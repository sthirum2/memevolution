import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    open: false,
    // A cloudflared quick tunnel puts the app behind a random trycloudflare.com
    // host each run; Vite's dev server rejects unrecognized Host headers unless
    // the suffix is allowed here.
    allowedHosts: ['.trycloudflare.com'],
    proxy: Object.fromEntries(['/experiments', '/generation', '/generations', '/select', '/evolve', '/agent-states', '/corpus', '/capabilities', '/media', '/health', '/reset'].map(path => [path, 'http://127.0.0.1:8000'])),
  },
})
