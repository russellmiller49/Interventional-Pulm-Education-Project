/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ScopePose, SpaceCommand } from '../components/space/types'
import type { PleuralZoneId } from '../content/pleuralZones'
import { anatomyManifest } from '../content/data/generated/anatomy'
import { colliderRule, type ContactRegion } from '../engine/space/contactPolicy'
import { scopeGeometry, sleeveTipDepth } from '../engine/space/fulcrum'
import { instrument } from '../engine/space/instrument'
import {
  assembleSpace,
  createResolver,
  loadSpace,
  type LoadedSpace,
  type ToolInHand,
} from '../engine/space/loadSpace'
import { reduce, startEngine } from '../engine/space/spaceReducer'
import { spaceSnapshot } from '../engine/space/spaceSnapshot'
import {
  CLEARANCE_SKIN_MM,
  createSpatialWorld,
  PORT_EXCLUSION_MM,
  TOUCH_MM,
  TOUCH_SKIN_MM,
} from '../engine/space/spatial/spatialWorld'
import type { Capsule } from '../engine/space/spatial/capsuleQuery'
import { forceps, toolCapsules, type ToolState } from '../engine/space/toolChannel'
import {
  gridBoxMesh,
  judgedMesh,
  judgePointTriangle,
  judgeSegmentMesh,
  seededRandom,
  sphereMesh,
  type JudgedMesh,
} from '../test-support/spaceFixtures'
import { CONTACT_LUNG, fuzzForceps, ROOM, scene, SCENE_PORT } from '../test-support/spaceScenes'

/**
 * The contact contract, region by region (independent review, R8): an engineering contract only.
 * A room whose far wall is the mediastinum region, a lung beside the port's line, no target. It
 * shows that the region the jaws meet takes part in whether they may touch, that the jaws are told
 * from the forceps' shaft and the telescope, that one region can be allowed and the next refused,
 * that a refusal names the part and what it met, that the jaws' state is part of it, and that
 * withdrawal is always possible. It is not a biopsy, says nothing about tissue, and no region here
 * is claimed safe to touch.
 */
const LUNG_STEP = 0

let made: { space: LoadedSpace; wallByZone: Map<PleuralZoneId, JudgedMesh> } | null = null
function regionScene() {
  if (made) return made
  const cuts = ([lo, hi]: readonly [number, number]) => [
    lo,
    ...Array.from({ length: 10 }, (_, i) => (i - 5) * 40).filter((v) => v > lo && v < hi),
    hi,
  ]
  const room = gridBoxMesh({ x: cuts(ROOM.x), y: cuts(ROOM.y), z: cuts(ROOM.z) })
  const lung = sphereMesh(CONTACT_LUNG.radiusMm, [...CONTACT_LUNG.centre], 12, 24)
  const device = instrument()
  const space = assembleSpace({
    port: SCENE_PORT,
    device,
    world: createSpatialWorld({ space: room, lungSteps: [lung, lung], port: SCENE_PORT }),
    samples: scene('spheres').space.samples,
    depthLimits: [sleeveTipDepth(SCENE_PORT, device), 150],
  })
  // the judge's copy of each region of the wall, by the same region per triangle, away from the port
  const wallByZone = new Map<PleuralZoneId, JudgedMesh>()
  for (const zone of new Set(space.triangleZones)) {
    wallByZone.set(
      zone,
      judgedMesh(
        {
          positions: room.positions,
          indices: Uint32Array.from(
            Array.from({ length: room.indices.length / 3 }, (_, f) => f).flatMap((f) =>
              space.triangleZones[f] === zone
                ? [room.indices[f * 3], room.indices[f * 3 + 1], room.indices[f * 3 + 2]]
                : [],
            ),
          ),
        },
        (a, b, c) => judgePointTriangle(SCENE_PORT.pleura, a, b, c) >= 10,
      ),
    )
  }
  made = { space, wallByZone }
  return made
}

/** Facing the far wall (the mediastinum region), 30 mm short of it. */
const FACING: ScopePose = { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 102.5, rollDeg: 0 }
const tool = (state: ToolState, regions?: readonly ContactRegion[]): ToolInHand => ({
  state,
  authorised: regions !== undefined,
  ...(regions ? { regions } : {}),
})
const CLOSED_IN: ToolState = { phase: 'in-channel', extensionMm: 0, jaws: 'closed' }

/** The jaws' least clearance from a region of the wall, by the judge. */
function jawsFrom(zone: PleuralZoneId, pose: ScopePose, state: ToolState): number {
  const { space, wallByZone } = regionScene()
  const { workingElement } = toolCapsules(
    scopeGeometry(pose, space.port, space.device),
    state,
    forceps(),
  )
  if (!workingElement) return Infinity
  return (
    judgeSegmentMesh(wallByZone.get(zone)!, workingElement.start, workingElement.end) -
    workingElement.radius
  )
}

/** Extend until something stops the forceps. */
function extendFully(regions?: readonly ContactRegion[], from: ToolState = CLOSED_IN) {
  const resolver = createResolver(regionScene().space)
  let state = from
  for (let n = 0; n < 30; n += 1) {
    const moved = resolver.toolStep(FACING, 'extend', LUNG_STEP, tool(state, regions))
    state = moved.tool ?? state
    if (moved.limit) return { state, limit: moved.limit, touching: moved.touching ?? false }
  }
  throw new Error('The forceps were never stopped')
}

describe('contact, region by region (R8)', () => {
  it('lets the jaws touch a region the scenario authorises, and no further', () => {
    const { state, limit, touching } = extendFully(['mediastinum'])
    expect(limit).toMatchObject({ kind: 'wall', part: 'working-element', zone: 'mediastinum' })
    expect(touching).toBe(true)
    const clearance = jawsFrom('mediastinum', FACING, state)
    expect(clearance).toBeGreaterThanOrEqual(TOUCH_SKIN_MM - 1e-6)
    expect(clearance).toBeLessThanOrEqual(TOUCH_MM)
  })

  it('keeps the jaws clear of the same wall when another region is authorised, or none', () => {
    for (const regions of [['apex'], undefined] as const) {
      const { state, limit, touching } = extendFully(regions)
      expect(limit).toMatchObject({ kind: 'wall', part: 'working-element', zone: 'mediastinum' })
      expect(touching).toBe(false)
      expect(jawsFrom('mediastinum', FACING, state)).toBeGreaterThanOrEqual(
        CLEARANCE_SKIN_MM - 1e-6,
      )
    }
    // one region allowed, the next refused: the stops differ
    expect(extendFully(['mediastinum']).state.extensionMm).toBeGreaterThan(
      extendFully(['apex']).state.extensionMm - 1e-9,
    )
  })

  it('never lets the telescope touch an authorised region: only the jaws may', () => {
    const resolver = createResolver(regionScene().space)
    let pose = FACING
    const IN: SpaceCommand = { kind: 'depth', direction: 'in' }
    let limit = null
    for (let n = 0; n < 40 && !limit; n += 1) {
      const moved = resolver.step(pose, IN, LUNG_STEP, tool(CLOSED_IN, ['mediastinum']))
      pose = moved.pose
      limit = moved.limit
    }
    expect(limit).toMatchObject({ kind: 'wall', part: 'telescope' })
    expect(resolver.clearance(pose, LUNG_STEP)).toBeGreaterThanOrEqual(CLEARANCE_SKIN_MM - 1e-6)
  })

  it('tells the jaws from the forceps’ shaft: the shaft keeps the clearance skin at an authorised region', () => {
    const { space } = regionScene()
    const rule = colliderRule('extended', 'authorised', ['mediastinum'])
    const at = (x: number) => ({
      start: [x - 10, 0, 0] as const,
      end: [x, 0, 0] as const,
      radius: 1,
    })
    // 0.2 mm from the far wall: within the touch distance, inside the clearance skin
    const near = at(ROOM.x[1] - 1.2)
    const jaws = space.world.contact([{ part: 'working-element', capsule: near }], LUNG_STEP, rule)
    expect(jaws.touching).toBe(true)
    expect(jaws.room).toBeCloseTo(0.2 - TOUCH_SKIN_MM, 6)
    expect(jaws.zone).toBe('mediastinum')
    const shaft = space.world.contact([{ part: 'tool-shaft', capsule: near }], LUNG_STEP, rule)
    expect(shaft.touching).toBe(false)
    expect(shaft.room).toBeCloseTo(0.2 - CLEARANCE_SKIN_MM, 6)
    expect(shaft).toMatchObject({ part: 'tool-shaft', obstacle: 'wall', zone: 'mediastinum' })
  })

  it('never authorises the lung, whatever the scenario asks', () => {
    const rule = colliderRule('extended', 'authorised', ['lung', 'mediastinum'])
    expect(rule('working-element', 'lung')).toBe('refuse')
    expect(rule('working-element', 'wall', 'mediastinum')).toBe('may-touch')
    expect(rule('working-element', 'wall', 'apex')).toBe('refuse')
    // asked about the wall as a whole, it is every region at once
    expect(rule('working-element', 'wall')).toBe('refuse')
  })
})

describe('the jaws (R8)', () => {
  const resolver = () => createResolver(regionScene().space)

  it('open only once wholly out of the channel', () => {
    const inChannel = resolver().jawStep(
      FACING,
      'open',
      LUNG_STEP,
      tool(CLOSED_IN, ['mediastinum']),
    )
    expect(inChannel.limit).toEqual({ kind: 'jaws-in-channel', part: 'working-element' })
    expect(inChannel.tool?.jaws ?? 'closed').toBe('closed')
  })

  it('are refused opening where the open jaws would meet a region they may not touch, and allowed with room', () => {
    // touching the authorised far wall, the open jaws would go into it: refused, named
    const touching = extendFully(['mediastinum']).state
    const refused = resolver().jawStep(FACING, 'open', LUNG_STEP, tool(touching, ['mediastinum']))
    expect(refused.limit).toMatchObject({
      part: 'working-element',
      kind: 'wall',
      zone: 'mediastinum',
    })
    expect(refused.tool?.jaws ?? 'closed').toBe('closed')
    // 14 mm back, still wholly out, there is room to open
    const back: ToolState = { ...touching, extensionMm: touching.extensionMm - 14 }
    expect(back.extensionMm).toBeGreaterThanOrEqual(forceps().jawLengthMm)
    const opened = resolver().jawStep(FACING, 'open', LUNG_STEP, tool(back, ['mediastinum']))
    expect(opened.limit).toBeNull()
    expect(opened.tool?.jaws).toBe('open')
    // the open jaws, extended again, touch the authorised region sooner and never go in
    const again = extendFully(['mediastinum'], opened.tool!)
    expect(again.touching).toBe(true)
    expect(again.state.extensionMm).toBeLessThan(touching.extensionMm)
    const clearance = jawsFrom('mediastinum', FACING, again.state)
    expect(clearance).toBeGreaterThanOrEqual(TOUCH_SKIN_MM - 1e-6)
    expect(clearance).toBeLessThanOrEqual(TOUCH_MM)
  })

  it('must close before the forceps come back; closing is never refused, and then withdrawal is always possible', () => {
    const touching = extendFully(['mediastinum']).state
    const back: ToolState = { ...touching, extensionMm: touching.extensionMm - 14 }
    const open = resolver().jawStep(FACING, 'open', LUNG_STEP, tool(back, ['mediastinum'])).tool!
    const blocked = resolver().toolStep(FACING, 'retract', LUNG_STEP, tool(open, ['mediastinum']))
    expect(blocked.limit).toEqual({ kind: 'jaws-open', part: 'working-element' })
    expect(blocked.tool).toEqual(open)
    const closed = resolver().jawStep(FACING, 'close', LUNG_STEP, tool(open, ['mediastinum']))
    expect(closed.limit).toBeNull()
    expect(closed.tool?.jaws).toBe('closed')
    let state = closed.tool!
    for (let n = 0; n < 30 && state.extensionMm > 0; n += 1) {
      const moved = resolver().toolStep(FACING, 'retract', LUNG_STEP, tool(state, ['mediastinum']))
      expect(moved.limit === null || moved.limit.kind === 'tool-in').toBe(true)
      state = moved.tool!
    }
    expect(state.phase).toBe('in-channel')
  })

  it('go through the reducer as a simulated action, with an event and the jaws in the state', () => {
    const r = resolver()
    let state = startEngine(r, {
      scenario: 'regions',
      lungStep: LUNG_STEP,
      pose: FACING,
      reducedMotion: true,
      snapshot: spaceSnapshot('regions', LUNG_STEP, undefined, true),
      tool: { authorised: true, regions: ['mediastinum'] },
    })
    const command = (c: SpaceCommand) =>
      reduce(state, { type: 'command', command: c, input: 'scripted', snapshot: state.snapshot }, r)
    state = command({ kind: 'jaws', action: 'open' })
    expect(state.limit).toEqual({ kind: 'jaws-in-channel', part: 'working-element' })
    for (let n = 0; n < 8; n += 1) state = command({ kind: 'tool', direction: 'extend' })
    state = command({ kind: 'jaws', action: 'open' })
    expect(state.tool?.jaws).toBe('open')
    expect(state.events.some((e) => e.kind === 'jaws-moved' && e.detail === 'open')).toBe(true)
    state = command({ kind: 'jaws', action: 'close' })
    expect(state.tool?.jaws).toBe('closed')
  })
})

describe('fuzzed, region by region (R8)', () => {
  it('never lets a part closer than its own skin, by region, over seeded sequences with the jaws', () => {
    const { space, wallByZone } = regionScene()
    const r = createResolver(space)
    const lung = judgedMesh(space.world.lung(LUNG_STEP))
    const COMMANDS: SpaceCommand[] = [
      { kind: 'tool', direction: 'extend' },
      { kind: 'tool', direction: 'extend' },
      { kind: 'tool', direction: 'retract' },
      { kind: 'jaws', action: 'open' },
      { kind: 'jaws', action: 'close' },
      { kind: 'pivot', hand: 'head' },
      { kind: 'pivot', hand: 'feet' },
      { kind: 'pivot', hand: 'front' },
      { kind: 'pivot', hand: 'back' },
      { kind: 'depth', direction: 'in' },
      { kind: 'depth', direction: 'out' },
      { kind: 'roll', direction: 'clockwise' },
    ]
    const problems: string[] = []
    let touches = 0
    for (let seed = 1; seed <= 60; seed += 1) {
      const random = seededRandom(90000 + seed)
      const zones = [...wallByZone.keys()]
      // half the sequences authorise the region straight ahead, the rest another one
      const regions: ContactRegion[] =
        seed % 2 === 0 ? ['mediastinum'] : [zones[Math.floor(random() * zones.length)]]
      let state = startEngine(r, {
        scenario: 'regions',
        lungStep: LUNG_STEP,
        pose: { ...FACING, depthMm: 85 + random() * 17 },
        reducedMotion: true,
        snapshot: spaceSnapshot('regions', LUNG_STEP, undefined, true),
        tool: { authorised: true, regions },
      })
      // out as far as they go first, then anything
      for (let k = 0; k < 50; k += 1) {
        const c: SpaceCommand =
          k < 20
            ? { kind: 'tool', direction: 'extend' }
            : COMMANDS[Math.floor(random() * COMMANDS.length)]
        state = reduce(
          state,
          { type: 'command', command: c, input: 'scripted', snapshot: state.snapshot },
          r,
        )
        const g = scopeGeometry(state.pose, space.port, space.device)
        const toolState: ToolState = {
          phase: state.tool!.phase,
          extensionMm: state.tool!.extensionMm,
          jaws: state.tool!.jaws ?? 'closed',
        }
        const { shaft, workingElement } = toolCapsules(g, toolState, forceps())
        type Part = readonly [string, Capsule]
        const parts: Part[] = [
          ['sleeve', g.sleeve],
          ...(g.shaft ? [['telescope', g.shaft] as Part] : []),
          ...(shaft ? [['tool-shaft', shaft] as Part] : []),
          ...(workingElement ? [['working-element', workingElement] as Part] : []),
        ]
        for (const [part, capsule] of parts) {
          const surfaces: [string, JudgedMesh, number][] = [
            ...[...wallByZone].map(([zone, mesh]): [string, JudgedMesh, number] => [
              zone,
              mesh,
              part === 'working-element' && regions.includes(zone)
                ? TOUCH_SKIN_MM
                : CLEARANCE_SKIN_MM,
            ]),
            ['lung', lung, CLEARANCE_SKIN_MM],
          ]
          for (const [name, mesh, skin] of surfaces) {
            const clearance = judgeSegmentMesh(mesh, capsule.start, capsule.end) - capsule.radius
            if (clearance < skin - 1e-6)
              problems.push(
                `seed ${seed}, ${JSON.stringify(c)}: ${part} ${clearance} mm from ${name}`,
              )
            if (part === 'working-element' && skin === TOUCH_SKIN_MM && clearance <= TOUCH_MM)
              touches += 1
          }
        }
      }
    }
    expect(problems).toEqual([])
    expect(touches).toBeGreaterThan(0)
  })
})

// ── The real proxies, where the owner’s local data holds them ────────────────────────────────

const root =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const packaged = join(root, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
const maybe = existsSync(packaged) ? it : it.skip
const bytes = (id: string) =>
  readFileSync(join(packaged, anatomyManifest.files.find((f) => f.id === id)?.file ?? ''))

describe('the forceps on the real proxies (R2, R8)', () => {
  maybe(
    'out, pivoted, jaws opened and closed, and back: 150 seeded sequences judged along every move, nothing wrong',
    () => {
      const space = loadSpace(bytes('proxy-pleural-space'), bytes('proxy-lung'))
      const target = {
        space,
        wall: judgedMesh(
          space.world.space,
          (a, b, c) => judgePointTriangle(space.port.pleura, a, b, c) >= PORT_EXCLUSION_MM,
        ),
        whole: judgedMesh(space.world.space),
        lungs: Array.from({ length: space.world.lungStepCount }, (_, k) =>
          judgedMesh(space.world.lung(k)),
        ),
      }
      const run = fuzzForceps(target, { seeds: 150, firstSeed: 80001, commands: 12, lungStep: 8 })
      expect(run.problems).toEqual([])
      expect(run.stopped).toBeGreaterThan(0)
      expect(run.insideChecks).toBeGreaterThan(0)
    },
    600000,
  )
})
