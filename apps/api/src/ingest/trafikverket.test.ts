import { describe, expect, it } from "vitest"
import queryFixture from "../../test/fixtures/trainPosition-query.json"
import { buildQuery, parseResponse } from "./trafikverket"

describe("buildQuery", () => {
  it("filters on an absolute timestamp", () => {
    const query = buildQuery("key", new Date("2026-11-02T14:00:00.000Z"))

    expect(query).toContain('<GT name="TimeStamp" value="2026-11-02T14:00:00.000Z"/>')
    expect(query).toContain('sseurl="true"')
  })

  it("escapes the API key", () => {
    const query = buildQuery('a"b<c', new Date())

    expect(query).toContain('authenticationkey="a&quot;b&lt;c"')
  })
})

describe("parseResponse", () => {
  it("returns positions and the SSE URL from a recorded response", () => {
    const { positions, sseUrl } = parseResponse(queryFixture)

    expect(positions).toHaveLength(20)
    expect(sseUrl).toBe("https://example.invalid/sse?token=redacted")
  })

  it("skips invalid positions but keeps the rest", () => {
    const [first, ...rest] = queryFixture.RESPONSE.RESULT[0]?.TrainPosition ?? []
    const broken = { ...first, Position: { WGS84: 42 } }
    const json = { RESPONSE: { RESULT: [{ TrainPosition: [broken, ...rest] }] } }

    const { positions, sseUrl } = parseResponse(json)

    expect(positions).toHaveLength(19)
    expect(sseUrl).toBeNull()
  })

  it("accepts a result without positions", () => {
    expect(parseResponse({ RESPONSE: { RESULT: [{}] } }).positions).toEqual([])
  })
})
