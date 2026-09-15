import { mcsPresentationTitle } from '../content/casePresentation'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { getCriticalCareResumeTarget } from '@/features/critical-care/progress'
import {
  MCS_RECOMMENDED_FIRST_SECTION_ID,
  mcsCapstoneScenarios,
  mcsPracticeScenarios,
  mcsDeviceProfiles,
  mcsSources,
  mcsSupportPathwayCards,
} from '../content'

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
 * highlight targets a case points at, and stubbing it away would let a case point at a region that
 * does not render.
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

/**
 * Renders the hub and lets its deferred reads land.
 *
 * The Continue call to action and the pathway accordion read stored progress in a `setTimeout(0)`,
 * so a resolved promise is not enough: the macrotask has to run before the CTA is resolved.
 */
async function renderHub() {
  const view = render(<McsHub />)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
  return view
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

  it('links each device reference card to that device track, which opens on its first section', async () => {
    const { container } = await renderHub()
    const devices = container.querySelector('[data-reference="devices"]')
    expect(devices).not.toBeNull()

    for (const profile of mcsDeviceProfiles) {
      const card = within(devices as HTMLElement)
        .getByRole('heading', { name: profile.displayName })
        .closest('article')
      expect(card).not.toBeNull()
      expect(
        within(card!).getByRole('link', { name: /Open the first section on this device/i }),
      ).toHaveAttribute('href', `/mechanical-circulatory-support/learn?device=${profile.kind}`)
    }
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
    expect(
      screen.getByRole('button', {
        name: new RegExp(
          mcsPresentationTitle(mcsPracticeScenarios.find((s) => s.id === 'IMP-02')!),
        ),
      }),
    ).toHaveAttribute('aria-current', 'true')
    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/mechanical-circulatory-support/practice?case=IMP-02',
      ),
    )
  })

  it('selects the exact integrated-case device and opens its teaching immediately', async () => {
    render(<McsWorkbench section="assess" initialActivityId="CAP-IMP-01" />)
    expect(screen.getByRole('button', { name: /Impella CP \/ 5\.5 \/ RP/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const scenario = mcsCapstoneScenarios.find((s) => s.id === 'CAP-IMP-01')!
    expect(
      screen.getByRole('heading', { name: mcsPresentationTitle(scenario), level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Why the display changed/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/mechanical-circulatory-support/assess?case=CAP-IMP-01',
      ),
    )
  })

  it('offers causal teaching before any answer in an integrated case', () => {
    render(<McsWorkbench section="assess" initialActivityId="CAP-IABP-01" />)
    expect(screen.getByText(/Why the display changed/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(screen.getByText('No actions performed.')).toBeInTheDocument()
  })

  it('renders the safety boundary, synchronized accessible traces, and required hemodynamics', () => {
    render(<McsWorkbench section="practice" initialDevice="iabp" />)
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
    render(<McsWorkbench section="practice" initialDevice="iabp" />)
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

  it('compares an optional prediction without locking patient or device controls or reporting it', () => {
    render(<McsWorkbench section="practice" initialActivityId="IABP-01" />)
    const compare = screen.getByRole('button', { name: 'Compare prediction' })
    expect(compare).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Deflation vs systole' })).toBeEnabled()
    fireEvent.click(
      screen.getByRole('radio', { name: /Late deflation raises effective LV afterload/i }),
    )
    fireEvent.click(compare)
    expect(screen.getByText('Prediction explanation')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Preload' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Try prediction again' }))
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(0)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('keeps a revealed case debrief at Explain without emitting transfer completion', async () => {
    render(<McsWorkbench section="practice" initialDevice="iabp" />)
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(
          mcsPresentationTitle(mcsPracticeScenarios.find((s) => s.id === 'IABP-01')!),
        ),
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Arterial waveform/i }))
    fireEvent.click(
      screen.getByRole('radio', { name: /Late deflation raises effective LV afterload/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Compare prediction/i }))
    fireEvent.change(screen.getByRole('slider', { name: /Deflation vs systole/i }), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reassess response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open worked explanation' }))

    expect(
      await screen.findByRole('heading', { name: /Worked case explanation/i }),
    ).toBeInTheDocument()
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
      expect(screen.getByRole('button', { name: /Open integrated case/i })).toBeEnabled(),
    )
    const capstone = mcsCapstoneScenarios.find((item) => item.device === 'iabp')!
    expect(screen.getByText(mcsPresentationTitle(capstone))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Open integrated case/i }))
    expect(
      screen.getAllByRole('heading', { name: mcsPresentationTitle(capstone) }),
    ).not.toHaveLength(0)
    expect(
      within(document.querySelector('[data-case-identity]') as HTMLElement).getByText(
        capstone.learningObjectives[0],
      ),
    ).toBeInTheDocument()

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

  it('emits no activity, grading or assistance analytics', async () => {
    render(<McsWorkbench section="practice" initialDevice="iabp" />)
    await act(async () => Promise.resolve())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows the reviewed-English fallback on non-English routes', () => {
    render(<McsWorkbench section="practice" locale="es" />)
    expect(screen.getByText(/Reviewed-English fallback/i)).toBeInTheDocument()
  })

  describe('the module front door (M0/M1)', () => {
    function precedesInDocument(first: Element, second: Element): boolean {
      return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
    }

    it('opens on one Continue that resolves to the recommended first section, and locks nothing', async () => {
      const { container } = await renderHub()
      const cta = container.querySelector('[data-mcs-continue]')
      expect(cta).toHaveAttribute('data-mcs-continue', 'resolved')
      expect(cta).toHaveAttribute(
        'href',
        `/mechanical-circulatory-support/learn?lesson=${MCS_RECOMMENDED_FIRST_SECTION_ID}`,
      )
      expect(container.querySelectorAll('[data-mcs-continue]')).toHaveLength(1)
      // Every section is its own link from the map, and no gate exists anywhere on the door.
      expect(
        container.querySelectorAll('[data-pathway-accordion] [data-kind="section"] a'),
      ).toHaveLength(9)
      expect(container.querySelector('[data-locked="true"]')).toBeNull()
      expect(container.querySelectorAll('a[aria-disabled="true"]')).toHaveLength(0)
    })

    it('keeps the common model ahead of the device cards in the reference block', async () => {
      const { container } = await renderHub()
      const model = container.querySelector('[data-reference="common-model"]')
      const devices = container.querySelector('[data-reference="devices"]')
      expect(model).not.toBeNull()
      expect(devices).not.toBeNull()
      expect(model!.querySelector('[data-mcs-common-model="root"]')).not.toBeNull()
      expect(precedesInDocument(model!, devices!)).toBe(true)
    })

    it('carries all four levels, all three flow lines, and the additivity warning in the model', async () => {
      const { container } = await renderHub()
      const model = container.querySelector('[data-reference="common-model"]') as HTMLElement

      for (const level of ['Pressure', 'Flow', 'Oxygen delivery', 'Organ response']) {
        expect(
          within(
            model.querySelector('[data-mcs-common-model="causal-ladder"]') as HTMLElement,
          ).getByText(level),
        ).toBeInTheDocument()
      }
      const account = model.querySelector('[data-mcs-common-model="flow-account"]') as HTMLElement
      for (const line of ['native', 'device-displayed', 'effective-systemic']) {
        expect(account.querySelector(`[data-flow-line="${line}"]`)).not.toBeNull()
      }
      expect(model.querySelector('[data-mcs-common-model="additivity-warning"]')).not.toBeNull()
      expect(within(model).getByText(/not automatically additive/i)).toBeInTheDocument()
      // Seven questions, in order, before anything device-specific.
      expect(
        model.querySelectorAll('[data-mcs-common-model="questions"] [data-question-order]'),
      ).toHaveLength(7)
    })

    it('carries the standardized pathway cards, every field on every card', async () => {
      const { container } = await renderHub()
      const cards = container.querySelectorAll('[data-reference="pathways"] [data-pathway-id]')
      expect(cards).toHaveLength(mcsSupportPathwayCards.length)
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
    })

    it('keeps the release checklist behind a reviewer layer and the preview warning in front', async () => {
      const { container } = await renderHub()
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
  })
})
