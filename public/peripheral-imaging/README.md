# Peripheral imaging suite assets

CT-derived teaching context and authored geometry for the peripheral-imaging
course. Source headers, identifiers and local absolute paths are excluded. The
original clinical source files remain outside Git in the primary checkout.

| Asset                         | What it contains                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `anatomy/thorax.glb`          | Four Slicer-derived layers: airways, lungs, ribs/spine and thoracic envelope; embedded Draco geometry      |
| `anatomy/ct-atlas.png`        | 192³ quantized CT packed into a 16 × 12 PNG atlas, with a baked authored part-solid nodule                 |
| `anatomy/dts-projections.png` | Thirteen parallel projections for each of five authored sweeps, using the same nodule plus a straight tool |
| `anatomy/fluoroview-carm.glb` | Retained original FluoroView gantry animation; retirement remains an owner decision                        |
| `sampling-window.glb`         | Repository-authored sphere and fictional needle side window                                                |
| `room-hero.png`               | Text-free 2400 × 1000 still from the real room mode, on `#061519`; approximately 134 KB                    |

`manifest.json` records source/output SHA-256 hashes and sizes for every binary
asset. `anatomy/manifest.json` records CT coordinates, quantization, source SHA,
anatomy layers and the nodule parameters. `anatomy/dts.json` records the projection
layout, processing and matching nodule provenance. `room-hero.json` records the
room render's scene sources, CT/airway hashes, camera, layers and tool versions.

The nodule is centered at `[85, -20, -30]` mm in LAS coordinates, with radius 9 mm,
a 4.05 mm core at −350 HU, and a smooth blend into the original surrounding lung.
These are authored teaching values from the physics contract and build parameters,
not a finding in the source CT. A voxel comparison to the contract commit found
495 changed voxels, all inside the nodule; no outside voxel changed. CT and DTS
use that same target density. The CT supplies context, while the analytic
sphere/tool geometry remains the source of exercise feedback.

The suite's C-arm, room, detector and cone are procedural components. Their posed
source/detector share `lib/physics.ts` and the original DRR renderer's geometry.
They need no extra GLB or renderer. The live monitor canvas supplies the detector
texture, keeping the view to two WebGL contexts. The former schematic thorax,
fixed-suite and mobile-suite GLBs are not part of this package.

Coordinates are millimeters, x left / y anterior / z superior. GLB roots convert
millimeters to meters; the runtime restores the teaching millimeter scale. The
package is approximately 6.8 MiB by file bytes, under the 12 MiB budget. Runtime assets are PNG,
GLB and JSON only; the existing decoder is local at `/fluoroview/draco/`.

Full provenance, interpretation limits, Slicer commands and optional nodule
parameters are in `docs/peripheral-imaging/slicer-assets.md`. Run Slicer in a
separate process, with `IMAGING_SOURCE_DIR` pointing at the original source.
After all exports and Draco compression:

```sh
npx tsx scripts/peripheral-imaging/render-room-hero.ts
npx tsx scripts/peripheral-imaging/write-asset-manifest.ts
npx tsx scripts/peripheral-imaging/verify-nodule-assets.ts
npx jest src/features/peripheral-imaging --runInBand
```

The original FluoroView/SlicerHeart gantry retains its existing licensing; this
package does not present it as newly authored CAD or a new model download.
