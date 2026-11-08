import { useEffect, useState } from "react"
import { trainDetailsSchema, type TrainDetails } from "@railradar/shared"
import { apiUrl } from "../api"

// Matches the API's cache, so a refresh can bring new data.
const REFRESH_INTERVAL_MS = 30_000

export type TrainDetailsState =
  | { status: "loading" }
  | { status: "loaded"; details: TrainDetails }
  | { status: "no-timetable" }
  | { status: "error" }

// Returns null when the train has no advertised timetable.
async function fetchTrainDetails(id: string, signal: AbortSignal): Promise<TrainDetails | null> {
  const response = await fetch(`${apiUrl}/api/trains/${encodeURIComponent(id)}`, { signal })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return trainDetailsSchema.parse(await response.json())
}

// Stays "loading" while no train is selected.
export function useTrainDetails(id: string | null): TrainDetailsState {
  const [result, setResult] = useState<{ id: string; state: TrainDetailsState } | null>(null)

  useEffect(() => {
    if (id === null) {
      return
    }

    const controller = new AbortController()

    // An arrow function, since a hoisted declaration would lose the null check above.
    const load = async () => {
      try {
        const details = await fetchTrainDetails(id, controller.signal)
        if (details) {
          setResult({ id, state: { status: "loaded", details } })
        } else {
          setResult({ id, state: { status: "no-timetable" } })
        }
      } catch (e) {
        if (controller.signal.aborted) {
          return
        }
        console.warn("Could not fetch train details:", e)
        // A failed refresh keeps the last good data on screen.
        setResult((current) => {
          if (current?.id === id && current.state.status === "loaded") {
            return current
          }
          return { id, state: { status: "error" } }
        })
      }
    }

    void load()
    const timer = setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
      // So that reopening a train starts from "loading" instead of old data.
      setResult(null)
    }
  }, [id])

  if (result?.id !== id) {
    return { status: "loading" }
  }
  return result.state
}
