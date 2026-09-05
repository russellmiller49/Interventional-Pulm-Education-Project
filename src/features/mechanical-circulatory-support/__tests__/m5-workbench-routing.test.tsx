/**
 * M5 — what the workbench resolves on arrival, and what changes when the learner moves.
 *
 * Every case here starts from a route the router can actually produce: a section with no deep link,
 * a section with an activity id, a section with a device hint, and the combinations of the two that
 * disagree. What is being proved is that the case title, the simulator topology, the selection
 * record and the resume target all describe the same activity — the failure this file exists to
 * catch is a workbench showing one pathway's heading over another pathway's state.
 *
 * The workbench hosts Practice and Challenge; Learn resolves on the lesson stage and its route
 * has its own tests.
 */
import { screen, waitFor, within } from '@testing-library/react'

import { getCriticalCareResumeTarget } from '@/features/critical-care/progress'

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

import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content'
import {
  deviceTab,
  practiceRail,
  practiceRailButton,
  readStoredProgressRaw,
  renderWorkbench,
  seedStoredProgress,
  selectDeviceTrack,
  setupMcsWorkbenchEnvironment,
  teardownMcsWorkbenchEnvironment,
} from '../test-support/mcsWorkbench'

describe('MCS M5 — workbench initialization and route resolution', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

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
   * The precedence, pinned. An exact case id and a device hint can disagree, and only one of them
   * can decide the topology: if the hint won, the heading would name one pathway while the
   * simulator ran another.
   */
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

  it('shows no resume banner when the learner arrived without a deep link', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(screen.queryByText('Return to saved case')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Return to case' })).not.toBeInTheDocument()
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

  it('keeps every Challenge open regardless of stored history', async () => {
    seedStoredProgress({ completedLessonIds: [], masteredCaseIds: [] })
    await renderWorkbench({ section: 'assess' })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open challenge' })).toBeEnabled(),
    )
  })

  it('writes no progress merely from mounting a route', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-02' })

    expect(readStoredProgressRaw()).toBeNull()
  })
})

describe('MCS M5 — device and activity transitions', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

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
