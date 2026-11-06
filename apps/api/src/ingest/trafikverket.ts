import { z } from "zod"
import { readSseData } from "./sse"
import { trainPositionSchema, type TrainPosition } from "./trainPosition"

const API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"
const QUERY_TIMEOUT_MS = 30_000

// Same shape for the query response and for each SSE event.
const responseSchema = z.object({
  RESPONSE: z.object({
    RESULT: z.array(
      z.object({
        TrainPosition: z.array(z.unknown()).default([]),
        INFO: z.object({ SSEURL: z.string() }).optional(),
      }),
    ),
  }),
})

export function buildQuery(apiKey: string, since: Date): string {
  // The filter needs an absolute time, since $dateadd isn't supported together with sseurl.
  // No filter on Status.Active: the stream uses the same filter, and we need inactive events.
  return [
    "<REQUEST>",
    `<LOGIN authenticationkey="${escapeXml(apiKey)}"/>`,
    '<QUERY objecttype="TrainPosition" namespace="järnväg.trafikinfo" schemaversion="1.1" sseurl="true">',
    "<FILTER>",
    `<GT name="TimeStamp" value="${since.toISOString()}"/>`,
    "</FILTER>",
    "</QUERY>",
    "</REQUEST>",
  ].join("")
}

// Validates each position on its own, so one odd train doesn't drop the whole batch.
export function parseResponse(json: unknown): {
  positions: TrainPosition[]
  sseUrl: string | null
} {
  const result = responseSchema.parse(json).RESPONSE.RESULT[0]
  if (!result) return { positions: [], sseUrl: null }

  const positions: TrainPosition[] = []
  let invalidCount = 0
  for (const item of result.TrainPosition) {
    const parsed = trainPositionSchema.safeParse(item)
    if (parsed.success) {
      positions.push(parsed.data)
    } else {
      invalidCount++
    }
  }
  if (invalidCount > 0) {
    console.warn(`Skipped ${invalidCount} invalid TrainPosition(s)`)
  }

  return { positions, sseUrl: result.INFO?.SSEURL ?? null }
}

export async function postQuery(body: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body,
    signal: AbortSignal.any([signal, AbortSignal.timeout(QUERY_TIMEOUT_MS)]),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Trafikverket query failed with ${response.status}: ${text.slice(0, 500)}`)
  }

  return response.json()
}

export async function queryTrainPositions(
  apiKey: string,
  since: Date,
  signal: AbortSignal,
): Promise<{ positions: TrainPosition[]; sseUrl: string }> {
  const { positions, sseUrl } = parseResponse(await postQuery(buildQuery(apiKey, since), signal))
  if (!sseUrl) throw new Error("Trafikverket response has no SSE URL")

  return { positions, sseUrl }
}

// Yields one batch of positions per SSE event. Ends when the stream closes or the signal aborts.
export async function* streamTrainPositions(
  sseUrl: string,
  signal: AbortSignal,
): AsyncGenerator<TrainPosition[]> {
  const response = await fetch(sseUrl, {
    headers: { Accept: "text/event-stream" },
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(`Trafikverket stream failed with ${response.status}`)
  }

  for await (const data of readSseData(response.body)) {
    yield parseResponse(JSON.parse(data)).positions
  }
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
