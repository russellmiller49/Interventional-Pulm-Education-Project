# BF-PRE-REVIEW-01 — simulation truth, timed tasks and goal status: handoff

**Batch scope:** lane 01 of the Bronchoscopy Foundations fellow-walkthrough package — the worked
accessory exchange (A1), the two stalled time-based activities (A2, A3), the goal and completion
claims that outlived the state they described (A4, A5), the neutral-branch investigation (A26) and
the accessory-control disclosure (SUP-16). **No clinical approval, no source or media review, no
anatomical validation, no real-learner validation, no release, no deployment and no merge is
claimed or performed.** Lanes 02 (sources, feedback, action controls), 03 (visual workspace), 04
(teaching and survey flow) and 05 (media and clinical decisions) are untouched.

The walkthrough this repairs is Claude in a first-year-fellow persona, not a fellow, a technologist
or a faculty reviewer. Nothing here is evidence that the module teaches what it intends to. A
working clock is not approval of the anatomy it animates.

**This document covers two phases.** Everything up to _Backlog raised in passing_ is the original
implementation. An independent review of PR #254 then returned **NOT READY FOR MERGE** on three
findings; _Repair pass after the independent review_ at the end records what was reproduced,
changed and re-run in response, and corrects three claims the review showed were inaccurate. Where
the two phases disagree, the repair pass is current.

## Repository reconciliation

| Field              | Recorded value                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout           | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-bf-1-9-19`                                                                                                                                                                                                                                                                                                     |
| Branch             | `claude/bf-1-9-19`, at `origin/main`                                                                                                                                                                                                                                                                                                                                                         |
| Base SHA           | `c717c9ffae09cb67e19b06a56d37c75487a5605a` (merge of PR #250). The planning package inspected `77a141cc…`; that SHA was **not** restored — this batch reproduced every finding against current main.                                                                                                                                                                                         |
| Starting status    | clean; `git rev-list --left-right --count origin/main...HEAD` = `0 0`                                                                                                                                                                                                                                                                                                                        |
| Source report      | `Bronchoscopy_Foundations_Fellow_Walkthrough.docx`, SHA-256 `3bac73ed7dc966f3cf9482b356f75261c2803ea94892201739a96c690d6d30aa`, read in place in Local-Data                                                                                                                                                                                                                                  |
| Instructions read  | root `AGENTS.md`, `CLAUDE.md`, `docs/local-authoring-assets.md`; the package in place under `Interventional-Pulm-Local-Data/module_update_9_19/BF_Claude_Implementation_Pack` (`00_START_HERE.md`, `01_…`, `FEEDBACK_LEDGER.md`, `PI_EBUS_BBT_BF_COORDINATION.md`, `SOURCE_AND_CODE_NOTES.md`)                                                                                               |
| Prior context read | `docs/gap-remediation/self-paced/BF-01-handoff.md`, `BF-02-handoff.md`, `BF-03-handoff.md`; `docs/gap-remediation/systemic-ux/SYSTEMIC-UX-01-handoff.md` and `-01-postmerge-regression.md`                                                                                                                                                                                                   |
| File ownership     | Every runtime file changed is under `src/features/bronchoscopy-foundations/**` or the BF e2e spec, which `PI_EBUS_BBT_BF_COORDINATION.md` assigns to BF 01–04. **No shared file was changed**: `AnswerVerdict.tsx` (EBUS 01) and the shared feedback/beta wrapper (PI platform 05) are untouched, as are the shared learning-module stage, global CSS, airway meshes and `public/**` assets. |
| Other worktrees    | Checked at start; no other lane holds a BF branch. Dev server on a lane-unique port 3131 (`.claude/launch.json` entry `claude-bf`), isolated Playwright browser profiles, evidence under this session's scratchpad.                                                                                                                                                                          |
| Not done           | No `.env.local` read or written, no owner-profile session, no production data write, no paid API call, no merge, no deploy.                                                                                                                                                                                                                                                                  |

## Reproduction before any edit

All five reproductions were made on the real route at base `c717c9ff`, in the in-app browser at the
report's **1204×987**, ordinary motion, with the 3D scene reported ready (`data-three-state="ready"`)
and the controls enabled. The only server-side error was the unrelated `/api/analytics` 500 caused
by this checkout having no Supabase environment; it is the same one BF-02 recorded and it does not
touch the lesson.

| ID  | Route and step                                                         | What the model did                                                                                                                                                                                                                                       | What the page said                                                                                           |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A1  | `learn?section=protected-accessories`, S16 Part 3, "Watch the example" | Move 4 (`accessory: brush-sheathed`) returned the misreport and left `accessory=brush-exposed`. Move 5 (`verify-accessory`) reported the disagreement. Move 6 (`accessory-move: in-channel`) was **refused**: `accessory-unsafe`, "It is still exposed…" | Final caption: "The protected brush returns into the channel." Accessory select still read `brush-exposed`.  |
| A2  | `learn?section=larynx-and-entry`, S9 Part 3                            | `signals.clockSec` never left 0; `inputs.cords` stayed `narrowing` for 24 s+ with the scene ready                                                                                                                                                        | Every advance at the glottis: "The true folds are not apart. Wait for the breath in…" No phase cue anywhere. |
| A3  | `learn?section=branch-entry`, S6 Part 5                                | `acknowledged` and `captured` recorded; `hold-completed` never fired after 30 s+                                                                                                                                                                         | Goals `hold` and `no-drift` stayed unticked; Continue stayed disabled; nothing showed how long the hold ran. |
| A4  | `learn?section=branch-entry`, S6 Part 3                                | All five goals met after RMSB → trachea → LMSB; wall contacts 0; deflection left at −30°; optical view an almost entirely mucosal field                                                                                                                  | "Done. Every goal on this card is met.", including "…keep the tip off the wall".                             |
| A5  | `learn?section=view-loss`, S8 Part 3                                   | One Withdraw recovered the red-out; 22 further advances at 0°/0° ended inside LMSB; all three goals still met                                                                                                                                            | "Done. Every goal on this card is met." while the view was wall-filled.                                      |
| A26 | same as A5                                                             | At 0° rotation and 0° deflection the tip entered **LMSB**, three times out of three, with no wall contact and no message                                                                                                                                 | Nothing disclosed how the fork is resolved in free drive.                                                    |

### State transitions recorded before changing anything (A1)

| Move | Command                       | `inputs.accessory` after | `inputs.accessoryPosition` after | Engine message                                                               |
| ---- | ----------------------------- | ------------------------ | -------------------------------- | ---------------------------------------------------------------------------- |
| 1    | `accessory-move → in-channel` | `brush-sheathed`         | `in-channel`                     | —                                                                            |
| 2    | `accessory-move → extended`   | `brush-sheathed`         | `extended`                       | —                                                                            |
| 3    | `accessory → brush-exposed`   | `brush-exposed`          | `extended`                       | —                                                                            |
| 4    | `accessory → brush-sheathed`  | `brush-exposed`          | `extended`                       | Assistant (scripted): "The brush is back in its sheath."                     |
| 5    | `verify-accessory`            | `brush-exposed`          | `extended`                       | "The image shows brush, bristles exposed. …they disagree."                   |
| 6    | `accessory-move → in-channel` | `brush-exposed`          | `extended`                       | "It is still exposed: drawing it into the channel now can damage the scope." |

## Root causes

**A1 — the sequence stopped one command short of its own rule.** `scopeAccessory.ts` is correct:
the first protecting command in the `waiting` phase answers with a scripted report and changes
nothing, verification reveals the mismatch (`revealed`), and a **second** protecting command
resolves it. The authored demonstration in `content/courseFlow.ts` issued the protecting command
once, verified, and then narrated a protected return the engine refused. The engine never let an
exposed accessory move; only the caption said it had.

**A2 and A3 — one shared cause.** `components/scope/useScopePlayback.ts` emits the scripted scene's
clock as `onCommand({ type: 'tick' }, 'scripted')`. `engine/stageSession.ts` dropped **every**
`scripted` command on any step carrying `learn` or `course` — which is every step of every course
section, because `content/stageLessons.ts` builds them all from `COURSE_FLOWS`. So `signals.clockSec`
stayed at 0 on the real route: `breathPhaseAt(0)` is `breath-out`, the folds never abducted, and
`clockSec - holdStart >= HOLD_SECONDS` was never true. The engine walkthroughs and flow tests passed
throughout because the test transport sends ticks with a learner input mode (`keyboard`), which the
session accepted; only the production pane sends them as `scripted`.

**A4 and A5 — present-tense words over historical predicates.** `scopeGoalEvaluation.ts` evaluates
`event`, `event-sequence` and `without` tests against the whole history of the step, so a goal met
on the way to the target stays met after the tip has moved on. Two goal labels also asserted
qualities the model does not measure ("keep the tip off the wall", "advance along the visible
lumen"), and the Now card's "Done. Every goal on this card is met." read as a statement about the
picture on the screen. The model has no measure of a visible lumen at all: `signals.view` reported
`clear` in both reproduced lost-view states.

**A26 — not a wiring defect.** See the investigation below.

## What changed

Eleven runtime files, all BF-local, plus the BF e2e spec, three new BF test files and one dev-server
entry.

| Area   | File                                                                                                                               | Change                                                                                                                                                                                                                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | `content/courseFlow.ts`                                                                                                            | The protected-accessories demonstration gains the two movements its own rule requires: a second `accessory → brush-sheathed` after the check, and a second `verify-accessory` before the channel movement. Six captions become eight; moves 4 and 5 now say a command was issued and a report came back, and that the image contradicts it. |
| A2, A3 | `engine/scope/scopeScripts.ts`                                                                                                     | New `ENVIRONMENT_CLOCK_SCRIPTS` and `isEnvironmentClockCommand(view, command)` — the one list the producer and the consumer both read.                                                                                                                                                                                                      |
| A2, A3 | `components/scope/useScopePlayback.ts`                                                                                             | Reads that list instead of hard-coded ids; holds `onCommand` in a ref so the interval effect no longer depends on the callback identity the host rebuilds on every render.                                                                                                                                                                  |
| A2, A3 | `engine/stageSession.ts`                                                                                                           | `SCOPE_COMMAND` accepts a `scripted` command on an authored step **only** when it is the scene's own clock. Every other scripted command stays refused.                                                                                                                                                                                     |
| A2     | `content/sections/larynx-and-entry.ts`                                                                                             | The act view gains `readouts: ['cordsState', 'deflectionDeg']` — the breathing-phase cue the report asked for, from the existing metric.                                                                                                                                                                                                    |
| A3     | `components/scope/types.ts`, `engine/scope/scopeMetrics.ts`, `engine/scope/scopeViewErrors.ts`, `content/sections/branch-entry.ts` | New `holdRemaining` readout, read from the same clock and history as the hold goal, offered only on a view running `assistant-interrupt`.                                                                                                                                                                                                   |
| A2, A3 | `components/scope/ScopeScenePane.tsx`, `scope-scene.module.css`                                                                    | A `role="status"` line above the dock when the scene's clock is held (reduced motion, schematic view or an explicit step control), naming **Step one second** as the way on.                                                                                                                                                                |
| A4, A5 | `engine/scope/scopeGoalEvaluation.ts`                                                                                              | `scopeGoalClaim` / `scopeGoalsClaim` classify a predicate as `history`, `current` or `mixed`; `scopeGoalStatuses` carries the classification.                                                                                                                                                                                               |
| A4, A5 | `components/stage/BronchStageHost.tsx`                                                                                             | Each goal row carries `data-goal-claim`. A line under the list says which kind of claim the card makes, states the model's limit, and prints where the tip is now. The done status on scope and observe cards is bounded the same way.                                                                                                      |
| A4, A5 | `content/sections/branch-entry.ts`, `content/sections/view-loss.ts`                                                                | Three goal labels now name the recorded signal instead of an unmeasured quality.                                                                                                                                                                                                                                                            |
| SUP-16 | `components/scope/ScopeDock.tsx`, `scope-scene.module.css`                                                                         | A described-by note on both accessory selects: choosing a state commands the assistant; the image settles what the accessory is doing.                                                                                                                                                                                                      |

### Before and after, on the real route

| Place                                   | Before                                                                                     | After                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S16 Part 3, last demonstration movement | `brush-exposed` / `extended`, refusal message shown, caption claimed protected             | `brush-sheathed` / `in-channel`, no message, caption matches; misreport still at move 4, disagreement at move 5                                             |
| S9 Part 3, folds                        | `narrowing` for 24 s+, no phase shown                                                      | readout cycles "Apart, on the breath in" ↔ "Narrowing, on the breath out" ↔ "Together, with a scripted cough"; a crossing timed to the opening is reachable |
| S9 Part 3, reduced motion               | Step one second offered, nothing explaining it                                             | Same control, with "The scripted scene is held while motion is reduced…" above the dock                                                                     |
| S6 Part 5, hold                         | never completed; nothing showed its length                                                 | "Scripted hold: 5 of 5 scripted seconds still to run" → "…the assistant is still waiting" → "The scripted hold is finished"                                 |
| S6 Part 3 and S8 Part 3, finished card  | "Done. Every goal on this card is met."                                                    | same, plus "They record this attempt, not the view on the screen now.", a basis line naming the model's limit, and "The tip is in Left main bronchus now."  |
| S6 Part 3, `no-force` goal              | "Advance only with the opening aimed and the lumen in view, and keep the tip off the wall" | "Reach the left main bronchus with no advance refused for want of aim, none made without a clear view, and no wall contact recorded"                        |

Every one of the module's 22 scope cards classifies as `history` (14) or `mixed` (8); none is purely
`current`, so each now carries a bounding sentence.

## A26 — the neutral push at the carina: investigation, not a new anatomical rule

**Reproduced.** In `view-loss` Part 3 (`mode: 'free-drive'`, `assists: {}`), from the trachea at
0° rotation and 0° deflection, an uninterrupted Advance entered **LMSB** in all three runs, with
`contactCount` 0 and no engine message.

**Measured inputs and route, same step.**

| Rotation | Deflection | Airway entered |
| -------- | ---------- | -------------- |
| +90°     | 20°        | RMSB           |
| +90°     | 35°        | RMSB           |
| −90°     | 20°        | LMSB           |
| 0°       | 0°         | LMSB           |

The learner's own controls therefore decide the route; nothing overrides them, and the readout for
this step reports `pointer, unaided` — no assist is engaged or hidden.

**What actually resolves the fork.** In free drive with the reviewed lumen loaded, the tip advances
along its own optical axis against the collider (`lib/airway-anatomy/drive.ts: driveScope`), and
`locateTip` then names the airway from the nearest centerline among the edges sharing a node with
the current one. There is no branch-selection rule, no default side and no fork behaviour to be
wrong: a straight push is a straight push, and the label follows where the tip physically ends up.
The guided-walk views are the ones that carry the aim guard (`scopeMotion.ts`: `requireAim` is set
only for `mode === 'guided-walk'`), and they behave as authored — at the same fork in `branch-entry`
a neutral advance does **not** choose a branch, and an undecided aim prints "Aim the tip into one
opening before advancing: the aim guard will not choose a branch for you."

**The report's premise does not hold in this teaching geometry.** Measured from the authored
`graph.json` for `adult-teaching-combined-left-basal-v1`, over the first 10 mm beyond the carina
node, the right main bronchus leaves the distal tracheal axis at **58.1°** and the left at **59.7°**
(perpendicular offsets 8.87 mm and 10.80 mm at 10 mm along). This model has no markedly straighter
right main for a neutral push to follow. Changing the outcome to "drift right" would mean changing
reviewed source geometry, which this batch is not authorised to do and did not do.

The independent review repeated this measurement with its own stated method and got RMSB 56.69°
(8.36 mm lateral offset) and LMSB 61.06° (8.75 mm): the same conclusion, different numbers. The two
runs sample the tracheal tangent and the branch direction differently, and neither figure is an
anatomical measurement or a reason to prefer a side. Treat the exact degrees as method-dependent,
and the conclusion — these centerlines are near-symmetric at the carina — as the part that holds.

**No change was made.** An owner decision is recorded below with its exact consequences.

## Preserved contracts

- The assistant-misreport rule is unchanged: the first protecting command still changes nothing and
  still answers with the scripted report.
- The guard refusing to move an exposed brush, needle or forceps through the channel is unchanged,
  and the `retrieve-protected` goal's predicate is asserted byte-for-byte in the new tests.
- The closed-fold crossing guard is unchanged; a press against closed folds still records
  `advanced-against-closure` and still leaves `no-advance-against-closure` unmet.
- A `tick` records no input mode (`reduceScope`), so environment time can never make an untouched
  start state count as the learner's work. `learnerActedOnScope` is unchanged. A tick the learner
  presses is not an action either.
- Demonstration playback still runs on its own isolated state (`useScopeDemonstration`), never
  reaches the session reducer, and writes no learner event, no completion and no survey.
- `performedIds` stays historical and sticky; `SKIP_PAST` still records nothing; no score, no
  compulsory correct answer and no navigation penalty exists.
- The self-paced record's survey snapshot contract (BF-03) is untouched; nothing in this batch reads
  or writes `ip-bronchoscopy-foundations-v1`.
- Section, step, goal and item ids are unchanged. No generated data file, source record, review
  status, publication flag, media asset or anatomical annotation changed.
- Reduced motion keeps its manual alternative; nothing here animates for a learner who asked for
  less motion.

## Validation

Environment: local Next dev server on port **3131** (`npm run dev:claude` equivalent with a
lane-unique port), Playwright Chromium with isolated profiles, no remote services. The unrelated
`/api/analytics` 500 (no Supabase environment in this checkout) is stubbed by the e2e suite's own
route handler and is present on unchanged main too.

| Check                                                                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx jest src/features/bronchoscopy-foundations --runInBand`                            | **28 suites passed, 380 passed, 1 todo** (25 suites / 351 passed before this batch; the todo is the pre-existing one)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npx tsc --noEmit`                                                                      | clean (needs `NODE_OPTIONS=--max-old-space-size=8192` on this machine; the default heap OOMs on unchanged main too)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npx eslint e2e/bronchoscopy-foundations.spec.ts src/features/bronchoscopy-foundations` | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npx prettier --check` on every changed path                                            | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `git diff --check`                                                                      | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Playwright, the new acceptance cases                                                    | **all passed** after the repair; **all failed** on the unchanged baseline with the repair reverted and the tests kept. This batch added five test declarations; the overshoot case runs at two widths, so the suite gained **six instances**. The independent review was right that "26 cases / 5 new" undercounted what the runner reports.                                                                                                                                                                                                                                                                 |
| Playwright, the whole BF suite                                                          | **25 passed, 1 failed** on the first full sequential run against a **development** server — `course presentations reflow … at 1440`, on a captured Next dev page error ("Internal Next.js error: Router action dispatched before initialization") while walking all 23 sections back to back. Re-run in isolation it passed 3/3 with the repair and 3/3 with `src/features/bronchoscopy-foundations` reverted to `c717c9ff`, so it is not specific to this change — but the cause of that one failure is **not** established. The independent review did not reproduce it at all against a production build. |
| `npm run build`                                                                         | **succeeds** (exit 0), including the embedded training-app build, contentlayer, the asset validators and `prepare:standalone`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Regressions that fail on the unchanged baseline

Every new mechanism has one. Verified by reverting `src/features/bronchoscopy-foundations` to
`c717c9ff` with the new tests kept in place, running them, and restoring.

| Test                                                                                          | On baseline                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/simulation-truth.test.tsx` (18 cases)                                              | **10 of the first 16 failed, 6 passed**; the two cases added afterwards (restart isolation, capture before acknowledgment) also fail on baseline, where the clock never runs. The cases that pass on baseline are the preserved-contract guards — the misreport, the learner's goal predicate, the closed-fold and exposed-accessory refusals.                                                                |
| `__tests__/scope-playback.test.tsx` (7 cases)                                                 | **1 failed** — two intervals created for one run of scripted time instead of one.                                                                                                                                                                                                                                                                                                                             |
| `__tests__/goal-truth.test.tsx` (4 cases, as this batch first wrote it)                       | **Three of the four failed, not four.** The drift case passed on baseline: the stage harness sends its ticks with a learner input mode, which the baseline session already accepted, so it is a preserved-contract guard rather than fail-before evidence. The independent review was right to call the original claim inaccurate. The file's current seven cases are accounted for in the repair pass below. |
| e2e `the worked accessory exchange keeps its false report and still ends protected`           | fails                                                                                                                                                                                                                                                                                                                                                                                                         |
| e2e `the authored breath moves on its own, and the crossing becomes reachable`                | fails                                                                                                                                                                                                                                                                                                                                                                                                         |
| e2e `the carina hold runs down on its own and finishes on the learner's actions`              | fails                                                                                                                                                                                                                                                                                                                                                                                                         |
| e2e `closed folds still refuse the advance, and the manual step is the reduced-motion way on` | fails                                                                                                                                                                                                                                                                                                                                                                                                         |
| e2e `a finished card after an overshoot records the attempt without describing the view`      | fails                                                                                                                                                                                                                                                                                                                                                                                                         |

### The required proving cases

1. **Brush.** Fresh full playback reaches `brush-sheathed` / `in-channel` with no `accessory-unsafe`
   and no refusal message; the intentional misreport is still at move 4 and the disagreement at
   move 5; "Try with guidance" then starts from `brush-sheathed` / `none` with no goal met and no
   record written. Stepping one movement at a time, replay after finishing, replay after a learner
   attempt was started, and a separate learner attempt were all run; a playback stopped part way
   leaves nothing for the next one to inherit.
2. **Time.** Both exact stalled activities now complete in a production browser on native keyboard
   input: the larynx crossing goal ticks after a press timed to the authored opening, and the carina
   hold finishes on Acknowledge plus Capture. No reducer injection is used in either e2e case. Both
   orders of the hold's two actions are covered (acknowledge then capture in the browser, capture
   then acknowledge in the session test).
3. **Negative controls.** Closed folds still refuse (asserted deterministically under reduced motion,
   where the learner steps the same authored cycle by hand); time running out with no acknowledgment
   and no image leaves every hold goal unmet and the readout saying the assistant is still waiting;
   a 3 mm drift during the hold leaves `no-drift` unmet while the hold itself completes; a background
   tab, an offscreen pane, a scene that is not ready and locked controls each produce no tick at all;
   a scripted `advance`, `capture` or `acknowledge` is still refused; a tick on a view with no clock
   of its own is refused.
4. **A4 and A5.** Target achieved, then deliberately overshot: the earlier events stay recorded and
   the goals stay met, while the card states that they record the attempt rather than the view, and
   prints the airway the tip is in now.
5. **Self-paced contract.** The existing suite covers no-action, explanation-before-answer,
   all-skip, retry, reload and legacy storage; results in the table below. Nothing in this batch
   touches the survey snapshot, and the timed steps write no survey.
6. **Motion, viewport and provenance.** Ordinary motion and reduced motion are exercised separately
   and labelled as such; the existing 1440/900/390 pixel journeys and the 200 % root-text case are
   re-run unchanged. Actual input, model state and rendered pixels are recorded separately above. A
   working clock establishes nothing about the anatomy it animates.

## Unresolved, and what needs a human

1. **Owner decision — the neutral push at a fork in free drive (A26).** The current behaviour is
   authored and consistent: free drive has no aim guard, and the tip goes where its axis takes it.
   Three options, with consequences:
   - **Keep it.** No code change. The learner can still steer either way; the report's expectation
     stays unmet, and nothing on the free-drive views says the fork is resolved physically.
   - **Disclose it.** One sentence in the two `view-loss` view boundaries, mirroring the guided-walk
     boundary that already names its three assists. No behaviour change. This is authored learner
     copy, which lane 02 owns, so it was not written here.
   - **Extend the aim guard to free drive.** A real behaviour change: an undecided advance at any
     fork would be refused everywhere, which changes the `view-loss`, `right-side`, `left-side`,
     `systematic-survey` and `scope-in-a-tube` tasks and their recorded assist disclosure (free drive
     would no longer be "unaided"). Not authorised here.
     Making the neutral input go right instead is **not** an option this batch can support: the
     authored centerlines are near-symmetric at the carina (58.1° vs 59.7°), so it would mean
     replacing reviewed source geometry.
2. **Model decision — what "a visible open lumen" means (A4).** The engine has no measure of it.
   This batch narrowed the claims to what the model records and printed the limit; it did not invent
   a threshold, a pixel classifier or a competence score. If the course wants a goal that is actually
   about the picture, someone has to define it and someone has to approve it. The `branch-entry`
   Part 3 instruction still says "Establish a visible open lumen before advancing", which is an
   instruction rather than a checked achievement — deliberately left as authored copy for lane 02.
3. **Anatomy and media holds are unchanged.** The close-up laryngeal geometry the report describes
   in figure 9.2 item 3 (a pink ring around a curled structure, folds no longer distinguishable up
   close), the BF-02 inlet-geometry TODO, and every "teaching media, pending clinical review" marker
   stay exactly as they were. A phase readout that moves does not make the picture readable, and this
   batch makes no claim about it. Tracked for lanes 03 and 05.
4. **Not run / not claimed.** No faculty review, no learner session, no accessibility audit beyond
   the existing suite, no performance work, no other module's runtime, no Device Intelligence, no
   deployment.

## Backlog raised in passing (not repaired here)

- `useScopePlayback` still derives "manual" partly from `view.controls.includes('step')`; no authored
  view uses that today, so the branch is untested in production. Harmless, worth deleting or using.
- In Playwright 1.62 the `reducedMotion` test option exists only inside `contextOptions`; the BF
  config's context-level `reducedMotion: 'reduce'` is what a `test.use` override has to replace.
  Recorded because the first override attempt silently did nothing.
- The default Playwright action timeout in these configs is 0 (no timeout), so `locator.textContent()`
  on an element that may be absent hangs the whole test. Worth a config default for the next lane.

---

## Repair pass after the independent review

An independent review of PR #254 at head `96291d71fbee4acf250b82caede263941768e02a` returned **NOT
READY FOR MERGE** on three findings. This pass answers all three and corrects the claims the review
showed were inaccurate. It starts from that head; it opens no new scope, starts no second batch and
changes nothing about A1, A2, A3, A26 or SUP-16 beyond the goal wording named below.

### Finding 1 (P1) — the completed A4 card still overclaimed a clear view

**Reproduced first, on the PR head.** Guided walk into RMSB, withdraw to the trachea, enter LMSB,
leave the bend at −30° and advance eight more times, with native keyboard input at 1204×987. All
five rows green, wall contacts 0, a wall-dominated image. What the card said:

| Surface                      | Before this pass                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Lead status                  | `Done. Every goal on this card is met. They record this attempt, not the view on the screen now.` |
| Goal row                     | `… none made without a clear view …`                                                              |
| Model limit                  | small muted paragraph at the foot of the column                                                   |
| Pane list under the controls | five green rows, no framing at all                                                                |

The review was right about the mechanism: a qualifier under a completion headline does not bound the
headline, because the learner has to reconcile the two and the headline wins. The second clause also
was not true of the predicate — `advanced-blind` records an advance made while the **model's own
view signal** was lost, which is not a reading of the image.

**Repaired by changing the hierarchy, not by adding another disclaimer.**

| Surface                      | After this pass                                                                                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead status                  | `Recorded: every step this card asks for.` (history) · `Recorded: every step this card asks for, and its live readings hold.` (mixed) · `Done: every reading this card asks for holds now.` (current)                                                                              |
| Above the rows               | a heading naming what the rows establish: **On the record for this attempt**                                                                                                                                                                                                       |
| Per row                      | `data-goal-claim`, plus a visible `Recorded` / `Now` tag on a card that carries both kinds                                                                                                                                                                                         |
| Below the rows               | a bordered, full-weight block: `Where the tip is now: Left main bronchus. The model records where the tip went, the contacts it counted and the views it marked as lost. It does not judge the bronchoscope image, so nothing on this card says the view on the screen is usable.` |
| Pane list under the controls | the same heading, the same per-row classification and the same limit line                                                                                                                                                                                                          |
| Goal row                     | `… none made while the model recorded a lost view …`                                                                                                                                                                                                                               |

No completion statement now reads as a verdict on the image; the earned events are untouched;
Continue stays enabled, because the learner did the work. The copy lives in one module
(`engine/scope/goalPresentation.ts`) so the card and the pane cannot drift apart.

Two other labels were corrected under the same rule — say only what is recorded:

| Goal                                         | Before                        | After                                                                                                     |
| -------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `branch-entry / no-drift`                    | `… with no change in depth …` | `… with no drift in depth recorded …` (the predicate is `without(drift-detected)`, a tolerance, not zero) |
| `view-loss / lens-cleared-without-advancing` | `Bring a usable view back …`  | `Clear the lens, with no advance made while the model recorded the view as obscured`                      |

Every other BF goal label was audited against its predicate in the same pass. The rest name
recorded events (`wall-contact`, `red-out-recovered`, `glottis-crossed-open`, the accessory events)
or are explicitly instructions to the learner, and were left alone.

**Deliberately not changed.** The `branch-entry` Part 3 instruction still reads "Establish a visible
open lumen before advancing." It is an instruction, not a claim the card checks, and the card now
states plainly that the model does not check it. Rewriting authored section copy belongs to lane 02.

### Finding 2 (P2) — cumulative inspection records were classed as the scope's present state

**Reproduced.** `scopeGoalClaim` put `ledger` and `ledger-complete` in `current`. The inspection
ledger keeps every declaration and observation after the scope leaves the airway they were made in,
so a met ledger goal is a record of the attempt. On the systematic-survey card that made
`no-airway-left-blank` read as `current` and `inspect-the-lobe` as `mixed`, and the card then told
the learner that some of its goals "read the state the scope is in now" — after the scope had
withdrawn to the bronchus intermedius.

**Repaired centrally**, in the classifier rather than in the displayed strings: the distinction is
what a predicate can still establish later, not which syntax it uses. `ledger` and `ledger-complete`
are now `history`.

Full inventory after the repair, over all 22 BF scope cards:

| Class                                              | Goals | Cards                                          |
| -------------------------------------------------- | ----- | ---------------------------------------------- |
| history — a record that survives the tip moving on | 40    | 14                                             |
| current — a live reading that stops holding        | 0     | 0                                              |
| mixed                                              | 9     | 8 (five-controls ×7, branch-entry `hold-view`) |

`systematic-survey` moved from `mixed` to `history`, which is the finding. No card is purely
`current` today, so `scopeDoneLead('current')` is unreachable from authored content; it is kept
because a `location`- or `metric`-only goal would produce it, and it is covered by a unit case.
Representative rendered examples were checked for `history` (view-loss and branch-entry practice,
systematic-survey) and `mixed` (branch-entry `hold-view`, whose four rows render as
`Recorded / Recorded and now / Recorded and now / Recorded`).

### Finding 3 (P2) — 3D restore after an asset failure: **pre-existing, not a PR regression**

Reproduced on both revisions with the same script, the same production-shaped browser conditions and
the same assertions: abort `**/anatomy/larynx/**`, reach S9 Part 3, take **Use the schematic view**,
restore the route, then take **Try the 3D view again**, and wait 30 s for readiness.

| Step                             | PR head `96291d71`                                             | Baseline `c717c9ff` |
| -------------------------------- | -------------------------------------------------------------- | ------------------- |
| initial                          | `data-three-state="failed"`, "The 3D view could not be loaded" | identical           |
| after **Use the schematic view** | schematic pane, `data-scope-state="fallback"`                  | identical           |
| after **Try the 3D view again**  | `data-three-state="loading"`, never ready within 30 s          | identical           |

Every runtime file under `src/features/bronchoscopy-foundations` was confirmed byte-identical to
`c717c9ff` for the baseline run (`git diff c717c9ff --name-only` returned no runtime path). The only
difference in the captured state is the PR's own "the scripted scene is held" status line, which has
nothing to do with readiness.

**Disposition: CASE 1 — pre-existing, out of scope for this bounded repair. No code changed and no
regression added**, because pinning a live defect in a test is worse than leaving it visible.

Mechanism, from source and unproven at browser level: `useScopePlayback` binds its
`IntersectionObserver` to `root.current` in an effect whose only dependency is the ref object, whose
identity never changes; `ScopeScenePane` attaches that same ref to a _different_ node in the
schematic branch and the 3D branch. Switching back therefore leaves the observer on the removed
node, `visible` stays false, `Scene` keeps `frameloop="never"`, `RenderLifecycle` never runs a frame
and `onDraw` is never called — so `status` stays `loading`. Both the ref/observer lifecycle and the
node swap are present unchanged in the baseline. A fix would rebind the observer when the observed
node changes; that is a 3D-lifecycle change this pass is not authorised to make.

### Validation for this pass

Production build, then the **complete** BF browser suite against `npm run start:prod`, not the dev
server.

| Check                                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/bronchoscopy-foundations --runInBand`                                       | **28 suites, 386 passed, 1 pre-existing todo** (380 before this pass)                                                                                                                                                                                                                                                                                                                                     |
| `npx tsc --noEmit`                                                                                 | clean                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npx eslint e2e/bronchoscopy-foundations.spec.ts src/features/bronchoscopy-foundations`            | clean                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npx prettier --check` on the changed paths                                                        | clean                                                                                                                                                                                                                                                                                                                                                                                                     |
| `git diff --check`                                                                                 | clean                                                                                                                                                                                                                                                                                                                                                                                                     |
| `NEXT_PUBLIC_SHOW_DRAFT_MODULES=true npm run build`                                                | succeeds (exit 0)                                                                                                                                                                                                                                                                                                                                                                                         |
| `PORT=3254 npm run start:prod`, BF route                                                           | HTTP 200                                                                                                                                                                                                                                                                                                                                                                                                  |
| Complete BF Playwright suite against that production server                                        | **28 passed, 0 failed, 0 retries, 7.3 minutes** — the complete suite (21 existing declarations plus this batch's, 28 instances), including the 23-section reflow walk at 1440 that failed once against a development server in the first phase, all four reflow widths, the 200 % root-text case and every new acceptance case. Built from exactly the committed source.                                  |
| New cases against the pre-repair implementation (PR head `96291d71`, runtime reverted, tests kept) | **8 failed, 20 passed** across `goal-truth` and `simulation-truth`. The passes are preserved-contract guards and the A1/A2/A3 cases this pass did not touch. Two of the new cases pass there for a weak reason and are labelled as guards, not fail-before evidence: the mixed-card classification was already correct, and the copy-constant case only imports a module that the revert leaves in place. |

Files changed in this pass:

- `engine/scope/goalPresentation.ts` _(new)_ — the one place the card and the pane take their words.
- `engine/scope/scopeGoalEvaluation.ts` — `ledger` and `ledger-complete` are history.
- `components/stage/BronchStageHost.tsx`, `components/stage/bronch-stage.module.css` — the heading,
  the per-row tag, the prominent limit block, the new leads.
- `components/scope/ScopeFallback.tsx`, `components/scope/scope-fallback.module.css` — the same
  treatment for the duplicated list under the controls.
- `components/scope/types.ts` — the pane contract carries each goal's classification (additive).
- `content/sections/branch-entry.ts`, `content/sections/view-loss.ts` — three goal labels.
- `__tests__/goal-truth.test.tsx`, `__tests__/simulation-truth.test.tsx`,
  `e2e/bronchoscopy-foundations.spec.ts` — the regressions below.

New and updated regressions:

- **Overshoot, both widths and both themes** (browser): requirement achieved → deliberate overshoot
  → the earlier events stay recorded → the lead is `Recorded: every step this card asks for.` → the
  card contains no "Every goal on this card is met" → the heading and the limit block are present,
  and remain visible after a real theme toggle → the live airway is printed separately → no
  horizontal overflow. Screenshots retained per width and theme.
- **A completed inspection record stays a record** (browser and component): all five survey goals
  classed `history`, the card carries no "Read from the scope right now", and after withdrawing to
  the bronchus intermedius every row is still a record and the live location says so.
- **The pane's own green list** (component): same classification, same heading, same limit line.
- **Wording** (component and unit): the entry card says `no wall contact recorded` and
  `while the model recorded a lost view`, and no longer says `keep the tip off the wall`,
  `without a clear view`, `usable view` or `no change in depth`.
- **Mixed cards** (component): `hold-view` renders `history / mixed / mixed / history` with visible
  per-row tags, and its lead names both kinds.
- **Classifier** (unit): `ledger` and `ledger-complete` are history; `location`, `metric` and
  `bench-target` stay current; no lead may contain "Every goal on this card is met".

### Theme coverage for the new copy

The overshoot case toggles the site theme with the site's own control at the desktop width and
checks that the heading, the limit block and the pane's limit line are all still visible, with a
screenshot in each theme. Two honest limits: the module's lesson stage renders on its own dark
surface in both site themes, so the new heading and limit block have one appearance and the toggle
changes the chrome around them rather than the card; and at phone width the site's theme control
sits inside the collapsed navigation, which is chrome this pass does not drive, so the 390 px case
runs in the default theme only. This is a visibility check, not a contrast audit.

### What this pass did **not** establish

- **Actual hidden-tab browser acceptance remains unverified.** Chromium reported both pages
  `visible` after native tab activation in the review's environment, and the Claude in-app browser
  pane reports `hidden` whenever it is not displayed. The hidden/resume/no-catch-up behaviour has
  passing hook-level evidence only. This pass changed no clock or lifecycle code, so it did not
  re-open that question.
- The 3D recovery failure above is **live on both revisions** and is not fixed here.
- Every human hold from the first phase stands unchanged: open-lumen meaning, laryngeal close-up
  readability and inlet geometry, A26's owner decision, source/media/clinical review.

### Readiness

**READY FOR INDEPENDENT RE-REVIEW.** Findings 1 and 2 are repaired with regressions that fail on
the reviewed head; finding 3 is reproduced identically on the baseline and handed on unchanged, with
its evidence. The three inaccurate claims the review identified are corrected above. Nothing is
merged or deployed, and no other batch was started.

---

## Closure pass — the residual accessibility overclaim (re-review of `6e5af351`)

The re-review accepted the visible repair above — historical completion reads as a record, the
current location is separate, the wall-dominated image is not approved, and the goal wording is
bounded to recorded model signals — and held **finding 1 open** on one surface the first pass never
touched: the accessible name of the optical field itself.

### What was still wrong

`signals.view` is a **model state signal**. The reducer derives it from two recorded conditions and
nothing else (`scopeReducer.ts`): a red-out, or a contaminated lens. Everything else is `clear`.
Both optical surfaces translated that signal straight into a claim about the picture:

| Surface                  | Accessible name on `6e5af351`                            |
| ------------------------ | -------------------------------------------------------- |
| WebGL optical field      | `A clear view through the scope`                         |
| DOM / schematic fallback | `The view through the scope: a clear view of the airway` |

"A clear view" is the differential's own row name for a usable image (`view-loss`, "a clear view of
an airway you cannot name"), so a learner is taught to read it as exactly the claim the model does
not make.

**Reproduced on the reviewed head, with the learner's own controls**: into RMSB, back through the
trachea, into LMSB, deflection set to −30°, then 25 advances. The result is the state the review
described — `place: airway`, `Left main bronchus`, `signals.view === 'clear'`, `lossOfViewCount: 0`,
**no opening in view**, and the camera's own forward axis running into the wall at **7 mm**, down
from 14 mm along the open bronchus. A wall-dominated image named "a clear view".

### The repair

One mapping, in the file the review traced it to, read by **both** renderers, so neither path can
hand a learner the stronger claim:

| Signal         | What the name now says                                                     |
| -------------- | -------------------------------------------------------------------------- |
| `clear`        | `Scope view · what the model records: no red field, smear or dark field`   |
| `red-out`      | `Scope view · what the model records: a red field over the whole view`     |
| `contaminated` | `Scope view · what the model records: a smeared field over the whole view` |
| `dark`         | `Scope view · what the model records: a dark field over the whole view`    |

Why the four values are not treated alike: `red-out`, `contaminated` and `dark` each **paint the
whole field themselves**, through the `data-lens-state` and `data-view-signal` rules in the two
optical stylesheets, so naming the field for those describes what the renderer actually draws.
`clear` has no rule at all — it paints nothing. It means only that neither recorded condition is
present, and the picture is then whatever the airway ahead gives. So `clear` reports the absence of
the recorded conditions and stops.

The lead is shared, so the text says _that it is a model record_ rather than asserting more than the
engine establishes. No value names a mechanism: the cause of a red or dark field is the answer
`view-loss` asks for, and its deny pattern forbids it.

The fallback still appends the openings it measures (`Openings ahead: …`), which is a separate,
projected geometric fact and is unchanged.

**Not changed:** the reducer, `signals.view` itself, `data-view-signal`, any visual rendering, the
image geometry, goal evaluation, scoring, navigation, and the history/current classification.

### Regression coverage

`__tests__/optical-view-truth.test.tsx` (15 cases) drives the reproduction above and pins:

- the overshoot state itself — signal `clear`, no opening in view, the forward run collapsing to
  under half its open-bronchus value;
- **(A)** the WebGL name matches none of eight visual-quality patterns (`clear view`, `clear
airway/lumen/field`, `open lumen`, `good view`, `unobstructed`, …);
- **(B)** it reports the model's signal and says so, under the shared lead;
- **(C)** the fallback's rendered `aria-label` **equals** the scene's name for the same signal, for
  every one of the four values;
- every value is free of the mechanism patterns and of the learner copy gate;
- **(D)** the accepted record and live-location presentation still renders, and nothing on the pane
  matches a visual-quality claim.

**Fails on `6e5af351`:** with the three source files reverted and the same assertions applied to the
old API, both probes fail on the exact reported strings — `A clear view through the scope` and `The
view through the scope: a clear view of the airway`.

### Card subtotals corrected

The re-review confirmed the goal inventory (40 history, 0 current, 9 mixed across 22 cards) and
found the **card** subtotals inaccurate. Recomputed from the implementation over all 22 cards:
**14 history, 0 current, 8 mixed** — the mixed cards being the seven `five-controls` learn cards
and `branch-entry / hold-view`. The handoff previously said 18/4 in prose and 16/6 in the table,
which also disagreed with each other, and the parenthetical said `five-controls ×5` where the
implementation has seven. The prose, the table and
`BF-PRE-REVIEW-01-dispositions.json` are corrected to the verified numbers. **The classifier was not
touched**; the implementation was already accepted and it is the documentation that was wrong.

### Readiness

**READY FOR FINAL CODEX CLOSURE REVIEW.** The residual overclaim is repaired at its source for both
renderers, with a regression that fails on the reviewed head. Finding 2 stays closed, finding 3
stays handed on as pre-existing and untouched, and hidden-tab browser acceptance remains the
documented limitation above. No new BF product scope, no second batch, nothing merged or deployed.
