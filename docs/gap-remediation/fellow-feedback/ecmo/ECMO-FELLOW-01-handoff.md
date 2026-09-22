# ECMO-FELLOW-01 — recoverable cases and truthful operational state

Implementation: September 21, 2026. Prepared by Claude (AI implementation). **Not reviewed by a
clinician, a perfusionist or a device specialist.**

**Result.** The two P0 rows — the air-case resumption dead end on both tracks — are repaired end to
end and are now reachable through the rendered control, with the reducer's safety refusals intact.
Of the nineteen assigned source IDs, **six are repaired**, **eight are partly repaired**, and
**five are contained pending the named model/clinical/device decisions**. This conservative count
covers each whole source row, including its deferred subparts. No whole row is classified as
“not reproduced”; the clock-pacing subpart of S17-4 was **not run** in the implementation batch.
Nothing here is clinical, device or release approval, and no
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

| ID         | Sev · page | What was reproduced at `c717c9ff`                                                                                                                                                                                                                                                                                                                                                    | Status                                       | What changed                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C7-1**   | P0 · p40   | VV air case: after `air-deair` clears `bubbleResetRequired`, the rendered Resume control is **disabled**, while the reducer would have accepted the transition. The case cannot be completed.                                                                                                                                                                                        | **Repaired**                                 | Single eligibility contract shared by control and reducer.                                                                                                                                                                                                                                                                                   |
| **VAC7-1** | P0 · p41   | VA air case: identical. Additionally the control is **live before any clamp or de-airing**, over a circuit with air in it.                                                                                                                                                                                                                                                           | **Repaired**                                 | Same contract; the control is now dead while air is outstanding and live only once isolated and clear.                                                                                                                                                                                                                                       |
| **C3-1**   | P0 · p40   | Tension-pneumothorax case, speed 3200 → 3600: at t+1 the model's pressure interlock stops the pump; at t+2 flow is 0.00, all four pressure channels go unavailable, and the pressure alarm clears **with the channel it was keyed to**, leaving "No active alarm" beside a speed of 3600. `pumpRunning` is `false` — the pump is **not** rotating, contrary to the report's reading. | **Contained; presentation repaired**         | The model's protection event is named on screen and recorded in history; the speed is labelled as requested. Exact CARDIOHELP behaviour and alarm remain **ECMO-OWNER-03**.                                                                                                                                                                  |
| **C1-2**   | P1 · p39   | VV initiation: after a safety event the Now card is replaced by a Safety card whose only action is Restart, ahead of the branches that carry "Reveal causal debrief".                                                                                                                                                                                                                | **Repaired**                                 | Primary action is now the case explanation; Restart is retained as a choice.                                                                                                                                                                                                                                                                 |
| **C5-1**   | P1 · p40   | Recirculation: the same branch, same single Restart action.                                                                                                                                                                                                                                                                                                                          | **Repaired**                                 | Same change; the branch is shared.                                                                                                                                                                                                                                                                                                           |
| **C7-2**   | P3 · p40   | The harmful card "Unclamp and restart before de-airing" completes as "Completed · …" / "Applied", identical to a correct action.                                                                                                                                                                                                                                                     | **Partly repaired; remainder 04**            | Completed cards are badged by authored effect. The checklist-ordering half is **04**.                                                                                                                                                                                                                                                        |
| **VAC7-2** | P3 · p41   | A premature resumption raises `premature-bubble-reset`, which appears in **neither** scenario's `unsafeActionPenalties`, so the card reads the generic "A safety stop was recorded for an action this case treats as unsafe."                                                                                                                                                        | **Repaired**                                 | Canonical safety-event label registry behind the authored labels; a test holds it complete against every identifier the reducer raises.                                                                                                                                                                                                      |
| **S15-2**  | P3 · p38   | A blocked resumption and a blocked bubble reset are greyed-out controls with **no message**.                                                                                                                                                                                                                                                                                         | **Partly repaired; remainder 05**            | Both controls carry a live, accessible reason. The "add a bedside-support action" half is **not done**: synthesizing one is out of scope, and reusing an authored action needs **05**.                                                                                                                                                       |
| **S7-2**   | P2 · p36   | Hold-to-ramp continues after window blur, after the tab is hidden, and after a pointer release outside the button; a hold that ends off the button leaves a stale flag that swallows the **next keyboard activation** of the stepper. Flow stays 0.00 with "the pump is stopped" until a separate step.                                                                              | **Partly repaired**                          | Repeat ends on blur, hidden tab, release-anywhere and unmount; the stale flag is released on its own schedule. Speed is labelled as requested. **Ramp rate deliberately unchanged** (below). Off-screen "+" at 1280 px is **03**.                                                                                                            |
| **S7-3**   | P1 · p36   | The stopped-pump sensor-check option is refuted with language that reads as a rule about circuits, not about this model. A transducer does read a static pressure with the pump stopped.                                                                                                                                                                                             | **Contained**                                | The rationale now says the reflex is sound and that only this simulation's convention refutes it, and names the open decision. **Key unchanged — not re-keyed.** Classification remains **ECMO-OWNER-01**.                                                                                                                                   |
| **S7-5**   | P3 · p36   | "Allow self-test completion, verify the audible indicator" — one click records both; this model runs no diagnostic and produces no sound.                                                                                                                                                                                                                                            | **Partly repaired; remainder 02/03/04**      | The step now separates what the click records from what it only describes. Tab-label naming, the ≡ → Alarm list path, SvO₂ 69.8 vs 74.6 and "steps" vs "tasks" are **03/04** and **02**.                                                                                                                                                     |
| **S10-2**  | P1 · p37   | "Escalate the identified oxygenator problem" retires the resistance fault and returns the circuit to reference in one simulated second, with no exchange represented.                                                                                                                                                                                                                | **Contained; procedure/timing held**         | The composite action is named as a teaching transition standing for the completed exchange, in both lessons and the Practice action label. **No timing, risk or new outcome added** — that is **05**.                                                                                                                                        |
| **S14-1**  | P2 · p37   | The blender prints "delivered 0.0 L/min — sweep flow reaching the membrane", a claim a flowmeter cannot make.                                                                                                                                                                                                                                                                        | **Contained**                                | Labelled as modeled gas availability, explicitly not a measured flowmeter reading; the model does not locate disconnections. Bedside checks remain visible. **Still shown before the prediction** — withholding gas-path evidence is explicitly forbidden. Recovery timing is **02**; device display per disconnection is **ECMO-OWNER-02**. |
| **S17-4**  | P2 · p38   | "Restore verified gas source" is greyed in a foundation section because that host passes `controlsEnabled={false}` by design; the console says so, the gas panel did not. The clock running while reading was **not reproduced** in this batch.                                                                                                                                      | **Partly repaired; clock subpart NOT RUN**   | The gas panel carries the same read-only reason as the console. Clock ownership and pacing are **02**; RR/WOB coupling is **05**.                                                                                                                                                                                                            |
| **C1-5**   | P3 · p40   | The context strip prints "2,800 rpm" beside a case whose support status is `not-on-ecmo`.                                                                                                                                                                                                                                                                                            | **Partly repaired; remainder 03/04**         | Speed reads as requested, with the reason, wherever the pump is not turning. Button styling and "Compare this prediction" are **03/04**; the debrief's Next target is the authored next case by design and is left.                                                                                                                          |
| **VAC5-2** | P3 · p41   | "Escalate the configuration decision" reports "The support strategy is revised and upper-body oxygen delivery begins to recover" while nothing patches the right-arm saturation.                                                                                                                                                                                                     | **Contained; effect/response model held**    | The response and the case completion line say escalation is escalation and point at the live right-arm reading. Effect, credit and required list unchanged.                                                                                                                                                                                  |
| **IA-3**   | P1 · p42   | VA integrated case: the Now card says "The cause is addressed" and the debrief timeline prints "Corrected scenario cause: differential-hypoxemia" — for a fault this engine deliberately keeps **active**, with right-arm SpO₂ still low.                                                                                                                                            | **Partly repaired; causal model remains 02** | Recognition-only faults are recorded and described as recognition and escalation; the debrief adds an explicit note. **SpO₂ was not forced to normalize.**                                                                                                                                                                                   |
| **IA-4**   | P2 · p42   | The context strip chip reads "No alarm" while the console shows a HIGH alarm. Both are correct: the strip is device-scoped, the console alarm is an **independent patient-monitor** alert (`RIGHT_RADIAL_LOW`). Separately, both integrated cases print "No lesson in this track teaches this mechanism yet" because a capstone unit lists no cases and so appears in no lookup.     | **Repaired**                                 | The chip says "No device alarm"; the two surfaces are deliberately **not** synchronised. Capstone lessons resolve through the existing mechanism vocabulary.                                                                                                                                                                                 |
| **IV-3**   | P1 · p42   | VV integrated case: after a failed off-sweep trial the debrief reads "No safety event is recorded." with no patient readings beside it.                                                                                                                                                                                                                                              | **Partly repaired; trial decision held**     | The sentence says what the empty log is a statement about; the patient's actual readings at the reveal are printed beside it. A pass/fail decision and a resume action are **04/05** and were **not invented**.                                                                                                                              |

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
| `npx jest src/features/cardiohelp-ecmo`                                                                      | 0         | **75 suites, 2356 tests passed** (38 new at the submitted head).                                                                          |
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

`src/features/cardiohelp-ecmo/__tests__/ecmo-fellow-01-recovery-and-state-truth.test.tsx`, 38
checks in five blocks matching the task's sections A–E. Some are preservation checks; they do not all fail on the baseline. The independent review below records representative assertion-level baseline failures:

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
   client width). **Implementation-stage comparison only; see the independent matched-baseline review below.** Removing every element this batch
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

## Independent sanity review — September 21, 2026

Codex reviewed the complete PR, implementation package, assigned ledger rows, original DOCX,
engine paths and rendered production journeys. This remains a software review, not a physician,
perfusionist or manufacturer review. The user expressly authorized exclusive correction of the
existing PR branch; no merge, deployment or Prompt 02 work was performed.

### Revisions and scope

- Submitted PR head: `925d7bcc3047a282f644abeed9e3cdbbb7918545`.
- PR base and initial fetched main: `d9dbfa2ec33c00f90395c14ec1dc6634623551e2`.
- Main advanced during review to `5ff2b096f6aa4d7032594b28520e2d78d64df5ed`.
  `git log d9dbfa2e..origin/main -- src/features/cardiohelp-ecmo
src/features/critical-care/__tests__/learner-copy.test.ts` was empty. No relevant ECMO code moved
  after Claude's rebase. Tests and matched-baseline builds use the PR base, not an unrecorded main.
- The original 11/4/3/1 summary did not reconcile with the actual disposition table. The revised
  table counts whole source rows conservatively: **6 repaired, 8 partly repaired, 5 contained**.
  S17-4's untested clock subpart is explicitly NOT RUN, not a whole “not reproduced” finding.
  Clarifying copy does not validate unresolved device behavior or model response.

### Defects reproduced and corrected on this PR

1. **Air resumption outside an air event.** Closing a return clamp on an ordinary resistance case
   made the new selector return `eligible`, falsely claiming an air source had been corrected.
   Its applicability check was below the clamp branch. The shared selector now returns
   `not-applicable` for every circuit without an air event, regardless of clamp position; direct
   dispatch is a no-op there. Both existing charged air refusals remain unchanged.
2. **Invented flowmeter provenance.** `sourceConnected ? sweepLpm : 0` does not identify a sensor
   location or distinguish upstream supply loss from downstream disconnection. Renaming it
   “the blender's own flowmeter” overstated the available state. It now reads **Modeled gas
   availability**, explicitly not a measured flowmeter reading. The number, timing and bedside
   gas-path checklist are preserved. ECMO-OWNER-02 stays open.
3. **Recognition described as frozen physiology.** The new debrief said its readings were still
   the opening physiology. On the VA capstone, recognition followed by ten model steps changed
   right-arm saturation from 82.3 to 82.0 and PaCO₂ from 43.4 to 46 without treatment. The note now
   identifies current simulated readings and does not attribute clock-driven changes to treatment.
4. **Pressure-stop wording one update ahead of state.** At the stopping update, `pumpRunning`
   is false but pressure values calculated before the stop are still visible. The next update
   makes them unavailable. The new explanation had said they were already unavailable. Its
   wording now describes this transition without changing pressure calculations or alarm behavior.

Three added regression tests failed on the submitted implementation before the first three
corrections; a fourth failed before the stop-message correction. All pass afterward. Existing
checks were strengthened to assert exact state identity on repeated resumption, both VV/VA
50-point bypass refusals, cross-case loading from the resumed state, and actual Learn resumption
through the reducer after `CORRECT_FAULT`.

### Independent state and test-quality findings

- UI and reducer call the same `resolveBubbleResumption`; safety enforcement remains in the reducer.
  Opening and isolated-but-uncleared states remain blocked. Both clear clinical circuits resume
  atomically with open clamps, a running pump, positive flow and `supportStatus: on-ecmo`.
- Both Learn bubble cases retain their corrected-source/latch-set path. Repetition returns the
  identical state, preventing duplicate history, credit, interventions or penalties. Restart and
  cross-case loading discard the prior run's isolation, correction and intervention state.
- Safety labels cover the literal reducer identifiers and the three dynamically supplied critical
  clinical identifiers (`unsafe-clinical-shortcut`, `rpm-during-recirculation`,
  `unsafe-unclamp-before-deair`). The original regex test covers literal calls only; it should not
  be represented as a general parser of future dynamically generated identifiers.
- The submitted targeted suite had **38 tests**, not 25. Some are preservation checks, not tests
  that should fail on the baseline. Four representative behavior checks were run against the
  actual pre-PR tree: both rendered Resume availability checks, explanation-versus-restart, and
  refused-intervention accounting. All four failed at their assertions. The new registry import
  was replaced by an unused empty constant in that baseline-only copy so these failures were
  behavioral rather than missing-module failures. The other 34 tests were skipped in that run.
- No physiology coefficients, targets, answer keys, device limits, clamp order, persistence,
  mastery or penalty values changed. Shared feedback components, global chrome and unrelated
  modules remain untouched. The existing exact-sentence copy exception is appropriately scoped.

### Production browser evidence and matched limitations

Fresh headless Chromium contexts, GPU not explicitly disabled, drove production builds on ports
3171 (PR) and 3172 (detached `d9dbfa2e` baseline). No environment file or secret was created or
copied. Browser state was read from the current rendered React tree for observation only; actions
were performed through learner controls, with no state injection or reducer dispatch from the
browser driver.

- Both VV and VA clean and harmful-action recovery paths reached resumed support. Reading each
  safety debrief changed **only** `scenario.phase`: full state comparison preserved time,
  physiology, history, observations, interventions, credit, penalties and safety errors.
  The event remained displayed; Restart remained available and cleared the current run.
- The C3-1 trace at requested 3600 rpm recorded: t0 pump running / flow 2.47; t1 pump stopped /
  flow 0 / last pVen -180; t2 pump stopped / flow 0 / displayed pVen unavailable. The existing
  `PVEN_STOP` alarm began at t1 and resolved at t2 as its channel became unavailable. Raw stored
  pressure is not a current displayed measurement. No device code, priority or threshold was added.
- At 1280×961, 1440×900, 1024×768 and 390×844, neither build had horizontal page overflow. At
  320×800 with root `font-size: 32px`, **both measured `scrollWidth: 388`**. The implementation's
  earlier 389 px measurement was not reproduced exactly, but the matched comparison shows no
  regression. The complete air sequence works using keyboard activation at this text size.
  This baseline overflow remains Prompt 03's work.
- Both builds produced the same environment failures: `/api/analytics` and unrelated RSC
  prefetches returned 500 with the missing Supabase URL/key message. ECMO routes and controls
  operated throughout; the driver recorded no uncaught page exceptions. No credential workaround
  was needed. These HTTP failures are not passing requests, but they do not block this review.
- Four existing production-browser focus checks passed: reverse Tab from Sources with enlarged
  operational strips in VV/VA bubble and power-loss lessons. Command:
  `ECMO_LAYOUT_BASE_URL=http://localhost:3171 npx playwright test --config
playwright.ecmo-layout.config.ts e2e/ecmo-focus.spec.ts --grep 'enlarged operational strip'`.
  This overrides the server URL; a dev server or primary-checkout port is not required.

Local evidence: `/tmp/ecmo255-review/`. It contains `browser.mjs`, `additional.mjs`, browser logs,
per-state JSON traces and screenshots in `browser-3171/` and `browser-3172/`, baseline and corrected
Jest logs, build/typecheck/lint/format logs. Run the browser drivers with the matching port argument
(`node /tmp/ecmo255-review/browser.mjs 3172 --baseline` for the baseline). Full baseline and PR
production builds were independently regenerated with `npm run build`.

### Holds preserved

All eight Appendix B decisions, **ECMO-OWNER-01 through ECMO-OWNER-08**, remain NOT REVIEWED,
including 04 (oxygenation coupling), 05 (VA afterload), 06 (tamponade native output/pulse pressure)
and 07 (vasoplegia MAP response), which the implementation's earlier abbreviated list did not
spell out. Decisions 09–12 also remain open. Sensor-question classification, gas measurement
location, actual device protection, procedural resumption, exchange timing, trial decisions and
unmodeled physiological responses have not been approved by this review. No answer was re-keyed.

### Final corrected-tree verification

- `npx jest src/features/cardiohelp-ecmo --runInBand`: **75 suites / 2,361 tests passed**, exit 0.
  The Prompt-01 suite separately passes **43 tests**.
- `npx jest src/features/critical-care src/features/icu-simulation --runInBand`: **30 suites /
  310 tests passed; 3 suites / 3 tests failed**, exit 1, identical on baseline, submitted head and
  corrected tree. The failures are the existing CRRT station order, shared accessibility wording,
  and MV/MCS learner-copy findings. The ECMO copy exception checks pass. ICU consumers pass.
- `npx tsc --noEmit`, ESLint on all PR-changed TS/TSX paths, Prettier check on all PR-changed
  paths, and `git diff --check`: exit 0.
- `npm run build`: exit 0 on both baseline and corrected tree; final emitted client code was
  checked to include the corrected pressure-stop sentence. Production-browser recovery,
  state-identity, restart, pump-stop, viewport and keyboard journeys pass on the corrected build.
- Additional real controls reproduce safety events in VV initiation and VV recirculation; opening
  their debriefs also changes only the phase. A clamped non-air clinical case keeps Resume
  unavailable. The gas panel explicitly distinguishes modeled availability from a measurement.

**Merge assessment:** ready as the bounded Prompt-01 software repair after these corrections.
The baseline failures and owner-held findings above do not require expanding this PR. Clinical
review, later numbered lanes, release approval and deployment remain outside this conclusion.
