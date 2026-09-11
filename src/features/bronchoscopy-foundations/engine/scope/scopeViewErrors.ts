import {
  SCOPE_ASSISTS,
  SCOPE_CONTROL_KEYS,
  SCOPE_METRIC_IDS,
  SCOPE_MODES,
  isAirwayLabel,
  type ScopeAssist,
  type ScopeControlKey,
  type ScopeMetricId,
  type ScopeMode,
  type ScopeScriptId,
  type ScopeStart,
  type ScopeViewSpec,
} from '../../components/scope/types'
import { expectedLedgerAirways } from './inspectionLedger'
import { MODEL_DEFLECTION_LIMIT_DEG } from './scopeInputs'

/**
 * What is wrong with a view spec against the pane contract, independent of any section.
 *
 * The section validator checks a view's place in its section (ids, copy, deny patterns); this
 * checks that the pane can honour it: the start fits the mode, a script runs only where the engine
 * scripts it, a control or readout exists in that mode, a declared assist is known, and the
 * defaults stay inside the teaching model's limits.
 */

const START_KINDS: Readonly<Record<ScopeMode, readonly ScopeStart['kind'][]>> = {
  idle: ['airway'],
  'controls-isolated': ['bench'],
  'guided-walk': ['airway'],
  'free-drive': ['airway'],
  'larynx-entry': ['larynx'],
  tube: ['tube'],
  accessory: ['airway'],
}

const SCRIPT_MODES: Readonly<Record<ScopeScriptId, readonly ScopeMode[]>> = {
  'red-out': ['guided-walk', 'free-drive'],
  'lens-contamination': ['guided-walk', 'free-drive'],
  'unfamiliar-clear': ['guided-walk', 'free-drive'],
  'assistant-interrupt': ['guided-walk', 'free-drive'],
  'assistant-misreport': ['accessory'],
  'breathing-cords': ['larynx-entry'],
}

/** Scripts that may wait for the first entry into an airway before they begin. */
const AIRWAY_TRIGGERED_SCRIPTS: readonly ScopeScriptId[] = [
  'lens-contamination',
  'unfamiliar-clear',
]

const MODE_ONLY_METRICS: Readonly<Partial<Record<ScopeMetricId, readonly ScopeMode[]>>> = {
  annularAreaFraction: ['tube'],
  annularAreaMm2: ['tube'],
  cordsState: ['larynx-entry'],
  accessoryState: ['accessory'],
}

const MODE_ONLY_CONTROLS: Readonly<Partial<Record<ScopeControlKey, readonly ScopeMode[]>>> = {
  accessory: ['accessory'],
  verifyAccessory: ['accessory'],
}

/** A control that is an assist is offered only where the view allows that assist. */
const CONTROL_ASSISTS: Readonly<Partial<Record<ScopeControlKey, ScopeAssist>>> = {
  recenter: 'recenter',
  teleportStart: 'teleport-to-start',
  branchLabels: 'branch-labels',
}

/** Modes where the tip travels the airway tree and the map, pins and narrowings apply. */
const TREE_MODES: readonly ScopeMode[] = ['guided-walk', 'free-drive']

export function scopeViewErrors(view: ScopeViewSpec): readonly string[] {
  const where = `${view.sectionId} ${view.mode} view`
  if (!SCOPE_MODES.includes(view.mode)) return [`${where} uses an unknown mode.`]
  const errors: string[] = []
  const start = view.start
  if (!START_KINDS[view.mode].includes(start.kind))
    errors.push(`${where} cannot start at ${start.kind}.`)
  if (start.kind === 'airway') {
    if (!isAirwayLabel(start.label)) errors.push(`${where} starts in an unknown airway.`)
    if (!['proximal', 'mid', 'distal'].includes(start.at))
      errors.push(`${where} starts at an unknown place along the airway.`)
  }

  const seenControls = new Set<string>()
  for (const control of view.controls) {
    if (!SCOPE_CONTROL_KEYS.includes(control)) {
      errors.push(`${where} offers an unknown control ${control}.`)
      continue
    }
    if (seenControls.has(control)) errors.push(`${where} offers ${control} twice.`)
    seenControls.add(control)
    const modes = MODE_ONLY_CONTROLS[control]
    if (modes && !modes.includes(view.mode))
      errors.push(`${where} offers ${control}, which only the ${modes.join(' or ')} mode has.`)
    const assist = CONTROL_ASSISTS[control]
    if (assist && view.assists[assist] !== true)
      errors.push(`${where} offers ${control} without allowing the ${assist} assist.`)
  }
  if (seenControls.has('declare') && !view.ledger)
    errors.push(`${where} offers declarations without an inspection record.`)
  if (seenControls.has('clearLens') && view.script !== 'lens-contamination')
    errors.push(`${where} offers lens clearing without a scripted smear.`)

  for (const assist of Object.keys(view.assists)) {
    if (!SCOPE_ASSISTS.includes(assist as ScopeAssist))
      errors.push(`${where} declares an unknown assist ${assist}.`)
  }

  for (const metric of view.readouts ?? []) {
    if (!SCOPE_METRIC_IDS.includes(metric)) {
      errors.push(`${where} shows an unknown readout ${metric}.`)
      continue
    }
    const modes = MODE_ONLY_METRICS[metric]
    if (modes && !modes.includes(view.mode))
      errors.push(`${where} shows ${metric}, which only the ${modes.join(' or ')} mode has.`)
  }

  const expected = expectedLedgerAirways(view)
  for (const label of expected) {
    if (!isAirwayLabel(label))
      errors.push(`${where} lists an unknown airway ${label} on its record.`)
  }
  for (const label of view.litAirways ?? []) {
    if (!isAirwayLabel(label)) errors.push(`${where} lights an unknown airway ${label}.`)
  }
  if (view.inaccessible?.length) {
    if (!TREE_MODES.includes(view.mode))
      errors.push(`${where} scripts a narrowing outside the airway tree.`)
    for (const label of view.inaccessible) {
      if (!isAirwayLabel(label)) errors.push(`${where} narrows an unknown airway ${label}.`)
      else if (view.ledger && !expected.includes(label))
        errors.push(`${where} narrows ${label}, which its record does not list.`)
    }
  }

  if (view.script) {
    const modes = SCRIPT_MODES[view.script]
    if (!modes) errors.push(`${where} runs an unknown script ${view.script}.`)
    else if (!modes.includes(view.mode))
      errors.push(`${where} runs ${view.script}, which the ${view.mode} mode does not script.`)
  }
  if (view.scriptAirway !== undefined) {
    if (!view.script || !AIRWAY_TRIGGERED_SCRIPTS.includes(view.script))
      errors.push(`${where} names a script airway for a script that does not wait for one.`)
    if (!isAirwayLabel(view.scriptAirway))
      errors.push(`${where} names an unknown script airway ${view.scriptAirway}.`)
  }

  const defaults = view.defaults ?? {}
  if (defaults.rotationDeg !== undefined && Math.abs(defaults.rotationDeg) > 180)
    errors.push(`${where} starts rotated beyond half a turn.`)
  if (
    defaults.deflectionDeg !== undefined &&
    Math.abs(defaults.deflectionDeg) > MODEL_DEFLECTION_LIMIT_DEG
  )
    errors.push(`${where} starts deflected beyond the model's range.`)
  if (defaults.stepMm !== undefined && !(defaults.stepMm > 0 && defaults.stepMm <= 10))
    errors.push(`${where} sets a step outside the model's range.`)
  if (defaults.scopeOdMm !== undefined && !(defaults.scopeOdMm > 0))
    errors.push(`${where} sets a scope without a diameter.`)
  if (defaults.tube !== undefined && view.mode !== 'tube')
    errors.push(`${where} sets a tube outside the tube mode.`)
  if (view.mode === 'tube') {
    const tube = defaults.tube
    if (!tube) errors.push(`${where} has no tube.`)
    else if (!(tube.idMm > (defaults.scopeOdMm ?? 0)))
      errors.push(`${where} puts the scope in a tube no wider than it.`)
  }
  if (
    (defaults.accessory !== undefined || defaults.accessoryPosition !== undefined) &&
    view.mode !== 'accessory'
  )
    errors.push(`${where} sets an accessory outside the accessory mode.`)
  if (defaults.cords !== undefined && view.mode !== 'larynx-entry')
    errors.push(`${where} sets the vocal folds outside the larynx.`)

  if (!view.boundary.trim()) errors.push(`${where} prints no model boundary.`)
  return errors
}
