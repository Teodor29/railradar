import type { FeatureCollection, Point } from "geojson"
import type { GeoJSONSource, MapLibreMap } from "maplibre-gl"
import { isStale, type TrainStore } from "../trains/store"
import { readColor } from "./style"
import { drawTrainIcon } from "./trainIcon"

const SOURCE_ID = "trains"
const LAYER_ID = "trains"
const ICON = "train"
const STALE_ICON = "train-stale"
// Trains turn stale without any new event, so the map is redrawn this often anyway.
const STALE_CHECK_INTERVAL_MS = 5_000

function toFeatures(store: TrainStore): FeatureCollection<Point> {
  const serverNow = store.serverNow()
  return {
    type: "FeatureCollection",
    features: store.all().map((train) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [train.lo, train.la] },
      properties: { i: train.i, n: train.n, b: train.b, stale: isStale(train, serverNow) },
    })),
  }
}

function drawIcons() {
  const outline = readColor("--color-page")
  return {
    normal: drawTrainIcon(readColor("--color-fg"), outline),
    stale: drawTrainIcon(readColor("--color-line"), outline),
  }
}

// Returns a function that stops following the store.
export function addTrainLayer(map: MapLibreMap, store: TrainStore): () => void {
  const icons = drawIcons()
  map.addImage(ICON, icons.normal.image, { pixelRatio: icons.normal.pixelRatio })
  map.addImage(STALE_ICON, icons.stale.image, { pixelRatio: icons.stale.pixelRatio })

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: toFeatures(store),
    promoteId: "i",
  })
  map.addLayer({
    id: LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    layout: {
      "icon-image": ["case", ["get", "stale"], STALE_ICON, ICON],
      // The icon is drawn at full size, so it is only ever scaled down and stays sharp.
      "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 9, 0.75, 13, 1],
      "icon-rotate": ["get", "b"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      // Stale trains are drawn first, so live trains end up on top.
      "symbol-sort-key": ["case", ["get", "stale"], 0, 1],
    },
    paint: {
      "icon-opacity": ["case", ["get", "stale"], 0.9, 1],
    },
  })

  function render() {
    map.getSource<GeoJSONSource>(SOURCE_ID)?.setData(toFeatures(store))
  }

  const unsubscribe = store.subscribe(render)
  const staleTimer = setInterval(render, STALE_CHECK_INTERVAL_MS)

  return () => {
    unsubscribe()
    clearInterval(staleTimer)
  }
}

export function applyTrainColors(map: MapLibreMap) {
  if (!map.hasImage(ICON)) {
    return
  }
  const icons = drawIcons()
  map.updateImage(ICON, icons.normal.image)
  map.updateImage(STALE_ICON, icons.stale.image)
}
