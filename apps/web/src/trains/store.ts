import type { z } from "zod"
import {
  heartbeatEventSchema,
  removeEventSchema,
  snapshotEventSchema,
  updateEventSchema,
  type StreamTrain,
} from "@railradar/shared"

// The server sends a heartbeat every 15 s, so this means three missed in a row.
const SILENCE_TIMEOUT_MS = 45_000
const WATCHDOG_INTERVAL_MS = 5_000
const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
// EventSource.CLOSED, which doesn't exist in Node where the tests run.
const CLOSED = 2
const STALE_AFTER_MS = 2 * 60 * 1000

// "Senast sett": the train stays on the map but its position is getting old.
export function isStale(train: StreamTrain, serverNow: number): boolean {
  return serverNow - train.t * 1000 > STALE_AFTER_MS
}

export type TrainChanges = {
  updated: string[]
  removed: string[]
}

type Listener = (changes: TrainChanges) => void

// The part of EventSource the store uses, so tests can pass a fake.
export type StreamSource = {
  readyState: number
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void
  close(): void
}
export type CreateSource = (url: string) => StreamSource

// Live trains from /api/stream. Knows nothing about the map.
export class TrainStore {
  private trains = new Map<string, StreamTrain>()
  private listeners = new Set<Listener>()
  private connectionListeners = new Set<() => void>()
  private connected = false
  private source: StreamSource | null = null
  private lastEventAt = 0
  private backoffMs = MIN_BACKOFF_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private clockOffsetMs = 0
  private url: string
  private createSource: CreateSource

  constructor(url: string, createSource: CreateSource = (streamUrl) => new EventSource(streamUrl)) {
    this.url = url
    this.createSource = createSource
  }

  get size(): number {
    return this.trains.size
  }

  get isConnected(): boolean {
    return this.connected
  }

  get(id: string): StreamTrain | undefined {
    return this.trains.get(id)
  }

  all(): StreamTrain[] {
    return [...this.trains.values()]
  }

  // Server time in ms, so "last seen" doesn't depend on the device clock being right.
  serverNow(): number {
    return Date.now() + this.clockOffsetMs
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  subscribeConnection(listener: () => void): () => void {
    this.connectionListeners.add(listener)
    return () => this.connectionListeners.delete(listener)
  }

  start(): void {
    this.connect()
    this.watchdogTimer = setInterval(() => this.checkConnection(), WATCHDOG_INTERVAL_MS)
  }

  stop(): void {
    this.setConnected(false)
    this.source?.close()
    this.source = null
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  private connect(): void {
    const source = this.createSource(this.url)
    this.source = source
    this.lastEventAt = Date.now()

    source.addEventListener("snapshot", (event) => {
      this.handle(event, snapshotEventSchema, (trains) => this.replaceAll(trains))
      this.backoffMs = MIN_BACKOFF_MS
      this.setConnected(true)
    })
    source.addEventListener("update", (event) => {
      this.handle(event, updateEventSchema, (trains) => this.update(trains))
    })
    source.addEventListener("remove", (event) => {
      this.handle(event, removeEventSchema, (ids) => this.remove(ids))
    })
    source.addEventListener("heartbeat", (event) => {
      this.handle(event, heartbeatEventSchema, (heartbeat) => {
        this.clockOffsetMs = heartbeat.t * 1000 - Date.now()
      })
    })
    // EventSource retries by itself while CONNECTING, but gives up for good on e.g. a 502.
    source.addEventListener("error", () => {
      this.setConnected(false)
      this.checkConnection()
    })
  }

  private setConnected(connected: boolean): void {
    if (connected === this.connected) {
      return
    }
    this.connected = connected
    for (const listener of this.connectionListeners) {
      listener()
    }
  }

  private handle<T>(
    event: MessageEvent<string>,
    schema: z.ZodType<T>,
    apply: (data: T) => void,
  ): void {
    this.lastEventAt = Date.now()

    let data: unknown
    try {
      data = JSON.parse(event.data)
    } catch {
      console.warn(`Invalid JSON in ${event.type} event from stream`)
      return
    }

    const result = schema.safeParse(data)
    if (!result.success) {
      console.warn(`Invalid ${event.type} event from stream`, result.error)
      return
    }
    apply(result.data)
  }

  private checkConnection(): void {
    if (!this.source || this.reconnectTimer) {
      return
    }

    const closed = this.source.readyState === CLOSED
    const silent = Date.now() - this.lastEventAt > SILENCE_TIMEOUT_MS
    if (closed || silent) {
      this.reconnect()
    }
  }

  private reconnect(): void {
    this.setConnected(false)
    this.source?.close()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.backoffMs)
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
  }

  // A snapshot is the full truth, so trains missing from it are gone.
  private replaceAll(trains: StreamTrain[]): void {
    const previousIds = new Set(this.trains.keys())
    this.trains.clear()

    for (const train of trains) {
      this.trains.set(train.i, train)
      previousIds.delete(train.i)
    }
    this.emit({ updated: trains.map((train) => train.i), removed: [...previousIds] })
  }

  private update(trains: StreamTrain[]): void {
    for (const train of trains) {
      this.trains.set(train.i, train)
    }
    this.emit({ updated: trains.map((train) => train.i), removed: [] })
  }

  private remove(ids: string[]): void {
    const removed = ids.filter((id) => this.trains.delete(id))
    this.emit({ updated: [], removed })
  }

  private emit(changes: TrainChanges): void {
    if (changes.updated.length === 0 && changes.removed.length === 0) {
      return
    }
    for (const listener of this.listeners) {
      listener(changes)
    }
  }
}
