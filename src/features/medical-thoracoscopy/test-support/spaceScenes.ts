import { PIVOT_HAND_DIRECTIONS, type ScopePose, type SpaceCommand } from '../components/space/types'
import { PLEURAL_ZONE_IDS, type PleuralZoneId } from '../content/pleuralZones'
import {
  acrossRibsLimitDeg,
  scopeGeometry,
  sleeveTipDepth,
  tiltAllowed,
  type ScopeGeometry,
} from '../engine/space/fulcrum'
import { instrument } from '../engine/space/instrument'
import {
  assembleSpace,
  createResolver,
  type LoadedSpace,
  type SpaceResolver,
} from '../engine/space/loadSpace'
import type { PortFrame } from '../engine/space/portDefinition'
import type { TriangleMesh } from '../engine/space/spatial/proxyGlb'
import {
  CLEARANCE_SKIN_MM,
  createSpatialWorld,
  PORT_EXCLUSION_MM,
} from '../engine/space/spatial/spatialWorld'
import { LUNG_STEP_MS, reduce, startEngine } from '../engine/space/spaceReducer'
import { spaceSnapshot } from '../engine/space/spaceSnapshot'
import { advance, stepTarget, takeStep } from '../engine/space/spatial/sweep'
import type { ZoneSamples } from '../engine/space/spatial/visibility'
import { teachingTarget } from '../engine/space/teachingTarget'
import type { Vec3 } from '../engine/space/vec'
import {
  boxMesh,
  gridBoxMesh,
  judgedMesh,
  judgedNear,
  judgeInside,
  judgePointTriangle,
  judgeSegmentMesh,
  seededRandom,
  sphereMesh,
  torusSegmentMesh,
  translateMesh,
  type JudgedMesh,
} from './spaceFixtures'

/**
 * The whole space engine on analytic scenes (plan, section 7): a box for the pleural space with the
 * port in the middle of one face, and a lung that is a set of shrinking spheres, a plate thinner
 * than any step, or half a ring. The port's frame is the real one's shape: in along +x, the head
 * along +z. Each scene carries the judge's own copy of its surfaces.
 */
export const ROOM = { x: [0, 130], y: [-85, 85], z: [-95, 95] } as const

export const SCENE_PORT: PortFrame = {
  pivot: [-2.54, 0, 0],
  inward: [1, 0, 0],
  acrossRibs: [0, 0, 1],
  alongRibs: [0, -1, 0],
  pleura: [0, 0, 0],
  pleuraDepthMm: 2.54,
  patchRadiusMm: 7.5,
  ribGapMm: 15.01,
  ribDepthMm: 8.9,
}

export const SCENE_KINDS = ['spheres', 'plate', 'torus'] as const
/** `lesson`: the spheres with nine steps, as the real lung has, for the lesson host's tests. */
export type SceneKind = (typeof SCENE_KINDS)[number] | 'lesson'

export interface Scene {
  readonly kind: SceneKind
  readonly space: LoadedSpace
  /** The judge's wall: the room less the port's patch, by its own rule. */
  readonly wall: JudgedMesh
  readonly lungs: readonly JudgedMesh[]
}

function lungSteps(kind: SceneKind): TriangleMesh[] {
  switch (kind) {
    case 'spheres':
      return [
        sphereMesh(40, [80, 5, -10], 16, 32),
        sphereMesh(34, [86, 7, -12], 16, 32),
        sphereMesh(28, [92, 9, -14], 16, 32),
      ]
    case 'lesson':
      // shrinking and drawing back from the port, step by step, as the lung falls away
      return Array.from({ length: 9 }, (_, k) =>
        sphereMesh(40 - 2 * k, [80 + k, 5 + k * 0.5, -10 - k * 0.5], 12, 24),
      )
    case 'plate': {
      const plate = boxMesh([44.75, -40, -40], [45.25, 40, 40])
      return [plate, plate]
    }
    case 'torus': {
      const ring = translateMesh(torusSegmentMesh(35, 8, 0, 180, 24, 12), [70, 0, 0])
      return [ring, ring]
    }
  }
}

/** Samples on the room's walls, every 12 mm, a quarter of a millimetre inside, a zone to a face. */
function roomSamples(): ZoneSamples {
  const zones: PleuralZoneId[] = []
  const points: number[] = []
  const normals: number[] = []
  const add = (zone: PleuralZoneId, p: readonly number[], n: readonly number[]) => {
    zones.push(zone)
    points.push(p[0] - 0.25 * n[0], p[1] - 0.25 * n[1], p[2] - 0.25 * n[2])
    normals.push(...n)
  }
  const along = (from: number, to: number) => {
    const out: number[] = []
    for (let v = from + 6; v < to; v += 12) out.push(v)
    return out
  }
  for (const y of along(ROOM.y[0], ROOM.y[1]))
    for (const z of along(ROOM.z[0], ROOM.z[1])) {
      add('lateral-chest-wall', [ROOM.x[0], y, z], [-1, 0, 0])
      add('mediastinum', [ROOM.x[1], y, z], [1, 0, 0])
    }
  for (const x of along(ROOM.x[0], ROOM.x[1]))
    for (const y of along(ROOM.y[0], ROOM.y[1])) {
      add('apex', [x, y, ROOM.z[1]], [0, 0, 1])
      add(x < 40 ? 'costophrenic-recess' : 'diaphragm', [x, y, ROOM.z[0]], [0, 0, -1])
    }
  for (const x of along(ROOM.x[0], ROOM.x[1]))
    for (const z of along(ROOM.z[0], ROOM.z[1])) {
      add('anterior-chest-wall', [x, ROOM.y[0], z], [0, -1, 0])
      add('posterior-chest-wall', [x, ROOM.y[1], z], [0, 1, 0])
    }
  // in the survey order, as the proxy file keeps them
  const order = PLEURAL_ZONE_IDS.flatMap((zone) => zones.flatMap((z, s) => (z === zone ? [s] : [])))
  return {
    zones: order.map((s) => zones[s]),
    points: Float32Array.from(order.flatMap((s) => points.slice(s * 3, s * 3 + 3))),
    normals: Float32Array.from(order.flatMap((s) => normals.slice(s * 3, s * 3 + 3))),
  }
}

const scenes = new Map<SceneKind, Scene>()

export function scene(kind: SceneKind): Scene {
  const found = scenes.get(kind)
  if (found) return found
  // cells of 40 mm, so that a BVH can pass most of the wall by and the judge's brute force stays quick
  const cuts = ([lo, hi]: readonly [number, number]) => [
    lo,
    ...Array.from({ length: 10 }, (_, i) => (i - 5) * 40).filter((v) => v > lo && v < hi),
    hi,
  ]
  const room = gridBoxMesh({ x: cuts(ROOM.x), y: cuts(ROOM.y), z: cuts(ROOM.z) })
  const lungs = lungSteps(kind)
  const device = instrument()
  const world = createSpatialWorld({ space: room, lungSteps: lungs, port: SCENE_PORT })
  const made: Scene = {
    kind,
    space: assembleSpace({
      port: SCENE_PORT,
      device,
      world,
      samples: roomSamples(),
      depthLimits: [sleeveTipDepth(SCENE_PORT, device), 150],
    }),
    wall: judgedMesh(
      room,
      (a, b, c) => judgePointTriangle(SCENE_PORT.pleura, a, b, c) >= PORT_EXCLUSION_MM,
    ),
    lungs: lungs.map((mesh) => judgedMesh(mesh)),
  }
  scenes.set(kind, made)
  return made
}

/** The instrument's least clearance from the wall and the lung at a step, by the judge alone. */
export function judgeInstrument(
  wall: JudgedMesh,
  lung: JudgedMesh,
  geometry: Pick<ScopeGeometry, 'sleeve' | 'shaft'>,
): number {
  const capsules = geometry.shaft ? [geometry.sleeve, geometry.shaft] : [geometry.sleeve]
  let best = Infinity
  for (const capsule of capsules) {
    best = Math.min(
      best,
      judgeSegmentMesh(wall, capsule.start, capsule.end) - capsule.radius,
      judgeSegmentMesh(lung, capsule.start, capsule.end) - capsule.radius,
    )
  }
  return best
}

// ── Seeded sequences of moves, each judged ─────────────────────────────────────────────────────

export const MOTIONS: readonly SpaceCommand[] = [
  ...PIVOT_HAND_DIRECTIONS.map((hand): SpaceCommand => ({ kind: 'pivot', hand })),
  { kind: 'depth', direction: 'in' },
  { kind: 'depth', direction: 'out' },
  { kind: 'roll', direction: 'clockwise' },
  { kind: 'roll', direction: 'anticlockwise' },
]
export const JUDGE_TOLERANCE_MM = 1e-6

/** A pose inside the ellipse and clear of everything, chosen by the seed. */
export function randomStart(
  random: () => number,
  space: LoadedSpace,
  resolver: SpaceResolver,
  lungStep: number,
  deepestMm = 60,
): ScopePose {
  const across = acrossRibsLimitDeg(space.port, space.device)
  const along = space.device.alongRibsLimitDeg
  const [least] = space.depthLimits
  for (let tries = 0; tries < 200; tries += 1) {
    const r = Math.sqrt(random()) * 0.999
    const phi = random() * 2 * Math.PI
    const pose: ScopePose = {
      tiltAcrossRibsDeg: across * r * Math.cos(phi),
      tiltAlongRibsDeg: along * r * Math.sin(phi),
      depthMm: least + random() * (deepestMm - least),
      rollDeg: Math.floor(random() * 72) * 5,
    }
    if (resolver.startProblem(pose, lungStep) === null) return pose
  }
  throw new Error('No clear start found')
}

/**
 * Seeded sequences, every move judged. Each starts somewhere clear, rushes straight in, in one move,
 * until something stops it, and then takes commands, mostly one control held the same way. Returns
 * what the judge found wrong, which should be nothing.
 */
export function fuzzSweep(
  target: {
    readonly space: LoadedSpace
    readonly wall: JudgedMesh
    readonly lungs: readonly JudgedMesh[]
  },
  {
    seeds,
    commands,
    firstSeed,
    lungSteps,
  }: {
    readonly seeds: number
    readonly commands: number
    readonly firstSeed: number
    readonly lungSteps?: readonly number[]
  },
): { readonly moves: number; readonly stopped: number; readonly problems: readonly string[] } {
  const { space, wall, lungs } = target
  const { world, port, device, depthLimits } = space
  const resolver = createResolver(space)
  const problems: string[] = []
  let moves = 0
  let stopped = 0
  const check = (seed: number, what: string, pose: ScopePose, lungStep: number) => {
    moves += 1
    const judged = judgeInstrument(wall, lungs[lungStep], scopeGeometry(pose, port, device))
    if (judged < CLEARANCE_SKIN_MM - JUDGE_TOLERANCE_MM)
      problems.push(`seed ${seed}, ${what}: the judge finds ${judged} mm`)
    if (!tiltAllowed(pose, port, device))
      problems.push(`seed ${seed}, ${what}: outside the ellipse`)
    if (pose.depthMm < depthLimits[0] - 1e-9 || pose.depthMm > depthLimits[1] + 1e-9)
      problems.push(`seed ${seed}, ${what}: depth ${pose.depthMm}`)
  }
  for (let seed = firstSeed; seed < firstSeed + seeds; seed += 1) {
    const random = seededRandom(seed)
    const steps = lungSteps ?? Array.from({ length: world.lungStepCount }, (_, k) => k)
    const lungStep = steps[Math.floor(random() * steps.length)]
    const start = randomStart(random, space, resolver, lungStep)
    const rushed = advance(
      world,
      port,
      device,
      start,
      { ...start, depthMm: depthLimits[1] },
      lungStep,
    )
    check(seed, 'the rush', rushed.pose, lungStep)
    let pose = rushed.pose
    const held = MOTIONS[Math.floor(random() * MOTIONS.length)]
    for (let k = 0; k < commands; k += 1) {
      const command = random() < 0.75 ? held : MOTIONS[Math.floor(random() * MOTIONS.length)]
      const result = takeStep(world, port, device, pose, command, lungStep, depthLimits)
      const what = `command ${k} ${JSON.stringify(command)}`
      check(seed, what, result.pose, lungStep)
      if (result.limit === null) {
        const whole = stepTarget(pose, command)
        const off = Math.max(
          Math.abs(result.pose.depthMm - whole.depthMm),
          Math.abs(result.pose.tiltAcrossRibsDeg - whole.tiltAcrossRibsDeg),
          Math.abs(result.pose.tiltAlongRibsDeg - whole.tiltAlongRibsDeg),
        )
        if (off > 1e-9) problems.push(`seed ${seed}, ${what}: stopped short without a reason`)
      } else stopped += 1
      pose = result.pose
    }
  }
  return { moves, stopped, problems }
}

// ── Journeys: every move judged along its path, inside and out (independent review, R2) ─────────

/**
 * The judge's spacing along a move: no capsule end point moves further than this between two judged
 * poses. Clearance is 1-Lipschitz in the capsules' end points, so between two poses judged `a` and
 * `b` clear, with the end points moving `m` between them, the clearance is at least (a + b − m) / 2.
 * Where that is not above the penetration tolerance, the judge halves the interval and looks again.
 * Along a move the engine promises no penetration; where a move stops, the clearance skin. At the
 * skin it moves in pieces shorter than the clearance, so a piece may pass inside the skin without
 * crossing anything (`SKIN_PIECE_SHARE`). A sampled judgment is evidence, not a proof.
 */
export const PATH_SPACING_MM = 0.1

/** Clearance below this is a penetration (plan, section 7). */
export const PENETRATION_MM = -1e-3

/** The instrument's axis points the judge classifies inside or out, away from the port's patch. */
function axisPoints(geometry: Pick<ScopeGeometry, 'sleeve' | 'tip'>, port: PortFrame): Vec3[] {
  const start = geometry.sleeve.start
  const tip = geometry.tip
  const length = Math.hypot(tip[0] - start[0], tip[1] - start[1], tip[2] - start[2])
  const points: Vec3[] = [tip]
  for (let d = 0; d < length; d += 5) {
    const t = d / Math.max(length, 1e-9)
    points.push([
      start[0] + (tip[0] - start[0]) * t,
      start[1] + (tip[1] - start[1]) * t,
      start[2] + (tip[2] - start[2]) * t,
    ])
  }
  const far = (p: Vec3) =>
    Math.hypot(p[0] - port.pleura[0], p[1] - port.pleura[1], p[2] - port.pleura[2]) >=
    PORT_EXCLUSION_MM
  return points.filter(far)
}

/** A straight path between two poses, as the engine's move takes it; rolls the shorter way. */
function poseAt(from: ScopePose, to: ScopePose, t: number): ScopePose {
  const roll = ((((to.rollDeg - from.rollDeg) % 360) + 540) % 360) - 180
  return {
    tiltAcrossRibsDeg: from.tiltAcrossRibsDeg + (to.tiltAcrossRibsDeg - from.tiltAcrossRibsDeg) * t,
    tiltAlongRibsDeg: from.tiltAlongRibsDeg + (to.tiltAlongRibsDeg - from.tiltAlongRibsDeg) * t,
    depthMm: from.depthMm + (to.depthMm - from.depthMm) * t,
    rollDeg: (((from.rollDeg + roll * t) % 360) + 360) % 360,
  }
}

type Capsules = readonly { readonly start: Vec3; readonly end: Vec3; readonly radius: number }[]

function capsulesOf(geometry: Pick<ScopeGeometry, 'sleeve' | 'shaft'>): Capsules {
  return geometry.shaft ? [geometry.sleeve, geometry.shaft] : [geometry.sleeve]
}

/** The furthest any capsule end point moves between two sets of capsules. */
function endPointMotion(a: Capsules, b: Capsules): number {
  if (a.length !== b.length) return Infinity
  let most = 0
  a.forEach((capsule, i) => {
    for (const [p, q] of [
      [capsule.start, b[i].start],
      [capsule.end, b[i].end],
    ] as const)
      most = Math.max(most, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))
  })
  return most
}

export interface JourneyTarget {
  readonly space: LoadedSpace
  /** The judge's wall: the space less the port's patch, for clearance. */
  readonly wall: JudgedMesh
  /** The judge's whole space, for inside and outside. */
  readonly whole: JudgedMesh
  readonly lungs: readonly JudgedMesh[]
}

export interface JourneyRun {
  readonly moves: number
  readonly stopped: number
  readonly pathPoses: number
  readonly insideChecks: number
  readonly lungMoves: number
  readonly lungHeld: number
  readonly problems: readonly string[]
  readonly failingSeeds: readonly number[]
}

/**
 * Seeded journeys on a scene, each judged by the brute force and the ray-parity inside test, which
 * share no code with the collider or its winding number. Each journey starts somewhere clear, rushes
 * in, takes commands, asks the lung to move a step either way (the reducer decides, as it does for
 * the learner), and takes more commands at whatever step the lung is then at. Every move is judged
 * along its path, not only where it ends: a depth move sweeps exactly the instrument at its deeper
 * end, a roll moves no capsule, and a pivot is judged at poses no more than `PATH_SPACING_MM` apart.
 * At the end of every move, the axis must lie inside the space and outside the lung.
 */
export function fuzzJourneys(
  target: JourneyTarget,
  {
    seeds,
    firstSeed,
    commands,
    lungSteps,
    only,
  }: {
    readonly seeds: number
    readonly firstSeed: number
    readonly commands: number
    readonly lungSteps: readonly number[]
    /** Replay just these seeds (the preserved ones), whatever `seeds` and `firstSeed` say. */
    readonly only?: readonly number[]
  },
): JourneyRun {
  const { space, wall, whole, lungs } = target
  const { world, port, device, depthLimits } = space
  const resolver = createResolver(space)
  const problems: string[] = []
  const failing = new Set<number>()
  let moves = 0
  let stopped = 0
  let pathPoses = 0
  let insideChecks = 0
  let lungMoves = 0
  let lungHeld = 0
  const geometryOf = (pose: ScopePose) => scopeGeometry(pose, port, device)
  const fail = (seed: number, text: string) => {
    problems.push(`seed ${seed}, ${text}`)
    failing.add(seed)
  }
  const judgeAt = (seed: number, what: string, pose: ScopePose, lungStep: number) => {
    const judged = judgeInstrument(wall, lungs[lungStep], geometryOf(pose))
    if (judged < CLEARANCE_SKIN_MM - JUDGE_TOLERANCE_MM)
      fail(seed, `${what}: the judge finds ${judged} mm`)
  }
  const judgeSides = (seed: number, what: string, pose: ScopePose, lungStep: number) => {
    for (const p of axisPoints(geometryOf(pose), port)) {
      insideChecks += 1
      if (!judgeInside(whole, p)) fail(seed, `${what}: a point of the axis is outside the space`)
      if (judgeInside(lungs[lungStep], p)) fail(seed, `${what}: a point of the axis is in the lung`)
    }
  }
  const judgePath = (
    seed: number,
    what: string,
    from: ScopePose,
    to: ScopePose,
    lungStep: number,
  ) => {
    const alongAxis =
      from.tiltAcrossRibsDeg === to.tiltAcrossRibsDeg &&
      from.tiltAlongRibsDeg === to.tiltAlongRibsDeg
    if (alongAxis) {
      // along the axis (or a roll), the instrument sweeps exactly itself at the deeper end
      pathPoses += 1
      judgeAt(seed, `${what}, swept`, from.depthMm > to.depthMm ? from : to, lungStep)
      return
    }
    const a = capsulesOf(geometryOf(from))
    const b = capsulesOf(geometryOf(to))
    const motion = endPointMotion(a, b)
    const count = Math.max(1, Math.ceil(motion / PATH_SPACING_MM))
    // only the triangles that could come near the move
    const ends = [...a, ...b].flatMap((c) => [c.start, c.end])
    const corner = (pick: (...values: number[]) => number): Vec3 => [
      pick(...ends.map((p) => p[0])),
      pick(...ends.map((p) => p[1])),
      pick(...ends.map((p) => p[2])),
    ]
    const box = { min: corner(Math.min), max: corner(Math.max) }
    const margin =
      Math.max(device.sleeveRadiusMm, device.shaftRadiusMm) + CLEARANCE_SKIN_MM + motion + 1
    const nearWall = judgedNear(wall, box, margin)
    const nearLung = judgedNear(lungs[lungStep], box, margin)
    const at = (t: number) => {
      pathPoses += 1
      const g = geometryOf(poseAt(from, to, t))
      return { t, capsules: capsulesOf(g), clearance: judgeInstrument(nearWall, nearLung, g) }
    }
    type Sample = ReturnType<typeof at>
    // certify each interval by the Lipschitz bound, halving it where the bound is not enough
    const certify = (a: Sample, b: Sample, depth: number): void => {
      if (b.clearance < PENETRATION_MM) {
        fail(
          seed,
          `${what}, along its path at ${b.t.toFixed(6)}: the judge finds ${b.clearance} mm`,
        )
        return
      }
      // chords, and a little for the arc a turn of a few degrees makes
      const m = endPointMotion(a.capsules, b.capsules) * 1.01
      if ((a.clearance + b.clearance - m) / 2 > PENETRATION_MM) return
      if (depth > 20) {
        fail(seed, `${what}, along its path near ${a.t.toFixed(6)}: not certified clear`)
        return
      }
      const middle = at((a.t + b.t) / 2)
      certify(a, middle, depth + 1)
      certify(middle, b, depth + 1)
    }
    let previous = at(0)
    for (let k = 1; k <= count; k += 1) {
      const next = at(k / count)
      certify(previous, next, 0)
      previous = next
    }
  }
  const step = (
    seed: number,
    what: string,
    pose: ScopePose,
    lungStep: number,
    command: SpaceCommand,
  ) => {
    const result = takeStep(world, port, device, pose, command, lungStep, depthLimits)
    moves += 1
    if (result.limit) stopped += 1
    const named = `${what} ${JSON.stringify(command)}`
    judgeAt(seed, named, result.pose, lungStep)
    judgePath(seed, named, pose, result.pose, lungStep)
    judgeSides(seed, named, result.pose, lungStep)
    if (!tiltAllowed(result.pose, port, device)) fail(seed, `${named}: outside the ellipse`)
    return result.pose
  }
  const least = Math.min(...lungSteps)
  const most = Math.max(...lungSteps)
  const list = only ?? Array.from({ length: seeds }, (_, k) => firstSeed + k)
  for (const seed of list) {
    const random = seededRandom(seed)
    let lungStep = lungSteps[Math.floor(random() * lungSteps.length)]
    let pose = randomStart(random, space, resolver, lungStep)
    judgeAt(seed, 'the start', pose, lungStep)
    judgeSides(seed, 'the start', pose, lungStep)
    // the rush: along the axis, until something stops it
    const rushed = advance(
      world,
      port,
      device,
      pose,
      { ...pose, depthMm: depthLimits[1] },
      lungStep,
    )
    moves += 1
    if (rushed.limit) stopped += 1
    judgePath(seed, 'the rush', pose, rushed.pose, lungStep)
    judgeSides(seed, 'the rush', rushed.pose, lungStep)
    pose = rushed.pose
    const held = MOTIONS[Math.floor(random() * MOTIONS.length)]
    const pick = () => (random() < 0.7 ? held : MOTIONS[Math.floor(random() * MOTIONS.length)])
    for (let k = 0; k < commands; k += 1) pose = step(seed, `command ${k}`, pose, lungStep, pick())
    // the lung, one step either way, as the reducer decides
    const toward = Math.min(most, Math.max(least, lungStep + (random() < 0.5 ? -1 : 1)))
    if (toward !== lungStep) {
      let state = startEngine(resolver, {
        scenario: 'journey',
        lungStep,
        pose,
        reducedMotion: false,
        snapshot: spaceSnapshot('journey', lungStep),
      })
      state = reduce(state, { type: 'lung-target', step: toward }, resolver)
      state = reduce(state, { type: 'tick', ms: LUNG_STEP_MS }, resolver)
      if (state.lungStep === toward) {
        lungMoves += 1
        lungStep = toward
        judgeAt(seed, `the lung to step ${toward}`, pose, lungStep)
        judgeSides(seed, `the lung to step ${toward}`, pose, lungStep)
      } else lungHeld += 1
    }
    for (let k = 0; k < commands; k += 1)
      pose = step(seed, `after the lung, command ${k}`, pose, lungStep, pick())
  }
  return {
    moves,
    stopped,
    pathPoses,
    insideChecks,
    lungMoves,
    lungHeld,
    problems,
    failingSeeds: [...failing],
  }
}

// ── The contact spike's scene (slice 13) ───────────────────────────────────────────────────────

/** The nodule, on the far wall straight ahead of the port, a millimetre sunk into it. */
export const CONTACT_NODULE: { readonly centre: Vec3; readonly radiusMm: number } = {
  centre: [ROOM.x[1] + 1, 0, 0],
  radiusMm: 5,
}

/** The lung, one sphere off to the side of the port's line, the same at both of its steps. */
export const CONTACT_LUNG = { centre: [70, -30, 0] as Vec3, radiusMm: 22 }

export interface ContactScene extends Scene {
  /** The judge's copy of the nodule. */
  readonly target: JudgedMesh
}

let contact: ContactScene | null = null

/**
 * The room, a lung beside the port's line, and a nodule on the far wall: the forceps can reach the
 * nodule along the telescope's line, and a pivot with the forceps out sweeps them toward the lung.
 */
export function contactScene(): ContactScene {
  if (contact) return contact
  const cuts = ([lo, hi]: readonly [number, number]) => [
    lo,
    ...Array.from({ length: 10 }, (_, i) => (i - 5) * 40).filter((v) => v > lo && v < hi),
    hi,
  ]
  const room = gridBoxMesh({ x: cuts(ROOM.x), y: cuts(ROOM.y), z: cuts(ROOM.z) })
  const lung = sphereMesh(CONTACT_LUNG.radiusMm, [...CONTACT_LUNG.centre], 12, 24)
  const target = teachingTarget(CONTACT_NODULE.centre, CONTACT_NODULE.radiusMm)
  const device = instrument()
  const world = createSpatialWorld({
    space: room,
    lungSteps: [lung, lung],
    port: SCENE_PORT,
    target: target.mesh,
  })
  contact = {
    kind: 'spheres',
    space: assembleSpace({
      port: SCENE_PORT,
      device,
      world,
      samples: roomSamples(),
      depthLimits: [sleeveTipDepth(SCENE_PORT, device), 150],
      target,
    }),
    wall: judgedMesh(
      room,
      (a, b, c) => judgePointTriangle(SCENE_PORT.pleura, a, b, c) >= PORT_EXCLUSION_MM,
    ),
    lungs: [judgedMesh(lung), judgedMesh(lung)],
    target: judgedMesh(target.mesh),
  }
  return contact
}
