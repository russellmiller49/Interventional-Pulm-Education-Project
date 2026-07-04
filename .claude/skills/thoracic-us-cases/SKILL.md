---
name: thoracic-us-cases
description: >-
  Extend this project's thoracic/pleural ultrasound simulator
  (src/features/thoracic-ultrasound-simulator + pleural-ultrasound-simulator): add a new patient
  case from a Slicer segmentation, add new structure types/labels, tune how the simulated B-mode
  image looks, or build a new consumer feature on the shared engine. Use it whenever the user
  mentions adding a segmentation/case/patient to the ultrasound simulator, new anatomy labels for
  it, the B-mode render looking wrong, or extending the manifest/provider/probe-store stack. It
  encodes the case-generation pipeline, every file a new label must touch, the offline visual
  verification loop (the app route is auth-gated), and the hard-won renderer/worker/jsdom pitfalls.
---

# Thoracic ultrasound simulator: cases & structures

The simulator is a shared, manifest-driven engine at
`src/features/thoracic-ultrasound-simulator/`; `pleural-ultrasound-simulator` is its first
consumer. Human-facing input requirements live in
[src/features/thoracic-ultrasound-simulator/EXTENDING.md](../../../src/features/thoracic-ultrasound-simulator/EXTENDING.md)
— point the user there when they need to know what to export from Slicer.

## Where things live

| Concern                                                  | File                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Structure vocabulary (label union, manifest v2 types)    | `src/features/thoracic-ultrasound-simulator/types.ts`                        |
| Acoustic properties per label                            | `engine/acousticMaterials.ts`                                                |
| Echogenicity, speckle texture, display shaping           | `engine/tissueModel.ts`                                                      |
| Renderer (metrics loop + polar-grid image pipeline)      | `engine/simulateBMode.ts`                                                    |
| Manifest validation / v1→v2 adapter / runtime volume     | `loader/`                                                                    |
| GLB node-name → structure matching                       | `loader/meshNaming.ts`                                                       |
| Frame provider stack (live render, atlases, placeholder) | `providers/` (`useBModeFrame.ts` orchestrates)                               |
| Probe transform store (rAF-batched)                      | `state/probeStore.ts`                                                        |
| 3D scene / probe controls / B-mode panel                 | `components/`                                                                |
| Case generator (seg.nrrd + GLB → case package)           | `scripts/thoracic-ultrasound/generate-thoracic-case-assets.mjs`              |
| Offline B-mode preview (visual verification)             | `scripts/thoracic-ultrasound/render-case-poses.mts`                          |
| Pose-index sweep (frames.json, entries needs-review)     | `scripts/thoracic-ultrasound/generate-frame-sweep.mjs`                       |
| Pleural case registry                                    | `src/features/pleural-ultrasound-simulator/content/pleuralSimulatorCases.ts` |
| Pleural-only logic (codes 0–12, scoring, tissue model)   | `src/features/pleural-ultrasound-simulator/engine/`                          |

## Path A — new patient case, existing labels

1. Confirm the user's source folder has the `.seg.nrrd` + `.glb` (see EXTENDING.md for
   requirements). Check the segment/mesh names against `defaultTargetLabelForName` in the
   generator and `meshKeywordsByLabel` in `loader/meshNaming.ts`; add keywords if the user's
   naming differs — do NOT ask them to rename exports.
2. Run the generator (schema v2 by default):
   `node scripts/thoracic-ultrasound/generate-thoracic-case-assets.mjs <sourceDir> --case-id=<id> --module=<module> --segmentation=<file> --mesh=<file>`
   It downsamples (stride 2), writes `case.json` + `<id>.labelmap.uint8.bin` + GLBs under
   `public/module-assets/v1/<module>/<id>/`, and logs per-label voxel counts — **check the counts**:
   a label with 0 voxels means a segment name didn't match.
3. Register the case in the consuming feature's registry (for pleural:
   `pleuralSimulatorCases.ts`). The manifest's probe defaults/ranges are derived from
   fluid/skin bounds; if the default pose starts somewhere useless, edit `probeDefaults` in the
   generated `case.json` rather than the code.
4. Verify visually (Path V below). New v2 packages display the live render immediately
   (`qualityStatus.browserRaymarch: 'acceptable'`); set `'prototype'` in the case.json to hide a
   case's render behind the placeholder.

## Path B — new structure type (new label)

Work through the checklist table in EXTENDING.md top-to-bottom (types.ts union →
acousticMaterials → tissueModel backscatter/displayGray → meshNaming keywords → generator
labelCodes/labelPriority/name-keywords/category/color/hazard tables → adaptPleuralV1 tables only
if v1 manifests will carry it → pleural `engine/labels.ts` only if the pleural format grows).
Acoustic archetypes: fluid-like = near-zero backscatter + low attenuation (+
`posteriorEnhancement`); bone-like = `castsShadow`; air-like = `airInterface` (bright line, dirty
shadow, reverb arcs); otherwise a mid-gray scatterer. Add an engine test when the label has
acoustic behavior (shadow/enhancement) — see `__tests__/thoracicEngine.test.ts` for the pattern of
building tiny volumes with `makeTestVolume()`.

## Path C — new consumer feature / region

Copy the pleural wrapper pattern: feature-local domain logic (scoring, classification UI) +
thin re-exports of the shared engine; load with `loadThoracicCase`, create a store with
`createProbeStore(activeProbePreset(manifest).defaults)`, render `ThoracicScene3D` +
`ThoracicProbeControls` (left) and `BModeFramePanel` + tasks (right), get frames via
`useBModeFrame` (pass a custom `TissueModel` only if the region needs one — see worker caveat).

## Path V — verification (always)

The app route is **auth-gated**: do not rely on browser preview. Instead:

```bash
npx tsx scripts/thoracic-ultrasound/render-case-poses.mts <caseDir>   # writes PNGs; Read them
npx jest src/features/thoracic-ultrasound-simulator src/features/pleural-ultrasound-simulator
npx tsc --noEmit
```

Read the PNGs and judge like a sonographer: speckle texture (not flat gray, not salt-and-pepper),
anechoic fluid with a bright rim, posterior enhancement behind fluid, clean rib shadows, bright
pleural line with reverb arcs over aerated lung, correct sector geometry. Metrics printed per pose
(fluid mm, beam fractions, structure flags) should match the anatomy you expect at that pose.

## Pitfalls (each was a real bug)

- **One LPS millimetre frame.** GLB meshes, labelmap, probe/beam/needle math all share it — never
  convert coordinates. If anatomy appears displaced, the export frame is wrong, not the engine.
- **Metrics loop is scoring-critical and separate from the image pipeline** in
  `simulateBMode.ts`. Tests assert metrics parity (renderImage on/off identical) — tune visuals in
  the polar-grid/render half and `tissueModel.ts` only.
- **Determinism**: no `Math.random` anywhere in the render path — hash functions of
  world/grid coordinates only. A test asserts byte-identical renders for a fixed pose.
- **The worker always uses the default tissue model** (functions can't cross the boundary).
  A custom `TissueModel` only affects main-thread fallback renders and metrics — keep custom
  models visually equivalent to the default or renders will differ between machines.
- **Quality gate**: `browserRaymarchProvider` refuses to display unless
  `manifest.qualityStatus.browserRaymarch` is `'acceptable'`/`'reviewed'`. A case stuck on the
  placeholder usually means `'prototype'` here.
- **Provider sync pass**: only providers with `resolveSync` run synchronously; never call an async
  provider's `resolve` and discard the promise (each discarded call fires a worker render).
- **Probe pose may hover off the skin** (poses are in volume coordinates); the renderer's contact
  pre-pass crops the air standoff. An all-dark fan means no beam found tissue within ~70mm — fix
  the pose, don't touch the renderer.
- **jsdom has no `ImageData`/WebGL/Worker**: tests that render must call
  `installImageDataPolyfill()` from `testSupport/`; test helpers live in `testSupport/`, never in
  `__tests__/` (Jest treats every file there as a suite). In jsdom the provider stack falls back
  to atlas frames — that's expected in component tests.
- **frames.json review flow**: `generate-frame-sweep.mjs` writes every entry
  `reviewStatus: 'needs-review'`; the runtime ignores them until a human flips them to
  `'reviewed'`. Don't "fix" the provider to show unreviewed entries.
- **GLB node names are messy** (`'diaphragm '` with a trailing space, `'bone'` for the whole
  skeleton) — extend keyword tables, don't exact-match.
