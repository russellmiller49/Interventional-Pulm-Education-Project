import { resolveSocratesSlideSource } from '../descriptor'
import {
  getInvenioPair,
  INVENIO_DEMO_ORIGIN,
  isApprovedSocratesDziUrl,
  isInvenioAssetPath,
  socratesTileSourceUrl,
} from '../invenio-source'

const id = 'nio-006-series-4-barcode-ax00631'
const tissue = `${INVENIO_DEMO_ORIGIN}/generated/tiles/${id}/original.dzi`
const annotated = `${INVENIO_DEMO_ORIGIN}/generated/tiles/${id}/analysis.dzi`

describe('Invenio comparison sources', () => {
  it.each(['slides', 'thinviewer/side-by-side', 'thinviewer/curtain', 'thinviewer/tissue-only'])(
    'resolves a %s link to the same registered tissue and annotation pair',
    (path) => {
      expect(resolveSocratesSlideSource(`${INVENIO_DEMO_ORIGIN}/${path}/${id}`)).toEqual({
        descriptorUrl: tissue,
        annotatedDescriptorUrl: annotated,
        slideKey: id,
        attributionUrl: `${INVENIO_DEMO_ORIGIN}/slides/${id}`,
      })
    },
  )

  it('normalizes an analysis descriptor to tissue coordinates and relays only demo assets', () => {
    expect(resolveSocratesSlideSource(annotated).descriptorUrl).toBe(tissue)
    expect(socratesTileSourceUrl(tissue)).toBe(`/api/socrates-invenio/tiles/${id}/original.dzi`)
    const oldSource = 'https://www.invenio-cloud.com/api/thinslides/example.dzi'
    expect(socratesTileSourceUrl(oldSource)).toBe(oldSource)
  })

  it.each([
    `${tissue}?token=secret`,
    `${tissue}#fragment`,
    tissue.replace('https://', 'https://user:password@'),
    tissue.replace('run.app', 'run.app.evil.test'),
    tissue.replace('/original.dzi', '/unrelated.dzi'),
    tissue.replace(id, 'arbitrary-id'),
  ])('rejects unsupported source %s', (source) => {
    expect(isApprovedSocratesDziUrl(source)).toBe(false)
    expect(getInvenioPair(source)).toBeNull()
  })

  it('allows only catalog, descriptors, and JPEG tile paths', () => {
    for (const path of [
      'catalog.json',
      `tiles/${id}/original.dzi`,
      `tiles/${id}/analysis_files/14/0_2.jpeg`,
    ]) {
      expect(isInvenioAssetPath(path)).toBe(true)
    }
    for (const path of [
      '../catalog.json',
      'catalog.json?url=https://example.com',
      `tiles/${id}/original_files/14/0_2.svg`,
      `tiles/${id}/../../secret`,
      'https://example.com',
    ]) {
      expect(isInvenioAssetPath(path)).toBe(false)
    }
  })
})
