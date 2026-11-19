import {
  checkPassword,
  clientOf,
  issueSession,
  mayAttempt,
  recordFailure,
  sessionCookie,
  viewerConfig,
} from '@/features/literature-atlas-viewer/server/access'
import { viewerReturn } from '@/features/literature-atlas-viewer/paths'
import {
  backToViewer,
  isSameSite,
  localeFrom,
  notFound,
} from '@/features/literature-atlas-viewer/server/requests'

/**
 * Open the Literature Atlas draft evidence with the shared viewer password (a plain form post). A
 * correct password sets a signed, HttpOnly session cookie and returns to the viewer page; anything
 * else returns there with one generic message. The password is never echoed, logged or stored.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const config = viewerConfig()
  if (!config) return notFound()
  if (!isSameSite(request)) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  const form = await request.formData().catch(() => null)
  const locale = localeFrom(form?.get('locale'))
  const returnTo = viewerReturn(form?.get('return'))
  const client = clientOf(request.headers)
  if (!mayAttempt(client)) return backToViewer(locale, 'limited', returnTo)
  const password = form?.get('password')
  if (typeof password !== 'string' || !checkPassword(config, password)) {
    recordFailure(client)
    return backToViewer(locale, 'denied', returnTo)
  }
  const session = issueSession(config)
  const cookie = sessionCookie()
  const response = backToViewer(locale, undefined, returnTo)
  response.cookies.set(cookie.name, session.value, { ...cookie.options, maxAge: session.maxAge })
  return response
}

export function GET(): Response {
  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  })
}
