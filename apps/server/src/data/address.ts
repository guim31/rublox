import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { BlockList, isIP } from 'node:net'

/**
 * Addresses the relay never calls (SPEC § 6.9): private networks, loopback, link-local (and
 * the cloud metadata service at 169.254.169.254), carrier-grade NAT, documentation and
 * benchmark ranges, multicast, reserved, and the IPv6 equivalents.
 */
const blocked = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6')
}

/** The IPv4 address inside an IPv4-mapped (`::ffff:a.b.c.d`) or NAT64 IPv6 address. */
function embeddedIpv4(address: string): string | null {
  const lower = address.toLowerCase()
  const mapped = /^(?:::ffff:(?:0:)?|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  if (mapped?.[1]) return mapped[1]
  const hex = /^(?:::ffff:(?:0:)?|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower)
  if (hex?.[1] && hex[2]) {
    const high = Number.parseInt(hex[1], 16)
    const low = Number.parseInt(hex[2], 16)
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
  }
  return null
}

/** True for an address the relay may connect to. */
export function isPublicAddress(address: string): boolean {
  const unbracketed = address.replace(/^\[|\]$/g, '')
  const family = isIP(unbracketed)
  if (family === 4) return !blocked.check(unbracketed, 'ipv4')
  if (family === 6) {
    const v4 = embeddedIpv4(unbracketed)
    if (v4) return isPublicAddress(v4)
    return !blocked.check(unbracketed, 'ipv6')
  }
  return false
}

/** Host names refused before any resolution. */
export function isBlockedHostName(host: string): boolean {
  const name = host.toLowerCase().replace(/\.$/, '')
  return (
    name === 'localhost' ||
    name.endsWith('.localhost') ||
    name.endsWith('.local') ||
    name.endsWith('.internal') ||
    name === 'metadata' ||
    !name.includes('.')
  )
}

export type Resolve = (host: string) => Promise<LookupAddress[]>

export const systemResolve: Resolve = (host) =>
  new Promise((resolve, reject) =>
    dnsLookup(host, { all: true, verbatim: true }, (error, addresses) =>
      error ? reject(error) : resolve(addresses),
    ),
  )

export class BlockedAddressError extends Error {
  override name = 'BlockedAddressError'
}

/**
 * A `lookup` for `http.request`: resolves the name, refuses it when **any** of its addresses
 * is not public, and connects to the checked address (no second resolution, so no DNS
 * rebinding between the check and the connection).
 */
export function guardedLookup(resolve: Resolve, allow: (address: string) => boolean) {
  return (
    hostname: string,
    options: { all?: boolean; family?: number | string } | number,
    callback: (
      error: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family?: number,
    ) => void,
  ) => {
    const all = typeof options === 'object' && options.all === true
    resolve(hostname).then(
      (addresses) => {
        if (!addresses.length || addresses.some((entry) => !allow(entry.address))) {
          callback(new BlockedAddressError(hostname), all ? [] : '', 4)
          return
        }
        const first = addresses[0] as LookupAddress
        if (all) callback(null, addresses)
        else callback(null, first.address, first.family)
      },
      (error: NodeJS.ErrnoException) => callback(error, all ? [] : '', 4),
    )
  }
}
