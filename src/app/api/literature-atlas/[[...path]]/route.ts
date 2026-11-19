/**
 * Same-origin, read-only relay to the Literature Atlas tester preview.
 *
 * The Atlas is a separate private service (`LITERATURE_ATLAS_ORIGIN`) that renders every link,
 * asset, fetch and redirect under this route's prefix. The relay strips the prefix and forwards
 * the rest of the path and the query unchanged, never forwards the visitor's cookies or
 * credentials, and returns only the response headers it sets itself. Unset origin → 404.
 * One addition: when this site has verified the draft-evidence viewer password (a valid viewer
 * session cookie, read here and not forwarded), the relay adds its own short-lived signed note
 * (`x-atlas-evidence-viewer`) so the Atlas shows its draft-evidence pages. The note names no one.
 * Downloads (`/export/…`) are limited per client and keep the Atlas's attachment file name.
 * Contract and go-live steps: docs/literature-atlas-preview.md.
 */

import { ATLAS_PAGE_PATH } from '@/features/literature-atlas-viewer/paths'
import {
  RELAY_HEADER,
  cookieValue,
  gateAll,
  relayNote,
  sessionCookie,
  verifySession,
  viewerConfig,
} from '@/features/literature-atlas-viewer/server/access'
import { defaultLocale, isActiveLocale } from '@/i18n/locale'

import { clientOf, takeDownload } from './downloads'

const PREFIX = '/api/literature-atlas'
const EXPORT_PATH = '/export/'
// The Atlas names its files `atlas-<kind>-<date>.<csv|json>`; any other disposition is dropped.
const ATTACHMENT = /^attachment; filename="[A-Za-z0-9][A-Za-z0-9._-]{0,99}"$/
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
  'text/csv',
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

const HEALTH_PATH = '/health'

/** The main Atlas page in the visitor's locale (from the referer's first path segment), else the default. */
function atlasPageFor(request: Request): string {
  let locale: string = defaultLocale
  try {
    const referer = request.headers.get('referer')
    const first = referer ? new URL(referer).pathname.split('/')[1] : undefined
    if (isActiveLocale(first)) locale = first
  } catch {
    // an unparsable referer means the default locale
  }
  return `/${locale}${ATLAS_PAGE_PATH}`
}

/**
 * The whole-Atlas gate (LITERATURE_ATLAS_GATE_ALL=1). Returns a response to send instead of
 * proxying, or null to continue. Health stays open for monitoring.
 */
function gateResponse(
  request: Request,
  method: 'GET' | 'HEAD',
  upstreamPath: string,
  viewer: ReturnType<typeof viewerConfig>,
): Response | null {
  if (!gateAll() || upstreamPath === HEALTH_PATH) return null
  if (!viewer) return plain('Not available', 503)
  if (verifySession(viewer, cookieValue(request.headers.get('cookie'), sessionCookie().name)))
    return null
  const wantsHtml = (request.headers.get('accept') ?? '').toLowerCase().includes('text/html')
  if (wantsHtml && (method === 'GET' || method === 'HEAD')) {
    return new Response(null, {
      status: 303,
      headers: relayHeaders({ Location: atlasPageFor(request), 'Cache-Control': 'no-store' }),
    })
  }
  return plain('Sign in required', 401)
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

  const viewer = viewerConfig()
  const gated = gateResponse(request, method, upstreamPath, viewer)
  if (gated) return gated

  const isDownload = upstreamPath.startsWith(EXPORT_PATH)
  if (isDownload) {
    const wait = takeDownload(clientOf(request.headers))
    if (wait > 0) {
      return plain('Too many downloads from this connection. Please wait a few minutes.', 429, {
        'Retry-After': String(wait),
      })
    }
  }

  const headers: Record<string, string> = { Accept: request.headers.get('accept') ?? '*/*' }
  if (
    viewer &&
    verifySession(viewer, cookieValue(request.headers.get('cookie'), sessionCookie().name))
  ) {
    headers[RELAY_HEADER] = relayNote(viewer)
  }

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method,
      headers,
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
  const disposition = upstream.headers.get('content-disposition')
  return new Response(withoutBody ? null : upstream.body, {
    status: upstream.status,
    headers: relayHeaders({
      'Content-Type': contentType,
      'Cache-Control': cacheControl(upstreamPath, mediaType),
      'Content-Security-Policy': upstream.headers.get('content-security-policy') ?? FALLBACK_CSP,
      ...(isDownload && disposition && ATTACHMENT.test(disposition)
        ? { 'Content-Disposition': disposition }
        : {}),
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
