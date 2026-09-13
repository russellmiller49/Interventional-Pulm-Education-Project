import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const feedbackBucket = 'module-beta-feedback'
export function feedbackJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

// Always verify a real main-site account. Local preview cookies never authorize storage writes.
export async function requireFeedbackUser(admin = false) {
  try {
    const client = await supabaseServer()
    const {
      data: { user },
      error,
    } = await client.auth.getUser()
    if (error || !user || user.is_anonymous)
      return {
        ok: false as const,
        response: feedbackJson({ error: 'Sign in with your site account to continue.' }, 401),
      }
    if (!user.email_confirmed_at)
      return {
        ok: false as const,
        response: feedbackJson({ error: 'Verify your email to continue.' }, 403),
      }
    if (admin) {
      const { data, error: accessError } = await client
        .from('site_entitlements')
        .select('entitlement')
        .eq('user_id', user.id)
        .eq('entitlement', 'site_admin')
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle()
      if (accessError)
        return {
          ok: false as const,
          response: feedbackJson({ error: 'Account access is temporarily unavailable.' }, 503),
        }
      if (!data)
        return {
          ok: false as const,
          response: feedbackJson({ error: 'Site admin access required.' }, 403),
        }
    }
    return { ok: true as const, user }
  } catch {
    return {
      ok: false as const,
      response: feedbackJson({ error: 'Sign-in is temporarily unavailable.' }, 503),
    }
  }
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const url = new URL(request.url)
  // Next's internal URL can use localhost behind a reverse proxy. The Host header
  // retains the requested site authority; browsers cannot forge it on cross-site requests.
  const host = request.headers.get('host') ?? url.host
  const protocol =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? url.protocol.slice(0, -1)
  return (protocol === 'https' || protocol === 'http') && origin === `${protocol}://${host}`
}

/** Bound multipart input even when the client omits Content-Length. */
export async function readFeedbackForm(request: Request, limit: number) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing request body')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) {
        await reader.cancel()
        throw new RangeError('Feedback body too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Response(body, {
    headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
  }).formData()
}
