import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
jest.mock('../components/McsAnatomy3D', () => ({
  McsAnatomy3D: ({ revealCausality }: { revealCausality: boolean }) => (
    <section aria-label="Animated mechanical-support anatomy">
      3D mechanism · coaching {revealCausality ? 'visible' : 'withheld'}
    </section>
  ),
}))
jest.mock('../components/EcmoCannulationPreview', () => ({
  EcmoCannulationPreview: () => <div>ECMO preview</div>,
}))
jest.mock('../components/ImpellaVariantPreview', () => ({
  ImpellaVariantPreview: () => <div>Impella preview</div>,
}))

import { McsHub } from '../components/McsHub'
import { McsWorkbench } from '../components/McsWorkbench'

const progressKey = 'interventionalpulm:mcs-progress:v1'

describe('Mechanical Circulatory Support learner interface', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/mechanical-circulatory-support/practice')
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true }),
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
  })

  afterEach(() => jest.useRealTimers())

  it('links each home-page card to its matching learning track', async () => {
    await act(async () => {
      render(<McsHub />)
    })
    const tracks = screen
      .getByRole('heading', { name: /See what the device moves/i })
      .closest('section')
    expect(tracks).not.toBeNull()

    for (const [heading, device] of [
      ['Intra-aortic balloon pump', 'iabp'],
      ['Impella CP, 5.5, and RP support', 'impella'],
      ['Durable continuous-flow LVAD', 'lvad'],
    ] as const) {
      const card = within(tracks!).getByRole('heading', { name: heading }).closest('article')
      expect(card).not.toBeNull()
      expect(within(card!).getByRole('link', { name: /Enter track/i })).toHaveAttribute(
        'href',
        `/mechanical-circulatory-support/learn?device=${device}`,
      )
    }
  })

  it.each([
    ['impella', /Impella CP \/ 5\.5 \/ RP/i, /Impella unloading and placement signals/i],
    ['lvad', /Durable continuous-flow LVAD/i, /Durable LVAD parameters and ICU assessment/i],
  ] as const)(
    'initializes the %s track and its first device lesson',
    (device, tabName, lessonName) => {
      render(<McsWorkbench section="learn" initialDevice={device} />)

      expect(screen.getByRole('button', { name: tabName })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: lessonName })).toHaveAttribute(
        'aria-current',
        'true',
      )
    },
  )

  it('renders the safety boundary, synchronized accessible traces, and required hemodynamics', () => {
    render(<McsWorkbench section="practice" />)
    expect(screen.getByText(/Educational model—not a clinical device/i)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: /Synchronized mechanical-support bedside monitor/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ECG II waveform/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ART waveform/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /pressure-volume loop/i })).toBeInTheDocument()
    const metrics = screen.getByRole('complementary', { name: /Current hemodynamic values/i })
    for (const label of [
      'NATIVE FLOW',
      'DEVICE FLOW',
      'EFFECTIVE FLOW',
      'MAP / PP',
      'RAP / PCWP',
      'PAPi / CPO',
      'SvO₂ / LVEDP',
      'AV OPENING',
    ]) {
      expect(within(metrics).getByText(label)).toBeInTheDocument()
    }
  })

  it('configures and displays independent 5.5 and RP pumps in the biventricular workspace', () => {
    render(<McsWorkbench section="practice" />)
    fireEvent.click(screen.getByRole('button', { name: /Impella CP \/ 5\.5 \/ RP/i }))

    fireEvent.change(screen.getByRole('combobox', { name: /Left-sided Impella configuration/i }), {
      target: { value: '55' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /Right-sided Impella configuration/i }), {
      target: { value: 'rp' },
    })

    expect(screen.getByRole('group', { name: 'Impella 5.5' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Impella RP' })).toBeInTheDocument()
    expect(screen.getByText('LV PUMP FLOW')).toBeInTheDocument()
    expect(screen.getByText('RP PUMP FLOW')).toBeInTheDocument()
    expect(screen.getByText('RP − LEFT PUMP')).toBeInTheDocument()
    expect(screen.getByText(/5\.5 \+ RP · BIVENTRICULAR/i)).toBeInTheDocument()
    expect(screen.getByText(/never added directly to systemic flow/i)).toBeInTheDocument()
  })

  it('enforces inspect then predict then commit before adjustment', async () => {
    render(<McsWorkbench section="practice" />)
    fireEvent.click(screen.getByRole('button', { name: /Late deflation/i }))
    const deflation = screen.getByRole('slider', { name: /Deflation vs systole/i })
    expect(deflation).toBeDisabled()
    const commit = screen.getByRole('button', { name: /Commit prediction/i })
    expect(commit).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Arterial waveform/i }))
    fireEvent.click(
      screen.getByRole('radio', { name: /Late deflation raises effective LV afterload/i }),
    )
    expect(commit).toBeEnabled()
    fireEvent.click(commit)
    expect(await screen.findByRole('button', { name: /Prediction committed/i })).toBeDisabled()
    expect(screen.getByRole('slider', { name: /Deflation vs systole/i })).toBeEnabled()
    expect(screen.getByRole('slider', { name: /Preload/i })).toBeDisabled()
    expect(screen.getByText(/Prediction locked. Adjust the model/i)).toBeInTheDocument()
  })

  it('persists lesson completion locally and exposes all eight lessons', async () => {
    render(<McsWorkbench section="learn" />)
    const rail = screen.getByRole('region', { name: /Eight guided lessons/i })
    expect(within(rail).getAllByRole('button')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: /Mark lesson complete/i }))
    const saved = JSON.parse(window.localStorage.getItem(progressKey) ?? '{}')
    expect(saved.completedLessonIds).toContain('mcs-foundations-signals')
    expect(screen.getByRole('button', { name: /Lesson complete/i })).toBeInTheDocument()
  })

  it('keeps capstones locked until foundations, device lessons, and three mastered cases are present', async () => {
    const baseProgress = {
      version: 1,
      completedLessonIds: [],
      completedCaseIds: [],
      masteredCaseIds: [],
      completedCapstoneIds: [],
      bestScores: {},
      criticalErrorStatus: {},
      lastDevice: 'iabp',
      lastSection: 'assess',
      lastActivityId: null,
    }
    window.localStorage.setItem(progressKey, JSON.stringify(baseProgress))
    const { unmount } = render(<McsWorkbench section="assess" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Start capstone/i })).toBeDisabled(),
    )
    expect(screen.getByText(/7 requirements remain/i)).toBeInTheDocument()
    unmount()

    window.localStorage.setItem(
      progressKey,
      JSON.stringify({
        ...baseProgress,
        completedLessonIds: [
          'mcs-foundations-signals',
          'mcs-foundations-mechanisms',
          'iabp-timing-triggering',
          'iabp-efficacy-limits',
        ],
        masteredCaseIds: ['IABP-01', 'IABP-02', 'IABP-03'],
      }),
    )
    render(<McsWorkbench section="assess" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Start capstone/i })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: /Start capstone/i }))
    expect(screen.getByText(/coaching withheld/i)).toBeInTheDocument()
    expect(screen.getByText(/Causal coaching is withheld/i)).toBeInTheDocument()
  })

  it('sends only the allowlisted aggregate analytics payload', async () => {
    render(<McsWorkbench section="practice" />)
    await act(async () => Promise.resolve())
    const fetchMock = global.fetch as jest.Mock
    expect(fetchMock).toHaveBeenCalled()
    const payload = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string)
    expect(payload.moduleId).toBe('mechanical-circulatory-support')
    expect(payload.eventPayload).toEqual({
      deviceTrack: 'iabp',
      station: 'studio',
      completion: 'in-progress',
      scoreBand: 'not-scored',
    })
    expect(JSON.stringify(payload)).not.toMatch(
      /waveform|pressure|trace|actionIds|presentation|freeText|mapMmHg|pcwp/i,
    )
  })

  it('shows the reviewed-English fallback on non-English routes', () => {
    render(<McsWorkbench section="learn" locale="es" />)
    expect(screen.getByText(/Reviewed-English fallback/i)).toBeInTheDocument()
  })
})
