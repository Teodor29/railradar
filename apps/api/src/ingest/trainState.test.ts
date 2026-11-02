import { describe, expect, it } from "vitest"
import { z } from "zod"
import queryFixture from "../../test/fixtures/trainPosition-query.json"
import { trainPositionSchema, type TrainPosition } from "./trainPosition"
import { TrainStore } from "./trainState"

const positions = z.array(trainPositionSchema).parse(queryFixture.RESPONSE.RESULT[0]?.TrainPosition)

const TRAIN_ID = "2026-11-02-1472"

// An active position for train 1472, measured at the given time.
function positionAt(timeStamp: string, changes: Partial<TrainPosition> = {}): TrainPosition {
  const base = positions.find((position) => position.Train.AdvertisedTrainNumber === "1472")
  if (!base) throw new Error("Fixture has no train 1472")
  return {
    ...base,
    TimeStamp: timeStamp,
    Status: { Active: true },
    Deleted: false,
    ...changes,
  }
}

describe("TrainStore.replaceAll", () => {
  it("keeps the newest position per train and drops inactive ones", () => {
    const store = new TrainStore()
    store.replaceAll(positions)

    // 20 positions: train 1472 appears twice, and two other trains are inactive.
    expect(store.size).toBe(17)
    expect(store.get(TRAIN_ID)?.measuredAt).toEqual(new Date("2026-11-02T14:37:24.000Z"))
  })

  it("does not depend on the order of the response", () => {
    const store = new TrainStore()
    store.replaceAll([...positions].reverse())

    expect(store.size).toBe(17)
    expect(store.get(TRAIN_ID)).toBeDefined()
  })

  it("clears trains from an earlier connection", () => {
    const store = new TrainStore()
    store.applyPosition(positionAt("2026-11-02T15:00:00.000+01:00"))
    store.replaceAll([])

    expect(store.size).toBe(0)
  })
})

describe("TrainStore.applyPosition", () => {
  it("updates a train with a newer position", () => {
    const store = new TrainStore()
    store.applyPosition(positionAt("2026-11-02T15:00:00.000+01:00", { Bearing: 10 }))
    store.applyPosition(positionAt("2026-11-02T15:00:05.000+01:00", { Bearing: 20 }))

    expect(store.get(TRAIN_ID)?.bearing).toBe(20)
  })

  it("ignores a position older than the current one", () => {
    const store = new TrainStore()
    store.applyPosition(positionAt("2026-11-02T15:00:05.000+01:00", { Bearing: 20 }))
    store.applyPosition(positionAt("2026-11-02T15:00:00.000+01:00", { Bearing: 10 }))

    expect(store.get(TRAIN_ID)?.bearing).toBe(20)
  })

  it("removes a train when the position is deleted", () => {
    const store = new TrainStore()
    store.applyPosition(positionAt("2026-11-02T15:00:00.000+01:00"))
    store.applyPosition(positionAt("2026-11-02T15:00:05.000+01:00", { Deleted: true }))

    expect(store.get(TRAIN_ID)).toBeUndefined()
  })

  it("removes a train when the position is inactive", () => {
    const store = new TrainStore()
    store.applyPosition(positionAt("2026-11-02T15:00:00.000+01:00"))
    store.applyPosition(positionAt("2026-11-02T15:00:05.000+01:00", { Status: { Active: false } }))

    expect(store.get(TRAIN_ID)).toBeUndefined()
  })

  it("ignores a removal older than the current position", () => {
    const store = new TrainStore()
    store.applyPosition(positionAt("2026-11-02T15:00:05.000+01:00"))
    store.applyPosition(positionAt("2026-11-02T15:00:00.000+01:00", { Status: { Active: false } }))

    expect(store.get(TRAIN_ID)).toBeDefined()
  })
})

describe("TrainStore.pruneStale", () => {
  it("removes trains not seen for more than 30 minutes", () => {
    const store = new TrainStore()
    store.applyPosition(positionAt("2026-11-02T15:00:00.000+01:00"))

    store.pruneStale(new Date("2026-11-02T15:30:00.000+01:00"))
    expect(store.size).toBe(1)

    store.pruneStale(new Date("2026-11-02T15:30:01.000+01:00"))
    expect(store.size).toBe(0)
  })
})
