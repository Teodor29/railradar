type Entry<Value> = {
  value: Promise<Value>
  expiresAt: number
}

// Stores the promise, so that concurrent calls for a key share one load. Failed loads aren't kept.
export function createTtlCache<Value>(
  load: (key: string) => Promise<Value>,
  ttlMs: number,
): (key: string) => Promise<Value> {
  const entries = new Map<string, Entry<Value>>()

  function removeExpired(now: number) {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key)
    }
  }

  return (key) => {
    const now = Date.now()
    removeExpired(now)

    const cached = entries.get(key)
    if (cached) return cached.value

    const value = load(key)
    entries.set(key, { value, expiresAt: now + ttlMs })
    value.catch(() => entries.delete(key))

    return value
  }
}
