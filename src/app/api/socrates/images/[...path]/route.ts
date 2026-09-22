import { z } from 'zod'
import {
  requireSocratesUser,
  trainingDocument,
  loadAttempt,
  SocratesAccessError,
} from '@/features/socrates-study/server/service'
import {
  getInvenioPair,
  isApprovedSocratesDziUrl,
} from '@/features/socrates-builder/invenio-source'
import { parseDziDescriptorXml } from '@/features/socrates-builder/descriptor'
export const dynamic = 'force-dynamic'
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await params).path
    const [kind, id, revision, pane, ...asset] = path
    if (
      !['training', 'testing'].includes(kind) ||
      !z.string().uuid().safeParse(id).success ||
      !/^\d+$/.test(revision) ||
      !['tissue', 'color'].includes(pane)
    )
      return new Response('Not found.', { status: 404, headers })
    const suffix = asset.join('/')
    if (
      suffix !== 'slide.dzi' &&
      !/^slide_files\/[0-9]{1,2}\/[0-9]{1,6}_[0-9]{1,6}\.jpe?g$/.test(suffix)
    )
      return new Response('Not found.', { status: 404, headers })
    const session = await requireSocratesUser()
    const testing = kind === 'testing' ? await loadAttempt(id, session) : null
    if (testing && pane === 'color' && !testing.config.showColorImage)
      return new Response('Not found.', { status: 404, headers })
    const document = testing?.document ?? (await trainingDocument(id, Number(revision)))
    const pair = getInvenioPair(document.slide.descriptorUrl)
    if (pane === 'color' && !pair) return new Response('Not found.', { status: 404, headers })
    const descriptor =
      pane === 'color' ? pair!.annotatedUrl : (pair?.tissueUrl ?? document.slide.descriptorUrl)
    if (!isApprovedSocratesDziUrl(descriptor))
      return new Response('Unavailable.', { status: 502, headers })
    const url =
      suffix === 'slide.dzi'
        ? descriptor
        : descriptor.replace(/\.dzi$/, suffix.replace(/^slide/, ''))
    const upstream = await fetch(url, {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })
    if (!upstream.ok)
      return new Response('Image unavailable. Please retry.', { status: 502, headers })
    const contentType = upstream.headers.get('content-type') ?? ''
    if (suffix === 'slide.dzi') {
      if (!/^(application|text)\/xml/.test(contentType)) {
        await upstream.body?.cancel()
        return new Response('Unexpected descriptor.', { status: 502, headers })
      }
      const d = parseDziDescriptorXml(await upstream.text())
      // Reconstruct only DZI dimensions: never relay embedded URLs or metadata.
      return new Response(
        `<Image TileSize="${d.tileSize}" Overlap="${d.overlap}" Format="${d.format}" xmlns="http://schemas.microsoft.com/deepzoom/2008"><Size Width="${d.width}" Height="${d.height}"/></Image>`,
        { headers: { ...headers, 'Content-Type': 'application/xml' } },
      )
    }
    if (!contentType.startsWith('image/jpeg')) {
      await upstream.body?.cancel()
      return new Response('Unexpected image.', { status: 502, headers })
    }
    return new Response(upstream.body, { headers: { ...headers, 'Content-Type': 'image/jpeg' } })
  } catch (error) {
    return new Response(
      error instanceof SocratesAccessError ? error.message : 'Image unavailable. Please retry.',
      { status: error instanceof SocratesAccessError ? error.status : 502, headers },
    )
  }
}
