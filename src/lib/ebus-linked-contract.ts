/** Guided-only acquisition rules. Numeric limits are authored exercise tolerances, not clinical thresholds. */
export const LINKED_TASK_VERSION = 2 as const
export const LINKED_VARIANTS = ['guided', 'changed-window'] as const
export type LinkedVariant = (typeof LINKED_VARIANTS)[number]
export const LINKED_LESSONS = [
  'scope-orientation',
  'acoustic-contact',
  'ct-map',
  'station-seven',
  'right-paratracheal',
] as const
export type LinkedLesson = (typeof LINKED_LESSONS)[number]
export type LinkedApproach = 'rms' | 'lms' | 'default'
type Triple = [number, number, number]
export interface LinkedFrameSource {
  sessionId: string
  taskId: string
  taskVersion: typeof LINKED_TASK_VERSION
  variant: LinkedVariant
  caseId: 'case-001'
  modelRevision: string
  geometrySha256: string
  acousticSha256: string
  presetKey: string
  frameId: string
  renderSequence: number
  pose: { originLps: Triple; depthAxisLps: Triple; lateralAxisLps: Triple }
  settings: {
    depthMm: number
    gainDb: number
    contactQuality: number
    sectorAngleDeg: number
    frequencyMHz: number
    tgcDb: Triple
  }
  scope: { roll: number; flexion: number; advanceMm: number; approach: LinkedApproach }
}
export interface LinkedRenderedFrame {
  ready: boolean
  targetVisible: boolean
  depth: number
  gain: number
  frozen: boolean
  poseKey: string
  frameId: string
  renderSequence: number
  pose?: LinkedFrameSource['pose']
  settings?: LinkedFrameSource['settings']
  baselineFrameId?: string
}
export interface LinkedSweep {
  phase: 'find-edge' | 'crossing' | 'complete'
  lastRoll: number | null
  lastFrameId: string
  direction: number
  outside: boolean
  samples: number
  span: number
  startRoll: number
}
/**
 * What the rotation sweep asks for. One rule, said to the learner in the workbench: rotate the
 * scope through at least `minSpanDeg` with the target seen in the image on the way. There is no
 * step limit, frame count or direction rule, so dragging the slider counts the same as stepping it.
 */
export const LINKED_SWEEP_TOLERANCES = {
  /** Below this contact index a frame carries no tissue window and is not counted. */
  minContact: 0.45,
  /** Rotation, in degrees, the sweep must cover. */
  minSpanDeg: 20,
} as const
/** What one sampled frame did to the sweep, so the workbench can describe where the learner is. */
export type LinkedSweepEvent =
  | 'unchanged'
  | 'already-complete'
  | 'no-contact'
  | 'complete'
  | 'sample'
  | 'outside'
export const emptyLinkedSweep = (): LinkedSweep => ({
  phase: 'find-edge',
  lastRoll: null,
  lastFrameId: '',
  direction: 0,
  outside: false,
  samples: 0,
  span: 0,
  startRoll: 0,
})
/**
 * One sampled frame. `startRoll` is the lowest rotation sampled so far and `span` the range
 * covered; `samples` counts frames that showed the target; `outside` records that a frame without
 * the target has been seen. The sweep completes once the range reaches `minSpanDeg` and the target
 * has been seen at least once.
 */
export function stepLinkedSweep(
  previous: LinkedSweep,
  frame: { roll: number; frameId: string; visible: boolean; contact: number },
): { sweep: LinkedSweep; event: LinkedSweepEvent } {
  const T = LINKED_SWEEP_TOLERANCES
  if (!frame.frameId || frame.frameId === previous.lastFrameId)
    return { sweep: previous, event: 'unchanged' }
  if (previous.phase === 'complete') return { sweep: previous, event: 'already-complete' }
  if (frame.contact < T.minContact)
    return { sweep: { ...previous, lastFrameId: frame.frameId }, event: 'no-contact' }
  const first = previous.lastRoll === null
  const low = first ? frame.roll : Math.min(previous.startRoll, frame.roll)
  const high = first ? frame.roll : Math.max(previous.startRoll + previous.span, frame.roll)
  const samples = previous.samples + (frame.visible ? 1 : 0)
  const span = high - low
  const complete = span >= T.minSpanDeg && samples > 0
  return {
    sweep: {
      phase: complete ? 'complete' : samples > 0 ? 'crossing' : 'find-edge',
      lastRoll: frame.roll,
      lastFrameId: frame.frameId,
      direction: first ? 0 : Math.sign(frame.roll - previous.lastRoll!),
      outside: previous.outside || !frame.visible,
      samples,
      span,
      startRoll: low,
    },
    event: complete ? 'complete' : frame.visible ? 'sample' : 'outside',
  }
}
export function sampleLinkedSweep(
  previous: LinkedSweep,
  frame: { roll: number; frameId: string; visible: boolean; contact: number },
): LinkedSweep {
  return stepLinkedSweep(previous, frame).sweep
}
export const linkedTaskId = (lesson: LinkedLesson, variant: LinkedVariant) => `${lesson}:${variant}`
export const linkedTaskKey = (lesson: LinkedLesson, variant: LinkedVariant) =>
  `${linkedTaskId(lesson, variant)}:v${LINKED_TASK_VERSION}`
export const LINKED_LANDMARKS: Record<LinkedLesson, readonly string[]> = {
  'scope-orientation': ['transducer_face'],
  'acoustic-contact': [],
  'ct-map': ['carina', 'superior_vena_cava'],
  'station-seven': ['carina', 'right_main_bronchus', 'left_main_bronchus'],
  'right-paratracheal': ['azygous', 'superior_vena_cava', 'left_brachiocephalic_vein'],
}
export const LANDMARK_NAMES: Record<string, string> = {
  transducer_face: 'transducer surface',
  carina: 'main carina',
  right_main_bronchus: 'right main bronchus',
  left_main_bronchus: 'left main bronchus',
  azygous: 'azygos vein',
  superior_vena_cava: 'superior vena cava',
  left_brachiocephalic_vein: 'left brachiocephalic vein',
}
/**
 * Learner-facing names for structures whose model labels are spelled or ordered differently from
 * the course (EBUS-PRE-REVIEW-04, L3-10): "azygous", "Left Atrium", "atrial appendage left",
 * "11RI". Display only. The keys are the models' semantic ids, which stay exactly as they are —
 * `azygous` included — because landmark answers, stored observations, the acoustic volume and the
 * Prompt-03 marker identity all key on them. Names follow the course text (`LANDMARK_NAMES`,
 * the station names in `locate.ts`).
 */
export const STRUCTURE_DISPLAY_NAMES: Record<string, string> = {
  azygous: 'azygos vein',
  left_atrium: 'left atrium',
  right_atrium: 'right atrium',
  left_ventricle: 'left ventricle',
  right_ventricle: 'right ventricle',
  atrial_appendage_left: 'left atrial appendage',
  superior_vena_cava: 'superior vena cava',
  node_station_11ri: 'Example node 11Ri',
  node_station_11rs: 'Example node 11Rs',
}
/** The name to show for a structure: the course's spelling where it differs, else the model's. */
export function structureDisplayName(id: string, label?: string) {
  const name = STRUCTURE_DISPLAY_NAMES[id] ?? String(label ?? id).replace(/_/g, ' ')
  // One case style for every label on a model: "Aorta" beside "Example node 4L", not "aorta".
  return name.charAt(0).toUpperCase() + name.slice(1)
}
export const LANDMARK_HINTS: Record<string, string> = {
  transducer_face:
    'Look on the scan-facing side of the distal scope, beside the projecting tip. The optical lens has a different direction.',
  carina: 'Follow the trachea to the point where it divides into the two main bronchi.',
  right_main_bronchus:
    'Trace the branch from the carina toward the patient’s right. Use the patient orientation markers, not your screen side.',
  left_main_bronchus:
    'Trace the branch from the carina toward the patient’s left. Observer rotation changes your view, not patient laterality.',
  azygous:
    'Look for the vein that arches over the right main bronchus toward the superior vena cava.',
  superior_vena_cava:
    'Look for the large vein to the patient’s right of the trachea, receiving the azygos arch.',
  left_brachiocephalic_vein:
    'Follow the vein crossing anterior to the upper trachea toward the superior vena cava. The brachiocephalic arterial trunk is a different structure.',
}
/** Feature descriptions give a text alternative to inspecting an unnamed mesh. */
export const STRUCTURE_FEATURES: Record<string, string> = {
  transducer_face:
    'A broad surface on one side of the distal device, aligned with the cyan ultrasound plane.',
  optical_lens:
    'A small circular face at the projecting end, aligned with the gold viewing direction.',
  channel_outlet: 'A separate small opening beside the distal imaging surfaces.',
  legacy_distal_body:
    'The projecting body at the end of the device, supporting its imaging surfaces.',
  carina: 'The junction at the lower end of the central airway, where two main branches diverge.',
  right_main_bronchus:
    'An airway segment extending from the central junction toward the patient’s right.',
  left_main_bronchus:
    'An airway segment extending from the central junction toward the patient’s left.',
  azygous:
    'An arching vessel passing over the right main airway branch toward a larger vertical vein.',
  superior_vena_cava:
    'A large vertical vein to the patient’s right of the central airway, receiving an arching vein.',
  left_brachiocephalic_vein:
    'A vein crossing anterior to the upper central airway from the patient’s left toward the large right-sided vein.',
  brachiocephalic_trunk:
    'An arterial branch rising from the large arterial arch toward the patient’s right; it is separate from the crossing vein.',
  aorta:
    'The large arterial structure forming an arch on the patient’s left and continuing posteriorly.',
}
export function linkedSetup(lesson: LinkedLesson, variant: LinkedVariant) {
  const changed = variant === 'changed-window'
  return {
    offsetMm: changed ? 3 : 0,
    initialRoll: changed ? -75 : 85,
    presetKey:
      lesson === 'right-paratracheal'
        ? 'station_4r_node_a::default'
        : lesson === 'station-seven' && changed
          ? 'station_7_node_a::lms'
          : 'station_7_node_a::rms',
  }
}

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const number = (v: unknown, low: number, high: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high
const triple = (v: unknown, low: number, high: number) =>
  Array.isArray(v) && v.length === 3 && v.every((n) => number(n, low, high))
export function isLinkedFrameSource(v: unknown): v is LinkedFrameSource {
  if (!object(v) || !object(v.pose) || !object(v.settings) || !object(v.scope)) return false
  return (
    v.taskVersion === LINKED_TASK_VERSION &&
    LINKED_VARIANTS.includes(v.variant as LinkedVariant) &&
    LINKED_LESSONS.some((l) => v.taskId === linkedTaskId(l, v.variant as LinkedVariant)) &&
    ['sessionId', 'modelRevision', 'presetKey', 'frameId'].every(
      (k) =>
        typeof v[k] === 'string' && (v[k] as string).length > 0 && (v[k] as string).length < 180,
    ) &&
    ['geometrySha256', 'acousticSha256'].every(
      (k) => typeof v[k] === 'string' && /^[a-f0-9]{64}$/.test(v[k] as string),
    ) &&
    v.caseId === 'case-001' &&
    Number.isInteger(v.renderSequence) &&
    number(v.renderSequence, 1, 1e8) &&
    triple(v.pose.originLps, -10000, 10000) &&
    triple(v.pose.depthAxisLps, -1, 1) &&
    triple(v.pose.lateralAxisLps, -1, 1) &&
    number(v.settings.depthMm, 15, 80) &&
    number(v.settings.gainDb, -18, 100) &&
    number(v.settings.contactQuality, 0, 1) &&
    number(v.settings.sectorAngleDeg, 1, 180) &&
    number(v.settings.frequencyMHz, 0.1, 100) &&
    triple(v.settings.tgcDb, -100, 100) &&
    number(v.scope.roll, -180, 180) &&
    number(v.scope.flexion, -90, 120) &&
    number(v.scope.advanceMm, 0, 1000) &&
    ['rms', 'lms', 'default'].includes(String(v.scope.approach))
  )
}
