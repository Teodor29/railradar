import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createTtlCache } from "./ttlCache"

describe("createTtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("loads once within the TTL and again after it", async () => {
    const load = vi.fn(async (key: string) => `${key}-value`)
    const get = createTtlCache(load, 1000)

    expect(await get("a")).toBe("a-value")
    vi.advanceTimersByTime(999)
    await get("a")
    expect(load).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    await get("a")
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("shares one load between concurrent calls", async () => {
    const load = vi.fn(async () => "value")
    const get = createTtlCache(load, 1000)

    await Promise.all([get("a"), get("a")])

    expect(load).toHaveBeenCalledTimes(1)
  })

  it("keeps keys apart", async () => {
    const load = vi.fn(async (key: string) => key)
    const get = createTtlCache(load, 1000)

    expect(await get("a")).toBe("a")
    expect(await get("b")).toBe("b")
  })

  it("loads again after a failed load", async () => {
    const load = vi.fn<() => Promise<string>>()
    load.mockRejectedValueOnce(new Error("failed"))
    load.mockResolvedValueOnce("value")
    const get = createTtlCache(load, 1000)

    await expect(get("a")).rejects.toThrow("failed")

    expect(await get("a")).toBe("value")
  })
})
