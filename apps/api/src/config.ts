import { z } from "zod"

const envSchema = z.object({
  TRAFIKVERKET_API_KEY: z.string().min(1),
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error("Invalid environment:", z.prettifyError(parsed.error))
  process.exit(1)
}

export const config = parsed.data
