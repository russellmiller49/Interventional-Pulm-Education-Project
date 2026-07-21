import { rectangleToPolygon } from '@/features/socrates-demo/engine/geometry'

import { createStarterSocratesDocument } from '../content/starter-document'
import {
  isApprovedInvenioDziUrl,
  parseSocratesSlideDocument,
  validateSocratesSlideDocument,
} from '../schema'

describe('SOCRATES builder document validation', () => {
  it('accepts the starter document and preserves its four-point polygons', () => {
    const document = parseSocratesSlideDocument(createStarterSocratesDocument())

    expect(document.slide.expectedDimensions).toEqual({ width: 5400, height: 5900 })
    expect(document.annotations).toHaveLength(5)
    expect(document.annotations[0].polygon).toHaveLength(4)
  })

  it('accepts only credential-free Invenio Cloud DZI descriptor URLs', () => {
    expect(
      isApprovedInvenioDziUrl(
        'https://www.invenio-cloud.com/api/thinslides/PATH_IP31-AC0501-2_7.dzi',
      ),
    ).toBe(true)
    expect(
      isApprovedInvenioDziUrl('https://www.invenio-cloud.com/api/thinslides/slide.dzi?token=x'),
    ).toBe(false)
    expect(isApprovedInvenioDziUrl('https://example.com/api/thinslides/slide.dzi')).toBe(false)
  })

  it('rejects annotations outside the source image', () => {
    const document = createStarterSocratesDocument()
    document.annotations[0] = {
      ...document.annotations[0],
      polygon: rectangleToPolygon({ x: 5300, y: 100, width: 200, height: 200 }),
    }

    const result = validateSocratesSlideDocument(document)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes('inside the slide bounds')),
      ).toBe(true)
    }
  })

  it('rejects duplicate IDs, missing parents, and detail regions without a parent', () => {
    const document = createStarterSocratesDocument()
    document.annotations = [
      document.annotations[0],
      {
        ...document.annotations[1],
        id: document.annotations[0].id,
        parentId: 'missing-parent',
      },
    ]

    const result = validateSocratesSlideDocument(document)

    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join(' ')
      expect(messages).toMatch(/duplicated/i)
      expect(messages).toMatch(/missing parent|requires a parent/i)
    }
  })

  it('requires detail regions to stay inside their parent region', () => {
    const document = createStarterSocratesDocument()
    document.annotations[1] = {
      ...document.annotations[1],
      polygon: rectangleToPolygon({ x: 850, y: 2600, width: 300, height: 300 }),
    }

    const result = validateSocratesSlideDocument(document)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('inside its parent'))).toBe(
        true,
      )
    }
  })
})
