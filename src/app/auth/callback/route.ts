import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import {
  SHARED_AUTH_CALLBACK_TARGETS,
  resolvePostAuthRedirectPath,
} from '@/lib/supabase/auth-redirect'

export const dynamic = 'force-dynamic'

const callbackPageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
}

function renderSharedAuthCallbackPage() {
  const targetsJson = JSON.stringify(SHARED_AUTH_CALLBACK_TARGETS)

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Authentication callback</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        align-items: center;
        background: Canvas;
        color: CanvasText;
        display: flex;
        margin: 0;
        min-height: 100vh;
        padding: 24px;
      }

      main {
        border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
        border-radius: 8px;
        margin: 0 auto;
        max-width: 520px;
        padding: 24px;
      }

      h1 {
        font-size: 1.25rem;
        line-height: 1.4;
        margin: 0 0 8px;
      }

      p {
        color: color-mix(in srgb, CanvasText 72%, transparent);
        line-height: 1.6;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <main>
      <h1 id="callback-title">Completing sign-in</h1>
      <p id="callback-message" role="status">Redirecting to the application...</p>
      <noscript>
        <p>JavaScript is required to finish this authentication redirect.</p>
      </noscript>
    </main>
    <script>
      (() => {
        const targets = ${targetsJson};
        const title = document.getElementById('callback-title');
        const message = document.getElementById('callback-message');

        function showError(text) {
          if (title) {
            title.textContent = 'Authentication link could not be routed';
          }

          if (message) {
            message.setAttribute('role', 'alert');
            message.textContent = text;
          }
        }

        function getSegmentKey(segment) {
          const separatorIndex = segment.indexOf('=');
          const rawKey = separatorIndex === -1 ? segment : segment.slice(0, separatorIndex);

          try {
            return decodeURIComponent(rawKey.replace(/\\+/g, ' '));
          } catch {
            return rawKey;
          }
        }

        function getParamValue(rawParams, key) {
          try {
            return new URLSearchParams(rawParams).get(key);
          } catch {
            return null;
          }
        }

        function getHashSegments(rawHash) {
          const hashBody = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;

          if (!hashBody) {
            return [];
          }

          const queryStart = hashBody.indexOf('?');
          const hashParams = queryStart === -1 ? hashBody : hashBody.slice(queryStart + 1);

          return hashParams.split('&').filter(Boolean);
        }

        const rawSearch = window.location.search.startsWith('?')
          ? window.location.search.slice(1)
          : window.location.search;
        const searchParams = new URLSearchParams(rawSearch);
        const app = searchParams.get('app');

        if (!app) {
          showError('This authentication link is missing an application target.');
          return;
        }

        const targetPath = targets[app];

        if (!targetPath) {
          showError('This authentication link points to an unknown application target.');
          return;
        }

        const rawHash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const isRecovery =
          getParamValue(rawHash, 'type') === 'recovery' ||
          getParamValue(rawSearch, 'type') === 'recovery';
        const authMode = searchParams.get('authMode') || (isRecovery ? 'reset-password' : null);
        const segments = rawSearch ? rawSearch.split('&').filter(Boolean) : [];
        const forwardedSegments = segments.concat(getHashSegments(rawHash)).filter((segment) => {
          const key = getSegmentKey(segment);
          return key !== 'app' && key !== 'authMode';
        });
        const hashRouteSegments = [];

        if (authMode === 'reset-password' || authMode === 'sign-in') {
          hashRouteSegments.push('mode=' + authMode);
        }

        if (authMode) {
          hashRouteSegments.push('authMode=' + authMode);
        }

        hashRouteSegments.push(...forwardedSegments);

        const authTargetPath = hashRouteSegments.length
          ? targetPath + (targetPath.includes('?') ? '&' : '?') + 'authCallback=1'
          : targetPath;

        window.location.replace(
          hashRouteSegments.length ? authTargetPath + '#/auth?' + hashRouteSegments.join('&') : targetPath,
        );
      })();
    </script>
  </body>
</html>`,
    {
      status: 200,
      headers: callbackPageHeaders,
    },
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (!code || url.searchParams.has('app')) {
    return renderSharedAuthCallbackPage()
  }

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
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')

  return response
}
