# Rebuild the Baxter CRRT module into a high-yield Learn / Practice / Assess module

## Context

The Baxter CRRT module (`/baxter-crrt`) is a single dense page with **five stacked navigation layers**: 5 workspace tabs (Learn/Practice/Mastery/Drills/Tools), a device selector (PrisMax vs Prismaflex), a role-lens selector, a station-grouped case dropdown, a second 5-tab "surface" strip, and a 7-step reasoning ribbon inside every case. Learn, Practice, and Mastery all render the **same 1,428-line case player** differing only by an enum — so "Learn" never actually teaches. The module is far heavier than its siblings (~9.8k lines content TS, ~5.1k engine, ~14.4k components/CSS, 2 device adapters, 37 test files) and, unlike Cardiohelp ECMO and the pleural modules, ignores the site's shared learning-module IA (hub + Learn/Practice/Assess routes).

**Goal**: restructure onto the proven hub + `/learn` + `/practice` + `/assess` pattern, curate content to a high-yield core path, and make Learn real didactics.

**Owner decisions (fixed):**

1. **PrisMax only** — delete Prismaflex adapter, device selector, cross-device transfer content.
2. **Keep the role lens** (Integrated/Operator/Prescriber) — demoted to a small toggle inside the case player.
3. **Curate to a core path** — ~10 core cases, 5 drills, 2 embedded labs; rest optional or cut.
4. **Learn = real didactic lessons** — cases move to Practice.

Key verified facts that shape the plan:

- `curriculum.ts:60-64` **throws at import if the catalog order deviates from `CRRT_ALL_CASE_IDS`** → curation must be a presentation-layer list; never delete case definitions. Same paired-registry invariants in `rapidDrills.ts:219` and `instructionalTools.ts:135`.
- `engine/progress.ts` `canonicalizeProgress` **fail-closes on any content-version mismatch** → stored progress resets on rebuild regardless; keep the `baxter-crrt-progress-v3` key/shape but spend zero effort on legacy-id migration (module is draft-gated, pre-publication).
- The capstone (`mastery.ts`) is masked **CRRT-16** ("Unseen PrisMax capstone", score ≥80, 0 hints, 0 critical errors, reassessment required) — yet CRRT-16 is currently selectable in Learn/Practice, **spoiling the masking**. Fix: exclude it from all pickers.
- Reference implementations: `src/features/cardiohelp-ecmo/` (hub, `CurriculumUnit` model, `nextRecommendedActivity`, capstone gating, `/assess` route name) and `src/features/learning-module/` (ModuleNavItem contract, LearnBlock shape). Cardiohelp is the primary template — CRRT is a device-simulator module like it, not a didactic-only module like pleural-ultrasound.

## New information architecture

All routes stay under the existing draft-gated `src/app/[locale]/baxter-crrt/layout.tsx` (unchanged; release stage stays `sme-review`).

| Route                   | Component (new)      | Content                                                                                                                                                                                                                                             |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/baxter-crrt`          | `BaxterCrrtHub`      | Hero + continue-where-you-left-off CTA, "How this module works" (Learn → Practice → Capstone), 6-station curriculum map with completion chips (from ProgressV3), locked capstone card, safety banner, SourcesPanel. Modeled on `CardiohelpHub.tsx`. |
| `/baxter-crrt/learn`    | `BaxterCrrtLearn`    | 7 didactic lessons (LearnBlock-shaped) with 2 embedded interactive labs; circuit SVG + console mockup as teaching figures.                                                                                                                          |
| `/baxter-crrt/practice` | `BaxterCrrtPractice` | Station-grouped case picker (core path prominent, extras collapsed, **CRRT-16 excluded**) + slimmed case player + "Safety drills" strip.                                                                                                            |
| `/baxter-crrt/assess`   | `BaxterCrrtAssess`   | Masked capstone, gated on core-path completion, results vs `mastery.ts` rules.                                                                                                                                                                      |
| `/baxter-crrt/review`   | **deleted**          | Module is already draft-gated and the SME is the owner. Kills the entire `review-preview` session mode, telemetry/write suppression, reviewer banner, twin layout.                                                                                  |

Route pages are thin server components (cardiohelp pattern: metadata + `setRequestLocale` + one client component) plus a `routes.test.tsx`. New `BaxterCrrtModuleNav` copies `CardiohelpModuleNav` (Overview / Learn / Practice / Assess, `ModuleNavItem` contract). Add `baxterCrrtNavBase = '/baxter-crrt'` to `src/features/learning-module/moduleRoutes.ts`. Module stays English-only with the existing fallback-banner pattern (no next-intl expansion now).

Wiring: remove `/baxter-crrt/review` from `src/lib/draft-modules.ts`; `site-search.ts`, `site-auth/access.ts`, `sitemap.ts` need no change (all key off the `/baxter-crrt` base).

## Component decomposition

**Deleted** (+ their CSS modules and tests): `BaxterCrrtLab.tsx` (the 5-tab shell), `CrrtCrossDeviceTransferReview.tsx`, `CrrtPhase7InstructionalTools.tsx`, `instructionalToolsModel.ts` (if orphaned — verify by grep).

**`CrrtLearningWorkflow.tsx` → renamed `CrrtCasePlayer.tsx` and slimmed:**

- `CrrtLearningExperience` narrows to `'practice' | 'mastery'` — all `'learn'` branches deleted (biggest source of the three-identical-modes confusion).
- **Keep the 7-phase engine reducer untouched** (heavily tested); collapse only the **UI ribbon to 4 stages**: Brief (Read+Define), Plan (Select+Predict), Run, Debrief (Reassess+Reflect). Pure presentation-layer grouping, no engine test churn.
- Role lens → small segmented control in the player header ("View as: Integrated · Operator · Prescriber", default Integrated).
- Mobile surface tabs move fully inside the player and shrink 5→4 (merge Circuit into Machine): Case / Machine / Patient & trends / Debrief.
- Device hardcoded to PrisMax.

**Kept**: `PrismaxPilotInterface.tsx`, `CrrtPilotCircuit.tsx` (doubles as Learn figure), `CrrtPrescriptionWorkbench.tsx`, `CrrtPressureLocalizationLab.tsx`, `CrrtRapidDrillReview.tsx` (mounted in Practice), `CrrtCalibrationPanel/CrrtResponsePanel`, `SourcesPanel` (drop `reviewPreview` prop), `prescriptionWorkbenchModel.ts`, `pressureLocalizationLabModel.ts`.

## Content curation (presentation layer — no case definitions deleted)

Rework `content/curriculum.ts` into cardiohelp-style `CurriculumUnit[]` (`{id, station, title, summary, lessonIds, coreCaseIds, additionalCaseIds, capstoneId?}`) with `nextRecommendedActivity` and `isCapstoneUnlocked` helpers ported from `cardiohelp-ecmo/content/curriculum.ts`.

**Core path — 10 cases** (coverage across all 6 stations):

| Station                             | Core             | Optional (collapsed) |
| ----------------------------------- | ---------------- | -------------------- |
| 1 Define the goal                   | CRRT-01, CRRT-02 | CRRT-03              |
| 2 Build the prescription            | CRRT-04, CRRT-05 | CRRT-06              |
| 3 Set up & start safely             | CRRT-08          | CRRT-07, CRRT-09     |
| 4 Monitor dose & fluid              | CRRT-11          | CRRT-10, CRRT-12     |
| 5 Pressures & troubleshooting       | CRRT-13, CRRT-15 | CRRT-14              |
| 6 Anticoag/complications/liberation | CRRT-17, CRRT-18 | —                    |

**CRRT-16 removed from all pickers** (capstone-only; loaded by id via `mastery.ts`).

**Drills 7→5**: keep DRILL-AIR, -BLOOD-LEAK, -GAIN-LOSS, -BAG-SCALE, -WRONG-SOLUTION as a Practice "Safety drills" strip. Cut DRILL-POWER and DRILL-BLOOD-RETURN (teaching points fold into Learn lesson 6). Update `artifactRegistry.ts` in the same commit (paired invariant throws).

**Concept labs 6→2**: keep LAB-PRESCRIPTION (workbench, embedded in Learn lesson 3) and LAB-PRESSURE-LOCALIZATION (embedded in Learn lesson 4). Cut LAB-TRANSPORT, LAB-PREPOST-DILUTION, LAB-FLUID-LEDGER, LAB-CITRATE-DASHBOARD as interactives — their teaching copy is mined into Learn prose.

**Learn — 7 lessons** in new `content/learnLessons.ts` (LearnBlock-shaped, each with `sourceRecordIds`, `reviewStatus: 'pending'`; mined prose is a DRAFT for the owner to author/review):

1. CRRT indications & modality selection (SCUF/CVVH/CVVHD/CVVHDF)
2. Solute transport (diffusion, convection, adsorption, UF) — from LAB-TRANSPORT copy
3. Prescription & dosing (effluent dose, prescribed vs delivered, pre/post dilution) — embeds Prescription Workbench
4. Circuit anatomy & pressures — `CrrtPilotCircuit` anchor figure + Pressure Localization Lab + read-only console mockup
5. Anticoagulation incl. citrate (recognition/verification/escalation framing)
6. Alarms & troubleshooting (cause-first doctrine; absorbs the 2 cut drills' points)
7. Fluid management & liberation — LAB-FLUID-LEDGER concept + CRRT-10/18 content
   Optional advanced block: "If you trained on Prismaflex" differences.

## Engine changes

- **Delete**: `deviceAdapters/prismaflex.ts` + its calculations; shrink `deviceAdapters/registry.ts` to PrisMax; trim `deviceProfiles.ts`; delete `content/crossDeviceTransfer.ts`. Remove `CrrtRuntimeSessionMode`/`review-preview` plumbing (`persistenceEnabled`/`telemetryEnabled` become constants).
- **Keep the Zod device-id enum in `schema.ts` unchanged** (both ids) — case data/provenance/progress reference both; changing the enum triggers a 900-line cascade. Only the runtime list `BAXTER_CRRT_DEVICE_IDS` becomes `['prismax-aw8035-2xx']`.
- **Keep**: entire simulation stack (`simulation.ts`, `learningSession.ts` + reducer, fluid/solute/pressure/filter/patient models, `clinicalMath`, `alarms`, `outcomes`), PrisMax adapter, `progress.ts`.
- **Progress**: keep key `baxter-crrt-progress-v3` and V3 shape. Update `isBaxterCrrtLearnerLessonId` in `learnerRegistry.ts` to the 7 new lesson ids. Bump `BAXTER_CRRT_CONTENT_VERSION` (stored progress resets by design — acceptable pre-publication). Optionally add shared `markModuleSection('baxter-crrt', …)` spine writes at publish time (deferrable; cardiohelp doesn't either).
- **Analytics**: section enum → `overview|learn|practice|assess`; drop device dimension, drills/tools values, and review-preview suppression — in both `src/features/baxter-crrt/analytics.ts` and `src/lib/baxter-crrt-analytics.ts` + tests.

## Implementation order (5 incremental PRs)

**PR 1 — Deletion pass: Prismaflex + review mode.** Delete prismaflex adapters/profile/transfer content, `CrrtCrossDeviceTransferReview`, `/baxter-crrt/review/*`, `review-preview` plumbing; runtime device list → PrisMax; strip the device selector from `BaxterCrrtLab` so the app keeps running; update `draft-modules.ts`. Tests: delete 5-6 (prismaflex/cross-device/review), update ~7 (deviceCalculations, learningSession, progress, analytics, content, releaseComposition, draft-modules).

**PR 2 — Content curation layer.** `curriculum.ts` → `CurriculumUnit[]` + helpers; drills 7→5 and labs 6→2 with paired `artifactRegistry` updates; exclude CRRT-16 from pickers; add `content/learnLessons.ts` (7 draft lessons); bump content version. Tests: update content/rapidDrillReview/instructionalTools/sourceMatrixIntegrity; add curriculum.test.ts (every station ≥1 core case, CRRT-16 absent from pickers, gate math) and learnLessons.test.ts.

**PR 3 — New shell & routes (big UI swap).** Add `baxterCrrtNavBase`; create `BaxterCrrtModuleNav`, `BaxterCrrtHub`, `BaxterCrrtLearn`, `BaxterCrrtPractice`, `BaxterCrrtAssess`; rename/slim `CrrtLearningWorkflow` → `CrrtCasePlayer` (drop learn mode, 4-stage ribbon, internal role lens, 4 surfaces); rewrite `page.tsx` as hub + add learn/practice/assess pages; delete `BaxterCrrtLab.tsx`. Tests: rewrite scaffold→hub, workflow→casePlayer, add routes.test.tsx + practice-curation + assess-gating tests; update accessibility/page/layout/moduleRoutes tests.

**PR 4 — Cleanup sweep.** Delete `CrrtPhase7InstructionalTools` + css, orphaned models, dead CSS (prune `baxter-crrt.module.css` ~1.9k lines + workflow/interface css aggressively), prune `content/index.ts`/`engine/index.ts` exports (`pathways.ts`, `engineFixtureBoundary.ts`, `runtimeCaseNormalization.ts` if unconsumed), update hero/metadata copy.

**PR 5 — Verification & owner review.** Full suite green; owner reviews Learn draft prose + keep/cut list; stage stays `sme-review` until sign-off.

## Verification

Routes are draft/auth-gated → browser preview unreliable; use the established jest+RTL pattern:

```
npm run type-check
npm run lint
npx jest src/features/baxter-crrt "src/app/\[locale\]/baxter-crrt" src/features/learning-module
npm test   # full suite before merge (sitemap/draft-modules/site-search couplings)
```

Existing 37 test files: delete ~6, keep ~14 pure engine-model tests unchanged, update ~12, add ~6.

## Risks

- **Import-time registry invariants** (curriculum order vs `CRRT_ALL_CASE_IDS`, `rapidDrills.ts:219`, `instructionalTools.ts:135`, learnerRegistry): any id-list trim must land with its paired registry constant in the same commit or the app crashes at import.
- **Prismaflex blast radius**: contained by keeping the Zod enum and changing only runtime lists/adapters/UI.
- **Progress reset on content-version bump**: guaranteed and accepted pre-publication; don't bump casually after publish.
- **CRRT-16**: exclude from pickers only — must remain in the case registry for the capstone to load.
- **Analytics Zod coupling**: section/tab renames must land in both analytics files + tests or events silently fail validation.
- **CSS pruning order**: delete pages before pruning shared CSS to avoid dangling imports.
- **Learn prose is drafted by mining existing case/lab copy** — flagged `reviewStatus: 'pending'`; the owner authors final wording before any release-stage change.
