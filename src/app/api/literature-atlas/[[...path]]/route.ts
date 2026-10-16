/**
 * Same-origin, read-only relay to the Literature Atlas tester preview.
 *
 * The Atlas is a separate private service (`LITERATURE_ATLAS_ORIGIN`) that renders every link,
 * asset, fetch and redirect under this route's prefix. The relay strips the prefix and forwards
 * the rest of the path and the query unchanged, never forwards the visitor's cookies or
 * credentials, and returns only the response headers it sets itself. Unset origin → 404.
 * Contract and go-live steps: docs/literature-atlas-preview.md.
 */

const PREFIX = '/api/literature-atlas'
const TIMEOUT_MS = 15000
const ROBOTS = 'noindex, nofollow, noarchive'
// Used only if the Atlas omits its own policy, which it should never do.
const FALLBACK_CSP =
  "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'"
const ALLOWED_MEDIA_TYPES = new Set([
  'text/html',
  'application/json',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/octet-stream',
  'text/plain',
])
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const NULL_BODY_STATUSES = new Set([204, 205, 304])

function atlasOrigin() {
  const configured = process.env.LITERATURE_ATLAS_ORIGIN?.trim()
  if (!configured) return null
  try {
    const url = new URL(configured)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

function relayHeaders(init: Record<string, string>) {
  const headers = new Headers(init)
  headers.set('X-Robots-Tag', ROBOTS)
  headers.set('X-Content-Type-Options', 'nosniff')
  // The module page frames this route; nothing else may.
  headers.set('X-Frame-Options', 'SAMEORIGIN')
  return headers
}

function plain(message: string, status: number, extra: Record<string, string> = {}) {
  return new Response(message, {
    status,
    headers: relayHeaders({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    }),
  })
}

function cacheControl(upstreamPath: string, mediaType: string) {
  // Asset names are not content-hashed, so a snapshot rebuild must show up within the hour.
  if (upstreamPath.startsWith('/static/')) return 'public, max-age=3600'
  if (mediaType === 'application/octet-stream') return 'public, max-age=300'
  return 'no-store'
}

async function relay(request: Request, method: 'GET' | 'HEAD') {
  const origin = atlasOrigin()
  if (!origin) return plain('Not found.', 404)

  const { pathname, search } = new URL(request.url)
  if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return plain('Not found.', 404)
  const upstreamPath = pathname.slice(PREFIX.length) || '/'
  // String concatenation, not URL resolution, so a path such as `//host/x` stays on the origin.
  const target = new URL(`${origin}${upstreamPath}${search}`)
  if (target.origin !== origin) return plain('Not found.', 404)

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method,
      headers: { Accept: request.headers.get('accept') ?? '*/*' },
      credentials: 'omit',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return plain('The Literature Atlas could not be reached. Please retry.', 502)
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel()
    const location = upstream.headers.get('location')
    if (!REDIRECT_STATUSES.has(upstream.status) || !location?.startsWith(`${PREFIX}/`)) {
      return plain('Unexpected redirect from the Literature Atlas.', 502)
    }
    return new Response(null, {
      status: upstream.status,
      headers: relayHeaders({ Location: location, 'Cache-Control': 'no-store' }),
    })
  }

  const contentType = upstream.headers.get('content-type') ?? ''
  const mediaType = contentType.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    await upstream.body?.cancel()
    return plain('Unexpected response from the Literature Atlas.', 502)
  }

  const withoutBody = method === 'HEAD' || NULL_BODY_STATUSES.has(upstream.status)
  if (withoutBody) await upstream.body?.cancel()
  return new Response(withoutBody ? null : upstream.body, {
    status: upstream.status,
    headers: relayHeaders({
      'Content-Type': contentType,
      'Cache-Control': cacheControl(upstreamPath, mediaType),
      'Content-Security-Policy': upstream.headers.get('content-security-policy') ?? FALLBACK_CSP,
    }),
  })
}

export function GET(request: Request) {
  return relay(request, 'GET')
}

export function HEAD(request: Request) {
  return relay(request, 'HEAD')
}

function methodNotAllowed() {
  return plain('Method not allowed.', 405, { Allow: 'GET, HEAD' })
}

export const POST = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
export const OPTIONS = methodNotAllowed
