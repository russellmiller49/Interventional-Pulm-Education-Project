# Phase 1 linked EBUS models

Scope: the five-lesson anatomy/scope pilot selected by the owner, based on `7206e287` and the supplied EBUS guided review/build plan. The document was used as a design reference; its later phases and its references to an unattached handbook/transcript collection were not treated as additional work or independently reviewed sources.

## Delivered

- `scope-orientation`: semantic scope parts, optical-direction arrow and ultrasound sector using the existing calibrated pose. Whole-scope and distal views, independent observer orbit, and explicit rotation/flexion demonstrations. The activity requires transducer selection and a learner-acquired target image.
- `acoustic-contact`: the same device and anatomy with the existing contact-dependent acoustic response. The balloon envelope is illustrative. Flexion moves the calibrated tip and illustrates bending/lever movement; it does not implement mechanical loads or balloon-fluid physics.
- `ct-map`: clinical CT remains available at orientation through the existing representative-media panel. The live localizer is explicitly a **model section**, sampled from the same acoustic label volume. It supports axial/coronal/sagittal sections, a selected-position marker and the actual scan-plane intersection. No registration to the historical clinical CT is claimed.
- `station-seven`: selectable carina and the same node example from the calibrated RMS and LMS starts. Both approaches require an actual rotation sweep with a current, coupled target image. Selecting a preset or orbiting does not satisfy that condition.
- `right-paratracheal`: azygos selection and the 4R/10R example-node contrast. Optional open boundary-level frames appear only during teaching/review. They are draft aids, not complete or validated IASLC compartments.

The actual unannotated grayscale acquisition stays mounted and held at Observe, with scope controls disabled and observer orbit available. Its in-memory frame identifier derives from the actual RGBA pixels, pose and settings, prefixed by the source geometry revision. The bridge supplies the lesson-session identity; the canvas records the actual acoustic pose and version. No acquisition or patient identifiers are written to persistent learner storage. Worked demonstrations use separate sessions and cannot supply activity completion. The original question/choice IDs and wording, historical first responses, course registry, legacy routes and original calibration/assets remain unchanged.

## Asset and native-source contract

Runtime directory: `EBUS-course/apps/web/public/simulator/case-001/models/guided-v1/`.

| Asset                        | Role                                                                                                                                    | Geometry authority / limits                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mediastinum-teaching.glb`   | Selectable airway, heart, vessels and esophagus                                                                                         | Existing 29-structure source, with node meshes exported separately. Airway faces partitioned into named display regions without moving any triangle; extent review pending. Both brachiocephalic veins and esophagus reused from the source. |
| `node-examples.glb`          | Node examples with separate node and station IDs                                                                                        | Existing modeled tissue volumes; not station compartment surfaces. Display can show nodes through surrounding structures for orientation.                                                                                                    |
| `station-regions.review.glb` | Open carina/azygos level frames                                                                                                         | Authored review aids derived from centerlines and a source surface vertex; default off, review pending.                                                                                                                                      |
| `ebus-scope-teaching.glb`    | Original distal body plus named lens/surface locators, balloon, bending rings, shaft, control body, lever, channel and retracted needle | Original tip calibration preserved. Added parts and external surface locators are illustrative, not device CAD. No interactive needle simulation.                                                                                            |

`asset-manifest.json` records SHA-256 dependencies, exact bytes, triangles, materials, roles, source type, rights/review status and lossless optimization. `case-transforms.json`, `device-geometry.json`, `landmarks.json` and `geometry-validation.json` record axes, asymmetric landmarks, pivots, source CT coordinate audit and export proof. glTF uses meters; runtime converts once to the existing web-mm frame `(L,P,S) → (L,S,-P)`. The original fan apex remains the virtual acquisition origin; external colored lens/transducer locators are illustrative surfaces and do not redefine calibration.

Native sources are outside Git in `Local-Data/raw-assets/ebus-guided-models/phase-1/`: `mediastinum-teaching.blend`, `ebus-scope-teaching.blend`, `mediastinum-review.mrb`, `acoustic-model.seg.nrrd`, `landmarks.mrk.json`, `source-audit.json`. The Slicer scene contains derived surfaces and the existing acoustic label anatomy, **not source CT**. See [the Local-Data map](../local-authoring-assets.md).

Rebuild from the repository root, in sequence:

```sh
/Applications/Slicer.app/Contents/MacOS/Slicer --no-splash --no-main-window --disable-settings --ignore-slicerrc --python-script scripts/ebus-guided/models/audit_sources.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/ebus-guided/models/build_models.py
node scripts/ebus-guided/models/optimize.mjs
/Applications/Slicer.app/Contents/MacOS/Slicer --no-splash --no-main-window --disable-settings --ignore-slicerrc --python-script scripts/ebus-guided/models/validate_and_package.py
node scripts/build-socal-ebus-course.mjs
```

Tested with Blender 5.1.0, Slicer 5.12.3 and glTF Transform CLI 4.5.0. The CLI runs as an authoring tool from npm's cache; no application dependency was added. Deduplication preserves semantic nodes, pivots and geometry; no quantization, decimation or compressed-geometry decoder is used. Dynamic browser lighting; no textures added, no collision/clearance claims, no LOD substitution for contact anatomy.

## Evidence

The source geometry and acoustic-volume hashes match. Slicer compared every source structure with the exported geometry: 29/29 retained, same triangle counts; maximum position/triangle-center round-trip error **0.000318 mm** (limit 0.002 mm). Original calibrated distal-tip error is below **0.000001 mm**. These are export tolerances, not clinical accuracy or safety thresholds. The four GLBs total **5,967,276 bytes**. glTF validation reports no errors or warnings; informational unused texture-coordinate notices remain.

Browser scripts run against the actual parent lesson and embedded workbench using headless Chromium/software WebGL. Reproduce with `EBUS_REVIEW_URL=http://127.0.0.1:3145`:

- `scripts/ebus-guided/browser-linked-models.ts`: all five actual lesson journeys; wrong landmark blocked, both station 7 scans required, demo and stale-session exclusion, rendered triangle count, observer-independent acquisition, identical pixels after Observe and further orbit, missing-model and WebGL gates.
- `scripts/ebus-guided/browser-review.ts`: 1500/1024/900/390 widths, keyboard pane navigation/help, review/reload with first responses preserved, unsupported phone gate, locale/noindex, reduced-motion clinical media and 750-pixel reflow check.
- `scripts/ebus-guided/browser-journey.ts`: full course and final-assessment regression with the new pilot requirements.

Generated screenshots/results live in ignored `artifacts/ebus-guided/linked-models/` and `artifacts/ebus-guided/`. The distal/whole/flexed scope, both station 7 approaches, 4R, model section, Observe and compact/gate states are the review set. Initial browser review found missing GLB surfaces caused by incorrect single-material handling, then an unconnected authored bending section. Both were corrected before final verification. No test was relaxed to accept those defects.

Final verification:

| Check                                                                          | Outcome                                                                                                                                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `npm run type-check`; embedded `npm run typecheck`                        | PASS                                                                                                                                                     |
| Root guided/shared-stage/site-access/module-beta/bronchoscopy-core Jest suites | PASS: 24 suites, 217 tests                                                                                                                               |
| Embedded simulator/knobology/case3d/new calibration Vitest suites              | PASS: 11 files, 145 tests                                                                                                                                |
| `npm run lint`                                                                 | PASS: zero errors; 15 existing unrelated warnings                                                                                                        |
| `npm run build`, final EBUS embed rebuild and standalone preparation           | PASS; existing large-chunk/metadata/Mermaid build notices                                                                                                |
| Full production-browser journey                                                | PASS: 22 lessons, 8 final cases, 90 first responses, no new legacy EBUS storage keys or page JavaScript errors                                           |
| Production pilot journeys and failure checks                                   | PASS: five lessons, both approaches, unscored demo, wrong landmark/stale session blocked, pixels held at Observe, missing asset/WebGL completion blocked |
| Production responsive/review/reload script                                     | PASS: desktop/compact/phone, keyboard, first responses, no horizontal overflow, locale/noindex and reduced motion                                        |
| Installed shared-stage smoke script on `scope-orientation`                     | PASS: 1440×900, 1280×720, 1024×768, 900×800, 390×844; initial-layout check only                                                                          |

A repeat preview check initially reached another worktree through localhost after that worktree bound IPv6 port 3135. Final pilot and course journeys use the isolated IPv4 URL `http://127.0.0.1:3145`; the other worktree was not modified.

The local unauthenticated preview logs the existing optional analytics endpoint's missing Supabase configuration. The course works without it; no shared credentials or backend state were changed. Headless software rendering confirms interaction and image consistency, not physical-device frame-rate performance.

## Structured-module checks (pilot only)

| Rule | Result / evidence                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS: existing Overview/Learn/Practice/Assess registry and unlisted entry retained.                                                         |
| H2   | PASS: worked 3D demonstrations precede five guided activities; one motion varied per demo.                                                  |
| H3   | PASS: shared StageLayout and explicit 0.26/0.29/rest fractions, 300/280/340 floors retained.                                                |
| H4   | PASS: one NowCard task; worked model and retained ultrasound have concrete location labels.                                                 |
| H5   | PASS: exports load in the actual embedded lesson; native-only assets do not count as integration.                                           |
| H6   | PASS: actual frame, contact, controls and semantic task gates; both station 7 acquisitions required.                                        |
| H7   | PASS: separate unscored demo; annotations withheld during prediction/Observe; original decisions retained.                                  |
| H8   | PASS: original geometry/calibration/acoustic engine preserved, linked revision checks and honest model-section labeling.                    |
| H9   | PASS: existing course storage and first-attempt contract; no new persistence or mastery claim.                                              |
| H10  | PASS for implementation review: visible clinical control/landmark names; faculty wording review remains pending.                            |
| H11  | PASS: five named lessons plus required feature adapter support; no catalog, auth, shared-stage or legacy asset replacement.                 |
| H12  | PASS for Chromium pilot checks described above; physical devices, Safari, assistive-technology and novice usability sessions not performed. |

Anatomical/IFU review of the new display partitions, landmark levels and illustrative device components, clinical faculty review, and owner media-rights/release review remain pending. This is a development pilot, not a validated station atlas, diagnostic image generator or procedural competency assessment.

Technical source checks: [Slicer coordinate conventions](https://slicer.readthedocs.io/en/latest/user_guide/coordinate_systems.html), [Olympus BF-UC180F nominal optical/device profile](https://medical.olympusamerica.com/products/bf-uc180f-ebus-bronchoscope), [glTF Transform CLI](https://gltf-transform.dev/cli). Clinical boundary wording was preserved from the current source-backed course; no guideline update was undertaken.

## Hover discovery follow-up

The owner's requested hover interaction extends the existing linked viewer from `84f36f7a`. Scope and anatomy meshes show their existing semantic names beside the pointer. Labels stay within the model window, clear during dragging or when leaving the canvas, and can be dismissed with Escape while the workbench has keyboard focus. The existing structure selector and click selection remain available. Hover never writes selection, acquisition, or completion evidence.

Picking excludes hidden meshes and follows the visible example-node overlay order. Node hover and click labels both remain “Example node” until the lesson's reveal phase. Hover is withheld during the unannotated Observe phase. No model geometry, calibration, question wording, progress storage, or release status changed.

Focused verification: embedded type check, ESLint for the modified browser script, the EBUS embed build and standalone preparation passed. Existing guided-course Jest tests passed (5 suites, 36 tests), as did linked-model/simulator Vitest tests (4 files, 116 tests). The updated production-browser pilot checks cover real scope/anatomy hover, bounded labels, Escape, drag/leave clearing, no hover completion, node-name disclosure, and all five existing acquisition/Observe journeys. Screenshots are in the existing ignored artifact directory: `scope-hover.png`, `scope-hover-compact.png`, `anatomy-structure-hover.png`, and `anatomy-hover.png`.

For this focused addition, H5–H8, H10 and H12 pass the rendered interaction checks above; H1–H4, H9 and H11 retain their preceding implementation with no applicable structural changes. The original clinical/asset review limits still apply. No new medical claims or device dimensions were authored.

## Ultrasound and model-section discovery

The follow-up from `9021f5b2` adds the same discovery interaction to ultrasound and the axial/coronal/sagittal model section. Both use the existing lesson `reveal` flag: labels are available in worked examples and explanation, and absent during acquisition, Observe, concealed review, and assessment. Hidden phases do not mount the tooltip, keyboard hint, or accessible label description. The broader legacy simulator remains unchanged.

Ultrasound lookup uses the label image belonging to the displayed acoustic frame, including a held frame. Model-section lookup uses the labels sampled during that section's actual raster draw. The pointer mapping accounts for CSS scaling and ultrasound letterboxing; outside-image pixels do not receive a tissue name. Labels use the existing case vocabulary, with nodal examples identified as examples. Hover, touch, and keyboard inspection never draw into the image pixels or write acquisition/selection/completion evidence.

Validation: root and embedded type checks, focused script lint, the embedded production build, and standalone preparation passed. Guided-course Jest tests passed (36 tests); image-discovery, linked-model, and simulator Vitest tests passed (124 tests). Production-browser checks verify names at calculated pixels in all three section planes and an offset section, hidden image labels throughout Act/Observe, labels restored on the identical retained ultrasound at explanation, touch/arrow-key/Escape inspection, and compact layout. Reviewed screenshots: `ultrasound-hover-demo.png`, `ultrasound-hover-revealed.png`, `ultrasound-hover-compact.png`, and `section-hover-{axial,coronal,sagittal}.png` in the existing ignored artifact directory. The noninteractive ultrasound status/readout layers were made transparent to pointer events after browser testing found they could obstruct image hover.

H5–H8, H10 and H12 pass these focused checks. H1–H4, H9 and H11 have no new structural changes and retain the preceding implementation. The existing clinical and asset-review limitations remain unchanged; no new guideline claims or device dimensions were added.
