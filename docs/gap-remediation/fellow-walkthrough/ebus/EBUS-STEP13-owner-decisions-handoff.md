# EBUS Step 13 — apply the recorded owner decisions

This is the bounded **apply-decisions** task from the Beta Finish-Line board. It applies only
OD-01, OD-03, OD-05, OD-06, OD-10, OD-11 and OD-12 from the merged owner worksheet. It does not
start Prompt 06, conduct new clinical/source/media review, merge, deploy, or mark any module ready.
All rollout stages remain `preview`. The glossary stays in this same PR: nine small content entries
and existing disclosures did not warrant a second runtime branch.

## Repository and authority

| Item                        | Exact record                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Starting/final fetched main | `b85da4a00fc1959ff9d5818d8a2b89d98d275723`                                                                                     |
| Implementation commit       | `7d13c13d1afacc9f5bf7aca6d7d9b4563d97c233`; the documentation commit follows it                                                |
| Branch                      | `codex/ebus-step13-owner-approved-20261007`                                                                                    |
| Isolated checkout           | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-ebus-step13-20261007`                             |
| PR #324                     | GitHub confirmed **MERGED**, `2026-10-07T01:28:23Z`; merge `24ce17bf6404af29cf3f3f025d39579762b3fe36`                          |
| Authority                   | [Merged owner worksheet](drafts/EBUS-PRE-REVIEW-05-owner-review-worksheet.md), owner decisions dated 2026-10-03 and 2026-10-04 |
| Scope records               | [Copy table](EBUS-STEP13-owner-decisions-copy-table.md), [status JSON](EBUS-STEP13-owner-decisions-status.json)                |

Read root/EBUS `AGENTS.md`, `CLAUDE.md`, local-authoring-assets map, the active self-paced
contract/checklist, EBUS implementation pack/common contract and coordination, its original
walkthrough rows, current 01–04 handoffs and scoped engineering acceptance, Prompt-05 packet,
drafts/manifest/worksheet, and beta-finish-line board. No repository `.agents/skills` directory was
present; applicable installed education/structured-module/handoff skills were read. The current
owner worksheet and explicit task override the packs' historical unreviewed statuses and the
skills' generic assessment rules. No other open EBUS runtime PR or newer overlapping main change
was found during the final remote-state check. Closed #316/#322 repairs were not reopened.

## Implemented dispositions and limits

| Decision | Implemented                                                                                                                                                                                       | Preserved / not authorized                                                                                                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-01    | Option A's exact R4 air-gap-versus-reflector mechanism comparison, options and rationales. Instructions say it is independent of which condition was held.                                        | `cutaway-observe`, key `b`, retained-acquisition policy, all five allowed hold conditions and evidence identity remain unchanged. New question ID or held-image policy remains a later decision; neither was selected here. No acquisition gate or condition-specific variants.                                                   |
| OD-03    | Exact protected-preparation / immediate pre-exposure target/live-image/vascular-path wording in lesson 20 and sequence explanation. The ordering prompt identifies the course's authored example. | **Wording only.** The first two steps, all sequence IDs and the accepted order are unchanged. Reversed order still differs from the authored example; feedback now carries the approved distinction without calling protected preparation unsafe. Alternate accepted sequences and optional technique additions have no approval. |
| OD-05    | Exact sector-plane, model image-right/head, processor caveat, and authored 0° axis wording in lesson 3.                                                                                           | Head/foot marker **HOLD**. No geometry, transform or Olympus/Fujifilm convention added.                                                                                                                                                                                                                                           |
| OD-06    | Exact D6 wide-window limitation in lessons 3/11. Exact educational-millimeter limitation in lessons 3/9/11 and their acquisition boundaries.                                                      | Existing model/phantom mm and recorded-video control practice retained. No clinical mm assignment, calibration, dimensions, sweep threshold, reference/difference feedback or expert overlay.                                                                                                                                     |
| OD-10    | Exact D10 fasting-required wording in lesson 2.                                                                                                                                                   | Generic antithrombotic/preparation guidance retained; no drug schedules, intervals, doses or institutional policy invented.                                                                                                                                                                                                       |
| OD-11    | Exact approved negative-systematic-examination/high-false-negative-risk guideline wording; D2 title and D3 year labels with stable source IDs; AABIP core reference listed for lessons 17/26.     | Existing CHEST/systematic-combined/device/preparation claims retained. AABIP is explicitly owner-approved scope / full text not independently verified; no new claim attributed to it. Source-check date unchanged; additions do not inherit that check. Fujiwara/CLNS/AQuIRE expansions remain held.                             |
| OD-12    | TNM, IASLC, NSCLC, PET, FNA, ERS/ESGE/ESTS, CHEST, IFU and descriptive CHS added to Overview, Help and relevant first uses.                                                                       | Original glossary entries unchanged. IFU has no manufacturer-specific interpretation. CHS uses ICS/IAB Table 5 descriptive wording; Fujiwara full-text hold appears beside it. External expansions have distinct provenance labels and no usage tracking.                                                                         |

OD-07, OD-08, OD-09, OD-13, OD-14, OD-15 and OD-16 remain **held with current behavior**. No
new imagery/annotation/storyboards, local emergency response, report/staging field, specimen-media
default, question-bank expansion or curriculum consolidation was implemented. None of these seven
worksheet groups explicitly requires additional learner-facing containment in this task.
OD-02's unlabeled vascular-flow task, OD-04A media attestation/OD-04B history hold, and
OD-17/OD-18 retain-current dispositions are preserved. Source-CT, image identity, unused/proposed
media and asset-specific de-identification limitations remain within their existing scope.

## Verification on the implementation commit

| Check                                                                          | Result and exact invocation                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host/route/state/evidence/content regressions and shared verdict compatibility | **267 passed / 17 suites**: `npx --no-install jest src/features/ebus-guided src/features/learning-module/components/__tests__/AnswerVerdict.test.tsx src/data/ebus-training.test.ts --runInBand`                                                                                                                                                                                                                                                                  |
| Failing-before approved-decision regressions                                   | The new five-test file, copied only into this task's detached base checkout, **5/5 failed as expected** against unchanged `b85da4a0` runtime. The same five pass on the implementation. No private inputs copied.                                                                                                                                                                                                                                                 |
| Embedded engine/legacy/EUS-B compatibility                                     | **384 passed / 41 files**: `npm --prefix EBUS-course/apps/web test`; `npm --prefix EBUS-course/apps/web run typecheck` **PASS**. No embedded source changed.                                                                                                                                                                                                                                                                                                      |
| Root typecheck                                                                 | **PASS**: `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`. Initial default-heap attempt exhausted memory; the explicit heap rerun passed.                                                                                                                                                                                                                                                                                                             |
| Full production build                                                          | **PASS**: `NODE_OPTIONS=--max-old-space-size=8192 npm run build`, including both training embeds, content, unchanged asset validations, webpack Next build and standalone preparation. Initial sandbox tsx IPC bind failure was rerun outside sandbox. Existing Contentlayer/Browserslist/Mermaid bundling warnings remain.                                                                                                                                       |
| Scoped lint and formatting                                                     | Explicit changed host/content/component/test/e2e paths: `npx --no-install eslint <changed TS/TSX paths>` and `npx --no-install prettier --check <changed TS/TSX paths>` **PASS**; `git diff --check` **PASS**.                                                                                                                                                                                                                                                    |
| Final production browser                                                       | **18/18 passed**, one worker, no retries: `EBUS_STEP13_BASE_URL=http://127.0.0.1:3148 EBUS_STEP13_OUTPUT=/tmp/ebus-step13-final-browser EBUS_STEP13_RESULTS=/tmp/ebus-step13-final-results.json npx --no-install playwright test --config artifacts/step13/playwright.config.ts e2e/ebus-owner-decisions-step13.spec.ts e2e/ebus-task-reveal.spec.ts e2e/ebus-recording-status.spec.ts`. Local config disables the normal dev webServer and sets headed Chromium. |
| Available beta-wrapper smoke                                                   | **2/2 passed** at 1440/390 widths on local dev port 3146, synthetic localhost-only auth cookie, real wrapper/course iframe. `node artifacts/step13/wrapper-smoke.cjs`. No report, draft or feedback saved. This is not real-account production wrapper verification.                                                                                                                                                                                              |
| Source/hold/scope comparison                                                   | Base/current content exports compared: **PASS**. All 26 lesson/question IDs, keys, unsafe flags, image policies, lab/transfer-lab predicates, sequence steps, cases/examination facts and original glossary entries unchanged. Existing source IDs/URLs/types/date unchanged except the two approved titles. Shared surfaces, engines/contracts, assets and rollout config have no diff.                                                                          |

Browser: **headed Chromium 151.0.7922.34, bundled revision 1234, macOS arm64**, disposable contexts.
Production server: `PORT=3148 HOSTNAME=127.0.0.1 node .next/standalone/server.js`. Dev auth and
synthetic Supabase values were process-only; production direct routes retain their existing public
unlisted access. No real account or stored credential was used. No media substitutions, API-success
mocks or bridge observations were injected. The two failure-path tests intentionally abort original
media/lookup requests and are counted separately from successful playback.

The changed-copy/glossary matrix covers 1707×900, 1440×900, 1246×1021, 1024×768, 390×844,
320×740, and 1024×768 with **200% CSS root text**; both site themes are asserted. The course's
existing feature-local palette is unchanged. This is not native browser zoom. Browser checks open
all approved glossary expansions by keyboard, show the CHS/IFU limits, and read changed briefing
copy and source notes. The actual contact workbench inspected five conditions, held **air gap**, and
kept that learner frame through the comparison, optional explanation, wrong/right response and
retry. Back shows the existing paused review response; restart/reload does not invent held evidence.

Original `Depth4.mp4` decoded at **1920×1080**. Real contrast and gain controls selected the existing
recording and produced a genuine held image. Changing gain alone still refuses the hold. A diagnostic
probe found gain 86 outside the accepted range after an initial keyboard-only harness attempt;
explicit native range input levels fixed the harness, without changing the acquisition predicates.
Earlier browser assertions incorrectly expected live held markup in paused review and a `status`
role on the host's reveal explanation; those assertions were corrected to the actual current contract.
The initial pre-review-04 failures asserted the superseded mismatch/excluded-glossary contract;
original-entry provenance and frame-preservation assertions remain, with new approved-scope checks.
Overlapping reruns are not added to the reported unique test count.

## Evidence and remaining work

Derived logs, final screenshots, base/current content exports, scope comparison and local harnesses
are saved outside Git at:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ebus-step13-2026-10-07/`

Inspected final production screenshots: 320-pixel expanded CHS/hold, 1024-pixel 200% text glossary,
1440-pixel mechanism review and the actual recorded held-image state. Original/current teaching,
source limits and keyboard focus remain readable. This is a scoped copy/behavior check, not a new
whole-module layout acceptance. No screenshots or private/raw inputs are committed.

Structured-module contract, within this task: H1–H3 **N/A** (no entry/architecture/stage migration);
H4–H5 **PASS** (real instructions/rendered copy); H6 **N/A** (no new completion mechanism);
H7 **PASS** under the owner's self-paced override; H8–H10 **PASS** (preserved engine/evidence/storage,
conventional approved copy); H11 **PASS** (scope/preview); H12 **PASS** for the exercised changed scope.
No whole-course H1–H12 compliance is claimed.

**NOT RUN:** Prompt 06 combined acceptance; full repository Jest/Playwright and unrelated board
baseline reds; real-account production beta-wrapper/report upload/storage/invitation flow; fresh
clinical/source/media reviews, device IFU or local-protocol adjudication; native zoom/DPR and
exhaustive camera matrix; real learner/faculty/technologist sessions. These are not passing checks.
No new clinical competence or release claim is made.

Next step: independent review of the bounded draft PR and its dispositions. Keep the PR draft/open;
only the owner may authorize merge or a later task. No automatic Prompt 06 follows this handoff.
