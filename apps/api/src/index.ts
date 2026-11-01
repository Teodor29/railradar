import { config } from "./config"
import { createApp } from "./app"
import { migrate } from "./db/migrate"
import { pool } from "./db/pool"

await migrate(pool)

const server = createApp().listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`)
})

function shutdown() {
  server.close()
  pool.end().finally(() => process.exit(0))
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
