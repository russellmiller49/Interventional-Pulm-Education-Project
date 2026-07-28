import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  advanceSeconds,
  ecmoFoundationLessonRuntime,
  ecmoFoundationPrimaryVariant,
  ecmoFoundationVariant,
  ecmoFoundationVariants,
  ecmoInteractiveFoundationSectionIds,
  validateEcmoFoundationRuntimes,
  type EcmoFoundationStateVariant,
} from '../content/foundationLessonRuntime'
import {
  createEcmoFoundationSessionState,
  createFoundationSourceState,
  createFoundationVariantState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
  ecmoFoundationSnapshot,
} from '../session/foundationSession'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState, SimulationAction } from '../engine/types'

const activitySource = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/EcmoFoundationLessonActivity.tsx'),
  'utf8',
)

const referenceVariant: EcmoFoundationStateVariant = {
  id: 'reference-circuit',
  source: { kind: 'reference-profile', profileId: 'vv-reference' },
  label: 'VV reference circuit',
}

function fold(
  state: EcmoSimulationState,
  actions: readonly SimulationAction[],
): EcmoSimulationState {
  return actions.reduce(ecmoSimulationReducer, state)
}

describe('the restore-then-act sequence is gone', () => {
  it('keeps no pending-action state and no effect that dispatches after a restore', () => {
    expect(activitySource).not.toMatch(/pendingAction/)
    expect(activitySource).not.toMatch(/setPendingAction/)
    expect(activitySource).not.toMatch(/react-hooks\/exhaustive-deps/)
    expect(activitySource).not.toMatch(/eslint-disable/)
  })

  it('keeps exactly one effect, and that effect only runs the clock', () => {
    const effects = activitySource.match(/useEffect\(/g) ?? []
    expect(effects).toHaveLength(1)
    expect(activitySource).toMatch(/setInterval\(\s*\n?\s*\(\) => dispatch\(\{ type: 'SIMULATION'/)
  })

  it('never records a scenario result, mastery, or Practice progress', () => {
    for (const forbidden of [
      'recordScenarioResult',
      'withMastery',
      'calculateMastery',
      'writeProgress',
      'recordLearnLessonCompleted',
      'setLastCaseForMode',
      'setLastLessonForMode',
      'COMMIT_PREDICTION',
      'COMMIT_REASSESSMENT',
      'CORRECT_FAULT',
    ]) {
      expect(activitySource).not.toContain(forbidden)
    }
  })

  it('offers no way to declare the lesson finished', () => {
    expect(activitySource).not.toMatch(/mark lesson complete/i)
  })

  it('keeps the bounded actions reachable in the transfer phase', () => {
    // The VV capstone's transfer step is "load the re-drainage preview and read it", which is
    // impossible if the action list disappears when the transfer item appears.
    expect(activitySource).toMatch(/phase !== 'recognize' && phase !== 'predict'/)
    expect(activitySource).not.toMatch(/phase === 'act' \|\| phase === 'observe'\s*\?/)
  })

  it('commits a prediction without advancing the phase on its own', () => {
    expect(activitySource).toMatch(/onClick=\{\(\) => setCommittedPredictionId\(choice\.id\)\}/)
    // Advancing is a separate, explicit button.
    expect(activitySource).toMatch(/onClick=\{\(\) => setPhase\('act'\)\}/)
  })
})

describe('RESTORE_SOURCE_AND_APPLY', () => {
  it('builds a clean source state that ignores whatever was on screen before', () => {
    const opening = createEcmoFoundationSessionState(referenceVariant)
    const disturbed = ecmoFoundationSessionReducer(opening, {
      type: 'SIMULATION',
      action: { type: 'SET_RPM', rpm: 4200 },
    })
    expect(disturbed.simulation.device.rpmSetpoint).toBe(4200)

    const restored = ecmoFoundationSessionReducer(
      disturbed,
      ecmoFoundationRestoreAction(referenceVariant),
    )
    expect(restored.simulation.device.rpmSetpoint).toBe(3200)
    expect(restored.simulation.simulationTime).toBe(0)
    expect(restored.simulation).toEqual(createReferenceSimulationState('vv-reference'))
  })

  it('supports zero, one, and several actions in one transition', () => {
    const base = createEcmoFoundationSessionState(referenceVariant)

    const none = ecmoFoundationSessionReducer(base, {
      type: 'RESTORE_SOURCE_AND_APPLY',
      source: referenceVariant.source,
      variantId: referenceVariant.id,
      actions: [],
    })
    expect(none.simulation.simulationTime).toBe(0)

    const one = ecmoFoundationSessionReducer(base, {
      type: 'RESTORE_SOURCE_AND_APPLY',
      source: referenceVariant.source,
      variantId: referenceVariant.id,
      actions: [{ type: 'SET_RPM', rpm: 3400 }],
    })
    expect(one.simulation.device.rpmSetpoint).toBe(3400)
    expect(one.simulation.simulationTime).toBe(0)

    const several = ecmoFoundationSessionReducer(base, {
      type: 'RESTORE_SOURCE_AND_APPLY',
      source: referenceVariant.source,
      variantId: referenceVariant.id,
      actions: [{ type: 'SET_RPM', rpm: 3400 }, ...advanceSeconds(6)],
    })
    expect(several.simulation.device.rpmSetpoint).toBe(3400)
    expect(several.simulation.simulationTime).toBe(6)
  })

  it('applies the supplied actions in authored order', () => {
    const base = createEcmoFoundationSessionState(referenceVariant)
    const ordered: readonly SimulationAction[] = [
      { type: 'SET_RPM', rpm: 3400 },
      { type: 'STEP' },
      { type: 'SET_RPM', rpm: 3000 },
    ]
    const reversed: readonly SimulationAction[] = [...ordered].reverse()

    const forwards = ecmoFoundationSessionReducer(base, {
      type: 'RESTORE_SOURCE_AND_APPLY',
      source: referenceVariant.source,
      variantId: referenceVariant.id,
      actions: ordered,
    })
    const backwards = ecmoFoundationSessionReducer(base, {
      type: 'RESTORE_SOURCE_AND_APPLY',
      source: referenceVariant.source,
      variantId: referenceVariant.id,
      actions: reversed,
    })

    expect(forwards.simulation.device.rpmSetpoint).toBe(3000)
    expect(backwards.simulation.device.rpmSetpoint).toBe(3400)
    // The fold is exactly the sequential application of the same actions, nothing more.
    expect(forwards.simulation).toEqual(
      fold(createFoundationSourceState(referenceVariant.source), ordered),
    )
  })

  it('returns the final state from one dispatch, so no intermediate frame can be rendered', () => {
    const base = createEcmoFoundationSessionState(referenceVariant)
    const guided = ecmoFoundationLessonRuntime('pump-and-pressure-zones').guidedActions.find(
      (action) => action.id === 'increase-rpm',
    )!
    const action = ecmoFoundationRestoreAction(referenceVariant, guided)

    // The restored speed is resolved against the restored profile, not against whatever the
    // previous state happened to hold.
    const disturbed = ecmoFoundationSessionReducer(base, {
      type: 'SIMULATION',
      action: { type: 'SET_RPM', rpm: 4800 },
    })
    const next = ecmoFoundationSessionReducer(disturbed, action)

    expect(next.simulation.device.rpmSetpoint).toBe(3400)
    expect(next.simulation.simulationTime).toBe(guided.settleSeconds)
    expect(next.simulation.circuit.bloodFlow).toBeGreaterThan(base.simulation.circuit.bloodFlow)
  })

  it('clears interaction evidence, or replaces it, in the same transition', () => {
    const opening = createEcmoFoundationSessionState(referenceVariant)
    const withEvidence = ecmoFoundationSessionReducer(opening, {
      type: 'RECORD_INTERACTION',
      id: 'looked-at-something',
    })
    expect(withEvidence.interactionsSinceRestore).toEqual(['looked-at-something'])

    const bare = ecmoFoundationSessionReducer(
      withEvidence,
      ecmoFoundationRestoreAction(referenceVariant),
    )
    expect(bare.interactionsSinceRestore).toEqual([])

    const guided = ecmoFoundationLessonRuntime('pump-and-pressure-zones').guidedActions[0]
    const replaced = ecmoFoundationSessionReducer(
      withEvidence,
      ecmoFoundationRestoreAction(referenceVariant, guided),
    )
    expect(replaced.interactionsSinceRestore).toEqual([guided.id])
  })

  it('clears a captured snapshot when the source is reloaded', () => {
    const opening = createEcmoFoundationSessionState(referenceVariant)
    const captured = ecmoFoundationSessionReducer(opening, {
      type: 'CAPTURE_SNAPSHOT',
      id: 'capture-reference-snapshot',
    })
    expect(captured.snapshot).not.toBeNull()
    expect(captured.snapshot).toEqual(ecmoFoundationSnapshot(opening.simulation))

    const restored = ecmoFoundationSessionReducer(
      captured,
      ecmoFoundationRestoreAction(referenceVariant),
    )
    expect(restored.snapshot).toBeNull()
  })

  it('records the variant that produced the state on screen', () => {
    const runtime = ecmoFoundationLessonRuntime('vv-series-physiology')
    const preview = ecmoFoundationVariant(runtime, 'vv', 'recirculation-preview')!
    const session = ecmoFoundationSessionReducer(
      createEcmoFoundationSessionState(referenceVariant),
      ecmoFoundationRestoreAction(preview),
    )
    expect(session.variantId).toBe('recirculation-preview')
    expect(session.source).toEqual({ kind: 'scenario', scenarioId: 'vv-recirculation' })
  })
})

describe('the four sequences the package has to support', () => {
  const pumpRuntime = ecmoFoundationLessonRuntime('pump-and-pressure-zones')
  const sweepRuntime = ecmoFoundationLessonRuntime('blood-flow-versus-sweep')
  const capstoneRuntime = ecmoFoundationLessonRuntime('vv-integration-capstone')
  const seriesRuntime = ecmoFoundationLessonRuntime('vv-series-physiology')

  function apply(runtime: typeof pumpRuntime, guidedId: string) {
    const guided = runtime.guidedActions.find((action) => action.id === guidedId)!
    const variant = ecmoFoundationVariant(runtime, 'vv', guided.variantId ?? '')!
    return ecmoFoundationSessionReducer(
      createEcmoFoundationSessionState(ecmoFoundationPrimaryVariant(runtime, 'vv')),
      ecmoFoundationRestoreAction(variant, guided),
    ).simulation
  }

  it('restores the VV reference and raises the pump speed', () => {
    const state = apply(pumpRuntime, 'increase-rpm')
    expect(state.scenario.scenarioId).toBe('vv-reference')
    expect(state.device.rpmSetpoint).toBe(3400)
  })

  it('restores the VV reference and raises the sweep', () => {
    const state = apply(sweepRuntime, 'increase-sweep')
    expect(state.scenario.scenarioId).toBe('vv-reference')
    expect(state.gas.sweepLpm).toBe(5)
  })

  it('loads the gas-source case and advances past its authored change', () => {
    const before = apply(capstoneRuntime, 'restore-case-before-change')
    const after = apply(capstoneRuntime, 'reveal-evolved-state')

    expect(before.scenario.scenarioId).toBe('gas-source-interruption')
    expect(before.gas.sourceConnected).toBe(true)
    expect(before.scenario.activeFaults).not.toContain('gas-source-interruption')

    expect(after.gas.sourceConnected).toBe(false)
    expect(after.scenario.activeFaults).toContain('gas-source-interruption')
    // The blood path is undisturbed, which is the whole point of the case.
    expect(after.circuit.bloodFlow).toBeCloseTo(before.circuit.bloodFlow, 2)
    expect(after.circuit.readouts.pVen.displayed).toBe(before.circuit.readouts.pVen.displayed)
    expect(after.circuit.readouts.deltaP.displayed).toBe(before.circuit.readouts.deltaP.displayed)
    expect(after.patient.paCO2).toBeGreaterThan(before.patient.paCO2 + 10)
  })

  it('loads the recirculation case and advances it to a settled preview', () => {
    const settled = apply(seriesRuntime, 'load-recirculation-preview')
    expect(settled.scenario.scenarioId).toBe('vv-recirculation')
    expect(settled.circuit.recirculationFraction).toBeCloseTo(0.48, 3)
    // Settled: another ten seconds moves nothing that matters.
    const later = fold(settled, advanceSeconds(10))
    expect(later.circuit.preOxygenatorSaturation).toBeCloseTo(
      settled.circuit.preOxygenatorSaturation,
      1,
    )
    expect(later.patient.systemicVenousSaturationEstimate).toBeCloseTo(
      settled.patient.systemicVenousSaturationEstimate,
      1,
    )
  })
})

describe('teaching previews stay non-scored', () => {
  const previewVariants = ecmoInteractiveFoundationSectionIds.flatMap((sectionId) =>
    ecmoFoundationVariants(ecmoFoundationLessonRuntime(sectionId), 'vv').filter(
      (variant) => variant.source.kind === 'scenario',
    ),
  )

  it('has at least one scenario-backed preview to check', () => {
    expect(previewVariants.length).toBeGreaterThan(0)
  })

  it('records nothing scored and completes no objective', () => {
    for (const variant of previewVariants) {
      const state = createFoundationVariantState(variant)
      expect(state.scenario.credit).toEqual({
        goal: false,
        control: false,
        direction: false,
        cause: false,
        reassessment: false,
      })
      expect(state.scenario.penalties).toBe(0)
      expect(state.scenario.hintPenalty).toBe(0)
      expect(state.scenario.completedObjectiveIds).toEqual([])
      expect(state.scenario.criticalErrors).toEqual([])
      expect(state.scenario.prediction.committed).toBe(false)
      expect(state.scenario.causeCorrectedAt).toBeNull()
    }
  })

  it('runs rather than opening on a frozen frame', () => {
    for (const variant of previewVariants) {
      expect(createFoundationVariantState(variant).paused).toBe(false)
    }
  })

  it('reloads to the same state every time, from whatever was on screen before', () => {
    for (const variant of previewVariants) {
      const fresh = createFoundationVariantState(variant)
      const afterOtherState = ecmoFoundationSessionReducer(
        createEcmoFoundationSessionState(referenceVariant),
        ecmoFoundationRestoreAction(variant),
      ).simulation
      expect(afterOtherState).toEqual(fresh)
    }
  })

  it('never compounds two previews', () => {
    const runtime = ecmoFoundationLessonRuntime('vv-integration-capstone')
    const recirculation = ecmoFoundationVariant(runtime, 'vv', 'recirculation-preview')!
    const resistance = ecmoFoundationVariant(runtime, 'vv', 'oxygenator-resistance-preview')!

    let session = createEcmoFoundationSessionState(ecmoFoundationPrimaryVariant(runtime, 'vv'))
    session = ecmoFoundationSessionReducer(session, ecmoFoundationRestoreAction(recirculation))
    session = ecmoFoundationSessionReducer(session, ecmoFoundationRestoreAction(resistance))

    expect(session.simulation).toEqual(createFoundationVariantState(resistance))
    expect(session.simulation.scenario.activeFaults).not.toContain('recirculation')
  })
})

describe('ADVANCE runs the clock without touching anything else', () => {
  it('advances exactly the authored number of modeled seconds in one transition', () => {
    const opening = createEcmoFoundationSessionState(referenceVariant)
    const advanced = ecmoFoundationSessionReducer(opening, {
      type: 'ADVANCE',
      seconds: 20,
      id: 'run-twenty-modeled-seconds',
    })
    expect(advanced.simulation.simulationTime).toBe(20)
    expect(advanced.simulation.device.rpmSetpoint).toBe(opening.simulation.device.rpmSetpoint)
    expect(advanced.interactionsSinceRestore).toEqual(['run-twenty-modeled-seconds'])
  })

  it('keeps a captured snapshot, because the comparison is the point of advancing', () => {
    let session = createEcmoFoundationSessionState(referenceVariant)
    session = ecmoFoundationSessionReducer(session, {
      type: 'CAPTURE_SNAPSHOT',
      id: 'capture-reference-snapshot',
    })
    session = ecmoFoundationSessionReducer(session, { type: 'ADVANCE', seconds: 20 })
    expect(session.snapshot?.simulationTime).toBe(0)
    expect(session.simulation.simulationTime).toBe(20)
  })
})

describe('authored runtimes', () => {
  it('validates structurally', () => {
    expect(validateEcmoFoundationRuntimes()).toEqual([])
  })

  it('never offers a VA reference behind a VV-only section, whatever track is asked for', () => {
    for (const sectionId of [
      'vv-series-physiology',
      'vv-normal-state',
      'vv-integration-capstone',
    ] as const) {
      const runtime = ecmoFoundationLessonRuntime(sectionId)
      expect(runtime.supportMode).toBe('vv')
      for (const requested of ['vv', 'va'] as const) {
        for (const variant of ecmoFoundationVariants(runtime, requested)) {
          if (variant.source.kind === 'reference-profile') {
            expect(variant.source.profileId).toBe('vv-reference')
          }
          expect(createFoundationVariantState(variant).supportMode).toBe('vv')
        }
      }
    }
  })
})
