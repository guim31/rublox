import {
  type AppBundle,
  type AppIconKey,
  type AppSettings,
  ARCHIVE_ASSETS_DIR,
  ARCHIVE_EXTENSION,
  ARCHIVE_PROJECT_FILE,
  assetHashes,
  migrateProject,
  newId,
  type ProjectDoc,
  ProjectFormatError,
  type PublishedApp,
  projectToYDoc,
} from '@rublox/schema'
import { strFromU8, strToU8, type Unzipped, unzip, type Zippable, zip } from 'fflate'
import * as Y from 'yjs'
import { api, call } from '../lib/api.ts'
import { toBase64 } from '../lib/base64.ts'
import { appsOrigin } from '../lib/config.ts'
import { sha256, storeAssetFile } from './assets.ts'
import { addProject } from './projects.ts'
import { uploadAsset } from './server-assets.ts'

type Files = Zippable

function zipAsync(files: Files): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(files, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data))),
  )
}

function unzipAsync(bytes: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) =>
    unzip(bytes, (error, data) => (error ? reject(error) : resolve(data))),
  )
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/** A file name from a project name: `Le dé magique.rublox`. */
export function fileName(name: string, extension: string): string {
  const base =
    name
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\p{Cc}+/gu, '')
      .trim()
      .slice(0, 80) || 'rublox'
  return `${base}${extension}`
}

/** Saves a file through the browser (a download). */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * A `.rublox` file (SPEC § 4.6): a zip of `project.json` (the project as JSON) and of each
 * asset under `assets/<sha256>`.
 */
export async function exportProject(
  doc: ProjectDoc,
  loadAsset: (hash: string) => Promise<Blob | undefined>,
): Promise<Blob> {
  const files: Files = {
    [ARCHIVE_PROJECT_FILE]: strToU8(JSON.stringify(doc, null, 2)),
  }
  for (const hash of assetHashes(doc)) {
    const blob = await loadAsset(hash)
    // Images and sounds are already compressed: stored as they are.
    if (blob) files[`${ARCHIVE_ASSETS_DIR}${hash}`] = [await bytesOf(blob), { level: 0 }]
  }
  return new Blob([(await zipAsync(files)) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

export type ArchiveError = 'invalid' | 'too-new'

export class ArchiveReadError extends Error {
  override name = 'ArchiveReadError'
  constructor(readonly code: ArchiveError) {
    super(code)
  }
}

/** Reads and checks a `.rublox` file: a valid project (migrated) and its files, by hash. */
export async function readArchive(
  file: Blob,
): Promise<{ doc: ProjectDoc; assets: Map<string, Blob> }> {
  let entries: Unzipped
  try {
    entries = await unzipAsync(await bytesOf(file))
  } catch {
    throw new ArchiveReadError('invalid')
  }
  const json = entries[ARCHIVE_PROJECT_FILE]
  if (!json) throw new ArchiveReadError('invalid')
  let doc: ProjectDoc
  try {
    doc = migrateProject(JSON.parse(strFromU8(json)))
  } catch (error) {
    throw new ArchiveReadError(
      error instanceof ProjectFormatError && error.code === 'too-new' ? 'too-new' : 'invalid',
    )
  }
  const assets = new Map<string, Blob>()
  for (const [hash, asset] of Object.values(doc.assets).map((a) => [a.sha256, a] as const)) {
    const bytes = entries[`${ARCHIVE_ASSETS_DIR}${hash}`]
    if (!bytes || assets.has(hash)) continue
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: asset.mime })
    // A file that does not match its name is left out, never trusted.
    if ((await sha256(blob)) === hash) assets.set(hash, blob)
  }
  return { doc, assets }
}

/**
 * Imports a `.rublox` file as a new project, in this browser or in the account. Returns the
 * new project's id.
 */
export async function importArchive(file: Blob, target: 'guest' | 'server'): Promise<string> {
  const { doc, assets } = await readArchive(file)
  const named = (hash: string) => {
    const asset = Object.values(doc.assets).find((a) => a.sha256 === hash)
    return new File([assets.get(hash) as Blob], asset?.name ?? hash, {
      type: asset?.mime ?? 'application/octet-stream',
    })
  }
  if (target === 'guest') {
    for (const hash of assets.keys()) {
      await storeAssetFile(named(hash), 'file')
    }
    return addProject({ ...doc, meta: { ...doc.meta, id: newId() } })
  }
  const state = toBase64(Y.encodeStateAsUpdate(projectToYDoc(doc)))
  const { id } = await call(api.projects.$post({ json: { state, import: true } }))
  try {
    for (const hash of assets.keys()) await uploadAsset(id, named(hash))
  } catch (error) {
    await call(api.projects[':projectId'].$delete({ param: { projectId: id } })).catch(() => {})
    throw error
  }
  return id
}

/**
 * A static website of the app (SPEC § 4.6): the player as built for the apps origin, the
 * project and its code, its files, a manifest and icons, with relative addresses so that it
 * can be hosted in any folder.
 */
export async function exportSite(options: {
  bundle: AppBundle
  settings: AppSettings
  icons: Record<AppIconKey, Blob>
  loadAsset: (hash: string) => Promise<Blob | undefined>
  readme: string
}): Promise<Blob> {
  const { bundle, settings, icons } = options
  const { doc } = bundle
  const kit = (await (await fetch(`${appsOrigin}/_rx/kit.json`, { mode: 'cors' })).json()) as {
    html: string
    files: string[]
  }
  const files: Files = {}
  for (const path of kit.files) {
    const response = await fetch(`${appsOrigin}${path}`, { mode: 'cors' })
    if (!response.ok) throw new Error(`player file ${path}: ${response.status}`)
    files[path.slice(1)] = new Uint8Array(await response.arrayBuffer())
  }
  files['index.html'] = strToU8(siteIndex(kit.html, settings, doc.meta.locale))
  const app: PublishedApp = {
    ...bundle,
    appId: `site:${doc.meta.id}`,
    slug: 'site',
    version: 1,
    settings,
  }
  files['app.json'] = strToU8(JSON.stringify(app))
  files['manifest.webmanifest'] = strToU8(
    JSON.stringify(
      {
        name: settings.name,
        short_name: settings.name,
        description: settings.description || undefined,
        lang: doc.meta.locale,
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: settings.themeColor,
        background_color: settings.backgroundColor,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      null,
      2,
    ),
  )
  files['icon-192.png'] = await bytesOf(icons['192'])
  files['icon-512.png'] = await bytesOf(icons['512'])
  files['icon-maskable.png'] = await bytesOf(icons.maskable)
  files['apple-touch-icon.png'] = await bytesOf(icons.apple)
  for (const hash of assetHashes(doc)) {
    const blob = await options.loadAsset(hash)
    if (blob) files[`assets/${hash}`] = [await bytesOf(blob), { level: 0 }]
  }
  files['README.txt'] = strToU8(options.readme)
  return new Blob([(await zipAsync(files)) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

const CONFIG_TAG = /(<script\b[^>]*\bid=["']rublox-config["'][^>]*>)[\s\S]*?(<\/script>)/i

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** The player's page for a static website: relative paths, the app's name and icons. */
export function siteIndex(html: string, settings: AppSettings, locale: string): string {
  const config = JSON.stringify({ studioUrl: '', appsUrl: '', page: { kind: 'site' } })
  const name = escapeHtml(settings.name)
  const head = [
    `<title>${name}</title>`,
    '<link rel="manifest" href="./manifest.webmanifest" />',
    `<meta name="theme-color" content="${escapeHtml(settings.themeColor)}" />`,
    '<link rel="apple-touch-icon" href="./apple-touch-icon.png" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    `<meta name="apple-mobile-web-app-title" content="${name}" />`,
  ].join('\n    ')
  return html
    .replace(CONFIG_TAG, (_m, open: string, close: string) => open + config + close)
    .replace(/<html\b[^>]*>/i, `<html lang="${escapeHtml(locale)}">`)
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/(src|href)="\/(_app\/|favicon\.svg)/g, '$1="./$2')
    .replace(
      /<link\b[^>]*rel=["']icon["'][^>]*>/i,
      '<link rel="icon" href="./icon-192.png" type="image/png" />',
    )
    .replace(/<\/head>/i, `    ${head}\n  </head>`)
}

export { ARCHIVE_EXTENSION }
