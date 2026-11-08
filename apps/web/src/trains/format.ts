import type { StopCall, StreamTrain, TrainDetails, TrainStop } from "@railradar/shared"
import { isStale } from "./store"

const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
})

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso))
}

export function formatDelay(minutes: number): string {
  if (minutes <= 0) {
    return "I tid"
  }
  return `+${minutes} min`
}

export type TrainStatus =
  | { kind: "canceled" }
  | { kind: "stale"; minutesAgo: number }
  | { kind: "moving"; speed: number }
  | { kind: "at-station"; station: string }
  | { kind: "stopped" }
  // Running, but without a speed we can't tell if it moves.
  | { kind: "running" }

// The station the train stands at: it has arrived (or starts there) but not left.
export function getCurrentStation(details: TrainDetails): string | null {
  if (details.nextStopIndex === null) {
    // Every stop is passed, so the train is at its last stop if it has arrived.
    const last = details.stops.at(-1)
    if (last?.arrival?.actualAt) {
      return last.name
    }
    return null
  }

  const stop = details.stops[details.nextStopIndex]
  if (!stop || stop.departure?.actualAt) {
    return null
  }
  const arrived = stop.arrival === null || stop.arrival.actualAt !== null
  return arrived ? stop.name : null
}

// What the train does right now. Details are null while they load, so a
// cancellation or a station stop only shows once they arrive.
export function getTrainStatus(
  details: TrainDetails | null,
  train: StreamTrain,
  serverNow: number,
): TrainStatus {
  if (details?.cancellation === "full") {
    return { kind: "canceled" }
  }
  if (isStale(train, serverNow)) {
    const minutesAgo = Math.floor((serverNow - train.t * 1000) / 60_000)
    return { kind: "stale", minutesAgo }
  }
  if (train.s !== null && train.s > 0) {
    return { kind: "moving", speed: train.s }
  }

  const station = details ? getCurrentStation(details) : null
  if (station) {
    return { kind: "at-station", station }
  }
  if (train.s === 0) {
    return { kind: "stopped" }
  }
  return { kind: "running" }
}

// "Stannar inte i Flemingsberg och Södertälje hamn" for canceled stops ahead.
export function getCanceledStopsNotice(details: TrainDetails): string | null {
  if (details.cancellation === "full") {
    return null
  }
  const names = details.stops
    .filter((stop) => stop.canceled && !stop.passed)
    .map((stop) => stop.name)

  if (names.length === 0) {
    return null
  }
  if (names.length > 3) {
    return `Stannar inte i ${names.length} stationer`
  }
  if (names.length === 1) {
    return `Stannar inte i ${names[0]}`
  }
  return `Stannar inte i ${names.slice(0, -1).join(", ")} och ${names.at(-1)}`
}

// The call that matters next: departure once the train has arrived, otherwise arrival.
export function getUpcomingCall(stop: TrainStop): StopCall | null {
  if (stop.arrival?.actualAt && stop.departure) {
    return stop.departure
  }
  return stop.arrival ?? stop.departure
}

export type DisplayTime = {
  time: string
  // Set when the shown time differs from the timetable.
  plannedTime: string | null
  late: boolean
}

// Actual time if reported, else Trafikverket's estimate, else the timetable.
export function getDisplayTime(call: StopCall): DisplayTime {
  const shownAt = call.actualAt ?? call.estimatedAt ?? call.advertisedAt
  const plannedTime = formatTime(call.advertisedAt)
  const time = formatTime(shownAt)
  if (time === plannedTime) {
    return { time, plannedTime: null, late: false }
  }
  return { time, plannedTime, late: shownAt > call.advertisedAt }
}

// "Tåg 1735 · Pågatågen"
export function getTrainName(product: string | null, trainNumber: string): string {
  if (!product) {
    return `Tåg ${trainNumber}`
  }
  return `Tåg ${trainNumber} · ${product}`
}
