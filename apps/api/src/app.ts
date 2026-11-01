import express from "express"
import type { Health } from "@railradar/shared"
import { pingDb } from "./db/pool"
import { errorHandler, notFound } from "./errors"
import { upstream } from "./upstream"

export function createApp() {
  const app = express()
  app.disable("x-powered-by")

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

  app.use(notFound)
  app.use(errorHandler)
  return app
}
