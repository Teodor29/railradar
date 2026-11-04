import type { ReactNode } from "react"

const toneClasses = {
  default: "text-fg",
  accent: "text-accent",
}

type MapButtonProps = {
  label: string
  onClick: () => void
  children: ReactNode
  tone?: keyof typeof toneClasses
  disabled?: boolean
  busy?: boolean
  title?: string
}

// Card floating over the map that stacks one or more MapButton.
export function MapControlGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-line/40 overflow-hidden rounded-xl bg-surface shadow-md">
      {children}
    </div>
  )
}

export function MapButton({
  label,
  onClick,
  children,
  tone = "default",
  disabled = false,
  busy = false,
  title,
}: MapButtonProps) {
  const classes = [
    "flex size-11 items-center justify-center transition-colors hover:bg-page disabled:opacity-40 cursor-pointer",
    toneClasses[tone],
  ]
  if (busy) {
    classes.push("animate-pulse")
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-busy={busy}
      title={title}
      className={classes.join(" ")}
    >
      {children}
    </button>
  )
}
