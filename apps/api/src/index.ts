import { config } from "./config"
import { createApp } from "./app"
import { migrate } from "./db/migrate"
import { pool } from "./db/pool"
import { startIngest, trains } from "./ingest/ingest"
import { startStationSync, stations } from "./stations/sync"
import { startBroadcast } from "./stream/broadcaster"
import { createTrainDetailsLoader } from "./trains/trainDetails"

await migrate(pool)
const stopIngest = startIngest(config.TRAFIKVERKET_API_KEY)
const stopStationSync = startStationSync(config.TRAFIKVERKET_API_KEY)

const broadcaster = startBroadcast(trains)
const getTrainDetails = createTrainDetailsLoader(config.TRAFIKVERKET_API_KEY, stations)

const server = createApp(broadcaster, getTrainDetails).listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`)
})

function shutdown() {
  stopIngest()
  stopStationSync()
  // Open streams would otherwise keep server.close() waiting.
  broadcaster.stop()
  server.close()
  pool.end().finally(() => process.exit(0))
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
