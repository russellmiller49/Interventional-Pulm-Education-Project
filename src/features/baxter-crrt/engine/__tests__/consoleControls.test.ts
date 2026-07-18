import { getBaxterCrrtCase } from '../../content'
import { selectCrrtConsoleControls } from '../consoleControls'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
} from '../learningSession'

function commitCorrectPrediction(state: CrrtLearningSessionState): CrrtLearningSessionState {
  for (const phase of ['define', 'select', 'predict'] as const) {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase,
    })
  }
  const hidden = state.caseDefinition.hiddenMechanism
  return crrtLearningSessionReducer(state, {
    type: 'COMMIT_PREDICTION',
    prediction: {
      goalOptionId: hidden.correctGoalOptionId,
      mechanismOptionId: hidden.correctMechanismOptionId,
      controlOptionIds: hidden.correctControlOptionIds,
      responseOptionId: hidden.correctResponseOptionId,
      reassessmentOptionIds: hidden.correctReassessmentOptionIds,
    },
  })
}

describe('CRRT console controls', () => {
  it('exposes only authored machine-setting actions and preserves clinical prerequisites', () => {
    let state = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-01'),
      experience: 'learn',
      roleLens: 'integrated',
      attempt: 1,
    })

    const locked = selectCrrtConsoleControls(state)
    expect(locked.settingActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Adjust machine fluid removal after assessment',
          enabled: false,
          changes: [
            expect.objectContaining({
              label: 'Patient fluid removal',
              instruction: 'Set to 70 mL/h',
            }),
          ],
        }),
      ]),
    )

    state = commitCorrectPrediction(state)
    let controls = selectCrrtConsoleControls(state)
    const safeSetting = controls.settingActions.find((action) => !action.unsafe)
    const assessment = controls.prerequisiteActions.find(
      (action) => action.category === 'assessment',
    )
    expect(safeSetting).toMatchObject({
      enabled: false,
      missingPrerequisiteLabels: ['Complete the initial clinical assessment'],
    })
    expect(assessment).toMatchObject({ enabled: true, performed: false })

    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: assessment?.id ?? '',
    })
    controls = selectCrrtConsoleControls(state)
    expect(controls.settingActions.find(({ id }) => id === safeSetting?.id)).toMatchObject({
      enabled: true,
      missingPrerequisiteLabels: [],
    })

    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: safeSetting?.id ?? '',
    })
    expect(state.simulation.prescription.flows.patientFluidRemovalMlHour).toBe(70)
    expect(
      selectCrrtConsoleControls(state).settingActions.find(({ id }) => id === safeSetting?.id),
    ).toMatchObject({
      performed: true,
      enabled: false,
    })
  })

  it('does not expose non-machine clinical interventions as direct setting controls', () => {
    const state = commitCorrectPrediction(
      createCrrtLearningSession({
        caseDefinition: getBaxterCrrtCase('CRRT-01'),
        experience: 'learn',
        roleLens: 'integrated',
        attempt: 1,
      }),
    )
    const controls = selectCrrtConsoleControls(state)
    expect(controls.settingActions.map(({ category }) => category)).not.toContain('communication')
    expect(controls.settingActions.every(({ changes }) => changes.length > 0)).toBe(true)
  })
})
