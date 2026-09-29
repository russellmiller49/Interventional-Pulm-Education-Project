import {
  clientOf,
  issueSession,
  matchCode,
  mayAttempt,
  previewConfig,
  recordFailure,
  sessionCookie,
} from '@/features/medical-thoracoscopy/wolf-preview/server/access'
import {
  backToPreview,
  isSameSite,
  localeFrom,
  notFound,
} from '@/features/medical-thoracoscopy/wolf-preview/server/requests'

/**
 * Sign in to the private manufacturer preview with a review code (a plain form post). A correct
 * code sets a signed, HttpOnly session cookie and returns to the preview; anything else returns
 * to the code screen with one generic message. The code is never echoed, logged or stored.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const config = previewConfig()
  if (!config) return notFound()
  if (!isSameSite(request)) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  const form = await request.formData().catch(() => null)
  const locale = localeFrom(form?.get('locale'))
  const client = clientOf(request.headers)
  if (!mayAttempt(client)) return backToPreview(locale, 'limited')
  const code = form?.get('code')
  const reviewer = typeof code === 'string' ? matchCode(config, code) : null
  if (!reviewer) {
    recordFailure(client)
    return backToPreview(locale, 'denied')
  }
  const session = issueSession(config, reviewer)
  const cookie = sessionCookie()
  const response = backToPreview(locale)
  response.cookies.set(cookie.name, session.value, { ...cookie.options, maxAge: session.maxAge })
  return response
}
