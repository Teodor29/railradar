import { useEffect, useRef, useState } from "react"

// Collapses to a button once the user starts using the map, like MapLibre's compact attribution.
export function Attribution() {
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!expanded) {
      return
    }

    function collapse(event: Event) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) {
        return
      }
      setExpanded(false)
    }

    window.addEventListener("pointerdown", collapse)
    window.addEventListener("wheel", collapse)
    return () => {
      window.removeEventListener("pointerdown", collapse)
      window.removeEventListener("wheel", collapse)
    }
  }, [expanded])

  return (
    <div ref={rootRef} className="pointer-events-auto absolute bottom-4 left-4">
      {expanded ? (
        <div className="rounded-md bg-surface/80 px-2 py-0.5 text-xs text-muted backdrop-blur">
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap
          </a>
          {" · "}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
            OpenFreeMap
          </a>
          {" · "}
          <a href="https://www.trafikverket.se/trafikinformation/" target="_blank" rel="noreferrer">
            Trafikverket
          </a>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Visa källor för kartan"
          className="flex size-6 items-center justify-center rounded-full bg-surface/80 font-serif text-xs text-muted italic backdrop-blur"
        >
          i
        </button>
      )}
    </div>
  )
}
