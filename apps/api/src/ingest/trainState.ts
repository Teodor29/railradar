import { isRemoval, toTrainState, type TrainPosition, type TrainState } from "./trainPosition"

const STALE_AFTER_MS = 30 * 60 * 1000

// Latest known state per train, keyed by TrainState.id.
export class TrainStore {
  private trains = new Map<string, TrainState>()

  get size(): number {
    return this.trains.size
  }

  get(id: string): TrainState | undefined {
    return this.trains.get(id)
  }

  applyPosition(position: TrainPosition): void {
    const train = toTrainState(position)
    if (!train) return

    // The same advertised train can have several positions with different operational
    // numbers, where the old one is often inactive. Ignore anything older than what we have.
    const current = this.trains.get(train.id)
    if (current && train.measuredAt < current.measuredAt) return

    if (isRemoval(position)) {
      this.trains.delete(train.id)
    } else {
      this.trains.set(train.id, train)
    }
  }

  // Used after the initial query. Oldest first, so the newest position per train wins.
  replaceAll(positions: TrainPosition[]): void {
    this.trains.clear()

    const oldestFirst = [...positions].sort(
      (first, second) => Date.parse(first.TimeStamp) - Date.parse(second.TimeStamp),
    )
    for (const position of oldestFirst) {
      this.applyPosition(position)
    }
  }

  pruneStale(now: Date): void {
    for (const [id, train] of this.trains) {
      if (now.getTime() - train.measuredAt.getTime() > STALE_AFTER_MS) {
        this.trains.delete(id)
      }
    }
  }
}
