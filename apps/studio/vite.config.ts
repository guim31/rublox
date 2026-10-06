import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Serves Blockly's media (zoom and trash icons, cursors) at `/blockly-media/` from the
 * installed package, so that nothing is fetched from a CDN (SPEC § 5.5).
 */
function blocklyMedia(): Plugin {
  const require = createRequire(import.meta.url)
  const media = join(dirname(require.resolve('blockly')), 'media')
  const files = readdirSync(media).filter((name) => !name.endsWith('.mp3'))
  return {
    name: 'rublox:blockly-media',
    configureServer(server) {
      server.middlewares.use('/blockly-media', (req, res, next) => {
        const name = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0] ?? '')
        if (!files.includes(name)) return next()
        res.setHeader(
          'Content-Type',
          name.endsWith('.svg')
            ? 'image/svg+xml'
            : name.endsWith('.png')
              ? 'image/png'
              : 'application/octet-stream',
        )
        res.end(readFileSync(join(media, name)))
      })
    },
    generateBundle() {
      for (const name of files) {
        this.emitFile({
          type: 'asset',
          fileName: `blockly-media/${name}`,
          source: readFileSync(join(media, name)),
        })
      }
    },
  }
}

// The studio origin (SPEC § 6.6): localhost:5173 in development. The API server runs on
// localhost:3000 (`pnpm dev` starts it) and is reached through the proxy below.
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true, quoteStyle: 'single' }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    blocklyMedia(),
  ],
  // One copy of these, whatever peer variants pnpm installs for each workspace package: two
  // Blockly copies keep two workspace registries (`getWorkspaceById` returns null).
  resolve: { dedupe: ['blockly', 'yjs'] },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
      // Project documents (Hocuspocus); the server checks Host and Origin, kept as they are.
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  preview: { host: 'localhost', port: 5173, strictPort: true },
  build: {
    assetsDir: '_app',
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
})
