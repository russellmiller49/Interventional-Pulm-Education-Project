import {
  ecmoFoundationLessonRuntime,
  ecmoFoundationPrimaryVariant,
  ecmoFoundationVariant,
  type EcmoFoundationGuidedAction,
} from '../content/foundationLessonRuntime'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import {
  createEcmoFoundationSessionState,
  ecmoFoundationRestoreAction,
  ecmoFoundationSessionReducer,
} from '../session/foundationSession'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'
import type { EcmoSimulationState, SupportMode } from '../engine/types'

/**
 * The comparisons the two circuit-walk sections run, checked against the engine rather than
 * against the copy that describes them.
 *
 * The defect this suite exists to exclude is specific and was live on `main`: the pump lesson asked
 * the learner to commit to a pairing — flow rises, and the drainage side is pulled harder to
 * produce it — then handed them a bounded action whose second half did not appear on the console.
 * `calculatePressures` rounds pressures to whole millimetres, and two hundred rpm moves the
 * drainage pressure by six tenths of one. The displayed value was identical either side of the
 * action, which is the distractor's claim, not the keyed answer's.
 *
 * So these tests assert what a learner can *see*, using `readouts.*.displayed` throughout rather
 * than the raw model values. A test written against the raw values would have passed the whole time
 * the lesson was contradicting itself.
 */

const TRACKS: readonly SupportMode[] = ['vv', 'va']

function settledReference(supportMode: SupportMode, seconds = 8): EcmoSimulationState {
  let state = createReferenceSimulationState(supportMode === 'va' ? 'va-reference' : 'vv-reference')
  for (let tick = 0; tick < seconds; tick += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
  return state
}

/** The state a named guided action produces, reached the way the activity reaches it. */
function afterGuidedAction(
  sectionId: 'pump-and-pressure-zones',
  guidedId: string,
  supportMode: SupportMode,
): EcmoSimulationState {
  const runtime = ecmoFoundationLessonRuntime(sectionId)
  const guided = runtime.guidedActions.find((action) => action.id === guidedId)
  if (!guided) throw new Error(`No guided action ${guidedId} on ${sectionId}`)
  const variant = ecmoFoundationVariant(runtime, supportMode, guided.variantId ?? '')
  if (!variant) throw new Error(`No variant ${guided.variantId} for ${supportMode}`)
  return ecmoFoundationSessionReducer(
    createEcmoFoundationSessionState(ecmoFoundationPrimaryVariant(runtime, supportMode)),
    ecmoFoundationRestoreAction(variant, guided),
  ).simulation
}

function displayed(state: EcmoSimulationState) {
  const { readouts } = state.circuit
  return {
    flow: state.circuit.bloodFlow,
    rpm: state.device.rpmSetpoint,
    pVen: readouts.pVen.displayed,
    pInt: readouts.pInt.displayed,
    pArt: readouts.pArt.displayed,
    deltaP: readouts.deltaP.displayed,
  }
}

function guidedAction(guidedId: string): EcmoFoundationGuidedAction {
  const guided = ecmoFoundationLessonRuntime('pump-and-pressure-zones').guidedActions.find(
    (action) => action.id === guidedId,
  )
  if (!guided) throw new Error(`No guided action ${guidedId}`)
  return guided
}

describe('the bounded speed change shows the learner what they committed to', () => {
  it.each(TRACKS)(
    '%s: raising the speed raises the flow and deepens the suction, on screen',
    (supportMode) => {
      const before = displayed(settledReference(supportMode))
      const after = displayed(
        afterGuidedAction('pump-and-pressure-zones', 'increase-rpm', supportMode),
      )

      expect(after.rpm).toBeGreaterThan(before.rpm)
      expect(after.flow).toBeGreaterThan(before.flow)

      // The half of the keyed answer that used to be invisible. Both channels must be reporting a
      // number for the comparison to mean anything, and the displayed value must actually move.
      expect(before.pVen).not.toBeNull()
      expect(after.pVen).not.toBeNull()
      expect(after.pVen!).toBeLessThan(before.pVen!)
    },
  )

  it.each(TRACKS)('%s: backing the speed off relieves the suction, on screen', (supportMode) => {
    const before = displayed(settledReference(supportMode))
    const after = displayed(
      afterGuidedAction('pump-and-pressure-zones', 'decrease-rpm', supportMode),
    )

    expect(after.rpm).toBeLessThan(before.rpm)
    expect(after.flow).toBeLessThan(before.flow)
    expect(before.pVen).not.toBeNull()
    expect(after.pVen).not.toBeNull()
    expect(after.pVen!).toBeGreaterThan(before.pVen!)
  })

  /*
   * Why the magnitude is what it is.
   *
   * This is the regression pin, and it is written as a comparison rather than as a constant so that
   * shrinking the authored step back toward the invisible band fails here with a sentence that says
   * what went wrong. A future package is free to raise the step further; it is not free to lower it
   * past the point where this console can show the change.
   */
  it('uses the smallest step this console can actually show a drainage change at', () => {
    const reference = settledReference('vv')
    const baselinePVen = reference.circuit.readouts.pVen.displayed
    expect(baselinePVen).not.toBeNull()

    function pVenAfter(delta: number): number {
      let state = ecmoSimulationReducer(reference, {
        type: 'SET_RPM',
        rpm: reference.device.rpmSetpoint + delta,
      })
      for (let tick = 0; tick < 6; tick += 1) {
        state = ecmoSimulationReducer(state, { type: 'STEP' })
      }
      const value = state.circuit.readouts.pVen.displayed
      if (value === null) throw new Error(`pVen unavailable at ${delta}`)
      return value
    }

    // The band the lesson used to sit in: the model moves, the console does not.
    expect(pVenAfter(200)).toBe(baselinePVen)

    const authored = guidedAction('increase-rpm').resolve?.(reference) ?? []
    const authoredRpm = authored.find((action) => action.type === 'SET_RPM')
    expect(authoredRpm).toBeDefined()
    if (!authoredRpm || authoredRpm.type !== 'SET_RPM') return
    const authoredDelta = authoredRpm.rpm - reference.device.rpmSetpoint

    expect(
      `authored delta ${authoredDelta}: pVen ${pVenAfter(authoredDelta)} vs baseline ${baselinePVen}`,
    ).not.toBe(`authored delta ${authoredDelta}: pVen ${baselinePVen} vs baseline ${baselinePVen}`)
  })

  it('says in its own label how far it moves the speed', () => {
    for (const id of ['increase-rpm', 'decrease-rpm']) {
      const guided = guidedAction(id)
      const reference = settledReference('vv')
      const resolved = guided.resolve?.(reference) ?? []
      const setRpm = resolved.find((action) => action.type === 'SET_RPM')
      expect(setRpm).toBeDefined()
      if (!setRpm || setRpm.type !== 'SET_RPM') continue
      const magnitude = Math.abs(setRpm.rpm - reference.device.rpmSetpoint)
      // A label that names a different number than the action applies is the drift this catches.
      expect(guided.label).toContain(`${magnitude} rpm`)
    }
  })

  it('asks the learner about the same speed change the action applies', () => {
    const prediction = ecmoFoundationLearningItemsFor('pump-and-pressure-zones').prediction
    const reference = settledReference('vv')
    const resolved = guidedAction('increase-rpm').resolve?.(reference) ?? []
    const setRpm = resolved.find((action) => action.type === 'SET_RPM')
    expect(setRpm).toBeDefined()
    if (!setRpm || setRpm.type !== 'SET_RPM') return
    const magnitude = Math.abs(setRpm.rpm - reference.device.rpmSetpoint)
    expect(prediction.stem).toContain(`${magnitude} rpm`)
  })

  it.each(TRACKS)(
    '%s: charges nothing and raises no alarm, because there is no limit to exceed',
    (supportMode) => {
      for (const id of ['increase-rpm', 'decrease-rpm']) {
        const state = afterGuidedAction('pump-and-pressure-zones', id, supportMode)
        expect(state.scenario.activeFaults).toEqual([])
        expect(state.scenario.criticalErrors).toEqual([])
        expect(state.circuit.drainageChatter).toBe(false)
        // Every channel the lesson reads must still be reporting after the change.
        for (const channel of ['pVen', 'pInt', 'pArt', 'deltaP'] as const) {
          expect(state.circuit.readouts[channel].status).toBe('valid')
        }
      }
    },
  )
})

describe('the return-resistance comparison is three real engine states', () => {
  const BEATS = {
    baseline: 'restore-reference',
    obstructed: 'load-return-resistance',
    matched: 'reference-at-matched-flow',
  } as const

  function beat(id: string, supportMode: SupportMode) {
    return displayed(afterGuidedAction('pump-and-pressure-zones', id, supportMode))
  }

  it.each(TRACKS)(
    '%s: at one pump setting, resistance beyond the membrane drops the flow and lifts both post-pump pressures',
    (supportMode) => {
      const baseline = beat(BEATS.baseline, supportMode)
      const obstructed = beat(BEATS.obstructed, supportMode)

      // Same setting. The comparison is only about load if the speed did not move.
      expect(obstructed.rpm).toBe(baseline.rpm)

      expect(obstructed.flow).toBeLessThan(baseline.flow)
      expect(obstructed.pInt!).toBeGreaterThan(baseline.pInt!)
      expect(obstructed.pArt!).toBeGreaterThan(baseline.pArt!)

      // The drainage side quiets rather than diving, which is what separates this pattern from a
      // drainage limitation. Reading it the other way round is the error the drills exist to stop.
      expect(obstructed.pVen!).toBeGreaterThan(baseline.pVen!)
    },
  )

  it.each(TRACKS)(
    '%s: the gradient falls with the flow, so the copy may not call it unchanged',
    (supportMode) => {
      const baseline = beat(BEATS.baseline, supportMode)
      const obstructed = beat(BEATS.obstructed, supportMode)
      // Stated as an assertion rather than left implicit: the engine moves this number, and any
      // stop copy that says the gradient holds still at the same speed contradicts what is drawn.
      expect(obstructed.deltaP!).toBeLessThan(baseline.deltaP!)
    },
  )

  it.each(TRACKS)(
    '%s: at matched flow the membrane reads the same and the load does not',
    (supportMode) => {
      const obstructed = beat(BEATS.obstructed, supportMode)
      const matched = beat(BEATS.matched, supportMode)

      // Close enough to read as the same flow. The teaching is the comparison, not the third decimal.
      expect(Math.abs(matched.flow - obstructed.flow)).toBeLessThanOrEqual(0.05)

      // The membrane has not changed: the gradient is the same on both circuits at the same flow.
      expect(Math.abs(matched.deltaP! - obstructed.deltaP!)).toBeLessThanOrEqual(1)

      // What has changed is everything downstream of the pump.
      expect(obstructed.pInt!).toBeGreaterThan(matched.pInt! + 50)
      expect(obstructed.pArt!).toBeGreaterThan(matched.pArt! + 50)
    },
  )

  /*
   * The safety property of the whole comparison.
   *
   * `return-path-resistance` names driving the pump harder against the resistance as the reflex to
   * avoid, and this engine would show that reflex working — flow comes back and the gradient
   * returns to its reference value. So the matched-flow beat slows the healthy circuit instead, and
   * no beat is allowed to raise the speed at all.
   */
  it.each(TRACKS)('%s: no beat drives the pump harder than the reference speed', (supportMode) => {
    const reference = settledReference(supportMode).device.rpmSetpoint
    for (const id of Object.values(BEATS)) {
      const state = beat(id, supportMode)
      expect(`${id}: ${state.rpm} vs reference ${reference}`).toBe(
        `${id}: ${Math.min(state.rpm, reference)} vs reference ${reference}`,
      )
    }
  })

  it.each(TRACKS)('%s: reads every channel on every beat, and charges nothing', (supportMode) => {
    for (const id of Object.values(BEATS)) {
      const state = afterGuidedAction('pump-and-pressure-zones', id, supportMode)
      for (const channel of ['pVen', 'pInt', 'pArt', 'deltaP'] as const) {
        expect(`${id} ${channel}: ${state.circuit.readouts[channel].status}`).toBe(
          `${id} ${channel}: valid`,
        )
      }
      expect(`${id}: ${state.scenario.criticalErrors.join()}`).toBe(`${id}: `)
      // A resisted return is not a drainage limitation, and must never present as one.
      expect(`${id}: ${state.circuit.drainageChatter}`).toBe(`${id}: false`)
    }
  })

  it.each(TRACKS)(
    '%s: loads its own case, never the case belonging to the other track',
    (supportMode) => {
      const state = afterGuidedAction('pump-and-pressure-zones', BEATS.obstructed, supportMode)
      expect(state.supportMode).toBe(supportMode)
      expect(state.scenario.scenarioId).toBe(
        supportMode === 'va'
          ? 'va-afterload-arterial-return-obstruction'
          : 'afterload-return-obstruction',
      )
      expect(state.scenario.activeFaults).toContain('return-obstruction')
    },
  )
})
