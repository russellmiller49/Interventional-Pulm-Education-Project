import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import anatomy from '../../public/peripheral-imaging/anatomy/manifest.json'
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const root = 'public/peripheral-imaging/'
const entries = [
  {
    path: 'anatomy/thorax.glb',
    sourceSha256: anatomy.sourceSha256,
    secondarySourceSha256: anatomy.airwaySourceSha256,
    source:
      'Existing teaching CT and segmented airway surface; Slicer thresholding and Draco compression',
  },
  {
    path: 'anatomy/ct-atlas.png',
    sourceSha256: anatomy.sourceSha256,
    source:
      'Existing teaching CT, resampling and 8-bit quantization with an authored part-solid nodule',
  },
  {
    path: 'anatomy/dts-projections.png',
    sourceSha256: anatomy.sourceSha256,
    source:
      'Derived CT atlas with its baked nodule and an added authored tool; parallel projections and high-pass filtering',
  },
  {
    path: 'anatomy/fluoroview-carm.glb',
    sourceSha256: hash('public/fluoroview/cases/patient-new/carm/c_arm_animation.glb'),
    source:
      'Existing published FluoroView gantry animation, Draco-compressed; retained pending retirement decision',
  },
  {
    path: 'sampling-window.glb',
    sourceSha256: hash('src/features/peripheral-imaging/lib/models.ts'),
    source:
      'Repository-authored sphere and side-window model; source SHA identifies geometry code, not a CT',
  },
]
const assets = entries.map((entry) => ({
  ...entry,
  sha256: hash(root + entry.path),
  bytes: statSync(root + entry.path).size,
}))
writeFileSync(
  root + 'manifest.json',
  JSON.stringify(
    {
      schema: 'peripheral-imaging-assets/v1',
      authoredOn: '2026-09-08',
      assets,
      authoredNodule: anatomy.authoredNodule,
      noduleSourceSha256: hash('scripts/peripheral-imaging/authored_nodule.py'),
      limitations:
        'CT-derived teaching context and authored geometry. No clinical performance, exposure, reconstruction or clearance validation.',
    },
    null,
    2,
  ) + '\n',
)
console.log(`Recorded source and output hashes for ${assets.length} assets.`)
