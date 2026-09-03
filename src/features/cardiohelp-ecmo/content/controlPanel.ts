import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { validateEvidenceIds } from './evidence'

/**
 * The small control panel: the three things a learner can change on this circuit, said once.
 *
 * A novice reads a console as fifty things that might need action. Enumerating the few that are
 * actually settings — and saying out loud that everything else is monitoring — is what turns every
 * later alarm from "what do I touch?" into "which knob, if any?". The "if any" is the point: most
 * of the drills in this module are cause problems no knob answers, and the panel is what makes that
 * a teachable answer rather than a trick.
 *
 * Authored here and quoted nowhere else. The drill specs reuse it as a recurring strip with each
 * knob in one of a few states; the foundation section that introduces it reads these records
 * rather than restating them.
 *
 * The clamps are listed apart from the knobs on purpose. They are hardware a learner will reach for
 * in two situations, both emergencies, and neither is "adjusting support".
 */

export const ecmoControlKnobIds = ['pump-speed', 'sweep', 'oxygen-fraction'] as const
export type EcmoControlKnobId = (typeof ecmoControlKnobIds)[number]

/** The two axes the three knobs live on. Two knobs on the gas path, one on the blood path. */
export type EcmoControlAxis = 'blood path' | 'gas path'

export interface EcmoControlKnob {
  readonly id: EcmoControlKnobId
  /** Plain name first; the label a learner sees on the device second. */
  readonly plainName: string
  readonly consoleLabel: string
  readonly axis: EcmoControlAxis
  /** What this knob is for. */
  readonly principallyMoves: string
  /** What it does not do, said beside what it does, because the two are habitually confused. */
  readonly doesNotMove: string
}

export interface EcmoEmergencyOnlyControl {
  readonly id: 'clamps'
  readonly plainName: string
  readonly sentence: string
}

export interface EcmoControlPanel {
  readonly knobs: readonly EcmoControlKnob[]
  readonly emergencyOnly: readonly EcmoEmergencyOnlyControl[]
  /** The one sentence the panel is introduced with. */
  readonly sentence: string
  readonly sourceIds: readonly string[]
}

export const ECMO_CONTROL_PANEL = {
  knobs: [
    {
      id: 'pump-speed',
      plainName: 'Pump speed',
      consoleLabel: 'rpm',
      axis: 'blood path',
      principallyMoves: 'oxygen transfer and the support delivered',
      doesNotMove: 'CO₂ clearance, except a little',
    },
    {
      id: 'sweep',
      plainName: 'Sweep',
      consoleLabel: 'external blender',
      axis: 'gas path',
      principallyMoves: 'CO₂ clearance',
      doesNotMove: 'oxygenation, except a little',
    },
    {
      id: 'oxygen-fraction',
      plainName: 'Oxygen fraction of the sweep gas',
      consoleLabel: 'FiO₂ on the blender',
      axis: 'gas path',
      principallyMoves: 'the oxygen offered to the membrane',
      doesNotMove: 'the gradient that carries CO₂ away',
    },
  ],
  emergencyOnly: [
    {
      id: 'clamps',
      plainName: 'The circuit clamps',
      sentence: 'For air in the circuit and for coming off support. Not a control.',
    },
  ],
  sentence:
    'You can change three things on this circuit: pump speed, sweep, and the oxygen fraction of the sweep gas. The clamps are for emergencies only. Everything else on the console is monitoring.',
  sourceIds: [
    'ecmo-book-ch17',
    'ecmo-book-ch18',
    'ifu-console-workflow',
    'bounded-educational-model',
  ],
} as const satisfies EcmoControlPanel

export const ecmoControlKnobById: ReadonlyMap<EcmoControlKnobId, EcmoControlKnob> = new Map(
  ECMO_CONTROL_PANEL.knobs.map((knob) => [knob.id, knob]),
)

export function ecmoControlKnob(id: EcmoControlKnobId): EcmoControlKnob {
  const knob = ecmoControlKnobById.get(id)
  if (!knob) throw new Error(`Unknown ECMO control knob: ${id}`)
  return knob
}

/**
 * Phrasings that turn a contextual value into a universal instruction.
 *
 * Mirrored from `critical-care/test-support/teachingPanelContract.tsx`, which cannot be imported
 * by content because it calls jest's `expect`. The control-panel test reads that file's source and
 * holds the two lists to each other, so the mirror cannot drift silently. Every pattern needs a
 * digit, so copy that carries no number cannot match one — the check is kept anyway, so that a
 * registry which later admits a sourced number still cannot phrase it as a target.
 */
export const ecmoUniversalTargetPatterns: readonly RegExp[] = [
  /\btarget of\s*\d/i,
  /\bshould (always )?be (above|below|over|under|greater than|less than)\s*\d/i,
  /\bkeep\b[^.]{0,32}\b(above|below|over|under)\s*\d/i,
  /\bnormal is\s*\d/i,
  /\bnormal range is\s*\d/i,
  /\baim for\s*\d/i,
]

export interface EcmoLearnerCopyOptions {
  /**
   * Mirrors `learnerCopyOverrideReason` on clinical learning items: a reviewed term used in its
   * clinical sense rather than as software or scoring vocabulary, with the reason on record. The
   * reason must name every term it excuses, so an override written for one word cannot quietly
   * cover a second.
   */
  readonly learnerCopyOverrideReason?: string
}

/**
 * The rules every learner-facing string in these registries is held to, in one place.
 *
 * No digit — a learner leaves with a direction and a comparison, never a number. No term from the
 * reviewed learner-copy list. No phrasing that reads as a universal bedside target. Returned as
 * messages rather than thrown so a registry validator can gather everything wrong at once.
 */
export function ecmoLearnerCopyErrors(
  where: string,
  value: string,
  options: EcmoLearnerCopyOptions = {},
): readonly string[] {
  const errors: string[] = []
  if (value.trim().length === 0) errors.push(`${where}: empty learner copy`)
  if (/\d/.test(value)) errors.push(`${where}: a number appears in learner-facing copy`)

  const flagged = flaggedLearnerCopyTerms(value)
  if (flagged.length > 0) {
    const reason = options.learnerCopyOverrideReason?.toLowerCase() ?? ''
    const unexcused = flagged.filter((term) => reason.length === 0 || !reason.includes(term))
    if (unexcused.length > 0) {
      errors.push(`${where}: learner copy contains reviewed terms: ${unexcused.join(', ')}`)
    }
  }

  for (const pattern of ecmoUniversalTargetPatterns) {
    if (pattern.test(value))
      errors.push(`${where}: reads as a universal target (${pattern.source})`)
  }
  return errors
}

export function validateEcmoControlPanel(
  panel: EcmoControlPanel = ECMO_CONTROL_PANEL,
): readonly string[] {
  const errors: string[] = []

  if (panel.knobs.length !== 3) {
    errors.push(`the panel must name exactly three knobs, found ${panel.knobs.length}`)
  }
  const ids = panel.knobs.map((knob) => knob.id)
  if (new Set(ids).size !== ids.length) errors.push('two knobs share an id')
  for (const id of ecmoControlKnobIds) {
    if (!ids.includes(id)) errors.push(`knob ${id} is declared but has no record`)
  }
  for (const id of ids) {
    if (!(ecmoControlKnobIds as readonly string[]).includes(id)) {
      errors.push(`knob ${id} has a record but is not declared`)
    }
  }

  for (const knob of panel.knobs) {
    if (knob.principallyMoves === knob.doesNotMove) {
      errors.push(`${knob.id}: says it moves and does not move the same thing`)
    }
    for (const [field, value] of Object.entries({
      plainName: knob.plainName,
      consoleLabel: knob.consoleLabel,
      principallyMoves: knob.principallyMoves,
      doesNotMove: knob.doesNotMove,
    })) {
      errors.push(...ecmoLearnerCopyErrors(`${knob.id}.${field}`, value))
    }
    // The learner is told which axis a knob lives on by the sentence that introduces it.
    if (!panel.sentence.toLowerCase().includes(knob.plainName.toLowerCase())) {
      errors.push(`${knob.id}: the panel sentence does not name it`)
    }
  }

  if (panel.emergencyOnly.length !== 1 || panel.emergencyOnly[0]?.id !== 'clamps') {
    errors.push('the clamps are the only emergency-only control')
  }
  for (const control of panel.emergencyOnly) {
    errors.push(...ecmoLearnerCopyErrors(`${control.id}.plainName`, control.plainName))
    errors.push(...ecmoLearnerCopyErrors(`${control.id}.sentence`, control.sentence))
    if (!/not a control/i.test(control.sentence)) {
      errors.push(`${control.id}: must say it is not a control`)
    }
  }

  errors.push(...ecmoLearnerCopyErrors('sentence', panel.sentence))
  if (!/monitoring/i.test(panel.sentence)) {
    errors.push('the panel sentence must say that everything else is monitoring')
  }

  if (panel.sourceIds.length === 0) errors.push('no sources')
  if (!validateEvidenceIds(panel.sourceIds)) errors.push('names a source that is not registered')

  return errors
}

const controlPanelErrors = validateEcmoControlPanel()
if (controlPanelErrors.length > 0) {
  throw new Error(`Invalid ECMO control panel:\n- ${controlPanelErrors.join('\n- ')}`)
}
