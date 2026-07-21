import {
  socratesDemoAnnotations,
  socratesDemoSlide,
} from '@/features/socrates-demo/content/demo-slide'

import type { SocratesSlideDocument } from '../types'

export function createStarterSocratesDocument(): SocratesSlideDocument {
  return {
    slug: 'path-ip31-ac0501-2-7',
    title: 'PATH IP31 AC0501-2_7',
    workflowStatus: 'draft',
    revision: 0,
    slide: {
      ...socratesDemoSlide,
      expectedDimensions: { ...socratesDemoSlide.expectedDimensions },
      initialImageRect: { ...socratesDemoSlide.initialImageRect },
      attribution: { ...socratesDemoSlide.attribution },
    },
    annotations: socratesDemoAnnotations.map((annotation, index) => ({
      ...annotation,
      polygon: [
        { ...annotation.polygon[0] },
        { ...annotation.polygon[1] },
        { ...annotation.polygon[2] },
        { ...annotation.polygon[3] },
      ] as const,
      sortOrder: index,
    })),
  }
}

export function createBlankSocratesDocument(): SocratesSlideDocument {
  const starter = createStarterSocratesDocument()
  return {
    ...starter,
    slug: 'new-invenio-slide',
    title: 'New Invenio slide',
    revision: 0,
    annotations: [],
  }
}
