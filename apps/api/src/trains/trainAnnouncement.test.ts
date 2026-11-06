import { describe, expect, it } from "vitest"
import canceledFixture from "../../test/fixtures/trainAnnouncement-canceled.json"
import overnightFixture from "../../test/fixtures/trainAnnouncement-overnight.json"
import runningFixture from "../../test/fixtures/trainAnnouncement-running.json"
import {
  buildAnnouncementQuery,
  parseAnnouncementResponse,
  toAnnouncement,
} from "./trainAnnouncement"

const recorded = runningFixture.RESPONSE.RESULT[0]?.TrainAnnouncement ?? []

function responseWith(items: unknown[]) {
  return { RESPONSE: { RESULT: [{ TrainAnnouncement: items }] } }
}

describe("buildAnnouncementQuery", () => {
  it("filters on train and date, and escapes values", () => {
    const query = buildAnnouncementQuery('a"b', "2026-11-06", "1<2")

    expect(query).toContain('authenticationkey="a&quot;b"')
    expect(query).toContain('name="AdvertisedTrainIdent" value="1&lt;2"')
    expect(query).toContain('<EQ name="Advertised" value="true"/>')
  })

  it("covers midnight in both summer and winter time", () => {
    const query = buildAnnouncementQuery("key", "2026-07-01", "179")

    expect(query).toContain(
      '<GTE name="ScheduledDepartureDateTime" value="2026-07-01T00:00:00+02:00"/>',
    )
    expect(query).toContain(
      '<LTE name="ScheduledDepartureDateTime" value="2026-07-01T00:00:00+01:00"/>',
    )
  })
})

describe("toAnnouncement", () => {
  const base = {
    ActivityType: "Avgang" as const,
    LocationSignature: "Cst",
    AdvertisedTimeAtLocation: "2026-11-06T15:14:00.000+01:00",
    Canceled: false,
    Deleted: false,
  }

  it("reads all fields", () => {
    const announcement = toAnnouncement({
      ...base,
      EstimatedTimeAtLocation: "2026-11-06T15:20:00.000+01:00",
      TimeAtLocation: "2026-11-06T15:21:00.000+01:00",
      TrackAtLocation: "17a",
      ProductInformation: [{ Description: "SJ Regional" }],
      InformationOwner: "SJ",
      FromLocation: [{ LocationName: "Cst" }],
      ToLocation: [{ LocationName: "G" }],
      Deviation: [{ Description: "Spårändrat" }],
      OtherInformation: [{ Description: "Vagn 2 obokad." }],
    })

    expect(announcement).toEqual({
      activity: "departure",
      signature: "Cst",
      advertisedAt: new Date("2026-11-06T14:14:00.000Z"),
      estimatedAt: new Date("2026-11-06T14:20:00.000Z"),
      actualAt: new Date("2026-11-06T14:21:00.000Z"),
      track: "17a",
      canceled: false,
      product: "SJ Regional",
      operator: "SJ",
      fromSignature: "Cst",
      toSignature: "G",
      deviations: ["Spårändrat"],
      otherInformation: ["Vagn 2 obokad."],
    })
  })

  it("uses null and empty lists for missing fields", () => {
    const announcement = toAnnouncement({ ...base, ActivityType: "Ankomst" })

    expect(announcement.activity).toBe("arrival")
    expect(announcement.estimatedAt).toBeNull()
    expect(announcement.actualAt).toBeNull()
    expect(announcement.track).toBeNull()
    expect(announcement.product).toBeNull()
    expect(announcement.operator).toBeNull()
    expect(announcement.fromSignature).toBeNull()
    expect(announcement.toSignature).toBeNull()
    expect(announcement.deviations).toEqual([])
    expect(announcement.otherInformation).toEqual([])
  })
})

describe("parseAnnouncementResponse", () => {
  it("parses a train under way, with actual and estimated times and deviations", () => {
    const announcements = parseAnnouncementResponse(runningFixture)

    expect(announcements).toHaveLength(recorded.length)
    expect(announcements.some((announcement) => announcement.actualAt !== null)).toBe(true)
    expect(announcements.some((announcement) => announcement.estimatedAt !== null)).toBe(true)
    expect(announcements.flatMap((announcement) => announcement.deviations)).toContain("Spårändrat")
    expect(announcements[0]?.operator).toBe("Skånetrafiken")
  })

  it("parses a train that runs past midnight and joins its product parts", () => {
    const announcements = parseAnnouncementResponse(overnightFixture)
    const midnightSwedishTime = new Date("2026-11-06T00:00:00.000+01:00")

    expect(
      announcements.some((announcement) => announcement.advertisedAt >= midnightSwedishTime),
    ).toBe(true)
    expect(announcements[0]?.product).toBe("SL Pendeltåg 43")
  })

  it("keeps canceled per location for a partly canceled train", () => {
    const announcements = parseAnnouncementResponse(canceledFixture)
    const canceled = announcements.filter((announcement) => announcement.canceled)

    expect(canceled).toHaveLength(7)
    expect(announcements).toHaveLength(13)
    expect(canceled[0]?.deviations).toContain("Buss ersätter")
  })

  it("skips deleted and invalid rows but keeps the rest", () => {
    const [first, second, ...rest] = recorded
    const deleted = { ...first, Deleted: true }
    const invalid = { ...second, LocationSignature: undefined }

    const announcements = parseAnnouncementResponse(responseWith([deleted, invalid, ...rest]))

    expect(announcements).toHaveLength(rest.length)
  })

  it("accepts a result without announcements", () => {
    expect(parseAnnouncementResponse({ RESPONSE: { RESULT: [{}] } })).toEqual([])
  })
})
