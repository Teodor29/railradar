import type { StreamTrain } from "@railradar/shared"
import type { TrainState } from "../ingest/trainPosition"

// 5 decimals is about 1 m, more than enough for a map.
function roundCoordinate(value: number): number {
  return Math.round(value * 100_000) / 100_000
}

export function toStreamTrain(train: TrainState): StreamTrain {
  return {
    i: train.id,
    n: train.trainNumber,
    la: roundCoordinate(train.lat),
    lo: roundCoordinate(train.lon),
    s: train.speed,
    b: train.bearing,
    t: Math.round(train.measuredAt.getTime() / 1000),
  }
}
