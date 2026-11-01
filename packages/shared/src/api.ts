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
