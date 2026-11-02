import { isRemoval, toTrainState, type TrainPosition, type TrainState } from "./trainPosition"

const STALE_AFTER_MS = 30 * 60 * 1000

export type TrainChanges = {
  updated: TrainState[]
  removed: string[]
}

// Latest known state per train, keyed by TrainState.id.
// Also tracks which trains changed since the last call to takeChanges().
export class TrainStore {
  private trains = new Map<string, TrainState>()
  private changedIds = new Set<string>()
  private removedIds = new Set<string>()

  get size(): number {
    return this.trains.size
  }

  get(id: string): TrainState | undefined {
    return this.trains.get(id)
  }

  all(): TrainState[] {
    return [...this.trains.values()]
  }

  applyPosition(position: TrainPosition): void {
    const train = toTrainState(position)
    if (!train) return

    // The same advertised train can have several positions with different operational
    // numbers, where the old one is often inactive. Ignore anything older than what we have.
    const current = this.trains.get(train.id)
    if (current && train.measuredAt < current.measuredAt) return

    if (isRemoval(position)) {
      this.remove(train.id)
    } else {
      this.set(train)
    }
  }

  // Used after the initial query. Oldest first, so the newest position per train wins.
  replaceAll(positions: TrainPosition[]): void {
    const previousIds = [...this.trains.keys()]
    this.trains.clear()

    const oldestFirst = [...positions].sort(
      (first, second) => Date.parse(first.TimeStamp) - Date.parse(second.TimeStamp),
    )
    for (const position of oldestFirst) {
      this.applyPosition(position)
    }

    // Trains that were known before but are gone now must be removed from clients.
    for (const id of previousIds) {
      if (!this.trains.has(id)) {
        this.changedIds.delete(id)
        this.removedIds.add(id)
      }
    }
  }

  pruneStale(now: Date): void {
    for (const [id, train] of this.trains) {
      if (now.getTime() - train.measuredAt.getTime() > STALE_AFTER_MS) {
        this.remove(id)
      }
    }
  }

  // Returns what changed since the last call and starts over.
  takeChanges(): TrainChanges {
    const updated: TrainState[] = []
    for (const id of this.changedIds) {
      const train = this.trains.get(id)
      if (train) updated.push(train)
    }
    const removed = [...this.removedIds]

    this.changedIds.clear()
    this.removedIds.clear()
    return { updated, removed }
  }

  private set(train: TrainState): void {
    this.trains.set(train.id, train)
    this.changedIds.add(train.id)
    this.removedIds.delete(train.id)
  }

  private remove(id: string): void {
    // A removal for a train we don't know is not news to anyone.
    if (!this.trains.delete(id)) return

    this.changedIds.delete(id)
    this.removedIds.add(id)
  }
}
