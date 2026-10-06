import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SHA256 = /^[0-9a-f]{64}$/

export function isSha256(value: string): boolean {
  return SHA256.test(value)
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Uploaded files on disk, named by their SHA-256: `DATA_DIR/assets/ab/abcdef…`. */
export class FileStore {
  readonly root: string

  constructor(dataDir: string) {
    this.root = join(dataDir, 'assets')
  }

  path(hash: string): string {
    if (!isSha256(hash)) throw new Error('invalid hash')
    return join(this.root, hash.slice(0, 2), hash)
  }

  async has(hash: string): Promise<boolean> {
    try {
      return (await stat(this.path(hash))).isFile()
    } catch {
      return false
    }
  }

  /** Writes the bytes once (atomically: temporary file, then rename). */
  async put(hash: string, bytes: Uint8Array): Promise<void> {
    if (await this.has(hash)) return
    const target = this.path(hash)
    await mkdir(join(this.root, hash.slice(0, 2)), { recursive: true })
    const temporary = `${target}.${randomBytes(6).toString('hex')}.tmp`
    await writeFile(temporary, bytes)
    await rename(temporary, target)
  }

  async read(hash: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.path(hash)))
    } catch {
      return null
    }
  }

  /** Removes the files whose hash `keep` rejects. Returns how many were removed. */
  async prune(keep: (hash: string) => boolean): Promise<number> {
    let removed = 0
    let folders: string[]
    try {
      folders = await readdir(this.root)
    } catch {
      return 0
    }
    for (const folder of folders) {
      for (const name of await readdir(join(this.root, folder)).catch(() => [] as string[])) {
        if (isSha256(name) && !keep(name)) {
          await rm(join(this.root, folder, name), { force: true })
          removed += 1
        }
      }
    }
    return removed
  }

  /** Bytes used on disk by the stored files. */
  async usage(): Promise<number> {
    let total = 0
    for (const folder of await readdir(this.root).catch(() => [] as string[])) {
      for (const name of await readdir(join(this.root, folder)).catch(() => [] as string[])) {
        total += (await stat(join(this.root, folder, name)).catch(() => ({ size: 0 }))).size
      }
    }
    return total
  }
}
