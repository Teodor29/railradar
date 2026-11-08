import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent,
  type ReactNode,
} from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"

// Tailwind's md breakpoint, where the sheet becomes a side panel.
const DESKTOP_QUERY = "(min-width: 48rem)"
const SWIPE_DISTANCE_PX = 40
// Matches duration-200 on the sheet.
const SETTLE_MS = 200

type Gesture = { startY: number; startHeight: number; maxHeight: number }
type SheetDrag = { height: number; settling: boolean }

// The sheet height that ends just below the given part of its content.
function getHeightBelow(content: HTMLElement, scroller: HTMLElement): number {
  const paddingBottom = parseFloat(getComputedStyle(scroller).paddingBottom)
  return content.offsetTop + content.offsetHeight + paddingBottom
}

function HeaderButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-muted transition-colors hover:bg-surface-hover"
      {...props}
    />
  )
}

type PanelProps = {
  title: string
  // Shown large under the title, since it says more than the title.
  heading: ReactNode
  onClose: () => void
  children: ReactNode
  // Added below children when the panel is expanded.
  more: ReactNode
}

// Bottom sheet on mobile, side panel on desktop.
export function Panel({ title, heading, onClose, children, more }: PanelProps) {
  // Only applies to mobile, the side panel on desktop always shows everything.
  const [expanded, setExpanded] = useState(false)
  const [drag, setDrag] = useState<SheetDrag | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const settleTimer = useRef<number | undefined>(undefined)
  const sectionRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const compactRef = useRef<HTMLDivElement>(null)
  const fullRef = useRef<HTMLDivElement>(null)

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const section = sectionRef.current
    if (!section || window.matchMedia(DESKTOP_QUERY).matches) {
      return
    }
    if (event.target instanceof Element && event.target.closest("button")) {
      return
    }

    window.clearTimeout(settleTimer.current)
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = {
      startY: event.clientY,
      startHeight: section.offsetHeight,
      maxHeight: parseFloat(getComputedStyle(section).maxHeight),
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!gesture.current) {
      return
    }
    const { startY, startHeight, maxHeight } = gesture.current
    const height = startHeight + startY - event.clientY
    setDrag({ height: Math.max(0, Math.min(height, maxHeight)), settling: false })
  }

  function settle(nextExpanded: boolean) {
    const maxHeight = gesture.current?.maxHeight
    gesture.current = null

    const scroller = scrollerRef.current
    const target = nextExpanded ? fullRef.current : compactRef.current
    // Without a drag this was a tap on the header, which does nothing.
    if (!drag || maxHeight === undefined || !scroller || !target) {
      return
    }

    setExpanded(nextExpanded)
    setDrag({ height: Math.min(getHeightBelow(target, scroller), maxHeight), settling: true })
    settleTimer.current = window.setTimeout(() => setDrag(null), SETTLE_MS)
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!gesture.current) {
      return
    }

    const movedUp = gesture.current.startY - event.clientY
    if (!expanded && movedUp < -SWIPE_DISTANCE_PX) {
      gesture.current = null
      onClose()
      return
    }

    if (movedUp > SWIPE_DISTANCE_PX) {
      settle(true)
    } else if (movedUp < -SWIPE_DISTANCE_PX) {
      settle(false)
    } else {
      settle(expanded)
    }
  }

  return (
    <section
      ref={sectionRef}
      aria-label={title}
      style={drag ? { height: drag.height } : undefined}
      className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-page shadow-lg md:top-4 md:bottom-auto md:left-4 md:max-h-[calc(100%-2rem)] md:w-96 md:rounded-2xl ${drag?.settling ? "transition-[height] duration-200 ease-out" : ""}`}
    >
      <div
        className="shrink-0 touch-none select-none md:touch-auto md:select-auto"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => settle(expanded)}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line/60 md:hidden" />

        <header className="flex items-start gap-2 px-4 pt-3 pb-4">
          <div className="mr-1 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted">{title}</p>
            <h2 className="text-xl font-semibold">{heading}</h2>
          </div>
          <div className="md:hidden">
            <HeaderButton
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? "Visa mindre" : "Visa mer"}
            >
              {expanded ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
            </HeaderButton>
          </div>
          <HeaderButton onClick={onClose} aria-label="Stäng">
            <X className="size-5" />
          </HeaderButton>
        </header>
      </div>

      <div
        ref={scrollerRef}
        className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [scrollbar-width:thin]"
      >
        <div ref={fullRef} className="flex flex-col gap-3">
          <div ref={compactRef} className="flex flex-col gap-3">
            {children}
          </div>
          {/* Shown during a drag so that there is something to pull into view. */}
          <div className={expanded || drag ? "contents" : "hidden md:contents"}>{more}</div>
        </div>
      </div>
    </section>
  )
}
