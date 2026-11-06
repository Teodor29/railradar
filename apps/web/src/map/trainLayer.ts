import type { FeatureCollection, Point } from "geojson"
import { Marker, type GeoJSONSource, type MapLibreMap, type PointLike } from "maplibre-gl"
import { isStale, type TrainStore } from "../trains/store"
import { readColor } from "./style"
import { drawTrainIcon } from "./trainIcon"

const SOURCE_ID = "trains"
const LAYER_ID = "trains"
const ICON = "train"
const STALE_ICON = "train-stale"
const SELECTED_ICON = "train-selected"
// Trains turn stale without any new event, so the map is redrawn this often anyway.
const STALE_CHECK_INTERVAL_MS = 5_000
// The icons are small targets, especially for a finger.
const TAP_RADIUS_PX = 14
// Clears the icon whichever way it's rotated.
const BADGE_OFFSET_PX = 18

export type TrainLayer = {
  setSelected(id: string | null): void
  stop(): void
}

function toFeatures(store: TrainStore, selectedId: string | null): FeatureCollection<Point> {
  const serverNow = store.serverNow()
  return {
    type: "FeatureCollection",
    features: store.all().map((train) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [train.lo, train.la] },
      properties: {
        i: train.i,
        n: train.n,
        b: train.b,
        stale: isStale(train, serverNow),
        selected: train.i === selectedId,
      },
    })),
  }
}

function drawIcons() {
  const outline = readColor("--color-land")
  return {
    normal: drawTrainIcon(readColor("--color-train"), outline),
    stale: drawTrainIcon(readColor("--color-train-stale"), outline),
    selected: drawTrainIcon(readColor("--color-train-selected"), outline),
  }
}

// The train closest to the point, within TAP_RADIUS_PX.
function findTrainAt(map: MapLibreMap, x: number, y: number): string | null {
  const box: [PointLike, PointLike] = [
    [x - TAP_RADIUS_PX, y - TAP_RADIUS_PX],
    [x + TAP_RADIUS_PX, y + TAP_RADIUS_PX],
  ]

  let closestId: string | null = null
  let closestDistance = Infinity
  for (const feature of map.queryRenderedFeatures(box, { layers: [LAYER_ID] })) {
    const { coordinates } = feature.geometry as Point
    const position = map.project(coordinates as [number, number])
    const distance = Math.hypot(position.x - x, position.y - y)
    if (distance < closestDistance) {
      closestDistance = distance
      closestId = feature.properties.i
    }
  }

  return closestId
}

function createBadge(): Marker {
  const element = document.createElement("div")
  element.className = "pointer-events-none rounded-full bg-accent px-2 py-0.5 font-semibold shadow"

  return new Marker({ element, anchor: "bottom", offset: [0, -BADGE_OFFSET_PX] })
}

export function addTrainLayer(
  map: MapLibreMap,
  store: TrainStore,
  onSelect: (id: string | null) => void,
): TrainLayer {
  const icons = drawIcons()
  map.addImage(ICON, icons.normal.image, { pixelRatio: icons.normal.pixelRatio })
  map.addImage(STALE_ICON, icons.stale.image, { pixelRatio: icons.stale.pixelRatio })
  map.addImage(SELECTED_ICON, icons.selected.image, { pixelRatio: icons.selected.pixelRatio })

  let selectedId: string | null = null
  const badge = createBadge()

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: toFeatures(store, selectedId),
    promoteId: "i",
  })
  map.addLayer({
    id: LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    layout: {
      "icon-image": [
        "case",
        ["get", "selected"],
        SELECTED_ICON,
        ["get", "stale"],
        STALE_ICON,
        ICON,
      ],
      // The icon is drawn at full size, so it is only ever scaled down and stays sharp.
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.3, 5, 0.6, 11, 1],

      "icon-rotate": ["get", "b"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      // Stale trains are drawn first and the selected train last, so it's never hidden.
      "symbol-sort-key": ["case", ["get", "selected"], 2, ["get", "stale"], 0, 1],
    },
    paint: {
      "icon-opacity": ["case", ["get", "selected"], 1, ["get", "stale"], 0.8, 1],
    },
  })

  function render() {
    map.getSource<GeoJSONSource>(SOURCE_ID)?.setData(toFeatures(store, selectedId))

    const train = selectedId ? store.get(selectedId) : undefined
    if (!train) {
      badge.remove()
      return
    }
    badge.getElement().textContent = train.n
    badge.setLngLat([train.lo, train.la]).addTo(map)
  }

  map.on("click", (event) => {
    onSelect(findTrainAt(map, event.point.x, event.point.y))
  })
  map.on("mouseenter", LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer"
  })
  map.on("mouseleave", LAYER_ID, () => {
    map.getCanvas().style.cursor = ""
  })

  const unsubscribe = store.subscribe(render)
  const staleTimer = setInterval(render, STALE_CHECK_INTERVAL_MS)

  return {
    setSelected(id) {
      selectedId = id
      render()
    },
    stop() {
      unsubscribe()
      clearInterval(staleTimer)
      badge.remove()
    },
  }
}

export function applyTrainColors(map: MapLibreMap) {
  if (!map.hasImage(ICON)) {
    return
  }
  const icons = drawIcons()
  map.updateImage(ICON, icons.normal.image)
  map.updateImage(STALE_ICON, icons.stale.image)
  map.updateImage(SELECTED_ICON, icons.selected.image)
}
