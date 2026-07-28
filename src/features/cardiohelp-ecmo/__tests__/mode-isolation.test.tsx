import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { CardiohelpWorkbench } from '../components/CardiohelpWorkbench'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { createInitialSimulationState } from '../engine'

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

describe('CARDIOHELP VV and VA pathway isolation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    mockRouterPush.mockReset()
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true }),
    })
  })

  it('keeps VV and VA Learn tracks isolated with keyboard-accessible switching', async () => {
    render(<CardiohelpWorkbench section="learn" />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Guided lessons/i })).toBeInTheDocument()
    })

    const vvTrack = screen.getByRole('radio', { name: /VV track/i })
    const vaTrack = screen.getByRole('radio', { name: /VA track/i })
    expect(vvTrack).toHaveAttribute('aria-checked', 'true')
    expect(vvTrack).toHaveAttribute('tabindex', '0')
    expect(vaTrack).toHaveAttribute('tabindex', '-1')
    // The rail lists the whole authored VV pathway, physiology sections included.
    const vvRail = screen.getByRole('navigation', { name: /VV learning pathway sections/i })
    expect(within(vvRail).getAllByRole('button')).toHaveLength(
      criticalCareLearningPathway('cardiohelp-ecmo', 'vv').sections.length,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))
    expect(
      screen.getByRole('img', { name: /VV ECMO femoral-femoral circuit schematic/i }),
    ).toBeInTheDocument()

    fireEvent.keyDown(vvTrack, { key: 'ArrowRight' })
    expect(vaTrack).toHaveAttribute('aria-checked', 'true')
    expect(vaTrack).toHaveAttribute('tabindex', '0')
    const vaRail = screen.getByRole('navigation', { name: /VA learning pathway sections/i })
    expect(within(vaRail).getAllByRole('button')).toHaveLength(
      criticalCareLearningPathway('cardiohelp-ecmo', 'va').sections.length,
    )
    expect(
      screen.getByRole('img', { name: /VA ECMO femoral-femoral circuit schematic/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Femoral artery return')).toBeInTheDocument()
    expect(screen.getAllByText('Right-arm SpO₂').length).toBeGreaterThan(0)

    fireEvent.keyDown(vaTrack, { key: 'Home' })
    expect(vvTrack).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps Practice case options track-scoped when switching modes', async () => {
    render(<CardiohelpWorkbench section="practice" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Begin case/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))
    expect(screen.getByRole('button', { name: 'Commit before action' })).toBeDisabled()

    const vvControl = screen.getByLabelText('First priority')
    expect(
      within(vvControl).queryByRole('option', { name: /right-arm oxygenation/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /VA track/i }))
    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))
    const vaControl = screen.getByLabelText('First priority')
    expect(
      within(vaControl).queryByRole('option', { name: /VV off-sweep trial/i }),
    ).not.toBeInTheDocument()
    expect(
      within(vaControl).getByRole('option', { name: /right-arm oxygenation/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Initiate VV ECMO/i })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Initiate peripheral VA ECMO/i })).toBeInTheDocument()
  })

  it('reloads a clean walkthrough when the track changes and never scores Learn', async () => {
    render(<CardiohelpWorkbench section="learn" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /identify all four domains/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /VA track/i }))
    expect(screen.queryByText(/Step complete—now verify what changed/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /VV track/i }))
    expect(screen.queryByText(/Step complete—now verify what changed/i)).not.toBeInTheDocument()

    const stored = JSON.parse(
      window.localStorage.getItem('cardiohelp-ecmo-progress-v1') ?? '{}',
    ) as { completedLearnLessonIds?: string[]; completedLabs?: string[] }
    expect(stored.completedLearnLessonIds ?? []).toHaveLength(0)
    expect(stored.completedLabs ?? []).toHaveLength(0)
  })

  it('hydrates persisted Learn completion from storage on load', async () => {
    window.localStorage.setItem(
      'cardiohelp-ecmo-progress-v1',
      JSON.stringify({
        version: 2,
        lastStation: 'orientation',
        completedLabs: [],
        scenarioAttempts: {},
        bestScores: {},
        criticalErrorStatus: {},
        mastery: false,
        completedLearnLessonIds: ['acute-hypercapnia'],
        lastLessonScenarioIdByMode: {},
        lastCaseScenarioIdByMode: {},
      }),
    )

    render(<CardiohelpWorkbench section="learn" />)
    await waitFor(() => {
      expect(screen.getByText('Choose any lesson')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Acute hypercapnic acidemia/i })).toBeInTheDocument()
  })

  it('renders mode-specific cannulation and supports keyboard panning of the schematic', () => {
    const state = createInitialSimulationState('va-differential-hypoxemia')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    expect(screen.getByText(/femoral artery → arterial circulation/i)).toBeInTheDocument()
    expect(screen.getByText(/MIXING REGION VARIES/i)).toBeInTheDocument()
    expect(screen.getByText(/DISTAL LIMB CHECK/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Circuit pArt is post-oxygenator circuit pressure/i),
    ).toBeInTheDocument()

    const viewport = screen.getByRole('group', { name: /horizontally scrollable/i })
    const scrollBy = jest.fn()
    Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy })
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledWith({ left: 120, behavior: 'smooth' })
  })

  it('uses non-animated keyboard panning when reduced motion is requested', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    })
    const state = createInitialSimulationState('startup-sensor-orientation')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))

    const viewport = screen.getByRole('group', { name: /horizontally scrollable/i })
    const scrollBy = jest.fn()
    Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy })
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledWith({ left: 120, behavior: 'auto' })
  })
})
