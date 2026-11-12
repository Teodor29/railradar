import express from "express"
import { rateLimit } from "express-rate-limit"
import type { Health, TrainDetails } from "@railradar/shared"
import { pingDb } from "./db/pool"
import { errorHandler, HttpError, notFound } from "./errors"
import type { Broadcaster } from "./stream/broadcaster"
import { upstream } from "./upstream"

// The frontend is hosted separately, on Vercel.
const WEB_ORIGIN = "https://www.railradar.se"
const PREVIEW_ORIGIN_PATTERN = /^https:\/\/railradar-[a-z0-9-]+-teodor29s-projects\.vercel\.app$/

function getAllowedOrigin(origin: string | undefined): string {
  if (origin && PREVIEW_ORIGIN_PATTERN.test(origin)) {
    return origin
  }

  return WEB_ORIGIN
}

export function createApp(
  broadcaster: Broadcaster,
  getTrainDetails: (id: string) => Promise<TrainDetails | null>,
) {
  const app = express()
  app.disable("x-powered-by")
  // Caddy is the only proxy in front of the API, so the client IP is the last hop it adds.
  app.set("trust proxy", 1)

  // Only GET without credentials is used, so there are no preflight requests to answer.
  app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", getAllowedOrigin(req.headers.origin))
    res.vary("Origin")
    next()
  })

  app.get("/api/health", async (_req, res) => {
    const dbOk = await pingDb()
    const now = Date.now()
    const body: Health = {
      status: dbOk && upstream.connected ? "ok" : "degraded",
      uptimeSeconds: Math.round(process.uptime()),
      db: { ok: dbOk },
      upstream: {
        connected: upstream.connected,
        lastEventAt: upstream.lastEventAt?.toISOString() ?? null,
        secondsSinceLastEvent: upstream.lastEventAt
          ? Math.round((now - upstream.lastEventAt.getTime()) / 1000)
          : null,
      },
    }
    res.status(dbOk ? 200 : 503).json(body)
  })

  app.get("/api/stream", (_req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Stops proxies from buffering the stream.
      "X-Accel-Buffering": "no",
    })
    res.flushHeaders()
    broadcaster.addClient(res)
  })

  // Each detail lookup can trigger a Trafikverket query, so limit how often one client can ask.
  const trainDetailsLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new HttpError(429, "rate_limited", "Too many requests"))
    },
  })
  app.use("/api/trains", trainDetailsLimiter)

  app.get("/api/trains/:id", async (req, res) => {
    const details = await getTrainDetails(req.params.id)
    if (!details) {
      throw new HttpError(404, "train_not_found", "Train not found")
    }
    res.json(details)
  })

  app.use(notFound)
  app.use(errorHandler)
  return app
}
