import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react"
import { X } from "lucide-react"

// Tailwind's md breakpoint, where the sheet becomes a side panel.
const DESKTOP_QUERY = "(min-width: 48rem)"
const SWIPE_DISTANCE_PX = 40
// Matches duration-200 on the sheet.
const SETTLE_MS = 200

type Gesture = { startY: number; startHeight: number; maxHeight: number }
type SheetDrag = { height: number; settling: boolean }

function createGesture(section: HTMLElement, startY: number): Gesture {
  return {
    startY,
    startHeight: section.offsetHeight,
    maxHeight: parseFloat(getComputedStyle(section).maxHeight),
  }
}

function getDragHeight(gesture: Gesture, clientY: number): number {
  const height = gesture.startHeight + gesture.startY - clientY
  return Math.max(0, Math.min(height, gesture.maxHeight))
}

// The sheet height that ends just below the given part of its content.
function getHeightBelow(content: HTMLElement, scroller: HTMLElement): number {
  const paddingBottom = parseFloat(getComputedStyle(scroller).paddingBottom)
  return content.offsetTop + content.offsetHeight + paddingBottom
}

export function HeaderButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-muted transition-colors after:absolute after:-inset-1 hover:bg-surface-hover"
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
  // Extra buttons in the header, before the close button.
  actions?: ReactNode
  // Only applies to mobile, the side panel on desktop always shows everything.
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

// Bottom sheet on mobile, side panel on desktop.
export function Panel({
  title,
  heading,
  onClose,
  children,
  more,
  actions,
  expanded,
  onExpandedChange,
}: PanelProps) {
  const [drag, setDrag] = useState<SheetDrag | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const settleTimer = useRef<number | undefined>(undefined)
  const sectionRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const compactRef = useRef<HTMLDivElement>(null)
  const fullRef = useRef<HTMLDivElement>(null)
  const touchY = useRef(0)

  // A native listener, since React's touchmove is passive and can't stop the content scrolling.
  // Touch events, because pointer events end as soon as the browser starts scrolling.
  useEffect(() => {
    const section = sectionRef.current
    const scroller = scrollerRef.current
    if (!section || !scroller) {
      return
    }

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const previousY = touchY.current
      touchY.current = touch.clientY

      if (!gesture.current) {
        const target = event.target
        if (!(target instanceof Element)) {
          return
        }
        // Header buttons are tapped, not dragged. The handle is a button too, but dragging it
        // should move the sheet, and so should the stops in the scrolling content.
        const button = target.closest("button:not([data-handle])")
        if (button && !scroller.contains(button)) {
          return
        }
        // Expanded content scrolls first and hands over to the sheet at the top.
        const pullingFromTop = scroller.scrollTop <= 0 && touch.clientY > previousY
        if (expanded && scroller.contains(target) && !pullingFromTop) {
          return
        }
        if (window.matchMedia(DESKTOP_QUERY).matches) {
          return
        }
        window.clearTimeout(settleTimer.current)
        gesture.current = createGesture(section, previousY)
      }

      // Not cancelable if the browser already scrolls, but then the list is at its top anyway.
      if (event.cancelable) {
        event.preventDefault()
      }
      setDrag({ height: getDragHeight(gesture.current, touch.clientY), settling: false })
    }

    section.addEventListener("touchmove", handleTouchMove, { passive: false })
    return () => section.removeEventListener("touchmove", handleTouchMove)
  }, [expanded])

  function settle(nextExpanded: boolean) {
    const maxHeight = gesture.current?.maxHeight
    gesture.current = null

    const scroller = scrollerRef.current
    const target = nextExpanded ? fullRef.current : compactRef.current
    // Without a drag there is nothing to settle.
    if (!drag || maxHeight === undefined || !scroller || !target) {
      return
    }

    onExpandedChange(nextExpanded)
    setDrag({ height: Math.min(getHeightBelow(target, scroller), maxHeight), settling: true })
    settleTimer.current = window.setTimeout(() => setDrag(null), SETTLE_MS)
  }

  function finishGesture() {
    if (!gesture.current) {
      return
    }

    const movedUp = gesture.current.startY - touchY.current
    if (movedUp > SWIPE_DISTANCE_PX) {
      settle(true)
    } else if (movedUp >= -SWIPE_DISTANCE_PX) {
      settle(expanded)
    } else if (expanded) {
      settle(false)
    } else {
      gesture.current = null
      onClose()
    }
  }

  return (
    <section
      ref={sectionRef}
      aria-label={title}
      data-panel
      style={drag ? { height: drag.height } : undefined}
      className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-page shadow-lg md:top-4 md:bottom-auto md:left-[max(1rem,env(safe-area-inset-left))] md:max-h-[calc(100%-2rem)] md:w-96 md:rounded-2xl ${drag?.settling ? "transition-[height] duration-200 ease-out" : ""}`}
      onTouchStart={(event) => {
        touchY.current = event.touches.item(0).clientY
      }}
      onTouchEnd={finishGesture}
      onTouchCancel={() => settle(expanded)}
    >
      <div className="shrink-0 touch-none select-none md:touch-auto md:select-auto">
        {/* Tap to expand or collapse, like swiping. Only on mobile, where it's a bottom sheet. */}
        <button
          type="button"
          data-handle
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? "Visa mindre" : "Visa mer"}
          className="flex w-full cursor-pointer justify-center pt-2 pb-3 md:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-line/60" />
        </button>

        <header className="flex items-start gap-2 px-4 pb-4 md:pt-3">
          <div className="mr-1 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted">{title}</p>
            <h2 className="text-xl font-semibold">{heading}</h2>
          </div>
          {actions}
          <HeaderButton onClick={onClose} aria-label="Stäng">
            <X className="size-5" />
          </HeaderButton>
        </header>
      </div>

      <div
        ref={scrollerRef}
        className="overflow-y-auto overscroll-y-none px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [scrollbar-width:thin]"
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
