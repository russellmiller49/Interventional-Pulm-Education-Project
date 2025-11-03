import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  type CookieOptions = Parameters<typeof res.cookies.set>[2]

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options?: CookieOptions) {
          res.cookies.set(name, value, options)
        },
        remove(name: string, options?: CookieOptions) {
          res.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname
  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/pocus')

  if (isProtected && !user) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/'
    redirectUrl.search = ''

    const redirectResponse = NextResponse.redirect(redirectUrl)
    const modifiedCookies = res.cookies.getAll()
    for (const cookie of modifiedCookies) {
      redirectResponse.cookies.set(cookie)
    }
    return redirectResponse
  }

  if (pathname.startsWith('/auth')) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/pocus/:path*', '/auth/:path*'],
}
