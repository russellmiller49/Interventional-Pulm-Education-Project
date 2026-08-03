import {
  assertCrossSurfaceCausalConsistencyAll,
  measureLearnOutcome,
  type CrossSurfaceCausalClaim,
} from '@/features/critical-care/test-support/crossSurfaceConsistency'

import { clinicalPracticeScenarios } from '../content/clinicalCases'
import {
  RECIRCULATION_FRACTION,
  createInitialSimulationState,
  ecmoSimulationReducer,
  type EcmoSimulationState,
  type SimulationAction,
} from '../engine'

/**
 * A2 — the VV recirculation claim, made true across Learn and Practice.
 *
 * Practice classifies "increase RPM to chase displayed flow" as harmful and says systemic
 * saturation falls further. Learn used to reward the same action: escalating from the authored
 * 3800 rpm to 5000 raised modeled SpO2 from 92.0 to 95.2, because the recirculation fraction was a
 * constant and effective flow therefore rose with displayed flow.
 */

const run = (state: EcmoSimulationState, actions: readonly SimulationAction[]) =>
  actions.reduce(ecmoSimulationReducer, state)

function settle(state: EcmoSimulationState, ticks = 14): EcmoSimulationState {
  let next = state
  for (let tick = 0; tick < ticks; tick += 1) next = run(next, [{ type: 'STEP' }])
  return next
}

/** The Practice case's own words, read from the authored content rather than restated here. */
function practiceNarratives(): readonly string[] {
  const definition = clinicalPracticeScenarios.find(
    (scenario) => scenario.id === 'clinical-vv-recirculation-migration',
  )
  if (!definition) throw new Error('clinical-vv-recirculation-migration is missing')
  const intervention = definition.clinicalCase?.interventions.find(
    (item) => item.id === 'recirc-increase-rpm',
  )
  if (!intervention) throw new Error('recirc-increase-rpm intervention is missing')
  return [intervention.response, ...definition.debrief.causalChain]
}

const claims: readonly CrossSurfaceCausalClaim<EcmoSimulationState>[] = [
  {
    id: 'vv-recirculation.rpm-escalation.patient-oxygenation',
    scenarioFamily: 'recirculation',
    action: 'Increase pump speed above the speed the case opened with',
    practiceClassification: 'harmful',
    observable: {
      label: 'modeled patient SpO2',
      read: (state) => state.patient.spo2,
      betterWhen: 'higher',
      deadband: 0.2,
    },
    loadLearnState: () => settle(createInitialSimulationState('vv-recirculation')),
    performOnLearnSurface: (state) => settle(run(state, [{ type: 'SET_RPM', rpm: 5000 }])),
    narratives: practiceNarratives(),
  },
  {
    id: 'vv-recirculation.rpm-escalation.effective-flow',
    scenarioFamily: 'recirculation',
    action: 'Increase pump speed above the speed the case opened with',
    practiceClassification: 'harmful',
    observable: {
      label: 'recirculation-adjusted circuit flow',
      read: (state) => state.circuit.recirculationAdjustedCircuitFlowLpm,
      betterWhen: 'higher',
      deadband: 0.02,
    },
    loadLearnState: () => settle(createInitialSimulationState('vv-recirculation')),
    performOnLearnSurface: (state) => settle(run(state, [{ type: 'SET_RPM', rpm: 5000 }])),
  },
  {
    // Proves the helper generalises past the case it was written for.
    id: 'preload-collapse.rpm-escalation.effective-flow',
    scenarioFamily: 'preload',
    action: 'Increase pump speed against a collapsing drainage limb',
    practiceClassification: 'harmful',
    observable: {
      label: 'recirculation-adjusted circuit flow',
      read: (state) => state.circuit.recirculationAdjustedCircuitFlowLpm,
      betterWhen: 'higher',
      deadband: 0.02,
    },
    loadLearnState: () => settle(createInitialSimulationState('preload-drainage-collapse')),
    performOnLearnSurface: (state) => settle(run(state, [{ type: 'SET_RPM', rpm: 5000 }])),
    // Stated rather than silently tolerated: the drainage-collapse model does still let speed buy
    // flow, and the harm it teaches is carried by the alarm, the guard and the pressure signature
    // instead. Removing this exception is tracked work, not a licence to leave the surfaces apart.
    authoredContextDifference:
      'Drainage collapse is modeled as a flow multiplier rather than as a re-drained share, so effective flow still tracks speed here. The harm is carried by the pVen signature, the drainage-collapse alarm and the rpm-during-collapse guard rather than by the oxygenation response.',
  },
]

describe('A2: cross-surface causal consistency', () => {
  it('holds for every registered claim', () => {
    assertCrossSurfaceCausalConsistencyAll(claims)
  })

  it('makes escalating speed against recirculation measurably worse, not merely unhelpful', () => {
    const outcome = measureLearnOutcome(claims[0])
    expect(outcome.movement).toBe('worsened')
    expect(outcome.after).toBeLessThan(outcome.before)
  })

  it('keeps displayed flow rising, because that is the illusion the module teaches', () => {
    // The fix must not work by making the console's flow number stop responding to the control.
    const baseline = settle(createInitialSimulationState('vv-recirculation'))
    const escalated = settle(run(baseline, [{ type: 'SET_RPM', rpm: 5000 }]))
    expect(escalated.circuit.bloodFlow).toBeGreaterThan(baseline.circuit.bloodFlow)
    expect(escalated.circuit.recirculationAdjustedCircuitFlowLpm).toBeLessThan(
      baseline.circuit.recirculationAdjustedCircuitFlowLpm,
    )
  })

  it('strengthens the bedside sign as the share rises', () => {
    // Drainage-limb saturation climbing toward the returned blood is what a clinician can actually
    // see. If escalation hid the sign, the simulation would be teaching the wrong tell.
    const baseline = settle(createInitialSimulationState('vv-recirculation'))
    const escalated = settle(run(baseline, [{ type: 'SET_RPM', rpm: 5000 }]))
    expect(escalated.circuit.recirculationFraction).toBeGreaterThan(
      baseline.circuit.recirculationFraction,
    )
    expect(escalated.circuit.preOxygenatorSaturation).toBeGreaterThan(
      baseline.circuit.preOxygenatorSaturation,
    )
  })
})

describe('A2: the recirculation model stays bounded', () => {
  it('leaves the authored case exactly as it was at and below its own baseline speed', () => {
    // The change must be invisible until the learner does the thing the module warns against.
    for (const rpm of [2600, 3000, 3400, 3800]) {
      const state = settle(
        run(createInitialSimulationState('vv-recirculation'), [{ type: 'SET_RPM', rpm }]),
      )
      expect(state.circuit.recirculationFraction).toBeCloseTo(RECIRCULATION_FRACTION.established, 3)
    }
  })

  it('rises monotonically with speed above the baseline and never reaches one', () => {
    let previous = 0
    for (const rpm of [3800, 4000, 4200, 4600, 5000]) {
      const state = settle(
        run(createInitialSimulationState('vv-recirculation'), [{ type: 'SET_RPM', rpm }]),
      )
      const fraction = state.circuit.recirculationFraction
      expect(fraction).toBeGreaterThanOrEqual(previous)
      expect(fraction).toBeLessThanOrEqual(RECIRCULATION_FRACTION.maximum)
      expect(fraction).toBeLessThan(1)
      expect(state.circuit.recirculationAdjustedCircuitFlowLpm).toBeGreaterThanOrEqual(0)
      previous = fraction
    }
  })

  it('does not move the share below the authored value when speed is reduced', () => {
    // Turning the pump down does not reposition a cannula, and a model that let it would compete
    // with the correction the case exists to teach.
    const slowed = settle(
      run(createInitialSimulationState('vv-recirculation'), [{ type: 'SET_RPM', rpm: 2000 }]),
    )
    expect(slowed.circuit.recirculationFraction).toBeCloseTo(RECIRCULATION_FRACTION.established, 3)
  })

  it('applies no speed sensitivity without the recirculation state, or in VA', () => {
    const noFault = settle(
      run(createInitialSimulationState('acute-hypercapnia'), [{ type: 'SET_RPM', rpm: 5000 }]),
    )
    expect(noFault.circuit.recirculationFraction).toBeCloseTo(RECIRCULATION_FRACTION.baseline, 3)

    const va = settle(
      run(createInitialSimulationState('va-differential-hypoxemia'), [
        { type: 'SET_RPM', rpm: 5000 },
      ]),
    )
    expect(va.circuit.recirculationFraction).toBe(0)
  })
})

describe('A2: the RPM-escalation guard family', () => {
  it('charges escalating against recirculation under its own mechanism name', () => {
    const state = run(createInitialSimulationState('vv-recirculation'), [
      { type: 'SET_RPM', rpm: 4200 },
    ])
    expect(state.scenario.criticalErrors).toContain('rpm-during-recirculation')
    // Not the drainage-collapse label: naming the wrong mechanism teaches the wrong cause.
    expect(state.scenario.criticalErrors).not.toContain('rpm-during-collapse')
  })

  it('does not fire when speed is held or reduced', () => {
    for (const rpm of [3800, 3000]) {
      const state = run(createInitialSimulationState('vv-recirculation'), [
        { type: 'SET_RPM', rpm },
      ])
      expect(state.scenario.criticalErrors).not.toContain('rpm-during-recirculation')
    }
  })

  it('does not fire while the learner is returning toward the speed the case opened at', () => {
    // The guard and the model have to agree about where harm begins. Below the case baseline the
    // model charges nothing, so scoring a critical error there would punish an action the
    // simulation itself treats as harmless.
    let state = run(createInitialSimulationState('vv-recirculation'), [
      { type: 'SET_RPM', rpm: 3000 },
    ])
    state = run(state, [{ type: 'SET_RPM', rpm: 3400 }])
    expect(state.device.rpmSetpoint).toBe(3400)
    expect(state.scenario.criticalErrors).not.toContain('rpm-during-recirculation')
    expect(state.circuit.recirculationFraction).toBeCloseTo(RECIRCULATION_FRACTION.established, 3)

    // Past the opening speed, both the guard and the model engage together. The guard is charged by
    // the action itself; the fraction only moves once the circuit is re-derived on the next tick.
    const escalated = run(state, [{ type: 'SET_RPM', rpm: 3900 }])
    expect(escalated.scenario.criticalErrors).toContain('rpm-during-recirculation')
    expect(settle(escalated).circuit.recirculationFraction).toBeGreaterThan(
      RECIRCULATION_FRACTION.established,
    )
  })

  it('shows the learner the authored label rather than the identifier', () => {
    const definition = clinicalPracticeScenarios.find(
      (scenario) => scenario.id === 'clinical-vv-recirculation-migration',
    )
    const penalty = definition?.unsafeActionPenalties.find(
      (item) => item.id === 'rpm-during-recirculation',
    )
    expect(penalty?.label).toBe('Increased speed against established recirculation')
  })

  it('leaves the drainage-collapse guard on its own faults', () => {
    const state = run(createInitialSimulationState('preload-drainage-collapse'), [
      { type: 'SET_RPM', rpm: 4200 },
    ])
    expect(state.scenario.criticalErrors).toContain('rpm-during-collapse')
    expect(state.scenario.criticalErrors).not.toContain('rpm-during-recirculation')
  })
})
