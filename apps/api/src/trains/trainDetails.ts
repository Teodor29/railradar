import type { StopCall, TrainDetails, TrainStop } from "@railradar/shared"
import { HttpError } from "../errors"
import type { Station } from "../stations/trainStation"
import { queryTrainAnnouncements, type Announcement } from "./trainAnnouncement"
import { createTtlCache } from "./ttlCache"

const CACHE_TTL_MS = 30_000
const QUERY_TIMEOUT_MS = 10_000
const TRAIN_ID_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)$/

export function parseTrainId(id: string): { departureDate: string; trainNumber: string } | null {
  const match = TRAIN_ID_PATTERN.exec(id)
  if (!match?.[1] || !match[2]) return null

  return { departureDate: match[1], trainNumber: match[2] }
}

function sortByTime(announcements: Announcement[]): Announcement[] {
  return announcements.toSorted((first, second) => {
    const difference = first.advertisedAt.getTime() - second.advertisedAt.getTime()
    if (difference !== 0) return difference

    // Arrival and departure at a stop often share the same advertised minute.
    if (first.activity === second.activity) return 0
    return first.activity === "arrival" ? -1 : 1
  })
}

// Rows arrive one per arrival or departure. Consecutive rows at the same location form one stop.
function groupByStop(sorted: Announcement[]): Announcement[][] {
  const groups: Announcement[][] = []
  for (const announcement of sorted) {
    const current = groups.at(-1)
    if (current?.[0]?.signature === announcement.signature) {
      current.push(announcement)
    } else {
      groups.push([announcement])
    }
  }

  return groups
}

function toStopCall(announcement: Announcement | undefined): StopCall | null {
  if (!announcement) return null

  return {
    advertisedAt: announcement.advertisedAt.toISOString(),
    estimatedAt: announcement.estimatedAt?.toISOString() ?? null,
    actualAt: announcement.actualAt?.toISOString() ?? null,
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

// A stop counts as passed once the train has left it, or reached it if it's the last stop.
// Earlier stops count as passed even if they lack a reported time, since reports can be missing.
function countPassedStops(groups: Announcement[][]): number {
  const lastReportedIndex = groups.findLastIndex((group) =>
    group.some((announcement) => announcement.actualAt !== null),
  )
  if (groups[lastReportedIndex]?.at(-1)?.actualAt) {
    return lastReportedIndex + 1
  }

  return Math.max(lastReportedIndex, 0)
}

function toStop(
  group: Announcement[],
  passed: boolean,
  stations: ReadonlyMap<string, Station>,
): TrainStop {
  const signature = group[0]?.signature ?? ""
  const station = stations.get(signature)
  const arrival = group.find((announcement) => announcement.activity === "arrival")
  const departure = group.find((announcement) => announcement.activity === "departure")

  return {
    signature,
    name: station?.name ?? signature,
    lat: station?.lat ?? null,
    lon: station?.lon ?? null,
    track: departure?.track ?? arrival?.track ?? null,
    arrival: toStopCall(arrival),
    departure: toStopCall(departure),
    passed,
    canceled: group.every((announcement) => announcement.canceled),
    deviations: unique(group.flatMap((announcement) => announcement.deviations)),
  }
}

function differenceInMinutes(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 60_000)
}

// Trafikverket's estimate for the road ahead is fresher than the last reported time.
function getDelayMinutes(sorted: Announcement[]): number | null {
  const lastActualIndex = sorted.findLastIndex((announcement) => announcement.actualAt !== null)

  const upcoming = sorted
    .slice(lastActualIndex + 1)
    .find((announcement) => !announcement.canceled && announcement.estimatedAt !== null)
  if (upcoming?.estimatedAt) {
    return differenceInMinutes(upcoming.estimatedAt, upcoming.advertisedAt)
  }

  const lastActual = sorted[lastActualIndex]
  if (lastActual?.actualAt) {
    return differenceInMinutes(lastActual.actualAt, lastActual.advertisedAt)
  }

  return null
}

function getCancellation(announcements: Announcement[]): TrainDetails["cancellation"] {
  const canceledCount = announcements.filter((announcement) => announcement.canceled).length
  if (canceledCount === 0) return "none"
  if (canceledCount === announcements.length) return "full"

  return "partial"
}

export function buildTrainDetails(
  id: string,
  trainNumber: string,
  announcements: Announcement[],
  stations: ReadonlyMap<string, Station>,
): TrainDetails | null {
  const sorted = sortByTime(announcements)
  const first = sorted[0]
  if (!first) return null

  const groups = groupByStop(sorted)
  const passedCount = countPassedStops(groups)
  const stops = groups.map((group, index) => toStop(group, index < passedCount, stations))
  const nextStopIndex = stops.findIndex((stop) => !stop.passed && !stop.canceled)

  function stationName(signature: string | null): string | null {
    if (!signature) return null
    return stations.get(signature)?.name ?? signature
  }

  return {
    id,
    trainNumber,
    product: first.product,
    operator: first.operator,
    from: stationName(first.fromSignature),
    to: stationName(first.toSignature),
    cancellation: getCancellation(sorted),
    delayMinutes: getDelayMinutes(sorted),
    nextStopIndex: nextStopIndex === -1 ? null : nextStopIndex,
    deviations: unique(stops.filter((stop) => !stop.passed).flatMap((stop) => stop.deviations)),
    otherInformation: unique(sorted.flatMap((announcement) => announcement.otherInformation)),
    stops,
  }
}

// Returns null when the train doesn't exist. Cached so that many viewers of the same
// train share one request to Trafikverket.
export function createTrainDetailsLoader(
  apiKey: string,
  stations: ReadonlyMap<string, Station>,
): (id: string) => Promise<TrainDetails | null> {
  return createTtlCache(async (id: string) => {
    const parsedId = parseTrainId(id)
    if (!parsedId) return null

    const { departureDate, trainNumber } = parsedId
    try {
      const signal = AbortSignal.timeout(QUERY_TIMEOUT_MS)
      const announcements = await queryTrainAnnouncements(
        apiKey,
        departureDate,
        trainNumber,
        signal,
      )
      return buildTrainDetails(id, trainNumber, announcements, stations)
    } catch (e) {
      console.warn("Train lookup failed:", e instanceof Error ? e.message : e)
      throw new HttpError(502, "upstream_error", "Could not fetch train from Trafikverket")
    }
  }, CACHE_TTL_MS)
}
