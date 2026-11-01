import pg from "pg"
import { config } from "../config"

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  connectionTimeoutMillis: 5000,
})

// Utan lyssnare kraschar processen när en vilande anslutning tappas, t.ex. vid omstart av Postgres.
pool.on("error", (err) => {
  console.error("Postgres pool error:", err.message)
})

export async function pingDb(): Promise<boolean> {
  try {
    await pool.query("SELECT 1")
    return true
  } catch {
    return false
  }
}
