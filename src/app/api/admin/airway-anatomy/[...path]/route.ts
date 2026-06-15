import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  LOCAL_DEV_AUTH_COOKIE_NAME,
  hasValidLocalDevAuthCookie,
} from '@/lib/site-auth/local-dev-auth'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const AIRWAY_ASSET_ROOT = resolve(process.cwd(), 'public/airway-anatomy')

const CONTENT_TYPES: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.json': 'application/json; charset=utf-8',
  '.raw': 'application/octet-stream',
  '.stl': 'model/stl',
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (!(await canReadAdminAirwayAsset(request))) {
    return new NextResponse('Not found.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const params = await context.params
  const filePath = resolveAirwayAssetPath(params.path ?? [])

  if (!filePath) {
    return new NextResponse('Invalid airway anatomy asset path.', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      return new NextResponse('Not found.', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const file = await readFile(filePath)
    const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'

    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Length': String(file.byteLength),
        'Content-Type': contentType,
      },
    })
  } catch {
    return new NextResponse('Not found.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}

function resolveAirwayAssetPath(pathSegments: string[]) {
  if (!pathSegments.length) {
    return null
  }

  if (
    pathSegments.some(
      (segment) => !segment || segment === '..' || segment.includes('/') || segment.includes('\\'),
    )
  ) {
    return null
  }

  const filePath = resolve(AIRWAY_ASSET_ROOT, ...pathSegments)
  return filePath.startsWith(`${AIRWAY_ASSET_ROOT}${sep}`) ? filePath : null
}

async function canReadAdminAirwayAsset(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  if (
    hasValidLocalDevAuthCookie(
      request.nextUrl,
      request.cookies.get(LOCAL_DEV_AUTH_COOKIE_NAME)?.value,
    )
  ) {
    return true
  }

  try {
    const supabase = await supabaseServer()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return false
    }

    const { data: adminEntitlement } = await supabase
      .from('site_entitlements')
      .select('entitlement')
      .eq('user_id', user.id)
      .eq('entitlement', 'site_admin')
      .eq('status', 'active')
      .maybeSingle()

    return Boolean(adminEntitlement)
  } catch {
    return false
  }
}
