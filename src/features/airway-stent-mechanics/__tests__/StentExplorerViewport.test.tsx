import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'

import { StentExplorerViewport } from '../components/explorer/StentExplorerViewport'
import { getStentExplorerStation } from '../explorer/stations'

jest.mock('@react-three/fiber', () => ({
  Canvas: ({ frameloop }: { children: ReactNode; frameloop: 'always' | 'demand' }) => (
    <div data-frameloop={frameloop} data-testid="mock-stent-explorer-canvas" />
  ),
}))

function installReducedMotionMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
    writable: true,
  })
}

describe('StentExplorerViewport reduced-motion authority', () => {
  const station = getStentExplorerStation('cough-motion')
  const commonProps = {
    architectureId: station.defaultArchitectureId,
    playing: true,
    progress: 0.25,
    showHotspots: false,
    station,
    viewMode: 'external' as const,
  }

  beforeEach(() => {
    installReducedMotionMatchMedia()
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({}) as GPUCanvasContext)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('treats an explicit reducedMotion=false prop as authoritative over the system preference', async () => {
    render(<StentExplorerViewport {...commonProps} reducedMotion={false} />)

    await waitFor(() => {
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(screen.getByTestId('mock-stent-explorer-canvas')).toHaveAttribute(
        'data-frameloop',
        'always',
      )
    })
    expect(
      within(screen.getByTestId('stent-explorer-viewport')).getByRole('status'),
    ).not.toHaveTextContent('Reduced motion is active.')
  })

  it('keeps the viewport static when reducedMotion=true is explicitly supplied', async () => {
    render(<StentExplorerViewport {...commonProps} reducedMotion />)

    await waitFor(() => {
      expect(screen.getByTestId('mock-stent-explorer-canvas')).toHaveAttribute(
        'data-frameloop',
        'demand',
      )
    })
    expect(
      within(screen.getByTestId('stent-explorer-viewport')).getByRole('status'),
    ).toHaveTextContent('Reduced motion is active.')
  })
})
