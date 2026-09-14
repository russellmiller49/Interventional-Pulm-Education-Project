import {
  CRRT_FOUNDATION_CONSTRUCTION,
  projectFoundationFluidBalance,
  validDowntimeComparison,
} from '../foundationModel'
import {
  calculateCrrtPredictedConsequences,
  crrtConstructionFlowRates,
} from '../stagedPrescriptionModel'
import { calculateCrrtMachineFluidLedger } from '../circuitFluidLedger'
import {
  createCrrtLearnAttempt,
  crrtCurrentTaskIdentity,
  crrtLearnAttemptReducer,
} from '../learnController'
import {
  CRRT_FOUNDATION_VERSION,
  mergeCrrtLearnEvidence,
  type CrrtLearnEvidence,
} from '../learnEvidence'
import {
  createDefaultProgress,
  parseProgress,
  recordLearnTaskEvidence,
  recordLessonCompletion,
} from '../engine/progress'
import { createSyntheticPressureLocalizationResult } from '../pressureLocalizationLabModel'

describe('CRRT foundation calculations and attempt identity', () => {
  it('uses the same example and canonical dose/ledger math, with external flow continuing through downtime', () => {
    const result = calculateCrrtPredictedConsequences(CRRT_FOUNDATION_CONSTRUCTION)
    expect(result.ledger.totalEffluentMlHour).toBe(2000)
    expect(result.intensity.prescribedDoseMlPerKgHour).toBe(25)
    expect(result.intensity.deliveredDoseMlPerKgHour).toBe(21.875)
    const projection = projectFoundationFluidBalance(CRRT_FOUNDATION_CONSTRUCTION)!
    expect(projection.totals.machinePatientFluidRemovalMl).toBe(2100)
    expect(projection.netBalanceMl).toBe(300)
    const stopped = projectFoundationFluidBalance({
      ...CRRT_FOUNDATION_CONSTRUCTION,
      downtimeHours: 24,
    })!
    expect(stopped.totals.machinePatientFluidRemovalMl).toBe(0)
    expect(stopped.netBalanceMl).toBe(2400)
  })
  it('admits SCUF numerical equality and does not call zero removal patient neutrality', () => {
    const flows = {
      ...crrtConstructionFlowRates(CRRT_FOUNDATION_CONSTRUCTION),
      dialysateFlowMlHour: 0,
    }
    const ledger = calculateCrrtMachineFluidLedger(flows)
    expect(ledger.totalEffluentMlHour).toBe(ledger.machinePatientFluidRemovalMlHour)
    expect(
      projectFoundationFluidBalance({
        ...CRRT_FOUNDATION_CONSTRUCTION,
        patientFluidRemovalMlPerHour: 0,
      })!.netBalanceMl,
    ).toBe(2400)
  })
  it('keeps makeup and optional advanced calculations fail-closed without blocking valid basic work', () => {
    expect(
      projectFoundationFluidBalance({ ...CRRT_FOUNDATION_CONSTRUCTION, makeupMlPerHour: 50 }),
    ).toBeNull()
    const changed = { ...CRRT_FOUNDATION_CONSTRUCTION, downtimeHours: 6 }
    expect(validDowntimeComparison(CRRT_FOUNDATION_CONSTRUCTION, changed)).toBe(true)
    expect(calculateCrrtPredictedConsequences(changed).filtrationBurden.quantitativeStatus).toBe(
      'unavailable-source-limited',
    )
    for (const invalid of [
      null,
      CRRT_FOUNDATION_CONSTRUCTION,
      { ...changed, downtimeHours: NaN },
      { ...changed, downtimeHours: 25 },
      { ...changed, dialysateMlPerHour: 2000 },
      { ...changed, simulatedWeightKg: 0 },
    ])
      expect(validDowntimeComparison(CRRT_FOUNDATION_CONSTRUCTION, invalid)).toBe(false)
  })
  it('does not force diagnostic precision from identical access signatures', () => {
    expect(createSyntheticPressureLocalizationResult('obstruction', 'access-line').signals).toEqual(
      createSyntheticPressureLocalizationResult('obstruction', 'access-catheter').signals,
    )
  })
  it('rejects stale lesson, task, version and attempt callbacks', () => {
    const state = createCrrtLearnAttempt('crrt-circuit-pressures', 'attempt-new')
    const identity = crrtCurrentTaskIdentity(state)
    const evidence: CrrtLearnEvidence = {
      ...identity,
      mode: 'guided',
      response: 'traced',
      correct: null,
      feedbackDisplayed: true,
      reviewed: true,
    }
    for (const patch of [
      { attemptId: 'attempt-old' },
      { taskId: 'other-task' },
      { exampleId: 'other-example' },
      { contentVersion: 'old' },
      { lessonId: 'crrt-prescription-dosing' as const },
    ])
      expect(
        crrtLearnAttemptReducer(state, {
          type: 'complete',
          identity: { ...identity, ...patch },
          evidence: { ...evidence, ...patch },
        }),
      ).toEqual(state)
    expect(crrtLearnAttemptReducer(state, { type: 'complete', identity })).toEqual(state)
    expect(
      crrtLearnAttemptReducer(state, {
        type: 'complete',
        identity,
        evidence: { ...evidence, reviewed: false },
      }),
    ).toEqual(state)
  })
  it('retains historical completion and first responses without manufacturing new evidence', () => {
    const old = recordLessonCompletion(createDefaultProgress(), 'crrt-indications-modality')
    expect(parseProgress(JSON.stringify(old))!.learnTaskHistory).toBeUndefined()
    const evidence: CrrtLearnEvidence = {
      lessonId: 'crrt-indications-modality',
      taskId: 'goals-case',
      attemptId: 'attempt-1',
      exampleId: 'constructed-overload-acidosis',
      contentVersion: CRRT_FOUNDATION_VERSION,
      mode: 'independent',
      response: 'fluid-only',
      correct: false,
      feedbackDisplayed: false,
      reviewed: false,
    }
    const updated = recordLearnTaskEvidence(old, evidence)
    const reviewed = mergeCrrtLearnEvidence(updated.learnTaskHistory!, {
      ...evidence,
      response: 'two-goals',
      correct: true,
      feedbackDisplayed: true,
      reviewed: true,
    })
    expect(reviewed[0]).toMatchObject({ response: 'fluid-only', correct: false, reviewed: true })
    expect(
      parseProgress(JSON.stringify({ ...updated, learnTaskHistory: reviewed }))!.completedLessonIds,
    ).toEqual(old.completedLessonIds)
    const historicalAttempts = Array.from({ length: 300 }, (_, index) => ({
      ...evidence,
      attemptId: `attempt-${index}`,
    }))
    const appended = mergeCrrtLearnEvidence(historicalAttempts, {
      ...evidence,
      attemptId: 'attempt-301',
    })
    expect(
      parseProgress(JSON.stringify({ ...updated, learnTaskHistory: appended }))!.learnTaskHistory,
    ).toHaveLength(301)
    expect(appended[0]).toEqual(historicalAttempts[0])
    expect(updated.attempts).toEqual(old.attempts)
    expect(updated.bestSafeScores).toEqual(old.bestSafeScores)
  })
})
