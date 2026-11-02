import { useSyncExternalStore } from "react"

export type ColorScheme = "light" | "dark"

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)")

function subscribe(onChange: () => void) {
  darkQuery.addEventListener("change", onChange)
  return () => darkQuery.removeEventListener("change", onChange)
}

function getColorScheme(): ColorScheme {
  if (darkQuery.matches) {
    return "dark"
  }
  return "light"
}

export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribe, getColorScheme)
}
