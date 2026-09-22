/**
 * MCS-AF-PRESENTATION-01 — the atrial-fibrillation trigger limitation, where the trigger is chosen.
 *
 * MCS-03 wrote the limitation (claim-review queue `MCS-03-05`, still `NOT REVIEWED`) and held the
 * model. It reached the learner only in the transfer exercise label, the transfer explanation and
 * the two worked case explanations — never beside the trigger selector itself, because the timing
 * panel that carries the boundary is not mounted on the Learn route for an introductory section.
 *
 * These tests hold two things apart. The presentation is new and asserted through the interface: the
 * note is on screen at the control, before any trigger choice, wherever the modeled rhythm is atrial
 * fibrillation. Everything the model does is pinned to the figures in the MCS-03 queue replay, so a
 * later recalibration re-opens that item instead of passing here silently. Nothing in this file is
 * clinical approval.
 */
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

import { McsControls } from '../components/McsControls'
import { McsTeachingPanel } from '../components/teaching/McsTeachingPanel'
import { MCS_AF_TRIGGER_LIMIT, mcsAfTriggerLimitApplies } from '../content/afTriggerLimit'
import { mcsLessonTransferByLessonId } from '../content/lessonTransfers'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { createInitialMcsState, mcsReducer } from '../engine'
import { MCS_LOCAL_PROGRESS_KEY } from '../engine/learningProgress'
import type { McsAction, McsDeviceKind, McsSimulationState } from '../engine'
import { mountSection, setupMcsStage, teardownMcsStage } from '../test-support/mcsStage'

/** The MCS-03 replay: learn mode, seed 417, 0.2 s steps, settled for 8 s. */
function settle(state: McsSimulationState, seconds = 8): McsSimulationState {
  let next = state
  for (let step = 0; step < seconds * 5; step += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.2 })
  }
  return next
}

function build(device: McsDeviceKind, actions: readonly McsAction[]): McsSimulationState {
  let state = createInitialMcsState('learn', device, null, 417)
  for (const action of actions) state = mcsReducer(state, action)
  return settle(state)
}

function withTrigger(
  state: McsSimulationState,
  value: 'ecg' | 'pressure' | 'internal',
): McsSimulationState {
  return settle(mcsReducer(state, { type: 'SET_IABP_CONTROL', control: 'triggerSource', value }))
}

const transfer = mcsLessonTransferByLessonId.get('iabp-timing-triggering')!
const afSetup = () => build(transfer.setupDevice, transfer.setupActions)

const limitNote = () => document.querySelector<HTMLElement>('[data-af-trigger-limit]')

function scenarioById(id: string) {
  const found = [...mcsPracticeScenarios, ...mcsCapstoneScenarios].find(
    (candidate) => candidate.id === id,
  )
  if (!found) throw new Error(`No scenario ${id}`)
  return found
}

/** A case's opening state, as the workbench builds it, without performing any action. */
function caseOpeningState(id: string): McsSimulationState {
  const scenario = scenarioById(id)
  return settle(createInitialMcsState('practice', scenario.device, scenario, 417))
}

// ── Where the learner meets it ───────────────────────────────────────────────

describe('the limitation is at the trigger control, before the trigger is chosen', () => {
  beforeEach(() => setupMcsStage())
  afterEach(() => teardownMcsStage())

  it('is on the Learn transfer step, with the selector still on ECG and no work performed', () => {
    mountSection('iabp-timing-triggering', 'transfer')

    const note = limitNote()
    expect(note).not.toBeNull()
    // The three things a learner needs before the control: what the model does, what the checked
    // labeling says, and that the disagreement is held rather than settled.
    expect(note!.textContent).toContain(MCS_AF_TRIGGER_LIMIT.modelRating)
    expect(note!.textContent).toContain(MCS_AF_TRIGGER_LIMIT.deviceLabeling)
    expect(note!.textContent).toContain(MCS_AF_TRIGGER_LIMIT.heldLead)
    expect(note!.textContent).toContain(MCS_AF_TRIGGER_LIMIT.atTheControl)

    const trigger = screen.getByRole('combobox', { name: 'Trigger source' }) as HTMLSelectElement
    expect(trigger.value).toBe('ecg')
    expect(trigger.disabled).toBe(false)
    /*
     * Read out with the control, not merely printed near it.
     *
     * MCS-PRE-REVIEW-01 added the three-way worked comparison inside the note, and moved the id
     * from the note's root to the paragraph carrying the sentences: a description that swallowed
     * the comparison table would read the whole table out on every focus. The guarantee this
     * assertion protects — the control's description resolves to the limitation's own words — is
     * unchanged, so it is now checked against the element the id actually sits on.
     */
    const describedBy = trigger.getAttribute('aria-describedby')
    expect(describedBy).not.toBe('')
    expect(describedBy).not.toBeNull()
    const description = document.getElementById(describedBy!)
    expect(note!.contains(description)).toBe(true)
    expect(description!.textContent).toContain(MCS_AF_TRIGGER_LIMIT.modelRating)
    expect(description!.textContent).toContain(MCS_AF_TRIGGER_LIMIT.atTheControl)
    // Nothing has been performed yet: the note precedes the choice, it does not report on it.
    expect(document.querySelector('[data-transfer-work-status]')?.textContent).toBe(
      'You can explore any controls or continue without performing the suggested exercise.',
    )
    expect(document.querySelector('[data-transfer-work]')?.getAttribute('data-met')).toBe('false')
  })

  it('stays on screen whichever trigger the learner then selects, and all three stay selectable', () => {
    mountSection('iabp-timing-triggering', 'transfer')
    const trigger = screen.getByRole('combobox', { name: 'Trigger source' }) as HTMLSelectElement
    expect([...trigger.options].map((option) => option.value)).toEqual([
      'ecg',
      'pressure',
      'internal',
    ])

    for (const value of ['pressure', 'ecg', 'internal', 'ecg'] as const) {
      fireEvent.change(trigger, { target: { value } })
      const live = screen.getByRole('combobox', { name: 'Trigger source' }) as HTMLSelectElement
      expect({ value: live.value, disabled: live.disabled, noted: limitNote() !== null }).toEqual({
        value,
        disabled: false,
        noted: true,
      })
    }
  })

  it('carries nothing to answer and nothing to dismiss, and opens its comparison by default', () => {
    mountSection('iabp-timing-triggering', 'transfer')
    /*
     * This assertion used to forbid a `details` too. MCS-PRE-REVIEW-01 requires the model
     * limitation and the source-specific teaching to be reachable at the moment of the choice, and
     * the three-way comparison it added is a disclosure — but a read-only one, open on arrival.
     * What the assertion was protecting is intact and is now stated directly: the note answers
     * nothing, records nothing, and cannot be dismissed into hiding the limitation.
     */
    const note = limitNote()!
    expect(note.querySelectorAll('button, input, select, a').length).toBe(0)
    const disclosures = [...note.querySelectorAll('details')]
    expect(disclosures.length).toBe(1)
    expect(disclosures[0].open).toBe(true)
    expect(disclosures[0].hasAttribute('data-af-trigger-comparison')).toBe(true)
  })

  it('reopens the step with the note and no fabricated trigger action, and writes no work', () => {
    const first = mountSection('iabp-timing-triggering', 'transfer')
    fireEvent.change(screen.getByRole('combobox', { name: 'Trigger source' }), {
      target: { value: 'pressure' },
    })
    first.unmount()

    mountSection('iabp-timing-triggering', 'transfer')
    const reopened = screen.getByRole('combobox', { name: 'Trigger source' }) as HTMLSelectElement
    expect(reopened.value).toBe('ecg')
    expect(limitNote()).not.toBeNull()
    expect(document.querySelector('[data-transfer-work]')?.getAttribute('data-met')).toBe('false')

    // The record is still the location record MCS-01 defined: it exists, and it holds nothing else.
    const stored = JSON.parse(window.localStorage.getItem(MCS_LOCAL_PROGRESS_KEY) ?? '{}') as {
      selfPaced?: Record<string, unknown>
    }
    const record = stored.selfPaced ?? {}
    expect(record.lastActivityId).toBe('iabp-timing-triggering')
    expect(record.lastPhase).toBe('transfer')
    expect(Object.keys(record).sort()).toEqual([
      'lastActivityId',
      'lastDevice',
      'lastPhase',
      'lastSection',
      'locationUpdatedAt',
      'visitedCaseIds',
      'visitedLessonIds',
    ])
  })

  it('leaves the transfer question, its feedback, Try again and Continue exactly as they were', () => {
    mountSection('iabp-timing-triggering', 'transfer')
    const keepEcg = transfer.item.choices.find((choice) => choice.id === 'assume-ecg')!
    const card = document.querySelector<HTMLElement>('[data-now-card]')!

    fireEvent.click(within(card).getByLabelText(new RegExp(keepEcg.label.slice(0, 60))))
    fireEvent.click(within(card).getByRole('button', { name: 'Compare answer' }))

    const verdict = document.querySelector<HTMLElement>('[data-verdict]')!
    expect(verdict.textContent).toContain(keepEcg.rationale)
    expect(within(card).getByRole('button', { name: 'Try again' })).not.toBeDisabled()
    const primary = document.querySelector<HTMLButtonElement>('[data-now-primary]')
    expect(primary?.disabled ?? false).toBe(false)
    // The note is beside the control, not inside the answer or its feedback.
    expect(verdict.querySelector('[data-af-trigger-limit]')).toBeNull()
    expect(limitNote()).not.toBeNull()
  })
})

describe('it follows the modeled rhythm, not a lesson or case id', () => {
  it('applies to an IABP in atrial fibrillation and to nothing else', () => {
    expect(mcsAfTriggerLimitApplies(afSetup())).toBe(true)
    expect(mcsAfTriggerLimitApplies(build('iabp', []))).toBe(false)
    expect(
      mcsAfTriggerLimitApplies(
        build('impella', [{ type: 'SET_RHYTHM', rhythm: 'atrial-fibrillation' }]),
      ),
    ).toBe(false)
    expect(mcsAfTriggerLimitApplies(build('iabp', [{ type: 'SET_RHYTHM', rhythm: 'paced' }]))).toBe(
      false,
    )
  })

  it('renders in the full control panel only for that combination', () => {
    const af = render(<McsControls state={afSetup()} dispatch={jest.fn()} />)
    const note = af.container.querySelector<HTMLElement>('[data-af-trigger-limit]')
    expect(note).not.toBeNull()
    const describedBy = af.container
      .querySelector<HTMLSelectElement>('[data-mcs-control="control:iabp-trigger"] select')
      ?.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    // See the transfer-step assertion above: the id sits on the note's sentences, not its root.
    expect(note!.contains(af.container.querySelector(`#${describedBy}`))).toBe(true)
    af.unmount()

    const sinus = render(<McsControls state={build('iabp', [])} dispatch={jest.fn()} />)
    expect(sinus.container.querySelector('[data-af-trigger-limit]')).toBeNull()
    expect(
      sinus.container
        .querySelector<HTMLSelectElement>('[data-mcs-control="control:iabp-trigger"] select')
        ?.getAttribute('aria-describedby'),
    ).toBeNull()
  })

  it('is on screen from the opening state of both authored atrial-fibrillation cases', () => {
    for (const id of ['IABP-02', 'CAP-IABP-01']) {
      const opening = caseOpeningState(id)
      expect({ id, actions: opening.actionIds.length }).toEqual({ id, actions: 0 })
      const view = render(
        <McsControls state={opening} dispatch={jest.fn()} hideUnavailable={false} />,
      )
      expect({
        id,
        noted: view.container.querySelector('[data-af-trigger-limit]') !== null,
      }).toEqual({ id, noted: true })
      view.unmount()
    }
  })
})

// ── The wording is MCS-03's, unchanged ───────────────────────────────────────

describe('the wording is the wording MCS-03 already wrote', () => {
  it('matches the timing panel boundary word for word', () => {
    const contract = mcsSectionLearningContractById.get('iabp-timing-triggering')!
    const panel = render(
      <McsTeachingPanel
        contract={contract}
        state={afSetup()}
        reveal="transfer"
        beforeMetrics={null}
      />,
    )
    /*
     * The sentences live in content/afTriggerLimit.ts, and the panel still carries them inline: the
     * MCS-03 claim-review queue pins this file and this excerpt as the reviewer's locator, so the
     * panel was left byte-identical. This assertion is what keeps the two copies from drifting.
     */
    expect(panel.container.querySelector('[data-trigger-source-hold]')?.textContent?.trim()).toBe(
      `${MCS_AF_TRIGGER_LIMIT.modelRating} ${MCS_AF_TRIGGER_LIMIT.deviceLabeling} ${MCS_AF_TRIGGER_LIMIT.besideTheFigure}`,
    )
  })

  it('matches the lead and closing sentence of both worked case explanations', () => {
    for (const id of ['IABP-02', 'CAP-IABP-01']) {
      const line = scenarioById(id).debrief.find((item) =>
        item.startsWith(MCS_AF_TRIGGER_LIMIT.heldLead),
      )
      expect({ id, found: line !== undefined }).toEqual({ id, found: true })
      expect({
        id,
        closes: line!.toLowerCase().includes(MCS_AF_TRIGGER_LIMIT.atTheControl.toLowerCase()),
      }).toEqual({ id, closes: true })
    }
  })

  it('attributes each claim to its owner and recommends no trigger', () => {
    expect(MCS_AF_TRIGGER_LIMIT.modelRating).toContain('this model rates')
    expect(MCS_AF_TRIGGER_LIMIT.deviceLabeling).toContain('The supplied Cardiosave material')
    expect(MCS_AF_TRIGGER_LIMIT.atTheControl).toContain('the console’s own instructions')
    expect(MCS_AF_TRIGGER_LIMIT.queueItemId).toBe('MCS-03-05')
  })

  it('leaves the transfer exercise label, key and options as MCS-03 left them', () => {
    expect(transfer.requiredActionIds).toEqual(['iabp:set-trigger'])
    expect(transfer.requiredActionLabel).toContain(
      'in atrial fibrillation it rates pressure triggering above ECG triggering',
    )
    expect(transfer.item.correctChoiceIds).toEqual(['compare-trigger-to-waveform'])
    expect(transfer.item.choices.map((choice) => [choice.id, choice.plausibility])).toEqual([
      ['compare-trigger-to-waveform', 'best'],
      ['assume-ecg', 'reasonable-but-incomplete'],
      ['increase-ratio', 'unsafe'],
    ])
    expect(transfer.item.reviewStatus).toBe('draft')
  })
})

// ── The model is untouched ───────────────────────────────────────────────────

describe('nothing about the model changed', () => {
  it('keeps the atrial-fibrillation synchrony figures and the trigger alarm from the MCS-03 replay', () => {
    const af = afSetup()
    const observed = (['ecg', 'pressure', 'internal'] as const).map((source) => {
      const state = withTrigger(af, source)
      return {
        source,
        synchrony: state.metrics.timingQualityPercent,
        alarm: state.alarms.some((alarm) => alarm.id === 'iabp-trigger-unreliable'),
      }
    })
    expect(observed).toEqual([
      { source: 'ecg', synchrony: 50, alarm: true },
      { source: 'pressure', synchrony: 74, alarm: false },
      { source: 'internal', synchrony: 40, alarm: true },
    ])
  })

  it('keeps the sinus reference figures', () => {
    const sinus = build('iabp', [])
    expect(
      (['ecg', 'pressure', 'internal'] as const).map(
        (source) => withTrigger(sinus, source).metrics.timingQualityPercent,
      ),
    ).toEqual([100, 90, 62])
  })

  it('keeps the transfer work predicate: any trigger on a running balloon, none on a stopped one', () => {
    const af = afSetup()
    for (const source of ['ecg', 'pressure', 'internal'] as const) {
      expect({ source, satisfied: transfer.isWorkSatisfied?.(withTrigger(af, source)) }).toEqual({
        source,
        satisfied: true,
      })
    }
    expect(
      transfer.isWorkSatisfied?.(
        mcsReducer(af, { type: 'SET_IABP_CONTROL', control: 'running', value: false }),
      ),
    ).toBe(false)
  })

  /*
   * The hold MCS-03 recorded and this task did not resolve: with both timing landmarks already
   * placed — everything else each case asks for — only pressure triggering reaches either case's
   * modeled useful-timing signal in atrial fibrillation. Pinned so that a reviewed model or
   * criterion change has to come back through here.
   */
  it('still reaches both cases’ useful-timing signal only on pressure triggering', () => {
    for (const [id, threshold] of [
      ['IABP-02', 60],
      ['CAP-IABP-01', 65],
    ] as const) {
      const scenario = scenarioById(id)
      const criterion = scenario.successCriteria.find(
        (item) => item.metric === 'timingQualityPercent',
      )!
      expect({ id, operator: criterion.operator, value: criterion.value }).toEqual({
        id,
        operator: 'at-least',
        value: threshold,
      })
      const timed = settle(
        [
          { type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: 0 },
          { type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value: 0 },
        ].reduce<McsSimulationState>(
          (state, action) => mcsReducer(state, action as McsAction),
          caseOpeningState(id),
        ),
      )
      const reached = (['ecg', 'pressure', 'internal'] as const).filter(
        (source) => (withTrigger(timed, source).metrics.timingQualityPercent ?? 0) >= threshold,
      )
      expect({ id, reached }).toEqual({ id, reached: ['pressure'] })
    }
    // CAP-IABP-01's starting trigger is part of the same hold.
    expect(scenarioById('CAP-IABP-01').initialDevice).toMatchObject({ triggerSource: 'internal' })
  })
})
