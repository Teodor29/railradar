import { describe, expect, it } from "vitest"
import { streamTrainSchema } from "@railradar/shared"
import { toStreamTrain } from "./compact"

describe("toStreamTrain", () => {
  it("maps to short keys with rounded coordinates and epoch seconds", () => {
    const streamTrain = toStreamTrain({
      id: "2026-11-02-1472",
      trainNumber: "1472",
      departureDate: "2026-11-02",
      lat: 55.6058712345,
      lon: 13.0007898765,
      speed: 87,
      bearing: 214,
      measuredAt: new Date("2026-11-02T14:37:24.400Z"),
    })

    expect(streamTrain).toEqual({
      i: "2026-11-02-1472",
      n: "1472",
      la: 55.60587,
      lo: 13.00079,
      s: 87,
      b: 214,
      t: Date.parse("2026-11-02T14:37:24.000Z") / 1000,
    })
    expect(streamTrainSchema.safeParse(streamTrain).success).toBe(true)
  })

  it("keeps missing speed as null", () => {
    const streamTrain = toStreamTrain({
      id: "2026-11-02-1472",
      trainNumber: "1472",
      departureDate: "2026-11-02",
      lat: 55.6,
      lon: 13,
      speed: null,
      bearing: 0,
      measuredAt: new Date("2026-11-02T14:37:24.000Z"),
    })

    expect(streamTrain.s).toBeNull()
  })
})
