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
