import { useCallback, useEffect, useState } from "react"
import { apiUrl } from "./api"
import { MapView } from "./map/MapView"
import { TrainPanel } from "./panel/TrainPanel"
import { TrainStore } from "./trains/store"
import { useTrainDetails } from "./trains/useTrainDetails"

const trainStore = new TrainStore(`${apiUrl}/api/stream`)

export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailsState = useTrainDetails(selectedId)
  const stops = detailsState.status === "loaded" ? detailsState.details.stops : null

  useEffect(() => {
    trainStore.start()
    return () => trainStore.stop()
  }, [])

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

  const deselect = useCallback(() => setSelectedId(null), [])

  // On the iOS home screen, 100dvh is short by the status bar's height.
  return (
    <main className="relative h-dvh w-full overflow-hidden standalone:h-lvh">
      <MapView store={trainStore} selectedId={selectedId} stops={stops} onSelect={setSelectedId} />
      {selectedId ? (
        // Keyed so that each train opens in the default state.
        <TrainPanel
          key={selectedId}
          store={trainStore}
          trainId={selectedId}
          detailsState={detailsState}
          onClose={deselect}
        />
      ) : null}
    </main>
  )
}
