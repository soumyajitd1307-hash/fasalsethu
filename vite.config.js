import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/fasalsethu/',
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
})
