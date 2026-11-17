// The selected train is kept in the URL as ?tag=<id>, so a link opens the same train.
const PARAM = "tag"

export function readLinkedTrainId(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM)
}

// replaceState, so selecting trains doesn't fill up the back button history.
export function writeLinkedTrainId(id: string | null): void {
  const url = new URL(window.location.href)
  if (id) {
    url.searchParams.set(PARAM, id)
  } else {
    url.searchParams.delete(PARAM)
  }
  window.history.replaceState(null, "", url)
}
