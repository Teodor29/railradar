import { describe, expect, it } from "vitest"
import queryFixture from "../../test/fixtures/trainStation-query.json"
import { buildStationQuery, parseStationResponse, toStation } from "./trainStation"

const recorded = queryFixture.RESPONSE.RESULT[0]?.TrainStation ?? []

function responseWith(items: unknown[]) {
  return { RESPONSE: { RESULT: [{ TrainStation: items }] } }
}

describe("buildStationQuery", () => {
  it("asks for the fields we use and escapes the API key", () => {
    const query = buildStationQuery('a"b')

    expect(query).toContain('authenticationkey="a&quot;b"')
    expect(query).toContain('objecttype="TrainStation"')
    expect(query).toContain("<INCLUDE>Geometry.WGS84</INCLUDE>")
  })
})

describe("toStation", () => {
  it("reads name and position", () => {
    const station = toStation({
      LocationSignature: "A",
      AdvertisedLocationName: "Alingsås",
      Geometry: { WGS84: "POINT (12.532185446104254 57.92690516743591)" },
      Deleted: false,
    })

    expect(station).toEqual({
      signature: "A",
      name: "Alingsås",
      lat: 57.92690516743591,
      lon: 12.532185446104254,
    })
  })

  it("keeps a station without a usable position, since the name is still needed", () => {
    const station = toStation({
      LocationSignature: "A",
      AdvertisedLocationName: "Alingsås",
      Deleted: false,
    })

    expect(station.lat).toBeNull()
    expect(station.lon).toBeNull()
  })
})

describe("parseStationResponse", () => {
  it("parses every station in the recorded response", () => {
    const stations = parseStationResponse(queryFixture)

    expect(stations).toHaveLength(recorded.length)
    expect(stations.every((station) => station.lat !== null && station.lon !== null)).toBe(true)
  })

  it("keeps stations that aren't advertised, since they can still be looked up", () => {
    const unadvertised = recorded.filter((station) => !station.Advertised)
    expect(unadvertised.length).toBeGreaterThan(0)

    const signatures = parseStationResponse(queryFixture).map((station) => station.signature)
    for (const station of unadvertised) {
      expect(signatures).toContain(station.LocationSignature)
    }
  })

  it("skips deleted and invalid stations but keeps the rest", () => {
    const [first, second, ...rest] = recorded
    const deleted = { ...first, Deleted: true }
    const invalid = { ...second, LocationSignature: undefined }

    const stations = parseStationResponse(responseWith([deleted, invalid, ...rest]))

    expect(stations).toHaveLength(rest.length)
  })

  it("accepts a result without stations", () => {
    expect(parseStationResponse({ RESPONSE: { RESULT: [{}] } })).toEqual([])
  })
})
