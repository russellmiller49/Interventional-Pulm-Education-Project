/**
 * Bake what the X-ray path through the nodule crosses, for every whole-degree view obliquity and
 * tilt, into `src/features/peripheral-imaging/data/rayCrossings.json`.
 *
 *   npx tsx scripts/peripheral-imaging/build-ray-crossings.ts
 *
 * Rerun after any change to the CT atlas or to `lib/rayStructures.ts`; `model-truth.test.ts` fails
 * when the table and the atlas disagree.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import metadata from '../../public/peripheral-imaging/anatomy/manifest.json'
import { LESION_CENTER } from '../../src/features/peripheral-imaging/lib/physics'
import {
  crossingBits,
  crossingFromMm,
  labelStructures,
  structuresOnRay,
} from '../../src/features/peripheral-imaging/lib/rayStructures'

const ATLAS = resolve('public/peripheral-imaging/anatomy/ct-atlas.png')
const OUT = resolve('src/features/peripheral-imaging/data/rayCrossings.json')
const OBLIQUITY = { min: -105, max: 105 }
const TILT = { min: -25, max: 25 }

async function main() {
  const sha = createHash('sha256').update(readFileSync(ATLAS)).digest('hex')
  if (sha !== metadata.atlasSha256) throw new Error('ct-atlas.png does not match its manifest hash')
  const { data, info } = await sharp(ATLAS).raw().toBuffer({ resolveWithObject: true })
  const [sx, sy, sz] = metadata.sizeXyz
  const width = sx * metadata.atlasColumns
  const volume = new Uint8Array(sx * sy * sz)
  for (let z = 0; z < sz; z++) {
    const col = z % metadata.atlasColumns
    const row = Math.floor(z / metadata.atlasColumns)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++)
        volume[(z * sy + y) * sx + x] =
          data[((row * sy + y) * width + col * sx + x) * info.channels]
  }
  const structures = labelStructures(volume)
  const rows: string[] = []
  for (let tilt = TILT.min; tilt <= TILT.max; tilt++) {
    let row = ''
    for (let obliquity = OBLIQUITY.min; obliquity <= OBLIQUITY.max; obliquity++)
      row += crossingBits(crossingFromMm(structuresOnRay(structures, obliquity, tilt))).toString(16)
    rows.push(row)
  }
  const table = {
    schema: 'peripheral-imaging-ray-crossings/v1',
    generator: 'scripts/peripheral-imaging/build-ray-crossings.ts',
    atlasSha256: sha,
    target: LESION_CENTER,
    bits: { mediastinum: 1, rib: 2, spine: 4, diaphragm: 8 },
    obliquity: OBLIQUITY,
    tilt: TILT,
    rows,
  }
  writeFileSync(OUT, `${JSON.stringify(table, null, 2)}\n`)
  console.log(`wrote ${OUT}: ${rows.length} tilts × ${rows[0].length} obliquities`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
