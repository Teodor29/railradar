import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { StreamTrain } from "@railradar/shared"
import { TrainStore, type StreamSource, type TrainChanges } from "./store"

const OPEN = 1
const CLOSED = 2

class FakeSource implements StreamSource {
  readyState = OPEN
  private listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>()

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  close(): void {
    this.readyState = CLOSED
  }

  send(type: string, data: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(data) })
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }

  fail(): void {
    this.readyState = CLOSED
    for (const listener of this.listeners.get("error") ?? []) {
      listener(new MessageEvent("error"))
    }
  }
}

function train(id: string, overrides: Partial<StreamTrain> = {}): StreamTrain {
  return {
    i: id,
    n: id.split("-").at(-1) ?? id,
    la: 55.6,
    lo: 13.0,
    s: null,
    b: 90,
    t: 0,
    ...overrides,
  }
}

describe("TrainStore", () => {
  let sources: FakeSource[]
  let store: TrainStore
  let changes: TrainChanges[]

  // The source the store is currently using.
  function current(): FakeSource {
    const source = sources.at(-1)
    if (!source) {
      throw new Error("Store has not connected")
    }
    return source
  }

  beforeEach(() => {
    vi.useFakeTimers()
    sources = []
    changes = []
    store = new TrainStore("/api/stream", () => {
      const source = new FakeSource()
      sources.push(source)
      return source
    })
    store.subscribe((change) => changes.push(change))
    store.start()
  })

  afterEach(() => {
    store.stop()
    vi.useRealTimers()
  })

  it("fills the store from a snapshot", () => {
    current().send("snapshot", [train("a"), train("b")])

    expect(store.size).toBe(2)
    expect(changes).toEqual([{ updated: ["a", "b"], removed: [] }])
  })

  it("replaces everything on a new snapshot and reports trains that are gone", () => {
    current().send("snapshot", [train("a"), train("b")])
    current().send("snapshot", [train("b"), train("c")])

    expect(store.all().map((item) => item.i)).toEqual(["b", "c"])
    expect(changes.at(-1)).toEqual({ updated: ["b", "c"], removed: ["a"] })
  })

  it("applies updates and removes", () => {
    current().send("snapshot", [train("a"), train("b")])
    current().send("update", [train("a", { la: 56 })])
    current().send("remove", ["b", "unknown"])

    expect(store.get("a")?.la).toBe(56)
    expect(store.get("b")).toBeUndefined()
    expect(changes.slice(1)).toEqual([
      { updated: ["a"], removed: [] },
      { updated: [], removed: ["b"] },
    ])
  })

  it("ignores events that don't match the schema", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    current().send("update", [{ i: "a" }])

    expect(store.size).toBe(0)
    expect(changes).toEqual([])
  })

  it("uses the heartbeat to follow server time", () => {
    vi.setSystemTime(1_000_000)
    current().send("heartbeat", { t: 1_060 })

    expect(store.serverNow()).toBe(1_060_000)
  })

  it("reconnects with backoff when the stream closes", () => {
    current().fail()
    expect(sources).toHaveLength(1)

    vi.advanceTimersByTime(1_000)
    expect(sources).toHaveLength(2)

    current().fail()
    vi.advanceTimersByTime(1_000)
    expect(sources).toHaveLength(2)
    vi.advanceTimersByTime(1_000)
    expect(sources).toHaveLength(3)
  })

  it("resets the backoff once a snapshot arrives", () => {
    current().fail()
    vi.advanceTimersByTime(1_000)
    current().send("snapshot", [])

    current().fail()
    vi.advanceTimersByTime(1_000)
    expect(sources).toHaveLength(3)
  })

  it("reconnects when the stream goes silent", () => {
    vi.advanceTimersByTime(40_000)
    expect(sources).toHaveLength(1)

    vi.advanceTimersByTime(10_000)
    vi.advanceTimersByTime(1_000)
    expect(sources[0]?.readyState).toBe(CLOSED)
    expect(sources).toHaveLength(2)
  })

  it("stays connected while heartbeats arrive", () => {
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(15_000)
      current().send("heartbeat", { t: Math.round(Date.now() / 1000) })
    }

    expect(sources).toHaveLength(1)
  })
})
