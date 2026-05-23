# FluoroView Pipeline Notes

FluoroView is a non-diagnostic educational simulator. It converts local CT and airway source assets
into derived web assets used by the `/fluoroview` Next.js module.

## Pipeline Contract

Inputs stay local:

- raw DICOM
- raw NIfTI
- raw segmentation NRRD
- source OBJ/STL segmentation files

Outputs may be committed or deployed after review:

- `case_manifest.json`
- optimized GLB
- centerline JSON
- segment metadata JSON
- CT slice tiles
- DRR atlas frames
- validation images

## Projection Model

The CPU projector is an approximate ray-sum model:

```text
mu = mu_water * (1 + HU / 1000)
```

It is deterministic and intended for local testing and first-pass atlas generation. It is not a
diagnostic model, not patient-specific dosimetry, and not calibrated to a real C-arm.

TIGRE is optional and isolated to the GPU VM workflow.

As of this implementation, the VM wrapper should be treated as `tigre-placeholder`: TIGRE is
installed and imported on the VM, but the repo's `TigreProjector` still delegates projection math to
the CPU ray-sum backend. Public manifests must keep that provenance visible until the wrapper is
replaced with true TIGRE projection geometry and the atlas is regenerated.

## Web Viewer Contract

The browser loads one `FluoroCaseManifest`, picks the nearest DRR atlas frame for the selected
RAO/LAO and cranial/caudal angles, then applies educational knobology effects client-side. The
transparent Three.js airway overlay uses the same C-arm angles and isocenter as the atlas frame.

Each public case manifest must include DRR atlas provenance, including backend label, detector
pixels, checksum metadata, and any caveat needed to distinguish placeholder projections from true
TIGRE outputs.
