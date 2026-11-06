import { setTimeout as sleep } from "node:timers/promises"
import { pool } from "../db/pool"
import { queryTrainStations, type Station } from "./trainStation"

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000
const RETRY_DELAY_MS = 5 * 60 * 1000

// Signature -> station, for looking up names and positions.
export const stations = new Map<string, Station>()

// Starts station handling in the background. Returns a function that stops it.
export function startStationSync(apiKey: string): () => void {
  const stopController = new AbortController()
  void runForever(apiKey, stopController.signal)

  return () => stopController.abort()
}

async function runForever(apiKey: string, stopSignal: AbortSignal): Promise<void> {
  await retryUntilDone(() => loadOrSync(apiKey, stopSignal), stopSignal)

  while (!stopSignal.aborted) {
    await sleep(SYNC_INTERVAL_MS, undefined, { signal: stopSignal }).catch(() => {})
    if (stopSignal.aborted) break

    await retryUntilDone(() => syncStations(apiKey, stopSignal), stopSignal)
  }
}

async function retryUntilDone(task: () => Promise<void>, stopSignal: AbortSignal): Promise<void> {
  while (!stopSignal.aborted) {
    try {
      await task()
      return
    } catch (e) {
      if (stopSignal.aborted) return
      console.warn("Station sync failed:", e instanceof Error ? e.message : e)
    }

    await sleep(RETRY_DELAY_MS, undefined, { signal: stopSignal }).catch(() => {})
  }
}

async function loadOrSync(apiKey: string, stopSignal: AbortSignal): Promise<void> {
  await loadStations()
  if (stations.size > 0) {
    console.log(`Loaded ${stations.size} stations from database`)
    return
  }

  await syncStations(apiKey, stopSignal)
}

async function syncStations(apiKey: string, stopSignal: AbortSignal): Promise<void> {
  const fetched = await queryTrainStations(apiKey, stopSignal)
  // An empty list would wipe the table, and is never a correct answer.
  if (fetched.length === 0) throw new Error("Trafikverket returned no stations")

  await saveStations(fetched)
  await loadStations()
  console.log(`Synced ${stations.size} stations from Trafikverket`)
}

async function loadStations(): Promise<void> {
  const { rows } = await pool.query<Station>("SELECT signature, name, lat, lon FROM stations")

  stations.clear()
  for (const row of rows) {
    stations.set(row.signature, row)
  }
}

// Replaces the whole table in one transaction, so stations removed upstream disappear too.
async function saveStations(fetched: Station[]): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("DELETE FROM stations")
    await client.query(
      `INSERT INTO stations (signature, name, lat, lon, updated_at)
       SELECT signature, name, lat, lon, now()
       FROM unnest($1::text[], $2::text[], $3::double precision[], $4::double precision[])
         AS fetched (signature, name, lat, lon)`,
      [
        fetched.map((station) => station.signature),
        fetched.map((station) => station.name),
        fetched.map((station) => station.lat),
        fetched.map((station) => station.lon),
      ],
    )
    await client.query("COMMIT")
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}
