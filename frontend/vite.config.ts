import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173, open: false },
  build: {
    rollupOptions: {
      output: {
        // Split the two heavy visualisation libraries out of the app chunk so
        // the first paint is not waiting on all of Recharts + React Flow.
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['recharts'],
          flow: ['@xyflow/react'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
