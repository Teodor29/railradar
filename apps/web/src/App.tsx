import { useEffect, useState } from "react"
import { Attribution } from "./map/Attribution"
import { MapView } from "./map/MapView"
import { TrainStore } from "./trains/store"

// Empty in development, where Vite proxies /api to the local API.
const apiUrl: string = import.meta.env.VITE_API_URL ?? ""
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

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView store={trainStore} selectedId={selectedId} onSelect={setSelectedId} />
      <Attribution />
    </main>
  )
}
