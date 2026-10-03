import type { McsDeviceKind, McsSimulationState } from '../engine/types'

/**
 * One naming crosswalk for the devices this module shows (F16).
 *
 * A first-year fellow met four to six names for each device — the balloon, counterpulsation, IABP;
 * the transvalvular pump, microaxial support, the left-sided pump, Impella CP — and stopped each time
 * to check whether they were different devices. The mechanism names are worth keeping: they are the
 * teaching. What was missing was one place that says which words name the same thing, and which
 * words must never be read as the same thing.
 *
 * Four kinds of name are kept apart on purpose, because collapsing them is how a generic model
 * becomes a manufacturer's device by accident:
 *
 *  - `shortLabel`        what buttons, tables and status rows call it
 *  - `mechanism`         what it does, said once in parentheses beside the short label
 *  - `productIdentity`   which product or product family the cited sources describe
 *  - `modelIdentity`     what this simulation actually is
 *
 * No stored id is named here and none changes: `McsDeviceKind`, the action ids and the storage keys
 * are exactly what they were. This file only says what the learner reads.
 */

export type McsNamedDeviceId = 'iabp' | 'impella-cp' | 'impella-55' | 'impella-rp' | 'lvad'

export interface McsDeviceNaming {
  readonly id: McsNamedDeviceId
  /** The engine topology this row belongs to. Read-only; nothing is keyed or stored on it here. */
  readonly kind: McsDeviceKind
  readonly shortLabel: string
  readonly mechanism: string
  /** Other words the module uses for the same thing, so a learner can match them. */
  readonly alsoCalled: readonly string[]
  readonly productIdentity: string
  readonly modelIdentity: string
  /** What this row must not be read as, in one sentence. */
  readonly notTheSameAs: string
  /** The open decision, where product identity is unresolved. */
  readonly openItem?: string
}

export const MCS_DEVICE_NAMING: readonly McsDeviceNaming[] = Object.freeze([
  {
    id: 'iabp',
    kind: 'iabp',
    shortLabel: 'IABP',
    mechanism: 'counterpulsation',
    alsoCalled: ['intra-aortic balloon pump', 'the balloon', 'counterpulsation'],
    productIdentity:
      'No console is named. The trigger and timing sources cited are Getinge / Datascope Cardiosave material.',
    modelIdentity:
      'A console-neutral counterpulsation model. It is not a Cardiosave and reproduces no console’s screen, software or alarm limits.',
    notTheSameAs:
      'A pump. The balloon changes the timing and shape of pressure and has no flow stream of its own.',
    openItem:
      'Which console model, software and market the module should teach is not decided (OD-01, NOT REVIEWED).',
  },
  {
    id: 'impella-cp',
    kind: 'impella',
    shortLabel: 'Impella CP',
    mechanism: 'LV-to-aorta microaxial pump',
    alsoCalled: ['transvalvular pump', 'left-sided pump', 'microaxial support'],
    productIdentity: 'Impella CP with SmartAssist, in the supplied instructions for use.',
    modelIdentity:
      'The default left-sided pump in this simulation. Its flow is this model’s estimate, not a console reading.',
    notTheSameAs:
      'The Impella 5.5. They are different pumps with different flow figures; the same performance level is not the same support.',
    openItem:
      'Which flow figure describes the CP, and how it is labelled, is open (MCS-03-01 and MCS-03-02, NOT REVIEWED).',
  },
  {
    id: 'impella-55',
    kind: 'impella',
    shortLabel: 'Impella 5.5',
    mechanism: 'LV-to-aorta microaxial pump',
    alsoCalled: ['transvalvular pump', 'left-sided pump', 'microaxial support'],
    productIdentity: 'Impella 5.5 with SmartAssist, in the supplied instructions for use.',
    modelIdentity:
      'An alternative left-sided configuration with its own modeled ceiling. Selected only where a section or case says so.',
    notTheSameAs:
      'The Impella CP. Same pathway, different pump: never carry a CP level or flow figure across.',
    openItem: 'Registered versus supplied labeling revision is open (MCS-03-03, NOT REVIEWED).',
  },
  {
    id: 'impella-rp',
    kind: 'impella',
    shortLabel: 'Impella RP',
    mechanism: 'right-sided microaxial pump, vena cava to pulmonary artery',
    alsoCalled: ['right-sided pump', 'right-sided support', 'RP'],
    productIdentity:
      'The supplied instructions are for the Impella RP. The registered product page describes the Impella RP Flex, a different product.',
    modelIdentity:
      'A right-sided pump of the RP family, modeled for direction only. Which right-sided product is being taught is not settled.',
    notTheSameAs:
      'The Impella RP Flex, unless and until that is reviewed. Its flow is also never added to a left-sided pump’s flow: the two pumps are in series.',
    openItem: 'RP versus RP Flex identity is open (MCS-03-04, OD-02, NOT REVIEWED).',
  },
  {
    id: 'lvad',
    kind: 'lvad',
    shortLabel: 'Durable LVAD',
    mechanism: 'generic continuous-flow pump, LV apex to ascending aorta',
    alsoCalled: ['durable pump', 'durable continuous-flow pump', 'LVAD'],
    productIdentity:
      'HeartMate 3 is the source-linked comparison only: an Abbott parameter card and an FDA labeling record are cited beside the model.',
    modelIdentity:
      'A generic continuous-flow mechanism. It is not a HeartMate 3 simulator and has no controller flow estimator: displayed flow here is the modeled flow itself.',
    notTheSameAs:
      'A HeartMate 3 controller. On that device flow is estimated from speed, power and hematocrit; this model runs the other way.',
    openItem:
      'Generic model versus named-device teaching is not decided (OD-02, NOT REVIEWED). No HeartMate 3 instructions for use were available to check.',
  },
])

const namingById = new Map(MCS_DEVICE_NAMING.map((row) => [row.id, row]))

export function mcsDeviceNaming(id: McsNamedDeviceId): McsDeviceNaming {
  const row = namingById.get(id)
  if (!row) throw new Error(`No naming row for ${id}`)
  return row
}

/** "IABP (counterpulsation)" — the short label with the mechanism said once beside it. */
export function mcsNameWithMechanism(id: McsNamedDeviceId): string {
  const row = mcsDeviceNaming(id)
  return `${row.shortLabel} (${row.mechanism})`
}

/** The naming row for a device track, where no pump variant is in play. */
export function mcsTrackNaming(kind: McsDeviceKind): McsDeviceNaming {
  return mcsDeviceNaming(kind === 'iabp' ? 'iabp' : kind === 'impella' ? 'impella-cp' : 'lvad')
}

/**
 * The devices actually in place in a state, by their short labels.
 *
 * Variant-aware, so an Impella 5.5 configuration is never announced as a CP, and a right-sided pump
 * is named as its own device rather than folded into "Impella".
 */
export function mcsActiveDeviceNames(state: McsSimulationState): readonly McsDeviceNaming[] {
  if (state.device.kind === 'iabp') return [mcsDeviceNaming('iabp')]
  if (state.device.kind === 'lvad') return [mcsDeviceNaming('lvad')]
  const names: McsDeviceNaming[] = []
  if (state.device.left.enabled) {
    names.push(mcsDeviceNaming(state.device.left.variant === '55' ? 'impella-55' : 'impella-cp'))
  }
  if (state.device.right.enabled) names.push(mcsDeviceNaming('impella-rp'))
  return names
}

/** One status-row sentence for the device on screen: short label first, mechanism once. */
export function mcsDeviceStatusLabel(state: McsSimulationState): string {
  const names = mcsActiveDeviceNames(state)
  if (names.length === 0) return 'No pump in place'
  if (names.length === 1) return `${names[0].shortLabel} · ${names[0].mechanism}`
  return names.map((row) => row.shortLabel).join(' + ')
}

function validateDeviceNaming(): readonly string[] {
  const errors: string[] = []
  const labels = new Set<string>()
  for (const row of MCS_DEVICE_NAMING) {
    if (labels.has(row.shortLabel)) errors.push(`duplicate short label: ${row.shortLabel}`)
    labels.add(row.shortLabel)
    for (const field of ['mechanism', 'productIdentity', 'modelIdentity', 'notTheSameAs'] as const)
      if (!row[field].trim()) errors.push(`${row.id}: ${field} is empty`)
  }
  // The three distinctions the crosswalk exists to hold, checked as data rather than as prose.
  if (mcsDeviceNaming('impella-cp').shortLabel === mcsDeviceNaming('impella-55').shortLabel)
    errors.push('Impella CP and 5.5 must have different short labels')
  if (!/RP Flex/.test(mcsDeviceNaming('impella-rp').notTheSameAs))
    errors.push('the RP row must say it is not the RP Flex')
  if (!/not a HeartMate 3 simulator/.test(mcsDeviceNaming('lvad').modelIdentity))
    errors.push('the durable row must say it is not a HeartMate 3 simulator')
  return errors
}

const namingErrors = validateDeviceNaming()
if (namingErrors.length > 0) {
  throw new Error(`Invalid MCS device naming:\n- ${namingErrors.join('\n- ')}`)
}
