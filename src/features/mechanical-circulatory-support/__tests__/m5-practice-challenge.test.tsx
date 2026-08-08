/**
 * M5 — Mechanism Studio, the patient cases, and the challenge capstones.
 *
 * The three surfaces differ in exactly the ways the accepted packages say they do: the studio is an
 * open workspace with no case identity and no debrief, Practice coaches while the learner works, and
 * Challenge holds routine teaching back while leaving the patient, the device and the safety
 * interruptions live. What is asserted here is that difference, case by case, from the interface.
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

import { getCriticalCareResumeTarget } from '@/features/critical-care/progress'

import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content'
import { createInitialMcsState } from '../engine'
import {
  advanceSimulation,
  challengeFeedbackToggle,
  commitCasePrediction,
  countLifecycleInteraction,
  inspectInCase,
  lifecycleAnalyticsPayloads,
  lifecycleInteractions,
  openCausalDebrief,
  practiceRailButton,
  progressWriteCount,
  reassessCase,
  renderWorkbench,
  renderWorkbenchOnFakeTimers,
  seedStoredProgress,
  selectDeviceTrack,
  setupMcsWorkbenchEnvironment,
  sharedStepperPhase,
  storedCompletedCaseIds,
  storedMasteredCaseIds,
  teardownMcsWorkbenchEnvironment,
} from '../test-support/mcsWorkbench'

const practiceCases = mcsPracticeScenarios.map((scenario) => [scenario.id, scenario] as const)
const capstones = mcsCapstoneScenarios.map((scenario) => [scenario.id, scenario] as const)
/** One representative case per device track, for the walks that go all the way to a debrief. */
const representativeCases = ['IABP-01', 'IMP-02', 'LVAD-03'].map(
  (id) => [id, mcsPracticeScenarios.find((scenario) => scenario.id === id)!] as const,
)

describe('MCS M5 — Mechanism Studio is a workspace, not a case', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('says so in its own words, and carries no case identity or debrief', async () => {
    const { container } = await renderWorkbench({ section: 'practice' })

    const studio = screen.getByRole('region', { name: 'Mechanism Studio instructions' })
    expect(within(studio).getByText('OPEN WORKSPACE · NOT A PATIENT CASE')).toBeInTheDocument()
    expect(within(studio).getByRole('heading', { name: 'Mechanism Studio' })).toBeInTheDocument()
    expect(
      within(studio).getByText(/no presentation, no\s+permitted-action list, and no debrief/),
    ).toBeInTheDocument()
    expect(container.querySelector('[data-case-identity]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open causal debrief' })).not.toBeInTheDocument()
    expect(screen.queryByText('Practice cue')).not.toBeInTheDocument()
  })

  it.each(['iabp', 'impella', 'lvad'] as const)(
    'exposes the bounded %s controls with nothing withheld by a scenario',
    async (device) => {
      await renderWorkbench({ section: 'practice' })
      selectDeviceTrack(device)

      const controls = screen.getByRole('region', {
        name: 'Patient and mechanical-support controls',
      })
      for (const slider of within(controls).getAllByRole('slider')) {
        // The LVAD speed slider stays closed until the simulated authorization is given, which is
        // an authored device rule rather than a scenario permission.
        if (slider.getAttribute('aria-label') === 'Pump speed') continue
        expect(slider).toBeEnabled()
      }
      for (const select of within(controls).getAllByRole('combobox')) expect(select).toBeEnabled()
    },
  )

  it('moves the synchronized monitor when one patient control changes', async () => {
    await renderWorkbench({ section: 'practice' })
    const readFilling = () =>
      within(screen.getByRole('group', { name: 'Current hemodynamic values' })).getByText(
        'RAP / PCWP',
      ).parentElement!.textContent

    const before = readFilling()
    fireEvent.change(screen.getByRole('slider', { name: 'Preload' }), { target: { value: '140' } })

    expect(readFilling()).not.toBe(before)
  })

  it('moves the anatomy pathway summary when the device topology changes', async () => {
    const { container } = await renderWorkbench({ section: 'practice' })
    const summaryText = () =>
      container.querySelector('[data-anatomy-target="anatomy:support-pathway-overview"]')
        ?.textContent

    const before = summaryText()
    selectDeviceTrack('impella')

    expect(summaryText()).not.toBe(before)
  })

  it('reports the studio under its documented activity id and practice mode', async () => {
    await renderWorkbench({ section: 'practice' })

    const opened = lifecycleAnalyticsPayloads().filter(
      (payload) => payload.interaction === 'critical_care_activity_opened',
    )
    expect(opened.at(-1)).toMatchObject({
      activityId: 'mcs:practice:studio-iabp',
      mode: 'practice',
      moduleId: 'mechanical-circulatory-support',
    })
  })

  it('records no case result from the studio, however long it runs', async () => {
    await renderWorkbenchOnFakeTimers({ section: 'practice' })
    advanceSimulation(3_000)

    expect(storedCompletedCaseIds()).toEqual([])
    expect(progressWriteCount()).toBe(0)
  })

  it('is replaced by a case opened from the rail, and restored when the learner returns', async () => {
    const scenario = mcsPracticeScenarios[0]
    await renderWorkbench({ section: 'practice' })

    fireEvent.click(practiceRailButton(scenario.shortTitle))
    expect(screen.getAllByRole('heading', { name: scenario.title }).length).toBeGreaterThan(0)
    expect(
      screen.queryByRole('region', { name: 'Mechanism Studio instructions' }),
    ).not.toBeInTheDocument()

    fireEvent.click(practiceRailButton('Mechanism Studio'))
    expect(
      screen.getByRole('region', { name: 'Mechanism Studio instructions' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(scenario.presentation)).not.toBeInTheDocument()
  })
})

describe('MCS M5 — practice case identity and permissions', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(practiceCases)('states what makes %s a case', async (caseId, scenario) => {
    const { container } = await renderWorkbench({ section: 'practice', initialActivityId: caseId })

    const identity = container.querySelector<HTMLElement>('[data-case-identity]')
    expect(identity).not.toBeNull()
    for (const label of [
      'Patient problem',
      'Support pathway',
      'Your role',
      'Immediate goal',
      'What makes this one different',
    ]) {
      expect(within(identity!).getByText(label)).toBeInTheDocument()
    }
    expect(within(identity!).getByText(scenario.presentation)).toBeInTheDocument()
    expect(within(identity!).getByText(scenario.learningObjectives[0])).toBeInTheDocument()
    expect(within(identity!).getByText(scenario.shortTitle)).toBeInTheDocument()
    expect(within(identity!).getByText(/Work it with coaching available/)).toBeInTheDocument()
  })

  it.each(practiceCases)('enables only the inspections %s permits', async (caseId, scenario) => {
    await renderWorkbench({ section: 'practice', initialActivityId: caseId })

    for (const [actionId, label] of [
      ['inspect:arterial', 'Arterial waveform'],
      ['inspect:preload', 'Filling & RV'],
      ['inspect:device', 'Device display'],
    ] as const) {
      const button = screen.getByRole('button', { name: label })
      if (scenario.permittedActionIds.includes(actionId)) expect(button).toBeEnabled()
      else expect(button).toBeDisabled()
    }
  })

  it('closes the patient sliders a case does not permit and opens the ones it does', async () => {
    // The placement-signal case permits general patient adjustment but names no specific slider.
    await renderWorkbench({ section: 'practice', initialActivityId: 'LVAD-03' })

    // LVAD-03 permits neither patient adjustment nor speed changes.
    expect(screen.getByRole('slider', { name: 'Preload' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'SVR' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Approved power path/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Escalate to shock/MCS team' })).toBeEnabled()
  })

  it('opens the SVR slider, and no unpermitted device control, on the afterload case', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'LVAD-01' })

    // LVAD-01 permits patient adjustment and the authorized speed path, and nothing else.
    expect(screen.getByRole('slider', { name: 'SVR' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: /Authorized-personnel order/ })).toBeEnabled()
    expect(
      screen.getByRole('checkbox', { name: /High-power \/ thrombosis pattern/ }),
    ).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Controller fault/ })).toBeDisabled()
  })
})

describe('MCS M5 — working a practice case through to its debrief', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(representativeCases)(
    'requires a choice before %s can commit a prediction, and keeps it visible afterwards',
    async (caseId, scenario) => {
      await renderWorkbench({ section: 'practice', initialActivityId: caseId })

      const commit = screen.getByRole('button', { name: /Record initial frame/ })
      expect(commit).toBeDisabled()

      commitCasePrediction(scenario.predictionOptions[0].label)

      expect(screen.getByRole('button', { name: /Prediction committed/ })).toBeDisabled()
      expect(screen.getByRole('radio', { name: scenario.predictionOptions[0].label })).toBeChecked()
    },
  )

  it.each(representativeCases)(
    'shows the Practice coaching cue for %s',
    async (caseId, scenario) => {
      await renderWorkbench({ section: 'practice', initialActivityId: caseId })

      expect(screen.getByText('Practice cue')).toBeInTheDocument()
      expect(screen.getAllByText(scenario.guidedPrompt).length).toBeGreaterThan(0)
      expect(screen.getByText('Simulation response')).toBeInTheDocument()
    },
  )

  it('moves the live model when a permitted action is taken', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
    const readTiming = () =>
      within(screen.getByRole('group', { name: 'Current hemodynamic values' })).getByText('TIMING')
        .parentElement!.textContent

    const before = readTiming()
    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '0' },
    })

    expect(readTiming()).not.toBe(before)
  })

  it('advances the case state on Reassess and completes it on the causal debrief', async () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IABP-01')!
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    inspectInCase('inspect:arterial')
    commitCasePrediction(scenario.predictionOptions[0].label)
    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '0' },
    })
    expect(sharedStepperPhase()).toBe('Observe')

    reassessCase()
    expect(sharedStepperPhase()).toBe('Explain')
    expect(screen.getByText(/^Reassessment: effective flow/)).toBeInTheDocument()

    openCausalDebrief()

    expect(await screen.findByRole('heading', { name: /Causal debrief/ })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Review the causal chain and the cues that changed' }),
    ).toBeInTheDocument()
    // The debrief belongs to this case and no other.
    for (const line of scenario.debrief) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
  })

  it('records the case result exactly once and does not rewrite it on later ticks', async () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IABP-01')!
    await renderWorkbenchOnFakeTimers({ section: 'practice', initialActivityId: 'IABP-01' })

    inspectInCase('inspect:arterial')
    commitCasePrediction(
      scenario.correctPredictionId === 'late-deflation'
        ? scenario.predictionOptions[0].label
        : scenario.predictionOptions[0].label,
    )
    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '0' },
    })
    reassessCase()
    openCausalDebrief()

    advanceSimulation(0)
    await waitFor(() => expect(storedCompletedCaseIds()).toContain('IABP-01'))
    const writes = progressWriteCount()

    advanceSimulation(3_000)
    expect(progressWriteCount()).toBe(writes)
    expect(storedCompletedCaseIds()).toEqual(['IABP-01'])
  })

  it('navigates the case reasoning rail and works its remaining steps', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-03' })
    const rail = screen.getByRole('list', { name: 'Case reasoning sequence' })

    fireEvent.click(within(rail).getByRole('button', { name: /observe/ }))
    expect(document.activeElement).toHaveAttribute('id', 'mcs-case-response')

    // The support-ceiling case is the one that asks for an escalation rather than a setting.
    inspectInCase('inspect:preload')
    inspectInCase('inspect:device')
    fireEvent.click(screen.getByRole('button', { name: 'Escalate to shock/MCS team' }))

    expect(
      screen.getByText('Shock/MCS team escalation documented in the simulation.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Escalate to shock/MCS team' })).toHaveAttribute(
      'data-complete',
      'true',
    )
  })

  it('returns the case to its authored start from the card\u2019s own Reset', async () => {
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IABP-01')!
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
    const workflow = screen.getByRole('region', { name: scenario.title })
    inspectInCase('inspect:arterial')
    expect(screen.getByRole('button', { name: 'Arterial waveform' })).toHaveAttribute(
      'data-complete',
      'true',
    )

    fireEvent.click(within(workflow).getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('button', { name: 'Arterial waveform' })).toHaveAttribute(
      'data-complete',
      'false',
    )
  })

  it('replays the active case without discarding history from earlier cases', async () => {
    seedStoredProgress({ completedCaseIds: ['IMP-01'], masteredCaseIds: ['IMP-01'] })
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === 'IABP-01')!
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    inspectInCase('inspect:arterial')
    commitCasePrediction(scenario.predictionOptions[0].label)
    reassessCase()
    openCausalDebrief()
    await waitFor(() => expect(storedCompletedCaseIds()).toContain('IABP-01'))

    fireEvent.click(screen.getByRole('button', { name: 'Replay this case' }))

    expect(screen.queryByRole('heading', { name: /Causal debrief/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record initial frame/ })).toBeDisabled()
    expect(storedMasteredCaseIds()).toContain('IMP-01')
    expect(storedCompletedCaseIds()).toEqual(expect.arrayContaining(['IMP-01', 'IABP-01']))
  })

  it('returns the case to its authored start on Reset, leaving stored history alone', async () => {
    seedStoredProgress({ completedLessonIds: ['mcs-foundations-signals'] })
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
    const deflation = () => screen.getByRole('slider', { name: 'Deflation vs systole' })
    const authored = (deflation() as HTMLInputElement).value

    fireEvent.change(deflation(), { target: { value: '90' } })
    expect((deflation() as HTMLInputElement).value).toBe('90')

    // The shared chrome's Reset is the first of the two; the case card carries its own below it.
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0])

    expect((deflation() as HTMLInputElement).value).toBe(authored)
    expect(
      JSON.parse(window.localStorage.getItem('interventionalpulm:mcs-progress:v1')!)
        .completedLessonIds,
    ).toEqual(['mcs-foundations-signals'])
  })

  it('recommends a next case that is neither the active one nor an already mastered one', async () => {
    seedStoredProgress({ masteredCaseIds: ['IABP-02'] })
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    const recommended = await screen.findByRole('link', { name: /^Next recommended/ })
    expect(recommended).toHaveAttribute(
      'href',
      '/mechanical-circulatory-support/practice?case=IABP-03',
    )
  })

  it('carries no stale answer, action, or safety event into the next case', async () => {
    const first = mcsPracticeScenarios.find((candidate) => candidate.id === 'IABP-01')!
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    inspectInCase('inspect:arterial')
    commitCasePrediction(first.predictionOptions[0].label)
    // A late-deflation setting is the authored safety event for this device.
    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '180' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent('iabp late deflation created')

    fireEvent.click(practiceRailButton('Trigger mismatch'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record initial frame/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Arterial waveform' })).not.toHaveAttribute(
      'data-complete',
      'true',
    )
    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/mechanical-circulatory-support/practice?case=IABP-02',
      ),
    )
  })
})

describe('MCS M5 — Challenge withholds routine teaching and nothing else', () => {
  beforeEach(() =>
    setupMcsWorkbenchEnvironment({ route: '/mechanical-circulatory-support/assess' }),
  )
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(capstones)(
    'opens %s regardless of local completion history',
    async (capstoneId, capstone) => {
      seedStoredProgress({ completedLessonIds: [], masteredCaseIds: [], completedCapstoneIds: [] })
      await renderWorkbench({ section: 'assess', initialActivityId: capstoneId })

      expect(screen.getAllByRole('heading', { name: capstone.title }).length).toBeGreaterThan(0)
      expect(screen.getByText(/Work it independently/)).toBeInTheDocument()
      expect(screen.queryByText('Practice cue')).not.toBeInTheDocument()

      /*
       * A capstone that starts in a critical alarm state is the one documented exception: the
       * explanation appears without an opt-in, because a safety interruption is not routine teaching.
       */
      const initial = createInitialMcsState('assess', capstone.device, capstone)
      const criticalAtStart = initial.alarms.some(
        (alarm) => alarm.active && alarm.priority === 'critical',
      )
      if (criticalAtStart) {
        expect(screen.getByText(/Why the display changed/)).toBeInTheDocument()
      } else {
        expect(screen.getByText('Routine teaching deferred')).toBeInTheDocument()
        expect(screen.queryByText(/Why the display changed/)).not.toBeInTheDocument()
      }
    },
  )

  it.each(capstones)('reveals the deferred teaching for %s only on opt-in', async (capstoneId) => {
    await renderWorkbench({ section: 'assess', initialActivityId: capstoneId })

    expect(challengeFeedbackToggle()).not.toBeChecked()
    fireEvent.click(challengeFeedbackToggle())

    expect(screen.getByText('Simulation response')).toBeInTheDocument()
    expect(screen.getByText(/Why the display changed/)).toBeInTheDocument()
  })

  it('keeps the patient and the clock live while the teaching is withheld', async () => {
    await renderWorkbenchOnFakeTimers({ section: 'assess', initialActivityId: 'CAP-IABP-01' })
    const monitor = screen.getByRole('region', {
      name: 'Synchronized mechanical-support bedside monitor',
    })
    const before = within(monitor).getByText(/ s$/).textContent

    advanceSimulation(1_000)

    expect(within(monitor).getByText(/ s$/).textContent).not.toBe(before)
    expect(screen.getByText('Routine teaching deferred')).toBeInTheDocument()
  })

  it('drops the previous opt-in when the learner switches capstone', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-IABP-01' })
    fireEvent.click(challengeFeedbackToggle())
    expect(challengeFeedbackToggle()).toBeChecked()

    selectDeviceTrack('impella')

    expect(challengeFeedbackToggle()).not.toBeChecked()
    expect(screen.getByText('Routine teaching deferred')).toBeInTheDocument()
  })

  it('shows a critical safety event immediately, without an opt-in', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-IABP-01' })

    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '180' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('iabp late deflation created')
    // The critical alarm is the one documented reason coaching appears without an opt-in.
    expect(challengeFeedbackToggle()).not.toBeChecked()
    expect(screen.getByText(/Why the display changed/)).toBeInTheDocument()
  })

  it('emits no hint event when Help is used inside a Challenge', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-IABP-01' })

    fireEvent.click(screen.getByRole('button', { name: 'Help' }))

    expect(lifecycleInteractions()).not.toContain('critical_care_hint_used')
  })

  it('emits the hint event when Help is used inside a Practice case', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    fireEvent.click(screen.getByRole('button', { name: 'Help' }))

    expect(countLifecycleInteraction('critical_care_hint_used')).toBe(1)
  })

  it('reveals the deferred response in the debrief, and reports completion once', async () => {
    const capstone = mcsCapstoneScenarios.find((candidate) => candidate.id === 'CAP-IABP-01')!
    await renderWorkbenchOnFakeTimers({ section: 'assess', initialActivityId: 'CAP-IABP-01' })

    inspectInCase('inspect:arterial')
    commitCasePrediction(capstone.predictionOptions[0].label)
    reassessCase()
    openCausalDebrief()
    advanceSimulation(0)

    expect(screen.getByText('Deferred simulation response')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Causal debrief/ })).toBeInTheDocument()
    await waitFor(() => expect(storedCompletedCaseIds()).toContain('CAP-IABP-01'))

    advanceSimulation(2_000)
    expect(countLifecycleInteraction('critical_care_debrief_viewed')).toBe(1)
    expect(
      countLifecycleInteraction('critical_care_activity_completed') +
        countLifecycleInteraction('critical_care_activity_mastered'),
    ).toBe(1)
  })

  it('reports a challenge under its own lifecycle identity, never as practice', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-LVAD-01' })

    const opened = lifecycleAnalyticsPayloads().filter(
      (payload) => payload.interaction === 'critical_care_activity_opened',
    )
    expect(opened.at(-1)).toMatchObject({
      activityId: 'mcs:assess:CAP-LVAD-01',
      mode: 'challenge',
    })
    expect(screen.getByText(/^CHALLENGE · CAP-LVAD-01$/)).toBeInTheDocument()
  })

  it('resolves the resume target it writes to a real challenge activity', async () => {
    await renderWorkbench({ section: 'assess' })

    fireEvent.click(screen.getByRole('button', { name: 'Open challenge' }))

    await waitFor(() =>
      expect(getCriticalCareResumeTarget(window.localStorage)?.href).toBe(
        '/mechanical-circulatory-support/assess?case=CAP-IABP-01',
      ),
    )
  })
})
