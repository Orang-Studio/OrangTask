import { lookup } from 'dns/promises'
import { isIPv4, isIPv6 } from 'net'

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

function isPublicIPv4(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number)
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function isPublicIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()

  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPublicIPv4(mapped[1])

  const groups = expandIPv6(lower)
  if (!groups) return false
  const [first] = groups

  return !(
    groups.every((g) => g === 0) ||
    (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && groups[1] === 0x0db8)
  )
}

function expandIPv6(ip: string): number[] | null {
  const [head, tail] = ip.split('::')
  const parse = (s: string) => (s ? s.split(':').map((g) => parseInt(g, 16)) : [])

  let groups: number[]
  if (tail === undefined) {
    groups = parse(head)
  } else {
    const left = parse(head)
    const right = parse(tail)
    const fill = 8 - left.length - right.length
    if (fill < 0) return null
    groups = [...left, ...Array(fill).fill(0), ...right]
  }

  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g))) return null
  return groups
}

function isPublicIp(ip: string): boolean {
  if (isIPv4(ip)) return isPublicIPv4(ip)
  if (isIPv6(ip)) return isPublicIPv6(ip)
  return false
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError('Webhook URL is not a valid absolute URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Webhook URL must be http or https')
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('Webhook URL must not contain credentials')
  }

  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  if (port !== '80' && port !== '443') {
    throw new UnsafeUrlError('Webhook URL must use a standard web port')
  }

  const host = url.hostname.replace(/\.$/, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new UnsafeUrlError('Webhook URL must not point at a private host')
  }

  const literal = host.startsWith('[') ? host.slice(1, -1) : host
  if (isIPv4(literal) || isIPv6(literal)) {
    if (!isPublicIp(literal)) {
      throw new UnsafeUrlError('Webhook URL must not point at a private address')
    }
    return url
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw new UnsafeUrlError('Webhook host could not be resolved')
  }

  if (addresses.length === 0 || !addresses.every((a) => isPublicIp(a.address))) {
    throw new UnsafeUrlError('Webhook URL must not point at a private address')
  }

  return url
}

const MAX_REDIRECTS = 3

export async function safePostJson(
  rawUrl: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs = 10000,
): Promise<Response> {
  let target = rawUrl
  let method: 'POST' | 'GET' = 'POST'

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(target)

    const res = await fetch(url, {
      method,
      headers: method === 'POST' ? headers : {},
      body: method === 'POST' ? body : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (res.status < 300 || res.status > 399) return res

    const location = res.headers.get('location')
    if (!location) return res

    target = new URL(location, url).toString()

    if (res.status === 303 || res.status === 301 || res.status === 302) method = 'GET'
  }

  throw new UnsafeUrlError('Webhook URL redirected too many times')
}