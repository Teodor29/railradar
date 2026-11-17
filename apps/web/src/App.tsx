import { useCallback, useEffect, useRef, useState } from "react"
import { apiUrl } from "./api"
import type { TrainStop } from "@railradar/shared"
import { MapView, type MapFocus } from "./map/MapView"
import { TrainPanel } from "./panel/TrainPanel"
import { TrainStore } from "./trains/store"
import { readLinkedTrainId, writeLinkedTrainId } from "./trains/trainLink"
import { useTrainDetails } from "./trains/useTrainDetails"
import { usePageVisible } from "./usePageVisible"

const trainStore = new TrainStore(`${apiUrl}/api/stream`)
// A quick look at another app or tab shouldn't cost a reconnect and a new snapshot.
const PAUSE_AFTER_MS = 30_000

export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The map follows the selected train until the user moves the map or picks a stop.
  const [following, setFollowing] = useState(true)
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const visible = usePageVisible()
  const detailsState = useTrainDetails(selectedId)
  const stops = detailsState.status === "loaded" ? detailsState.details.stops : null
  // A train from the URL waits for the first snapshot, which says whether it's still running.
  const linkedIdRef = useRef(readLinkedTrainId())

  // The stream pauses in the background and catches up with a new snapshot when back.
  useEffect(() => {
    if (visible) {
      trainStore.start()
      return
    }
    const timer = setTimeout(() => trainStore.stop(), PAUSE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [visible])

  useEffect(() => {
    return () => trainStore.stop()
  }, [])

  useEffect(() => {
    return trainStore.subscribe(() => {
      const linkedId = linkedIdRef.current
      if (linkedId === null) {
        return
      }
      linkedIdRef.current = null
      if (trainStore.get(linkedId)) {
        setSelectedId(linkedId)
      } else {
        writeLinkedTrainId(null)
      }
    })
  }, [])

  useEffect(() => {
    if (linkedIdRef.current === null) {
      writeLinkedTrainId(selectedId)
    }
  }, [selectedId])

  // A train that leaves the map can't stay selected.
  useEffect(() => {
    return trainStore.subscribe(({ removed }) => {
      setSelectedId((current) => {
        if (current && removed.includes(current)) {
          return null
        }
        return current
      })
    })
  }, [])

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setFollowing(true)
  }, [])

  const deselect = useCallback(() => setSelectedId(null), [])

  const focusStop = useCallback((stop: TrainStop) => {
    if (stop.lat === null || stop.lon === null) {
      return
    }
    setFocus({ center: [stop.lon, stop.lat] })
    setFollowing(false)
  }, [])

  // On the iOS home screen, 100dvh is short by the status bar's height.
  return (
    <main className="relative h-dvh w-full overflow-hidden standalone:h-lvh">
      <MapView
        store={trainStore}
        selectedId={selectedId}
        stops={stops}
        onSelect={select}
        following={following}
        onFollowingChange={setFollowing}
        focus={focus}
      />
      {selectedId ? (
        // Keyed so that each train opens in the default state.
        <TrainPanel
          key={selectedId}
          store={trainStore}
          trainId={selectedId}
          detailsState={detailsState}
          onClose={deselect}
          onSelectStop={focusStop}
        />
      ) : null}
    </main>
  )
}
