import { kitModel } from '../../content/deviceExplorerCatalogue'
import {
  add,
  applyPose,
  band,
  clamp01,
  composePose,
  dot,
  IDENTITY,
  length,
  lerp,
  lerpVec,
  normalize,
  type Pose,
  quatBetween,
  quatFromAxisAngle,
  scale,
  smoothstep,
  sub,
  type Vec3,
} from './vector'

/**
 * The explorer's assembly: a flexible sleeve, the operative telescope and the double-spoon forceps,
 * put together by their anchors rather than by eye. Everything is a pure function of time, so the
 * sequence can be played, paused and scrubbed in either direction and always shows the same state
 * for the same moment.
 *
 * Frame: the telescope's device frame with the telescope fully inserted (millimetres; −Z distal
 * along the shaft, +Y from the channel toward the optic). The sleeve stays where it sits on the
 * seated telescope; the telescope and the forceps travel along their axes to reach it.
 *
 * The relationships, each read from the committed kit manifest:
 * - sleeve.lumenAxis onto telescope.shaftAxis (coaxial), and sleeve.distalEnd at the measured seat
 *   along that axis;
 * - telescope.distalFace travels through sleeve.proximalEnd and sleeve.distalEnd;
 * - forceps.handleFront onto telescope.channelEntry (position and direction) when fully inserted;
 * - forceps.toolTip travels from telescope.channelEntry to telescope.channelExit;
 * - forceps.workingElement past telescope.channelExit before the jaws may open;
 * - the jaws turn about forceps.jawHinge, together through jawOpeningDeg.
 *
 * Only placement is authored here: where a part waits before it moves, and how long each step
 * takes. Those are presentation choices and say so.
 */

export interface Anchor {
  readonly position: Vec3
  readonly direction: Vec3
}

export function kitAnchor(modelId: string, name: string): Anchor {
  const anchor = kitModel(modelId).anchors[name]
  if (!anchor) throw new Error(`${modelId} has no anchor ${name}`)
  return { position: anchor.position, direction: anchor.direction }
}

/** The anchors the assembly is built from, read from the committed kit manifest. */
export interface AssemblyAnchors {
  readonly telescope: {
    readonly distalFace: Anchor
    readonly shaftAxis: Anchor
    readonly channelEntry: Anchor
    readonly channelExit: Anchor
  }
  readonly sleeve: {
    readonly distalEnd: Anchor
    readonly lumenAxis: Anchor
    readonly proximalEnd: Anchor
  }
  readonly forceps: {
    readonly handleFront: Anchor
    readonly sheathEnd: Anchor
    readonly toolTip: Anchor
    readonly workingElement: Anchor
    readonly jawHinge: Anchor
  }
}

export function kitAssemblyAnchors(): AssemblyAnchors {
  const telescope = (name: string) => kitAnchor('operative-telescope', name)
  const sleeve = (name: string) => kitAnchor('trocar-sleeve-flexible', name)
  const forceps = (name: string) => kitAnchor('double-spoon-forceps', name)
  return {
    telescope: {
      distalFace: telescope('distalFace'),
      shaftAxis: telescope('shaftAxis'),
      channelEntry: telescope('channelEntry'),
      channelExit: telescope('channelExit'),
    },
    sleeve: {
      distalEnd: sleeve('distalEnd'),
      lumenAxis: sleeve('lumenAxis'),
      proximalEnd: sleeve('proximalEnd'),
    },
    forceps: {
      handleFront: forceps('handleFront'),
      sheathEnd: forceps('sheathEnd'),
      toolTip: forceps('toolTip'),
      workingElement: forceps('workingElement'),
      jawHinge: forceps('jawHinge'),
    },
  }
}

/** The forceps' full opening, both jaws together, from the kit manifest (a derived measurement). */
export function kitJawOpeningDeg(): number {
  const extras = kitModel('double-spoon-forceps').extras as { jawOpeningDeg?: number }
  if (typeof extras?.jawOpeningDeg !== 'number') throw new Error('No jaw opening in the kit')
  return extras.jawOpeningDeg
}

/** Presentation choices: clearances and approach offsets. Not device geometry. */
export const PRESENTATION = {
  /** How far behind the sleeve's cap the telescope's distal face waits once aligned. */
  telescopeClearanceMm: 40,
  /** How far behind the channel entry the jaw tips wait once aligned. */
  forcepsClearanceMm: 30,
  /** Where a part starts before it is aligned: further back, off the axis and tilted. */
  telescopeApproach: { backMm: 70, offset: [0, 55, 0] as Vec3, tiltDeg: 9 },
  forcepsApproach: { backMm: 70, offset: [0, -45, 0] as Vec3, tiltDeg: -7 },
  /** The sleeve rises this far as it appears. */
  sleeveDropMm: 22,
} as const

export interface AssemblyGeometry {
  readonly anchors: AssemblyAnchors
  /** The sleeve's distal end from the telescope's distal face, along the shaft axis. */
  readonly sleeveSeatMm: number
  readonly jawOpeningDeg: number
  /** Where the sleeve sits, in the assembly frame. */
  readonly sleevePose: Pose
  /** The forceps fully inserted, in the telescope's frame. */
  readonly forcepsSeatedPose: Pose
  /** Unit vector the telescope travels along as it goes in (distal). */
  readonly telescopeInsertion: Vec3
  /** Unit vector the forceps travels along as it goes in (distal). */
  readonly forcepsInsertion: Vec3
  /** How far the telescope is drawn back at each landmark of its travel (0 = fully inserted). */
  readonly telescopeWithdrawal: {
    readonly aligned: number
    readonly tipAtSleeveCap: number
    readonly tipAtSleeveEnd: number
  }
  /** How far the forceps is drawn back at each landmark of its travel (0 = fully inserted). */
  readonly forcepsWithdrawal: {
    readonly aligned: number
    readonly tipAtChannelEntry: number
    readonly tipAtChannelExit: number
    readonly workingElementAtChannelExit: number
  }
  /** How far the sheath's end stands beyond the distal face when fully inserted (derived). */
  readonly sheathBeyondDistalFaceMm: number
}

/**
 * How far to draw a part back along `insertion` so that `point` (already placed) lands on the
 * plane through `target` square to the axis.
 */
function withdrawalToReach(point: Vec3, target: Vec3, insertion: Vec3): number {
  return dot(sub(point, target), insertion)
}

export function assemblyGeometry(
  anchors: AssemblyAnchors,
  sleeveSeatMm: number,
  jawOpeningDeg: number,
): AssemblyGeometry {
  const { telescope, sleeve, forceps } = anchors
  const shaft = normalize(telescope.shaftAxis.direction)
  const telescopeInsertion = scale(shaft, -1)

  // The sleeve: its lumen axis on the shaft axis, its distal end at the seat.
  const sleeveRotation = quatBetween(sleeve.lumenAxis.direction, shaft)
  const seatPoint = add(telescope.distalFace.position, scale(shaft, sleeveSeatMm))
  const sleevePose: Pose = {
    quaternion: sleeveRotation,
    position: sub(
      seatPoint,
      applyPose({ position: [0, 0, 0], quaternion: sleeveRotation }, sleeve.distalEnd.position),
    ),
  }
  const sleeveCap = applyPose(sleevePose, sleeve.proximalEnd.position)
  const sleeveEnd = applyPose(sleevePose, sleeve.distalEnd.position)

  // The forceps: its handle front on the channel entry, facing the way a tool enters.
  const forcepsInsertion = normalize(telescope.channelEntry.direction)
  const forcepsRotation = quatBetween(forceps.handleFront.direction, forcepsInsertion)
  const forcepsSeatedPose: Pose = {
    quaternion: forcepsRotation,
    position: sub(
      telescope.channelEntry.position,
      applyPose({ position: [0, 0, 0], quaternion: forcepsRotation }, forceps.handleFront.position),
    ),
  }
  const seated = (anchor: Anchor) => applyPose(forcepsSeatedPose, anchor.position)

  const tipAtSleeveCap = withdrawalToReach(
    telescope.distalFace.position,
    sleeveCap,
    telescopeInsertion,
  )
  const tipAtChannelEntry = withdrawalToReach(
    seated(forceps.toolTip),
    telescope.channelEntry.position,
    forcepsInsertion,
  )
  return {
    anchors,
    sleeveSeatMm,
    jawOpeningDeg,
    sleevePose,
    forcepsSeatedPose,
    telescopeInsertion,
    forcepsInsertion,
    telescopeWithdrawal: {
      aligned: tipAtSleeveCap + PRESENTATION.telescopeClearanceMm,
      tipAtSleeveCap,
      tipAtSleeveEnd: withdrawalToReach(
        telescope.distalFace.position,
        sleeveEnd,
        telescopeInsertion,
      ),
    },
    forcepsWithdrawal: {
      aligned: tipAtChannelEntry + PRESENTATION.forcepsClearanceMm,
      tipAtChannelEntry,
      tipAtChannelExit: withdrawalToReach(
        seated(forceps.toolTip),
        telescope.channelExit.position,
        forcepsInsertion,
      ),
      workingElementAtChannelExit: withdrawalToReach(
        seated(forceps.workingElement),
        telescope.channelExit.position,
        forcepsInsertion,
      ),
    },
    sheathBeyondDistalFaceMm: dot(
      sub(seated(forceps.sheathEnd), telescope.distalFace.position),
      forcepsInsertion,
    ),
  }
}

/**
 * The state of the assembly, as numbers that blend: visibility 0–1, approach 0 (waiting off the
 * axis) to 1 (aligned), withdrawal in millimetres (0 = fully inserted), jaws 0 closed to 1 open.
 */
export interface AssemblyParams {
  readonly sleeveVisible: number
  readonly sleeveRise: number
  readonly telescopeVisible: number
  readonly telescopeApproach: number
  readonly telescopeWithdrawalMm: number
  readonly forcepsVisible: number
  readonly forcepsApproach: number
  readonly forcepsWithdrawalMm: number
  readonly jawOpen: number
}

export function blendParams(a: AssemblyParams, b: AssemblyParams, t: number): AssemblyParams {
  const k = clamp01(t)
  const out = {} as Record<keyof AssemblyParams, number>
  for (const key of Object.keys(a) as (keyof AssemblyParams)[]) out[key] = lerp(a[key], b[key], k)
  return out
}

export type AssemblyStepId =
  | 'sleeve'
  | 'telescope-aligns'
  | 'telescope-advances'
  | 'to-distal-end'
  | 'cutaway'
  | 'forceps-aligns'
  | 'forceps-advances'
  | 'forceps-exits'
  | 'jaws'
  | 'assembled'

interface StepDefinition {
  readonly id: AssemblyStepId
  readonly seconds: number
  /** What this step does to the parts, at its own progress k (0–1). */
  readonly apply: (params: Mutable, k: number, geometry: AssemblyGeometry) => void
  /** Where the camera is at the end of this step. */
  readonly camera: (state: CameraInputs) => CameraKey
}

type Mutable = { -readonly [K in keyof AssemblyParams]: AssemblyParams[K] }

/** Where the camera looks: a point, the direction from it to the camera, and how much to show. */
export interface CameraKey {
  readonly target: Vec3
  readonly direction: Vec3
  /** Half the extent that must stay in view, in millimetres. */
  readonly radius: number
}

/**
 * How much must be in view to show the system at three moments: the telescope aligned behind the
 * sleeve, the whole system seated, and the exploded row. The scene measures these from the loaded
 * models for its own viewport; `anchorBounds` estimates them from the anchors alone.
 */
export interface SystemBounds {
  readonly aligned: { readonly centre: Vec3; readonly radius: number }
  readonly seated: { readonly centre: Vec3; readonly radius: number }
  readonly exploded: { readonly centre: Vec3; readonly radius: number }
}

interface CameraInputs {
  readonly geometry: AssemblyGeometry
  readonly poses: AssemblyPoses
  readonly bounds: SystemBounds
}

const FRONT = normalize([1, 0.32, -0.18])
/** The front three-quarter view the sequence's overviews use, in the assembly frame. */
export const ASSEMBLY_FRONT_VIEW: Vec3 = FRONT
const DISTAL = normalize([0.62, 0.34, -0.71])
const REAR = normalize([0.78, 0.36, 0.52])

function initialParams(geometry: AssemblyGeometry): Mutable {
  return {
    sleeveVisible: 0,
    sleeveRise: 0,
    telescopeVisible: 0,
    telescopeApproach: 0,
    telescopeWithdrawalMm: geometry.telescopeWithdrawal.aligned,
    forcepsVisible: 0,
    forcepsApproach: 0,
    forcepsWithdrawalMm: geometry.forcepsWithdrawal.aligned,
    jawOpen: 0,
  }
}

const sleeveCentre = ({ geometry }: CameraInputs): Vec3 =>
  applyPose(
    geometry.sleevePose,
    lerpVec(
      geometry.anchors.sleeve.distalEnd.position,
      geometry.anchors.sleeve.proximalEnd.position,
      0.5,
    ),
  )

export const ASSEMBLY_STEPS: readonly StepDefinition[] = [
  {
    id: 'sleeve',
    seconds: 1.8,
    apply: (p, k) => {
      p.sleeveVisible = band(k, 0, 0.7)
      p.sleeveRise = smoothstep(k)
    },
    camera: (state) => ({ target: sleeveCentre(state), direction: FRONT, radius: 62 }),
  },
  {
    id: 'telescope-aligns',
    seconds: 2.4,
    apply: (p, k) => {
      p.telescopeVisible = band(k, 0, 0.35)
      p.telescopeApproach = smoothstep(k)
    },
    camera: ({ bounds }) => ({
      target: bounds.aligned.centre,
      direction: FRONT,
      radius: bounds.aligned.radius,
    }),
  },
  {
    id: 'telescope-advances',
    seconds: 3.2,
    apply: (p, k, g) => {
      p.telescopeWithdrawalMm = lerp(g.telescopeWithdrawal.aligned, 0, smoothstep(k))
    },
    camera: ({ bounds }) => ({
      target: bounds.seated.centre,
      direction: FRONT,
      radius: bounds.seated.radius,
    }),
  },
  {
    id: 'to-distal-end',
    seconds: 2.4,
    apply: () => {},
    camera: ({ geometry }) => ({
      target: add(geometry.anchors.telescope.distalFace.position, [0, 0.3, -1.5]),
      direction: DISTAL,
      radius: 7.5,
    }),
  },
  {
    id: 'cutaway',
    seconds: 2,
    apply: () => {},
    camera: ({ bounds }) => ({
      target: bounds.seated.centre,
      direction: FRONT,
      radius: bounds.seated.radius,
    }),
  },
  {
    id: 'forceps-aligns',
    seconds: 2.4,
    apply: (p, k) => {
      p.forcepsVisible = band(k, 0, 0.35)
      p.forcepsApproach = smoothstep(k)
    },
    camera: ({ geometry }) => ({
      target: add(
        geometry.anchors.telescope.channelEntry.position,
        scale(geometry.forcepsInsertion, -45),
      ),
      direction: REAR,
      radius: 70,
    }),
  },
  {
    id: 'forceps-advances',
    seconds: 4.2,
    apply: (p, k, g) => {
      p.forcepsWithdrawalMm = lerp(
        g.forcepsWithdrawal.aligned,
        g.forcepsWithdrawal.tipAtChannelExit,
        smoothstep(k),
      )
    },
    camera: ({ poses }) => ({ target: poses.toolTip, direction: FRONT, radius: 42 }),
  },
  {
    id: 'forceps-exits',
    seconds: 2.4,
    apply: (p, k, g) => {
      p.forcepsWithdrawalMm = lerp(g.forcepsWithdrawal.tipAtChannelExit, 0, smoothstep(k))
    },
    camera: ({ geometry }) => ({
      target: add(
        geometry.anchors.telescope.channelExit.position,
        scale(geometry.forcepsInsertion, geometry.sheathBeyondDistalFaceMm * 0.6),
      ),
      direction: DISTAL,
      radius: 30,
    }),
  },
  {
    id: 'jaws',
    seconds: 2.8,
    apply: (p, k) => {
      p.jawOpen = band(k, 0.05, 0.4) - band(k, 0.62, 0.97)
    },
    camera: ({ poses }) => ({
      target: lerpVec(poses.jawHinge, poses.toolTip, 0.5),
      direction: normalize([0.8, 0.3, -0.5]),
      radius: 12,
    }),
  },
  {
    id: 'assembled',
    seconds: 2.8,
    apply: () => {},
    camera: ({ bounds }) => ({
      target: bounds.seated.centre,
      direction: FRONT,
      radius: bounds.seated.radius,
    }),
  },
]

export const ASSEMBLY_SECONDS = ASSEMBLY_STEPS.reduce((sum, step) => sum + step.seconds, 0)

/** Where each step starts, in seconds. */
export const STEP_STARTS: readonly number[] = ASSEMBLY_STEPS.reduce<number[]>(
  (starts, step, index) => [
    ...starts,
    index === 0 ? 0 : starts[index - 1] + ASSEMBLY_STEPS[index - 1].seconds,
  ],
  [],
)

export function stepAt(seconds: number): { readonly index: number; readonly k: number } {
  const t = Math.min(ASSEMBLY_SECONDS, Math.max(0, seconds))
  for (let index = ASSEMBLY_STEPS.length - 1; index >= 0; index -= 1) {
    if (t >= STEP_STARTS[index]) {
      return { index, k: clamp01((t - STEP_STARTS[index]) / ASSEMBLY_STEPS[index].seconds) }
    }
  }
  return { index: 0, k: 0 }
}

/** The parts at a moment of the sequence: every earlier step complete, the current one part-way. */
export function paramsAt(seconds: number, geometry: AssemblyGeometry): AssemblyParams {
  const params = initialParams(geometry)
  const { index, k } = stepAt(seconds)
  for (let step = 0; step < index; step += 1) ASSEMBLY_STEPS[step].apply(params, 1, geometry)
  ASSEMBLY_STEPS[index].apply(params, k, geometry)
  return params
}

/** Every part shown, coaxial, each drawn back clear of the next: the exploded view. */
export function explodedParams(geometry: AssemblyGeometry): AssemblyParams {
  return {
    sleeveVisible: 1,
    sleeveRise: 1,
    telescopeVisible: 1,
    telescopeApproach: 1,
    telescopeWithdrawalMm: geometry.telescopeWithdrawal.aligned,
    forcepsVisible: 1,
    forcepsApproach: 1,
    forcepsWithdrawalMm: geometry.forcepsWithdrawal.aligned,
    jawOpen: 0,
  }
}

/** The cutaway suits the steps from the cutaway to the jaws; the last step shows the solid system. */
export function cutawaySuggestedAt(seconds: number): boolean {
  const { index } = stepAt(seconds)
  const from = ASSEMBLY_STEPS.findIndex((step) => step.id === 'cutaway')
  const until = ASSEMBLY_STEPS.findIndex((step) => step.id === 'assembled')
  return index >= from && index < until
}

/** Whether the working element is past the channel exit, so the jaws have room to open. */
export function jawsClearOfChannel(params: AssemblyParams, geometry: AssemblyGeometry): boolean {
  return (
    params.forcepsApproach >= 1 - 1e-9 &&
    params.forcepsWithdrawalMm <= geometry.forcepsWithdrawal.workingElementAtChannelExit + 1e-9
  )
}

export interface AssemblyPoses {
  readonly sleeve: Pose
  readonly telescope: Pose
  readonly forceps: Pose
  /** Each jaw's turn about the hinge, in degrees (the two jaws turn in opposite senses). */
  readonly jawEachDeg: number
  readonly toolTip: Vec3
  readonly jawHinge: Vec3
}

function approachPose(
  approach: { readonly backMm: number; readonly offset: Vec3; readonly tiltDeg: number },
  insertion: Vec3,
  amount: number,
): Pose {
  const away = 1 - smoothstep(amount)
  return {
    position: add(scale(approach.offset, away), scale(insertion, -approach.backMm * away)),
    quaternion: quatFromAxisAngle([1, 0, 0], ((approach.tiltDeg * Math.PI) / 180) * away),
  }
}

export function posesFor(params: AssemblyParams, geometry: AssemblyGeometry): AssemblyPoses {
  const sleeve: Pose = {
    position: add(geometry.sleevePose.position, [
      0,
      -PRESENTATION.sleeveDropMm * (1 - params.sleeveRise),
      0,
    ]),
    quaternion: geometry.sleevePose.quaternion,
  }
  const telescopeTravel: Pose = {
    position: scale(geometry.telescopeInsertion, -params.telescopeWithdrawalMm),
    quaternion: IDENTITY,
  }
  const telescope = composePose(
    approachPose(
      PRESENTATION.telescopeApproach,
      geometry.telescopeInsertion,
      params.telescopeApproach,
    ),
    telescopeTravel,
  )
  const forcepsInTelescope = composePose(
    composePose(
      approachPose(PRESENTATION.forcepsApproach, geometry.forcepsInsertion, params.forcepsApproach),
      {
        position: scale(geometry.forcepsInsertion, -params.forcepsWithdrawalMm),
        quaternion: IDENTITY,
      },
    ),
    geometry.forcepsSeatedPose,
  )
  const forceps = composePose(telescope, forcepsInTelescope)
  return {
    sleeve,
    telescope,
    forceps,
    jawEachDeg: (clamp01(params.jawOpen) * geometry.jawOpeningDeg) / 2,
    toolTip: applyPose(forceps, geometry.anchors.forceps.toolTip.position),
    jawHinge: applyPose(forceps, geometry.anchors.forceps.jawHinge.position),
  }
}

/** The three moments `SystemBounds` describes, as the sequence's numbers. */
export function boundsMoments(
  geometry: AssemblyGeometry,
): Record<keyof SystemBounds, AssemblyParams> {
  const aligned = ASSEMBLY_STEPS.findIndex((step) => step.id === 'telescope-aligns')
  return {
    aligned: paramsAt(STEP_STARTS[aligned] + ASSEMBLY_STEPS[aligned].seconds, geometry),
    seated: paramsAt(ASSEMBLY_SECONDS, geometry),
    exploded: explodedParams(geometry),
  }
}

/** Bounds from the anchors alone, for use before the models have loaded. */
export function anchorBounds(geometry: AssemblyGeometry): SystemBounds {
  const fit = (params: AssemblyParams) => {
    const poses = posesFor(params, geometry)
    const { telescope, sleeve, forceps } = geometry.anchors
    const points: Vec3[] = [
      applyPose(poses.forceps, forceps.toolTip.position),
      applyPose(poses.forceps, forceps.handleFront.position),
      applyPose(poses.telescope, telescope.distalFace.position),
      applyPose(poses.telescope, telescope.channelEntry.position),
      applyPose(poses.sleeve, sleeve.proximalEnd.position),
    ]
    const centre = scale(
      points.reduce<Vec3>((sum, point) => add(sum, point), [0, 0, 0]),
      1 / points.length,
    )
    const radius = Math.max(...points.map((point) => length(sub(point, centre)))) + 40
    return { centre, radius }
  }
  const moments = boundsMoments(geometry)
  return {
    aligned: fit(moments.aligned),
    seated: fit(moments.seated),
    exploded: fit(moments.exploded),
  }
}

function blendCamera(a: CameraKey, b: CameraKey, t: number): CameraKey {
  const k = smoothstep(t)
  return {
    target: lerpVec(a.target, b.target, k),
    direction: normalize(lerpVec(a.direction, b.direction, k)),
    radius: Math.exp(lerp(Math.log(a.radius), Math.log(b.radius), k)),
  }
}

/** The sequence's camera at a moment: from the previous step's view to this step's. */
export function cameraAt(
  seconds: number,
  params: AssemblyParams,
  geometry: AssemblyGeometry,
  bounds: SystemBounds,
): CameraKey {
  const inputs: CameraInputs = { geometry, poses: posesFor(params, geometry), bounds }
  const { index, k } = stepAt(seconds)
  const end = ASSEMBLY_STEPS[index].camera(inputs)
  const start =
    index === 0
      ? { ...ASSEMBLY_STEPS[0].camera(inputs), radius: 60 }
      : ASSEMBLY_STEPS[index - 1].camera(inputs)
  return blendCamera(start, end, k)
}

/** The exploded view's camera: the whole row of parts. */
export function explodedCamera(bounds: SystemBounds): CameraKey {
  return { target: bounds.exploded.centre, direction: FRONT, radius: bounds.exploded.radius }
}

export function mixCamera(a: CameraKey, b: CameraKey, t: number): CameraKey {
  return blendCamera(a, b, t)
}
