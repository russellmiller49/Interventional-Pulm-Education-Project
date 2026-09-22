/**
 * MCS-PRE-REVIEW-01 — device conflicts and state truth.
 *
 * Six defects, all reproduced on the base commit before anything here was written:
 *
 *  F19  In atrial fibrillation the engine rates pressure triggering 74, ECG 50 and internal 40, and
 *       raises its trigger alarm below 60 — so IABP-02's authored condition (≥60) and
 *       CAP-IABP-01's (≥65) were reachable only by selecting the trigger the supplied Cardiosave
 *       material advises against, and the module answered that selection with a higher figure, a
 *       cleared alarm, an "all clear" strip and a met condition.
 *  F26  Both suction stories run from one constructed low-preload baseline while the section around
 *       them is a right-ventricular-failure patient, and neither said so; "from the same starting
 *       point" had no referent on screen.
 *  F33  Twenty-one numerical conditions across twelve cases, printed as bare thresholds under
 *       "Signals to reconcile", none of them classified or sourced.
 *  F04  The strip readouts and the tiles carry different quantities over different windows and
 *       said neither; the modeled synchrony index was tiled and levelled like a console reading.
 *  F27  The durable reference state was described as reading normally at a mean pressure of 103.
 *  F28  The module teaches "power up, flow unchanged", which is the reverse of the dependency the
 *       HeartMate 3 pump-parameter card states.
 *  F18  The recognize step claimed an unannotated example while rendering the annotated reference.
 *  F01  The hub's light theme inherited the site's dark-mode foreground onto its own white cards.
 *
 * Nothing here is clinical or device approval. The atrial-fibrillation model is CONTAINED, not
 * corrected: `MCS-03-05` keeps its `NOT REVIEWED` decision and OD-01 still owns the model.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fireEvent, render, screen, within } from '@testing-library/react'

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

import { McsCaseWorkflow } from '../components/McsCaseWorkflow'
import { McsControls } from '../components/McsControls'
import { McsMonitor } from '../components/McsMonitor'
import { McsStoryProblems } from '../components/stage/McsStoryProblems'
import { MCS_AF_TRIGGER_CONTAINMENT, MCS_AF_TRIGGER_LIMIT } from '../content/afTriggerLimit'
import { mcsAfTriggerComparison } from '../content/afTriggerComparison'
import { mcsLessonTransferByLessonId } from '../content/lessonTransfers'
import { allMcsScenarios, mcsScenarioById } from '../content/scenarios'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { mcsSources } from '../content/sources'
import { mcsStoryBaseline, mcsStoryProblems, runMcsStory } from '../content/storyProblems'
import { createInitialMcsState, mcsReducer } from '../engine'
import { calculateMcsScore } from '../engine/reducer'
import type { McsAction, McsSimulationState } from '../engine/types'
import {
  completeIntroductorySteps,
  mountSection,
  nowPrimary,
  setupMcsStage,
  teardownMcsStage,
} from '../test-support/mcsStage'

const FEATURE_ROOT = join(__dirname, '..')

function settle(state: McsSimulationState, seconds = 8): McsSimulationState {
  let next = state
  for (let step = 0; step < seconds * 5; step += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.2 })
  }
  return next
}

function apply(state: McsSimulationState, actions: readonly McsAction[]): McsSimulationState {
  let next = state
  for (const action of actions) next = mcsReducer(next, action)
  return next
}

const TRIGGERS = ['ecg', 'pressure', 'internal'] as const

function afTransferState(): McsSimulationState {
  const transfer = mcsLessonTransferByLessonId.get('iabp-timing-triggering')!
  return settle(
    apply(createInitialMcsState('learn', transfer.setupDevice, null, 417), transfer.setupActions),
  )
}

function caseState(id: string): McsSimulationState {
  const scenario = mcsScenarioById.get(id)!
  return settle(createInitialMcsState('practice', scenario.device, scenario, 417))
}

function withTrigger(
  state: McsSimulationState,
  value: (typeof TRIGGERS)[number],
): McsSimulationState {
  return settle(mcsReducer(state, { type: 'SET_IABP_CONTROL', control: 'triggerSource', value }))
}

// ── A. The atrial-fibrillation trigger false-success pathway ─────────────────

describe('F19 — no surface answers a trigger choice in atrial fibrillation with a success', () => {
  it('reproduces the ranking this containment exists for, across rhythm and balloon state', () => {
    const af = afTransferState()
    const sinus = settle(createInitialMcsState('learn', 'iabp', null, 417))
    const read = (state: McsSimulationState) => ({
      synchrony: state.metrics.timingQualityPercent,
      triggerAlarm: state.alarms.some(
        (alarm) => alarm.id === 'iabp-trigger-unreliable' && alarm.active,
      ),
    })

    expect(TRIGGERS.map((trigger) => read(withTrigger(af, trigger)))).toEqual([
      { synchrony: 50, triggerAlarm: true },
      { synchrony: 74, triggerAlarm: false },
      { synchrony: 40, triggerAlarm: true },
    ])
    // The controlled rhythm, same offsets, same ratio, same elapsed time.
    expect(TRIGGERS.map((trigger) => read(withTrigger(sinus, trigger)))).toEqual([
      { synchrony: 100, triggerAlarm: false },
      { synchrony: 90, triggerAlarm: false },
      { synchrony: 62, triggerAlarm: false },
    ])
    // A stopped balloon rates nothing and raises no trigger alarm, on any source.
    const stopped = settle(
      mcsReducer(af, { type: 'SET_IABP_CONTROL', control: 'running', value: false }),
    )
    expect(TRIGGERS.map((trigger) => read(withTrigger(stopped, trigger)))).toEqual([
      { synchrony: 0, triggerAlarm: false },
      { synchrony: 0, triggerAlarm: false },
      { synchrony: 0, triggerAlarm: false },
    ])
  })

  it('holds exactly the two atrial-fibrillation timing conditions and nothing else', () => {
    const held = allMcsScenarios.flatMap((scenario) =>
      scenario.successCriteria
        .filter((criterion) => criterion.classification.held)
        .map((criterion) => [scenario.id, criterion.metric, criterion.value] as const),
    )
    expect(held).toEqual([
      ['IABP-02', 'timingQualityPercent', 60],
      ['CAP-IABP-01', 'timingQualityPercent', 65],
    ])
    for (const [scenarioId] of held) {
      expect(mcsScenarioById.get(scenarioId)!.initialPatient.rhythm).toBe('atrial-fibrillation')
    }
  })

  it('scores a held condition neither way, so no trigger choice is rewarded', () => {
    for (const id of ['IABP-02', 'CAP-IABP-01']) {
      const opening = caseState(id)
      const totals = TRIGGERS.map((trigger) => calculateMcsScore(withTrigger(opening, trigger)))
      expect(new Set(totals.map((score) => score.response)).size).toBe(1)
      expect(new Set(totals.map((score) => score.total)).size).toBe(1)
    }
    // The control: a case with no held condition still responds to its own criteria.
    const iabp01 = caseState('IABP-01')
    expect(
      calculateMcsScore(
        settle(
          mcsReducer(iabp01, {
            type: 'SET_IABP_CONTROL',
            control: 'inflationOffsetMs',
            value: -170,
          }),
        ),
      ).response,
    ).toBeLessThan(calculateMcsScore(iabp01).response)
  })

  it('never reports a held condition as reached, on any trigger, in either case', () => {
    for (const id of ['IABP-02', 'CAP-IABP-01']) {
      const scenario = mcsScenarioById.get(id)!
      for (const trigger of TRIGGERS) {
        const state = mcsReducer(withTrigger(caseState(id), trigger), { type: 'COMPLETE' })
        const view = render(<McsCaseWorkflow state={state} dispatch={jest.fn()} />)
        const panel = view.container.querySelector<HTMLElement>('[data-worked-explanation]')!
        const heldEntry = panel.querySelector<HTMLElement>('[data-condition-held="true"]')!
        expect(heldEntry).not.toBeNull()
        expect(heldEntry.textContent).toContain(MCS_AF_TRIGGER_CONTAINMENT.conditionHoldReason)
        expect(heldEntry.textContent).toContain(MCS_AF_TRIGGER_CONTAINMENT.openItemId)
        expect(heldEntry.textContent).toContain('NOT REVIEWED')
        // No met/achieved/success signal anywhere in the worked explanation.
        expect(panel.textContent).not.toMatch(/\b(met|achieved|passed|success|well done)\b/i)
        expect(scenario.successCriteria.some((c) => c.classification.held)).toBe(true)
        view.unmount()
      }
    }
  })

  it('keeps the alarm bar from reading as an all-clear while the rating is held', () => {
    const af = withTrigger(afTransferState(), 'pressure')
    expect(af.alarms.filter((alarm) => alarm.active)).toHaveLength(0)
    const view = render(<McsMonitor state={af} />)
    const bar = view.container.querySelector<HTMLElement>('[data-monitor-target="monitor:alarms"]')!
    expect(bar.querySelector('[data-af-trigger-held]')).not.toBeNull()
    expect(bar.textContent).toContain(MCS_AF_TRIGGER_CONTAINMENT.notAnAllClear)
    view.unmount()

    // The control: a quiet bar in sinus rhythm says only what it says.
    const sinus = render(
      <McsMonitor state={settle(createInitialMcsState('learn', 'iabp', null, 417))} />,
    )
    expect(sinus.container.querySelector('[data-af-trigger-held]')).toBeNull()
  })

  it('does not narrate the figure as a result in the causal caption', () => {
    const af = withTrigger(afTransferState(), 'pressure')
    expect(af.causalExplanation).toContain('its own timing index, not a console reading')
    expect(af.causalExplanation).toContain(MCS_AF_TRIGGER_LIMIT.heldLead)
    expect(af.causalExplanation).not.toMatch(/^Counterpulsation is \d+% synchronized\./)

    const sinus = settle(createInitialMcsState('learn', 'iabp', null, 417))
    expect(sinus.causalExplanation).toContain('its own timing index, not a console reading')
    expect(sinus.causalExplanation).not.toContain(MCS_AF_TRIGGER_LIMIT.heldLead)
  })

  it('offers all three ratings at once, derived from the engine, without touching the session', () => {
    const af = afTransferState()
    const comparison = mcsAfTriggerComparison(af)!
    expect(comparison.ratings.map((rating) => [rating.source, rating.synchronyPercent])).toEqual([
      ['ecg', 50],
      ['pressure', 74],
      ['internal', 40],
    ])
    // One matched instant for all three, and the settings the caption claims.
    expect(comparison.observedAtSeconds).toBeCloseTo(af.timeSeconds + 5, 5)
    expect(comparison.assistRatio).toBe(af.device.kind === 'iabp' ? af.device.assistRatio : -1)

    // Reading the comparison is not performing work.
    const before = {
      actions: [...af.actionIds],
      trigger: (af.device as { triggerSource: string }).triggerSource,
    }
    mcsAfTriggerComparison(af)
    expect(af.actionIds).toEqual(before.actions)
    expect((af.device as { triggerSource: string }).triggerSource).toBe(before.trigger)

    expect(
      mcsAfTriggerComparison(settle(createInitialMcsState('learn', 'iabp', null, 417))),
    ).toBeNull()
    expect(
      mcsAfTriggerComparison(settle(createInitialMcsState('learn', 'lvad', null, 417))),
    ).toBeNull()
  })

  it('puts the comparison and the checked labeling at the control, open, in both selectors', () => {
    const view = render(<McsControls state={afTransferState()} dispatch={jest.fn()} />)
    const note = view.container.querySelector<HTMLElement>('[data-af-trigger-limit]')!
    const comparison = note.querySelector<HTMLDetailsElement>('[data-af-trigger-comparison]')!
    expect(comparison.open).toBe(true)
    expect(comparison.textContent).toContain(MCS_AF_TRIGGER_LIMIT.deviceLabeling)
    expect(comparison.textContent).toContain('NOT REVIEWED')
    for (const source of TRIGGERS) {
      expect(comparison.querySelector(`[data-af-trigger-rating="${source}"]`)).not.toBeNull()
    }
    // It recommends nothing and grades nothing.
    expect(comparison.querySelectorAll('button, input, select').length).toBe(0)
  })

  it('leaves the transfer step continuable, retryable and ungraded on the trigger', () => {
    setupMcsStage()
    try {
      mountSection('iabp-timing-triggering', 'transfer')
      const trigger = screen.getByRole('combobox', { name: 'Trigger source' }) as HTMLSelectElement
      for (const value of TRIGGERS) {
        fireEvent.change(trigger, { target: { value } })
        const live = screen.getByRole('combobox', { name: 'Trigger source' }) as HTMLSelectElement
        expect(live.disabled).toBe(false)
        expect(document.querySelector('[data-af-trigger-limit]')).not.toBeNull()
      }
      // Containment is not a lock: the way on and the way back are both still there.
      expect(nowPrimary()).not.toBeNull()
      expect((nowPrimary() as HTMLButtonElement).disabled).toBe(false)
      expect(document.querySelector('[data-transfer-work]')).not.toBeNull()
      // The context strip does not answer a trigger choice with an all-clear.
      expect(document.body.textContent).not.toContain('No active alarm')
      expect(document.body.textContent).toContain(MCS_AF_TRIGGER_CONTAINMENT.notAnAllClear)
    } finally {
      teardownMcsStage()
    }
  })

  it('leaves the transfer work predicate and the exercise identities as MCS-03 left them', () => {
    const transfer = mcsLessonTransferByLessonId.get('iabp-timing-triggering')!
    const af = afTransferState()
    expect(TRIGGERS.map((trigger) => transfer.isWorkSatisfied!(withTrigger(af, trigger)))).toEqual([
      true,
      true,
      true,
    ])
    const stopped = settle(
      mcsReducer(af, { type: 'SET_IABP_CONTROL', control: 'running', value: false }),
    )
    expect(transfer.isWorkSatisfied!(stopped)).toBe(false)
    expect(transfer.item.correctChoiceIds).toEqual(['compare-trigger-to-waveform'])
    expect(transfer.item.choices.map((choice) => choice.id)).toEqual([
      'compare-trigger-to-waveform',
      'assume-ecg',
      'increase-ratio',
    ])
    expect(transfer.item.choices.find((c) => c.id === 'assume-ecg')!.plausibility).toBe(
      'reasonable-but-incomplete',
    )
  })
})

// ── B. The story problems' baseline identity ─────────────────────────────────

describe('F26 — a story says which patient it starts from, before it asks', () => {
  const pair = mcsStoryProblems.filter((story) => story.sectionId === 'impella-suction-purge-rv')

  it('shares one named baseline across the pair, at matched values and elapsed time', () => {
    expect(pair).toHaveLength(2)
    expect(new Set(pair.map((story) => story.baselineId)).size).toBe(1)
    const [first, second] = pair.map(mcsStoryBaseline)
    expect(first.timeSeconds).toBe(second.timeSeconds)
    for (const key of ['rapMmHg', 'pcwpMmHg', 'mapMmHg', 'leftDeviceFlowLMin'] as const) {
      expect(first.metrics[key]).toBe(second.metrics[key])
    }
  })

  it('is a different patient from the section around it, and shows its own numbers', () => {
    const section = mcsSectionLearningContractById.get('impella-suction-purge-rv')!
    const live = settle(
      apply(createInitialMcsState('learn', section.startingDevice, null, 417), [
        ...section.startingActions,
      ]),
    )
    const story = mcsStoryBaseline(pair[0])
    // The report's reading: the section's patient and the story's are not the same circulation.
    expect(story.patient.rightVentricularContractility).not.toBe(
      live.patient.rightVentricularContractility,
    )
    expect(story.patient.preloadPercent).not.toBe(live.patient.preloadPercent)

    const view = render(<McsStoryProblems stories={[pair[0]]} />)
    const panel = view.container.querySelector<HTMLElement>('[data-story-baseline]')!
    expect(panel.querySelector('[data-story-baseline-id]')!.textContent).toBe(pair[0].baselineId)
    expect(panel.querySelector('[data-story-baseline-metric="rapMmHg"]')!.textContent).toContain(
      story.metrics.rapMmHg.toFixed(0),
    )
    expect(panel.querySelector('[data-story-baseline-metric="pcwpMmHg"]')!.textContent).toContain(
      story.metrics.pcwpMmHg.toFixed(0),
    )
    expect(
      panel.querySelector('[data-story-baseline-metric="leftDeviceFlowLMin"]')!.textContent,
    ).toContain(story.metrics.leftDeviceFlowLMin.toFixed(1))
    expect(panel.querySelector('[data-story-baseline-setting]')!.textContent).toContain('P7')
    expect(panel.querySelector('[data-story-baseline-time]')!.textContent).toContain(
      story.timeSeconds.toFixed(2),
    )
    // The report's suggested numbers were a guess; these are the model's.
    expect(panel.textContent).not.toContain('RAP 5')
  })

  it('shows the baseline before the question, not after the answer', () => {
    const view = render(<McsStoryProblems stories={[pair[1]]} />)
    const panel = view.container.querySelector('[data-story-baseline]')!
    const question = view.container.querySelector('[data-story-choices]')!
    expect(panel.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(view.container.querySelector('[data-story-run]')).toBeNull()
  })

  it('states the scope of the loading change and implies no dose, rate or fluid recommendation', () => {
    const volume = pair.find((story) => story.id === 'story-volume-for-suction')!
    expect(volume.changeScope).toMatch(/55 per cent to 100 per cent/)
    expect(volume.changeScope).toMatch(/not a specified bolus/i)
    const view = render(<McsStoryProblems stories={[volume]} />)
    const text = view.container.querySelector('[data-story-change-scope]')!.textContent!
    expect(text).not.toMatch(/\b\d+\s*(mL|ml|millilitres|cc)\b/)
    expect(text).not.toMatch(/bolus of|give \d|over \d+ minutes/i)
  })

  it('survives reverse replay order and a deliberately changed live session', () => {
    const forward = pair.map(mcsStoryBaseline).map((state) => state.metrics.rapMmHg)
    const reverse = [...pair]
      .reverse()
      .map(mcsStoryBaseline)
      .map((state) => state.metrics.rapMmHg)
    expect(reverse).toEqual([...forward].reverse())

    // A live session moved a long way from the story's setup changes nothing about the story.
    const live = settle(
      apply(createInitialMcsState('learn', 'impella', null, 417), [
        { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 140 },
        { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 2 },
      ]),
    )
    expect(live.patient.preloadPercent).toBe(140)
    expect(mcsStoryBaseline(pair[0]).patient.preloadPercent).toBe(55)
    expect(live.patient.preloadPercent).toBe(140)
    expect(live.actionIds).not.toContain('impella:left:set-level-9')
  })

  it('records no work and keeps the run reproducible', () => {
    const before = window.localStorage.length
    const view = render(<McsStoryProblems stories={[pair[0]]} />)
    expect(view.container.querySelectorAll('input:checked')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Run it on a copy of the circulation' }))
    const run = runMcsStory(pair[0])
    expect(view.container.querySelector('[data-story-run]')!.textContent).toContain(
      run.after.metrics.leftDeviceFlowLMin.toFixed(1),
    )
    expect(view.container.querySelectorAll('input:checked')).toHaveLength(0)
    expect(window.localStorage.length).toBe(before)
  })
})

// ── C. Numbers and device claims ─────────────────────────────────────────────

describe('F33 — every numerical condition in the twelve cases says what kind of claim it is', () => {
  it('classifies all twenty-one, and lets none claim clinical support without a scoped source', () => {
    const conditions = allMcsScenarios.flatMap((scenario) =>
      scenario.successCriteria.map((criterion) => ({ scenario: scenario.id, criterion })),
    )
    expect(allMcsScenarios).toHaveLength(12)
    expect(conditions).toHaveLength(21)
    for (const { scenario, criterion } of conditions) {
      const classification = criterion.classification
      expect(typeof classification.kind).toBe('string')
      expect(classification.quantity.length).toBeGreaterThan(0)
      if (classification.kind === 'source-supported-clinical') {
        expect(mcsSources.some((source) => source.id === classification.sourceId)).toBe(true)
        expect(classification.scope?.length ?? 0).toBeGreaterThan(0)
      } else {
        expect(classification.sourceId).toBeUndefined()
      }
      expect(scenario).toBeTruthy()
    }
    // As of this slice no condition has a clinical source behind it. OD-04 owns any that gain one.
    expect(
      conditions.filter(
        (entry) => entry.criterion.classification.kind !== 'authored-model-condition',
      ),
    ).toHaveLength(0)
  })

  it('prints the classification beside the number in every one of the twelve cases', () => {
    for (const scenario of allMcsScenarios) {
      const state = mcsReducer(
        settle(createInitialMcsState('practice', scenario.device, scenario, 417)),
        { type: 'COMPLETE' },
      )
      const view = render(<McsCaseWorkflow state={state} dispatch={jest.fn()} />)
      const panel = view.container.querySelector<HTMLElement>('[data-worked-explanation]')!
      expect(panel.querySelector('[data-condition-contract]')!.textContent).toMatch(
        /not a treatment target/,
      )
      const entries = panel.querySelectorAll('[data-condition-list] > li')
      expect(entries).toHaveLength(scenario.successCriteria.length)
      entries.forEach((entry, index) => {
        const criterion = scenario.successCriteria[index]
        expect(entry.textContent).toContain(criterion.label)
        expect(entry.getAttribute('data-condition-class')).toBe(criterion.classification.kind)
        expect(entry.textContent).toContain('Authored for this simulation')
        expect(entry.textContent).toContain(criterion.classification.quantity)
      })
      // No universal target was substituted for the authored numbers.
      expect(panel.textContent).not.toContain('MAP ≥65')
      view.unmount()
    }
  })

  it('keeps the model-only synchrony index off the device-display level', () => {
    const levelled = [
      ...[...mcsSectionLearningContractById.values()].flatMap((contract) =>
        contract.observedSignals.map((signal) => [signal.key, signal.level] as const),
      ),
      ...[...mcsLessonTransferByLessonId.values()]
        .filter((transfer) => transfer.observation)
        .map((transfer) => [transfer.observation!.key, transfer.observation!.level] as const),
    ]
    const timing = levelled.filter(([key]) => key === 'timingQualityPercent')
    expect(timing.length).toBeGreaterThan(0)
    expect(timing.every(([, level]) => level === 'model-index')).toBe(true)
    // The quantities a console does report keep their level.
    expect(
      levelled.some(([key, level]) => key === 'pumpPowerW' && level === 'device-display'),
    ).toBe(true)
  })
})

describe('F04 — the monitor says which number is which', () => {
  it('names the strip readouts instantaneous and the tiles modeled means', () => {
    const state = settle(createInitialMcsState('learn', 'iabp', null, 417))
    const view = render(<McsMonitor state={state} />)
    const art = screen.getByRole('img', { name: /^ART waveform/ })
    expect(art.getAttribute('aria-label')).toMatch(/instantaneous sample/)
    expect(
      view.container.querySelectorAll('[data-readout-window="instantaneous"]').length,
    ).toBeGreaterThanOrEqual(4)

    const tile = (label: string) =>
      [...view.container.querySelectorAll('[aria-label="Current hemodynamic values"] > div')].find(
        (node) => node.querySelector('span')?.textContent === label,
      )!
    expect(tile('MAP / PP').textContent).toContain('modeled mean')
    expect(tile('RAP / PCWP').textContent).toContain('modeled mean')
    expect(tile('TIMING').getAttribute('data-quantity-class')).toBe('model-index')
    expect(tile('TIMING').textContent).toContain('no console reports this')
    // The physical values are unchanged: the strip and the tile still differ.
    expect(state.waveforms.at(-1)!.arterialMmHg).not.toBe(state.metrics.mapMmHg)
  })
})

// ── F27 / F28. The durable-pump reference and the device framing ─────────────

describe('F27 / F28 — the durable reference is named, and the estimator direction is not', () => {
  const section7 = mcsSectionLearningContractById.get('lvad-parameters-assessment')!
  const section8 = mcsSectionLearningContractById.get('lvad-alarms-emergencies')!

  it('reproduces the elevated reference pressure and does not call it normal', () => {
    const reference = settle(createInitialMcsState('learn', 'lvad', null, 417))
    expect(reference.metrics.mapMmHg).toBeGreaterThan(100)
    expect(reference.alarms.filter((alarm) => alarm.active)).toHaveLength(0)
    expect(section7.startingContext).not.toMatch(/reading normally/)
    expect(section7.startingContext).toMatch(/Steady is not the same as normal/)
    expect(section7.startingContext).toMatch(/not adopted as this module’s target/)
    expect(section7.startingContext).toMatch(/OD-02/)
    expect(section8.startingContext).toMatch(/not a target/)
  })

  it('separates this model’s power-from-flow from the card’s flow-from-power', () => {
    /*
     * Matched elapsed time, one fork. Settling the high-power branch on top of an already-settled
     * control would compare eight seconds against sixteen, and the small drift between them would
     * read as the flag moving the flow when it does not.
     */
    const base = createInitialMcsState('learn', 'lvad', null, 417)
    const branch = (value: boolean) =>
      settle(
        mcsReducer(base, { type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value }),
      )
    // Both branches take the same control dispatch, so they also take its refresh step: the only
    // difference between them is the flag.
    const rest = branch(false)
    const highPower = branch(true)
    expect(highPower.timeSeconds).toBeCloseTo(rest.timeSeconds, 5)
    // The model's behaviour, reproduced: power moves, the displayed flow does not.
    expect(highPower.metrics.pumpPowerW!).toBeGreaterThan(rest.metrics.pumpPowerW! + 2)
    expect(highPower.metrics.deviceFlowLMin).toBe(rest.metrics.deviceFlowLMin)

    const card = mcsSources.find(
      (source) => source.id === 'abbott-heartmate3-pump-parameters-card',
    )!
    expect(card.sourceType).toBe('manufacturer')
    expect(card.intendedUse).toMatch(/fixed speed, power and the patient’s hematocrit/)
    expect(card.limitation).toMatch(/no estimator equation/)
    for (const text of [
      section8.teaching.flowAccountNote,
      section8.explanation,
      section7.recognizeOptions.find((option) => option.id === 'from-power-and-speed')!.feedback,
    ]) {
      expect(text).toMatch(/(fixed )?speed, power and (the patient’s )?hematocrit/)
    }
    expect(section8.teaching.flowAccountNote).toMatch(/OD-02/)
    // No reverse-engineered controller is claimed anywhere.
    expect(section8.teaching.flowAccountNote).toMatch(/gives no estimator equation/)
    // The card is attached to the durable-support evidence set the section's items cite.
    expect(section8.predictionItem.evidenceIds).toContain('abbott-heartmate3-pump-parameters-card')
  })
})

// ── F18. The false "unannotated" claim ───────────────────────────────────────

describe('F18 — no screen claims unannotated while the annotated reference is on it', () => {
  const contract = mcsSectionLearningContractById.get('iabp-timing-triggering')!

  it('removes the claim from the copy without concealing the landmarks or the alarm', () => {
    expect(contract.recognizePrompt).not.toMatch(/unannotated/i)
    expect(contract.startingContext).not.toMatch(/unannotated/i)
    expect(contract.recognizePrompt).toMatch(/annotated Timing reference/)

    setupMcsStage()
    try {
      mountSection('iabp-timing-triggering', 'recognize')
      // The recognize step is reached past the guided demonstrations; that is the step whose
      // prompt claimed an unannotated example.
      completeIntroductorySteps('iabp-timing-triggering')
      expect(document.body.textContent).toContain(contract.recognizePrompt)
      const figure = document.querySelector<HTMLElement>('[data-timing-figure]')!
      // What is actually rendered is the annotated reference: the copy now matches it.
      expect(figure.getAttribute('data-timing-figure')).toBe('reference')
      expect(figure.textContent).toContain('Annotated demonstration')
      expect(figure.querySelectorAll('[data-iabp-landmark]').length).toBeGreaterThan(0)
      expect(document.body.textContent).not.toMatch(/unannotated/i)
      // The model's own alarm is still reachable and still true: nothing was hidden.
      expect(document.body.textContent).toContain('Inflation before aortic-valve closure')
      // The recognize options are unchanged.
      expect(contract.recognizeOptions.map((option) => option.id)).toEqual([
        'raises-impedance',
        'loses-augmentation',
        'no-effect',
      ])
    } finally {
      teardownMcsStage()
    }
  })
})

// ── D. The hub, and the shared verdict component ─────────────────────────────

describe('F01 — the module’s light theme does not inherit the site’s dark foreground', () => {
  it('pins the light frame inside the MCS shell to the shell’s own ink and paper', () => {
    const css = readFileSync(
      join(FEATURE_ROOT, 'components/mechanical-circulatory-support.module.css'),
      'utf8',
    )
    const rule = css.match(
      /\.moduleShell \[data-learning-module-v2-theme-root\]\[data-theme='light'\] \{([^}]*)\}/,
    )
    expect(rule).not.toBeNull()
    const body = rule![1]
    for (const token of [
      '--lm-v2-surface',
      '--lm-v2-panel',
      '--lm-v2-panel-muted',
      '--lm-v2-border',
      '--lm-v2-text',
      '--lm-v2-muted',
    ]) {
      expect(body).toContain(`${token}:`)
    }
    expect(body).toContain('--lm-v2-text: var(--ink)')
    expect(body).toContain('color-scheme: light')
    // The stage's dark theme is untouched by the rule.
    expect(body).not.toContain("data-theme='dark'")
    // The route-card eyebrow reads on the tinted card it sits on.
    expect(css).toContain('--teal-text: #0f6f6b')
    expect(css).toMatch(/\.routeGrid article > span \{\s*color: var\(--teal-text/)
  })
})

describe('F09 — the shared alternatives heading, and which component MCS actually renders', () => {
  /*
   * The EBUS pre-review fixed the key-aware heading on `AnswerVerdict`. MCS renders
   * `ChoiceReasoningFeedback` on all three of its verdict surfaces and `AnswerVerdict` on none, so
   * that fix does not reach this module. Neither shared component is edited or forked here: these
   * tests record the exact consumers and preserve their reasoning and source contract. The
   * key-aware heading repair remains a shared-owner follow-up; the current incorrect heading is
   * not an invariant and a future shared repair must not break these consumer tests.
   */
  const read = (relative: string) => readFileSync(join(FEATURE_ROOT, relative), 'utf8')

  it('names the three MCS surfaces that consume ChoiceReasoningFeedback', () => {
    const consumers = ['components/stage/McsStageHost.tsx', 'components/stage/McsStoryProblems.tsx']
    for (const file of consumers) {
      expect(read(file)).toContain(
        "import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'",
      )
    }
    expect(
      read('components/stage/McsStageHost.tsx').split('<ChoiceReasoningFeedback').length - 1,
    ).toBe(2)
    expect(
      read('components/stage/McsStoryProblems.tsx').split('<ChoiceReasoningFeedback').length - 1,
    ).toBe(1)
    // No MCS surface renders AnswerVerdict, so the EBUS heading fix is not reached from here.
    for (const file of consumers) expect(read(file)).not.toContain('<AnswerVerdict')
  })

  it('keeps keyed and non-keyed reasoning reachable regardless of the shared heading repair', () => {
    const story = mcsStoryProblems[0]
    for (const choice of story.item.choices) {
      const view = render(<McsStoryProblems stories={[story]} />)
      fireEvent.click(screen.getByRole('radio', { name: choice.label }))
      fireEvent.click(screen.getByRole('button', { name: 'Compare prediction' }))
      const verdict = view.container.querySelector<HTMLElement>('[data-story-verdict]')!
      expect(verdict).toHaveTextContent(choice.rationale)
      const alternatives = verdict.querySelector('[data-other-answers-panel]')!
      for (const other of story.item.choices.filter((candidate) => candidate.id !== choice.id)) {
        expect(alternatives).toHaveTextContent(other.label)
        expect(alternatives).toHaveTextContent(other.rationale)
      }
      expect(within(verdict).getByText('Sources')).toBeInTheDocument()
      expect(verdict.querySelector('a[href]')).not.toBeNull()
      view.unmount()
    }
  })

  it('keeps the verdict’s own outcomes and sources on every MCS surface that renders it', () => {
    const story = mcsStoryProblems[0]
    const view = render(<McsStoryProblems stories={[story]} />)
    fireEvent.click(view.container.querySelectorAll('input[type="radio"]')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Compare prediction' }))
    const verdict = view.container.querySelector<HTMLElement>('[data-story-verdict]')!
    expect(verdict.querySelector('[data-verdict-outcome-label]')).not.toBeNull()
    expect(within(verdict).getByText('Sources')).toBeInTheDocument()
    expect(verdict.querySelector('[data-other-answers-panel]')).not.toBeNull()
    expect(verdict.querySelectorAll('[data-other-answer]').length).toBe(
      story.item.choices.length - 1,
    )
  })
})
