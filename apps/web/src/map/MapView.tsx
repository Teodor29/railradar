import { useEffect, useRef, useState } from "react"
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

// Shifts the center so the selected train lands in the part of the map the panel doesn't cover:
// above the bottom sheet on mobile, to the right of the side panel on desktop.
function getPanelOffset(): [number, number] {
  const panel = document.querySelector("[data-panel]")
  if (!panel) {
    return [0, 0]
  }
  const rect = panel.getBoundingClientRect()
  // Tailwind's md breakpoint, where the panel becomes a side panel.
  if (window.matchMedia("(min-width: 48rem)").matches) {
    return [rect.right / 2, 0]
  }
  return [0, -(window.innerHeight - rect.top) / 2]
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
  following: boolean
  onFollowingChange: (following: boolean) => void
  // A new object each time, so picking the same stop again moves the map back to it.
  focus: MapFocus | null
}

export type MapFocus = { center: [number, number] }

const FOCUS_ZOOM = 13

export function MapView({
  store,
  selectedId,
  stops,
  onSelect,
  following,
  onFollowingChange,
  focus,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const trainLayerRef = useRef<TrainLayer | null>(null)
  // State, so that the effects below run again once the layers exist. Trains from a shared link
  // and their stops can arrive before the map has loaded.
  const [loaded, setLoaded] = useState(false)
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
    // Only the user drags, easeTo and flyTo don't.
    map.on("dragstart", () => onFollowingChange(false))
    mapRef.current = map

    map.on("load", () => {
      addStopLayer(map)
      trainLayerRef.current = addTrainLayer(map, store, onSelect)
      setLoaded(true)
    })

    return () => {
      trainLayerRef.current?.stop()
      trainLayerRef.current = null
      setLoaded(false)
      map.remove()
      mapRef.current = null
    }
  }, [store, onSelect, onFollowingChange])

  useEffect(() => {
    trainLayerRef.current?.setSelected(selectedId)
  }, [selectedId, loaded])

  // Centers on the train when it's selected or following is turned back on, then as it moves.
  useEffect(() => {
    if (!selectedId || !following) {
      return
    }

    const centerOnTrain = () => {
      const train = store.get(selectedId)
      if (train) {
        mapRef.current?.easeTo({ center: [train.lo, train.la], offset: getPanelOffset() })
      }
    }

    centerOnTrain()
    return store.subscribe(({ updated }) => {
      // easeTo would cut off a pinch zoom or a previous ease that is still running.
      if (updated.includes(selectedId) && !mapRef.current?.isMoving()) {
        centerOnTrain()
      }
    })
  }, [selectedId, following, store, loaded])

  useEffect(() => {
    const map = mapRef.current
    if (!focus || !map) {
      return
    }
    map.flyTo({
      center: focus.center,
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      offset: getPanelOffset(),
    })
  }, [focus])

  useEffect(() => {
    if (mapRef.current) {
      setStops(mapRef.current, stops ?? [])
    }
  }, [stops, loaded])

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
  }, [stops, selectedId, store, loaded])

  // Not map.isStyleLoaded(), which is also false while tiles or train data load.
  useEffect(() => {
    const map = mapRef.current
    if (map && loaded) {
      applyTheme(map)
    }
  }, [scheme, loaded])

  // MapLibre's CSS sets the container to position: relative and wins over Tailwind's layered
  // utilities, so the positioning lives on a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute top-[env(safe-area-inset-top)] right-[env(safe-area-inset-right)] bottom-[env(safe-area-inset-bottom)] left-[env(safe-area-inset-left)]">
        <MapControls
          mapRef={mapRef}
          following={selectedId ? following : null}
          onFollowingChange={onFollowingChange}
        />
        <ConnectionBanner store={store} />
        <Attribution />
      </div>
    </div>
  )
}
