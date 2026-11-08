import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: [".devtunnels.ms"],
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
})
