import { z } from "zod"

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  uptimeSeconds: z.number(),
  db: z.object({
    ok: z.boolean(),
  }),
  upstream: z.object({
    connected: z.boolean(),
    lastEventAt: z.string().nullable(),
    secondsSinceLastEvent: z.number().nullable(),
  }),
})
export type Health = z.infer<typeof healthSchema>

export const stopCallSchema = z.object({
  advertisedAt: z.iso.datetime(),
  estimatedAt: z.iso.datetime().nullable(),
  actualAt: z.iso.datetime().nullable(),
})
export type StopCall = z.infer<typeof stopCallSchema>

export const trainStopSchema = z.object({
  signature: z.string(),
  name: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  track: z.string().nullable(),
  arrival: stopCallSchema.nullable(),
  departure: stopCallSchema.nullable(),
  passed: z.boolean(),
  canceled: z.boolean(),
  deviations: z.array(z.string()),
})
export type TrainStop = z.infer<typeof trainStopSchema>

export const trainDetailsSchema = z.object({
  id: z.string(),
  trainNumber: z.string(),
  product: z.string().nullable(),
  operator: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  cancellation: z.enum(["none", "partial", "full"]),
  delayMinutes: z.number().nullable(),
  nextStopIndex: z.number().nullable(), // index in stops
  deviations: z.array(z.string()), // for stops not yet passed
  otherInformation: z.array(z.string()),
  stops: z.array(trainStopSchema),
})
export type TrainDetails = z.infer<typeof trainDetailsSchema>
