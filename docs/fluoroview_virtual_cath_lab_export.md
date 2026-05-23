# FluoroView Virtual Cath Lab Export

Use this when SlicerHeart Virtual Cath Lab shows the CT, airway model, and rendered C-arm fluoro
the way you want FluoroView to match. The export captures derived geometry and rendered images from
Slicer; it does not require exporting raw CT or raw segmentation volumes.

## Before Exporting

In 3D Slicer:

1. Open the scene with `Patient_4_CT`, the final airway model/segmentation, and SlicerHeart
   Virtual Cath Lab.
2. In `Modules > Virtual Cath Lab`, select `GenericFluoro` unless you specifically want biplane.
3. Set the C-arm to the reference view you trust, usually AP:
   - L-arm angle: `-90`
   - P-arm angle: `1`
   - C-arm angle: `0`
   - Detector rotation: keep the value that makes the Slicer fluoro view look right.
   - SID: keep the SlicerHeart value, often `940 mm`.
4. Confirm the top-right `CArmFrontalXRay` view has the airway/model aligned with the X-ray image.
5. Optional but helpful: place markup points for the carina, trachea top, right main, and left main.

## Run The Export

From Slicer's Python Interactor, paste:

```python
import sys
sys.argv = [
    "export_virtual_cath_lab_bundle.py",
    "/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/fluoro_2/virtual-cath-lab-export",
    "--render",
    "--screenshots",
    "--sample-model-points",
    "20",
]
exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/tools/fluoroview-pipeline/scripts/export_virtual_cath_lab_bundle.py").read())
```

If `--render` prints a warning, that is OK as long as the C-arm fluoro image is already visible in
Slicer. The script will still export the current rendered C-arm volume nodes.

## Expected Output Files

The output folder should include:

- `virtual_cath_lab_bundle.json`
- `CArmFrontalXRay.png`
- `CArmLateralXRay.png`, if the lateral view exists
- `virtual_cath_lab_screenshots_manifest.json`
- `three_d_view_*.png`
- `slice_view_*.png`

The JSON includes:

- Virtual Cath Lab parameter node values
- node references such as `ct-to-table`, `gantry-to-ras`, camera transforms, and C-arm X-ray nodes
- rendered C-arm volume metadata
- volume, model, segmentation, markup, transform, camera, slice, and view matrices
- optional sampled surface points for sanity checking alignment

## What Not To Export

Do not export or commit:

- raw DICOM
- `.nii` / `.nii.gz`
- `.nrrd`
- `.stl`
- `.obj`
- raw segmentation volumes

The generated JSON, PNGs, and screenshots are derived calibration artifacts and can stay under the
ignored `fluoro_2` folder until FluoroView ingests only the final non-PHI web assets.

## Full Scene Export Path

If you use Slicer's `Save` dialog and export a full scene folder such as
`fluoro_2/C_arm_files`, FluoroView can ingest more of SlicerHeart's calibration state directly from
the `.mrml` file. This is the preferred path when you want the browser app to reuse Virtual Cath
Lab detector/camera settings, table shifts, rendering presets, and the C-arm reference image.

Expected useful files include:

- `2026-05-20-Scene.mrml`
- `CArmFrontalXRay.nrrd`
- `FluoroRenderingPreset_01.vp.json`
- `frontal-*.h5` and `table-*.h5` transform files
- `frontal-*.vtk` and `table-*.vtk` C-arm/table model files

Ingest it from the repo root:

```bash
PYTHONPATH=tools/fluoroview-pipeline/src python3 \
  tools/fluoroview-pipeline/scripts/ingest_slicer_c_arm_scene.py \
  --scene-dir /Users/russellmiller/Projects/Interventional-Pulm-Education-Project/fluoro_2/C_arm_files \
  --case-dir public/fluoroview/cases/patient-4
```

The ingest publishes only:

- `public/fluoroview/cases/patient-4/virtual-cath-lab/slicerheart_frontal_reference.png`
- `public/fluoroview/cases/patient-4/metadata/slicer_c_arm_scene_manifest.json`
- updated SlicerHeart metadata inside `case_manifest.json`

It does not copy the source `.mrml`, `.nrrd`, `.h5`, or `.vtk` files into `public`.
