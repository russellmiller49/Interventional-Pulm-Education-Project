import type { ControlId } from '../../content/controlPanel'
import { PLEURAL_ZONE_IDS, type PleuralZoneId } from '../../content/pleuralZones'

/**
 * The space pane's contract: the one seam between a lesson and whatever draws the pleural space.
 *
 * The lesson host holds the space engine's state and hands the pane a `SpacePaneState`; the pane
 * sends `SpaceCommand`s back. Three things stand behind this contract: the 3D scene (slice 11), the
 * cross-section drawn in SVG for a browser without WebGL (`SpaceFallbackPane`), and the test double
 * the lesson tests use. None of them works anything out. What is in view, what has been seen and
 * what stops the telescope all come from the engine, so the same commands give the same ledger
 * whichever pane draws them.
 *
 * The state is plain JSON: no renderer object, no clock and no callback. Written first and changed
 * only by adding to it (plan, section 5).
 */

// ── Identity ─────────────────────────────────────────────────────────────────────────────────

/**
 * What a state was computed for (fidelity contract, "Snapshot identity"). A result for another
 * snapshot changes nothing, so the host compares snapshots before it passes a result on.
 */
export interface SpaceSnapshotId {
  readonly anatomy: string
  readonly device: string
  readonly optics: string
  readonly port: string
  readonly scenario: string
  readonly lungAndFluid: string
  readonly geometry: string
  /**
   * The engine's own authored rules that decide a spatial answer: step sizes, the clearance and
   * touch skins, the port's excluded patch, the lung's room and the view's occlusion tolerance
   * (added after the independent review, R4).
   */
  readonly rules: string
}

export const SNAPSHOT_PARTS = [
  'anatomy',
  'device',
  'optics',
  'port',
  'scenario',
  'lungAndFluid',
  'geometry',
  'rules',
] as const satisfies readonly (keyof SpaceSnapshotId)[]

export function sameSnapshot(a: SpaceSnapshotId, b: SpaceSnapshotId): boolean {
  return SNAPSHOT_PARTS.every((part) => a[part] === b[part])
}

// ── The telescope ────────────────────────────────────────────────────────────────────────────

/**
 * Where the telescope is, in the port's frame: tilted about the port across the ribs and along
 * them, inserted to a depth, and turned about its own length. Numbers for the engine and the scene;
 * no pane shows them to the learner.
 */
export interface ScopePose {
  readonly tiltAcrossRibsDeg: number
  readonly tiltAlongRibsDeg: number
  readonly depthMm: number
  readonly rollDeg: number
}

// ── The ledger ───────────────────────────────────────────────────────────────────────────────

/**
 * How much of a region the telescope has shown, as the model estimates it. `seen-to-reach`: part of
 * it has been seen and none of the rest can be, from any position the model tried: observed to the
 * model's available extent, which is as far as a survey can go (owner decision OD-16; added after
 * the independent review, R5).
 */
export const SEEN_STATES = ['seen', 'seen-to-reach', 'partly-seen', 'not-seen'] as const
export type SeenState = (typeof SEEN_STATES)[number]

/** Why the rest of a region has not been seen. */
export const UNSEEN_REASONS = ['not-looked-at', 'hidden', 'out-of-reach'] as const
export type UnseenReason = (typeof UNSEEN_REASONS)[number]

export interface ZoneLedgerEntry {
  readonly zone: PleuralZoneId
  readonly seen: SeenState
  /** Null exactly when the whole region has been seen. */
  readonly reason: UnseenReason | null
}

/** Every survey zone once, in the survey order. No number and no total (learning contract). */
export type ZoneLedger = readonly ZoneLedgerEntry[]

/** A ledger with nothing seen yet: every region not looked at. */
export function emptyLedger(): ZoneLedger {
  return PLEURAL_ZONE_IDS.map((zone) => ({ zone, seen: 'not-seen', reason: 'not-looked-at' }))
}

/** Why a ledger breaks the contract, or an empty list. */
export function ledgerProblems(ledger: ZoneLedger): readonly string[] {
  const problems: string[] = []
  if (ledger.map((entry) => entry.zone).join() !== PLEURAL_ZONE_IDS.join()) {
    problems.push('The ledger must hold every zone once, in the survey order.')
  }
  for (const entry of ledger) {
    if (!SEEN_STATES.includes(entry.seen))
      problems.push(`${entry.zone}: unknown state ${entry.seen}`)
    if (entry.seen === 'seen' && entry.reason !== null) {
      problems.push(`${entry.zone}: a region seen whole has no reason`)
    }
    if (
      entry.seen !== 'seen' &&
      (entry.reason === null || !UNSEEN_REASONS.includes(entry.reason))
    ) {
      problems.push(`${entry.zone}: a region not seen whole needs one of the three reasons`)
    }
    if (entry.seen === 'seen-to-reach' && entry.reason === 'not-looked-at') {
      problems.push(
        `${entry.zone}: a region seen as far as the model reaches has nothing left to look at`,
      )
    }
  }
  return problems
}

// ── What the pane draws ──────────────────────────────────────────────────────────────────────

/** A point in the plane of a cross-section, in millimetres; +y is up the screen. */
export type PlanePoint = readonly [number, number]

/**
 * A cut through the space along the telescope, for the pane that cannot draw in 3D. The engine
 * computes it from the same geometry and the same lung step as everything else.
 */
export interface CrossSection {
  /** The wall of the space where the cut meets it, each run of it belonging to one zone. */
  readonly wall: readonly { readonly zone: PleuralZoneId; readonly points: readonly PlanePoint[] }[]
  /** The lung where the cut meets it, as closed outlines. */
  readonly lung: readonly (readonly PlanePoint[])[]
  readonly port: PlanePoint
  readonly tip: PlanePoint
  /** The two edges of the field of view, from the tip to the end of its range. */
  readonly field: readonly [PlanePoint, PlanePoint]
  /** Which way the cut is seen, in words: for example "from the patient’s front". */
  readonly seenFrom: string
  /** A teaching target where the cut meets it, as closed outlines (added in slice 13). */
  readonly target?: readonly (readonly PlanePoint[])[]
  /**
   * The forceps out beyond the tip, projected onto the cut: from the channel's exit to the base of
   * the jaws, and on to their tip. Absent while they are in the channel (added in slice 13).
   */
  readonly tool?: {
    readonly exit: PlanePoint
    readonly jawBase: PlanePoint
    readonly tip: PlanePoint
  }
}

/** Whether the spatial controls can act, and if not, why, in the learner's words. */
export type SpaceReadiness =
  | { readonly kind: 'ready' }
  | { readonly kind: 'loading'; readonly what: string }
  | { readonly kind: 'unavailable'; readonly why: string; readonly canRetry: boolean }

/**
 * The forceps in the working channel, for a scenario that has them (added in slice 13): in the
 * channel, or out beyond the tip; and whether the jaws are touching the teaching target, which the
 * contact table allows only them, and only when the target is authorised.
 */
export interface SpaceToolState {
  readonly phase: 'in-channel' | 'extended'
  /** How far the jaws are out beyond the telescope's tip, for a scene to draw; no pane prints it. */
  readonly extensionMm: number
  readonly touching: boolean
  readonly authorised: boolean
}

/** A movement the model refused, with the part that stopped it named (fidelity contract). */
export interface SpaceRefusal {
  readonly part: string
  readonly words: string
}

export interface SpacePaneState {
  readonly snapshot: SpaceSnapshotId
  readonly readiness: SpaceReadiness
  readonly pose: ScopePose
  /** The zones some of which is in the field of view now. */
  readonly inView: readonly PleuralZoneId[]
  readonly ledger: ZoneLedger
  readonly refusal: SpaceRefusal | null
  /** Null until the geometry is ready. */
  readonly crossSection: CrossSection | null
  /** Under reduced motion the clock waits: `held` says something is waiting for the Step control. */
  readonly clock: { readonly held: boolean }
  /** The lung's step, the one the snapshot names, for a scene to draw (added in slice 11). */
  readonly lungStep: number
  /** The forceps, when the scenario has them (added in slice 13). */
  readonly tool?: SpaceToolState
}

// ── What the pane sends back ─────────────────────────────────────────────────────────────────

/** The way the learner's hand moves the eyepiece; the tip swings the other way. */
export const PIVOT_HAND_DIRECTIONS = ['head', 'feet', 'front', 'back'] as const
export type PivotHandDirection = (typeof PIVOT_HAND_DIRECTIONS)[number]

/**
 * One step of one control. A held control is a run of these; the engine decides how far a step
 * goes and may refuse it. Course navigation and loading a teaching example are not commands.
 */
export type SpaceCommand =
  | { readonly kind: 'pivot'; readonly hand: PivotHandDirection }
  | { readonly kind: 'depth'; readonly direction: 'in' | 'out' }
  | { readonly kind: 'roll'; readonly direction: 'clockwise' | 'anticlockwise' }
  | { readonly kind: 'step-clock' }
  | { readonly kind: 'retry-geometry' }
  /** The forceps along the working channel, the telescope held still (added in slice 13). */
  | { readonly kind: 'tool'; readonly direction: 'extend' | 'retract' }

export type SpaceInputMode = 'keyboard' | 'pointer' | 'touch' | 'scripted'

/** The part of the second control a command belongs to, or none for the clock and retry. */
export function commandPart(command: SpaceCommand): 'pivot' | 'depth' | 'roll' | null {
  return command.kind === 'pivot' || command.kind === 'depth' || command.kind === 'roll'
    ? command.kind
    : null
}

/** The control of the model a command belongs to, or none for the clock and retry (slice 13). */
export function commandControl(command: SpaceCommand): 'scope' | 'tool' | null {
  if (command.kind === 'tool') return 'tool'
  return commandPart(command) === null ? null : 'scope'
}

export interface SpacePaneProps {
  readonly state: SpacePaneState
  /** The controls the section shows, and those among them the learner can use. */
  readonly shown: readonly ControlId[]
  readonly operable: readonly ControlId[]
  readonly reducedMotion: boolean
  readonly onCommand: (command: SpaceCommand, input: SpaceInputMode) => void
}

/** A stable id for a control of the pane, for labels and tests. */
export function spaceControlId(key: string): string {
  return `mt-space-${key}`
}
