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
/*
 * The WebGL canvas is stubbed, but the authored pathway summary is not: it carries the anatomy
 * highlight targets a Learn section points at, and stubbing it away would let a section point at a
 * region that does not render.
 */
jest.mock('../components/McsAnatomy3D', () => {
  const { McsAnatomyPathwaySummary } = jest.requireActual<
    typeof import('../components/McsAnatomyPathwaySummary')
  >('../components/McsAnatomyPathwaySummary')
  return {
    McsAnatomy3D: ({
      revealCausality = true,
      state,
      highlightTarget,
    }: {
      revealCausality?: boolean
      state: Parameters<typeof McsAnatomyPathwaySummary>[0]['state']
      highlightTarget?: Parameters<typeof McsAnatomyPathwaySummary>[0]['highlightTarget']
    }) => (
      <section aria-label="Animated mechanical-support anatomy">
        3D mechanism · coaching {revealCausality ? 'visible' : 'withheld'}
        <McsAnatomyPathwaySummary state={state} highlightTarget={highlightTarget} />
      </section>
    ),
  }
})
jest.mock('../components/EcmoCannulationPreview', () => ({
  EcmoCannulationPreview: () => <div>ECMO preview</div>,
}))
jest.mock('../components/ImpellaVariantPreview', () => ({
  ImpellaVariantPreview: () => <div>Impella preview</div>,
}))

import { McsHub } from '../components/McsHub'
import { McsWorkbench } from '../components/McsWorkbench'

const progressKey = 'interventionalpulm:mcs-progress:v1'

function savedLessonIds(): readonly string[] {
  return JSON.parse(window.localStorage.getItem(progressKey) ?? '{}').completedLessonIds ?? []
}

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

  // Learn shows the ordered pathway rail instead of the device tabs, so a device deep link is
  // expressed as the pathway section it opens.
  it.each([
    ['impella', /^5\. Impella unloading and placement signals/i],
    ['lvad', /^7\. Durable LVAD parameters and ICU review/i],
  ] as const)('initializes the %s track at its first device section', (device, sectionName) => {
    render(<McsWorkbench section="learn" initialDevice={device} />)

    expect(
      screen.queryByRole('navigation', { name: /Choose device track/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: sectionName })).toHaveAttribute(
      'aria-current',
      'step',
    )
  })

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

  it('walks a Learn section through all six phases before it is recorded', async () => {
    render(<McsWorkbench section="learn" />)
    const rail = screen.getByRole('navigation', { name: /MCS learning pathway sections/i })
    // Eight device sections plus the cross-device integration capstone (WP10 §5.3).
    expect(within(rail).getAllByRole('button')).toHaveLength(9)
    expect(screen.queryByRole('button', { name: /Mark lesson complete/i })).not.toBeInTheDocument()

    // Recognize.
    fireEvent.click(screen.getByRole('radio', { name: /The displayed device contribution/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))
    expect(savedLessonIds()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /Continue to the prediction/i }))

    // Predict: committing shows the verdict and does not advance on its own.
    fireEvent.click(
      screen.getByRole('radio', { name: /A native contribution, an effective systemic delivery/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))
    expect(screen.getByText(/That read holds/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Predict — step 2 of 6$/ })).toBeInTheDocument()
    expect(savedLessonIds()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /Continue to the task/i }))

    // Act: this section is inspect-only and says so.
    expect(screen.getByText(/No adjustment is expected in this section/i)).toBeInTheDocument()
    for (const label of [
      'Read the arterial pressure',
      'Read the filling pressures and right-sided delivery',
      'Read the device and effective flow',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
    expect(savedLessonIds()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /Continue to what changed/i }))

    // Observe reads from the resulting live state. The learner-action pane's own comparison, which
    // is the one this phase is built around — the teaching pane now carries a second, richer
    // comparison of its own, so the query names the table it means.
    const beforeAfter = document.querySelector<HTMLElement>('[data-before-after]')!
    expect(beforeAfter).not.toBeNull()
    expect(within(beforeAfter).getByText('Effective systemic delivery')).toBeInTheDocument()
    expect(within(beforeAfter).getByText('Displayed device contribution')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continue to the explanation/i }))

    // Explain connects the ladder and names what the section does not establish.
    expect(screen.getByText('This does not establish')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continue to the transfer patient/i }))

    // Transfer: a response and the paired live work are both required.
    expect(savedLessonIds()).toEqual([])
    fireEvent.click(
      screen.getByRole('radio', { name: /Reassess the patient, validate the pressure signal/i }),
    )
    expect(screen.getByRole('button', { name: 'Commit this transfer answer' })).toBeDisabled()
    for (const label of [
      'Read the arterial pressure',
      'Read the filling pressures and right-sided delivery',
      'Read the device and effective flow',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Commit this transfer answer' }))

    await waitFor(() => expect(savedLessonIds()).toContain('mcs-foundations-signals'))
    expect(screen.getByRole('region', { name: 'Section worked through' })).toBeInTheDocument()
    expect(screen.getByText(/records participation in an educational module/i)).toBeInTheDocument()
  })

  it('continues from a worked-through Impella section to the next Impella section', async () => {
    render(<McsWorkbench section="learn" initialDevice="impella" />)

    fireEvent.click(screen.getByRole('radio', { name: /The left ventricle is relieved directly/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Record what you identified' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the prediction/i }))
    fireEvent.click(screen.getByRole('radio', { name: /Displayed pump flow falls by about half/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit this answer' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the task/i }))

    // The adjustment phase points at one real control, and Continue waits for it.
    expect(screen.getByRole('button', { name: /Continue to what changed/i })).toBeDisabled()
    fireEvent.change(screen.getByRole('combobox', { name: 'Placement state' }), {
      target: { value: 'too-deep' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue to what changed/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the explanation/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue to the transfer patient/i }))

    fireEvent.click(screen.getByRole('radio', { name: /The pump is pressure-gradient dependent/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Read the device and effective flow' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit this transfer answer' }))

    const continueButton = await screen.findByRole('button', {
      name: /Continue to the next section: Impella suction, purge, hemolysis, and RV delivery/i,
    })
    fireEvent.click(continueButton)
    expect(
      screen.getAllByRole('heading', {
        name: 'Impella suction, purge, hemolysis, and RV delivery',
      }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/where a right-sided pump returns the blood it draws/i).length,
    ).toBeGreaterThan(0)
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

  describe('the common model comes before the device-specific controls (M0/M1)', () => {
    function precedesInDocument(first: Element, second: Element): boolean {
      return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
    }

    it('carries the model in the teaching pane, after the live surface and before the task', () => {
      const { container } = render(<McsWorkbench section="learn" />)

      const model = container.querySelector('[data-mcs-common-model="root"]')
      expect(model).not.toBeNull()

      // Pane order is primary surface → teaching → learner action, and the model sits in the
      // teaching pane rather than above a simulator that no longer exists on this surface.
      const primary = screen.getByRole('region', { name: /Live monitor panel/i })
      const teaching = screen.getByRole('region', { name: /Teaching panel/i })
      const action = screen.getByRole('region', { name: /Your turn panel/i })
      expect(precedesInDocument(primary, teaching)).toBe(true)
      expect(precedesInDocument(teaching, action)).toBe(true)
      expect(teaching.contains(model)).toBe(true)

      // The device-specific controls are not on this surface at all until the act phase asks for
      // them, so the model cannot be buried beneath them.
      expect(
        screen.queryByRole('region', { name: /Patient and mechanical-support controls/i }),
      ).not.toBeInTheDocument()
    })

    it('shows all four levels, all three flow lines, and the additivity warning', () => {
      const { container } = render(<McsWorkbench section="learn" />)

      for (const level of ['Pressure', 'Flow', 'Oxygen delivery', 'Organ response']) {
        expect(
          within(
            container.querySelector('[data-mcs-common-model="causal-ladder"]') as HTMLElement,
          ).getByText(level),
        ).toBeInTheDocument()
      }
      const account = container.querySelector(
        '[data-mcs-common-model="flow-account"]',
      ) as HTMLElement
      for (const line of ['native', 'device-displayed', 'effective-systemic']) {
        expect(account.querySelector(`[data-flow-line="${line}"]`)).not.toBeNull()
      }
      expect(container.querySelector('[data-mcs-common-model="additivity-warning"]')).not.toBeNull()
      // Counterpulsation reports no flow, so the displayed-device line must not be labelled an
      // estimate — that would give a number that does not exist a provenance it cannot have.
      expect(
        account
          .querySelector('[data-flow-line="device-displayed"] [data-value-type]')
          ?.getAttribute('data-value-type'),
      ).toBe('no device flow reported')
      expect(
        account
          .querySelector('[data-flow-line="effective-systemic"] [data-value-type]')
          ?.getAttribute('data-value-type'),
      ).toBe('inferred')
      expect(screen.getByText(/not automatically additive/i)).toBeInTheDocument()
      // Seven questions, in order, before anything device-specific.
      expect(
        container.querySelectorAll('[data-mcs-common-model="questions"] [data-question-order]'),
      ).toHaveLength(7)
    })

    it('carries the standardized pathway cards on the mechanisms section only', () => {
      const { container, unmount } = render(<McsWorkbench section="learn" />)
      expect(container.querySelector('[data-mcs-pathway-cards]')).toBeNull()
      unmount()

      const mechanisms = render(
        <McsWorkbench section="learn" initialActivityId="mcs-foundations-mechanisms" />,
      )
      const cards = mechanisms.container.querySelectorAll('[data-pathway-id]')
      expect(cards).toHaveLength(8)
      // Every card answers the same fields, so the same field markers appear on each one.
      for (const card of Array.from(cards)) {
        for (const field of [
          'bloodEntersFrom',
          'bloodReturnsTo',
          'mechanism',
          'flowPattern',
          'chamberPrimarilyUnloaded',
          'chamberOrBedPotentiallyLoaded',
          'preloadRequirements',
          'constraints',
          'gasExchange',
          'displayedFlow',
          'lowFlowDifferential',
          'firstUnsafeReflex',
          'supportRole',
          'bridgeExitBoundary',
        ]) {
          expect(card.querySelector(`[data-field="${field}"]`)).not.toBeNull()
        }
        expect(card.querySelector('[data-not-a-target]')).not.toBeNull()
      }
      mechanisms.unmount()
    })

    it('leaves the model out of the device-specific sections', () => {
      const { container } = render(
        <McsWorkbench section="learn" initialActivityId="iabp-timing-triggering" />,
      )
      expect(container.querySelector('[data-mcs-common-model="root"]')).toBeNull()
      expect(container.querySelector('[data-mcs-pathway-cards]')).toBeNull()
    })
  })

  describe('the module front door (M0/M1)', () => {
    it('states the recommended first section without locking any other', async () => {
      await act(async () => {
        render(<McsHub />)
      })
      expect(
        screen.getByRole('link', { name: /Open the recommended first section/i }),
      ).toHaveAttribute(
        'href',
        '/mechanical-circulatory-support/learn?lesson=mcs-foundations-signals',
      )
      // Every device track link stays open from the front door.
      expect(screen.getAllByRole('link', { name: /Enter track/i })).toHaveLength(3)
    })

    it('puts the common model before the product tracks', async () => {
      let container!: HTMLElement
      await act(async () => {
        container = render(<McsHub />).container
      })
      const model = container.querySelector('[data-mcs-common-model="root"]')
      const tracks = screen
        .getByRole('heading', { name: /See what the device moves/i })
        .closest('section')
      expect(model).not.toBeNull()
      expect(tracks).not.toBeNull()
      expect(
        Boolean(model!.compareDocumentPosition(tracks!) & Node.DOCUMENT_POSITION_FOLLOWING),
      ).toBe(true)
    })

    it('keeps the release checklist behind a reviewer layer and the preview warning in front', async () => {
      let container!: HTMLElement
      await act(async () => {
        container = render(<McsHub />).container
      })
      const governance = container.querySelector('[data-review-governance]')
      expect(governance).not.toBeNull()
      // The warning a learner must see is not inside the collapsed layer.
      const warning = within(governance as HTMLElement).getByText(
        /bounded teaching approximations/i,
      )
      expect(warning.closest('details')).toBeNull()
      // The gate list is.
      const reviewerLayer = governance!.querySelector('[data-reviewer-layer]')
      expect(reviewerLayer).not.toBeNull()
      expect(reviewerLayer!.querySelectorAll('li').length).toBeGreaterThan(0)
      expect(
        within(reviewerLayer as HTMLElement).getByText(/Publication awaits review/i),
      ).toBeInTheDocument()
    })

    it('derives the track counts instead of writing them down', async () => {
      await act(async () => {
        render(<McsHub />)
      })
      // Two device sections, three practice cases, one harder case per track — derived, so the
      // hand-written "2 device lessons" cannot drift from the arrays again.
      expect(screen.getAllByText('2 device sections')).toHaveLength(3)
      expect(screen.getAllByText('3 cases')).toHaveLength(3)
      expect(screen.getAllByText('1 harder case')).toHaveLength(3)
    })
  })
})
