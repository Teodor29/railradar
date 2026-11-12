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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const upstreamError = new HttpError(502, "upstream_error", "Could not fetch train")

    const response = await request(async () => {
      throw upstreamError
    })

    expect(response.status).toBe(502)
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe("upstream_error")
    expect(consoleError).toHaveBeenCalledWith(upstreamError)

    consoleError.mockRestore()
  })

  it("limits how often one client can ask", async () => {
    const response = await request(async () => details)
    const url = response.url

    const statuses = []
    for (let i = 0; i < 60; i++) {
      statuses.push((await fetch(url)).status)
    }

    expect(statuses.slice(0, 59).every((status) => status === 200)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
    const limited = await fetch(url)
    expect(apiErrorSchema.parse(await limited.json()).error.code).toBe("rate_limited")
  })
})

describe("CORS", () => {
  const PRODUCTION = "https://www.railradar.se"
  const PREVIEW = "https://railradar-git-feat-info-panel-teodor29s-projects.vercel.app"
  let server: Server

  async function allowedOriginFor(origin: string): Promise<string | null> {
    server = createApp(broadcaster, async () => null).listen(0)
    await new Promise((resolve) => server.once("listening", resolve))

    const { port } = server.address() as AddressInfo
    const response = await fetch(`http://localhost:${port}/api/trains/2026-11-06-179`, {
      headers: { Origin: origin },
    })
    return response.headers.get("access-control-allow-origin")
  }

  afterEach(() => {
    server.close()
  })

  it("allows the production site", async () => {
    expect(await allowedOriginFor(PRODUCTION)).toBe(PRODUCTION)
  })

  it("allows the project's Vercel previews", async () => {
    expect(await allowedOriginFor(PREVIEW)).toBe(PREVIEW)
  })

  it.each([
    "https://evil.example",
    "https://railradar-evil.vercel.app",
    "https://railradar-x-teodor29s-projects.vercel.app.evil.example",
    "http://railradar-x-teodor29s-projects.vercel.app",
  ])("doesn't allow %s", async (origin) => {
    expect(await allowedOriginFor(origin)).toBe(PRODUCTION)
  })
})
