import { z } from "zod"
import { escapeXml, postQuery } from "../ingest/trafikverket"
import { parseWktPoint } from "../ingest/trainPosition"

export const trainStationSchema = z.object({
  LocationSignature: z.string().min(1),
  AdvertisedLocationName: z.string().min(1),
  Geometry: z.object({ WGS84: z.string() }).optional(),
  Deleted: z.boolean(),
})

export type TrainStation = z.infer<typeof trainStationSchema>

export type Station = {
  signature: string // LocationSignature
  name: string // AdvertisedLocationName
  lat: number | null
  lon: number | null
}

const responseSchema = z.object({
  RESPONSE: z.object({
    RESULT: z.array(
      z.object({
        TrainStation: z.array(z.unknown()).default([]),
      }),
    ),
  }),
})

export function buildStationQuery(apiKey: string): string {
  return [
    "<REQUEST>",
    `<LOGIN authenticationkey="${escapeXml(apiKey)}"/>`,
    '<QUERY objecttype="TrainStation" namespace="rail.infrastructure" schemaversion="1.5">',
    "<INCLUDE>LocationSignature</INCLUDE>",
    "<INCLUDE>AdvertisedLocationName</INCLUDE>",
    "<INCLUDE>Geometry.WGS84</INCLUDE>",
    "<INCLUDE>Deleted</INCLUDE>",
    "</QUERY>",
    "</REQUEST>",
  ].join("")
}

export function toStation(trainStation: TrainStation): Station {
  const wkt = trainStation.Geometry?.WGS84
  const point = wkt ? parseWktPoint(wkt) : null

  return {
    signature: trainStation.LocationSignature,
    name: trainStation.AdvertisedLocationName,
    lat: point?.lat ?? null,
    lon: point?.lon ?? null,
  }
}

// Validates each station on its own, so one odd station doesn't drop the whole list.
export function parseStationResponse(json: unknown): Station[] {
  const result = responseSchema.parse(json).RESPONSE.RESULT[0]
  if (!result) return []

  const stations: Station[] = []
  let invalidCount = 0
  for (const item of result.TrainStation) {
    const parsed = trainStationSchema.safeParse(item)
    if (!parsed.success) {
      invalidCount++
      continue
    }
    if (!parsed.data.Deleted) {
      stations.push(toStation(parsed.data))
    }
  }
  if (invalidCount > 0) {
    console.warn(`Skipped ${invalidCount} invalid TrainStation(s)`)
  }

  return stations
}

export async function queryTrainStations(apiKey: string, signal: AbortSignal): Promise<Station[]> {
  return parseStationResponse(await postQuery(buildStationQuery(apiKey), signal))
}
