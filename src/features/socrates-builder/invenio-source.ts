/** The approved company demo serves registered tissue/analysis pairs at these paths. */
export const INVENIO_DEMO_ORIGIN = 'https://ucsd-slide-viewer-1080580899927.us-central1.run.app'
export const INVENIO_RELAY_PATH = '/api/socrates-invenio'

const slideIdPattern = 'nio-[0-9]+-series-[0-9]+-barcode-[a-z0-9]+'
const descriptorPattern = new RegExp(
  `^/generated/tiles/(${slideIdPattern})/(original|analysis)\\.dzi$`,
)
const viewerPattern = new RegExp(
  `^/(?:slides|thinviewer/(?:side-by-side|curtain|tissue-only))/(${slideIdPattern})/?$`,
)
const assetPattern = new RegExp(
  `^tiles/${slideIdPattern}/(?:original|analysis)(?:\\.dzi|_files/[0-9]{1,2}/[0-9]{1,6}_[0-9]{1,6}\\.jpe?g)$`,
)

function approvedDemoUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.origin === INVENIO_DEMO_ORIGIN &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? url
      : null
  } catch {
    return null
  }
}

export function getInvenioPair(value: string) {
  const url = approvedDemoUrl(value)
  const id =
    url && (url.pathname.match(descriptorPattern)?.[1] ?? url.pathname.match(viewerPattern)?.[1])
  if (!id) return null
  return {
    id,
    label: id.replace(
      /^nio-(\d+)-series-(\d+)-barcode-([a-z0-9]+)$/,
      (_, caseNumber, series, barcode: string) =>
        `Case ${caseNumber} · Series ${series} · ${barcode.toUpperCase()}`,
    ),
    tissueUrl: `${INVENIO_DEMO_ORIGIN}/generated/tiles/${id}/original.dzi`,
    annotatedUrl: `${INVENIO_DEMO_ORIGIN}/generated/tiles/${id}/analysis.dzi`,
    viewerUrl: `${INVENIO_DEMO_ORIGIN}/slides/${id}`,
  }
}

export function isApprovedSocratesDziUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return false
    return (
      (url.origin === 'https://www.invenio-cloud.com' &&
        /^\/api\/thinslides\/[A-Za-z0-9._-]+\.dzi$/.test(url.pathname)) ||
      (url.origin === INVENIO_DEMO_ORIGIN && descriptorPattern.test(url.pathname))
    )
  } catch {
    return false
  }
}

/** Only the fixed catalog and JPEG pyramids can pass through the relay. */
export function isInvenioAssetPath(path: string): boolean {
  return path === 'catalog.json' || assetPattern.test(path)
}

export function socratesTileSourceUrl(descriptorUrl: string): string {
  const url = approvedDemoUrl(descriptorUrl)
  if (!url || !descriptorPattern.test(url.pathname)) return descriptorUrl
  return `${INVENIO_RELAY_PATH}${url.pathname.slice('/generated'.length)}`
}
