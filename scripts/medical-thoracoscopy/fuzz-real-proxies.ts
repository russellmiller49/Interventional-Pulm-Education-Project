/**
 * The prototype gate's fuzz on the real proxies (plan, section 7: "the full 10,000 on the real
 * proxies at the gate"): seeded sequences of moves on the collision proxies in the owner's local
 * data, every move judged by the brute force that shares no code with the collider, as the jest
 * suite does with 1,000.
 *
 *   npx tsx scripts/medical-thoracoscopy/fuzz-real-proxies.ts [--seeds 10000] [--first-seed 60001]
 *
 * Prints one line of JSON: the seeds, the moves judged, how many were stopped by something, the
 * problems the judge found (which should be none), and how long it took. Lung steps 4 to 8, as in
 * the suite: before the lung has fallen some way there is no room for the telescope at the port.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { anatomyManifest } from '../../src/features/medical-thoracoscopy/content/data/generated/anatomy'
import { loadSpace } from '../../src/features/medical-thoracoscopy/engine/space/loadSpace'
import { PORT_EXCLUSION_MM } from '../../src/features/medical-thoracoscopy/engine/space/spatial/spatialWorld'
import {
  judgedMesh,
  judgePointTriangle,
} from '../../src/features/medical-thoracoscopy/test-support/spaceFixtures'
import { fuzzSweep } from '../../src/features/medical-thoracoscopy/test-support/spaceScenes'

const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const PACKAGED = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/anatomy/packaged')

function option(name: string, fallback: number): number {
  const at = process.argv.indexOf(name)
  if (at < 0) return fallback
  const value = Number(process.argv[at + 1])
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${name} takes a positive whole number`)
  return value
}

function main(): void {
  const seeds = option('--seeds', 10000)
  const firstSeed = option('--first-seed', 60001)
  const bytes = (id: string) => {
    const entry = anatomyManifest.files.find((file) => file.id === id)
    if (!entry) throw new Error(`The anatomy manifest has no ${id}`)
    return readFileSync(path.join(PACKAGED, entry.file))
  }
  const started = Date.now()
  const space = loadSpace(bytes('proxy-pleural-space'), bytes('proxy-lung'))
  const wall = judgedMesh(
    space.world.space,
    (a, b, c) => judgePointTriangle(space.port.pleura, a, b, c) >= PORT_EXCLUSION_MM,
  )
  const lungs = Array.from({ length: space.world.lungStepCount }, (_, k) =>
    judgedMesh(space.world.lung(k)),
  )
  const run = fuzzSweep(
    { space, wall, lungs },
    { seeds, commands: 2, firstSeed, lungSteps: [4, 5, 6, 7, 8] },
  )
  console.log(
    JSON.stringify({
      seeds,
      firstSeed,
      moves: run.moves,
      stopped: run.stopped,
      problems: run.problems,
      seconds: Math.round((Date.now() - started) / 1000),
      proxies: anatomyManifest.files
        .filter((file) => file.id.startsWith('proxy-'))
        .map((file) => `${file.id} ${file.sha256.slice(0, 12)}`),
    }),
  )
  if (run.problems.length > 0) process.exit(1)
}

main()
