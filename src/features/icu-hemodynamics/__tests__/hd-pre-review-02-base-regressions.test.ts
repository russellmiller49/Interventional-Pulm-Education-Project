import { hemodynamicCaseById } from '../content/cases'
import {
  chamberInterpretationAvailable,
  normalWaveformValidityChallenges,
} from '../content/normalWaveformValidityChallenges'
import { hemodynamicsStoryProblems, runHemodynamicsStory } from '../content/storyProblems'
import {
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  isEndExpiration,
  respiratoryPhaseAt,
  thermodilutionAcceptedAverage,
  thermodilutionSeriesSummary,
  wedgeCaptureDelaySeconds,
} from '../engine'
import { observedSystemState } from '../engine/decisionRecord'
import { fickCardiacOutput, type FickInputSet } from '../engine/fick'
import { cleanState, dampedArterialState, standardTechnique } from '../engine/stageRuntime'
import type { HemodynamicAction, HemodynamicSimulationState } from '../engine/types'
import { MMHG_PER_CM_H2O } from '../engine/waveformMorphology'

/**
 * HD-PRE-REVIEW-02 — the key regressions, written only against APIs that already existed on the
 * pre-Task-02 base (`9fbdbddc`), so that the same file run there fails on its assertions rather
 * than on a missing import. Each one reproduces a finding from the September 2026 walkthrough.
 */

const reduce = (state: HemodynamicSimulationState, action: HemodynamicAction) =>
  icuHemodynamicsReducer(state, action)

function acceptThree(state: HemodynamicSimulationState): HemodynamicSimulationState {
  let next = state
  for (let index = 0; index < 3; index += 1) {
    next = reduce(next, { type: 'GENERATE_THERMODILUTION_TRIAL', technique: standardTechnique() })
    const trial = next.thermodilutionTrials[next.thermodilutionTrials.length - 1]
    next = reduce(next, { type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id })
    next = reduce(next, { type: 'SET_THERMODILUTION_ACCEPTED', trialId: trial.id, accepted: true })
  }
  return next
}

/** Report P-05: HD-01, zeroed, three curves, one fluid step, three more curves. */
function threePlusThree() {
  const definition = hemodynamicCaseById.get('HD-01')!
  const seed = [...'HD-01'].reduce((total, character) => total + character.charCodeAt(0), 0) + 3000
  let state = reduce(createInitialHemodynamicState(definition, 'practice', seed), {
    type: 'ZERO_TRANSDUCER',
  })
  state = acceptThree(state)
  const pre = state.thermodilutionTrials.map((trial) => trial.estimatedCardiacOutputLMin)
  const fluid = definition.interventions.find((item) => item.id === 'fluid-250')!
  state = reduce(state, { type: 'APPLY_INTERVENTION', intervention: fluid })
  const afterFluid = state
  state = reduce(state, { type: 'TICK', seconds: 40 })
  state = acceptThree(state)
  const post = state.thermodilutionTrials.slice(3).map((trial) => trial.estimatedCardiacOutputLMin)
  return { state, afterFluid, pre, post }
}

const mean = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length

describe('P-05: curves from before and after a fluid step are not one series', () => {
  it('averages only the post-fluid series, never the six-curve pool', () => {
    const { state, pre, post } = threePlusThree()
    const pooled = Math.round(mean([...pre, ...post]) * 10) / 10
    const postMean = Math.round(mean(post) * 10) / 10
    expect(pooled).not.toBe(postMean)

    const average = thermodilutionAcceptedAverage(state.thermodilutionTrials)
    expect(average).toBe(postMean)
    expect(average).not.toBe(pooled)
    expect(thermodilutionSeriesSummary(state.thermodilutionTrials).acceptedTrialIds).toHaveLength(3)
    expect(observedSystemState(state).flow?.trialCount).toBe(3)
  })

  it('does not carry the pre-fluid series forward as the current flow', () => {
    const { afterFluid } = threePlusThree()
    expect(observedSystemState(afterFluid).flow).toBeNull()
  })
})

describe('L2-14: a pure hydrostatic offset moves every number by the same amount', () => {
  it('reports identical systolic and diastolic shifts and an unchanged pulse pressure', () => {
    const story = hemodynamicsStoryProblems.find(
      (candidate) => candidate.id === 'story-relevel-for-flat',
    )!
    const run = runHemodynamicsStory(story)
    const offset = 8 * MMHG_PER_CM_H2O
    const systolic = (run.after.papSystolic as number) - (run.before.papSystolic as number)
    const diastolic = (run.after.papDiastolic as number) - (run.before.papDiastolic as number)
    const pulse = (run.after.pulsePressure as number) - (run.before.pulsePressure as number)
    // Exact, not "within 1 mmHg": the base printed +5, +6 and a pulse pressure that fell 9 → 8.
    expect(systolic).toBeCloseTo(offset, 9)
    expect(diastolic).toBeCloseTo(offset, 9)
    expect(pulse).toBeCloseTo(0, 9)
  })
})

describe('L9-05: damping the arterial line damps the arterial line only', () => {
  it('leaves the pulmonary-artery and central-venous samples identical to an undamped line', () => {
    const damped = reduce(dampedArterialState(616), { type: 'TICK', seconds: 3 })
    const clean = reduce(cleanState(616, 'pa'), { type: 'TICK', seconds: 3 })
    const recent = (state: HemodynamicSimulationState) => state.waveforms.slice(-150)
    expect(recent(damped).map((sample) => sample.papMmHg)).toEqual(
      recent(clean).map((sample) => sample.papMmHg),
    )
    expect(recent(damped).map((sample) => sample.cvpMmHg)).toEqual(
      recent(clean).map((sample) => sample.cvpMmHg),
    )
    expect(recent(damped).map((sample) => sample.artMmHg)).not.toEqual(
      recent(clean).map((sample) => sample.artMmHg),
    )
  })
})

describe('L7-06: Fick labels and arithmetic say what they are', () => {
  const base: FickInputSet = {
    methodId: 'fick-direct',
    vo2MlMin: 245,
    hemoglobinGDl: 12.4,
    arterialSaturationFraction: 0.97,
    mixedVenousSaturationFraction: 0.68,
    venousSampleSite: 'pulmonary-artery',
    arterialPo2MmHg: null,
    venousPo2MmHg: null,
    includeDissolvedOxygen: false,
    steadyState: true,
    samplesPairedInTime: true,
    intracardiacShuntPresent: false,
  }

  it('does not call a superior vena cava specimen a mixed-venous saturation', () => {
    const svc = fickCardiacOutput({ ...base, venousSampleSite: 'superior-vena-cava' })
    const row = svc.trace.find((candidate) => candidate.id === 'mixed-venous-saturation')!
    expect(row.label).not.toBe('Mixed-venous oxygen saturation')
    expect(row.label).toMatch(/superior vena cava/i)
  })

  it('does not print 16.12 − 14.12 = 1.99 as if the rounded figures produced it', () => {
    const narrow = fickCardiacOutput({ ...base, mixedVenousSaturationFraction: 0.85 })
    const line = narrow.unitAccount.find((candidate) => candidate.startsWith('Difference'))!
    expect(line).toContain('16.12')
    expect(line).not.toMatch(/16\.12 mL\/dL − 14\.12 mL\/dL = 1\.99/)
  })
})

describe('L7-03: accepting a technically unusable curve is answered at once', () => {
  it('says the accepted curve is not in the calculation, and why', () => {
    let state = cleanState(510, 'pa')
    state = reduce(state, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        ...standardTechnique(),
        injectionDurationSeconds: 7,
        respiratoryPhase: 'variable',
        smoothness: 0.3,
      },
    })
    const trial = state.thermodilutionTrials[0]
    expect(trial.quality).toBe('invalid')
    state = reduce(state, { type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id })
    state = reduce(state, {
      type: 'SET_THERMODILUTION_ACCEPTED',
      trialId: trial.id,
      accepted: true,
    })
    expect(state.thermodilutionTrials[0].accepted).toBe(true)
    expect(state.thermodilutionTrials[0].quality).toBe('invalid')
    expect(state.responseMessage).toMatch(/not in the calculation/i)
  })
})

describe('L6-02: a cursor recorded as end-expiratory is at the modeled end expiration', () => {
  it('does not record a mid-breath cursor as end-expiratory', () => {
    const definition = hemodynamicCaseById.get('HD-01')!
    let state = reduce(createInitialHemodynamicState(definition, 'learn', 2), {
      type: 'ZERO_TRANSDUCER',
    })
    // Start the occlusion mid-inspiration, so "now" a breath later is mid-inspiration too.
    const cycle = 60 / state.parameters.respiratoryRateBpm
    const phase = respiratoryPhaseAt(state.timeSeconds, state.parameters.respiratoryRateBpm)
    const toMidInspiration = (((0.25 - phase) % 1) + 1) % 1
    state = reduce(state, { type: 'TICK', seconds: toMidInspiration * cycle })
    state = reduce(state, { type: 'START_WEDGE' })
    state = reduce(state, {
      type: 'TICK',
      seconds: wedgeCaptureDelaySeconds(state.parameters.respiratoryRateBpm) + 0.1,
    })
    expect(isEndExpiration(respiratoryPhaseAt(state.timeSeconds, 18))).toBe(false)
    state = reduce(state, { type: 'PLACE_WEDGE_CURSOR' })
    state = reduce(state, { type: 'STORE_WEDGE' })
    const cursorTime = state.catheter.wedgeCursorTime as number
    expect(state.catheter.storedAtEndExpiration).toBe(
      isEndExpiration(respiratoryPhaseAt(cursorTime, state.parameters.respiratoryRateBpm)),
    )
    expect(state.catheter.storedAtEndExpiration).toBe(true)
  })
})

describe('L3-09: an off-level transducer does not stop the chamber being named', () => {
  it('lets the right-atrial shape name the chamber while the value stays withheld', () => {
    const level = normalWaveformValidityChallenges.find(
      (challenge) => challenge.faultKind === 'level-or-zero',
    )!
    expect(chamberInterpretationAvailable(level)).toBe(true)
    const overdamped = normalWaveformValidityChallenges.find(
      (challenge) => challenge.faultKind === 'overdamped',
    )!
    expect(chamberInterpretationAvailable(overdamped)).toBe(false)
  })
})
