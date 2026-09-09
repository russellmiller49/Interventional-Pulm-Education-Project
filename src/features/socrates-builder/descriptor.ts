import { getInvenioPair, isApprovedSocratesDziUrl, socratesTileSourceUrl } from './invenio-source'

import type { ImageRect } from '@/features/socrates-demo/types'

export interface DziDescriptorInfo {
  width: number
  height: number
  tileSize: number
  overlap: number
  format: 'jpg' | 'jpeg'
}

export interface ResolvedSocratesSlideSource {
  descriptorUrl: string
  slideKey: string
  initialImageRect?: ImageRect
  attributionUrl?: string
  annotatedDescriptorUrl?: string
}

const INVENIO_DZI_ORIGIN = 'https://www.invenio-cloud.com'
const NIO_THINVIEWER_ORIGIN = 'https://www.nio-net.com'
const THINVIEWER_PATH = /^\/Thinviewer\/([A-Za-z0-9._-]+)\.dzi$/i

function readThinviewerCrop(url: URL): ImageRect | undefined {
  const names = ['x1', 'y1', 'x2', 'y2'] as const
  const hasAnyCoordinate = names.some((name) => url.searchParams.has(name))
  if (!hasAnyCoordinate) return undefined

  if (!names.every((name) => url.searchParams.has(name))) {
    throw new Error('A Thinviewer starting crop must include x1, y1, x2, and y2.')
  }

  const rawValues = names.map((name) => url.searchParams.get(name)?.trim() ?? '')
  if (rawValues.some((value) => value === '')) {
    throw new Error('Thinviewer crop coordinates must be numbers.')
  }

  const [x1, y1, x2, y2] = rawValues.map(Number)
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    throw new Error('Thinviewer crop coordinates must be numbers.')
  }
  if (x1 < 0 || y1 < 0 || x2 <= x1 || y2 <= y1) {
    throw new Error('Thinviewer crop coordinates must describe a positive image rectangle.')
  }

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

/**
 * Accepts either the raw Invenio descriptor used by OpenSeadragon or the
 * user-facing NIO Thinviewer URL that Invenio users normally copy.
 */
export function resolveSocratesSlideSource(input: string): ResolvedSocratesSlideSource {
  const value = input.trim()
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Paste a complete HTTPS NIO Thinviewer or Invenio DZI URL.')
  }

  const pair = getInvenioPair(value)
  if (pair) {
    return {
      descriptorUrl: pair.tissueUrl,
      annotatedDescriptorUrl: pair.annotatedUrl,
      slideKey: pair.id,
      attributionUrl: pair.viewerUrl,
    }
  }

  if (isApprovedSocratesDziUrl(value)) {
    const slideKey =
      url.pathname
        .split('/')
        .at(-1)
        ?.replace(/\.dzi$/i, '') ?? ''
    return { descriptorUrl: url.toString(), slideKey }
  }

  const thinviewerMatch = url.pathname.match(THINVIEWER_PATH)
  if (
    url.origin === NIO_THINVIEWER_ORIGIN &&
    !url.username &&
    !url.password &&
    url.hash === '' &&
    thinviewerMatch?.[1]
  ) {
    const slideKey = thinviewerMatch[1]
    return {
      descriptorUrl: `${INVENIO_DZI_ORIGIN}/api/thinslides/${slideKey}.dzi`,
      slideKey,
      initialImageRect: readThinviewerCrop(url),
      attributionUrl: url.toString(),
    }
  }

  throw new Error(
    'Paste an HTTPS NIO Thinviewer link, Invenio Cloud DZI descriptor, or UCSD Slide Viewer slide link.',
  )
}

function readAttribute(source: string, name: string) {
  return source.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]
}

function positiveInteger(value: string | undefined, label: string) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer.`)
  }
  return number
}

export function parseDziDescriptorXml(xml: string): DziDescriptorInfo {
  const imageTag = xml.match(/<Image\b([^>]*)>/i)?.[1]
  const sizeTag = xml.match(/<Size\b([^>]*)\/?\s*>/i)?.[1]
  if (!imageTag || !sizeTag) {
    throw new Error('The response is not a readable DZI descriptor.')
  }

  const format = readAttribute(imageTag, 'Format')?.toLowerCase()
  if (format !== 'jpg' && format !== 'jpeg') {
    throw new Error('The builder currently supports JPEG DZI pyramids only.')
  }

  const overlap = Number(readAttribute(imageTag, 'Overlap'))
  if (!Number.isInteger(overlap) || overlap < 0) {
    throw new Error('DZI overlap must be a non-negative integer.')
  }

  return {
    width: positiveInteger(readAttribute(sizeTag, 'Width'), 'DZI width'),
    height: positiveInteger(readAttribute(sizeTag, 'Height'), 'DZI height'),
    tileSize: positiveInteger(readAttribute(imageTag, 'TileSize'), 'DZI tile size'),
    overlap,
    format,
  }
}

export async function loadInvenioDziDescriptor(
  descriptorUrl: string,
  signal?: AbortSignal,
): Promise<DziDescriptorInfo> {
  if (!isApprovedSocratesDziUrl(descriptorUrl)) {
    throw new Error('Use an approved Invenio Cloud DZI descriptor URL.')
  }

  const response = await fetch(socratesTileSourceUrl(descriptorUrl), {
    credentials: 'omit',
    headers: { Accept: 'application/xml,text/xml' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Invenio returned HTTP ${response.status}.`)
  }

  return parseDziDescriptorXml(await response.text())
}
