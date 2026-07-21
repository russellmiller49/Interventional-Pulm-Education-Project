export interface ImagePoint {
  x: number
  y: number
}

export interface ImageRect extends ImagePoint {
  width: number
  height: number
}

export type FourPointPolygon = readonly [ImagePoint, ImagePoint, ImagePoint, ImagePoint]

export interface DeepZoomSlide {
  id: string
  descriptorUrl: string
  expectedDimensions: {
    width: number
    height: number
  }
  initialImageRect: ImageRect
  attribution: {
    label: string
    href: string
  }
  contentStatus: string
}

export interface DemoAnnotation {
  id: string
  parentId?: string
  label: string
  polygon: FourPointPolygon
  style: 'parent' | 'detail'
  enterZoomRatio: number
  exitZoomRatio: number
  summary: string
  placeholderNote: string
  sortOrder?: number
}

export interface DeepZoomViewerHandle {
  fitImageRect: (rect: ImageRect) => void
  zoomBy: (factor: number) => void
  resetToInitialView: () => void
  retry: () => void
}

export interface ViewportSnapshot {
  zoomRatio: number
  visibleImageBounds: ImageRect
}

export type DeepZoomViewerStatus =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string; kind: 'descriptor' | 'dimensions' }
