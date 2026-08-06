/**
 * M5 — what leaves the browser, what stays in it, and what stops when the workbench unmounts.
 *
 * Analytics is asserted at the one boundary every event crosses: `fetch('/api/analytics')`. That is
 * deliberate. Counting calls to a mocked hook would prove the hook was called; counting requests
 * proves what a learner's browser actually sent, which is the claim the privacy note makes.
 *
 * The exact-once assertions all advance the simulation afterwards, because "emitted once" and
 * "emitted on every tick and therefore also once" are indistinguishable without that.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

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

import { mcsPracticeScenarios } from '../content'
import { createDefaultMcsProgress } from '../engine'
import {
  advanceSimulation,
  aggregateAnalyticsEvents,
  capturedAnalyticsEvents,
  capturedIntervalDelays,
  everyInstalledIntervalCleared,
  challengeFeedbackToggle,
  commitCasePrediction,
  commitPredictionPhase,
  commitTransferPhase,
  completeRecognizePhase,
  continueFromPhase,
  countLifecycleInteraction,
  flushAnimationFrames,
  inspectInCase,
  lifecycleAnalyticsPayloads,
  lifecycleInteractions,
  mockRouterPush,
  openCausalDebrief,
  pendingAnimationFrameCount,
  practiceRailButton,
  progressWriteCount,
  reassessCase,
  readStoredProgressRaw,
  renderWorkbench,
  renderWorkbenchOnFakeTimers,
  renderWorkbenchWithoutSettling,
  satisfyLearnAction,
  satisfyLearnTransferActions,
  seedStoredProgress,
  selectDeviceTrack,
  setupMcsWorkbenchEnvironment,
  storedCompletedCaseIds,
  storedLessonIds,
  teardownMcsWorkbenchEnvironment,
  workThroughLearnSection,
  writeMalformedStoredProgress,
  MCS_PROGRESS_KEY,
} from '../test-support/mcsWorkbench'

describe('MCS M5 — loading, writing, and leaving stored progress', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('loads stored progress asynchronously rather than during the first render', async () => {
    seedStoredProgress({ masteredCaseIds: ['IABP-01'] })
    renderWorkbenchWithoutSettling({ section: 'practice' })

    // The rail marks a mastered case only once the deferred read has landed.
    expect(practiceRailButton('Late deflation')).toHaveAttribute('data-complete', 'false')

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(practiceRailButton('Late deflation')).toHaveAttribute('data-complete', 'true')
  })

  it('falls back to a default record when the stored payload is malformed', async () => {
    writeMalformedStoredProgress()
    await renderWorkbench({ section: 'practice' })

    expect(practiceRailButton('Late deflation')).toHaveAttribute('data-complete', 'false')
    expect(
      screen.getByRole('region', { name: 'Mechanism Studio instructions' }),
    ).toBeInTheDocument()
    // The malformed value is left exactly as it was: nothing is migrated and nothing is destroyed.
    expect(window.localStorage.getItem(MCS_PROGRESS_KEY)).toBe('{ this is not json')
  })

  it('reflects a lesson recorded before this package', async () => {
    seedStoredProgress({ completedLessonIds: ['mcs-foundations-signals'] })
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })

    const recommended = await screen.findByRole('link', { name: /^Next recommended/ })
    expect(recommended.getAttribute('href')).not.toContain('mcs-foundations-signals')
  })

  it('reflects a mastered case and a stored capstone record after loading', async () => {
    seedStoredProgress({
      masteredCaseIds: ['IABP-02'],
      completedCaseIds: ['IABP-02', 'CAP-IABP-01'],
      completedCapstoneIds: ['CAP-IABP-01'],
    })
    await renderWorkbench({ section: 'practice' })

    expect(practiceRailButton('Trigger mismatch')).toHaveAttribute('data-complete', 'true')
    expect(readStoredProgressRaw()?.completedCapstoneIds).toEqual(['CAP-IABP-01'])
  })

  it('writes nothing merely from mounting, on any route', async () => {
    for (const section of ['learn', 'practice', 'assess'] as const) {
      const view = await renderWorkbench({ section })
      expect(progressWriteCount()).toBe(0)
      view.unmount()
    }
    expect(window.localStorage.getItem(MCS_PROGRESS_KEY)).toBeNull()
  })

  it('keeps stored history when the activity is reset', async () => {
    seedStoredProgress({
      completedLessonIds: ['mcs-foundations-signals'],
      masteredCaseIds: ['IABP-02'],
    })
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0])

    expect(storedLessonIds()).toEqual(['mcs-foundations-signals'])
    expect(readStoredProgressRaw()?.masteredCaseIds).toEqual(['IABP-02'])
  })

  it('writes the current record and routes to the module front door on Save & exit', async () => {
    seedStoredProgress({ completedLessonIds: ['mcs-foundations-signals'] })
    await renderWorkbench({ section: 'practice' })

    fireEvent.click(screen.getByRole('button', { name: 'Save & exit' }))

    expect(progressWriteCount()).toBe(1)
    expect(readStoredProgressRaw()).toMatchObject({
      version: 1,
      completedLessonIds: ['mcs-foundations-signals'],
    })
    expect(mockRouterPush).toHaveBeenCalledWith('/mechanical-circulatory-support')
  })

  it('keeps the storage key, the payload version, and the payload shape', async () => {
    await renderWorkbench({ section: 'practice' })

    fireEvent.click(screen.getByRole('button', { name: 'Save & exit' }))

    const stored = readStoredProgressRaw()!
    expect(Object.keys(stored).sort()).toEqual(Object.keys(createDefaultMcsProgress()).sort())
    expect(stored.version).toBe(1)
  })

  it('discards no historical id it does not recognize', async () => {
    seedStoredProgress({ completedLessonIds: ['a-section-from-an-earlier-release'] })
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })

    workThroughLearnSection('mcs-foundations-signals')

    await waitFor(() => expect(storedLessonIds()).toContain('mcs-foundations-signals'))
    expect(storedLessonIds()).toContain('a-section-from-an-earlier-release')
  })
})

describe('MCS M5 — the simulation interval and unmount cleanup', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('installs exactly one interval, at the normal cadence', async () => {
    await renderWorkbenchOnFakeTimers({ section: 'practice' })

    expect(capturedIntervalDelays()).toEqual([100])
  })

  it('installs the reduced-motion cadence when the media query matches', async () => {
    setupMcsWorkbenchEnvironment({ reducedMotion: true })
    await renderWorkbenchOnFakeTimers({ section: 'practice' })

    expect(capturedIntervalDelays()).toEqual([250])
  })

  it('still installs the simulation interval where matchMedia does not exist', async () => {
    // Not every embedding browser exposes matchMedia; the reduced-motion read is optional for that
    // reason, and losing it must cost the reduced cadence rather than the simulation.
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })

    await renderWorkbenchOnFakeTimers({ section: 'practice' })

    expect(capturedIntervalDelays()).toEqual([100])
  })

  it('clears the interval it installed on unmount', async () => {
    const view = await renderWorkbenchOnFakeTimers({ section: 'practice' })
    expect(capturedIntervalDelays()).toHaveLength(1)

    view.unmount()

    expect(everyInstalledIntervalCleared()).toBe(true)
  })

  it('produces no state update when the timers run after unmount', async () => {
    const errors: unknown[] = []
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args[0])
    })
    const view = await renderWorkbenchOnFakeTimers({ section: 'practice' })

    view.unmount()
    act(() => {
      jest.advanceTimersByTime(5_000)
    })

    expect(errors).toEqual([])
    consoleError.mockRestore()
  })

  it('drops a queued animation-frame callback rather than updating an unmounted workbench', async () => {
    const errors: unknown[] = []
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args[0])
    })
    const view = await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    fireEvent.click(screen.getByRole('button', { name: 'Open Act phase' }))
    expect(pendingAnimationFrameCount()).toBe(1)
    view.unmount()
    flushAnimationFrames()

    expect(errors).toEqual([])
    consoleError.mockRestore()
  })

  it('unmounts before the deferred read without a late state update', async () => {
    const errors: unknown[] = []
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args[0])
    })
    seedStoredProgress({ masteredCaseIds: ['IABP-01'] })
    const view = renderWorkbenchWithoutSettling({ section: 'practice' })

    view.unmount()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(errors).toEqual([])
    consoleError.mockRestore()
  })
})

describe('MCS M5 — every lifecycle event is emitted once', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('reports a committed prediction once, and not again on every tick', async () => {
    const scenario = mcsPracticeScenarios[0]
    await renderWorkbenchOnFakeTimers({ section: 'practice', initialActivityId: scenario.id })

    commitCasePrediction(scenario.predictionOptions[0].label)
    advanceSimulation(3_000)

    expect(countLifecycleInteraction('critical_care_prediction_submitted')).toBe(1)
  })

  it('reports a new prediction for the next case', async () => {
    const first = mcsPracticeScenarios[0]
    await renderWorkbench({ section: 'practice', initialActivityId: first.id })
    commitCasePrediction(first.predictionOptions[0].label)

    fireEvent.click(practiceRailButton('Trigger mismatch'))
    const second = mcsPracticeScenarios.find((candidate) => candidate.id === 'IABP-02')!
    commitCasePrediction(second.predictionOptions[0].label)

    expect(
      countLifecycleInteraction('critical_care_prediction_submitted', {
        activityId: 'mcs:practice:IABP-01',
      }),
    ).toBe(1)
    expect(
      countLifecycleInteraction('critical_care_prediction_submitted', {
        activityId: 'mcs:practice:IABP-02',
      }),
    ).toBe(1)
  })

  it('reports one safety event for one safety error, however long the case runs', async () => {
    await renderWorkbenchOnFakeTimers({ section: 'practice', initialActivityId: 'IABP-01' })

    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '180' },
    })
    advanceSimulation(3_000)
    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '170' },
    })

    expect(countLifecycleInteraction('critical_care_safety_event')).toBe(1)
  })

  it('reports a distinct safety error in another case separately', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '180' },
    })
    expect(countLifecycleInteraction('critical_care_safety_event')).toBe(1)

    selectDeviceTrack('lvad')
    fireEvent.click(practiceRailButton('Power emergency'))
    // The power-emergency case opens with the approved path already lost, so restoring it comes
    // first and the learner-caused disconnection is the second move.
    const power = screen.getByRole('checkbox', { name: /Approved power path/ })
    expect(power).not.toBeChecked()
    fireEvent.click(power)
    fireEvent.click(screen.getByRole('checkbox', { name: /Approved power path/ }))

    expect(
      lifecycleAnalyticsPayloads()
        .filter((payload) => payload.interaction === 'critical_care_safety_event')
        .map((payload) => payload.activityId),
    ).toEqual(['mcs:practice:IABP-01', 'mcs:practice:LVAD-03'])
  })

  it('reports the safety event again when the case is reset and the error recreated', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
    const setDeflation = (value: string) =>
      fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
        target: { value },
      })

    setDeflation('180')
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0])
    setDeflation('180')

    expect(countLifecycleInteraction('critical_care_safety_event')).toBe(2)
  })

  it('reports no goal met from the studio, which has no required actions', async () => {
    await renderWorkbenchOnFakeTimers({ section: 'practice' })
    advanceSimulation(2_000)

    expect(lifecycleInteractions()).not.toContain('critical_care_goal_met')
  })

  it('reports no goal met while a case still has required actions outstanding', async () => {
    // IABP-01 requires an arterial inspection and a deflation change.
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    inspectInCase('inspect:arterial')

    expect(lifecycleInteractions()).not.toContain('critical_care_goal_met')
  })

  it('reports goal met once when the last required action lands', async () => {
    await renderWorkbenchOnFakeTimers({ section: 'practice', initialActivityId: 'IABP-01' })

    inspectInCase('inspect:arterial')
    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '0' },
    })
    advanceSimulation(3_000)

    expect(countLifecycleInteraction('critical_care_goal_met')).toBe(1)
  })

  it('reports the debrief and the completion once each, and no transfer completion', async () => {
    const scenario = mcsPracticeScenarios[0]
    await renderWorkbenchOnFakeTimers({ section: 'practice', initialActivityId: scenario.id })

    inspectInCase('inspect:arterial')
    commitCasePrediction(scenario.predictionOptions[0].label)
    reassessCase()
    openCausalDebrief()
    advanceSimulation(3_000)

    expect(countLifecycleInteraction('critical_care_debrief_viewed')).toBe(1)
    expect(
      countLifecycleInteraction('critical_care_activity_completed') +
        countLifecycleInteraction('critical_care_activity_mastered'),
    ).toBe(1)
    expect(lifecycleInteractions()).not.toContain('critical_care_transfer_completed')
  })

  it('persists the case result once, and not again on later rerenders', async () => {
    const scenario = mcsPracticeScenarios[0]
    await renderWorkbenchOnFakeTimers({ section: 'practice', initialActivityId: scenario.id })

    inspectInCase('inspect:arterial')
    commitCasePrediction(scenario.predictionOptions[0].label)
    reassessCase()
    openCausalDebrief()
    advanceSimulation(0)
    await waitFor(() => expect(storedCompletedCaseIds()).toContain(scenario.id))
    const writes = progressWriteCount()

    /*
     * A learner can still act after the debrief opens, and each action produces a new state the
     * persistence effect sees. Reassessing keeps the same scenario, score and error count, so the
     * result has not changed and must not be written again.
     */
    reassessCase()
    advanceSimulation(1)
    expect(progressWriteCount()).toBe(writes)

    advanceSimulation(5_000)
    fireEvent.click(
      screen
        .getByRole('group', { name: 'Choose mobile workspace surface' })
        .querySelector('button')!,
    )

    expect(progressWriteCount()).toBe(writes)
  })

  it('reports a Learn section completion once, and not again on later ticks', async () => {
    await renderWorkbenchOnFakeTimers({
      section: 'learn',
      initialActivityId: 'mcs-foundations-signals',
    })

    completeRecognizePhase('mcs-foundations-signals')
    continueFromPhase('recognize')
    commitPredictionPhase('mcs-foundations-signals')
    continueFromPhase('predict')
    satisfyLearnAction('mcs-foundations-signals')
    continueFromPhase('act')
    continueFromPhase('observe')
    continueFromPhase('explain')
    satisfyLearnTransferActions('mcs-foundations-signals')
    commitTransferPhase('mcs-foundations-signals')
    advanceSimulation(3_000)

    expect(
      countLifecycleInteraction('critical_care_activity_completed', {
        activityId: 'mcs:learn:mcs-foundations-signals',
      }),
    ).toBe(1)
    expect(
      countLifecycleInteraction('critical_care_goal_met', {
        activityId: 'mcs:learn:mcs-foundations-signals',
      }),
    ).toBe(1)
  })
})

describe('MCS M5 — lifecycle identity and the privacy boundary', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each([
    ['learn', 'mcs-foundations-signals', 'mcs:learn:mcs-foundations-signals', 'guided'],
    ['practice', 'IMP-02', 'mcs:practice:IMP-02', 'practice'],
    ['assess', 'CAP-LVAD-01', 'mcs:assess:CAP-LVAD-01', 'challenge'],
  ] as const)(
    'reports %s under its own activity id and mode',
    async (section, activity, activityId, mode) => {
      await renderWorkbench({ section, initialActivityId: activity })

      const opened = lifecycleAnalyticsPayloads().filter(
        (payload) => payload.interaction === 'critical_care_activity_opened',
      )
      expect(opened.at(-1)).toMatchObject({ activityId, mode })
    },
  )

  it('reports the studio under a studio id rather than a fabricated case id', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('lvad')

    const opened = lifecycleAnalyticsPayloads().filter(
      (payload) => payload.interaction === 'critical_care_activity_opened',
    )
    expect(opened.at(-1)).toMatchObject({
      activityId: 'mcs:practice:studio-lvad',
      mode: 'practice',
    })
  })

  it('reports the phase the learner can see', async () => {
    await renderWorkbench({ section: 'learn', initialActivityId: 'mcs-foundations-signals' })

    completeRecognizePhase('mcs-foundations-signals')
    continueFromPhase('recognize')
    commitPredictionPhase('mcs-foundations-signals')
    continueFromPhase('predict')

    const completedPhases = lifecycleAnalyticsPayloads()
      .filter((payload) => payload.interaction === 'critical_care_phase_completed')
      .map((payload) => payload.phase)
    expect(completedPhases).toEqual(['recognize', 'predict'])
  })

  it('sends only the device track, the station, and a coarse completion state', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IMP-02' })

    const aggregate = aggregateAnalyticsEvents()
    expect(aggregate.length).toBeGreaterThan(0)
    for (const event of aggregate) {
      expect(event.eventPayload).toEqual({
        deviceTrack: 'impella',
        station: 'IMP-02',
        completion: 'in-progress',
      })
    }
  })

  it('reports completion coarsely once the case is complete', async () => {
    const scenario = mcsPracticeScenarios[0]
    await renderWorkbench({ section: 'practice', initialActivityId: scenario.id })

    commitCasePrediction(scenario.predictionOptions[0].label)
    openCausalDebrief()

    expect(aggregateAnalyticsEvents().at(-1)?.eventPayload).toMatchObject({
      completion: 'complete',
    })
  })

  it('sends no physiologic value anywhere in any payload', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-IMP-01' })
    fireEvent.click(challengeFeedbackToggle())
    inspectInCase('inspect:device')
    reassessCase()
    openCausalDebrief()

    const serialized = JSON.stringify(capturedAnalyticsEvents())
    expect(serialized).not.toMatch(
      /waveform|trace|pressure|actionIds|presentation|freeText|mapMmHg|pcwp|papi|svo2|cardiacPower|effectiveSystemic|rapMmHg|debrief:/i,
    )
    // The privacy note on the page says exactly this, so it must remain true.
    expect(
      screen.getByText(/Physiologic traces, pressures, detailed action histories, and free text/),
    ).toBeInTheDocument()
  })
})
