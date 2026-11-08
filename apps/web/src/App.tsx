import { useCallback, useEffect, useState } from "react"
import { apiUrl } from "./api"
import { MapView } from "./map/MapView"
import { TrainPanel } from "./panel/TrainPanel"
import { TrainStore } from "./trains/store"

const trainStore = new TrainStore(`${apiUrl}/api/stream`)

export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView store={trainStore} selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId ? (
        // Keyed so that each train opens in the default state.
        <TrainPanel key={selectedId} store={trainStore} trainId={selectedId} onClose={deselect} />
      ) : null}
    </main>
  )
}
