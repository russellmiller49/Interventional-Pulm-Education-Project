import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import type { DeepZoomViewerHandle } from '../types'

const mockFitImageRect = jest.fn()
const mockZoomBy = jest.fn()
const mockResetToInitialView = jest.fn()
const mockRetry = jest.fn()

jest.mock('../components/DeepZoomViewer', () => {
  const MockDeepZoomViewer = React.forwardRef(
    (
      props: {
        annotations: Array<{ id: string }>
        onImageSelect: (point: { x: number; y: number }) => void
        onStatusChange: (status: { phase: 'ready' }) => void
        onViewportChange: (snapshot: {
          zoomRatio: number
          visibleImageBounds: { x: number; y: number; width: number; height: number }
        }) => void
      },
      ref: React.ForwardedRef<DeepZoomViewerHandle>,
    ) => {
      const { onStatusChange } = props

      React.useImperativeHandle(ref, () => ({
        fitImageRect: mockFitImageRect,
        zoomBy: mockZoomBy,
        resetToInitialView: mockResetToInitialView,
        retry: mockRetry,
      }))

      React.useEffect(() => {
        onStatusChange({ phase: 'ready' })
      }, [onStatusChange])

      return (
        <div data-testid="mock-deep-zoom-viewer">
          <output data-testid="overlay-ids">
            {props.annotations.map((annotation) => annotation.id).join(',')}
          </output>
          <button
            type="button"
            onClick={() =>
              props.onViewportChange({
                zoomRatio: 2,
                visibleImageBounds: { x: 65, y: 1738, width: 1525, height: 1249 },
              })
            }
          >
            Mock detail zoom
          </button>
          <button type="button" onClick={() => props.onImageSelect({ x: 400, y: 2000 })}>
            Mock image click
          </button>
        </div>
      )
    },
  )
  MockDeepZoomViewer.displayName = 'MockDeepZoomViewer'

  return { DeepZoomViewer: MockDeepZoomViewer }
})

import { SocratesDemo } from '../components/SocratesDemo'

describe('SOCRATES demo interface', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows the live-demo framing, placeholder warning, source, and initial root regions', async () => {
    render(<SocratesDemo />)

    expect(
      screen.getByRole('heading', { name: 'SOCRATES deep-slide annotation demo' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Placeholder annotations—not clinically reviewed')).toBeVisible()
    expect(screen.getByText(/Education and demonstration only/)).toBeVisible()
    expect(screen.getByRole('link', { name: /Sample slide provided/ })).toHaveAttribute(
      'href',
      expect.stringContaining('nio-net.com/Thinviewer'),
    )
    const regionList = screen.getByRole('region', { name: 'Regions in view' })
    expect(within(regionList).getByRole('button', { name: 'Zone 1' })).toBeVisible()
    expect(within(regionList).getByRole('button', { name: 'Zone 2' })).toBeVisible()
    expect(within(regionList).queryByRole('button', { name: 'Zone 1A' })).not.toBeInTheDocument()
    expect(screen.getByTestId('overlay-ids')).toHaveTextContent('zone-1,zone-2')
  })

  it('reveals children with zoom hysteresis and selects the deepest image hit', async () => {
    const user = userEvent.setup()
    render(<SocratesDemo />)

    await user.click(screen.getByRole('button', { name: 'Mock detail zoom' }))
    const regionList = screen.getByRole('region', { name: 'Regions in view' })
    expect(within(regionList).getByRole('button', { name: 'Zone 1A' })).toBeVisible()
    expect(within(regionList).getByRole('button', { name: 'Zone 1B' })).toBeVisible()
    expect(within(regionList).getByRole('button', { name: 'Zone 2A' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Mock image click' }))
    expect(screen.getByRole('heading', { name: 'Zone 1A' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Zoom to Zone 1A' })).toBeEnabled()
  })

  it('supports region selection, zoom-to-zone, and ancestor breadcrumbs', async () => {
    const user = userEvent.setup()
    render(<SocratesDemo />)

    const regionList = screen.getByRole('region', { name: 'Regions in view' })
    await user.click(within(regionList).getByRole('button', { name: 'Zone 2' }))
    expect(screen.getByRole('heading', { name: 'Zone 2' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Zoom to Zone 2' }))
    expect(mockFitImageRect).toHaveBeenCalledWith({ x: 930, y: 1800, width: 600, height: 1050 })
    expect(mockZoomBy).toHaveBeenCalledWith(1.55)

    await user.click(screen.getByRole('button', { name: 'Mock detail zoom' }))
    await user.click(within(regionList).getByRole('button', { name: 'Zone 2A' }))
    expect(screen.getByRole('heading', { name: 'Zone 2A' })).toBeVisible()

    const zoneTwoButtons = screen.getAllByRole('button', { name: 'Zone 2' })
    await user.click(zoneTwoButtons[0])
    expect(mockFitImageRect).toHaveBeenLastCalledWith({
      x: 930,
      y: 1800,
      width: 600,
      height: 1050,
    })
  })

  it('pins a focused region with the keyboard', async () => {
    const user = userEvent.setup()
    render(<SocratesDemo />)

    const regionList = screen.getByRole('region', { name: 'Regions in view' })
    const zoneTwoButton = within(regionList).getByRole('button', { name: 'Zone 2' })
    zoneTwoButton.focus()
    await user.keyboard('{Enter}')

    expect(zoneTwoButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Zone 2' })).toBeVisible()
  })

  it('hides only the visual overlay and reset restores the crop selection', async () => {
    const user = userEvent.setup()
    render(<SocratesDemo />)

    const regionList = screen.getByRole('region', { name: 'Regions in view' })
    await user.click(within(regionList).getByRole('button', { name: 'Zone 2' }))
    await user.click(screen.getByRole('button', { name: 'Hide annotations' }))

    expect(screen.getByTestId('overlay-ids')).toBeEmptyDOMElement()
    expect(screen.getByRole('heading', { name: 'Zone 2' })).toBeVisible()
    expect(screen.getByText(/accessible region controls remain available/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Reset slide view' }))
    expect(mockResetToInitialView).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'Zone 1' })).toBeVisible()
    expect(screen.getByTestId('overlay-ids')).toBeEmptyDOMElement()
  })

  it('keeps the current viewport when annotation visibility changes', async () => {
    const user = userEvent.setup()
    render(<SocratesDemo />)

    await user.click(screen.getByRole('button', { name: 'Hide annotations' }))
    await user.click(screen.getByRole('button', { name: 'Show annotations' }))

    expect(mockFitImageRect).not.toHaveBeenCalled()
    expect(mockResetToInitialView).not.toHaveBeenCalled()
    expect(screen.getByTestId('overlay-ids')).toHaveTextContent('zone-1,zone-2')
  })
})
