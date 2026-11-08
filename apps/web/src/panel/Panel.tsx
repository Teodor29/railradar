import type { ReactNode } from "react"
import { X } from "lucide-react"

type PanelProps = {
  title: string
  // Shown large under the title, since it says more than the title.
  heading: ReactNode
  onClose: () => void
  children: ReactNode
}

// Bottom sheet on mobile, side panel on desktop.
export function Panel({ title, heading, onClose, children }: PanelProps) {
  return (
    <section
      aria-label={title}
      className="absolute inset-x-0 bottom-0 flex max-h-[70dvh] flex-col rounded-t-2xl bg-page shadow-lg md:top-4 md:bottom-auto md:left-4 md:max-h-[calc(100%-2rem)] md:w-96 md:rounded-2xl"
    >
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line/60 md:hidden" />

      <header className="flex shrink-0 items-start gap-3 px-4 pt-3 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted">{title}</p>
          <h2 className="text-xl font-semibold">{heading}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Stäng"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-muted transition-colors hover:bg-surface-hover"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </section>
  )
}
