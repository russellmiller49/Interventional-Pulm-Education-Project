# CT-derived assets and original FluoroView reuse

Generated and reviewed 2026-09-08 using 3D Slicer 5.12.3. The course reuses the
original FluoroView dataset and rendering implementation, with new browser assets.
It does not require Slicer, an external image service or a clinical scanner at runtime.

## Provenance

| Delivered asset               | Source and processing                                                                                                                                    | Runtime use                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `anatomy/thorax.glb`          | Existing `target_clean_ct.nrrd` and `Final_airway_target.vtk`; Slicer/VTK thresholding, surface extraction, smoothing, decimation and Draco compression  | Independently selectable airways, lungs, ribs/spine and thoracic envelope    |
| `anatomy/ct-atlas.png`        | Same CT; 192³ samples with a baked authored part-solid nodule, quantized to 8-bit over −1100 to 1800 HU, packed into a 16 × 12 PNG atlas                 | Original FluoroView volume DRR renderer and linked CT slice context          |
| `anatomy/fluoroview-carm.glb` | Existing `public/fluoroview/cases/patient-new/carm/c_arm_animation.glb`; Draco compression preserves its animation                                       | Original FluoroView C-arm motion reference                                   |
| `anatomy/dts-projections.png` | Parallel projections of the derived CT with its baked part-solid target and a straight tool added to the volume; horizontal Gaussian high-pass filtering | Browser shift-and-add refocusing of 13 views at each of five authored sweeps |
| `sampling-window.glb`         | Original procedural sphere and fictional side-window needle                                                                                              | Download of the geometry used in the sampling exercise                       |

The local source stays in the primary checkout's `fluoro_2/New_patient` directory.
No raw NRRD, DICOM headers, local absolute path, name, or identifier is copied into
the public assets. The manifest records a source hash, geometry and processing
provenance. Original source files and the user's running Slicer session are untouched.

The prior FluoroView pipeline used SlicerHeart/VirtualCathLab, and the installed
SlicerHeart fluoroscopy presets were inspected. This revision actually uses Slicer
for the anatomy exports and reuses the already-published FluoroView gantry. It does
**not** claim a new calibrated SlicerHeart fluoroscopy export. SlicerHeart's bundled
gantry source has separate licensing; its encrypted source was not extracted, and
the reused animation is not offered as a newly authored model download.

Technical workflow references: [Slicer scripting](https://slicer.readthedocs.io/en/v5.12.0/developer_guide/script_repository.html)
and [SlicerHeart](https://github.com/SlicerHeart/SlicerHeart). These are implementation
references, separate from the course's published clinical bibliography.

## Rebuild

Run from this worktree with the local source available. Use a separate Slicer
process; do not modify an open user scene. Substitute the source directory for
your machine without committing that local path.

```sh
export IMAGING_SOURCE_DIR=/path/to/fluoro_2/New_patient
export IMAGING_OUTPUT_DIR="$PWD/public/peripheral-imaging/anatomy"
/Applications/Slicer.app/Contents/MacOS/Slicer --no-main-window --no-splash --ignore-slicerrc --disable-settings --python-script scripts/peripheral-imaging/build-slicer-anatomy.py
/Applications/Slicer.app/Contents/MacOS/Slicer --no-main-window --no-splash --ignore-slicerrc --disable-settings --python-script scripts/peripheral-imaging/build-dts-projections.py
npx gltf-pipeline -i public/peripheral-imaging/anatomy/thorax.glb -o /tmp/imaging-thorax-compressed.glb -d
cp /tmp/imaging-thorax-compressed.glb public/peripheral-imaging/anatomy/thorax.glb
npx gltf-pipeline -i public/fluoroview/cases/patient-new/carm/c_arm_animation.glb -o public/peripheral-imaging/anatomy/fluoroview-carm.glb -d
npx tsx scripts/peripheral-imaging/export-models.ts
npx tsx scripts/peripheral-imaging/write-asset-manifest.ts
npx tsx scripts/peripheral-imaging/verify-nodule-assets.ts
```

Runtime dependencies already exist in the repository. The GLB decoder is served
locally at `/fluoroview/draco/`. The optimized anatomy is approximately 457 KiB,
the original gantry 955 KiB, the CT atlas 4 MiB and the DTS atlas 1.2 MiB. PNG
atlases decode once per browser page and are shared between mounted views.

## Geometry and interpretation contracts

- Course coordinates are millimeters in LAS (left, anterior, superior), centered
  on the teaching volume. The GLB root converts millimeters to meters; the scene
  converts it back to the controls' millimeter scale. The script rejects source
  orientation it does not support instead of dropping that orientation silently.
- The cone projection uses the original FluoroView detector frame: source distance
  720 mm, source-detector distance 1200 mm, field 640 mm. These are authored model
  values, not recommended console settings. A test compares both projected axes
  with the original renderer at combined obliquity and tilt.
- The added target is centered at `[85, −20, −30]` mm. The geometry lab's tool moves
  along the initial source–target ray, so its frontal projection overlaps the
  target even with a nonzero physical offset. A second view reveals parallax.
- The suite uses a procedural C-arm: orbit about z, then tilt about local x. Its
  source and detector land on the shared detector frame. The original animation
  remains only in the legacy fallback, and its retirement is still an owner decision.
  Fixed/mobile acquisition animation is a later round; the shell variants are
  schematic and do not claim a manufacturer geometry or a clearance result.
- Scouts translate the same CT and overlays used by the centering controls. The
  registration exercise translates CT and target rigidly while keeping the tool
  and historical contour fixed; it does not simulate deformation or physiology.
- DTS uses parallel projections, a fixed 13-view sample count, a Gaussian high-pass
  filter (sigma 7 source pixels), and bilinear shift-and-add at the selected depth.
  All depths use one display window. Source slices and projections are approximate,
  with no vendor algorithm, scatter, spectral detector response or dose inference.
- Sampling MPR adds analytic sphere/cylinder sections over the CT background. CT
  context uses trilinear interpolation and an illustrative 102 mm MIP for the slab.
  The analytic tool/target geometry remains the source of the exercise's feedback;
  the CT now contains the authored part-solid nodule. The tool is an analytic
  overlay in CT/DRR and is added separately for the DTS teaching projections.

Threshold-derived lung/bone surfaces can include vessels, truncated scan boundaries
and segmentation artifacts. They provide anatomical context and are not diagnostic
segmentations. The original schematic thorax/fixed/mobile GLBs were retired from
this course; source FluoroView assets remain available in their existing location.

## Review checks

Tests cover GLB self-containment/size, atlas dimensions and scalar dynamic range,
the target's location in lung, cone-frame agreement, DTS tile selection/refocusing,
and shared model feedback. Browser checks read actual canvas pixels to catch a
loaded-but-blank renderer, exercise the gantry and depth controls, and inspect
desktop/mobile screens. They do not validate clinical imaging performance.

## Imaging-suite detector spike — 2026-09-08

Checkpoint for Claude before extending the suite. `DrrTextureSource` owns one
preserved WebGL2 canvas and one sRGB `CanvasTexture`; `DetectorImage` maps U to
image-right and V to image-up on a source-facing quad. The monitor uses the
existing `ProjectionView` SVG coordinates. No mode is marked ready by this spike.

At obliquity 30° and tilt 15°, the target projects to `(349.31097750,
275.79558417)` on the 512-square overlay. In the fronted Codex browser, a 128²
normalized pixel comparison gave mean absolute gray error 0.84/255 aligned,
23.29 horizontally mirrored and 35.17 vertically mirrored. Thirty 460² uploads
measured 0.1 ms median / 0.1 ms p95 on this machine at the browser's timer
resolution. This measures `initTexture` plus completed destination GPU work,
after draining prior source/destination work; it excludes DRR generation and
is not a cross-device performance guarantee. Mipmaps are disabled.

`VolumeDRRRenderer.resize(scale, {width, height, pixelRatio})` retains an explicit
size for later renders. With a hidden monitor whose layout rect was `[0, 0]`,
the DRR remained 460² and continued updating (0.1 ms median/p95). The default
layout-based path remains available to existing callers. Both views together
use two WebGL contexts. No added dependency or public asset is needed.

Reproduce with `npx tsx scripts/peripheral-imaging/serve-spike.ts`, then open
`http://127.0.0.1:5117/scripts/peripheral-imaging/drr-spike.html`. Use **Measure
texture upload**, then **Toggle zero-rect monitor** and measure again. The
screenshot and JSON observations are local verification artifacts under
`test-results/peripheral-imaging/spike/`. The application dev server uses 3117.

Checkpoint validation: focused Jest 8 suites / 59 tests passed;
`npm run type-check` passed; ESLint on the changed TS/TSX files passed.

## Authored nodule bake and signal view — round one

The separate Slicer 5.12.3 export reused source SHA-256
`572afc5bf6b2d80b28439e0397ad4e24e4eb6dfb2630780593259e081ae0a29b`.
The source and open user scene were not modified. `authored_nodule.py` reads the
default center and radius from `lib/physics.ts`. Optional build parameters are
`IMAGING_NODULE_CENTER_MM` (JSON triple), `IMAGING_NODULE_RADIUS_MM`,
`IMAGING_NODULE_CORE_HU` and `IMAGING_NODULE_CORE_FRACTION`. Defaults are the
contract target `[85, -20, -30]`, radius 9 mm, −350 HU core and core fraction 0.45.
The manifest records the resolved parameters; changing them intentionally requires
updating the physics contract and its asset checks together.

The bake preserves float32 values outside the sphere, including quantization
ties. Independent comparison with commit `998081f5` found 495 changed voxels, none
outside the 9 mm sphere (farthest changed voxel: 8.9854 mm). The central encoded
sample is −349.41 HU; surrounding test points remain below −700 HU. DTS consumes
this baked volume instead of replacing the target with the previous denser sphere.
Its metadata records both the CT source SHA and the derived atlas SHA.

The signal view marches the shared source–target ray through the quantized atlas
at authored one-millimeter steps and groups CT density bands, with exact final
interval lengths. Bands are descriptive teaching proxies, not tissue diagnoses.
The authored target is tagged geometrically. The line and the strip share those
samples. No image brightness is driven by tube-load controls, and the signal
monitor omits the old painted target fill so the baked nodule supplies its signal.

The `projection` and `signal` modes are enabled in `SUITE_MODES_READY`. The dock
uses the lab control registry and its exact readout oracle; the boundary and
caption are supplied by the stage. Native radio labels are portaled outside the
image role, and a committed answer remains disabled. The scene has context-loss
recovery, a flat detector when the DRR fails, offscreen frame suspension and a
Step control that advances one authored degree, including under reduced motion.

The standalone contract preview uses the actual `ImagingSuitePane` entry point:
`http://127.0.0.1:5117/scripts/peripheral-imaging/suite-harness.html`. Run its
scene checks with
`npx playwright test --config=scripts/peripheral-imaging/playwright.suite.config.ts`.
They check canvas pixels, geometry/readout agreement, chain selection and lock,
signal changes, reduced motion, context recovery and a maximum of two live WebGL
contexts during repeated mode switches. They also exercise supplied camera changes,
spotlight focus, pause text, reset, a hidden live monitor and an axe accessibility
scan of the native chain answer and signal view. The app server is on 3117 and was signed
in using local development auth; the stage integration awaits Claude's sync.
The remaining modes, acquisition animations, labelmap and airway routes remain
for rounds two and three.

Round-one verification: 87 focused peripheral-imaging Jest tests passed (94
including the original DRR and detector-frame tests), six scene browser checks
passed, and type-check and ESLint on the owned TS/TSX files passed. Desktop
projection/signal and mobile screenshots are local review artifacts at
`test-results/peripheral-imaging/suite-{projection,signal,mobile}.png`. The whole
public package is approximately 6.65 MiB by file bytes; its root manifest covers
every binary asset with output hashes, sizes and source provenance.
