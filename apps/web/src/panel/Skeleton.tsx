// Placeholder for text that is loading. The non-breaking space gives it the
// line height of the surrounding text, so nothing moves when the text arrives.
export function Skeleton({ className }: { className: string }) {
  return (
    <span aria-hidden className={`inline-block animate-pulse rounded-md bg-line/25 ${className}`}>
      {" "}
    </span>
  )
}
