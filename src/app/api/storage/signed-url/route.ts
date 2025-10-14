import { NextResponse } from 'next/server'

function encodeSupabasePath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function resolveSupabaseBaseUrl(projectRef?: string): string | null {
  const explicitUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (explicitUrl && explicitUrl.length > 0) {
    return explicitUrl.replace(/\/$/, '')
  }
  const ref =
    projectRef ||
    process.env.SUPABASE_PROJECT_REF ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ||
    ''
  if (!ref) {
    return null
  }
  return `https://${ref}.supabase.co`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bucket = searchParams.get('bucket')
  const pathParam = searchParams.get('path')
  const expiresInParam = searchParams.get('expiresIn')
  const projectRefParam = searchParams.get('projectRef')

  if (!bucket || !pathParam) {
    return NextResponse.json(
      { error: 'Supabase bucket and path query parameters are required.' },
      { status: 400 },
    )
  }

  const supabaseBaseUrl = resolveSupabaseBaseUrl(projectRefParam ?? undefined)
  if (!supabaseBaseUrl) {
    return NextResponse.json(
      {
        error:
          'Supabase base URL could not be determined. Set SUPABASE_URL or SUPABASE_PROJECT_REF in your environment.',
      },
      { status: 500 },
    )
  }

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_API_KEY

  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is not configured. Either mark the bucket as public or provide a service key to generate signed URLs.',
      },
      { status: 501 },
    )
  }

  const encodedPath = encodeSupabasePath(pathParam)
  const expiresInValue = Number(expiresInParam ?? '300')
  const expiresIn = Number.isFinite(expiresInValue)
    ? Math.min(Math.max(expiresInValue, 60), 3600)
    : 300

  const endpoint = `${supabaseBaseUrl}/storage/v1/object/sign/${bucket}/${encodedPath}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
    cache: 'no-store',
  })

  const payload = await response
    .json()
    .catch(() => ({ error: 'Unable to parse Supabase response.' }))

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error ?? `Supabase responded with status ${response.status}.` },
      { status: response.status },
    )
  }

  let signedUrl: string | undefined =
    payload?.signedURL ?? payload?.signedUrl ?? payload?.url ?? undefined
  if (!signedUrl || typeof signedUrl !== 'string') {
    return NextResponse.json({ error: 'Supabase did not return a signed URL.' }, { status: 500 })
  }

  if (signedUrl.startsWith('/')) {
    signedUrl = `${supabaseBaseUrl}${signedUrl}`
  }

  return NextResponse.json(
    { url: signedUrl },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
