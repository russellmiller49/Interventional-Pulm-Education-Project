import { enterFreeDrive } from '@/lib/airway-anatomy/drive'
import {
  createInitialScopeState,
  type ScopeState as EngineScopeState,
} from '@/lib/airway-anatomy/scope-state'

import type {
  AirwayLabel,
  InspectionLedger,
  ScopeAssist,
  ScopeCommand,
  ScopeControlKey,
  ScopeEventId,
  ScopeInputMode,
  ScopeInputs,
  ScopeSignals,
  ScopeState,
  ScopeViewSpec,
} from '../../components/scope/types'
import { airwayStartPlacement } from './anatomyProfiles'
import {
  advanceInspectionLedger,
  createInspectionLedger,
  declareInspection,
  inspectionLedgerIsFinal,
} from './inspectionLedger'
import {
  commandAccessory,
  moveAccessory,
  verifyAccessory,
  type AccessoryOutcome,
  type MisreportPhase,
} from './scopeAccessory'
import type { ScopeCase } from './scopeCase'
import { assistEvent, controlUsedEvent, enteredEvent, ostiumVisualizedEvent } from './scopeEvents'
import { aimAt } from './scopeFrame'
import { clampDeflectionDeg, normalizeRotationDeg, resolveScopeInputs } from './scopeInputs'
import { SCOPE_MESSAGES, SCRIPT_REPORTS } from './scopeMessages'
import { insertScope } from './scopeMotion'
import { distalViewAirways, upcomingOstia } from './scopeOstia'
import {
  airwayDepthMm,
  buildScopePose,
  scopeLocation,
  tipBaseFrame,
  tipOpticalFrame,
} from './scopePose'
import type { ScopeContext, ScopeRuntime, ScopeRuntimeState } from './scopeRuntime'
import {
  breathPhaseAt,
  cordsForPhase,
  DRIFT_TOLERANCE_MM,
  HOLD_SECONDS,
  RED_OUT_RELAX_DEG,
  RED_OUT_WITHDRAW_MM,
  TUBE_START_MM,
} from './scopeScripts'

/**
 * The host reduces every pane command here; the pane renders the result (the seam's one rule).
 *
 * `createScopeState(view, case)` places the tip where the step starts; `reduceScope` applies one
 * command and rebuilds everything derived from it — pose, openings ahead, location, the inspection
 * record's heuristics, the view signal and the scripts — then appends what happened to the step's
 * events, the history the goals read. Pure: no clock, no randomness; simulated time passes only on
 * `tick`. A command for a control the step does not offer is refused and changes nothing.
 */

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

interface Draft {
  place: ScopeState['place']
  engine: EngineScopeState | null
  depthMm: number
  inputs: ScopeInputs
  ledger: InspectionLedger
  signals: Mutable<ScopeSignals>
  inputModes: ScopeInputMode[]
  assistsUsed: ScopeAssist[]
  script: ScopeState['script']
  runtime: Mutable<ScopeRuntime>
  events: ScopeEventId[]
  message: string | null
}

function requireCase(scopeCase: ScopeCase | null, view: ScopeViewSpec): ScopeCase {
  if (!scopeCase)
    throw new Error(`${view.sectionId}: the ${view.mode} view needs the teaching graph`)
  return scopeCase
}

function startPosition(
  view: ScopeViewSpec,
  scopeCase: ScopeCase | null,
): Pick<Draft, 'place' | 'engine' | 'depthMm'> {
  const start = view.start
  switch (start.kind) {
    case 'bench':
      return { place: 'bench', engine: null, depthMm: 0 }
    case 'larynx':
      return { place: 'larynx', engine: null, depthMm: 0 }
    case 'tube': {
      const sc = requireCase(scopeCase, view)
      const trachea = sc.originEdge.get('TR')
      if (trachea === undefined) throw new Error('The teaching graph has no trachea')
      const engine = createInitialScopeState(sc.graph, trachea, TUBE_START_MM)
      return { place: 'tube', engine, depthMm: airwayDepthMm(engine, view, sc) }
    }
    case 'airway': {
      const sc = requireCase(scopeCase, view)
      const at = airwayStartPlacement(sc, start.label, start.at)
      const engine = createInitialScopeState(sc.graph, at.edgeId, at.distanceMm)
      return { place: 'airway', engine, depthMm: airwayDepthMm(engine, view, sc) }
    }
  }
}

function freeWhenLoaded(
  engine: EngineScopeState | null,
  inputs: ScopeInputs,
  ctx: ScopeContext,
): EngineScopeState | null {
  const { view, scopeCase } = ctx
  if (view.mode !== 'free-drive' || !engine || !scopeCase?.collider) return engine
  return enterFreeDrive(engine, tipOpticalFrame(engine, inputs, view, scopeCase), scopeCase.graph)
}

function addAssist(d: Draft, assist: ScopeAssist) {
  if (!d.assistsUsed.includes(assist)) d.assistsUsed.push(assist)
}

export function createScopeState(
  view: ScopeViewSpec,
  scopeCase: ScopeCase | null,
): ScopeRuntimeState {
  const ctx: ScopeContext = { view, scopeCase }
  let inputs = resolveScopeInputs(view)
  const start = startPosition(view, scopeCase)
  const d: Draft = {
    ...start,
    engine: freeWhenLoaded(start.engine, inputs, ctx),
    inputs,
    ledger: createInspectionLedger(view),
    signals: {
      contactCount: 0,
      pathLengthMm: 0,
      view: 'clear',
      lossOfViewCount: 0,
      hold: { startedAtSec: null, driftMm: 0 },
      clockSec: 0,
    },
    inputModes: [],
    assistsUsed: [],
    script: null,
    runtime: { lens: 'clear', redOut: null, scriptBegun: false, holdDepthMm: null },
    events: [],
    message: null,
  }
  switch (view.script) {
    case 'red-out':
      d.runtime.redOut = { depthMm: d.depthMm, bendDeg: Math.abs(inputs.deflectionDeg) }
      d.events.push('red-out')
      d.signals.lossOfViewCount = 1
      d.script = { id: 'red-out', phase: 'lens-on-wall' }
      break
    case 'lens-contamination':
      if (view.scriptAirway) d.script = { id: 'lens-contamination', phase: 'waiting' }
      else {
        d.runtime.lens = 'contaminated'
        d.runtime.scriptBegun = true
        d.events.push('lens-contaminated')
        d.signals.lossOfViewCount = 1
        d.script = { id: 'lens-contamination', phase: 'smeared' }
      }
      break
    case 'unfamiliar-clear':
      if (view.scriptAirway) d.script = { id: 'unfamiliar-clear', phase: 'waiting' }
      else {
        d.runtime.scriptBegun = true
        inputs = { ...inputs, branchLabels: false }
        d.script = { id: 'unfamiliar-clear', phase: 'unidentified' }
      }
      break
    case 'assistant-interrupt':
      d.runtime.holdDepthMm = d.depthMm
      d.signals.hold = { startedAtSec: 0, driftMm: 0 }
      d.events.push('hold-started')
      d.script = { id: 'assistant-interrupt', phase: 'asking' }
      d.message = SCRIPT_REPORTS.holdForImage
      break
    case 'assistant-misreport':
      d.script = { id: 'assistant-misreport', phase: 'waiting' }
      break
    case 'breathing-cords': {
      const phase = breathPhaseAt(0)
      inputs = { ...inputs, cords: cordsForPhase(phase) }
      d.script = { id: 'breathing-cords', phase }
      break
    }
    case undefined:
      break
  }
  d.inputs = inputs
  if (view.mode === 'guided-walk') {
    addAssist(d, 'centerline-lock')
    if (view.assists['aim-guard'] !== false) addAssist(d, 'aim-guard')
  }
  if (view.mode === 'free-drive' && !scopeCase?.collider) addAssist(d, 'centerline-lock')
  if (view.assists['reference-orientation'] === true) addAssist(d, 'reference-orientation')
  if (inputs.branchLabels) addAssist(d, 'branch-labels')
  return finalize(null, d, ctx)
}

/** The control a command belongs to; null for time passing and for assists without a control. */
export function scopeCommandControl(command: ScopeCommand): ScopeControlKey | null {
  switch (command.type) {
    case 'advance':
      return command.mm < 0 ? 'withdraw' : 'advance'
    case 'rotate':
    case 'set-rotation':
      return 'rotate'
    case 'deflect':
    case 'set-deflection':
      return 'deflect'
    case 'suction':
      return 'suction'
    case 'accessory':
    case 'accessory-move':
      return 'accessory'
    case 'verify-accessory':
      return 'verifyAccessory'
    case 'clear-lens':
      return 'clearLens'
    case 'capture':
      return 'capture'
    case 'acknowledge':
      return 'acknowledge'
    case 'tick':
      return null
    case 'assist':
      if (command.assist === 'recenter') return 'recenter'
      return command.assist === 'teleport-to-start' ? 'teleportStart' : null
    case 'branch-labels':
      return 'branchLabels'
    case 'declare':
      return 'declare'
  }
}

function applyAccessory(d: Draft, outcome: AccessoryOutcome) {
  d.inputs = outcome.inputs
  d.events.push(...outcome.events)
  d.message = outcome.message
  if (outcome.phase) d.script = { id: 'assistant-misreport', phase: outcome.phase }
}

export function reduceScope(
  state: ScopeRuntimeState,
  command: ScopeCommand,
  inputMode: ScopeInputMode,
  ctx: ScopeContext,
): ScopeRuntimeState {
  const { view, scopeCase } = ctx
  const control = scopeCommandControl(command)
  if (control && !view.controls.includes(control))
    return { ...state, message: SCOPE_MESSAGES.controlNotOffered }
  const d: Draft = {
    place: state.place,
    engine: state.engine,
    depthMm: state.depthMm,
    inputs: state.inputs,
    ledger: state.ledger,
    signals: { ...state.signals },
    inputModes:
      command.type === 'tick' || state.inputModes.includes(inputMode)
        ? [...state.inputModes]
        : [...state.inputModes, inputMode],
    assistsUsed: [...state.assistsUsed],
    script: state.script,
    runtime: { ...state.runtime },
    events: [],
    message: null,
  }
  const misreport =
    view.script === 'assistant-misreport'
      ? ((state.script?.phase ?? 'waiting') as MisreportPhase)
      : null

  switch (command.type) {
    case 'advance': {
      d.events.push(controlUsedEvent('insertion'))
      const moved = insertScope(state, command.mm, ctx)
      d.place = moved.place
      d.engine = moved.engine
      d.depthMm = moved.depthMm
      d.events.push(...moved.events)
      d.message = moved.message
      if (moved.contact) d.signals.contactCount += 1
      d.signals.pathLengthMm += moved.travelledMm
      if (moved.lensOnWall && !d.runtime.redOut) {
        d.runtime.redOut = { depthMm: d.depthMm, bendDeg: Math.abs(d.inputs.deflectionDeg) }
        d.events.push('red-out')
        d.signals.lossOfViewCount += 1
      }
      if (moved.aimGuardActed) addAssist(d, 'aim-guard')
      if (command.mm > 0 && moved.travelledMm > 0 && state.signals.view !== 'clear') {
        d.events.push('advanced-blind')
        d.message = d.message ?? SCOPE_MESSAGES.advancedBlind
      }
      break
    }
    case 'rotate':
    case 'set-rotation': {
      const next = normalizeRotationDeg(
        command.type === 'rotate' ? d.inputs.rotationDeg + command.deg : command.deg,
      )
      if (next !== d.inputs.rotationDeg) {
        d.inputs = { ...d.inputs, rotationDeg: next }
        d.events.push(controlUsedEvent('rotation'))
      }
      break
    }
    case 'deflect':
    case 'set-deflection': {
      const next = clampDeflectionDeg(
        command.type === 'deflect' ? d.inputs.deflectionDeg + command.deg : command.deg,
      )
      if (next !== d.inputs.deflectionDeg) {
        d.inputs = { ...d.inputs, deflectionDeg: next }
        d.events.push(controlUsedEvent('deflection'))
      }
      break
    }
    case 'suction':
      if (command.on !== d.inputs.suction) {
        d.inputs = { ...d.inputs, suction: command.on }
        d.events.push(controlUsedEvent('suction'))
        if (command.on && state.signals.view === 'red-out') {
          d.events.push('suction-in-red-out')
          d.message = SCOPE_MESSAGES.suctionInRedOut
        }
      }
      break
    case 'accessory':
      applyAccessory(d, commandAccessory(d.inputs, command.state, misreport))
      break
    case 'accessory-move':
      applyAccessory(d, moveAccessory(d.inputs, command.to, misreport))
      break
    case 'verify-accessory':
      applyAccessory(d, verifyAccessory(d.inputs, misreport))
      break
    case 'clear-lens':
      if (d.runtime.lens === 'contaminated') {
        d.runtime.lens = 'clear'
        d.events.push('lens-cleared')
        d.message = SCOPE_MESSAGES.lensCleared
        if (d.script?.id === 'lens-contamination') d.script = { ...d.script, phase: 'cleared' }
      } else d.message = SCOPE_MESSAGES.lensAlreadyClear
      break
    case 'capture':
      d.events.push('captured')
      d.message = SCOPE_MESSAGES.captured
      break
    case 'acknowledge':
      d.events.push('acknowledged')
      if (d.script?.id === 'assistant-interrupt' && d.signals.hold.startedAtSec !== null) {
        d.script = { ...d.script, phase: 'acknowledged' }
        d.message = SCRIPT_REPORTS.holdThanks
      }
      break
    case 'tick': {
      d.signals.clockSec += Math.max(0, Math.min(10, command.seconds || 0))
      if (view.script === 'breathing-cords') {
        const phase = breathPhaseAt(d.signals.clockSec)
        d.inputs = { ...d.inputs, cords: cordsForPhase(phase) }
        d.script = { id: 'breathing-cords', phase }
      }
      break
    }
    case 'assist': {
      const assist = command.assist
      if (view.assists[assist] !== true) {
        d.message = SCOPE_MESSAGES.assistNotOffered
        break
      }
      if (command.assist === 'align-to-branch') {
        const label = command.label
        const pin = state.ostia.find((candidate) => candidate.label === label)
        if (!pin || !state.engine || !scopeCase) {
          d.message = SCOPE_MESSAGES.noSuchOpening
          break
        }
        const aim = aimAt(tipBaseFrame(state.engine, view, scopeCase), pin.pointLps)
        d.inputs = { ...d.inputs, rotationDeg: aim.rotationDeg, deflectionDeg: aim.deflectionDeg }
      } else if (assist === 'recenter') {
        d.inputs = { ...d.inputs, rotationDeg: 0, deflectionDeg: 0 }
      } else {
        const start = startPosition(view, scopeCase)
        d.place = start.place
        d.engine = freeWhenLoaded(start.engine, d.inputs, ctx)
        d.depthMm = start.depthMm
        d.runtime.redOut = null
      }
      d.events.push(assistEvent(assist))
      addAssist(d, assist)
      break
    }
    case 'branch-labels':
      if (view.assists['branch-labels'] !== true) d.message = SCOPE_MESSAGES.labelsNotOffered
      else if (command.on && d.script?.phase === 'unidentified')
        d.message = SCOPE_MESSAGES.labelsWithheld
      else if (command.on !== d.inputs.branchLabels) {
        d.inputs = { ...d.inputs, branchLabels: command.on }
        if (command.on) {
          d.events.push(assistEvent('branch-labels'))
          addAssist(d, 'branch-labels')
        }
      }
      break
    case 'declare': {
      const result = declareInspection(d.ledger, command.airway, command.status)
      if (result.kind === 'refused') d.message = result.message
      else {
        d.ledger = result.ledger
        d.events.push(result.event)
        d.message = result.message
      }
      break
    }
  }
  return finalize(state, d, ctx)
}

/** Rebuild every derived field from the draft, then append what happened to the history. */
function finalize(prev: ScopeRuntimeState | null, d: Draft, ctx: ScopeContext): ScopeRuntimeState {
  const { view, scopeCase } = ctx
  const history = (): readonly ScopeEventId[] => [...(prev?.events ?? []), ...d.events]

  // The tip against the wall: withdrawing slightly or reducing the bend lifts the lens off it.
  const redOut = d.runtime.redOut
  if (redOut) {
    const withdrawn = redOut.depthMm - d.depthMm >= RED_OUT_WITHDRAW_MM
    const relaxed =
      redOut.bendDeg >= RED_OUT_RELAX_DEG &&
      redOut.bendDeg - Math.abs(d.inputs.deflectionDeg) >= RED_OUT_RELAX_DEG
    if (withdrawn || relaxed) {
      d.runtime.redOut = null
      d.events.push('red-out-recovered')
      d.message = d.message ?? SCOPE_MESSAGES.redOutRecovered
      if (d.script?.id === 'red-out') d.script = { ...d.script, phase: 'recovered' }
    }
  }

  // Scripts that wait for the first entry into an airway.
  const trigger = view.scriptAirway
  if (trigger && !d.runtime.scriptBegun && d.events.includes(enteredEvent(trigger))) {
    d.runtime.scriptBegun = true
    if (view.script === 'lens-contamination') {
      d.runtime.lens = 'contaminated'
      d.events.push('lens-contaminated')
      d.signals.lossOfViewCount += 1
      d.script = { id: 'lens-contamination', phase: 'smeared' }
    } else if (view.script === 'unfamiliar-clear') {
      d.inputs = { ...d.inputs, branchLabels: false }
      d.script = { id: 'unfamiliar-clear', phase: 'unidentified' }
    }
  } else if (
    d.script?.id === 'unfamiliar-clear' &&
    d.script.phase === 'unidentified' &&
    d.events.some((event) => event.startsWith('withdrew-to:'))
  )
    d.script = { ...d.script, phase: 'reoriented' }

  const signalView: ScopeSignals['view'] = d.runtime.redOut
    ? 'red-out'
    : d.runtime.lens === 'contaminated'
      ? 'contaminated'
      : 'clear'

  const engine = d.engine
  const onTree =
    (d.place === 'airway' || d.place === 'tube') && engine !== null && scopeCase !== null
  const pose = onTree ? buildScopePose(engine, d.inputs, view, scopeCase) : null
  const ostia =
    onTree && pose?.opticalFrame
      ? upcomingOstia(scopeCase, engine.edgeId, engine.distanceMm, pose.opticalFrame)
      : []
  const location = scopeLocation(d.place, engine, d.depthMm, scopeCase)

  // An opening counts as seen when it comes into a clear view.
  const clear = signalView === 'clear'
  const seenBefore = new Set<AirwayLabel>(
    prev && prev.signals.view === 'clear'
      ? prev.ostia.filter((pin) => pin.inView).map((pin) => pin.label)
      : [],
  )
  const visible = new Set<AirwayLabel>()
  for (const pin of ostia) {
    if (!pin.inView || !clear) continue
    visible.add(pin.label)
    if (!seenBefore.has(pin.label)) d.events.push(ostiumVisualizedEvent(pin.label))
  }
  d.ledger = advanceInspectionLedger(d.ledger, {
    visible,
    entered: onTree ? location.parentage : [],
    distalView:
      clear && onTree
        ? distalViewAirways(scopeCase, engine.edgeId, engine.distanceMm)
        : new Set<AirwayLabel>(),
  })
  if (view.ledger && inspectionLedgerIsFinal(d.ledger) && !history().includes('survey-complete'))
    d.events.push('survey-complete')

  // Drill D10: hold the view while the assistant speaks and the image is taken.
  const holdStart = d.signals.hold.startedAtSec
  if (
    view.script === 'assistant-interrupt' &&
    holdStart !== null &&
    d.runtime.holdDepthMm !== null
  ) {
    const driftMm = Math.abs(d.depthMm - d.runtime.holdDepthMm)
    d.signals.hold = { startedAtSec: holdStart, driftMm }
    if (driftMm > DRIFT_TOLERANCE_MM && !history().includes('drift-detected'))
      d.events.push('drift-detected')
    const done = history()
    if (
      d.signals.clockSec - holdStart >= HOLD_SECONDS &&
      done.includes('acknowledged') &&
      done.includes('captured')
    ) {
      d.events.push('hold-completed')
      d.signals.hold = { startedAtSec: null, driftMm }
      d.script = { id: 'assistant-interrupt', phase: 'done' }
      d.message = SCRIPT_REPORTS.holdDone
    }
  }

  return {
    inputs: d.inputs,
    engine,
    pose,
    place: d.place,
    depthMm: d.depthMm,
    location,
    ostia,
    events: history(),
    ledger: d.ledger,
    signals: { ...d.signals, view: signalView },
    inputModes: d.inputModes,
    assistsUsed: d.assistsUsed,
    script: d.script,
    message: d.message,
    runtime: d.runtime,
  }
}
