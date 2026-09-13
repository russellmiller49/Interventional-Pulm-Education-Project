# Additional EBUS model packages (A3–A6)

Continuation of draft PR #189 from `e6eaa66f`. The reference is the existing EBUS `LessonHost` and shared stage used by the completed Phase 1 pilot. The owner's latest request authorizes the remaining models in the supplied review/build plan. The proposed full curriculum rewrite and unreviewed clinical-media annotations are outside this model pass.

## Delivered teaching objects

| Package                                                     | New lesson ID           | Runtime GLB                    | Size          |
| ----------------------------------------------------------- | ----------------------- | ------------------------------ | ------------- |
| Generic needle assembly and finite-plane tip visibility     | `needle-assembly-model` | `ebus-needle-assembly.glb`     | 104,708 bytes |
| Acoustic-contact and artifact cutaway                       | `contact-cutaway-model` | `acoustic-contact-cutaway.glb` | 89,668 bytes  |
| Sphere, elongated, adjacent and lobulated analytic phantoms | `measurement-phantoms`  | `measurement-phantoms.glb`     | 125,920 bytes |
| Same-frame EUS-B orientation locators and lower example     | `eus-b-route-model`     | `eus-b-route-locators.glb`     | 57,872 bytes  |

The four new GLBs total 378,168 bytes. Route comparison reuses the Phase 1 anatomy and node GLBs. Model state drives the visible geometry, schematic/section and completion evidence. Each new lesson has an orientation, worked model, independent prediction, required actions, retained observation, explanation and changed transfer situation.

Original lessons, case questions, clinical media, acoustic worker, Phase 1 hashes, routes, station/scope calibration and IDs remain intact. Four companion lessons extend the canonical registry to 26 lessons. Historical answers and completions stay in the existing store; new lessons become the next incomplete work. The incomplete-lesson restart boundary remains unchanged.

## Representation and sources

- Needle travel and dimensions are illustrative. The assembly is generic, compressed longitudinally and is not commercial-device CAD. Its shaft, tip and sheath share an outlet axis. No fixed clinical extension, force, tissue yield, transvascular passage, or disappearance/reappearance maneuver is taught. The model explicitly blocks advancement without current live tip guidance and does not permit exposed-tip channel removal.
- The contact image is an authored qualitative schematic, separate from the original acoustic renderer. Contact state governs both the cutaway and the schematic. Gain does not restore an absent window. Balloon assistance, focal air interruption and reflector shadow are mechanism demonstrations, without pressure or inflation volume.
- Phantom meshes and section equations share one contract. Caliper validation checks opposing requested-axis borders with an authored 1.25 phantom-mm endpoint tolerance, not just separation. Every shape requires the full sequence of sampled planes. A saved SVG contains the learner's actual calipers and explicitly identifies phantom units and provenance. It is not a calibrated clinical image.
- EUS-B locators are derived from the original same-frame meshes. The target never moves when the approach switches. The lower paraesophageal example is newly authored and requires anatomical review. Station 9, interlobar EUS-B and other unsupported presets remain explicit. View arrows are not needle trajectories; the activity has no esophageal collision/navigation, ultrasound synthesis or reachability calculation.

Clinical propositions retain the course's existing ICS/IAB 2023 safety teaching ([primary guideline](https://pmc.ncbi.nlm.nih.gov/articles/PMC10401980/)). The [ESGE/ERS/ESTS 2015 primary guideline](https://www.thieme-connect.com/products/ejournals/pdf/10.1055/s-0034-1392040.pdf) is separately cited for complementary anatomical access, not substituted for the course's newer management guideline. The existing [IASLC atlas](https://pmc.ncbi.nlm.nih.gov/articles/PMC4499584/) supports station anatomy. Analytic shape and acoustic-schematic behavior are explicitly course authored. The supplied plan's handbook/transcript references are not claimed as independently reviewed sources; a bounded local search found no EBUS needle IFU or corresponding handbook/transcripts in the searched manual, intro-course and clinical-language source folders. No new clinical clips or expert border annotations were fabricated.

## Reproduction and geometry proof

1. Blender 5.1: `--background --factory-startup --python-exit-code 1 --python scripts/ebus-guided/models/build_additional.py`.
2. `node scripts/ebus-guided/models/optimize-additional.mjs` uses glTF Transform 4.5.0 deduplication without collapsing semantic pivots or simplifying geometry.
3. Blender: `--background --factory-startup --python-exit-code 1 --python scripts/ebus-guided/models/validate_additional.py`.
4. `node scripts/ebus-guided/models/validate-additional-runtime.mjs` checks 12 actual GLB needle poses against fixed-entry and true-tip endpoints (maximum error 0.00000104 mm).
5. `node scripts/build-socal-ebus-course.mjs` and the normal root build/standalone preparation.

Editable `.blend` files and optimization intermediates live outside Git in Local-Data `raw-assets/ebus-guided-models/additional/`. The runtime manifest, contract and `geometry-validation.json` record units, bounds, dependencies, semantic nodes, hashes and analytic mesh checks. The loader verifies the contract and every GLB before accepting rendered activity evidence. Source files are not copied into the repository.

## Verification record

- PASS: six guided-course Jest suites, 48 tests. Includes clinical stage/bridge/progress regressions and new finite-plane, state-guard, full-sweep, border/axis, route-invariance and asset-integrity checks.
- PASS: five embedded guided/simulator Vitest files, 124 tests; previous Phase 1/image discovery and acoustic behavior retained.
- PASS: root and embedded TypeScript checks, focused ESLint, embedded production build, native/optimized geometry validation.
- PASS: `npm run build` (all embedded apps, content, asset inventories, Next production compilation/type check and standalone preparation). Existing large-chunk and Mermaid dependency warnings remain nonfatal.
- PASS: `EBUS_REVIEW_URL=http://127.0.0.1:3145 npx tsx scripts/ebus-guided/browser-journey.ts`: all 26 lessons, 8 assessment cases, 102 first responses, reload, no legacy storage writes or page errors.
- PASS: `scripts/ebus-guided/browser-additional-models.ts` against the production preview: all four real lesson journeys; worked mesh hover/selector, demonstration isolation, unsafe needle-transfer revision, hidden tip/dimension labels during independent decisions, locked Observe controls, unchanged retained frame identity, Explain reveal, 900 px compact layout, 390 px device gate and failed-asset completion block. `browser-result.json` records four completions and 12 first responses with no page errors.
- PASS: `scripts/ebus-guided/browser-model-runtime.ts` with the generated static app: all four model activities, unsafe/frozen/lost-tip/resistance actions, complete phantom sweeps, invalid-axis rejection, actual pointer calipers, SVG download and reset. Its harness is an isolated runtime check; it does not replace the real course journey.
- Visual inspection: worked mesh hover for needle/contact/routes, central short-axis calipers and Explain annotation, retained observations, 900 px compact pane and phone gate. Screenshots and the downloaded phantom SVG are under ignored `artifacts/ebus-guided/additional-models/`. A visual defect in route transparency was fixed by recompiling changed transparent materials; needle geometry was refined to retain a fixed channel entry. The final four-lesson browser run uses those corrections.

## Shared-stage acceptance within this model extension

| Check | Result                   | Evidence                                                                                                                                                                                   |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1    | PASS                     | Original Overview / Learn / Practice / Assess routes and canonical next-incomplete resolver; full course journey.                                                                          |
| H2    | PASS                     | Four authored model lessons with worked examples, independent actions, interpretation and changed transfer tasks.                                                                          |
| H3    | PASS                     | Existing `LessonHost` and shared stage; unchanged Steps → Teaching → Simulator fractions and floors.                                                                                       |
| H4    | PASS                     | Existing NowCard and phase controls, real model instructions and retained-observation landmarks; rendered journeys.                                                                        |
| H5    | PASS                     | New lessons render through the canonical registry; models appear in Worked, Act, Observe and Explain as appropriate.                                                                       |
| H6    | PASS                     | Required state transitions, sweeps, calipers and route comparisons; reset and asset failure cannot complete.                                                                               |
| H7    | PASS                     | Demonstration observations excluded; independent image labels withheld, hidden tip absent from selector, unsafe response revised before completion, first responses retained.              |
| H8    | PASS                     | Original engines/assets/calibration retained; verified same-frame targets, 12 GLB needle poses, analytic phantom export checks and unchanged frame identity across Observe/Explain.        |
| H9    | PASS                     | Existing store and stable old IDs; 102 first responses and reload checked; incomplete sections still restart.                                                                              |
| H10   | PASS                     | Named controls and structures; generic/phantom/schematic units and limitations stated in context.                                                                                          |
| H11   | PASS                     | Unlisted development route and draft PR retained; no shared-stage/global style, release, backend or legacy-asset changes.                                                                  |
| H12   | PASS (development scope) | Actual course/runtime journeys, unsafe and wrong-axis actions, reset, reload, locked/reveal, compact and failure states; screenshots inspected. Clinical validation remains pending below. |

## Review boundary

Development-only models. Faculty anatomical review, device-specific IFU/CAD validation, expert-marked clinical companions, physical device comparison, Safari and assistive-technology review remain pending. These models teach modeled relationships and decisions; completion does not establish clinical procedural competence. No deployment, release-catalog change, clinical media replacement, backend mutation or merge is included.
