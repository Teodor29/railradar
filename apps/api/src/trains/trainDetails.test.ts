import { describe, expect, it } from "vitest"
import canceledFixture from "../../test/fixtures/trainAnnouncement-canceled.json"
import overnightFixture from "../../test/fixtures/trainAnnouncement-overnight.json"
import runningFixture from "../../test/fixtures/trainAnnouncement-running.json"
import type { Station } from "../stations/trainStation"
import { parseAnnouncementResponse, type Announcement } from "./trainAnnouncement"
import { buildTrainDetails, parseTrainId } from "./trainDetails"

const noStations = new Map<string, Station>()

function announcement(overrides: Partial<Announcement>): Announcement {
  return {
    activity: "departure",
    signature: "Cst",
    advertisedAt: new Date("2026-11-06T10:00:00Z"),
    estimatedAt: null,
    actualAt: null,
    track: null,
    canceled: false,
    product: null,
    operator: null,
    fromSignature: null,
    toSignature: null,
    deviations: [],
    otherInformation: [],
    ...overrides,
  }
}

function build(announcements: Announcement[], stations = noStations) {
  const details = buildTrainDetails("2026-11-06-1", "1", announcements, stations)
  if (!details) throw new Error("Expected train details")
  return details
}

// Cst -> U -> G, with one row per arrival and departure.
const journey = {
  cstDeparture: announcement({ signature: "Cst", advertisedAt: new Date("2026-11-06T10:00:00Z") }),
  uArrival: announcement({
    activity: "arrival",
    signature: "U",
    advertisedAt: new Date("2026-11-06T10:30:00Z"),
  }),
  uDeparture: announcement({ signature: "U", advertisedAt: new Date("2026-11-06T10:30:00Z") }),
  gArrival: announcement({
    activity: "arrival",
    signature: "G",
    advertisedAt: new Date("2026-11-06T11:00:00Z"),
  }),
}

describe("parseTrainId", () => {
  it("splits date and train number", () => {
    expect(parseTrainId("2026-11-06-179")).toEqual({
      departureDate: "2026-11-06",
      trainNumber: "179",
    })
  })

  it("rejects ids without a date or number", () => {
    expect(parseTrainId("179")).toBeNull()
    expect(parseTrainId("2026-11-06-")).toBeNull()
  })

  it("rejects train numbers that aren't digits", () => {
    expect(parseTrainId("2026-11-06-179A")).toBeNull()
    expect(parseTrainId("2026-11-06-1'</FILTER>")).toBeNull()
    expect(parseTrainId("2026-11-06-1234567")).toBeNull()
  })
})

describe("buildTrainDetails", () => {
  it("returns null for a train without announcements", () => {
    expect(buildTrainDetails("2026-11-06-1", "1", [], noStations)).toBeNull()
  })

  it("groups rows into sorted stops, with arrival before departure in the same minute", () => {
    const { uDeparture, gArrival, uArrival, cstDeparture } = journey

    const { stops } = build([uDeparture, gArrival, uArrival, cstDeparture])

    expect(stops.map((stop) => stop.signature)).toEqual(["Cst", "U", "G"])
    expect(stops[0]?.arrival).toBeNull()
    expect(stops[1]?.arrival).not.toBeNull()
    expect(stops[1]?.departure).not.toBeNull()
    expect(stops[2]?.departure).toBeNull()
  })

  it("translates signatures to names and falls back to the signature", () => {
    const stations = new Map<string, Station>([
      ["Cst", { signature: "Cst", name: "Stockholm C", lat: 59.33, lon: 18.05 }],
    ])

    const details = build(
      [{ ...journey.cstDeparture, fromSignature: "Cst", toSignature: "G" }, journey.gArrival],
      stations,
    )

    expect(details.from).toBe("Stockholm C")
    expect(details.to).toBe("G")
    expect(details.stops[0]).toMatchObject({ name: "Stockholm C", lat: 59.33, lon: 18.05 })
    expect(details.stops[1]).toMatchObject({ name: "G", lat: null, lon: null })
  })

  describe("passed and next stop", () => {
    const { cstDeparture, uArrival, uDeparture, gArrival } = journey
    const actualAt = new Date("2026-11-06T10:30:00Z")

    it("starts at the first stop before any report", () => {
      const details = build([cstDeparture, uArrival, uDeparture, gArrival])

      expect(details.stops.map((stop) => stop.passed)).toEqual([false, false, false])
      expect(details.nextStopIndex).toBe(0)
    })

    it("keeps a stop as next while the train stands there", () => {
      const details = build([
        { ...cstDeparture, actualAt },
        { ...uArrival, actualAt },
        uDeparture,
        gArrival,
      ])

      expect(details.stops.map((stop) => stop.passed)).toEqual([true, false, false])
      expect(details.nextStopIndex).toBe(1)
    })

    it("passes earlier stops even if their reports are missing", () => {
      const details = build([cstDeparture, uArrival, { ...uDeparture, actualAt }, gArrival])

      expect(details.stops.map((stop) => stop.passed)).toEqual([true, true, false])
      expect(details.nextStopIndex).toBe(2)
    })

    it("has no next stop once the train has arrived", () => {
      const details = build([cstDeparture, uArrival, uDeparture, { ...gArrival, actualAt }])

      expect(details.stops.every((stop) => stop.passed)).toBe(true)
      expect(details.nextStopIndex).toBeNull()
    })

    it("skips canceled stops", () => {
      const details = build([
        { ...cstDeparture, actualAt },
        { ...uArrival, canceled: true },
        { ...uDeparture, canceled: true },
        gArrival,
      ])

      expect(details.nextStopIndex).toBe(2)
    })
  })

  describe("cancellation", () => {
    const { cstDeparture, gArrival } = journey

    it("is none when no row is canceled", () => {
      expect(build([cstDeparture, gArrival]).cancellation).toBe("none")
    })

    it("is partial when some rows are canceled", () => {
      const details = build([{ ...cstDeparture, canceled: true }, gArrival])

      expect(details.cancellation).toBe("partial")
      expect(details.stops.map((stop) => stop.canceled)).toEqual([true, false])
    })

    it("is full when all rows are canceled", () => {
      const details = build([
        { ...cstDeparture, canceled: true },
        { ...gArrival, canceled: true },
      ])

      expect(details.cancellation).toBe("full")
      expect(details.nextStopIndex).toBeNull()
    })
  })

  describe("delay", () => {
    const { cstDeparture, gArrival } = journey

    it("is null when nothing is reported or estimated", () => {
      expect(build([cstDeparture, gArrival]).delayMinutes).toBeNull()
    })

    it("uses the last reported time", () => {
      const details = build([
        { ...cstDeparture, actualAt: new Date("2026-11-06T10:04:00Z") },
        gArrival,
      ])

      expect(details.delayMinutes).toBe(4)
    })

    it("prefers the estimate for the next stop", () => {
      const details = build([
        { ...cstDeparture, actualAt: new Date("2026-11-06T10:04:00Z") },
        { ...gArrival, estimatedAt: new Date("2026-11-06T11:15:00Z") },
      ])

      expect(details.delayMinutes).toBe(15)
    })

    it("ignores estimates for stops already reported and for canceled stops", () => {
      const details = build([
        {
          ...cstDeparture,
          estimatedAt: new Date("2026-11-06T10:30:00Z"),
          actualAt: new Date("2026-11-06T10:02:00Z"),
        },
        { ...gArrival, canceled: true, estimatedAt: new Date("2026-11-06T11:30:00Z") },
      ])

      expect(details.delayMinutes).toBe(2)
    })

    it("can be negative for a train ahead of time", () => {
      const details = build([
        { ...cstDeparture, actualAt: new Date("2026-11-06T09:59:00Z") },
        gArrival,
      ])

      expect(details.delayMinutes).toBe(-1)
    })
  })

  it("lists deviations only for stops not yet passed, without duplicates", () => {
    const { cstDeparture, uArrival, uDeparture, gArrival } = journey

    const details = build([
      { ...cstDeparture, actualAt: new Date("2026-11-06T10:00:00Z"), deviations: ["Spårändrat"] },
      { ...uArrival, deviations: ["Kort tåg"] },
      { ...uDeparture, deviations: ["Kort tåg"] },
      { ...gArrival, deviations: ["Kort tåg", "Buss ersätter"] },
    ])

    expect(details.deviations).toEqual(["Kort tåg", "Buss ersätter"])
    expect(details.stops[0]?.deviations).toEqual(["Spårändrat"])
  })

  describe("recorded trains", () => {
    it("builds a partly canceled train", () => {
      const details = build(parseAnnouncementResponse(canceledFixture))

      expect(details.cancellation).toBe("partial")
      expect(details.product).toBe("Mälartåg")
      expect(details.operator).toBe("Mälardalstrafik AB")
      expect(details.stops).toHaveLength(8)
      expect(details.stops.filter((stop) => stop.canceled).map((stop) => stop.signature)).toEqual([
        "Cst",
        "Flb",
        "Söö",
        "Gn",
      ])
      expect(details.stops[details.nextStopIndex ?? -1]?.signature).toBe("Fle")
      expect(details.deviations).toContain("Buss ersätter")
    })

    it("keeps a train that runs past midnight in order", () => {
      const details = build(parseAnnouncementResponse(overnightFixture))

      expect(details.stops).toHaveLength(28)
      expect(details.stops[0]?.signature).toBe("Bål")
      expect(details.stops.at(-1)?.signature).toBe("Nyc")
      expect(details.stops.every((stop) => stop.passed)).toBe(true)
      expect(details.nextStopIndex).toBeNull()
    })

    it("places a train under way", () => {
      const details = build(parseAnnouncementResponse(runningFixture))
      const nextStopIndex = details.nextStopIndex ?? -1

      expect(details.stops).toHaveLength(29)
      expect(nextStopIndex).toBeGreaterThan(0)
      expect(details.stops.slice(0, nextStopIndex).every((stop) => stop.passed)).toBe(true)
      expect(details.stops.slice(nextStopIndex).some((stop) => stop.passed)).toBe(false)
      expect(details.delayMinutes).toBeGreaterThan(0)
    })
  })
})
