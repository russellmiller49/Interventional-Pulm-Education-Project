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
export function sampleLinkedSweep(
  previous: LinkedSweep,
  frame: { roll: number; frameId: string; visible: boolean; contact: number },
): LinkedSweep {
  if (!frame.frameId || frame.frameId === previous.lastFrameId) return previous
  if (previous.phase === 'complete') return previous
  const delta = previous.lastRoll === null ? 0 : frame.roll - previous.lastRoll
  if (frame.contact < 0.45)
    return { ...emptyLinkedSweep(), lastFrameId: frame.frameId, lastRoll: frame.roll }
  const continuous = Math.abs(delta) > 0 && Math.abs(delta) <= 12
  const next = { ...previous, lastRoll: frame.roll, lastFrameId: frame.frameId }
  if (previous.phase === 'crossing') {
    if (!continuous || Math.sign(delta) !== previous.direction)
      return {
        ...emptyLinkedSweep(),
        lastRoll: frame.roll,
        lastFrameId: frame.frameId,
        outside: !frame.visible,
      }
    if (!frame.visible)
      return previous.samples >= 5 && previous.span >= 20
        ? { ...next, phase: 'complete' }
        : { ...emptyLinkedSweep(), lastRoll: frame.roll, lastFrameId: frame.frameId, outside: true }
    return {
      ...next,
      samples: previous.samples + 1,
      span: Math.abs(frame.roll - previous.startRoll),
    }
  }
  if (!frame.visible) return { ...next, outside: true }
  if (previous.outside && continuous)
    return {
      ...next,
      phase: 'crossing',
      direction: Math.sign(delta),
      samples: 1,
      startRoll: frame.roll,
    }
  return { ...next, outside: false }
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
