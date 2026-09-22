import { selectCrrtActualRunReview } from '../actualRunReview'
import { getBaxterCrrtCase } from '../content/completeCases'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  hasCrrtRunActivity,
  type CrrtLearningSessionState,
} from '../engine/learningSession'

function start(caseId: string): CrrtLearningSessionState {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtCase(caseId as never),
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
    deviceId: 'prismax-aw8035-2xx',
  })
}

describe('CRRT actual-run review reports the session, not the worked example', () => {
  it('says values were not recorded for an event that carried none, without inferring them', () => {
    const session = start('CRRT-04')
    // A legacy-shaped entry: recorded before parameter values or outcomes were tracked.
    const withLegacyEntry: CrrtLearningSessionState = {
      ...session,
      timeline: [
        { sequence: 1, atSeconds: 0, type: 'device-action', referenceId: 'SET_PRESCRIPTION_VALUE' },
      ],
    }
    const review = selectCrrtActualRunReview(withLegacyEntry)
    expect(review.actions[0].label).toBe('Entered a prescription value')
    expect(review.actions[0].outcome).toBe('not-recorded')
    expect(review.actions[0].valueNote).toBe('Values were not recorded with this event.')
    // The final prescription is not borrowed to fill the gap.
    expect(review.actions[0].details).toEqual([])
  })

  it('records the parameter a console entry actually carried', () => {
    let session = start('CRRT-04')
    session = crrtLearningSessionReducer(session, {
      type: 'DEVICE_ACTION',
      action: { type: 'SELECT_NEW_PATIENT' },
    })
    session = crrtLearningSessionReducer(session, {
      type: 'DEVICE_ACTION',
      action: { type: 'COMPLETE_SETUP_STEP', stepId: 'patient' },
    })
    const review = selectCrrtActualRunReview(session)
    const setupStep = review.actions.find((entry) => entry.label === 'Completed a setup step')
    expect(setupStep?.details).toEqual([{ label: 'Setup step', value: 'Patient' }])
    expect(setupStep?.outcome).toBe('applied')
  })

  it('records a refused attempt without counting it as run activity', () => {
    const session = start('CRRT-11')
    // The safe action needs the assessment first; attempting it is refused.
    const refused = crrtLearningSessionReducer(session, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'crrt11-action-safe-candidate',
    })
    const review = selectCrrtActualRunReview(refused)
    expect(review.actions).toHaveLength(1)
    expect(review.actions[0].outcome).toBe('refused')
    expect(review.actions[0].valueNote).toMatch(/Refused because: it requires/)
    expect(refused.performedInterventionIds).toEqual([])
    expect(hasCrrtRunActivity(refused)).toBe(false)
    expect(review.hasRun).toBe(false)
    expect(review.statusLabel).toBe('Debrief opened · no run performed')
  })

  it('keeps the worked narrative out of the observations it reports', () => {
    let session = start('CRRT-11')
    session = crrtLearningSessionReducer(session, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'crrt11-action-unsafe-candidate',
    })
    session = crrtLearningSessionReducer(session, { type: 'ADVANCE_TIME', seconds: 7_200 })
    const review = selectCrrtActualRunReview(session)

    expect(review.unsafeActionsPerformed).toHaveLength(1)
    expect(review.unsafeActionsPerformed[0].actionLabel).toMatch(/Increase removal/)
    expect(review.reassessmentLabels).toEqual([])
    const balance = review.observations.find((entry) =>
      entry.label.startsWith('Whole-patient fluid balance'),
    )
    // The actual harmful-path balance, not the worked example's.
    expect(balance?.value).toBe('-600 mL')
    expect(review.observations.map((entry) => entry.value)).not.toContain('Not recorded')
  })
})
