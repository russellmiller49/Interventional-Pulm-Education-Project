import type { DeepZoomSlide, DemoAnnotation, ImageRect } from '../types'
import { rectangleToPolygon } from '../engine/geometry'

export const SOCRATES_INITIAL_RECT: ImageRect = {
  x: 65,
  y: 1738,
  width: 1525,
  height: 1249,
}

export const socratesDemoSlide: DeepZoomSlide = {
  id: 'PATH_IP31-AC0501-2_7',
  descriptorUrl: 'https://www.invenio-cloud.com/api/thinslides/PATH_IP31-AC0501-2_7.dzi',
  expectedDimensions: {
    width: 5400,
    height: 5900,
  },
  initialImageRect: SOCRATES_INITIAL_RECT,
  attribution: {
    label: 'Sample slide provided through NIO Thinviewer / Invenio Cloud',
    href: 'https://www.nio-net.com/Thinviewer/PATH_IP31-AC0501-2_7.dzi?x1=65&y1=1738&x2=1590&y2=2987',
  },
  contentStatus: 'Placeholder annotations—not clinically reviewed',
}

export const socratesDemoAnnotations: readonly DemoAnnotation[] = [
  {
    id: 'zone-1',
    label: 'Zone 1',
    polygon: rectangleToPolygon({ x: 220, y: 1800, width: 700, height: 900 }),
    style: 'parent',
    enterZoomRatio: 0,
    exitZoomRatio: 0,
    summary: 'A parent region demonstrating stable image-pixel alignment while the slide moves.',
    placeholderNote: 'Zoom into this zone to reveal the nested Zones 1A and 1B.',
  },
  {
    id: 'zone-1a',
    parentId: 'zone-1',
    label: 'Zone 1A',
    polygon: rectangleToPolygon({ x: 320, y: 1900, width: 260, height: 260 }),
    style: 'detail',
    enterZoomRatio: 1.75,
    exitZoomRatio: 1.55,
    summary: 'A nested detail region that appears only after the parent area is enlarged.',
    placeholderNote: 'Illustrative geometry and copy for interaction review only.',
  },
  {
    id: 'zone-1b',
    parentId: 'zone-1',
    label: 'Zone 1B',
    polygon: rectangleToPolygon({ x: 600, y: 2150, width: 250, height: 300 }),
    style: 'detail',
    enterZoomRatio: 1.75,
    exitZoomRatio: 1.55,
    summary: 'A second nested detail region used to demonstrate overlap-aware selection.',
    placeholderNote: 'Illustrative geometry and copy for interaction review only.',
  },
  {
    id: 'zone-2',
    label: 'Zone 2',
    polygon: rectangleToPolygon({ x: 930, y: 1800, width: 600, height: 1050 }),
    style: 'parent',
    enterZoomRatio: 0,
    exitZoomRatio: 0,
    summary: 'A second parent region demonstrating navigation between separate slide areas.',
    placeholderNote: 'Zoom into this zone to reveal the nested Zone 2A.',
  },
  {
    id: 'zone-2a',
    parentId: 'zone-2',
    label: 'Zone 2A',
    polygon: rectangleToPolygon({ x: 1040, y: 1970, width: 350, height: 360 }),
    style: 'detail',
    enterZoomRatio: 1.75,
    exitZoomRatio: 1.55,
    summary: 'A nested region showing that detail visibility is gated by its parent and zoom.',
    placeholderNote: 'Illustrative geometry and copy for interaction review only.',
  },
] as const
