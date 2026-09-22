import { getBaxterCrrtCase } from '../../content/completeCases'
import { selectCrrtActualRunReview } from '../../actualRunReview'
import { selectCrrtBloodFlowState } from '../circuitDelivery'
import {
  canStartPrismaxTreatment,
  selectPrismaxPilotCaseOperationsDisplay,
  selectPrismaxPilotInterface,
} from '../deviceAdapters/prismax'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer as reduce,
  type CrrtLearningSessionState,
  type CrrtLearningSessionAction,
} from '../learningSession'
import { selectCrrtPrescriptionRecord } from '../setupWorkflow'
import { completeCrrtMachineSetup } from '../testSupport/machineWorkflow'

const start = (id: string) =>
  createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(id as never),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
const perform = (interventionId: string): CrrtLearningSessionAction => ({
  type: 'PERFORM_INTERVENTION',
  interventionId,
})
const advance = (seconds: number): CrrtLearningSessionAction => ({ type: 'ADVANCE_TIME', seconds })
const run = (s: CrrtLearningSessionState, ...actions: CrrtLearningSessionAction[]) =>
  actions.reduce(reduce, s)
const review = (s: CrrtLearningSessionState) =>
  reduce(s, { type: 'DEVICE_ACTION', action: { type: 'COMPLETE_SETUP_STEP', stepId: 'review' } })
const values = { bloodFlowMlMin: 150, dialysateFlowMlHour: 1900, patientFluidRemovalMlHour: 100 }
const prepare = () => completeCrrtMachineSetup(start('CRRT-04'), values, { startTreatment: false })
const change = (s: CrrtLearningSessionState) =>
  run(s, perform('crrt04-assess-goal'), perform('crrt04-enter-blood-flow'))

describe('independent Batch-02 setup challenges', () => {
  it('invalidates review after a case edit, preserves completed operations, and blocks first start through either entry', () => {
    const before = prepare()
    const changed = change(before)
    expect(changed.interfaceState.committedPrescription).toEqual(
      before.interfaceState.committedPrescription,
    )
    expect(changed.interfaceState.completedStepIds).toEqual(before.interfaceState.completedStepIds)
    expect(changed.interfaceState.primeState).toBe('complete')
    expect(selectCrrtPrescriptionRecord(changed).reviewCurrent).toBe(false)
    expect(canStartPrismaxTreatment(changed.interfaceState)).toBe(false)
    expect(
      selectPrismaxPilotInterface(changed.interfaceState).stepStatuses.find(
        ({ step }) => step.id === 'review',
      )?.status,
    ).toBe('current')
    expect(
      reduce(changed, { type: 'DEVICE_ACTION', action: { type: 'START_TREATMENT' } }).timeline.at(
        -1,
      )?.outcome,
    ).toBe('refused')
    const definition = {
      ...changed.caseDefinition,
      interventions: changed.caseDefinition.interventions.map((a) =>
        a.id === 'crrt04-start-reviewed-treatment' ? { ...a, prerequisites: [] } : a,
      ),
    }
    expect(
      reduce(
        { ...changed, caseDefinition: definition },
        perform('crrt04-start-reviewed-treatment'),
      ).timeline.at(-1)?.outcome,
    ).toBe('refused')
    const rereviewed = review(changed)
    expect(canStartPrismaxTreatment(rereviewed.interfaceState)).toBe(true)
    expect(selectCrrtPrescriptionRecord(rereviewed).reviewCurrent).toBe(true)
    expect(rereviewed.interfaceState.committedPrescription?.flows.bloodFlowMlMin).toBe(150)
    expect(rereviewed.simulation.prescription.flows.bloodFlowMlMin).toBe(120)
    expect(new Set(rereviewed.interfaceState.completedStepIds).size).toBe(8)
    expect(review(rereviewed).timeline.at(-1)?.outcome).toBe('refused')
  })
  it('does not silently restore a review when a later action returns to the committed value', () => {
    const changed = change(prepare())
    const template = changed.caseDefinition.interventions.find(
      (a) => a.id === 'crrt04-enter-blood-flow',
    )!
    const restore = {
      ...template,
      id: 'test-return-value',
      prerequisites: [],
      effects: template.effects.map((e) => ({ ...e, value: 150 })),
    } as typeof template
    const restored = reduce(
      {
        ...changed,
        caseDefinition: {
          ...changed.caseDefinition,
          interventions: [...changed.caseDefinition.interventions, restore],
        },
      },
      perform(restore.id),
    )
    expect(selectCrrtPrescriptionRecord(restored).divergences).toEqual([])
    expect(selectCrrtPrescriptionRecord(restored).reviewCurrent).toBe(false)
    expect(canStartPrismaxTreatment(restored.interfaceState)).toBe(false)
    expect(selectCrrtPrescriptionRecord(review(restored)).reviewCurrent).toBe(true)
  })
  it.each(['prime', 'review', 'sets', 'connect-patient'] as const)(
    'refuses both starts when %s is incomplete',
    (step) => {
      const prepared = prepare()
      const incomplete = {
        ...prepared,
        interfaceState: {
          ...prepared.interfaceState,
          completedStepIds: prepared.interfaceState.completedStepIds.filter((id) => id !== step),
        },
      }
      const definition = {
        ...incomplete.caseDefinition,
        interventions: incomplete.caseDefinition.interventions.map((a) =>
          a.id === 'crrt04-start-reviewed-treatment' ? { ...a, prerequisites: [] } : a,
        ),
      }
      expect(canStartPrismaxTreatment(incomplete.interfaceState)).toBe(false)
      expect(
        reduce(incomplete, {
          type: 'DEVICE_ACTION',
          action: { type: 'START_TREATMENT' },
        }).timeline.at(-1)?.outcome,
      ).toBe('refused')
      expect(
        reduce(
          { ...incomplete, caseDefinition: definition },
          perform('crrt04-start-reviewed-treatment'),
        ).timeline.at(-1)?.outcome,
      ).toBe('refused')
    },
  )
  it.each(['no-prescription', 'prime-in-progress', 'ended'] as const)(
    'refuses both entry points for %s',
    (condition) => {
      const prepared = prepare()
      const interfaceState = {
        ...prepared.interfaceState,
        ...(condition === 'no-prescription' ? { committedPrescription: null } : {}),
        ...(condition === 'prime-in-progress' ? { primeState: 'in-progress' as const } : {}),
        ...(condition === 'ended' ? { treatmentState: 'ended' as const } : {}),
      }
      const caseDefinition = {
        ...prepared.caseDefinition,
        interventions: prepared.caseDefinition.interventions.map((a) =>
          a.id === 'crrt04-start-reviewed-treatment' ? { ...a, prerequisites: [] } : a,
        ),
      }
      const s = { ...prepared, interfaceState, caseDefinition }
      expect(canStartPrismaxTreatment(interfaceState)).toBe(false)
      expect(
        reduce(s, { type: 'DEVICE_ACTION', action: { type: 'START_TREATMENT' } }).timeline.at(-1)
          ?.outcome,
      ).toBe('refused')
      expect(reduce(s, perform('crrt04-start-reviewed-treatment')).timeline.at(-1)?.outcome).toBe(
        'refused',
      )
    },
  )
  it('does not call a committed but unreviewed prescription reviewed', () => {
    const prepared = prepare()
    const unreviewed = {
      ...prepared,
      interfaceState: {
        ...prepared.interfaceState,
        completedStepIds: prepared.interfaceState.completedStepIds.filter((id) => id !== 'review'),
      },
    }
    expect(selectCrrtPrescriptionRecord(unreviewed).status).toBe('machine-committed-unreviewed')
  })
  it('retains the authored running setup and allows operational pause/recovery after a flow edit', () => {
    let s = start('CRRT-13')
    expect(s.interfaceState.treatmentState).toBe('running')
    s = run(
      s,
      ...[
        'assess-patient-device',
        'advance-to-pattern',
        'increase-bfr-through-obstruction',
        'inspect-access-path',
        'pause-treatment',
        'reposition-access',
        'resume-treatment',
      ].map((id) => perform('crrt13-' + id)),
    )
    expect(s.simulation.device.deliveryState).toBe('running')
    expect(s.criticalErrorIds).toContain('crrt13-critical-increase-bfr')
    expect(selectCrrtPrescriptionRecord(s).reviewCurrent).toBe(false)
  })
})

describe('independent actual-time accounting challenges', () => {
  it.each([
    ['zero', [], 0, 0],
    ['learner', [advance(600)], 600, 0],
    ['action', [perform('crrt11-action-assess'), perform('crrt11-action-safe-candidate')], 0, 3600],
    [
      'mixed',
      [perform('crrt11-action-assess'), perform('crrt11-action-safe-candidate'), advance(600)],
      600,
      3600,
    ],
    [
      'multiple',
      [
        perform('crrt11-action-assess'),
        perform('crrt11-action-safe-candidate'),
        perform('crrt11-action-alternative-candidate'),
      ],
      0,
      7200,
    ],
    ['refused', [perform('crrt11-action-safe-candidate')], 0, 0],
    [
      'repeat',
      [
        perform('crrt11-action-assess'),
        perform('crrt11-action-safe-candidate'),
        perform('crrt11-action-safe-candidate'),
      ],
      0,
      3600,
    ],
    ['same-time', [perform('crrt11-action-assess'), perform('crrt11-action-communicate')], 0, 0],
  ] as const)('%s time is conserved', (_name, actions, learner, carried) => {
    const s = run(start('CRRT-11'), ...actions)
    const a = selectCrrtActualRunReview(s).timeAccounting
    expect(a).toMatchObject({
      totalElapsedSeconds: learner + carried,
      advancedByLearnerSeconds: learner,
      advancedByCaseActionsSeconds: carried,
      reconciled: true,
    })
    expect(selectCrrtActualRunReview(s).reassessmentLabels).toEqual([])
  })
  it('reports only the reassessment actually entered', () => {
    const s = run(start('CRRT-11'), advance(600))
    const option = s.caseDefinition.reassessmentOptions[0]
    const next = reduce(s, { type: 'COMMIT_REASSESSMENT', optionIds: [option.id] })
    expect(selectCrrtActualRunReview(next).reassessmentLabels).toEqual([option.label])
    expect(selectCrrtActualRunReview(s).reassessmentLabels).toEqual([])
  })
  it('detects missing time records, instead of forcing the conservation flag true', () => {
    const s = run(start('CRRT-11'), advance(600))
    expect(selectCrrtActualRunReview({ ...s, timeline: [] }).timeAccounting.reconciled).toBe(false)
  })
  it('does not read arbitrary latency metadata as elapsed time', () => {
    const s = start('CRRT-11')
    const definition = {
      ...s.caseDefinition,
      interventions: s.caseDefinition.interventions.map((a) => ({ ...a, latencySeconds: 999999 })),
    }
    const after = run(
      { ...s, caseDefinition: definition },
      perform('crrt11-action-assess'),
      perform('crrt11-action-safe-candidate'),
    )
    expect(selectCrrtActualRunReview(after).timeAccounting.advancedByCaseActionsSeconds).toBe(3600)
  })
})

describe('actual flow gates pressure validity independently of delivery strings', () => {
  it.each(['paused', 'ended', 'idle'] as const)(
    '%s keeps the set value and zero actual flow',
    (deliveryState) => {
      const s = start('CRRT-13')
      const sim = {
        ...s.simulation,
        device: { ...s.simulation.device, deliveryState, bloodPumpRunning: false },
      }
      const d = selectPrismaxPilotCaseOperationsDisplay(s.interfaceState, sim)
      expect(d.treatmentContext.bloodFlow).toMatchObject({ setMlMin: 120, actualMlMin: 0 })
      expect(
        d.pressureSignals
          .filter((x) => x.kind === 'calculated-relationship')
          .every((x) => x.validity === 'no-flow-through-circuit'),
      ).toBe(true)
    },
  )
  it('uses disconnected access, a stopped pump and zero settings even when state says running', () => {
    const s = start('CRRT-13')
    const sim = s.simulation
    for (const variant of [
      { ...sim, device: { ...sim.device, bloodPumpRunning: false } },
      { ...sim, access: { ...sim.access, accessConnected: false } },
      {
        ...sim,
        prescription: {
          ...sim.prescription,
          flows: { ...sim.prescription.flows, bloodFlowMlMin: 0 },
        },
      },
    ] as (typeof sim)[]) {
      expect(selectCrrtBloodFlowState(variant).actualMlMin).toBe(0)
    }
    expect(selectCrrtBloodFlowState(sim).actualMlMin).toBe(120)
  })
})
