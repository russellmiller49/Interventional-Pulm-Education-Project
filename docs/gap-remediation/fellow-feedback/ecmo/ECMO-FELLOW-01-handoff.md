# ECMO-FELLOW-01 — recoverable cases and truthful operational state

Implementation: September 21, 2026. Prepared by Claude (AI implementation). **Not reviewed by a
clinician, a perfusionist or a device specialist.**

**Result.** The two P0 rows — the air-case resumption dead end on both tracks — are repaired end to
end and are now reachable through the rendered control, with the reducer's safety refusals intact.
Of the nineteen assigned source IDs, **eleven are repaired**, **four are partly repaired with the
remaining subpart held or deferred to a named lane**, **three are contained** (the claim is made
truthful while the underlying clinical question stays open with a named owner), and **one was not
reproduced in this batch**. Nothing here is clinical, device or release approval, and no
`OWNER_DECISIONS.md` hold is closed.

**Evidence provenance.** Every source row comes from `CARDIOHELP_ECMO_learner_walkthrough.docx`
(44 pages, walked September 19, 2026), an **AI-assisted browser walkthrough written in a
first-year-fellow persona**, with GPU disabled partway through. It is not a learner study, not
participant data, and not clinical or device approval. Its screenshots are **observations of a
past run, not proof of current code behaviour**; every row below was independently reproduced
against the code at the baseline SHA before anything was changed.

## Scope and baseline

- Task file `01_ECMO_RECOVERY_AND_STATE_TRUTH.md`, read with `00_START_HERE.md`,
  `FEEDBACK_LEDGER.md`, `SOURCE_AND_CODE_NOTES.md`, `CROSS_MODULE_COORDINATION.md`,
  `OWNER_DECISIONS.md`, `SHARED_FEEDBACK_HANDOFF.md` and the DOCX, at
  `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/module_update_9_19/ECMO_Claude_Implementation_Pack`.
  Repository `AGENTS.md` and `CLAUDE.md` read.
- Branch **`claude/ecmo-fellow-01`**, worktree
  `Interventional-Pulm-Education-Worktrees/claude-ecmo9-21`.
- **Baseline SHA `c717c9ffae09cb67e19b06a56d37c75487a5605a`** — `origin/main` at the start of the
  session, and what every "before" observation below was taken against.
  `git log 77a141cc..c717c9ff -- src/features/cardiohelp-ecmo` is **empty**: the ECMO tree at the
  baseline is byte-identical to the pack's inspection snapshot `77a141cc`, so the pack's code leads
  applied unchanged. The snapshot was not used as a rollback point.
- **`origin/main` moved during the session** to
  **`d9dbfa2ec33c00f90395c14ec1dc6634623551e2`** (PR #253, peripheral imaging). The branch was
  rebased onto it before the PR. #253 touches no ECMO path; the critical-care baseline failures are
  identical on both commits (below).
- **Checkout deviation, disclosed.** The harness pins this session to the dated worktree
  `claude-ecmo9-21` rather than the permanent `claude` worktree `CLAUDE.md` names. It was clean,
  level with `origin/main`, exclusively owned, and no branch was switched while dirty.
- **Concurrency.** `git worktree list` at the start showed no other session holding an ECMO branch.
  No second ECMO writer ran. No other worktree's dev server or watcher was touched.
- **Shared-ownership boundaries honoured.** `AnswerVerdict.tsx` (EBUS #249) and
  `ChoiceReasoningFeedback.tsx` (the coordinated shared-feedback follow-up, `SHARED_FEEDBACK_HANDOFF.md`)
  were **not edited**; S1-1 stays with that owner. Global site header, language selector, footer,
  feedback storage and the beta wrapper were **not edited**; those remain with PI platform task 05.
  Device Intelligence, Airway Stent Mechanics and ICU Simulation were not touched.
- **One file outside `src/features/cardiohelp-ecmo` changed**:
  `src/features/critical-care/__tests__/learner-copy.test.ts`. It holds a registry of documented
  ECMO copy exceptions keyed to exact sentences; IV-3 rewrote one of those sentences, and the
  registry entry was updated to the new wording with the same term and the same reason. That is the
  test doing its job, not a relaxation: the guard still fires on the new sentence plus a grading
  label, and still fires if the sentence moves to another file.

## What this batch did not touch

No physiological coefficient, clinical range, alarm limit, hemolysis model, mixing-location
calculation, weaning rule, ventilator prescription, device gas or pressure behaviour, or clamp /
exchange sequence was added or changed. No answer key, `correctChoiceIds` entry, choice
`plausibility`, reassessment `correctOptionId`, scenario expectation, objective, penalty value or
evidence identifier was changed. No new persistence, score, mastery threshold, first-attempt
history, reveal penalty, assistance tracking, required acknowledgment or correctness gate was
introduced, and no legacy progress record is read or written differently.

## Disposition of every assigned source ID

Reproduced against the baseline SHA by driving the real reducer and rendering the real components
in jsdom, and the repaired learner journeys re-checked in Chromium against the production build
(see [Verification](#verification)). "Repaired" means the behaviour changed and a portable
failing-before / passing-after check exists.

| ID         | Sev · page | What was reproduced at `c717c9ff`                                                                                                                                                                                                                                                                                                                                                    | Status                                          | What changed                                                                                                                                                                                                                                                                     |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C7-1**   | P0 · p40   | VV air case: after `air-deair` clears `bubbleResetRequired`, the rendered Resume control is **disabled**, while the reducer would have accepted the transition. The case cannot be completed.                                                                                                                                                                                        | **Repaired**                                    | Single eligibility contract shared by control and reducer.                                                                                                                                                                                                                       |
| **VAC7-1** | P0 · p41   | VA air case: identical. Additionally the control is **live before any clamp or de-airing**, over a circuit with air in it.                                                                                                                                                                                                                                                           | **Repaired**                                    | Same contract; the control is now dead while air is outstanding and live only once isolated and clear.                                                                                                                                                                           |
| **C3-1**   | P0 · p40   | Tension-pneumothorax case, speed 3200 → 3600: at t+1 the model's pressure interlock stops the pump; at t+2 flow is 0.00, all four pressure channels go unavailable, and the pressure alarm clears **with the channel it was keyed to**, leaving "No active alarm" beside a speed of 3600. `pumpRunning` is `false` — the pump is **not** rotating, contrary to the report's reading. | **Repaired (presentation); clinical part held** | The model's protection event is named on screen and recorded in history; the speed is labelled as requested. Exact CARDIOHELP behaviour and alarm remain **ECMO-OWNER-03**.                                                                                                      |
| **C1-2**   | P1 · p39   | VV initiation: after a safety event the Now card is replaced by a Safety card whose only action is Restart, ahead of the branches that carry "Reveal causal debrief".                                                                                                                                                                                                                | **Repaired**                                    | Primary action is now the case explanation; Restart is retained as a choice.                                                                                                                                                                                                     |
| **C5-1**   | P1 · p40   | Recirculation: the same branch, same single Restart action.                                                                                                                                                                                                                                                                                                                          | **Repaired**                                    | Same change; the branch is shared.                                                                                                                                                                                                                                               |
| **C7-2**   | P3 · p40   | The harmful card "Unclamp and restart before de-airing" completes as "Completed · …" / "Applied", identical to a correct action.                                                                                                                                                                                                                                                     | **Repaired (01 part)**                          | Completed cards are badged by authored effect. The checklist-ordering half is **04**.                                                                                                                                                                                            |
| **VAC7-2** | P3 · p41   | A premature resumption raises `premature-bubble-reset`, which appears in **neither** scenario's `unsafeActionPenalties`, so the card reads the generic "A safety stop was recorded for an action this case treats as unsafe."                                                                                                                                                        | **Repaired**                                    | Canonical safety-event label registry behind the authored labels; a test holds it complete against every identifier the reducer raises.                                                                                                                                          |
| **S15-2**  | P3 · p38   | A blocked resumption and a blocked bubble reset are greyed-out controls with **no message**.                                                                                                                                                                                                                                                                                         | **Repaired (01 part)**                          | Both controls carry a live, accessible reason. The "add a bedside-support action" half is **not done**: synthesizing one is out of scope, and reusing an authored action needs **05**.                                                                                           |
| **S7-2**   | P2 · p36   | Hold-to-ramp continues after window blur, after the tab is hidden, and after a pointer release outside the button; a hold that ends off the button leaves a stale flag that swallows the **next keyboard activation** of the stepper. Flow stays 0.00 with "the pump is stopped" until a separate step.                                                                              | **Partly repaired**                             | Repeat ends on blur, hidden tab, release-anywhere and unmount; the stale flag is released on its own schedule. Speed is labelled as requested. **Ramp rate deliberately unchanged** (below). Off-screen "+" at 1280 px is **03**.                                                |
| **S7-3**   | P1 · p36   | The stopped-pump sensor-check option is refuted with language that reads as a rule about circuits, not about this model. A transducer does read a static pressure with the pump stopped.                                                                                                                                                                                             | **Contained**                                   | The rationale now says the reflex is sound and that only this simulation's convention refutes it, and names the open decision. **Key unchanged — not re-keyed.** Classification remains **ECMO-OWNER-01**.                                                                       |
| **S7-5**   | P3 · p36   | "Allow self-test completion, verify the audible indicator" — one click records both; this model runs no diagnostic and produces no sound.                                                                                                                                                                                                                                            | **Repaired (01 part)**                          | The step now separates what the click records from what it only describes. Tab-label naming, the ≡ → Alarm list path, SvO₂ 69.8 vs 74.6 and "steps" vs "tasks" are **03/04** and **02**.                                                                                         |
| **S10-2**  | P1 · p37   | "Escalate the identified oxygenator problem" retires the resistance fault and returns the circuit to reference in one simulated second, with no exchange represented.                                                                                                                                                                                                                | **Repaired (01 part)**                          | The composite action is named as a teaching transition standing for the completed exchange, in both lessons and the Practice action label. **No timing, risk or new outcome added** — that is **05**.                                                                            |
| **S14-1**  | P2 · p37   | The blender prints "delivered 0.0 L/min — sweep flow reaching the membrane", a claim a flowmeter cannot make.                                                                                                                                                                                                                                                                        | **Contained**                                   | Labelled as the blender's own flowmeter, with what it cannot know and the bedside checks named. **Still shown before the prediction** — withholding gas-path evidence is explicitly forbidden. Recovery timing is **02**; device display per disconnection is **ECMO-OWNER-02**. |
| **S17-4**  | P2 · p38   | "Restore verified gas source" is greyed in a foundation section because that host passes `controlsEnabled={false}` by design; the console says so, the gas panel did not. The clock running while reading was **not reproduced** in this batch.                                                                                                                                      | **Partly repaired; clock part NOT RUN**         | The gas panel carries the same read-only reason as the console. Clock ownership and pacing are **02**; RR/WOB coupling is **05**.                                                                                                                                                |
| **C1-5**   | P3 · p40   | The context strip prints "2,800 rpm" beside a case whose support status is `not-on-ecmo`.                                                                                                                                                                                                                                                                                            | **Repaired (01 part)**                          | Speed reads as requested, with the reason, wherever the pump is not turning. Button styling and "Compare this prediction" are **03/04**; the debrief's Next target is the authored next case by design and is left.                                                              |
| **VAC5-2** | P3 · p41   | "Escalate the configuration decision" reports "The support strategy is revised and upper-body oxygen delivery begins to recover" while nothing patches the right-arm saturation.                                                                                                                                                                                                     | **Repaired**                                    | The response and the case completion line say escalation is escalation and point at the live right-arm reading. Effect, credit and required list unchanged.                                                                                                                      |
| **IA-3**   | P1 · p42   | VA integrated case: the Now card says "The cause is addressed" and the debrief timeline prints "Corrected scenario cause: differential-hypoxemia" — for a fault this engine deliberately keeps **active**, with right-arm SpO₂ still low.                                                                                                                                            | **Repaired**                                    | Recognition-only faults are recorded and described as recognition and escalation; the debrief adds an explicit note. **SpO₂ was not forced to normalize.**                                                                                                                       |
| **IA-4**   | P2 · p42   | The context strip chip reads "No alarm" while the console shows a HIGH alarm. Both are correct: the strip is device-scoped, the console alarm is an **independent patient-monitor** alert (`RIGHT_RADIAL_LOW`). Separately, both integrated cases print "No lesson in this track teaches this mechanism yet" because a capstone unit lists no cases and so appears in no lookup.     | **Repaired**                                    | The chip says "No device alarm"; the two surfaces are deliberately **not** synchronised. Capstone lessons resolve through the existing mechanism vocabulary.                                                                                                                     |
| **IV-3**   | P1 · p42   | VV integrated case: after a failed off-sweep trial the debrief reads "No safety event is recorded." with no patient readings beside it.                                                                                                                                                                                                                                              | **Repaired (01 part)**                          | The sentence says what the empty log is a statement about; the patient's actual readings at the reveal are printed beside it. A pass/fail decision and a resume action are **04/05** and were **not invented**.                                                                  |

## The state machine, by canonical registry id

Menu numbers in the source are locators. These are the identifiers, and who owns each piece of
state.

| Surface                       | Registry id                           |
| ----------------------------- | ------------------------------------- |
| Learn 15 air drill, VV        | `arterial-bubble-stop`                |
| Learn 15 air drill, VA        | `va-arterial-bubble-stop`             |
| Clinical air case, VV         | `clinical-vv-circuit-air-embolism`    |
| Clinical air case, VA         | `va-clinical-circuit-air-embolism`    |
| Clinical VV 1 (initiation)    | `clinical-vv-initiation-ards`         |
| Clinical VV 5 (recirculation) | `clinical-vv-recirculation-migration` |
| Integrated case, VV           | `vv-off-sweep-capstone`               |
| Integrated case, VA           | `va-mixed-circulation-capstone`       |

| Concept                           | Owner                                                                   | Note                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Active fault                      | `scenario.activeFaults`                                                 | Recognition-only faults stay here after "correction".                |
| Corrected fault                   | `scenario.correctedFaults`                                              | The drill writes it; the clinical de-air patch does not.             |
| Air detector                      | `circuit.arterialBubbleDetected`                                        |                                                                      |
| Console intervention latch        | `circuit.bubbleResetRequired`                                           | **Not** the resumption precondition. This was the defect.            |
| Isolated circuit                  | `circuit.drainageClampClosed` + `circuit.returnClampClosed`             |                                                                      |
| Requested speed                   | `device.rpmSetpoint`                                                    | A setting. Never zeroed by the interlock.                            |
| Pump turning                      | `device.pumpRunning`                                                    | Moved by the bubble stop, the pressure interlock and support status. |
| Modeled flow                      | `circuit.bloodFlow`                                                     | Forced to 0 whenever the pump is not running.                        |
| Clinical support status           | `scenario.clinical.supportStatus`                                       |                                                                      |
| Attempted vs applied intervention | `ClinicalInterventionResult.blocked` vs `clinical.appliedInterventions` | A refused attempt no longer logs as applied.                         |
| Simulated response observed       | `getObservationProgress` (anchor + minimum seconds)                     | Distinct from the reassessment the learner picks.                    |
| Reassessment selected             | `scenario.reassessment`                                                 |                                                                      |
| Safety events                     | `scenario.criticalErrors`                                               | Named through `describeSafetyEvent`.                                 |
| Debrief visibility                | `scenario.phase === 'complete'`                                         | Revealing changes only this.                                         |

### Resumption transition matrix — before and after

`resolveBubbleResumption(state)` is the single contract. The **UI enabled** columns are what the
rendered `#cardiohelp-resume-support` control does; the **reducer** columns are what
`RESUME_SUPPORT_AFTER_BUBBLE` does on a direct dispatch.

| State (clinical air case)                                        | UI before               | UI after                                       | Reducer before                                        | Reducer after               |
| ---------------------------------------------------------------- | ----------------------- | ---------------------------------------------- | ----------------------------------------------------- | --------------------------- |
| Opening state: air detected, latch set, both limbs open          | **enabled**             | disabled · "air source has not been corrected" | refuse + charge `premature-bubble-reset`              | unchanged                   |
| Return clamped only                                              | **enabled**             | disabled · same reason                         | refuse + charge                                       | unchanged                   |
| Both clamped, not de-aired                                       | **enabled**             | disabled · same reason                         | refuse + charge                                       | unchanged                   |
| Both clamped, de-aired (`air-deair` applied)                     | **disabled — dead end** | **enabled** · eligible                         | perform                                               | unchanged                   |
| Resumed once                                                     | disabled                | disabled · "already been resumed"              | **refuse + charge `air-correction-before-isolation`** | **no-op, nothing charged**  |
| Corrected without ever isolating (hand-built)                    | disabled                | disabled · "never isolated"                    | refuse + charge                                       | unchanged                   |
| Ordinary circuit, no air event                                   | disabled                | disabled · "no air event outstanding"          | refuse + charge                                       | **refuse, nothing charged** |
| Learn drill after `CORRECT_FAULT` (latch deliberately still set) | enabled                 | **enabled** — unchanged                        | perform                                               | unchanged                   |

Reaching `never-isolated` through a legitimate path is impossible: `CORRECT_FAULT` on
`arterial-bubble` and the clinical de-airing patch are both refused while either limb is open, so
the air can only be dealt with from isolation. The branch is kept and asserted against a hand-built
state so that guard cannot be removed silently.

## Deliberately not changed

- **The hold-to-ramp rate (S7-2).** 200 rpm per 90 ms at full widening is this interface's key
  repeat. An earlier owner review asked for a hold that brings a stopped pump to a working speed in
  one gesture, and `a3-sequencing-naming-boundaries.test.tsx` encodes it. The finding's substance —
  that the number reads like a device ramp — is a copy problem, and the hint now says plainly that
  the rate belongs to this interface and the value is a request. Slowing it is an owner decision,
  not this batch's.
- **The stopped-pump sensor question's key (S7-3).** Re-keying it is explicitly forbidden and is
  ECMO-OWNER-01.
- **The clamp order and the resumption choreography.** The bounded "per IFU / local protocol"
  abstraction is preserved verbatim; ECMO-OWNER-08 stays open.
- **When the blender reading appears (S14-1).** It stays visible before the prediction. Hiding
  gas-path evidence until after an answer is forbidden by the task.
- **The integrated cases' physiology.** No saturation, pressure or trajectory was moved to make a
  label true. Where a label was false, the label changed.

## Verification

### Commands

| Command                                                                                                      | Exit      | Result                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/cardiohelp-ecmo`                                                                      | 0         | **75 suites, 2356 tests passed** (25 new).                                                                                                |
| `npx jest src/features/critical-care`                                                                        | 1         | 3 suites / 3 tests failed — **identical set and count on a clean `d9dbfa2e` checkout**; all in MV/MCS/CRRT copy and layout, none in ECMO. |
| `npx jest src/features/learning-module src/features/mechanical-circulatory-support src/features/baxter-crrt` | 0         | 112 suites, 1548 tests passed.                                                                                                            |
| `npx tsc --noEmit`                                                                                           | 0         | Clean.                                                                                                                                    |
| `npx eslint <changed paths>`                                                                                 | 0         | Clean.                                                                                                                                    |
| `npx prettier --write <changed paths>`                                                                       | 0         | Applied.                                                                                                                                  |
| `npm run build`                                                                                              | see below | Production build.                                                                                                                         |

### The clean matched baseline

`src/features/critical-care` was run on a detached checkout of `d9dbfa2e` with no working-tree
changes. It failed the same three tests: the CRRT authored-station-order row, the colour-coded
accessibility row, and the general "static component copy free of grading and software-internal
labels" row (162 findings, all in `mechanical-ventilation` and `mechanical-circulatory-support`
files). The ECMO-specific copy row **passes on this branch**; it failed mid-implementation and was
resolved by updating the documented exception, as described under Scope.

### Portable tests added

`src/features/cardiohelp-ecmo/__tests__/ecmo-fellow-01-recovery-and-state-truth.test.tsx`, 25
checks in five blocks matching the task's sections A–E, each of which fails on the baseline tree:

- **A** — registry inventory for the four air surfaces and one eligibility answer for both readers.
- **B** — clean VV and VA resumption through the **rendered** control; recovery after an unsafe
  early attempt with the safety event preserved; unsafe direct dispatch still refused;
  missing-prerequisite guard; repeat click idempotent; restart resets this case only; both Learn
  bubble workflows unchanged; a disabled control's accessible reason.
- **C** — two safety-event debrief paths (VA air, VV tension pneumothorax) reaching the explanation
  without restarting; revealing clears no event, runs no treatment, records no observation, moves
  no credit, penalty, time or patient value; every safety identifier the reducer raises is named.
- **D** — C3-1 protective stop with a valid running and a valid not-started reference control;
  independent-monitor alerts are not device alarms; capstone lesson links; a held stepper stops on
  window blur and does not swallow the next activation.
- **E** — explanation-only path fabricates no intervention, time or correction; the exchange step is
  named as a teaching transition; the blender label; no score, attempt or stored record moves.

### Real Chromium against the production build

`npm run build` exited **0** (`BUILD_EXIT=0`, Next 16.2.2, webpack, TypeScript clean, standalone
output prepared). This worktree's dev server and watchers were not running; no other worktree's
server was touched. The build was served with `PORT=3128 npm run start` — a port no other checkout
uses (3001 primary, 3110 codex, 3120/3122/3123 in use elsewhere) — and driven with headless
Chromium through Playwright 1.62, **GPU not disabled**, a fresh profile per run, and no signed-in
account.

**All evidence in this section is production-build evidence.** None of it is from a dev server.

**31 checks, 28 passed.** The three that did not are analysed below and none is a regression.

| Journey                                                                                                                                 | Result                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VV air case: opening state                                                                                                              | Resume **disabled**, `data-resumption-status="air-outstanding"`, reason rendered: _"Not available yet: the air source has not been corrected…"_. Before this change the control was **enabled** here.                                                                            |
| VV air case: return clamp → drainage clamp → de-air                                                                                     | Resume **enabled**, `status="eligible"`. Before this change it was **disabled** here — the dead end.                                                                                                                                                                             |
| VV air case: press Resume                                                                                                               | Completes; `status="already-resumed"`; context line reads `FLOW 4.05 L/min · SPEED 3200 rpm · NO DEVICE ALARM`.                                                                                                                                                                  |
| VV air case: press Resume again                                                                                                         | No safety card, nothing charged.                                                                                                                                                                                                                                                 |
| VA air case                                                                                                                             | Same four results.                                                                                                                                                                                                                                                               |
| Safety path (harmful unclamp card)                                                                                                      | Card reads _"Opened a circuit clamp before the air source was corrected and cleared"_; **primary "Open the case explanation"**, **secondary "Restart this case from the beginning"**.                                                                                            |
| Safety path → explanation                                                                                                               | Debrief renders (7 351 characters) **without a restart**; the safety event is still listed in it; "Where the patient is at the reveal" is present.                                                                                                                               |
| Harmful card badge (C7-2)                                                                                                               | _"APPLIED — HARMFUL IN THIS SCENARIO"_, not a success badge.                                                                                                                                                                                                                     |
| Protective stop (C3-1)                                                                                                                  | Banner: _"Stopped by this model's pressure protection. This simulation's pressure interlock has stopped the pump: the modeled drainage (pVen) pressure went past its alarm limit…"_. No `mmHg` value and no `PVEN_`/`ART_` code in it. Speed tile reads **"Speed (requested)"**. |
| 1280×961, 1440×900, 1024×768, 390×844                                                                                                   | Resume control present, operable and non-zero-sized at all four; no horizontal page scroll at any.                                                                                                                                                                               |
| Keyboard at 320 px with **root-font enlargement to 32 px (200 % text)** — not CSS zoom, not device pixel ratio, not native browser zoom | The whole sequence — both clamps, the de-air card, the resumption — is completable with Tab and Enter; Enter on the resume control performs it.                                                                                                                                  |

Screenshots, the full check log, the build log, the server log and the driver script are outside
Git at
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/ecmo-fellow-01-2026-09-21/`
(`shots/`, `chromium-verification.log`, `build.log`, `prod-server.log`, `verify.mjs`,
`before.txt` = the failing-before jest run). To reproduce: `npm run build`, then
`PORT=3128 npm run start`, then `node verify.mjs` from that directory.

### The three checks that did not pass, and why none is a regression

1. **`POST /api/analytics` returns 500, and RSC prefetches of `/en/search`, `/en/board-prep`,
   `/en/ebus-training`, `/en/journal-club-podcasts`, `/en/learn/anatomy`, `/en/fluoroview`,
   `/en/bronch-navigation-trainer` and `/en` return 500.** The server log gives the cause:
   _"Your project's URL and Key are required to create a Supabase client"_. This worktree has no
   `.env.local`, which is a read-only protected mount this task forbids creating. **Environment
   blocker, reported rather than worked around.** None of it is on the ECMO route, which rendered
   and operated fully; no ECMO path reads Supabase.
2. **Horizontal page scroll at 320 px with 200 % text** (`scrollWidth` 389 against a 320 px
   client width). **Measured, not assumed, to be pre-existing.** Removing every element this batch
   added — the resumption reason paragraph, the pump-stop banner, the reset reason, and the strip's
   "requested" qualifier — leaves `scrollWidth` at **389, unchanged**. The offenders are the
   track toggle (`cardiohelp-ecmo_trackToggle`, 351 px), the self-paced navigation button row
   (`Show explanation without answering`, 340 px) and the Now-card action row (340 px), none of
   which this batch touched. **Observation for lane 03**, below.

## Non-blocking observations, with owners

| Observation                                                                                                                                                                                                                                    | Owner                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| ECMO Practice overflows horizontally at 320 px with 200 % root text: track toggle, self-paced navigation row, Now-card action row. Measured on the production build; unrelated to this batch.                                                  | **03** (console and visual workbench)                           |
| The "+" rotary control is off-screen at 1280 px inside the console box (S7-2, second half).                                                                                                                                                    | **03**                                                          |
| Tab labels PARAM/BLOOD vs the steps' "Parameter list / Blood parameters"; the unlabelled ≡ → "Alarm list" vs "Alarm history"; "steps" here vs "tasks" elsewhere (S7-5).                                                                        | **03 / 04**                                                     |
| Device SvO₂ 69.8 % here vs 74.6 % elsewhere at the same settings (S7-5) — a context/time question, not a value to force equal.                                                                                                                 | **02**                                                          |
| The clock running while a reading task is open (S17-4, first half) — **not reproduced in this batch**.                                                                                                                                         | **02**                                                          |
| Recovery timing after the gas source is restored (S14-1, second half).                                                                                                                                                                         | **02**                                                          |
| `differential-escalate-config` still carries `effect: 'definitive'`, which is what earns the case's cause credit. The copy no longer claims treatment, but whether the effect enum is the right one for an escalation is a modelling question. | **05**                                                          |
| A bedside-support action while the circuit is clamped in the Learn drill (S15-2, second half).                                                                                                                                                 | **05**                                                          |
| S1-1 / Figure 29 (`ChoiceReasoningFeedback`) — deliberately untouched.                                                                                                                                                                         | Coordinated shared-feedback owner, `SHARED_FEEDBACK_HANDOFF.md` |
| OV-1, OV-2, global chrome, feedback storage, beta wrapper.                                                                                                                                                                                     | PI platform task 05                                             |

## Clinical and device holds that stay open

None of the eight Appendix B decisions is closed, and this batch is authorised to close none of
them. Specifically still **NOT REVIEWED**:

- **ECMO-OWNER-01** (S7-3) — what the stopped-pump sensor question should teach, and how the key
  should classify the sensor-check reflex. The claim is contained, not resolved.
- **ECMO-OWNER-02** (S14-1) — which gas quantity is measured where, for a supply loss versus a
  downstream disconnection.
- **ECMO-OWNER-03** (C3-1) — what pressure protection, pump status and alarm are appropriate on the
  real device during collapse. This batch names the _model's_ protection event and invents no
  device behaviour.
- **ECMO-OWNER-08** (S15-3) — clamp order and the bounds of the protocol-governed resumption
  abstraction. The abstraction is preserved exactly as authored.
- **ECMO-OWNER-09 / 10 / 11 / 12** — time and causal scope, unrepresented responses, integrated-case
  scope (including IV-3's pass/fail decision and resume action), and orientation material.

**Runtime merge readiness is not clinical or release readiness.** This PR is ready to review as
software. Nothing in it has been seen by a physician, a perfusionist or a device specialist, and
the module's evidence panel still correctly reports no clinical or device review on record.

## What is explicitly NOT RUN

- The full Playwright `e2e/` suite (its config starts a dev server on port 3001, which belongs to
  the primary checkout).
- `ecmo-focus.spec.ts` and `ecmo-layout.spec.ts` as Playwright specs, for the same reason. Their
  subject matter — focus and scroll behaviour — is covered on this branch by the jest suites
  `layout-scroll-owners`, `foundation-workspace-layout` and `practice-assess-boundary`, all passing.
- Any non-Chromium browser, a real screen reader, a physical touch device, translations, or a
  signed-in progress path.
- The clock-pacing half of S17-4.
- Anything requiring Supabase (see the environment blocker above).
