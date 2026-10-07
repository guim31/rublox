import { BlockList, isIP } from 'node:net'
import { networkInterfaces } from 'node:os'
import { embeddedIpv4, isPublicAddress, type Resolve } from './address.ts'

type Address = { address: string; family: number }

/**
 * The public addresses of this machine's own network interfaces. A call to one of them never
 * leaves the machine (it goes through the loopback), past any outside firewall.
 */
export function interfaceAddresses(): Address[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry !== undefined)
    .map((entry) => ({ address: entry.address, family: entry.family === 'IPv6' ? 6 : 4 }))
    .filter((entry) => isPublicAddress(entry.address))
}

/**
 * What the administrator forbids the relay on top of the private ranges (`RUBLOX_RELAY_DENY`,
 * SPEC § 6.9): name suffixes (`example.com` also refuses `*.example.com`) and IPv4 or IPv6
 * ranges in CIDR notation (or single addresses).
 */
export class DenyList {
  private readonly names: string[] = []
  private readonly addresses = new BlockList()
  private empty = true

  /** Throws on an entry that is neither a name nor an address nor a range. */
  constructor(entries: readonly string[] = []) {
    for (const raw of entries) {
      const entry = raw.trim().toLowerCase()
      if (!entry) continue
      this.empty = false
      if (entry.includes('/')) {
        const [network = '', prefix = '', ...extra] = entry.split('/')
        const family = isIP(network)
        const bits = Number(prefix)
        if (!family || extra.length || !/^\d+$/.test(prefix) || bits > (family === 4 ? 32 : 128)) {
          throw new Error(`invalid range: ${raw}`)
        }
        this.addresses.addSubnet(network, bits, family === 4 ? 'ipv4' : 'ipv6')
      } else if (isIP(entry)) {
        this.addresses.addAddress(entry, isIP(entry) === 4 ? 'ipv4' : 'ipv6')
      } else {
        const name = entry.replace(/^\*?\./, '').replace(/\.$/, '')
        if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(name)) throw new Error(`invalid name: ${raw}`)
        this.names.push(name)
      }
    }
  }

  /** `RUBLOX_RELAY_DENY`: entries separated by commas. */
  static parse(text: string | undefined): DenyList {
    return new DenyList((text ?? '').split(','))
  }

  get size(): number {
    return this.empty ? 0 : this.names.length + 1
  }

  deniesName(host: string): boolean {
    const name = host.toLowerCase().replace(/\.$/, '')
    return this.names.some((suffix) => name === suffix || name.endsWith(`.${suffix}`))
  }

  deniesAddress(address: string): boolean {
    return blockListHas(this.addresses, address)
  }
}

function blockListHas(list: BlockList, address: string): boolean {
  const unbracketed = address.replace(/^\[|\]$/g, '')
  const family = isIP(unbracketed)
  if (family === 4) return list.check(unbracketed, 'ipv4')
  if (family !== 6) return false
  const v4 = embeddedIpv4(unbracketed)
  return list.check(unbracketed, 'ipv6') || (v4 !== null && list.check(v4, 'ipv4'))
}

/** How often the addresses of the instance are resolved again. */
export const SELF_REFRESH_MS = 5 * 60_000

/**
 * The addresses of the instance itself: what the names of `STUDIO_URL` and `APPS_URL` resolve
 * to, and the public addresses of the machine's interfaces (when those names point to a CDN or
 * a tunnel, SPEC § 0.10). Behind a home router, the public name resolves to the router's
 * public address, and a call to it comes back through the router (NAT hairpin) with a local
 * source address: the relay must never call it. Resolved at start, then every 5 minutes to
 * follow a new address.
 */
export class SelfAddresses {
  private readonly known = new Map<string, { address: string; family: number }[]>()
  private current = new BlockList()
  private timer: NodeJS.Timeout | undefined
  /** Settles after the first resolution, successful or not. */
  readonly ready: Promise<void>

  constructor(
    readonly hosts: readonly string[],
    private readonly resolve: Resolve,
    private readonly onError: (host: string, error: unknown) => void = () => {},
    refreshMs = SELF_REFRESH_MS,
    private readonly interfaces: () => Address[] = interfaceAddresses,
  ) {
    this.ready = this.refresh()
    if (refreshMs > 0) {
      this.timer = setInterval(() => void this.refresh(), refreshMs)
      this.timer.unref()
    }
  }

  /** Resolves every name again; a name that fails keeps its previous addresses. */
  async refresh(): Promise<void> {
    await Promise.all(
      this.hosts.map(async (raw) => {
        const host = raw.replace(/^\[|\]$/g, '')
        const literal = isIP(host)
        if (literal) {
          this.known.set(host, [{ address: host, family: literal }])
          return
        }
        try {
          this.known.set(host, await this.resolve(host))
        } catch (error) {
          this.onError(host, error)
        }
      }),
    )
    const next = new BlockList()
    let own: Address[] = []
    try {
      own = this.interfaces()
    } catch (error) {
      this.onError('network interfaces', error)
    }
    for (const addresses of [...this.known.values(), own]) {
      for (const { address, family } of addresses) {
        next.addAddress(address, family === 6 ? 'ipv6' : 'ipv4')
        const v4 = family === 6 ? embeddedIpv4(address) : null
        if (v4) next.addAddress(v4, 'ipv4')
      }
    }
    this.current = next
  }

  has(address: string): boolean {
    return blockListHas(this.current, address)
  }

  close() {
    clearInterval(this.timer)
  }
}
