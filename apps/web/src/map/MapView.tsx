import { useEffect, useRef } from "react"
import { MapLibreMap, setWorkerUrl } from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import "maplibre-gl/dist/maplibre-gl.css"
import type { TrainStop } from "@railradar/shared"
import type { TrainStore } from "../trains/store"
import { useColorScheme } from "../theme"
import { Attribution } from "./Attribution"
import { ConnectionBanner } from "./ConnectionBanner"
import { MapControls } from "./MapControls"
import { addStopLayer, applyStopColors, setStopLine, setStops } from "./stopLayer"
import { applyColors, createStyle } from "./style"
import { addTrainLayer, applyTrainColors, type TrainLayer } from "./trainLayer"

// MapLibre looks for its worker next to its own file, which breaks when Vite bundles it.
setWorkerUrl(workerUrl)

const SWEDEN_BOUNDS: [[number, number], [number, number]] = [
  [10.9, 55.3],
  [24.2, 69.1],
]

const VIEW_KEY = "mapView"

type SavedView = { center: [number, number]; zoom: number }

function loadView(): SavedView | null {
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (!raw) {
      return null
    }
    const view = JSON.parse(raw)
    if (!Array.isArray(view.center) || typeof view.zoom !== "number") {
      return null
    }
    return view
  } catch {
    return null
  }
}

function saveView(map: MapLibreMap) {
  const { lng, lat } = map.getCenter()
  const view: SavedView = { center: [lng, lat], zoom: map.getZoom() }
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(view))
  } catch {
    // Storage can be blocked (private mode etc.); the map works without it.
  }
}

function applyTheme(map: MapLibreMap) {
  applyColors(map)
  applyStopColors(map)
  applyTrainColors(map)
}

type MapViewProps = {
  store: TrainStore
  selectedId: string | null
  // Stops of the selected train, null when there are none to show.
  stops: TrainStop[] | null
  onSelect: (id: string | null) => void
}

export function MapView({ store, selectedId, stops, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const trainLayerRef = useRef<TrainLayer | null>(null)
  const loadedRef = useRef(false)
  const scheme = useColorScheme()

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const savedView = loadView()
    const map = new MapLibreMap({
      container: containerRef.current,
      style: createStyle(),
      ...(savedView ?? { bounds: SWEDEN_BOUNDS, fitBoundsOptions: { padding: 16 } }),
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.on("moveend", () => saveView(map))
    mapRef.current = map

    map.on("load", () => {
      addStopLayer(map)
      trainLayerRef.current = addTrainLayer(map, store, onSelect)
      loadedRef.current = true
      applyTheme(map)
    })

    return () => {
      trainLayerRef.current?.stop()
      trainLayerRef.current = null
      loadedRef.current = false
      map.remove()
      mapRef.current = null
    }
  }, [store, onSelect])

  useEffect(() => {
    trainLayerRef.current?.setSelected(selectedId)

    const train = selectedId ? store.get(selectedId) : undefined
    if (train) {
      mapRef.current?.easeTo({ center: [train.lo, train.la] })
    }
  }, [selectedId, store])

  useEffect(() => {
    if (mapRef.current) {
      setStops(mapRef.current, stops ?? [])
    }
  }, [stops])

  // The line starts at the train, so it's redrawn as the train moves.
  useEffect(() => {
    const updateLine = () => {
      const train = selectedId ? store.get(selectedId) : undefined
      if (mapRef.current) {
        setStopLine(mapRef.current, stops ?? [], train ? [train.lo, train.la] : null)
      }
    }

    updateLine()
    return store.subscribe(updateLine)
  }, [stops, selectedId, store])

  // Not map.isStyleLoaded(), which is also false while tiles or train data load.
  useEffect(() => {
    const map = mapRef.current
    if (map && loadedRef.current) {
      applyTheme(map)
    }
  }, [scheme])

  // MapLibre's CSS sets the container to position: relative and wins over Tailwind's layered
  // utilities, so the positioning lives on a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute top-[env(safe-area-inset-top)] right-[env(safe-area-inset-right)] bottom-[env(safe-area-inset-bottom)] left-[env(safe-area-inset-left)]">
        <MapControls mapRef={mapRef} />
        <ConnectionBanner store={store} />
        <Attribution />
      </div>
    </div>
  )
}
