import type { NextRequest } from 'next/server'

import {
  previewConfig,
  sessionCookie,
  verifySession,
} from '@/features/medical-thoracoscopy/wolf-preview/server/access'
import { modelFor, readModel } from '@/features/medical-thoracoscopy/wolf-preview/server/models'
import { notFound } from '@/features/medical-thoracoscopy/wolf-preview/server/requests'

/**
 * A showcase model for the private manufacturer preview. Every request must carry a valid preview
 * session; only models on the committed manifest are served, their bytes checked against its
 * hashes; nothing is cached by the browser or a proxy. There is no public copy to fall back to.
 */
export const dynamic = 'force-dynamic'

const PRIVATE = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Cookie',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const config = previewConfig()
  if (!config) return notFound()
  if (!verifySession(config, request.cookies.get(sessionCookie().name)?.value)) {
    return new Response('Not authorized', { status: 401, headers: PRIVATE })
  }
  const model = modelFor((await params).file)
  if (!model) return new Response('Not found', { status: 404, headers: PRIVATE })
  let bytes: Buffer
  try {
    bytes = await readModel(model.id)
  } catch {
    return new Response('The preview model is unavailable', { status: 503, headers: PRIVATE })
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      ...PRIVATE,
      'Content-Type': 'model/gltf-binary',
      'Content-Length': String(bytes.length),
    },
  })
}
