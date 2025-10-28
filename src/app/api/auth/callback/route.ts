import { NextResponse } from 'next/server'

/**
 * Supabase OAuth callback handler
 *
 * This route handles OAuth redirects from Supabase when users sign up
 * with email or social providers. Supabase will redirect here with
 * authentication tokens in the URL.
 *
 * URL for Supabase configuration:
 * - Production: https://interventionalpulm.org/api/auth/callback
 * - Demo: https://demo.interventionalpulm.org/api/auth/callback
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const searchParams = url.searchParams

  // Extract the tokens from the URL
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle errors
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    // Redirect to home page with error (you can customize this)
    return NextResponse.redirect(
      `${url.origin}?error=${encodeURIComponent(error || 'Authentication failed')}`,
      {
        status: 302,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    )
  }

  // Handle successful authentication
  if (accessToken && refreshToken) {
    // TODO: Store the tokens in your app (cookies, session, etc.)
    // and redirect to the appropriate page

    // For now, redirect to home page
    return NextResponse.redirect(url.origin, {
      status: 302,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  }

  // No tokens or error - redirect to home
  return NextResponse.redirect(url.origin, {
    status: 302,
    headers: {
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
