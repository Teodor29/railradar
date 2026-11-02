import { z } from "zod"

// Only the fields we use. Unknown fields are stripped by zod.
export const trainPositionSchema = z.object({
  Train: z.object({
    AdvertisedTrainNumber: z.string().optional(),
    JourneyPlanDepartureDate: z.iso.datetime({ offset: true }),
  }),
  Position: z.object({
    WGS84: z.string(),
  }),
  TimeStamp: z.iso.datetime({ offset: true }),
  Status: z.object({
    Active: z.boolean(),
  }),
  Bearing: z.number(),
  Speed: z.number().optional(),
  Deleted: z.boolean(),
})

export type TrainPosition = z.infer<typeof trainPositionSchema>

export type TrainState = {
  id: string // {departureDate}-{trainNumber}
  trainNumber: string // AdvertisedTrainNumber
  departureDate: string // YYYY-MM-DD
  lat: number
  lon: number
  speed: number | null // km/h, often missing
  bearing: number // degrees
  measuredAt: Date // TimeStamp
}

const wktPointPattern = /^POINT \((-?[\d.]+) (-?[\d.]+)\)$/

// Trafikverket sends WGS84 as "POINT (lon lat)".
export function parseWktPoint(wkt: string): { lat: number; lon: number } | null {
  const match = wktPointPattern.exec(wkt)
  if (!match) return null

  const lon = Number(match[1])
  const lat = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return { lat, lon }
}

// Returns null for trains we don't show: no advertised number or no usable position.
export function toTrainState(position: TrainPosition): TrainState | null {
  const trainNumber = position.Train.AdvertisedTrainNumber
  if (!trainNumber) return null

  const point = parseWktPoint(position.Position.WGS84)
  if (!point) return null

  // The date part is already in Swedish local time, e.g. "2026-11-02T00:00:00.000+01:00".
  const departureDate = position.Train.JourneyPlanDepartureDate.slice(0, 10)

  return {
    id: `${departureDate}-${trainNumber}`,
    trainNumber,
    departureDate,
    lat: point.lat,
    lon: point.lon,
    speed: position.Speed ?? null,
    bearing: position.Bearing,
    measuredAt: new Date(position.TimeStamp),
  }
}

export function isRemoval(position: TrainPosition): boolean {
  return position.Deleted || !position.Status.Active
}
