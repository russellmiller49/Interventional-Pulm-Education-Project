/** Shared model definitions and deterministic activity transitions. No clinical device calibration. */
import contract from '../../EBUS-course/apps/web/public/simulator/case-001/models/guided-v2/model-contract.json'
export const MODEL_REVISION = contract.revision
export const MODEL_PACKAGES = ['needle', 'contact', 'measurement', 'routes'] as const
export type ModelPackage = (typeof MODEL_PACKAGES)[number]
export const MODEL_STEPS = {
  /*
   * The needle lab is worked by the learner's own hand, in the order of a pass (rebuild of
   * 2026-11-11): sheath out and locked, stop set to the far side of the node, needle into the node
   * with its tip in the image, the tip turned out of the image and brought back, movements within
   * the node, then the needle back in its sheath and the assembly out.
   */
  needle: ['sheath', 'stop', 'in-node', 'tip-recovered', 'agitate', 'protected-removal'],
  contact: ['gain-gap', 'direct', 'balloon', 'bubble', 'shadow'],
  // One sweep and one measurement, both on the elongated shape. The other shapes are optional.
  measurement: ['ellipsoid-sweep', 'short-axis-record'],
  routes: ['4L-airway', '4L-esophagus', '7-airway', '7-esophagus', '8-esophagus', 'unsupported'],
} as const
export type Point2 = [number, number]
export type PhantomName = keyof typeof contract.phantoms
export const CONTACT_MODES = ['gap', 'direct', 'balloon', 'bubble', 'shadow'] as const
export type ContactMode = (typeof CONTACT_MODES)[number]
/** How each modelled acoustic-contact condition is named to a learner. */
export const CONTACT_MODE_LABELS: Record<ContactMode, string> = {
  gap: 'air gap',
  direct: 'direct contact',
  balloon: 'fluid-balloon contact',
  bubble: 'balloon with a bubble',
  shadow: 'contact with a reflector',
}
interface Base {
  package: ModelPackage
  steps: string[]
  actions: number
  notice: string
}
export interface NeedleState extends Base {
  package: 'needle'
  /** Millimetres the sheath is brought out of the channel: 0 is inside it. */
  sheath: number
  /** The sheath lock. */
  secured: boolean
  /** The needle stop: the travel the needle is allowed, in millimetres. 0 is not set. */
  stop: number
  /** Millimetres of needle beyond the sheath. */
  extension: number
  /** Scope rotation off the needle path, in degrees. */
  plane: number
  /** The learner has turned the tip out of the image with the needle out. */
  tipLost: boolean
  /** Completed back-and-forth movements within the node. */
  movements: number
  movementsNeeded: number
  stroke: 'idle' | 'deep' | 'back'
  removed: boolean
}
export interface ContactState extends Base {
  package: 'contact'
  mode: ContactMode
  gain: number
  inspected: boolean
}
export interface MeasurementState extends Base {
  package: 'measurement'
  shape: PhantomName
  offset: number
  frozen: boolean
  bins: Record<PhantomName, number[]>
  calipers: [Point2 | null, Point2 | null]
  endpoint: 0 | 1
  axis: 'short' | 'long'
  station: string
  record: null | { label: string; value: number; frameId: string }
}
export interface RouteState extends Base {
  package: 'routes'
  station: string
  route: 'airway' | 'esophagus'
}
export type ModelState = NeedleState | ContactState | MeasurementState | RouteState
export interface ModelAction {
  type: string
  value?: string | number | Point2
}
const add = (steps: string[], step: string) => [...new Set([...steps, step])]
const drop = (steps: string[], step: string) => steps.filter((entry) => entry !== step)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
/** What a lesson can set on a model activity. Only the needle lab takes any. */
export interface ModelOptions {
  /** Movements within the node the needle lab asks for; the lesson passes its sourced number. */
  needleMovements?: number
}
export function initialModelState(pkg: ModelPackage, options: ModelOptions = {}): ModelState {
  const base = { steps: [], actions: 0, notice: '' }
  if (pkg === 'needle')
    return {
      ...base,
      package: pkg,
      sheath: 0,
      secured: false,
      stop: 0,
      extension: 0,
      plane: 0,
      tipLost: false,
      movements: 0,
      movementsNeeded: clamp(Math.round(options.needleMovements ?? 5), 1, 20),
      stroke: 'idle',
      removed: false,
    }
  if (pkg === 'contact') return { ...base, package: pkg, mode: 'gap', gain: 45, inspected: false }
  if (pkg === 'measurement')
    return {
      ...base,
      package: pkg,
      shape: 'ellipsoid',
      offset: -12,
      frozen: false,
      bins: { sphere: [], ellipsoid: [-12], adjacent: [], lobulated: [] },
      calipers: [null, null],
      endpoint: 0,
      axis: 'short',
      station: '',
      record: null,
    }
  return { ...base, package: pkg, station: '4L', route: 'airway' }
}
/**
 * What the needle lab draws around the needle, in the model's own millimetres (x along the scope,
 * distal positive; y into the tissue). The 3D view places its node and vessel on these same
 * sections, so the ultrasound picture and the model cannot disagree. Teaching geometry: the node
 * lies on the needle path and a vessel lies beyond its far side, which is what the needle stop is
 * for. None of it is a depth for a patient.
 */
export const NEEDLE_LAB = {
  node: { cx: 1.25, cy: 15.5, rx: 6, ry: 4.5 },
  vessel: { cx: 6.3, cy: 24.2, r: 3 },
  /** The tissue side of the airway wall. */
  wallOuter: 9.7,
  /** The ultrasound sector: a fan from a point above the transducer face. */
  fan: { cx: 2, cy: -6, near: 13, far: 48, halfAngle: 32 },
  maxRotation: 8,
  /** How far short of the far side of the node a stop may be set and still be "at the far side". */
  stopShortMm: 3,
  /** The slack allowed at a border, so a whole-millimetre setting can sit on it. */
  borderMm: 0.3,
} as const
const NEEDLE_START = contract.needle.retractedTip
const NEEDLE_AXIS = contract.needle.axis
/** Distances along the needle path, from the retracted tip, at which it crosses something. */
function crossings(cx: number, cy: number, rx: number, ry: number): [number, number] | null {
  const px = (NEEDLE_START[0] - cx) / rx,
    py = (NEEDLE_START[1] - cy) / ry
  const dx = NEEDLE_AXIS[0] / rx,
    dy = NEEDLE_AXIS[1] / ry
  const a = dx * dx + dy * dy,
    b = 2 * (px * dx + py * dy),
    c = px * px + py * py - 1
  const disc = b * b - 4 * a * c
  if (disc <= 0) return null
  const root = Math.sqrt(disc)
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
}
const NODE_CROSSING = crossings(
  NEEDLE_LAB.node.cx,
  NEEDLE_LAB.node.cy,
  NEEDLE_LAB.node.rx,
  NEEDLE_LAB.node.ry,
)!
const VESSEL_CROSSING = crossings(
  NEEDLE_LAB.vessel.cx,
  NEEDLE_LAB.vessel.cy,
  NEEDLE_LAB.vessel.r,
  NEEDLE_LAB.vessel.r,
)!
/**
 * Where the needle path meets the node and the vessel, measured as the learner reads it: in
 * millimetres of needle beyond the sheath, for the sheath position in this state.
 */
export function needlePath(s: Pick<NeedleState, 'sheath'>) {
  const fromSheath = (t: number) => t - s.sheath
  return {
    wall: fromSheath((NEEDLE_LAB.wallOuter - NEEDLE_START[1]) / NEEDLE_AXIS[1]),
    nodeNear: fromSheath(NODE_CROSSING[0]),
    nodeFar: fromSheath(NODE_CROSSING[1]),
    vessel: fromSheath(VESSEL_CROSSING[0]),
  }
}
/** The stop settings that put the limit of travel at the far side of the node. */
export function needleStopWindow(s: Pick<NeedleState, 'sheath'>) {
  const far = needlePath(s).nodeFar
  return {
    min: Math.ceil(far - NEEDLE_LAB.stopShortMm),
    max: Math.floor(far + NEEDLE_LAB.borderMm),
  }
}
export const needleStopValid = (s: Pick<NeedleState, 'sheath' | 'stop'>) => {
  const window = needleStopWindow(s)
  return s.stop >= window.min && s.stop <= window.max
}
export type NeedleTipPlace = 'sheath' | 'wall' | 'before-node' | 'node' | 'beyond-node' | 'vessel'
/** Which structure the true tip is in, whatever the image shows. */
export function needleTipPlace(s: Pick<NeedleState, 'sheath' | 'extension'>): NeedleTipPlace {
  const path = needlePath(s)
  if (s.extension <= 0) return 'sheath'
  if (s.extension >= path.vessel) return 'vessel'
  if (s.extension > path.nodeFar + NEEDLE_LAB.borderMm) return 'beyond-node'
  if (s.extension >= path.nodeNear + NEEDLE_LAB.borderMm) return 'node'
  if (s.extension > path.wall) return 'before-node'
  return 'wall'
}
/** How far the point of the needle at a given extension lies from the imaging plane. */
const planeOffset = (s: Pick<NeedleState, 'plane'>, extension: number) =>
  Math.abs(Math.sin((s.plane * Math.PI) / 180) * (NEEDLE_AXIS[0] * extension - 0.5))
/** Whether the tip would be in the image with the needle at this extension. */
export const needleTipInPlane = (s: Pick<NeedleState, 'plane'>, extension: number) =>
  planeOffset(s, extension) <= contract.needle.sliceHalfThickness
export const needleGeometry = (s: NeedleState) => {
  const d = contract.needle.axis
  const tip = contract.needle.retractedTip.map((p, i) => p + d[i] * (s.extension + s.sheath))
  const outlet = contract.needle.outlet.map((p, i) => p + d[i] * s.sheath)
  const planeDistance = Math.abs(Math.sin((s.plane * Math.PI) / 180) * (tip[0] - outlet[0]))
  return {
    tip,
    outlet,
    axis: d,
    tipVisible: s.extension > 1 && planeDistance <= contract.needle.sliceHalfThickness,
    /** The needle is out and its tip is not in the image: what remains on screen is shaft. */
    tipLost: s.extension > 1 && planeDistance > contract.needle.sliceHalfThickness,
    planeDistance,
  }
}
export function phantomSections(shape: PhantomName, offset: number) {
  return contract.phantoms[shape].flatMap(({ center, radii }) => {
    const scale2 = 1 - ((offset - center[2]) / radii[2]) ** 2
    return scale2 <= 0
      ? []
      : [
          {
            x: center[0],
            y: center[1],
            rx: radii[0] * Math.sqrt(scale2),
            ry: radii[1] * Math.sqrt(scale2),
          },
        ]
  })
}
/**
 * The model's own reference for the plane that is currently displayed
 * (EBUS-PRE-REVIEW-02, L9-2 / L9-3 / L10-1).
 *
 * The phantoms are analytic, so the section through the current plane, its axes and its
 * dimensions are all derivable exactly — no assumed full-object diameter, no measurement of the
 * picture, and nothing carried over from another plane. It is a model reference in authored
 * phantom millimetres and says nothing about a patient image or a clinical border.
 *
 * `axisMm` and `idealCalipers` exist only where one section is in the plane; where the plane cuts
 * two objects there is no single short or long axis and the caller is told so rather than shown a
 * number that means nothing.
 */
export interface PhantomPlaneReference {
  objects: number
  sections: ReturnType<typeof phantomSections>
  shortAxisMm: number | null
  longAxisMm: number | null
  axisMm: number | null
  idealCalipers: [Point2, Point2] | null
}
export function phantomPlaneReference(s: MeasurementState): PhantomPlaneReference {
  const sections = phantomSections(s.shape, s.offset)
  const single = sections.length === 1 ? sections[0] : null
  const shortAxisMm = single ? single.ry * 2 : null
  const longAxisMm = single ? single.rx * 2 : null
  return {
    objects: sections.length,
    sections,
    shortAxisMm,
    longAxisMm,
    axisMm: s.axis === 'short' ? shortAxisMm : longAxisMm,
    idealCalipers: !single
      ? null
      : s.axis === 'short'
        ? [
            [single.x, single.y - single.ry],
            [single.x, single.y + single.ry],
          ]
        : [
            [single.x - single.rx, single.y],
            [single.x + single.rx, single.y],
          ],
  }
}
/** The plane and shape the recorded short-axis task asks for, so it can be offered directly. */
export const PHANTOM_RECOMMENDED_COMPARISON = { shape: 'ellipsoid' as PhantomName, offset: 0 }
export function measurePhantom(s: MeasurementState) {
  const [a, b] = s.calipers
  if (!a || !b)
    return {
      valid: false,
      value: 0,
      feedback: 'Freeze the section, then click the top and bottom borders to place two calipers.',
    }
  const value = Math.hypot(a[0] - b[0], a[1] - b[1])
  if (!s.frozen)
    return { valid: false, value, feedback: 'Freeze the intended section before measuring.' }
  if (s.shape !== 'ellipsoid' || s.offset !== 0)
    return {
      valid: false,
      value,
      feedback: 'Measure the elongated shape at plane offset 0, its central section.',
    }
  const section = phantomSections('ellipsoid', 0)[0]
  const expected: Point2[] =
    s.axis === 'short'
      ? [
          [section.x, section.y - section.ry],
          [section.x, section.y + section.ry],
        ]
      : [
          [section.x - section.rx, section.y],
          [section.x + section.rx, section.y],
        ]
  const distance = (p: Point2, q: Point2) => Math.hypot(p[0] - q[0], p[1] - q[1])
  const borders =
    Math.min(
      Math.max(distance(a, expected[0]), distance(b, expected[1])),
      Math.max(distance(a, expected[1]), distance(b, expected[0])),
    ) <= 1.25
  if (s.axis !== 'short')
    return {
      valid: false,
      value,
      feedback: 'This task asks for the short axis, not the long axis.',
    }
  return {
    valid: borders,
    value,
    feedback: borders
      ? 'Calipers follow the requested central short axis.'
      : 'Put one caliper on the top border and one on the bottom border of the shape, straight across its short axis.',
  }
}
export const routeDefinition = (s: RouteState) => contract.routes.find((r) => r.id === s.station)
/**
 * What one recorded route comparison was (EBUS-PRE-REVIEW-04, L19-2).
 *
 * Every supported comparison used to return the same sentence, so six presses of "Record
 * comparison" read identically. The notice now names which view was recorded and how many of the
 * supported views are done, and keeps the one statement that is true of all of them — the target
 * and the surrounding anatomy do not move; the locator and viewing direction do (the lesson's own
 * teaching). No view-specific anatomy is added: the lesson has no per-view statement to draw on.
 * Messages are excluded from `modelFrameId`, so no acquisition identity changes.
 */
function routeComparisonNotice(s: RouteState) {
  const target = s.station === '8' ? 'the lower paraesophageal example (8)' : s.station + ' example'
  const view = s.route === 'airway' ? 'airway (EBUS) view' : 'esophageal (EUS-B) view'
  const supported = MODEL_STEPS.routes.filter((step) => step !== 'unsupported')
  const done = supported.filter((step) => s.steps.includes(step)).length
  return (
    'Recorded: the ' +
    view +
    ' of ' +
    target +
    '. The target and the surrounding anatomy stay where they were; only the locator and viewing direction change. ' +
    done +
    ' of ' +
    supported.length +
    ' supported views recorded.'
  )
}
export const routeSupported = (s: RouteState) =>
  !!routeDefinition(s)?.[s.route === 'airway' ? 'airway' : 'esophageal']
export function modelComplete(s: ModelState) {
  if (!(MODEL_STEPS[s.package] as readonly string[]).every((step) => s.steps.includes(step)))
    return false
  if (s.package === 'needle') return s.removed && s.extension === 0 && s.secured
  if (s.package === 'measurement') return !!s.record && s.frozen
  return true
}
export function modelFrameId(s: ModelState) {
  // Excludes teaching reveal, observer camera, hover, messages and activity history.
  const pose = {
    ...s,
    steps: undefined,
    bins: undefined,
    actions: undefined,
    notice: undefined,
    record: undefined,
    // The needle lab's history of the pass is not part of the pose either.
    tipLost: undefined,
    movements: undefined,
    movementsNeeded: undefined,
    stroke: undefined,
  }
  let h = 2166136261
  for (const c of JSON.stringify(pose)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return `${MODEL_REVISION}:${s.package}:${(h >>> 0).toString(16)}`
}
/**
 * The needle lab (rebuild of 2026-11-11). Every action is one the operator makes on the handle or
 * the scope; nothing happens to the learner. The rules the earlier model enforced are kept: the
 * needle does not leave an unlocked sheath, it is not advanced while its tip is out of the image,
 * and the assembly does not come out with the needle exposed. Credit is given only along that
 * path, and a stop set too long is never credited.
 */
function needleReducer(s: NeedleState, a: ModelAction): NeedleState {
  const value = Number(a.value)
  const say = (notice: string): NeedleState => ({ ...s, notice })
  if (s.removed)
    return say(
      'The assembly is out of the scope with the needle inside its sheath. Reset to repeat the pass.',
    )
  if (a.type === 'sheath') {
    if (s.extension > 0) return say('Retract the needle before moving the sheath.')
    if (s.secured) return say('Release the sheath lock before moving the sheath.')
    s.sheath = clamp(Math.round(value), 0, 2)
    s.steps = drop(s.steps, 'sheath')
    if (s.stop > 0) s.steps = needleStopValid(s) ? add(s.steps, 'stop') : drop(s.steps, 'stop')
    return s
  }
  if (a.type === 'secure') {
    if (s.extension > 0) return say('Retract the needle before releasing the sheath lock.')
    s.secured = !s.secured
    if (s.secured && s.sheath > 0) s.steps = add(s.steps, 'sheath')
    else s.steps = drop(s.steps, 'sheath')
    if (s.secured && s.sheath === 0)
      s.notice =
        'The sheath is locked inside the channel. Release the lock and bring the sheath out until it is seen beyond the scope tip.'
    return s
  }
  if (a.type === 'stop') {
    if (s.extension > 0) return say('Retract the needle before moving the stop.')
    s.stop = clamp(Math.round(value), 0, contract.needle.maxTravel)
    const window = needleStopWindow(s)
    if (needleStopValid(s)) s.steps = add(s.steps, 'stop')
    else {
      s.steps = drop(s.steps, 'stop')
      if (s.stop > window.max)
        s.notice =
          'With the stop here the needle can pass the far side of the node, toward the vessel. Read the depth to the far border on the needle path and set the stop to it.'
      else if (s.stop > 0)
        s.notice =
          'The stop is short of the far side of the node. Read the depth to the far border on the needle path and set the stop to it.'
    }
    return s
  }
  if (a.type === 'rotate') {
    s.plane = clamp(Math.round(value), -NEEDLE_LAB.maxRotation, NEEDLE_LAB.maxRotation)
    const g = needleGeometry(s)
    if (g.tipLost) {
      s.tipLost = true
      s.notice =
        'The tip has left the image. The bright line that remains is shaft. Do not advance: turn the scope back until the tip returns.'
    } else if (s.tipLost && g.tipVisible) {
      s.tipLost = false
      if (needleTipPlace(s) === 'node') s.steps = add(s.steps, 'tip-recovered')
      s.notice = 'The tip is back in the image.'
    }
    return s
  }
  if (a.type === 'needle') {
    const target = clamp(Math.round(value), 0, contract.needle.maxTravel)
    if (target > s.extension) {
      if (!s.secured || s.sheath === 0)
        return say('Bring the sheath out and lock it before the needle leaves the sheath.')
      if (s.stop === 0) return say('Set the needle stop before advancing the needle.')
      if (needleGeometry(s).tipLost)
        return say(
          'The tip is not in the image. Do not advance: bring the tip back with small rotations of the scope.',
        )
      const next = Math.min(target, s.stop)
      if (next > 1 && !needleTipInPlane(s, next))
        return say(
          'The scope is turned off the needle path, so the tip would not be seen. Turn the scope back before advancing.',
        )
      if (next === s.extension) return say('The needle is at the stop.')
      s.extension = next
      if (target > s.stop) s.notice = 'The needle is at the stop.'
    } else s.extension = target
    const place = needleTipPlace(s)
    const visible = needleGeometry(s).tipVisible
    if (place === 'vessel')
      s.notice =
        'The tip is at the vessel beyond the node. Retract the needle. The stop was set too long.'
    else if (place === 'beyond-node')
      s.notice =
        'The tip is past the far side of the node, toward the vessel. Retract the needle. The stop was set too long.'
    else if (place === 'node' && visible && needleStopValid(s)) s.steps = add(s.steps, 'in-node')
    else if (s.extension === s.stop && s.stop > 0 && !needleStopValid(s))
      s.notice =
        'The needle is at the stop, short of the far side of the node. Retract it and set the stop to the far side.'
    // A movement is the tip carried from the stop back toward the near side of the node and to
    // the stop again, in the image throughout and without leaving the node.
    if (!visible && place === 'node') s.stroke = 'idle'
    else if (place !== 'node' || !s.steps.includes('in-node')) {
      if (
        s.stroke !== 'idle' &&
        s.extension > 0 &&
        place !== 'node' &&
        !s.steps.includes('agitate')
      )
        s.notice =
          'The tip came out of the node. Keep the tip within the node as you move the needle.'
      s.stroke = 'idle'
    } else if (s.extension >= s.stop - 1) {
      if (s.stroke === 'back') {
        s.movements += 1
        if (s.movements >= s.movementsNeeded) s.steps = add(s.steps, 'agitate')
      }
      s.stroke = 'deep'
    } else if (s.stroke === 'deep' && s.extension <= s.stop - 4) s.stroke = 'back'
    return s
  }
  if (a.type === 'remove') {
    if (s.extension !== 0 || !s.secured)
      return say(
        'Do not remove an exposed or unsecured needle through the working channel. Retract the needle fully and keep the sheath locked.',
      )
    s.removed = true
    s.steps = add(s.steps, 'protected-removal')
    s.notice = 'The needle is inside its sheath and the assembly is out of the scope.'
  }
  return s
}
export function modelReducer(state: ModelState, a: ModelAction): ModelState {
  if (a.type === 'reset')
    return initialModelState(
      state.package,
      state.package === 'needle' ? { needleMovements: state.movementsNeeded } : {},
    )
  const s = { ...state, actions: state.actions + 1, notice: '' }
  const value = Number(a.value)
  if (s.package === 'needle') return needleReducer(s, a)
  if (s.package === 'contact') {
    if (a.type === 'gain') {
      s.gain = clamp(value, 0, 100)
      if (s.mode === 'gap' && s.gain >= 75) s.steps = add(s.steps, 'gain-gap')
    }
    if (
      a.type === 'mode' &&
      ['gap', 'direct', 'balloon', 'bubble', 'shadow'].includes(String(a.value))
    ) {
      s.mode = a.value as ContactMode
      s.inspected = false
    }
    if (a.type === 'inspect') {
      s.inspected = true
      if (s.mode !== 'gap') s.steps = add(s.steps, s.mode)
      s.notice =
        s.mode === 'gap'
          ? 'The transducer remains separated from the wall. Gain has not restored tissue echoes.'
          : s.mode === 'bubble'
            ? 'A focal interruption persists despite a fluid balloon. Balloon inflation alone does not guarantee coupling.'
            : s.mode === 'shadow'
              ? 'Contact is present. Reduced echoes deep to a strong reflector persist when gain changes.'
              : 'Tissue echoes are present through this authored contact window.'
    }
    return s
  }
  if (s.package === 'measurement') {
    if (a.type === 'shape' && Object.keys(contract.phantoms).includes(String(a.value))) {
      s.shape = a.value as PhantomName
      s.offset = -12
      s.frozen = false
      s.calipers = [null, null]
      s.record = null
      s.bins = { ...s.bins, [s.shape]: [...new Set([...s.bins[s.shape], -12])] }
    } else if (a.type === 'offset' && !s.frozen) {
      s.offset = clamp(Math.round(value / 2) * 2, -12, 12)
      s.calipers = [null, null]
      s.record = null
      s.bins = { ...s.bins, [s.shape]: [...new Set([...s.bins[s.shape], s.offset])] }
      // A sweep is the shape carried from one edge of the plane range to the other.
      const visited = s.bins[s.shape]
      if (s.shape === 'ellipsoid' && Math.min(...visited) <= -8 && Math.max(...visited) >= 8)
        s.steps = add(s.steps, 'ellipsoid-sweep')
    } else if (a.type === 'freeze') {
      s.frozen = !s.frozen
      s.record = null
    } else if (a.type === 'endpoint') s.endpoint = value === 1 ? 1 : 0
    else if (a.type === 'caliper' && s.frozen && Array.isArray(a.value)) {
      s.calipers = [...s.calipers]
      s.calipers[s.endpoint] = [clamp(a.value[0], -30, 30), clamp(a.value[1], 0, 46)]
      s.endpoint = s.endpoint === 0 ? 1 : 0
      s.record = null
    } else if (a.type === 'axis' && (a.value === 'short' || a.value === 'long')) {
      s.axis = a.value
      s.record = null
    } else if (a.type === 'station') {
      s.station = String(a.value)
      s.record = null
    } else if (a.type === 'inadequate')
      s.notice =
        'No measurement recorded. Sweep to a section with clear borders before placing calipers.'
    else if (a.type === 'record') {
      const m = measurePhantom(s)
      if (!m.valid) return { ...s, notice: m.feedback }
      s.record = {
        label: 'Elongated phantom · central short axis',
        value: m.value,
        frameId: modelFrameId(s),
      }
      s.steps = add(s.steps, 'short-axis-record')
      s.notice = 'Measurement recorded: the short axis of the central section.'
    }
    return s
  }
  if (a.type === 'station' && ['4L', '7', '8', '9', '11R', '4R'].includes(String(a.value)))
    s.station = String(a.value)
  if (a.type === 'route' && (a.value === 'airway' || a.value === 'esophagus')) s.route = a.value
  if (a.type === 'inspect') {
    if (routeSupported(s)) s.steps = add(s.steps, `${s.station}-${s.route}`)
    else s.steps = add(s.steps, 'unsupported')
    s.notice = routeSupported(s)
      ? routeComparisonNotice(s)
      : 'This window is not included in the model. A window you could not obtain is not a negative nodal examination.'
  }
  return s
}
export { contract as MODEL_GEOMETRY }
