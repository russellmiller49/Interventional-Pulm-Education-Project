# Rigid bronchoscopy assembly assets

This directory contains an educational 3D reconstruction of an EFER-DUMON
rigid bronchoscopy set and generic accessory tools for the assembly puzzle lab.

## Runtime asset

`rigid-bronchoscopy-assembly-kit.glb` combines all 26 semantic component roots
into one request-efficient file. The same parts remain available as individual
GLBs in `components/` for inspection, reuse, and future lessons.

The existing EFER-DUMON model was separated without changing its geometry.
`efer-component-inventory.json` records the source SHA-256, semantic root names,
manufacturer part numbers, dimensions, bounds, and per-file hashes.

Eight additional teaching assets were generated from the supplied photographs and
manufacturer reference dimensions:

- Generic, unbranded round/cylindrical endoscopic camera head
- Generic C1 telescope light-guide adapter
- Generic C2 fiber-optic cable adapter
- Generic fiber-optic light cable
- Optical grasping forceps, 32-3230-430HM
- Semi-rigid grasping forceps, BPS2002
- Semi-rigid biopsy forceps, BPS2001
- 3 mm semi-rigid suction catheter

`tool-asset-inventory.json` distinguishes manufacturer-published dimensions
from photo-derived or educationally approximated geometry. The camera, C1/C2
adapters, and cable are deliberately generic; the supplied photographs did not
establish exact models or manufacturing dimensions. The EFER manual identifies
STORZ/Olympus, WOLF, and ACMI adapter families, but the supplied C1/C2 composite
does not establish which interface those teaching pieces represent. The
BX-5500-FA's 490 mm shaft in the source model is also retained only as an
educational geometry estimate; the current
manufacturer pages publish its 5.5 mm diameter and 0-degree view, but not that
working length.

## Regeneration

The component split and accessory build are reproducible:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/rigid-bronchoscopy/split-efer-components.py -- \
  SOURCE.glb public/models/rigid-bronchoscopy/assembly/components \
  public/models/rigid-bronchoscopy/assembly/efer-component-inventory.json \
  /tmp/efer-component-roundtrip-validation.json

/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/rigid-bronchoscopy/build-rigid-tool-assets.py -- \
  public/models/rigid-bronchoscopy/assembly/components \
  public/models/rigid-bronchoscopy/assembly
```

These models support equipment-recognition and assembly education. They are not
validated manufacturing CAD, procedural guidance, or a substitute for device
instructions for use and supervised clinical training.
