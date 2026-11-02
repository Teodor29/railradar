import { setTimeout as sleep } from "node:timers/promises"
import { upstream } from "../upstream"
import { queryTrainPositions, streamTrainPositions } from "./trafikverket"
import { TrainStore } from "./trainState"

const QUERY_WINDOW_MS = 30 * 60 * 1000
const SILENCE_LIMIT_MS = 60_000
const MIN_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 60_000
const PRUNE_INTERVAL_MS = 60_000

export const trains = new TrainStore()

// Starts ingest in the background. Returns a function that stops it.
export function startIngest(apiKey: string): () => void {
  const stopController = new AbortController()

  const pruneTimer = setInterval(() => {
    trains.pruneStale(new Date())
    console.log(`Trains in state: ${trains.size}`)
  }, PRUNE_INTERVAL_MS)

  void runForever(apiKey, stopController.signal)

  return () => {
    clearInterval(pruneTimer)
    stopController.abort()
  }
}

async function runForever(apiKey: string, stopSignal: AbortSignal): Promise<void> {
  let backoffMs = MIN_BACKOFF_MS

  while (!stopSignal.aborted) {
    try {
      // Backoff resets once events flow, not after the query, so a stream that
      // fails right away still backs off.
      await connect(apiKey, stopSignal, () => {
        backoffMs = MIN_BACKOFF_MS
      })
      console.warn("Trafikverket stream closed")
    } catch (e) {
      if (!stopSignal.aborted) {
        console.warn("Trafikverket stream failed:", e instanceof Error ? e.message : e)
      }
    }

    upstream.connected = false
    if (stopSignal.aborted) break

    console.log(`Reconnecting to Trafikverket in ${backoffMs / 1000} s`)
    await sleep(backoffMs, undefined, { signal: stopSignal }).catch(() => {})
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
  }
}

// One connection: fill state with a query, then apply stream events until it ends or goes silent.
async function connect(
  apiKey: string,
  stopSignal: AbortSignal,
  onEvent: () => void,
): Promise<void> {
  const connection = new AbortController()
  const signal = AbortSignal.any([stopSignal, connection.signal])

  let silenceTimer: NodeJS.Timeout | undefined
  function restartSilenceTimer() {
    clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      connection.abort(new Error(`No events for ${SILENCE_LIMIT_MS / 1000} s`))
    }, SILENCE_LIMIT_MS)
  }

  try {
    const since = new Date(Date.now() - QUERY_WINDOW_MS)
    const { positions, sseUrl } = await queryTrainPositions(apiKey, since, signal)
    trains.replaceAll(positions)
    console.log(`Loaded ${trains.size} trains from Trafikverket`)

    restartSilenceTimer()
    for await (const batch of streamTrainPositions(sseUrl, signal)) {
      restartSilenceTimer()
      for (const position of batch) {
        trains.applyPosition(position)
      }

      upstream.connected = true
      upstream.lastEventAt = new Date()
      onEvent()
    }
  } finally {
    clearTimeout(silenceTimer)
  }
}
