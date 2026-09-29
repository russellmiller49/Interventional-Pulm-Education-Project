/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  ledgerProblems,
  type PIVOT_HAND_DIRECTIONS,
  type ScopePose,
  type SpaceCommand,
} from '../components/space/types'
import { portRecord, zoneReach, zoneSamples as zoneSamplesRecord } from '../content/anatomy'
import { anatomyManifest } from '../content/data/generated/anatomy'
import { PLEURAL_ZONE_IDS } from '../content/pleuralZones'
import {
  AUTHORISATIONS,
  CONTACT_PARTS,
  CONTACT_REGIONS,
  CONTACT_TABLE,
  TOOL_PHASES,
} from '../engine/space/contactPolicy'
import { addView, emptyCoverage, ledgerFrom, type Coverage } from '../engine/space/coverage'
import { crossSectionOf } from '../engine/space/crossSection'
import {
  acrossRibsLimitDeg,
  cameraRight,
  scopeGeometry,
  sleeveTipDepth,
  tiltAllowed,
} from '../engine/space/fulcrum'
import { AUTHORED_INSTRUMENT_VALUES, instrument } from '../engine/space/instrument'
import { createResolver, loadSpace, type LoadedSpace } from '../engine/space/loadSpace'
import { OUTCOME_EVENTS, outcomeStanding } from '../engine/space/outcomes'
import { paneStateOf } from '../engine/space/paneState'
import { portFrame } from '../engine/space/portDefinition'
import { spaceSnapshot } from '../engine/space/spaceSnapshot'
import {
  isSimulatedAction,
  LUNG_STEP_MS,
  reduce,
  startEngine,
  type EngineState,
  type SimulatedAction,
} from '../engine/space/spaceReducer'
import { replay, type TimedAction } from '../engine/space/spaceReplay'
import { LIMIT_WORDS, wallWords } from '../engine/space/spaceWords'
import { CLEARANCE_SKIN_MM } from '../engine/space/spatial/spatialWorld'
import { advance, stepTarget, takeStep } from '../engine/space/spatial/sweep'
import type { ZoneSamples } from '../engine/space/spatial/visibility'
import { VIEW } from '../engine/space/spatial/visibility'
import { cross, dot, length, radians, rotate, sub, type Vec3 } from '../engine/space/vec'
import { computeReach, currentReach, reachIdentity } from '../engine/space/zoneReach'
import {
  fastJudgeSegmentTriangle,
  judgeSegmentTriangle,
  seededRandom,
} from '../test-support/spaceFixtures'
import {
  JUDGE_TOLERANCE_MM,
  judgeInstrument,
  randomStart,
  scene,
  SCENE_KINDS,
} from '../test-support/spaceScenes'

/**
 * The space engine (slice 10) end to end: the fulcrum on the port of the records; the sweep on
 * analytic scenes, judged by a brute force that shares no code with the collider; the reducer and
 * its replay; the ledger, the contact table, the outcomes, the cross-section and the pane state.
 * Where the owner's local data holds the proxies, the same checks run on them.
 */

type Point = [number, number, number]
const JUDGE_TOLERANCE = JUDGE_TOLERANCE_MM

describe('the fast judge', () => {
  it('agrees with the slow judge, crossing or not', () => {
    const random = seededRandom(3)
    const point = (): Point => [random() * 40 - 20, random() * 40 - 20, random() * 40 - 20]
    let crossing = 0
    for (let n = 0; n < 3000; n += 1) {
      const [a, b, c] = [point(), point(), point()]
      let p0 = point()
      let p1 = point()
      if (n % 3 === 0) {
        // through a point inside the triangle
        const u = random()
        const v = random() * (1 - u)
        const inside: Point = [0, 1, 2].map(
          (i) => a[i] + u * (b[i] - a[i]) + v * (c[i] - a[i]),
        ) as Point
        const d = point()
        p0 = [inside[0] - d[0], inside[1] - d[1], inside[2] - d[2]]
        p1 = [inside[0] + d[0], inside[1] + d[1], inside[2] + d[2]]
      }
      const fast = fastJudgeSegmentTriangle(p0, p1, a, b, c)
      if (fast === 0) crossing += 1
      expect(Math.abs(fast - judgeSegmentTriangle(p0, p1, a, b, c))).toBeLessThan(1e-6)
    }
    expect(crossing).toBeGreaterThanOrEqual(1000)
  })
})

describe('the fulcrum, on the port of the records', () => {
  const port = portFrame()
  const device = instrument()
  const at = (pose: Partial<ScopePose>) =>
    scopeGeometry(
      { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 30, rollDeg: 0, ...pose },
      port,
      device,
    )

  it('turns the axis across the ribs toward the head, and along them toward the front', () => {
    expect(dot(at({}).axis, port.inward)).toBeCloseTo(1, 12)
    const across = at({ tiltAcrossRibsDeg: 10 }).axis
    expect(dot(across, port.acrossRibs)).toBeCloseTo(Math.sin(radians(10)), 12)
    expect(dot(across, port.alongRibs)).toBeCloseTo(0, 12)
    const along = at({ tiltAlongRibsDeg: 10 }).axis
    expect(dot(along, port.alongRibs)).toBeCloseTo(Math.sin(radians(10)), 12)
    // along the ribs is toward the patient's front, in LPS −y
    expect(port.alongRibs[1]).toBeLessThan(0)
    expect(port.acrossRibs[2]).toBeGreaterThan(0)
  })

  it('limits the tilt across the ribs where the sleeve fills the measured gap', () => {
    expect(port.ribGapMm).toBe(portRecord.ribGapMm)
    expect(port.ribDepthMm).toBe(portRecord.ribDepthMm)
    expect(Object.keys(AUTHORED_INSTRUMENT_VALUES)).not.toContain('ribDepthMm')
    const limit = radians(acrossRibsLimitDeg(port, device))
    const filled = (2 * device.sleeveRadiusMm) / Math.cos(limit) + port.ribDepthMm * Math.tan(limit)
    expect(filled).toBeCloseTo(port.ribGapMm, 6)
  })

  it('allows the tilts inside the ellipse and nothing outside it', () => {
    const a = acrossRibsLimitDeg(port, device)
    const b = device.alongRibsLimitDeg
    const pose = (across: number, along: number): ScopePose => ({
      tiltAcrossRibsDeg: across,
      tiltAlongRibsDeg: along,
      depthMm: 20,
      rollDeg: 0,
    })
    expect(tiltAllowed(pose(a, 0), port, device)).toBe(true)
    expect(tiltAllowed(pose(a + 0.01, 0), port, device)).toBe(false)
    expect(tiltAllowed(pose(0, -b), port, device)).toBe(true)
    expect(tiltAllowed(pose(a * Math.SQRT1_2, b * Math.SQRT1_2), port, device)).toBe(true)
    expect(tiltAllowed(pose(a * 0.72, b * 0.72), port, device)).toBe(false)
  })

  it('runs the sleeve from the pleura to its tip, and the telescope on beyond it', () => {
    const sleeveEnd = sleeveTipDepth(port, device)
    const inside = at({ depthMm: sleeveEnd })
    expect(inside.shaft).toBeNull()
    expect(dot(sub(inside.sleeve.start, port.pivot), port.inward)).toBeCloseTo(
      port.pleuraDepthMm,
      9,
    )
    expect(length(sub(inside.sleeve.end, port.pivot))).toBeCloseTo(sleeveEnd, 9)
    const out = at({ depthMm: sleeveEnd + 10 })
    expect(out.shaft?.start).toEqual(out.sleeve.end)
    expect(out.shaft?.end).toEqual(out.tip)
    expect(out.shaft?.radius).toBe(device.shaftRadiusMm)
    expect(out.sleeve.radius).toBe(device.sleeveRadiusMm)
  })

  it('puts the optic on the tip, off the axis, the picture’s up toward the head at no roll', () => {
    const g = at({})
    const offset = sub(g.camera.origin, g.tip)
    expect(length(offset)).toBeCloseTo(device.opticOffsetMm, 9)
    expect(dot(g.camera.up, g.axis)).toBeCloseTo(0, 12)
    expect(dot(g.camera.up, port.acrossRibs)).toBeCloseTo(1, 9)
    const rolled = at({ rollDeg: 90 })
    expect(dot(rolled.camera.up, g.camera.up)).toBeCloseTo(0, 9)
    expect(rolled.camera.up).toEqual(
      rotate(g.camera.up, g.axis, radians(90)).map((v) => expect.closeTo(v, 9)),
    )
    expect(cameraRight(g.camera)).toEqual(cross(g.camera.forward, g.camera.up))
  })
})

describe('the hand and the tip move opposite ways', () => {
  const port = portFrame()
  const device = instrument()
  const start: ScopePose = { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 40, rollDeg: 0 }
  const tipMoves = (hand: (typeof PIVOT_HAND_DIRECTIONS)[number]): Vec3 =>
    sub(
      scopeGeometry(stepTarget(start, { kind: 'pivot', hand }), port, device).tip,
      scopeGeometry(start, port, device).tip,
    )

  it.each([
    ['head', 'feet', -1, 0],
    ['feet', 'head', 1, 0],
    ['front', 'back', 0, -1],
    ['back', 'front', 0, 1],
  ] as const)(
    'the hand to the %s swings the tip to the %s',
    (hand, _tip, acrossSign, alongSign) => {
      const moved = tipMoves(hand)
      if (acrossSign !== 0) expect(Math.sign(dot(moved, port.acrossRibs))).toBe(acrossSign)
      if (alongSign !== 0) expect(Math.sign(dot(moved, port.alongRibs))).toBe(alongSign)
    },
  )
})

describe('the sweep, on analytic scenes', () => {
  it.each(SCENE_KINDS)(
    'the %s scene is closed and outward, and leaves the port’s patch out of the wall',
    (kind) => {
      const { space, wall } = scene(kind)
      expect(space.world.wallIndex.mesh.indices.length / 3).toBe(wall.triangles.length)
      // the engine and the judge, each by its own rule, leave out the same triangles around the port
      expect(space.world.space.indices.length / 3 - wall.triangles.length).toBeGreaterThan(0)
    },
  )

  it('stops short of a plate thinner than any step, however large the move', () => {
    const { space, wall, lungs } = scene('plate')
    const from: ScopePose = { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 12, rollDeg: 0 }
    for (const depthMm of [48, 80, 140]) {
      const moved = advance(space.world, space.port, space.device, from, { ...from, depthMm }, 0)
      expect(moved.limit).toMatchObject({ kind: 'lung', part: 'telescope' })
      const tip = scopeGeometry(moved.pose, space.port, space.device).tip
      expect(tip[0]).toBeLessThan(44.75 - space.device.shaftRadiusMm)
      expect(
        judgeInstrument(wall, lungs[0], scopeGeometry(moved.pose, space.port, space.device)),
      ).toBeGreaterThanOrEqual(CLEARANCE_SKIN_MM - JUDGE_TOLERANCE)
    }
  })

  it('stops a large turn at the ring, both tilts at once', () => {
    const { space, wall, lungs } = scene('torus')
    const resolver = createResolver(space)
    const random = seededRandom(99)
    for (let n = 0; n < 200; n += 1) {
      const from = randomStart(random, space, resolver, 0, 90)
      const to: ScopePose = {
        tiltAcrossRibsDeg: (random() * 2 - 1) * 25,
        tiltAlongRibsDeg: (random() * 2 - 1) * 35,
        depthMm: space.depthLimits[0] + random() * 100,
        rollDeg: from.rollDeg,
      }
      const moved = advance(space.world, space.port, space.device, from, to, 0)
      expect(
        judgeInstrument(wall, lungs[0], scopeGeometry(moved.pose, space.port, space.device)),
      ).toBeGreaterThanOrEqual(CLEARANCE_SKIN_MM - JUDGE_TOLERANCE)
    }
  })

  it('refuses at the ribs, at the end of the telescope’s travel and back in the sleeve, naming the part', () => {
    const { space } = scene('spheres')
    const { world, port, device, depthLimits } = space
    let pose: ScopePose = { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 20, rollDeg: 0 }
    let limit = null
    for (let n = 0; n < 40 && !limit; n += 1) {
      const step = takeStep(
        world,
        port,
        device,
        pose,
        { kind: 'pivot', hand: 'feet' },
        2,
        depthLimits,
      )
      pose = step.pose
      limit = step.limit
    }
    expect(limit).toEqual({ kind: 'ribs', part: 'sleeve' })
    expect(pose.tiltAcrossRibsDeg).toBeCloseTo(acrossRibsLimitDeg(port, device), 6)

    const shallow = takeStep(
      world,
      port,
      device,
      { ...pose, tiltAcrossRibsDeg: 0, depthMm: depthLimits[0] },
      { kind: 'depth', direction: 'out' },
      2,
      depthLimits,
    )
    expect(shallow.limit).toEqual({ kind: 'back-in-sleeve', part: 'telescope' })

    const short: readonly [number, number] = [depthLimits[0], 25]
    const deep = takeStep(
      world,
      port,
      device,
      { ...pose, tiltAcrossRibsDeg: 0, depthMm: 24 },
      { kind: 'depth', direction: 'in' },
      2,
      short,
    )
    expect(deep).toEqual({
      pose: expect.objectContaining({ depthMm: 25 }),
      limit: { kind: 'fully-in', part: 'telescope' },
    })
  })

  it('names the region of the wall it stopped against', () => {
    const { space } = scene('spheres')
    const resolver = createResolver(space)
    let state = startEngine(resolver, {
      scenario: 'test scene',
      lungStep: 2,
      pose: { tiltAcrossRibsDeg: 20, tiltAlongRibsDeg: 0, depthMm: 20, rollDeg: 0 },
      reducedMotion: false,
      snapshot: spaceSnapshot('test scene', 2),
    })
    for (let n = 0; n < 80 && !state.limit; n += 1) {
      state = reduce(
        state,
        {
          type: 'command',
          command: { kind: 'depth', direction: 'in' },
          input: 'scripted',
          snapshot: state.snapshot,
        },
        resolver,
      )
    }
    expect(state.limit?.kind).toBe('wall')
    // turned toward the head, it runs on to the far wall, the mediastinum's
    if (state.limit?.kind !== 'wall') return
    expect(space.triangleZones[state.limit.triangle]).toBe('mediastinum')
    const pane = paneStateOf(state, space, null)
    expect(pane.refusal).toEqual({ part: 'The telescope', words: wallWords('mediastinum') })
  })
})

// ── The reducer ────────────────────────────────────────────────────────────────────────────────

function sceneEngine(
  options: { lungStep?: number; reducedMotion?: boolean; pose?: Partial<ScopePose> } = {},
) {
  const { space } = scene('spheres')
  const resolver = createResolver(space)
  const lungStep = options.lungStep ?? 0
  const state = startEngine(resolver, {
    scenario: 'test scene',
    lungStep,
    pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 20, rollDeg: 0, ...options.pose },
    reducedMotion: options.reducedMotion ?? false,
    snapshot: spaceSnapshot('test scene', lungStep),
  })
  return { space, resolver, state }
}

const command = (state: EngineState, c: SpaceCommand): SimulatedAction => ({
  type: 'command',
  command: c,
  input: 'scripted',
  snapshot: state.snapshot,
})
const IN: SpaceCommand = { kind: 'depth', direction: 'in' }
const OUT: SpaceCommand = { kind: 'depth', direction: 'out' }

describe('the engine’s state', () => {
  it('is plain data that survives a round trip through JSON', () => {
    const { state } = sceneEngine()
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })

  it('takes only simulated actions: navigating or loading an example is not a procedure event', () => {
    const { state, resolver } = sceneEngine()
    expect(isSimulatedAction({ type: 'navigate' })).toBe(false)
    expect(isSimulatedAction({ type: 'motion' })).toBe(true)
    expect(isSimulatedAction({ type: 'load-teaching-example' })).toBe(false)
    expect(() =>
      reduce(state, { type: 'navigate', to: 'x' } as unknown as SimulatedAction, resolver),
    ).toThrow(/Only a simulated action/)
  })

  it('will not start the telescope outside the space or through the lung', () => {
    const { resolver } = sceneEngine()
    const snapshot = spaceSnapshot('test scene', 0)
    const start = (pose: ScopePose) => () =>
      startEngine(resolver, {
        scenario: 'test scene',
        lungStep: 0,
        pose,
        reducedMotion: false,
        snapshot,
      })
    expect(start({ tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 60, rollDeg: 0 })).toThrow(
      /not clear/,
    )
    expect(
      start({ tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 20, rollDeg: 0 }),
    ).not.toThrow()
  })

  it('changes nothing for a command issued against another snapshot', () => {
    const { state, resolver } = sceneEngine()
    const stale: SimulatedAction = {
      type: 'command',
      command: IN,
      input: 'scripted',
      snapshot: { ...state.snapshot, lungAndFluid: 'lung step 1' },
    }
    expect(reduce(state, stale, resolver)).toBe(state)
  })

  it('takes two commands in the same millisecond as two steps, the same way every time', () => {
    const { state, resolver } = sceneEngine()
    const twice = reduce(reduce(state, command(state, IN), resolver), command(state, IN), resolver)
    expect(twice.pose.depthMm).toBeCloseTo(24, 9)
    expect(twice.events.map((e) => [e.atMs, e.kind])).toEqual([
      [0, 'moved'],
      [0, 'moved'],
    ])
    const again = reduce(reduce(state, command(state, IN), resolver), command(state, IN), resolver)
    expect(again).toEqual(twice)
  })

  it('accepts only whole milliseconds on the clock', () => {
    const { state, resolver } = sceneEngine()
    expect(() => reduce(state, { type: 'tick', ms: 1.5 }, resolver)).toThrow(/whole/)
    expect(() => reduce(state, { type: 'tick', ms: -1 }, resolver)).toThrow(/whole/)
  })

  it('moves the lung a step at a time on the clock, each stamped when it was due', () => {
    const { state, resolver } = sceneEngine()
    let s = reduce(state, { type: 'lung-target', step: 2 }, resolver)
    s = reduce(s, { type: 'tick', ms: 1000 }, resolver)
    expect(s.lungStep).toBe(2)
    expect(s.snapshot.lungAndFluid).toBe('lung step 2')
    expect(s.events).toEqual([
      { atMs: LUNG_STEP_MS, kind: 'lung-moved', detail: 'step 1' },
      { atMs: 2 * LUNG_STEP_MS, kind: 'lung-moved', detail: 'step 2' },
    ])
    expect(s.nextLungMoveAtMs).toBeNull()
  })

  it('holds the lung where the instrument is in its way, says so, and lets it go on once there is room', () => {
    const { state, resolver } = sceneEngine({ lungStep: 2 })
    let s = state
    for (let n = 0; n < 20; n += 1) s = reduce(s, command(s, IN), resolver)
    expect(s.limit).toBeNull()
    s = reduce(s, { type: 'lung-target', step: 0 }, resolver)
    s = reduce(s, { type: 'tick', ms: 2000 }, resolver)
    expect(s.lungHeld).toBe(true)
    expect(s.lungStep).toBe(2)
    expect(s.events.filter((e) => e.kind === 'lung-held')).toEqual([
      { atMs: LUNG_STEP_MS, kind: 'lung-held', detail: 'step 2' },
    ])
    expect(paneStateOf(s, sceneEngine().space, null).refusal).toEqual({
      part: 'The lung',
      words: LIMIT_WORDS.lungHeld,
    })
    for (let n = 0; n < 16 && s.lungStep !== 0; n += 1) {
      s = reduce(s, command(s, OUT), resolver)
      s = reduce(s, { type: 'tick', ms: LUNG_STEP_MS }, resolver)
    }
    expect(s.lungStep).toBe(0)
    expect(s.lungHeld).toBe(false)
  })

  it('under reduced motion, holds the clock and moves the lung only on Step', () => {
    const { state, resolver } = sceneEngine({ reducedMotion: true })
    let s = reduce(state, { type: 'lung-target', step: 2 }, resolver)
    expect(s.clockHeld).toBe(true)
    expect(s.events.at(-1)).toEqual({ atMs: 0, kind: 'lung-waits', detail: 'toward step 2' })
    s = reduce(s, { type: 'tick', ms: 5000 }, resolver)
    expect(s.lungStep).toBe(0)
    s = reduce(s, command(s, { kind: 'step-clock' }), resolver)
    expect(s.lungStep).toBe(1)
    expect(s.clockHeld).toBe(true)
    s = reduce(s, command(s, { kind: 'step-clock' }), resolver)
    expect(s.lungStep).toBe(2)
    expect(s.clockHeld).toBe(false)
    expect(paneStateOf(s, sceneEngine().space, null).clock).toEqual({ held: false })
  })

  it('follows the motion preference while the space is open: reduced holds the clock, released lets it run', () => {
    const { state, resolver } = sceneEngine()
    let s = reduce(state, { type: 'lung-target', step: 2 }, resolver)
    s = reduce(s, { type: 'tick', ms: 500 }, resolver)
    expect(s.lungStep).toBe(1)
    s = reduce(s, { type: 'motion', reduced: true }, resolver)
    expect(s.clockHeld).toBe(true)
    s = reduce(s, { type: 'tick', ms: 5000 }, resolver)
    expect(s.lungStep).toBe(1)
    s = reduce(s, { type: 'motion', reduced: false }, resolver)
    expect(s.clockHeld).toBe(false)
    s = reduce(s, { type: 'tick', ms: LUNG_STEP_MS }, resolver)
    expect(s.lungStep).toBe(2)
    expect(s.events.at(-1)).toEqual({
      atMs: 5500 + LUNG_STEP_MS,
      kind: 'lung-moved',
      detail: 'step 2',
    })
    expect(reduce(s, { type: 'motion', reduced: false }, resolver)).toBe(s)
  })

  it('starts afresh when a scenario is reset mid-way through the lung’s move', () => {
    const { state, resolver } = sceneEngine()
    const moving = reduce(
      reduce(state, { type: 'lung-target', step: 2 }, resolver),
      { type: 'tick', ms: 500 },
      resolver,
    )
    expect(moving.lungStep).toBe(1)
    const reset = startEngine(resolver, {
      scenario: 'test scene',
      lungStep: 0,
      pose: state.pose,
      reducedMotion: false,
      snapshot: spaceSnapshot('test scene', 0),
    })
    const later = reduce(reset, { type: 'tick', ms: 5000 }, resolver)
    expect(later.lungStep).toBe(0)
    expect(later.events).toEqual([])
    // the old state's command is stale for the new one only if its snapshot differs; the lung's does
    expect(reduce(later, { ...command(moving, IN) }, resolver)).toBe(later)
  })
})

describe('replay', () => {
  const script: TimedAction[] = [
    { atMs: 0, action: { type: 'lung-target', step: 2 } },
    { atMs: 50, action: { type: 'command', command: IN, input: 'scripted' } },
    {
      atMs: 120,
      action: { type: 'command', command: { kind: 'pivot', hand: 'head' }, input: 'scripted' },
    },
    {
      atMs: 120,
      action: { type: 'command', command: { kind: 'pivot', hand: 'head' }, input: 'scripted' },
    },
    {
      atMs: 700,
      action: {
        type: 'command',
        command: { kind: 'roll', direction: 'clockwise' },
        input: 'scripted',
      },
    },
    { atMs: 1000, action: { type: 'lung-target', step: 0 } },
    ...Array.from(
      { length: 16 },
      (_, i): TimedAction => ({
        atMs: 1010 + i * 5,
        action: { type: 'command', command: IN, input: 'scripted' },
      }),
    ),
    ...Array.from(
      { length: 12 },
      (_, i): TimedAction => ({
        atMs: 2500 + i * 37,
        action: { type: 'command', command: OUT, input: 'scripted' },
      }),
    ),
  ]
  const schedules: [string, (clock: number) => number][] = [
    ['every 16 ms', () => 16],
    ['every 400 ms', () => 400],
    [
      'at seeded random intervals',
      (() => {
        const random = seededRandom(5)
        return () => 1 + Math.floor(random() * 97)
      })(),
    ],
    ['in one tick to each action', () => 1e9],
  ]

  it('gives the same state and the same events under four schedules of ticks', () => {
    const { state, resolver } = sceneEngine()
    const results = schedules.map(([, tick]) => replay(state, script, resolver, tick, 6000))
    const kinds = new Set(results[0].events.map((e) => e.kind))
    expect([...kinds].sort()).toEqual(['lung-held', 'lung-moved', 'moved'])
    for (const result of results.slice(1)) expect(result).toEqual(results[0])
    expect(results[0].lungStep).toBe(0)
  })
})

// ── The ledger ─────────────────────────────────────────────────────────────────────────────────

describe('the ledger', () => {
  const samples: ZoneSamples = {
    zones: PLEURAL_ZONE_IDS.flatMap((zone) => [zone, zone]),
    points: new Float32Array(PLEURAL_ZONE_IDS.length * 6),
    normals: new Float32Array(PLEURAL_ZONE_IDS.length * 6),
  }
  const index = (zone: (typeof PLEURAL_ZONE_IDS)[number], k: 0 | 1) =>
    PLEURAL_ZONE_IDS.indexOf(zone) * 2 + k
  const coverageWith = (seen: number[], hidden: number[]): Coverage => {
    const c = emptyCoverage(samples.zones.length)
    return {
      seen: c.seen.map((_, s) => (seen.includes(s) ? 1 : 0)),
      hidden: c.hidden.map((_, s) => (hidden.includes(s) ? 1 : 0)),
    }
  }

  it('calls a region seen only when every sample has been seen', () => {
    const d = (k: 0 | 1) => index('diaphragm', k)
    const ledger = ledgerFrom(coverageWith([d(0), d(1)], []), samples, null)
    expect(ledger[0]).toEqual({ zone: 'diaphragm', seen: 'seen', reason: null })
    expect(ledgerFrom(coverageWith([d(0)], []), samples, null)[0]).toEqual({
      zone: 'diaphragm',
      seen: 'partly-seen',
      reason: 'not-looked-at',
    })
  })

  it('gives the reason the learner can still act on: not looked at, then hidden, then out of reach', () => {
    const a = (k: 0 | 1) => index('apex', k)
    const all = samples.zones.map(() => 1)
    const entry = (coverage: Coverage, reach: readonly number[] | null) =>
      ledgerFrom(coverage, samples, reach).find((e) => e.zone === 'apex')
    // one sample never in the field, one hidden: not looked at wins
    expect(entry(coverageWith([], [a(1)]), all)).toEqual({
      zone: 'apex',
      seen: 'not-seen',
      reason: 'not-looked-at',
    })
    // both in the field, both blocked: hidden
    expect(entry(coverageWith([], [a(0), a(1)]), all)).toEqual({
      zone: 'apex',
      seen: 'not-seen',
      reason: 'hidden',
    })
    // one seen, the other out of every field
    const reach = all.map((v, s) => (s === a(1) ? 0 : v))
    expect(entry(coverageWith([a(0)], []), reach)).toEqual({
      zone: 'apex',
      seen: 'partly-seen',
      reason: 'out-of-reach',
    })
    // without a reach record the ledger never says out of reach
    expect(entry(coverageWith([a(0)], []), null)?.reason).toBe('not-looked-at')
  })

  it('always keeps the pane contract', () => {
    const random = seededRandom(17)
    for (let n = 0; n < 500; n += 1) {
      const pick = () => samples.zones.flatMap((_, s) => (random() < 0.4 ? [s] : []))
      const reach = random() < 0.3 ? null : samples.zones.map(() => (random() < 0.8 ? 1 : 0))
      expect(ledgerProblems(ledgerFrom(coverageWith(pick(), pick()), samples, reach))).toEqual([])
    }
  })

  it('keeps a sample seen once, whatever later views say', () => {
    const view = new Uint8Array(samples.zones.length)
    view[0] = VIEW.inView
    const once = addView(emptyCoverage(samples.zones.length), view)
    const later = addView(once, new Uint8Array(samples.zones.length).fill(VIEW.hidden))
    expect(later.seen[0]).toBe(1)
    expect(later.hidden[0]).toBe(1)
    expect(ledgerFrom(later, samples, null)[0].seen).toBe('partly-seen')
  })
})

describe('reach', () => {
  it('is what the field can take in from some position, whatever is in the way', () => {
    const { space } = scene('spheres')
    const resolver = createResolver(space)
    const { reach, seeable } = computeReach(space, resolver, 0, {
      tiltStepDeg: 8,
      depthStepMm: 12,
      rollsDeg: [0],
    })
    const zoneOf = (zone: string) => space.samples.zones.flatMap((z, s) => (z === zone ? [s] : []))
    // a straight telescope cannot turn back to the wall it passes through
    expect(zoneOf('lateral-chest-wall').every((s) => reach[s] === 0)).toBe(true)
    // the far wall is in reach; behind the lung, some of it is not seeable
    const far = zoneOf('mediastinum')
    expect(far.filter((s) => reach[s]).length).toBeGreaterThan(far.length / 2)
    expect(far.filter((s) => seeable[s]).length).toBeLessThan(far.filter((s) => reach[s]).length)
    expect(seeable.every((v, s) => v <= reach[s])).toBe(true)
    const state = startEngine(resolver, {
      scenario: 'test scene',
      lungStep: 0,
      pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 20, rollDeg: 0 },
      reducedMotion: false,
      snapshot: spaceSnapshot('test scene', 0),
    })
    const lateral = ledgerFrom(state.coverage, space.samples, Array.from(reach)).find(
      (e) => e.zone === 'lateral-chest-wall',
    )
    expect(lateral).toEqual({
      zone: 'lateral-chest-wall',
      seen: 'not-seen',
      reason: 'out-of-reach',
    })
  })

  it('is recorded for the snapshot the engine would compute it for now, one digit a sample', () => {
    expect(zoneReach.computedFor).toEqual(reachIdentity(zoneReach.lungStep))
    expect(zoneReach.reachable).toHaveLength(zoneSamplesRecord.total)
    expect(currentReach(zoneSamplesRecord.total)).toHaveLength(zoneSamplesRecord.total)
    expect(zoneReach.zones.map((z) => [z.id, z.samples])).toEqual(
      zoneSamplesRecord.zones.map((z) => [z.id, z.points]),
    )
    const ones = [...zoneReach.reachable].filter((d) => d === '1').length
    expect(zoneReach.zones.reduce((sum, z) => sum + z.reachable, 0)).toBe(ones)
    for (const zone of zoneReach.zones) expect(zone.seeable).toBeLessThanOrEqual(zone.reachable)
    expect(zoneReach.files['proxy-pleural-space']).toBe(
      anatomyManifest.files.find((f) => f.id === 'proxy-pleural-space')?.sha256,
    )
  })

  it('is not used for another snapshot, so the ledger never says out of reach from stale inputs', () => {
    const stale = {
      ...zoneReach,
      computedFor: { ...zoneReach.computedFor, optics: 'viewRangeMm=1' },
    }
    expect(currentReach(zoneSamplesRecord.total, stale)).toBeNull()
    expect(currentReach(zoneSamplesRecord.total - 1)).toBeNull()
  })
})

// ── Contact, outcomes, snapshot ────────────────────────────────────────────────────────────────

describe('contact', () => {
  it('has one row for every part, region, phase of the tool and authorisation', () => {
    expect(CONTACT_TABLE).toHaveLength(
      CONTACT_PARTS.length * CONTACT_REGIONS.length * TOOL_PHASES.length * AUTHORISATIONS.length,
    )
    const keys = new Set(
      CONTACT_TABLE.map((row) => [row.part, row.region, row.phase, row.authorisation].join('|')),
    )
    expect(keys.size).toBe(CONTACT_TABLE.length)
    expect(CONTACT_REGIONS).toEqual([...PLEURAL_ZONE_IDS, 'lung', 'teaching-target'])
  })

  it('lets only the extended working element touch an authorised teaching target', () => {
    expect(CONTACT_TABLE.filter((row) => row.rule === 'may-touch')).toEqual([
      {
        part: 'working-element',
        region: 'teaching-target',
        phase: 'extended',
        authorisation: 'authorised',
        rule: 'may-touch',
      },
    ])
  })
})

describe('outcomes', () => {
  it('models no clinical consequence; the lung falling away is authored, awaiting review and blocks publication', () => {
    for (const event of OUTCOME_EVENTS) {
      const standing = outcomeStanding(event)
      if (event === 'lung-falls-away') {
        expect(standing).toEqual({
          kind: 'authored-awaiting-review',
          claims: ['MT-C-0001', 'MT-C-0002'],
          label: 'Authored, illustrative',
          blocksPublication: true,
        })
      } else expect(standing).toEqual({ kind: 'not-modelled' })
    }
  })
})

describe('the snapshot', () => {
  it('names the anatomy, the device, the authored optics, the port and the proxies by their files', () => {
    const snapshot = spaceSnapshot('survey', 8)
    expect(snapshot.port).toBe(anatomyManifest.records['port-record.json'].slice(0, 12))
    expect(snapshot.optics).toBe('sleeveBeyondPleuraMm=5;viewRangeMm=200;alongRibsLimitDeg=40')
    expect(snapshot.lungAndFluid).toBe('lung step 8')
    expect(snapshot.geometry).toMatch(/^[0-9a-f]{12}\+[0-9a-f]{12}$/)
  })
})

// ── What the panes are given ───────────────────────────────────────────────────────────────────

describe('the pane state', () => {
  it('keeps the slice-9 contract: a ledger for every region, words for a refusal, a cut when ready', () => {
    const { state, space, resolver } = sceneEngine()
    const ready = paneStateOf(state, space, null)
    expect(ledgerProblems(ready.ledger)).toEqual([])
    expect(ready.refusal).toBeNull()
    expect(ready.crossSection?.seenFrom).toBe(
      'Seen from the patient’s front, with the head to the right.',
    )
    expect(
      paneStateOf(state, space, null, { kind: 'loading', what: 'the chest' }).crossSection,
    ).toBeNull()
    let s = state
    for (let n = 0; n < 60 && !s.limit; n += 1) s = reduce(s, command(s, IN), resolver)
    const stopped = paneStateOf(s, space, null)
    expect(stopped.refusal?.part).toBe('The telescope')
    expect(Object.values(LIMIT_WORDS)).toContain(stopped.refusal?.words)
    expect(JSON.parse(JSON.stringify(stopped))).toEqual(stopped)
  })

  it('draws the cut through the telescope from the engine’s own geometry', () => {
    const { state, space } = sceneEngine()
    const cut = crossSectionOf(space, state.pose, 0)
    expect(cut.port).toEqual([0, 0])
    expect(cut.tip[0]).toBeCloseTo(0, 2)
    expect(cut.tip[1]).toBeCloseTo(-20, 2)
    expect(cut.lung.length).toBeGreaterThanOrEqual(1)
    const loop = cut.lung[0]
    expect(loop[0]).toEqual(loop[loop.length - 1])
    const zones = new Set(cut.wall.map((run) => run.zone))
    expect([...zones].every((zone) => PLEURAL_ZONE_IDS.includes(zone))).toBe(true)
    expect(zones.has('apex')).toBe(true)
    expect(zones.has('mediastinum')).toBe(true)
  })
})

// ── The real proxies ───────────────────────────────────────────────────────────────────────────

describe('the real proxies, where the owner’s local data holds them', () => {
  const root =
    process.env.IP_LOCAL_DATA?.trim() ||
    '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
  const packaged = join(root, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
  const available = existsSync(packaged)
  const bytes = (id: string) =>
    readFileSync(join(packaged, anatomyManifest.files.find((f) => f.id === id)?.file ?? ''))
  const maybe = available ? it : it.skip
  let loaded: LoadedSpace | null = null
  const space = () => (loaded ??= loadSpace(bytes('proxy-pleural-space'), bytes('proxy-lung')))

  maybe('gives the pane a state that keeps the contract, with the record’s reach', () => {
    const s = space()
    const resolver = createResolver(s)
    const state = startEngine(resolver, {
      scenario: 'survey',
      lungStep: 8,
      pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 12, rollDeg: 0 },
      reducedMotion: false,
      snapshot: spaceSnapshot('survey', 8),
    })
    const reach = currentReach(resolver.sampleCount)
    expect(reach).not.toBeNull()
    const pane = paneStateOf(state, s, reach)
    expect(ledgerProblems(pane.ledger)).toEqual([])
    expect(pane.ledger.find((e) => e.zone === 'lateral-chest-wall')?.reason).toBe('not-looked-at')
    expect(pane.crossSection?.wall.length).toBeGreaterThan(0)
    expect(pane.crossSection?.lung.length).toBeGreaterThan(0)
  })
})
