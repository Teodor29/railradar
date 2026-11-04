import { useRef, useState, type RefObject } from "react"
import { Minus, Navigation, Plus } from "lucide-react"
import { Marker, type MapLibreMap } from "maplibre-gl"
import { MapButton, MapControlGroup } from "./MapButton"

const LOCATE_ZOOM = 11

type LocateState = "idle" | "locating" | "unavailable"

function createPositionDot() {
  const dot = document.createElement("div")
  dot.className = "size-4 rounded-full border-2 border-white bg-accent shadow-md"
  return dot
}

export function MapControls({ mapRef }: { mapRef: RefObject<MapLibreMap | null> }) {
  const [locateState, setLocateState] = useState<LocateState>("idle")
  const positionMarkerRef = useRef<Marker | null>(null)

  function locate() {
    const map = mapRef.current
    if (!map || !("geolocation" in navigator)) {
      setLocateState("unavailable")
      return
    }

    setLocateState("locating")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.longitude, coords.latitude]
        if (!positionMarkerRef.current) {
          positionMarkerRef.current = new Marker({ element: createPositionDot() })
        }
        positionMarkerRef.current.setLngLat(position).addTo(map)
        map.flyTo({ center: position, zoom: Math.max(map.getZoom(), LOCATE_ZOOM) })
        setLocateState("idle")
      },
      () => setLocateState("unavailable"),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-3 md:top-auto md:bottom-4">
      <MapControlGroup>
        <MapButton
          label="Visa min position"
          onClick={locate}
          tone="accent"
          disabled={locateState === "unavailable"}
          busy={locateState === "locating"}
          title={locateState === "unavailable" ? "Din position är inte tillgänglig" : undefined}
        >
          <Navigation className="size-5" />
        </MapButton>
      </MapControlGroup>

      <div className="hidden md:block">
        <MapControlGroup>
          <MapButton label="Zooma in" onClick={() => mapRef.current?.zoomIn()}>
            <Plus className="size-5" />
          </MapButton>
          <MapButton label="Zooma ut" onClick={() => mapRef.current?.zoomOut()}>
            <Minus className="size-5" />
          </MapButton>
        </MapControlGroup>
      </div>
    </div>
  )
}
