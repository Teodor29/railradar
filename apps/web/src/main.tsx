import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./index.css"

// Opened from the iOS home screen. display-mode: standalone doesn't match there without a manifest.
if ((navigator as Navigator & { standalone?: boolean }).standalone) {
  document.documentElement.classList.add("standalone")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
