# MCS-PRE-REVIEW-02 — coupled models and waveforms

Prepared 2026-09-22 by an AI authoring assistant (Claude Opus 5) at the owner's request, against
the `MCS_Claude_Implementation_Pack` prepared 2026-09-20. **Nothing in this slice is clinical,
device or source approval.** MCS-PRE-REVIEW-01's atrial-fibrillation containment is **in force and
untouched**: the model is unchanged, `MCS-03-05` keeps its `NOT REVIEWED` decision, and OD-01 still
owns it.

The consolidated decision packet is
[MCS-PRE-REVIEW-02-owner-decisions.md](MCS-PRE-REVIEW-02-owner-decisions.md). It carries the
dependency map, every matched-time table, the source reading, and OD-01 through OD-04 with at most
two bounded options each. This document is the engineering record.

## Identity and scope

|                              |                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree                     | `…/Interventional-Pulm-Education-Worktrees/claude-mcs-2-9-22` (new and exclusive; the Prompt-01 worktree was not reused)                                              |
| Branch                       | `claude/mcs-pre-review-02-9-22`                                                                                                                                       |
| Authorized starting baseline | `c1fb8a0d4d0704ea7fc3050d34512104edba79b7` — the exact reviewed integration baseline named in the task                                                                |
| `origin/main` at start       | `c1fb8a0d4d0704ea7fc3050d34512104edba79b7` — identical to the baseline, so no separate newer-main record was needed at cut time                                       |
| Tree at start                | clean                                                                                                                                                                 |
| Execution date               | 2026-09-22                                                                                                                                                            |
| Report                       | `MCS_ICU_Lab_Fellow_Walkthrough_Findings(1).docx`, 2026-09-19, SHA-256 `0f6e31dc…3350`, read through the package's ledger                                             |
| Assigned findings            | F14, F17, F19 (model investigation), F21, F24, F25, F26, F27, F28, F29, F35                                                                                           |
| Changed paths                | `src/features/mechanical-circulatory-support/**` and `docs/gap-remediation/self-paced/**` only                                                                        |
| Verified unchanged           | `src/features/hemodynamics-core/**`, `src/features/learning-module/**`, `src/features/critical-care/**`, `src/lib/**`, Device Intelligence, all other modules, config |
| Concurrent owners            | No other agent was editing MCS runtime. Shared `ChoiceReasoningFeedback` remains the shared-feedback owner's (F09, still outstanding, not touched here).              |

**The shared solver was read, not edited.** `advanceWindkesselCompartments` and its types are
byte-identical to the baseline; the coupling questions it raises are written up for OD-03 as a
bounded specification rather than implemented.

## Disposition of every assigned finding

| Finding                               | Disposition                                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F14** transfer vignette             | **Reproduced → repaired.** The card claimed low native output; the model produces the reference patient's output. The card now states what the model produces. No patient value changed, no option re-keyed.                    |
| **F17** IABP timing contours          | **Reproduced → contained, with a source-supported authored reference added.** The live model demonstrably cannot produce either canonical pressure relationship; no waveform amplitude was changed. OD-01 holds the rest.       |
| **F19** AF trigger model              | **CONTAINED — named hold remains, unchanged.** Prompt-01's containment is fully in force. The Cardiosave source was read first-hand this slice and confirms the conflict and that no implementable correction exists.           |
| **F21** RV weakening vs the LV        | **Reproduced → inference contained; the coupling gap is a named OD-03 hold.** The conserved compartments do show the phenomenon; the displayed wedge has no right-sided term. Copy now says what the model shows.               |
| **F24** the unloading example         | **Reproduced → repaired, without amplification.** The response is real, small, and now read against the module's own measured resolution. No coefficient, baseline or displayed value changed.                                  |
| **F25** suction with a full LV        | **Reproduced → repaired for what the alarm claims; the predicate is an OD-03 hold.** The limiting term is right-sided delivery in every state measured, and the module now says so where the alarm is.                          |
| **F26** the volume story              | **Already resolved by Prompt 01 for identity; quantified here.** The control moves +1845 mL of modeled circulating volume. No dose implied, Prompt-01's guard kept. An RV-failure contrast is specified for OD-03, not shipped. |
| **F27** the durable reference / alarm | **Reproduced → repaired for measurand honesty; the predicate and the baseline value are OD-02 holds.** The alarm's input is 35 mm Hg below the displayed mean and never fires in the state it names.                            |
| **F28** estimator fidelity            | **Reproduced → documented, with the generic/device boundary made explicit.** This module has no estimator: its displayed flow is the modeled transfer. No controller algorithm invented, no hematocrit control added.           |
| **F29** keyed answer vs congestion    | **Reproduced → repaired by separating the two questions.** The key, its id and the option set are unchanged; the false "modest wedge" characterisation is gone and the congestion panel is pointed at, not hidden.              |
| **F35** LVAD-02's PAPi signal         | **NOT REPRODUCED as stated; one real sub-issue repaired.** PAPi is not a standalone criterion and moves 0.5 → 2.1 on the intended action. The apparent conflict with Section 9 is two different interventions; now said.        |

---

## A. The causal harness, built before anything was changed

`test-support/replayHarness.ts` drives the production reducer and reads. It duplicates no formula:
`mcsReplayBaseline` builds one settled starting state from `createInitialMcsState` plus setup
actions, `mcsReplay` forks that one object into named arms, dispatches each arm's actions through
`mcsReducer`, advances each by the same interval, and photographs the result.

To get unrounded intermediates without a second simulator, the production support computation now
**publishes** its own local values. `SupportComputation` carries a `diagnostics` member — a
discriminated union per device kind holding the trigger qualities and cycle landmarks (IABP), the
three preload terms with the smallest of them named, the suction flags and threshold, the afterload
factor and the high-afterload predicate's actual input (Impella and LVAD). The state carries them
alongside `supportEffect`, so a panel or a test reads the very numbers the reducer used.

**Nothing derives a displayed value from a diagnostic, and the reducer never reads one back.** They
are observation only.

Four inline literals became named constants with their values unchanged:
`LEFT_IMPELLA_SUCTION_PRELOAD_THRESHOLD = 0.58`, `LVAD_SUCTION_FILLING_THRESHOLD = 0.42`,
`LVAD_SUCTION_MINIMUM_FLOW_LMIN = 2.5`, `LVAD_HIGH_AFTERLOAD_MAP_MMHG = 100`, plus
`LVAD_SUSPECTED_THROMBOSIS_POWER_W = 2.8`.

### The replay matrix actually run

Seed 417, 0.02 s fixed steps, 8 s settle, 8 s observation unless noted, no-action control in every
comparison: no action · RV weakening (0.45, 0.20) · RV restoration (0.9, 1.2) · low preload (50%,
55%) · high preload (100%, 140%, 145%) · mixed LV/RV dysfunction · RP off/on · left malposition ·
left level 5→6→8→9 · afterload 400/1150/1400/1900/2200 dyn·s·cm⁻⁵ · high-power toggle · support
stopped · power disconnected · AF on ECG, pressure and internal triggering · sinus control · all
five IABP timing references at 1:2 · tamponade · severe aortic insufficiency · PVR 9 Wood units ·
heart rate 180 · PEEP 20 · settle extended to 30, 60 and 120 s where a state was still moving.

### The dependency map, and the names that are not one quantity

Both are in the [decision packet](MCS-PRE-REVIEW-02-owner-decisions.md). The five confusable pairs
are `lvFilling` against the displayed LVEDV; the conserved pulmonary venous pressure against the
displayed wedge; `baseline.mapMmHg` against the displayed MAP; modeled transfer against displayed
flow against effective delivery; and PAPi moving under support against PAPi moving under a changed
right ventricle.

---

## B. What the model turned out to be doing

### The suction predicate is a right-sided-delivery predicate (F25)

`leftPreloadFactor = min(rvDeliveryToLeftHeart, lvFilling, circulatingVolumeFactor)`, and suction is
raised below 0.58. Across thirteen deliberately extreme states at two settle times,
**`leftPreloadLimiter` was `rv-delivery` every single time**, and `lvFilling` never left 0.817 –
1.200 against a clamp of 0.18 – 1.20.

The reason is a scale mismatch: `lvFilling` is `(leftVentricularVolumeMl − 25) / 85`, calibrated for
an end-diastolic range of 25–110 mL, while the conserved reservoir it reads operates at 115–260 mL.
The term is saturated and cannot participate in the minimum. The same holds for the durable pump.

**Repaired:** the alarm no longer says the ventricle is empty. `impella-left-suction`'s explanation
names the term the model used, and the Section 6 teaching panel prints it live as _Smallest term
feeding the left inlet_ with its value and threshold. So the screen a fellow found
self-contradictory — suction beside wedge 20 and the module's largest LV volume — now reads as a
mechanism. **Not repaired:** the calibration itself, which is an OD-03 decision because changing it
changes which states alarm across the module.

### The displayed wedge has no right-sided term (F21)

Matched times, Section 4 setup: weakening the right ventricle to 0.20 moves RAP 11 → 22, PAPi 1.6 →
0.3 and effective delivery 4.51 → 2.55 L/min, while the **displayed wedge stays at 20 and the
displayed LVEDV moves 6 mL** — inside the module's own 5.5 mL deadband. The conserved compartments
meanwhile move a long way: the LV reservoir 235.3 → 175.1 mL and the pulmonary venous pressure
16.31 → 11.66 mm Hg, settling at 155 mL and 9.6 mm Hg by 30 s. A left-sided-failure control moves
the same displayed wedge 20 → 26, so the number is not frozen; it simply has no right-sided input.

**Repaired:** the distractor rationale that told a learner the left heart tends to be underfilled
rather than congested now says what this model shows and why the wedge is not the measurement that
tells you first. **Not repaired:** the mapping. A bounded specification — blending the conserved
pulmonary venous pressure in the same form `deriveMcsMetrics` already uses for MAP — is written up
with its measured consequences for OD-03. The section's own objective is unaffected: the RV-limited
ceiling is large and plainly visible.

### The durable high-afterload alarm reads a pressure nobody is looking at (F27)

Its predicate is `baseline.mapMmHg > 100` — the modeled circulation **with no support running**. At
the reference state the monitor reads 101–103 mm Hg and that input reads 67.5. At a simulated
resistance of 1900 the monitor reads 140, modeled pump flow falls 3.93 → 3.22 L/min, the model's
own afterload factor falls 0.94 → 0.77 — and the alarm stays quiet, because 87.2 is not above 100.
It first raises only at resistance 2200 with preload 145%.

**Repaired:** the alarm's label and explanation name the quantity its predicate reads; the Section 8
differential's afterload row prints what the outlet is costing the pump and says the alarm's input
is a different number. **Not repaired:** when it fires. Re-pointing it at the compartment arterial
pressure would match the flow limitation and would also raise it in tamponade, so it needs a second
condition and an owner decision (OD-02).

### The durable pump has no estimator at all (F28)

Flow comes from speed and loading; power is computed from the flow; the suspected-thrombosis flag
adds a flat 2.8 W and never enters the flow formula (measured: power 4.9 → 7.8 W, displayed flow
3.78 → 3.79). Abbott's parameter card runs the other way — power → flow, with hematocrit — and gives
no equation. The honest statement, now on the panel, is that this module's displayed pump flow _is_
the modeled transfer the compartments move, rounded; nothing is biased and nothing estimated is fed
back as blood movement. No hematocrit control and no coefficients were invented.

### The timing waveform cannot show what Section 3 teaches (F17)

At the section's own 1:2 demonstration settings, aligned: assisted systolic peak 98.1, augmented
diastolic peak **92.4**, assisted end-diastolic **60.5** against an unassisted 61.0. Both canonical
relationships are absent, and the second by 0.5 mm Hg. `generateMcsWaveformSample` adds a
fixed-amplitude augmentation to assisted beats over a diastolic baseline shared with unassisted
beats, and has **no term that reduces the pressure the next ejection opens against**.

**No amplitude was changed.** Getinge's _The IABP Numbers Game_ (booklet 83440-EN) was read
first-hand from the local reference copy; it names the five landmarks and states the relationships,
including that augmentation _ideally_ rises above systole, and gives no magnitude for any of the
reductions. The report's 15–20 mm Hg figure is a third-party interpretation that was not verified
here and appears nowhere. An authored diagram of those relationships now sits beside the live strip
on the same fixed 40–120 mm Hg scale, labelled _not this patient's trace, not a run of this
simulation, and not a measurement_, with the live strip carrying a measured statement of what it
does and does not show. The strip's arterial trace also moved from per-window auto-scaling to that
fixed domain, so the five demonstrations are finally drawn against the same pressures.

### The Section 9 item was right about the bottleneck and wrong about the wedge (F29)

Measured at its own starting actions: RAP **18**, wedge **18**, PAPi 0.5, suction active,
`leftPreloadLimiter` = `rv-delivery`, and three extra levels buy +0.25 L/min displayed and +0.21
effective with RAP unmoved. The congestion panel on the same screen says **biventricular**, and it
is correct — both pressures exceed the 15 mm Hg the module cites from the ACC description.

So the key is defensible and the word "modest" was not. **The key, its id and the option set are
unchanged.** The option and both rationales now refuse the distractor on the bottleneck instead of
by denying that the wedge is elevated, and the starting context points at the congestion panel and
says the two questions are different. No lower-wedge baseline was invented and no ratio threshold
was introduced.

### The Section 2 transfer overstated its own patient (F14)

Measured: native flow **4.46** L/min against the reference patient's **4.51** — the same output —
with wedge 26 against 20 and LVEDV 149 against 133, classified LV-predominant. The card said "high
PCWP with low native output". The loading half was right and the output half was not. The card now
says what the model produces. The suggested 2.5–3 L/min patient was **not** created.

### LVAD-02's condition is two predicates, and PAPi moves (F35)

`papi ≥ 1` **and** `deviceFlowLMin ≥ 2.8`. From the case's own opening state: no action 0.5 / 1.16;
the intended action 2.1 / 3.66 with RAP 20 → 8 and effective delivery 3.12 → 6.03; raising the speed
0.5 / 1.34, satisfying neither. Section 9's statement that the ratio moves only weakly is about
right-sided _support_ — starting the right pump there moves it 0.5 → 0.6, inside the module's own
deadband — and this case changes the right ventricle itself. Nothing was re-keyed; the debrief now
names the difference and repeats that it is not a response measure on its own.

### The volume story's control, quantified (F26)

The preload control rescales the circulation rather than adding to it: 55% → 100% moves the solver's
total from 2515 mL to 4360 mL, **+1845 mL in one step**. That is why the response is as large as the
report found it. The learner-facing sentence says the control rescales the entire circulation and
that the response is larger than a bedside fluid challenge would produce, and still carries no
figure that could be read as a dose — Prompt-01's guard is intact and tested. A right-ventricular-
failure contrast is fully specified with its measured response in the decision packet and **is not
shipped**.

---

## C. Everything changed, and why

| What changed                                                       | Old                                                     | New                                                                                               | Why                                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/model.ts` — `impella-left-suction` explanation             | "Available LV blood volume is inadequate or restricted" | Names the smallest of the three inlet terms, and says a high filling pressure can stand beside it | The old sentence asserted a chamber volume; the predicate is an inflow minimum and the limiter is right-sided delivery in every measured state (F25)       |
| `engine/model.ts` — `lvad-suction` explanation                     | "The LV is underfilled relative to the selected speed"  | Names which of the two terms is below the threshold                                               | Same measurand error, durable pathway                                                                                                                      |
| `engine/model.ts` — `lvad-high-afterload` label and explanation    | "Afterload-limited flow" / "Elevated aortic pressure…"  | "High modeled unsupported arterial pressure", naming the predicate's input and what it is not     | The predicate reads the no-support baseline MAP, not the displayed mean and not what limits the flow (F27). **The predicate and threshold are unchanged.** |
| `engine/model.ts`, `engine/types.ts` — `diagnostics`               | —                                                       | Unrounded intermediates published per device kind; carried on the state                           | The harness needed the model's own numbers rather than a second simulator                                                                                  |
| `engine/model.ts` — five named constants                           | Inline literals                                         | Same values, named and documented                                                                 | One place for a reviewed change to land; nothing moved                                                                                                     |
| `content/sectionLearningContracts.ts` — Section 4 `wedge-rising`   | "the left heart tends to be underfilled…"               | What the model shows at matched times, with the measured wedge                                    | An inference the implemented model cannot support (F21)                                                                                                    |
| `content/sectionLearningContracts.ts` — Section 9, five places     | "modest wedge" / "modestly raised"                      | The measured relationship, with the congestion panel named                                        | 18 mm Hg is above the module's own cited threshold and its panel says biventricular (F29)                                                                  |
| `content/lessonTransfers.ts` — Section 2 card and stem             | "High PCWP with low native output"                      | The wedge and volume, at the reference patient's output                                           | Native flow is 4.46 against the reference's 4.51 (F14)                                                                                                     |
| `content/lessonTransfers.ts` — Section 9 card, stem, rationale     | "PCWP is only modestly elevated"                        | The measured relationship                                                                         | Same as Section 9 above (F29)                                                                                                                              |
| `content/scenarios.ts` — LVAD-02 debrief                           | Two lines                                               | A third naming why the ratio moved here and not in Section 9                                      | The two statements are about different interventions (F35). **No criterion, value, label or key changed.**                                                 |
| `content/storyProblems.ts` — volume story `changeScope`            | Prompt-01's sentence                                    | Plus: the control rescales the circulation, so the response exceeds a bedside challenge           | Quantifies the magnitude without a dose (F26)                                                                                                              |
| `content/iabpWaveformReference.ts`, `McsIabpWaveformReference.tsx` | —                                                       | The authored contour, its five landmarks, the fixed scale, and the live-trace limits              | The live model cannot show either relationship (F17)                                                                                                       |
| `content/sources.ts`                                               | —                                                       | `getinge-iabp-numbers-game`, with its limits and the OD-06 rights question                        | The relationships came from a document read for this slice                                                                                                 |
| `McsTimingFigure.tsx`, `teaching/selectors.ts` `iabpStripView`     | Per-window auto-scaling                                 | Optional fixed arterial domain; the figure passes the shared 40–120 mm Hg scale                   | Five demonstrations on five different scales cannot be compared (F17)                                                                                      |
| `content/unloadingExamples.ts`, `McsUnloadingComparison.tsx`       | Two value columns                                       | A matched-time difference column, qualified against the module's measured deadbands               | 18 and 18 with no comment taught "Impella hardly unloads" (F24)                                                                                            |
| `teaching/ImpellaSuctionPurgeRvPanel.tsx`, `selectors.ts`          | Suction state as a word                                 | Plus the live limiting term, its value and its threshold                                          | F25                                                                                                                                                        |
| `teaching/LvadParametersAssessmentPanel.tsx`, `selectors.ts`       | —                                                       | The afterload cost, and the three-quantity flow identity                                          | F27 / F28. **See the reachability note below.**                                                                                                            |
| `teaching/LvadAlarmsEmergenciesPanel.tsx`                          | Displayed MAP offered as the alarm's evidence           | The cost figure, and the alarm's real input named                                                 | The row presented a number the predicate does not read (F27)                                                                                               |
| `docs/…/MCS-03-claim-review-queue.json`                            | `MCS-03-07` quoted the old Section 9 stem               | The current stem, with the previous wording and the reason preserved in `learnerWording`          | The record must quote the live surface; the decision stays `NOT REVIEWED`                                                                                  |

**No physiology constant, waveform amplitude, threshold, baseline patient value, answer key, option
id, case id or success predicate was changed.**

### Reachability note, stated rather than implied

`McsTeachingPanel` is mounted only by the stage's teaching column, and only for the four
non-introductory sections (4, 6, 8, 9). The edits to `LvadParametersAssessmentPanel` (section 7) and
`IabpTimingTriggeringPanel` (section 3) are therefore **correct where that panel renders but not
learner-visible today** — the code comment saying the legacy panel is retained "for the four
application sections and the open workbench" is stale, because the workbench no longer mounts it.
The F27 repair a learner actually meets is the Section 8 differential row, which is verified below;
the F17 repair is in `McsTimingFigure`, which the stage does mount, also verified. The unreachable
panels are handed to **03/04** as a separate question, not repaired here.

---

## D. Tests

### `__tests__/mcs-pre-review-02.test.tsx` — 30 tests

Harness contract (matched arm times, volume conservation, replay-order identity, stopped and
power-off controls, serial RP accounting, recirculation) · F25 (the limiter, the alarm's words, the
panel view with a device-kind negative control, and suction clearing on RP but not on level) · F21
(the full matched-time table, with the LV-failure positive control proving the wedge is not frozen,
and the repaired rationale with the key pinned) · F29 (the measured state against the module's
threshold, the key preserved, no "modest" anywhere, the transfer) · F14 (output within deadband of
the reference, loading above it, the card, the key preserved) · F24 (monotone response, not
amplified, and the rendered delta column at P6 and P8) · F17 (the two absent relationships pinned so
the reference cannot be quietly retired, the five references still separated by landmark, the
authored diagram's five landmarks and its refusals, the source record) · F27/F28 (the flat wattage
with the flow unchanged, the alarm quiet through a limited state, the cost view, the alarm's words,
the speed interlock, the reference pressure pinned as an open decision) · F35 (both predicates, the
intended action, the speed alternative failing, the debrief, and the Section 9 right-support
control) · F26 (the scope sentence with Prompt-01's dose guard re-asserted, the +1845 mL rescaling,
and the RV-failure negative control) · F19 (all three AF ratings, both alarms, the sinus control,
and exactly the two held conditions).

Positive and negative controls are paired throughout, so deleting a phenomenon cannot pass as
repairing it. Several tests pin **unrepaired** behaviour — the flat thrombosis wattage, the quiet
afterload alarm, the unmoving wedge, the high reference pressure — each commented with the decision
that owns it. Pinning is not endorsement.

### Changed assertions in existing suites

| Suite                              | Assertion                                            | Why                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unloading-comparison.test.tsx`    | Each signal row had exactly two cells                | The row has a third: the matched-time difference. The two value cells are still checked exactly as before — still the engine's numbers and nothing else — and the added assertion is that the third is arithmetic on those two, qualified against the module's own deadband. |
| `mcs03-claim-review-queue.test.ts` | `MCS-03-07`'s excerpt must appear in the source file | The excerpt quoted the Section 9 stem this slice reworded. The queue entry was updated to quote the live wording, with the previous wording and the reason preserved in its `learnerWording` field. The item's decision and null reviewer fields are untouched.              |

No test was deleted or skipped.

## E. Validation actually run

| Check                      | Command                                                                    | Result                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| MCS feature                | `npx jest src/features/mechanical-circulatory-support`                     | **41 suites, 839 tests, all passing**                                                                         |
| MCS + all app routes       | `npx jest src/features/mechanical-circulatory-support src/app`             | **79 suites, 1238 tests, all passing**                                                                        |
| Full suite                 | `npx jest`                                                                 | 9 suites / 8 tests failing, **the identical nine on the base**, measured under matched conditions (see below) |
| Base comparison            | same ten suites at `c1fb8a0d` in a detached worktree                       | **9 failed, 1 passed** — the same nine                                                                        |
| MCS share of the copy scan | `critical-care/__tests__/learner-copy.test.ts`                             | MCS contributes **exactly 10** findings, the number MCS-PRE-REVIEW-01 recorded — unchanged                    |
| Type check                 | `npx tsc --noEmit`                                                         | Clean (after `npm run build:content`, which generates the contentlayer types a fresh worktree lacks)          |
| Lint                       | `npx eslint --max-warnings 0` over all 20 changed and new TypeScript files | **Clean, zero warnings**                                                                                      |
| Format                     | `npx prettier --check` over the same files plus both changed documents     | Clean                                                                                                         |
| Whitespace                 | `git diff --check`                                                         | Clean                                                                                                         |
| Production build           | `npm run build`, dev server stopped first                                  | See the PR description for the recorded exit status                                                           |

**The nine pre-existing failures**, identical on base and head: the brochure-intake static scan, the
US-status safety boundaries, `training-apps.test.mjs` (no tests), branch-tracing contracts,
critical-care accessibility, critical-care curriculum sequencing, critical-care learner copy, the
Literature foundation manifest, and board-review localized HTML. None is MCS.

`src/features/bronchial-branch-tracing/__tests__/lesson.test.tsx` failed once under the full
parallel run and **passes on the base and twice in isolation on the head**. Recorded as an
unexplained flake rather than explained away.

### Browser journeys

Dev server on port 3124 from this worktree, isolated pane, English, signed out, stopped before the
build. Console errors are the usual Supabase `500`s from the absent `.env.local`, an environment
condition of a fresh worktree.

| Route                                                | Observed                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `learn?lesson=impella-suction-purge-rv`, step 1      | `Left Impella suction detected` beside wedge **20.0** and LV volume **130.0 mL** — and, on the same screen, _Smallest term feeding the left inlet · right-sided delivery to the left heart · 0.43 … against the 0.58 below which it raises the suction state_          |
| `learn?lesson=iabp-timing-triggering`                | Authored reference contour rendered: path length 517 px across the full width, five landmarks at five distinct heights in the order augmentation → unassisted systole → assisted systole → unassisted end-diastolic → assisted end-diastolic; text contrast 16.9:1     |
| same                                                 | Live strip drawn on the fixed domain — the arterial trace occupies 46.7% of its band starting at y 17.3, where auto-scaling would fill 0 → 64 exactly. Figure caption states the 40–120 mm Hg scale.                                                                   |
| `learn?lesson=impella-unloading-placement`, P6       | Wedge row `18 / 18 / +0 mm Hg · below this model's resolution`; effective flow `5.76 / 6.04 / +0.28 L/min` with no qualifier                                                                                                                                           |
| same, after choosing P8                              | `118 / 107 / −11 mL` and `2.44 / 3.49 / +1.05 L/min`, both unqualified; the wedge `18 / 17 / −1 mm Hg` still qualified                                                                                                                                                 |
| `learn?lesson=lvad-alarms-emergencies`, step 2       | Afterload row: _mean arterial pressure 101 mm Hg … the modeled outlet pressure is taking 6% of what this speed asks for · the alarm's own input is this patient's modeled unsupported mean pressure, 67 mm Hg against a threshold of 100, not the mean pressure above_ |
| `learn?lesson=iabp-efficacy-limits`, step 1          | The repaired rationale renders in full on Compare answer; no occurrence of "underfilled rather than congested" anywhere on the page                                                                                                                                    |
| `learn?lesson=mcs-device-selection-integration`      | RAP **18.0** and wedge **18.0**, congestion panel reading _Biventricular filling-pressure congestion pattern_, the reworded key, and **no occurrence of "modest" anywhere on the page**                                                                                |
| `learn?lesson=iabp-timing-triggering&phase=transfer` | **Prompt-01 containment intact**: ECG 50% raised / Arterial pressure 74% quiet / Internal 40% raised, the `Model limit held` line, `NOT REVIEWED`, and no all-clear, corrected, resolved or success wording                                                            |

**Screenshots could not be captured** — every screenshot from this browser pane returned a blank
frame regardless of page or scroll position, so the visual checks above were made from the rendered
DOM, computed styles and SVG geometry instead. Recorded rather than glossed.

**Not run:** Playwright, native browser zoom, Safari or Firefox, a real phone or touch device,
assistive technology, `es`/`zh-CN`, authenticated sync, the 1440×900 / 768×1024 / 320×740 widths and
200% root text, and any learner observation. Those are OD-08 and separately executed engineering.

## F. Preservation

Self-paced policy intact: no scores, no attempt gates, no first-try records, nothing new persisted,
every explanation still available before a response and every step still skippable. Real safety and
authorization intact: `lvad:authorize-speed` still gates speed and an unauthorized dispatch still
refuses, verified by test. No alarm was hidden and no warning removed — three alarm _explanations_
became more specific and one label stopped naming something its predicate does not test. Prompt-01's
work is untouched: the AF containment, the two held conditions, the story baselines and their dose
guard, the twenty-one condition classifications, the F04 measurand labels, the F18 wording and the
hub contrast all still pass. Device Intelligence unchanged. `MCS-03-claim-review-queue.json` keeps
every decision and every null reviewer field; one excerpt was re-pointed at the live wording with
the old wording preserved in the record.

## G. Handed on

| To                        | What                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OD-01**                 | The AF trigger model, still contained; the timing reference diagram's content and the "ideally" qualifier                                                                          |
| **OD-02**                 | Durable product identity; the `lvad-high-afterload` predicate, with both bounded options and the tamponade consequence measured; the reference patient's pressure                  |
| **OD-03**                 | The `lvFilling` scale mismatch; whether the displayed wedge should carry the conserved pulmonary venous response, with the blend specified and costed; the RV-failure volume story |
| **OD-04**                 | Three newly named authored constants added to the Prompt-01 condition inventory                                                                                                    |
| **OD-06**                 | Rights review of a diagram drawn from a manufacturer booklet's stated relationships                                                                                                |
| **Task 03**               | The two unreachable teaching panels above; the authored reference's layout at narrow widths and 200% root text, which this slice did not test                                      |
| **Task 04**               | Whether Section 3 should offer a practice comparison against the authored reference; the claim-level source audit                                                                  |
| **Shared-feedback owner** | F09 is still outstanding and was not touched                                                                                                                                       |

## H. Review status

**NOT REVIEWED.** No clinical, device, source, media or model decision was made or filled in by the
agent. Two manufacturer documents were read first-hand from the local reference copies this slice —
Getinge's _Cardiosave Troubleshooting Strategies_, which confirmed the existing `MCS-03` source
record, and Getinge's _The IABP Numbers Game_, newly registered with its limitations. Registering or
confirming a source is not approval of anything it is cited for. `MCS-03-05` keeps its decision.

No clinical validation is claimed. No device fidelity is claimed. No release readiness is claimed.
The activities that remain unsuitable for clinical release are listed in the decision packet.
