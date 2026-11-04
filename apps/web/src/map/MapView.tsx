import { useEffect, useRef } from "react"
import { MapLibreMap, setWorkerUrl } from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import "maplibre-gl/dist/maplibre-gl.css"
import type { TrainStore } from "../trains/store"
import { useColorScheme } from "../theme"
import { MapControls } from "./MapControls"
import { applyColors, createStyle } from "./style"
import { addTrainLayer, applyTrainColors } from "./trainLayer"

// MapLibre looks for its worker next to its own file, which breaks when Vite bundles it.
setWorkerUrl(workerUrl)

const SWEDEN_BOUNDS: [[number, number], [number, number]] = [
  [10.9, 55.3],
  [24.2, 69.1],
]

function applyTheme(map: MapLibreMap) {
  applyColors(map)
  applyTrainColors(map)
}

export function MapView({ store }: { store: TrainStore }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const scheme = useColorScheme()

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const map = new MapLibreMap({
      container: containerRef.current,
      style: createStyle(),
      bounds: SWEDEN_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    mapRef.current = map

    let stopTrains: (() => void) | null = null
    map.on("load", () => {
      stopTrains = addTrainLayer(map, store)
    })

    return () => {
      stopTrains?.()
      map.remove()
      mapRef.current = null
    }
  }, [store])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }
    if (map.isStyleLoaded()) {
      applyTheme(map)
    } else {
      map.once("load", () => applyTheme(map))
    }
  }, [scheme])

  // MapLibre's CSS sets the container to position: relative and wins over Tailwind's layered
  // utilities, so the positioning lives on a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      <MapControls mapRef={mapRef} />
    </div>
  )
}
