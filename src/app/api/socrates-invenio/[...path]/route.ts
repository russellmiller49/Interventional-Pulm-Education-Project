import { INVENIO_DEMO_ORIGIN, isInvenioAssetPath } from '@/features/socrates-builder/invenio-source'

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join('/')
  if (!isInvenioAssetPath(path)) {
    return new Response('Unknown slide asset.', { status: 404 })
  }

  try {
    const response = await fetch(`${INVENIO_DEMO_ORIGIN}/generated/${path}`, {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })
    if (!response.ok) {
      return new Response('The Invenio slide asset is unavailable.', {
        status: response.status === 404 ? 404 : 502,
      })
    }
    const isCatalog = path === 'catalog.json'
    const isDescriptor = path.endsWith('.dzi')
    const contentType = response.headers.get('content-type') ?? ''
    const expectedType = isCatalog
      ? 'application/json'
      : isDescriptor
        ? 'application/xml'
        : 'image/jpeg'
    if (
      !contentType.startsWith(expectedType) &&
      !(isDescriptor && contentType.startsWith('text/xml'))
    ) {
      await response.body?.cancel()
      return new Response('Unexpected slide asset format.', { status: 502 })
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': expectedType,
        'Cache-Control':
          isCatalog || isDescriptor ? 'public, max-age=300' : 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    })
  } catch {
    return new Response('The Invenio demo could not be reached. Please retry.', { status: 502 })
  }
}
