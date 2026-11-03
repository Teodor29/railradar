import type { FeatureCollection, Point } from "geojson"
import type { GeoJSONSource, MapLibreMap } from "maplibre-gl"
import type { StreamTrain } from "@railradar/shared"
import type { TrainStore } from "../trains/store"
import { readColor } from "./style"
import { drawTrainIcon } from "./trainIcon"

const SOURCE_ID = "trains"
const LAYER_ID = "trains"
const ICON = "train"

function toFeatures(trains: StreamTrain[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: trains.map((train) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [train.lo, train.la] },
      properties: { i: train.i, n: train.n, b: train.b },
    })),
  }
}

function drawIcon() {
  return drawTrainIcon(readColor("--color-fg"), readColor("--color-page"))
}

// Returns a function that stops following the store.
export function addTrainLayer(map: MapLibreMap, store: TrainStore): () => void {
  const { image, pixelRatio } = drawIcon()
  map.addImage(ICON, image, { pixelRatio })

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: toFeatures(store.all()),
    promoteId: "i",
  })
  map.addLayer({
    id: LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    layout: {
      "icon-image": ICON,
      // The icon is drawn at full size, so it is only ever scaled down and stays sharp.
      "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 9, 0.75, 13, 1],
      "icon-rotate": ["get", "b"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  })

  return store.subscribe(() => {
    map.getSource<GeoJSONSource>(SOURCE_ID)?.setData(toFeatures(store.all()))
  })
}

export function applyTrainColors(map: MapLibreMap) {
  if (map.hasImage(ICON)) {
    map.updateImage(ICON, drawIcon().image)
  }
}
