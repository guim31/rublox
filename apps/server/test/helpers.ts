import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import { openDatabase } from '../src/db/index.ts'
import { createServices } from '../src/services.ts'

export const STUDIO = 'http://studio.example.com'
export const APPS = 'http://apps.example.com'

export function indexHtml(name: string): string {
  return `<!doctype html><html><head><script id="rublox-config" type="application/json">{"studioUrl":"http://localhost:5173","appsUrl":"http://127.0.0.1:5174"}</script></head><body>${name}</body></html>`
}

function writeTree(root: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
}

/** Temporary studio and player dist folders, as produced by `vite build`. */
export function createDistFixture() {
  const root = mkdtempSync(join(tmpdir(), 'rublox-dist-'))
  const studioDist = join(root, 'studio')
  const playerDist = join(root, 'player')
  writeTree(studioDist, {
    'index.html': indexHtml('studio'),
    '_app/index-abc123.js': 'console.log("studio")',
    'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'manifest.webmanifest': '{}',
  })
  writeTree(playerDist, {
    'index.html': indexHtml('player'),
    '_app/player-def456.js': 'console.log("player")',
    '_app/engine.wasm': 'wasm',
  })
  writeFileSync(join(root, 'secret.txt'), 'outside the dist folder')
  return {
    root,
    studioDist,
    playerDist,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

export function testApp(
  dist: { studioDist: string; playerDist: string },
  options: { studioUrl?: string; ping?: () => Promise<void> } = {},
) {
  const config = loadConfig({
    NODE_ENV: 'test',
    STUDIO_URL: options.studioUrl ?? STUDIO,
    APPS_URL: APPS,
    STUDIO_DIST: dist.studioDist,
    PLAYER_DIST: dist.playerDist,
  })
  // Routing tests never reach the database: an unmigrated in-memory one is enough.
  const database = openDatabase({ databaseUrl: 'memory://', dataDir: dist.studioDist })
  const services = createServices(database.db, config)
  return createApp({ config, services, ping: options.ping ?? (async () => {}) })
}

/** Issues a request with an explicit `Host` header. */
export function get(app: ReturnType<typeof testApp>, host: string, path: string) {
  return app.request(`http://${host}${path}`, { headers: { host } })
}
