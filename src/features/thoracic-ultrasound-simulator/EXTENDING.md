# Extending the thoracic ultrasound simulator

How to add a **new patient case** (different segmentation) or **new structure
types** to `src/features/thoracic-ultrasound-simulator`. The matching Claude
Code skill is `.claude/skills/thoracic-us-cases/SKILL.md` — say "add a new
ultrasound case" and it will walk through this.

## What you need to provide for a new patient case

Put these in one local source folder (e.g. `~/cases/effusion-002/`). **Raw CT
and Slicer project files stay local** — only derived, downsampled educational
assets are committed to `public/`.

| Input                                    | Requirements                                                                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slicer segmentation export (`.seg.nrrd`) | 4D Slicer export, LPS space, gzip or raw encoding. **Segment names matter**: they are keyword-matched to engine labels (see below).                                                                                                      |
| Surface mesh (`.glb`)                    | Exported from the same segmentation in the same LPS millimetre frame (Slicer GLB export default — the app does **no** coordinate conversion). Node names are anatomical and keyword-matched at load time; trailing spaces are tolerated. |
| Probe model (`ultrasound probe.glb`)     | Optional. If missing from the source folder, copy the one from `pleural-effusion-001`.                                                                                                                                                   |

Segment/mesh **name keywords** currently recognized (case-insensitive,
substring): `skin`, `diaphragm`, `pleural effusion` → pleuralFluid,
`atelectatic`, `lung`, `rib`/`bone`/`spine` → rib, `intercostal`/`muscle`,
`liver`, `spleen`. Anything else maps to background (segmentation) or is
hidden (mesh). Two places must both know a name: the **generator script**
(`defaultTargetLabelForName`) for voxels and **`loader/meshNaming.ts`** for GLB
nodes.

## Commands

```bash
# 1. Generate the case package (downsampled labelmap + mesh + case.json, schema v2)
node scripts/thoracic-ultrasound/generate-thoracic-case-assets.mjs \
  ~/cases/effusion-002 \
  --case-id=pleural-effusion-002 \
  --module=pleural-ultrasound-simulator \
  --segmentation="my segmentation.seg.nrrd" \
  --mesh="my model.glb"
# → public/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-002/

# 2. Visually verify the B-mode render offline (the experimental route is public for smoke QA)
npx tsx scripts/thoracic-ultrasound/render-case-poses.mts \
  public/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-002
# writes PNGs to a temp dir; open them and check speckle/fluid/shadows/pose

# 3. Optional: pose-indexed offline frame set (entries start 'needs-review')
node scripts/thoracic-ultrasound/generate-frame-sweep.mjs <caseDir>
```

Then register the case where a feature lists it — for the pleural module:
`src/features/pleural-ultrasound-simulator/content/pleuralSimulatorCases.ts`.

Fresh v2 packages ship with `qualityStatus.browserRaymarch: 'acceptable'`, so
the **live render displays immediately** and follows the probe. Set it to
`'prototype'` in the generated `case.json` if a case's render should be hidden
(placeholder + metrics only) until you're happy with it.

## Adding a NEW structure type (label not in the vocabulary)

Every file that must learn the new label, in dependency order:

| File                                                            | What to add                                                                                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts` → `ThoracicStructureLabel`                           | The label itself (union member).                                                                                                                                        |
| `engine/acousticMaterials.ts`                                   | `scatter` / `attenuation` / `reflectivity`, plus `castsShadow` (bone-like), `airInterface` (air-like), `posteriorEnhancement` (fluid-like) as appropriate.              |
| `engine/tissueModel.ts`                                         | `defaultBackscatter` case (echogenicity); special display shaping in `defaultDisplayGray` only if it needs clamps like fluid/rib.                                       |
| `loader/meshNaming.ts`                                          | GLB node-name keywords.                                                                                                                                                 |
| `scripts/thoracic-ultrasound/generate-thoracic-case-assets.mjs` | `defaultLabelCodes` (next free code), `defaultLabelPriority` (which label wins a downsampled voxel), `defaultTargetLabelForName` keyword, category/color/hazard tables. |
| `loader/adaptPleuralV1.ts`                                      | Category/hazard/color tables — only needed if legacy **v1** manifests will contain the label.                                                                           |
| `src/features/pleural-ultrasound-simulator/engine/labels.ts`    | Code mapping — only if the pleural case format itself grows the label.                                                                                                  |
| Tests                                                           | Extend `testSupport/fixtures.ts` label codes if used; add an engine test if the label has acoustic behavior (shadow/enhancement).                                       |

Rule of thumb: **fluid-like** labels get near-zero backscatter + low
attenuation (dark + posterior enhancement falls out of the TGC physics);
**bone-like** get `castsShadow`; **air-like** get `airInterface` (bright line +
dirty shadow + reverb arcs). Everything else is a mid-gray scatterer.

## Verifying

```bash
npx jest src/features/thoracic-ultrasound-simulator src/features/pleural-ultrasound-simulator
npx tsc --noEmit
npx tsx scripts/thoracic-ultrasound/render-case-poses.mts <caseDir>   # eyeball the PNGs
```

The renderer must stay **deterministic** (no `Math.random` — hash functions
only; a test asserts identical bytes for a fixed pose) and the metrics loop in
`engine/simulateBMode.ts` is scoring-critical: a test asserts metrics parity
between the metrics-only and rendered paths.

## Cardiac fallback and cine QA

A whole-heart CT label does not contain chambers, valves, or myocardium. Cases
that need live cardiac teaching must therefore provide a case-calibrated
`cardiacModel` (`parametric-cardiac-v1`) in the manifest. It defines the LPS
heart centre, an orthonormal left/anterior/base frame, four chamber blood-pool
ellipsoids, valve reflectors, illustrative rate, and respiratory excursion.
The model is sampled only inside source voxels labelled `heart`; it never
creates cardiac anatomy outside the patient segmentation.

When a cardiac model is in the beam, the runtime uses phased-array sector
geometry and a reduced-resolution worker cine. Pleural scoring remains cached
from the static source labelmap. Every cardiac view must stay labeled as a
procedural educational approximation, and representative views require expert
review before promotion beyond `qualityStatus.browserRaymarch: 'acceptable'`.
For true patient-specific echo, prefer reviewed pose-indexed cine frames or a
chamber-resolved 4D source rather than further tuning the parametric fallback.
