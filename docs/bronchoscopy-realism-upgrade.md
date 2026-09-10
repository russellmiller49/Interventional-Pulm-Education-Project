# Bronchoscopy realism implementation

Order: synchronized anatomy → EBUS continuous scanning → navigation trainer.
Sources in the primary checkout are read-only; derived assets are prepared in this worktree.

## Baseline

- 42 airway and 94 EBUS unit tests passed before changes.
- Source lumen: 673,216 triangles, one connected component, no boundary/nonmanifold edges.
- 16 of 8,294 centerline samples tested outside the source surface.
- Screenshot RUL entrance rays can see the proximal mainstem/trachea; preserve valid anatomy and correct optical framing/position rather than sealing a real opening.
- Flexible reference views: RB1 superior; RB5 screen-left; LUL upper division above lingula.
- Active simplified EBUS station contact differs from the old physics image contact by 19.998 mm.

## Validation record

Implementation and rendered review results are recorded here as each milestone is completed.

## Synchronized Bronchoscopy

Implemented a patient-LPS optical frame, transported orientation, the three requested flexible reference views, frame-aware screen steering, continuous manual rotation, and an independent tip mode with a 3.8 mm simulated scope. Guided travel and free-tip motion use spatial collision sweeps; the rendered camera no longer independently eases through junctions. The existing HID decoding/profile contract is unchanged. Named ostia use case anchors and lumen occlusion checks.

The Blender export retains every source surface vertex, with welded indexing and smooth normals. Slicer Python/VTK verified a closed, connected lumen and repaired 16 outside centerline samples. `metadata/geometry-review.json` records source hashes and individual repairs. Display and collision currently use the same exact surface, avoiding a geometric discrepancy between them.

The shared shader replaces discrete sparkles and repeating material bands with continuous tissue variation, fine normal detail, variable wet sheen and a lens-mounted illuminator. The fixed 4:3 optical pane uses an 88-degree horizontal field; enlargement preserves this framing. The correlated 3D scene uses superior-up orientation, local branch emphasis and the same scope frame.

Linked CT provides axial, coronal, sagittal and scope-oblique views; physical aspect ratios, anatomical edge labels, crosshairs, window/level, zoom, pan, slice browsing and follow-scope controls. Resampling runs in a worker, old requests are coalesced, and the 3D plane reuses one texture. A 64 MiB LRU promotes signed source-HU regions around the scope from gzip-compressed 64-voxel bricks, with preview fallback.

Validation: 60 airway/core tests passed (42 prior tests plus 18 navigation, orientation, collision and CT tests); root TypeScript passed. Headless Chromium rendered all three reference views and exercised insertion/withdrawal with no browser errors. Comparison captures and the repeatable review script are under `artifacts/bronchoscopy-review` and `scripts/airway-anatomy/visual-review.mjs`. Hardware throughput and full physical-controller operation still require the reference desktop/controller; software-rendered headless Chromium is not a valid 60 fps benchmark.

### Rebuild the case

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/airway-anatomy/cook-surface.py -- --source /path/to/primary/new_anatomy_module/airway_large.stl --output public/airway-anatomy/case-001/lumen-v2.glb
/Applications/Slicer.app/Contents/bin/PythonSlicer scripts/airway-anatomy/prepare-reviewed-case.py --source /path/to/primary/new_anatomy_module --output public/airway-anatomy/case-001
```

The original graph is read from the primary checkout alongside the source directory; rerunning does not accumulate centerline corrections. The reviewed mesh/manifest/graph ship in the standalone bundle together. The 225,837,459-byte native CT brick set is a generated, ignored asset for the existing module-assets publishing workflow. Until those bricks are published, production retains the signed-HU preview and all linked CT controls. No storage or database changes have been made.
