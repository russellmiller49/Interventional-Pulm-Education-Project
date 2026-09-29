/**
 * The prototype gate's fuzz on the real proxies (plan, section 7: "the full 10,000 on the real
 * proxies at the gate"), strengthened after the independent review (R2): seeded journeys on the
 * collision proxies in the owner's local data, every move judged along its path and not only where
 * it ends, the instrument's axis classified inside the space and outside the lung by ray parity, the
 * lung asked to move a step either way through the reducer; and seeded sequences with the forceps out,
 * pivoted, the jaws opened and closed, and brought back. The judges share no code with the collider or
 * its winding number. Fuzzing is evidence, not proof.
 *
 *   npx tsx scripts/medical-thoracoscopy/fuzz-real-proxies.ts [--seeds 10000] [--first-seed 60001]
 *     [--forceps 2000] [--forceps-first-seed 160001] [--commands 3]
 *
 * Prints one line of JSON. Any failing seed is added to `test-support/fuzz-seeds.json`, which the Jest
 * suite replays on every run (preserved, not minimised: a seed replays its whole sequence).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { anatomyManifest } from '../../src/features/medical-thoracoscopy/content/data/generated/anatomy'
import { loadSpace } from '../../src/features/medical-thoracoscopy/engine/space/loadSpace'
import { PORT_EXCLUSION_MM } from '../../src/features/medical-thoracoscopy/engine/space/spatial/spatialWorld'
import {
  judgedMesh,
  judgePointTriangle,
} from '../../src/features/medical-thoracoscopy/test-support/spaceFixtures'
import {
  fuzzForceps,
  fuzzJourneys,
} from '../../src/features/medical-thoracoscopy/test-support/spaceScenes'

const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const PACKAGED = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
const SEEDS_FILE = path.resolve(
  __dirname,
  '../../src/features/medical-thoracoscopy/test-support/fuzz-seeds.json',
)

function option(name: string, fallback: number): number {
  const at = process.argv.indexOf(name)
  if (at < 0) return fallback
  const value = Number(process.argv[at + 1])
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${name} takes a whole number, zero or more`)
  return value
}

function main(): void {
  const seeds = option('--seeds', 10000)
  const firstSeed = option('--first-seed', 60001)
  const forcepsSeeds = option('--forceps', 2000)
  const forcepsFirstSeed = option('--forceps-first-seed', 160001)
  const commands = option('--commands', 3)
  const bytes = (id: string) => {
    const entry = anatomyManifest.files.find((file) => file.id === id)
    if (!entry) throw new Error(`The anatomy manifest has no ${id}`)
    return readFileSync(path.join(PACKAGED, entry.file))
  }
  const started = Date.now()
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
  // before the lung has fallen some way there is no room for the telescope at the port
  const journeys = fuzzJourneys(target, { seeds, firstSeed, commands, lungSteps: [4, 5, 6, 7, 8] })
  const journeySeconds = Math.round((Date.now() - started) / 1000)
  const forcepsStarted = Date.now()
  const forceps = fuzzForceps(target, {
    seeds: forcepsSeeds,
    firstSeed: forcepsFirstSeed,
    commands: 12,
    lungStep: 8,
  })
  const failing = [
    ...journeys.failingSeeds.map((seed) => ({ scene: 'real', kind: 'journey', seed })),
    ...forceps.failingSeeds.map((seed) => ({ scene: 'real', kind: 'forceps', seed })),
  ]
  if (failing.length > 0) {
    const kept = JSON.parse(readFileSync(SEEDS_FILE, 'utf8')) as {
      scene: string
      kind?: string
      seed: number
    }[]
    for (const entry of failing)
      if (!kept.some((k) => k.seed === entry.seed && k.kind === entry.kind))
        kept.push({ ...entry, note: `found ${new Date().toISOString().slice(0, 10)}` } as never)
    writeFileSync(SEEDS_FILE, `${JSON.stringify(kept, null, 2)}\n`)
  }
  console.log(
    JSON.stringify({
      journeys: {
        seeds,
        firstSeed,
        commandsEitherSideOfTheLung: commands,
        moves: journeys.moves,
        stopped: journeys.stopped,
        posesJudgedOnPaths: journeys.pathPoses,
        insideChecks: journeys.insideChecks,
        lungMoves: journeys.lungMoves,
        lungHeld: journeys.lungHeld,
        problems: journeys.problems.slice(0, 20),
        seconds: journeySeconds,
      },
      forceps: {
        seeds: forcepsSeeds,
        firstSeed: forcepsFirstSeed,
        moves: forceps.moves,
        stopped: forceps.stopped,
        posesJudgedOnPaths: forceps.pathPoses,
        insideChecks: forceps.insideChecks,
        jawsOpened: forceps.jawsOpened,
        problems: forceps.problems.slice(0, 20),
        seconds: Math.round((Date.now() - forcepsStarted) / 1000),
      },
      preservedSeedsAdded: failing.length,
      proxies: anatomyManifest.files
        .filter((file) => file.id.startsWith('proxy-'))
        .map((file) => `${file.id} ${file.sha256.slice(0, 12)}`),
    }),
  )
  if (failing.length > 0) process.exit(1)
}

main()
