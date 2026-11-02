import { config } from "./config"
import { createApp } from "./app"
import { migrate } from "./db/migrate"
import { pool } from "./db/pool"
import { startIngest } from "./ingest/ingest"

await migrate(pool)
const stopIngest = startIngest(config.TRAFIKVERKET_API_KEY)

const server = createApp().listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`)
})

function shutdown() {
  stopIngest()
  server.close()
  pool.end().finally(() => process.exit(0))
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
