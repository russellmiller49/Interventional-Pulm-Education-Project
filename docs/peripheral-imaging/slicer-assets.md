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

## Phase 2 — field

The field view uses the shared target-centred shutter rectangle for the collimator
opening, beam cross-section, detector mask and monitor mask. Physical shutters
narrow the cone; selecting display crop restores the full cone and retains the
image mask. Stored-image zoom transforms only the monitor image. No new assets or
runtime dependencies are used; the pinned-display height and camera fitting are
unchanged. The boundary is printed verbatim from the section specification.

The static harness can open authored sections with `?section=field` (and other
section ids). Its background now matches the dark lesson pane. Validation on
2026-09-09: 153 focused Jest tests, TypeScript, ESLint, seven scene scenarios and
six application scenarios passed. The first app navigation needed a warm-server
rerun after cold compilation exceeded its five-second assertion. Manual review at
`/en/peripheral-imaging/learn?section=field` confirmed the lab goal flips at a
60% field side and the acquired image stays visible. Tests distinguish the
physical field, display mask and monitor-only zoom.

## Phase 2 — time

The focal spot pulses while an authored tool translates. The detector and monitor
hold the most recently completed exposure; a magnified sample strip distinguishes
movement during each pulse from travel between measurements. All timing and
motion distances use `temporalMetrics`; tube load never changes the DRR. A shared
clock clamps frame deltas to 1/30 second and runs authored time at one tenth speed.
Only visible, unlocked, playing scenes request continuous rendering. Pause holds
time, reduced motion opens a completed sample, and Step advances one pulse.

Validation on 2026-09-09: 155 focused Jest tests, TypeScript, ESLint, eight scene
scenarios and six app scenarios passed. The live time section was checked through
Act, including halving rate, doubling width and the resulting goal completion.
The frame caption remains readable in a narrow simulator pane. No assets or
runtime dependencies were added.

## Phase 2 — CBCT

One DRR context supplies two orthogonal scout copies and 24 low-resolution orbit
copies. Fixed and mobile teaching gantries have distinct supports, panel sizes,
field-of-view cylinders and drawn swept envelopes. The +/-8 mm teaching-center
predicate remains the engine's authored tolerance. Capture runs only after the
readiness checks, records completion after the last projection, and a moved setup
invalidates its copies. Reduced motion starts with completed illustrative copies;
Step, Pause, Reset, locking and visibility control the sequence explicitly.

After the orbit, the original CT appears as three MPR planes, explicitly labelled
as CT standing in for the volume; it is not reconstructed from the orbit. There
are no new assets or dependencies. The display-height and pane-container rules
are retained. Control scrolling now accounts for the pinned display height, and
overview chain labels use leader lines to avoid obscuring the equipment. Camera
fitting still includes the physical chain and now includes the whole swept arc.

The owner's latched-action fix in PR #148 is included from main. Its regression
drives all three acquisition sections through every required Act goal, including
capture. The scene test additionally checks that the rendered acquisition reports
capture and that moving the setup invalidates it. Engine files remain owner-managed.

## Phase 2 — DTS

The authored 13-projection atlas supplies the arc thumbnails and the sliding
teaching focal plane. Smear widths reuse dtsShift; dashed sectors mark unsampled
directions. The atlas remains a parallel-beam teaching construction. Continuous
collection runs only while visible and enabled; reduced motion shows the completed
sweep, and Step collects one projection. Plane controls use the existing lab
actions and clamps. The filmstrip and explanatory text scroll below the displays.
No DRR context, new asset or dependency is created. Unit and scene checks cover
projection geometry, refocusing pixels, playback, actions, locks and context count.

## Phase 2 — DTS prior

The authored dts-interpretation view is a sorter with no bound lab controls and a
hidden monitor. Its console therefore uses local measured / prior / blend controls,
without inventing lab readouts. Gray atlas-derived pixels remain recoverable;
planning-CT pixels are separately tinted teal. Prior controls wait for the CT,
and a failed load is reported rather than presenting measured pixels as a prior.
The console texture and its hidden 2D source share those pixels. Scene checks
verify the color change, recovery, reduced-motion Step, locking and a single
WebGL context. No assets or dependencies were added.

## Phase 2 — sampling

The authored sphere and side-window needle use the physics contract's target,
tip and sampling-window geometry. Three thin CT quads and the MPR grid share
the existing slice offsets; slab mode combines the same authored depth interval.
The grid stays below the pinned displays. Target close-up framing, translucent
context and offset labels keep the window visible. Step advances one axial
slice. The engine computes window overlap and tip inclusion independently.
Unit and scene checks compare those relationships, linked pixel changes, slab
reset, reveal invalidation and the single-context limit. No assets were added.

## Phase 2 — navigation

The sensor is fixed at the nearest vertex of the existing registered airway mesh
to the authored target. The gray map stays in its original coordinates while the
colored current anatomy translates by the existing rigid registration state.
The sensor's 2D projection uses that same point, and a local contour update stores
the current displacement without moving the sensor. The field-generator board is
under the table. Pure and scene tests compare engine displacement, stale-state
readouts, current/stored visibility and pixel changes. This adds no route asset,
deformation model, tracking simulation or new dependency.

## Phase 2 — augmented imaging

The stored target projects along a source ray onto the live detector and monitor.
Current CT and target positions share the rigid state used in navigation; the
physical tool stays fixed. Capturing a contour updates its stored position, and
the existing engine reports whether it is stale. Current and stored overlays
can be toggled independently. Target close-ups use a closer authored distance
and labels sit away from the target. Scene tests verify ray/overlay agreement,
independent tool position, captures and toggles. No new assets were added.

## Phase 2 — staff

The orientation control rotates the actual gantry. Floor contours illustrate a
normalized inverse-square trend with authored weighting toward the tube entrance
side. A geometric barrier shadow changes the illustration without multiplying the
engine's distance readout by an invented attenuation factor. The numerical ratio
compares horizontal distance in the schematic floor plan. Overview framing includes
the full set of contours, and six separated chain labels retain leaders to their
physical locations. Unit and scene tests cover orientation, distance, shielding,
context count, label visibility and label separation. No assets were added.

## Phase 2 — dose

Two planes use inverse-square kerma and expanding beam area to show equal KAP.
The first is just after the collimator; the other uses the authored input plane.
An equipment-convention reference marker and a CT-derived surface-entry marker
are separate from those quantities. No skin-dose value is computed. The displayed
KAP readouts come from the existing lab engine, and field presets change both the
aperture and the cone. Pure and scene checks cover KAP invariance, detector/plane
footprints, presets, the surface marker and reduced-motion Step. This mode uses
one WebGL context and reuses the existing CT asset.
