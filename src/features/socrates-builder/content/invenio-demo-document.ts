import { rectangleToPolygon } from '@/features/socrates-demo/engine/geometry'

import { getInvenioPair, INVENIO_DEMO_ORIGIN } from '../invenio-source'
import type { SocratesSlideDocument } from '../types'

/** Source dimensions checked against both provider descriptors on September 8, 2026.
 * These teaching rectangles demonstrate authoring; they are not clinical classifications. */
export function createInvenioDemoDocument(): SocratesSlideDocument {
  const pair = getInvenioPair(`${INVENIO_DEMO_ORIGIN}/slides/nio-006-series-4-barcode-ax00631`)!
  return {
    recordId: 'b00c0060-0000-4000-8000-000000000001',
    slug: pair.id,
    title: pair.label,
    workflowStatus: 'draft',
    revision: 0,
    slide: {
      id: pair.id,
      descriptorUrl: pair.tissueUrl,
      expectedDimensions: { width: 9000, height: 9900 },
      initialImageRect: { x: 0, y: 0, width: 9000, height: 9900 },
      attribution: { label: 'Invenio Imaging · UCSD Slide Viewer', href: pair.viewerUrl },
      contentStatus: 'Illustrative teaching regions · awaiting author review',
    },
    annotations: [
      {
        id: 'tissue-color-correlation',
        label: 'Tissue and color correlation',
        polygon: rectangleToPolygon({ x: 470, y: 3581, width: 4433, height: 3922 }),
        style: 'parent',
        enterZoomRatio: 0,
        exitZoomRatio: 0,
        summary: 'Compare this region in the tissue and the matching Invenio color image.',
        explanation:
          'Both panes show the same part of the slide. Pan or zoom either image to compare the tissue with the color annotations supplied by Invenio.\n\nZoom into this teaching region to reveal a smaller detail with its own explanation. In Build a slide, replace this example text with the features you want the learner to observe and the sources supporting your interpretation.',
        placeholderNote: 'Illustrative region for the company demo; no clinical meaning assigned.',
        sortOrder: 0,
      },
      {
        id: 'close-up-teaching-detail',
        parentId: 'tissue-color-correlation',
        label: 'Close-up teaching detail',
        polygon: rectangleToPolygon({ x: 3306, y: 5982, width: 1179, height: 1150 }),
        style: 'detail',
        enterZoomRatio: 1.82,
        exitZoomRatio: 1.62,
        summary: 'A smaller region with its own explanation, revealed as you zoom in.',
        explanation:
          'This detail demonstrates how a broad teaching region can contain a more specific explanation at higher magnification. Its boundary stays aligned in both images.\n\nAn author can describe the visible features here, explain how they relate to the Invenio colors, and add supporting references. This example demonstrates the interaction and awaits clinical author review.',
        placeholderNote: 'Example zoom threshold and region authored for this demonstration.',
        sortOrder: 1,
      },
    ],
  }
}
