import type { NextRequest } from 'next/server'

import {
  previewConfig,
  sessionCookie,
  verifySession,
} from '@/features/medical-thoracoscopy/wolf-preview/server/access'
import {
  byteRange,
  previewFileFor,
  readPreviewFile,
} from '@/features/medical-thoracoscopy/wolf-preview/server/files'
import { notFound } from '@/features/medical-thoracoscopy/wolf-preview/server/requests'

/**
 * A file of the private preview's hub or of one of its demonstrations (viewer page, scripts,
 * scene data, models, video, stills). Every request must carry a valid preview session; only
 * files on the committed manifest are served, their bytes checked against its hashes; nothing is
 * cached by the browser or a proxy. Videos are served in byte ranges, as browsers ask for them.
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
  { params }: { params: Promise<{ group: string; path: string[] }> },
): Promise<Response> {
  const config = previewConfig()
  if (!config) return notFound()
  if (!verifySession(config, request.cookies.get(sessionCookie().name)?.value)) {
    return new Response('Not authorized', { status: 401, headers: PRIVATE })
  }
  const { group, path } = await params
  const file = previewFileFor(group, path)
  if (!file) return new Response('Not found', { status: 404, headers: PRIVATE })
  let bytes: Buffer
  try {
    bytes = await readPreviewFile(file)
  } catch {
    return new Response('The preview file is unavailable', { status: 503, headers: PRIVATE })
  }
  const headers = { ...PRIVATE, 'Content-Type': file.contentType, 'Accept-Ranges': 'bytes' }
  const range = byteRange(request.headers.get('range'), bytes.length)
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` },
    })
  }
  if (range) {
    const part = bytes.subarray(range.start, range.end + 1)
    return new Response(new Uint8Array(part), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}`,
        'Content-Length': String(part.length),
      },
    })
  }
  return new Response(new Uint8Array(bytes), {
    headers: { ...headers, 'Content-Length': String(bytes.length) },
  })
}
