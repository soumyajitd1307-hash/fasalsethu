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
        manualChunks: {
          vendor: ['react', 'react-dom'],
          motion: ['framer-motion'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          router: ['react-router-dom'],
        },
      },
    },
  },
})

