import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import type pg from "pg"

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../migrations")
// Godtyckligt men fast nummer så att bara en process migrerar åt gången.
const LOCK_ID = 727274

export async function migrate(pool: pg.Pool): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations")
    const applied = new Set(rows.map((row) => row.name))
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort()

    for (const file of files) {
      if (applied.has(file)) continue
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8")
      await client.query("BEGIN")
      try {
        await client.query(sql)
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file])
        await client.query("COMMIT")
        console.log(`Applied migration ${file}`)
      } catch (err) {
        await client.query("ROLLBACK")
        throw new Error(`Migration ${file} failed`, { cause: err })
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {})
    client.release()
  }
}
