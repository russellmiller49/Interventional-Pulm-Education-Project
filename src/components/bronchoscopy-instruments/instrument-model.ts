/**
 * The instrument lab's model: one accessory in the scope's working channel, its catheter's
 * position, and the one control the hand works at the handle.
 *
 * Pure and frame-free, so the steps and the faults are testable without a renderer. The lab
 * reduces learner moves into a `LabState`; `evaluate` reads the state and its short history into
 * the steps done, in order, and the faults seen.
 *
 * Distances are millimetres from the scope tip along the channel axis: negative while the catheter
 * tip is still inside the channel. They shape the drawing and the checks only; the lab teaches no
 * number from them.
 */

export type InstrumentId = 'forceps' | 'brush' | 'needle'

export const INSTRUMENT_IDS: readonly InstrumentId[] = ['forceps', 'brush', 'needle']

/** How far the catheter can go: from deep in the channel to past the target surface. */
export const OUT_MIN_MM = -10
/** The target's near surface, ahead of the scope tip. */
export const TARGET_MM = 14
/** Clear of the tip: the jaws, brush or needle can open out without touching the channel. */
export const CLEAR_MM = 3
/** Within this of the target surface counts as touching it. */
const CONTACT_MM = 1.2
/**
 * The brush works along the wall, not into it: its target is a plaque on the airway wall beside
 * its path, this far beyond the scope tip. The bristles sweep its surface as the catheter moves.
 */
export const BRUSH_TARGET_MM = { from: 6, to: 16 } as const
/** The bristled length of the brush, back from its tip. */
export const BRISTLE_LENGTH_MM = 8
/** The brush catheter's furthest reach: no wall stops it, the view does. */
const BRUSH_OUT_MAX_MM = 10
/** A control past this is open, out or deployed; below `CLOSED` it is shut or sheathed. */
const OPEN = 0.8
const CLOSED = 0.15
/** The brush and the needle sample by moving to and fro: this many reversals. */
const PASSES = 2

export interface LabState {
  readonly instrument: InstrumentId
  /** Catheter tip beyond the scope tip, mm. */
  readonly outMm: number
  /** The handle control, 0–1: forceps cups open, brush out of its sheath, needle out of its catheter. */
  readonly control: number
  /** Needle only: suction on the side port. */
  readonly suction: boolean
  /** What has happened so far, kept by the reducer: the evaluation reads it. */
  readonly memory: LabMemory
}

export interface LabMemory {
  /** Step ids done, in order. */
  readonly done: readonly string[]
  /** Fault ids seen, once each. */
  readonly faults: readonly FaultId[]
  /** Direction reversals of the catheter while sampling counts them. */
  readonly passes: number
  readonly lastDirection: -1 | 0 | 1
  /** The specimen is in the jaws, on the brush, or in the needle. */
  readonly specimen: boolean
  /** The specimen was lost before it reached the channel. */
  readonly lost: boolean
}

export type LabAction =
  | { readonly type: 'select'; readonly instrument: InstrumentId }
  | { readonly type: 'move'; readonly outMm: number }
  /** Move the catheter by this much from wherever it is. */
  | { readonly type: 'nudge'; readonly deltaMm: number }
  | { readonly type: 'control'; readonly value: number }
  | { readonly type: 'suction'; readonly on: boolean }
  | { readonly type: 'reset' }

export type FaultId =
  | 'opened-in-channel'
  | 'withdrawn-open'
  | 'brush-in-channel'
  | 'withdrawn-unsheathed'
  | 'needle-in-channel'
  | 'withdrawn-needle-out'
  | 'suction-off-target'
  | 'suction-on-withdrawal'
  | 'opened-after-bite'

export interface LabStep {
  readonly id: string
  /** Imperative, short: what the hand does. */
  readonly label: string
  /** What the learner sees when it is done. */
  readonly result: string
}

export interface LabFault {
  readonly id: FaultId
  readonly message: string
}

const EMPTY_MEMORY: LabMemory = {
  done: [],
  faults: [],
  passes: 0,
  lastDirection: 0,
  specimen: false,
  lost: false,
}

export function initialLabState(instrument: InstrumentId = 'forceps'): LabState {
  return { instrument, outMm: -6, control: 0, suction: false, memory: EMPTY_MEMORY }
}

// ── Where the working end is ─────────────────────────────────────────────────────────────────────

/** How far the working part reaches beyond the catheter tip when fully out, mm. */
export const REACH_MM: Readonly<Record<InstrumentId, number>> = {
  forceps: 0,
  brush: 10,
  needle: 6,
}

/** The distal end of whatever is exposed: the closed cups, the brush, or the needle tip. */
export function distalMm(state: Pick<LabState, 'instrument' | 'outMm' | 'control'>): number {
  return state.outMm + REACH_MM[state.instrument] * state.control
}

export function atTarget(state: Pick<LabState, 'instrument' | 'outMm' | 'control'>): boolean {
  if (state.instrument === 'brush') {
    // The exposed bristles lie alongside the plaque when their span overlaps it.
    const tip = distalMm(state)
    const back = Math.max(state.outMm, tip - BRISTLE_LENGTH_MM)
    return tip > state.outMm && tip > BRUSH_TARGET_MM.from + 1 && back < BRUSH_TARGET_MM.to - 1
  }
  return distalMm(state) >= TARGET_MM - CONTACT_MM
}

/**
 * How far the catheter can go before something stops it: the closed cups and the needle catheter
 * rest on the target surface ahead (the needle itself goes through); the brush runs along the wall.
 */
export function maxOutMm(instrument: InstrumentId): number {
  return instrument === 'brush' ? BRUSH_OUT_MAX_MM : TARGET_MM
}

/** The catheter itself rests on the target surface. */
function catheterAtTarget(state: LabState): boolean {
  return state.outMm >= TARGET_MM - CONTACT_MM
}

function clearOfScope(state: LabState): boolean {
  return state.outMm >= CLEAR_MM
}

/** The needle is through the wall and into the target. */
export function needleInTarget(state: Pick<LabState, 'instrument' | 'outMm' | 'control'>): boolean {
  return state.instrument === 'needle' && state.control >= OPEN && atTarget(state)
}

// ── Steps and faults, per instrument ─────────────────────────────────────────────────────────────

export const LAB_STEPS: Readonly<Record<InstrumentId, readonly LabStep[]>> = {
  forceps: [
    {
      id: 'pass-closed',
      label: 'Advance the forceps, cups closed, until they are clear of the scope tip.',
      result: 'The closed cups are in view, clear of the channel.',
    },
    {
      id: 'open',
      label: 'Push the spool away from the thumb ring to open the cups.',
      result: 'The cups are open.',
    },
    {
      id: 'seat',
      label: 'Advance the open cups onto the target.',
      result: 'The open cups sit on the target.',
    },
    {
      id: 'bite',
      label: 'Pull the spool back to the thumb ring and hold it closed.',
      result: 'The cups have closed on tissue.',
    },
    {
      id: 'withdraw',
      label: 'Keep the cups closed and withdraw them into the channel.',
      result: 'The specimen is back in the channel in closed cups.',
    },
  ],
  brush: [
    {
      id: 'sheath-out',
      label: 'Advance the sheath, brush inside it, until it is clear of the scope tip.',
      result: 'The sheath is in view, clear of the channel.',
    },
    {
      id: 'brush-out',
      label: 'Push the plunger toward the thumb ring to put the brush out of its sheath.',
      result: 'The brush is out.',
    },
    {
      id: 'brush-target',
      label: 'Bring the brush alongside the target and sweep it to and fro across the surface.',
      result: 'The brush has swept the surface of the target.',
    },
    {
      id: 'brush-in',
      label: 'Pull the plunger back to bring the brush into its sheath.',
      result: 'The brush is back in its sheath with its cells.',
    },
    {
      id: 'withdraw',
      label: 'Withdraw the sheath into the channel.',
      result: 'The brush comes out through the channel still sheathed.',
    },
  ],
  needle: [
    {
      id: 'catheter-out',
      label: 'Advance the catheter, needle inside it, until it is clear of the scope tip.',
      result: 'The catheter is in view, its needle still inside.',
    },
    {
      id: 'catheter-on-wall',
      label: 'Bring the catheter tip against the airway wall over the target.',
      result: 'The catheter tip rests on the wall.',
    },
    {
      id: 'needle-out',
      label: 'Push the hub forward to drive the needle through the wall.',
      result: 'The needle is through the wall and in the target.',
    },
    {
      id: 'aspirate',
      label: 'Turn on suction and move the needle in and out within the target.',
      result: 'The needle has sampled the target under suction.',
    },
    {
      id: 'suction-off',
      label: 'Turn the suction off while the needle is still in the target.',
      result: 'Suction is off before the needle leaves the target.',
    },
    {
      id: 'needle-in',
      label: 'Pull the hub back to bring the needle into its catheter.',
      result: 'The needle is back inside its catheter.',
    },
    {
      id: 'withdraw',
      label: 'Withdraw the catheter into the channel.',
      result: 'The catheter comes out with the needle sheathed.',
    },
  ],
}

export const LAB_FAULTS: Readonly<Record<FaultId, string>> = {
  'opened-in-channel':
    'The cups opened before they were clear of the scope tip. Open jaws inside the channel scratch and tear it.',
  'withdrawn-open':
    'The cups came back into the channel open. Keep them closed, or the jaws catch the channel and the specimen falls out.',
  'opened-after-bite':
    'The cups opened again after the bite. The specimen is lost; take another bite.',
  'brush-in-channel':
    'The brush came out of its sheath inside the channel. Advance the sheath clear of the tip first.',
  'withdrawn-unsheathed':
    'The brush came back into the channel unsheathed. Its cells stay on the channel wall instead of reaching the slide.',
  'needle-in-channel':
    'The needle came out while the catheter was still inside the scope. A needle in the channel punctures it.',
  'withdrawn-needle-out':
    'The catheter came back into the channel with its needle out. Retract the needle first, every time.',
  'suction-off-target':
    'Suction went on before the needle was in the target. It draws airway secretions, not the target.',
  'suction-on-withdrawal':
    'The needle left the target with suction still on. The sample is pulled up the catheter and mixed with airway secretions; turn suction off first.',
}

export function labSteps(instrument: InstrumentId): readonly LabStep[] {
  return LAB_STEPS[instrument]
}

/** The next step not yet done, or null when the sequence is complete. */
export function nextStep(state: LabState): LabStep | null {
  return LAB_STEPS[state.instrument].find((step) => !state.memory.done.includes(step.id)) ?? null
}

export function labComplete(state: LabState): boolean {
  return nextStep(state) === null
}

/** Whether the given step's condition holds now, given what has already happened. */
function stepHolds(stepId: string, state: LabState, memory: LabMemory): boolean {
  const { control } = state
  switch (state.instrument) {
    case 'forceps':
      switch (stepId) {
        case 'pass-closed':
          return clearOfScope(state) && control <= CLOSED
        case 'open':
          return clearOfScope(state) && control >= OPEN
        case 'seat':
          return control >= OPEN && catheterAtTarget(state)
        case 'bite':
          return control <= CLOSED && catheterAtTarget(state)
        case 'withdraw':
          return state.outMm <= 0 && control <= CLOSED && memory.specimen
      }
      return false
    case 'brush':
      switch (stepId) {
        case 'sheath-out':
          return clearOfScope(state) && control <= CLOSED
        case 'brush-out':
          return clearOfScope(state) && control >= OPEN
        case 'brush-target':
          return memory.passes >= PASSES
        case 'brush-in':
          return control <= CLOSED && memory.specimen
        case 'withdraw':
          return state.outMm <= 0 && control <= CLOSED && memory.specimen
      }
      return false
    case 'needle':
      switch (stepId) {
        case 'catheter-out':
          return clearOfScope(state) && control <= CLOSED
        case 'catheter-on-wall':
          return catheterAtTarget(state) && control <= CLOSED
        case 'needle-out':
          return needleInTarget(state)
        case 'aspirate':
          return state.suction && memory.passes >= PASSES
        case 'suction-off':
          return !state.suction && needleInTarget(state) && memory.specimen
        case 'needle-in':
          return control <= CLOSED && memory.specimen
        case 'withdraw':
          return state.outMm <= 0 && control <= CLOSED && memory.specimen
      }
      return false
  }
}

/** Faults the move from `before` to `after` commits. */
function faultsOf(before: LabState, after: LabState): FaultId[] {
  const found: FaultId[] = []
  // Opening needs room beyond the tip; coming back, the catheter tip is entering the channel.
  const inChannel = after.outMm < CLEAR_MM
  const entering = after.outMm < 0.5
  const opened = after.control > CLOSED * 2
  switch (after.instrument) {
    case 'forceps':
      if (inChannel && opened && after.control > before.control) found.push('opened-in-channel')
      if (entering && opened && after.outMm < before.outMm) found.push('withdrawn-open')
      if (before.memory.specimen && after.control >= OPEN && !inChannel) {
        found.push('opened-after-bite')
      }
      break
    case 'brush':
      if (inChannel && opened && after.control > before.control) found.push('brush-in-channel')
      if (entering && opened && after.outMm < before.outMm) found.push('withdrawn-unsheathed')
      break
    case 'needle':
      if (inChannel && opened && after.control > before.control) found.push('needle-in-channel')
      if (entering && opened && after.outMm < before.outMm) found.push('withdrawn-needle-out')
      if (after.suction && !before.suction && !needleInTarget(after)) {
        found.push('suction-off-target')
      }
      if (before.suction && after.suction && needleInTarget(before) && !needleInTarget(after)) {
        found.push('suction-on-withdrawal')
      }
      break
  }
  return found
}

/** What the move does to the specimen and the to-and-fro count. */
function nextMemory(before: LabState, after: LabState, memory: LabMemory): LabMemory {
  let { passes, lastDirection, specimen, lost } = memory
  const delta = after.outMm - before.outMm
  const direction: -1 | 0 | 1 = delta > 0.05 ? 1 : delta < -0.05 ? -1 : 0
  const sampling =
    after.instrument === 'brush'
      ? after.control >= OPEN && atTarget(after) && atTarget(before)
      : after.instrument === 'needle'
        ? after.suction && needleInTarget(after) && needleInTarget(before)
        : false
  if (sampling && direction !== 0) {
    if (lastDirection !== 0 && direction !== lastDirection) passes += 1
    lastDirection = direction
  } else if (!sampling) {
    lastDirection = 0
  }
  switch (after.instrument) {
    case 'forceps':
      if (
        !specimen &&
        after.control <= CLOSED &&
        before.control > CLOSED &&
        catheterAtTarget(after)
      ) {
        specimen = true
      } else if (specimen && after.control >= OPEN && after.outMm >= CLEAR_MM) {
        specimen = false
        lost = true
      }
      break
    case 'brush':
      if (passes >= PASSES) specimen = true
      break
    case 'needle':
      if (passes >= PASSES) specimen = true
      break
  }
  return { ...memory, passes, lastDirection, specimen, lost }
}

function withProgress(before: LabState, after: LabState): LabState {
  let memory = nextMemory(before, after, before.memory)
  const faults = faultsOf(before, after).filter((id) => !memory.faults.includes(id))
  if (faults.length > 0) memory = { ...memory, faults: [...memory.faults, ...faults] }
  // Steps are taken in order: a step counts only once the one before it is done.
  const steps = LAB_STEPS[after.instrument]
  const done = [...memory.done]
  for (const step of steps) {
    if (done.includes(step.id)) continue
    if (stepHolds(step.id, after, memory)) done.push(step.id)
    break
  }
  if (done.length !== memory.done.length) memory = { ...memory, done }
  return { ...after, memory }
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'select':
      return action.instrument === state.instrument ? state : initialLabState(action.instrument)
    case 'reset':
      return initialLabState(state.instrument)
    case 'nudge':
      return labReducer(state, { type: 'move', outMm: state.outMm + action.deltaMm })
    case 'move': {
      const outMm = clamp(action.outMm, OUT_MIN_MM, maxOutMm(state.instrument))
      if (outMm === state.outMm) return state
      return withProgress(state, { ...state, outMm })
    }
    case 'control': {
      const value = clamp(action.value, 0, 1)
      if (value === state.control) return state
      return withProgress(state, { ...state, control: value })
    }
    case 'suction':
      if (state.instrument !== 'needle' || action.on === state.suction) return state
      return withProgress(state, { ...state, suction: action.on })
  }
}

export function labFaults(state: LabState): readonly LabFault[] {
  return state.memory.faults.map((id) => ({ id, message: LAB_FAULTS[id] }))
}
