import {
  getMechanismScenario,
  mechanismScenarioRegistry,
  validateMechanismScenarioRegistry,
} from '../content/mechanismScenarioRegistry'
import {
  canAdvanceMechanismScenario,
  createInitialMechanismScenarioState,
  getCurrentMechanismPhase,
  getMechanismConsequence,
  reduceMechanismScenarioState,
} from '../engine/mechanismScenarioFlow'

describe('airway-stent mechanism scenario registry and flow', () => {
  it('has a valid deterministic registry with resolved evidence and text equivalents', () => {
    expect(validateMechanismScenarioRegistry()).toEqual([])
    expect(mechanismScenarioRegistry.map((scenario) => scenario.id)).toEqual([
      'silicone-curve-involution',
      'cough-interface-response',
      'whole-y-fit-deployment',
      'longitudinal-complication-outcomes',
    ])
    expect(getMechanismScenario('cough-interface-response').completionPolicy).toBe(
      'all-architecture-families',
    )
    expect(getMechanismScenario('whole-y-fit-deployment').completionPolicy).toBe(
      'all-architecture-families',
    )

    for (const scenario of mechanismScenarioRegistry) {
      expect(scenario.phases.every((phase) => phase.reducedMotionText.length > 40)).toBe(true)
      expect(scenario.evidenceBoundary).toMatch(/\b(?:does not|not|cannot|insufficient)\b/i)
      expect(scenario.evidenceRefs.length).toBeGreaterThan(0)
    }
  })

  it('gates the cough consequence behind commitment and all contributor observations', () => {
    const scenario = getMechanismScenario('cough-interface-response')
    let state = createInitialMechanismScenarioState(scenario)

    expect(getCurrentMechanismPhase(scenario, state).id).toBe('cough-baseline')
    expect(getMechanismConsequence(scenario, state)).toBeNull()
    expect(canAdvanceMechanismScenario(scenario, state)).toBe(false)

    state = reduceMechanismScenarioState(scenario, state, {
      type: 'select-prediction',
      predictionId: 'predict-architecture-plus-context',
    })
    expect(getCurrentMechanismPhase(scenario, state).id).toBe('cough-baseline')

    state = reduceMechanismScenarioState(scenario, state, { type: 'commit-prediction' })
    expect(getCurrentMechanismPhase(scenario, state).id).toBe('cough-excursion')
    expect(getMechanismConsequence(scenario, state)).toBeNull()

    state = reduceMechanismScenarioState(scenario, state, { type: 'advance' })
    expect(getCurrentMechanismPhase(scenario, state).id).toBe('cough-contributor-check')
    expect(canAdvanceMechanismScenario(scenario, state)).toBe(false)

    const blockedState = reduceMechanismScenarioState(scenario, state, { type: 'advance' })
    expect(blockedState).toEqual(state)

    for (const observationId of [
      'end-contact',
      'secretions-infection',
      'dwell-time',
      'host-response',
    ]) {
      state = reduceMechanismScenarioState(scenario, state, {
        type: 'toggle-observation',
        observationId,
      })
    }

    expect(canAdvanceMechanismScenario(scenario, state)).toBe(true)
    state = reduceMechanismScenarioState(scenario, state, { type: 'advance' })
    expect(getCurrentMechanismPhase(scenario, state).id).toBe('cough-response')
    expect(getMechanismConsequence(scenario, state)?.id).toBe('cough-multifactorial-response')

    state = reduceMechanismScenarioState(scenario, state, { type: 'complete' })
    expect(state.completed).toBe(false)
    expect(state.completedArchitectureFamilies).toEqual(['braided-self-expanding-scaffold'])
    expect(state.architectureFamily).toBe('solid-silicone-tube')
    expect(getCurrentMechanismPhase(scenario, state).id).toBe('cough-baseline')
    expect(getMechanismConsequence(scenario, state)).toBeNull()

    state = reduceMechanismScenarioState(scenario, state, {
      type: 'select-prediction',
      predictionId: 'predict-architecture-plus-context',
    })
    state = reduceMechanismScenarioState(scenario, state, { type: 'commit-prediction' })
    state = reduceMechanismScenarioState(scenario, state, { type: 'advance' })
    for (const observationId of [
      'end-contact',
      'secretions-infection',
      'dwell-time',
      'host-response',
    ]) {
      state = reduceMechanismScenarioState(scenario, state, {
        type: 'toggle-observation',
        observationId,
      })
    }
    state = reduceMechanismScenarioState(scenario, state, { type: 'advance' })
    state = reduceMechanismScenarioState(scenario, state, { type: 'complete' })

    expect(state.completed).toBe(true)
    expect(state.completedArchitectureFamilies).toEqual([
      'braided-self-expanding-scaffold',
      'solid-silicone-tube',
    ])
  })

  it('resets a revealed scenario when the architecture family changes', () => {
    const scenario = getMechanismScenario('cough-interface-response')
    let state = createInitialMechanismScenarioState(scenario)

    state = reduceMechanismScenarioState(scenario, state, {
      type: 'select-prediction',
      predictionId: 'predict-architecture-plus-context',
    })
    state = reduceMechanismScenarioState(scenario, state, { type: 'commit-prediction' })
    state = reduceMechanismScenarioState(scenario, state, {
      type: 'select-architecture',
      architectureFamily: 'solid-silicone-tube',
    })

    expect(state).toEqual({
      architectureFamily: 'solid-silicone-tube',
      phaseIndex: 0,
      selectedPredictionId: null,
      committedPredictionId: null,
      completedObservationIds: [],
      completedArchitectureFamilies: [],
      completed: false,
    })
  })

  it('requires both Y-stent deployment pathways before overall completion', () => {
    const scenario = getMechanismScenario('whole-y-fit-deployment')
    let state = createInitialMechanismScenarioState(scenario)

    for (const expectedArchitectureFamily of ['silicone-y', 'metallic-y-scaffold'] as const) {
      expect(state.architectureFamily).toBe(expectedArchitectureFamily)
      state = reduceMechanismScenarioState(scenario, state, {
        type: 'select-prediction',
        predictionId: 'predict-whole-y-inspection',
      })
      state = reduceMechanismScenarioState(scenario, state, { type: 'commit-prediction' })

      for (const observationId of [
        'y-tracheal-segment',
        'y-carinal-saddle',
        'y-limb-diameters-lengths',
        'y-branch-angles',
        'y-distal-patency',
      ]) {
        state = reduceMechanismScenarioState(scenario, state, {
          type: 'toggle-observation',
          observationId,
        })
      }

      state = reduceMechanismScenarioState(scenario, state, { type: 'advance' })
      expect(getMechanismConsequence(scenario, state)?.id).toBe('y-whole-fit-preserved')
      state = reduceMechanismScenarioState(scenario, state, { type: 'complete' })
    }

    expect(state.completedArchitectureFamilies).toEqual(['silicone-y', 'metallic-y-scaffold'])
    expect(state.completed).toBe(true)
  })

  it('keeps cough behavior architecture-specific', () => {
    const scenario = getMechanismScenario('cough-interface-response')
    const braid = scenario.architectureBehaviors.find(
      (behavior) => behavior.architectureFamily === 'braided-self-expanding-scaffold',
    )
    const silicone = scenario.architectureBehaviors.find(
      (behavior) => behavior.architectureFamily === 'solid-silicone-tube',
    )

    expect(braid?.motionDuringCough?.join(' ')).toMatch(/diameter-length coupling/i)
    expect(braid?.motionDuringCough?.join(' ')).toMatch(/axial end excursion/i)
    expect(braid?.motionDuringCough?.join(' ')).toMatch(/foreshortening/i)

    expect(silicone?.motionDuringCough?.join(' ')).toMatch(/sliding|migration/i)
    expect(silicone?.motionDuringCough?.join(' ')).toMatch(/straightening/i)
    expect(silicone?.motionDuringCough?.join(' ')).toMatch(/involution/i)
    expect(silicone?.motionDuringCough?.join(' ')).not.toMatch(/foreshortening/i)
    expect(silicone?.explicitlyNotModeled.join(' ')).toMatch(
      /braid-angle diameter-length coupling/i,
    )
    expect(silicone?.explicitlyNotModeled.join(' ')).toMatch(/wire-scaffold foreshortening/i)
  })

  it('contains the full complication timeline and avoids prohibited causal or numeric claims', () => {
    const timeline = getMechanismScenario('longitudinal-complication-outcomes')
    const complicationIds = timeline.consequenceStates[0]?.complicationIds ?? []
    expect(complicationIds).toEqual(
      expect.arrayContaining([
        'mucus-obstruction',
        'infection',
        'migration',
        'granulation',
        'tumor-ingrowth-overgrowth',
        'fracture',
        'cover-failure',
        'branch-obstruction',
      ]),
    )

    const authoredCopy = JSON.stringify(mechanismScenarioRegistry)
    expect(authoredCopy).not.toMatch(
      /\bcough(?:ing)?(?:\s+with)?\s+foreshortening\s+causes?\s+granulation\b/i,
    )
    expect(authoredCopy).not.toMatch(/\bforeshortening\s+causes?\s+granulation\b/i)
    expect(authoredCopy).not.toMatch(/\b(?:tissue|mucosal|airway)\s+pressure\s*(?:is|=|:)\s*\d/i)
    expect(authoredCopy).not.toMatch(
      /\b(?:granulation|complication)\s+(?:risk|probability)\s*(?:is|=|:)\s*\d/i,
    )
  })
})
