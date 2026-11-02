import type { Response } from "express"
import type { HeartbeatEvent } from "@railradar/shared"
import type { TrainStore } from "../ingest/trainState"
import { toStreamTrain } from "./compact"

const BATCH_INTERVAL_MS = 2000
const HEARTBEAT_INTERVAL_MS = 15_000

export type StreamEventName = "snapshot" | "update" | "remove" | "heartbeat"

export type Broadcaster = {
  addClient(res: Response): void
  stop(): void
}

export function formatEvent(name: StreamEventName, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
}

// Sends a snapshot to each new client, then batched changes from the store to all clients.
export function startBroadcast(store: TrainStore): Broadcaster {
  const clients = new Set<Response>()

  function sendToAll(message: string) {
    for (const client of clients) {
      client.write(message)
    }
  }

  // Runs even without clients, so the store's change sets don't grow forever.
  const batchTimer = setInterval(() => {
    const { updated, removed } = store.takeChanges()

    if (updated.length > 0) {
      sendToAll(formatEvent("update", updated.map(toStreamTrain)))
    }
    if (removed.length > 0) {
      sendToAll(formatEvent("remove", removed))
    }
  }, BATCH_INTERVAL_MS)

  const heartbeatTimer = setInterval(() => {
    const heartbeat: HeartbeatEvent = { t: Math.round(Date.now() / 1000) }
    sendToAll(formatEvent("heartbeat", heartbeat))
  }, HEARTBEAT_INTERVAL_MS)

  return {
    addClient(res) {
      res.write(formatEvent("snapshot", store.all().map(toStreamTrain)))
      clients.add(res)
      res.on("close", () => clients.delete(res))
    },

    stop() {
      clearInterval(batchTimer)
      clearInterval(heartbeatTimer)
      for (const client of clients) {
        client.end()
      }
      clients.clear()
    },
  }
}
