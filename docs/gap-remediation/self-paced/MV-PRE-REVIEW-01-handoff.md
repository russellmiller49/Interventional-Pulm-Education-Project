# MV-PRE-REVIEW-01 — capture and observation truth

Batch 01 of the Mechanical Ventilation pre-owner-review pack
(`Interventional-Pulm-Local-Data/module_update_9_19/MV_Claude_Implementation_Pack/01_MV_CAPTURE_AND_OBSERVATION_TRUTH.md`),
read with `COMMON_CONTRACT.md`, `FEEDBACK_LEDGER.md`, `SOURCE_AND_CODE_NOTES.md` and
`CROSS_MODULE_COORDINATION.md`. Prepared 2026-09-21 by an AI authoring assistant (Claude) at the
owner's request.

**Nothing here is clinical, device, media, source or release approval.** Every clinical hold named
in the pack is still open, and this batch opened no new ones for review.

## Delivery and scope

- **Checkout and branch.** Worktree `…/Interventional-Pulm-Education-Worktrees/claude-mechanical-vent-9-21`,
  branch `claude/mechanical-vent-9-21`, cut from `origin/main` at
  `c717c9ffae09cb67e19b06a56d37c75487a5605a` (merge of PR #250). The tree was clean at the start and
  `origin/main` was at that same SHA when fetched, so the pack's inspected commit and the execution
  base are the same commit.
- **Module-local.** Every changed runtime, content and test file is under
  `src/features/mechanical-ventilation`, plus this document. No shared stage, shared
  `AnswerVerdict`, critical-care registry, progress store, device-intelligence, backend, dependency
  or deployment change. No URL was fetched and no paid API was used.
- **Out of scope by instruction, and untouched:** gas-exchange coefficients, case severity, PEEP
  response bins, clinical alarm thresholds, question answer keys, clinical sources and review
  status. `content/source-cases.v1.json` is hash-pinned and unchanged. The live clinical case MV-03
  stays excluded.
- **A separate read-only worktree** was created at the base SHA solely to reproduce pre-existing
  test failures, and removed afterwards. No branch was reset, rebased or force-pushed.

## A — reproduced on the unmodified base first

Every item below was reproduced in the browser on `c717c9ff` before any edit, at 1280×1000 in the
built-in Chromium pane against `next dev --port 3123 --webpack`. The pane was hidden, so
`requestAnimationFrame` was suspended in it; **every time advance used the explicit "One breath"
control**, never the animation loop, so none of this is the Appendix-B artifact.

| ID              | Route / step                                                   | What the base showed                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1-1            | `learn?activity=breathing-with-support`, step 1                | "Use the marked interval A on the captured complete breath" with no captured breath on screen; the engine reference was inside the collapsed "Teaching and worked references" disclosure.                                                                                                                                                                                                                      |
| S1-2            | same, step 2                                                   | Cursor at **0.30 s, flow +40.0 L/min, volume 201 → 214 mL**, caption "Inspiration: positive flow adds volume", against a question keying **Expiration**. No "A" was drawn anywhere. Clicking the figure's own Expiration button moved the same cursor to 1.86 s; nothing about "A" changed.                                                                                                                    |
| S1-3            | same                                                           | Step copy "Labels are withheld for this independent identification" printed directly above "Inspiration: positive flow adds volume."                                                                                                                                                                                                                                                                           |
| S1-4            | same, steps 1 and 10                                           | Step 1 figure captioned "Worked demonstration; no independent credit" while the step called it an independent identification. Step 10 said "A new complete breath is shown on a longer respiratory cycle" and re-showed the same **3.74 s** breath, keeping the cursor position set during step 2 across the part change.                                                                                      |
| S4-1            | `learn?activity=mechanics-load-and-pressure`, step 1           | Worked reference hold **12.9 cmH₂O** beside "Plateau · modeled **13.5 cmH₂O**".                                                                                                                                                                                                                                                                                                                                |
| S7-2            | `learn?activity=expiration-and-air-trapping`, step 6           | "Compare the end of machine inspiration with the effort trace" over a figure with three rows and no effort row.                                                                                                                                                                                                                                                                                                |
| S7-3            | same                                                           | Row labelled "Breath-relative volume (mL)" reading **486 → 872 → 518 mL** (axis to 947) beside an exhaled volume of **426 mL**.                                                                                                                                                                                                                                                                                |
| S7-5            | same, step 5 (passive round)                                   | "Measured trigger delay is **80 ms**" in the same paragraph as "Patient effort is not appreciable this breath."                                                                                                                                                                                                                                                                                                |
| S8-1            | `learn?activity=safety-reassessment-and-human-factors`, step 1 | "Readings to watch … **Anxiety 8.0 /10 · Dyspnea 7.6 /10 · Delivered rate 31 /min**".                                                                                                                                                                                                                                                                                                                          |
| S14-1           | `learn?activity=high-peak-pressure-integration`, step 1        | Readings said "Plateau · modeled — Acquire a current inspiratory hold" while the integration panel showed **PLATEAU 14.3** and **PEAK − PLATEAU 17.4** with no hold performed.                                                                                                                                                                                                                                 |
| C2              | `practice?case=MV-01…`, after Assess                           | Exam list "Ppeak 34 and Pplat 27 cm H2O" against a console reading **Ppeak 25, Pplateau 14**. MV-14 at t = 100 s: "…and SpO2 falls" with SpO₂ at **97 %** (76 % at t = 0), plus "Manual ventilation remains difficult" with no manual ventilation performed. MV-13: "secretions are visible in the airway tubing" immediately followed by "Still open: one of these fits this patient" and all three branches. |
| C5 (provenance) | `practice?case=MV-14…`                                         | t = 0: pH 7.38 / PaCO₂ 42 / **PaO₂ 76** / HCO₃⁻ 24, "Baseline gas shown." t = 100.0 s, nothing ordered: **PaO₂ 97**, still "Baseline gas shown."                                                                                                                                                                                                                                                               |
| C7              | every case console at open                                     | "Waveform text: … **measured Pplateau 14 cmH₂O** …. **Held trace**, labelled levels: …" with no hold performed and the trace merely paused.                                                                                                                                                                                                                                                                    |
| C9              | MV-14, decompression at t = 100 s, read at t = 130 s           | "**Peak airway pressure 58 → 58 UNCHANGED**" while the console read **Ppeak 31**; stabilization line "is active on the ventilator now" on a latched card.                                                                                                                                                                                                                                                      |
| Q2              | Section 1 step 2                                               | "Predict the observable response to one change, then compare it with a real run." above "Which phase is shown at cursor A?"                                                                                                                                                                                                                                                                                    |

The full capture, with the exact strings, is in the PR description; the assertions in
`__tests__/mv-pre-review-01-evidence.test.tsx` quote the same values.

## Disposition by assigned source ID

| ID                              | Disposition                                                          | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1-1**                        | **Repaired**                                                         | The marked reference is rendered inside the step card, directly under the instruction, on the read/predict/explain steps of any section that carries an authored marker. The teaching column stops drawing its own copy on those steps, so there is one figure and one marker.                                                                                                                                                                                                                                                                                                                                                                       |
| **S1-2**                        | **Repaired**                                                         | New `content/referenceEvidence.ts` binds each authored identification item to a marker (letter, breath stop, keyed phase), asserts at import that the marker's phase equals the option the round already keys, and resolves it against the real samples — validating flow sign and volume direction rather than a timestamp. The marker is drawn on every row with its letter, styled apart from the movable exploration cursor, and does not move when that cursor does.                                                                                                                                                                            |
| **S1-3**                        | **Repaired (copy) + optional clean view**                            | "Labels are withheld for this independent identification" is gone. The phase label stays available and gains an honest "Hide the phase label on this figure" toggle that removes it from that figure's own view only. No answer-first gate was introduced.                                                                                                                                                                                                                                                                                                                                                                                           |
| **S1-4**                        | **Split: two halves repaired, two deferred by instruction**          | Repaired: the reference is now built from the step's own application, so Section 1 step 10's "a longer respiratory cycle" resolves to a genuinely longer breath (**3.74 s → 5.00 s**) and the copy names the rate it was set to; the figure remounts per application so an exploration cursor cannot carry across. Deferred: the duplicate steps 3/4 presentation is batch 04's; the 80 ms vs 20 ms sampling-rate difference between the captured baseline and the reference trace is batch 03's. Neither was touched.                                                                                                                               |
| **S4-1**                        | **Explained, not equalised**                                         | The two numbers are two quantities and the difference is implemented, not clinical: the Readings number is `observedPlateauPressureCmH2O` (end-inspiratory airway pressure less the resistive pressure at that instant, nothing occluded); the worked number is read after two seconds of an actual occlusion, during which `simulation.ts` scales the elastic term by `1 - holdRelaxationFraction(secondsHeld)`. The panel now says exactly that, names both as what they are, and states that whether the modeled relaxation matches a real patient's is unreviewed. **The values were not averaged, re-rounded or renamed.**                      |
| **S7-2**                        | **Repaired**                                                         | `ventilationTaskPresentation` derives the effort row from the round itself (`watch` includes `effort`, or the round's own copy names it) as well as from the per-unit flag, so the one round that asks for the effort trace now draws it, labelled as a model signal.                                                                                                                                                                                                                                                                                                                                                                                |
| **S7-3**                        | **Repaired at the rendering boundary only**                          | `anchorBreathVolume` re-anchors volume to a **verified** breath start (`completedBreath`, two real inspiration onsets) and the row is labelled "Volume from breath start (mL)". Where there is no verified anchor the raw signal is drawn under "Raw lung volume (mL)". The caption keeps the raw offsets (486 mL at the start, 518 mL at the end on the reproduced breath) and states that a rise from the start and the ventilator's exhaled volume are different quantities. **No engine state was changed**: trapped volume, intrinsic PEEP and timing are untouched and expiration is not forced to zero.                                       |
| **S7-5**                        | **Repaired**                                                         | New `engine/triggerEvidence.ts` looks for an eligible trigger event — appreciable modeled effort across the expiration that preceded the last inspiration onset, against the engine's existing `EFFORT_DETECTION_FLOOR_CMH2O` — and returns `reported` / `not-applicable` / `unavailable`. The Timing view prints "—" and says why. `measurements.triggerDelayMs` is unchanged; it is simply no longer reported as a measurement when there is no event to time. No new clinical cutoff.                                                                                                                                                             |
| **S8-1**                        | **Repaired (identity), physiology deferred**                         | New `content/patientReport.ts` separates a ventilator measurement, a **modeled patient report** (a patient the model says can communicate) and an **internal symptom index** (one who cannot). "Readings to watch" prints the scores under their own heading with their own suffix. No score value changed, and whether a patient at a given RASS should be reportable at all is batch 02's.                                                                                                                                                                                                                                                         |
| **S14-1**                       | **Repaired**                                                         | The integration panel's `plateauMeasured` was `plateauPressureCmH2O > 0`, true on every breath of every case. It now uses the acquisition projection; plateau and peak − plateau show "—" until a hold is acquired and both appear the moment one is. Explanations, sources and navigation stay open throughout.                                                                                                                                                                                                                                                                                                                                     |
| **C2**                          | **Repaired (separation), numbers left alone**                        | The bedside panel prints three groups: "From the case description at handover" (the pinned casebook text, with a line saying its numbers are the presenting description and the console is what the patient is doing now), "What your examination finds now" (derived live), and the differential. An examination that actually separates the candidates narrows the differential — gated on the action that produces the finding, reading only the live fields already on screen, never `state.branch` — and says explicitly that narrowing is not a confirmed diagnosis. The pinned source text was not edited and no exam number was regenerated. |
| **C5 (sample provenance only)** | **Repaired for provenance; the numbers are batch 02's**              | See _Measurement contracts_ below. The baseline is the case's authored `initialPatient.gasExchange` as a frozen specimen; repeats are frozen at collection. **No pH, PaCO₂, PaO₂, bicarbonate or saturation value was chosen or changed.**                                                                                                                                                                                                                                                                                                                                                                                                           |
| **C7**                          | **Repaired across all four facsimiles**                              | One code path serves the four consoles. The plateau value is still shown — a real ventilator shows one — but it is called an estimate unless a valid occlusion produced it, the elastic/resistive attribution is made only then, the visible text equivalent no longer says "measured Pplateau" over an estimate, and a merely paused trace says "Frozen trace" rather than "Held trace".                                                                                                                                                                                                                                                            |
| **C9**                          | **Repaired (episode and window); response physiology is batch 02's** | The observation window now covers every reading the card prints, the card states the interval it describes, and its stabilization line is tensed to that interval and points at the console for what is alarming now.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Q2**                          | **Repaired for this batch's items**                                  | The lead-in is chosen per item kind: identification where a marker exists, measurement-interpretation for a hold round, reading-the-frozen-traces for a pause round, prediction otherwise. The full copy audit stays with batch 04.                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Not reproduced:** none. Every assigned finding reproduced on the base.

## Measurement and observation contracts introduced

Four new modules, each reusing what already existed rather than adding a competing flag.

### 1. `engine/types.ts` — `PerformedHoldRecord`, and `state.holdRecords`

Until now the only record of an occlusion that actually happened lived in the Learn lab wrapper
(`CapturedHold`). Every other surface — the four consoles, the teaching panels, the case feedback —
could only see `measurements.plateauPressureCmH2O`, which the engine publishes on every breath. The
record now lives on the simulation state, written by `advanceSimulation` as the valves close, at
every occluded step, and as they reopen. `completedAtSeconds` is null while it runs.
`interpretable` only ever falls. **In memory only**: `VentilationSimulationState` is not serialised
anywhere, and neither `holdRecords` nor `arterialGasSamples` appears in the lab-checkpoint or
self-paced schemas.

### 2. `content/plateauAcquisition.ts` — the six states

`reference-estimate` · `not-acquired` · `pending` · `acquired-invalid` · `acquired-valid` · `stale`.

- Sources: `state.holdRecords`, `ventilator.pendingHold` / `holdType`, `plateauReadingValidity`
  (unchanged) and `measurementConditionsFingerprint` — the same fingerprint the Learn lab already
  used, lifted into `engine/measurementConditions.ts` so the two cannot drift.
- Acquisition and passivity stay orthogonal. An occlusion performed while the patient was pulling is
  `acquired-invalid`: it happened, it is kept, and it cannot carry a mechanics claim. An estimate on
  a perfectly passive patient is `reference-estimate`: quiet, and still not a measurement.
- `requireAcquisition` decides whether a surface may print a current-patient value no occlusion
  produced. It is set on the Section 14 integration card and the dyssynchrony/load panel; the
  consoles keep printing the number with the correct name.
- Consumers: the four console facsimiles (readouts, trace annotations, visible text equivalent,
  dynamic-lung resistive gap), the Learn "Readings to watch" and its measurement-status line, the
  integration panel, the dyssynchrony panel, the oxygenation panel's plateau label, the worked-hold
  reference, and `coachingReadingSnapshot`'s peak-to-plateau gap.

### 3. `engine/arterialGas.ts` — the bounded gas contract, stated once

- **Order time** = the simulated second `order-abg` is performed.
- **Collection time** = the same second. This model has no separate phlebotomy delay and inventing
  one would be inventing physiology; naming it is what fixes _where_ the values freeze.
- **Availability time** = order time + the intervention's own authored `latencySeconds` (60 s). The
  specimen does not change while it is pending, and the result appearing does not resample.
- **Baseline** = the case's authored `initialPatient.gasExchange`, collected before the run,
  available immediately, labelled as history supplied with the case.
- Prior results are kept and listed; a pending specimen shows no values until it results.
  `lastAbgAt` is unchanged and still drives the existing consumers.

### 4. `engine/triggerEvidence.ts` — absent, unknown and zero kept apart

`reported` needs an eligible effort before the last inspiration onset; `not-applicable` says the
timer started the breath and that this is not a delay of zero and says nothing about the next
breath; `unavailable` says the buffer holds no breath boundary yet.

### 5. Post-action episode and window (`content/postActionCoaching.ts`)

`settleSecondsFor` now extends to one trace length whenever the card will print a trace-derived
reading. `coreReadings` always includes peak airway pressure and the displayed peak is the maximum
over the whole 12-second buffer, so a shorter window reported pre-action breaths — which is exactly
how "Peak airway pressure 58 → 58 UNCHANGED" appeared against a console reading 31. The card gains
`observedFromSeconds` / `observedToSeconds` and prints them. The card stays **latched** when its
window closes (re-deriving it live was fixed earlier because it rewrote itself under the learner and
re-announced through `role="status"`); its stabilization line is therefore tensed to that moment and
names the console banner as the surface for what is alarming now.

## Before and after, as evidence identities

| Surface                           | Before                                                       | After                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Section 1 reference               | Inside a collapsed disclosure; round 0 always; no marker     | Under the instruction; the step's own application; a fixed lettered marker validated against the samples                               |
| "cursor A"                        | The exploration cursor's default position                    | Interval A, pinned in expiration, resolved from actual flow sign and volume direction; the exploration cursor is a separate element    |
| Volume row                        | "Breath-relative volume (mL)" over the raw signal            | "Volume from breath start (mL)" from a verified anchor, or "Raw lung volume (mL)" where there is none; raw offsets kept in the caption |
| Trigger delay on a passive breath | "Measured trigger delay is 80 ms"                            | "—", "Trigger delay is not applicable: no effort started this breath"                                                                  |
| Plateau at case open              | "measured Pplateau 14 cmH₂O … Held trace"                    | "Pplateau 14 cmH₂O — estimate from the trace … Frozen trace"                                                                           |
| Section 14 integration            | PLATEAU 14.3 · PEAK − PLATEAU 17.4 before any hold           | "—" until acquired; both appear on a valid hold, with the acquisition time                                                             |
| Symptom scores                    | Listed with inspiratory time and exhaled volume              | Own group: "Patient report · modeled" or "Internal symptom index · not a patient report"                                               |
| Baseline ABG                      | `state.patient.gasExchange`, moving                          | The case's authored specimen, byte-stable, labelled as history                                                                         |
| Repeat ABG                        | One availability stamp over live values                      | A specimen frozen at collection, with order/collection/availability times and kept history                                             |
| MV-01 exam                        | "Ppeak 34 and Pplat 27" as a current finding                 | Under "From the case description at handover", with the console named as the current measurement                                       |
| MV-13 differential                | "Still open" with all three after the discriminating finding | "Narrowed by what you found", one supported and two unsupported, and not a confirmed diagnosis                                         |
| MV-14 decompression card          | "58 → 58 UNCHANGED" against a console reading 31             | "58 → 31 FELL", with "Compared from 100 s … to 127 s" printed                                                                          |

## Clinical questions this batch did **not** adjudicate

All remain `NOT REVIEWED`. None was moved, closed or reworded as settled.

1. **S4-1 / D5.** Whether the amplitude (0.06) and time constant (1.4 s) of `holdRelaxationFraction`
   represent real respiratory-system stress relaxation, and whether a 4-second occlusion is the right
   teaching maneuver length. The module now _describes_ the implemented difference; it does not
   defend it.
2. **S7-5 / D5.** What should count as an eligible trigger event at the bedside. The repair uses the
   engine's own effort floor and publishes no threshold; a clinician may want a different rule.
3. **S8-1 / D2.** Whether a patient at a given RASS should be reportable at all, and what the
   internal symptom index means when they are not. Only the identity is fixed here.
4. **C5 / D2.** The gas values themselves — HCO₃⁻ 24 in 13 of 14 live cases, MV-05's pH 7.33 with
   PaCO₂ 62 and HCO₃⁻ 24, the seven cases sharing 7.38 / 42 / 24, and the SpO₂–PaO₂ pairs
   (MV-14 76 % at PaO₂ 76; MV-13 88 % at PaO₂ 83). **Flagged, not changed.**
5. **C2 / D1.** Whether each case's authored handover description is the intended presentation, and
   whether the live trajectory should match it (MV-14's "SpO₂ falls" against a rising SpO₂ is now
   labelled as history, which is containment, not agreement).
6. **C9 / D1.** Whether the modeled response to each action is clinically right. The card now
   describes the right interval; it does not certify the response.
7. **D4.** The alarm-limit harmful choice and the MV-13 / Section 13 device-event behaviour stay
   held; nothing here touched alarm thresholds or limit semantics.

## Explicit dependencies handed to batch 02

- **C5 numerical.** Choosing pH / PaCO₂ / HCO₃⁻ / PaO₂ / SpO₂ for each case's authored baseline, and
  deciding whether pH should be derived from PaCO₂ and bicarbonate at initialisation as
  `updateSlowPhysiology` already does on updates. The observation identity is in place, so a value
  change lands in one authored place (`initialPatient.gasExchange`) and flows to the baseline
  specimen automatically. **Do not** infer chronic compensation, temperature or measurement error
  from the current mismatches.
- **C9 physiological.** Whether each action's modeled response is right, how long it should take, and
  what a fading response should look like. The window and the episode are now defined, so a
  trajectory change will be read over the correct interval rather than over the buffer that happened
  to be on screen.
- **S8-1 / C6 reportability.** Whether deep sedation should suppress the symptom index, produce no
  report, or both; `patientReportAvailability` reads `canCommunicate` and is the single place to
  change once that is decided.
- **S1-4 sampling.** The 80 ms captured-baseline cadence against the 20 ms reference trace is left for
  batch 03; the marker and its evidence are computed from whatever cadence the trace has.

## Tests

New: `src/features/mechanical-ventilation/__tests__/mv-pre-review-01-evidence.test.tsx` — 33 tests
covering the eight required behaviours: the fixed marker across exploration, restart and part change
with sample signs supporting the item; the reference view changing no live state; breath-relative
rendering over preserved raw volume, the effort row where the instruction asks for it and no false
trigger delay; the six plateau states agreed across the four facsimiles with reading and navigation
open; a byte-stable baseline gas and a repeat frozen at collection that cannot cross cases or
survive a reset; examination history / current / branch / conditional separated without completing a
hidden acquisition; post-action feedback on a real episode with a defined window and no fabricated
outcome from opening, reading or assessing; and the MV-03, self-paced-store and legacy-record
protections.

**Baseline-failing assertions that use no symbol this batch introduced** (so they fail on
`c717c9ff` for the defect, not for a missing import):

| Assertion                                                                        | Why it fails on the base                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| step copy carries no "labels are withheld"                                       | `learningExperiments.ts:275` on the base                                                   |
| `expiration-and-air-trapping` transfer step has `presentation.effort === true`   | `taskPresentation.ts:40` has no effort flag on the base                                    |
| `capturePostActionBaseline(...).settleSeconds >= WAVEFORM_WINDOW_SECONDS`        | base `settleSecondsFor` returns one breath unless the action's own target is trace-derived |
| integration panel shows "—" for plateau and peak − plateau before a hold         | base `plateauMeasured = measurements.plateauPressureCmH2O > 0`                             |
| Timing panel prints no "Measured trigger delay is N" on the passive setup        | base prints the analytic default                                                           |
| four consoles never say "measured Pplateau" and do say "estimate from the trace" | base `MechanicalVentilatorConsole.tsx:1638`                                                |
| the bedside ABG grid shows the case's authored PaO₂, not the live one            | base `BedsidePanel.tsx:242` renders `state.patient.gasExchange`                            |

Assertions about the new grouping markup (`data-finding-group`, `data-marker`, `data-abg-sample`)
necessarily depend on markup this batch adds; each is a behavioural assertion about separation, not
about an imported symbol, and each corresponds to a string quoted in the reproduction table above.

Changed test contracts (all because the assertion encoded the defect):

- `waveform-annotations` — a paused console says "Frozen trace"; only an occlusion says "Held trace".
- `components` — the plateau caveat now carries the acquisition clause _and_ the effort clause; a
  passive patient with no hold gets "estimate from the trace", and the elastic-load attribution is
  asserted after an actual occlusion instead.
- `case-debrief` — the differential test is split into still-open, narrowed-by-examination, and
  nothing-revealed-before-assessment.
- `post-action-coaching` — three scenarios advanced far enough for the longer window; stabilization
  wording tensed to the interval.

### Commands run (base and head both `c717c9ff`-derived, node 26.5.0, `NODE_OPTIONS=--max-old-space-size=8192`)

| Command                                                                                                                                                                                          | Result                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `npx jest src/features/mechanical-ventilation`                                                                                                                                                   | 37 suites, **788 tests, all passing**                                                                 |
| `npx jest src/app/[locale]/mechanical-ventilation/routes.test.tsx src/features/critical-care src/features/learning-module src/features/icu-simulation src/lib/draft-modules.hamilton-c6.test.ts` | 49 suites, 454 tests, **451 passing, 3 failing — all three fail identically on the base** (see below) |
| `npx tsc --noEmit -p tsconfig.json`                                                                                                                                                              | clean                                                                                                 |
| `npx eslint src/features/mechanical-ventilation`                                                                                                                                                 | clean                                                                                                 |
| `npx prettier --check "src/features/mechanical-ventilation/**/*.{ts,tsx,css}"`                                                                                                                   | clean                                                                                                 |
| `git diff --check`                                                                                                                                                                               | clean                                                                                                 |
| `npm run build`                                                                                                                                                                                  | succeeded, with the dev server stopped first                                                          |

### Pre-existing failures, reproduced on the exact base

Run in a read-only worktree at `c717c9ff` with the same node_modules: all three fail there too, with
the same test names.

- `critical-care/__tests__/accessibility.test.tsx` — "keeps color-coded circuit, pressure, alarm and
  trend states readable without color".
- `critical-care/__tests__/curriculum-sequencing.test.tsx` — CRRT case ordering ("PrisMax
  troubleshooting challenge" extra).
- `critical-care/__tests__/learner-copy.test.ts` — 19 flagged strings on the base. **This batch's
  copy adds none**: the count is 19 before and after, checked by running the scanner on both.

## Browser checks

Foreground-equivalent stepping in the built-in Chromium pane against `next dev --webpack` on port
3123, after the repair, at:

- **1280×1000** — Sections 1, 4, 7, 13, 14; Practice MV-01, MV-13, MV-14.
- **1427×1000** (the report's width) — Section 1, light scheme.
- **390×844** — Section 1: no horizontal page scroll, marker drawn on all three rows.
- **320×740 with a 32 px root font (200 %)** — Section 1: 7 px of horizontal page overflow, isolated
  to the pre-existing unit-title `<h1>` (shortening it removes the overflow; hiding the captured
  breath entirely does not). **Pre-existing; recorded for batch 03, not fixed here.** The figure
  caption's own box overflows by 11 px at that size because of the pre-existing "· Worked
  demonstration; no independent credit" suffix; also left for batch 03.
- Light and dark — the captured-breath figure carries its own dark surface in both, so the near-white
  dashed marker and the amber exploration cursor stay distinct in both.

## NOT RUN

- Native browser zoom; Firefox and Safari; hardware devices; real assistive technology.
- Keyboard-only and screen-reader journeys end to end.
- The Spanish and Simplified Chinese locales.
- Every experiment in every section at 1×; the 5× and 30× schedulers were not compared for this
  batch because no physiological timing changed.
- Bounded no-action replays of all 14 cases: not required, because this batch changed no runtime
  physiology. The only engine additions are the two observation records, which are written but never
  read back into the model.
- The deployed build and the beta-wrapped routes.
- Any clinical, device, media or source review.

## What must not be undone

- `state.holdRecords` and `state.arterialGasSamples` are in-memory only. If either is ever
  persisted, the self-paced and legacy stores need their own decision first.
- The marker contract asserts at import that a marker's phase matches the option its round keys.
  Re-keying an item without moving its marker will fail the build, which is the point.
- The post-action card stays latched. Making it live again reintroduces the `role="status"`
  re-announcement defect an earlier batch fixed.
- MV-03 stays excluded, the alarm-limit item stays held, and no review field was changed.

## Stop

One PR, opened and stopped. No merge, no deploy, no batch 02, no G02 restart.
