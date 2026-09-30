# EBUS: scoped combined engineering acceptance and task-reveal repair

This is a bounded engineering pass across the merged EBUS batches, plus one local repair.
It is **not whole-module acceptance**, clinical/anatomical approval, media permission, a real
learner session, or permission to release. Remaining verification is explicit below.

## Current baseline and ownership

- Tested baseline: `46c5bb94f779a1464da6198bba4bcf8550379419` from a fresh origin fetch.
- Isolated branch: `codex/ebus-combined-acceptance-20260930`.
- Worktree: `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-ebus-combined-acceptance-20260930`.
- Local preview: port **3118**; separate visible Chromium profile created by Playwright.
  No owner browser profile, saved owner progress, `.env.local`, remote data or settings were used.
- Live GitHub checks confirmed #249, #251, #261, #269, #278, #281 and #285 merged. The 22 current
  open PRs have no EBUS runtime overlap. #134 affects the shared verdict/stage and #308 the site
  theme; neither open head was incorporated or edited. Their eventual merges require affected
  compatibility checks, not a repeat of unrelated clinical reviews.
- The three remaining Claude EBUS worktrees were clean; allowed process/cwd checks found no
  active EBUS writer. Primary main and every other checkout were left alone.
- HD `b496d530` under review, HD `11d7c6fb`, CRRT `fb6f3910`, ECMO `046ae64a`/`43d71902`,
  Device Intelligence, Literature and the held Wolf stack were untouched.

Read root and embedded `AGENTS.md`, root `CLAUDE.md`, local-authoring rules, the active
`docs/gap-remediation/self-paced/README.md`, EBUS roadmap 00/06, owner decisions, coordination,
source walkthrough/ledger and merged batch status/handoff evidence. Current user authorization
allows a bounded reproduced engineering repair and forbids the roadmap's proposed PR publication.
The self-paced policy governs optional answers and navigation; simulator/acquisition protections
and intentional examination drafts remain separate.

## The one repair

On current main, clicking **Show the matches** updates the host's task outcome to `shown`.
That makes `taskOpen` false, immediately unmounting the matching component and its newly revealed
pairings. Only a general explanation remains. **Show the sequence** has the same host mechanism.
Standalone component tests pass while the integration loses the requested answer.

The local runtime change is only in `LessonHost.tsx`: when the existing outcome is `shown`, render
the existing authored pairs as a read-only definition list, or the existing authored steps as an
ordered list. These survive same-session return to the task and clear on Restart lesson. Existing
question availability, source explanations, outcomes, navigation and persistence are unchanged.
No new state, schema, grade, gate, answer key, clinical text, geometry, evidence or acquisition is
introduced. Completed/skipped tasks retain their existing behavior.

Two new real-host component regressions fail on the unchanged baseline; six browser regressions
pass after repair. The browser tests use native navigation/reveal/return/restart at 1246×1021,
390×844, and 1024×768 with **200% root text**, verifying every existing pairing/ordered step and
the absence of interactive controls in the revealed reference. This implements the self-paced
answer-access contract without reinstating the old reveal gates proposed by the walkthrough.

The final presentation refinement groups each cue/response pair, emphasizes the cue and keeps
sequence numbers inside the reference panel. The same two focused regressions and six browser
journeys passed again on that final markup. The focused Jest selection skipped 12 unrelated tests;
those skips are not added to the pass count. The 258-test full host/verdict run preceded this small
reference-only formatting change. Screenshot visibility is not whole-page or physical-device
usability acceptance; the existing sticky lesson chrome remains outside this repair.

## Actual coverage and results

| Coverage                                       | Actual result and limits                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EBUS host plus shared verdict tests            | Baseline **256 passed / 15 suites**; final repair **258 passed / 15 suites**. Includes progress/legacy compatibility, examination, evidence, bridge, workbench, safety and batches 01–04. No mocks are counted as genuine browser acquisitions.                                                                                                                         |
| Embedded guided tests                          | **47 passed / 8 files**; guided camera, labels, acquisition windows, recorded-frame regions and sweep helpers. This is not the entire embedded application's test suite.                                                                                                                                                                                                |
| Embedded TypeScript and production embed build | Both exit **0**. Generated embedded bundle/media are built from this checkout; no previous dist or substitute media used.                                                                                                                                                                                                                                               |
| All current lesson entries                     | **26** direct Learn entry routes plus unknown-section fallback rendered at 1246×1021, with no page errors. This checks entry, not every deep state.                                                                                                                                                                                                                     |
| Learn feedback and interruption                | Native unsafe choice, truthful alert, available retry/Continue, retry and reload-to-first-task passed. No response was restored.                                                                                                                                                                                                                                        |
| Practice                                       | Leave before answering, wrong feedback/keyed comparison, retry to a keyed answer, persistent supplied CT across checks, active Practice exit, reopen with empty responses, skipped debrief and return passed. No legacy graded record written in the isolated profile.                                                                                                  |
| Integrated case                                | Authored case deep link, mid-case exit, reload-to-check-1, skipped debrief, active Cases exit and browser Back passed. No completed progress was seeded.                                                                                                                                                                                                                |
| Intentional examination draft                  | Native authored-case field edits survived reload with **identical stored bytes** and the earlier-session/not-new-acquisition notice. No patient information or fabricated acquisition was entered.                                                                                                                                                                      |
| Original H.264 acquisition                     | Visible Chromium decoded the actual MP4, native depth control changed the real frame, comparison/hold acknowledgement produced a held image, review controls paused, reload cleared held state, and skipping a new acquisition left interpretation unavailable while explanation/Continue remained available. No bridge observation injected and no codec substitution. |
| Recording failure states                       | Two existing deliberate resource-abort tests passed: lookup/clip failure ends busy status and keeps hold unavailable. These are labeled failure injection, not successful media playback.                                                                                                                                                                               |
| Existing anatomy/sweep spec                    | **8/9 tests passed** (one is a pure reset-event helper; seven are browser journeys). The column-stability test failed and failed again in a matched diagnostic; see below. No model repair made.                                                                                                                                                                        |
| Mobile/text and beta wrapper                   | Native Help open/close/keyboard return, entry-to-matching at 1440×900, 1024×768/200% root text, 390×844 and 320×740, plus the local beta iframe entry passed after waiting for dialog state to settle. No feedback was submitted.                                                                                                                                       |
| New reveal/revisit/restart browser regressions | **6/6 passed** on repaired source. This is focused repair evidence, not six additional curriculum acceptances.                                                                                                                                                                                                                                                          |
| Scoped ESLint, Prettier and diff check         | Passed for the three changed runtime/test paths. Normal commit hooks also run.                                                                                                                                                                                                                                                                                          |

Do not sum repeated runs as unique successes. The initial 19-test combined browser run had
**13 passes and 6 failures**. One failure revealed the disappearing answers. Practice/Cases helpers
used overly strict accessible-name selectors; the corrected native active-tab selectors passed.
Other helpers needed actual control readiness, ArrowLeft events, settled dialog state, and a
review-control assertion rather than a capture-only caption. These corrections changed only the
local harness. Their original failures remain in the evidence. The anatomy-column failure remains
unresolved; it is not relabeled as a pass.

## Remaining engineering finding

Existing `e2e/ebus-anatomy-sweep.spec.ts` test **“lesson 3 markers keep their column across rotation…”**
fails at the before/after `sideOf()` comparison: marker **C** starts in the left label column and
ends in the right after the native roll sequence **40 → 0 → −40 → −85**. The same failure occurred
in the initial baseline run and a matched one-test confirmation. The letters remain present; this
evidence does not establish a wrong anatomical identity, a lost control, or clinical invalidity.

Classify this as an **important unresolved engineering/verification finding**, not a clinical or
release judgment based on column movement alone. The remainder of this individual test, including
its later hover/reference assertions, was not reached. Separate keyboard/highlight and other
model/sweep tests did run. An independent Astra High read-only diagnosis of layout/camera readiness
and the column contract is the proportionate next step; do not recalibrate anatomy to force the
assertion green. It is outside the completed reveal repair.

## Unperformed acceptance and owner gates

- Full Next.js production/standalone build and full-repository type-check were **not run**.
  The host was Next dev with a fresh production embedded Vite bundle. This does not satisfy the
  roadmap's full production acceptance requirement. Unrelated root public/3D assets are sparse.
- Not every lesson interaction, camera/control combination, model measurement dimension,
  needle/acquisition deep state, specimen/report field, locale or recording was exercised in the
  browser. Existing focused unit and historical batch evidence do not turn those into fresh passes.
- No native browser zoom, physical phone, Safari/Firefox, screen reader or real learner/faculty/
  technologist session. Root-text enlargement is not native browser zoom.
- An administrative index retains **all 182 unique source IDs**, roadmap lanes and attributed
  historical dispositions. No claim that all 182 observations were individually accepted or newly
  reproduced. Unmapped/partly held source rows remain explicit. Full final disposition work is
  still required for whole-module acceptance.
- #281/#285 merge receipts establish the existing redaction/versioning work is incorporated;
  no new media/redaction review was performed. Rights/provenance, reuse/de-identification approval
  and any historical-Git-blob policy remain owner-only. Repository availability is not permission.
- Owner choices remain: difficult image identity/purpose and expert annotations; orientation/model
  limitations; control-only versus expert-calibrated measurement teaching; clinical/protocol draft
  additions; report/staging/pathology meanings; selected storyboards/consolidation; and release/media
  scope. The merged #278 draft packet's source-verification evidence supplements the older roadmap
  claim but does not make draft questions clinically reviewed. No NOT REVIEWED item was approved.

## Exact evidence and review handoff

Local evidence:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ebus-combined-engineering-acceptance-20260930/`

Includes live 22-PR inventory, baseline/final test logs, fresh embedded build logs, the expected
reveal regression failures, initial browser failures, corrected harness/results, six committed
browser regression screenshots, actual H.264 decoder metadata, the repeat label-column failure,
and `source-status-index.json`. Original roadmap/source content remains outside Git.

Review the EBUS-only runtime diff and rerun:

```sh
node node_modules/jest/bin/jest.js --runInBand \
  src/features/ebus-guided \
  src/features/learning-module/components/__tests__/AnswerVerdict.test.tsx
```

Run `e2e/ebus-task-reveal.spec.ts` against an authenticated isolated preview using
`EBUS_E2E_TOKEN_FILE` when local-dev authentication is needed. The evidence includes the temporary
Playwright config/harness. Dependencies were linked transiently to existing installs; no lockfile
changed. The preview is stopped and ephemeral credentials/dependency links removed at handoff.

The **authored-answer visibility repair is ready for independent engineering review**. The scoped
combined pass remains incomplete for whole-module acceptance. No push, PR publication, merge,
deployment, release approval, new services or owner-only action occurred.
