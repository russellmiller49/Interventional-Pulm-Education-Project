import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const response = NextResponse.redirect(new URL('/pocus', url.origin))
  type CookieOptions = Parameters<typeof response.cookies.set>[2]

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as CookieOptions)
          })
        },
      },
    },
  )

  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch (error) {
      console.error('Supabase POCUS session exchange failed', error)
      response.headers.set('Location', new URL('/', url.origin).toString())
    }
  }

  response.headers.set('X-Robots-Tag', 'noindex, nofollow')

  return response
}
