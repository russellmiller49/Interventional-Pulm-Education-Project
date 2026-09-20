/** Shared model definitions and deterministic activity transitions. No clinical device calibration. */
import contract from '../../EBUS-course/apps/web/public/simulator/case-001/models/guided-v2/model-contract.json'
export const MODEL_REVISION = contract.revision
export const MODEL_PACKAGES = ['needle', 'contact', 'measurement', 'routes'] as const
export type ModelPackage = (typeof MODEL_PACKAGES)[number]
export const MODEL_STEPS = {
  needle: ['sheath', 'live-tip', 'lost-tip-stop', 'resistance-stop', 'protected-removal'],
  contact: ['gain-gap', 'direct', 'balloon', 'bubble', 'shadow'],
  measurement: [
    'sphere-sweep',
    'ellipsoid-sweep',
    'adjacent-sweep',
    'lobulated-sweep',
    'short-axis-record',
  ],
  routes: ['4L-airway', '4L-esophagus', '7-airway', '7-esophagus', '8-esophagus', 'unsupported'],
} as const
export type Point2 = [number, number]
export type PhantomName = keyof typeof contract.phantoms
export type ContactMode = 'gap' | 'direct' | 'balloon' | 'bubble' | 'shadow'
interface Base {
  package: ModelPackage
  steps: string[]
  actions: number
  notice: string
}
export interface NeedleState extends Base {
  package: 'needle'
  sheath: number
  extension: number
  secured: boolean
  plane: number
  live: boolean
  contact: boolean
  stopped: boolean
  resistance: boolean
  removed: boolean
  held: null | { extension: number; sheath: number; plane: number; contact: boolean }
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
export function initialModelState(pkg: ModelPackage): ModelState {
  const base = { steps: [], actions: 0, notice: '' }
  if (pkg === 'needle')
    return {
      ...base,
      package: pkg,
      sheath: 0,
      extension: 0,
      secured: false,
      plane: 0,
      live: true,
      contact: true,
      stopped: false,
      resistance: false,
      removed: false,
      held: null,
    }
  if (pkg === 'contact') return { ...base, package: pkg, mode: 'gap', gain: 45, inspected: false }
  if (pkg === 'measurement')
    return {
      ...base,
      package: pkg,
      shape: 'sphere',
      offset: -12,
      frozen: false,
      bins: { sphere: [-12], ellipsoid: [], adjacent: [], lobulated: [] },
      calipers: [null, null],
      endpoint: 0,
      axis: 'short',
      station: '',
      record: null,
    }
  return { ...base, package: pkg, station: '4L', route: 'airway' }
}
const add = (steps: string[], step: string) => [...new Set([...steps, step])]
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const needleGeometry = (s: NeedleState) => {
  const d = contract.needle.axis
  const tip = contract.needle.retractedTip.map((p, i) => p + d[i] * (s.extension + s.sheath))
  const outlet = contract.needle.outlet.map((p, i) => p + d[i] * s.sheath)
  const planeDistance = Math.abs(Math.sin((s.plane * Math.PI) / 180) * (tip[0] - outlet[0]))
  return {
    tip,
    outlet,
    axis: d,
    tipVisible: s.extension > 1 && s.contact && planeDistance <= contract.needle.sliceHalfThickness,
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
export function measurePhantom(s: MeasurementState) {
  const [a, b] = s.calipers
  if (!a || !b)
    return { valid: false, value: 0, feedback: 'Place both calipers on the visible borders.' }
  const value = Math.hypot(a[0] - b[0], a[1] - b[1])
  if (!s.frozen)
    return { valid: false, value, feedback: 'Freeze the intended section before measuring.' }
  if (s.shape !== 'ellipsoid' || s.offset !== 0)
    return {
      valid: false,
      value,
      feedback: 'For this record, return to the central section of the elongated phantom.',
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
      feedback:
        'The authored task requests the short axis. A long-axis record does not satisfy it.',
    }
  return {
    valid: borders,
    value,
    feedback: borders
      ? 'Calipers follow the requested central short axis.'
      : 'Reposition the calipers at opposite borders on the short axis. Separated points alone are insufficient.',
  }
}
export const routeDefinition = (s: RouteState) => contract.routes.find((r) => r.id === s.station)
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
  }
  let h = 2166136261
  for (const c of JSON.stringify(pose)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return `${MODEL_REVISION}:${s.package}:${(h >>> 0).toString(16)}`
}
export function modelReducer(state: ModelState, a: ModelAction): ModelState {
  if (a.type === 'reset') return initialModelState(state.package)
  const s = { ...state, actions: state.actions + 1, notice: '' }
  const value = Number(a.value)
  if (s.package === 'needle') {
    if (s.removed)
      return {
        ...s,
        notice: 'Assembly removed with the tip protected. Reset to repeat the exercise.',
      }
    if (a.type === 'sheath') {
      if (s.extension > 0 || s.secured)
        return {
          ...s,
          notice: 'Retract the needle and release the sheath lock before adjusting the sheath.',
        }
      s.sheath = clamp(value, 0, 2)
      if (s.sheath > 0) s.steps = add(s.steps, 'sheath')
    } else if (a.type === 'secure') s.secured = !s.secured
    else if (a.type === 'live') {
      s.live = !s.live
      s.held = s.live
        ? null
        : { extension: s.extension, sheath: s.sheath, plane: s.plane, contact: s.contact }
    } else if (a.type === 'contact') s.contact = !s.contact
    else if (a.type === 'extend') {
      if (!s.secured || s.sheath === 0)
        return {
          ...s,
          notice:
            'Prepare and lock the sheath before exposing the needle in this conceptual assembly.',
        }
      if (!s.live || !s.contact || s.plane !== 0 || s.resistance || s.stopped)
        return {
          ...s,
          notice:
            'Stop. Needle advancement is blocked while live tip guidance is unavailable or resistance requires reassessment.',
        }
      s.extension = clamp(s.extension + 4, 0, contract.needle.maxTravel)
      if (needleGeometry(s).tipVisible) s.steps = add(s.steps, 'live-tip')
    } else if (a.type === 'retract') s.extension = 0
    else if (a.type === 'lost') {
      if (!s.steps.includes('live-tip') || s.extension < 4)
        return { ...s, notice: 'First display the exposed tip with live guidance.' }
      s.plane = 24
      s.stopped = false
      s.notice = 'The imaging plane has changed. Inspect the displayed needle echo before acting.'
    } else if (a.type === 'resistance') {
      s.resistance = true
      s.stopped = false
      s.notice =
        'Resistance is reported by the operator. Choose the next action; this model does not calculate force.'
    } else if (a.type === 'stop') {
      s.stopped = true
      const lostTip = s.plane !== 0 && !needleGeometry(s).tipVisible
      if (lostTip) s.steps = add(s.steps, 'lost-tip-stop')
      if (s.resistance) s.steps = add(s.steps, 'resistance-stop')
      /*
       * The stop that follows a plane change is not the stop that follows resistance, and the
       * model already distinguishes them: it sets `plane` and `resistance` from two different
       * actions and records two different steps. The notice did not — every stop read "do not
       * overcome resistance by adding force", including a stop taken because the tip had left
       * the imaging plane, where no resistance had been reported at all (EBUS-PRE-REVIEW-01,
       * L21-4). Each state now gets the reason already authored for it: the plane-change wording
       * from the `lost` action and the lesson's "stop movement and regain a reliable view", and
       * the resistance wording unchanged. Both together when both are true. The safety
       * predicates, the recorded steps and the block on advancing are untouched.
       */
      s.notice =
        lostTip && s.resistance
          ? 'Advancement stopped with the tip out of the imaging plane and resistance reported. Restore a reliable view of the tip and reassess the assembly with the supervising operator; do not overcome resistance by adding force.'
          : lostTip
            ? 'Advancement stopped. The tip is not identified in the imaging plane: restore the window and regain a reliable view of the tip with the supervising operator before any further movement.'
            : 'Advancement stopped. Reassess the image and assembly with the supervising operator; do not overcome resistance by adding force.'
    } else if (a.type === 'restore') {
      if (!s.stopped)
        return { ...s, notice: 'Stop advancement before restoring this demonstration window.' }
      if (s.resistance)
        return {
          ...s,
          notice:
            'The resistance scenario ends with protected retraction and removal. It does not authorize another pass.',
        }
      s.plane = 0
      s.contact = true
      s.live = true
      s.stopped = false
    } else if (a.type === 'remove') {
      if (s.extension !== 0 || !s.secured)
        return {
          ...s,
          notice:
            'Do not remove an exposed or unsecured needle through the working channel. Retract the needle fully and secure the assembly.',
        }
      s.removed = true
      s.steps = add(s.steps, 'protected-removal')
      s.notice =
        'The needle is protected within the sheath. The assembly has been removed in the model.'
    }
    return s
  }
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
      if (s.bins[s.shape].length === 13) s.steps = add(s.steps, s.shape + '-sweep')
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
        'No measurement recorded. Sweep to a section with adequately visualized borders before placing calipers.'
    else if (a.type === 'record') {
      const m = measurePhantom(s)
      if (!m.valid) return { ...s, notice: m.feedback }
      if (s.station !== 'Phantom station 7')
        return {
          ...s,
          notice:
            'Label this authored example “Phantom station 7” before saving the image. These shapes are not anatomical station boundaries.',
        }
      s.record = {
        label: `${s.station} · elongated phantom · central short axis`,
        value: m.value,
        frameId: modelFrameId(s),
      }
      s.steps = add(s.steps, 'short-axis-record')
      s.notice =
        'Phantom image and measurement recorded. Millimeters refer only to the authored phantom.'
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
      ? 'View compared. The anatomical target has not moved with the approach.'
      : 'This preset is not modeled. Absence of a supported window is not a negative nodal examination.'
  }
  return s
}
export { contract as MODEL_GEOMETRY }
