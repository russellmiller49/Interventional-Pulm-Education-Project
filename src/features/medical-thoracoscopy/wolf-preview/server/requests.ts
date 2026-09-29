import { NextResponse } from 'next/server'

import { defaultLocale, isActiveLocale } from '@/i18n/locale'

import { WOLF_PREVIEW_PATH, type ReviewState } from '../paths'

/**
 * Small helpers the preview's endpoints share: a same-site check for form posts, and redirects
 * back to the page. Redirects use a relative Location so they are right behind the host's proxy.
 */
export function isSameSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  // A browser sends `Origin: null` under some referrer policies; then only the browser's own
  // same-origin statement will do.
  if (origin === 'null') return site === 'same-origin'
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  const hosts = [request.headers.get('x-forwarded-host'), request.headers.get('host')]
    .flatMap((value) => (value ? value.split(',').map((host) => host.trim()) : []))
    .filter(Boolean)
  return hosts.includes(originHost)
}

export function localeFrom(value: FormDataEntryValue | null | undefined): string {
  return typeof value === 'string' && isActiveLocale(value) ? value : defaultLocale
}

export function backToPreview(locale: string, state?: ReviewState): NextResponse {
  const location = `/${locale}${WOLF_PREVIEW_PATH}${state ? `?review=${state}` : ''}`
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  })
}

export function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
  })
}
