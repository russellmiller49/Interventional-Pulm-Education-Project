# Beta reviewer readiness — 2026-11-03

Written against `main` 57e25963, after the 2026-11-03 repair PRs. This places each of the 14 hub
modules against the gate in [Beta finish line](beta-finish-line.md#2-the-gate). It also records
which hub cards now carry a reviewer note. It changes no rollout stage: all 14 modules stay
`preview` in `src/features/module-beta/rollout.ts`. Marking a module `ready` stays the owner's
one-line change (board section 8).

Sources outside Git are cited as `LD/…` for `Interventional-Pulm-Local-Data/`. "Readiness check"
means the read-only check of 2026-11-03 against `main` 32caf374; its report is in that session's
scratchpad and its hand-over is in the side-session notes.

## Summary

| Module                                     | Bucket             | What decides it                                                                  |
| ------------------------------------------ | ------------------ | -------------------------------------------------------------------------------- |
| EBUS: Guided Course                        | After verification | Row sign-off, two owner checks, Prompt 06                                        |
| Peripheral Bronchoscopy Imaging            | After verification | Owner read of Sections 4, 6, 7 and 10, row sign-off, Prompt 06                   |
| Bronchoscopy Foundations                   | After verification | Lidocaine row (SUP-07) and 61 other rows, #398's five items, Prompt 06           |
| Mechanical Ventilation                     | After verification | Row sign-off, open MV-L rulings, Prompt 06                                       |
| Airway Anatomy — Synchronized Bronchoscopy | After verification | Light readiness pass, one headset check                                          |
| EUS-B Simulator                            | Hold               | Light pass NOT READY: image and controls split at every size (EUSB-LR-01)        |
| Bronchial Branch Tracing                   | Hold               | Rebuild half-landed (#419 stream C unpushed); OD-01 undecided                    |
| Live Bronchoscopy Anatomy                  | Hold               | Two audit "fix now" anatomy errors in `airway-map.ts`                            |
| Device Atlas                               | Hold               | Light pass NOT READY; nothing changed since                                      |
| Literature Atlas                           | Hold               | Feedback migration `20261016025933` not applied                                  |
| Cardiohelp ECMO                            | Hold               | 2D and 3D figures drain from opposite groins (ECMO-OWNER-12)                     |
| Baxter CRRT                                | Hold               | Recorded model conflicts open; re-acceptance predates #357                       |
| ICU Hemodynamics                           | Hold               | HD-05 contradicts its own debrief row (#433); R1 undecided                       |
| Mechanical Circulatory Support             | Hold               | Shared answer card files the best answer under "do not fit" (SHARED-FEEDBACK-02) |

**Note, 2026-11-10.** The Cardiohelp ECMO row's issue, ECMO-OWNER-12, is closed by #464. It was a
naming error, not a mismatch: both figures drain the patient's right femoral vein. The row is kept
as written on 2026-11-03; see the note in the [Cardiohelp ECMO](#cardiohelp-ecmo) section. The
module's bucket is not re-assessed here.

**Ready to recommend for physician beta: none.** No module meets gates 1 to 4 on record. The
reasons are below.

## How the buckets are drawn

The gate, in short:

1. Runtime batches and named repairs are merged.
2. Prompt 06 acceptance has run with zero technical blockers. A module with no pack needs the light
   readiness pass instead.
3. Every remaining hold is in the module's tester note.
4. The owner has decided the module's fact-level items and walked it.
5. Before any invitation: the owner's live check with a non-admin account.

The buckets:

- **Ready to recommend for physician beta.** Gates 1 to 4 are met on record.
- **Ready after a specific verification.** No unresolved defect is on record, and each missing
  piece is a named check or sign-off.
- **Hold pending an unresolved issue.** A recorded finding is still open on `main`: a failed check,
  a contradiction, or a factual error.

A reviewer note goes on the card of each module in the second bucket. Gate 3 needs the note
before a module can be marked ready, and these are the modules a reviewer could be sent to next.
Held modules get their note once the hold clears, so their cards render as before.

## What applies to every module

- **Gate 5 has not run.** No non-admin test account exists (readiness check 1a). No module has been
  opened through the wrapper by a real reviewer account.
- **Gate 2 has no post-rebuild record.** On 2026-10-08 the owner reversed the withholding rules
  (`docs/teaching-first-rules.md`), and every module was rebuilt or re-taught from 10-10 on.
  - No Prompt 06 acceptance or light pass is on record on a `main` SHA since then.
  - The board's opening log (section 12) is empty.
  - The only acceptance-type runs are the EBUS scoped engineering pass (09-30), CRRT's Prompt 06
    (10-03, NOT READY) and its bounded re-acceptance (10-07), and the EUS-B and Device Atlas light
    passes (10-07, both NOT READY).
- **No owner walkthrough is recorded** for any module. The owner feedback rounds cited below are
  the closest evidence.
- **Teaching numbers.**
  - `npm run numbers:signoff` on 57e25963: 159 of 159 rows are unsigned in the seven registers it
    reads.
  - Bronchoscopy Foundations keeps its own register (`content/numbers.ts`), which the script does
    not read. 13 of its 75 rows are signed ("Russell Miller, 2026-10-08").
  - Under the teaching-first rules unsigned rows already teach, so signing them is a verification,
    not a hold.

| Register                                        | Unsigned rows |
| ----------------------------------------------- | ------------- |
| `baxter-crrt`                                   | 35 of 35      |
| `cardiohelp-ecmo`                               | 33 of 33      |
| `icu-hemodynamics`                              | 25 of 25      |
| `mechanical-ventilation`                        | 20 of 20      |
| `mechanical-circulatory-support`                | 19 of 19      |
| `peripheral-imaging`                            | 14 of 14      |
| `ebus-guided`                                   | 13 of 13      |
| Bronchoscopy Foundations (`content/numbers.ts`) | 62 of 75      |

- **Live feedback.**
  - `module_beta_feedback` holds 65 reports from 2 testers: 64 ECMO and 1 Peripheral Imaging, the
    latest on 2026-10-23 (readiness check 4c).
  - On 2026-09-25 a temporary tester saved one report from each of the 12 module ids then in the
    catalog, and the rows were removed afterwards (`docs/module-beta-testing.md`, Validation).
  - That check predates the wrapper repair (#320). It covers neither EUS-B nor the Literature Atlas,
    nor Live Anatomy's new review address (#434).
- **Shared answer card (SHARED-FEEDBACK-02).** The bounded fix the board authorized (section 7)
  never landed.
  - `src/features/learning-module/components/ChoiceReasoningFeedback.tsx` last changed on
    2026-09-07 (98df7570).
  - It lists every option except the chosen one under "Why the other answers do not fit". A learner
    who picks a wrong answer therefore sees the best-supported answer filed there.
  - Only MCS passes `alternatives` today. ECMO uses its own `EcmoOtherAnswers.tsx`.
- **Feedback wrapper risks** (readiness check), each proposed as its own follow-up:
  - In server mode, an unsent draft is lost on reload or on **All modules** then Back.
  - The Live Anatomy tab is not in the URL.
- **Section 10 baseline reds.** The three critical-care suites the board listed (accessibility,
  curriculum sequencing, learner copy) now pass: 3 suites, 41 tests on 57e25963.

## 1. Ready to recommend for physician beta

None. Every module misses gate 2 on its post-rebuild content and has no recorded owner walk
(gate 4). A module in the next bucket moves here when its named checks are done.

## 2. Ready after a specific verification

### EBUS: Guided Course

- **Gate 1, met.**
  - Batches 01–05: #249, #251, #261, #269 and #278 (board section 3).
  - The seven decided owner items were applied in #344 (10-11).
  - Re-taught in #356; owner feedback rounds #383, #384 (10-11) and #387 (10-12).
  - No open PR touches it, and there have been no commits since 10-13.
- **Gate 2, missed.**
  - The only run is a scoped engineering pass on 46c5bb94, 2026-09-30
    (`fellow-walkthrough/ebus/EBUS-PRE-REVIEW-06-scoped-engineering-acceptance.md`). It is not a
    Prompt 06, and it predates #344, #356 and #383–#387.
  - Its one open finding, the lesson-3 marker column, is repaired
    (`EBUS-PRE-REVIEW-03-marker-columns-repair.md`).
- **Gate 4, partly met.**
  - There is no section 9 item.
  - OD-07, 08, 09 and 13–16 stay held with current behaviour, as the board allows. The note lists
    OD-07's effect on Lesson 16.
  - #356 leaves owner checks open: the bleeding sequence is unsourced, and AQuIRE was read as an
    abstract only.
  - #387 leaves the find-task structures for the owner to confirm.
- **Verifications:**
  1. The owner signs the 13 `ebus-guided` rows.
  2. The owner confirms the #356 and #387 items above.
  3. Prompt 06 (EBUS pack) runs on a SHA after 10-13.

### Peripheral Bronchoscopy Imaging

- **Gate 1, met.**
  - Batches 01–04: #248, #253, #262, #265 and #279.
  - Later work: #366, #386, #390, #392, #395, #417 and #418.
  - The board's condition that #320 be re-reviewed at its final head was not met as written. #320
    merged at fc4ef8ee on 10-07 with no recorded re-review.
  - The readiness check exercised the merged wrapper and the feedback POST against a stub, and both
    passed (rows 3a, 3b). One real report from this module is on record (4c).
- **Gate 2, missed:** no Prompt 06.
- **Gate 4, partly met.**
  - OD4-01 to OD4-12 are decided. The owner reversed OD4-06 on 10-12 (#395).
  - #417's checkbox "Owner read of Sections 4, 6, 7 and 10 as a fellow would" is unchecked.
  - #417 and #418 list items that need physician review: routine recruitment, positioning, and the
    percutaneous source of the Hwang figures.
- **Verifications:**
  1. The owner reads Sections 4, 6, 7 and 10 as #417 asks.
  2. The owner signs the 14 `peripheral-imaging` rows.
  3. Prompt 06 (PI pack) runs.

### Bronchoscopy Foundations

- **Gate 1, met.**
  - Batches 01–03: #254, #274 and #291.
  - The rewrite: #349–#378, #381 and #391. Owner rounds: #396, #397 and #398. Then #428.
  - BF-04 was superseded by the rewrite; its 3D-retry fix landed as #351.
  - Two draft PRs are open: #394 (practice clean-up) and #379 (records the signatures on rows
    13–15). Neither blocks review.
- **Gate 2, missed.** There is no Prompt 06, and no production build is recorded for #391, #396 or
  #398.
- **Gate 4, partly met.**
  - Section 9's SUP-07 asked whether the medication-dose guidance is labelled or withheld. The
    teaching-first rule answers it by teaching the number, so what remains is a signature.
  - The lidocaine ceiling is taught (`content/sections/sedation-and-monitoring.ts:204`) from an
    unsigned row in `content/numbers.ts`.
  - #398 lists five items "For the owner to confirm", among them the orientation rule and the clock
    table.
- **Verifications:**
  1. The owner signs the lidocaine row, which closes SUP-07, and the other 61 unsigned rows.
  2. The owner confirms #398's five items.
  3. Prompt 06 (BF pack) runs on a production build.

### Mechanical Ventilation

- **Gate 1, met.**
  - #259, #271 and #290; batch 04 as #347; #354; #403–#405, #408, #409, #412 and #429.
  - The two section 10 lines in `VentilationPeepComparison.tsx` were cleared in #347.
- **Gate 2, missed:** no Prompt 06.
- **Gate 4, partly met.**
  - There is no section 9 item.
  - The owner ruled on MV-L3 and MV-L5 on 10-15 (#409). MV-L1, L2, L4 and L6–L8 are open
    (`docs/clinical-language/mechanical-ventilation-sections-6-14.md`, "Open E2 tickets").
  - The audit's "fix now" item, tidal volume credited to the 2024 ATS update, is addressed. The
    evidence list now cites ARMA 2000 and the 2017 guideline (`learningCurriculum.ts:339-342`).
- **Noted in #429's hand-over, not a defect on record:** one case reaches an intrinsic PEEP of
  33.9 cmH₂O, and the console has no live driving-pressure readout. Both are in the note.
- **Verifications:**
  1. The owner signs the 20 `mechanical-ventilation` rows.
  2. The owner rules on MV-L1, L2, L4 and L6–L8.
  3. Prompt 06 (MV pack) runs.

### Airway Anatomy — Synchronized Bronchoscopy

- **Gate 1, met.**
  - H-1 is fixed by #422 (10-28). The route opens to a verified reviewer, and the canvas renders
    inside the wrapper (readiness check 1c and 5b, stub reviewer).
  - The audit's RB4/RB5 "fix now" item is resolved (#437).
- **Gate 2, missed.** This module has no pack, and its light readiness pass (board section 7) has
  not run.
- **Not verified:**
  - #424's VR fix in a headset.
  - #440 on a dev server, a production build or the VR HUD.
- **Visible but not an error:** the CT file name and a Scope Tracker toggle. The audit lists hiding
  them as a change, not as a "fix now" error.
- **Verification:** the light readiness pass. It is a production-build open by a reviewer account at
  1707 × 900, 1440 × 900, 1280 × 800 and 390 × 844, plus one headset check of the VR view.

## 3. Hold pending an unresolved issue

### EUS-B Simulator

- **Issue: EUSB-LR-01 (P1).** The ultrasound image and the controls that change it are not on one
  screen at 1707 × 900, 1440 × 900, 1280 × 800 or 390 × 844.
  - Light readiness pass, NOT READY, 2026-10-07 on a3fce9f8.
  - Tracked in
    `LD/renders/output/eusb-step16-light-readiness-20261007/STEP16-EUS-B-light-readiness.md`.
  - There have been no commits to the EUS-B paths since.
- **Labels, not holds.** LR-02 and LR-03 asked for review-status labels, which teaching-first
  rule 6 now forbids; those holds belong in the tester note. The standard page still tells learners
  the notes are "a draft awaiting physician review" (`src/app/[locale]/eus-b-simulator/page.tsx:73`).
- **Feedback.** Live EUS-B feedback has never been saved; the migration was applied on 10-07.
- **Clears with:** one EUS-B layout PR for LR-01, then a re-run of the light pass.

### Bronchial Branch Tracing

- **Issue: the simplified-method rebuild is half-landed.**
  - Stream A (#419) merged, but its component is not mounted.
  - Stream C, which wires it into the navigation bench, sits only on a local `claude/bbb-simplified`
    worktree. It has no pushed branch and no PR.
  - Review now would spend physician time on a flow that the planned stream C replaces.
- **Also open: OD-01 (board section 9).** It is undecided on record
  (`fellow-feedback/bbt/BBT-PRE-REVIEW-05-owner-decision-packet.md`). #372 put the first
  bifurcation on slice 372 "for the owner to check".
- **Clears with:** the owner decides whether stream C lands before review, and decides OD-01.

### Live Bronchoscopy Anatomy

- **Issue: two anatomy errors.** Both are on the audit's "errors to fix now" list (owner audit
  2026-10-08; `teaching-first-handoff.md`, "What is next" item 2), and both are unfixed on `main`:
  - `src/data/airway-anatomy-lesson/airway-map.ts:487` says LB1+2 mirrors "RB7+8"; it should read
    LB7+8.
  - `:701` credits the left lung's eight segments to the LB7+8 fusion alone, but LB1+2 is needed
    too.
- **Fixed today:**
  - The route works for reviewers (#434).
  - Screen orientation is fixed (#437), and the quiz answer is hidden until the learner commits
    (#438).
- **Still open:** the quiz still's file name carries the node id (#438 hand-over).
- **Clears with:** an owner-approved correction of those two pearls, then the light readiness pass.

### Device Atlas

- **Issue: its light readiness pass was NOT READY** (2026-10-07 on a3fce9f8;
  `LD/renders/output/step16-device-atlas-light-review-20261007/REPORT.md`):
  - DA-L1: search and the first result cannot be used together at 1280 × 800 or 390 × 844.
  - DA-L2: a working length prints as 220.00000000000003 cm (`device-display-config.ts:185-190`).
  - DA-H1 to H3: holds unlabelled.
- **Also open:** the audit's "fix now" item, the BF-1TH190 page reporting no working channel.
- **No change since:** no commit has touched the Atlas code or data since 09-30.
- **Clears with:** the bounded presentation PR the report recommends, plus BF-1TH190, then a re-run.

### Literature Atlas

- **Issue: feedback migration `20261016025933` is not applied on Endoreels.**
  - Readiness check 3d; `docs/module-beta-testing.md`, Deployment item 4;
    `docs/literature-atlas-preview.md`, go-live step 3.
  - Every report from this card fails to save.
  - It must be applied before #442's `20261103180000`, never after: each file re-creates the whole
    constraint.
- **Also:** there is no board row and no readiness pass.
- **Clears with:** the owner applies the migration from the primary checkout, runs the constraint
  check, and saves one report.

### Cardiohelp ECMO

- **Issue: ECMO-OWNER-12 (board section 9).** Section 2's two figures drain from opposite groins:
  - The 2D map drains from the patient's right femoral vein: the drainage cannula sits left of the
    164 midline in an anterior view (`circuit-map/circuitMapGeometry.ts`).
  - The 3D circuit drains from `GROIN_VEIN_LEFT` (`ecmo-circuit/layout.ts:99,126`).
  - The independent review asked for them to be reconciled
    (`fellow-feedback/ecmo/ECMO-FELLOW-03-sanity-review.md`), and neither file has changed since.
- **Note, 2026-11-10: ECMO-OWNER-12 is closed by #464.** It was a naming error. The two figures
  never disagreed:
  - `GROIN_VEIN_LEFT` sits at −x in the patient model's frame. The model lies supine with its head
    toward −z and its front toward +y, unrotated, so the patient's left is +x and that anchor is
    the patient's right groin. It was named for the model's x axis, not for the patient.
  - Both figures drain the patient's right femoral vein and return to the left groin: the vein on
    VV, the artery with the distal perfusion catheter on VA.
  - The owner's decision (2026-11-10) was to leave both drawings as they are. #464 renames the
    anchors by the patient's side and adds a test that holds the two figures to the same groins.
  - The "Clears with" line below predates this. No figure changes; the items under "Also open",
    the unsigned rows and Prompt 06 stand as written.
- **Also open:**
  - Board section 3 names the SHARED-FEEDBACK-02 fix as a precondition of ECMO's Prompt 06. ECMO
    does not use that card, so waiving the precondition is an owner call.
  - The Section 1 quantity once shown with two values (13.3 vs 13.2 mL/dL) now shows one, after
    #399. No decision is recorded.
- **Strongest record otherwise:**
  - 64 tester reports, 56 resolved through #399 and #400.
  - #431 and #435 merged.
  - 33 unsigned rows.
- **Clears with:** the owner picks the side and one figure changes; then Prompt 06.

### Baxter CRRT

- **Issue: recorded conflicts are unresolved** (`fellow-review/CRRT-FELLOW-06-repair-B-handoff.md`,
  end of evidence):
  - CONFLICT-CRRT-MAKEUP-001, CONFLICT-001 and 002, and G01-CRRT-02.
  - O-01 to O-10.
- **Acceptance history:**
  - Prompt 06 was NOT READY on 10-03 (#323). Repairs A (#334) and B (#343) merged.
  - The bounded re-acceptance ran on 10-07. It found no blocker but "NOT READY TO MARK FOR FELLOW
    REVIEW", with decision holds unlabelled
    (`LD/renders/crrt343-independent-20261007/CRRT-PR343-independent-reacceptance.md`). It was
    never committed, so the repo hand-over still lists it as not run.
  - It predates #357, which rewrote the cases, checks and drills, and #430.
- **Also:** CRRT-03's stem omits shock while the case shows MAP 61, HR 118 and rising
  vasopressors (#430 hand-over).
- **Clears with:**
  - Owner rulings on the makeup conflict and the O items, or each listed in the tester note.
  - The CRRT-03 stem.
  - A bounded re-test after #357 and #430.

### ICU Hemodynamics

- **Issue: HD-05 contradicts its own debrief row** (#433, "Reported, not changed" item 1). The case
  sits on the Cardiogenic row, which says filling pressures are high. The debrief tells the learner
  to hold the case's numbers against that row, but the model shows RAP 11.9 and wedge 7.6.
- **Also open:**
  - R1 is undecided (board section 9). The HD pack's `OWNER_DECISIONS.md` says to settle it
    "before those scenes are shown as finished teaching", and HD-08 is now Section 2's last task.
  - #432's three owner decisions are pending.
- **Clears with:** the Cardiogenic row and HD-05 made consistent, and R1 and #432's decisions made.

### Mechanical Circulatory Support

- **Issue: SHARED-FEEDBACK-02** (board section 7; see above).
  - MCS passes `alternatives` at five sites: `McsStoryProblems.tsx:192`,
    `McsImpellaEchoPosition.tsx:93`, `McsStageHost.tsx:923` and `:1308`, and
    `McsLvadPerfusionCase.tsx:129`. Two of them are the cases added in #439 and #441.
  - A fellow who picks a wrong answer sees the keyed answer listed under "Why the other answers do
    not fit".
- **Otherwise:**
  - The section 9 item, the CAP-LVAD-01 stem, was decided and applied (#345).
  - The section 10 copy lines were fixed (#345).
- **Clears with:** the bounded SHARED-FEEDBACK-02 PR the board already authorizes, with
  failing-before tests on the MCS consumers.

## Reviewer notes on the hub

`BetaTesterNote` gains `audience` and an optional `estimate` (minutes plus their basis). A
`preview` entry may now carry a note; the card then shows:

- who the module is for;
- what it teaches;
- the estimated time and its basis, where the module's structure supports one;
- where feedback helps most;
- its known limits.

| Module                          | Estimate shown  | Basis                                                                                                  |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| EBUS: Guided Course             | about 4 hours   | 26 lessons at 202 minutes by the course's own count, plus about 25 minutes of cases (`CoursePage.tsx`) |
| Peripheral Bronchoscopy Imaging | about 3.5 hours | 19 sections, 207 minutes (`imagingPathwayComposition`, shown on its hub)                               |
| Bronchoscopy Foundations        | about 2.5 hours | 15 sections, 152 minutes; the 8 integrated cases are extra                                             |
| Mechanical Ventilation          | about 1.5 hours | 14 sections, 102 minutes; the 15 cases are extra                                                       |
| Synchronized Bronchoscopy       | none            | Free exploration and timed Bronch Quest runs; no basis for a total                                     |

Every known limit on a card is a real item from the evidence above.

## Recommendations to the owner

- **No stage changes in this PR.** None of the 14 modules is recommended for `ready` today.
- **Shortest path to the first `ready`:** EBUS, Peripheral Imaging, Foundations and Ventilation.
  For each: sign its rows, settle its owner items, then run one Prompt 06 on a recorded SHA.
- **Owner calls this raises:**
  1. Does your own feedback since 10-11 count as the gate 4 walk for a module? And does a fresh
     Prompt 06 still apply after the teaching-first rebuild? If you waive both, those four modules
     need only the sign-off and the live check.
  2. Apply `20261016025933`, then #442's migration, in that order.
  3. Close #337 unmerged, as the #434 hand-over says. The board's H-1 entry still points at it.
  4. Open the SHARED-FEEDBACK-02 PR. It clears MCS, and one ECMO precondition with it.
  5. Run the live check with a second, non-admin account (board section 8). Nothing goes out
     before it.

## Not verified here

- Any live sign-in, live feedback save or deployed page. This work read the code, the docs and PR
  bodies, and ran the hub on a local development server with a local test cookie.
- Module content beyond what the cited PRs, hand-overs and reports state. No module was walked
  end to end for this document.
