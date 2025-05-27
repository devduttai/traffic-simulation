import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/traffic-simulation/",
  server: {
    port: 3000,
    host: true
  }
})
