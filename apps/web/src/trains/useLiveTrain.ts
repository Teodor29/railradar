import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import type { StreamTrain } from "@railradar/shared"
import type { TrainStore } from "./store"

export function useLiveTrain(store: TrainStore, id: string): StreamTrain | undefined {
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store])
  return useSyncExternalStore(subscribe, () => store.get(id))
}

// Server time that ticks, for texts like "3 min sedan" that change without new data.
export function useServerNow(store: TrainStore, intervalMs: number): number {
  const [now, setNow] = useState(() => store.serverNow())

  useEffect(() => {
    const timer = setInterval(() => setNow(store.serverNow()), intervalMs)
    return () => clearInterval(timer)
  }, [store, intervalMs])

  return now
}
