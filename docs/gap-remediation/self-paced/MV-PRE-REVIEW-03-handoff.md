# MV-PRE-REVIEW-03 — workbench, waveforms and experiment flow

Batch 03 of the Mechanical Ventilation pre-owner-review pack
(`Interventional-Pulm-Local-Data/module_update_9_19/MV_Claude_Implementation_Pack/03_MV_WORKBENCH_AND_EXPERIMENT_FLOW.md`),
read with `COMMON_CONTRACT.md`, the assigned rows of `FEEDBACK_LEDGER.md`, `SOURCE_AND_CODE_NOTES.md`,
`CROSS_MODULE_COORDINATION.md`, the walkthrough DOCX, and the merged `MV-PRE-REVIEW-01-handoff.md` and
`MV-PRE-REVIEW-02-handoff.md`. Prepared 2026-09-28 by an AI authoring assistant (Claude) at the owner's
request.

**Nothing here is clinical, device, media, source or release approval.** This batch changed how the
Learn workbench, waveforms, experiment and navigation are presented. It changed no physiology, case
trajectory, gas model, alarm policy, answer key, source or review status, device behaviour, global
site chrome, or D1–D5 decision. The four console facsimiles were checked for display only; visual
parity is not manufacturer-workflow validation.

> **Read first.** An independent sanity review of this PR found six defects in the batch recorded
> below. The repair is the next section; where it supersedes a statement further down, that
> statement is marked.

## Sanity-review repair pass (2026-10-03)

An independent Codex sanity review of PR #290 at `02eb66e46dfdee0c716edf08f24211308e8b0872` returned
**NOT READY TO MERGE** with six bounded Batch-03 defects (R1–R6) and two notes (a pinned-chrome
probe, and whether a captured result always has a complete breath). This section records the
repair. Prepared by an AI authoring assistant (Claude) at the owner's request.

**Nothing here is clinical, device, media, source or release approval.** The repair changed how a
pause is credited, what a figure and its text call their origin, how a navigation request is scoped,
and module-local console layout. It changed no physiology, BreathClock, alarm history, PEEP
reversal, trigger-estimate semantics, ABG specimen, plateau acquisition, post-action evidence, case
trajectory, answer key, option, stem, authored marker or evidence phase. Batch 04 was not started;
nothing was merged or deployed; the branch was not reset, rebased, force-pushed or re-created.
Sections below this one are the original batch record; statements the repair supersedes are marked
there.

### Heads and drift

|                        |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Previous reviewed head | `02eb66e46dfdee0c716edf08f24211308e8b0872`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Repair commits         | `88660c6e` R5 (console layout) · `f804d3ac` R1–R4, R6, the capture gate and the regression suite · `945bf07a` R3 (observation feedback)                                                                                                                                                                                                                                                                                                                                                                                                            |
| Implementation head    | `945bf07a` — every test, type-check, lint, build and production browser result below is from this commit                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Repaired final head    | the commit that adds this section and its screenshots (docs only; recorded in the PR)                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Branch base            | `756c9aee7d7119f3817b5d85aaf73f9efa573418`, unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Expected `origin/main` | `756c9aee7d7119f3817b5d85aaf73f9efa573418`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Fetched `origin/main`  | **Drift recorded, twice.** At the start of the pass: `754bed0e362a57e804d104ca99da8a8eaefbbeb5` (50 commits past the base). Re-fetched before the push: `60e3bd642a92fc25714141ad8e6c8d877510f8e7` (82 commits past the base; merges of PRs #273, #279, #284, #289, #291–#293, #309–#319 and #322). Neither touches `src/features/mechanical-ventilation` or the MV routes. `src/features/learning-module` gained the MT-01a sponsor-notice slot (`ModuleFrameV2.tsx`, its stylesheet and two test files). See [Integration](#integration-status). |
| Worktree               | Commits were made in `…/claude-mechanical-vent-03-9-25`, where the branch is checked out. The session opened in `…/codex-mv-03`, detached at the reviewed head; it was used only as the reviewed-head checkout (a probe test file and a dev server on port 3128, both removed; `git status` clean before and after).                                                                                                                                                                                                                               |
| Files                  | 24 runtime, content and test files, all under `src/features/mechanical-ventilation`; this document and 21 screenshots. No shared `learning-module` file, global site chrome, other module, backend, dependency or deployment change. No `.env.local` was created, modified or deleted.                                                                                                                                                                                                                                                             |

### Disposition

| ID                    | Review finding                                                                                    | Disposition                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1**                | A background suspension counted as the learner's pause and, with automatic capture on, captured   | **Reproduced (browser and Jest) → repaired.** The pause carries its origin; only the learner's own pause of a running model can be their inspection.                                       |
| **Capture readiness** | No explicit complete-breath gate                                                                  | **Verified: not guaranteed → smallest gate added.** 39 % of instants after Section 11's first interval held no complete breath. Post-change provenance _is_ transitive, and is now tested. |
| **R2**                | Section 1 step 3 names "interval A, marked on the captured breath" and shows no marker            | **Reproduced → repaired.** The step's figure carries the authoritative marker; the sentence follows the figure on screen.                                                                  |
| **R3**                | "Breath start" overstates the origin; calculated 0.63 s read as measured                          | **Reproduced → repaired (disposition B).** Origin named as the first recorded inspiratory sample everywhere; calculated and sampled times labelled as such.                                |
| **R4**                | A Command-click left a reveal request behind that an unrelated arrival consumed                   | **Reproduced (browser and Jest) → repaired.** The request names its destination and is made only by a same-tab activation.                                                                 |
| **N4 probe**          | Hidden fixed / non-header sticky elements could set the inset                                     | **Repaired narrowly.** Unpainted elements and sticky elements with no top offset are ignored; ordinary-route geometry re-measured identical.                                               |
| **R5**                | C6 monitor column overlaps Ppeak / Pplateau at 200 % root text                                    | **Reproduced on the reviewed head → repaired (module-local).** Column floors in rem; narrow-screen reflow by container width.                                                              |
| **R6**                | Overlay text equivalent omits the effort row; time-axis caption collides with its tick on a phone | **Reproduced → repaired.** Sample-derived effort description; the axis title is page text under the figure.                                                                                |

### R1 — who paused decides what a pause counts for

**Reproduction on the reviewed head** (dev build of `02eb66e4` on port 3128, headless Chromium,
1280×1000, page visible and its own clock running): Section 1, step 3 → tick "Capture automatically
when the result is ready" → Run experiment → at model time 4.6 s the page's `visibilityState` was
scripted to `hidden` and `visibilitychange` dispatched. The panel went straight to
`data-experiment-stage="captured"`: "Result captured at 4.6 s of model time", the goal ticked, a
retained result on the page. It stayed captured after visibility was restored.

**Cause**, four links, each sufficient to need repair:

1. `useVentilationLabSession` answered a hidden page with the same `SET_PAUSED` the Pause button sends.
2. `learningLabReducer` wrote the Section 1 `inspection` record for _any_ `SET_PAUSED` in the
   experiment once four seconds had passed and the last sample was expiratory with gas leaving.
3. `labGoalMet` did not even need the record: with none, the `pause-expiration` goal fell through to
   "`simulation.paused`, past four seconds, last sample expiratory" — intent read off `paused === true`.
   That is also true after **Advance one breath** from an early pause, and at the model-time limit.
4. The panel's automatic capture dispatched `COMPARE` the moment the gate opened.

**Contract now** (`engine/types.ts`, `engine/learningLab.ts`):

- The pause action carries who asked: `origin: 'learner'` (the three Pause buttons), `'background'`
  (the page hidden or suspended), or nothing (the program itself: reset, restart, device change,
  replay). The physiology reducer ignores it — the engine state after a pause is identical for every
  origin (asserted with `toEqual`).
- The inspection record is written in exactly two places: the learner's **Use this captured
  interval**, and a `'learner'` pause that **stopped a running model** in the experiment, at least
  four model seconds in, in expiration with gas leaving. Nothing else writes it.
- The `pause-expiration` goal is met by that record and by nothing else. The `paused === true`
  fall-through is deleted.
- A background pause therefore records no inspection, meets no goal, sets no `readySince`, opens no
  gate and triggers no capture — while hidden and after the page is visible again, because there is
  nothing recorded to become true later. The capture effect was **not** given a `document.hidden`
  check; it reads the gate, and the gate is closed.
- The lab layer reads the origin, not the browser: `visibilityState` appears only in
  `useVentilationLabSession` (asserted by a source test over the lab, the status projection and the
  panel).
- `LabSession.pauseOrigin` remembers the origin of the pause in force so the panel can say why the
  clock stopped ("The model clock stopped because this page went to the background. That was not
  your pause, so nothing was recorded for it…"). It is presentation state: never part of a
  checkpoint, never read by a goal, cleared by Run, one breath, capture, reset, restart, device
  change and a new round.

**After, production build** (same sequence, 1280×1000):

| Moment                                       | Stage             | Goal  | Model time | Capture                           | Captured result |
| -------------------------------------------- | ----------------- | ----- | ---------- | --------------------------------- | --------------- |
| Scripted hidden at 4.6 s                     | `awaiting-action` | to do | 4.6 s      | disabled                          | none            |
| Hidden + 2.5 s                               | `awaiting-action` | to do | 4.6 s      | disabled                          | none            |
| Visible again + 2.5 s                        | `awaiting-action` | to do | 4.6 s      | disabled                          | none            |
| Learner: Run experiment, then Pause at 8.6 s | `captured`        | done  | 8.6 s      | — (automatic capture was left on) | present         |

**Native tab hiding was not exercised.** It was attempted — a second page opened and brought to the
front in the same headless Chromium context — and the first page kept
`visibilityState === 'visible'` and kept running, so it is not evidence either way. Only the
scripted transition (the same one the review used) is claimed.

**Tests** (`mv-pre-review-03-repairs.test.tsx`, "R1"; numbers are the review's list):

| #   | Required                                              | Test                                                                                                                                                                          |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Learner Pause at the right time may progress the goal | lab: `'learner'` pause at 4.6 s → inspection in expiration, `ready`. Rendered: Run, 4.6 s, Pause → `ready`, Capture enabled, nothing captured without the option.             |
| 2   | Background suspension → no credit                     | lab: `'background'` pause at the same instant → no inspection, no `readySince`, goal unmet, `COMPARE` refused. Rendered: hidden → `awaiting-action`, the note, no capture.    |
| 3   | Visibility returns → still no credit                  | lab: six later actions (speed, tick, further pauses of every origin) leave it unmet. Rendered: visible again, 2 s later, still `awaiting-action`, goal `to-do`.               |
| 4   | With automatic capture on → no capture                | Rendered, option ticked before Run: no `[data-captured-result]` hidden, 5 s later, or after return.                                                                           |
| 5   | Learner's later inspection → capture proceeds         | Rendered, same run: Run, 3.8 s, Pause → `captured` (the option was still on and the gate was really open).                                                                    |
| 6   | Pause on an unrelated step                            | lab: Section 2 (no pause goal), Section 1's second application (asks for an interval), Section 1 before its experiment. Rendered: Run/Pause on the reading step, then step 3. |
| 7   | One-breath stepping is not a pause                    | lab: early pause at 2 s + Advance one breath → paused, past 4 s, expiratory, gas leaving, **not ready**. Rendered with the option on: nothing captured.                       |
| 8   | Reset / new round clears transient state              | lab: RESET, RESTART, OPEN_ROUND, DEVICE each clear `pauseOrigin`, the inspection and `readySince`. Rendered: Reset patient removes the note and un-ticks the option.          |

Also asserted: a pause naming no origin earns nothing; a `'learner'` pause of an already-stopped
model earns nothing; `labCheckpoint` drops `pauseOrigin`.

The Practice case flow has its own hidden-page pause and no pause-based credit; it was not touched.

### Capture readiness — verified, and not guaranteed

The review asked whether a captured result is already guaranteed to hold a complete breath. Every
authored change round was run on all four consoles, with the change made at four different points
in the breath, and sampled every 0.1 s for 20 s from the first moment `labReadyToCompare` was true
(800 instants per round and console):

- **Section 11, first application** (inspect the circuit, clear the condensate): the corrected
  patient breathes at 8/min, 7.5 s a breath, and the record is the engine's 12-second window. **314
  of 800 instants (39 %) held no complete breath**, on every console. A manual capture at one of
  them retained a result with nothing to draw. Not guaranteed.
- **Every other change round**: a complete breath at every instant.
- **In no round, at no instant, did the drawn breath begin before `readySince`** — each interval is
  longer than two breath periods at the rate that follows the change. That half _is_ guaranteed
  transitively by the existing gate.

So the smallest authoritative gate was added, once: `labReadyToCompare` also requires
`labRecordHoldsCompleteBreath(session)` (`completedBreath(record).length >= 4`, the same test the
figure uses to draw). The status projection names the state ("Everything requested is in place.
Waiting for one complete breath on the record before the result can be captured."), so the panel
does not show an interval at its full length and a disabled button with no reason. Clean runs of the
other 25 change rounds are unaffected. The relationship is documented on `labReadyToCompare` and held
by a test over all 26 change rounds (two action timings, 80 instants each).

**Found while verifying, pre-existing, presentation corrected only:** Section 8's first application
opens at 10/min, where the 12-second window begins exactly on an onset and holds one _verifiable_
onset, so its **baseline** — captured when the experiment starts, before anything runs — holds no
complete breath on any console. The retained comparison used to print "A complete breath is not yet
available. Run or advance one breath, then capture again", which cannot be done to a retained
record. It now says the retained record holds no complete breath and that its readings are still in
the table; the overlay says the same. Drawing a baseline there needs a decision about the record
window or the warm-up alignment, which is engine work and was not started.

### R2 — the experiment step shows the interval it names

**Reproduction** (reviewed head, 1280×1000 and 390×844): step 3's card printed "Read all three
traces at interval A, marked on the captured breath below. The phase label under the figure can be
hidden while you decide…" over a figure captioned "Baseline reference · select an interval to
inspect" with **0 marker elements** and no phase label.

**Repair** — both halves of the review's preferred repair, because both halves of the sentence were
wrong on that step:

- The experiment panel's captured breath now carries the **authoritative** marker:
  `ventilationReferenceMarker(unit, round)` from Batch 01's `referenceEvidence.ts`, resolved against
  this breath's own samples by `markerEvidence`. No marker was added, no phase logic duplicated, and
  the captured baseline is the same reference breath the question step marks (both are
  `createLabSimulation(unit, round, device)`), so the figure prints the same evidence sentence —
  asserted equal to `markerEvidenceSentence(...)` on both steps.
- The look line on the steps that _perform_ a marked round follows the figure that is on screen
  (`inspectionFigureState` → `markedIntervalLook`): the marked figure is open ("Read all three
  traces at interval A, marked on the captured breath in the Experiment panel. Interval A stays
  where it is; the exploration cursor is yours to move…"), not started yet, or replaced by the
  retained comparison after capture. The lesson's "What to look at" prints the same sentence. The
  authored `look` line is unchanged and still printed on the question step, beside the marked,
  guided reference whose phase label it describes.

**After, production:** marker line on all three rows at one x (652 px at 1280×1000, 209 px at
390×844), letter "A" on each, `data-marker-resolved="true"`, "Interval A is at 1.86 s on this
breath: flow -4.0 L/min (gas moving out) and volume falling by 1 mL over the preceding 0.02 s."
Moving the exploration cursor 25 samples left the marker where it was (x 588.32 → 588.32 in figure
units). Interval B behaves the same on the second application.

Tests ("R2", 7): the exact step's instruction and figure agree; the marker's identity, stop and
phase come from the Batch-01 contract; the cursor is independent; no card in Section 1 — before or
after a capture — prints "marked on the captured breath" without a marker on it; the three figure
states; interval B; and no key, option, goal or authored look line changed.

### R3 — the origin is the first recorded inspiratory sample

Measured on the Section 2 baseline, agreeing with the review: the sample before the breath reads
0.7 mL; the first inspiratory sample 14.1 mL; it already holds one 20-ms step of 40 L/min
(13.3 mL). A figure that subtracts the first sample draws a breath that received 413 mL rising
400 mL (427 → 413). **Disposition B**: the origin stays where it is and is called what it is.
Nothing sampled changed: no engine volume altered, no zero-time sample synthesised or interpolated,
no timestamp moved, the drawn rise not stretched to the delivered volume (asserted: one drawn vertex
per sample, the first at the plot's left edge, the evidence byte-identical after rendering).

One set of words, in `content/breathOrigin.ts`, used by every path:

| Path                                  | Before                                                                   | After                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Volume row label (figure and overlay) | "Volume from breath start (mL)"                                          | "Volume from first inspiratory sample (mL)"                                                                                                                                                                                                                                                                                                                                                   |
| Time axis (figure and overlay)        | "Time (s)" / "Time from breath start (s)"                                | "Time from first recorded inspiratory sample (s)" (a hold slice: "Time from the first sample of this trace (s)")                                                                                                                                                                                                                                                                              |
| Figure caption                        | "Volume is drawn from this breath's start. The lung held 14 mL…"         | "Volume and time are counted from this breath's first recorded inspiratory sample: a convention of the sampled trace, not the instant inspiration began. A sample is recorded after each 20-ms step, so that sample already holds one step of flow: … 0.7 mL … in the sample before it and 14.1 mL in it. The drawn rise is therefore about 13 mL less than the volume this breath received." |
| Duration line                         | "…onset to next onset"                                                   | "…from its first inspiratory sample to the next breath's"                                                                                                                                                                                                                                                                                                                                     |
| Cursor text / accessible name         | "…mL above this breath's start"                                          | "…mL above this breath's first inspiratory sample"                                                                                                                                                                                                                                                                                                                                            |
| Overlay caption                       | "each from its own breath start"                                         | "each from its own first recorded inspiratory sample"                                                                                                                                                                                                                                                                                                                                         |
| Zoom notes                            | "from each breath's start"                                               | "from each breath's first recorded inspiratory sample" / "counted from its first recorded inspiratory sample"                                                                                                                                                                                                                                                                                 |
| Text equivalent                       | "it received 413 mL (peak volume less the volume just before its onset)" | adds the origin sentence and "its drawn volume rises 400 mL, because the first inspiratory sample it is drawn from already holds 13 mL" (a pressure-targeted breath whose first step is under 1 mL says that instead)                                                                                                                                                                         |

No path in the comparison says "breath start" in either view, zoomed or not (asserted). Authored
teaching copy that speaks of "breath-relative volume" or "the breath's starting reference" as a
display concept (`foundations.ts`, round rationales, the waveform-anatomy panel) names no sampled
origin and was left alone.

**S2-1 timing**, now explicit:

- The reading: "Inspiratory time · calculated", with "Calculated from the settings, not timed on the
  trace: 420 mL at 40 L/min is 0.63 s of inspiratory flow. The trace is sampled every 20 ms, so a
  drawn breath shows flow for 31 or 32 samples: 0.62 or 0.64 s." (At 60 L/min, a whole number of
  steps, only the provenance sentence.) The captured table's row is "Inspiratory time · calculated (s)".
- The drawn breaths: "inspiratory flow over 31 samples (0.62 s as sampled)".
- Between them: "The Inspiratory time reading (0.63 s before, 0.42 s after) is calculated from the
  selected volume and flow; it is not timed on the trace."
- The Section 2 observation feedback: "Recorded inspiratory time (the reading calculated from the
  settings): 0.63 → 0.42 s." Stem, choices and key unchanged (asserted).

The 413 / 427 mL alternation and the 3.74 / 3.76 s sampled periods are untouched (their Batch-03
tests pass unchanged).

### R4 — the reveal request belongs to one same-tab navigation

**Reproduction** (reviewed head, browser): on Section 1's last step, Command-click "Continue to …"
opened the next section in a new tab; in the original tab, All sections → Section 1 within the old
15-second window → **the Section 1 heading took focus** (`document.activeElement` was the `<h2>`).

**Repair** (`revealTaskHeading.ts`, `VentilationStageHost.tsx`):

- The request is `{ sectionId, requestedAt }`, and only the section it names can take it. A
  different section arriving takes nothing and leaves it for its owner.
- It is made only by an activation that navigates this tab (`activatesThisTab`: primary button, no
  modifier, no `target` or `download` of its own — the rule the framework's link uses). A modified
  click is left entirely to the browser: not prevented, no request, no push.
- The chooser and the last step's link go through one `navigateToSection`, which runs the router
  push as a transition. Arriving unmounts the section, so if the transition settles and the section
  is still mounted the navigation did not happen and its own request is withdrawn.
- Browser back/forward withdraws a pending request (a one-shot `popstate` listener that exists only
  while a request does). The 15-second age limit remains as a last bound; it is no longer what
  identifies the request. No timer waits for or forces a navigation.

**After, production (1280×1000):**

| Scenario                                             | Result                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Same-tab Continue to the next section                | arrived, heading focused (430 px: already comfortable, so not scrolled — as before) |
| Same-tab section chooser                             | arrived, heading focused                                                            |
| Back, then Forward                                   | arrived, **not** focused, both                                                      |
| Command-click the link                               | new tab opened (its heading not focused); original tab still on its last step       |
| …then, in the original tab, All sections → Section 1 | **not focused** (`activeElement` is `BODY`); before the repair: the heading         |
| …then All sections → the section the link pointed at | not focused                                                                         |
| Control-click (macOS)                                | no navigation, no new tab, no request; later arrivals not focused                   |
| Capture, then Overlay, on the experiment step        | focus stays on the control used; page moved 0 px                                    |

Jest ("R4", 17) adds Shift-, Alt- and middle-click, a link with its own `target`, a navigation that
never happens, an unrelated arrival inside the lifetime, expiry, `popstate`, and rapid successive
choices (the section finally shown is the one revealed).

**N4, ordinary navigation, re-measured on production** — identical to the table in
[N4](#n4--explicit-navigation-only): 3 × bottom Continue, 2 × Back, step chooser, keyboard Enter on
Continue and Restart land the heading at 93 px under 81 px of chrome at 1280×900 and 1024×768, and
85 under 73 at 390×844, focused each time; 3 s of Run from the keyboard leaves focus on the button
and the page where it was; the section chooser lands at 430 / 93 / 85.

**Pinned-chrome probe.** `pinnedTopInset` now ignores an element that is not painted
(`display: none`, `visibility: hidden | collapse`, `opacity: 0`, or `checkVisibility()` false, which
also answers for hidden ancestors) and a sticky element with no top offset. The fixed-position
discovery was not redesigned. A unit test injects the review's cases and the two exclusions that
already existed.

### R5 — the console at 200 % root text

The review found it on the exact base and on the reviewed head; it was reproduced here on the
reviewed head, and repaired because the surface is one this batch changed. Root-text enlargement (`html { font-size: 32px }`), Practice case MV-14.

**Cause.** The monitored-value column's floor was in pixels (112 px on the C6) while the values in
it are in rem. At 200 % the C6 column was 125 px wide holding 169 px of text, which spilled 44 px
over the waveform label column: nine text collisions at 1280×1000 ("58 × Paw", "cmH2O × Pplateau",
"10.1 × Pmean" …). The same cause pushed the AVEA's values 71 px out of their column — past the
right edge of the console, 9 px of page overflow at 1024×768 — and the Evita's units 8–14 px.

**Repair** (`mechanical-ventilation.module.css`, module-local; the global site header is untouched):

- The three floors are rem: 6.5625 / 7 / 8.25 rem, which are the 105 / 112 / 132 px they had, so
  **nothing moves at the default text size** (C6 column measured identical at 100 %: 134, 160 and
  112 px at 1280, 1024 and 390). The phone rule's 84 px is 5.25 rem.
- The console screen is a query container. Narrower than 16 rem it puts the values in a band above
  or below the waveforms. No font size is reduced. 16 rem is below every console width at the
  default size down to a 320-px phone, so it is reached only with enlarged text.
- A slash-joined readout label ("PEEP/CPAP") may wrap after its slash. In a phone-width label
  column at 200 % it ran 19 px under its own value.

**After, production, 200 % root text** — four consoles × 1280×1000, 1024×768, 390×844, 320×740, and
the C6 at 100 % at the same four sizes: **20 of 20 runs with no text collision and no text outside
its column.**

| Console                | 1280×1000: value column / collisions | 1024×768          | 390×844 and 320×740 | Plateau row              | PEEP |
| ---------------------- | ------------------------------------ | ----------------- | ------------------- | ------------------------ | ---- |
| hamilton-c6            | 125 → 224 px / 9 → 0                 | 153 → 224 / 0     | stacked band; 9 → 0 | "Pplateau 46 · estimate" | "12" |
| drager-evita-v800-v600 | 132 → 264 px / units no longer spill | 0                 | stacked; 0          | "Pplat 46 · estimate"    | "12" |
| puritan-bennett-980    | banner layout, no column / 0         | 0                 | 0                   | "PPL 46 · estimate"      | "12" |
| carefusion-avea        | 105 → 210 px / values back inside    | 9 px → 0 overflow | stacked; 0          | "Pplat 46 · estimate"    | "12" |

Every readout value is on one line and clear of its label (smallest gap 5 px, "Pplateau" on the C6
at 390×844); the status word is readable; no bare `?`. The plateau word was also driven through each
console's own hold control at 1280×1000 (C6 Tools, Evita Procedures, PB980 front panel, AVEA
MANEUVER): `46 · estimate` → `46 · hold running` → `52 · not valid` on all four.

Page overflow at 200 %, by owner: at 1280×1000 and 1024×768 the page overflows 51 and 125 px from a
global site link outside `<main>` (platform lane, unchanged) and **0 px from anything inside the
module** (the AVEA's 9 px is gone). At 390×844 and 320×740 the Practice case layout itself is 98 and
103 px wider than the viewport at 200 % — the case workspace and the console's six-button nav — on
the reviewed head and after, unchanged by this repair and not new (the AVEA was 185 / 190 px and is
now 98 / 103).

### R6 — the effort row in words; the time axis on a narrow figure

**Reproduction** (reviewed head, Section 7's second application, captured): the retained comparison
drew "Effort · model (cmH₂O)" in both views and its description mentioned pressure, flow and volume
only. At 390×844 the zoomed time-axis title overlapped its first tick; at 320×740 it overlapped both
ticks zoomed and the first tick un-zoomed ("Time 0.00m breath start (s) · zoo2.25").

**Repair.**

- `content/effortDescription.ts` reads the retained samples of the breath that is drawn. Where the
  modeled effort is at or above the engine's own `EFFORT_DETECTION_FLOOR_CMH2O` it reports the first
  and last such sample as times from the first recorded inspiratory sample, the largest value and
  its time, the machine's sampled inspiration on the same axis, and the difference between the two
  ends as arithmetic. Section 7, second application, from the page:

  > Baseline breath: modeled effort is first at or above 1.5 cmH₂O 0.02 s after the first recorded
  > inspiratory sample, last at or above it at 0.58 s (largest 8.0 cmH₂O at 0.30 s); that is 0.92 s
  > before the machine's first expiratory sample. Machine inspiration, on the same axis, runs from
  > 0.00 s to its first expiratory sample at 1.50 s. Result breath: … that is 0.62 s before the
  > machine's first expiratory sample. … to its first expiratory sample at 1.20 s.

  It is introduced as "this simulator's modeled signal, not a measurement from a patient" and closed
  with "These are sample times on two modeled signals: they do not show that an effort started a
  breath, and no interval here is a measured delay." It never says trigger, never calls the signal a
  patient's effort, and reintroduces no measured trigger delay (asserted). A quiet record says the
  effort stays below the floor; a record with no complete breath says its effort row is not
  described. A test recomputes every number independently from the samples.

- The time axis keeps its two end ticks in the figure and its title is page text under it, in both
  figures. It wraps, grows with the reader's text and cannot reach a tick. The axis, its scale, the
  crop and the samples are unchanged (asserted: same end ticks, evidence byte-identical).
- The longer volume row label wraps onto two lines on a figure narrower than it (one row pitch for
  the whole figure), instead of spilling: at 320×740 the figure is 252 px wide.

**After, production:** Section 7's second application at 390×844, 320×740 and 1280×1000, side by
side and overlay, whole and zoomed — the effort description present in all 12 states; **0 axis
collisions and no figure text outside its figure in all 12** (reviewed head: collisions in 5 of the 8
phone states).

### Terminology after the repair

| Term                              | Means                                                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First recorded inspiratory sample | The first sample of a breath whose phase is inspiration. The origin of drawn time and drawn volume. It is recorded after one 20-ms step and already holds that step. |
| Received                          | Peak volume less the volume in the sample _before_ the first inspiratory sample: the ventilator's own exhaled-volume definition (413 or 427 mL at 40 L/min).         |
| Drawn rise                        | Peak volume less the volume _at_ the first inspiratory sample: one step smaller (400 or 413 mL).                                                                     |
| Inspiratory time · calculated     | The published reading in volume control: flow time from the selected volume and flow (0.63 s). Not timed on the trace.                                               |
| … s as sampled                    | Inspiratory samples × 20 ms on the drawn breath (0.62 or 0.64 s).                                                                                                    |
| Modeled effort                    | The simulator's effort signal. Never "measured", never the patient's, never a trigger event.                                                                         |
| Learner pause / background pause  | The origin carried on the pause action. Only the first can be the learner's inspection.                                                                              |

### Tests and commands (repair pass)

Node 26.5.0; `NODE_OPTIONS=--max-old-space-size=8192`. All at the implementation head.

**New:** `__tests__/mv-pre-review-03-repairs.test.tsx` — 82 tests: R1 (13), capture gate (28: one per
authored change round, the Section 11 gap, the Section 8 baseline), R2 (7), R3 (8), R4 (17),
R5 (3), R6 (6).

**Fails on the reviewed head for the defect.** A 10-assertion probe using only symbols that exist on
`02eb66e4` was run in the reviewed-head checkout, then removed: **10 failed on the reviewed head, 10
passed on the repaired tree** — hidden page with automatic capture (rendered); the hidden-page pause
(lab); one-breath stepping; capture offered with no complete breath; step 3's missing marker;
"breath start" in the comparison; Command-click then a later arrival; px column floors; no effort in
the comparison's text; a centred time-axis title inside the figure.

**Changed test contracts** (three; each encoded a label or signature this repair supersedes, not an
evidence rule):

- `mv-pre-review-01-evidence` — the volume-row label assertion follows the rename (and now also
  asserts the old label is gone). The invariant it protects — anchored display, engine volume
  untouched — is unchanged.
- `mv-pre-review-03-workbench` — the description assertion follows "(0.62 s as sampled)";
  `requestTaskHeadingReveal` is called with its destination.
- `test-support/live-learning.ts` — the Section 1 driver's pause says it is the learner's.

| Command                                                                                                                                                                                                                         | Result                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/mechanical-ventilation`                                                                                                                                                                                  | 44 suites, **1199 tests, all passing** (reviewed head: 43 suites, 1117)                                                                                  |
| Batch-03 suites                                                                                                                                                                                                                 | `mv-pre-review-03-workbench` 64/64 · `mv-pre-review-03-repairs` 82/82                                                                                    |
| Batch-01 suites                                                                                                                                                                                                                 | `mv-pre-review-01-evidence` 34/34 · `-01-sanity-repairs` 37/37 · `waveform-annotations` 17/17                                                            |
| Batch-02 suites                                                                                                                                                                                                                 | `-02-causality` 126/126 · `-02-sanity-repairs` 43/43 · `-02-rereview-repairs` 31/31 · `-02-alarm-history` 25/25 · `peep-comparison` 21/21 + rendered 4/4 |
| Post-action coaching, lab, routes                                                                                                                                                                                               | `post-action-coaching` 51/51 · `learning-lab` 16/16 · `src/app/[locale]/mechanical-ventilation/routes.test.tsx` 9/9                                      |
| MV + consumers: `…/mechanical-ventilation`, `src/app/[locale]/mechanical-ventilation`, `src/features/critical-care`, `src/features/learning-module`, `src/features/icu-simulation`, `src/lib/draft-modules.hamilton-c6.test.ts` | 94 suites, 1663 tests: 1660 passed, **3 failed — baseline** (below)                                                                                      |
| `npx tsc --noEmit -p tsconfig.json` (full, tests included)                                                                                                                                                                      | clean, exit 0                                                                                                                                            |
| `npx eslint src/features/mechanical-ventilation`                                                                                                                                                                                | clean, exit 0                                                                                                                                            |
| `npx prettier --check "src/features/mechanical-ventilation/**/*.{ts,tsx,css}"`                                                                                                                                                  | clean                                                                                                                                                    |
| `git diff --check 756c9aee..HEAD`                                                                                                                                                                                               | clean                                                                                                                                                    |
| `npm run build`                                                                                                                                                                                                                 | succeeded (exit 0) at `f804d3ac` and again at the implementation head                                                                                    |

**Baseline debt, reproduced before classifying.** The same three tests fail, and only those, on the
exact base `756c9aee`, on main at both fetches (`754bed0e` and `60e3bd64`), on the reviewed head and
on the repaired tree (each run in its own read-only checkout with this worktree's `node_modules`;
3 failed / 38 passed in the three files every time): `critical-care/__tests__/accessibility.test.tsx` ("keeps color-coded
circuit, pressure, alarm, and trend states readable without color"), `curriculum-sequencing.test.tsx`
("renders CRRT cases in authored station order…"), `learner-copy.test.ts`. The full output of the
three suites is identical on the reviewed head and the repaired tree, and the learner-copy scanner's
set of flagged (file, copy) pairs is identical on base, reviewed head and repaired tree — its one MV
entry (`VentilationPeepComparison.tsx`, "Engine-generated example values · no hold acquired")
predates Batch 03. This repair's copy adds no flagged string.

### Browser checks (repair pass)

Headless Playwright Chromium, fresh context per run, `deviceScaleFactor` 1, pages visible so the
page's own clock ran. **After** evidence is from the production build of the implementation head
(`npm run build` → `node server.js` on 127.0.0.1:3127). **Before** evidence is from a dev server of
the reviewed head `02eb66e4` on port 3128, except R5's before images, which are this worktree's dev
server with the reviewed head's stylesheet swapped in for the capture. The built-in browser pane was
not used (it reports `document.hidden`, which suspends the clock).

| Check                  | Viewports                                                                                             | Result                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| R1                     | 1280×1000                                                                                             | as tabulated; no page error                                                                                  |
| R2                     | 1280×1000, 390×844                                                                                    | marker on three rows, resolved, cursor independent, no page overflow                                         |
| R3                     | 1280×1000, 390×844; Section 2 captured; side by side, zoomed, overlay zoomed, overlay                 | origin wording in every state; no "breath start"; calculated / sampled labels; no overflow                   |
| R4                     | 1280×1000                                                                                             | as tabulated                                                                                                 |
| N4 ordinary navigation | 1280×900, 1024×768, 390×844 (reduced-motion context)                                                  | geometry and focus identical to the original table                                                           |
| R5                     | 200 % root text: 1280×1000, 1024×768, 390×844, 320×740 × four consoles; C6 at 100 % × the same four   | 20/20 clean; 100 % geometry unchanged                                                                        |
| Plateau words          | 1280×1000, four consoles, each console's own hold control                                             | estimate → hold running → not valid on all four                                                              |
| R6                     | 390×844, 320×740, 1280×1000; Section 7 second application; side by side and overlay, whole and zoomed | effort text in 12/12 states; 0 axis collisions in 12/12                                                      |
| Smoke                  | Sections 5, 9, 14 at 1280×1000 and 390×844                                                            | 6/6: change or hold made, run at 5×, captured, Continue lands the heading at 93 / 85 px focused, no overflow |

No uncaught page error in any run (a `pageerror` listener was on every page).

### Screenshots (repair pass)

In `MV-PRE-REVIEW-03-screenshots/`, prefixed `repair-`; downscaled to at most 900 px wide and
palette-reduced; signed-out, no account data. For the R5 console captures only, the global sticky
site header was un-pinned by an injected style so it would not paint over the element (at 200 % it
is about 377 px tall); nothing else on the page was altered.

| Finding | Before (reviewed head)                                                                                                                | After (production)                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1      | `repair-r1-before-hidden-auto-captured-1280x1000.png`                                                                                 | `repair-r1-after-hidden-nothing-recorded-1280x1000.png`, `repair-r1-after-learner-pause-captured-1280x1000.png`                                                               |
| R2      | `repair-r2-before-s1-step3-1280x1000.png`, `repair-r2-before-s1-step3-390x844.png`                                                    | `repair-r2-after-s1-step3-1280x1000.png`, `repair-r2-after-s1-step3-390x844.png`                                                                                              |
| R3      | `repair-r3-before-s2-side-by-side-1280x1000.png`                                                                                      | `repair-r3-after-s2-side-by-side-1280x1000.png`, `repair-r3-after-s2-overlay-zoomed-1280x1000.png`                                                                            |
| R5      | `repair-r5-before-c6-root200-1280x1000.png`, `repair-r5-before-c6-root200-390x844.png`, `repair-r5-before-avea-root200-1280x1000.png` | `repair-r5-after-c6-root200-1280x1000.png`, `repair-r5-after-c6-root200-1024x768.png`, `repair-r5-after-c6-root200-390x844.png`, `repair-r5-after-avea-root200-1280x1000.png` |
| R6      | `repair-r6-before-s7-overlay-zoomed-390x844.png`, `repair-r6-before-s7-overlay-zoomed-320x740.png`                                    | `repair-r6-after-s7-overlay-zoomed-390x844.png`, `repair-r6-after-s7-overlay-zoomed-320x740.png`                                                                              |

R4 is a focus result and has no screenshot; its evidence is the table above.

### Integration status

Not merged, not rebased. The branch is still based on `756c9aee`; `origin/main` was `754bed0e` when
the pass began and `60e3bd64` when it was re-fetched before the push. GitHub reports the PR
mergeable with a clean merge state.

A trial merge of the implementation head `945bf07a` into `60e3bd64`, in a temporary worktree (not
committed, not pushed, removed afterwards), applied with **no conflicts**. On the merge result the
MV-and-consumers suite ran 96 suites, 1708 tests — 1705 passed and the same three baseline tests
failed; the 44 MV suites (1199 tests) all passed — and the full type-check was clean. The same trial
against `754bed0e` with `f804d3ac` earlier in the pass gave the same picture (no conflicts; 1707
tests, 1704 passed, the same three; type-check clean).

### NOT RUN (repair pass)

- **Native tab hiding / OS-level suspension** — attempted, not achieved in headless Chromium (above).
  Only the scripted `visibilitychange` was exercised.
- Native browser zoom; Firefox and Safari; real devices; DPR 2. 200 % was root-text enlargement only.
- Real assistive technology. The effort description, the background-pause note and the status
  region were checked as text and semantics, not with a screen reader.
- The `measured` and `outdated` plateau words in the browser this round (Jest renders all five
  states on all four consoles; the browser exercised three).
- Middle-click and Shift/Alt-click in the browser (Jest only); a navigation that fails over the
  network in the browser (Jest only, with a router that does not navigate).
- The trial merge's production build and browser run; the es and zh-CN locales; the deployed build.
- Bounded all-case physiology replays: no physiology, clock or alarm code changed; the Batch-01/02
  protection suites were run instead and pass with unchanged counts.
- Any clinical, device, media or source review.

### Seen, not changed (repair pass)

- **Section 8, first application: the baseline record holds no complete breath** (10/min against a
  12-second window). Message corrected; drawing it is engine work.
- **Practice case layout on a phone at 200 % root text** is 98–103 px wider than the viewport
  (case workspace and console nav). Present before; outside the console/waveform layout R5 names.
- **Global site link at 200 % root text** overflows 51 / 125 px at 1280 / 1024 wide. Platform lane.
- **The PEEP/CPAP knob's own caption** wraps mid-word at 200 % root text ("PEEP/CPA P"). The value
  is intact; the knob is a control, not a waveform readout.
- **Authored conceptual copy** ("breath-relative volume", "the breath's starting reference") was
  not reworded; it describes the display concept, not the sampled origin.

## Delivery and scope

|                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected base                       | `2bc539f4e96fe66d196aae9ae08fad4c8131e79a`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Actual base (fetched `origin/main`) | `756c9aee7d7119f3817b5d85aaf73f9efa573418` (merge of PR #285). `main` had moved 41 commits; none touches `src/features/mechanical-ventilation`, `src/features/learning-module`, `src/features/critical-care` or the MV routes (`git diff --stat 2bc539f4 756c9aee -- …` is empty).                                                                                                                                                                                            |
| Branch / worktree                   | `claude/mechanical-vent-03-9-25` in a new worktree `…/Interventional-Pulm-Education-Worktrees/claude-mechanical-vent-03-9-25`. The session opened in `…/codex-mv-03`, a worktree last used on `codex/mv-03`; it was not used for any work. The Batch-01 and Batch-02 branches and worktrees were not touched.                                                                                                                                                                 |
| Implementation head                 | `0de3896d` (browser and test evidence below is from `d39d5d24` → `0de3896d`; see [Heads](#heads))                                                                                                                                                                                                                                                                                                                                                                             |
| Final head                          | the commit that adds this document and its screenshots (recorded in the PR)                                                                                                                                                                                                                                                                                                                                                                                                   |
| Files                               | all runtime, content and test changes under `src/features/mechanical-ventilation`; this document and `MV-PRE-REVIEW-03-screenshots/`. No shared `learning-module` stage file, shared `AnswerVerdict`, critical-care registry, progress store, other clinical engine, device-intelligence, backend, dependency or deployment change. No `.env.local` was created, modified or deleted; servers read the primary checkout's existing configuration into their own process only. |
| Held                                | Live clinical case MV-03 stays excluded. The alarm-limit harmful choice, D1–D5 and every source/review hold are unchanged. `content/source-cases.v1.json` is untouched.                                                                                                                                                                                                                                                                                                       |

### Heads

| Commit     | What                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `de71e6fe` | The batch: experiment panel, navigation, lesson structure, V1/V3/V4/V2, sampling, S2-1, B2, tests                                                                                                                                                             |
| `d39d5d24` | Two layout fixes found in the browser matrix: the control column comes first when the workbench stacks (phones), and the lesson's grid track can no longer grow past its box at 200 % text on 320 px                                                          |
| `ff7476dc` | S2-1 correction found while reading the production screenshots (see [S2-1](#s2-1--numerical-oddities-investigated-before-any-cosmetic-change))                                                                                                                |
| `0de3896d` | Test-only: the full type-check at `ff7476dc` failed on two TS2339 errors in the new suite (reading `ratePerMin` / `vtMl` off the settings union); narrowed, re-run clean. The production build's own type pass excludes tests, so only the full run caught it |

## 1. Reproduced on the base first

Every item below was reproduced on `756c9aee` before any edit, against this worktree's `next dev
--webpack` on port 3126, in headless Playwright Chromium (1× DPR, `document.visibilityState ===
'visible'`, so the page's own 100 ms clock ran — not the Appendix-B hidden-tab artefact). Each run used
a fresh browser context (clean `localStorage`).

### N4 / N7 — the task, the controls and the evidence on the base

Real sequence per run: open the section → top Continue to the experiment step → change the requested
control from paused (or request the hold, or select an interval in Section 1) → wait 1.5 s → set 5× →
Run → wait until Capture enabled → Capture → bottom Continue. Positions are `getBoundingClientRect().top`
in CSS px at the moment named; the site header is `position: sticky`, 0–81 px, at every desktop size;
the document is the only scroll owner (no element had its own vertical scroll).

| Viewport  | Section | Heading after entry    | Run (separate row) | Control | Readings | Capture | Heading after bottom Continue | Focus after bottom Continue |
| --------- | ------- | ---------------------- | ------------------ | ------- | -------- | ------- | ----------------------------- | --------------------------- |
| 1280x1000 | 1       | 352                    | 632                | —       | 1260     | 1624    | -1419                         | Continue button             |
| 1280x1000 | 2       | 430                    | 689                | 875     | 1317     | 1659    | -751                          | Continue button             |
| 1280x1000 | 5       | 430                    | 689                | 907     | 1317     | 1711    | -803                          | Continue button             |
| 1280x1000 | 7       | 430                    | 689                | 875     | 1317     | 1659    | -805                          | Continue button             |
| 1280x1000 | 9       | 430                    | 1609               | 1795    | 2387     | 3038    | -4093                         | document body               |
| 1280x1000 | 14      | 430                    | 689                | 1128    | 1719     | 2092    | -1184                         | Continue button             |
| 1427x1000 | 1–14    | identical to 1280×1000 |                    |         |          |         |                               |                             |
| 1280x900  | 1       | 302                    | 582                | —       | 1210     | 1574    | -1469                         | Continue button             |
| 1280x900  | 2       | 430                    | 689                | 875     | 1317     | 1659    | -801                          | Continue button             |
| 1280x900  | 5       | 430                    | 689                | 907     | 1317     | 1711    | -853                          | Continue button             |
| 1280x900  | 7       | 430                    | 689                | 875     | 1317     | 1659    | -855                          | Continue button             |
| 1280x900  | 9       | 430                    | 1609               | 1795    | 2387     | 3038    | -4144                         | document body               |
| 1280x900  | 14      | 430                    | 689                | 1128    | 1719     | 2092    | -1234                         | Continue button             |
| 1024x768  | 1       | 219                    | 516                | —       | 1187     | 1573    | -1638                         | Continue button             |
| 1024x768  | 2       | 438                    | 691                | 878     | 1363     | 1727    | -927                          | Continue button             |
| 1024x768  | 5       | 438                    | 691                | 910     | 1363     | 1799    | -999                          | Continue button             |
| 1024x768  | 7       | 438                    | 691                | 878     | 1363     | 1727    | -1002                         | Continue button             |
| 1024x768  | 9       | 438                    | 1695               | 1881    | 2495     | 3271    | -4666                         | document body               |
| 1024x768  | 14      | 438                    | 691                | 1130    | 1743     | 2143    | -1359                         | Continue button             |

- **N4 reproduced** at every size: after the bottom Continue the step changed while the new heading
  was 751–4666 px above the viewport and focus stayed on the button (the walkthrough measured
  ~870 px at 1280×900; this base gave 801 px for Section 2).
- **N7 reproduced**: Run lived in a separate "Playback / inspection" row; the requested control was
  below the fold at 1280×1000 in Sections 9 and 14; Capture was 1573–3271 px down. Changing the
  control while paused did nothing visible for 1.5 s. The status copy was "The requested action is
  present. Check the measurement status and response interval." and Section 1 printed "Observe for
  0 simulated seconds".
- **T1 reproduced**: every section's teaching sat inside a closed `<details>` titled "Teaching and
  worked references", with further closed panels inside it from Section 6 on.

### The other assigned findings on the base

| ID                 | What the base showed                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1                 | Section 5 idealized comparison: flow axis `400` / `-400` L/min; VC's 24 L/min square flow and PC's 55 L/min decelerating flow both near-flat.                                                                                                                                                                                                                                                                                                                                             |
| V2                 | Optional question card `rgb(247, 249, 247)`; bedside "Live patient status" card `rgb(255, 255, 255)`; Section 11 reading-sequence card `rgb(246, 248, 245)` with an SVG containing **no `<text>` at all** (four unnamed traces).                                                                                                                                                                                                                                                          |
| V3 / S1-4 sampling | `labSnapshot` kept one sample in four (`index % 4 === 0`): captured baselines and results were 80 ms records beside the 20 ms reference. Held records were halved above 150 samples.                                                                                                                                                                                                                                                                                                      |
| V4                 | Practice MV-14 (PEEP 12) on all four facsimiles: the plateau readout printed `46?` — a bare `?` with no legend. At 100 % root text PEEP `12` stayed on one line at 1024–1427 px on the current base (not reproduced as the walkthrough described it at DPR 2); **at 200 % root text** PEEP `12` broke onto two lines ("1" / "2") on the C6, Evita and AVEA and the plateau `46?` onto three; the PB980 banner layout did not wrap. The readout `<dd>` inherits `overflow-wrap: anywhere`. |
| S2-1               | See [S2-1](#s2-1--numerical-oddities-investigated-before-any-cosmetic-change). Walk step: "Cursor at 0.00 s" beside "At the cursor in the inspiratory interval, the flow segment is nearly level…".                                                                                                                                                                                                                                                                                       |
| S6-2               | Sections 1–5 rendered a different teaching layout (`FoundationTeaching`) from Sections 6–14 (`StageBlock` panels), and Section 1–5 read steps printed a second "Learn the relationship" block with the same unit text.                                                                                                                                                                                                                                                                    |
| S7-2               | Batch 01's repair holds: Section 7 steps 6 and 7 draw "Effort · model (cmH₂O)" on the live figure. Nothing to repair beyond keeping it in the new layout (verified below).                                                                                                                                                                                                                                                                                                                |
| B2                 | See [B2](#b2--one-pathway-click-reset-the-page).                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## 2. Disposition by assigned finding

| ID                       | Disposition                                                                                                 | What was done                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N4**                   | **Reproduced → repaired**                                                                                   | Explicit Continue (top and bottom), Back, the step chooser, Restart, the section chooser and the last step's "Continue to …" link bring the new step's `<h2>` into view and focus it. Nothing else does. See [N4](#n4--explicit-navigation-only).                                                                                                                |
| **N7**                   | **Reproduced → repaired**                                                                                   | An "Experiment" panel inside the step card, under the instruction: stage chip, headline, goal checklist, model-time response interval, Run experiment / Pause, Advance one breath, speed, Capture result and an opt-in automatic capture. Engine-language copy removed; no interval line when the round has none. See [N7](#n7--the-experiment-beside-the-task). |
| **T1**                   | **Reproduced → repaired**                                                                                   | The wrapper is gone. Each step shows the lesson in one shape with three named disclosures. See [T1 / S6-2](#t1--s6-2--one-lesson-shape).                                                                                                                                                                                                                         |
| **S6-2**                 | **Reproduced → repaired**                                                                                   | Sections 1–5 and 6–14 now render the same lesson structure; 1–5 are shorter (no mechanism panel) and add their worked demonstration as the evidence part.                                                                                                                                                                                                        |
| **V1**                   | **Reproduced → repaired**                                                                                   | One scale fitted to the displayed VC/PC pair, shared by both modes: pressure 0–20 cmH₂O, flow ±60 L/min, volume 0–500 mL at the reference. The all-settings ±400 scale is kept as an explicit choice. Row labels with units; zero marked. Waveform values unchanged.                                                                                             |
| **V2**                   | **Reproduced → repaired (module-local)**                                                                    | Question card, bedside card, ARDS reference card and all nine mechanism panels on the module's dark palette; the reading-sequence figure names each row with unit and scale. Global theme untouched.                                                                                                                                                             |
| **V3**                   | **Reproduced → repaired**                                                                                   | Side-by-side or overlay view; inspiration zoom that crops the same seconds of both breaths; full-resolution records; a text description drawn from the samples.                                                                                                                                                                                                  |
| **V4**                   | **Reproduced (plateau `?` at 100 %, digit wrap at 200 % root text) → repaired**                             | The plateau's acquisition state printed as a word under the value on every facsimile; numbers never break between digits; the label column is in rem.                                                                                                                                                                                                            |
| **S2-1 (presentation)**  | **Investigated → labelled; one demonstrated capture error repaired**                                        | The 80 ms thinning (duration 3.68 s) is repaired; 427 vs 420 mL is a real, alternating model output and is now explained, not rounded; the worked sentence is printed only beside a cursor it describes.                                                                                                                                                         |
| **S1-4 (sampling half)** | **Repaired**                                                                                                | Captured baselines are now 20 ms records like the reference.                                                                                                                                                                                                                                                                                                     |
| **S7-2 (visual half)**   | **Verified, nothing to change**                                                                             | Effort row present, labelled, on the same time axis, at 1280 and 390 px.                                                                                                                                                                                                                                                                                         |
| **B2**                   | **Hub path: not reproduced / unconfirmed. Same-component race on the Learn landing: reproduced → repaired** | See [B2](#b2--one-pathway-click-reset-the-page).                                                                                                                                                                                                                                                                                                                 |

## N4 — explicit navigation only

`components/stage/revealTaskHeading.ts`, called only from the host's navigation handlers:

- **Pinned chrome is measured at the moment of navigation**: every `position: fixed | sticky`
  element currently pinned across the top (top ≤ 1 px, at least half the viewport wide, at most half
  its height). _Repair pass:_ an element that is not painted, and a sticky element with no top
  offset, no longer count. Measured values: 81 px at desktop sizes, 73 px at 390/320, ~377 px at 1280×1000 with
  200 % root text (the site header wraps). No fixed offset exists anywhere.
- **Scroll owner**: `heading.scrollIntoView({ block: 'start', behavior: 'instant' })` with
  `scroll-margin-top` set to the measured inset + 12 px, so whichever ancestor scrolls is moved. In
  the task flow that is the document.
- **Instant, explicitly.** The site sets `html:focus-within { scroll-behavior: smooth }`; with
  `behavior: 'auto'` the scroll became smooth and the step's own re-render cancelled it — measured
  on the first attempt (heading left at −580 px). `'instant'` also satisfies reduced motion.
- A step change aligns the heading under the chrome (at 1280×900 a heading left at 430 px put the
  requested control below the fold). A section change scrolls only when the heading is under the
  chrome, below the fold or in the lower half of what is left, so the new section's title is not
  scrolled away on arrival (1280×900: stays at 430; 1024×768: moved to 93).
- Focus moves to the `<h2>` (`tabIndex=-1`, `aria-describedby` → the "Step n of m · Application k"
  line) with `preventScroll`. `:focus-visible` shows the ring for keyboard users.
- A section change goes through the router and remounts the host; the chooser leaves a one-shot,
  15-second request that the new section's first render consumes. A reload, a link from elsewhere
  or browser back never sets it. _Superseded by the repair pass (R4):_ the request now names its
  destination, is made only by a same-tab activation, and is withdrawn when its navigation does not
  happen; a Command-click used to leave it behind for any section to take.
- Nothing listens for focus. Ticks, Run/Pause, captures, control edits and disclosures never call it.

Production build, measured (`nav-keyboard` probe, reduced-motion context):

| Viewport | 3 × bottom Continue                        | 2 × Back    | Keyboard Tab→Enter on Continue | Step chooser → 7 | 3 s of Run (Space)                  | Section chooser → 8                |
| -------- | ------------------------------------------ | ----------- | ------------------------------ | ---------------- | ----------------------------------- | ---------------------------------- |
| 1280×900 | heading 93 (chrome 81), focused, each time | 93, focused | 93, focused                    | 93, focused      | focus stays on Run; page moved 0 px | 430 (already comfortable), focused |
| 1024×768 | 93, focused                                | 93, focused | 93, focused                    | 93, focused      | stays on Run; 0 px                  | 93, focused                        |
| 390×844  | 85 (chrome 73), focused                    | 85, focused | 85, focused                    | 85, focused      | stays on Run; 0 px                  | 85, focused                        |

## N7 — the experiment beside the task

`content/experimentStatus.ts` names the state that `labGoalMet`, `labReadyToCompare`, the round's
`seconds` and the session's `readySince` already define; it adds no gate. Stages:

| Stage                  | When                                                                                      | Headline (examples)                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not-started`          | round not in its experiment phase (e.g. a jump straight to an observe step)               | "Not started. Start the experiment from its baseline to record a result." + a Start button                                                                     |
| `awaiting-action`      | a requested change / maneuver / interval selection not in place                           | "Paused. Next: set the inspiratory flow to 60 L/min."                                                                                                          |
| `awaiting-measurement` | a requested hold is queued or running, or (Section 4) the last hold was not interpretable | "Hold requested; the valves close at the next breath boundary. It happens only while the experiment runs."                                                     |
| `awaiting-effect`      | a bedside action was selected and its modeled delay has not elapsed                       | "Treat the pain: selected; its modeled effect starts in 118 s of model time."                                                                                  |
| `awaiting-interval`    | everything in place; interval running                                                     | paused: "Change in place. Run the experiment to let the patient respond: 0.0 of 12 s so far." running: "Running. Response interval 4.0 of 12 s of model time." |
| `ready`                | `labReadyToCompare`                                                                       | "Ready to capture. Everything requested is in place and 12 s of model time have passed."                                                                       |
| `captured`             | a response exists                                                                         | "Result captured at 13.0 s of model time. Reset the patient to repeat it."                                                                                     |

- **Cancelled / invalidated**: undoing the requested change drops `readySince`; the panel says "The
  requested change is no longer in place, so the response interval stopped…" (derived from the
  previous stage during render). Reset, device change and a new application remount the panel.
  Confounds are still listed by the workbench.
- **Run**: the only thing that starts the clock is Run experiment (or Advance one breath). A control
  edit leaves `paused: true`, the time unchanged and no response — asserted.
- **Automatic capture**: a checkbox, off by default and off again after any reset/device/application
  change. It dispatches the ordinary `COMPARE` when `labReadyToCompare` becomes true and the
  comparison has no confounds; with confounds it says it is held and leaves Capture to the learner.
  It runs from session state (model time), so it does nothing while paused or hidden, and respects
  speed and one-breath stepping. Manual Capture and Pause/inspect remain. _Corrected by the repair
  pass (R1):_ in Section 1 a hidden page _was_ recorded as the learner's pause and captured; a pause
  now carries its origin, and `labReadyToCompare` also requires a complete breath on the record.
- **Announcements**: a polite status region whose text depends only on the stage and the run state
  — identical at 4 s and 7 s of the same interval (asserted) — so it speaks transitions, not ticks.
  The model-time readout is `aria-live="off"`.
- The workbench's own playback row is hidden on experiment steps (one clock control per patient).
- **Adjacency**: readings moved above the live trace; the bedside and PBW cards moved into the signal
  column; Section 9's worked PEEP comparison and the lesson follow the workbench on experiment steps.
  Below 1000 px the control column stacks first.

Production, after (`after` probe; same real sequence as the base table; positions in CSS px):

| Viewport  | Section | Heading after entry    | Run | Capture | Requested control | Readings | Heading after bottom Continue (pinned chrome bottom) | Focus       | Page overflow |
| --------- | ------- | ---------------------- | --- | ------- | ----------------- | -------- | ---------------------------------------------------- | ----------- | ------------- |
| 1280x1000 | 1       | 93                     | 330 | 384     | on the figure     | 1054     | 93 (81)                                              | new heading | none          |
| 1280x1000 | 2       | 93                     | 353 | 407     | 730               | 600      | 93 (81)                                              | new heading | none          |
| 1280x1000 | 5       | 93                     | 353 | 407     | 762               | 600      | 93 (81)                                              | new heading | none          |
| 1280x1000 | 7       | 93                     | 353 | 407     | 730               | 600      | 93 (81)                                              | new heading | none          |
| 1280x1000 | 9       | 93                     | 353 | 407     | 730               | 600      | 93 (81)                                              | new heading | none          |
| 1280x1000 | 14      | 93                     | 353 | 407     | 730               | 600      | 93 (81)                                              | new heading | none          |
| 1427x1000 | 1–14    | identical to 1280×1000 |     |         |                   |          |                                                      |             | none          |
| 1280x900  | 1–14    | identical to 1280×1000 |     |         |                   |          |                                                      |             | none          |
| 1024x768  | 1       | 93                     | 346 | 400     | on the figure     | 1114     | 93 (81)                                              | new heading | none          |
| 1024x768  | 2       | 93                     | 348 | 401     | 725               | 595      | 93 (81)                                              | new heading | none          |
| 1024x768  | 5       | 93                     | 348 | 401     | 757               | 595      | 93 (81)                                              | new heading | none          |
| 1024x768  | 7       | 93                     | 348 | 401     | 725               | 595      | 93 (81)                                              | new heading | none          |
| 1024x768  | 9       | 93                     | 369 | 423     | 746               | 617      | 93 (81)                                              | new heading | none          |
| 1024x768  | 14      | 93                     | 348 | 401     | 725               | 595      | 93 (81)                                              | new heading | none          |
| 390x844   | 2       | 85                     | 402 | 537     | 976               | 1067     | 85 (73)                                              | new heading | none          |
| 390x844   | 14      | 85                     | 381 | 516     | 955               | 1193     | 85 (73)                                              | new heading | none          |
| 320x740   | 2       | 85                     | 546 | 703     | 1215              | 1307     | 85 (73)                                              | new heading | none          |
| 320x740   | 14      | 85                     | 499 | 657     | 1168              | 1447     | 85 (73)                                              | new heading | none          |

All 36 runs (6 sections × 1280×1000, 1427×1000, 1280×900, 1024×768, 390×844, 320×740) completed the
sequence, captured, landed the heading at pinned chrome + 12 px with focus after the bottom Continue
and after Back, and had no horizontal page overflow. At 1280×1000–1024×768 the instruction, Run,
Capture, readings and the requested control share one view. Section 1's maneuver is on the
captured-breath figure inside the panel (Run 330, Capture 384; figure below). On phones the order is
instruction → panel → control → readings → trace (control at 955–1215 px; it was 2013–3418 px before
`d39d5d24`).

## T1 / S6-2 — one lesson shape

`VentilationTeachingColumn` now renders every section, in this order:

1. **The idea** (`spec.newConcept`) and **By the end you can** (`spec.objective`) — always shown.
2. **For this step** — the breath-landmark card on a walk or single-stop step; the "While you do
   this" guide on an experiment step; "The picture and the checklist" (analogy, explanation, checklist)
   otherwise; on explain steps also "Why it matters" and this section's row(s) of the one table.
3. **Evidence the step reads** — Sections 1–5: the worked demonstration (Section 1–2 captured
   reference, Section 3 setting map, Section 4 reference hold, Section 5 idealized comparison) with
   its reading sentence before it and its limit directly after it. Sections 6–14 on reading steps: the
   separate normal breath, the normal-timing illustration or the ARDS reference.
4. **Worked example**, **More detail** (why a ventilator exists, the full one table, which control if
   any, the live mechanism panel, story problems, playback note) and **Model limits**, always in that
   order, as named `<details>`. On reading and explain steps the model limit is shown instead of
   folded, so it appears exactly once (asserted for all 14 sections × every step kind). Sources: the
   page footer, now headed "Sources" (`#mv-section-sources`), linked from every lesson.

No lesson content was deleted or reworded: the Section 1–5 `foundationTeaching` title, purpose,
explanation, worked sentence and boundary are all still printed, and the duplicate
"Learn the relationship" block is gone because its text is part of the lesson. The marked Section 1
reference stays in the step card on its read/predict/explain steps (Batch 01).

## V1 — the VC/PC scale

The reference signals are unchanged (`idealBreaths`): VC 24 L/min square; PC 55.5 L/min at the start
of inspiration decaying to ~7; both expire from 48 L/min. The old axis came from the extreme offered
change (twice the compliance at a quarter of the resistance), rounded to ±400. `idealPairAxes` takes
the two breaths on screen and gives one axes object to both modes, so neither is normalised on its
own: VC fills 40 % of the ±60 half-range and PC's peak 92 %; their on-screen heights keep the
55.5 : 24 ratio (asserted). Flow stays symmetric so inspiration and expiration read alike. The
fixed all-settings scale is one button away ("Fixed across every offered setting", `aria-pressed`),
and the note under the figure states which scale is in use and that "fitted" re-fits when the
illustration mechanics change. Nothing is off-scale on either scale, so no off-scale marker is drawn.
Row titles carry units; scale values are right-aligned in their own gutter (the −400 / "volume (mL)"
crowding is gone); zero is labelled on the flow row.

## V3 — overlay and inspiration zoom

In the retained comparison (beside the task after capture, and in the explanation):

- **View**: Side by side | Overlay, as `aria-pressed` buttons (keyboard-operable; a pressed button
  carries a check mark and a heavier border, not colour alone). Radios were avoided so that "no
  answer radio is pre-checked" stays a meaningful invariant.
- **Overlay**: both breaths from their own onset on the same physical axes; baseline dashed at 75 %
  opacity, result solid; legend in words.
- **Zoom to inspiration**: a crop of 0 to (longer sampled inspiration + max(0.3 s, 50 %)) — 0.93 s
  for the Section 2 pair — applied identically to both breaths. The same seconds map onto a wider
  plot; samples outside are not drawn (one sample beyond each edge is kept, clipped, so a line leaves
  the plot where it really goes). Each figure still reports its own measured duration and says
  "Showing 0.00–0.93 s of this 3.74-s breath … nothing is retimed or resampled"; the whole breath is
  one press away.
- **Text equivalent** (both views): for each breath drawn, its inspiratory flow in samples and
  seconds, its onset-to-onset duration, the volume it received (peak less the sample before its
  onset — the ventilator's own exhaled-volume definition), peak flow and peak pressure, and a line
  saying the readings table is what the ventilator published at capture and is not all taken from the
  drawn breath. _Repair pass (R3, R6):_ the origin is named as the first recorded inspiratory
  sample, the drawn rise is given beside the received volume, and the effort row has its own
  sample-derived description where it is drawn.
- Changing the view changes no evidence (the captured record is byte-identical before and after,
  asserted).

## Sampling integrity

- `labSnapshot` now keeps `state.waveforms` whole: 601 samples at 20 ms for the 12-second buffer.
  The thinning existed to bound a saved lab checkpoint; nothing saves one any more
  (`useVentilationLabProgress` has no importer; the self-paced host keeps runs in memory). The
  legacy parser's bound grew from 160 to 800 samples, so every record that parsed before parses
  identically.
- `updateHoldAcquisition` no longer halves held records above 150 samples. Hold values,
  interpretability and revision are unchanged; only the drawn record is finer.
- Nothing is interpolated or synthesised. Extrema and phase boundaries are whatever the engine
  sampled (asserted: peak pressure of the snapshot equals the buffer's).
- Every captured figure prints its measured spacing: "samples every 20 ms, so a time is resolved to
  one sample". A legacy 80 ms record would say "every 80 ms".

## S2-1 — numerical oddities investigated before any cosmetic change

| Observation                                                            | Traced to                                                                                                                                                                                                                                                                                                                                                                | Disposition                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Breath duration 3.68 / 3.73 / 3.74 / 3.76 s at 16/min (3.75 s)         | The captured record kept one sample in four, so both onsets had to land on 80 ms positions (±0.08 s). At 20 ms the onset-to-onset duration is 3.74 or 3.76 s — the cycle is 187.5 samples                                                                                                                                                                                | **Capture error repaired** (full resolution); duration **labelled** with its sample spacing. Not forced to 3.75.                                                                                                                                                                                                    |
| Exhaled 427 mL vs selected 420 mL                                      | Real model output. The engine integrates flow in 20 ms steps; the 0.63-s inspiration at 40 L/min is 31.5 steps, and because onsets fall at different points between samples, **successive breaths receive 31 or 32 steps: 413 or 427 mL** (one-minute replay: 8 of each). At 60 and 30 L/min the flow time is a whole number of steps and every breath is exactly 420 mL | **Labelled, not rounded**: the reading keeps its value and gains "…successive breaths receive 31 or 32 steps — about 413 or 427 mL", printed only for square-flow volume control whose flow time is not a whole number of steps and whose exhaled volume is within one step of the selection. Delivery not changed. |
| "At the cursor in the inspiratory interval…" beside "Cursor at 0.00 s" | The walk opens on Trigger and the figure's cursor follows the landmark; the worked sentence was written for mid-inspiration. On multi-stop steps the figure used the first stop (Trigger)                                                                                                                                                                                | **Repaired**: off the walk, the figure uses the stop its worked sentence reads; on the walk the sentence is printed only when the cursor is at Inspiration, and otherwise says which landmark it reads.                                                                                                             |

The first S2-1 note I wrote (`de71e6fe`) described a one-sided overshoot ("stops at the first step
that reaches the selected volume"). Reading the production screenshots, the drawn breath had 31
inspiratory samples and received 413 mL; a one-minute tally found the alternation, and `ff7476dc`
states it. Two related quantities are **seen, not changed** (below): the "Inspiratory time" reading is
the calculated 0.63 s while the drawn breaths flow for 0.62 or 0.64 s, and the Batch-01 volume anchor
starts at the first inspiratory sample, which already holds one step (13 mL at 40 L/min).

## S7-2 — visual completion

Section 7 steps 6 and 7: the live figure has four rows with the third "Volume from breath start (mL)"
(since the repair pass: "Volume from first inspiratory sample (mL)") and the fourth "Effort · model (cmH₂O)", scale −25 to 5 with zero marked, the same x-scale as the
others, and the model-signal note under the figure. Present at 1280 and 390 px. The retained
comparison now draws the effort row too when the step's presentation asks for it. No trigger
physiology was touched.

## V4 — the four facsimiles

The plateau readout prints the value and, under it, one word from `plateauAcquisition(state).status`,
with the projection's full `detail` as its tooltip: estimate · hold running · not valid · outdated ·
measured (a surface that withholds an unacquired value drops the row, so "not acquired" never reaches
a readout). Amber is kept for anything that is not a valid acquisition, but the word carries the
meaning. The console's visible text equivalent still carries the full clause, including the effort
reason. `.waveformReadouts dd` is `white-space: nowrap; overflow-wrap: normal`; the label may wrap
between words; the label column is 5.75 rem (92 px at 16 px root), 4.25 rem below 620 px.

Browser (dev and production, 1280×1000):

| Facsimile (`data-device`) | Open (MV-14)  | Hold requested    | After the hold (MV-14, effort) | Section 4 passive patient after a hold | …after changing resistance | PEEP 12 at 100 % / 200 % root text |
| ------------------------- | ------------- | ----------------- | ------------------------------ | -------------------------------------- | -------------------------- | ---------------------------------- |
| hamilton-c6               | 46 · estimate | 46 · hold running | 52 · not valid                 | 13 · measured                          | 13 · outdated              | 1 line / 1 line                    |
| drager-evita-v800-v600    | 46 · estimate | 46 · hold running | 52 · not valid                 | 13 · measured                          | 13 · outdated              | 1 line / 1 line                    |
| puritan-bennett-980       | 46 · estimate | 46 · hold running | 52 · not valid                 | 13 · measured                          | 13 · outdated              | 1 line / 1 line                    |
| carefusion-avea           | 46 · estimate | 46 · hold running | 52 · not valid                 | 13 · measured                          | 13 · outdated              | 1 line / 1 line                    |

Each hold used the facsimile's own control (C6 Tools → Inspiratory hold; Evita Procedures; PB980
Inspiratory pause; AVEA MANEUVER). No `\d?` appears in any console's text. Jest renders all five
states on all four devices from engine states and asserts the word, the tooltip, the absence of a
bare `?`, and that rendering leaves the patient state byte-identical.

## V2 — module-local theme

- Question card in the Learn flow: dark surface, `color-scheme: dark`, the card's stylesheet now
  reads variables whose defaults are its old light values (the Applications page and MV-UX-01's
  light-scheme contract are unchanged). The chosen row keeps tint + accent border + inset ring.
- Bedside "Live patient status" card, and the Section 6 ARDS reference: dark token values scoped to
  the Learn flow; the navy vital-sign strip keeps its own surface.
- Mechanism panels (`mechanical-ventilation-teaching.module.css`, used only by the nine panels): all
  145 colour literals mapped by role onto the module palette (surfaces, text, accent, the three
  verdict tints, benefit/cost, trend, effort/zero-flow red); pressed toggles keep a bright fill with
  dark text as their selection cue. Rendered with `npm run render:mv-teaching` and checked by eye;
  every surface background has relative luminance < 0.45 (asserted).
- Reading-sequence figure: four rows titled "Pressure (cmH₂O)", "Flow (L/min)", "Volume (mL)",
  "Patient effort · model (cmH₂O)", each with its scale (−5/45, −80/0/80, 0/800, −25/5), drawn from one
  table that also drives the traces, and capped at 30 rem wide.

## B2 — one pathway click reset the page

Bounded matrix, fresh browser contexts, dev and production, 1× and 6× CPU throttling:

| Scenario                                                                                                | Runs                         | Result                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub → "Browse all 14 sections" (clicked as soon as it responded) → Section 1 "Up next" chip             | 5 × 2 throttles × dev + prod | 20/20 navigated on the first click (266–437 ms)                                                                                                                                                                                                                                                                                                                               |
| Learn landing, chip clicked at first paint (before hydration: `data-hydrated=false`)                    | same                         | 20/20 navigated (full navigation before hydration, client after)                                                                                                                                                                                                                                                                                                              |
| …then browser Back and the chip again                                                                   | same                         | 20/20 navigated                                                                                                                                                                                                                                                                                                                                                               |
| **Learn landing with stored progress** (Sections 1–5 visited), chip clicked 0–1500 ms after first paint | 5 delays × 2 throttles       | **Reproduced on the base component**: first paint opened stage 1 with Section 1 "Up next"; the storage read after hydration collapsed stage 1 and opened stage 3 with a different "Up next". A click in that window found its target gone (1× at 400 ms; Playwright timed out on a hidden element; a person's click lands on whatever moved under it while the page shrinks). |

Cause: `VentilationPathwayAccordion` chose its open group and "Up next" chip from the empty progress
that the server and first client render see, and chose again when stored progress arrived. Repair: the
accordion opens nothing and marks nothing until progress is read, chooses the open group once, and
never closes a group afterwards. Production after the repair: returning learner `00000 → 00100`,
fresh learner `00000 → 10000`, no collapse, no "Up next" change, at 1× and 6×.

**The walkthrough's exact path (the hub's "Browse all" accordion, which only appears after
hydration) was not reproduced and remains unconfirmed.** The repair addresses the demonstrated race
in the same component; it is not claimed to be the event the walkthrough saw once.

## Protected Batch-01 / Batch-02 contracts

UI consumes the existing projections; none was re-derived:

- Plateau: `plateauAcquisition` (status, value, detail, `supportsMechanicsClaim`) is the only source
  for the console word, the readings row and the integration panel. Every live case still opens on
  `reference-estimate` (asserted).
- Experiment gates: `labGoalMet` / `labReadyToCompare` unchanged; the panel and automatic capture read
  them. Reading, revealing, navigating and opening disclosures record no run, capture or action
  (asserted).
- Marker identity, cursor independence, phase-label toggle (Batch 01): unchanged; the marked Section 1
  reference still sits in the step card.
- ABG specimens, post-action evidence, trigger labels, BreathClock, PEEP reversal, PEEP-13
  containment, speed and alarm-history invariance (Batch 02): no engine file changed except the
  capture/record thinning above; their suites pass unchanged (counts below).
- Legacy stores: parse bound only widened; no storage key or schema field changed.

## Tests

**New:** `__tests__/mv-pre-review-03-workbench.test.tsx` — 64 tests: experiment stages from real
sessions (paused edit does not run; interval; undo cancels; hold in progress; zero-interval round);
Run and Capture inside the step card with no engine copy for all 14 sections; opt-in automatic capture
only once ready, never with confounds; explicit navigation reveal/focus for Continue, bottom Continue,
Back and the chooser, and no scroll/focus on ticks, Run/Pause, control changes or disclosures; no
global focus listener; section-change one-shot; the lesson shape for all 14 sections × every step
kind; V1 axes and labels; full-resolution sampling; S2-1 413/427 alternation and the note; the
worked-sentence/cursor rule; V3 zoom/overlay/description and evidence immutability; S7-2 effort row;
V4 five states × four devices; V2 surfaces and labelled reading rows; B2 accordion; earlier-contract
checks.

**Assertions that fail on the base for the defect.** An 11-assertion probe using only symbols that
exist on `756c9aee` was run in a read-only detached worktree at that SHA (with this worktree's
`node_modules`), then removed: **11 failed on the base, 11 passed on the head** — snapshot keeps 20 ms
samples; no "Observe for 0 simulated seconds"; Run inside the step card; bottom Continue focuses the
new heading; no "Teaching and worked references"; no bare `?` on any console; readout values
`nowrap`; default VC/PC flow axis not ±400; Learn question card not light-scheme; worked sentence not
beside a 0.00 s cursor; stored progress does not first open stage 1 and then collapse it.

**Changed test contracts** (each encoded the old UI, not a clinical or evidence rule):

- `stage-teaching-disclosure` — the wrapper `<details>` is replaced by "the lesson is present, not
  inside a `<details>`, has its idea part and a More detail disclosure".
- `stage-learner-review`, `peep-comparison.rendered` — "Capture observed response" → "Capture result";
  "Run" → "Run experiment".

## Commands (node 26.5.0; `NODE_OPTIONS=--max-old-space-size=8192`)

Suite totals in the "Head" column were run at `ff7476dc`; `0de3896d` changes only type narrowing in
the new test file, whose 64 tests were re-run there and pass.

| Command                                                                                                                                                                                                                         | Base `756c9aee`                                  | Head                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/mechanical-ventilation`                                                                                                                                                                                  | 42 suites, 1053 tests, all passing               | 43 suites, **1117 tests, all passing**                                                                                                                                                                                                                                |
| MV + consumers: `…/mechanical-ventilation`, `src/app/[locale]/mechanical-ventilation`, `src/features/critical-care`, `src/features/learning-module`, `src/features/icu-simulation`, `src/lib/draft-modules.hamilton-c6.test.ts` | 92 suites, 1517 tests: 1514 passed, **3 failed** | 93 suites, 1581 tests: 1578 passed, **the same 3 failed**                                                                                                                                                                                                             |
| Batch-01/02 regression suites at head                                                                                                                                                                                           | —                                                | `mv-pre-review-01-evidence` 34, `-01-sanity-repairs` 37, `-02-causality` 126, `-02-sanity-repairs` 43, `-02-rereview-repairs` 31, `-02-alarm-history` 25, `peep-comparison` 25, `post-action-coaching` 51, `learning-lab` 16, `waveform-annotations` 17 — all passing |
| `npx tsc --noEmit -p tsconfig.json` (full, tests included)                                                                                                                                                                      | —                                                | **failed at `ff7476dc`** (2 × TS2339, test file only); clean, exit 0, at `0de3896d`                                                                                                                                                                                   |
| `npx eslint src/features/mechanical-ventilation`                                                                                                                                                                                | —                                                | clean, exit 0                                                                                                                                                                                                                                                         |
| `npx prettier --check "src/features/mechanical-ventilation/**/*.{ts,tsx,css}"`                                                                                                                                                  | —                                                | clean                                                                                                                                                                                                                                                                 |
| `git diff --check 756c9aee..HEAD`                                                                                                                                                                                               | —                                                | clean                                                                                                                                                                                                                                                                 |
| `npm run build` (this worktree's dev server, then its production server, stopped first)                                                                                                                                         | —                                                | succeeded at `d39d5d24` and again at `0de3896d`                                                                                                                                                                                                                       |
| `npm run render:mv-teaching`                                                                                                                                                                                                    | —                                                | wrote the gitignored preview; nine panels checked by eye                                                                                                                                                                                                              |

**Baseline debt, reproduced on the exact base** in the read-only worktree with the same
`node_modules` and identical names: `critical-care/__tests__/accessibility.test.tsx` ("keeps
color-coded circuit, pressure, alarm, and trend states readable without color"),
`curriculum-sequencing.test.tsx` (CRRT "renders CRRT cases in authored station order"),
`learner-copy.test.ts`. The learner-copy scanner's full failure output is byte-identical on base and
head, so this batch's copy adds no flagged string.

## Browser checks

Headless Playwright Chromium (bundled build), fresh context per run, `deviceScaleFactor` 1, pages
visible (the clock ran; every run also used Run and 5× where timed). Dev: `next dev --webpack` on 3126. Production: `npm run build` → `node server.js` on 127.0.0.1:3127. The built-in pane was not used
for evidence (it reports `document.hidden`, which suspends the clock).

- **Six sections × six viewports**, production: 36/36 as tabulated above.
- **Navigation / keyboard**, production, three viewports: as tabulated in N4.
- **200 % root text** (`html { font-size: 32px }` — root-text enlargement, not CSS zoom, not native
  zoom): Learn Sections 2 and 14 at 1280×1000, 390×844, 320×740 — heading focused under the measured
  chrome, no page overflow at 390 and 320 (Section 14 at 320 overflowed 10 px before `d39d5d24`), Run
  and Capture reachable. At 1280×1000 the page overflows 51 px because of a **global site-header link**
  (platform lane). Practice consoles at 200 %: see V4.
- **Four facsimiles**: as tabulated in V4 (dev and production).
- **B2**: as tabulated (dev and production).
- **Reduced motion**: navigation probe ran with `prefers-reduced-motion: reduce`; scrolling is
  instant regardless.
- Console: no uncaught page error in any probe (a `pageerror` listener was on every page); the one
  console error per load is `401 /api/analytics` from the local backend.

## Screenshots

In `MV-PRE-REVIEW-03-screenshots/` (downscaled; signed-out, no account data). "Before" images are
from the base `756c9aee` (dev), except `before-v2-reading-sequence.png`, captured on the working tree
after the lesson restructure but before the V2 change, when that panel was still the base component.
"After" images are from the production build.

| Finding   | Before                                                                                                | After                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| N4        | `before-n4-s2-after-bottom-continue-1280x900.png` (old console and readings; new heading off-screen)  | `after-n4-s2-after-bottom-continue-1280x900.png`                                                                                        |
| N7 / T1   | `before-n7-t1-s2-task-1280x1000.png` (Run in a separate row, "Teaching and worked references" closed) | `after-n7-s2-task-1280x900.png`, `after-n7-s2-ready-1280x900.png`, `after-n7-s14-task-1280x1000.png`, `after-phone-s2-task-390x844.png` |
| T1 / S6-2 | —                                                                                                     | `after-t1-lesson-breathing-with-support.png`, `after-t1-lesson-expiration-and-air-trapping.png`                                         |
| V1        | `before-v1-idealized.png`                                                                             | `after-v1-idealized.png`                                                                                                                |
| V2        | `before-v2-question-card.png`, `before-v2-reading-sequence.png`                                       | `after-v2-question-card.png`, `after-v2-reading-sequence.png`                                                                           |
| V3        | —                                                                                                     | `after-v3-zoom-side-by-side.png`, `after-v3-zoom-overlay.png`                                                                           |
| V4        | `before-v4-c6-100.png` (`46?`), `before-v4-c6-root200.png` ("1"/"2", "46"/"?")                        | `after-v4-c6-pressure-100.png`, `after-v4-c6-pressure-root200.png`                                                                      |

## Seen, not changed (deferred)

- ~~**"Inspiratory time" reading vs drawn inspiration** (Section 2)~~ — **repaired in the repair pass
  (R3)**: the reading is labelled as calculated and the sampled flow times as sampled.
- ~~**Volume anchor one step late**~~ — **addressed in the repair pass (R3, disposition B)**: the
  anchor is unchanged and is now named as the first recorded inspiratory sample, with the step it
  holds and both the received volume and the drawn rise stated.
- ~~**Section 1 step 3 look line**~~ — **repaired in the repair pass (R2)**: the figure carries the
  authoritative marker and the sentence follows the figure on screen.
- ~~**C6 left monitor column at 200 % root text**~~ — **repaired in the repair pass (R5)**, on all
  four consoles.
- **Global site header** at 200 % root text: wraps to ~377 px and overflows 51 px at 1280 wide.
  Platform lane (PI prompt 05); not an MV change.
- **`VentilationWaveformAnatomy` panel** (render-harness only; not mounted by the Learn host) has one
  unstyled button.

## NOT RUN

- Native browser zoom; Firefox and Safari; real devices; DPR 2 (all runs were DPR 1 — DPR, CSS zoom,
  native zoom and root-text enlargement were not conflated; only the last was tested).
- Real assistive technology (VoiceOver, NVDA). Semantics were checked in code and jsdom (heading focus
  - `aria-describedby`, polite status region, `aria-pressed` toggles), not with a screen reader.
- Light site theme screenshots: the module frame paints its own dark palette in both site themes; not
  re-screenshotted.
- The es and zh-CN locales; the deployed build; beta-wrapped routes.
- Bounded all-case physiology replays and 1×/5×/30× comparisons: no physiology, clock or alarm code
  changed; the Batch-02 invariance suites were run instead and pass.
- Every section at 1× wall-clock time (5× and Advance one breath were used for timed intervals).
- Any clinical, device, media or source review.

## What must not be undone

- Focus and scroll move only from explicit navigation handlers. Do not add a global
  `focusin`/`scrollIntoView` handler, and keep `behavior: 'instant'` (the site's smooth scrolling
  cancels an `'auto'` scroll).
- The experiment panel reads `labGoalMet` / `labReadyToCompare`; automatic capture stays opt-in,
  confound-held and state-driven (no timers, no polling).
- Captured records keep their source resolution; thin at drawing time if ever needed, preserving
  extrema and phase boundaries.
- VC and PC share one axes object; never scale a mode on its own.
- The plateau word comes from `plateauAcquisition`; do not reintroduce a glyph without a legend.
- The pathway accordion must not choose its open group or "Up next" before stored progress is read.

Added by the repair pass:

- A pause is credited by its origin, never by `paused === true`. Only the learner's own Pause that
  stopped a running model, or Use this captured interval, writes the inspection record; the
  `pause-expiration` goal reads that record and nothing else. Page visibility is read in
  `useVentilationLabSession` only.
- `labReadyToCompare` requires a complete breath on the record. Do not remove it because "all
  authored cases pass": Section 11's first application does not, 39 % of the time.
- A marked interval is named only beside a figure that draws it; the marker comes from
  `referenceEvidence.ts` and nowhere else.
- The figures' origin is the first recorded inspiratory sample and is called that, from
  `content/breathOrigin.ts`. Do not rename it "breath start", shift a timestamp, add a zero-time
  sample or stretch the drawn rise to the delivered volume.
- A heading-reveal request names its destination and is made only by a same-tab activation.
- The console's value-column floors stay in rem; its narrow-screen reflow stays a reflow.
- The effort row's text is sample facts about a modeled signal: no cause, no measured delay.

## Stop

One PR, opened and stopped. No merge, no deploy, no batch 04, no G02 restart.

Repair pass, 2026-10-03: the bounded R1–R6 repairs pushed to the same PR #290, and stopped. No
merge, no deploy, no batch 04, no unrelated cleanup.
