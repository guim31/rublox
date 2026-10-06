import { randomBytes } from 'node:crypto'

/**
 * UUIDv7 (RFC 9562): 48-bit Unix time in milliseconds, then random bits. Database ids sort by
 * creation time, which keeps B-tree inserts local (SPEC § 6.4: UUIDv7 in the database).
 */
export function uuidv7(now = Date.now()): string {
  const bytes = randomBytes(16)
  let time = now
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256
    time = Math.floor(time / 256)
  }
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f)
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f)
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

/** A random URL-safe token (invitation codes): 24 bytes, 192 bits. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}
