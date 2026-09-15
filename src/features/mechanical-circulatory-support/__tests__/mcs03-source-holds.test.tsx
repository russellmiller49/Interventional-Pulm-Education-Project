/**
 * MCS-03 — consequential source holds and the corrections the supplied evidence supports.
 *
 * Each block names its claim-queue item (docs/gap-remediation/self-paced/MCS-03-claim-review-queue.json).
 * Where the model and a source still disagree, the test pins the disagreement rather than hiding it:
 * a later model or source change then re-opens the item instead of passing silently. None of this is
 * clinical approval; every edited item stays draft and every queue decision stays NOT REVIEWED.
 */
import { render, screen } from '@testing-library/react'

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

import { criticalCareMeasurementClarificationById } from '@/features/critical-care/content/measurementClarifications'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'

import { McsSourcesPanel } from '../components/McsSourcesPanel'
import { McsSourceList } from '../components/stage/McsSourceList'
import { McsTeachingPanel } from '../components/teaching/McsTeachingPanel'
import { impellaAnatomyVariants } from '../content/impellaVariants'
import { mcsLessonTransferByLessonId } from '../content/lessonTransfers'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../content/scenarios'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { mcsSourceById } from '../content/sources'
import { mcsSupportPathwayCardById } from '../content/supportPathways'
import { createInitialMcsState, mcsReducer } from '../engine'
import type { McsAction, McsDeviceKind, McsSimulationState } from '../engine'

/** The replay the queue's model outputs came from: learn mode, seed 417, 0.2 s steps. */
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

function then(state: McsSimulationState, action: McsAction): McsSimulationState {
  return settle(mcsReducer(state, action))
}

const alarmIds = (state: McsSimulationState) => state.alarms.map((alarm) => alarm.id)

function transferFor(lessonId: string) {
  const transfer = mcsLessonTransferByLessonId.get(lessonId)
  if (!transfer) throw new Error(`No transfer for ${lessonId}`)
  return transfer
}

describe('MCS-03-01 and MCS-03-02 — manufacturer measurands and the textbook disagreement', () => {
  const clarification = criticalCareMeasurementClarificationById.get(
    'clarification.mcs.impella-cp-flow-measurands',
  )!
  const conflict = criticalCareSourceConflictById.get('conflict.mcs.impella-cp-textbook-flow')!

  it('keeps the two records separate, and neither is approved', () => {
    expect(clarification.quantities.flatMap((quantity) => quantity.evidenceIds)).not.toContain(
      'case-based-device-therapy-hf',
    )
    for (const position of conflict.positions) {
      expect(position.evidenceIds).toEqual(['case-based-device-therapy-hf'])
    }
    expect(clarification.reviewStatus).toBe('sme-review')
    expect(conflict.reviewStatus).toBe('sme-review')

    const card = mcsSupportPathwayCardById.get('impella-left-transvalvular')!
    expect(card.measurementClarificationIds).toEqual([clarification.id])
    expect(card.sourceConflictIds).toEqual([conflict.id])
  })

  it('names the textbook chapter from its own title and copyright pages', () => {
    const textbook = mcsSourceById.get('case-based-device-therapy-hf')!
    expect(textbook.year).toBe(2021)
    expect(textbook.citation).toMatch(/^Walters D, Reeves R\. Temporary mechanical circulatory/)
    expect(textbook.citation).toMatch(/Springer Nature Switzerland; 2021/)
    expect(textbook.limitation).toMatch(/printed page 26/)
    expect(textbook.limitation).toMatch(/printed page 27/)
    expect(textbook.citation).not.toMatch(/reviewed/i)
  })

  it('still holds the model’s Impella CP ceiling at the peak systolic figure (held, not repaired)', () => {
    // The supplied instructions for use give 3.7 L/min as the maximum mean flow and 4.3 L/min as a
    // peak systolic flow at P-9. The model's reference ceiling is 4.3 and its mean pump flow at P-9
    // exceeds 3.7. That is a model/measurand disagreement for faculty, not a number to change here.
    expect(
      impellaAnatomyVariants.find((variant) => variant.id === 'cp')!.modeledReferenceFlowLMin,
    ).toBe(4.3)
    const p9 = build('impella', [
      { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 9 },
    ])
    expect(p9.metrics.leftDeviceFlowLMin).toBeGreaterThan(3.7)
  })
})

describe('MCS-03-03 — the Impella 5.5 figure names one measurand wherever it appears', () => {
  it('calls 5.5 L/min a maximum mean flow on the card, the variant preview and the source record', () => {
    const card = mcsSupportPathwayCardById.get('impella-left-transvalvular')!
    const reference = card.productReferences.find(
      (candidate) => candidate.id === 'mcs.pathway.impella-55.maximum-flow',
    )!
    const variant = impellaAnatomyVariants.find((candidate) => candidate.id === '55')!
    const source = mcsSourceById.get('fda-impella-55-labeling')!

    expect(reference.valueText).toBe('5.5 L/min')
    expect(reference.measurand).toBe('Maximum mean flow')
    expect(variant.productFlowFraming).toMatch(/^Maximum mean flow of 5\.5 L\/min/)
    expect(source.intendedUse).toMatch(/maximum mean flow/)
    for (const text of [reference.condition, variant.productFlowFraming, source.intendedUse]) {
      expect(text).not.toMatch(/not a guaranteed maximum|product-reported (mean|maximum)/i)
    }
  })
})

describe('MCS-03-05 — trigger choice in atrial fibrillation', () => {
  const transfer = transferFor('iabp-timing-triggering')

  it('pins the held disagreement: the model still rates pressure triggering above ECG triggering', () => {
    const af = build(transfer.setupDevice, transfer.setupActions)
    expect(af.patient.rhythm).toBe('atrial-fibrillation')
    const ecg = then(af, { type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'ecg' })
    const pressure = then(af, {
      type: 'SET_IABP_CONTROL',
      control: 'triggerSource',
      value: 'pressure',
    })
    expect(pressure.metrics.timingQualityPercent!).toBeGreaterThan(
      ecg.metrics.timingQualityPercent!,
    )
  })

  it('no longer rewards leaving ECG triggering, and reads keeping it as incomplete rather than wrong', () => {
    const af = build(transfer.setupDevice, transfer.setupActions)
    for (const source of ['ecg', 'pressure', 'internal'] as const) {
      const running = mcsReducer(af, {
        type: 'SET_IABP_CONTROL',
        control: 'triggerSource',
        value: source,
      })
      expect({ source, satisfied: transfer.isWorkSatisfied?.(running) }).toEqual({
        source,
        satisfied: true,
      })
    }
    // The genuine prerequisite stays: a stopped balloon is not a trigger comparison.
    const stopped = mcsReducer(af, { type: 'SET_IABP_CONTROL', control: 'running', value: false })
    expect(transfer.isWorkSatisfied?.(stopped)).toBe(false)
    expect(transfer.requiredActionIds).toEqual(['iabp:set-trigger'])
    const keepEcg = transfer.item.choices.find((choice) => choice.id === 'assume-ecg')!
    expect(keepEcg.plausibility).toBe('reasonable-but-incomplete')
    expect(transfer.item.correctChoiceIds).toEqual(['compare-trigger-to-waveform'])
    expect(transfer.item.evidenceIds).toEqual(
      expect.arrayContaining([
        'getinge-cardiosave-hybrid-operating-instructions',
        'getinge-cardiosave-troubleshooting-strategies',
      ]),
    )
    for (const id of transfer.item.evidenceIds) expect(mcsSourceById.has(id)).toBe(true)
    expect(transfer.item.reviewStatus).toBe('draft')
  })

  it('says so beside the synchrony figure only when the rhythm is atrial fibrillation', () => {
    const contract = mcsSectionLearningContractById.get('iabp-timing-triggering')!
    const af = build(transfer.setupDevice, transfer.setupActions)
    const first = render(
      <McsTeachingPanel contract={contract} state={af} reveal="transfer" beforeMetrics={null} />,
    )
    expect(first.container.querySelector('[data-trigger-source-hold]')?.textContent).toMatch(
      /not as a guide to choosing a trigger/,
    )
    first.unmount()

    const sinus = render(
      <McsTeachingPanel
        contract={contract}
        state={build('iabp', [])}
        reveal="transfer"
        beforeMetrics={null}
      />,
    )
    expect(sinus.container.querySelector('[data-trigger-source-hold]')).toBeNull()
  })

  it('names the limit in the worked explanation of both atrial fibrillation cases', () => {
    for (const id of ['IABP-02', 'CAP-IABP-01']) {
      const scenario = [...mcsPracticeScenarios, ...mcsCapstoneScenarios].find(
        (candidate) => candidate.id === id,
      )!
      expect(scenario.initialPatient.rhythm).toBe('atrial-fibrillation')
      expect(
        scenario.debrief.some((line) => line.startsWith('Model limit held for faculty review')),
      ).toBe(true)
    }
  })
})

describe('MCS-03-06 — suction: lowering the level is the first step, not the whole response', () => {
  const transfer = transferFor('impella-suction-purge-rv')

  it('describes what the model does after a reduction and after refilling', () => {
    const setup = build(transfer.setupDevice, transfer.setupActions)
    expect(alarmIds(setup)).toContain('impella-left-suction')

    const twoLevelsDown = then(setup, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'left',
      control: 'performanceLevel',
      value: 6,
    })
    expect(alarmIds(twoLevelsDown)).toContain('impella-left-suction')
    expect(twoLevelsDown.metrics.effectiveSystemicFlowLMin).toBeLessThan(
      setup.metrics.effectiveSystemicFlowLMin,
    )

    const refilled = then(setup, {
      type: 'SET_PATIENT_CONTROL',
      control: 'preloadPercent',
      value: 85,
    })
    expect(alarmIds(refilled)).not.toContain('impella-left-suction')

    expect(transfer.item.explanation).toMatch(/volume status/)
    expect(transfer.item.explanation).toMatch(/imaging/)
    expect(transfer.item.explanation).toMatch(/right ventricular function/)
    const best = transfer.item.choices.find((choice) => choice.plausibility === 'best')!
    expect(best.id).toBe('reduce-and-diagnose')
    expect(best.rationale).not.toMatch(/limits ongoing suction/)
  })
})

describe('MCS-03-07 — right-limited selection: a small effective gain, not none', () => {
  const transfer = transferFor('mcs-device-selection-integration')

  it('matches the model: escalating the left pump adds a little effective flow and keeps suction', () => {
    const setup = build(transfer.setupDevice, transfer.setupActions)
    const p8 = then(setup, {
      type: 'SET_IMPELLA_CONTROL',
      side: 'left',
      control: 'performanceLevel',
      value: 8,
    })
    const gain = p8.metrics.effectiveSystemicFlowLMin - setup.metrics.effectiveSystemicFlowLMin
    expect(gain).toBeGreaterThan(0)
    expect(gain).toBeLessThan(0.5)
    expect(alarmIds(p8)).toContain('impella-left-suction')

    const best = transfer.item.choices.find((choice) => choice.plausibility === 'best')!
    expect(best.rationale).not.toMatch(/without raising effective systemic flow/)
    expect(transfer.item.reviewStatus).toBe('draft')
  })
})

describe('MCS-03-08 — the LVAD high-power transfer describes the patient on screen', () => {
  const transfer = transferFor('lvad-alarms-emergencies')

  it('says the flows barely move, because in this model they do not', () => {
    const baseline = build('lvad', [])
    const setup = build(transfer.setupDevice, transfer.setupActions)
    expect((setup.metrics.pumpPowerW ?? 0) - (baseline.metrics.pumpPowerW ?? 0)).toBeGreaterThan(1)
    expect(
      Math.abs(
        setup.metrics.effectiveSystemicFlowLMin - baseline.metrics.effectiveSystemicFlowLMin,
      ),
    ).toBeLessThan(0.1)
    expect(alarmIds(setup)).toContain('lvad-high-power')

    const copy = [
      transfer.title,
      transfer.item.stem,
      ...transfer.contextItems.map((context) => context.value),
    ].join(' ')
    expect(copy).not.toMatch(/worsen/i)
    expect(transfer.item.stem).toMatch(/barely move/)
    expect(transfer.item.explanation).toMatch(/does not establish a diagnosis/)
    expect(transfer.item.correctChoiceIds).toEqual(['preserve-power-escalate'])
  })
})

describe('MCS-03-10 — supplied syntheses carry the identity their files show', () => {
  it.each(['mcs-bedside-reference-supplied', 'master-hemodynamics-reference'])(
    '%s states no date and says what the file does not name',
    (id) => {
      const source = mcsSourceById.get(id)!
      expect(source.year).toBeNull()
      expect(source.citation).toMatch(/names no author, publisher, date or reference list/)
      expect(source.citation).toMatch(/OpenAI/)
      expect(source.citation).not.toMatch(/reviewed/i)
      expect(source.limitation).toMatch(/no clinical statement should rest on it alone/)
    },
  )

  it('renders an absent date as not stated rather than as a year', () => {
    render(<McsSourceList sourceIds={['mcs-bedside-reference-supplied']} claimsVisible={false} />)
    expect(screen.getByText(/date not stated/)).toBeInTheDocument()
  })

  it('does not present a labeling check as a clinical review or a current-revision verification', () => {
    const { container } = render(<McsSourcesPanel />)
    const terms = Array.from(container.querySelectorAll('dt')).map((node) => node.textContent)
    expect(terms).not.toContain('Reviewed')
    expect(container.textContent).toMatch(/no clinical review is recorded/)
    expect(container.textContent).toMatch(/has not been verified here/)
    expect(container.textContent).not.toMatch(/current FDA labeling/)
  })
})
