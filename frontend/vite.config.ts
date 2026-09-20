import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173, open: false, proxy: Object.fromEntries(['/experiments', '/generation', '/generations', '/select', '/evolve', '/agent-states', '/corpus', '/media', '/health'].map(path => [path, 'http://127.0.0.1:8000'])) },
})
