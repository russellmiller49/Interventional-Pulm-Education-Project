import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import metadata from '../../public/peripheral-imaging/anatomy/manifest.json'

async function main() {
  const baseline = execFileSync(
    'git',
    ['show', '998081f5:public/peripheral-imaging/anatomy/ct-atlas.png'],
    { maxBuffer: 12 * 1024 * 1024 },
  )
  const previous = await sharp(baseline).raw().toBuffer({ resolveWithObject: true })
  const current = await sharp(readFileSync('public/peripheral-imaging/anatomy/ct-atlas.png'))
    .raw()
    .toBuffer({ resolveWithObject: true })
  const nodule = metadata.authoredNodule
  let changed = 0,
    outside = 0,
    maxRadius = 0
  const size = metadata.sizeXyz[0]
  for (let z = 0; z < metadata.sizeXyz[2]; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const pixel =
          (Math.floor(z / metadata.atlasColumns) * size + y) * current.info.width +
          (z % metadata.atlasColumns) * size +
          x
        if (
          current.data[pixel * current.info.channels] ===
          previous.data[pixel * previous.info.channels]
        )
          continue
        changed++
        const radius = Math.hypot(
          ...[x, y, z].map(
            (n, i) => metadata.originMm[i] + n * metadata.spacingMm[i] - nodule.centerMm[i],
          ),
        )
        maxRadius = Math.max(maxRadius, radius)
        if (radius > nodule.radiusMm) outside++
      }
  const result = {
    baseline: '998081f5',
    sourceSha256: metadata.sourceSha256,
    changedVoxels: changed,
    changedOutsideAuthoredSphere: outside,
    farthestChangedVoxelMm: maxRadius,
    authoredNodule: nodule,
  }
  console.log(JSON.stringify(result, null, 2))
  if (changed === 0 || outside !== 0)
    throw new Error('The atlas change must stay inside the authored sphere')
  mkdirSync('test-results/peripheral-imaging', { recursive: true })
  writeFileSync(
    'test-results/peripheral-imaging/nodule-verification.json',
    JSON.stringify(result, null, 2) + '\n',
  )
}
void main()
