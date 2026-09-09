import type { ReactNode } from 'react'

import type { ChainStopId } from '../../content/imagingChain'
import type { LabGoal } from '../../engine/labGoalEvaluation'
import type { LabMetricId, LabState, LabValues } from '../../engine/labMetrics'
import type { LabId } from '../../types'

/**
 * THE CONTRACT between the lesson stage (Claude) and the imaging suite (Codex/Astra).
 *
 * The stage host renders `ImagingSuitePane` into the simulator pane and drives it with a per-step
 * view spec, the lab's state, and the goals the step is waiting on. The suite renders the scene,
 * the monitor, the control dock, the readouts and the chain map, and reports every change back
 * through `onLabChange`. The flow tests never touch WebGL: they mount `SuiteTestDouble`, a DOM-only
 * stand-in that honours the same props and the same data attributes.
 *
 * Do not change these shapes without telling the other side. Additive fields are fine.
 */

/** Which mechanism the suite shows. `room` is the hub hero: the suite at rest. */
export type SuiteMode =
  | 'projection'
  | 'signal'
  | 'field'
  | 'time'
  | 'dts'
  | 'dts-prior'
  | 'cbct'
  | 'sampling'
  | 'rebus'
  | 'navigation'
  | 'augmented'
  | 'staff'
  | 'dose'
  | 'room'

export type ChainStop = ChainStopId

export type SuiteLayer =
  | 'Airways'
  | 'Lungs'
  | 'Ribs and spine'
  | 'Thoracic envelope'
  | 'table'
  | 'gantry'
  | 'cone'
  | 'ray'
  | 'monitor'
  | 'staff'
  | 'barrier'
  | 'isodose'
  | 'fov'
  | 'planes'
  | 'probe'
  | 'fieldGenerator'
  | 'labels'

export type SuiteCamera =
  | 'suite'
  | 'beam'
  | 'anterior'
  | 'side'
  | 'head'
  | 'target'
  | 'room'
  | 'console'

export type SuiteVariant = 'fixed' | 'mobile' | 'generic'

export type SuiteAnimationKind = 'pulse' | 'sweep' | 'orbit' | 'transducer' | 'exchange'

/**
 * Every number the scene can be driven by, in millimetres, degrees and seconds.
 *
 * Every field is optional at the call site: `resolveSuiteInputs` (Codex) applies the view's
 * bindings from the lab's control values, then the view's defaults, then the lab's own clamps,
 * so the scene and the readouts never disagree about a value. Field names for the tool tip and
 * the acquisition offsets match the lab control keys one for one.
 */
export interface SuiteInputs {
  readonly orbit: number
  readonly tilt: number
  readonly toolDepth: number
  /** Source–isocenter, source–detector, detector field; defaults 720 / 1200 / 640 (the DRR's config). */
  readonly geometry: { readonly sod: number; readonly sid: number; readonly field: number }
  readonly fieldPercent: number
  readonly crop: boolean
  readonly zoom: number
  readonly focalSpotMm: number
  readonly pulseRate: number
  readonly pulseWidthMs: number
  readonly speedMmS: number
  /** Clock seconds for the time view. */
  readonly phase: number
  readonly sweepDeg: number
  readonly planeDepth: number
  readonly priorLayer: 'measured' | 'prior' | 'blend'
  readonly orbitSpanDeg: number
  /** 0..1 along the CBCT orbit. */
  readonly orbitProgress: number
  readonly projectionCount: number
  readonly acquisitionOrbit: number
  readonly offsetX: number
  readonly offsetDepth: number
  /** Acquisition semantics move CT, target and tool together; registration semantics leave the tool. */
  readonly toolFollowsAnatomy: boolean
  readonly displacement: number
  readonly storedDisplacement: number
  readonly showStored: boolean
  readonly showCurrent: boolean
  readonly tipX: number
  readonly tipY: number
  readonly tipZ: number
  readonly axial: number
  readonly coronal: number
  readonly sagittal: number
  readonly slab: boolean
  readonly probeAlong: number
  readonly probeLateralMm: number
  readonly transducerTurns: number
  readonly probeState: 'probe' | 'tool'
  readonly staffDistanceM: number
  readonly barrier: boolean
  readonly kermaMgy: number
  readonly areaCm2: number
  readonly variant: SuiteVariant
}

export interface SuiteBinding {
  readonly input: keyof SuiteInputs
  /** A lab control key from `LAB_CONTROLS[lab]`. */
  readonly control: string
  readonly scale?: number
}

/** What the suite shows for one section, or one step of it. */
export interface SuiteViewSpec {
  readonly sectionId: string
  readonly mode: SuiteMode
  /** The chain stop lit on this step; null while a chain-answered prediction is open. */
  readonly litStop: ChainStop | null
  /** "You are at: the detector — …" in the words the caption prints. */
  readonly stopSentence: string
  readonly camera: SuiteCamera
  readonly layers: readonly SuiteLayer[]
  readonly variant: SuiteVariant
  readonly monitor: 'beside' | 'below' | 'hidden'
  readonly animation?: {
    readonly kind: SuiteAnimationKind
    readonly autoplay: boolean
    readonly loop: boolean
  }
  readonly bindings: readonly SuiteBinding[]
  readonly defaults: Partial<SuiteInputs>
  /** Which lab's control dock is open, and which of its controls this step exposes. */
  readonly lab?: LabId
  readonly controls?: readonly string[]
  readonly readouts?: readonly LabMetricId[]
  /** The chain pins are the answer control on this step. */
  readonly chainAnswer?: boolean
  /** The model-boundary sentence printed under the scene. */
  readonly boundary: string
}

/**
 * A prediction answered by choosing a stop on the chain map.
 *
 * The inputs live in one DOM `<fieldset>` (`ChainAnswerFieldset`, Claude-owned); the suite's 3D
 * pins are `<label htmlFor>` elements pointing at those inputs, so a pin click checks the radio,
 * arrow keys move between stops, and `disabled` locks a committed answer. Choices with a null
 * stop are off-chain options ("cannot be located from this image") and get a row but no pin.
 */
export interface ChainAnswerChoice {
  readonly id: string
  readonly label: string
  readonly stop: ChainStop | null
}

export interface ChainAnswer {
  readonly name: string
  readonly legend: string
  readonly choices: readonly ChainAnswerChoice[]
  readonly selectedChoiceId: string | null
  readonly committedChoiceId?: string | null
  readonly correctChoiceIds?: readonly string[]
  readonly onSelect: (choiceId: string) => void
  readonly disabled: boolean
  readonly hint?: string
}

export interface ImagingSuitePaneProps {
  readonly view: SuiteViewSpec
  readonly lab: LabState
  /** A partial or whole values object; only keys whose value differs count as a change. */
  readonly onLabChange: (patch: LabValues) => void
  readonly onLabReset: () => void
  readonly controlsEnabled: boolean
  /** Printed on the scene when the controls are locked (deciding) or paused (looking back). */
  readonly lockedReason?: string
  readonly pausedReason?: string
  readonly goals: readonly { readonly goal: LabGoal; readonly met: boolean }[]
  /** `chainCaption(view.litStop)`, printed verbatim. */
  readonly chainCaption: string
  readonly chainAnswer?: ChainAnswer
  /** A control key to spotlight ("Show me where"). */
  readonly spotlightKey?: string
  readonly children?: ReactNode
}

/** Element ids both sides use, so tests and pins can find a control. */
export function controlElementId(key: string): string {
  return `peripheral-imaging-control-${key}`
}

export function chainChoiceInputId(name: string, choiceId: string): string {
  return `peripheral-imaging-chain-${name}-${choiceId}`
}

/**
 * The DOM contract the flow tests and the e2e suite read.
 *
 * - `[data-suite-scene][data-suite-mode][data-suite-state=ready|failed|fallback][data-lit]`
 * - the scene canvas carries `data-three-state="ready"` once it has drawn
 * - the monitor wrapper carries `data-projection-state="ready"|"failed"`
 * - `[data-suite-anim="running"|"idle"]` while a view animates
 * - `[data-chain-map] [data-chain-pin=<stop>]`, the lit pin with `aria-current="step"`
 * - `[data-chain-answer]` fieldset, rows `[data-off-chain]`, `[data-chain-outcome]` after commit
 * - `[data-readouts] [data-readout=<metricId>]`
 * - every control `id={controlElementId(key)}`
 * - scouts `[data-scout-state="ready"]`, DTS `[data-dts-state]`, CT slices `[data-ct-state]`
 * - `[data-model-boundary]`
 */
export const SUITE_DOM = {
  scene: 'data-suite-scene',
  mode: 'data-suite-mode',
  state: 'data-suite-state',
  lit: 'data-lit',
  animation: 'data-suite-anim',
  chainMap: 'data-chain-map',
  chainPin: 'data-chain-pin',
  chainAnswer: 'data-chain-answer',
  offChain: 'data-off-chain',
  chainOutcome: 'data-chain-outcome',
  readouts: 'data-readouts',
  readout: 'data-readout',
  boundary: 'data-model-boundary',
} as const
