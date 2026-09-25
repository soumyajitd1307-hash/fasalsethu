import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/fasalsethu/',
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
    },
  },
  build: {
    // Bump chunk warning limit (scroll frame images are fetched dynamically, not bundled)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor'
            if (id.includes('framer-motion')) return 'motion'
            if (id.includes('three') || id.includes('@react-three')) return 'three'
            if (id.includes('react-router')) return 'router'
          }
        },
      },
    },
  },
})

