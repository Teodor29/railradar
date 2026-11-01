import { useEffect, useState } from "react"
import { healthSchema, type Health } from "@railradar/shared"

export function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((json) => setHealth(healthSchema.parse(json)))
      .catch((err: unknown) => setError(String(err)))
  }, [])

  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">RailRadar</h1>
      {error && <p className="text-red-400">{error}</p>}
      {health && (
        <pre className="max-w-full overflow-x-auto rounded-lg bg-white/5 p-4 text-sm">
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
    </main>
  )
}
