import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, describe, expect, it, vi } from "vitest"
import { apiErrorSchema, trainDetailsSchema, type TrainDetails } from "@railradar/shared"
import { createApp } from "./app"
import { HttpError } from "./errors"

// The route does not need a database, and importing the real pool requires env.
vi.mock("./db/pool", () => ({ pingDb: async () => true }))

const details: TrainDetails = {
  id: "2026-11-06-179",
  trainNumber: "179",
  product: "SJ Regional",
  operator: "SJ",
  from: "Stockholm C",
  to: "Göteborg C",
  cancellation: "none",
  delayMinutes: 3,
  nextStopIndex: null,
  deviations: [],
  otherInformation: [],
  stops: [],
}

const broadcaster = { addClient: () => {}, stop: () => {} }

describe("GET /api/trains/:id", () => {
  let server: Server

  async function request(getTrainDetails: (id: string) => Promise<TrainDetails | null>) {
    server = createApp(broadcaster, getTrainDetails).listen(0)
    await new Promise((resolve) => server.once("listening", resolve))

    const { port } = server.address() as AddressInfo
    return fetch(`http://localhost:${port}/api/trains/2026-11-06-179`)
  }

  afterEach(() => {
    server.close()
  })

  it("returns the details of the requested train", async () => {
    const getTrainDetails = vi.fn(async () => details)

    const response = await request(getTrainDetails)

    expect(response.status).toBe(200)
    expect(trainDetailsSchema.parse(await response.json())).toEqual(details)
    expect(getTrainDetails).toHaveBeenCalledWith("2026-11-06-179")
  })

  it("returns 404 for a train that doesn't exist", async () => {
    const response = await request(async () => null)

    expect(response.status).toBe(404)
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe("train_not_found")
  })

  it("passes on an upstream failure", async () => {
    const response = await request(async () => {
      throw new HttpError(502, "upstream_error", "Could not fetch train")
    })

    expect(response.status).toBe(502)
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe("upstream_error")
  })
})
