import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Web-SPA. Im Dev wird /api an den Fastify-Server (Port 3000) weitergereicht,
// in Produktion liefert Fastify das gebaute SPA selbst aus (gleiche Origin).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
