import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

// False when the tab is in the background or the app is switched away from on mobile.
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, () => !document.hidden)
}
