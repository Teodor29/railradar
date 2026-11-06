import type { AddressInfo } from "node:net"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { removeEventSchema, snapshotEventSchema, updateEventSchema } from "@railradar/shared"
import queryFixture from "../../test/fixtures/trainPosition-query.json"
import { createApp } from "../app"
import { trainPositionSchema, type TrainPosition } from "../ingest/trainPosition"
import { TrainStore } from "../ingest/trainState"
import { formatEvent, startBroadcast, type Broadcaster } from "./broadcaster"

// The stream does not need a database, and importing the real pool requires env.
vi.mock("../db/pool", () => ({ pingDb: async () => true }))

const positions = z.array(trainPositionSchema).parse(queryFixture.RESPONSE.RESULT[0]?.TrainPosition)

// A position for the given train, newer than anything in the fixture.
function laterPosition(trainNumber: string, active: boolean): TrainPosition {
  const base = positions.find((position) => position.Train.AdvertisedTrainNumber === trainNumber)
  if (!base) throw new Error(`Fixture has no train ${trainNumber}`)
  return {
    ...base,
    TimeStamp: "2026-11-02T16:00:00.000+01:00",
    Status: { Active: active },
    Deleted: false,
  }
}

describe("formatEvent", () => {
  it("formats a named SSE event with JSON data", () => {
    expect(formatEvent("remove", ["2026-11-02-1472"])).toBe(
      'event: remove\ndata: ["2026-11-02-1472"]\n\n',
    )
  })
})

describe("GET /api/stream", () => {
  let store: TrainStore
  let broadcaster: Broadcaster
  let baseUrl: string
  let closeServer: () => void

  beforeEach(async () => {
    // Only intervals are faked, so the sockets still work.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })

    store = new TrainStore()
    store.replaceAll(positions)
    store.takeChanges()

    broadcaster = startBroadcast(store)
    const server = createApp(broadcaster).listen(0)
    await new Promise((resolve) => server.once("listening", resolve))

    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`
    closeServer = () => server.close()
  })

  afterEach(() => {
    broadcaster.stop()
    closeServer()
    vi.useRealTimers()
  })

  // Reads from the stream until `count` complete events have arrived.
  async function readEvents(reader: ReadableStreamDefaultReader<Uint8Array>, count: number) {
    const decoder = new TextDecoder()
    let text = ""
    while (text.split("\n\n").length - 1 < count) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }

    return text
      .split("\n\n")
      .filter((chunk) => chunk !== "")
      .map((chunk) => {
        const [eventLine, dataLine] = chunk.split("\n")
        return {
          name: eventLine?.replace("event: ", ""),
          data: JSON.parse(dataLine?.replace("data: ", "") ?? "null") as unknown,
        }
      })
  }

  it("sends a snapshot, then batched updates and removals", async () => {
    const response = await fetch(`${baseUrl}/api/stream`)
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    expect(response.headers.get("access-control-allow-origin")).toBe("https://www.railradar.se")

    const reader = response.body!.getReader()
    const [snapshot] = await readEvents(reader, 1)
    expect(snapshot?.name).toBe("snapshot")
    expect(snapshotEventSchema.parse(snapshot?.data)).toHaveLength(17)

    store.applyPosition(laterPosition("1472", true))
    store.applyPosition(laterPosition("1872", false))

    vi.advanceTimersByTime(2000)
    const [update, remove] = await readEvents(reader, 2)

    expect(update?.name).toBe("update")
    expect(updateEventSchema.parse(update?.data).map((train) => train.n)).toEqual(["1472"])
    expect(remove?.name).toBe("remove")
    expect(removeEventSchema.parse(remove?.data)).toEqual(["2026-11-02-1872"])

    await reader.cancel()
  })
})
