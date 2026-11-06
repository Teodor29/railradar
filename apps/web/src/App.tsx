import { useEffect } from "react"
import { Attribution } from "./map/Attribution"
import { MapView } from "./map/MapView"
import { TrainStore } from "./trains/store"

// Empty in development, where Vite proxies /api to the local API.
const apiUrl: string = import.meta.env.VITE_API_URL ?? ""
const trainStore = new TrainStore(`${apiUrl}/api/stream`)

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
