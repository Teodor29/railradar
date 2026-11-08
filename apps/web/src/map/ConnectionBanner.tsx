import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { WifiOff } from "lucide-react"
import type { TrainStore } from "../trains/store"

const SHOW_AFTER_MS = 5_000

export function ConnectionBanner({ store }: { store: TrainStore }) {
  const subscribe = useCallback(
    (onChange: () => void) => store.subscribeConnection(onChange),
    [store],
  )
  const connected = useSyncExternalStore(subscribe, () => store.isConnected)

  if (connected) {
    return null
  }
  return <DelayedBanner />
}

function DelayedBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) {
    return null
  }

  return (
    <div className="absolute top-4 left-4 flex md:right-4 md:left-auto">
      <div
        role="status"
        className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm text-fg shadow-md"
      >
        <WifiOff className="size-4 shrink-0 text-warning" />
        Ingen kontakt med servern. Försöker igen…
      </div>
    </div>
  )
}
