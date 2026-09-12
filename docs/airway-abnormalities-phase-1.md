# Airway abnormalities — phase 1

## Scope and preservation

Owner request, September 11, 2026: use Synchronized Airway Anatomy as the foundation for an interactive bronchoscopy simulator, beginning with selectable endobronchial tumors, lesions and bleeding. Baseline: `7da3886e`. This phase adds an explicitly labeled Abnormalities exploration mode to the existing admin-only `/en/learn/anatomy/airway` workspace. It is an asset and simulation extension, not a curriculum migration. Existing Explore, Challenge, navigation, optical frames, CT, controller support and orientation calibration remain the reference implementation. Lesson-stage, assessment and progress requirements are evaluated where this unscored extension changes them; the scoped H1–H12 review is below. No second progress system is introduced.

Audience: pulmonary fellows and instructors using a desktop to inspect morphology and spatial relationships. Prerequisite: orientation to the normal central airway. Objective: compare the normal lumen with authored wall-attached abnormalities from different scope positions; recognize loss of visibility during simulated bleeding. No assessment or procedural-competence claim. Normal comparison is available at the same scope position; a location change provides a different spatial application.

## Asset and simulation contract

- Original Blender-authored closed GLBs: lobulated obstructing mass, smooth polypoid lesion, irregular mucosal lesion. Local X is circumferential, Y distal, Z projects into the lumen; wall attachment is Z=0. Runtime dimensions are authored, not measured from the reference media.
- Wall placement is derived from the reviewed patient-LPS lumen. The displayed lesion geometry also supplies collision and occlusion. Each mesh remains independent of the source airway so future tools can target it.
- Bleeding is a source-attached visual simulation with pause/restart. It does not simulate blood loss, coagulation, oxygenation, hemodynamics, or treatment. Changing a control is scenario authoring, not a clinical intervention.
- The source CT represents the original anatomy. Synthetic abnormalities are not added to CT voxel values and must never be presented as CT findings.
- Session-only configuration. Reload starts a fresh exploration; no mastery, score, or attempt record is created. Challenge and XR use the original anatomy; entering those modes removes synthetic pathology from navigation.
- Clinical images supplied in this task and the 9-minute video are visual references, not instructions or source-authorized treatment sequences. No supplied media are copied into public assets. Morphology labels do not assert a diagnosis or histology.

## Sources and numbers

Visual design: owner-supplied image collages and `Bronch videos and animations.mp4`, inspected September 11, 2026. Surface shape, material variation, dimensions, bleed animation rates, and movement clearances are authored simulation constructs, not clinical thresholds. The existing scope model retains its documented 3.8 mm diameter in realistic mode.

Clinical context: [CHEST central airway obstruction guideline, 2024](https://www.chestnet.org/guidelines-and-topic-collections/guidelines/interventional-pulmonary/management-of-central-airway-obstruction). This provides the distinction between intrinsic, extrinsic and mixed disease; this phase represents intrinsic abnormalities only. It does not implement guideline treatment recommendations. Bleeding effects are illustrative, not a clinical hemorrhage classification.

## Acceptance

Load each GLB; verify closed topology, finite bounds and vertex colors; exercise all morphology/site combinations against the reviewed airway; verify contact blocks insertion and permits withdrawal, with labels occluded by the displayed mass. In the browser exercise abnormality selection, size and wall-position changes, normal comparison, independent bleeding, pause/reset, navigation, return to Explore/Challenge, reload and compact layout. Inspect actual rendered optical views. Run targeted regression tests, TypeScript, feature lint, and relevant build checks; record results below.

## Validation record

- Blender 5.1 generated three closed, outward-oriented meshes with vertex colors: 17,198 / 6,260 / 4,992 triangles, totaling 714,396 bytes. Indexed geometry, decimation and vertex colors keep the asset set small without new texture or compression-decoder dependencies. The local editable source is `artifacts/airway-abnormalities/airway-abnormalities.blend`; regenerate with the committed script. The public directory is `public/bronchoscopy-abnormalities`, which is included by the existing standalone packaging rules. No asset-upload or storage changes are required.
- `npx --no-install jest src/lib/airway-anatomy src/lib/bronchoscopy-core --runInBand`: **74 tests passed in nine suites**. Includes signed solid collision, a 3.8 mm swept scope, withdrawal, label occlusion, source-dependent blood visibility, bounded animation timing, and a regression for the patient-space render bounds of the curved mucosal lesion.
- Exact-asset review: **432 combinations passed** (three morphologies × four locations × three sizes × twelve wall angles). Starting clearance, contact and withdrawal were checked against the reviewed 673,216-triangle airway and the same lesion geometry used by the renderer. Evidence: `artifacts/airway-abnormalities/geometry-review.json`. These are geometric checks, not clinician validation.
- Feature ESLint and root TypeScript passed. Full `npm run build` passed, including both embedded training apps, content generation, asset validation and standalone packaging. Existing warnings concern bundle sizes, Mermaid's dependency analysis, and missing site metadataBase.
- Browser review **passed** at 1440×1000 and 390×844 with zero unexpected browser errors and one deliberately failed model request. Selection, size, wall position, contact, withdrawal, comparison, bleeding alone or with a mass, pause/resume/restart, all locations, mode changes, reload and model-load retry were exercised. Evidence: `artifacts/airway-abnormalities/browser/review.json` and the adjacent optical/desktop/mobile screenshots. The comparison status reset has an additional focused check in `comparison-review.json`. Headless software rendering required generous animation timeouts; this is a behavior and appearance check, not a hardware frame-rate benchmark. Native CT bricks are not present in this checkout, so the existing source-HU CT preview is the tested fallback.

### Repeatable commands

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/airway-abnormalities/build-assets.py
npx --no-install esbuild scripts/airway-abnormalities/review-geometry.mts --bundle --platform=node --format=esm --packages=external --outfile=artifacts/airway-abnormalities/review-geometry.mjs
node artifacts/airway-abnormalities/review-geometry.mjs
BRONCH_REVIEW_AUTH_ENV=/path/to/existing/local/auth.env node scripts/airway-abnormalities/visual-review.mjs
```

The browser review uses the existing localhost-only auth token from the specified file without printing or writing it. Run the local server with the same existing local-development configuration. The browser script suppresses analytics requests and simulates one failed model request to verify error recovery. Do not run a production build concurrently with the development browser review; restart the dev server after a build.

### Structured-module contract within this phase

| Rule | Result and evidence                                                                                                                                                                                                                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1   | Not applicable: this extends an existing exploratory workspace; a curriculum migration was not requested.                                                                                                                                                                                                             |
| H2   | Pass within this scope: normal is the starting appearance; the same-position normal comparison supports inspection of one changed finding. No course-completion claim.                                                                                                                                                |
| H3   | Not applicable: no new structured lesson stage. The existing synchronized renderer is retained.                                                                                                                                                                                                                       |
| H4   | Not applicable to NowCard/lesson steps; the Abnormalities panel provides a visible instruction and controls for this unscored exploration.                                                                                                                                                                            |
| H5   | Pass: model definitions, explanatory copy, dimensions and mode controls are imported by the actual module route.                                                                                                                                                                                                      |
| H6   | Pass within this scope: selections change the visible 3D geometry and physical collision; motion and blood progression are real interactions. No completion system.                                                                                                                                                   |
| H7   | Not applicable: no predictions, answer keys, scoring or debriefs.                                                                                                                                                                                                                                                     |
| H8   | Pass: reviewed anatomy, optical frames, CT, controller inputs and existing challenge code retained; original regression suites pass. Synthetic findings remain separate from source CT.                                                                                                                               |
| H9   | Pass: configuration is session-only, reload starts a fresh normal configuration, and no progress store is added.                                                                                                                                                                                                      |
| H10  | Pass: conventional morphology terms, visible control names and authored-dimension labels. Clinical diagnosis and management remain outside this phase.                                                                                                                                                                |
| H11  | Pass: feature-local changes, generated synthetic assets, tests and documentation only; admin gate, release catalogs and databases unchanged.                                                                                                                                                                          |
| H12  | Pass: real selection and navigation handlers, contact/withdrawal, normal comparison, animation pause/restart, bleeding without a mass, mode changes, reload, compact layout and model-load failure/retry passed with zero unexpected browser errors. Actual rendered optical and desktop/mobile views were inspected. |

This is a visual and navigation prototype. Clinician review of appearance, physical-controller testing and learner usability testing remain future validation. It does not yet include biopsy, debulking, suction/hemostasis, tissue deformation, clotting, or physiologic deterioration. XR retains the original anatomy mode and is explicitly unavailable while reviewing abnormalities.
