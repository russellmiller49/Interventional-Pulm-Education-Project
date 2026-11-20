import { sessionCookie } from '@/features/literature-atlas-viewer/server/access'
import {
  backToViewer,
  isSameSite,
  localeFrom,
} from '@/features/literature-atlas-viewer/server/requests'

/** Leave the draft evidence: clear this browser's viewer session and return to the password screen. */
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  if (!isSameSite(request)) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  const form = await request.formData().catch(() => null)
  const cookie = sessionCookie()
  const response = backToViewer(localeFrom(form?.get('locale')), 'ended')
  response.cookies.set(cookie.name, '', { ...cookie.options, maxAge: 0 })
  return response
}

export function GET(): Response {
  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  })
}
