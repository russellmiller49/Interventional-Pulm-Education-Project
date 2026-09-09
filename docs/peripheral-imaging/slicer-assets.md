# CT-derived assets and original FluoroView reuse

Generated and reviewed 2026-09-08 using 3D Slicer 5.12.3. The course reuses the
original FluoroView dataset and rendering implementation, with new browser assets.
It does not require Slicer, an external image service or a clinical scanner at runtime.

## Provenance

| Delivered asset               | Source and processing                                                                                                                                   | Runtime use                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `anatomy/thorax.glb`          | Existing `target_clean_ct.nrrd` and `Final_airway_target.vtk`; Slicer/VTK thresholding, surface extraction, smoothing, decimation and Draco compression | Independently selectable airways, lungs, ribs/spine and thoracic envelope    |
| `anatomy/ct-atlas.png`        | Same CT; 192³ scalar samples, quantized to 8-bit over −1100 to 1800 HU, packed into a 16 × 12 PNG atlas                                                 | Original FluoroView volume DRR renderer and linked CT slice context          |
| `anatomy/fluoroview-carm.glb` | Existing `public/fluoroview/cases/patient-new/carm/c_arm_animation.glb`; Draco compression preserves its animation                                      | Original FluoroView C-arm motion reference                                   |
| `anatomy/dts-projections.png` | Parallel projections of the derived CT with a spherical target and a straight tool added to the volume; horizontal Gaussian high-pass filtering         | Browser shift-and-add refocusing of 13 views at each of five authored sweeps |
| `sampling-window.glb`         | Original procedural sphere and fictional side-window needle                                                                                             | Download of the geometry used in the sampling exercise                       |

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
- The gantry's original animation chooses a dominant single axis and clamps to its
  recorded range. It is intentionally separated from the quantitatively linked
  CT view, not represented as a mechanically exact coupled-axis acquisition.
  Fixed/mobile choices change workflow guidance and invalidate readiness; they
  do not claim a particular manufacturer model or perform collision detection.
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
  the CT does not contain that target or instrument except in the separate DTS
  teaching volume, where they are explicitly added before projection.

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
