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
import { advance, stepTarget, takeStep } from '../engine/space/spatial/sweep'
import type { ZoneSamples } from '../engine/space/spatial/visibility'
import {
  boxMesh,
  gridBoxMesh,
  judgedMesh,
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
export type SceneKind = (typeof SCENE_KINDS)[number]

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
