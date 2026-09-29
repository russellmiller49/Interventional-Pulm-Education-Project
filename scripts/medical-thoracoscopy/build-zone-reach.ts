/**
 * Which zone samples the telescope can bring into its field from any position the port allows, with
 * the lung collapsed: what "out of reach from this port" means in the ledger (section 11; owner
 * decisions, T12; plan, section 4.5, "outside this model's reach").
 *
 *   npx tsx scripts/medical-thoracoscopy/build-zone-reach.ts
 *
 * Reads the packaged proxies from the owner's local data (they are not in the repository) and runs
 * the space engine itself (`computeReach`) over a grid of positions: every pair of tilts inside the
 * ellipse the ribs allow, and at each, the telescope advanced from the end of its sleeve until the
 * instrument would touch the wall or the lung, and at the deepest point it clears, each at four
 * rolls, since the optic sits off the axis. A sample within the field, within range and facing the
 * telescope from any of those positions is reachable, whether or not something lies in the way:
 * what lies in the way is "hidden", the ledger's other reason.
 *
 * Also counts, for the handoff, the samples that some position shows with nothing in the way: how
 * much of each region the model lets the learner see at all.
 *
 * Writes `src/features/medical-thoracoscopy/content/data/anatomy/zone-reach.json`: numbers only, one
 * digit per sample in the order of the proxy file (0 out of the field, 1 in the field only behind
 * something, 2 seeable), with the snapshot it was computed for. The engine uses it only while that
 * snapshot is the current one.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import prettier from 'prettier'

import { anatomyManifest } from '../../src/features/medical-thoracoscopy/content/data/generated/anatomy'
import { PLEURAL_ZONE_IDS } from '../../src/features/medical-thoracoscopy/content/pleuralZones'
import { acrossRibsLimitDeg } from '../../src/features/medical-thoracoscopy/engine/space/fulcrum'
import {
  createResolver,
  loadSpace,
} from '../../src/features/medical-thoracoscopy/engine/space/loadSpace'
import {
  computeReach,
  REACH_GRID,
  reachDigits,
  reachIdentity,
} from '../../src/features/medical-thoracoscopy/engine/space/zoneReach'

const ROOT = path.resolve(__dirname, '../..')
const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const PACKAGED = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
const RECORD = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/content/data/anatomy/zone-reach.json',
)
const LUNG_STEP = 8

async function main(): Promise<void> {
  const file = (id: string) => {
    const entry = anatomyManifest.files.find((f) => f.id === id)
    if (!entry) throw new Error(`The anatomy manifest has no ${id}`)
    return { bytes: readFileSync(path.join(PACKAGED, entry.file)), sha256: entry.sha256 }
  }
  const spaceFile = file('proxy-pleural-space')
  const lungFile = file('proxy-lung')
  const space = loadSpace(spaceFile.bytes, lungFile.bytes)
  const resolver = createResolver(space)
  const started = Date.now()
  const { reach, seeable, poses } = computeReach(space, resolver, LUNG_STEP)
  const zones = PLEURAL_ZONE_IDS.map((id) => {
    const members = space.samples.zones.flatMap((zone, s) => (zone === id ? [s] : []))
    return {
      id,
      samples: members.length,
      reachable: members.filter((s) => reach[s]).length,
      seeable: members.filter((s) => seeable[s]).length,
    }
  })
  const record = {
    record: 'medical-thoracoscopy-zone-reach',
    version: 1,
    script: 'scripts/medical-thoracoscopy/build-zone-reach.ts',
    statement:
      'Numbers only: for each zone sample, one digit: 0 if no position the port allows brings it into the telescope’s field, within range and facing it, with the lung collapsed; 1 if some does, but always with something in the way; 2 if some position shows it with nothing in the way. Per region, the counts. Computed by the space engine from the collision proxies, which are not in the repository.',
    label: 'Authored construct',
    computedFor: reachIdentity(LUNG_STEP),
    lungStep: LUNG_STEP,
    grid: {
      ...REACH_GRID,
      acrossRibsLimitDeg: acrossRibsLimitDeg(space.port, space.device),
      alongRibsLimitDeg: space.device.alongRibsLimitDeg,
    },
    files: { 'proxy-pleural-space': spaceFile.sha256, 'proxy-lung': lungFile.sha256 },
    poses,
    reachable: reachDigits(reach, seeable),
    zones,
  }
  const options = await prettier.resolveConfig(path.join(ROOT, 'package.json'))
  writeFileSync(
    RECORD,
    await prettier.format(JSON.stringify(record), { ...options, parser: 'json' }),
  )
  console.log(`${poses} positions in ${Math.round((Date.now() - started) / 1000)} s`)
  for (const zone of zones)
    console.log(
      `  ${zone.id}: ${zone.reachable} of ${zone.samples} reachable, ${zone.seeable} seeable`,
    )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
