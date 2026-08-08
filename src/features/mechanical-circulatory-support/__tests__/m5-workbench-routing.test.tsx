/**
 * M5 — what the workbench resolves on arrival, and what changes when the learner moves.
 *
 * Every case here starts from a route the router can actually produce: a section with no deep link,
 * a section with an activity id, a section with a device hint, and the combinations of the two that
 * disagree. What is being proved is that the lesson title, the simulator topology, the selection
 * record and the resume target all describe the same activity — the failure this file exists to
 * catch is a workbench showing one pathway's heading over another pathway's state.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { getCriticalCareResumeTarget } from '@/features/critical-care/progress'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

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

import {
  mcsCapstoneScenarios,
  mcsLessons,
  mcsPracticeScenarios,
  mcsSectionLearningContractById,
} from '../content'
import type { McsDeviceKind } from '../engine'
import {
  deviceTab,
  pathwayRail,
  practiceRail,
  practiceRailButton,
  readStoredProgressRaw,
  renderWorkbench,
  seedStoredProgress,
  selectDeviceTrack,
  setupMcsWorkbenchEnvironment,
  teardownMcsWorkbenchEnvironment,
} from '../test-support/mcsWorkbench'

const pathway = criticalCareLearningPathway('mechanical-circulatory-support')

/** The rail's own accessible name for a section, built from the pathway rather than retyped. */
function railName(sectionId: string): string {
  const index = pathway.sections.findIndex((section) => section.id === sectionId)
  const section = pathway.sections[index]
  return `${index + 1}. ${section.title}${section.stage === 'integration' ? ', integration capstone' : ''}`
}

/** Which section the rail reports as current, read from `aria-current` and the authored order. */
function activeRailSectionId(): string {
  const current = within(pathwayRail()).getAllByRole('button', { current: 'step' })
  expect(current).toHaveLength(1)
  const label = current[0].getAttribute('aria-label') ?? ''
  const index = Number.parseInt(label, 10) - 1
  const section = pathway.sections[index]
  if (!section) throw new Error(`Rail reported an unknown section: "${label}"`)
  return section.id
}

const firstLessonForDevice: Readonly<Record<McsDeviceKind, string>> = {
  iabp: mcsLessons.find((lesson) => lesson.device === 'iabp')!.id,
  impella: mcsLessons.find((lesson) => lesson.device === 'impella')!.id,
  lvad: mcsLessons.find((lesson) => lesson.device === 'lvad')!.id,
}

describe('MCS M5 — workbench initialization and route resolution', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('opens the recommended first section when Learn carries no deep link', async () => {
    await renderWorkbench({ section: 'learn' })

    expect(activeRailSectionId()).toBe(mcsLessons[0].id)
    expect(screen.getAllByRole('heading', { name: mcsLessons[0].title }).length).toBeGreaterThan(0)
  })

  it.each(mcsLessons.map((lesson) => [lesson.id, lesson.title] as const))(
    'opens the exact section for the %s deep link',
    async (lessonId, title) => {
      await renderWorkbench({ section: 'learn', initialActivityId: lessonId })

      expect(activeRailSectionId()).toBe(lessonId)
      expect(screen.getByRole('button', { name: railName(lessonId) })).toHaveAttribute(
        'aria-current',
        'step',
      )
      expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0)
    },
  )

  it.each(Object.entries(firstLessonForDevice) as [McsDeviceKind, string][])(
    'opens the first authored %s section for a device deep link',
    async (device, lessonId) => {
      await renderWorkbench({ section: 'learn', initialDevice: device })

      expect(activeRailSectionId()).toBe(lessonId)
      expect(mcsSectionLearningContractById.get(lessonId)?.startingDevice).toBe(device)
    },
  )

  it('replaces the Practice and Challenge device tabs with the ordered pathway rail in Learn', async () => {
    await renderWorkbench({ section: 'learn' })

    expect(
      screen.queryByRole('navigation', { name: 'Choose device track' }),
    ).not.toBeInTheDocument()
    expect(within(pathwayRail()).getAllByRole('button')).toHaveLength(mcsLessons.length)
  })

  it('opens Mechanism Studio when Practice carries no case', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(
      screen.getByRole('region', { name: 'Mechanism Studio instructions' }),
    ).toBeInTheDocument()
    expect(within(practiceRail()).getByRole('button', { current: true })).toHaveTextContent(
      'Mechanism Studio',
    )
  })

  it.each(mcsPracticeScenarios.map((scenario) => [scenario.id] as const))(
    'opens practice case %s on its own device',
    async (caseId) => {
      const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === caseId)!
      await renderWorkbench({ section: 'practice', initialActivityId: caseId })

      expect(screen.getAllByRole('heading', { name: scenario.title }).length).toBeGreaterThan(0)
      expect(deviceTab(scenario.device)).toHaveAttribute('aria-pressed', 'true')
      expect(practiceRailButton(scenario.shortTitle)).toHaveAttribute('aria-current', 'true')
    },
  )

  it.each(mcsCapstoneScenarios.map((scenario) => [scenario.id] as const))(
    'opens capstone %s on its own device',
    async (capstoneId) => {
      const capstone = mcsCapstoneScenarios.find((candidate) => candidate.id === capstoneId)!
      await renderWorkbench({ section: 'assess', initialActivityId: capstoneId })

      expect(screen.getAllByRole('heading', { name: capstone.title }).length).toBeGreaterThan(0)
      expect(deviceTab(capstone.device)).toHaveAttribute('aria-pressed', 'true')
    },
  )

  it('falls back to the first section when the lesson id is not one this module owns', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'not-a-lesson' })

    expect(activeRailSectionId()).toBe(mcsLessons[0].id)
    expect(getCriticalCareResumeTarget(window.localStorage)).toBeNull()
  })

  it('falls back to Mechanism Studio when the practice case id is unknown', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-99' })

    expect(
      screen.getByRole('region', { name: 'Mechanism Studio instructions' }),
    ).toBeInTheDocument()
    expect(getCriticalCareResumeTarget(window.localStorage)).toBeNull()
  })

  it('falls back to an unloaded capstone card when the capstone id is unknown', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-NOPE-01' })

    // No scenario is loaded, so the workspace is the studio rather than a fabricated challenge.
    expect(
      screen.getByRole('region', { name: 'Mechanism Studio instructions' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open challenge' })).toBeEnabled()
    expect(getCriticalCareResumeTarget(window.localStorage)).toBeNull()
  })

  /*
   * The precedence, pinned. An exact activity id and a device hint can disagree, and only one of
   * them can decide the topology: if the hint won, the heading would name one pathway while the
   * simulator ran another.
   */
  it('lets an exact Learn activity id win over a disagreeing device hint', async () => {
    await renderWorkbench({
      section: 'learn',
      initialActivityId: 'impella-unloading-placement',
      initialDevice: 'lvad',
    })

    expect(activeRailSectionId()).toBe('impella-unloading-placement')
    // The live context strip reads from the simulator, so it proves the topology, not the heading.
    expect(screen.getAllByText(/Microaxial pump/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/Durable continuous flow — left ventricular apex/)).toHaveLength(0)
  })

  it('lets an exact practice case id win over a disagreeing device hint', async () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'LVAD-01')!
    await renderWorkbench({
      section: 'practice',
      initialActivityId: 'LVAD-01',
      initialDevice: 'iabp',
    })

    expect(screen.getAllByRole('heading', { name: scenario.title }).length).toBeGreaterThan(0)
    expect(deviceTab('lvad')).toHaveAttribute('aria-pressed', 'true')
    expect(deviceTab('iabp')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a resume banner on a deep link that says prior answers were not replayed', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IMP-02' })

    expect(screen.getByText('Return to saved case')).toBeInTheDocument()
    expect(screen.getByText(/Prior controls and answers were not replayed\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to case' })).toBeInTheDocument()
  })

  it('names the Learn resume banner after the lesson rather than the case', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'iabp-timing-triggering' })

    expect(screen.getByText('Return to saved lesson')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to lesson' })).toBeInTheDocument()
  })

  it('shows no resume banner when the learner arrived without a deep link', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(screen.queryByText('Return to saved case')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Return to case' })).not.toBeInTheDocument()
  })

  it('writes the Learn selection record for a deep-linked section', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'lvad-alarms-emergencies' })

    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/mechanical-circulatory-support/learn?lesson=lvad-alarms-emergencies',
      ),
    )
  })

  it('writes the Practice selection record for a deep-linked case', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IMP-02' })

    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/mechanical-circulatory-support/practice?case=IMP-02',
      ),
    )
  })

  it('creates no resume target from a deep-linked Challenge', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-IMP-01' })

    expect(getCriticalCareResumeTarget(window.localStorage)).toBeNull()
  })

  it('keeps every Learn section reachable regardless of stored history', async () => {
    seedStoredProgress({ completedLessonIds: [] })
    await renderWorkbench({ section: 'learn' })

    for (const button of within(pathwayRail()).getAllByRole('button')) {
      expect(button).toBeEnabled()
    }
  })

  it('keeps every Challenge open regardless of stored history', async () => {
    seedStoredProgress({ completedLessonIds: [], masteredCaseIds: [] })
    await renderWorkbench({ section: 'assess' })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open challenge' })).toBeEnabled(),
    )
  })

  it('writes no progress merely from mounting a route', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'iabp-efficacy-limits' })

    expect(readStoredProgressRaw()).toBeNull()
  })
})

describe('MCS M5 — device, section, and activity transitions', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(Object.entries(firstLessonForDevice) as [McsDeviceKind, string][])(
    'is reachable at the first %s section from the pathway rail',
    async (device, lessonId) => {
      await renderWorkbench({ section: 'learn' })

      fireEvent.click(within(pathwayRail()).getByRole('button', { name: railName(lessonId) }))

      await waitFor(() => expect(activeRailSectionId()).toBe(lessonId))
      expect(mcsSectionLearningContractById.get(lessonId)?.startingDevice).toBe(device)
    },
  )

  it.each(['iabp', 'impella', 'lvad'] as const)(
    'opens Mechanism Studio for %s when the device tab changes in Practice',
    async (device) => {
      await renderWorkbench({ section: 'practice', initialActivityId: 'IMP-02' })

      selectDeviceTrack(device)

      expect(
        screen.getByRole('region', { name: 'Mechanism Studio instructions' }),
      ).toBeInTheDocument()
      expect(deviceTab(device)).toHaveAttribute('aria-pressed', 'true')
    },
  )

  it.each(mcsCapstoneScenarios.map((scenario) => [scenario.device, scenario.id] as const))(
    'loads the %s capstone when the Challenge device tab changes',
    async (device, capstoneId) => {
      await renderWorkbench({ section: 'assess' })

      selectDeviceTrack(device)

      const capstone = mcsCapstoneScenarios.find((candidate) => candidate.id === capstoneId)!
      expect(screen.getAllByRole('heading', { name: capstone.title }).length).toBeGreaterThan(0)
    },
  )

  it('drops the previous patient case when the Practice device changes', async () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IMP-02')!
    await renderWorkbench({ section: 'practice', initialActivityId: 'IMP-02' })
    expect(screen.getAllByRole('heading', { name: scenario.title }).length).toBeGreaterThan(0)

    selectDeviceTrack('lvad')

    expect(screen.queryByRole('heading', { name: scenario.title })).not.toBeInTheDocument()
    expect(screen.queryByText(scenario.presentation)).not.toBeInTheDocument()
  })
})
