import type { LayerSpecification, MapLibreMap, StyleSpecification } from "maplibre-gl"

type PaintProperty = Parameters<MapLibreMap["setPaintProperty"]>[1]
type SymbolLayout = NonNullable<Extract<LayerSpecification, { type: "symbol" }>["layout"]>

type Palette = {
  land: string
  water: string
  road: string
  rail: string
  label: string
  labelHalo: string
  waterLabel: string
}

// MapLibre can't parse oklch(), so the browser converts each color to rgba via a 1x1 canvas.
const colorCanvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true })

function toRgba(color: string): string {
  if (!colorCanvas) {
    return color
  }
  colorCanvas.clearRect(0, 0, 1, 1)
  colorCanvas.fillStyle = color
  colorCanvas.fillRect(0, 0, 1, 1)
  const [red, green, blue, alpha] = colorCanvas.getImageData(0, 0, 1, 1).data
  return `rgba(${red}, ${green}, ${blue}, ${(alpha ?? 255) / 255})`
}

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string) => toRgba(styles.getPropertyValue(name).trim())

  return {
    land: read("--color-page"),
    water: read("--color-water"),
    road: read("--color-surface"),
    rail: read("--color-line"),
    label: read("--color-muted"),
    labelHalo: read("--color-page"),
    waterLabel: read("--color-muted"),
  }
}

const SOURCE = "openmaptiles"

// Without name:sv, the Baltic Sea gets its name in every bordering language.
const SWEDISH_NAME: SymbolLayout["text-field"] = ["coalesce", ["get", "name:sv"], ["get", "name"]]

function baseLayers(palette: Palette): LayerSpecification[] {
  return [
    {
      id: "land",
      type: "background",
      paint: { "background-color": palette.land },
    },
    {
      id: "water",
      type: "fill",
      source: SOURCE,
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": palette.water },
    },
    {
      id: "roads",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 6,
      filter: ["match", ["get", "class"], ["motorway", "trunk", "primary"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.road,
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 12, 3, 16, 8],
      },
    },
    {
      id: "rail",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      filter: ["all", ["==", ["get", "class"], "rail"], ["!", ["has", "service"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.rail,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.75, 10, 1.5, 16, 3],
      },
    },
    {
      id: "water-labels",
      type: "symbol",
      source: SOURCE,
      "source-layer": "water_name",
      filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
      layout: {
        "text-field": SWEDISH_NAME,
        "text-font": ["Noto Sans Italic"],
        "text-size": 13,
        "text-letter-spacing": 0.3,
      },
      paint: { "text-color": palette.waterLabel },
    },
    {
      id: "place-labels",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      filter: ["match", ["get", "class"], ["city", "town"], true, false],
      layout: {
        "text-field": SWEDISH_NAME,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 10, 14],
        "symbol-sort-key": ["get", "rank"],
      },
      paint: {
        "text-color": palette.label,
        "text-halo-color": palette.labelHalo,
        "text-halo-width": 1.5,
      },
    },
  ]
}

export function createStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      [SOURCE]: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    },
    layers: baseLayers(readPalette()),
  }
}

// In place instead of setStyle, which would drop the layers added on top.
export function applyColors(map: MapLibreMap) {
  for (const layer of baseLayers(readPalette())) {
    if (!("paint" in layer) || !layer.paint) {
      continue
    }
    for (const [property, value] of Object.entries(layer.paint)) {
      map.setPaintProperty(layer.id, property as PaintProperty, value)
    }
  }
}
