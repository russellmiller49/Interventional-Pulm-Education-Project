/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PIVOT_HAND_DIRECTIONS, type ScopePose, type SpaceCommand } from '../components/space/types'
import { toolContact } from '../content/anatomy'
import { anatomyManifest } from '../content/data/generated/anatomy'
import { PLEURAL_ZONE_IDS } from '../content/pleuralZones'
import {
  AUTHORISATIONS,
  colliderRule,
  CONTACT_PARTS,
  contactRule,
  TOOL_PHASES,
} from '../engine/space/contactPolicy'
import { scopeGeometry } from '../engine/space/fulcrum'
import { createResolver, loadSpace, type SpaceResolver } from '../engine/space/loadSpace'
import { paneStateOf } from '../engine/space/paneState'
import { spaceSnapshot } from '../engine/space/spaceSnapshot'
import { reduce, startEngine, type EngineState } from '../engine/space/spaceReducer'
import { replay, type TimedAction } from '../engine/space/spaceReplay'
import { LIMIT_WORDS, refusalOf } from '../engine/space/spaceWords'
import type { Capsule } from '../engine/space/spatial/capsuleQuery'
import { proxyProblems } from '../engine/space/spatial/proxyValidation'
import {
  CLEARANCE_SKIN_MM,
  createSpatialWorld,
  TOUCH_MM,
  TOUCH_SKIN_MM,
  type InstrumentPart,
  type Obstacle,
} from '../engine/space/spatial/spatialWorld'
import { VIEW, viewSamples } from '../engine/space/spatial/visibility'
import {
  currentToolContact,
  icosphereMesh,
  NODULE_SUBDIVISIONS,
  teachingTarget,
} from '../engine/space/teachingTarget'
import { AUTHORED_TOOL_VALUES, forceps, toolCapsules } from '../engine/space/toolChannel'
import { judgeSegmentMesh, seededRandom, type JudgedMesh } from '../test-support/spaceFixtures'
import {
  CONTACT_LUNG,
  CONTACT_NODULE,
  contactScene,
  JUDGE_TOLERANCE_MM,
  MOTIONS,
  randomStart,
  SCENE_PORT,
  type ContactScene,
} from '../test-support/spaceScenes'

/**
 * Contact (slice 13; plan, sections 4.5 and 4.7): one table serves moving about the space and
 * touching a target. On an analytic scene, and on the real proxies where the local data holds them:
 * the forceps' jaws reach the nodule while the telescope is kept clear of it; a pivot that would
 * sweep the forceps through the lung is refused with the part named; once the forceps are back in the
 * channel, the telescope moves exactly as it does with no forceps. Every pose is judged by a brute
 * force that shares no code with the collider, along the path of each move as well as at its end.
 */

const scene = contactScene()
const resolver = createResolver(scene.space)
const tools = forceps()
const LUNG_STEP = 1
const IN: SpaceCommand = { kind: 'depth', direction: 'in' }
const OUT: SpaceCommand = { kind: 'depth', direction: 'out' }
const EXTEND: SpaceCommand = { kind: 'tool', direction: 'extend' }
const RETRACT: SpaceCommand = { kind: 'tool', direction: 'retract' }
const FULL_OUT = Math.ceil(AUTHORED_TOOL_VALUES.reachMm / AUTHORED_TOOL_VALUES.stepMm) + 1
const pose = (depthMm: number): ScopePose => ({
  tiltAcrossRibsDeg: 0,
  tiltAlongRibsDeg: 0,
  depthMm,
  rollDeg: 0,
})

function begin(
  from: ScopePose,
  {
    authorised = true,
    tool = true,
    on = resolver,
    lungStep = LUNG_STEP,
  }: { authorised?: boolean; tool?: boolean; on?: SpaceResolver; lungStep?: number } = {},
): EngineState {
  return startEngine(on, {
    scenario: 'contact-test',
    lungStep,
    pose: from,
    reducedMotion: true,
    snapshot: spaceSnapshot('contact-test', lungStep),
    ...(tool ? { tool: { authorised } } : {}),
  })
}

const press = (state: EngineState, command: SpaceCommand, on: SpaceResolver = resolver) =>
  reduce(state, { type: 'command', command, input: 'scripted', snapshot: state.snapshot }, on)

function pressUntilStopped(
  state: EngineState,
  command: SpaceCommand,
  presses: number,
  on: SpaceResolver = resolver,
) {
  let current = state
  for (let n = 1; n <= presses; n += 1) {
    current = press(current, command, on)
    if (current.limit) return { state: current, presses: n, limit: current.limit }
  }
  return { state: current, presses, limit: null }
}

interface Judged {
  readonly part: InstrumentPart
  readonly obstacle: Obstacle
  readonly clearance: number
}

/** Every part against every surface, by the judge alone. */
function judge(
  at: ScopePose,
  extensionMm: number,
  surfaces: {
    readonly wall: JudgedMesh
    readonly lung: JudgedMesh
    readonly target: JudgedMesh
  },
  space = scene.space,
): Judged[] {
  const g = scopeGeometry(at, space.port, space.device)
  const { shaft, workingElement } = toolCapsules(
    g,
    { phase: extensionMm > 0 ? 'extended' : 'in-channel', extensionMm },
    tools,
  )
  const parts: [InstrumentPart, Capsule | null][] = [
    ['sleeve', g.sleeve],
    ['telescope', g.shaft],
    ['tool-shaft', shaft],
    ['working-element', workingElement],
  ]
  const out: Judged[] = []
  for (const [part, capsule] of parts) {
    if (!capsule) continue
    for (const [obstacle, mesh] of [
      ['wall', surfaces.wall],
      ['lung', surfaces.lung],
      ['target', surfaces.target],
    ] as const) {
      const clearance = judgeSegmentMesh(mesh, capsule.start, capsule.end) - capsule.radius
      out.push({ part, obstacle, clearance })
    }
  }
  return out
}

const sceneSurfaces = (s: ContactScene) => ({
  wall: s.wall,
  lung: s.lungs[LUNG_STEP],
  target: s.target,
})

/** The skin the collider keeps for a pair, from the table, for the forceps as they are. */
function skinOf(part: InstrumentPart, obstacle: Obstacle, extended: boolean, authorised: boolean) {
  const rule = colliderRule(
    extended ? 'extended' : 'in-channel',
    authorised ? 'authorised' : 'not-authorised',
  )(part, obstacle)
  return rule === 'may-touch' ? TOUCH_SKIN_MM : CLEARANCE_SKIN_MM
}

describe('the table of contact, as the collider reads it', () => {
  it('lets only the jaws touch, only the target, only out of the channel and authorised; the wall is every region at once', () => {
    for (const phase of TOOL_PHASES) {
      for (const authorisation of AUTHORISATIONS) {
        const rule = colliderRule(phase, authorisation)
        for (const part of CONTACT_PARTS) {
          expect(rule(part, 'target')).toBe(
            contactRule(part, 'teaching-target', phase, authorisation),
          )
          expect(rule(part, 'lung')).toBe(contactRule(part, 'lung', phase, authorisation))
          expect(rule(part, 'wall')).toBe('refuse')
          for (const zone of PLEURAL_ZONE_IDS)
            expect(contactRule(part, zone, phase, authorisation)).toBe('refuse')
          expect(rule(part, 'target') === 'may-touch').toBe(
            part === 'working-element' && phase === 'extended' && authorisation === 'authorised',
          )
        }
      }
    }
  })

  it('keeps a skin for every pair, the touching one inside the touching distance', () => {
    expect(TOUCH_SKIN_MM).toBeGreaterThan(0)
    expect(TOUCH_SKIN_MM).toBeLessThan(TOUCH_MM)
    expect(TOUCH_SKIN_MM).toBeLessThan(CLEARANCE_SKIN_MM)
  })
})

describe('the nodule', () => {
  it('is a closed, outward sphere of its radius about its centre', () => {
    const centre = [10, -4, 7] as const
    const mesh = icosphereMesh(centre, 5)
    expect(proxyProblems('nodule', mesh)).toEqual([])
    expect(mesh.indices.length / 3).toBe(20 * 4 ** NODULE_SUBDIVISIONS)
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const r = Math.hypot(
        mesh.positions[i] - centre[0],
        mesh.positions[i + 1] - centre[1],
        mesh.positions[i + 2] - centre[2],
      )
      expect(r).toBeCloseTo(5, 4)
    }
  })

  it('is in the space the collider and the view meet, and hides the wall it covers', () => {
    expect(scene.space.world.targetIndex).not.toBeNull()
    // a sample on the far wall under the nodule: hidden with the nodule there, in view without it
    const covered = {
      zones: ['mediastinum' as const],
      points: Float32Array.from([129.75, 0.5, 0.5]),
      normals: Float32Array.from([1, 0, 0]),
    }
    const camera = resolver.geometry(pose(100)).camera
    const withNodule = viewSamples(scene.space.world, covered, camera, scene.space.device, 1)
    const bare = createSpatialWorld({
      space: scene.space.world.space,
      lungSteps: [scene.space.world.lung(0), scene.space.world.lung(1)],
      port: SCENE_PORT,
    })
    const without = viewSamples(bare, covered, camera, scene.space.device, 1)
    expect(Array.from(withNodule)).toEqual([VIEW.hidden])
    expect(Array.from(without)).toEqual([VIEW.inView])
  })
})

describe('facing the nodule', () => {
  it('stops the telescope clear of it, lets the jaws touch it and never go in, and after withdrawal stops the telescope again', () => {
    const start = begin(pose(100))
    const inward = pressUntilStopped(start, IN, 30)
    expect(inward.limit).toMatchObject({ kind: 'target', part: 'telescope' })
    const telescopeAtStop = judge(inward.state.pose, 0, sceneSurfaces(scene))
    expect(
      Math.min(
        ...telescopeAtStop
          .filter((entry) => entry.obstacle === 'target')
          .map((entry) => entry.clearance),
      ),
    ).toBeGreaterThanOrEqual(CLEARANCE_SKIN_MM - JUDGE_TOLERANCE_MM)
    expect(refusalOf(inward.limit, false, null, false)).toEqual({
      part: 'The telescope',
      words: LIMIT_WORDS.target,
    })

    let state = press(press(press(inward.state, OUT), OUT), OUT)
    expect(state.limit).toBeNull()
    const out = pressUntilStopped(state, EXTEND, FULL_OUT)
    state = out.state
    expect(out.limit).toMatchObject({ kind: 'target', part: 'working-element' })
    expect(state.tool).toMatchObject({ phase: 'extended', touching: true })
    const jaws = judge(state.pose, state.tool?.extensionMm ?? 0, sceneSurfaces(scene)).filter(
      (entry) => entry.part === 'working-element' && entry.obstacle === 'target',
    )[0]
    expect(jaws.clearance).toBeGreaterThanOrEqual(TOUCH_SKIN_MM - JUDGE_TOLERANCE_MM)
    expect(jaws.clearance).toBeLessThanOrEqual(TOUCH_MM)
    expect(paneStateOf(state, scene.space, null).refusal).toEqual({
      part: 'The forceps’ jaws',
      words: LIMIT_WORDS.touching,
    })

    // taking the telescope in now would take the jaws into the nodule: refused, and nothing moves
    const pushed = press(state, IN)
    expect(pushed.limit).toMatchObject({ kind: 'target', part: 'working-element' })
    expect(pushed.pose).toEqual(state.pose)

    const back = pressUntilStopped(state, RETRACT, FULL_OUT)
    expect(back.limit).toMatchObject({ kind: 'tool-in' })
    expect(back.state.tool).toMatchObject({ phase: 'in-channel', extensionMm: 0, touching: false })
    const again = pressUntilStopped(back.state, IN, 30)
    expect(again.limit).toMatchObject({ kind: 'target', part: 'telescope' })
    expect(again.state.pose.depthMm).toBeCloseTo(inward.state.pose.depthMm, 6)
  })

  it('keeps the jaws clear of a target that is not authorised, like any other part', () => {
    const start = begin(pose(100), { authorised: false })
    const nearer = press(press(press(pressUntilStopped(start, IN, 30).state, OUT), OUT), OUT)
    const out = pressUntilStopped(nearer, EXTEND, FULL_OUT)
    expect(out.limit).toMatchObject({ kind: 'target', part: 'working-element' })
    expect(out.state.tool?.touching).toBe(false)
    const jaws = judge(
      out.state.pose,
      out.state.tool?.extensionMm ?? 0,
      sceneSurfaces(scene),
    ).filter((entry) => entry.part === 'working-element' && entry.obstacle === 'target')[0]
    expect(jaws.clearance).toBeGreaterThanOrEqual(CLEARANCE_SKIN_MM - JUDGE_TOLERANCE_MM)
    expect(paneStateOf(out.state, scene.space, null).refusal).toEqual({
      part: 'The forceps’ jaws',
      words: LIMIT_WORDS.target,
    })
  })

  it('names the forceps at their two fences', () => {
    const start = begin(pose(40))
    const inward = press(start, RETRACT)
    expect(inward.limit).toMatchObject({ kind: 'tool-in' })
    expect(inward.tool).toMatchObject({ phase: 'in-channel', extensionMm: 0 })
    expect(refusalOf(inward.limit, false)).toEqual({
      part: 'The forceps',
      words: LIMIT_WORDS.toolIn,
    })
    const out = pressUntilStopped(start, EXTEND, FULL_OUT)
    expect(out.limit).toMatchObject({ kind: 'tool-out' })
    expect(out.state.tool?.extensionMm).toBe(AUTHORED_TOOL_VALUES.reachMm)
    expect(refusalOf(out.limit, false)).toEqual({ part: 'The forceps', words: LIMIT_WORDS.toolOut })
  })
})

describe('a pivot with the forceps out', () => {
  it('is refused where it would sweep them into the lung, with their part named; with them back in, the same pivot moves', () => {
    const start = begin(pose(40))
    const out = pressUntilStopped(start, EXTEND, FULL_OUT)
    expect(out.limit).toMatchObject({ kind: 'tool-out' })
    const refused = PIVOT_HAND_DIRECTIONS.map((hand) => {
      const pivot: SpaceCommand = { kind: 'pivot', hand }
      return { hand, pivot, swept: pressUntilStopped(out.state, pivot, 8) }
    }).filter(
      ({ swept }) =>
        swept.limit?.kind === 'lung' &&
        (swept.limit.part === 'tool-shaft' || swept.limit.part === 'working-element'),
    )
    expect(refused.length).toBeGreaterThan(0)
    for (const { pivot, swept } of refused) {
      const named = paneStateOf(swept.state, scene.space, null).refusal
      expect(named?.part).toMatch(/^The forceps’ (shaft|jaws)$/)
      expect(named?.words).toBe(LIMIT_WORDS.lung)
      // the forceps back in the channel: the telescope makes the same pivot, and more
      const back = pressUntilStopped(swept.state, RETRACT, FULL_OUT).state
      const free = pressUntilStopped(back, pivot, swept.presses + 3)
      expect(free.limit).toBeNull()
    }
  })

  it('counts the forceps when the lung would move toward them', () => {
    const extended = pressUntilStopped(begin(pose(40)), EXTEND, FULL_OUT).state
    const tool = { state: { phase: 'extended' as const, extensionMm: 40 }, authorised: true }
    const tilted = { ...extended.pose, tiltAlongRibsDeg: 10 }
    const without = resolver.lungClearance(tilted, LUNG_STEP)
    const withTool = resolver.lungClearance(tilted, LUNG_STEP, tool)
    expect(withTool).toBeLessThan(without)
  })
})

describe('withdrawing', () => {
  it('is never refused by a surface: the telescope drawn out, and the forceps brought in, pass only through space they fill', () => {
    // the telescope, its tip past the lung, pivoted until its side meets the lung: pulling it out
    // leaves the least clearance where it was, which a move at the skin must not be refused for
    let state = begin(pose(100))
    const toward = PIVOT_HAND_DIRECTIONS.map((hand) =>
      pressUntilStopped(state, { kind: 'pivot', hand }, 40),
    ).find((run) => run.limit?.kind === 'lung' && run.limit.part === 'telescope')
    expect(toward).toBeDefined()
    state = toward!.state
    const drawn = press(state, OUT)
    expect(drawn.limit).toBeNull()
    expect(drawn.pose.depthMm).toBeCloseTo(state.pose.depthMm - 2, 9)
    // and with the forceps out against the lung, bringing them in
    let out = begin(pose(40))
    out = pressUntilStopped(out, EXTEND, FULL_OUT).state
    const swept = PIVOT_HAND_DIRECTIONS.map((hand) =>
      pressUntilStopped(out, { kind: 'pivot', hand }, 8),
    ).find((run) => run.limit?.kind === 'lung')
    expect(swept).toBeDefined()
    const inward = press(swept!.state, RETRACT)
    expect(inward.limit).toBeNull()
    expect(inward.tool?.extensionMm).toBe((swept!.state.tool?.extensionMm ?? 0) - 2)
  })
})

describe('after withdrawal', () => {
  it('moves the telescope exactly as with the forceps never out, and as with no forceps at all', () => {
    const random = seededRandom(1307)
    const script = Array.from({ length: 40 }, () => MOTIONS[Math.floor(random() * MOTIONS.length)])
    const run = (state: EngineState) => {
      const trail: string[] = []
      let current = state
      for (const command of script) {
        current = press(current, command)
        trail.push(JSON.stringify([current.pose, current.limit]))
      }
      return trail
    }
    const from = pose(60)
    const neverOut = run(begin(from))
    let excursion = begin(from)
    for (let n = 0; n < 6; n += 1) excursion = press(excursion, EXTEND)
    excursion = pressUntilStopped(excursion, RETRACT, FULL_OUT).state
    expect(excursion.tool).toMatchObject({ phase: 'in-channel', extensionMm: 0 })
    expect(excursion.pose).toEqual(from)
    expect(run({ ...excursion, limit: null })).toEqual(neverOut)
    expect(run(begin(from, { tool: false }))).toEqual(neverOut)
  })
})

describe('the engine with the forceps', () => {
  it('changes nothing for a forceps command where the scenario has none, or for another snapshot', () => {
    const plain = begin(pose(40), { tool: false })
    expect(press(plain, EXTEND)).toBe(plain)
    const start = begin(pose(40))
    const stale = reduce(
      start,
      {
        type: 'command',
        command: EXTEND,
        input: 'keyboard',
        snapshot: { ...start.snapshot, geometry: 'another' },
      },
      resolver,
    )
    expect(stale).toBe(start)
  })

  it('replays a script with the forceps to the same state and events under any schedule of ticks', () => {
    const script: TimedAction[] = [
      { atMs: 0, action: { type: 'command', command: IN, input: 'keyboard' } },
      { atMs: 30, action: { type: 'command', command: EXTEND, input: 'keyboard' } },
      { atMs: 31, action: { type: 'command', command: EXTEND, input: 'pointer' } },
      {
        atMs: 250,
        action: { type: 'command', command: { kind: 'pivot', hand: 'front' }, input: 'touch' },
      },
      { atMs: 400, action: { type: 'command', command: RETRACT, input: 'keyboard' } },
      {
        atMs: 900,
        action: {
          type: 'command',
          command: { kind: 'roll', direction: 'clockwise' },
          input: 'keyboard',
        },
      },
    ]
    const start = { ...begin(pose(40)), reducedMotion: false }
    const schedules = [() => 1, () => 16, () => 33, (t: number) => (t % 7) + 1]
    const results = schedules.map((tick) => replay(start, script, resolver, tick, 1200))
    for (const result of results.slice(1)) expect(result).toEqual(results[0])
    expect(results[0].events.map((entry) => entry.kind)).toContain('tool-moved')
    expect(JSON.parse(JSON.stringify(results[0]))).toEqual(results[0])
  })

  it('gives the pane the forceps and draws the nodule and the forceps in the cut', () => {
    const extended = press(press(begin(pose(60)), EXTEND), EXTEND)
    const pane = paneStateOf(extended, scene.space, null)
    expect(pane.tool).toEqual({
      phase: 'extended',
      extensionMm: 4,
      touching: false,
      authorised: true,
    })
    expect(pane.crossSection?.target?.length).toBeGreaterThan(0)
    expect(pane.crossSection?.tool).toBeDefined()
    const inChannel = paneStateOf(begin(pose(60)), scene.space, null)
    expect(inChannel.crossSection?.tool).toBeUndefined()
    expect(inChannel.tool).toMatchObject({ phase: 'in-channel', extensionMm: 0 })
  })

  it('names the nodule in the snapshot’s geometry', () => {
    const named = spaceSnapshot('x', 8, 'nodule 1 2 3 r 5')
    expect(named.geometry).toBe(`${spaceSnapshot('x', 8).geometry}+nodule 1 2 3 r 5`)
  })
})

/**
 * Seeded sequences with the forceps: scope and forceps commands mixed, each move judged at its end
 * and along its path, every pair at the skin the table gives it. Returns what the judge found wrong.
 */
function fuzzContact(seeds: number, commands: number, firstSeed: number) {
  const problems: string[] = []
  let moves = 0
  let touched = 0
  const surfaces = sceneSurfaces(scene)
  const TOOL_COMMANDS = [EXTEND, EXTEND, RETRACT]
  const mixRoll = (a: number, b: number, t: number) => {
    const change = ((((b - a) % 360) + 540) % 360) - 180
    return (((a + change * t) % 360) + 360) % 360
  }
  for (let seed = firstSeed; seed < firstSeed + seeds; seed += 1) {
    const random = seededRandom(seed)
    const authorised = random() < 0.75
    // half the sequences start aimed at the nodule, the rest anywhere clear
    const aimed: ScopePose = {
      tiltAcrossRibsDeg: (random() - 0.5) * 6,
      tiltAlongRibsDeg: (random() - 0.5) * 6,
      depthMm: 60 + random() * 50,
      rollDeg: Math.floor(random() * 72) * 5,
    }
    const start =
      seed % 2 === 0 && resolver.startProblem(aimed, LUNG_STEP) === null
        ? aimed
        : randomStart(random, scene.space, resolver, LUNG_STEP, 110)
    let state = begin(start, { authorised })
    const held = random() < 0.5 ? EXTEND : MOTIONS[Math.floor(random() * MOTIONS.length)]
    for (let k = 0; k < commands; k += 1) {
      const roll = random()
      const command =
        roll < 0.45
          ? held
          : roll < 0.7
            ? TOOL_COMMANDS[Math.floor(random() * TOOL_COMMANDS.length)]
            : MOTIONS[Math.floor(random() * MOTIONS.length)]
      const before = state
      state = press(state, command)
      moves += 1
      if (state.tool?.touching) touched += 1
      const what = `seed ${seed}, command ${k} ${JSON.stringify(command)}`
      const extended = (state.tool?.extensionMm ?? 0) > 0
      for (const entry of judge(state.pose, state.tool?.extensionMm ?? 0, surfaces)) {
        const skin = skinOf(entry.part, entry.obstacle, extended, authorised)
        if (entry.clearance < skin - JUDGE_TOLERANCE_MM)
          problems.push(`${what}: ${entry.part} × ${entry.obstacle} at ${entry.clearance} mm`)
      }
      // along the path: nothing crosses anything, however the move went
      const a = before.pose
      const b = state.pose
      const ea = before.tool?.extensionMm ?? 0
      const eb = state.tool?.extensionMm ?? 0
      for (let s = 1; s < 5; s += 1) {
        const t = s / 5
        const at: ScopePose = {
          tiltAcrossRibsDeg: a.tiltAcrossRibsDeg + (b.tiltAcrossRibsDeg - a.tiltAcrossRibsDeg) * t,
          tiltAlongRibsDeg: a.tiltAlongRibsDeg + (b.tiltAlongRibsDeg - a.tiltAlongRibsDeg) * t,
          depthMm: a.depthMm + (b.depthMm - a.depthMm) * t,
          rollDeg: mixRoll(a.rollDeg, b.rollDeg, t),
        }
        for (const entry of judge(at, ea + (eb - ea) * t, surfaces)) {
          if (entry.clearance < -1e-3)
            problems.push(
              `${what}, on its path: ${entry.part} × ${entry.obstacle} at ${entry.clearance} mm`,
            )
        }
      }
    }
  }
  return { moves, touched, problems }
}

describe('fuzzed with the forceps', () => {
  it('never lets a part closer than its skin, nor through anything along a move, over seeded sequences', () => {
    const { moves, touched, problems } = fuzzContact(120, 40, 7000)
    expect(problems).toEqual([])
    expect(moves).toBe(120 * 40)
    // the sequences did reach the nodule, so the touching pair was exercised
    expect(touched).toBeGreaterThan(0)
  }, 120_000)
})

// ── The real proxies, where the owner's local data holds them ─────────────────────────────────

const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const PACKAGED = join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
const proxyFile = (id: string) => {
  const entry = anatomyManifest.files.find((file) => file.id === id)
  return entry ? join(PACKAGED, entry.file) : ''
}
const haveProxies = ['proxy-pleural-space', 'proxy-lung'].every((id) => existsSync(proxyFile(id)))
const onRealProxies = haveProxies ? describe : describe.skip

describe('the record', () => {
  it('is current for the snapshot the engine would compute it for now', () => {
    expect(currentToolContact()).not.toBeNull()
  })

  it('says why the nodule is not on the chest wall, when it is not', () => {
    if (toolContact.nodule.on === 'lung-surface') {
      expect(toolContact.costalPleura.linesMeetingTheLungFirst).toBe(
        toolContact.costalPleura.linesTried,
      )
    } else {
      expect(toolContact.nodule.zone).not.toBeNull()
    }
  })

  it('is ignored when it was computed for another snapshot', () => {
    expect(
      currentToolContact({
        ...toolContact,
        computedFor: { ...toolContact.computedFor, geometry: 'another' },
      }),
    ).toBeNull()
  })
})

onRealProxies('the spike on the real proxies', () => {
  const contact = currentToolContact()
  if (!contact) throw new Error('The tool-contact record is not current')
  const target = teachingTarget(contact.nodule.centre, contact.nodule.radiusMm)
  const real = loadSpace(
    readFileSync(proxyFile('proxy-pleural-space')),
    readFileSync(proxyFile('proxy-lung')),
    { target },
  )
  const realResolver = createResolver(real)
  const place = (id: string) => {
    const found = contact.places.find((entry) => entry.id === id)
    if (!found) throw new Error(`No place ${id}`)
    return begin(found.pose, { on: realResolver, lungStep: found.lungStep })
  }

  it('shows the first and third demonstrations facing the nodule', () => {
    const inward = pressUntilStopped(place('facing-the-nodule'), IN, 30, realResolver)
    expect(inward.limit).toMatchObject({ kind: 'target', part: 'telescope' })
    expect(inward.presses).toBe(toolContact.found.telescopeStopsAfterSteps)
    let state = inward.state
    for (let n = 0; n < 3; n += 1) state = press(state, OUT, realResolver)
    const out = pressUntilStopped(state, EXTEND, FULL_OUT, realResolver)
    expect(out.limit).toMatchObject({ kind: 'target', part: 'working-element' })
    expect(out.state.tool?.touching).toBe(true)
    expect(out.state.tool?.extensionMm).toBeCloseTo(toolContact.found.forcepsTouchAtMm, 2)
    const back = pressUntilStopped(out.state, RETRACT, FULL_OUT, realResolver)
    const again = pressUntilStopped(back.state, IN, 30, realResolver)
    expect(again.limit).toMatchObject({ kind: 'target', part: 'telescope' })
  })

  it('shows the second demonstration beside the lung, and its undoing', () => {
    const out = pressUntilStopped(place('beside-the-lung'), EXTEND, FULL_OUT, realResolver)
    const pivot: SpaceCommand = { kind: 'pivot', hand: contact.towardTheLung }
    const swept = pressUntilStopped(out.state, pivot, 6, realResolver)
    expect(swept.limit).toMatchObject({
      kind: 'lung',
      part: toolContact.found.besideTheLungStoppedBy,
    })
    expect(swept.presses).toBe(toolContact.found.besideTheLungPivotSteps)
    const back = pressUntilStopped(swept.state, RETRACT, FULL_OUT, realResolver).state
    const free = pressUntilStopped(
      back,
      pivot,
      toolContact.found.withoutTheForcepsPivotSteps,
      realResolver,
    )
    expect(free.limit).toBeNull()
  })

  it('starts each place clear, with the lung where the record found it', () => {
    for (const entry of contact.places)
      expect(realResolver.startProblem(entry.pose, entry.lungStep)).toBeNull()
    expect(CONTACT_NODULE.radiusMm).toBe(contact.nodule.radiusMm)
    expect(CONTACT_LUNG.radiusMm).toBeGreaterThan(0)
  })
})
