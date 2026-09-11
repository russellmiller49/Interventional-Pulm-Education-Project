import type { ReactNode } from 'react'

import type { ScopeState as EngineScopeState } from '@/lib/airway-anatomy/scope-state'
import type { ScopePoseSnapshot, Vec3 } from '@/lib/airway-anatomy/types'

/**
 * THE CONTRACT between the lesson stage (Claude) and the bronchoscopy simulator pane (Codex/Astra).
 *
 * The stage host renders `ScopePane` into the Simulator panel and drives it with a per-step view
 * spec, the scope's state and the goals the step is waiting on. The pane renders the optical view,
 * the control dock, the readouts, the inspection ledger and the airway map, and reports every
 * learner action back through `onCommand`. The host — never the pane — reduces commands into the
 * next state (`engine/scope/scopeReducer.ts`), so the pane, the Now card's goals and the record read
 * one state. Flow tests never touch WebGL: they mount `ScopeTestDouble`, a DOM-only stand-in that
 * honours the same props and data attributes.
 *
 * One deliberate difference from the imaging suite's contract: the pane sends COMMANDS, not value
 * patches. A scope position is path-dependent — setting "insertion = 200 mm" would teleport the
 * tip, which the course must disclose as an assist rather than allow silently.
 *
 * Four layers stay apart (knowledge spec §23.3): the anatomical graph (labels, parentage), the 3D
 * geometry (lumen and collider), the camera transform (`state.pose.opticalFrame`) and the input
 * mapping (`ScopeInputs` → frame). Rotating the scope never changes a label, because labels come
 * from the graph position only (acceptance tests A06/A28).
 *
 * Do not change these shapes without telling the other side. Additive fields are fine.
 */

/** Which scene the pane shows. `idle` is the scope at rest (the hub and the reading sections). */
export type ScopeMode =
  | 'idle'
  /** Drill D02: the tip on a bench outside the model; one control at a time. */
  | 'controls-isolated'
  /** Centerline-locked travel with the aim guard; assisted by definition, and disclosed. */
  | 'guided-walk'
  /** The tip moves freely inside the lumen against the collider; unaided. */
  | 'free-drive'
  /** Oropharynx, larynx and subglottis; the folds open and close with a scripted breath cycle. */
  | 'larynx-entry'
  /** The scope inside an endotracheal or tracheostomy tube, with the geometric annulus. */
  | 'tube'
  /** A visible target and an accessory whose protected and exposed states can be seen. */
  | 'accessory'

export const SCOPE_MODES: readonly ScopeMode[] = [
  'idle',
  'controls-isolated',
  'guided-walk',
  'free-drive',
  'larynx-entry',
  'tube',
  'accessory',
]

/** The one anatomy profile this round teaches. Variant profiles are deferred (owner decision D4). */
export type AnatomyProfileId = 'adult-teaching-combined-left-basal-v1'

/**
 * The airway labels of the teaching profile, in survey order. These are bronchus names — never
 * lymph-node station ids (A05). `LUL-UD` is the left upper division; `LB4+5` the lingular
 * division; `LB7+8` the declared combined anteromedial basal convention.
 */
export const AIRWAY_LABELS = [
  'TR',
  'RMSB',
  'RUL',
  'RB1',
  'RB2',
  'RB3',
  'BI',
  'RML',
  'RB4',
  'RB5',
  'RLL',
  'RB6',
  'RB7',
  'RB8',
  'RB9',
  'RB10',
  'LMSB',
  'LUL',
  'LUL-UD',
  'LB1+2',
  'LB3',
  'LB4+5',
  'LB4',
  'LB5',
  'LLL',
  'LB6',
  'LB7+8',
  'LB9',
  'LB10',
] as const

export type AirwayLabel = (typeof AIRWAY_LABELS)[number]

/** The eighteen segmental endpoints of the declared profile (knowledge spec §23.3). */
export const SEGMENTAL_AIRWAY_LABELS = [
  'RB1',
  'RB2',
  'RB3',
  'RB4',
  'RB5',
  'RB6',
  'RB7',
  'RB8',
  'RB9',
  'RB10',
  'LB1+2',
  'LB3',
  'LB4',
  'LB5',
  'LB6',
  'LB7+8',
  'LB9',
  'LB10',
] as const satisfies readonly AirwayLabel[]

export function isAirwayLabel(value: unknown): value is AirwayLabel {
  return typeof value === 'string' && (AIRWAY_LABELS as readonly string[]).includes(value)
}

/** The five distinguishable controls (knowledge spec §4.2, §23.3). */
export const SCOPE_CONTROL_IDS = [
  'insertion',
  'rotation',
  'deflection',
  'suction',
  'accessory',
] as const
export type ScopeControlId = (typeof SCOPE_CONTROL_IDS)[number]

export type AccessoryKind = 'forceps' | 'brush' | 'needle'
export type AccessoryState =
  | 'none'
  | 'forceps-closed'
  | 'forceps-open'
  | 'brush-sheathed'
  | 'brush-exposed'
  | 'needle-sheathed'
  | 'needle-exposed'
/** Where the accessory is: loaded in the channel, at the tip, or extended beyond it. */
export type AccessoryPosition = 'none' | 'in-channel' | 'at-tip' | 'extended'
/**
 * The true folds in the scripted breath cycle: widest on inspiration, narrower on expiration, and
 * closed only with a scripted cough or phonation (knowledge spec §6.1, §10.3).
 */
export type CordsState = 'abducted' | 'narrowing' | 'adducted'

export interface TubeSpec {
  readonly kind: 'ett' | 'tracheostomy'
  /** Authored teaching value, not a manufacturer specification. */
  readonly idMm: number
}

/** The inputs the five controls set, plus drill-only settings. Millimetres and degrees. */
export interface ScopeInputs {
  /** Control-body rotation; positive = clockwise as the operator sees the control body. */
  readonly rotationDeg: number
  /** Thumb-lever deflection in the single bending plane; positive bends the tip toward image-up. */
  readonly deflectionDeg: number
  readonly suction: boolean
  readonly accessory: AccessoryState
  readonly accessoryPosition: AccessoryPosition
  readonly cords: CordsState
  readonly tube: TubeSpec | null
  /** Authored teaching value for the device; never a product dimension. */
  readonly scopeOdMm: number
  /** How far one advance or withdraw press moves. */
  readonly stepMm: number
  /** In-view airway labels: an assist when shown, recorded as such. */
  readonly branchLabels: boolean
}

export type ScopeControlKey =
  | 'advance'
  | 'withdraw'
  | 'rotate'
  | 'deflect'
  | 'suction'
  | 'accessory'
  | 'capture'
  | 'acknowledge'
  | 'declare'
  | 'recenter'
  | 'reset'
  | 'teleportStart'
  | 'branchLabels'
  | 'clearLens'
  | 'verifyAccessory'
  | 'step'

export const SCOPE_CONTROL_KEYS: readonly ScopeControlKey[] = [
  'advance',
  'withdraw',
  'rotate',
  'deflect',
  'suction',
  'accessory',
  'capture',
  'acknowledge',
  'declare',
  'recenter',
  'reset',
  'teleportStart',
  'branchLabels',
  'clearLens',
  'verifyAccessory',
  'step',
]

/**
 * Every helper the scene can offer. Each is disclosed in the record and excluded from any claim of
 * unaided performance (§23.3, A18).
 */
export type ScopeAssist =
  /** Guided walk: the tip follows the aimed child's centerline. */
  | 'centerline-lock'
  /** Refuse an undecided bifurcation instead of choosing one. */
  | 'aim-guard'
  /** In-view airway labels. */
  | 'branch-labels'
  /** Pressing a label points the tip at it. */
  | 'align-to-branch'
  /** Jump back to the authored start. */
  | 'teleport-to-start'
  /** Zero deflection and rotation. */
  | 'recenter'
  /** The authored camera roll that sets the reviewed reference views at the RUL, RML and LUL. */
  | 'reference-orientation'

export const SCOPE_ASSISTS: readonly ScopeAssist[] = [
  'centerline-lock',
  'aim-guard',
  'branch-labels',
  'align-to-branch',
  'teleport-to-start',
  'recenter',
  'reference-orientation',
]

/** Assists that disqualify a performance from being called unaided. */
export const UNAIDED_DISQUALIFYING_ASSISTS: readonly ScopeAssist[] = [
  'centerline-lock',
  'aim-guard',
  'align-to-branch',
  'teleport-to-start',
  'branch-labels',
]

export type ScopeInputMode = 'keyboard' | 'pointer' | 'touch' | 'gamepad' | 'scripted'

/** Where a step starts. `at` places the tip along the airway's first labelled segment. */
export type ScopeStart =
  | {
      readonly kind: 'airway'
      readonly label: AirwayLabel
      readonly at: 'proximal' | 'mid' | 'distal'
    }
  | { readonly kind: 'bench' }
  | { readonly kind: 'larynx' }
  | { readonly kind: 'tube' }

/** Scripted states, labelled as scripted wherever they show (§23.4). */
export type ScopeScriptId =
  /** The lens against mucosa: a close pink-red field. */
  | 'red-out'
  /** Secretion on the lens in a correct position. */
  | 'lens-contamination'
  /** A clear image deep in the tree with the labels off: identity unknown. */
  | 'unfamiliar-clear'
  /** Drill D10: an assistant speaks and a photograph is due while the view must not drift. */
  | 'assistant-interrupt'
  /** Drill D21: the assistant reports a protected state that the image contradicts. */
  | 'assistant-misreport'
  /**
   * Larynx: the folds open widest on inspiration and narrow on expiration, with a scripted cough
   * that closes them now and then. Crossing is refused unless they are open.
   */
  | 'breathing-cords'

export type InspectionStatus =
  | 'not-observed'
  | 'identified'
  | 'ostium-visualized'
  | 'entered'
  | 'inspected'
  | 'not-safely-accessible'

export type DeclarableStatus = 'identified' | 'inspected' | 'not-safely-accessible' | 'not-observed'

export const DECLARABLE_STATUSES: readonly DeclarableStatus[] = [
  'identified',
  'inspected',
  'not-safely-accessible',
  'not-observed',
]

/**
 * One expected airway's record. `ostiumVisualized`, `entered` and `distalViewObtained` are
 * heuristics from the tip's position and view; `identified` and `inspected` are the learner's
 * declarations. Entering an airway never sets `inspected` (A07/A30).
 */
export interface AirwayInspectionRecord {
  readonly label: AirwayLabel
  readonly identified: boolean
  readonly ostiumVisualized: boolean
  readonly entered: boolean
  readonly distalViewObtained: boolean
  readonly inspected: 'no' | 'declared' | 'declared-without-view'
  readonly limitation: null | 'not-safely-accessible' | 'not-observed' | 'entry-route'
}

export type InspectionLedger = Readonly<Partial<Record<AirwayLabel, AirwayInspectionRecord>>>

/** The event vocabulary goals are written in. History-dependent things the learner did, in order. */
export type ScopeEventId =
  | `ostium-visualized:${AirwayLabel}`
  | `entered:${AirwayLabel}`
  | `withdrew-to:${AirwayLabel}`
  | `declared:${AirwayLabel}:${DeclarableStatus}`
  | `control-used:${ScopeControlId}`
  | `accessory:${AccessoryState}`
  | `accessory-moved:${AccessoryPosition}`
  | `assist:${ScopeAssist}`
  | 'reached-carina'
  | 'returned-to-trachea'
  | 'wall-contact'
  | 'red-out'
  | 'red-out-recovered'
  | 'advanced-in-red-out'
  | 'suction-in-red-out'
  | 'lens-contaminated'
  | 'lens-cleared'
  | 'advanced-blind'
  | 'aim-refused'
  | 'lumen-end'
  | 'entry-refused'
  | 'hold-started'
  | 'drift-detected'
  | 'hold-completed'
  | 'captured'
  | 'acknowledged'
  | 'accessory-state-verified'
  | 'accessory-unsafe'
  | 'glottis-crossed-open'
  | 'advanced-against-closure'
  | 'tube-exited'
  | 'survey-complete'

export type ScopeMetricId =
  | 'currentAirway'
  | 'parentage'
  | 'depthMm'
  | 'rotationDeg'
  | 'deflectionDeg'
  | 'suction'
  | 'contactCount'
  | 'lossOfViewCount'
  | 'annularAreaFraction'
  | 'annularAreaMm2'
  | 'cordsState'
  | 'accessoryState'
  | 'ledgerSummary'
  | 'inputMode'
  | 'assistsUsed'

export const SCOPE_METRIC_IDS: readonly ScopeMetricId[] = [
  'currentAirway',
  'parentage',
  'depthMm',
  'rotationDeg',
  'deflectionDeg',
  'suction',
  'contactCount',
  'lossOfViewCount',
  'annularAreaFraction',
  'annularAreaMm2',
  'cordsState',
  'accessoryState',
  'ledgerSummary',
  'inputMode',
  'assistsUsed',
]

/** What a step waits on, as predicates over the state and the events since the step began. */
export type ScopeGoalTest =
  | { readonly type: 'event'; readonly event: ScopeEventId }
  /** The events happened in this order (others may come between them). */
  | { readonly type: 'event-sequence'; readonly events: readonly ScopeEventId[] }
  | { readonly type: 'location'; readonly airway: AirwayLabel }
  | { readonly type: 'ledger'; readonly airway: AirwayLabel; readonly status: InspectionStatus }
  /** Every listed airway carries a status other than not-observed. */
  | { readonly type: 'ledger-complete'; readonly airways: readonly AirwayLabel[] }
  | {
      readonly type: 'metric'
      readonly metric: 'rotationDeg' | 'deflectionDeg' | 'depthMm' | 'annularAreaFraction'
      readonly op: '>=' | '<=' | 'abs>='
      readonly value: number
    }
  /** Met while the event has not happened since the step began. Never enough on its own. */
  | { readonly type: 'without'; readonly event: ScopeEventId }
  | { readonly type: 'all'; readonly tests: readonly ScopeGoalTest[] }

export interface ScopeGoal {
  readonly id: string
  /** Learner-facing, imperative, names the landmark: "Enter the right main bronchus". */
  readonly label: string
  readonly test: ScopeGoalTest
}

/** What the pane shows for one section, or one step of it. */
export interface ScopeViewSpec {
  readonly sectionId: string
  readonly mode: ScopeMode
  readonly profile: AnatomyProfileId
  readonly start: ScopeStart
  /** The controls the dock exposes on this step. */
  readonly controls: readonly ScopeControlKey[]
  readonly assists: Readonly<Partial<Record<ScopeAssist, boolean>>>
  readonly defaults?: Partial<ScopeInputs>
  readonly readouts?: readonly ScopeMetricId[]
  /** Which airways the ledger lists on this step. */
  readonly ledger?: { readonly expected: readonly AirwayLabel[] | 'segmental' | 'profile' }
  readonly script?: ScopeScriptId
  /**
   * Where a scripted lens or view event begins: the first entry into this airway. Omitted, the
   * script is active from the start of the step.
   */
  readonly scriptAirway?: AirwayLabel
  /** Airways a scripted narrowing makes impossible to enter safely (drill D14, M10-O4). */
  readonly inaccessible?: readonly AirwayLabel[]
  /** Airways lit on the map; [] while a map-answered prediction is open. */
  readonly litAirways?: readonly AirwayLabel[]
  /** The model-boundary sentence printed under the scene. */
  readonly boundary: string
}

export type ScopeCommand =
  | { readonly type: 'advance'; readonly mm: number }
  | { readonly type: 'rotate'; readonly deg: number }
  | { readonly type: 'set-rotation'; readonly deg: number }
  | { readonly type: 'deflect'; readonly deg: number }
  | { readonly type: 'set-deflection'; readonly deg: number }
  | { readonly type: 'suction'; readonly on: boolean }
  | { readonly type: 'accessory'; readonly state: AccessoryState }
  | { readonly type: 'accessory-move'; readonly to: AccessoryPosition }
  | { readonly type: 'verify-accessory' }
  | { readonly type: 'clear-lens' }
  | { readonly type: 'capture' }
  | { readonly type: 'acknowledge' }
  /** Simulated time passing (breath cycle, hold clocks). The pane or a test drives it. */
  | { readonly type: 'tick'; readonly seconds: number }
  | { readonly type: 'assist'; readonly assist: 'align-to-branch'; readonly label: AirwayLabel }
  | { readonly type: 'assist'; readonly assist: 'recenter' | 'teleport-to-start' }
  | { readonly type: 'branch-labels'; readonly on: boolean }
  | {
      readonly type: 'declare'
      readonly airway: AirwayLabel
      readonly status: DeclarableStatus
    }

/** An upcoming ostium the tip can see or steer into. */
export interface OstiumPin {
  readonly label: AirwayLabel
  readonly fullLabel: string
  /** The child edge the learner steers into to enter it. */
  readonly edgeId: number
  readonly pointLps: Vec3
  /** Inside the optical field from the current frame (nominal 4:3, 88°). */
  readonly inView: boolean
}

export interface ScopeSignals {
  /** Feedback signals, not measurements of trauma, force or competence (§23.3). */
  readonly contactCount: number
  readonly pathLengthMm: number
  readonly view: 'clear' | 'red-out' | 'contaminated' | 'dark'
  readonly lossOfViewCount: number
  /** Drill D10: forward drift since the hold started. */
  readonly hold: { readonly startedAtSec: number | null; readonly driftMm: number }
  /** Simulated seconds since the step began; advances only on `tick`. */
  readonly clockSec: number
}

export interface ScopeState {
  readonly inputs: ScopeInputs
  /** The graph position (plain data, no renderer objects); null on the bench or in the larynx. */
  readonly engine: EngineScopeState | null
  /** The pose the scene renders through `scopeOpticalFrame(pose)`; null on the bench. */
  readonly pose: ScopePoseSnapshot | null
  /** Where the tip is: the bench, the larynx, a tube, or an airway of the profile. */
  readonly place: 'bench' | 'larynx' | 'tube' | 'airway'
  /** Insertion depth: along the airway path from its entry point, or net advance on the bench. */
  readonly depthMm: number
  readonly location: {
    readonly label: AirwayLabel | null
    readonly fullLabel: string
    /** Labels from the trachea to the current airway. */
    readonly parentage: readonly AirwayLabel[]
  }
  readonly ostia: readonly OstiumPin[]
  readonly events: readonly ScopeEventId[]
  readonly ledger: InspectionLedger
  readonly signals: ScopeSignals
  readonly inputModes: readonly ScopeInputMode[]
  readonly assistsUsed: readonly ScopeAssist[]
  readonly script: { readonly id: ScopeScriptId; readonly phase: string } | null
  /** The engine's refusal or guidance, printed on the scene. */
  readonly message: string | null
}

/** A prediction answered by choosing an airway on the map or an ostium in the view. */
export interface TreeAnswerChoice {
  readonly id: string
  readonly label: string
  readonly airway: AirwayLabel | null
}

export interface TreeAnswer {
  readonly name: string
  readonly legend: string
  readonly choices: readonly TreeAnswerChoice[]
  readonly selectedChoiceId: string | null
  readonly committedChoiceId?: string | null
  readonly correctChoiceIds?: readonly string[]
  readonly onSelect: (choiceId: string) => void
  readonly disabled: boolean
  readonly hint?: string
}

/** The map drawn once per case: coronal projection of the labelled centerlines. */
export interface AirwayMapGeometry {
  readonly viewBox: readonly [number, number, number, number]
  readonly paths: readonly {
    readonly label: AirwayLabel | null
    readonly d: string
    readonly widthMm: number
  }[]
  /** Where each airway's pin sits on the map. */
  readonly pins: Readonly<Partial<Record<AirwayLabel, readonly [number, number]>>>
  /** Projects a patient point (LPS mm) onto the map. */
  readonly project: (point: Vec3) => readonly [number, number]
}

export interface ScopePaneProps {
  readonly view: ScopeViewSpec
  readonly state: ScopeState
  /** The loaded case's map; null while loading or on the bench. */
  readonly map: AirwayMapGeometry | null
  readonly onCommand: (command: ScopeCommand, inputMode: ScopeInputMode) => void
  readonly onReset: () => void
  readonly controlsEnabled: boolean
  /** Printed on the scene when the controls are locked (deciding) or paused (looking back). */
  readonly lockedReason?: string
  readonly pausedReason?: string
  readonly goals: readonly { readonly goal: ScopeGoal; readonly met: boolean }[]
  /** `locationCaption(state)`, printed verbatim. */
  readonly caption: string
  readonly treeAnswer?: TreeAnswer
  /** A control key to spotlight ("Show me where"). */
  readonly spotlightKey?: ScopeControlKey
  readonly children?: ReactNode
}

/** Element ids both sides use, so tests and pins can find a control. */
export function scopeControlId(key: ScopeControlKey | string): string {
  return `bronchoscopy-foundations-scope-${key}`
}

export function treeChoiceInputId(name: string, choiceId: string): string {
  return `bronchoscopy-foundations-tree-${name}-${choiceId}`
}

/**
 * The DOM contract the flow tests and the e2e suite read.
 *
 * - `[data-scope-scene][data-scope-mode][data-scope-state=ready|failed|fallback][data-anatomy-profile]`
 * - the optical canvas host carries `data-three-state="ready"` once it has drawn (3D scene only)
 * - `[data-view-signal=clear|red-out|contaminated|dark]` on the optical view
 * - `[data-airway-map] [data-airway-pin=<label>]`, the current airway with `aria-current="location"`
 * - `[data-tree-answer]` fieldset, rows `[data-off-tree]`, `[data-tree-outcome]` after commit
 * - `[data-readouts] [data-readout=<metricId>]`
 * - `[data-inspection-ledger] [data-ledger-row=<label>][data-ledger-status=<status>]`
 * - `[data-input-mode]` (last mode used) and `[data-assists-used]` (comma-separated)
 * - every control `id={scopeControlId(key)}`
 * - `[data-model-boundary]`
 */
export const SCOPE_DOM = {
  scene: 'data-scope-scene',
  mode: 'data-scope-mode',
  state: 'data-scope-state',
  profile: 'data-anatomy-profile',
  three: 'data-three-state',
  viewSignal: 'data-view-signal',
  map: 'data-airway-map',
  pin: 'data-airway-pin',
  treeAnswer: 'data-tree-answer',
  offTree: 'data-off-tree',
  treeOutcome: 'data-tree-outcome',
  readouts: 'data-readouts',
  readout: 'data-readout',
  ledger: 'data-inspection-ledger',
  ledgerRow: 'data-ledger-row',
  ledgerStatus: 'data-ledger-status',
  inputMode: 'data-input-mode',
  assists: 'data-assists-used',
  boundary: 'data-model-boundary',
} as const
