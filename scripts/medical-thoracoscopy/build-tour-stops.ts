/**
 * Where the tour of section 6 stops (slice 12): for each survey region, the position of the
 * telescope, among those the port allows with the lung fallen away, that shows the most of the
 * region with nothing in the way. The tour takes the telescope to each in turn; the learner does not
 * steer in that section.
 *
 *   npx tsx scripts/medical-thoracoscopy/build-tour-stops.ts
 *
 * Reads the packaged proxies from the owner's local data and runs the space engine over the same
 * grid as reach (`REACH_GRID`), keeping, for each region, the first position that shows the most of
 * its samples. Writes `src/features/medical-thoracoscopy/content/data/anatomy/tour-stops.json`:
 * numbers only, with the snapshot they were computed for. An authored construct: the stops are
 * chosen for teaching, from the model's own geometry.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import prettier from 'prettier'

import type { ScopePose } from '../../src/features/medical-thoracoscopy/components/space/types'
import { anatomyManifest } from '../../src/features/medical-thoracoscopy/content/data/generated/anatomy'
import {
  PLEURAL_ZONE_IDS,
  type PleuralZoneId,
} from '../../src/features/medical-thoracoscopy/content/pleuralZones'
import { acrossRibsLimitDeg } from '../../src/features/medical-thoracoscopy/engine/space/fulcrum'
import {
  createResolver,
  loadSpace,
} from '../../src/features/medical-thoracoscopy/engine/space/loadSpace'
import { CLEARANCE_SKIN_MM } from '../../src/features/medical-thoracoscopy/engine/space/spatial/spatialWorld'
import { VIEW } from '../../src/features/medical-thoracoscopy/engine/space/spatial/visibility'
import {
  REACH_GRID,
  reachIdentity,
} from '../../src/features/medical-thoracoscopy/engine/space/zoneReach'

const ROOT = path.resolve(__dirname, '../..')
const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const PACKAGED = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
const RECORD = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/content/data/anatomy/tour-stops.json',
)
const LUNG_STEP = 8

function span(from: number, to: number, step: number): number[] {
  const count = Math.max(1, Math.ceil((to - from) / step))
  return Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count)
}

const round = (value: number) => Math.round(value * 100) / 100

async function main(): Promise<void> {
  const bytes = (id: string) => {
    const entry = anatomyManifest.files.find((f) => f.id === id)
    if (!entry) throw new Error(`The anatomy manifest has no ${id}`)
    return readFileSync(path.join(PACKAGED, entry.file))
  }
  const space = loadSpace(bytes('proxy-pleural-space'), bytes('proxy-lung'))
  const resolver = createResolver(space)
  const across = acrossRibsLimitDeg(space.port, space.device)
  const along = space.device.alongRibsLimitDeg
  const [least, most] = space.depthLimits
  const best = new Map<PleuralZoneId, { pose: ScopePose; seen: number; inField: number }>()
  // For a region no position shows any of: the position that brings the most of it into the field,
  // facing the telescope and within range, with something in the way.
  const facing = new Map<PleuralZoneId, { pose: ScopePose; inField: number }>()
  const zoneOf = space.samples.zones
  const started = Date.now()
  for (const a of span(-across, across, REACH_GRID.tiltStepDeg)) {
    const reachAlong = along * Math.sqrt(Math.max(0, 1 - (a / across) ** 2))
    for (const b of span(-reachAlong, reachAlong, REACH_GRID.tiltStepDeg)) {
      for (const depthMm of span(least, most, REACH_GRID.depthStepMm)) {
        const pose: ScopePose = { tiltAcrossRibsDeg: a, tiltAlongRibsDeg: b, depthMm, rollDeg: 0 }
        if (resolver.clearance(pose, LUNG_STEP) < CLEARANCE_SKIN_MM) break
        const counts = new Map<PleuralZoneId, number>()
        const inField = new Map<PleuralZoneId, number>()
        resolver.view(pose, LUNG_STEP).forEach((value, s) => {
          if (value === VIEW.out) return
          inField.set(zoneOf[s], (inField.get(zoneOf[s]) ?? 0) + 1)
          if (value === VIEW.inView) counts.set(zoneOf[s], (counts.get(zoneOf[s]) ?? 0) + 1)
        })
        for (const [zone, seen] of counts) {
          if (seen > (best.get(zone)?.seen ?? 0))
            best.set(zone, { pose, seen, inField: inField.get(zone) ?? seen })
        }
        for (const [zone, count] of inField) {
          if (count > (facing.get(zone)?.inField ?? 0)) facing.set(zone, { pose, inField: count })
        }
      }
    }
  }
  const stops = PLEURAL_ZONE_IDS.map((zone) => {
    const shown = best.get(zone)
    const faced = facing.get(zone)
    const found = shown ?? (faced ? { ...faced, seen: 0 } : undefined)
    const samples = zoneOf.filter((z) => z === zone).length
    return found
      ? {
          zone,
          pose: {
            tiltAcrossRibsDeg: round(found.pose.tiltAcrossRibsDeg),
            tiltAlongRibsDeg: round(found.pose.tiltAlongRibsDeg),
            depthMm: round(found.pose.depthMm),
            rollDeg: 0,
          },
          seenFromThere: found.seen,
          inFieldFromThere: found.inField,
          samples,
        }
      : { zone, pose: null, seenFromThere: 0, inFieldFromThere: 0, samples }
  })
  const record = {
    record: 'medical-thoracoscopy-tour-stops',
    version: 1,
    script: 'scripts/medical-thoracoscopy/build-tour-stops.ts',
    statement:
      'Numbers only: for each survey region, the position of the telescope that shows the most of it with nothing in the way, with the lung fallen away, how many of its samples that is, and how many lie in the field from there, seen or hidden. Where no position shows any of a region, the stop is the position that brings the most of it into the field with something in the way, and seenFromThere is 0. Computed by the space engine from the collision proxies, which are not in the repository.',
    label: 'Authored construct',
    computedFor: reachIdentity(LUNG_STEP),
    lungStep: LUNG_STEP,
    stops,
  }
  const options = await prettier.resolveConfig(path.join(ROOT, 'package.json'))
  writeFileSync(
    RECORD,
    await prettier.format(JSON.stringify(record), { ...options, parser: 'json' }),
  )
  console.log(`${Math.round((Date.now() - started) / 1000)} s`)
  for (const stop of stops)
    console.log(
      `  ${stop.zone}: ${stop.seenFromThere} seen, ${stop.inFieldFromThere} in the field, of ${stop.samples}`,
      JSON.stringify(stop.pose),
    )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
