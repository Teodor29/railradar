import { z } from "zod"

// Compact train for the stream. Short keys make the payload about 25 % smaller,
// which matters for mobile data since the stream stays open.
export const streamTrainSchema = z.object({
  i: z.string(), // id, {departureDate}-{trainNumber}
  n: z.string(), // trainNumber
  la: z.number(), // lat, 5 decimals (~1 m)
  lo: z.number(), // lon, 5 decimals
  s: z.number().nullable(), // speed km/h, often missing
  b: z.number(), // bearing degrees
  t: z.number(), // measuredAt, epoch seconds
})
export type StreamTrain = z.infer<typeof streamTrainSchema>

export const snapshotEventSchema = z.array(streamTrainSchema)
export const updateEventSchema = z.array(streamTrainSchema)
export const removeEventSchema = z.array(z.string()) // ids

export const heartbeatEventSchema = z.object({
  t: z.number(), // server time, epoch seconds
})
export type HeartbeatEvent = z.infer<typeof heartbeatEventSchema>
