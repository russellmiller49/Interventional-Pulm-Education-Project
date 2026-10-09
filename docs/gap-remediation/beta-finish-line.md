# Beta finish line — status board and work orders

Written 2026-10-06 against `origin/main` `15c52445`. This is a working map for the Claude and Codex
lanes and for the owner. It is not clinical approval, module acceptance or release authorization,
and it changes no release-stage constant. The module packs in Local-Data
`module_update_9_19/` remain the authority for each prompt; this file records where each module
stands against them, what was decided on 2026-10-06, and the order of the remaining work.

Refresh PR state (`gh pr list`) and `origin/main` before acting on any row; an open PR is occupied
work.

## 1. What "finished" means here

Every pack ends the same way: runtime batches 01–04 → one independent, read-only combined
acceptance (Prompt 06) → the owner's own review → external beta. Acceptance is technical. Clinical,
model, device and source holds may remain, provided the application does not present an unreviewed
outcome as supported and each hold is visible to the learner rather than recorded only in a
handoff.

The development-beta hub already runs in server mode on production and a few people use it.
Opening it to fellows is therefore not an access change. Access to every module stays as it is; the
owner decides later whether to pull any module before the first invitation.

### Owner decisions recorded 2026-10-06

| Topic                          | Decision                                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bar for outside reviewers      | Prompt 06 with no technical blockers, every remaining hold listed in a tester note, fact-level items decided, owner walkthrough done.                             |
| Rollout                        | Staged: each module is marked ready as it clears. Nothing is hidden.                                                                                              |
| First reviewers                | Fellows. Their round is feedback only; it does not sign off the PI-02 or BF-03 usability plans or the human gates in `docs/critical-care/testing-and-release.md`. |
| Hub modules with no pack       | One light readiness pass each.                                                                                                                                    |
| ICU Hemodynamics batch 03      | PR #326 with a repair pass; PR #321 is closed once #326 merges.                                                                                                   |
| Branch Tracing magnifier       | Saved views accept 4×.                                                                                                                                            |
| Shared feedback card           | One bounded PR to `ChoiceReasoningFeedback.tsx` is authorized (SHARED-FEEDBACK-02). No other shared file.                                                         |
| Parallel work                  | Three runtime lanes at a time. Read-only acceptance, re-reviews and docs-only packets do not count.                                                               |
| Live checks before invitations | Run by the owner with a second, non-admin account.                                                                                                                |

## 2. The gate

**Before a module is marked ready**

1. Its runtime batches and any repair named in section 7 are merged.
2. Prompt 06 has run once on a recorded `main` SHA, in a fresh session that did not implement the
   module, with zero technical blockers — or one consolidated repair has merged and that scope was
   re-tested. Modules with no pack: the light readiness pass instead.
3. Every remaining clinical, model, device or source hold is listed in the module's tester note.
   A label inside the module is required only where a learner could take a wrong clinical action
   because of the hold. Review status is never shown to learners (owner direction 2026-10-08,
   `docs/teaching-first-rules.md`). A hold missing from the tester note blocks marking the module
   ready.
4. The owner has decided that module's fact-level items (section 9) and walked it.

**Before anyone is invited to it**

5. The owner's live check with a non-admin account passes (section 8).

## 3. Status board

| Module                    | Merged                                                                         | Open PR                           | Needed before acceptance                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| EBUS Guided               | 01–05 (#249, #251, #261, #269, #278); a scoped engineering pass, not Prompt 06 | #324 owner worksheet              | The seven decided-but-unimplemented items applied (OD-01, 03, 05, 06, 10, 11, 12)                           |
| Peripheral Imaging        | 01–04 (#248, #253, #262, #265 and #279)                                        | #320 platform and wrapper         | #320 re-reviewed at its final head and merged                                                               |
| Branch Tracing            | 01–04 (#250, #252, #260, #273)                                                 | #329 decision packet              | Magnifier fix; owner decision OD-01                                                                         |
| MCS                       | 01–04 (#256, #264, #284, #325)                                                 | #332 decision packet              | Shared feedback card fix; CAP-LVAD-01 stem; the nine learner-copy guard lines                               |
| ECMO                      | 01–04 (#255, #267, #277, #315 and #327)                                        | —                                 | Shared feedback card fix on `main` (its Prompt 06 names it as a precondition); decision packet alongside    |
| CRRT                      | 01–05 (#257, #263, #268, #275, #276); Prompt 06 verdict NOT READY (#323)       | #334, which contains #333         | #334 merged; Repair B for F06-R04 and F06-R05; bounded re-acceptance                                        |
| Bronchoscopy Foundations  | 01–03 (#254, #274, #291)                                                       | —                                 | Batch 04 (16 findings, two of them P1, and the survey-to-report path); the 3D-retry defect; decision packet |
| Mechanical Ventilation    | 01–03 (#259, #271, #290)                                                       | —                                 | Batch 04 (30 of the 64 findings); a wide-window layout pass; decision packet                                |
| ICU Hemodynamics          | 01–02 (#258, #266) and part of 03 (#314)                                       | #326 and #321, mutually exclusive | #326 repaired and re-reviewed; the 16 red browser journeys; batch 04 (34 findings); decision packet         |
| EUS-B Simulator           | #330                                                                           | —                                 | Feedback migration applied; light readiness pass                                                            |
| Synchronized Bronchoscopy | —                                                                              | —                                 | Route fix (H-1); light readiness pass. The page carries no limitation label today                           |
| Live Bronchoscopy Anatomy | —                                                                              | —                                 | Route fix (H-1); light readiness pass                                                                       |
| Device Atlas              | —                                                                              | —                                 | Light readiness pass. Opens on production today                                                             |

Notes:

- `codex/bf-04`, `codex/bf-05` and `codex/mv-04` hold no work; each sits on a merge commit of
  `main`.
- Every owner decision in every packet is NOT REVIEWED except EBUS (11 of 18 groups decided
  2026-10-03 and 10-04, recorded on #324) and Peripheral Imaging OD4-01 to OD4-12.
- #334 is #333 plus the two fixes its own review required. That review says #333 unchanged is not
  ready to merge.
- The status fields in the HD-01, HD-02, BBT-04 and BF-01 to BF-03 status files still say "open" or
  "not merged"; the PRs are merged.

## 4. Hub findings

Verified 2026-10-06 against the live site and `main`.

| ID  | Finding                                                                                                                         | Evidence                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-1 | Synchronized Bronchoscopy and Live Bronchoscopy Anatomy return 404 to every non-admin.                                          | Live site: 404 for `/en/learn/anatomy/airway` and `/en/intro-bronchoscopy/airway-anatomy`; 200 for the other 44 static hub routes. Both layouts call `assertDraftModulesEnabled()` unconditionally. A development server always enables drafts, so the hub tests cannot see it. Their assets are served on production. |
| H-2 | EUS-B feedback cannot be saved.                                                                                                 | `20261004072344_add_eus_b_simulator_to_module_beta_feedback.sql` is not in the main-site project's applied migrations. The primary checkout is behind `main` and does not have the file yet.                                                                                                                           |
| H-3 | A signed-in learner's critical-care progress read fails, silently.                                                              | The read schema uses `z.string().datetime()`, which rejects the `+00:00` form the database returns; the client treats the failure as "no account progress". The repair exists only in stale PR #134.                                                                                                                   |
| H-4 | A browser that refuses storage gets a blank site.                                                                               | PR #308, open since 2026-09-29.                                                                                                                                                                                                                                                                                        |
| H-5 | The wrapper repair is unmerged, and its third repair (`879dd053`) was pushed after the last independent run found two failures. | PR #320. No re-review of head `fc4ef8ee` is on record.                                                                                                                                                                                                                                                                 |
| H-6 | No CI runs tests. `main` carries the baseline reds in section 10.                                                               | `.github/workflows/` holds one no-op workflow.                                                                                                                                                                                                                                                                         |
| H-7 | The hub gives a tester no orientation: no description, time, focus or known limits for a module.                                | `src/app/[locale]/development-beta/page.tsx`.                                                                                                                                                                                                                                                                          |
| H-8 | PR #134 is 667 commits behind and conflicting, and edits shared-stage and ECMO-local files that later work deliberately kept.   | `gh pr view 134`.                                                                                                                                                                                                                                                                                                      |
| H-9 | The independent review of #326 was never posted or committed.                                                                   | Preserved in Local-Data `renders/output/hd326-sanity-review-2026-10-04/`. Verdict NOT READY TO MERGE: 16 closed, 6 acceptable partial, 2 correctly held, 3 blocking (L2-06, L5-05, P-03).                                                                                                                              |

## 5. Sequencing rules

- **Three runtime lanes at a time.** This waives the packs' default of two. A lane is free when its
  PR is open and waiting on review. One runtime lane per module. The other agent does the sanity
  review. Nobody works on, rebases or merges the other agent's branch.
- **Shared changes land first:** #320, SHARED-FEEDBACK-02 and the hub PRs. After that the shared
  surfaces are frozen — `src/features/module-beta/**`, `src/features/learning-module/**` and the
  site header and footer. A later change to any of them re-runs the route and wrapper smoke for
  every module already accepted.
- **Acceptance SHAs.** The coordination documents ask for one common SHA for the Peripheral
  Imaging, EBUS, Branch Tracing and Foundations acceptances. Under the staged rollout each
  acceptance records its own SHA instead; the freeze above is what keeps the shared surfaces equal
  across them.
- Each runtime PR stops at the open PR. Only the owner merges.

## 6. Owner queue

1. Dispatch an independent re-review of #320 at `fc4ef8ee`. Six of the nine acceptance prompts
   exercise the wrapper.
2. Merge #334 and close #333 as superseded. Merge #324, #329 and #332; they are documents only and
   merging them records the packets without deciding anything. Merge #308.
3. Pull `main` in the primary checkout, then apply the EUS-B feedback migration.
4. Close #134 once the progress-read repair (#338) merges. Close #321 once #326 merges.
5. Make the decisions in section 9, each before its module's acceptance or opening.
6. Before the first invitation: decide whether to pull any module from the hub.

## 7. Work orders

Each runtime order is one bounded PR from current `origin/main` in its own worktree, following the
module pack's common contract where one exists, with a handoff in the module's existing handoff
folder. Start order under the three-lane cap is the order below; preconditions are in brackets.

### Hub lane

Opened 2026-10-06; none merged.

- **Anatomy routes (H-1), PR #337.** This is the one hub PR that changes who can open something;
  leaving it unmerged keeps the two modules admin-only. Remove the unconditional guard from the
  Synchronized Bronchoscopy layout; move the intro-course guard into a `(course)` route group so
  the Live Bronchoscopy Anatomy page sits outside it with its address unchanged; correct the two
  contradicted expectations in the Branch Tracing contract test; add a test that every hub module's
  route is free of an unconditional draft guard, is framed in `next.config.mjs` and is named in a
  feedback migration; add a request-only smoke for hub routes and assets that can run against
  production (`npx tsx scripts/module-beta/verify-hub-routes.ts --base-url=…`).
- **Progress read (H-3), PR #338.** Normalise the two stored timestamps at the read boundary, with
  a regression test that uses the database's real output form.
- **Readiness on the hub (H-7), PR #340.** A `ready` or `preview` state and a tester note per
  module, shown as "Ready for review" and "Still in development". Presentation only: every module
  stays listed and opens as it does today. Its documentation and one browser-test line follow the
  merge of #320, which edits the same two files.

### Re-review of #320 (read-only)

Independent review of `origin/claude/pi-platform-05` at `fc4ef8ee`, covering the third repair
(`879dd053`, one-snapshot Save with a mandatory stored attempt). The two cases that failed in the
last independent run are the place to start: a failed attempt commit must stop the report and keep
an honest unsent state, and a queued Save must bind the revision it covers to the content it
submitted. Handoff: `docs/gap-remediation/fellow-feedback/platform/REVIEW-PLATFORM-01-handoff.md` on
that branch.

### HD-03 repair — Claude, on PR #326

Repair the four P2 defects from the preserved review and nothing else:

1. L2-06, `components/WaveformStrip.tsx:219` — the boundary sample acquired before an action is
   assigned to the post-action trace and joined to the first new sample.
2. L5-05, `components/BedsideMonitor.tsx:563` — the held view omits display seams and reconnects
   incompatible acquisition conditions.
3. L2-06, `components/BedsideMonitor.tsx:172` — the automatic rescale notice says pressure did not
   change after an intervention that changed it.
4. P-03, `components/HemodynamicCaseActivity.tsx:1087` — keeping the populated workbench open on
   Observe widens page overflow from 101 px to 161 px at 390 px with 200% text.

Merge `main` into the branch (no rebase). Measure the workbench at 1707 × 900 and 1440 × 900: the
tracing and the controls that change it must be visible together. Before #321 is closed, read its
eight files that #326 does not touch and port anything #326 lacks. The reviewer's probes and tests
are in the preserved evidence folder. Codex re-reviews.

### MV-04

Pack prompt `MV_Claude_Implementation_Pack/04_MV_SELF_PACED_TEACHING_AND_SOURCES.md`. Since the pack
was written: batch 03 merged as #290; the learner-copy guard flags
`components/stage/VentilationPeepComparison.tsx` lines 122 and 160, which this batch owns. A
separate, later PR does the wide-window layout pass (figure and its control on one screen at
1707 × 900); #331 deliberately left Ventilation out while #290 was open.

### SHARED-FEEDBACK-02

Launcher text: `ECMO_Claude_Implementation_Pack/SHARED_FEEDBACK_HANDOFF.md`. In
`src/features/learning-module/components/ChoiceReasoningFeedback.tsx` the list headed "Why the other
answers do not fit" holds every option except the chosen one, so a learner who picks a wrong answer
sees the best-supported answer filed under it. Three MCS call sites pass `alternatives`
(`McsStoryProblems.tsx`, `McsStageHost.tsx` twice); the ECMO call sites do not. Identify keyed
options from the item contract. Make the unsafe framing truthful where nothing stops, through the
existing caller override, or record with evidence that no caller is affected. Failing-before
component tests; exercise the real MCS and ECMO consumers. No other shared file.

### Branch Tracing magnifier

`components/NativeCtViewer.tsx` offers magnification up to 4; `engine/ct-draft.ts` accepts at most
2.5, so a value above 2.5 is saved and the lesson's local draft is discarded on reload. Raise the
saved-view bound to 4. Make an out-of-range stored value fall back to the default for that field
rather than discarding the draft. Existing drafts stay valid.

### BF-04

Pack prompt `BF_Claude_Implementation_Pack/04_BF_TEACHING_AND_SURVEY_FLOW.md`. Add BF-01 finding 3,
still open on `main`: after an asset failure, "Try the 3D view again" stays in loading. Batch 03 was
closed by a post-merge check on `15c52445`. Follow the module's context rule: do not read the
clinical content files into a session; use structural dumps.

### CRRT Repair B [#334 merged]

- F06-R04: the nonzero-makeup guard does not reach three balance surfaces. It is reachable only
  from a fixture today; repair it at the guard.
- F06-R05: the rapid-select and reload test in `e2e/baxter-crrt-batch03-sanity.spec.ts`. Adjudicate
  on a production build: repair the race if it is real there, or record the evidence that it is
  development-only.
- The two critical-care reds that are CRRT's (section 10).

### EBUS apply-decisions [#324 merged]

Apply the decided groups from the owner worksheet to the runtime: OD-01, OD-03, OD-05, OD-06,
OD-10, OD-11 and OD-12, each exactly as recorded, with the pack's handoff and status file. The
glossary expansion may be its own second PR. The seven unresolved groups (OD-07, 08, 09, 13, 14,
15, 16) stay held with current behaviour.

### MCS copy [owner decision on the CAP-LVAD-01 stem]

The CAP-LVAD-01 stem as decided, and the nine lines the learner-copy guard flags in MCS components.
Copy only.

### HD-04 [HD-03 repair merged]

First a small PR that realigns the 16 red journeys in `e2e/icu-hemodynamics-flow.spec.ts` and
`e2e/icu-hemodynamics-targeted.spec.ts` with the merged behaviour, without weakening an assertion.
Then pack prompt `HD_Claude_Implementation_Pack/04_HD_SELF_PACED_TEACHING_AND_FLOW.md`.

### Light readiness pass — the four modules with no pack (read-only report)

Per module, on a production build and on production:

- opens for a signed-in non-admin through `/development-beta/<id>`, with no asset request
  redirected or missing;
- at 1707 × 900, 1440 × 900, 1280 × 800 and 390 × 844 the interactive visual and its controls are
  on one screen;
- draft, limitation and "not for clinical use" labels are present and true. Synchronized
  Bronchoscopy has none today; its open review items are in `docs/bronchoscopy-delivery-review.md`.
  EUS-B's landmark notes are a draft and stations 8 and 9 are placed, not seen;
- Device Atlas serves no unlicensed product image;
- a tester note is drafted.

Anything it finds becomes one small PR.

### Decision packets (docs only)

Prompt 05 for ECMO, Foundations, Ventilation and Hemodynamics (R1 first), from each pack. No lane
needed.

### Acceptance (read-only, report-only PR)

Use the pack's `06_*` prompt, in a fresh session of the agent that did not implement the module's
batches. Order as preconditions clear: ECMO, Peripheral Imaging, MCS, Branch Tracing, EBUS, CRRT,
then Foundations, Ventilation and Hemodynamics. The CRRT pass is the one its acceptance document
defines: bounded follow-up of F06-R01 to R04 and adjudication of R05, on one SHA that contains both
repairs, plus the two CRRT reds.

One addendum applies to every acceptance, written into the report itself:

1. Reproduce each baseline red in section 10 once on the acceptance SHA and classify it. Do not
   root-cause it.
2. Exercise `/development-beta/<id>` as well as the direct route. This is new for Foundations,
   Hemodynamics and MCS; the other six prompts already ask for it.
3. Add 1707 × 900 to the viewport matrix. A workbench whose control and visual are split there
   blocks marking the module ready; it is not an acceptance blocker.
4. A table of every remaining hold and where on screen it is labelled, or "not labelled".
5. The tester note (what the module is, minutes, what to look for, known limits), the owner's walk
   list, and any fact-level contradiction found.

After acceptance, one batch per module covers blockers, holds missing from the tester note and the owner's decisions,
followed by a re-test of that scope only.

## 8. Marking a module ready, and the live check

Acceptance clean → the owner decides the module's fact-level items and walks it → a one-line PR
sets the module to `ready` with its tester note → deploy → live check → invitation.

Live check, about ten minutes, with a second account that is not an admin. The steps follow
"Transition to external development beta" in `docs/module-beta-owner-review.md`.

1. Export any owner-local notes from the browser first.
2. Sign up fresh, through email verification and profile completion. Registration changed on
   2026-10-04 (#328).
3. The hub shows the module under "Ready for review" with its note.
4. It opens through the wrapper, and nothing in it fails to load.
5. One report with an annotated screenshot saves.
6. As admin, the report and its image appear in `/en/admin/module-feedback`.
7. The non-admin account cannot open that workspace or the screenshot address.

Feedback rows carry a time, not a build. The table in section 12 records what was deployed when.

## 9. Owner decisions before each opening

Candidates from the records; each acceptance confirms its module's final list. Everything else in
the packets can stay held and labelled.

| Module               | Item                                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch Tracing       | OD-01: what the first bifurcation example shows (packet in #329), and the two text discrepancies the packet notes.                                                                                                                                                         |
| MCS                  | The CAP-LVAD-01 stem says speed and power are unchanged; the derived power differs.                                                                                                                                                                                        |
| ICU Hemodynamics     | R1: which fault the capstone and HD-08 demonstrate. The pack says to settle it before those scenes are shown as finished teaching.                                                                                                                                         |
| ECMO                 | The 2D and 3D figures disagree on side (ECMO-OWNER-12). One quantity is shown with two values in Section 1.                                                                                                                                                                |
| Foundations          | Whether the unreviewed medication-dose guidance (SUP-07) is labelled or withheld.                                                                                                                                                                                          |
| Not tied to the beta | The Peripheral Imaging teaching CT, the EBUS historical Git object and 94 Foundations media files are publicly retrievable today (public repository, direct-link routes). Inviting fellows does not change that; whether it is acceptable as it stands is a separate call. |

## 10. Baseline reds on `main`

Reproduced on `15c52445` on 2026-10-06 unless marked otherwise.

| Test                                                                                                      | Failure                                                                                                      | Owner                                                      |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `src/features/critical-care/__tests__/accessibility.test.tsx`                                             | The CRRT circuit figure no longer exposes the accessible name the test expects.                              | CRRT Repair B                                              |
| `src/features/critical-care/__tests__/curriculum-sequencing.test.tsx`                                     | "PrisMax troubleshooting challenge" appears in the rendered CRRT list but not in the authored order.         | CRRT Repair B                                              |
| `src/features/critical-care/__tests__/learner-copy.test.ts`                                               | Eleven flagged lines: two in Ventilation (`VentilationPeepComparison.tsx`), nine in MCS components.          | MV-04 and MCS copy                                         |
| `src/features/bronchial-branch-tracing/__tests__/contracts.test.ts`                                       | Asserts two anatomy paths are not public; `src/lib/site-auth/access.test.ts` asserts they are, and they are. | Hub lane (anatomy routes)                                  |
| `e2e/icu-hemodynamics-flow.spec.ts`, `e2e/icu-hemodynamics-targeted.spec.ts` (as recorded in HD handoffs) | 16 journeys fail identically on base and head since batch 02.                                                | HD-04, first PR                                            |
| `e2e/mcs-unloading.spec.ts` (as recorded in #331)                                                         | Fails at 1280, 720 and 320 px on a development server.                                                       | Classified by MCS acceptance                               |
| Five suites outside these modules (as recorded in the MCS-04 sanity review)                               | Literature foundation manifest, two IP-card suites, training-apps, board-review HTML.                        | Confirm once from the primary checkout; likely environment |

## 11. Expected order

From the merge record since 2026-09-19 (48 module PRs: median under a day from open to merge, later
batches 4 to 10 days) and the one acceptance precedent (CRRT: two rounds, not yet clean after 12
days). Ranges, not commitments.

| When          | Modules                                                     |
| ------------- | ----------------------------------------------------------- |
| About 2 weeks | Device Atlas, EUS-B, the two anatomy modules, possibly ECMO |
| 2–3 weeks     | Peripheral Imaging, MCS, Branch Tracing, EBUS               |
| About 3 weeks | CRRT                                                        |
| 3–4 weeks     | Bronchoscopy Foundations                                    |
| 4–5 weeks     | Mechanical Ventilation                                      |
| 5–6 weeks     | ICU Hemodynamics                                            |

## 12. Opening log

| Module | Acceptance report and SHA | Marked ready (PR) | Deployed | Live check |
| ------ | ------------------------- | ----------------- | -------- | ---------- |
| —      | —                         | —                 | —        | —          |

## 13. Outside this board

- Medical Thoracoscopy (#295–#307, #335) is not in the hub and is not counted in the three lanes.
- Public main-page release is a separate decision after the beta.
- Shared backlog, recorded once so each acceptance can cite it instead of re-investigating: the
  site header and footer overflow at 200% root text; the language selector truncation inside the
  wrapper (BBTF-17); the 768 px sticky chrome in EBUS. These were routed to the platform lane, whose
  PR (#320) covers its four findings only.
