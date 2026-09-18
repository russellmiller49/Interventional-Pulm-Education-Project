# SYSTEMIC-UX-01 — implementation handoff

Baseline: `00e66fa88cb2cb8a8909fcd7f98159c38dd03459`. Branch: `codex/systemic-ux-01`.
The [inventory](SYSTEMIC-UX-01-inventory.md) records the nine-module inspection completed before
runtime edits, followed by the additional findings from consolidated regression. The
[content review](SYSTEMIC-UX-01-content-review.md) contains faculty candidates, not implemented
curriculum changes.

Six modules have runtime presentation changes: BF, PI, EBUS, CRRT, MV and MCS. BBT, ECMO and HD
were inspected and exercised as regression references. No clinical engine, question bank,
objective, authored lesson sequence, source/media asset, progress adapter, release flag or
review status changed. Device Intelligence, Airway Stent Mechanics and ICU Simulation are
outside the batch.

**EBUS remains not clinically/content ready.** All human, clinical, source, media and device
review holds remain unchanged. PI's completed pre-change G02 gate and ECMO's technical closure
remain historical baselines. This report is engineering evidence, not a new release approval.
Delivery is one PR; no merge or deployment is authorized by this run.

## SYSTEMIC FIXES IMPLEMENTED

- **Explicit document scroll ownership.** The desktop rule in `src/styles/globals.css` used the
  presence of `data-critical-care-activity-shell` to lock both `body` and `#main-content`, even
  when the adapter already rendered a flowing lesson. Native wheel gestures reproduced the
  lock in CRRT, MV and MCS. Their existing focused-lesson/task-flow/flowing adapters now declare
  `data-learning-document-flow`, which opts out of that rule and its outside-footer hiding.
  BBT and ECMO retain their real internal workspace scroll owners. Shared StageLayout,
  LessonShell and stage state machines are unchanged.
- **Reusable contracts backed by each actual owner.** Control/result adjacency, truthful
  availability, visual discovery, one current action and preserved progressive workbenches
  are documented in the inventory. The implementations use local image, scope and circuit
  renderers rather than adding another universal stage or progress store.
- **Browser regression harness.** `e2e/systemic-ux.spec.ts` exercises native input, real output
  changes, measured bounding boxes, hit-tested focus, native wheel scrolling, compact/text
  reflow, disabled semantics and public entry. `playwright.systemic-ux.config.ts` also runs the
  relevant existing journeys against an explicitly supplied local production server.

## MODULE-LOCAL FIXES IMPLEMENTED

| Module   | Actual owner and resulting behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Preserved behavior                                                                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PI       | `imaging-flow.module.css` gives comparison workbenches the task width. `suite-scene.module.css` places current/baseline projections, virtual C-arm and real controls in adjacent desktop columns; compact layouts stack. Projection metadata follows the image. Immediate native document scrolling prevents rapid Tab navigation from finishing behind the header.                                                                                                                                                              | Existing focus measurement, outline placement, wrap/help hooks, acquisition and multiplanar layouts, actual model/input handlers, baseline pixels and self-paced progress.                                          |
| EBUS     | Embedded `GuidedKnobology.tsx` and `guided.css` group recorded images with the existing image-control fieldset. Status, playback, comparison and explanatory limits remain present. Host `course.module.css` gives unavailable answer labels neutral styling and a non-action cursor.                                                                                                                                                                                                                                            | Real recorded-example selection, held-frame semantics, previous comparison pixels, Doppler, freeze, calipers, save, iframe height reporting and existing disabled predicates. No new synthetic ultrasound behavior. |
| BF       | Scope CSS reduces the graphical bench and close-up footprint. `BronchCourseLayout` places interactive task navigation in normal flow before the workbench and measures site-header clearance for native focus scrolling. Supporting coaching follows the compact workbench.                                                                                                                                                                                                                                                      | Same instruction, single existing set of action callbacks, scope engine/assets, authored demonstrations, actual input provenance, skip/retry/explanation, section progress and reading-task navigation.             |
| CRRT     | `CircuitWorkbench` groups the real circuit and controls in five existing guided tools. `CrrtFoundationLesson` presents those exercises after the current instruction and before supporting prose; all prose remains. The foundation heading scrolls with the document. User-directed task changes reveal the new instruction after rendering; initial mounting and ordinary control operations do not trigger that scroll or move focus. The fixed anticoagulation selector is natively disabled with an accessible explanation. | Circuit geometry, quantities, state/readiness predicates, numeric examples, pressure comparisons, transport ledger, operational workflows, source restrictions and self-paced continuation.                         |
| MV / MCS | Existing flowing adapters explicitly own document scrolling. No local engine or teaching component was rewritten.                                                                                                                                                                                                                                                                                                                                                                                                                | Delivered/pending setting semantics, simulation time, waveforms, explanation/skip/reset/reload and current task boundaries.                                                                                         |

### Measured visual evidence

Evidence uses Chromium bounding boxes and the actual uncovered viewport band, not readiness
flags alone. At normal desktop/laptop sizes the selected control and full relevant output fit
after an ordinary orientation scroll; manipulation then changes the output without scrolling.
PI's desktop assertion includes the virtual C-arm as well as the current projection. Compact
screens may stack; CRRT retains its deliberate internal horizontal schematic scroller while
the document itself does not overflow. Enlarged-text checks include native keyboard focus.

| Pair                                           | Baseline 1440 span | Final 1600 | Final 1440 | Final 1024 | Final 390 | Final 320 | Final 200% text |
| ---------------------------------------------- | -----------------: | ---------: | ---------: | ---------: | --------: | --------: | --------------: |
| PI projection / obliquity (+ C-arm on desktop) |                594 |        292 |        292 |        248 |       581 |       600 |             534 |
| EBUS recording / depth                         |                666 |        281 |        250 |        266 |       436 |       382 |             519 |
| BF bench / Advance                             |                496 |        421 |        421 |        358 |       486 |       451 |             500 |
| CRRT circuit / CVVHD                           |                790 |        516 |        516 |        588 |       588 |       640 |             696 |

All numbers are CSS pixels, rounded; baseline spans at the other five variants are in the inventory. The PI final desktop measurement is stricter: it includes the C-arm; its baseline number measured the projection/control pair alone. Compact and enlarged-text spans describe adjacency, not a promise that every panel fits one screen.

| 1024×768 pair | Available vertical band | Measured pair bounds |
| ------------- | ----------------------- | -------------------- |
| PI            | 233.3–695.8             | 244.8–493.2          |
| EBUS          | 81.0–768.0              | 93.0–359.3           |
| BF            | 81.0–768.0              | 92.9–451.1           |
| CRRT          | 81.0–768.0              | 93.6–681.1           |
| MV            | 81.0–768.0              | 93.7–268.2           |

Native 350px wheel input left `scrollY` at zero in baseline CRRT/MV/MCS. The repaired document
routes scroll normally, while BBT/ECMO retain independently scrolling workspaces. Before/after
captures also include the CRRT fixed selector and EBUS unavailable-answer state.

Visual review inspected final entry and manipulation/scroll contact sheets covering all six
viewport/text variants for each touched module, plus the full-size disabled-state captures. These show adjacent desktop
controls/results, readable stacked compact workbenches, visible native focus, and the repaired
CRRT instruction on task entry. Source and reading panels remain document content rather than
fixed overlays. The screenshots do not establish clinical/content approval.

Durable evidence: `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/systemic-ux-01/`.
`manifest.json` lists files and SHA-256 hashes; `measurements.json` contains the final geometry.
Screenshots, traces and raw authoring evidence stay outside Git as required by
`docs/local-authoring-assets.md`. Committed tests and reports supply reproducible commands and
reviewable measurements without copying private reference assets into the checkout.

## CONTENT/CURRICULUM ITEMS DEFERRED TO HUMAN REVIEW

The separate content-review file identifies ten candidates with locations, friction, a review
direction, preservation boundaries and required reviewers. They include EBUS depth and
knobology consolidation, repeated microsteps, question level, the unresolved exact “unnamed
structure” item, PI CT-to-body divergence placement, opening media, action terminology and
CRRT/MV/MCS text/visual emphasis. None authorizes replacement questions, images, clinical claims
or reordered concepts. EBUS's existing human/source/media queue remains authoritative.

## PRE-EXISTING / UNRELATED DEBT

- BBT `contracts.test.ts:198` expects
  `isPublicPath('/airway-anatomy/case-001/case_manifest.json')` to be false, while the baseline
  access policy returns true. The same result was reproduced by bundling `access.ts` and its
  locale dependencies read directly from baseline Git objects; see
  `baseline-access-reproduction.json`. The access policy, test and dependencies are unchanged.
  Resolving the intended access contract is outside this presentation batch.
- The legacy HD browser file has stale progression/gating assumptions. For example, its
  pressure test sends two primary actions after choosing a response, passes the action surface,
  then expects a flush control while `pressure-system-9-explain` is displayed. The waveform and
  advancement tests similarly pass the expected activity; the wedge test expects no primary
  action although the current self-paced surface offers Continue. The HD module and browser
  file are byte-identical to baseline, and the global scroll selector does not match the
  reproduced HD page (`hd-baseline-reproduction.json`, `hd-baseline-identity.diff`). The remaining HD diagnostics are retained without claiming each cause was independently resolved. These
  failures are reported below; changing the curriculum or restoring compulsory gates to make
  the old tests pass is outside this repair. Refresh those journeys against the current
  self-paced contract in a separate test-maintenance task.
- Forced lint of the embedded Vite `GuidedKnobology.tsx` reports six existing warnings: three
  effect-state warnings and three Next image-rule warnings. The baseline version reports the
  same six; zero errors. Ordinary root ESLint ignores the embedded app, so this explicit check
  is retained in evidence rather than silently omitted.
- BF retains the existing `scope-assets.test.ts:305` todo for a continuous larynx/trachea
  surface join. This batch changes no anatomical mesh; the exercised larynx entry/crossing/
  return pixel checks pass, but they do not resolve that geometry todo.
- Build warnings include existing large training-app chunks, Mermaid/Langium dynamic-import
  analysis and metadata-base fallback. No dependency or build-system changes were made.

The 11 HD failures are retained in `hd-browser-failures.json` and the original traces:

| Existing spec line / journey  | Observed failure                                                             |
| ----------------------------- | ---------------------------------------------------------------------------- |
| 78 — pressure                 | Flush control requested after advancing to the explanation step.             |
| 212 — waveform recognition    | Right-ventricle radio requested outside the recognition surface.             |
| 256 — catheter advancement    | Confirmation expected after the test has advanced into the observation step. |
| 295 — wedge capture           | Test expects zero primary actions; the current surface has one.              |
| 319 — thermodilution          | Injection control requested in the wrong workflow state.                     |
| 361 — attribution             | Old sort-row selector is absent at the reached step.                         |
| 391 — derived inputs          | Old “Commit these classifications” button is absent.                         |
| 458 — integration             | Old reassess-button selector is absent at the reached step.                  |
| 550 — Practice                | Old “Commit mechanism and priority” button is absent.                        |
| 574 — both Challenge variants | Old teaching-feedback preference checkbox is absent.                         |

These are unresolved legacy test results, not a claim that every HD clinical workflow was
revalidated. Five viewport journeys and the eight-Practice-brief availability check pass.

## VALIDATION

All browser runs target local production output using real Chromium. The new systemic tests
isolate local APIs and external requests; they do not establish authenticated/backend behavior.
Navigation and control operations use the real UI, without seeding answers, completion records
or fabricated learner actions. Screenshot pixel checks establish visible change in the
projection/recording/bench/circuit; MV also checks the actual delivered-rate readout.

| Check                                        | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build                             | PASS: final full `npm run build`, including both training apps, content, asset validation, Next production output and standalone preparation (`production-final-build.log`).                                                                                                                                                                                                                                                                            |
| Root TypeScript                              | PASS with Node heap set to 8GB (`type-check-verified.log`).                                                                                                                                                                                                                                                                                                                                                                                             |
| PI/BF/EBUS-host/CRRT Jest                    | 110 suites passed; 1,211 tests passed, one existing todo. Subsequent BF/CRRT check: 66 suites, 861 tests passed and the same todo. After the CRRT navigation fix, 41 CRRT suites / 510 tests passed again. These are subsets, not additional unique tests.                                                                                                                                                                                              |
| Shared stage and remaining five modules Jest | 209 suites passed, one failed; 4,534 tests passed, one existing BBT access-contract failure. Across both nonoverlapping selections: 319 suites passed, 5,745 tests passed, one failure and one todo.                                                                                                                                                                                                                                                    |
| Embedded EBUS                                | TypeScript PASS; Vitest 35 files / 254 tests passed.                                                                                                                                                                                                                                                                                                                                                                                                    |
| New systemic Chromium matrix                 | PASS: 39/39 against the final build, including all six width/text variants for each touched module, native output changes and all nine anonymous entries. PI rapid Tab uses normal motion. Final native-wheel audit confirms the nine scroll owners.                                                                                                                                                                                                    |
| Existing Chromium regressions                | 128/139 distinct checks pass after correcting the harness; 11 legacy HD failures remain. The initial run was 124 pass / 15 fail; the three BF larynx tests and one ECMO focus test pass with the corrected reduced-motion option. A subsequent PI/CRRT regression passes 40/40. After the final CRRT navigation repair, its nine existing journeys pass again (`production-navigation-crrt.log`). Repeats are not counted as additional distinct tests. |
| Changed-path quality checks                  | PASS: root changed-path ESLint (zero errors/warnings), Prettier including embedded paths, and `git diff --check`. Forced embedded lint has zero errors and the six baseline warnings described above.                                                                                                                                                                                                                                                   |

Reproduction commands, from this checkout (start a production server separately):

```sh
NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only NODE_OPTIONS=--max-old-space-size=8192 npm run build
NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3165
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
npm --prefix EBUS-course/apps/web run typecheck
npm --prefix EBUS-course/apps/web test
npx jest --runInBand src/features/peripheral-imaging/__tests__ src/features/bronchoscopy-foundations/__tests__ src/features/ebus-guided/__tests__ src/features/baxter-crrt/__tests__
npx jest --runInBand src/features/learning-module src/features/mechanical-ventilation/__tests__ src/features/mechanical-circulatory-support/__tests__ src/features/cardiohelp-ecmo/__tests__ src/features/icu-hemodynamics/__tests__ src/features/bronchial-branch-tracing/__tests__
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3165 PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3165 BRONCH_FOUNDATIONS_BASE_URL=http://127.0.0.1:3165 npx playwright test --config playwright.systemic-ux.config.ts
```

The existing browser selection contains 31 PI, 21 BF, 23 BBT, 9 CRRT, 30 ECMO, 17 HD and 8 MCS checks (139 distinct tests). The systemic file adds 39 checks across the six touched modules and all nine public entries.

The embedded EBUS app has its own TypeScript/Vitest checks. Changed-path ESLint, embedded
forced lint, Prettier (including the normally ignored embedded paths) and `git diff --check`
are recorded in the evidence logs. A first default-heap root type-check exhausted Node's 4GB
heap; the 8GB run completed. The first browser harness used an unsupported top-level
`reducedMotion` option; TypeScript caught it. It now uses `contextOptions`, and the three
affected BF larynx journeys plus the ECMO guided-focus check passed with the intended setting. These harness/resource failures
are retained in logs; they are not reported as application defects.

### H1–H12 status within this repair boundary

| Contract                 | Status and evidence                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 — entry/curriculum    | PASS for preservation: all nine anonymous entry routes and existing Learn navigation exercised; no registry or resolver edits.                                                                                  |
| H2 — teaching sequence   | PASS for preservation only: all teaching, objectives and authored sequence retained; substantive curriculum evaluation deferred.                                                                                |
| H3 — shared stage        | NOT APPLICABLE to a migration: no stage replacement or pane-fraction migration. Existing shared components retained; actual local owners repaired.                                                              |
| H4 — current task/action | PASS for representative repaired journeys: current instruction, one primary action and secondary self-paced actions remain visible/reachable. BF removes only the duplicate rendered instruction.               |
| H5 — rendered content    | PASS for changed layouts: actual workbenches and unchanged supporting teaching rendered in production captures and existing journeys.                                                                           |
| H6 — real activities     | PASS for preservation: native controls change the real output; layout does not advance time, acquire images or record completion.                                                                               |
| H7 — feedback modes      | PASS for preservation: existing correct/wrong/retry, explanation, held-image availability and self-paced tests; no response or feedback handlers changed.                                                       |
| H8 — fidelity            | PASS for preservation: no models, measurements, assets or device handlers changed; explicit unavailable settings stay unavailable.                                                                              |
| H9 — honest progress     | PASS for exercised existing journeys: skip, reload, Back/review, actual input records and section restart boundaries retained; no new persistence.                                                              |
| H10 — language           | NOT APPLICABLE to clinical rewriting: clinical copy untouched. The fixed-selector explanation describes only its actual availability.                                                                           |
| H11 — scope/holds        | PASS: six named modules and one scoped global scroll rule; out-of-scope modules, review states, release flags and data stores unchanged.                                                                        |
| H12 — browser proof      | PASS for the repaired engineering matrix; FAIL for the wider legacy regression because the unrelated BBT unit and legacy HD browser failures remain unresolved. This is not full-module clinical certification. |

## NOT RUN

- A new full PI G02 release gate or serial closure loop; explicitly excluded by the owner.
- Faculty/content/source/media/device review, real-device validation or clinical validation.
- Deployed/CDN asset delivery or the trimmed standalone server as a separate deployment artifact; browser checks use `next start` against the production build.
- Authenticated cloud progress, backend write paths, upload scripts, Supabase mutations,
  deployments or remote production tests.
- Every possible lesson/control combination at every viewport, every locale, assistive
  technology or browser engine. Inventory rows distinguish source inspection from exercised
  representatives; the width/text matrix is real Chromium, not a claim about all platforms.

## POST-MERGE REGRESSION REQUIRED

1. On the integrated production build, rerun the systemic matrix and all nine public entries.
   Confirm document scroll in CRRT/MV/MCS and retained internal scroll in BBT/ECMO.
2. PI: targeted comparison layouts for projection/field/signal, actual C-arm/projection changes,
   immutable baseline/hold behavior, and preserved PI-FOCUS-01, PI-OUTLINE-01, PI-WRAP-01 and
   PI-HELP-01. Include rapid forward/reverse Tab, manual-wheel focus, open outline, help,
   1024 laptop, compact and enlarged text; retain skip/explain/retry/reload progress semantics.
   This is targeted post-change regression, not reopening historical G02.
3. EBUS: image depth, gain/contrast, Doppler, held/unavailable response, freeze/calipers/save,
   comparison pixels and iframe resize. Keep all clinical/content/source/media holds.
4. BF: guided five-control bench, demonstration/own-attempt provenance, larynx return,
   non-bench inspection and enlarged-text focus. CRRT: all five circuit workbenches, fixed
   anticoagulation description, operational/case navigation and native document scroll.
5. MV/MCS: native scroll and task/setting/explanation/restart/reload behavior; ECMO: existing
   layout/focus suite before accepting any later shared-scroll change.

The PR must not be merged or deployed by this task. Technical test results do not advance any
module's review or release status.
