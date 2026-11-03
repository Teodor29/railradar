import { useEffect } from "react"
import { Attribution } from "./map/Attribution"
import { MapView } from "./map/MapView"
import { TrainStore } from "./trains/store"

const trainStore = new TrainStore("/api/stream")

export function App() {
  useEffect(() => {
    trainStore.start()
    return () => trainStore.stop()
  }, [])

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView store={trainStore} />
      <Attribution />
    </main>
  )
}
