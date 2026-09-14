# G01 — CRRT source and clinical-review batch: handoff

Prompt: G01, v2 self-paced action pack (`Interventional-Pulm-Local-Data/roadmaps/IP-Education-Self-Paced-Action-Pack-v2/prompts/G01.md`), read in place. Prepared 2026-09-14 by an AI authoring assistant (Claude) at the owner's request. **Nothing here is clinical approval.** The reviewer queue holds no decision; every item is `NOT REVIEWED`.

## Repository reconciliation

- Worktree `claude-education-update-9-14`, branch `claude/g01-source-review`, created from `origin/main` at `dea4e80d` (PR #203 merged). Tree clean at start.
- Historical review baseline `9ef04539` (G00). G00's conversion map recorded the CRRT display offsets and model/protocol boundaries as "not independently verified" and carried CRRT-04 and CRRT-07 to G01. This batch checks the offsets against the registered manual; it does not rerun the external report.
- Codex was working on MV (`codex/mv02-peep-comparisons`), so MV was excluded; one writer per module.
- No dependency, backend, dashboard, storage, publication, release-state or remote-data change.

## Why CRRT, and what the other modules showed

Read-only structural surveys of the CRRT, EBUS, hemodynamics and ECMO source registries (identifiers and structure only) compared how each separates dates, classes sources, represents review and exposes sources to learners.

CRRT went first because CRRT-04 is the only G01-linked gap the adjudication marks as a potential clinical-content hold, and CRRT is the one module whose cited device manual is available locally with a registered hash, so its locations could actually be checked. The other findings are carried to the next slice below.

## Changed files

| File                                                                                                | Change                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/baxter-crrt/content/sourceReviewMetadata.ts` (new)                                    | Module-local adapter: source type, publication date and basis, revision, dated document checks (who, what, where recorded) and limitation for the seven batch records. Imports nothing. |
| `src/features/baxter-crrt/components/CrrtSourceDating.tsx` (new)                                    | Renders those fields on separate lines, plus "Clinical and device review: none recorded yet." Renders nothing for other sources.                                                        |
| `src/features/baxter-crrt/components/crrt-source-dating.module.css` (new), `baxter-crrt.module.css` | List spacing; hub cards match the list's size and colour to their paragraphs.                                                                                                           |
| `src/features/baxter-crrt/components/SourcesPanel.tsx`                                              | New hub section "Pressure calculations and citrate sources: dates, source type and checks". The TMP and filter-drop records were previously absent from the hub panel.                  |
| `src/features/baxter-crrt/components/CrrtFoundationLesson.tsx`                                      | Lesson "Explanation, sources and limits" list shows the dated lines.                                                                                                                    |
| `src/features/baxter-crrt/components/CrrtCitrateDifferential.tsx`                                   | "Sources for this explanation" shows the dated lines; the raw `Review: pending` enum is kept only for undated sources.                                                                  |
| `src/features/baxter-crrt/content/circuitModel.ts`                                                  | Filter-pressure-drop detail wording corrected (G01-CRRT-02).                                                                                                                            |
| `src/features/baxter-crrt/content/foundationLessons.ts`                                             | Pressure-sites teaching sentence corrected (G01-CRRT-03).                                                                                                                               |
| `src/features/baxter-crrt/content/provenance.ts`                                                    | DEV-PM-010 claim, formula note and limitation corrected.                                                                                                                                |
| `src/features/baxter-crrt/content/phase7ReviewSources.ts`                                           | DEV-PM-010 learner-facing claim corrected; nine simulated-value records relabelled from "v1 SME-review build".                                                                          |
| `src/features/baxter-crrt/content/citrateSources.ts`                                                | Reading dates and article type removed from citation text (now dated checks and source type).                                                                                           |
| `src/features/baxter-crrt/engine/pressureModel.ts`                                                  | Comments only. Constants and arithmetic unchanged.                                                                                                                                      |
| `src/features/baxter-crrt/components/BaxterCrrtModuleFrame.tsx`                                     | "Reviewed-English fallback" → "English fallback".                                                                                                                                       |
| `src/features/baxter-crrt/__tests__/sourceReviewMetadata.test.tsx` (new)                            | 6 tests.                                                                                                                                                                                |
| `src/features/baxter-crrt/__tests__/g01SourceReviewQueue.test.ts` (new)                             | 5 tests.                                                                                                                                                                                |
| `src/features/baxter-crrt/__tests__/scaffold.test.tsx`                                              | Fallback-label assertion updated.                                                                                                                                                       |
| `docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json` (new)                           | The reviewer queue.                                                                                                                                                                     |
| `docs/baxter-crrt/live-pressure-profile.md`                                                         | Dated note on the filter-drop finding.                                                                                                                                                  |
| `docs/gap-remediation/self-paced/README.md`, this file                                              | Index and handoff.                                                                                                                                                                      |

## Source finding that drove the wording change

The local PrisMax manual (`device-manuals/critical-care/708933961-Prismax-Operator-s-Manual (1).pdf`) matches the registered SHA-256 (`204543b8…`), has 353 pages, and every checked footer reads `AW8035 Rev B JUN2019` / `Program version: 2.XX`.

- **TMP (MATH-PM-002), PDF p218:** the printed expression includes the −18 mmHg term exactly as the module implements it.
- **Filter pressure drop (DEV-PM-010), PDF pp202–203:** the printed expression is `ΔPfil = Pfil − Pret`. The following paragraph says the filter and return pressure _readings_ are automatically corrected for a −25 mmHg sensor-height bias. No −25 mmHg term is printed in the drop. The model applies −25 mmHg to the drop, and learner copy presented that as the manual's display arithmetic.

This is not settled here: it depends on console behaviour a device reviewer must confirm. The response is a narrow hold. Learner wording now says what the manual prints and what the simulation does, and that the placement awaits device review. The simulated numbers, the derivation label on the circuit diagram and the tests pinning them are unchanged. Record DEV-PF-005 (Prismaflex manual, not available locally) describes a displayed corrected drop, which may explain the model's choice.

## Behavior: old → new

| Surface                                           | Before                                                                                    | After                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub evidence panel                                | Omitted MATH-PM-002, DEV-PM-010 and all citrate records; no dates beyond identity strings | New section lists all seven batch records with source type, publication date, revision, each document check and "Clinical and device review: none recorded yet." Always available on the hub; no lesson, answer or case state involved |
| Lesson source lists                               | One line mixing citation, revision and (citrate) reading date                             | Citation line plus separate type/date/check/limit lines for batch sources                                                                                                                                                              |
| Citrate comparison sources                        | "… passages read 2026-09-13. … Review: pending."                                          | Citation line plus separate lines; reading date is a dated check with the reader recorded as unknown                                                                                                                                   |
| Filter-drop detail and Foundation sentence        | Stated "displayed filter drop = filter − return −25 mmHg" as the manual's arithmetic      | States the printed expression, the manual's correction of the readings, and that the simulation's placement awaits device review                                                                                                       |
| Non-English routes                                | "Reviewed-English fallback"                                                               | "English fallback"                                                                                                                                                                                                                     |
| Simulated-value source version text               | "v1 SME-review build"                                                                     | "v1 authored teaching calibration · no clinical review recorded"                                                                                                                                                                       |
| Calculations, alarms, scenarios, progress, access | —                                                                                         | Unchanged                                                                                                                                                                                                                              |

## Reviewer queue

[`G01-crrt-source-review-queue.json`](G01-crrt-source-review-queue.json) holds ten items, each with exact learner wording (and previous wording where changed), visual, intended teaching point, source records and document, supporting location, what the assistant checked and did not check, limitation, the clinical decision needed, the hold, the change in this batch, content version, and an empty reviewer decision (`NOT REVIEWED`, reviewer/role/date/version all `null`).

| ID          | Topic                                                  | Gap     | Hold / change                                                                         |
| ----------- | ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------- |
| G01-CRRT-01 | Displayed TMP expression                               | CRRT-04 | Location matches; dated in hub; wording unchanged                                     |
| G01-CRRT-02 | Filter pressure drop −25 mmHg correction               | CRRT-04 | **Narrow hold** on where the correction applies; wording corrected; numbers unchanged |
| G01-CRRT-03 | Foundation sentence stating both expressions           | CRRT-04 | Wording corrected; shares 02's hold                                                   |
| G01-CRRT-04 | Manual identity and currency (program 2.XX)            | CRRT-04 | Display claims stay scoped to 2.XX                                                    |
| G01-CRRT-05 | SIAARTI-SIN citrate expert opinion                     | CRRT-07 | Type and dates separated; passages not re-read                                        |
| G01-CRRT-06 | Schneider 2017 citrate viewpoint                       | CRRT-07 | Type and dates separated; passages not re-read                                        |
| G01-CRRT-07 | 2026 ICU RRT guideline for citrate monitoring          | CRRT-07 | Strength/certainty not recorded; not shown                                            |
| G01-CRRT-08 | Unregistered KDIGO link ("chapter 5.2", different URL) | —       | Hold; unchanged                                                                       |
| G01-CRRT-09 | Prismaflex transfer note with no source                | —       | Hold; unchanged                                                                       |
| G01-CRRT-10 | Labels implying completed review                       | —       | Two labels renamed; "Reviewed release" (unreachable at unlisted-preview) unchanged    |

The queue is plain JSON. Its test enforces only honesty: a decision is either explicitly absent or has a named, non-AI reviewer, role, date and reviewed version; cited records resolve; and each quoted surface still exists at the current content version, so a wording change re-opens review.

## Test-contract migration

| Old assertion                                                          | Why it changed                                                            | New assertion                                      | Invariant kept                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| `scaffold.test.tsx`: non-English hub shows "Reviewed-English fallback" | No review of the English content is recorded; G01 forbids implying review | Shows "English fallback" and no "Reviewed-English" | Fallback note still rendered; English still stated as authoritative |

Added: `sourceReviewMetadata.test.tsx` and `g01SourceReviewQueue.test.ts`. No test was removed, weakened or skipped. The offset-pinning tests (`circuitModel.test.ts` formula constants, `CrrtPilotCircuit.test.tsx` derivation labels, `engine/__tests__/pressureModel.test.ts` values, `CrrtLivePressureDevice.test.tsx` no-restated-offset, `numericAudit.test.ts` double-correction) pass unchanged, because the calculation is unchanged pending the device decision.

## Executed evidence

### Commands and results

| Command                                                                                                                                                                                                                                                | Result                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/baxter-crrt 'src/app/\[locale\]/baxter-crrt'` on base `dea4e80d` (temporary detached worktree, since removed)                                                                                                                   | 57 suites, 584 tests passed                                                                                                                                                                                                                                                                                                                          |
| Same on this branch                                                                                                                                                                                                                                    | 59 suites, 595 tests passed (+2 suites, +11 tests, all new)                                                                                                                                                                                                                                                                                          |
| `npm run type-check`                                                                                                                                                                                                                                   | Passed (exit 0)                                                                                                                                                                                                                                                                                                                                      |
| `npx eslint` on changed TS/TSX                                                                                                                                                                                                                         | No findings                                                                                                                                                                                                                                                                                                                                          |
| `npx prettier --check` on changed files                                                                                                                                                                                                                | Clean after formatting `sourceReviewMetadata.ts`                                                                                                                                                                                                                                                                                                     |
| `npx jest src/features/critical-care/__tests__/{learner-copy,accessibility,catalogs,release-boundary,curriculum-sequencing}.test.* …/hub-pathway-start-alignment.test.ts src/features/learning-module/__tests__/criticalCareShellConvergence.test.tsx` | 2 failures, both **pre-existing**: they fail identically on base `dea4e80d` (2 failed, 20 passed there). The learner-copy finding list (63 lines: existing CRRT, ECMO and MCS component copy) is byte-identical between base and branch. The accessibility failure is an existing CRRT circuit image name not touched here. Not fixed in this batch. |

An earlier baseline run in this session used an unquoted route pattern (55 suites, 576 tests); the like-for-like comparison above supersedes it.

### Genuine browser actions (in-app browser, this worktree's dev server on :3126)

Clicks were dispatched to the rendered buttons by script in the page; screenshots were taken with the in-app browser.

| Route                                                 | Action                                                                                                                                                                                | Observed                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/en/baxter-crrt` (200)                               | Opened "Pressure calculations and citrate sources: dates, source type and checks (7)"                                                                                                 | Seven dated records. DEV-PM-010 shows type, "Published: June 2019", revision, the 2026-07-27 check "(checker not recorded)", the 2026-09-14 PDF p203 check, limit and "Clinical and device review: none recorded yet." The list's computed font size and colour match the card paragraphs (13.12px). |
| `/es/baxter-crrt`                                     | Read the language note                                                                                                                                                                | "English fallback"; no "Reviewed-English" anywhere; the dated section is present.                                                                                                                                                                                                                    |
| `/en/baxter-crrt/learn?lesson=crrt-circuit-pressures` | Opened "Explanation, sources and limits"; worked through task 1 (six stops in order) and task 2 (five fluid paths); continued to task 3 "Four sites and two calculated relationships" | Lesson sources show dated lines for MATH-PM-002 and DEV-PM-010. Task 3 renders the corrected sentence verbatim; the old "displayed filter drop = filter − return" sentence is absent.                                                                                                                |
| `/en/baxter-crrt/learn?lesson=crrt-anticoagulation`   | Opened the lesson source list; continued once                                                                                                                                         | All five citrate records show dated lines; "passages read" appears nowhere on the page. The reached task's "Sources for this explanation" shows the renamed simulated-value label with "Review: pending" for that undated source.                                                                    |

**Not seen in the browser:** the citrate comparison's own "Sources for this explanation" with dated citrate sources. The task that mounts it ("Compare four physiological patterns") is disabled until earlier tasks are worked through (see CRRT-01 note below). That path is covered by type-check and code reading only.

The dev server logs a Supabase "URL and Key are required" error and a 500 for `/en`, because this worktree has no `.env.local`. The CRRT routes returned 200. No authentication-dependent behaviour was exercised.

## Source, clinical and media holds

- **G01-CRRT-02 (device):** where the −25 mmHg correction belongs; simulated numbers and diagram label unchanged until decided.
- **G01-CRRT-04 (currency):** all device display claims describe program version 2.XX only; no newer manual available.
- **G01-CRRT-05 to 07 (clinical):** citrate passages were not re-read; whether they support their statements, and the guideline's recommendation strength, need faculty.
- **G01-CRRT-08, 09:** unregistered KDIGO citation; unsourced Prismaflex comparison.
- No media, rights or deidentification changes.

## Legacy-progress implications

None. No storage key, progress writer, reducer, completion flag or analytics payload was touched. Legacy records are unaffected and nothing new is written.

## Question ledger

No question, prediction or check is in this batch's scope. None was kept, rewritten, replaced, combined or removed. CRRT question dispositions remain with CRRT-01 to CRRT-03 and the G00 sample ledger.

## Checks not run / limits

- No clinical or device review; no reviewer contacted. The queue contains no decision.
- The citrate publications, KDIGO guideline, Prismaflex manual and PrisMax specification sheet were not available; no URL was fetched.
- No later PrisMax manual or console was checked.
- CRRT Playwright end-to-end specs, screen-reader and narrow-layout checks were not run.
- The new dated lines are English-only; CRRT shows the English fallback on es/zh routes.
- The two pre-existing critical-care test failures remain.
- The citrate comparison's own dated source list was not seen in the browser (task locked); no component test renders it with a dated source.
- **Observed for CRRT-01, not changed:** CRRT Learn disables lesson tasks that have not been reached, so task-level teaching waits on earlier tasks. Lesson-level and hub sources stay reachable, which is what G01 requires; the task lock itself is a self-paced navigation question for CRRT-01.

## Findings for the next G01 slices (from the structural surveys; not changed here)

- **ECMO:** the hub sources panel would print "PUBLISHED · REVIEW APPROVED" from a two-value publication flag with no review record; "reviewed local process/protocol" wording has no local-policy source; a supplied case curriculum is classed as an educational model with an unattributed "reviewed" date; in Learn, what each source supports and its limits stay hidden until a prediction is committed, and Practice case sources appear only after the debrief — a direct G01 reachability gap. Local PDF metadata can date the textbook records; the IFU revision label needs human confirmation.
- **Hemodynamics:** the source `version` field mixes internal revisions (`<year>.1`), capture dates, editions, a document number and the module version, and learners see it as "version …"; supplied notes and a published chapter share one class label; the shared critical-care activity default `sme-review` marks all hemodynamics activities competency-eligible while 17 of 18 Learn items are draft (shared file, serialize with owner).
- **EBUS:** all 89 citations are whole-source with no locator; one global "checked" date; seven cited guideline documents absent locally, so strength claims need faculty-supplied sources.
- **Bronchoscopy Foundations (BF-01):** keeps `year` and `accessedDate` apart in its manifest but does not display the accessed date; each source's "Used for" and "Limit" lines are hidden while a prediction is pending.

## Next slice

1. Owner/device educator decision on G01-CRRT-02, then either keep the model and restore stronger wording, or change `engine/pressureModel.ts`, the derivation label and the pinned pressure tests together.
2. ECMO G01 batch (reachability of limits and Practice sources, review-approved literal, local-policy and curriculum classes), sequenced with ECMO-01.
3. CRRT-02/03 worked-case review using this queue format; register the KDIGO citation once faculty name the section.
