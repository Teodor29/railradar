import { describe, expect, it } from "vitest"
import type { StreamTrain, TrainDetails, TrainStop } from "@railradar/shared"
import {
  formatDelay,
  formatTime,
  getCanceledStopsNotice,
  getCurrentStation,
  getDisplayTime,
  getTrainName,
  getTrainStatus,
  getUpcomingCall,
} from "./format"

const train: StreamTrain = {
  i: "2026-11-07-1047",
  n: "1047",
  la: 55.7,
  lo: 13.2,
  s: 142,
  b: 180,
  t: 1_000,
}

function stop(overrides: Partial<TrainStop>): TrainStop {
  return {
    signature: "Lu",
    name: "Lund C",
    lat: null,
    lon: null,
    track: "2",
    arrival: null,
    departure: null,
    passed: false,
    canceled: false,
    deviations: [],
    ...overrides,
  }
}

function details(overrides: Partial<TrainDetails>): TrainDetails {
  return {
    id: "2026-11-07-1047",
    trainNumber: "1047",
    product: null,
    operator: null,
    from: null,
    to: null,
    cancellation: "none",
    delayMinutes: null,
    nextStopIndex: null,
    deviations: [],
    otherInformation: [],
    stops: [],
    ...overrides,
  }
}

const call = { advertisedAt: "2026-11-07T13:32:00.000Z", estimatedAt: null, actualAt: null }
const reportedCall = { ...call, actualAt: "2026-11-07T13:33:00.000Z" }

describe("formatTime", () => {
  it("shows Swedish local time, also in summer", () => {
    expect(formatTime("2026-11-07T13:36:00.000Z")).toBe("14:36")
    expect(formatTime("2026-07-01T13:36:00.000Z")).toBe("15:36")
  })
})

describe("formatDelay", () => {
  it("shows on time for no or negative delay", () => {
    expect(formatDelay(0)).toBe("I tid")
    expect(formatDelay(-2)).toBe("I tid")
    expect(formatDelay(4)).toBe("+4 min")
  })
})

describe("getTrainStatus", () => {
  const now = (1_000 + 60) * 1000
  const atLund = details({
    nextStopIndex: 0,
    stops: [stop({ arrival: reportedCall, departure: call })],
  })

  it("puts cancellation before staleness", () => {
    const later = 1_000_000 * 1000
    const canceled = details({ cancellation: "full" })
    expect(getTrainStatus(canceled, train, later)).toEqual({ kind: "canceled" })
  })

  it("is stale after 2 min without position", () => {
    expect(getTrainStatus(null, train, (1_000 + 185) * 1000)).toEqual({
      kind: "stale",
      minutesAgo: 3,
    })
  })

  it("shows the speed while moving, also at a station", () => {
    expect(getTrainStatus(atLund, train, now)).toEqual({ kind: "moving", speed: 142 })
  })

  it("names the station when standing at one", () => {
    const standing = { ...train, s: 0 }
    expect(getTrainStatus(atLund, standing, now)).toEqual({
      kind: "at-station",
      station: "Lund C",
    })
    expect(getTrainStatus(null, standing, now)).toEqual({ kind: "stopped" })
  })

  it("is only running without a speed", () => {
    expect(getTrainStatus(null, { ...train, s: null }, now)).toEqual({ kind: "running" })
  })
})

describe("getCurrentStation", () => {
  it("is the first stop before departure", () => {
    const starting = details({ nextStopIndex: 0, stops: [stop({ departure: call })] })
    expect(getCurrentStation(starting)).toBe("Lund C")
  })

  it("is nothing on the way to the next stop", () => {
    const onTheWay = details({ nextStopIndex: 0, stops: [stop({ arrival: call })] })
    expect(getCurrentStation(onTheWay)).toBeNull()
  })

  it("is the last stop once arrived there", () => {
    const arrived = details({ stops: [stop({ arrival: reportedCall, passed: true })] })
    expect(getCurrentStation(arrived)).toBe("Lund C")
  })
})

describe("getCanceledStopsNotice", () => {
  const canceledAhead = (name: string) => stop({ name, canceled: true })

  it("names canceled stops ahead, not passed ones", () => {
    const partial = details({
      cancellation: "partial",
      stops: [
        stop({ name: "Malmö C", canceled: true, passed: true }),
        canceledAhead("Lund C"),
        canceledAhead("Eslöv"),
      ],
    })
    expect(getCanceledStopsNotice(partial)).toBe("Stannar inte i Lund C och Eslöv")
  })

  it("counts many stops and skips fully canceled trains", () => {
    const many = ["A", "B", "C", "D"].map(canceledAhead)
    expect(getCanceledStopsNotice(details({ stops: many }))).toBe("Stannar inte i 4 stationer")
    expect(getCanceledStopsNotice(details({ cancellation: "full", stops: many }))).toBeNull()
  })
})

describe("getUpcomingCall", () => {
  const arrival = { advertisedAt: "2026-11-07T13:32:00.000Z", estimatedAt: null, actualAt: null }
  const departure = { advertisedAt: "2026-11-07T13:34:00.000Z", estimatedAt: null, actualAt: null }

  it("uses arrival until the train has arrived", () => {
    expect(getUpcomingCall(stop({ arrival, departure }))).toBe(arrival)
  })

  it("uses departure once the train has arrived", () => {
    const arrived = { ...arrival, actualAt: "2026-11-07T13:33:00.000Z" }
    expect(getUpcomingCall(stop({ arrival: arrived, departure }))).toBe(departure)
  })

  it("uses departure at the first stop", () => {
    expect(getUpcomingCall(stop({ departure }))).toBe(departure)
  })
})

describe("getDisplayTime", () => {
  it("shows the planned time only when it differs", () => {
    const onTime = { advertisedAt: "2026-11-07T13:32:00.000Z", estimatedAt: null, actualAt: null }
    expect(getDisplayTime(onTime)).toEqual({ time: "14:32", plannedTime: null, late: false })

    const late = { ...onTime, estimatedAt: "2026-11-07T13:36:00.000Z" }
    expect(getDisplayTime(late)).toEqual({ time: "14:36", plannedTime: "14:32", late: true })

    const reported = { ...late, actualAt: "2026-11-07T13:37:00.000Z" }
    expect(getDisplayTime(reported)).toEqual({ time: "14:37", plannedTime: "14:32", late: true })
  })

  it("marks early times as not late", () => {
    const early = {
      advertisedAt: "2026-11-07T13:32:00.000Z",
      estimatedAt: null,
      actualAt: "2026-11-07T13:30:00.000Z",
    }
    expect(getDisplayTime(early)).toEqual({ time: "14:30", plannedTime: "14:32", late: false })
  })
})

describe("getTrainName", () => {
  it("names the train by product and number", () => {
    expect(getTrainName("Pågatågen", "1735")).toBe("Tåg 1735 · Pågatågen")
    expect(getTrainName(null, "1735")).toBe("Tåg 1735")
  })
})
