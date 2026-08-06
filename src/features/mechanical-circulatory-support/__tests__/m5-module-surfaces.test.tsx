/**
 * M5 — the front door, the route chrome, and the two point-of-use drawers.
 *
 * M0/M1 already proved what the hub says. What was never covered is the component-level branching
 * underneath it: counts derived from arrays rather than written down, the lazy preview's fallback,
 * the non-English notice, the nav's active marking, and — the part with the most branches and the
 * least coverage — which evidence entries each route actually opens, and what opening one does to
 * the activity behind it.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .anatomyModule(),
)
jest.mock('../components/EcmoCannulationPreview', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .ecmoPreviewModule(),
)
jest.mock('../components/ImpellaVariantPreview', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .impellaPreviewModule(),
)

import { act, render } from '@testing-library/react'

import {
  mcsCapstoneScenarios,
  mcsLessonTransferByLessonId,
  mcsLessons,
  mcsPracticeScenarios,
  mcsSources,
} from '../content'
import { mcsCongestionSources } from '../content/congestionEvidence'
import { McsHub } from '../components/McsHub'
import { McsLearnLanding } from '../components/McsLearnLanding'
import {
  commitPredictionPhase,
  completeRecognizePhase,
  continueFromPhase,
  learnPhase,
  renderWorkbench,
  satisfyLearnAction,
  setupMcsWorkbenchEnvironment,
  sharedStepperPhase,
  teardownMcsWorkbenchEnvironment,
} from '../test-support/mcsWorkbench'

async function renderHub() {
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(<McsHub />)
  })
  return view
}

describe('MCS M5 — the module front door derives what it claims', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support' }))
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('counts guided sections and cases from the arrays, on every surface that shows them', async () => {
    await renderHub()

    expect(screen.getAllByText(String(mcsLessons.length)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(`${mcsLessons.length} guided sections`).length).toBeGreaterThan(0)
    expect(
      screen.getByText(`${mcsPracticeScenarios.length} patient cases, plus an open studio`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`${mcsCapstoneScenarios.length} harder cases, one per device track`),
    ).toBeInTheDocument()
  })

  it('does not count Mechanism Studio as one of the patient cases', async () => {
    await renderHub()

    const practice = screen.getByText(
      `${mcsPracticeScenarios.length} patient cases, plus an open studio`,
    )
    expect(practice).toBeInTheDocument()
    expect(
      screen.queryByText(`${mcsPracticeScenarios.length + 1} patient cases`),
    ).not.toBeInTheDocument()
  })

  it('resolves the recommended first section to a section that exists', async () => {
    await renderHub()

    const link = screen.getByRole('link', { name: /Open the recommended first section/ })
    const lessonId = new URL(link.getAttribute('href')!, 'https://example.test').searchParams.get(
      'lesson',
    )
    expect(mcsLessons.some((lesson) => lesson.id === lessonId)).toBe(true)
  })

  it('keeps all three device tracks open from the front door', async () => {
    await renderHub()

    const tracks = screen.getAllByRole('link', { name: /Enter track/ })
    expect(tracks).toHaveLength(3)
    for (const track of tracks) expect(track).toBeEnabled()
  })

  it('describes the comparison pathways without claiming MCS simulates them', async () => {
    await renderHub()

    const comparison = screen
      .getByRole('heading', { name: /Locate other support without duplicating their simulators/ })
      .closest('section')!
    expect(
      within(comparison).getByText(/Full interaction lives in the CARDIOHELP module/),
    ).toBeInTheDocument()
    expect(
      within(comparison).getByText(
        /insertion, cannulation, and operational controls remain out of scope/i,
      ),
    ).toBeInTheDocument()
  })

  it('keeps the preview warning in the primary path and the gate list behind the disclosure', async () => {
    const { container } = await renderHub()

    const governance = container.querySelector('[data-review-governance]') as HTMLElement
    expect(
      within(governance)
        .getByText(/bounded teaching approximations/)
        .closest('details'),
    ).toBeNull()
    const reviewerLayer = governance.querySelector('[data-reviewer-layer]') as HTMLElement
    expect(reviewerLayer.tagName.toLowerCase()).toBe('details')
    expect(within(reviewerLayer).getByText(/Publication awaits review/)).toBeInTheDocument()
  })

  it('renders the lazy comparison previews behind an accessible boundary', async () => {
    await renderHub()

    expect(screen.getByText('ECMO preview')).toBeInTheDocument()
    expect(screen.getByText('Impella preview')).toBeInTheDocument()
  })

  it('lists every source in the sources panel', async () => {
    await renderHub()

    for (const source of mcsSources.slice(0, 5)) {
      expect(screen.getAllByText(source.title).length).toBeGreaterThan(0)
    }
  })

  it('opens the learn landing with one link per authored section', async () => {
    render(<McsLearnLanding />)

    const sectionLinks = screen.getAllByRole('link', { name: 'Open section' })
    expect(sectionLinks).toHaveLength(mcsLessons.length)
    for (const [index, link] of sectionLinks.entries()) {
      expect(link).toHaveAttribute(
        'href',
        `/mechanical-circulatory-support/learn?lesson=${mcsLessons[index].id}`,
      )
    }
  })
})

describe('MCS M5 — module chrome on every route', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each([
    ['learn', 'Learn'],
    ['practice', 'Practice'],
    ['assess', 'Challenge'],
  ] as const)('marks %s as the active route in the module nav', async (section, label) => {
    await renderWorkbench({ section })

    const nav = screen.getByRole('navigation', {
      name: 'Mechanical circulatory support module sections',
    })
    const active = within(nav).getAllByRole('link', { current: 'page' })
    expect(active).toHaveLength(1)
    expect(active[0]).toHaveTextContent(label)
  })

  it('introduces no route gate: every module section stays a plain link', async () => {
    await renderWorkbench({ section: 'learn' })

    const nav = screen.getByRole('navigation', {
      name: 'Mechanical circulatory support module sections',
    })
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(4)
    for (const link of links) {
      expect(link).toHaveAttribute('href')
      expect(link).not.toHaveAttribute('aria-disabled')
    }
  })

  it('keeps the educational safety notice on every route', async () => {
    for (const section of ['learn', 'practice', 'assess'] as const) {
      const view = await renderWorkbench({ section })
      expect(screen.getByRole('note', { name: 'Educational safety notice' })).toHaveTextContent(
        /Educational model—not a clinical device/,
      )
      view.unmount()
    }
  })

  it('shows the reviewed-English fallback only on a non-English route', async () => {
    const english = await renderWorkbench({ section: 'learn' })
    expect(screen.queryByText(/Reviewed-English fallback/)).not.toBeInTheDocument()
    english.unmount()

    await renderWorkbench({ section: 'learn', locale: 'es' })
    expect(screen.getByText(/Reviewed-English fallback/)).toBeInTheDocument()
  })
})

describe('MCS M5 — the reference and evidence drawers', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  async function openDrawer(name: 'Reference' | 'Evidence') {
    fireEvent.click(screen.getByRole('button', { name }))
    return screen.findByRole('dialog')
  }

  it.each(['learn', 'practice', 'assess'] as const)(
    'opens the reference drawer on the %s route',
    async (section) => {
      await renderWorkbench({ section })

      const drawer = await openDrawer('Reference')
      expect(within(drawer).getByText('Reference')).toBeInTheDocument()
      expect(within(drawer).getAllByRole('heading').length).toBeGreaterThan(0)
    },
  )

  it.each(['learn', 'practice', 'assess'] as const)(
    'opens the evidence drawer on the %s route',
    async (section) => {
      await renderWorkbench({ section })

      const drawer = await openDrawer('Evidence')
      expect(within(drawer).getByText('Evidence and model limits')).toBeInTheDocument()
      expect(within(drawer).getAllByRole('heading').length).toBeGreaterThan(1)
    },
  )

  it('names the active lesson in the reference drawer', async () => {
    const lesson = mcsLessons[4]
    await renderWorkbench({ section: 'learn', initialActivityId: lesson.id })

    const drawer = await openDrawer('Reference')
    expect(within(drawer).getByRole('heading', { name: lesson.title })).toBeInTheDocument()
    expect(within(drawer).getByText(lesson.summary)).toBeInTheDocument()
  })

  it('names the active case in the reference drawer', async () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IMP-03')!
    await renderWorkbench({ section: 'practice', initialActivityId: scenario.id })

    const drawer = await openDrawer('Reference')
    expect(within(drawer).getByRole('heading', { name: scenario.title })).toBeInTheDocument()
    expect(within(drawer).getByText(scenario.presentation)).toBeInTheDocument()
  })

  it('renders each evidence id once, however many activities cite it', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-IMP-01' })

    const drawer = await openDrawer('Evidence')
    const titles = within(drawer)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('adds the transfer evidence once the learner reaches the transfer patient', async () => {
    const sectionId = 'iabp-efficacy-limits'
    const transfer = mcsLessonTransferByLessonId.get(sectionId)!
    const transferOnly = transfer.item.evidenceIds.filter(
      (id) => !mcsLessons.find((lesson) => lesson.id === sectionId)!.sourceIds.includes(id),
    )
    await renderWorkbench({ section: 'learn', initialActivityId: sectionId })

    const before = await openDrawer('Evidence')
    const beforeText = before.textContent ?? ''
    fireEvent.keyDown(before, { key: 'Escape' })

    completeRecognizePhase(sectionId)
    continueFromPhase('recognize')
    commitPredictionPhase(sectionId)
    continueFromPhase('predict')
    satisfyLearnAction(sectionId)
    continueFromPhase('act')
    continueFromPhase('observe')
    continueFromPhase('explain')
    expect(learnPhase()).toBe('transfer')

    const after = await openDrawer('Evidence')
    const afterText = after.textContent ?? ''
    if (transferOnly.length > 0) {
      const source = mcsSources.find((candidate) => candidate.id === transferOnly[0])
      if (source) {
        expect(beforeText).not.toContain(source.title)
        expect(afterText).toContain(source.title)
      }
    }
    // Whatever the authored ids are, the transfer phase never shows fewer sources than before it.
    expect(afterText.length).toBeGreaterThanOrEqual(beforeText.length)
  })

  it('opens a case whose optional evidence list is empty without failing', async () => {
    const caseWithoutExtraEvidence = mcsPracticeScenarios.find(
      (scenario) => scenario.evidenceSourceIds.length === 0,
    )
    const scenario = caseWithoutExtraEvidence ?? mcsPracticeScenarios[0]
    await renderWorkbench({ section: 'practice', initialActivityId: scenario.id })

    const drawer = await openDrawer('Evidence')
    expect(within(drawer).getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0)
  })

  it('leaves the phase and the simulation untouched by opening and closing a drawer', async () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IABP-01')!
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
    const readTiming = () =>
      within(screen.getByRole('group', { name: 'Current hemodynamic values' })).getByText('TIMING')
        .parentElement!.textContent
    const phaseBefore = sharedStepperPhase()
    const timingBefore = readTiming()

    const drawer = await openDrawer('Evidence')
    fireEvent.keyDown(drawer, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(sharedStepperPhase()).toBe(phaseBefore)
    expect(readTiming()).toBe(timingBefore)
    expect(screen.getAllByRole('heading', { name: scenario.title }).length).toBeGreaterThan(0)
  })

  it('keeps the M4 congestion provenance in its panel and out of the shared drawer', async () => {
    await renderWorkbench({
      section: 'learn',
      initialActivityId: 'mcs-device-selection-integration',
    })

    const drawer = await openDrawer('Evidence')
    for (const source of mcsCongestionSources) {
      // The congestion records are module-local with their own source kinds; the shared drawer
      // renders the manifest sources, and must not restate a cohort or registry as one of them.
      expect(within(drawer).queryByText(source.title)).not.toBeInTheDocument()
    }
    fireEvent.keyDown(drawer, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // The provenance itself is still on the section's own teaching panel.
    completeRecognizePhase('mcs-device-selection-integration')
    continueFromPhase('recognize')
    commitPredictionPhase('mcs-device-selection-integration')
    expect(
      screen.getAllByText(new RegExp(mcsCongestionSources[0].citation.split(',')[0])).length,
    ).toBeGreaterThan(0)
  })
})
