/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { anatomyManifest } from '../content/data/generated/anatomy'
import { loadSpace } from '../engine/space/loadSpace'
import { PORT_EXCLUSION_MM } from '../engine/space/spatial/spatialWorld'
import { judgedMesh, judgePointTriangle } from '../test-support/spaceFixtures'
import { fuzzSweep, scene } from '../test-support/spaceScenes'

/**
 * The sweep never carries the instrument through a surface (plan, section 7): seeded sequences of
 * moves, every move judged by a brute force over every triangle that shares no code with the
 * collider. On analytic scenes always; on the real proxies where the owner's local data holds them.
 */
describe('the sweep, fuzzed', () => {
  it('never carries the instrument through a surface: 10,000 seeded sequences on analytic scenes', () => {
    // The ring costs the most: a rush grazing its curve closes in on it in many small moves.
    const runs = [
      fuzzSweep(scene('spheres'), { seeds: 4500, commands: 2, firstSeed: 1 }),
      fuzzSweep(scene('plate'), { seeds: 4500, commands: 2, firstSeed: 10001 }),
      fuzzSweep(scene('torus'), { seeds: 1000, commands: 2, firstSeed: 20001 }),
    ]
    expect(runs.flatMap((run) => run.problems)).toEqual([])
    expect(runs.reduce((sum, run) => sum + run.moves, 0)).toBe(30000)
    // a good share of the commands were taken pressed against something
    expect(runs.reduce((sum, run) => sum + run.stopped, 0)).toBeGreaterThan(5000)
  }, 600000)

  const root =
    process.env.IP_LOCAL_DATA?.trim() ||
    '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
  const packaged = join(root, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
  const bytes = (id: string) =>
    readFileSync(join(packaged, anatomyManifest.files.find((f) => f.id === id)?.file ?? ''))

  ;(existsSync(packaged) ? it : it.skip)(
    'never carries the instrument through the real proxies: 1,000 seeded sequences',
    () => {
      const space = loadSpace(bytes('proxy-pleural-space'), bytes('proxy-lung'))
      const wall = judgedMesh(
        space.world.space,
        (a, b, c) => judgePointTriangle(space.port.pleura, a, b, c) >= PORT_EXCLUSION_MM,
      )
      const lungs = Array.from({ length: space.world.lungStepCount }, (_, k) =>
        judgedMesh(space.world.lung(k)),
      )
      // before the lung has fallen some way there is no room for the telescope at the port
      const run = fuzzSweep(
        { space, wall, lungs },
        { seeds: 1000, commands: 2, firstSeed: 50001, lungSteps: [4, 5, 6, 7, 8] },
      )
      expect(run.problems).toEqual([])
      expect(run.moves).toBe(3000)
    },
    600000,
  )
})
