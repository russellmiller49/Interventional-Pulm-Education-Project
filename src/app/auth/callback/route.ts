import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { resolvePostAuthRedirectPath } from '@/lib/supabase/auth-redirect'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const redirectTarget = new URL(
    resolvePostAuthRedirectPath(url.searchParams.get('next')),
    url.origin,
  )
  const response = NextResponse.redirect(redirectTarget)
  type CookieOptions = Parameters<typeof response.cookies.set>[2]

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          void name
          return undefined
        },
        set(name: string, value: string, options?: CookieOptions) {
          response.cookies.set(name, value, options)
        },
        remove(name: string, options?: CookieOptions) {
          response.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    },
  )

  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch (error) {
      console.error('Supabase session exchange failed', error)
      response.headers.set('Location', new URL('/', url.origin).toString())
    }
  }

  response.headers.set('X-Robots-Tag', 'noindex, nofollow')

  return response
}
