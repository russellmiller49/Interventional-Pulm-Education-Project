import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { getCriticalCareResumeTarget } from '@/features/critical-care/progress'
import { mcsCapstoneScenarios, mcsSources } from '../content'

const mockRouterPush = jest.fn()

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
  useRouter: () => ({ push: mockRouterPush }),
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
    mockRouterPush.mockReset()
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
    ['lvad', /Durable continuous-flow LVAD/i, /Durable LVAD parameters and ICU review/i],
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

  it('opens an exact practice deep link and exposes it through global Continue', async () => {
    const { container } = render(<McsWorkbench section="practice" initialActivityId="IMP-02" />)

    expect(container.querySelector('[data-critical-care-activity-shell]')).toBeInTheDocument()
    const sharedPhases = screen.getByRole('group', { name: 'MCS shared activity phases' })
    for (const label of ['Recognize', 'Predict', 'Act', 'Observe', 'Explain', 'Transfer']) {
      expect(within(sharedPhases).getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /Impella CP \/ 5\.5 \/ RP/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Placement signal/i })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/mechanical-circulatory-support/practice?case=IMP-02',
      ),
    )
  })

  it('selects an exact Challenge track and keeps it open from the start', async () => {
    render(<McsWorkbench section="assess" initialActivityId="CAP-IMP-01" />)

    expect(screen.getByRole('button', { name: /Impella CP \/ 5\.5 \/ RP/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getAllByText('Advanced Impella effective-flow challenge').length).toBeGreaterThan(
      1,
    )
    const feedbackToggle = screen.getByRole('checkbox', {
      name: /Show teaching notes after each action/i,
    })
    expect(feedbackToggle).not.toBeChecked()
    expect(screen.getByText('Routine teaching deferred')).toBeInTheDocument()
    expect(screen.getByText(/Why the display changed/i)).toBeInTheDocument()
    fireEvent.click(feedbackToggle)
    expect(screen.getByText('Simulation response')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Open challenge/i })).toBeEnabled(),
    )
    expect(getCriticalCareResumeTarget(window.localStorage)).toBeNull()
  })

  it('defers causal coaching in a Challenge until opt-in when no critical alarm is active', () => {
    render(<McsWorkbench section="assess" initialActivityId="CAP-IABP-01" />)

    expect(screen.getByText(/Causal coaching is withheld/i)).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Show teaching notes after each action/i,
      }),
    )
    expect(screen.getByText(/Why the display changed/i)).toBeInTheDocument()
  })

  it('renders the safety boundary, synchronized accessible traces, and required hemodynamics', () => {
    render(<McsWorkbench section="practice" />)
    expect(screen.getByText(/Educational model—not a clinical device/i)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: /Synchronized mechanical-support bedside monitor/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ECG II waveform/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ART waveform/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /pressure-volume loop/i })).toBeInTheDocument()
    const metrics = screen.getByRole('group', { name: /Current hemodynamic values/i })
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
    const derivedGuide = screen.getByRole('region', {
      name: /PAPi and cardiac power interpretation/i,
    })
    expect(within(derivedGuide).getByText(/No universal normal interval exists/i)).toBeVisible()
    expect(
      within(derivedGuide).getByText(/No universal normal interval or treatment target/i),
    ).toBeVisible()
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

  it('keeps permitted controls open while preserving an optional initial frame', async () => {
    render(<McsWorkbench section="practice" />)
    fireEvent.click(screen.getByRole('button', { name: /Late deflation/i }))
    const deflation = screen.getByRole('slider', { name: /Deflation vs systole/i })
    expect(deflation).toBeEnabled()
    const commit = screen.getByRole('button', { name: /Record initial frame/i })
    expect(commit).toBeDisabled()
    fireEvent.click(
      screen.getByRole('radio', { name: /Late deflation raises effective LV afterload/i }),
    )
    expect(commit).toBeEnabled()
    fireEvent.click(commit)
    expect(await screen.findByRole('button', { name: /Prediction committed/i })).toBeDisabled()
    expect(screen.getByRole('slider', { name: /Deflation vs systole/i })).toBeEnabled()
    expect(screen.getByRole('slider', { name: /Preload/i })).toBeDisabled()
    expect(screen.getByText(/Initial frame recorded. Adjust the model/i)).toBeInTheDocument()
    const lifecyclePayloads = (global.fetch as jest.Mock).mock.calls.map(([, request]) =>
      JSON.parse(request.body as string),
    )
    expect(lifecyclePayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleId: 'critical-care',
          eventPayload: expect.objectContaining({
            interaction: 'critical_care_prediction_submitted',
            moduleId: 'mechanical-circulatory-support',
          }),
        }),
      ]),
    )
  })

  it('keeps a revealed case debrief at Explain without emitting transfer completion', async () => {
    render(<McsWorkbench section="practice" />)
    fireEvent.click(screen.getByRole('button', { name: /Late deflation/i }))
    fireEvent.click(screen.getByRole('button', { name: /Arterial waveform/i }))
    fireEvent.click(
      screen.getByRole('radio', { name: /Late deflation raises effective LV afterload/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Record initial frame/i }))
    fireEvent.change(screen.getByRole('slider', { name: /Deflation vs systole/i }), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reassess response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open causal debrief' }))

    expect(await screen.findByRole('heading', { name: /Causal debrief/i })).toBeInTheDocument()
    const phases = screen.getByRole('group', { name: 'MCS shared activity phases' })
    expect(within(phases).getByText('Explain').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(within(phases).getByText('Transfer').closest('li')).not.toHaveAttribute('aria-current')

    const lifecycleInteractions = (global.fetch as jest.Mock).mock.calls
      .map(([, request]) => JSON.parse(request.body as string))
      .map((payload) => payload.eventPayload?.interaction)
    expect(lifecycleInteractions).not.toContain('critical_care_transfer_completed')
  })

  it('requires authored interactions and a transfer decision before lesson completion', async () => {
    render(<McsWorkbench section="learn" />)
    const rail = screen.getByRole('region', { name: /Eight guided lessons/i })
    expect(within(rail).getAllByRole('button')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: /Mark lesson complete/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Inspect arterial waveform' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to next step' }))
    expect(screen.getByRole('heading', { name: 'Read both ventricles' })).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect filling pressures and RV delivery' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue to next step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Inspect device and effective flow' }))
    fireEvent.click(screen.getByRole('button', { name: 'Load transfer patient' }))

    expect(
      screen.getByRole('heading', {
        name: /Transfer after transport: plausible pressure, falling perfusion/i,
      }),
    ).toBeInTheDocument()
    expect(
      JSON.parse(window.localStorage.getItem(progressKey) ?? '{}').completedLessonIds ?? [],
    ).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Inspect arterial waveform' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect filling pressures and RV delivery' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Inspect device and effective flow' }))
    fireEvent.click(
      screen.getByRole('radio', {
        name: /Reassess the patient, validate the pressure signal/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Check transfer decision' }))

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(progressKey) ?? '{}')
      expect(saved.completedLessonIds).toContain('mcs-foundations-signals')
    })
    expect(screen.getByText('Evidence complete')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Continue to next lesson Unloading, augmentation, and total flow/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Recheck transfer evidence/i }),
    ).not.toBeInTheDocument()
  })

  it('continues from completed Impella transfer evidence to the next Impella lesson', async () => {
    render(<McsWorkbench section="learn" initialDevice="impella" />)

    fireEvent.change(screen.getByRole('combobox', { name: /Left-sided Impella configuration/i }), {
      target: { value: '55' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to next step' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Performance level' }), {
      target: { value: '6' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to next step' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Placement state' }), {
      target: { value: 'too-deep' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to next step' }))
    fireEvent.change(screen.getByRole('slider', { name: 'SVR' }), {
      target: { value: '1950' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load transfer patient' }))
    fireEvent.click(screen.getByRole('button', { name: 'Inspect device and effective flow' }))
    fireEvent.click(
      screen.getByRole('radio', {
        name: /The pump is pressure-gradient dependent/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Check transfer decision' }))

    const continueButton = await screen.findByRole('button', {
      name: /Continue to next lesson Impella suction, purge, hemolysis, and RV delivery/i,
    })
    expect(screen.getByRole('region', { name: 'Lesson worked through' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Recheck transfer evidence/i })).toBeNull()

    fireEvent.click(continueButton)
    expect(
      screen.getByRole('heading', {
        name: 'Impella suction, purge, hemolysis, and RV delivery',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Build RP and BiPella support' }),
    ).toBeInTheDocument()
  })

  it('keeps capstones open, named, and source-visible regardless of local history', async () => {
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
    render(<McsWorkbench section="assess" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Open challenge/i })).toBeEnabled(),
    )
    const capstone = mcsCapstoneScenarios.find((item) => item.device === 'iabp')!
    expect(screen.getByText(capstone.title)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Open challenge/i }))
    expect(screen.getAllByRole('heading', { name: capstone.title })).not.toHaveLength(0)
    for (const objective of capstone.learningObjectives) {
      expect(screen.getAllByText(objective)).not.toHaveLength(0)
    }

    fireEvent.click(screen.getByRole('button', { name: 'Evidence' }))
    const evidenceDrawer = await screen.findByRole('dialog')
    expect(within(evidenceDrawer).getByText('Evidence and model limits')).toBeInTheDocument()
    const caseOnlySource = mcsSources.find((source) =>
      capstone.evidenceSourceIds.includes(source.id),
    )
    if (caseOnlySource) {
      expect(within(evidenceDrawer).getByText(caseOnlySource.title)).toBeInTheDocument()
    }
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
