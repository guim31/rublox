import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The player is served on the apps origin (SPEC § 6.6): 127.0.0.1:5174 in development.
export default defineConfig({
  plugins: [react()],
  // Uploaded files (`/assets/<sha256>`) come from the API server, which tells the apps origin
  // from the studio's by the Host header: keep this origin's.
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/assets': { target: 'http://localhost:3000', headers: { host: '127.0.0.1:5174' } },
    },
  },
  preview: { host: '127.0.0.1', port: 5174, strictPort: true },
  // `/assets/` belongs to project resources on the apps origin: keep the build elsewhere.
  build: { assetsDir: '_app', target: 'es2022' },
})
