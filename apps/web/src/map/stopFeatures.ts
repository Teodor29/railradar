import type { Feature, FeatureCollection, LineString, Point, Position } from "geojson"
import type { TrainStop } from "@railradar/shared"

// Stops without a known position can't be drawn. The train won't call at canceled stops,
// so they are dimmed like the ones it has passed.
export function toStopFeatures(stops: TrainStop[]): FeatureCollection<Point> {
  const features: Feature<Point>[] = []
  for (const stop of stops) {
    if (stop.lat === null || stop.lon === null) {
      continue
    }
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
      properties: { name: stop.name, dimmed: stop.passed || stop.canceled },
    })
  }

  return { type: "FeatureCollection", features }
}

function toLine(coordinates: Position[], dimmed: boolean): Feature<LineString> {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: { dimmed },
  }
}

// Both parts meet at the train. Straight between stops, as the track ahead isn't known.
export function toStopLine(
  stops: TrainStop[],
  trainPosition: Position | null,
): FeatureCollection<LineString> {
  if (!trainPosition) {
    return { type: "FeatureCollection", features: [] }
  }

  const passed: Position[] = []
  const upcoming: Position[] = [trainPosition]
  for (const stop of stops) {
    if (stop.canceled || stop.lat === null || stop.lon === null) {
      continue
    }
    if (stop.passed) {
      passed.push([stop.lon, stop.lat])
    } else {
      upcoming.push([stop.lon, stop.lat])
    }
  }

  passed.push(trainPosition)

  const features: Feature<LineString>[] = []
  if (passed.length >= 2) {
    features.push(toLine(passed, true))
  }
  if (upcoming.length >= 2) {
    features.push(toLine(upcoming, false))
  }
  return { type: "FeatureCollection", features }
}
