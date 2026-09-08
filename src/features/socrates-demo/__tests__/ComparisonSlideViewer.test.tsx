import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { createRef } from 'react'
import type { DeepZoomViewerProps } from '../components/DeepZoomViewer'
import type { DeepZoomViewerHandle, ViewportSnapshot } from '../types'
import { socratesDemoAnnotations, socratesDemoSlide } from '../content/demo-slide'

const mockCallbacks: Record<string, DeepZoomViewerProps> = {}
const mockSynchronize = jest.fn()
const mockZoom = jest.fn()
jest.mock('../components/DeepZoomViewer', () => ({
  DeepZoomViewer: React.forwardRef(function MockViewer(
    props: DeepZoomViewerProps,
    ref: React.ForwardedRef<DeepZoomViewerHandle>,
  ) {
    const pane = props.slide.descriptorUrl.endsWith('/analysis.dzi') ? 'annotated' : 'tissue'
    React.useLayoutEffect(() => {
      mockCallbacks[pane] = props
    }, [pane, props])
    React.useImperativeHandle(ref, () => ({
      fitImageRect: jest.fn(),
      resetToInitialView: jest.fn(),
      retry: jest.fn(),
      zoomBy: (factor) => mockZoom(pane, factor),
      synchronizeViewport: (snapshot) => {
        mockSynchronize(pane, snapshot)
        // Model an OpenSeadragon echo: synchronization must not bounce indefinitely.
        mockCallbacks[pane].onViewportChange(snapshot)
      },
    }))
    React.useEffect(() => {
      mockCallbacks[pane].onStatusChange?.({ phase: 'ready' })
    }, [pane])
    return (
      <div data-testid={`${pane}-viewer`}>
        <span>{props.annotations.map((annotation) => annotation.label).join(',')}</span>
      </div>
    )
  }),
}))

import { ComparisonSlideViewer } from '../components/ComparisonSlideViewer'

const pairedSlide = {
  ...socratesDemoSlide,
  descriptorUrl:
    'https://ucsd-slide-viewer-1080580899927.us-central1.run.app/generated/tiles/nio-006-series-4-barcode-ax00631/original.dzi',
}
const closeView: ViewportSnapshot = {
  zoomRatio: 3,
  visibleImageBounds: { x: 300, y: 1900, width: 500, height: 450 },
}

function renderComparison() {
  const ref = createRef<DeepZoomViewerHandle>()
  const onViewportChange = jest.fn()
  const onImageSelect = jest.fn()
  const onDrawRectangle = jest.fn()
  const result = render(
    <ComparisonSlideViewer
      ref={ref}
      slide={pairedSlide}
      annotations={socratesDemoAnnotations}
      selectedAnnotationId="zone-1"
      previewedAnnotationId={null}
      onImageHover={jest.fn()}
      onImageSelect={onImageSelect}
      onDrawRectangle={onDrawRectangle}
      onViewportChange={onViewportChange}
    />,
  )
  return { ...result, ref, onViewportChange, onImageSelect, onDrawRectangle }
}

describe('paired teaching viewer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows the same teaching regions and routes selections/drawings from either image', () => {
    const { onImageSelect, onDrawRectangle } = renderComparison()
    expect(within(screen.getByTestId('tissue-viewer')).getByText(/Zone 1A/)).toBeVisible()
    expect(within(screen.getByTestId('annotated-viewer')).getByText(/Zone 1A/)).toBeVisible()
    act(() => {
      mockCallbacks.annotated.onImageSelect({ x: 420, y: 2000 })
      mockCallbacks.tissue.onDrawRectangle?.(closeView.visibleImageBounds)
    })
    expect(onImageSelect).toHaveBeenCalledWith({ x: 420, y: 2000 })
    expect(onDrawRectangle).toHaveBeenCalledWith(closeView.visibleImageBounds)
  })

  it('synchronizes pan/zoom in both directions without feedback loops', () => {
    const { onViewportChange } = renderComparison()
    mockSynchronize.mockClear()
    onViewportChange.mockClear()
    act(() => mockCallbacks.annotated.onViewportChange(closeView))
    expect(mockSynchronize).toHaveBeenCalledTimes(1)
    expect(mockSynchronize).toHaveBeenCalledWith('tissue', closeView)
    expect(onViewportChange).toHaveBeenCalledTimes(1)
    const next = { ...closeView, zoomRatio: 4 }
    act(() => mockCallbacks.tissue.onViewportChange(next))
    expect(mockSynchronize).toHaveBeenLastCalledWith('annotated', next)
    expect(onViewportChange).toHaveBeenLastCalledWith(next)
  })

  it('restores the current region and teaching zoom after switching image modes', async () => {
    const user = userEvent.setup()
    renderComparison()
    act(() => mockCallbacks.tissue.onViewportChange(closeView))
    await user.click(screen.getByRole('button', { name: 'Color annotated' }))
    expect(screen.queryByTestId('tissue-viewer')).not.toBeInTheDocument()
    // The wider pane fits the original area with extra space at its sides.
    act(() =>
      mockCallbacks.annotated.onViewportChange({
        ...closeView,
        visibleImageBounds: { x: 50, y: 1900, width: 1000, height: 450 },
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Side by side' }))
    expect(mockSynchronize).toHaveBeenCalledWith('tissue', closeView)
    expect(mockSynchronize).toHaveBeenLastCalledWith('annotated', closeView)
  })

  it('keeps controls usable on the surviving image if its partner fails', () => {
    const { ref } = renderComparison()
    act(() =>
      mockCallbacks.tissue.onStatusChange?.({
        phase: 'error',
        kind: 'descriptor',
        message: 'unavailable',
      }),
    )
    act(() => ref.current?.zoomBy(1.35))
    expect(mockZoom).toHaveBeenCalledWith('annotated', 1.35)
  })
})
