import { sessionCookie } from '@/features/medical-thoracoscopy/wolf-preview/server/access'
import {
  backToPreview,
  isSameSite,
  localeFrom,
} from '@/features/medical-thoracoscopy/wolf-preview/server/requests'

/** End the preview on this browser: the session cookie is cleared. */
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  if (!isSameSite(request)) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  const form = await request.formData().catch(() => null)
  const cookie = sessionCookie()
  const response = backToPreview(localeFrom(form?.get('locale')), 'ended')
  response.cookies.set(cookie.name, '', { ...cookie.options, maxAge: 0 })
  return response
}
