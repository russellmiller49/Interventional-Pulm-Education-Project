import { NextResponse } from 'next/server'

import { defaultLocale, isActiveLocale } from '@/i18n/locale'

import { VIEWER_PAGE_PATH, type ViewerState } from '../paths'

/**
 * Helpers the viewer's form endpoints share (as in the manufacturer preview): a same-site check for
 * form posts and a redirect back to the viewer page with a relative Location, correct behind the
 * host's proxy.
 */
export function isSameSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return false
  const origin = request.headers.get('origin')
  if (!origin) return true
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

export function backToViewer(locale: string, state?: ViewerState): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: `/${locale}${VIEWER_PAGE_PATH}${state ? `?viewer=${state}` : ''}`,
      'Cache-Control': 'no-store',
    },
  })
}

export function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
  })
}
