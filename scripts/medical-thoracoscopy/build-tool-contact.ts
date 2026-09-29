/**
 * The contact spike's nodule and the two places it starts from (slice 13; plan, section 4.7).
 *
 *   npx tsx scripts/medical-thoracoscopy/build-tool-contact.ts
 *
 * Reads the packaged proxies from the owner's local data, with the lung fallen away, and:
 *
 * 1. finds where the line of the working channel meets the costal pleura (the anterior, lateral or
 *    posterior chest wall) head on, from a position the port allows, with nothing in the way, and
 *    sets an illustrative nodule there, a sphere a little sunk into the pleura. The plan puts it
 *    there (section 4.7). If the lung lies in front of every such line, as it does with the lung the
 *    model has now (MT-C-0002), nothing on the chest wall can be reached along the telescope, and the
 *    nodule is set on the lung's surface instead, where the line first meets it; the record says
 *    which, and how many lines met the lung first;
 * 2. "Facing the nodule": a position a little back along that line, where taking the telescope in
 *    stops it at the nodule, kept clear, and putting the forceps out then brings the jaws to touch
 *    it; after they are back in the channel, the telescope stops at the nodule again;
 * 3. "Beside the lung": a position where, with the forceps put out until they stop, a pivot one way
 *    stops them against the lung, with the forceps' part named, while the same pivot with the
 *    forceps back in the channel moves the telescope freely.
 *
 * Each demonstration is run through the space engine itself, command by command, and the record
 * keeps what it found. Writes `src/features/medical-thoracoscopy/content/data/anatomy/
 * tool-contact.json`: numbers only, with the snapshot they were computed for. An authored construct:
 * the nodule is illustrative, and nothing about it is a clinical statement.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import prettier from 'prettier'
import { DoubleSide, Ray, Vector3 } from 'three'

import {
  PIVOT_HAND_DIRECTIONS,
  type PivotHandDirection,
  type ScopePose,
  type SpaceCommand,
} from '../../src/features/medical-thoracoscopy/components/space/types'
import { anatomyManifest } from '../../src/features/medical-thoracoscopy/content/data/generated/anatomy'
import type { PleuralZoneId } from '../../src/features/medical-thoracoscopy/content/pleuralZones'
import { acrossRibsLimitDeg } from '../../src/features/medical-thoracoscopy/engine/space/fulcrum'
import {
  createResolver,
  loadSpace,
  type LoadedSpace,
  type SpaceResolver,
} from '../../src/features/medical-thoracoscopy/engine/space/loadSpace'
import {
  spaceSnapshot,
  toolIdentity,
} from '../../src/features/medical-thoracoscopy/engine/space/spaceSnapshot'
import {
  reduce,
  startEngine,
  type EngineState,
} from '../../src/features/medical-thoracoscopy/engine/space/spaceReducer'
import { CLEARANCE_SKIN_MM } from '../../src/features/medical-thoracoscopy/engine/space/spatial/spatialWorld'
import { teachingTarget } from '../../src/features/medical-thoracoscopy/engine/space/teachingTarget'
import {
  AUTHORED_TOOL_VALUES,
  forceps,
} from '../../src/features/medical-thoracoscopy/engine/space/toolChannel'
import {
  add,
  cross,
  dot,
  normalize,
  scale,
  sub,
  type Vec3,
} from '../../src/features/medical-thoracoscopy/engine/space/vec'
import { reachIdentity } from '../../src/features/medical-thoracoscopy/engine/space/zoneReach'

const ROOT = path.resolve(__dirname, '../..')
const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const PACKAGED = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
const RECORD = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/content/data/anatomy/tool-contact.json',
)
const LUNG_STEP = 8
/** Authored: the nodule's radius, and how much of it lies behind the pleura. */
const NODULE_RADIUS_MM = 5
const SUNK_SHARE = 0.2
/** Authored: how far from the nodule the telescope's tip starts, facing it. */
const FACING_GAP_MM = 16
const COSTAL: readonly PleuralZoneId[] = [
  'anterior-chest-wall',
  'lateral-chest-wall',
  'posterior-chest-wall',
]
const GRID = { tiltStepDeg: 2, depthStepMm: 3 }
const TILT_SHARE = 0.85

function span(from: number, to: number, step: number): number[] {
  const count = Math.max(1, Math.ceil((to - from) / step))
  return Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count)
}

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places
const roundPose = (pose: ScopePose): ScopePose => ({
  tiltAcrossRibsDeg: round(pose.tiltAcrossRibsDeg),
  tiltAlongRibsDeg: round(pose.tiltAlongRibsDeg),
  depthMm: round(pose.depthMm),
  rollDeg: round(pose.rollDeg),
})

function bytes(id: string): Buffer {
  const entry = anatomyManifest.files.find((f) => f.id === id)
  if (!entry) throw new Error(`The anatomy manifest has no ${id}`)
  return readFileSync(path.join(PACKAGED, entry.file))
}

/** Every pose of the grid the port allows, clear of everything, at roll zero. */
function clearPoses(space: LoadedSpace, resolver: SpaceResolver, share = 1): ScopePose[] {
  const across = acrossRibsLimitDeg(space.port, space.device) * share
  const along = space.device.alongRibsLimitDeg * share
  const [least, most] = space.depthLimits
  const poses: ScopePose[] = []
  for (const a of span(-across, across, GRID.tiltStepDeg)) {
    const reachAlong = along * Math.sqrt(Math.max(0, 1 - (a / across) ** 2))
    for (const b of span(-reachAlong, reachAlong, GRID.tiltStepDeg)) {
      for (const depthMm of span(least, most, GRID.depthStepMm)) {
        const pose: ScopePose = { tiltAcrossRibsDeg: a, tiltAlongRibsDeg: b, depthMm, rollDeg: 0 }
        if (resolver.clearance(pose, LUNG_STEP) < CLEARANCE_SKIN_MM) break
        poses.push(pose)
      }
    }
  }
  return poses
}

interface Site {
  readonly pose: ScopePose
  readonly on: 'costal-pleura' | 'lung-surface'
  readonly zone: PleuralZoneId | null
  /** From the channel's exit to the surface, along the axis. */
  readonly distanceMm: number
  readonly onSurface: Vec3
  /** The surface's normal there, pointing into the space the telescope is in. */
  readonly towardTelescope: Vec3
  readonly headOn: number
}

function normalOf(mesh: { positions: Float32Array; indices: Uint32Array }, triangle: number): Vec3 {
  const { positions, indices } = mesh
  const vertex = (i: number): Vec3 => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]
  const a = vertex(indices[triangle * 3])
  return normalize(
    cross(sub(vertex(indices[triangle * 3 + 1]), a), sub(vertex(indices[triangle * 3 + 2]), a)),
  )
}

/**
 * Where the channel's line first meets the costal pleura, from each clear pose; and where it first
 * meets the lung, for when the lung lies in front of every line.
 */
function sites(space: LoadedSpace, resolver: SpaceResolver) {
  const tools = forceps()
  const { world } = space
  const lungIndex = world.lungIndex(LUNG_STEP)
  const costal: Site[] = []
  const lungSurface: Site[] = []
  let lines = 0
  let lungFirst = 0
  let nearestLung = Infinity
  for (const pose of clearPoses(space, resolver, TILT_SHARE)) {
    const g = resolver.geometry(pose)
    const exit = add(g.tip, scale(g.camera.up, -tools.channelOffsetMm))
    const ray = new Ray(new Vector3(...exit), new Vector3(...g.axis))
    const wall = world.spaceIndex.bvh.raycastFirst(ray, DoubleSide, 0, 400)
    if (!wall || wall.faceIndex === undefined || wall.faceIndex === null) continue
    lines += 1
    const inLung = lungIndex.bvh.raycastFirst(ray, DoubleSide, 0, wall.distance)
    if (inLung && inLung.faceIndex !== undefined && inLung.faceIndex !== null) {
      lungFirst += 1
      if (pose.depthMm === space.depthLimits[0])
        nearestLung = Math.min(nearestLung, inLung.distance)
      // the lung's proxy is outward, so its normal points into the space the telescope is in
      const normal = normalOf(lungIndex.mesh, lungIndex.original[inLung.faceIndex])
      lungSurface.push({
        pose,
        on: 'lung-surface',
        zone: null,
        distanceMm: inLung.distance,
        onSurface: [inLung.point.x, inLung.point.y, inLung.point.z],
        towardTelescope: normal,
        headOn: -dot(g.axis, normal),
      })
      continue
    }
    const triangle = world.spaceIndex.original[wall.faceIndex]
    const zone = space.triangleZones[triangle]
    if (!COSTAL.includes(zone)) continue
    // the space's proxy is outward, so its normal points out of the space, away from the telescope
    const normal = normalOf(world.space, triangle)
    costal.push({
      pose,
      on: 'costal-pleura',
      zone,
      distanceMm: wall.distance,
      onSurface: [wall.point.x, wall.point.y, wall.point.z],
      towardTelescope: scale(normal, -1),
      headOn: dot(g.axis, normal),
    })
  }
  return { costal, lungSurface, lines, lungFirst, nearestLung }
}

type Limit = NonNullable<EngineState['limit']>

/** Press one command until something stops it, up to a number of presses. */
function pressUntilStopped(
  state: EngineState,
  command: SpaceCommand,
  resolver: SpaceResolver,
  presses: number,
): { state: EngineState; presses: number; limit: Limit | null } {
  let current = state
  for (let n = 1; n <= presses; n += 1) {
    current = reduce(
      current,
      { type: 'command', command, input: 'scripted', snapshot: current.snapshot },
      resolver,
    )
    if (current.limit) return { state: current, presses: n, limit: current.limit }
  }
  return { state: current, presses, limit: null }
}

function press(state: EngineState, command: SpaceCommand, resolver: SpaceResolver, times: number) {
  let current = state
  for (let n = 0; n < times; n += 1)
    current = reduce(
      current,
      { type: 'command', command, input: 'scripted', snapshot: current.snapshot },
      resolver,
    )
  return current
}

const IN: SpaceCommand = { kind: 'depth', direction: 'in' }
const OUT: SpaceCommand = { kind: 'depth', direction: 'out' }
const EXTEND: SpaceCommand = { kind: 'tool', direction: 'extend' }
const RETRACT: SpaceCommand = { kind: 'tool', direction: 'retract' }
const FULL_OUT = Math.ceil(AUTHORED_TOOL_VALUES.reachMm / AUTHORED_TOOL_VALUES.stepMm) + 1

function start(resolver: SpaceResolver, pose: ScopePose, scenario: string): EngineState | null {
  if (resolver.startProblem(pose, LUNG_STEP)) return null
  return startEngine(resolver, {
    scenario,
    lungStep: LUNG_STEP,
    pose,
    reducedMotion: true,
    snapshot: spaceSnapshot(scenario, LUNG_STEP, undefined, true),
    tool: { authorised: true },
  })
}

/** Facing the nodule: every step of the first and third demonstrations, or why it fails. */
function tryFacing(resolver: SpaceResolver, pose: ScopePose) {
  const begun = start(resolver, pose, 'tool-contact:facing')
  if (!begun) return null
  const inward = pressUntilStopped(begun, IN, resolver, 30)
  if (inward.limit?.kind !== 'target' || inward.limit.part !== 'telescope') return null
  if (inward.presses < 3) return null
  const backed = press(inward.state, OUT, resolver, 3)
  if (backed.limit) return null
  const out = pressUntilStopped(backed, EXTEND, resolver, FULL_OUT)
  if (out.limit?.kind !== 'target' || out.limit.part !== 'working-element') return null
  if (!out.state.tool?.touching) return null
  const pushed = press(out.state, IN, resolver, 1)
  if (pushed.limit?.kind !== 'target' || pushed.limit.part !== 'working-element') return null
  if (pushed.pose.depthMm > out.state.pose.depthMm + 0.2) return null
  const back = pressUntilStopped(out.state, RETRACT, resolver, FULL_OUT)
  if (back.limit?.kind !== 'tool-in' || back.state.tool?.phase !== 'in-channel') return null
  const again = pressUntilStopped(back.state, IN, resolver, 30)
  if (again.limit?.kind !== 'target' || again.limit.part !== 'telescope') return null
  return {
    telescopeStopsAfterSteps: inward.presses,
    forcepsTouchAtMm: round(out.state.tool.extensionMm),
  }
}

/** Beside the lung: the second demonstration, and its undoing, for each way of the hand. */
function tryBeside(resolver: SpaceResolver, pose: ScopePose) {
  const begun = start(resolver, pose, 'tool-contact:beside')
  if (!begun) return null
  // out until they stop, at the lung or as far as the model lets them go, and well out of the channel
  const out = pressUntilStopped(begun, EXTEND, resolver, FULL_OUT)
  if (!out.limit || (out.state.tool?.extensionMm ?? 0) < 10) return null
  if (out.limit.kind === 'target') return null
  const found: {
    hand: PivotHandDirection
    part: 'tool-shaft' | 'working-element'
    presses: number
    free: number
  }[] = []
  for (const hand of PIVOT_HAND_DIRECTIONS) {
    const pivot: SpaceCommand = { kind: 'pivot', hand }
    const swept = pressUntilStopped(out.state, pivot, resolver, 6)
    if (swept.limit?.kind !== 'lung') continue
    if (swept.limit.part !== 'tool-shaft' && swept.limit.part !== 'working-element') continue
    // the same pivot, the forceps back in the channel
    const back = pressUntilStopped(begun, pivot, resolver, swept.presses + 4)
    const free = back.limit ? back.presses - 1 : back.presses
    if (free < swept.presses + 2) continue
    found.push({ hand, part: swept.limit.part, presses: swept.presses, free })
  }
  // prefer a stop after a press or two that moved, so the forceps are seen to swing, then stop
  const score = (entry: (typeof found)[number]) =>
    entry.presses === 2 ? 0 : entry.presses === 3 ? 1 : entry.presses === 1 ? 2 : 3
  return found.sort((a, b) => score(a) - score(b))[0] ?? null
}

async function main(): Promise<void> {
  const started = Date.now()
  const plain = loadSpace(bytes('proxy-pleural-space'), bytes('proxy-lung'))
  const plainResolver = createResolver(plain)
  const found = sites(plain, plainResolver)
  const headOn = (list: readonly Site[]) =>
    list
      .filter((site) => site.headOn > 0.85 && site.distanceMm > 20 && site.distanceMm < 140)
      .sort((a, b) => b.headOn - a.headOn)
  const costal = headOn(found.costal)
  const candidates = costal.length > 0 ? costal : headOn(found.lungSurface)
  console.log(
    `${found.lines} lines, ${found.lungFirst} meeting the lung first (nearest ${round(found.nearestLung, 1)} mm from the tip); ${costal.length} head-on sites on the costal pleura, ${candidates.length} candidates`,
  )

  let chosen: {
    site: Site
    centre: Vec3
    space: LoadedSpace
    facing: ScopePose
    facingFound: NonNullable<ReturnType<typeof tryFacing>>
  } | null = null
  const [least] = plain.depthLimits
  for (const site of candidates.slice(0, 400)) {
    // a little sunk into the surface it sits on, away from the telescope
    const centre = add(site.onSurface, scale(site.towardTelescope, -SUNK_SHARE * NODULE_RADIUS_MM))
    const space = loadSpace(bytes('proxy-pleural-space'), bytes('proxy-lung'), {
      target: teachingTarget(centre, NODULE_RADIUS_MM),
    })
    const resolver = createResolver(space)
    // back along the line, to leave a gap before the nodule's surface
    const protrudes = (1 - SUNK_SHARE) * NODULE_RADIUS_MM
    const depthMm = site.pose.depthMm + site.distanceMm - protrudes - FACING_GAP_MM
    if (depthMm < least) continue
    const facing = { ...site.pose, depthMm }
    const facingFound = tryFacing(resolver, facing)
    if (!facingFound) continue
    chosen = { site, centre, space, facing, facingFound }
    break
  }
  if (!chosen) throw new Error('No site shows the first demonstration')
  console.log(
    `nodule on the ${chosen.site.on} (${chosen.site.zone ?? 'lung'}), head on ${round(chosen.site.headOn, 3)}`,
    JSON.stringify(roundPose(chosen.facing)),
    JSON.stringify(chosen.facingFound),
  )

  const resolver = createResolver(chosen.space)
  const nearLung = clearPoses(chosen.space, resolver)
    .map((pose) => ({ pose, gap: resolver.lungClearance(pose, LUNG_STEP) }))
    .filter((entry) => entry.gap > 6 && entry.gap < 30)
    .sort((a, b) => a.gap - b.gap)
  console.log(`${nearLung.length} positions within reach of the lung`)
  let beside: { pose: ScopePose; found: NonNullable<ReturnType<typeof tryBeside>> } | null = null
  for (const entry of nearLung.slice(0, 600)) {
    const found = tryBeside(resolver, entry.pose)
    if (!found) continue
    if (!beside || (found.presses === 2 && beside.found.presses !== 2))
      beside = { pose: entry.pose, found }
    if (found.presses === 2) break
  }
  if (!beside) throw new Error('No position shows the second demonstration')
  console.log(
    'beside the lung',
    JSON.stringify(roundPose(beside.pose)),
    JSON.stringify(beside.found),
  )

  // the rounded poses are what the page starts from: check them again, rounded
  const facingPose = roundPose(chosen.facing)
  const besidePose = roundPose(beside.pose)
  const facingAgain = tryFacing(resolver, facingPose)
  const besideAgain = tryBeside(resolver, besidePose)
  if (!facingAgain || !besideAgain)
    throw new Error('A rounded place no longer shows its demonstration')

  const record = {
    record: 'medical-thoracoscopy-tool-contact',
    version: 1,
    script: 'scripts/medical-thoracoscopy/build-tool-contact.ts',
    statement:
      'Numbers only: an illustrative nodule for the contact spike, on the costal pleura where the plan puts it or, when the lung lies in front of every line the port allows, on the lung’s surface; and the two positions of the telescope the spike starts from, with the lung fallen away, each checked by running its demonstration through the space engine. Computed from the collision proxies, which are not in the repository.',
    label: 'Authored construct',
    computedFor: { ...reachIdentity(LUNG_STEP), tool: toolIdentity() },
    lungStep: LUNG_STEP,
    nodule: {
      on: chosen.site.on,
      zone: chosen.site.zone,
      centre: chosen.centre.map((value) => round(value, 3)),
      radiusMm: NODULE_RADIUS_MM,
      onSurface: chosen.site.onSurface.map((value) => round(value, 3)),
      towardTelescope: chosen.site.towardTelescope.map((value) => round(value, 4)),
    },
    costalPleura: {
      linesTried: found.lines,
      linesMeetingTheLungFirst: found.lungFirst,
      nearestLungFromTheTipMm: round(found.nearestLung, 1),
    },
    places: [
      { id: 'facing-the-nodule', pose: facingPose },
      { id: 'beside-the-lung', pose: besidePose },
    ],
    towardTheLung: besideAgain.hand,
    found: {
      telescopeStopsAfterSteps: facingAgain.telescopeStopsAfterSteps,
      forcepsTouchAtMm: facingAgain.forcepsTouchAtMm,
      besideTheLungStoppedBy: besideAgain.part,
      besideTheLungPivotSteps: besideAgain.presses,
      withoutTheForcepsPivotSteps: besideAgain.free,
    },
  }
  const options = await prettier.resolveConfig(path.join(ROOT, 'package.json'))
  writeFileSync(
    RECORD,
    await prettier.format(JSON.stringify(record), { ...options, parser: 'json' }),
  )
  console.log(`${Math.round((Date.now() - started) / 1000)} s`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
