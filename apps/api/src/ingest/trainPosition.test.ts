import { describe, expect, it } from "vitest"
import { z } from "zod"
import queryFixture from "../../test/fixtures/trainPosition-query.json"
import {
  isRemoval,
  parseWktPoint,
  toTrainState,
  trainPositionSchema,
  type TrainPosition,
} from "./trainPosition"

const positions = z.array(trainPositionSchema).parse(queryFixture.RESPONSE.RESULT[0]?.TrainPosition)

function firstPosition(): TrainPosition {
  const position = positions[0]
  if (!position) throw new Error("Fixture is empty")
  return position
}

describe("trainPositionSchema", () => {
  it("parses every position in the recorded response", () => {
    expect(positions).toHaveLength(20)
  })

  it("rejects a position without coordinates", () => {
    const withoutPosition = { ...firstPosition(), Position: undefined }
    expect(trainPositionSchema.safeParse(withoutPosition).success).toBe(false)
  })
})

describe("parseWktPoint", () => {
  it("reads lon before lat", () => {
    expect(parseWktPoint("POINT (15.68084174019192 58.13413237549775)")).toEqual({
      lat: 58.13413237549775,
      lon: 15.68084174019192,
    })
  })

  it("returns null for anything that isn't a point", () => {
    expect(parseWktPoint("LINESTRING (1 2, 3 4)")).toBeNull()
    expect(parseWktPoint("POINT EMPTY")).toBeNull()
  })
})

describe("toTrainState", () => {
  it("maps a recorded position", () => {
    expect(toTrainState(firstPosition())).toEqual({
      id: "2026-11-02-1472",
      trainNumber: "1472",
      departureDate: "2026-11-02",
      lat: 55.56254886212555,
      lon: 12.9754294436625,
      speed: 5,
      bearing: 58,
      measuredAt: new Date("2026-11-02T14:08:04.000Z"),
    })
  })

  it("uses null when speed is missing", () => {
    const withoutSpeed = positions.find((position) => position.Speed === undefined)
    if (!withoutSpeed) throw new Error("Fixture has no position without speed")
    expect(toTrainState(withoutSpeed)?.speed).toBeNull()
  })

  it("skips trains without an advertised number", () => {
    const position = firstPosition()
    const unadvertised = {
      ...position,
      Train: { ...position.Train, AdvertisedTrainNumber: undefined },
    }
    expect(toTrainState(unadvertised)).toBeNull()
  })
})

describe("isRemoval", () => {
  it("is true for deleted or inactive positions", () => {
    const position = firstPosition()
    const active = { ...position, Status: { Active: true }, Deleted: false }

    expect(isRemoval(active)).toBe(false)
    expect(isRemoval({ ...active, Deleted: true })).toBe(true)
    expect(isRemoval({ ...active, Status: { Active: false } })).toBe(true)
  })
})
