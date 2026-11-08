import type { Position } from "geojson"
import type { GeoJSONSource, MapLibreMap } from "maplibre-gl"
import type { TrainStop } from "@railradar/shared"
import { toStopFeatures, toStopLine } from "./stopFeatures"
import { readColor } from "./style"

const SOURCE_ID = "stops"
const LAYER_ID = "stops"
const LINE_SOURCE_ID = "stops-line"
const LINE_LAYER_ID = "stops-line"
const LABEL_LAYER_ID = "stops-label"

function getColorExpression(): ["case", ["get", string], string, string] {
  return ["case", ["get", "dimmed"], readColor("--color-stop-passed"), readColor("--color-stop")]
}

// Add before the train layer, so that the dots end up below the trains.
export function addStopLayer(map: MapLibreMap) {
  map.addSource(LINE_SOURCE_ID, { type: "geojson", data: toStopLine([], null) })
  map.addLayer({
    id: LINE_LAYER_ID,
    type: "line",
    source: LINE_SOURCE_ID,
    layout: { "line-cap": "round" },
    paint: {
      "line-color": getColorExpression(),
      "line-width": 3,
      "line-opacity": ["case", ["get", "dimmed"], 0.45, 0.6],
      "line-dasharray": [0, 2],
    },
  })

  map.addSource(SOURCE_ID, { type: "geojson", data: toStopFeatures([]) })
  map.addLayer({
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-color": getColorExpression(),
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 11, 6],
      "circle-stroke-color": readColor("--color-land"),
      "circle-stroke-width": 1.5,
    },
  })
  // MapLibre hides labels that collide, so more names appear as you zoom in.
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 0.6],
    },
    paint: {
      "text-color": readColor("--color-place-label"),
      "text-opacity": ["case", ["get", "dimmed"], 0.6, 1],
      "text-halo-color": readColor("--color-land"),
      "text-halo-width": 1.4,
    },
  })
}

export function setStops(map: MapLibreMap, stops: TrainStop[]) {
  map.getSource<GeoJSONSource>(SOURCE_ID)?.setData(toStopFeatures(stops))
}

export function setStopLine(map: MapLibreMap, stops: TrainStop[], trainPosition: Position | null) {
  map.getSource<GeoJSONSource>(LINE_SOURCE_ID)?.setData(toStopLine(stops, trainPosition))
}

export function applyStopColors(map: MapLibreMap) {
  if (!map.getLayer(LAYER_ID)) {
    return
  }
  map.setPaintProperty(LINE_LAYER_ID, "line-color", getColorExpression())
  map.setPaintProperty(LAYER_ID, "circle-color", getColorExpression())
  map.setPaintProperty(LAYER_ID, "circle-stroke-color", readColor("--color-land"))
  map.setPaintProperty(LABEL_LAYER_ID, "text-color", readColor("--color-place-label"))
  map.setPaintProperty(LABEL_LAYER_ID, "text-halo-color", readColor("--color-land"))
}
