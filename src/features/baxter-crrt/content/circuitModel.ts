/**
 * One universal CRRT circuit.
 *
 * Every modality, fluid, pressure, and citrate view in this module renders from
 * the coordinates in this file. Components never move between views: an overlay
 * changes only which paths are *active*, never where anything sits. That single
 * fixed orientation is the point — a learner who has traced the circuit once can
 * reuse the same picture for every later equation, prescription control, alarm,
 * and case.
 *
 * Nothing here is a device screen, an operating instruction, an alarm setting,
 * or a clinical target. Geometry is an original educational schematic.
 */

import {
  PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
  PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
} from '../engine/pressureModel'
import type { CrrtModality } from '../engine/types'
import { unresolvableCrrtSourceIds } from './learnerSourceMap'

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

export const CRRT_CIRCUIT_VIEWBOX = '0 0 1330 780' as const

/**
 * The circuit is laid out on two rows. Blood leaves the patient along y = 250
 * and runs left to right; it returns along y = 560 and runs right to left. The
 * fluid side of the membrane and its bags occupy the right-hand column, so no
 * two paths cross anywhere on the diagram.
 */

export interface CrrtCircuitPoint {
  readonly x: number
  readonly y: number
}

export const crrtCircuitNodeIds = [
  'patient',
  'access-lumen',
  'access-pressure',
  'pbp-citrate-entry',
  'blood-pump',
  'pre-filter-replacement-entry',
  'filter-pressure',
  'filter',
  'post-filter-replacement-entry',
  'deaeration-chamber',
  'return-pressure',
  'air-detector',
  'return-clamp',
  'return-lumen',
  'pbp-citrate-source',
  'pre-filter-replacement-source',
  'post-filter-replacement-source',
  'dialysate-source',
  'dialysate-pump',
  'effluent-pressure',
  'blood-leak-detector',
  'effluent-pump',
  'effluent-scale',
  'calcium-source',
  'circuit-sampling-domain',
  'systemic-sampling-domain',
] as const

export type CrrtCircuitNodeId = (typeof crrtCircuitNodeIds)[number]

export type CrrtLabelAnchor = 'start' | 'middle' | 'end'

/**
 * Where a node's caption sits relative to the node. Captions are hand-placed
 * rather than defaulted: the circuit packs fourteen labelled components onto two
 * rows, and a uniform offset makes several of them collide.
 */
export interface CrrtCircuitLabelOffset {
  readonly dx: number
  readonly dy: number
  readonly anchor: CrrtLabelAnchor
}

export interface CrrtCircuitNode {
  readonly id: CrrtCircuitNodeId
  readonly at: CrrtCircuitPoint
  /** Short all-caps label drawn on the schematic. */
  readonly label: string
  /** Second label line, drawn smaller. Null when one line is enough. */
  readonly subLabel: string | null
  readonly labelOffset: CrrtCircuitLabelOffset
  /** Sentence used by the text equivalent and by screen readers. */
  readonly description: string
}

/**
 * The single coordinate table. Overlays index into this and never override it.
 */
export const crrtCircuitNodes: readonly CrrtCircuitNode[] = Object.freeze([
  {
    id: 'patient',
    at: { x: 110, y: 385 },
    label: 'PATIENT',
    subLabel: null,
    labelOffset: { dx: 0, dy: -38, anchor: 'middle' },
    description:
      'The patient, connected by one dual-lumen catheter whose two lumens are drawn separately.',
  },
  {
    id: 'access-lumen',
    at: { x: 174, y: 336 },
    label: 'ACCESS LUMEN',
    subLabel: 'BLOOD OUT OF PATIENT',
    labelOffset: { dx: 34, dy: 5, anchor: 'start' },
    description:
      'The access lumen. Blood leaves the patient here and is drawn toward the blood pump.',
  },
  {
    id: 'access-pressure',
    at: { x: 252, y: 250 },
    label: 'ACCESS PRESSURE',
    subLabel: null,
    labelOffset: { dx: 0, dy: -30, anchor: 'middle' },
    description:
      'The access pressure site, on the access line between the patient and the blood pump.',
  },
  {
    id: 'pbp-citrate-entry',
    at: { x: 348, y: 250 },
    label: 'PBP / CITRATE',
    subLabel: 'ENTERS BEFORE PUMP',
    labelOffset: { dx: 0, dy: 50, anchor: 'middle' },
    description:
      'The pre-blood-pump entry. Pre-blood-pump fluid and, where citrate anticoagulation is used, citrate join the blood path here — before the blood pump and before the filter.',
  },
  {
    id: 'blood-pump',
    at: { x: 452, y: 250 },
    label: 'BLOOD PUMP',
    subLabel: null,
    labelOffset: { dx: 0, dy: 80, anchor: 'middle' },
    description: 'The blood pump, which sets the extracorporeal blood flow rate.',
  },
  {
    id: 'pre-filter-replacement-entry',
    at: { x: 560, y: 250 },
    label: 'PRE-FILTER',
    subLabel: 'REPLACEMENT PORT',
    labelOffset: { dx: 0, dy: 50, anchor: 'middle' },
    description:
      'The pre-filter replacement port. Replacement fluid given here dilutes blood before it reaches the membrane.',
  },
  {
    id: 'filter-pressure',
    at: { x: 628, y: 250 },
    label: 'FILTER PRESSURE',
    subLabel: null,
    labelOffset: { dx: 0, dy: -30, anchor: 'middle' },
    description: 'The filter pressure site, on the blood line at the filter inlet.',
  },
  {
    id: 'filter',
    at: { x: 740, y: 369 },
    label: 'FILTER',
    subLabel: null,
    labelOffset: { dx: 10, dy: -130, anchor: 'middle' },
    description:
      'The filter. Blood passes down the blood side; dialysate and ultrafiltrate occupy the fluid side on the other face of the membrane.',
  },
  {
    id: 'post-filter-replacement-entry',
    at: { x: 640, y: 560 },
    label: 'POST-FILTER',
    subLabel: 'REPLACEMENT PORT',
    labelOffset: { dx: 0, dy: -44, anchor: 'middle' },
    description:
      'The post-filter replacement port. Replacement fluid given here enters the blood after the membrane, so it is never filtered.',
  },
  {
    id: 'deaeration-chamber',
    at: { x: 540, y: 560 },
    label: 'DEAERATION',
    subLabel: 'RETURN CHAMBER',
    labelOffset: { dx: 0, dy: 62, anchor: 'middle' },
    description: 'The deaeration or return chamber on the return line.',
  },
  {
    id: 'return-pressure',
    at: { x: 440, y: 560 },
    label: 'RETURN PRESSURE',
    subLabel: null,
    labelOffset: { dx: -30, dy: -32, anchor: 'middle' },
    description: 'The return pressure site, on the return line downstream of the return chamber.',
  },
  {
    id: 'air-detector',
    at: { x: 360, y: 560 },
    label: 'AIR DETECTOR',
    subLabel: null,
    labelOffset: { dx: 0, dy: 46, anchor: 'middle' },
    description: 'The air detector on the return line.',
  },
  {
    id: 'return-clamp',
    at: { x: 280, y: 560 },
    label: 'RETURN CLAMP',
    subLabel: null,
    labelOffset: { dx: 0, dy: -46, anchor: 'middle' },
    description: 'The return line clamp, the last circuit element before the patient.',
  },
  {
    id: 'return-lumen',
    at: { x: 174, y: 436 },
    label: 'RETURN LUMEN',
    subLabel: 'BLOOD INTO PATIENT',
    labelOffset: { dx: 34, dy: 5, anchor: 'start' },
    description: 'The return lumen. Blood re-enters the patient here.',
  },
  {
    id: 'pbp-citrate-source',
    at: { x: 348, y: 120 },
    label: 'PBP / CITRATE',
    subLabel: 'SOURCE',
    labelOffset: { dx: 0, dy: 46, anchor: 'middle' },
    description: 'The pre-blood-pump fluid source, which also carries citrate where it is used.',
  },
  {
    id: 'pre-filter-replacement-source',
    at: { x: 560, y: 120 },
    label: 'REPLACEMENT',
    subLabel: 'PRE-FILTER SOURCE',
    labelOffset: { dx: 0, dy: 46, anchor: 'middle' },
    description: 'The replacement fluid source feeding the pre-filter port.',
  },
  {
    id: 'post-filter-replacement-source',
    at: { x: 640, y: 680 },
    label: 'REPLACEMENT',
    subLabel: 'POST-FILTER SOURCE',
    labelOffset: { dx: 0, dy: 46, anchor: 'middle' },
    description: 'The replacement fluid source feeding the post-filter port.',
  },
  {
    id: 'dialysate-source',
    at: { x: 1000, y: 668 },
    label: 'DIALYSATE',
    subLabel: 'BAG + SCALE',
    labelOffset: { dx: 0, dy: 54, anchor: 'middle' },
    description: 'The dialysate bag on its scale.',
  },
  {
    id: 'dialysate-pump',
    at: { x: 1000, y: 528 },
    label: 'DIALYSATE PUMP',
    subLabel: null,
    labelOffset: { dx: -42, dy: 4, anchor: 'end' },
    description: 'The dialysate pump, which drives fluid into the fluid side of the filter.',
  },
  {
    id: 'effluent-pressure',
    at: { x: 1230, y: 268 },
    label: 'EFFLUENT PRESSURE',
    subLabel: null,
    labelOffset: { dx: -30, dy: -34, anchor: 'end' },
    description: 'The effluent pressure site, on the effluent line leaving the filter fluid side.',
  },
  {
    id: 'blood-leak-detector',
    at: { x: 1230, y: 358 },
    label: 'BLOOD-LEAK',
    subLabel: 'DETECTOR',
    labelOffset: { dx: -40, dy: -2, anchor: 'end' },
    description:
      'The blood-leak detector, which watches the effluent for blood crossing the membrane.',
  },
  {
    id: 'effluent-pump',
    at: { x: 1230, y: 452 },
    label: 'EFFLUENT PUMP',
    subLabel: null,
    labelOffset: { dx: -46, dy: 4, anchor: 'end' },
    description: 'The effluent pump, which sets total effluent flow.',
  },
  {
    id: 'effluent-scale',
    at: { x: 1230, y: 640 },
    label: 'EFFLUENT',
    subLabel: 'BAG + SCALE',
    labelOffset: { dx: 0, dy: 54, anchor: 'middle' },
    description:
      'The effluent bag on its scale. Everything that leaves by the fluid side collects here.',
  },
  {
    id: 'calcium-source',
    at: { x: 110, y: 672 },
    label: 'CALCIUM',
    subLabel: 'SEPARATE INFUSION',
    labelOffset: { dx: 0, dy: 46, anchor: 'middle' },
    description:
      'The calcium replacement infusion. It runs to the patient on its own line and is not part of the extracorporeal circuit.',
  },
  {
    id: 'circuit-sampling-domain',
    at: { x: 700, y: 560 },
    label: 'CIRCUIT SAMPLE',
    subLabel: 'POST-FILTER',
    labelOffset: { dx: 0, dy: 58, anchor: 'middle' },
    description:
      'The circuit sampling domain, drawn from the circuit after the filter. It describes conditions inside the circuit, not the patient.',
  },
  {
    id: 'systemic-sampling-domain',
    at: { x: 110, y: 385 },
    label: 'SYSTEMIC SAMPLE',
    subLabel: 'PATIENT',
    labelOffset: { dx: 0, dy: -96, anchor: 'middle' },
    description:
      'The systemic sampling domain, drawn from the patient. It describes the patient, not the circuit.',
  },
])

export const crrtCircuitNodeById: ReadonlyMap<CrrtCircuitNodeId, CrrtCircuitNode> = new Map(
  crrtCircuitNodes.map((node) => [node.id, node]),
)

export function crrtCircuitNode(id: CrrtCircuitNodeId): CrrtCircuitNode {
  const node = crrtCircuitNodeById.get(id)
  if (!node) throw new Error(`Unknown CRRT circuit node: ${id}`)
  return node
}

/* ------------------------------------------------------------------ *
 * Paths
 * ------------------------------------------------------------------ */

/**
 * Path kinds are distinguished by dash pattern and arrow marker as well as
 * colour, so the schematic stays readable without colour perception.
 */
export const crrtCircuitPathKinds = [
  'blood',
  'dialysate',
  'replacement',
  'pbp-citrate',
  'effluent',
  'calcium',
] as const

export type CrrtCircuitPathKind = (typeof crrtCircuitPathKinds)[number]

export interface CrrtCircuitPathKindStyle {
  readonly kind: CrrtCircuitPathKind
  readonly label: string
  /** Non-colour encoding. Solid blood line, distinct dash rhythm for each fluid. */
  readonly dashPattern: string
  readonly patternDescription: string
}

export const crrtCircuitPathKindStyles: readonly CrrtCircuitPathKindStyle[] = Object.freeze([
  {
    kind: 'blood',
    label: 'Blood',
    dashPattern: 'none',
    patternDescription: 'solid heavy line',
  },
  {
    kind: 'dialysate',
    label: 'Dialysate',
    dashPattern: '18 10',
    patternDescription: 'long dashes',
  },
  {
    kind: 'replacement',
    label: 'Replacement fluid',
    dashPattern: '4 8',
    patternDescription: 'short dots',
  },
  {
    kind: 'pbp-citrate',
    label: 'Pre-blood-pump fluid and citrate',
    dashPattern: '20 8 4 8',
    patternDescription: 'dash-dot',
  },
  {
    kind: 'effluent',
    label: 'Effluent',
    dashPattern: '11 7 11 7',
    patternDescription: 'even medium dashes',
  },
  {
    kind: 'calcium',
    label: 'Calcium replacement',
    dashPattern: '2 7',
    patternDescription: 'fine dots',
  },
])

export const crrtCircuitPathKindStyleByKind: ReadonlyMap<
  CrrtCircuitPathKind,
  CrrtCircuitPathKindStyle
> = new Map(crrtCircuitPathKindStyles.map((style) => [style.kind, style]))

export const crrtCircuitPathIds = [
  'access-lumen',
  'access-line',
  'pump-to-filter',
  'filter-blood-side',
  'filter-to-return',
  'return-line',
  'return-lumen',
  'pbp-citrate-infusion',
  'pre-filter-replacement',
  'post-filter-replacement',
  'dialysate-supply',
  'filter-fluid-side',
  'effluent-line',
  'calcium-infusion',
] as const

export type CrrtCircuitPathId = (typeof crrtCircuitPathIds)[number]

export interface CrrtCircuitPath {
  readonly id: CrrtCircuitPathId
  readonly kind: CrrtCircuitPathKind
  /** SVG path data in the shared coordinate space. Never varies by overlay. */
  readonly d: string
  readonly label: string
  /** One sentence for the text equivalent, phrased as a direction of travel. */
  readonly textEquivalent: string
}

export const crrtCircuitPaths: readonly CrrtCircuitPath[] = Object.freeze([
  {
    id: 'access-lumen',
    kind: 'blood',
    d: 'M 168 340 L 228 250',
    label: 'Access lumen',
    textEquivalent: 'Blood leaves the patient through the access lumen.',
  },
  {
    id: 'access-line',
    kind: 'blood',
    d: 'M 228 250 H 400',
    label: 'Access line',
    textEquivalent:
      'Blood travels along the access line past the access pressure site and the pre-blood-pump entry to the blood pump.',
  },
  {
    id: 'pump-to-filter',
    kind: 'blood',
    d: 'M 504 250 H 710',
    label: 'Pump to filter',
    textEquivalent:
      'Blood leaves the blood pump, passes the pre-filter replacement port and the filter pressure site, and reaches the top of the filter.',
  },
  {
    id: 'filter-blood-side',
    kind: 'blood',
    d: 'M 710 250 V 470',
    label: 'Filter blood side',
    textEquivalent: 'Blood passes down the blood side of the filter.',
  },
  {
    id: 'filter-to-return',
    kind: 'blood',
    d: 'M 710 470 V 560 H 688',
    label: 'Filter to return line',
    textEquivalent: 'Blood leaves the filter and turns onto the return line.',
  },
  {
    id: 'return-line',
    kind: 'blood',
    d: 'M 688 560 H 228',
    label: 'Return line',
    textEquivalent:
      'Blood travels along the return line past the post-filter replacement port, the deaeration chamber, the return pressure site, the air detector, and the return clamp.',
  },
  {
    id: 'return-lumen',
    kind: 'blood',
    d: 'M 228 560 L 168 440',
    label: 'Return lumen',
    textEquivalent: 'Blood re-enters the patient through the return lumen.',
  },
  {
    id: 'pbp-citrate-infusion',
    kind: 'pbp-citrate',
    d: 'M 348 154 V 250',
    label: 'Pre-blood-pump and citrate infusion',
    textEquivalent:
      'Pre-blood-pump fluid, carrying citrate where citrate is used, enters the blood path before the blood pump and therefore before the filter.',
  },
  {
    id: 'pre-filter-replacement',
    kind: 'replacement',
    d: 'M 560 154 V 250',
    label: 'Pre-filter replacement',
    textEquivalent:
      'Replacement fluid enters the blood path before the filter, diluting blood on its way to the membrane.',
  },
  {
    id: 'post-filter-replacement',
    kind: 'replacement',
    d: 'M 640 646 V 560',
    label: 'Post-filter replacement',
    textEquivalent:
      'Replacement fluid enters the blood path after the filter, so this fluid never crosses the membrane.',
  },
  {
    id: 'dialysate-supply',
    kind: 'dialysate',
    d: 'M 1000 634 V 470 H 800',
    label: 'Dialysate supply',
    textEquivalent:
      'Dialysate travels from its bag and pump into the fluid side of the filter, entering at the end the blood leaves from so that it runs countercurrent to blood.',
  },
  {
    id: 'filter-fluid-side',
    kind: 'dialysate',
    d: 'M 800 470 V 268',
    label: 'Filter fluid side',
    textEquivalent:
      'Inside the filter, dialysate and everything filtered out of the blood occupy the fluid side of the membrane and travel toward the effluent outlet.',
  },
  {
    id: 'effluent-line',
    kind: 'effluent',
    d: 'M 800 268 V 150 H 1230 V 606',
    label: 'Effluent line',
    textEquivalent:
      'Effluent leaves the fluid side of the filter and passes the effluent pressure site, the blood-leak detector, and the effluent pump on its way to the effluent bag and scale.',
  },
  {
    id: 'calcium-infusion',
    kind: 'calcium',
    d: 'M 110 638 V 449',
    label: 'Calcium replacement infusion',
    textEquivalent:
      'Calcium replacement runs directly to the patient on a separate infusion line. It does not pass through the circuit.',
  },
])

export const crrtCircuitPathById: ReadonlyMap<CrrtCircuitPathId, CrrtCircuitPath> = new Map(
  crrtCircuitPaths.map((path) => [path.id, path]),
)

export function crrtCircuitPath(id: CrrtCircuitPathId): CrrtCircuitPath {
  const path = crrtCircuitPathById.get(id)
  if (!path) throw new Error(`Unknown CRRT circuit path: ${id}`)
  return path
}

/** Every path the blood itself travels, in flow order. */
export const crrtBloodPathIds: readonly CrrtCircuitPathId[] = Object.freeze([
  'access-lumen',
  'access-line',
  'pump-to-filter',
  'filter-blood-side',
  'filter-to-return',
  'return-line',
  'return-lumen',
])

/* ------------------------------------------------------------------ *
 * Pressure semantics: directly modelled sites versus calculated relationships
 * ------------------------------------------------------------------ */

/**
 * The distinction this module refuses to blur. Four pressures are modelled at a
 * physical location. TMP and filter pressure drop are arithmetic over those
 * locations — there is no fifth or sixth transducer to inspect.
 */
export type CrrtPressureSignalKind = 'directly-modelled-site' | 'calculated-relationship'

export const crrtPressureSignalIds = [
  'access',
  'filter',
  'return',
  'effluent',
  'tmp',
  'filter-drop',
] as const

export type CrrtPressureSignalId = (typeof crrtPressureSignalIds)[number]

export interface CrrtPressureSignalDetail {
  readonly id: CrrtPressureSignalId
  readonly label: string
  readonly kind: CrrtPressureSignalKind
  /** Node the value belongs to. Null for calculated relationships — they have no location. */
  readonly nodeId: CrrtCircuitNodeId | null
  /** Nodes a calculated relationship is computed from. Empty for modelled sites. */
  readonly derivedFromNodeIds: readonly CrrtCircuitNodeId[]
  readonly physicalLocation: string
  readonly whatProducesTheValue: string
  readonly bloodFlowEffect: string
  readonly patientOrAccessCauses: readonly string[]
  readonly circuitCauses: readonly string[]
  readonly whenUnreliable: string
  readonly firstInspectionBoundary: string
  readonly sourceIds: readonly string[]
}

const ESCALATION_BOUNDARY =
  'Stay within observation and inspection. Confirm the reading is real, look at the patient and the named part of the circuit, and hand the decision to the responsible clinical team and the local protocol before changing therapy.'

export const crrtPressureSignalDetails: readonly CrrtPressureSignalDetail[] = Object.freeze([
  {
    id: 'access',
    label: 'Access pressure',
    kind: 'directly-modelled-site',
    nodeId: 'access-pressure',
    derivedFromNodeIds: [],
    physicalLocation:
      'On the access line, between the access lumen and the blood pump — upstream of the pump.',
    whatProducesTheValue:
      'The blood pump pulls against whatever resists flow between the patient and the pump. The harder it has to pull, the more negative this reading becomes.',
    bloodFlowEffect:
      'Raising blood flow makes access pressure more negative even when nothing has changed anatomically, because the same resistance is being asked to pass more flow. A more negative access pressure after a blood-flow increase is not by itself evidence of a new obstruction.',
    patientOrAccessCauses: [
      'Catheter tip position against a vessel wall or moved by patient position.',
      'Low intravascular volume, so the vessel collapses around the lumen when suction is applied.',
      'Thrombus or fibrin sheath on the access lumen.',
    ],
    circuitCauses: [
      'A kink, clamp, or compression on the access line.',
      'A partly closed connector between the access lumen and the pump.',
    ],
    whenUnreliable:
      'Immediately after a position change, during coughing or agitation, or when the line is being handled — the transducer is reporting a transient, not a trend.',
    firstInspectionBoundary: ESCALATION_BOUNDARY,
    sourceIds: ['DEV-PM-009', 'SYNTH-LAB-PRESSURE-001'],
  },
  {
    id: 'filter',
    label: 'Filter pressure',
    kind: 'directly-modelled-site',
    nodeId: 'filter-pressure',
    derivedFromNodeIds: [],
    physicalLocation: 'On the blood line at the filter inlet, downstream of the blood pump.',
    whatProducesTheValue:
      'The pump pushes blood into everything downstream of it. This reading is the pressure needed to drive the current blood flow through the filter and the whole return limb.',
    bloodFlowEffect:
      'Raising blood flow raises filter pressure through unchanged resistance. Filter pressure read on its own cannot separate "more flow" from "more resistance".',
    patientOrAccessCauses: [
      'Nothing on the patient side raises this directly; a patient-side problem reaches it only by changing what the return limb has to push against.',
    ],
    circuitCauses: [
      'Clot or fouling accumulating in the filter.',
      'Any obstruction downstream of the filter, because filter pressure sits upstream of it.',
      'A kink on the line between the pump and the filter.',
    ],
    whenUnreliable:
      'While the pump is stopped or the circuit is being primed, the reading reflects a static column rather than flow.',
    firstInspectionBoundary: ESCALATION_BOUNDARY,
    sourceIds: ['DEV-PM-009', 'SYNTH-LAB-PRESSURE-001'],
  },
  {
    id: 'return',
    label: 'Return pressure',
    kind: 'directly-modelled-site',
    nodeId: 'return-pressure',
    derivedFromNodeIds: [],
    physicalLocation:
      'On the return line, downstream of the deaeration chamber and upstream of the return lumen.',
    whatProducesTheValue:
      'The pressure needed to push blood back into the patient through the return lumen and everything between.',
    bloodFlowEffect:
      'Raising blood flow raises return pressure through unchanged resistance, for the same reason filter pressure rises.',
    patientOrAccessCauses: [
      'Return lumen position, thrombus, or a fibrin sheath.',
      'Raised central venous pressure, which the circuit must push against.',
    ],
    circuitCauses: [
      'A kink, clamp, or compression on the return line.',
      'A partly closed return clamp or connector.',
    ],
    whenUnreliable:
      'While the return clamp is closing or the chamber level is being adjusted, the reading is transient.',
    firstInspectionBoundary: ESCALATION_BOUNDARY,
    sourceIds: ['DEV-PM-009', 'SYNTH-LAB-PRESSURE-001'],
  },
  {
    id: 'effluent',
    label: 'Effluent pressure',
    kind: 'directly-modelled-site',
    nodeId: 'effluent-pressure',
    derivedFromNodeIds: [],
    physicalLocation: 'On the effluent line, on the fluid side of the membrane.',
    whatProducesTheValue:
      'The effluent pump pulls fluid off the fluid side of the filter. This reading reports the pressure on that side of the membrane.',
    bloodFlowEffect:
      'Blood flow reaches this reading only indirectly, through the pressure on the blood side of the membrane. The effluent pump setting and the effluent line itself matter more.',
    patientOrAccessCauses: ['No patient-side cause acts on this site directly.'],
    circuitCauses: [
      'A kink or obstruction on the effluent line.',
      'A membrane that has become harder to filter across, so more suction is needed for the same effluent flow.',
      'An effluent bag or scale problem that changes what the pump is pulling against.',
    ],
    whenUnreliable:
      'During a bag change, while a scale is open, or before the effluent pump has reached its set rate.',
    firstInspectionBoundary: ESCALATION_BOUNDARY,
    sourceIds: ['DEV-PM-009', 'SYNTH-LAB-PRESSURE-001'],
  },
  {
    id: 'tmp',
    label: 'TMP',
    kind: 'calculated-relationship',
    nodeId: null,
    derivedFromNodeIds: ['filter-pressure', 'return-pressure', 'effluent-pressure'],
    physicalLocation:
      'Nowhere. TMP has no transducer of its own. It is arithmetic over the filter, return, and effluent readings, plus a fixed device display offset.',
    whatProducesTheValue: `The device averages the filter and return pressures, subtracts the effluent pressure, and applies a fixed display offset of ${PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG} mmHg. It describes the pressure difference across the membrane, not a place you can inspect.`,
    bloodFlowEffect:
      'Raising blood flow raises the blood-side terms and therefore raises TMP, with no change on the fluid side and no new obstruction anywhere.',
    patientOrAccessCauses: [
      'Only through the three readings it is made of. There is no separate patient-side route to TMP.',
    ],
    circuitCauses: [
      'Anything that moves filter, return, or effluent pressure moves TMP.',
      'A membrane that is harder to filter across widens the difference between the blood and fluid sides.',
    ],
    whenUnreliable:
      'Whenever any one of its three inputs is unreliable. A TMP built on a transient effluent reading is itself a transient. Treat TMP as a summary of three numbers you should look at individually.',
    firstInspectionBoundary:
      'Read the three underlying pressures before acting on TMP. Then stay within observation and inspection and hand the decision to the responsible clinical team and the local protocol.',
    sourceIds: ['MATH-PM-002'],
  },
  {
    id: 'filter-drop',
    label: 'Filter pressure drop',
    kind: 'calculated-relationship',
    nodeId: null,
    derivedFromNodeIds: ['filter-pressure', 'return-pressure'],
    physicalLocation:
      'Nowhere. Filter pressure drop has no transducer of its own. It is the difference between the filter and return readings, plus a fixed device display offset.',
    whatProducesTheValue: `The device subtracts the return pressure from the filter pressure and applies a fixed display offset of ${PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG} mmHg. It describes how hard it is to push blood through the filter and the return limb.`,
    bloodFlowEffect:
      'Raising blood flow widens the drop across unchanged resistance. A rising pressure drop after a blood-flow increase is expected arithmetic, not new information about the filter.',
    patientOrAccessCauses: ['Only through the two readings it is made of.'],
    circuitCauses: [
      'Clot or fouling inside the filter, which is the reading it is usually watched for.',
      'Anything that changes filter or return pressure independently.',
    ],
    whenUnreliable:
      'Whenever filter or return pressure is unreliable, and whenever blood flow has just changed — compare like with like before calling a trend.',
    firstInspectionBoundary:
      'Read filter and return pressure separately and note the blood flow they were read at. Then stay within observation and inspection and hand the decision to the responsible clinical team and the local protocol.',
    sourceIds: ['DEV-PM-010'],
  },
])

export const crrtPressureSignalDetailById: ReadonlyMap<
  CrrtPressureSignalId,
  CrrtPressureSignalDetail
> = new Map(crrtPressureSignalDetails.map((detail) => [detail.id, detail]))

export function crrtPressureSignalDetail(id: CrrtPressureSignalId): CrrtPressureSignalDetail {
  const detail = crrtPressureSignalDetailById.get(id)
  if (!detail) throw new Error(`Unknown CRRT pressure signal: ${id}`)
  return detail
}

/* ------------------------------------------------------------------ *
 * Overlays
 * ------------------------------------------------------------------ */

export const crrtCircuitOverlayIds = [
  'blood-path',
  'scuf',
  'cvvhd',
  'cvvh-pre',
  'cvvh-post',
  'cvvhdf',
  'fluid-conservation',
  'citrate-calcium',
  'pressure-profile',
] as const

export type CrrtCircuitOverlayId = (typeof crrtCircuitOverlayIds)[number]

export interface CrrtCircuitOverlay {
  readonly id: CrrtCircuitOverlayId
  /** Learner-facing toggle label. */
  readonly label: string
  /** Modality this view represents, where it represents one. */
  readonly modality: CrrtModality | null
  /** One sentence stating what this view is for. */
  readonly summary: string
  /** Paths carrying fluid in this view. Everything else is drawn inactive. */
  readonly activePathIds: readonly CrrtCircuitPathId[]
  /** Whether the six pressure annotations are drawn. */
  readonly showsPressureProfile: boolean
  /** Whether the fluid-conservation ledger is emphasised. */
  readonly showsFluidLedger: boolean
  /** Whether the two sampling domains are drawn. */
  readonly showsSamplingDomains: boolean
  /** What the learner should be able to say after using this view. */
  readonly teachingPoint: string
  /**
   * Records backing this view's claims. Validated at module scope against the
   * union of the pilot, supplemental, and device-math registries — the Learn
   * surface resolves only the first two and drops unknown ids silently, which
   * would quietly lose the TMP citation.
   */
  readonly sourceIds: readonly string[]
}

const BLOOD = crrtBloodPathIds
/** Every modality that removes fluid uses the fluid side and the effluent line. */
const FLUID_SIDE: readonly CrrtCircuitPathId[] = ['filter-fluid-side', 'effluent-line']

export const crrtCircuitOverlays: readonly CrrtCircuitOverlay[] = Object.freeze([
  {
    id: 'blood-path',
    label: 'Blood path only',
    modality: null,
    summary:
      'The extracorporeal blood loop on its own, with no dialysate, replacement, or effluent drawn.',
    activePathIds: BLOOD,
    showsPressureProfile: false,
    showsFluidLedger: false,
    showsSamplingDomains: false,
    teachingPoint:
      'Blood leaves through the access lumen, is driven by one pump through the filter, and returns through a different lumen. This loop is identical in every modality below; only what happens at the membrane changes.',
    sourceIds: ['DEV-PM-009', 'REVIEW-CKRT-CORE-2025'],
  },
  {
    id: 'scuf',
    label: 'SCUF',
    modality: 'scuf',
    summary:
      'Slow continuous ultrafiltration: fluid is removed across the membrane, with no dialysate and no replacement fluid.',
    activePathIds: [...BLOOD, ...FLUID_SIDE],
    showsPressureProfile: false,
    showsFluidLedger: true,
    showsSamplingDomains: false,
    teachingPoint:
      'Nothing is given back and no dialysate is run, so effluent is the fluid taken off the patient and very little else. This is the one modality where effluent and net patient removal are nearly the same number.',
    sourceIds: ['REVIEW-CKRT-CORE-2025', 'MATH-PM-001'],
  },
  {
    id: 'cvvhd',
    label: 'CVVHD',
    modality: 'cvvhd',
    summary:
      'Continuous veno-venous haemodialysis: dialysate runs countercurrent along the fluid side of the membrane, with no replacement fluid.',
    activePathIds: [...BLOOD, 'dialysate-supply', ...FLUID_SIDE],
    showsPressureProfile: false,
    showsFluidLedger: true,
    showsSamplingDomains: false,
    teachingPoint:
      'Dialysate never enters the blood path and never enters the patient. It runs along the far side of the membrane and leaves in the effluent, which is why effluent volume is much larger than the fluid taken off the patient.',
    sourceIds: ['REVIEW-CKRT-CORE-2025', 'MATH-PM-001', 'SYNTH-LAB-TRANSPORT-001'],
  },
  {
    id: 'cvvh-pre',
    label: 'CVVH · pre-filter replacement',
    modality: 'cvvh',
    summary:
      'Continuous veno-venous haemofiltration with replacement fluid given before the filter.',
    activePathIds: [...BLOOD, 'pre-filter-replacement', ...FLUID_SIDE],
    showsPressureProfile: false,
    showsFluidLedger: true,
    showsSamplingDomains: false,
    teachingPoint:
      'Replacement fluid enters the blood before the membrane, so it dilutes the blood being filtered and is itself partly filtered off again. It does enter the patient; the fluid removed across the membrane is larger than the fluid the patient actually loses.',
    sourceIds: ['REVIEW-CKRT-CORE-2025', 'SYNTH-LAB-PREPOST-001', 'MATH-PM-001'],
  },
  {
    id: 'cvvh-post',
    label: 'CVVH · post-filter replacement',
    modality: 'cvvh',
    summary:
      'Continuous veno-venous haemofiltration with replacement fluid given after the filter.',
    activePathIds: [...BLOOD, 'post-filter-replacement', ...FLUID_SIDE],
    showsPressureProfile: false,
    showsFluidLedger: true,
    showsSamplingDomains: false,
    teachingPoint:
      'The same physical circuit, with the replacement fluid entering after the membrane instead of before it. This fluid is never filtered, so all of it reaches the patient — and the machine must pull that whole volume across the membrane first.',
    sourceIds: ['REVIEW-CKRT-CORE-2025', 'SYNTH-LAB-PREPOST-001', 'MATH-PM-001'],
  },
  {
    id: 'cvvhdf',
    label: 'CVVHDF',
    modality: 'cvvhdf',
    summary:
      'Continuous veno-venous haemodiafiltration: dialysate and replacement fluid together on the same circuit.',
    activePathIds: [
      ...BLOOD,
      'pre-filter-replacement',
      'post-filter-replacement',
      'dialysate-supply',
      ...FLUID_SIDE,
    ],
    showsPressureProfile: false,
    showsFluidLedger: true,
    showsSamplingDomains: false,
    teachingPoint:
      'Both fluids are running. Dialysate still never enters the patient and replacement fluid still does. Effluent now carries the dialysate and everything filtered across the membrane, so it is the largest number on the machine and the least like net patient removal.',
    sourceIds: ['REVIEW-CKRT-CORE-2025', 'MATH-PM-001', 'SYNTH-LAB-PREPOST-001'],
  },
  {
    id: 'fluid-conservation',
    label: 'Fluid conservation',
    modality: null,
    summary:
      'Every fluid at once, with the ledger that separates what enters the patient, what never does, and what leaves in the effluent.',
    activePathIds: [
      ...BLOOD,
      'pbp-citrate-infusion',
      'pre-filter-replacement',
      'post-filter-replacement',
      'dialysate-supply',
      ...FLUID_SIDE,
    ],
    showsPressureProfile: false,
    showsFluidLedger: true,
    showsSamplingDomains: false,
    teachingPoint:
      'Effluent is not net patient loss. Effluent is everything that leaves by the fluid side: the dialysate that was never in the patient, plus everything pulled across the membrane — most of which is handed straight back as replacement fluid.',
    sourceIds: ['MATH-PM-001', 'FLUID-PM-001', 'FLUID-PM-002', 'SYNTH-LAB-FLUID-001'],
  },
  {
    id: 'citrate-calcium',
    label: 'Citrate and calcium path',
    modality: null,
    summary:
      'Where citrate enters, where the calcium it binds leaves, where calcium replacement is given, and which sample describes which compartment.',
    activePathIds: [
      ...BLOOD,
      'pbp-citrate-infusion',
      'calcium-infusion',
      'dialysate-supply',
      ...FLUID_SIDE,
    ],
    showsPressureProfile: false,
    showsFluidLedger: false,
    showsSamplingDomains: true,
    teachingPoint:
      'Citrate enters before the filter, so it acts inside the circuit. Citrate-calcium complexes can leave in the effluent. Blood still returns to the patient, and calcium replacement supports the patient on a separate line. A circuit sample and a systemic sample answer different questions and are not interchangeable.',
    sourceIds: ['REVIEW-CKRT-CORE-2025', 'TEXT-CRRT-NEYRA-2026', 'GUID-RRT-ICU-2026'],
  },
  {
    id: 'pressure-profile',
    label: 'Pressure profile',
    modality: null,
    summary:
      'The four directly modelled pressure sites and the two calculated relationships, on the same unchanged circuit.',
    activePathIds: [...BLOOD, 'dialysate-supply', ...FLUID_SIDE],
    showsPressureProfile: true,
    showsFluidLedger: false,
    showsSamplingDomains: false,
    teachingPoint:
      'Four pressures have a location you can walk to and inspect. TMP and filter pressure drop have no location — they are arithmetic over the first four, so they move whenever their inputs move, including when only blood flow changed.',
    sourceIds: ['DEV-PM-009', 'DEV-PM-010', 'MATH-PM-002', 'SYNTH-LAB-PRESSURE-001'],
  },
])

export const crrtCircuitOverlayById: ReadonlyMap<CrrtCircuitOverlayId, CrrtCircuitOverlay> =
  new Map(crrtCircuitOverlays.map((overlay) => [overlay.id, overlay]))

export function crrtCircuitOverlay(id: CrrtCircuitOverlayId): CrrtCircuitOverlay {
  const overlay = crrtCircuitOverlayById.get(id)
  if (!overlay) throw new Error(`Unknown CRRT circuit overlay: ${id}`)
  return overlay
}

/**
 * Which fluids in this view reach the patient. The circuit teaches this
 * distinction more often than any other, so it is derived from the overlay's
 * own active paths rather than restated per overlay.
 */
export interface CrrtOverlayFluidDestinations {
  readonly entersPatient: readonly CrrtCircuitPathId[]
  readonly neverEntersPatient: readonly CrrtCircuitPathId[]
}

const PATHS_THAT_REACH_THE_PATIENT: readonly CrrtCircuitPathId[] = Object.freeze([
  'pbp-citrate-infusion',
  'pre-filter-replacement',
  'post-filter-replacement',
  'calcium-infusion',
])

const PATHS_THAT_NEVER_REACH_THE_PATIENT: readonly CrrtCircuitPathId[] = Object.freeze([
  'dialysate-supply',
  'filter-fluid-side',
  'effluent-line',
])

export function crrtOverlayFluidDestinations(
  overlay: CrrtCircuitOverlay,
): CrrtOverlayFluidDestinations {
  const active = new Set(overlay.activePathIds)
  return {
    entersPatient: PATHS_THAT_REACH_THE_PATIENT.filter((id) => active.has(id)),
    neverEntersPatient: PATHS_THAT_NEVER_REACH_THE_PATIENT.filter((id) => active.has(id)),
  }
}

/**
 * The complete text equivalent for one overlay. The rendered schematic and this
 * string must always describe the same circuit; a test pins that.
 */
export function crrtCircuitTextEquivalent(overlayId: CrrtCircuitOverlayId): string {
  const overlay = crrtCircuitOverlay(overlayId)
  const destinations = crrtOverlayFluidDestinations(overlay)
  const lines = [`${overlay.label}. ${overlay.summary}`]

  lines.push(
    `Active paths: ${overlay.activePathIds
      .map((id) => crrtCircuitPath(id).textEquivalent)
      .join(' ')}`,
  )

  if (destinations.entersPatient.length > 0) {
    lines.push(
      `Fluid that enters the patient in this view: ${destinations.entersPatient
        .map((id) => crrtCircuitPath(id).label)
        .join(', ')}.`,
    )
  } else {
    lines.push('No added fluid enters the patient in this view.')
  }

  if (destinations.neverEntersPatient.length > 0) {
    lines.push(
      `Fluid that never enters the patient in this view: ${destinations.neverEntersPatient
        .map((id) => crrtCircuitPath(id).label)
        .join(', ')}.`,
    )
  }

  if (overlay.showsPressureProfile) {
    lines.push(
      `Directly modelled pressure sites: ${crrtPressureSignalDetails
        .filter((detail) => detail.kind === 'directly-modelled-site')
        .map((detail) => detail.label)
        .join(
          ', ',
        )}. Calculated relationships with no location of their own: ${crrtPressureSignalDetails
        .filter((detail) => detail.kind === 'calculated-relationship')
        .map((detail) => detail.label)
        .join(', ')}.`,
    )
  }

  if (overlay.showsSamplingDomains) {
    lines.push(
      `${crrtCircuitNode('circuit-sampling-domain').description} ${crrtCircuitNode('systemic-sampling-domain').description}`,
    )
  }

  lines.push(overlay.teachingPoint)
  return lines.join(' ')
}

/* ------------------------------------------------------------------ *
 * Citrate and calcium: first-use terms only
 * ------------------------------------------------------------------ */

/**
 * The vocabulary the citrate view needs, and nothing beyond it.
 *
 * This is a bounded topology-and-first-use layer, approved as such. It names
 * where citrate enters, what it does inside the circuit, where the calcium it
 * binds can leave, where calcium replacement is given, and which sample
 * describes which compartment. It deliberately carries no dose, no ratio, no
 * numeric goal, no titration or timing instruction, and no accumulation
 * differential — those belong to a later package, and `ConceptualCitrateState`
 * in the engine draws the same boundary in code.
 *
 * Every term is a learner-facing string, so every term carries its own CRRT
 * provenance rather than inheriting the overlay's.
 */
export interface CrrtCitrateCalciumTerm {
  readonly id: string
  /** The term as a learner meets it. */
  readonly term: string
  /** What it means, in the compartment it belongs to. */
  readonly definition: string
  /** Why the distinction matters when reading a result. */
  readonly whyItMatters: string
  readonly sourceIds: readonly string[]
}

const CITRATE_CONTEXT_SOURCE_IDS = Object.freeze([
  'REVIEW-CKRT-CORE-2025',
  'TEXT-CRRT-NEYRA-2026',
  'GUID-RRT-ICU-2026',
])

export const crrtCitrateCalciumTerms: readonly CrrtCitrateCalciumTerm[] = Object.freeze([
  {
    id: 'citrate-entry-point',
    term: 'Citrate enters before the filter',
    definition:
      'Citrate joins the blood path at the pre-blood-pump entry, upstream of both the pump and the membrane.',
    whyItMatters:
      'Entering before the filter is what lets it act on the blood while that blood is outside the patient. Where a fluid joins the circuit decides which compartment it acts in.',
    sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
  },
  {
    id: 'circuit-anticoagulation',
    term: 'Anticoagulation inside the circuit',
    definition:
      'Citrate binds calcium in the blood travelling through the circuit, which is how clotting is slowed there.',
    whyItMatters:
      'The intended effect is local to the extracorporeal blood. That is the whole reason the circuit and the patient have to be thought about as two separate compartments.',
    sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
  },
  {
    id: 'circuit-sample',
    term: 'Circuit sample',
    definition:
      'A sample drawn from the circuit after the filter. It describes conditions inside the circuit.',
    whyItMatters:
      'It answers a question about the circuit, not about the patient. Reading it as if it described the patient swaps one compartment for the other.',
    sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
  },
  {
    id: 'systemic-sample',
    term: 'Systemic sample',
    definition: 'A sample drawn from the patient. It describes the patient.',
    whyItMatters:
      'A circuit sample and a systemic sample are not interchangeable, and neither one substitutes for the other.',
    sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
  },
  {
    id: 'citrate-calcium-in-effluent',
    term: 'Citrate-calcium complexes can leave in the effluent',
    definition:
      'Some of what citrate binds crosses the membrane and leaves with everything else on the fluid side.',
    whyItMatters:
      'It explains why calcium has to be given back somewhere, and why the effluent is a route out of the circuit for more than water.',
    sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
  },
  {
    id: 'calcium-replacement',
    term: 'Calcium replacement',
    definition:
      'A separate infusion running to the patient. It is not part of the extracorporeal circuit and does not pass through the filter.',
    whyItMatters:
      'It supports the patient rather than the circuit, which is why it is drawn on its own line and why it is judged against a systemic sample.',
    sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
  },
  {
    id: 'blood-returns-to-patient',
    term: 'Blood still returns to the patient',
    definition:
      'The blood that citrate acted on continues around the circuit and re-enters the patient through the return lumen.',
    whyItMatters:
      'The two compartments are connected, not sealed off from one another. That is why a circuit-directed treatment needs a patient-directed one alongside it.',
    sourceIds: CITRATE_CONTEXT_SOURCE_IDS,
  },
])

export const crrtCitrateCalciumTermById: ReadonlyMap<string, CrrtCitrateCalciumTerm> = new Map(
  crrtCitrateCalciumTerms.map((term) => [term.id, term]),
)

/* ------------------------------------------------------------------ *
 * Provenance closure
 * ------------------------------------------------------------------ */

/**
 * Every citation the circuit makes must resolve in the merged learner-facing
 * registry, and this throws at import if one does not. The merge itself lives in
 * `learnerSourceMap.ts` so a citation cannot resolve here while disappearing on
 * the Learn surface.
 */
export function unresolvedCrrtCircuitSourceIds(): readonly string[] {
  const cited = new Set<string>()
  for (const overlay of crrtCircuitOverlays) {
    for (const id of overlay.sourceIds) cited.add(id)
  }
  for (const detail of crrtPressureSignalDetails) {
    for (const id of detail.sourceIds) cited.add(id)
  }
  for (const term of crrtCitrateCalciumTerms) {
    for (const id of term.sourceIds) cited.add(id)
  }
  return unresolvableCrrtSourceIds(cited)
}

const unresolvedAtImport = unresolvedCrrtCircuitSourceIds()
if (unresolvedAtImport.length > 0) {
  throw new Error(
    `CRRT circuit cites source records that do not exist: ${unresolvedAtImport.join(', ')}`,
  )
}
