/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { collisionProxies as proxies, lungStates } from '../content/anatomy'
import { anatomyManifest } from '../content/data/generated/anatomy'
import { sleeveTipDepth } from '../engine/space/fulcrum'
import { instrument } from '../engine/space/instrument'
import {
  assembleSpace,
  createResolver,
  loadSpace,
  type LoadedSpace,
} from '../engine/space/loadSpace'
import { LUNG_STEP_MS, reduce, startEngine } from '../engine/space/spaceReducer'
import { spaceSnapshot } from '../engine/space/spaceSnapshot'
import { createSpatialWorld, PORT_EXCLUSION_MM } from '../engine/space/spatial/spatialWorld'
import {
  gridBoxMesh,
  judgedMesh,
  judgeInside,
  judgePointTriangle,
  judgeTopology,
  sphereMesh,
} from '../test-support/spaceFixtures'
import preserved from '../test-support/fuzz-seeds.json'
import {
  fuzzJourneys,
  ROOM,
  scene,
  SCENE_PORT,
  type JourneyTarget,
} from '../test-support/spaceScenes'

/**
 * The independent review's R2 and R7: journeys judged along every move and inside and out, on
 * analytic scenes always and on the real proxies where the owner's local data holds them; the lung's
 * steps checked closed, outward and inside the space by the judge's own routes; and a lung step that
 * would swallow the instrument refused. Fuzzing is evidence, not proof.
 */
function journeyTarget(space: LoadedSpace): JourneyTarget {
  return {
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
}

/**
 * The lung proxy's Euler characteristic at each step, as measured on 2026-09-29 (R7): 2 for a
 * surface like a sphere, 0 for one with a single tunnel through it. Steps 2 and 4 have one tunnel
 * each. The winding number and the clearance are sound for any closed, outward surface, and the
 * journeys find nothing wrong at step 4, but whether a tunnel could admit an instrument has not been
 * established. Pinned so that a rebuild that changes the lung's shape is noticed; it is a finding for
 * the owner's lung decision (R9), not a defect this repair rebuilds geometry to hide.
 */
const MEASURED_LUNG_EULER = [2, 2, 0, 2, 0, 2, 2, 2, 2] as const

type PreservedSeed = { readonly scene: string; readonly seed: number; readonly note: string }
const preservedSeeds = preserved as readonly PreservedSeed[]

describe('journeys, judged along every move (R2)', () => {
  it.each([
    ['spheres', 1, 300],
    ['plate', 3001, 300],
    ['torus', 6001, 150],
  ] as const)(
    'finds nothing wrong on the %s scene: path, clearance, inside and outside, lung steps both ways',
    (kind, firstSeed, seeds) => {
      const target = journeyTarget(scene(kind).space)
      const steps = Array.from({ length: target.lungs.length }, (_, k) => k)
      const run = fuzzJourneys(target, { seeds, firstSeed, commands: 3, lungSteps: steps })
      expect(run.problems).toEqual([])
      expect(run.moves).toBe(seeds * 7)
      expect(run.pathPoses).toBeGreaterThan(run.moves)
      expect(run.insideChecks).toBeGreaterThan(run.moves)
      // the lung moved in some journeys and was held in others
      expect(run.lungMoves + run.lungHeld).toBeGreaterThan(0)
    },
    600000,
  )

  it('replays every preserved failing seed on its analytic scene', () => {
    for (const entry of preservedSeeds.filter((e) => e.scene !== 'real')) {
      const target = journeyTarget(scene(entry.scene as 'spheres').space)
      const steps = Array.from({ length: target.lungs.length }, (_, k) => k)
      const run = fuzzJourneys(target, {
        seeds: 1,
        firstSeed: entry.seed,
        commands: 3,
        lungSteps: steps,
        only: [entry.seed],
      })
      expect(run.problems).toEqual([])
    }
  })
})

describe('a lung step that would swallow the instrument (R7, the review’s finding 10)', () => {
  it('is refused, though the lung’s surface keeps its distance', () => {
    // the room, a small lung far from the port, and a lung so large it holds the whole instrument
    const cuts = ([lo, hi]: readonly [number, number]) => [lo, (lo + hi) / 2, hi]
    const room = gridBoxMesh({ x: cuts(ROOM.x), y: cuts(ROOM.y), z: cuts(ROOM.z) })
    const small = sphereMesh(10, [110, 60, 70], 12, 24)
    const swallowing = sphereMesh(400, [0, 0, 0], 16, 32)
    const device = instrument()
    const space = assembleSpace({
      port: SCENE_PORT,
      device,
      world: createSpatialWorld({ space: room, lungSteps: [small, swallowing], port: SCENE_PORT }),
      samples: scene('spheres').space.samples,
      depthLimits: [sleeveTipDepth(SCENE_PORT, device), 150],
    })
    const resolver = createResolver(space)
    const pose = { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 30, rollDeg: 0 }
    // clearance alone would let it through: the swallowing surface is far from every capsule
    expect(resolver.lungClearance(pose, 1)).toBeGreaterThan(300)
    expect(resolver.tipFree(pose, 1)).toBe(false)
    let state = startEngine(resolver, {
      scenario: 'swallow',
      lungStep: 0,
      pose,
      reducedMotion: false,
      snapshot: spaceSnapshot('swallow', 0),
    })
    state = reduce(state, { type: 'lung-target', step: 1 }, resolver)
    state = reduce(state, { type: 'tick', ms: LUNG_STEP_MS * 3 }, resolver)
    expect(state.lungStep).toBe(0)
    expect(state.lungHeld).toBe(true)
    expect(state.events.map((e) => e.kind)).toEqual(['lung-held'])
  })
})

// ── The real proxies ───────────────────────────────────────────────────────────────────────────

const root =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const packaged = join(root, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
const available = existsSync(packaged)
const maybe = available ? it : it.skip
const bytes = (id: string) =>
  readFileSync(join(packaged, anatomyManifest.files.find((f) => f.id === id)?.file ?? ''))
let loaded: LoadedSpace | null = null
const real = () => (loaded ??= loadSpace(bytes('proxy-pleural-space'), bytes('proxy-lung')))

describe('the real proxies, where the owner’s local data holds them', () => {
  maybe(
    'journeys: 300 seeded, the lung steps 4 to 8 both ways, nothing wrong (R2)',
    () => {
      const run = fuzzJourneys(journeyTarget(real()), {
        seeds: 300,
        firstSeed: 70001,
        commands: 3,
        lungSteps: [4, 5, 6, 7, 8],
      })
      expect(run.problems).toEqual([])
      expect(run.moves).toBe(2100)
      expect(run.lungMoves).toBeGreaterThan(0)
    },
    600000,
  )

  maybe('replays every preserved failing seed on the real proxies', () => {
    const seeds = preservedSeeds.filter((e) => e.scene === 'real').map((e) => e.seed)
    const run = fuzzJourneys(journeyTarget(real()), {
      seeds: 0,
      firstSeed: 0,
      commands: 3,
      lungSteps: [4, 5, 6, 7, 8],
      only: seeds,
    })
    expect(run.problems).toEqual([])
  })

  maybe(
    'every lung step is closed, outward, of its measured shape and, within the modelling tolerance, inside the space (R7)',
    () => {
      const space = real()
      const whole = judgedMesh(space.world.space)
      const spaceShape = judgeTopology(space.world.space)
      expect(spaceShape).toMatchObject({ closedManifold: true, consistent: true, euler: 2 })
      expect(spaceShape.signedVolumeMm3).toBeGreaterThan(0)
      // The permitted protrusion follows from the records, not from the helper under test: a lung
      // proxy lies within its recorded distance of the drawn lung, which the build keeps inside the
      // drawn pleura by its recorded clearance; the space proxy lies within its recorded distance
      // inside the drawn pleura. So no lung proxy point can lie further outside the space proxy than
      // the lung proxy's greatest distance from the drawn lung plus the drawn pleura's from the space
      // proxy, less the drawn lung's least clearance.
      expect(space.world.lungStepCount).toBe(lungStates.states.length)
      const measured: {
        step: number
        outside: number
        furthestMm: number
        permitted: number
      }[] = []
      for (let step = 0; step < space.world.lungStepCount; step += 1) {
        const mesh = space.world.lung(step)
        const shape = judgeTopology(mesh)
        expect({ step, ...shape, signedVolumeMm3: shape.signedVolumeMm3 > 0 }).toEqual({
          step,
          closedManifold: true,
          consistent: true,
          euler: MEASURED_LUNG_EULER[step],
          signedVolumeMm3: true,
        })
        const recorded = proxies.lung.states[step]
        const clearance = lungStates.states[step].clearanceMm
        const permitted =
          recorded.proxyFromDrawnMm[2] + proxies.pleuralSpace.drawnFromProxyMm[2] - clearance
        let outside = 0
        let furthest = 0
        for (let v = 0; v < mesh.positions.length; v += 3) {
          const p = [mesh.positions[v], mesh.positions[v + 1], mesh.positions[v + 2]] as const
          if (judgeInside(whole, p)) continue
          outside += 1
          let nearest = Infinity
          for (const [a, b, c] of whole.triangles)
            nearest = Math.min(nearest, judgePointTriangle(p, a, b, c))
          furthest = Math.max(furthest, nearest)
        }
        expect({ step, within: furthest <= permitted }).toEqual({ step, within: true })
        measured.push({ step, outside, furthestMm: Math.round(furthest * 100) / 100, permitted })
      }
      // As the lung falls away, less of its proxy lies outside the space's
      expect(measured[measured.length - 1].outside).toBeLessThan(measured[0].outside)
      console.info(JSON.stringify(measured))
    },
    600000,
  )

  it('draws the lung and collides with it at the same steps, from one build (R7)', () => {
    const drawn = anatomyManifest.files.find((f) => f.id === 'lung-states')
    const proxy = anatomyManifest.files.find((f) => f.id === 'proxy-lung')
    // the drawn lung's base shape and one morph target a step; the proxy one closed surface a step
    expect((drawn?.morphTargets.length ?? 0) + 1).toBe(lungStates.states.length)
    expect(proxy?.nodes.filter((n) => n.startsWith('proxy:lung:step ')).length).toBe(
      lungStates.states.length,
    )
    expect(proxies.lung.states.map((s) => s.step)).toEqual(lungStates.states.map((s) => s.step))
    // both files are the ones the lung-states record was built with
    expect(lungStates.files['lung-states']?.sha256).toBe(drawn?.sha256)
    expect(lungStates.files['proxy-lung']?.sha256).toBe(proxy?.sha256)
    // and the build checked the drawn lung between steps as well as at them
    for (const between of lungStates.between) {
      expect(between).toMatchObject({ foldedFaces: 0, crossingFaces: 0, facesThroughPleura: 0 })
      expect(between.clearanceMm).toBeGreaterThanOrEqual(lungStates.checks.clearanceFloorMm)
    }
  })
})
