import { useEffect, useState } from "react"
import { Check, Share } from "lucide-react"
import { HeaderButton } from "./Panel"

const COPIED_MS = 2_000

// The share sheet where there is one (mostly mobile), otherwise copies the link.
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
      }
    } catch {
      // Closing the share sheet also rejects, so there is nothing to report.
    }
  }

  return (
    <HeaderButton onClick={share} aria-label={copied ? "Länk kopierad" : "Dela tåget"}>
      {copied ? <Check className="size-5 text-success" /> : <Share className="size-5" />}
    </HeaderButton>
  )
}
