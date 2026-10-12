import { cardiohelpScenarioById } from './scenarios'

/**
 * What each integrated case rehearses, and what it cannot establish.
 *
 * A fellow walkthrough (IV-1, IV-3, IA-1; September 2026) met two integrated cases whose framing
 * claimed more than the exercise holds. The VV case is an off-sweep trial that no lesson in the
 * track teaches, and it ends without saying what the trial did or did not show. The VA case offers
 * one management button naming a whole plan, which reads as though pressing it carried the plan out.
 *
 * Neither is repaired by inventing content. A separation protocol, a threshold for calling a trial,
 * a duration and a resume rule are clinical decisions this module is not in a position to author
 * (ECMO-OWNER-11), and splitting the VA action into separately performed procedures would claim
 * bedside work the simulation does not represent. What can be done truthfully is to say, beside the
 * action and again in the debrief, what the exercise is and where it stops.
 *
 * Every sentence here describes this simulation's own behaviour or the sequence the case already
 * authors (`scenario.debrief.correctWorkflow`). None is a bedside rule, and none has had clinical
 * review: these notes bound a teaching exercise, they do not approve it.
 */
export interface EcmoIntegratedCaseScope {
  /** What the exercise actually rehearses, in the case's own already-authored terms. */
  readonly rehearses: string
  /** What the live exercise cannot establish. */
  readonly cannotEstablish: string
  /** Said beside the paired-lesson link, where the lesson teaches one part of the case only. */
  readonly lessonNote?: string
}

export const ECMO_INTEGRATED_CASE_SCOPE: Readonly<Record<string, EcmoIntegratedCaseScope>> =
  Object.freeze({
    'vv-off-sweep-capstone': {
      rehearses:
        'This case rehearses one sequence on a settled VV run: keep circuit blood flow where it is, turn the sweep gas off, then read the patient in a fixed order — oxygenation first, work of breathing second, PaCO₂ and pH third.',
      cannotEstablish:
        'No lesson in this track teaches separation from VV support, and this simulation does not decide whether a trial off sweep has succeeded, how long one should run, or when to restore the sweep. Those belong to your program’s protocol. While the case runs, the monitor keeps showing the patient’s readings and the sweep control on the gas blender stays available; this exercise does not ask you to call the trial, and it records no such call.',
      lessonNote:
        'That lesson teaches reading CO₂ together with pH, which is the third check in this case. It does not teach separation from support.',
    },
    'va-mixed-circulation-capstone': {
      rehearses:
        'This case rehearses recognising a right-arm and femoral saturation mismatch on peripheral VA support, reading both circulations, and treating the native lungs first.',
      cannotEstablish:
        'The one management step stands for the right radial gas and the ventilator change together. No venous return limb is placed here, so the right-arm reading stays low afterwards.',
    },
  })

export function ecmoIntegratedCaseScope(scenarioId: string): EcmoIntegratedCaseScope | undefined {
  return ECMO_INTEGRATED_CASE_SCOPE[scenarioId]
}

/** Structural check, run at import: a scope note may only describe a registered integrated case. */
export function validateEcmoIntegratedCaseScope(): readonly string[] {
  const errors: string[] = []
  for (const scenarioId of Object.keys(ECMO_INTEGRATED_CASE_SCOPE)) {
    const scenario = cardiohelpScenarioById.get(scenarioId)
    if (!scenario) errors.push(`integrated-case scope names an unknown scenario: ${scenarioId}`)
    else if (scenario.family !== 'capstone')
      errors.push(`integrated-case scope is registered for a non-integrated case: ${scenarioId}`)
  }
  return errors
}

const scopeErrors = validateEcmoIntegratedCaseScope()
if (scopeErrors.length > 0) {
  throw new Error(`Invalid ECMO integrated-case scope:\n- ${scopeErrors.join('\n- ')}`)
}
