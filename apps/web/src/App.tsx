import { Attribution } from "./map/Attribution"
import { MapView } from "./map/MapView"

export function App() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView />
      <Attribution />
    </main>
  )
}
