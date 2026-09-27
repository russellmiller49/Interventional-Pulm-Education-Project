# HD-PRE-REVIEW-02 — measurement provenance and causality

**Status: engineering batch complete and sanity-repaired (round 1, three blockers), NOT REVIEWED
and NOT MERGED.** A clean technical PR is not
clinical approval. Every clinical, device and source question this batch touched is listed as an
open hold at the end, with the exact decision the reviewer has to make.

## Base and head

|                                         |                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository                              | `russellmiller49/Interventional-Pulm-Education-Project`                                                                                                                                                                                                                                                                 |
| Inspected SHA in the package            | `c717c9ffae09cb67e19b06a56d37c75487a5605a` (citation baseline only)                                                                                                                                                                                                                                                     |
| Execution base (`origin/main` at fetch) | `9fbdbddc4d7f124c7ac3254f4cb8aa4c15c0233f` — contains the merged Task-01 PR #258 (`81145a6d`)                                                                                                                                                                                                                           |
| Final head                              | Task-02 implementation `585a216155d7e0e4d9cf8867f22f80a83987c6b5`, reviewed at `e5a3096f721b10118221fc8e8419a112808a1d59`; sanity-repair implementation `78de3bad` (see the sanity-repair section); the docs-only commit recording it follows, and the PR shows the final head                                          |
| `origin/main` at the sanity repair      | `a306d8250ec10207c750f46407f151c06d487707` — 74 commits past the execution base, none in ICU Hemodynamics and no dependency or config change; PR #266 still merges cleanly, so the branch was not rebased or merged                                                                                                     |
| Branch / worktree                       | `claude/hemodynamics-2-9-22` in `Interventional-Pulm-Education-Worktrees/claude-hemodynamics-2-9-22`, a fresh worktree created from `origin/main` for this task and exclusively owned; not the Task-01 branch                                                                                                           |
| Pristine comparison checkout            | `/private/tmp/hd02-base`, a detached worktree at the execution base, used only to reproduce and to run the same tests and journeys against the unchanged code; removed at the end                                                                                                                                       |
| Source report                           | `ICU_Hemodynamics_Learner_Walkthrough.docx` (19 Sept 2026), read in full from `Interventional-Pulm-Local-Data/module_update_9_19/HD_Claude_Implementation_Pack/`, with the pack's start file, common contract, task file 02, source/code notes, coordination note, owner decisions and the fifteen assigned ledger rows |
| Handoff directory                       | `docs/gap-remediation/fellow-walkthrough/hemodynamics/`, beside the Task-01 handoff (the package's suggested `docs/gap-remediation/pre-review/` does not exist)                                                                                                                                                         |
| Raw evidence (outside Git)              | `Interventional-Pulm-Local-Data/renders/output/hd-pre-review-02-2026-09-22/` — `base/`, `head/`, `head-narrow/` screenshots and `readouts-base.json`, `readouts-head.json`, `head-narrow/narrow-readouts.json`                                                                                                          |

No shared learning-module, critical-care, catalog, progress, analytics, auth, deployment or
`hemodynamics-core` file was changed. The historical HD-01/02/03 handoffs, the HD-03 claim-review
queue and the Task-01 handoff and status are unchanged.

## Sanity-repair round 1 (2026-09-23)

An independent Codex review of `e5a3096f` returned **SANITY REVIEW: NOT READY TO MERGE** with three
Task-02 blockers. Only those three were repaired, with the helpers and tests they need. Every
blocker was reproduced on `e5a3096f` first, with a scratch engine script and then by the regression
file below run in a detached worktree at that SHA.

| Blocker                                                        | Reproduced at `e5a3096f`                                                                                                                                                                   | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 (P1)** Stored wedge stamped with the wrong episode         | Yes. HD-01: leg raise, occlusion, cursor at 26.7 s (leg-raise episode 1), waning at 32.0 s, Store: record stamped episode 2, `current: true`, and PVR **1.4 WU** from a post-waning series | **Fixed.** The cursor records a `WedgeWindowAcquisition` (session, physiological episode, each episode its averaged samples fall in) worked out from the sample times against the episode timeline when it is placed. `STORE_WEDGE` copies it; it never reads the episode current at Store. A cycle that straddles a boundary gets `physiologicalEpisode: null`, and Store refuses it with the reason. Same path now: episode 1, `current: false`, PVR withheld, drawer names the old wedge |
| **2 (P2)** Inert/clamped interventions start episodes          | Yes. HD-02: 30 norepinephrine tiers, 150 s, series, one more tier: episode 30 → 31, series went historical, effective parameters identical to the no-action path                           | **Fixed.** An intervention or a scheduled waning starts an episode only if it can change the model's effective parameters at some time in its course, given the other effects and the model's bounds (`effectCanChangeEffectiveParameters`). One bounds table now drives both the derivation and the check. The absorbed dose is still accepted (effect recorded), starts no episode, leaves the series current, and is narrated as having no further modeled effect                        |
| **3 (P2)** Debrief says no series was acquired when one exists | Yes. HD-03: fluid, series (3.8 L/min), dobutamine, debrief: "No accepted thermodilution series was acquired…" and, for fluid, "No thermodilution series was acquired after it…"            | **Fixed.** The run summary and each action row read every accepted series with its own acquisition identity (`acceptedFlowSeries`, `flowAroundAction`). "None under the final conditions" is kept apart from "none ever"; a series counts as acquired after an action only if it belongs to that action's episode or a later one, and one acquired only after a later change is not read as that action's effect                                                                            |

**Architecture and helper changes (all in `src/features/icu-hemodynamics`).**

- `engine/types.ts`: `WedgeWindowAcquisition`; `WedgeCursorReading.acquisition`; `StoredWedgeRecord`
  comments now say `storedAtSeconds` is when Store was pressed and `physiologicalEpisode` is the
  acquisition episode.
- `engine/measurementProvenance.ts`: `physiologicalEpisodeAt(episodes, time)` (a sample at an
  episode's start time still belongs to the episode before — an effect's scale is zero at its own
  start, and a waning effect has not begun to recover at its boundary); `wedgeCursorReadingAt`
  fills `acquisition`; `WEDGE_WINDOW_STRADDLES_CHANGE`.
- `engine/reducer.ts`: `PLACE_WEDGE_CURSOR` says when the cycle straddles a change; `STORE_WEDGE`
  stamps the cursor's acquisition episode and session, refuses a straddling cycle, and says when a
  stored value belongs to earlier conditions; `APPLY_INTERVENTION` uses
  `interventionChangesPhysiology` and, for an absorbed dose, `absorbedInterventionNarration`.
- `engine/simulation.ts`: `EFFECTIVE_PARAMETER_BOUNDS` (the clamps, moved into one table;
  `deriveEffectiveCirculationParameters` output is unchanged); `effectScaleBounds` (from the shape
  of `effectScale`: onset only rises towards 1, recovery only falls towards 0);
  `effectCanChangeEffectiveParameters`; `interventionChangesPhysiology`;
  `interventionHasModeledEffect`; `absorbedInterventionNarration`. The waning check in
  `advanceOneStep` skips an effect the bounds absorb from its waning time on.
- `engine/decisionRecord.ts`: `AcquiredFlow.firstAcquiredAtSeconds`; `acceptedFlowSeries(state)` (a
  listing of `thermodilutionSeriesView`, oldest first, current marked — not a second history);
  `flowAroundAction(state, action)`.
- Components: `HemodynamicCaseActivity` (reduce first, then describe; absorbed-dose feedback and
  trace row; `flowSentence(state)`; `flowAfterActionSentence`; the leg-raise row uses
  `flowAroundAction`); `PacActionDock` and `StageDocks` (Store not offered for a straddling cycle;
  earlier-conditions wording; the one-button dock can re-place a straddling assisted cursor);
  `WedgeCursorPicker` (`data-cursor-conditions`, straddle and earlier-conditions notes, and the
  same in the slider's `aria-valuetext`).

**Why the absorption check is exact without a tolerance.** Parameters are summed independently and
then bounded. For each parameter the effect moves, adding it changes nothing at a given time exactly
when the sum without it is already at or beyond the bound it pushes towards — both then read the
bound itself, bit for bit. The check bounds the sum without it over every time from now on, using
each other effect's lowest and highest possible scale, and calls the effect inert only if that
holds for every parameter it moves. The bounds are sound, not tight: where they are loose the
check says "can change" and the Task-02 episode split is kept. The matrix tests compare the
effective parameters with and without the candidate on the model's own 0.02 s step grid and
confirm agreement both ways.

**Regression tests added.**

- `__tests__/hd-pre-review-02-sanity-repair-regressions.test.tsx` — **9 tests, written only against
  APIs that existed at `e5a3096f`.** Run there, all 9 fail on their assertions. Blocker 1:
  stored episode 2, expected 1 (×2), PVR `"1.4 WU"`, straddling mean `3.64` stored. Blocker 2:
  episode 31, expected 30; authored "tone rises" narration; absorbed leg raise episode 11,
  expected 10. Blocker 3: "No accepted thermodilution series was acquired…" and "Flow was acquired
  after it: … after Dobutamine ↑" for the fluid. On the repair all 9 pass. The end-to-end wedge test
  goes capture → cursor → waning → Store → deflate → series → the real `FormulaDrawer`. The debrief
  tests drive the real case host: inject, review and accept through the curve controls.
- `__tests__/hd-pre-review-02-sanity-repair-matrix.test.tsx` — **26 tests**: same-condition delayed
  storage with sweep, scale, loops, freeze, alarms, mechanism selection and phase changes in between;
  a new current wedge restoring PVR; the episode-boundary rule; the cursor's recorded identity;
  the monitor, stage picker and practice dock surfaces; an effective intervention, a repeat before
  the bound, refused and empty-effect actions, one waning transition tick by tick and across a
  60 s TICK, unbounded and at-floor parameters, a transient that cannot mask a later push; the
  absorbed dose through the case host; and, through the case host, no series anywhere, baseline
  only, current only, across conditions, several historical series, the leg-raise series built vs
  after waning, and the engine listing.

**Results.**

| Check                                                                                                                                                                                                                          | Result                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New repair suites                                                                                                                                                                                                              | 35 pass (9 + 26)                                                                                                                                                                                                                                                                                      |
| Regression file at `e5a3096f`                                                                                                                                                                                                  | 9 of 9 fail on their assertions                                                                                                                                                                                                                                                                       |
| All Task-02 suites (four original + two repair)                                                                                                                                                                                | pass                                                                                                                                                                                                                                                                                                  |
| `jest src/features/icu-hemodynamics --runInBand`                                                                                                                                                                               | **46 suites, 626 tests, all pass** (Task-02 head: 44 / 591)                                                                                                                                                                                                                                           |
| Task-01 preservation suites (`hd-pre-review-01-*` ×3, `h2-h3-reference-and-pac-safety`)                                                                                                                                        | pass, unchanged                                                                                                                                                                                                                                                                                       |
| Route + consumers (`src/app/[locale]/icu-hemodynamics`, critical-care, learning-module, module-beta, `src/app/api/critical-care`)                                                                                              | 47 of 50 suites, 432 / 435 tests: the same three baseline failures by name (CRRT station order; critical-care accessibility surfaces; learner-copy framing — no ICU Hemodynamics rows)                                                                                                                |
| Integration with `origin/main` `a306d825` (throwaway worktree, merge not committed)                                                                                                                                            | merges automatically; HD + route + consumers 93 / 96 suites, 1,059 / 1,062 tests, the same three failures; `tsc --noEmit` clean with generated content present                                                                                                                                        |
| Integration re-check, 2026-09-24, `origin/main` `afe74131b83718be1bb07b8739f8ba2bd37a0c07` (7 commits past `a306d825`: CRRT-FELLOW-04/05, touching `critical-care` content but no ICU Hemodynamics, dependency or config file) | main alone: route + consumers 47 / 50 suites, 433 / 436 tests, the same three failures by name; with head `08296288` merged (not committed): 93 / 96 suites, 1,059 / 1,062 tests, the same three failures; `tsc --noEmit` clean; PR #266 CLEAN and mergeable, so the branch was not rebased or merged |
| `tsc --noEmit`                                                                                                                                                                                                                 | clean                                                                                                                                                                                                                                                                                                 |
| `eslint --max-warnings 0` and `prettier --check` on every changed file                                                                                                                                                         | clean                                                                                                                                                                                                                                                                                                 |
| `npm run build`                                                                                                                                                                                                                | succeeded; only third-party warnings (`vscode-languageserver-types` via mermaid; Vite chunk-size notices in the bundled training apps)                                                                                                                                                                |
| HD Playwright specs (`playwright.icu-hemodynamics.config.ts`, port 3125)                                                                                                                                                       | 10 passed, 16 failed — the same 16 test names as recorded under “Known failures” (flow 78, 212, 256, 295, 319, 361, 391, 458, 550, 574 ×2; targeted 87 ×3, 132, 191); not repaired, by instruction                                                                                                    |

**Browser journeys (headless Chromium, this worktree's server on port 3125, 1204 × 987; wedge and
debrief also at 390 × 844 with no horizontal overflow).** Evidence:
`Interventional-Pulm-Local-Data/renders/output/hd-pre-review-02-sanity-repair-2026-09-23/`
(`journeys-head.json`, `journeys-head-390.json`, screenshots 01–07).

- **Wedge provenance, Practice HD-01.** Zero, leg raise at 12.6 s, inflate at 25.1 s, assisted
  cursor at 28.5 s, Store at 33.0 s, after the 32.6 s waning. Dock: "PAWP stored. Its cycle was
  acquired before the modeled physiology last changed, so it is kept as a value from those earlier
  conditions." Monitor: "stored end-exp · assisted cursor · earlier conditions". After a current
  series (4.7 L/min), PVR reads **Not interpretable**, and the drawer says "the stored wedge was
  read after PLR". A new occlusion stored under the current conditions restores **PVR 1.4 WU**, with
  no stale-input note.
- **Clamped repeat, Practice HD-02.** 30 tiers, 150 model seconds, series 9.3 L/min, one more tier.
  The CO rail reads 9.3 L/min before and after. The feedback and the trace row say "no further
  modeled effect". The debrief keeps the series as current.
- **Historical-series debrief, Practice HD-03.** Fluid, series 3.8 L/min, dobutamine, debrief. The
  rail reads "— · thermodilution not established for current conditions · last series 3.8 L/min
  was acquired after Fluid +250 mL". The run summary says the series was acquired after fluid, that
  the conditions at the end are those after dobutamine, and that no series was acquired under them.
  The fluid row says "Flow was acquired after it, under the conditions it created: 3.8 L/min …
  That series is now historical … so current flow is not measured."

**Preserved.** Immutable series identity and the current-vs-historical split; learner decision vs
technical quality vs inclusion; manual vs assisted cursor provenance; Task-01 catheter and balloon
safety (`catheterSafety.ts` untouched); `monitorPressureReadouts` as display truth; automatic vs
learner release; missing is not zero; line-specific arterial damping and the shared level/zero
limitation; the Fick provenance rules; model-only leg-raise and counterfactual labelling; the
self-paced policy (no score, penalty or gate added). No coefficient, bound value, onset or
recovery time changed.

**Holds.** HD02-H1…H14 and Task-01 R1/R5/R8 are unchanged. None of the three repairs depended on a
held clinical or source decision.

**Observed, not acted on (this round).**

- Fluid carries a `stressedVenousVolumeMl` delta. That parameter is unbounded, and this model's
  derivation never reads it. So a fluid step always counts as a change of conditions, even with
  volume at its bound — the conservative direction. Whether an unread parameter should count is a
  model-hygiene question for its owner.
- In dark theme the derived-values cards (`.formulaGrid article`) draw near-white text on a
  near-white card. Measured: text `rgb(239, 248, 255)` on `rgb(250, 251, 249)`. Only the
  "Not interpretable" chip and the reason line stay legible. The CSS is untouched since before
  Task 02; this belongs with the Task-03 visual work.
- The practice "Catheter actions and acquisition" disclosure closes itself on deflation (its
  `open` follows the balloon). This is existing behaviour, noted because a second occlusion means
  reopening it.
- In the Learn stage the picker's straddle and earlier-conditions notes appear only if the modeled
  physiology changes during an occlusion. The rendered-surface tests cover them.

## Disposition of the fifteen assigned findings

Every finding was reproduced on the execution base before any edit — in the engine (a scratch
reproduction script), in the real browser against the unchanged base server (port 3136), or both.

| ID    | Reproduced on the base?                                                                                                                                                     | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-05  | Yes, exactly: HD-01, 4.1/4.1/4.1 before fluid and 4.5/4.3/4.5 after, pooled to **“4.3 L/min … from 6 reviewed trials”** with “these 3 acquisitions” beneath it              | **Fixed.** Immutable acquisition-series identity (section A below). The same path now reads **4.4 L/min from 3 reviewed trials in this series**; the 4.1 series is listed separately as acquired “as the case opened”, never averaged in; straight after the fluid step the rail reads “—” and says the last series was acquired before it.                                                                                                                                                                                                                               |
| L7-03 | Yes: an accepted, technically unusable Trial 2 badged “ACCEPTED TRIAL” with no message; the series said “summarizes 3 reviewed, technically usable trials; 0 are available” | **Fixed.** Learner decision, technical quality and calculation inclusion are three separate facts on the card, in the series readout and in the curve's text equivalent, in the same words; an accepted-but-excluded curve is explained at once in an announced note. The learner's choice is kept. Also repaired: the pressed Accept/Exclude button rendered white-on-white inside the stage (identical on the base), so the learner's own selection was invisible.                                                                                                      |
| L2-14 | Yes, exactly: 22 → 27, 13 → 19, pulse pressure 9 → 8 with a down-arrow                                                                                                      | **Fixed.** Both tables compare the model's unrounded estimates from the same state either side of the move and add a Change column: **21.6 → 27.5 (+5.9), 13.4 → 19.3 (+5.9), 8.2 → 8.2 (none)**. Exact equality is asserted, not a ±1 mmHg tolerance.                                                                                                                                                                                                                                                                                                                    |
| L2-02 | Yes: PA rail 28/13 (last beat), dashed tag “mPAP 16” (the model's mean, no respiratory swing); levelling table 16.0 → 9.0 for a 7.36 mmHg offset                            | **Fixed as labelling and precision; no quantity forced equal.** The rail says “last beat · mPAP 19, that beat's mean”; the dashed line is labelled “model mPAP”; the levelling table prints unrounded estimates (16.3 → 8.9) with the −7.4 mmHg hydrostatic contribution on its own row and a note that each value is rounded on its own.                                                                                                                                                                                                                                 |
| L6-03 | Yes: header “PAC · PAWP 9–11”, in-trace “end-exp mean 8”, stored 8, all unlabelled                                                                                          | **Fixed as labelling.** Header: “balloon occlusion · live mean, last beat, any breath phase”; dashed line: “model end-exp mean”; stored value: “stored end-exp · your cursor” (or “assisted cursor”, “not end-exp”, “earlier conditions”). Moving the tag out of the trace lane is Task 03 (L2-01).                                                                                                                                                                                                                                                                       |
| L6-02 | Yes: “Place cursor” dropped the cursor at _now_ (any breath phase), recorded it as end-expiratory unconditionally, and stored the model's estimate, not a sample            | **Fixed.** A keyboard-operable cursor over the samples this occlusion actually captured, with the simulation's modeled respiratory phase drawn beneath (labelled as a model reference, not a ventilator/airway-pressure/impedance trace), plus a separate, labelled assisted placement. Manual vs assisted, sample time, sample value, one-cycle mean, respiratory phase and distance from modeled end expiration are recorded; the stored value is the cursor's cycle mean. The automatic end-expiration marker is no longer drawn on the PAC strip during an occlusion. |
| L3-09 | Yes: an off-level RA read “Chamber interpretation withheld — this display cannot support one” under “Why no chamber can be named”, against its own key                      | **Fixed per authored key.** The readout gives two lines — Chamber and Value — per display problem, written from that problem's own key and explanation: an offset, a moving catheter and a wrong breath phase name the chamber and withhold the number; damping, ringing, a wrong label and a wrong axis withhold both. The “why” heading follows. HD-03-03 stays open.                                                                                                                                                                                                   |
| L3-04 | Yes: reference “base of the c wave”, walk checklist “read the mean, not a peak”, walk note “taken at its trough”, figure line between v and y                               | **Partly fixed; convention held.** The three §3 surfaces and the signal-grammar row now name the point the reference, the monitor's own RA cursor and the cited source (`cvp-measurement-2017`) already use — end expiration, base of the c wave — say “trough” means the respiratory envelope under this patient's controlled ventilation, and distinguish a digital mean averaged across the breath. §8's RAP input (“mean at end expiration”) is a second convention and is held. The figure's reading marker is Task 03.                                              |
| L8-02 | Yes: “mean over cycle” beside “mean end expiration”, cycle unspecified                                                                                                      | **Label fixed; convention held.** The ledger now says “mean over the cardiac cycle (respiratory phase not stated)” and “mean at end expiration”. Which convention the PVR gradient requires is an R2/R8 decision; no formula rule changed.                                                                                                                                                                                                                                                                                                                                |
| L7-06 | Yes: “16.12 − 14.12 = 1.99”; the SVC specimen labelled “Mixed-venous oxygen saturation”; “Inputs that contradict each other” over a missing arterial specimen               | **Fixed.** Site-true labels (“Central venous oxygen saturation (superior vena cava specimen)”); withheld reasons carried as data (`missing-input` vs `contradictory-inputs` vs `not-mixed-venous`…); the subtraction and division lines say “≈” and show the four-decimal working when rounded figures would not reproduce them; the fifth episode is retitled “A missing arterial specimen” with its inputs unchanged (no arterial value inferred). The ScvO₂-vs-SvO₂ direction sentence the report asked for has no registered source and is held.                      |
| L9-05 | Yes: damping the arterial line damped PAP (21/13) and CVP; the arterial repair lifted them to 28/14 and 4; the goal said “distal lumen”; the table reported PA              | **Fixed with a backward-compatible per-line contract.** `MeasurementSystemState.arterialLine` (optional) carries the arterial line's own response; absent, every channel shares one response as before. The transfer damps and repairs only the arterial line; PAP 28/13 and CVP 4 are unchanged by the repair; the goal reads “Run a fast flush on the arterial line”; the table reports arterial rows with PA/RA rows showing no change. Limitation stated on screen: the lines still share one transducer height and zero.                                             |
| L9-03 | Yes: no curves exist (`thermodilutionTrials: []`); the brief promised “erratic thermodilution curves”                                                                       | **Unsupported reference corrected; nothing fabricated.** No authored erratic series exists. The HD-08 brief, the HD-08 expert-trace cue and the capstone stem now say the earlier outputs were _reported_ as disagreeing and their curves are not available here. A source-backed request for authored prior curves is carried forward.                                                                                                                                                                                                                                   |
| P-04  | Yes: “real-time stroke-volume endpoint” and “watch the CO/SV trend” with no flow channel; latent flow 3.9 → 4.5 L/min invisible                                             | **Promise corrected; model-only view added; endpoint decision held.** The action and feedback now say there is no continuous CO/SV channel and that a thermodilution series acquired during the leg raise is the measured route (series identity keeps it separate). A disclosure shows the simulation's internal flow as a labelled model-only value. The debrief says whether this run measured any flow during the leg raise.                                                                                                                                          |
| P-08  | Yes: HD-03 fluid, MAP 85 → 89 (now 84 → 88 on this seed), trace “Applied …” with no comment                                                                                 | **Fixed as debrief truth; clinical grading held.** The debrief names the fluid step, quotes the case's own authored concern, reports what the monitor displayed and whether flow was acquired afterwards, states the model's limit (it does not model oxygenation or lung water, so SpO₂ cannot move), and offers a model-only comparison at the same model time with and without the action. No coefficient changed; no deterioration was added.                                                                                                                         |
| P-12  | Yes, all four parts                                                                                                                                                         | **(2) and (3) fixed; (1) and (4) held.** Model time is stated as compressed in every case brief, in the debrief and in the fluid/diuresis responses; the HD-07 brief no longer says “hypotension” over a modeled MAP of 73–78. HD-05's missing vasopressor and the per-case action menus are owner decisions; no inert or unmodeled option was added.                                                                                                                                                                                                                     |

## A. Thermodilution acquisition-series identity

**What identifies a series.** Every curve the reducer generates now carries an immutable
`ThermodilutionAcquisition`: acquisition time, catheter position, and a `ThermodilutionSeriesIdentity`
made of

- **session** — `caseId/mode/seed/run-N`; `RESET_CASE`, `SET_MODE` and the Practice “Reset case”
  button start a new run, so nothing from before a reset can pool with anything after it;
- **case** and **method** (`bolus-thermodilution`);
- **injectate computation constants** (configured volume and temperature for the case);
- **physiological episode** — an index, the model time it began, and its cause.

Two curves may be averaged only when their identity keys are equal. The key is fixed at acquisition
and never rewritten; reviewing, accepting or excluding an old curve changes its decision, not its
series.

**What starts an episode.** Exactly two things:

1. an accepted `APPLY_INTERVENTION` whose definition changes the model (`parameterDeltas` not empty),
   stamped `{ kind: 'intervention', interventionId, label }`;
2. a change the model itself schedules — a transient effect starting to wane
   (`effectWaningStartsAt`, the same boundary `effectScale` uses) — stamped
   `{ kind: 'effect-waning', … }`. Only the leg raise has one.

Nothing else does: ticks, freeze, sweep, scale, alarms, phase/checkpoint changes, mechanism
selection, level, zero, damping, flush, validation checks, catheter moves, balloon inflation and
deflation, opening hints, references or panels. A refused action (the three HD-08 bundled actions)
and an accepted action with no modeled effect start none.

**Consumers.** One series is “current” — the series for the conditions measurements are acquired
under now (`thermodilutionSeriesView(state).current`). The monitor's CO/CI rail, the case's observe
panel and comparison table, the Learn `series` goal, the before/after watch, the derived-values
drawer, the HD-08 `repeat-valid-thermodilution` milestone and the decision record all read the
current series. Earlier series are kept, listed with their conditions and figures in an
“Earlier series — kept, and not averaged with this one” disclosure, and never presented as current.
The configured maximum of six curves now applies per series.

**Legacy and authored curves.** A curve built without acquisition context (a directly constructed
test fixture) belongs to an `unrecorded` group, which never pools with a recorded series. In a state
whose only curves are unrecorded and which has had a single episode, that group stands in for the
current series and is labelled “acquisition conditions not recorded”. An authored-example identity
exists for teaching series written for the module; it is never the learner's.

**Trial-list API.** `thermodilutionAcceptedAverage(trials, seriesKey?)` and
`thermodilutionSeriesSummary(trials, seriesKey?, identityWhenEmpty?)` keep their signatures and
describe one series — the one named, or the most recently acquired — and never a pool. The summary
adds identity, included vs learner-accepted ids, accepted-but-not-included reasons, the other series
and the reason they were not pooled.

## B–G. What else changed, by section

- **B.** `thermodilutionTrialInclusion` returns learner decision, technical quality, inclusion, a
  code and one sentence; the reducer's response message, the card's announced note, the series
  readout and `thermodilutionCurveTextEquivalent` all print that sentence. No question became
  required; undecided curves simply stay out of the calculation.
- **C.** `deriveUnroundedHemodynamicMeasurements` (the rounded function now delegates to it) and
  `unroundedModelEstimates(state)`; story readings and before/after watches subtract unrounded values;
  monitor, levelling-table and ledger labels name their quantity and window.
- **D.** `PLACE_WEDGE_CURSOR` takes `placement: 'manual' | 'assisted'` and `time`; with neither, it is
  assisted (every existing caller). `occlusionCapture`, `wedgeCursorReadingAt`,
  `assistedWedgeCursorTime` and `modeledRespiratoryReference` are the one implementation the reducer,
  the slider, its `aria-valuetext`, the drawn cursor and the stored value all read.
  `CatheterState.wedgeCursor` and `storedWedge` record the provenance; `wedgeCursorTime` and
  `storedAtEndExpiration` are kept for existing consumers and now tell the truth.
- **E.** `fickVenousSpecimenWords`, `withheldReasonKinds`, unrounded difference and flow on the result,
  and the rounding explanation in the unit account. The derived-values drawer now uses a flow only
  from the current series and a wedge only if stored under the current conditions, and says which
  earlier value it declined and why.
- **F.** `engine/measurementLines.ts` (`arterialMeasurementSystem`, `lineMeasurementSystem`);
  `SET_DAMPING`/`SET_ARTIFACT` take an optional `line: 'systemic-arterial'`; `FAST_FLUSH` reads the
  flushed line's response and adds `fast-flush:<line>`; `pressureObservationKey` keys on the line.
- **G.** `engine/matchedComparison.ts` (`modelOnlyMatchedComparison`, fixed horizons of 15 model seconds
  for an assessment and 30 otherwise, from the authored response windows) using
  `latentPhysiologicalEstimates` — the physiology without this run's measurement-system error; the
  case host keeps an immutable snapshot of the state before each accepted action;
  `authoredConcernForUnfavourableAction` points at a sentence each case already authors.

## Provenance rules the code now enforces

| Category                    | Where it lives                                                                  | Rule                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Latent model state          | `state.measurements`, `unroundedModelEstimates`, `latentPhysiologicalEstimates` | Shown only inside surfaces labelled “model”/“model-only”; never in the decision trace; never called a measurement |
| Currently displayed         | `monitorPressureReadouts` (Task 01), `recentTracePressureMetrics`               | Labelled with its window (“last beat”, “end-exp c-base”, “any breath phase”)                                      |
| Learner-acquired            | curves with a `learner-acquired` identity; `storedWedge` with a `manual` cursor | Carries session, episode, time, method, and for the wedge the sample, window and phase                            |
| Stored historical           | an earlier series; a wedge stored in an earlier episode                         | Kept and visible with its conditions; never current; never an input to a current derived value                    |
| Authored / example evidence | expert traces, Fick and comparison episodes, `authored-example` series identity | Labelled as authored; never transplanted into the learner's record                                                |
| Derived                     | Fick results, the derived-values drawer, `compareObservedFlow`                  | Carries its inputs' provenance; withheld with a reason when an input is missing, stale or from another episode    |
| Assistance                  | `assisted` wedge cursor, the automatic safety release (Task 01)                 | Recorded as assistance; never credited as the learner's identification or deflation                               |

## Mathematical and state invariants under test

- A pure hydrostatic move of −8 cm shifts PA systolic and diastolic by exactly 8 × 0.7355 mmHg and
  the pulse pressure by exactly 0 (to 1e-9), in the story run and in the before/after watch.
- `thermodilutionAcceptedAverage` never returns a value computed from curves of two identities; the
  six-curve pool of Figure 42 is returned by no function.
- A curve's `acquisition` is deep-equal before and after any later action.
- The wedge cursor's value equals an independently computed mean of the samples in the centred
  cardiac cycle (to 1e-12); the stored value equals it; `storedAtEndExpiration` equals
  `isEndExpiration(phase(cursor))`; the assisted cursor is the capture's closest sample to modeled
  end expiration.
- Fick: the difference and the flow are computed from unrounded contents
  (`245 / ((1.34·12.4·0.97 − 1.34·12.4·0.85) × 10)` to 1e-12).
- Line isolation: the last 150 PA and CVP samples of the damped-arterial transfer state are identical
  to those of the clean state at the same seed and time; the arterial repair leaves PA and RA model
  estimates exactly unchanged; a line-less `SET_DAMPING` still damps every channel.
- The model-only comparison is deterministic (two runs deep-equal) and leaves the learner's state
  untouched.

## Trace matrix

Engine traces at identical seed and model time (baseline taken after the zeroed trace settles;
“latent” = `latentPhysiologicalEstimates`, “acq.” = accepted thermodilution series and its episode).
Time is model seconds, compressed.

| Case  | Path (+40 model s)                   | Displayed MAP | Latent CO | Latent PAWP | Latent PA diastolic | SpO₂ | Acq. CO (episode) |
| ----- | ------------------------------------ | ------------- | --------- | ----------- | ------------------- | ---- | ----------------- |
| HD-03 | before                               | 80            | 3.57      | 21.4        | 24.1                | 97   | 3.6 (0)           |
| HD-03 | no action                            | 80            | 3.57      | 21.4        | 24.1                | 97   | 3.6 (0)           |
| HD-03 | intended (dobutamine + diuresis)     | 93            | 4.57      | 17.9        | 21.5                | 97   | 4.7 (2)           |
| HD-03 | unfavourable (fluid 250)             | 84            | 3.77      | 23.4        | 26.3                | 97   | 3.9 (1)           |
| HD-03 | fluid, then intended at +10 s        | 101           | 4.83      | 20.4        | 24.2                | 97   | 4.9 (3)           |
| HD-04 | before                               | 51            | 3.40      | 6           | 23.4                | 88   | 3.5 (0)           |
| HD-04 | no action                            | 51            | 3.40      | 6           | 23.4                | 88   | 3.5 (0)           |
| HD-04 | intended (inhaled PVD + reperfusion) | 58            | 4.23      | 6           | 8.2                 | 89   | 4.3 (2)           |
| HD-04 | unfavourable (fluid 250)             | 55            | 3.61      | 7           | 25.5                | 88   | 3.7 (1)           |
| HD-04 | fluid, then intended at +10 s        | 62            | 4.41      | 7           | 10.8                | 89   | 4.5 (3)           |
| HD-01 | before                               | 72            | 3.90      | 1.0         | 5.4                 | 97   | 4.1 (0)           |
| HD-01 | leg raise + fluid (intended)         | 89            | 4.78      | 1.7         | 5.7                 | 97   | 4.8 (3)           |
| HD-01 | fluid alone                          | 83            | 4.44      | 1.1         | 5.1                 | 97   | 4.4 (1)           |

What these show, and do not: in HD-03 fluid raises MAP a little and flow a little while the modeled
occlusion pressure and PA diastolic rise — the congestion the case's authored reasoning names; SpO₂
never moves because the model has no oxygenation coupling. In HD-04 fluid also raises flow slightly;
whether that is the intended teaching model is held (R5). No coefficient was changed to make any row
“win”.

Journey matrix (unit and browser; ✓ = asserted in a test, B = observed in the real browser on base
and head):

| Condition                     | Learn                                        | Practice / Applied                                     |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| 3 pre + 3 post thermodilution | —                                            | ✓ B (4.3/6 → 4.4/3; earlier 4.1/3 listed)              |
| no measurement                | ✓ trace “not acquired (no accepted series)”  | ✓ leg raise with no series; ✓ HD-03 debrief            |
| stale measurement             | ✓ derived drawer declines earlier CO/wedge   | ✓ B rail “—” + “last series … as the case opened”      |
| changed physiology            | ✓ episodes (intervention, waning, none)      | ✓ series split; ✓ matched comparison                   |
| partial series                | ✓ “2 of the 3 usable curves”                 | ✓ current not established; earlier not carried forward |
| invalid-but-accepted trial    | ✓ B §7 Trial 2                               | ✓ inclusion code on the case card                      |
| held/withheld output          | ✓ Fick missing vs contradictory; L3-09 value | ✓ derived drawer withholds stale inputs                |
| manual cursor                 | ✓ B §6 (record, value, phase, feedback)      | case dock stays one-button assisted (labelled)         |
| assisted cursor               | ✓ B §6                                       | ✓ case dock                                            |
| debrief-first                 | —                                            | ✓ HD-01 debrief before any action                      |
| reset / new case              | ✓ `RESET_CASE` new session                   | ✓ Practice “Reset case” clears action records          |

## Before and after, in the real browser

Real Chromium (Playwright, headless) against the unchanged base server (port 3136, `/private/tmp/hd02-base`)
and this worktree's server (port 3125), at **1204 × 987**; readouts in `readouts-base.json` and
`readouts-head.json`.

| Path                                     | Base                                                                                               | Head                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Practice HD-01, 3 + fluid + 3            | rail 4.1 → **4.1** just after fluid → **4.3**; “4.3 L/min … from 6 reviewed trials”, range 4.1–4.5 | rail 4.1 → **—** (“last series 4.1 L/min was acquired as the case opened”) → **4.4**; “from 3 reviewed trials in this series”; earlier series listed   |
| §7 Trial 2 accepted (invalid)            | “ACCEPTED TRIAL”; “summarizes 3 …; 0 are available”; pressed button invisible                      | “Your decision: Accepted trial” + “Not in the calculation” + announced reason; “0 of the 3 usable curves …”; button visible                            |
| §6 wedge                                 | one “Place cursor”; header “PAWP 9 mmHg”; “stored end-expiratory PAWP 8”                           | slider over captured samples, respiratory model strip, “Set the cursor here” / “Show the assisted placement”; feedback; “stored end-exp · your cursor” |
| §9 arterial transfer                     | PAP 21/13 → 28/14, CVP 6 → 4 after the arterial repair; goal “distal lumen”                        | PAP 28/13 → 28/13, CVP 4 → 4; ART 82/62 → 98/57; goal “arterial line”; line-scope note                                                                 |
| §3 off-level RA                          | “Chamber interpretation withheld — this display cannot support one”                                | “Chamber: the right-atrial pattern …” / “Value: not usable until the transducer is re-levelled and zeroed …”                                           |
| §2 story table                           | 22 → 27, 13 → 19, 9 → 8                                                                            | 21.6 → 27.5 (+5.9), 13.4 → 19.3 (+5.9), 8.2 → 8.2 (none)                                                                                               |
| §2 levelling demo (+10 cm), browser pane | 16.0 → 9.0                                                                                         | 16.3 → 8.9, hydrostatic −7.4 mmHg on its own row                                                                                                       |
| Practice HD-03 debrief after fluid, pane | “Applied Give one modeled 250 mL crystalloid step.” only                                           | named action, the case's own concern, MAP 84 → 88 with “not by itself benefit”, SpO₂ limitation, model-only table                                      |

Layout on the changed surfaces (wedge picker, trial card), head: **1204 × 987, 390 × 844 and 320 × 740
at 100 % root text — no horizontal page overflow and no clipped descendants; 390 × 844 at 200 % root
text — none after a fix made during this batch** (the picker's slider inherited a 9 rem minimum). At
1204 × 987 with 200 % root text the page overflows by 76 px on **both base and head** — the Learn
pathway strip, pre-existing and not HD-02's. Root-text enlargement is CSS `font-size` on `html`,
not native browser zoom, which was not tested. The wedge picker and the trial card were also
captured at **1440 × 900 and 1024 × 768** (no overflow, nothing clipped), and the repository's HD
Playwright document-flow specs pass at 1440 × 900, 1280 × 800, 1280 × 600, 768 × 1024 and 390 × 844.

## Preservation of Task-01 contracts

- `catheterTransitionHold` / `catheterTransitionAllowed`, the single transition rule — untouched;
  the stage-host hold assertions still pass.
- `monitorPressureReadouts` stays the one source of the displayed arterial and CVP numbers; the
  decision record still reads it; the Task-01 displayed-pressure suite passes unchanged.
- `observedSystemState`/`AcquiredFlow` are extended, not replaced; “missing is not zero” and the
  Task-01 sentence formats are kept (`cardiac index not acquired (no accepted thermodilution
series)`, `… accepted curves, newest N s earlier`).
- Episode-bound PA-return checks (`paReturnEpisodeKey`), `paWaveformReturned` vs
  `occlusionReleasedByLearner`, the automatic release earning no `balloon-down` credit, the 10-second
  simulation rail, overinflation/reinflation interlocks and `catheterFlushBlocked` — untouched; the
  automatic release now also clears the wedge cursor.
- Action truthfulness: the reduce-then-describe path is unchanged; HD-08's refused bundled actions
  start no episode and acquire nothing.
- Self-paced policy: no score, penalty, first-attempt tracking, quota, forced question, competence
  record or new gate. The legacy `calculateHemodynamicScore` (never shown to a learner) was not
  touched.

## Tests

| Check                                                                                                                                                                      | Result                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Task-02 suites (4 new files)                                                                                                                                       | **52 tests pass**: `hd-pre-review-02-base-regressions` 9, `…-series-identity` 17, `…-pressure-provenance` 15, `…-derived-and-causality` 11                                                                                                                                                |
| The base-regression file run **on the unchanged base**                                                                                                                     | **9 of 9 fail on their assertions** (not on imports): expected 4.4 received 4.3; pre-fluid flow carried forward; expected 5.884 received 5; 150 PA/CVP samples differ; SVC label; “= 1.99”; no L7-03 message; mid-breath cursor stored as end-expiratory; level fault chamber unavailable |
| `npx --no-install jest src/features/icu-hemodynamics --runInBand`                                                                                                          | **44 suites, 591 tests, all pass** (base: 40 / 539)                                                                                                                                                                                                                                       |
| Consumers: `jest src/app/[locale]/icu-hemodynamics src/features/critical-care src/features/learning-module src/features/module-beta src/app/api/critical-care --runInBand` | 47 of 50 suites; **the same 3 tests fail with identical 432/435 counts on the unchanged base**: CRRT station order; critical-care accessibility surfaces; critical-care learner-copy framing (its rows are in CRRT/MCS/MV files — zero ICU-hemodynamics rows)                             |
| HD Playwright specs, `playwright.icu-hemodynamics.config.ts` (port 3125)                                                                                                   | **10 passed, 16 failed — the same 16 test names fail on the unchanged base** (same specs, identical config pointed at port 3136). Pre-existing; see “Known failures”                                                                                                                      |
| `tsc --noEmit` (`NODE_OPTIONS=--max-old-space-size=8192`)                                                                                                                  | clean                                                                                                                                                                                                                                                                                     |
| `eslint --max-warnings 0` on every changed/added `.ts`/`.tsx`                                                                                                              | clean                                                                                                                                                                                                                                                                                     |
| `prettier --write` on every changed/added file                                                                                                                             | applied                                                                                                                                                                                                                                                                                   |
| `npm run build`                                                                                                                                                            | **succeeded** with this worktree's and the base's dev servers stopped, including `build:content`, the asset validators and `prepare:standalone`; the only warnings are third-party (`vscode-languageserver-types` via mermaid)                                                            |

**Existing tests changed, and why.** Three baseline tests asserted behaviour this batch was asked to
change; each now asserts the new contract rather than being removed:

1. `h2-h3-reference-and-pac-safety.test.tsx` — “never names a chamber from a faulted display” was
   the contract report L3-09 found contradicting the items' own keys. It now asserts that nothing is
   named before a reading, that the off-level RA names the chamber and withholds the value, and that
   the overdamped display withholds both. The companion “opens the reasoning” test checks the value
   line instead of the withheld sentence.
2. `stage-host.test.tsx` (wedge section) — the one-press cursor is now the labelled assisted
   placement; the test presses it and checks the stored value says “assisted cursor”.
3. `components.test.tsx` (PacActionDock) — the test forced `wedgeCaptureReady` on a state with
   nothing captured, which the new cursor correctly refuses; it now lets a breath of trace accumulate,
   and the button name gained “(assisted)”.

**Not run, and why.** `npm run test` in full (the HD suites plus every suite importing
`icu-hemodynamics` were run instead). Native browser zoom, real assistive technology, dark/light theme
contrast measurement and non-Chromium browsers were not tested. `/api/analytics` errors locally because
the worktree has no `.env.local` — present on the base and unrelated.

## Source and model assumptions

- The episode boundaries are step boundaries. A series acquired while a modeled response is still
  developing (the fluid step equilibrates over 15–30 model seconds) is not further split; the
  readout does not claim otherwise.
- The wedge value a cursor yields is the mean of the one cardiac cycle centred on it, taken from the
  captured occlusion samples. The module already calls the stored wedge an end-expiratory mean; the
  point on the cycle and the respiratory window a clinician should use remain HD-03-09 / R2.
- “Inside the modeled end-expiratory window” reuses the existing model constant
  `END_EXPIRATION_TOLERANCE_PHASE` (±0.12 of the breath), which the monitor's CVP cursor already used.
  It is labelled a model setting, never a clinical tolerance.
- The modeled respiratory reference is the samples' `respiration` channel, the model's own breath
  timing; its direction is taken from `spontaneousBreathingFraction`.
- Model-only comparison horizons (15 and 30 model seconds) come from the authored response windows
  (“over the next 10–20 seconds”, “over 15–30 seconds”). They are display choices, not clinical times.
- Latent physiological values are read through an ideal measurement system (levelled, zeroed,
  damping 0.65); they exclude this run's measurement error and nothing else.
- No catheter dimension, balloon volume, withdrawal distance, drug target, fluid contraindication,
  diagnostic cutoff, response coefficient, wave timing or acceptance percentage was added or changed.

## Human-review holds (all NOT REVIEWED)

| Hold                                                | Group / old hold  | Exact decision                                                                                                                                                                                                                                            | Current code example                                                                                                          |
| --------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| What counts as a comparable series                  | R4                | Are _case/session + configured injectate + physiological episode_ the right identity for this module, and should a series acquired during an evolving response (e.g. within 30 s of a fluid step) be flagged or split?                                    | `learnerThermodilutionSeriesIdentity`, `withNewPhysiologicalEpisode`; HD-01 post-fluid trials 4.5/4.3/4.5 acquired from +13 s |
| Which chamber/value verdict each display fault gets | R2 / **HD-03-03** | Confirm, per fault, the split implemented from each item's own key: level, motion and respiratory phase name the chamber; overdamped, underdamped, mislabel and scale do not.                                                                             | `normalWaveformValidityChallenges[*].readout`                                                                                 |
| RA/CVP reading convention across sections           | R2 / R8           | §3 now says “end expiration, base of the c wave” (matching the monitor and `cvp-measurement-2017`); §8's RAP input says “mean at end expiration”. Which should the module teach, and should §8 change?                                                    | `routeSpine.ts` `ra`; `derivedMetrics.ts` `rapMmHg.requiredConvention`                                                        |
| mPAP convention in the PVR gradient                 | R2 / R8           | Must the mean PA pressure feeding PVR also be end-expiratory, or is a cardiac-cycle mean of unstated phase acceptable? No formula rule changed.                                                                                                           | ledger rows in §8 “Work the episodes”                                                                                         |
| Wedge cursor value and window                       | R2 / **HD-03-09** | Is “mean of the cardiac cycle centred on an end-expiratory cursor” the value to teach, and is ±0.12 of the breath an acceptable _model_ window?                                                                                                           | `wedgeCursorReadingAt`, `END_EXPIRATION_TOLERANCE_PHASE`                                                                      |
| Hydrostatic figure                                  | R2 / **HD-03-01** | Unchanged: the 7.4 mmHg per 10 cm figure and its source are still open. The table now prints the offset with one decimal.                                                                                                                                 | `MMHG_PER_CM_H2O = 0.7355`                                                                                                    |
| ScvO₂ versus SvO₂                                   | R4                | Should the Fick teaching say how, and in which direction, a central venous saturation can mislead? No registered source supports a sentence; one was not written.                                                                                         | `fick.ts` `not-mixed-venous` reason                                                                                           |
| PLR endpoint                                        | R4                | The module has no continuous flow or stroke-volume sensor. Should the leg raise teach a thermodilution series during the leg raise, add a sourced flow surrogate, or keep the model-only view? Until decided, the promise says only what exists.          | `plr` in `cases.ts`; `LegRaiseModelOnly`                                                                                      |
| Authored prior erratic curves for HD-08/§9          | R4                | Should the capstone show supplied prior curves as authored evidence? If so, which source or authored specification? None was fabricated.                                                                                                                  | HD-08 opens with `thermodilutionTrials: []`                                                                                   |
| How to grade fluid in HD-03/HD-04                   | R5                | Should fluid in these cases be a hard safety interrupt, stay an unfavourable but permitted choice (as now), or get different model coefficients? The model shows a small flow rise with fluid in both (table above). Nothing was changed to make it lose. | `unsafeInterventionIds`; `fluidStep.parameterDeltas`                                                                          |
| HD-05 pressure support                              | R5                | Should HD-05 offer a vasopressor, or explain its absence? No action was added.                                                                                                                                                                            | HD-05 `interventions`                                                                                                         |
| HD-07 severity                                      | R5                | The brief no longer says “hypotension” because the modeled MAP is 73 (78 displayed unzeroed). Should the case instead be re-parameterised to be hypotensive?                                                                                              | HD-07 `initialParameters`                                                                                                     |
| Per-case action menus hint at the diagnosis         | R5 / R7           | A common menu would add inert or unmodeled options, which the package forbids. Owner decision with Task 04 (P-01/P-02).                                                                                                                                   | `interventions` per case                                                                                                      |
| Shared transducer level and zero across lines       | model             | Should each line get its own level and zero (a broader change to `MeasurementSystemState`), or is the stated limitation enough?                                                                                                                           | `arterialLine` carries damping only                                                                                           |

Task-01 holds R1, R5 (L1-02) and R8 (HD-03-08) are unchanged.

## Carry-forwards

**To HD-PRE-REVIEW-03 (waveforms and visual workbench)**

| Item                                                         | Status                                 | What 03 should do                                                                                                               | Acceptance check                                                          |
| ------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| L6-03 / L2-01 value tags drawn over the trace                | Labels fixed here; placement not moved | Move “model mPAP”, “model end-exp mean”, cursor and c-base tags into a gutter, keeping the labels and provenance this batch set | No tag intersects the trace at 1204 × 987 and 390 × 844; labels unchanged |
| L3-04 figure reading marker                                  | Wording fixed here                     | Mark the end-expiratory c-wave-base reading point on the §3 RA figure with its own marker                                       | Marker at the c-wave base inside the end-expiratory window                |
| Pressed/placeholder contrast in thermodilution cards         | Pressed button fixed here              | Placeholder “Choose a reason” and disabled controls are low-contrast on the light card                                          | Measured contrast in both themes                                          |
| 1204 × 987 at 200 % root text: pathway strip overflows 76 px | Pre-existing, identical on base        | Contain the Learn pathway strip                                                                                                 | No horizontal page overflow                                               |
| Case dock wedge cursor                                       | One-button, labelled assisted          | Optionally reuse `WedgeCursorPicker` in `PacActionDock` so Practice offers the manual cursor too                                | Manual and assisted both recorded in Practice                             |

**To HD-PRE-REVIEW-04 (self-paced teaching and flow)**

| Item                                             | Status                                                                                     | Next                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| L2-15 “What actually changed” numbers never seen | Precision fixed here (unrounded, 0.1 mmHg, Change column); still model estimates, labelled | Decide whether the table should report the monitor's readings instead                       |
| L7-05 six near-identical Fick cards              | Unchanged except episode 5's title                                                         | A comparison table could show a genuine contradictory pair beside the missing-specimen case |
| P-01/P-02 action cards and menus                 | Unchanged                                                                                  | See the R5/R7 hold above                                                                    |

**To whoever owns the HD end-to-end specs** — see “Known failures”.

## Known failures

All pre-existing; each fails identically on the unchanged base.

- **HD Playwright specs** — 16 of 26, the same names on base and head:
  `icu-hemodynamics-flow.spec.ts` lines 78, 212, 256, 295, 319, 361, 391, 458, 550 and 574 (×2:
  deferred and immediate teaching feedback), and `icu-hemodynamics-targeted.spec.ts` lines 87
  (×3: 1440, 1280, 390), 132 and 191. Task 01 recorded the same count at `c717c9ff`; the first
  failure still waits for a flush control that the current stage does not render at that point.
  Realigning these specs is the unclaimed bounded task Task 01 named.
- **Consumer Jest suites** — CRRT station order; critical-care accessibility surfaces; critical-care
  learner-copy framing (zero ICU-hemodynamics rows). Identical 432/435 on base and head.
- **1204 × 987 at 200 % root text** — the Learn pathway strip overflows 76 px on base and head.

## Stopping rule

One branch, one PR, no merge, no deployment, no Task 03, no G02 re-run, no API purchase. The
sanity-repair round was pushed to the same PR (#266); no new PR was opened.
