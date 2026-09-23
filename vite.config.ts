import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Distinct port from apps/client (5173) - both dev servers run against
    // the same backend at once.
    port: 5174,
    proxy: {
      // Same convention as apps/client: fetch calls use /api/v1/... and
      // this strips only the /api prefix, leaving /v1/... to match the
      // server's route prefix.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
