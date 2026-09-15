# ECMO-03 — Cardiohelp ECMO sources, model bounds and question feedback

Prompt ECMO-03 of the v2 self-paced action pack
(`Interventional-Pulm-Local-Data/roadmaps/IP-Education-Self-Paced-Action-Pack-v2/prompts/ECMO-03.md`),
read in place with `LEARNING_DESIGN_BRIEF.md`. Prepared 2026-09-15 by an AI authoring assistant
(Claude) at the owner's request. **Nothing here is clinical or device approval.** All ten items in
the [claim-review queue](ECMO-03-claim-review-queue.json) are `NOT REVIEWED`, and the
[observation guide](ECMO-03-observation-guide.md) is prepared, not run.

## Delivery and scope

- Worktree `…/Interventional-Pulm-Education-Worktrees/claude-ecmo-03`, branch `claude/ecmo-03`, cut
  from `origin/main` at `e80a03c7` (merge of PR #224). The tree was clean and no other session was
  working in it. The historical review baseline `9ef04539` is an ancestor; newer ECMO work was kept.
- **Authoritative merged behavior, not revisited:** [ECMO-01](ECMO-01.md) (PR #214: optional
  predictions, explanation before answering, retry and skip, explicit activity start, visit-only
  progress), [SHARED-01](SHARED-01-HD-ECMO-handoff.md) (PR #215: ECMO rows inert for shared
  progress, sync and recommendations) and [ECMO-02](ECMO-02-handoff.md) (PR #222: named lesson and
  case titles). No exam framing, grade authority, answer gating or hidden topic name was restored.
- **Module-local.** Every changed runtime and test file is under `src/features/cardiohelp-ecmo`. The
  shared critical-care evidence registry, which projects this module's records, was read and not
  edited; a test pins its ECMO claim types unchanged. Nothing in `learning-module`, `critical-care`,
  `src/lib`, routes, catalog, progress, analytics or Device Intelligence changed.
- No model equation, coefficient, clamp, interlock, scenario, success signal, storage key, dependency,
  backend, deployment or remote data changed. No URL was fetched and no `.env.local` was added.
- The prompt's `docs/gap-remediation/ecmo/` does not exist; ECMO records are in `docs/cardiohelp-ecmo/`
  and this folder.

## How the ten items were chosen

The prompt's evidence-date and draft gap (pack ECMO-04), the saturation-ceiling check (ECMO-06), the
remaining item-feedback work (ECMO-05) and G01's ECMO survey (a hub panel that would print "REVIEW
APPROVED" from a publication flag; an unattributed "reviewed" curriculum). Sources come first because
they are what every other explanation leans on; the model and question items are the lessons that
discuss flow and gas effects.

| ID         | Kind                | Topic                                            | Finding                                                                                                                                                                                                     | Change / hold                                                    |
| ---------- | ------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ECMO-03-01 | Review status       | Hub review badge and profile                     | The badge and the Publication row were derived only from a two-value publication flag; set to published they would have read "PUBLISHED · REVIEW APPROVED" and "Reviewed release". No review record exists  | **Corrected**; review line independent of the flag               |
| ECMO-03-02 | Device labeling     | CARDIOHELP IFU identity, date and scope          | Supplied PDF: revision 2.3, issue date 2025-01 (p. 2), software ≥ 03.04.10.00; manufacturer printed as Maquet Cardiopulmonary GmbH, not Getinge; indication p. 13 and thApp restriction pp. 29, 90 verified | **Corrected** citations and "current" wording; currency **held** |
| ECMO-03-03 | Device labeling     | IFU bubble size and pressure-drop alarm priority | p. 20 (≤ 5 mm can also stop the pump) against p. 199 (pump stop ≥ 5 mm); p. 136 (low priority) against p. 165 (medium-priority list)                                                                        | Limitation made exact; **held**, nothing encoded                 |
| ECMO-03-04 | Textbook            | The ECMO Book, chapters 9, 16, 17, 18            | Chapter files begin at printed pp. 92, 170, 173, 182; registered ranges fit. No editor, edition, ISBN or year printed                                                                                       | Date shown as not stated; support **held**                       |
| ECMO-03-05 | Supplied curriculum | ECMO CASES curriculum record                     | "reviewed July 2026" had no review record; Word properties: course author, 2026-07-16, 45 pages; filed under the simulation-model class                                                                     | **Corrected** class and citation; review **held**                |
| ECMO-03-06 | Clinical guidance   | Six ELSO and nomenclature records                | Documents not available locally; years and DOIs as registered                                                                                                                                               | Dates shown with that basis; **held**                            |
| ECMO-03-07 | Model boundary      | Sweep → PaCO₂                                    | Copy said the response has "no plateau"; the model floors PaCO₂ at 20 mmHg from about 7.5 L/min (slider to 15)                                                                                              | **Corrected** on four surfaces; engine unchanged                 |
| ECMO-03-08 | Model boundary      | Pump speed → VV saturation                       | Saturation stops at 100 from about 4000 rpm while flow and drainage suction keep rising; no surface said so                                                                                                 | Ceiling **named**; engine unchanged                              |
| ECMO-03-09 | Question feedback   | Blood flow versus sweep: prediction and transfer | The prediction's explanation only restated the principal controls                                                                                                                                           | Explanation now says what to read and the next check             |
| ECMO-03-10 | Model boundary      | Recirculating share on the reference circuit     | Copy said more flow raises the share in every case; on the reference circuit it stays at 0.08 at every speed                                                                                                | **Corrected** on three surfaces; engine unchanged                |

Each queue item carries the exact learner wording and file, the wording it replaced, the source
locations with findings, the model output where one applies, the unresolved disagreement, the clinical
question, the question disposition, the hold, the change and an empty reviewer decision. The
documents checked (paths, SHA-256, page counts, identity as printed) and the six documents not
available are listed in the queue.

## Behavior: old → new

| Surface                                                     | Before                                                                                                                      | After                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub badge and profile (`SourcesPanel`)                      | "UNLISTED REVIEW · REVIEW REQUIRED"; published flag → "PUBLISHED · REVIEW APPROVED", "Reviewed release"                     | "Unlisted draft · Clinical and device review: none recorded"; rows "IFU document check: 2026-09-15; currency not checked" and "Clinical and device review: None recorded", whichever the flag says                                                                                             |
| Hub scope sentence                                          | "The current U.S. IFU governs this facsimile’s console behavior."                                                           | "…follows the U.S. IFU, revision 2.3, issued January 2025; whether a later revision exists has not been checked."                                                                                                                                                                              |
| Every source row (hub card, compact card, stage footnote)   | Class, title, citation, claims, limit                                                                                       | Adds a date line (the document's own date and its basis), a revision line where one exists, each dated document check, and "Clinical and device review of how this module uses it: none recorded yet." Compact cards keep the date line only; footnotes keep the check date without its detail |
| IFU records                                                 | "Getinge. CARDIOHELP-i Instructions for Use … January 2025"; "The current U.S. labeling covers…"; "internally inconsistent" | "Maquet Cardiopulmonary GmbH. CARDIOHELP System Instructions for Use (U.S.). Revision 2.3, issue date 2025-01…"; indication with its page and "not checked" currency; page-by-page discrepancy wording                                                                                         |
| Case curriculum record                                      | Class "Simplified educational model"; "Unpublished 30-case curriculum … reviewed July 2026."                                | Class "Supplied case curriculum, unpublished" (own hub group and badge); "Unpublished case curriculum supplied by the course author (Word document)."                                                                                                                                          |
| Sweep boundary (lesson panel ×2, console control)           | "straight line … no plateau and no diminishing return"                                                                      | Straight line down to a fixed lower bound of 20 mmHg (about 7.5 L/min on the reference circuit); past it more sweep changes nothing; the bound is a model limit, not a physiological plateau                                                                                                   |
| VV pump-speed block                                         | —                                                                                                                           | Saturation rises with flow after re-drainage only until it stops at 100 (about 4000 rpm on the reference circuit); above that only flow and drainage suction change                                                                                                                            |
| Story problems (doubled sweep, raised speed)                | Straight-line boundary; no ceiling                                                                                          | Name the lower bound and the saturation ceiling without numbers (story copy keeps its no-digits rule)                                                                                                                                                                                          |
| VV series card, mixture boundary, adjusted-flow value guide | "Each case sets where this starts. Asking the circuit for more flow than it opened with raises it from there."              | The share rises with speed only in a case that opens with established recirculation; on the reference circuit it stays at its baseline                                                                                                                                                         |
| Sweep-section prediction explanation                        | Ended at "…attributed to the control that produced it."                                                                     | Adds what to read after the sweep and speed comparisons, and to check the gas path before changing the blood side if CO₂ keeps climbing                                                                                                                                                        |
| Kept exactly                                                | —                                                                                                                           | Engine, coefficients, interlocks, clamp and bubble logic, scenarios, question ids, stems, choices and keys, record ids and claims, routes, progress storage, analytics, shared registry                                                                                                        |

## Model range exercised

A scratch script drove the module's own reducer (one `STEP` per simulated second) at base `e80a03c7`;
the raw output is `Interventional-Pulm-Local-Data/renders/output/ecmo-03-self-paced-2026-09-15/model-replay-baseline.json`.
These are engine outputs from provided reference circuits and authored drills, not learner runs; the
values that copy relies on are pinned in `ecmo03-sources-and-model-range.test.tsx`.

| Run                                               | Result                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VV reference, pump speed (60 s)                   | 3200 rpm flow 4.05, SpO₂ 96.9 · 3600: 4.56, 98.8 · 4000: 5.06, **100** · 5000: 6.33, **100**; pre-oxygenator 77.5 from 4000; pVen −35 → −40; share 0.08 throughout |
| VV reference, sweep (120 s)                       | 4 L/min PaCO₂ 46 · 6: 31 · 7: 23.5 · 7.5, 8, 10, 12, 15: **20** (pH 7.70); SpO₂ unchanged                                                                          |
| VV reference, sweep-gas oxygen fraction (60 s)    | 0.21 → 1.0: SpO₂ 85.1 → 96.9, post-oxygenator 96.6 → 99                                                                                                            |
| Story: doubled sweep (12 s, as the activity runs) | PaCO₂ 46 → 29.2, pH 7.36 → 7.56, flow and SpO₂ unchanged; still falling toward 20                                                                                  |
| Story: raised speed (+400 rpm, 12 s)              | Flow 4.05 → 4.56, SpO₂ 96.9 → 98.8, PaCO₂ 46 unchanged                                                                                                             |
| VV recirculation drill, speed above opening       | +0 → +1500 rpm: share 0.48 → 0.70, displayed flow 4.81 → 6.33, adjusted flow 2.50 → 1.90, SpO₂ 92.0 → 89.6                                                         |
| VA reference, pump speed                          | Right radial 96 and femoral 98.5 at 2500–5000 rpm                                                                                                                  |
| Acute hypercapnia drill, sweep                    | PaCO₂ 20 from about 7.25 L/min                                                                                                                                     |

The VA pump-speed block already said regional saturations are fixed; no change was needed there. The
external report's saturation observation (SpO₂ pinned at 100 above about 4000 rpm, pre-oxygenator
capped at 77.5) is reproduced exactly. Existing labels already separate provided and live values
where comparisons are shown ("VV reference circuit" against "On screen now" in the series table;
guided comparisons restored from the reference); they were not changed.

## Question ledger (ECMO-03 scope)

Rows refer to the [ECMO-01 question ledger](ECMO-01-question-ledger.md), which remains the complete
ledger.

| Item                                                          | Disposition                                  | What and why                                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ecmo.foundation.sweep.prediction`                            | **Keep as reinforcement — rewrite feedback** | The one optional control prediction before the comparisons. Its explanation now names what to read after each run and a sensible next check. Stem, choices, key unchanged. Draft |
| `ecmo.foundation.sweep.transfer`                              | Keep                                         | Teaches that a flow display says nothing about the gas path; its explanation already names the connection to inspect                                                             |
| `ecmo.foundation.blood-flow-versus-sweep.story.doubled-sweep` | **Keep — rewrite explanation boundary**      | Axis contrast with a real run; the boundary no longer denies the model's bound                                                                                                   |
| `ecmo.foundation.blood-flow-versus-sweep.story.raised-speed`  | **Keep — extend explanation boundary**       | Axis contrast with a real run; its unsafe choice (keep raising speed until CO₂ moves) agrees with the model; the boundary now names the saturation ceiling                       |
| `ecmo.learn.vv-recirculation.prediction`                      | Keep                                         | Displayed versus effective support; its figures (4.8 displayed, about 2.5 on first circuit, drainage 83 against 99) match the drill run                                          |

Summary: rewrite 3 (feedback only), keep unchanged 2, replace 0, combine 0, remove 0. No option was
added or removed and no key or id changed. The overlap between the sweep prediction and the
raised-speed story is recorded for faculty in ECMO-03-09 rather than removed: both are optional and
neither is needed to run a comparison or continue.

**Mastery thresholds.** `content/clinicalCases.ts` and `content/scenarios.ts` still carry authored
`terminalRules` strings ("Score is calculated only after reassessment.", "Mastery requires at least 80%
with no critical safety error.") and the reducer still computes a dormant outcome score. Nothing
renders those strings, no route or component reads the outcome score or mastery (the only reader,
`session/ecmoSessionAnalytics.ts`, has no caller), and `nextRecommendedActivity` /
`isTrackCapstoneUnlocked` have no callers. They are dormant compatibility, not an active or hidden
continuation rule. They were left unchanged here and are listed for a cleanup slice.

## Test-contract migration

| File · assertion                                                                                                  | Old contract                                  | New assertion                                                                                                                                                                                                                                                                                                               | Why                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `__tests__/scenarios.evidence.test.ts` · "resolves every evidence ID and preserves the explicit source boundary"  | Exactly four source classes                   | Five: the supplied case curriculum has its own class                                                                                                                                                                                                                                                                        | The curriculum is an unpublished author's draft, not the simulation model (ECMO-03-05); every id still resolves |
| `__tests__/vv-foundation-lessons.test.tsx` · "states what the case authors and what speed moves, and bounds both" | Panel says "each case sets where this starts" | Panel says the share is taken from the authored case, that on the reference circuit it stays at its baseline at every speed, and (unchanged) that more flow than a case opened with raises it                                                                                                                               | The old sentence claimed a rise the reference circuit does not show (ECMO-03-10); the engine is unchanged       |
| New `__tests__/ecmo03-sources-and-model-range.test.tsx`                                                           | —                                             | 18 tests: one dating record per source; document dates never check or review dates; curriculum class; shared claim types unchanged; citation lines by density; hub review line for both flag values; the VV ceiling, PaCO₂ floor, both story runs, recirculation drill and VA saturations on the engine; the corrected copy | Keeps each correction tied to the model behavior it describes                                                   |
| New `__tests__/ecmo03-claim-review-queue.test.ts`                                                                 | —                                             | 5 tests: at most ten items; required fields; `NOT REVIEWED` with null reviewer fields or a named non-AI reviewer; every record, document or repository path resolves; every excerpt still quoted                                                                                                                            | Keeps the queue honest; it enforces no workflow                                                                 |

No other assertion changed, and none was skipped or removed. `story-problems.test.ts` caught numbers
added to story copy in the first pass; the copy was changed, not the rule. Earlier assertions remain in
Git at `e80a03c7`. Engine, interlock, bubble-resumption, drainage-capacity, source-surface,
localization, progress and self-paced suites ran unchanged.

## Executed evidence

Raw outputs are outside Git in
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ecmo-03-self-paced-2026-09-15/`
(`baseline/`, `iter1/`, `final/`, `model-replay-baseline.json`).

| Command                                                                                                                                                                                                                                       | Result                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline, before any edit (clean status and HEAD recorded): `node node_modules/jest/bin/jest.js --runInBand src/features/cardiohelp-ecmo 'src/app/\[locale\]/cardiohelp-ecmo' src/features/critical-care src/features/learning-module --json` | **112 suites (109 passed, 3 failed); 2,555 tests (2,552 passed, 3 failed, 0 pending).** Failures: `critical-care accessibility … readable without color` (CRRT image name), `curriculum-sequencing … CRRT cases in authored station order`, `learner-copy … static component copy` (MV/MCS/CRRT phrases) |
| Model replay (esbuild bundle of a scratch script, node)                                                                                                                                                                                       | Table above                                                                                                                                                                                                                                                                                              |
| `tsc --noEmit -p .` after the first edit set                                                                                                                                                                                                  | Exit 0                                                                                                                                                                                                                                                                                                   |
| `iter1`: ECMO module, ECMO routes and critical-care suites                                                                                                                                                                                    | 97 suites, 2,421 tests, 6 failed: the 3 baseline failures (identical messages) and 3 caused here — the four-class assertion, the VV series sentence, and digits added to story copy. Fixed as recorded above                                                                                             |
| New suites alone                                                                                                                                                                                                                              | 2 suites / 23 tests passed                                                                                                                                                                                                                                                                               |
| `final`: prettier `--write` on every changed file → ESLint `--max-warnings=0` on the 16 changed TS/TSX files → `tsc --noEmit` → the baseline jest command                                                                                     | Prettier exit 0; **ESLint exit 0**; **tsc exit 0**; **114 suites (111 passed, 3 failed); 2,578 tests (2,575 passed, 3 failed, 0 pending).** The same three failures with identical messages (ANSI and stack lines stripped); the only count changes are the two new suites (+5, +18)                     |
| `git diff --check`                                                                                                                                                                                                                            | Clean                                                                                                                                                                                                                                                                                                    |

Source documents were read with `pdfinfo` and `pdftotext -layout` at the pages in the queue, and the
Word file's `docProps/core.xml` and `docProps/app.xml` only.

### Genuine browser actions

Local dev server (`npm run dev:claude`, launch entry `claude-worktree`, this worktree, :3120), in-app
browser, unauthenticated. JavaScript only read DOM text and `localStorage`. `POST /api/analytics`
returned 500 because this worktree has no Supabase environment; no other request failed.

| Route                                                               | Action                                                                                            | Observed                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/en/cardiohelp-ecmo`                                               | Read the sources panel                                                                            | Badge "Unlisted draft · Clinical and device review: none recorded"; rows "IFU document check: 2026-09-15; currency not checked", "Publication: Unlisted draft", "Clinical and device review: None recorded"; five groups (3, 6, 4, 1, 1 records); IFU, curriculum and guideline rows show date, revision, check and review lines separately; no "approved", "reviewed release" or "review required" text |
| `/en/cardiohelp-ecmo/learn?track=vv&lesson=blood-flow-versus-sweep` | Opened the lesson                                                                                 | Console sweep boundary reads the new bound wording; "no plateau" appears nowhere on the page; stage footnote shows 8 date lines, 8 review lines and check lines without detail; storage holds only `selfPaced` visited topic and location                                                                                                                                                                |
| Same lesson                                                         | **Continue without doing this step** on step 1, then **Increase pump speed by 200 rpm** on step 2 | Step 2 shows the new saturation-ceiling note. The real run reported "Before / After / Change", modeled time 8 s → 20 s: speed 3200 → 3400 rpm, flow 4.05 → 4.30 L/min, PaCO₂ 46 → 46, pH 7.36 → 7.36, SpO₂ 96.9 → 97.8, labeled "Teaching comparison … not a CARDIOHELP hardware control" and "All values are simulated". The skip and the run left `localStorage` unchanged                             |

**Not seen in the browser:** the rewritten sweep-prediction explanation (ECMO-03-09, step 5) and the
VV series card and boundary (ECMO-03-10). The in-app browser pane was hidden: the step outline sat
outside its viewport at every emulated height, the in-step Continue control is re-rendered on each
step, and a `phase=predict` deep link reopens at the first task by design (ECMO-01). Those surfaces
are covered by the rendered and unit tests above only.

## Source, clinical and model holds

- **Faculty or device review required** for all ten items; none is reviewed or approved.
- **ECMO-03-02:** whether IFU revision 2.3 is the current U.S. revision; console paraphrases stay
  scoped to it.
- **ECMO-03-03:** the console's actual bubble size and pressure-drop alarm priority; neither is taught.
- **ECMO-03-04 / -06:** book edition and year; every guidance document's identity, currency and
  support for its registered statements; no recommendation strength is shown or claimed.
- **ECMO-03-05:** whether the case curriculum was reviewed; Practice cases citing it stay draft.
- **ECMO-03-07 / -08 / -10:** whether the straight-line-to-floor CO₂ curve, the linear-to-ceiling
  saturation response and the speed-driven recirculating share are fair teaching curves; any engine
  change needs its own reviewed task.
- **ECMO-03-09:** whether the section's prediction question earns its place beside the story problems,
  and whether the gas-path check is the intended reassessment.
- **Carried from ECMO-01/02:** emergency instructional order, air-resumption boundary and all existing
  draft labels (none of which is approval).
- No media changed.

## Legacy-progress implications

None. No storage key, writer, reducer, completion flag or analytics payload changed; source dates and
review lines are content, never persisted. The browser walk showed only the existing `selfPaced`
visit and location fields. Legacy root fields are untouched by this batch; the existing progress and
self-paced suites that cover them passed unchanged.

## Findings outside the batch (not changed)

- The shared critical-care device-profile record `cardiohelp-i-us-2025`
  (`src/features/critical-care/content/evidenceRegistry.ts`) still cites "Getinge … January 2025"; the
  ECMO device profile's `manufacturer: 'Getinge'` is not rendered. A serialized shared slice can align
  both with the printed manufacturer.
- Content copy defers to a "reviewed local process", "reviewed exchange process", "reviewed
  configuration strategy" or "approved local protocol": 49 phrase matches across `clinicalCases.ts`,
  `practiceSupport.ts`, `scenarios.ts`, `learnLessons.ts` and `learnPredictionItems.ts`. The phrases
  point learners to their own institution and claim no review of this module, but no local-policy
  source is registered. Next batch.
- Dormant `terminalRules` mastery and score strings and the unused recommendation helpers (see the
  question ledger).

## Checks not run

Full `npm test`; production build; Playwright; the sweep-prediction explanation and VV series panel in
a browser (see above); the Practice case source list in a browser; keyboard-only and screen-reader
passes; narrow or tablet widths; Safari or Firefox; es and zh-CN wording (English fallback only); authenticated sync or
remote analytics; learner observation; faculty or device review; any URL fetch, including ELSO
documents and current device labeling.

## Next slice

1. **ECMO faculty and device educator review of the queue**, starting with ECMO-03-07, -08 and -10
   (model bounds) and -02/-03 (labeling).
2. **Source acquisition by the owner:** the six ELSO and nomenclature documents, the book's edition and
   year, and any record of a curriculum review.
3. **Run the observation guide** with one to three volunteers and an ECMO educator.
4. **Serialized shared slice:** align the shared device-profile citation with the printed manufacturer.
5. **A later ECMO batch:** the local-protocol wording, and retiring the dormant mastery strings.

G02 was not started.

## Changed files

Module source:

- `src/features/cardiohelp-ecmo/content/sourceReviewMetadata.ts` (new)
- `src/features/cardiohelp-ecmo/content/evidence.ts`
- `src/features/cardiohelp-ecmo/content/evidenceResolver.ts`
- `src/features/cardiohelp-ecmo/content/storyProblems.ts`
- `src/features/cardiohelp-ecmo/content/ecmoValueGuides.ts`
- `src/features/cardiohelp-ecmo/content/foundationLearningItems.ts`
- `src/features/cardiohelp-ecmo/engine/types.ts` (source-class union only)
- `src/features/cardiohelp-ecmo/components/SourcesPanel.tsx`
- `src/features/cardiohelp-ecmo/components/evidence/EcmoCitation.tsx`
- `src/features/cardiohelp-ecmo/components/evidence/evidence.module.css`
- `src/features/cardiohelp-ecmo/components/CircuitAndMonitors.tsx`
- `src/features/cardiohelp-ecmo/components/teaching/BloodFlowVsSweepPanel.tsx`
- `src/features/cardiohelp-ecmo/components/teaching/VvSeriesPhysiologyPanel.tsx`

Tests:

- `src/features/cardiohelp-ecmo/__tests__/ecmo03-sources-and-model-range.test.tsx` (new)
- `src/features/cardiohelp-ecmo/__tests__/ecmo03-claim-review-queue.test.ts` (new)
- `src/features/cardiohelp-ecmo/__tests__/scenarios.evidence.test.ts`
- `src/features/cardiohelp-ecmo/__tests__/vv-foundation-lessons.test.tsx`

Documents:

- `docs/gap-remediation/self-paced/ECMO-03-handoff.md` (new)
- `docs/gap-remediation/self-paced/ECMO-03-claim-review-queue.json` (new)
- `docs/gap-remediation/self-paced/ECMO-03-observation-guide.md` (new)
- `docs/gap-remediation/self-paced/README.md`
- `docs/gap-remediation/self-paced/test-contracts.md`
- `docs/cardiohelp-ecmo/e5-model-limitations.md`
- `docs/cardiohelp-ecmo/flow-validation.md`
