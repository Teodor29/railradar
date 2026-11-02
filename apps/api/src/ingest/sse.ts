// Minimal SSE reader. Yields the data of each event; ids, event names and comments are ignored
// since we re-query instead of resuming with Last-Event-ID.
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ""
  let dataLines: string[] = []

  for await (const bytes of body) {
    // stream: true keeps multi-byte characters that are split across chunks intact.
    buffer += decoder.decode(bytes, { stream: true })

    // Trafikverket uses CRLF. A trailing "\r" stays in the buffer until its "\n" arrives.
    const lines = buffer.split(/\r\n|\n/)
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (line === "") {
        if (dataLines.length > 0) {
          yield dataLines.join("\n")
          dataLines = []
        }
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""))
      }
    }
  }
}
