import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'

import { socratesDemoAnnotations, socratesDemoSlide } from '../content/demo-slide'
import type {
  DeepZoomViewerHandle,
  DeepZoomViewerStatus,
  ImagePoint,
  ViewportSnapshot,
} from '../types'

interface MockEvent {
  message?: string
  quick?: boolean
  position?: { x: number; y: number }
}

type MockEventHandler = (event: MockEvent) => void

let mockHandlers: Record<string, MockEventHandler> = {}
let mockContentSize = { x: 5400, y: 5900 }
const mockDestroy = jest.fn()
const mockClose = jest.fn()
const mockFitBounds = jest.fn()
const mockZoomBy = jest.fn()
const mockApplyConstraints = jest.fn()
const mockOpenSeadragon = jest.fn()

jest.mock('openseadragon', () => ({
  __esModule: true,
  default: (options: unknown) => mockOpenSeadragon(options),
  Point: class MockPoint {
    constructor(
      public x: number,
      public y: number,
    ) {}
  },
}))

import { DeepZoomViewer } from '../components/DeepZoomViewer'

function configureMockViewer() {
  mockOpenSeadragon.mockImplementation((rawOptions: unknown) => {
    const options = rawOptions as { element: HTMLElement }
    const canvas = document.createElement('div')
    options.element.appendChild(canvas)

    const tiledImage = {
      getContentSize: () => mockContentSize,
      imageToViewportRectangle: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
      }),
      viewportToImageRectangle: () => ({ x: 65, y: 1738, width: 1525, height: 1249 }),
      viewerElementToImageCoordinates: (point: { x: number; y: number }) => point,
      imageToViewportCoordinates: (x: number, y: number) => ({ x, y }),
    }

    const viewport = {
      fitBounds: mockFitBounds,
      getZoom: () => 1,
      getBounds: () => ({ x: 0, y: 0, width: 1, height: 1 }),
      viewportToViewerElementCoordinates: (point: { x: number; y: number }) => point,
      zoomBy: mockZoomBy,
      applyConstraints: mockApplyConstraints,
    }

    return {
      element: options.element,
      canvas,
      viewport,
      world: { getItemAt: () => tiledImage },
      addHandler: (eventName: string, handler: MockEventHandler) => {
        mockHandlers[eventName] = handler
      },
      addOverlay: ({ element }: { element: HTMLElement }) => {
        options.element.appendChild(element)
      },
      close: mockClose,
      destroy: mockDestroy,
    }
  })
}

function renderViewer(overrides?: {
  slide?: typeof socratesDemoSlide
  onStatusChange?: (status: DeepZoomViewerStatus) => void
}) {
  const ref = createRef<DeepZoomViewerHandle>()
  const onImageHover = jest.fn<void, [ImagePoint | null]>()
  const onImageSelect = jest.fn<void, [ImagePoint]>()
  const onViewportChange = jest.fn<void, [ViewportSnapshot]>()
  const onStatusChange = overrides?.onStatusChange ?? jest.fn<void, [DeepZoomViewerStatus]>()
  const view = render(
    <DeepZoomViewer
      ref={ref}
      slide={overrides?.slide ?? socratesDemoSlide}
      annotations={socratesDemoAnnotations.slice(0, 2)}
      selectedAnnotationId="zone-1"
      previewedAnnotationId={null}
      onImageHover={onImageHover}
      onImageSelect={onImageSelect}
      onViewportChange={onViewportChange}
      onStatusChange={onStatusChange}
    />,
  )

  return { ...view, ref, onImageHover, onImageSelect, onViewportChange, onStatusChange }
}

describe('DeepZoomViewer lifecycle and recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHandlers = {}
    mockContentSize = { x: 5400, y: 5900 }
    configureMockViewer()
  })

  it('loads one viewer, fits the exact initial rectangle, and publishes ready state', async () => {
    const { onStatusChange } = renderViewer()

    expect(screen.getByText('Loading the remote slide…')).toBeVisible()
    await waitFor(() => expect(mockOpenSeadragon).toHaveBeenCalledTimes(1))

    act(() => mockHandlers.open({}))

    expect(mockFitBounds).toHaveBeenCalledWith({ x: 65, y: 1738, width: 1525, height: 1249 }, false)
    expect(onStatusChange).toHaveBeenLastCalledWith({ phase: 'ready' })
    expect(screen.queryByText('Loading the remote slide…')).not.toBeInTheDocument()
  })

  it('reports a dimension mismatch and makes it retryable', async () => {
    const user = userEvent.setup()
    mockContentSize = { x: 5399, y: 5900 }
    renderViewer()
    await waitFor(() => expect(mockOpenSeadragon).toHaveBeenCalledTimes(1))

    act(() => mockHandlers.open({}))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'expected 5400 × 5900, received 5399 × 5900',
    )
    expect(mockClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Retry slide' }))
    await waitFor(() => expect(mockOpenSeadragon).toHaveBeenCalledTimes(2))
  })

  it('surfaces descriptor and partial-tile failures without introducing a proxy', async () => {
    const user = userEvent.setup()
    renderViewer()
    await waitFor(() => expect(mockOpenSeadragon).toHaveBeenCalledTimes(1))

    act(() => mockHandlers['open-failed']({ message: 'CORS descriptor failure' }))
    expect(screen.getByRole('alert')).toHaveTextContent('CORS descriptor failure')

    await user.click(screen.getByRole('button', { name: 'Retry slide' }))
    await waitFor(() => expect(mockOpenSeadragon).toHaveBeenCalledTimes(2))
    act(() => mockHandlers.open({}))
    act(() => mockHandlers['tile-load-failed']({ message: 'missing tile' }))

    expect(screen.getByText('Some image tiles did not load.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('uses quick canvas clicks for selection and destroys the viewer on cleanup', async () => {
    const { unmount, onImageSelect, ref } = renderViewer()
    await waitFor(() => expect(mockOpenSeadragon).toHaveBeenCalledTimes(1))
    act(() => mockHandlers.open({}))

    act(() => mockHandlers['canvas-click']({ quick: false, position: { x: 400, y: 2000 } }))
    expect(onImageSelect).not.toHaveBeenCalled()

    act(() => mockHandlers['canvas-click']({ quick: true, position: { x: 400, y: 2000 } }))
    expect(onImageSelect).toHaveBeenCalledWith({ x: 400, y: 2000 })

    act(() => ref.current?.zoomBy(1.35))
    expect(mockZoomBy).toHaveBeenCalledWith(1.35, undefined, false)

    unmount()
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })
})
