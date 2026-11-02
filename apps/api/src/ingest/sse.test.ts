import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { readSseData } from "./sse"

const sseFixture = readFileSync(
  new URL("../../test/fixtures/trainPosition-sse.txt", import.meta.url),
  "utf8",
)

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function splitEvery(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let start = 0; start < text.length; start += size) {
    chunks.push(text.slice(start, start + size))
  }
  return chunks
}

async function collect(body: ReadableStream<Uint8Array>): Promise<string[]> {
  const events: string[] = []
  for await (const data of readSseData(body)) {
    events.push(data)
  }
  return events
}

describe("readSseData", () => {
  it("reads every event in the recorded stream", async () => {
    const events = await collect(streamOf([sseFixture]))

    expect(events).toHaveLength(3)
    for (const data of events) {
      expect(JSON.parse(data)).toHaveProperty("RESPONSE")
    }
  })

  it("gives the same result when chunks split lines and CRLF pairs", async () => {
    const whole = await collect(streamOf([sseFixture]))

    // Odd chunk sizes land in the middle of "\r\n" somewhere in the fixture.
    for (const size of [1, 7, 333]) {
      expect(await collect(streamOf(splitEvery(sseFixture, size)))).toEqual(whole)
    }
  })

  it("handles LF line endings, comments and multi-line data", async () => {
    const stream = streamOf([": keepalive\n\nid: 1\ndata: first\ndata:second\n\n"])

    expect(await collect(stream)).toEqual(["first\nsecond"])
  })

  it("drops an unfinished event when the stream ends", async () => {
    expect(await collect(streamOf(["data: done\n\ndata: partial"]))).toEqual(["done"])
  })
})
