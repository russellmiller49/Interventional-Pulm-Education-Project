# Core build validation

This record covers the inherited 23-section core module and the completed seven-mode scope pane. It distinguishes rendered host tests, a real-geometry scene harness, native browser journeys and human review still required. The implementation is unlisted and noindex; this record does not grant clinical or publication approval.

## Checks and outcomes

| Check                                                       | Result                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Feature, route, site-access and existing airway unit suites | 27 suites; 367 passed; one inherited larynx-junction TODO                                               |
| Section, capstone and registry gates                        | All 23 sections, eight capstone cases and registries pass                                               |
| Existing-media register                                     | 94 files match their inventory and hashes; all review/permission fields remain pending                  |
| Real scene harness                                          | All seven modes have rendered pixel signal; 13 grouped interaction/recovery checks pass; no page errors |
| Native production-browser journeys                          | 10 tests passed against the final standalone build                                             |
| TypeScript and scoped ESLint                                | Pass; no diagnostics                                                                                    |
| Complete production build                                   | Pass; packaged server launches and all ten browser tests pass                                           |
| Existing airway optical regression                          | RUL, RML and LUL crops are pixel-identical to the inherited baseline in both new runs                   |

The unit command is:

```sh
npx jest src/features/bronchoscopy-foundations 'src/app/\[locale\]/bronchoscopy-foundations' src/lib/site-auth/access.test.ts src/lib/airway-anatomy --runInBand
```

It includes all 23 rendered section walkthroughs, teaching disclosure and source checks, reducer/inspection guards, asset decoding/provenance, capstone behavior, actual control handlers and the existing airway tests. The one TODO records the unresolved geometric junction; it is not silently counted as a passing check.

```sh
npx tsx scripts/bronchoscopy-foundations/check-section.ts --all
npx tsx scripts/bronchoscopy-foundations/check-capstone.ts
npx tsx scripts/bronchoscopy-foundations/check-registries.ts
npx tsx scripts/bronchoscopy-foundations/build-media-register.mts --check
npx tsc --noEmit -p tsconfig.json
npx eslint src/features/bronchoscopy-foundations src/app/'[locale]'/bronchoscopy-foundations
npm run build
node scripts/bronchoscopy-foundations/review-scope-pane.mjs
BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3130 npx playwright test --config playwright.bronchoscopy-foundations.config.ts
```

Scoped lint also covers the changed legacy airway-map wording, new JS/TS review scripts, browser suite and its configuration. The full build runs both training-app builds, Contentlayer, critical-care and cardiac asset validation, Next's webpack production build and standalone packaging. No shared Supabase or upload script is involved.

The isolated checkout uses local dependency directories. Its earlier external node_modules symlink caused standalone tracing to omit a dependency; replacing that symlink with a local directory resolved packaging. The packaged server is launched directly from `.next/standalone/server.js` with its runtime configuration, then the browser suite runs against that server. Development-only auth is used solely for the existing admin-airway regression capture; the public foundations tests need no auth bypass.

## Demonstrated learner and scene behavior

The native browser suite covers Overview entry, a direct lesson link, an incomplete-section reload, an immutable first decision, bench locks/movement/reset/observation, the difference between entered and inspected airways, refusal of an unsupported report statement, paired Practice, and a capstone with seven held decisions plus one unsafe critical choice that remains unmet after reload. Rationales and paired lessons stay withheld until the capstone debrief, apart from immediate unsafe feedback.

The real scene harness uses the loaded lumen and collider. It enters RUL, completes the survey with declared inspections, records an inaccessible segment and returns to RB6. It also verifies red-field withdrawal, lens-smear clearing, tube geometry/readout agreement, bench rotation, keyboard/pointer/touch provenance, native locks, reduced-motion manual breathing, glottic entry, accessory state changes, context-loss recovery, normal breathing paused offscreen or while locked, failed-asset retry and a usable schematic after WebGL creation fails. The harness's ScopePilot sends normal commands; it does not manufacture inspection records.

Camera projection is compared with a Three.js camera across sampled rolls and deflections. Narrow optical captions may move to avoid overlap, with a leader line retaining the original projected attachment point. The SVG map has 29 separated caption slots. Browser tests check actual caption rectangles as well as absence of horizontal page overflow.

## Visual review

The actual ImagingStageHost reference and the foundations bench were captured at matching 1440×900 and 1280×720 viewports. The same Steps → Teaching → Simulator structure, panel sizes and current-task treatment are retained.

Six representative sections are checked at 1440×900, 1024×700, 390×844 and 320×844: Shared airway, Five controls, Branch entry, Right side, Systematic survey and Honest report. Compact views expose their real Steps/Teaching/Simulator tabs. The optical view is scrolled into view before checking readiness: an offscreen pane intentionally does not render continuously. Additional 900×800 captures and separate optical/map screenshots were inspected.

The 320 px review found overlapping main-bronchus captions. The final build separates them and tests the actual rendered rectangles. A CSS-only 200% zoom experiment also showed overflow in the unchanged global navigation; CSS zoom does not reproduce native browser zoom and is not counted as an accessibility pass. Native browser zoom and manual screen-reader review remain unverified.

Two new admin-airway capture runs report no browser errors. Each RUL/RML/LUL optical crop matches all 431,871 baseline pixels exactly. Whole-page captures differ outside those crops; no whole-page pixel-equivalence claim is made. The shared admin rendering primitives, source lumen and graph were not changed in the takeover implementation.

Selected inspected screenshots accompany this record in [review](review/). Full local evidence is in `artifacts/bronchoscopy-build/`, `artifacts/bronchoscopy-review/` and `test-results/bronchoscopy-foundations/`. Browser traces are retained on failures.

## Assets and remaining review

The four new Draco-compressed props total 38,008 bytes. The anatomy manifest inventories 21 payloads and 2,104,172 bytes including the manifest. Asset tests decode all seven GLBs, check named states and budgets, and verify hashes and provenance. The inherited single-run collision review measured 69.3 ms for Draco parse/decode and 46.2 ms for BVH construction; these are reference measurements, not a new hardware-performance certification.

The larynx exit has a 2.4168 mm maximum gap to the unchanged capped source inlet, above the original 0.5 mm target. The camera's scripted handoff does not prove geometric continuity. New props are generic authored teaching models, not manufacturer specifications or clinical findings. Every clinical item remains draft; rights, de-identification confirmation, anatomy review, local-policy decisions and faculty validation are still required. Optional E01–E04, variant profiles, gamepad input, public cutover and deployment are not represented as completed.

The detailed H1–H12 and A01–A44 dispositions are in the [acceptance report](implementation-report.md). The [faculty packet](faculty-review-packet.md) identifies the remaining decisions and records blank reviewer/approval fields rather than inventing sign-off.
