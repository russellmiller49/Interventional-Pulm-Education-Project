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

/*
 * The foundation activity is a shim over the lesson stage: `EcmoFoundationLessonActivity.tsx`
 * renders `FoundationStageHost`, and the host is where the session is mounted, the clock run, the
 * prediction committed and the one write made. The source scans below read the host, and one case
 * pins that the shim really is a shim — nothing about the session lives there any more.
 */
const hostSource = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/stage/FoundationStageHost.tsx'),
  'utf8',
)
const shimSource = readFileSync(
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

/** The body of one top-level function declaration in the host, from its name to the next one. */
function hostFunction(name: string): string {
  const start = hostSource.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`${name} is not declared in FoundationStageHost.tsx`)
  const rest = hostSource.slice(start + `function ${name}(`.length)
  const next = rest.search(/\n  (?:function|const|let) /)
  return rest.slice(0, next < 0 ? undefined : next)
}

describe('the restore-then-act sequence is gone', () => {
  it('keeps no pending-action state and no effect that dispatches after a restore', () => {
    expect(hostSource).not.toMatch(/pendingAction/)
    expect(hostSource).not.toMatch(/setPendingAction/)
    expect(hostSource).not.toMatch(/react-hooks\/exhaustive-deps/)
    expect(hostSource).not.toMatch(/eslint-disable/)
  })

  it('leaves nothing of the session in the shim', () => {
    // The route still imports the activity by its old name; the name is all that is left of it.
    expect(shimSource).toContain('<FoundationStageHost')
    for (const forbidden of [
      'useEffect',
      'useReducer',
      'useState',
      'dispatch',
      'persistFoundationSectionCompleted',
      'localStorage',
      'sessionStorage',
    ]) {
      expect(shimSource).not.toContain(forbidden)
    }
  })

  /**
   * The invariant, rather than a count of effects.
   *
   * This used to assert that the activity had exactly one `useEffect`, as a proxy for "no effect
   * dispatches a simulation action after a restore". The host has effects that move focus to the
   * Now card and write the phase into the URL, so the count no longer means what it meant — but
   * the thing it was protecting is directly checkable: of every effect in the file, only one may
   * dispatch, and that one is the clock.
   */
  it('lets only one effect dispatch, and that effect only runs the clock', () => {
    const effectBodies: string[] = []
    const opener = /use(?:Isomorphic)?(?:Layout)?Effect\(/g
    for (let match = opener.exec(hostSource); match; match = opener.exec(hostSource)) {
      let depth = 0
      let index = match.index + match[0].length - 1
      const start = index
      do {
        const character = hostSource[index]
        if (character === '(') depth += 1
        if (character === ')') depth -= 1
        index += 1
      } while (depth > 0 && index < hostSource.length)
      effectBodies.push(hostSource.slice(start, index))
    }

    expect(effectBodies.length).toBeGreaterThan(0)
    const dispatching = effectBodies.filter((body) => body.includes('dispatch('))
    expect(dispatching).toHaveLength(1)
    expect(dispatching[0]).toMatch(/setInterval\(\s*\n?\s*\(\) => dispatch\(\{ type: 'SIMULATION'/)
    expect(dispatching[0]).toContain("action: { type: 'STEP' }")
    // The clock is the only thing that effect does: no restore, no guided action, no progression.
    expect(dispatching[0]).not.toMatch(/RESTORE_SOURCE_AND_APPLY|ecmoFoundationRestoreAction/)
    expect(dispatching[0]).not.toMatch(/setProgression|enterStep|advance\(/)
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
      expect(hostSource).not.toContain(forbidden)
    }
  })

  /**
   * The positive half of the persistence contract.
   *
   * This activity used to persist nothing at all, and that was asserted by banning strings. Once a
   * single traversal marker became necessary — the seven foundation sections in each pathway could
   * not otherwise take part in "what comes next" — the string bans stopped being sufficient on
   * their own: a writer reached through the `../engine` barrel would satisfy every one of them
   * while writing whatever it liked. So the write is pinned positively as well: one import, one
   * call, and no direct storage API in this file. The behaviour itself — nothing on mount, exactly
   * one write on commit — is asserted against a rendered component in
   * `foundation-phase-restoration.test.tsx`.
   */
  it('persists through exactly one named writer, and touches no storage API directly', () => {
    const progressImports =
      hostSource.match(/import \{[^}]*\} from '\.\.\/\.\.\/engine\/progress'/g) ?? []
    expect(progressImports).toHaveLength(1)
    expect(progressImports[0]).toContain('persistFoundationSectionCompleted')
    expect(hostSource.match(/from '[^']*progress'/g)).toHaveLength(1)

    // Exactly one call site. The import mentions the name without parentheses, so this counts calls.
    expect(hostSource.match(/persistFoundationSectionCompleted\(/g)).toHaveLength(1)

    for (const forbidden of ['localStorage', 'sessionStorage', 'JSON.parse', 'JSON.stringify']) {
      expect(hostSource).not.toContain(forbidden)
    }
  })

  it('marks the section worked from the transfer commit, not from navigation', () => {
    // The continue button does not render on the last section of a pathway, so recording there
    // would leave a learner who finished everything permanently one section short of done.
    const commitTransfer = hostFunction('commitTransfer')
    expect(commitTransfer).toContain('committedTransferId: selectedChoiceId')
    expect(commitTransfer).toContain('persistFoundationSectionCompleted(sectionId)')
    // Wired to the transfer item's primary action, and to nothing else.
    expect(hostSource).toMatch(/case 'transfer-item':[\s\S]*?onActivate: commitTransfer/)
    for (const name of ['advance', 'enterStep', 'goToSection', 'selectStepRow']) {
      expect(hostFunction(name)).not.toContain('persistFoundationSectionCompleted')
    }
  })

  it('offers no way to declare the lesson finished', () => {
    expect(hostSource).not.toMatch(/mark lesson complete/i)
  })

  it('keeps the bounded actions reachable in the transfer phase', () => {
    // The VV capstone's transfer step is "load the re-drainage preview and read it", which is
    // impossible if the action list disappears when the transfer item appears.
    expect(hostSource).toMatch(
      /predictionCommitted && activeStep\.phase !== 'recognize' && activeStep\.phase !== 'predict'/,
    )
    expect(hostSource).not.toMatch(/phase === 'act' \|\| phase === 'observe'\s*\?/)
  })

  it('commits a prediction without advancing the phase on its own', () => {
    const commitPrediction = hostFunction('commitPrediction')
    expect(commitPrediction).toContain('committedPredictionId: selectedChoiceId')
    // Advancing is a separate, explicit button. `foundation-activity.test.tsx` mounts this and
    // asserts the behaviour; the source match only pins that the two remain separate controls.
    expect(commitPrediction).not.toMatch(/advance\(|enterStep\(|index:/)
    expect(hostSource).toMatch(/case 'prediction':[\s\S]*?onActivate: commitPrediction/)
    expect(hostSource).toMatch(/onClick=\{advance\}>\s*Continue\s*<\/button>/)
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

    expect(next.simulation.device.rpmSetpoint).toBe(3500)
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
    expect(state.device.rpmSetpoint).toBe(3500)
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
