/** Guided-only acquisition rules. Numeric limits are authored exercise tolerances, not clinical thresholds. */
export const LINKED_TASK_VERSION = 2 as const
/**
 * `along-airway` (2026-11-10) is the advance-and-withdraw task: the scope starts past the node at
 * a rotation that holds the node in plane, and the learner slides the plane along the airway
 * until the node sits in the middle of the image. It asks for no landmark click and no sweep.
 *
 * `airway-view` (2026-11-10) is the scope lesson's task on the forward-oblique lens: flex the tip
 * down until the lens looks along the airway (the airway ahead sits in the middle of the
 * white-light view and there is no ultrasound image), then up until the lens is on the wall and
 * tissue echoes return.
 */
export const LINKED_VARIANTS = ['guided', 'changed-window', 'along-airway', 'airway-view'] as const
export type LinkedVariant = (typeof LINKED_VARIANTS)[number]
export const LINKED_LESSONS = [
  'scope-orientation',
  'acoustic-contact',
  'ct-map',
  'station-seven',
  'right-paratracheal',
  // Station scans added 2026-11-10: 4L and 2L in the left paratracheal lesson, 11Ri in the
  // hilar and interlobar lesson. Each is a lab of its own, with its own preset and landmarks.
  'left-paratracheal',
  'left-upper-paratracheal',
  'interlobar',
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
  /**
   * Where the target sits across the image, 0 (image left, the tip side) to 1 (image right, the
   * side of the orientation dot); null when it is not in the image. Read from the rendered
   * frame's own label image, never from the pose.
   */
  targetLateral?: number | null
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
  // Structures the learner finds and clicks on the ultrasound image (keys of the acoustic volume's
  // labels). Airway anatomy on the 3D model is assumed knowledge and is not asked.
  'scope-orientation': ['station_7'],
  'acoustic-contact': [],
  'ct-map': ['station_7', 'pulmonary_artery'],
  'station-seven': ['station_7', 'pulmonary_artery', 'esophagus'],
  'right-paratracheal': ['superior_vena_cava', 'azygous', 'station_4r'],
  // 4L between its two vascular boundaries; 2L above the arch; 11Ri by itself, because the
  // vessels beside it are too small in this model's plane to ask for.
  'left-paratracheal': ['aorta', 'pulmonary_artery', 'station_4l'],
  'left-upper-paratracheal': ['aorta', 'station_2l'],
  interlobar: ['station_11ri'],
}
/** The station preset each linked lab scans from. */
export const LINKED_PRESETS: Record<LinkedLesson, string> = {
  'scope-orientation': 'station_7_node_a::rms',
  'acoustic-contact': 'station_7_node_a::rms',
  'ct-map': 'station_7_node_a::rms',
  'station-seven': 'station_7_node_a::rms',
  'right-paratracheal': 'station_4r_node_a::default',
  'left-paratracheal': 'station_4l_node_a::default',
  'left-upper-paratracheal': 'station_2l_node_a::default',
  interlobar: 'station_11ri_node_a::default',
}
export const LANDMARK_NAMES: Record<string, string> = {
  transducer_face: 'transducer surface',
  carina: 'main carina',
  right_main_bronchus: 'right main bronchus',
  left_main_bronchus: 'left main bronchus',
  azygous: 'azygos vein',
  superior_vena_cava: 'superior vena cava',
  left_brachiocephalic_vein: 'left brachiocephalic vein',
  station_7: 'subcarinal node (station 7)',
  station_4r: 'right lower paratracheal node (4R)',
  station_4l: 'left lower paratracheal node (4L)',
  station_2l: 'left upper paratracheal node (2L)',
  station_11ri: 'right interlobar node (11Ri)',
  pulmonary_artery: 'pulmonary artery',
  esophagus: 'esophagus',
  left_atrium: 'left atrium',
  aorta: 'aorta',
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
  station_7:
    'It lies against the airway wall between the two main bronchi. Rotate until a rounded structure with tissue echoes comes into the image; vessels are echo-free.',
  station_4r:
    'It lies beside the lower trachea, behind the superior vena cava and above the azygos arch.',
  pulmonary_artery:
    'It is the large echo-free vessel in front of the subcarinal space. Rotate the plane anteriorly to bring it in.',
  esophagus:
    'It lies behind the subcarinal space and has a layered wall. Rotate the plane posteriorly to bring it in.',
  transducer_face:
    'Look on the scan-facing side of the distal scope, beside the projecting tip. The optical lens has a different direction.',
  carina: 'Follow the trachea to the point where it divides into the two main bronchi.',
  right_main_bronchus:
    'Trace the branch from the carina toward the patient’s right. Use the patient orientation markers, not your screen side.',
  left_main_bronchus:
    'Trace the branch from the carina toward the patient’s left. Observer rotation changes your view, not patient laterality.',
  azygous:
    'It arches over the right main bronchus to join the superior vena cava, at the lower edge of the right paratracheal space.',
  superior_vena_cava:
    'It is the large echo-free vein in front of the right paratracheal space, to the patient’s right of the trachea.',
  left_brachiocephalic_vein:
    'Follow the vein crossing anterior to the upper trachea toward the superior vena cava. The brachiocephalic arterial trunk is a different structure.',
}
/**
 * Hints that depend on the station being scanned. The pulmonary artery beside 4L is the left
 * main pulmonary artery below the node, not the vessel in front of the subcarinal space, and the
 * aorta at these levels is the arch. Each is the lesson's own boundary statement.
 */
export const LANDMARK_HINTS_BY_LESSON: Partial<Record<LinkedLesson, Record<string, string>>> = {
  'left-paratracheal': {
    aorta:
      'The aortic arch is the large echo-free vessel in this window. Its superior border is the upper limit of 4L.',
    pulmonary_artery:
      'The left main pulmonary artery is the other echo-free vessel, below the arch. Its upper rim is the lower limit of 4L.',
    station_4l:
      'It lies left of the trachea, below the superior border of the aortic arch and above the left main pulmonary artery.',
  },
  'left-upper-paratracheal': {
    aorta:
      'The aortic arch is the large echo-free vessel in this window. Its superior border separates 2L from 4L.',
    station_2l: 'It lies left of the trachea, above the superior border of the aortic arch.',
  },
  interlobar: {
    station_11ri:
      'It lies against the airway wall between the middle- and lower-lobe bronchi. Rotate until a small rounded structure with tissue echoes comes into the image.',
  },
}
/**
 * Names that depend on the station being scanned: beside 2L and 4L the aorta in the window is
 * the arch, and the pulmonary artery beside 4L is the left main pulmonary artery. The lessons
 * name them that way, so the task bar does too.
 */
export const LANDMARK_NAMES_BY_LESSON: Partial<Record<LinkedLesson, Record<string, string>>> = {
  'left-paratracheal': { aorta: 'aortic arch', pulmonary_artery: 'left main pulmonary artery' },
  'left-upper-paratracheal': { aorta: 'aortic arch' },
}
/** The name of a structure the learner is asked to find in a given lab. */
export function linkedLandmarkName(lesson: LinkedLesson | undefined, id: string) {
  return (lesson && LANDMARK_NAMES_BY_LESSON[lesson]?.[id]) ?? LANDMARK_NAMES[id]
}
/** The hint for a structure in a given lab: the lab's own where it has one. */
export function linkedLandmarkHint(lesson: LinkedLesson | undefined, id: string) {
  return (lesson && LANDMARK_HINTS_BY_LESSON[lesson]?.[id]) ?? LANDMARK_HINTS[id]
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
/**
 * The advance-and-withdraw task. Authored exercise tolerances for one anatomy model, not clinical
 * thresholds: how far past the node the scope starts, how far it may travel, and how close to
 * the middle of the image the node has to finish. Measured on the station 7 preset from the
 * right main bronchus (2026-11-10): the node's mean column runs from 0.38 of the image width at
 * 10 mm withdrawn to 0.65 at 14 mm advanced, and sits within 0.05 of the middle from about 6 mm
 * withdrawn to 1 mm advanced. Further back than 10 mm the scope is in the trachea and the
 * transducer is off the wall.
 */
export const LINKED_ALONG_AIRWAY = {
  /** Start this far advanced past the station preset: the node sits toward the dot side. */
  startOffsetMm: 12,
  /** How far the scope may be withdrawn from the station preset while keeping wall contact. */
  minOffsetMm: -10,
  /** How far the scope may be advanced past the station preset. */
  maxOffsetMm: 14,
  /** The rotation that holds the node in plane while the scope moves along the airway. */
  roll: 0,
  /** Half-width of "the middle of the image", as a fraction of the image width. */
  centreHalfWidth: 0.05,
} as const
/** Left of the middle, in it, or right of it; `out` when the target is not in the image. */
export type LinkedLateralPosition = 'out' | 'left' | 'centre' | 'right'
export function linkedLateralPosition(lateral: number | null | undefined): LinkedLateralPosition {
  if (typeof lateral !== 'number' || !Number.isFinite(lateral)) return 'out'
  const offset = lateral - 0.5
  if (Math.abs(offset) <= LINKED_ALONG_AIRWAY.centreHalfWidth + 1e-9) return 'centre'
  return offset < 0 ? 'left' : 'right'
}
/**
 * The airway-view task. Authored exercise tolerances for one anatomy model, not clinical
 * thresholds. They are distances from the lens to the first airway wall along the optical axis,
 * measured at the station 7 preset from the right main bronchus with no rotation (2026-11-10):
 * 21 mm at 25° of downward flexion, 14 mm at 10° down, 9 mm with the tip straight, 5.5 mm at 10°
 * up and 3 to 4 mm from 20° up. Contact returns from about 10° up.
 */
export const LINKED_AIRWAY_VIEW = {
  /** At or beyond this the lens is looking along the airway. */
  lumenMinMm: 14,
  /** At or within this the lens is on the wall the transducer faces. */
  wallMaxMm: 6,
  /** Contact index needed for tissue echoes when the tip is back on the wall. */
  minContact: 0.8,
} as const
export type LinkedOpticView = 'lumen' | 'wall' | 'between'
/** What the white-light view is of: the airway ahead, the wall with an image, or neither yet. */
export function linkedOpticView(
  opticalWallMm: number | null | undefined,
  contact: number,
): LinkedOpticView {
  if (typeof opticalWallMm !== 'number' || !Number.isFinite(opticalWallMm)) return 'between'
  if (opticalWallMm >= LINKED_AIRWAY_VIEW.lumenMinMm) return 'lumen'
  if (opticalWallMm <= LINKED_AIRWAY_VIEW.wallMaxMm && contact >= LINKED_AIRWAY_VIEW.minContact)
    return 'wall'
  return 'between'
}
export function linkedSetup(lesson: LinkedLesson, variant: LinkedVariant) {
  if (variant === 'airway-view')
    return { offsetMm: 0, initialRoll: 0, presetKey: 'station_7_node_a::rms' }
  if (variant === 'along-airway')
    return {
      offsetMm: LINKED_ALONG_AIRWAY.startOffsetMm,
      initialRoll: LINKED_ALONG_AIRWAY.roll,
      presetKey:
        lesson === 'right-paratracheal' ? 'station_4r_node_a::default' : 'station_7_node_a::rms',
    }
  // The 2026-11-10 station scans have one position each: the preset, as it is.
  if (
    lesson === 'left-paratracheal' ||
    lesson === 'left-upper-paratracheal' ||
    lesson === 'interlobar'
  )
    return { offsetMm: 0, initialRoll: 85, presetKey: LINKED_PRESETS[lesson] }
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
