import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import { hemodynamicsSourceById } from './sources'

/**
 * The control panel: the five things a learner can change on this monitoring system, said once.
 *
 * A bedside monitor with a pulmonary-artery catheter reads as fifty things that might need
 * attention. Five of them are settings the learner can change; three more are checks they can run;
 * everything else is monitoring. Enumerating that before any fault is the single largest reduction
 * in cognitive load the module can offer, and it turns every later question from "what do I touch?"
 * into "which of the five, if any?" — where "if any" is a teachable answer, because most faults on
 * this system have no setting that fixes them.
 *
 * Two axes are stated with it and reused on every Explain step: the *reference* (level and zero,
 * which move the whole tracing and change no shape) and the *response* (damping and scale, which
 * change the shape or the size and move nothing).
 */
export const hemodynamicsControlIds = ['level', 'zero', 'scale', 'tip', 'balloon'] as const

export type HemodynamicsControlId = (typeof hemodynamicsControlIds)[number]

export type HemodynamicsControlAxis = 'reference' | 'response' | 'position'

export interface HemodynamicsControl {
  readonly id: HemodynamicsControlId
  readonly plainName: string
  readonly monitorLabel: string
  readonly axis: HemodynamicsControlAxis
  readonly moves: string
  /** Said beside what it does, because the two are confused. */
  readonly doesNotMove: string
}

export const hemodynamicsCheckIds = ['fast-flush', 'injection', 'sample'] as const

export type HemodynamicsCheckId = (typeof hemodynamicsCheckIds)[number]

export interface HemodynamicsCheck {
  readonly id: HemodynamicsCheckId
  readonly plainName: string
  readonly sentence: string
}

export interface HemodynamicsControlPanel {
  readonly controls: readonly HemodynamicsControl[]
  readonly checks: readonly HemodynamicsCheck[]
  /** The whole panel in one breath. */
  readonly sentence: string
  readonly axes: Readonly<Record<HemodynamicsControlAxis, string>>
  readonly sourceIds: readonly string[]
}

export const HEMODYNAMICS_CONTROL_PANEL = {
  controls: [
    {
      id: 'level',
      plainName: 'where the transducer sits',
      monitorLabel: 'level',
      axis: 'reference',
      moves: 'the whole tracing, up or down, by a fixed amount',
      doesNotMove: 'the shape of a single wave',
    },
    {
      id: 'zero',
      plainName: 'what it calls zero',
      monitorLabel: 'zero',
      axis: 'reference',
      moves: 'where every displayed pressure is measured from',
      doesNotMove: 'the transducer itself, or a distorted response',
    },
    {
      id: 'scale',
      plainName: 'the display scale',
      monitorLabel: 'scale',
      axis: 'response',
      moves: 'how large the tracing is drawn',
      doesNotMove: 'the signal underneath it',
    },
    {
      id: 'tip',
      plainName: 'where the catheter tip is',
      monitorLabel: 'advance or withdraw',
      axis: 'position',
      moves: 'which chamber writes the tracing',
      doesNotMove: 'the pressures inside that chamber',
    },
    {
      id: 'balloon',
      plainName: 'whether the balloon is up',
      monitorLabel: 'inflate or deflate',
      axis: 'position',
      moves: 'whether the tip listens to the artery in front of it or the atrium beyond it',
      doesNotMove: 'the tip, once it is in the artery',
    },
  ],
  checks: [
    {
      id: 'fast-flush',
      plainName: 'a fast flush',
      sentence:
        'A fast flush is a check, not a setting: it asks the line whether it can follow a quick change, and the answer is read from how the tracing settles.',
    },
    {
      id: 'injection',
      plainName: 'a thermodilution injection',
      sentence:
        'A thermodilution injection is a measurement, not a setting: it produces one curve, and the curve is judged before its number is.',
    },
    {
      id: 'sample',
      plainName: 'a blood sample',
      sentence:
        'A blood sample from the tip is a measurement, not a setting: it feeds a calculation, and the calculation is only as good as where and when it was drawn.',
    },
  ],
  sentence:
    'You can change five things on this monitoring system: where the transducer sits, what it calls zero, the display scale, where the catheter tip is, and whether the balloon is up. Three more are checks you run, not settings: a fast flush, a thermodilution injection, and a blood sample. Everything else on the screen is monitoring — the pressures are read, flow is measured, and every other number is calculated from them.',
  axes: {
    reference:
      'The reference: level and zero move the whole tracing up or down and change no shape.',
    response:
      'The response: damping and scale change the shape or the size of the tracing and move nothing.',
    position:
      'The position: the tip and the balloon decide which chamber is writing the tracing at all.',
  },
  sourceIds: [
    'arterial-pressure-five-step-2020',
    'monitor-workflow-supplied',
    'icu-hemodynamics-model-v1',
  ],
} as const satisfies HemodynamicsControlPanel

const controlById = new Map<HemodynamicsControlId, HemodynamicsControl>(
  HEMODYNAMICS_CONTROL_PANEL.controls.map((control) => [control.id, control]),
)

export function hemodynamicsControl(id: HemodynamicsControlId): HemodynamicsControl {
  const control = controlById.get(id)
  if (!control) throw new Error(`Unknown hemodynamics control: ${id}`)
  return control
}

/**
 * Phrases that would hand a learner a universal number.
 *
 * The module teaches trend and relationship; a numeric band appears only with a source and an
 * institution-variation note, and never in a sentence shaped like an order.
 */
export const hemodynamicsUniversalTargetPatterns: readonly RegExp[] = [
  /\btarget of\s*\d/i,
  /\bshould (always )?be (above|below|over|under|greater than|less than)\s*\d/i,
  /\bkeep\b[^.]{0,32}\b(above|below|over|under)\s*\d/i,
  /\bnormal is\s*\d/i,
  /\bnormal range is\s*\d/i,
  /\baim for\s*\d/i,
  /\bmust (be|stay) (above|below|over|under)\s*\d/i,
]

export interface HemodynamicsLearnerCopyOptions {
  /** Names the term an override excuses; an override that excuses nothing is an error. */
  readonly learnerCopyOverrideReason?: string
  /** Copy that legitimately carries a sourced figure (a source-backed reference interval). */
  readonly allowsNumbers?: boolean
}

/**
 * The module-wide gate for learner-facing copy authored in the new registries.
 *
 * Three rules: the copy is not empty; it carries no software or examination vocabulary unless an
 * override names the term; and it does not phrase a number as a target. Numbers are refused by
 * default because most learner copy here has no business carrying one — the registries that do
 * (a source-backed interval, a story problem's readings) say so explicitly.
 */
export function hemodynamicsLearnerCopyErrors(
  where: string,
  value: string,
  options: HemodynamicsLearnerCopyOptions = {},
): readonly string[] {
  const errors: string[] = []
  const text = value.trim()
  if (text.length === 0) {
    errors.push(`${where} is empty.`)
    return errors
  }
  const flagged = flaggedLearnerCopyTerms(text)
  if (flagged.length > 0) {
    const reason = options.learnerCopyOverrideReason ?? ''
    const unexcused = flagged.filter((term) => !reason.toLowerCase().includes(term.toLowerCase()))
    if (unexcused.length > 0) {
      errors.push(`${where} contains review vocabulary: ${unexcused.join(', ')}.`)
    }
  } else if (options.learnerCopyOverrideReason) {
    errors.push(`${where} declares an override that excuses nothing.`)
  }
  if (!options.allowsNumbers && /\d/.test(text)) {
    errors.push(`${where} carries a number in learner copy.`)
  }
  for (const pattern of hemodynamicsUniversalTargetPatterns) {
    if (pattern.test(text)) {
      errors.push(`${where} phrases a number as a universal target (${pattern.source}).`)
    }
  }
  return errors
}

export function validateHemodynamicsControlPanel(
  panel: HemodynamicsControlPanel = HEMODYNAMICS_CONTROL_PANEL,
): readonly string[] {
  const errors: string[] = []
  if (panel.controls.length !== hemodynamicsControlIds.length) {
    errors.push(`The panel must declare exactly ${hemodynamicsControlIds.length} controls.`)
  }
  const seen = new Set<string>()
  for (const control of panel.controls) {
    if (seen.has(control.id)) errors.push(`Control ${control.id} is declared twice.`)
    seen.add(control.id)
    if (!hemodynamicsControlIds.includes(control.id)) {
      errors.push(`Control ${control.id} is not one of the declared five.`)
    }
    if (control.moves === control.doesNotMove) {
      errors.push(`Control ${control.id} says it moves what it does not move.`)
    }
    if (!panel.sentence.includes(control.plainName)) {
      errors.push(`The panel sentence does not name the control "${control.plainName}".`)
    }
    errors.push(
      ...hemodynamicsLearnerCopyErrors(`Control ${control.id}`, control.moves),
      ...hemodynamicsLearnerCopyErrors(`Control ${control.id}`, control.doesNotMove),
    )
  }
  for (const check of panel.checks) {
    if (!panel.sentence.includes(check.plainName)) {
      errors.push(`The panel sentence does not name the check "${check.plainName}".`)
    }
    if (!/not a setting/i.test(check.sentence)) {
      errors.push(`Check ${check.id} must say it is not a setting.`)
    }
    errors.push(...hemodynamicsLearnerCopyErrors(`Check ${check.id}`, check.sentence))
  }
  if (!/monitoring/i.test(panel.sentence)) {
    errors.push('The panel sentence must say that everything else is monitoring.')
  }
  errors.push(...hemodynamicsLearnerCopyErrors('The panel sentence', panel.sentence))
  for (const axis of Object.values(panel.axes)) {
    errors.push(...hemodynamicsLearnerCopyErrors('An axis sentence', axis))
  }
  for (const sourceId of panel.sourceIds) {
    if (!hemodynamicsSourceById.has(sourceId)) {
      errors.push(`The panel cites an unregistered source: ${sourceId}.`)
    }
  }
  return errors
}

const controlPanelErrors = validateHemodynamicsControlPanel()
if (controlPanelErrors.length > 0) {
  throw new Error(`Hemodynamics control panel is invalid:\n${controlPanelErrors.join('\n')}`)
}
