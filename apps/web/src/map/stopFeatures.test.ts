import { describe, expect, it } from "vitest"
import type { TrainStop } from "@railradar/shared"
import { toStopFeatures, toStopLine } from "./stopFeatures"

function stop(overrides: Partial<TrainStop>): TrainStop {
  return {
    signature: "Lu",
    name: "Lund C",
    lat: 55.7,
    lon: 13.2,
    track: "2",
    arrival: null,
    departure: null,
    passed: false,
    canceled: false,
    deviations: [],
    ...overrides,
  }
}

describe("toStopFeatures", () => {
  it("places a stop at lon, lat", () => {
    const [feature] = toStopFeatures([stop({})]).features

    expect(feature?.geometry.coordinates).toEqual([13.2, 55.7])
  })

  it("carries the station name for the label", () => {
    const [feature] = toStopFeatures([stop({})]).features

    expect(feature?.properties?.name).toBe("Lund C")
  })

  it("dims passed and canceled stops but not upcoming ones", () => {
    const { features } = toStopFeatures([
      stop({ passed: true }),
      stop({ canceled: true }),
      stop({}),
    ])

    expect(features.map((feature) => feature.properties?.dimmed)).toEqual([true, true, false])
  })

  it("skips stops without a known position", () => {
    const { features } = toStopFeatures([stop({ lat: null, lon: null }), stop({})])

    expect(features).toHaveLength(1)
  })
})

describe("toStopLine", () => {
  it("connects the stops in order, leaving out canceled ones and unknown positions", () => {
    const { features } = toStopLine(
      [
        stop({ lat: 55.7, lon: 13.2 }),
        stop({ lat: 56, lon: 13.5, canceled: true }),
        stop({ lat: null, lon: null }),
        stop({ lat: 56.2, lon: 13.8 }),
      ],
      [13.1, 55.6],
    )

    expect(features[0]?.geometry.coordinates).toEqual([
      [13.1, 55.6],
      [13.2, 55.7],
      [13.8, 56.2],
    ])
  })

  it("dims the passed part and joins both parts at the train", () => {
    const { features } = toStopLine(
      [
        stop({ lat: 55, lon: 13, passed: true }),
        stop({ lat: 56, lon: 14, passed: true }),
        stop({ lat: 57, lon: 15 }),
      ],
      [14.5, 56.5],
    )

    expect(features.map((feature) => feature.properties?.dimmed)).toEqual([true, false])
    expect(features[0]?.geometry.coordinates).toEqual([
      [13, 55],
      [14, 56],
      [14.5, 56.5],
    ])
    expect(features[1]?.geometry.coordinates).toEqual([
      [14.5, 56.5],
      [15, 57],
    ])
  })

  it("has no passed part before the first stop is passed", () => {
    const { features } = toStopLine([stop({})], [13, 55])

    expect(features.map((feature) => feature.properties?.dimmed)).toEqual([false])
  })

  it("is empty without a train position", () => {
    expect(toStopLine([stop({}), stop({})], null).features).toEqual([])
  })
})
