import { NextResponse } from 'next/server'

import {
  canIssueLocalDevAuth,
  getLocalDevAuthCookieOptions,
  LOCAL_DEV_AUTH_COOKIE_NAME,
  resolveLocalDevAuthNextPath,
} from '@/lib/site-auth/local-dev-auth'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const submittedToken = requestUrl.searchParams.get('token')

  if (!canIssueLocalDevAuth(requestUrl, submittedToken)) {
    return new NextResponse('Local development auth is unavailable.', {
      status: 404,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  }

  const nextPath = resolveLocalDevAuthNextPath(requestUrl.searchParams.get('next'))
  const redirectUrl = new URL(nextPath, requestUrl.origin)
  const response = NextResponse.redirect(redirectUrl)

  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.cookies.set(
    LOCAL_DEV_AUTH_COOKIE_NAME,
    submittedToken?.trim() ?? '',
    getLocalDevAuthCookieOptions(),
  )

  return response
}
