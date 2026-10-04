# CRRT-FELLOW-06 repair A — handoff

First bounded repair from the completed CRRT-FELLOW-06 final acceptance
(`CRRT-FELLOW-06-final-acceptance.md`, PR #323). It closes three of the five findings:

- **F06-R01** — unsupported laboratory-trend promises in CRRT-03 and CRRT-04.
- **F06-R02** — the generic debrief tail narrates reassessment and escalation a run never performed.
- **F06-R03** — CRRT-08 and CRRT-09 describe a preconnection, paused or pre-start state while their
  fixture is connected and delivering.

This is an engineering-truthfulness repair: learner-facing wording and one debrief section
boundary. It is not clinical, device or source approval. **F06-R04 (makeup accounting) and F06-R05
(navigation/reload timing) are untouched**, as are the Batch-05 owner decisions.

## 1. Baseline

| Item                 | Value                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| PR #323              | MERGED 2026-10-04; merge commit `fd6805119d9de8bb454d8dcf7f879f4e8165f420`                                                               |
| `origin/main` (base) | `fd6805119d9de8bb454d8dcf7f879f4e8165f420`, the #323 merge itself                                                                        |
| Branch / worktree    | `claude/crrt-f06-repair-a`, fresh worktree `Interventional-Pulm-Education-Worktrees/claude-crrt-f06-repair-a` created from `origin/main` |
| Build commit         | `07ac4edb` (runtime, tests); this handoff is the following docs-only commit, which is the PR head                                        |
| Content version      | `1.1.0-sme-review.1` (`content/versions.ts`), unchanged. A release label, not reviewer approval                                          |
| Engine version       | `1.0.0`, unchanged                                                                                                                       |

Main moved between the acceptance SHA (`6753cb32`) and this base through #331 (MV/MCS/PI/ECMO
layout) and #323 itself; neither touches `src/features/baxter-crrt/`.

Read before editing: the final acceptance report (the completed 2026-10-03 review in full); the
CRRT-12 acceptance-repair handoff and sanity review (#286) and the terminal-End handoff (#313); the
Batch-05 decision packet and queue. The Batch 01–04 handoffs and sanity reviews were searched for
every statement about CRRT-03/04/08/09/17, the debrief tail and the removed duplicate debrief
rather than re-read end to end. The Local-Data common contract, feedback ledger and owner decisions
were not re-read; nothing in this repair depends on or changes them.

All paths below are under `src/features/baxter-crrt/` unless stated otherwise.

## 2. Reproduction on unchanged main

Every finding was reproduced on `fd680511` before any edit, two ways.

**Built case text.** A scratch dump of every learner-facing field of all 18 built case definitions
(`dump-before.json` in the evidence folder) showed, verbatim:

| Finding | Case(s)                 | Text on unchanged main                                                                                                                                                                                                                |
| ------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01     | CRRT-03                 | Opening finding "A serial solute trend and a neurologic vulnerability are visible together."; safe-action response and debrief paragraph "The serial simulated trend changes gradually and remains subject to delivery checks."       |
| R01     | CRRT-04                 | Action description "Observe how the interruption changes actual treatment delivery and later laboratory trends."; debrief "…and the later laboratory trends." and "Delivered clearance drives the later solute and acid-base trends." |
| R02     | CRRT-01, 02, 06, 07, 11 | Last causal-chain step "Reassessing … showed whether the intended response occurred.", first step "The clinical context framed the goal: …"                                                                                           |
| R02     | CRRT-17                 | Debrief paragraph "The escalation and reassessment plan is recorded. …"; chain step "The responsible team receives a structured escalation and reassessment summary."                                                                 |
| R03     | CRRT-08                 | "Before connection, one item … does not match the treatment plan."; response and debrief "The setup remains paused until the mismatch is explicitly resolved or escalated."                                                           |
| R03     | CRRT-09                 | "Before treatment starts, an anticoagulation option is visible …"                                                                                                                                                                     |

The report's trace also holds: no valid clinical solute series exists for CRRT-03/04
(`selectCrrtLabEvidence` lists every solute as unmodeled and the allow-listed metric reader returns
null for them), and CRRT-08/09 start with `device.deliveryState` `running`, patient connected and
150 mL/min through the circuit, with no intervention effect on either case.

Additional sites the report did not list, found by the same dump and repaired with the rest:
CRRT-03's learning objective, mechanism, reassessment option and two hints; CRRT-04's learning
objective, mechanism, mechanism chain, correct-response option, reassessment option, reassess
action label/description and prediction review; CRRT-08's goal, reassessment option, hints and
accepted-alternative label.

**Failing tests.** The new Jest suite was run against unchanged main sources (the repair diff
reverted, the test file kept): **42 failed / 8 passed of 50** (`red-on-main.txt`). The eight that
pass on main are the engine-state and workflow invariants that this repair must not change
(running fixture, no-effect actions, CRRT-04 intervention/event list and start interlock, withheld
chemistry), so they pass before and after by design.

## 3. Repairs

### F06-R01 — CRRT-03 and CRRT-04

**CRRT-03** (`content/completeCases.ts`, the CRRT-03 narrative). Reframed like CRRT-12's
information-gap repair, around three things: the treatment-delivery record a run does provide, the
laboratory values supplied once at case start, and the serial clinical measurements that would
have to be obtained separately.

- Introduction and opening finding now state that the case supplies case-start laboratory values
  and the live delivery record, and carries no serial solute measurements.
- The safe action's response: "Your coordination plan is recorded in the case timeline, and no
  setting changes. No solute series appears, because this case carries none; the pace of solute
  change would have to be followed with serial clinical measurements obtained separately."
- Learning objective, mechanism, reassessment option, causal chain and debrief paragraph were
  aligned. The correct-response label is now "Expect the plan to be recorded, not new clinical data".

No laboratory trend was created and no internal pool is exposed. The action still has no effect.

**CRRT-04** (`content/completeCases.ts`, the learner-wording table). Chemistry prose only:

- "later laboratory trends" / "delayed laboratory direction" wording was replaced in the learning
  objective, mechanism, mechanism chain, correct-response option, reassessment option, the
  six-hour observation description, the reassess action, the prediction review, the debrief
  paragraph and the last causal-chain step.
- The replacements describe delivered therapy and downtime, and name solute and acid-base values as
  measurements to obtain and review separately. Example, debrief paragraph: "Review prescribed
  dose, delivered dose, downtime, and actual effluent. This case supplies laboratory values once,
  at case start; serial solute and acid-base measurements would have to be obtained and reviewed
  separately."

The machine/setup workflow is unchanged: same intervention ids, effects, timed events, prime and
review steps and start interlock. A test pins the id/effect list and the start refusal.

### F06-R02 — actual run versus worked teaching

Two changes, one structural and one grammatical. No second debrief was added and the actual-event
ledger is untouched.

1. **Boundary** (`components/CrrtCasePlayer.tsx`, `actualRunReview.ts`,
   `components/crrt-case-player.module.css`). The debrief tail (trend paragraph, navigation point,
   causal chain, transfer question) was four loose elements after the actual-run sections. It is
   now one labelled section, **"Worked teaching for this case · not a record of this run"**, opening
   with: "The points below are the authored teaching for this case: what a review would look at and
   why. They are the same after every run and do not report an action, a reassessment, or a result
   from this one. What this run recorded is under “What you did in this run” above." The same four
   elements render inside it in the same order; the section has a dashed amber border to set it
   apart from the teal run-evidence blocks.
2. **Grammar** (`content/completeCases.ts`).
   - Shared chain steps for the review-template cases: "Reassessing X **would show** whether the
     intended response occurred." and "The clinical context **frames** the goal: …". This is the
     only change to CRRT-01, 02, 06, 07 and 11.
   - CRRT-17: the debrief paragraph is now its own authored text ("This case cannot show a calcium
     trend, a total-to-ionized ratio, or a citrate measurement … An escalation would state that
     single value, the samples still to obtain, and the reassessment the responsible team would
     need."), and the chain step reads "An escalation would give the responsible team a structured
     summary …".
   - Root cause removed: `CaseNarrative.trendReview` is now **required**. The debrief paragraph no
     longer falls back to `expectedResponse`, which is an action response and reads as something the
     learner did. CRRT-14, 16 and 18 received their existing text explicitly, so their output is
     byte-identical.

Real actions still read as real: a performed action's own response stays in "Action teaching notes
from this run" (CRRT-17's "The escalation and reassessment plan is recorded." appears there only
after the action is performed), and committed reassessments still appear under "Actual
reassessment".

### F06-R03 — CRRT-08 and CRRT-09

Smallest truthful repair, copy only (`content/completeCases.ts`). The engine was not changed into a
preconnection workflow, and no intervention effect was added to make the prose true.

- **CRRT-08** is framed as rehearsing the verification that belongs before connection, beside "an
  already-running demonstration, connected and delivering". The response to the verification
  action: "Your verification plan is recorded in the case timeline. Nothing is stopped or paused:
  the running demonstration continues unchanged, because this exercise has no setup state to hold.
  In practice the mismatch would be resolved or escalated before connection." The debrief paragraph
  says the exercise does not model that hold. The pre-connection verification objective is kept.
- **CRRT-09** drops "Before treatment starts" and says the check is rehearsed "beside an
  already-running demonstration treatment and changes nothing on it". The response: "Your
  verification is recorded in the case timeline. No anticoagulation setting, medication
  instruction, or treatment state changes; the demonstration treatment keeps running as it was."
  No medication behavior or setup state was added.

## 4. Files and cases affected

| File                                               | Change                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `content/completeCases.ts`                         | CRRT-03/08/09/17 narratives; CRRT-04 wording-table entries; two shared chain templates; required `trendReview` |
| `components/CrrtCasePlayer.tsx`                    | Debrief tail wrapped in one labelled section                                                                   |
| `actualRunReview.ts`                               | `CRRT_WORKED_TEACHING_BOUNDARY` sentence                                                                       |
| `components/crrt-case-player.module.css`           | `.workedTeaching` block style                                                                                  |
| `__tests__/fellow06RepairA.test.tsx`               | New, 50 tests                                                                                                  |
| `e2e/baxter-crrt-fellow06-repair-a.spec.ts` (root) | New, 13 browser tests                                                                                          |
| `docs/…/CRRT-FELLOW-06-repair-A-handoff.md`        | This document                                                                                                  |

Field-level diff of the built definitions, before versus after (`dump-before.json`,
`dump-after.json`):

| Cases                               | Changed fields                                             |
| ----------------------------------- | ---------------------------------------------------------- |
| CRRT-03, CRRT-08                    | 13 each (narrative fields described above)                 |
| CRRT-04                             | 11 (chemistry prose only)                                  |
| CRRT-09                             | 5                                                          |
| CRRT-17                             | 3 (debrief paragraph, one chain step in its two locations) |
| CRRT-01, 02, 06, 07, 11             | 2 each (the two shared chain templates, tense only)        |
| CRRT-05, 10, 12, 13, 14, 15, 16, 18 | 0                                                          |

Every case additionally gains the section heading and boundary sentence in its debrief. No
`initialPatient`, `initialAccess`, `initialPrescription`, fixture, effect, timed event, success
condition, source basis or review status changed in any case.

## 5. Validation

Evidence folder (local, not in Git):
`Interventional-Pulm-Local-Data/renders/crrt-fellow06-repair-a-20261004/`.

| Gate                                       | Result                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| New Jest suite on unchanged main           | **42 failed / 8 passed** (expected; see §2)                                                                                     |
| New Jest suite, final                      | **50 passed**                                                                                                                   |
| Complete CRRT feature Jest                 | **84 suites / 1,044 tests passed** (was 83 / 994; the difference is the new suite)                                              |
| Broad CRRT + shared consumers Jest         | **134 suites passed / 3 failed; 1,611 tests passed / 3 failed.** The three failures are the pre-existing shared ones, see below |
| CRRT Playwright, production (`next start`) | **84 passed / 1 skipped / 0 failed** across all nine `baxter-crrt-*` specs (71 existing + 13 new)                               |
| CRRT Playwright, development (webpack dev) | **84 passed / 1 skipped / 0 failed**                                                                                            |
| TypeScript (`npm run type-check`)          | **Passed, 0 diagnostics**, run after the build generated the content layer                                                      |
| Production build (`npm run build`)         | **Passed**: both embedded apps, content, asset validation, Next build, standalone preparation                                   |
| ESLint (`npm run lint`)                    | **0 errors, 15 warnings**, none in CRRT files                                                                                   |
| Prettier                                   | Passed for the CRRT feature, CRRT routes, CRRT e2e specs and `docs/gap-remediation/fellow-review`                               |
| `git diff --check`                         | Passed                                                                                                                          |

Jest command was the acceptance review's broad command (CRRT feature, critical-care,
learning-module, CRRT routes, analytics API, sitemap, module-beta, draft-modules and site-search
consumers). Playwright used a synthetic preview URL/key as process environment, ports 3306
(production) and 3307 (development), one worker, no retries. No environment file was read.

**Shared Jest failures (not caused by this change).** The same three as the acceptance baseline:
`critical-care/__tests__/accessibility.test.tsx` (old CRRT circuit image name),
`curriculum-sequencing.test.tsx` (trailing PrisMax challenge expectation) and
`learner-copy.test.ts` (MV/MCS copy findings). Compared with the acceptance review's
`baseline-jest.json` after removing stack frames: the first two are identical; the third differs
only in four line numbers inside MV/MCS files moved by #331. It names no CRRT file.

**The skip** is the existing beta-wrapper test, which self-skips without its local owner flag.

**Setup notes.** The fresh worktree needed `npm ci` at the root and in `navigation_module/web` and
`EBUS-course/apps/web` before the full build would run. The first type-check attempt ran before
any build and failed on the missing generated content layer and on heap; it was rerun after the
build with a larger heap and passed. Neither was a code problem.

### Regression tests added

`__tests__/fellow06RepairA.test.tsx` (50 tests):

- **R01**, CRRT-03 and CRRT-04: no learner-facing field promises a laboratory or solute trend;
  laboratory values are supplied and the evolving chemistry stays withheld after two hours
  (unmodeled list and allow-listed metric reader); delivery evidence stays on the patient surface;
  CRRT-03's action leaves the simulation identical; CRRT-04 keeps its intervention ids, effect
  counts, timed events and start refusal.
- **R02**: a no-action debrief for **all 18 cases** (which includes CRRT-01, 02, 06, 07, 11 and 17) shows the no-run status, one ledger entry (opening the debrief), "Actual reassessment: Not
  recorded", no action-notes section, and a worked-teaching section free of completed-action
  language. No case reuses an action response as its debrief paragraph. Two performed paths
  (CRRT-17 escalation and CRRT-11 fluid-removal change, each with elapsed time and a committed
  reassessment) show the real action, the real reassessment and the action's own response.
- **R03**, CRRT-08 and CRRT-09: the fixture starts running, connected, at 150 mL/min; no
  intervention has an effect; the verification action leaves the simulation identical; after two
  hours delivery is still running with zero downtime; no field claims a preconnection, pre-start or
  paused state; the pre-connection verification objective and the medication containment remain.

### Browser journeys (production build, repeated on development)

`e2e/baxter-crrt-fellow06-repair-a.spec.ts` (13 tests), each reading the introduction, the Current
task panel, an action response, Patient & trends and the debrief:

- **CRRT-03** — evidence boundary in the introduction and Current task; worked plan; coordination
  action performed from the keyboard; two hours; no solute value on the patient surface; debrief.
- **CRRT-04** — introduction and Current task; action cards; the Start card stays disabled before
  prime and review; no-run debrief with the laboratory section still marked not modeled.
- **CRRT-08, CRRT-09** — introduction and Current task say the machine is already running;
  Machine + circuit shows the run active, pumps active, 150 mL/min before and after the action and
  after two hours; downtime 0 min; debrief records the action and 150 mL/min.
- **CRRT-17** — no-action debrief: no-run status, reassessment not recorded, no action notes,
  worked-teaching section present and prospective.
- **CRRT-01, 02, 06, 07, 11** — no-action debrief keeps the reassessment step prospective.
- **390 × 844** for CRRT-03, CRRT-08 and CRRT-17 — no document overflow on the introduction or the
  debrief; the Debrief tab and End control operated by keyboard; the new section heading inside
  the viewport width.

Action cards were activated by focus plus Enter in the journeys. Screenshots of the new section at
desktop and phone width were inspected (`screenshots/crrt17-worked-teaching.png`,
`CRRT-08-worked-teaching-390.png`). Not run for this change: the 1024/1280/320 px and 200%-text
matrix, the systemic layout suite, and any screen-reader check. The change adds text inside an
existing scrolling column and no new control.

## 6. Preserved contracts and holds

Exercised by the unchanged existing suites, all passing in both browser modes and in Jest: CRRT-04
machine setup and start interlocks, the CRRT-12 information-gap repair, terminal End across
scheduled checkpoints, the actual-run debrief ledger, unsupported-chemistry containment, case URL
identity, role perspective preservation, zero-versus-missing, Help/Reference/Evidence, pressure
arithmetic, visited semantics and optional teaching. No existing test was edited, skipped or
weakened.

Owner and source status, unchanged:

- Batch-05 queue: all 34 items untouched; SHA-256
  `fa4b7656f06df44008d99b0d5c92f55aeecb4dd40771e488d1a7d7e15522363b`, identical to the acceptance
  report.
- G01 source queue: SHA-256 `7a80a66e1afa32bdbe7f3cc06bf5732b3ade9e49ed145749673a5b6ce48efc8d`,
  identical.
- O-01 through O-10, the G01 decisions, source review statuses and clinical/device approval fields
  were not edited. No physiology was added. Content and engine versions were not bumped.

## 7. Left unchanged, on purpose

- **F06-R04 — nonzero-makeup accounting.** Not touched. `CrrtActivityWorkspace.tsx`,
  the patient/trend balance reads in `CrrtCasePlayer.tsx` and the balance reads in
  `actualRunReview.ts` still consume raw cumulative totals. The only edits to those two files are
  the debrief section wrapper and one new caption constant.
- **F06-R05 — development rapid-selection/reload.** Not touched:
  `components/BaxterCrrtPractice.tsx` and `e2e/baxter-crrt-batch03-sanity.spec.ts` are unchanged.
  The affected test ("every Cases option is reachable and all four group boundaries stay truthful")
  **passed in this development run and in production**. That is one passing run of a
  timing-sensitive test, not a fix and not evidence the race is gone; it still needs the
  adjudication the acceptance report asks for.
- **Batch-05 clinical/device/model decisions** — none implemented.

Observations recorded, not acted on:

- CRRT-17's transfer question still says "linked trend" ("How would you communicate the linked
  trend, missing context, and escalation boundary…"). It is a question, not a claim about the run,
  and CRRT-17's containment passed acceptance, so it was left; an owner may want it reworded with
  O-05.
- CRRT-08's action is still labelled "Stop the sequence, identify the mismatched domain, and
  complete an independent check". Its card description and response now say nothing is stopped in
  the simulation, but the label itself reads as an instruction to stop. Relabelling was held back
  to keep the change small.
- CRRT-03's title still names a "controlled solute trajectory"; the Batch-05 packet already lists
  its sodium-rate objective and shared seed as owner items.
- All adapted cases still share the finding "The worked plan explains the expected machine and
  patient response and what to reassess."

## 8. Review checkpoint

Review the PR against `fd6805119d9de8bb454d8dcf7f879f4e8165f420`. Suggested checks: read the four
rewritten narratives as a clinician for tone and accuracy (they are engineering wording, not
reviewed clinical copy); confirm the worked-teaching section reads as separate from the run record
on a no-action and an action debrief; rerun the new Jest suite with the three source files reverted
to confirm it fails for the stated reasons.

Not merged and not deployed.
