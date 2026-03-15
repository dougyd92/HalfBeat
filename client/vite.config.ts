import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/auth': 'http://localhost:3001',
      '/spotify': 'http://localhost:3001',
      '/game': 'http://localhost:3001',
      '/ws': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
