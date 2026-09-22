# ECMO-FELLOW-02 — causality and time

Implementation: September 22, 2026. Prepared by Claude (AI implementation). **Not reviewed by a
clinician, a perfusionist or a device specialist.** This is a software and educational-model
remediation. The independent software review is recorded in the addendum below. This is not
clinical validation, device validation or release approval, and it closes no `OWNER_DECISIONS.md`
hold.

**Result.** The engine now separates what a case authored, what the model derives, what a fault's
story drives, and what a learner's action bought. It also no longer spends a clock second on
loading, recomputing or revealing. The no-action path of every case now moves only where the case's
own story says it should. Of the 36 assigned source IDs:

- **9 are repaired**;
- **14 are partly repaired**, with the deferred subpart named;
- **13 are contained**: the model limitation is stated on the learner's surface and the physiology
  stays with the named owner decision.

No row is classified "not reproduced": every row reproduced on the baseline. No coefficient, target,
answer key, drill timing or hazard threshold was changed to make a trajectory look right.

**Evidence provenance.** The source rows come from `CARDIOHELP_ECMO_learner_walkthrough.docx`, an
AI-assisted browser walkthrough written in a first-year-fellow persona. It is not a learner study
and not clinical or device review. Its screenshots record a past run. Every row was reproduced
against the code at the baseline SHA before anything was changed (engine traces and the Jest gate).
The rendered baseline was driven in a production browser later in the session (see
[Browser](#real-chromium-against-production-builds)).

## Scope and baseline

- Task file `02_ECMO_CAUSALITY_AND_TIME.md`, read with `00_START_HERE.md`, `FEEDBACK_LEDGER.md`,
  `SOURCE_AND_CODE_NOTES.md`, `CROSS_MODULE_COORDINATION.md`, `OWNER_DECISIONS.md` and
  `SHARED_FEEDBACK_HANDOFF.md`. All are in
  `Interventional-Pulm-Local-Data/module_update_9_19/ECMO_Claude_Implementation_Pack`.
  Repository `AGENTS.md` and `CLAUDE.md` were also read.
- **Branch `claude/ecmo-fellow-02`**, a new branch in its own new worktree
  `Interventional-Pulm-Education-Worktrees/claude-ecmo2-9-22`. `claude/ecmo-fellow-01` and its
  worktree `claude-ecmo9-21` were not used or touched.
- **Starting `origin/main`: `9fbdbddc4d7f124c7ac3254f4cb8aa4c15c0233f`** (PR #261). Every "before"
  observation below was taken against it. The branch was created from it directly: not from the
  Prompt-01 head, and not from the Prompt-01 merge.
- **Prompt-01 ancestry.** The Prompt-01 merge `035081c6827f9c6fafd855d21afb3ed2c41d2c16`
  (PR #255, `claude/ecmo-fellow-01`) is an ancestor of `9fbdbddc`, and so is the reviewed Prompt-01
  head `b4f51f40` ("close prompt-one sanity review findings"). `git log 035081c6..9fbdbddc --
src/features/cardiohelp-ecmo` is **empty**, so the ECMO tree at the baseline is exactly the
  reviewed Prompt-01 tree. No Prompt-01 commit was rewritten, reset or rebased.
- **`origin/main` moved during the session** to **`d98bab79af9231eb1857e2da96cb75ca2068d85c`**
  (PR #263 CRRT-FELLOW-02 and PR #254 BF batch 01). It was merged into the branch
  (`664b8973`, merge commit, no rebase). No file overlaps: main changed CRRT,
  bronchoscopy-foundations, e2e and `.claude/launch.json` paths only, and this branch changes only
  ECMO paths, one ECMO script and these docs. Checks were rerun on the merged tree
  ([Verification](#verification)).
- **At implementation handoff**, `origin/main` had moved again to
  **`bf613270a37a30cfd31a915a33758b808dfbff89`** (PR #259, MV-PRE-REVIEW-01). The implementer
  had not integrated it. The independent review merged it and reran the checks; see the addendum.

### Baseline gate (before any edit, at `9fbdbddc`)

| Check                                                                            | Result                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECMO Jest (`src/features/cardiohelp-ecmo`)                                       | 75 suites, **2,361 / 2,361 pass**, including all Prompt-01 regressions (`ecmo-fellow-01-recovery-and-state-truth.test.tsx`)                                                                                                                                                 |
| `tsc --noEmit`                                                                   | exit 0                                                                                                                                                                                                                                                                      |
| Consumer Jest (critical-care, CRRT, MCS, ICU simulation, shared learning-module) | 154 suites, 1,952 pass, **3 fail**, all in `critical-care/__tests__`: learner-copy (names 15 CRRT/critical-care files), CRRT station order, CRRT accessibility name. No ECMO file is named.                                                                                 |
| The new Prompt-02 tests, run on the baseline tree                                | engine suite **42 of 66 fail**; surfaces suite **21 of 24 fail** (only the two new modules stubbed so it compiles)                                                                                                                                                          |
| Rendered production-build check of the Prompt-01 invariants                      | **Not run before the first edit.** Disclosed: it was run later against a production build of the untouched baseline tree (detached worktree at `9fbdbddc`), with the same driver as the repaired build. Results are in [Browser](#real-chromium-against-production-builds). |

## The causal manifest

`ECMO-FELLOW-02-causal-manifest.json` has two parts:

- A **variables table** (22 rows). Each row gives the variable, its initial owner, what updates it,
  its time and learner dependence, what it is derived from, the defect at the baseline and the
  intended contract.
- **Per-case rows** for all 14 clinical Practice cases (C1–C7, VAC1–VAC7) and both integrated cases
  (IV, IA). Each gives the presenting fault, the fields the case authors, and whether the narrative
  is historical or simultaneous. It lists every keyed response clause and whether the model can
  display it, the owner decisions, and the matched-time samples of every metric on both trees.

The per-case rows are generated from the engine at the branch head:

- the owner of each value at load (`resolvePatientTargets`);
- the active fault's story (`faultPatientTargets`);
- deterministic replays of the paths in `test-support/causalTrajectories.ts`, run on both trees.

Clause status, narrative timing and owner decisions are hand annotations.

**Ownership vocabulary.** A value comes from one of these sources:

- authored initial case state;
- derived circuit state;
- derived patient state;
- clock- or time-driven state;
- learner-action-driven state;
- a transient intervention patch;
- an exogenous story event;
- an illustrative or reference-only value;
- unavailable or unmodeled state;
- a copied or stale presentation value.

**Target owners** (who sets where a patient field is heading):

- `fault-story`: an active fault's deterioration target;
- `case-authored`: the case's level, moved only by later changes in the generic target;
- `intervention-held`: a non-temporizing intervention's level, held against faults present when it landed; a later fault with its own target can still move the field;
- `generic-model`: the engine's generic relationship.

### Variables: defect at the baseline and the contract now enforced

| Variable                                         | Baseline defect                                                                                                                                                                                                     | Contract now                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elapsed simulated time                           | Loading counted as a clock second. TICK and STEP kept running under the debrief. A foundation restore (reveal, preview, phase entry) restarted a held clock.                                                        | Advances only on an explicit STEP, a learner-started TICK or a learner-started foundation clock. Stops at the reveal. Loads, actions and restores never advance it, and a restore never starts it. |
| Circuit flow and pressures                       | A speed, sweep, gas, restore, correction or clinical patch was not recomputed until the next tick, so a paused case showed stale flow.                                                                              | Recomputed at the unchanged time after every control action. The patient is untouched. A stopped pump's channels are never invented.                                                               |
| Pump speed, running state                        | The LPM loop, trim and restart ran on every derivation.                                                                                                                                                             | Stop acts on any recomputation. Trim, LPM loop and automatic restart run only on clock seconds. The request is never zeroed (Prompt 01).                                                           |
| Patient oxygenation                              | Generic targets pulled authored values toward a generic patient: recirculation 78 → 91 untreated, differential hypoxemia 78.7 → 82 untreated. A supportive patch faded. Unauthored fields drifted from VV defaults. | The ownership rule, plus settle-at-load for unauthored fields.                                                                                                                                     |
| PaCO₂ and pH                                     | Every case drifted 42 → 46 in its first seconds. An authored pH was overwritten upward on the first tick.                                                                                                           | An unauthored PaCO₂ does not drift. An authored pH is reproduced by a derived bicarbonate.                                                                                                         |
| MAP, CVP, pulse pressure, native output, lactate | Generic VA values overwrote authored ones (tamponade pulse pressure 6 → 18 untreated). VA cases inherited VV defaults (native output 4.5).                                                                          | Ownership rule. Unauthored VA fields start at VA values. No new targets.                                                                                                                           |
| Heart rate                                       | Shown as a live value though never modeled.                                                                                                                                                                         | Labelled on the monitor as held, not modeled.                                                                                                                                                      |
| Work of breathing, respiratory rate              | Timed from the case clock (t ≥ 20), not from the sweep stop. An authored rate snapped to 18/24/32 on the first tick.                                                                                                | Timed from the recorded sweep stop. An authored rate stands until work of breathing changes. An unauthored rate follows the authored work of breathing at load.                                    |
| Intervention records                             | No reading of what an action found or produced was kept. The debrief rebuilt it from an overwritable trend buffer.                                                                                                  | Each record carries an immutable before/after observation at its own simulation time.                                                                                                              |
| Landed patch                                     | Moved toward its target in the same second, so the ventilation card showed 85.3, never 86.                                                                                                                          | Shown for its own second. Non-temporizing patches become held levels.                                                                                                                              |
| Debrief comparisons                              | "Before" was the state after every action that second. The last interval kept growing under a running clock.                                                                                                        | Named pairs: at the action, over the following interval, and the untreated case over the same seconds. Same-second actions grouped.                                                                |
| Case brief data                                  | Printed beside the live monitor with no label.                                                                                                                                                                      | Labelled as the presentation. The monitor is the running model.                                                                                                                                    |

The remaining rows (sweep/gas, clamps, air state, support mode, alarms, authored event timing,
foundation baseline) are in the JSON. Clamps, air state and support mode are unchanged from
Prompt 01.

## Causal architecture changes

The engine changes are in `engine/simulation.ts`, `engine/reducer.ts`,
`engine/clinicalResponse.ts` and `engine/types.ts`.

1. **Loading is not a clock second.** The load derivation runs with
   `{ advancePatient: false, atLoad: true }`. A single gate, `clockAdvanced`, lets the following
   move only on a new clock sample: the patient, the post-oxygenator saturation, the battery, the
   haemoglobin drift, the LPM loop, the backflow counter, and the interlock trim and restart. At
   t = 0 the monitor shows the authored patient exactly.
2. **Unauthored fields settle at load** (`settleLoadedState`). An unauthored rate-limited field
   starts at the model's generic value for the opening state, unless an active fault's story owns
   that field. Aliases:
   - VV right-radial and femoral take an authored SpO₂;
   - VA SpO₂ and the right-radial reading alias each other.

   Also at load: bicarbonate is derived when pH and PaCO₂ are authored without it; pH is computed
   when it is not authored; respiratory rate follows work of breathing; the post-oxygenator
   saturation settles.

3. **Clinical and integrated cases own what they author** (`scenario.patientOwnership`,
   `resolvePatientTargets`). Precedence:
   1. a newly introduced fault's story target; otherwise, an intervention-held anchor beats the
      story targets already present when that intervention landed;
   2. the authored level plus (generic now − generic at load);
   3. generic.

   Rules within that precedence:
   - The anchor is worse-of(authored, generic at load) only when support is interrupted at load.
   - Directional fields, and fields owned by the presenting fault's story, are released when the
     presenting problem is corrected.
   - Recognition-only faults never release.
   - Non-temporizing patches (supportive, definitive, harmful) become held levels when they land.
     Temporizing patches still fade.

4. **Action-time recomputation.** These actions recompute the circuit at the unchanged time:
   SET_RPM, SET_FLOW_TARGET, SET_SWEEP, SET_GAS_FIO2, RESTORE_GAS_SOURCE, RESTORE_AC_POWER,
   TOGGLE_ZERO_FLOW, TOGGLE_GLOBAL_OVERRIDE, ADJUST_LIMIT, CORRECT_FAULT, PERFORM_CHECK,
   APPLY_CLINICAL_INTERVENTION and INJECT_FAULT. `RESET_BUBBLE` is deliberately excluded, which
   keeps a Prompt-01 reducer contract.
5. **Sweep-stop timing.** The reducer records `scenario.sweepStoppedAt`. The off-sweep
   work-of-breathing response comes 20 modeled seconds after the sweep stops, not at case t = 20.
6. **The clock stops at the reveal.** TICK and STEP are no-ops once `phase === 'complete'`.
7. **Immutable observations.** Every learner action records an `EcmoObservation` before/after pair
   on its `ClinicalInterventionRecord` and `HistoryEntry`.
   - `engine/counterfactual.ts` (`replayWithoutAction`) is a deterministic untreated replay of the
     same case.
   - `components/practice/debriefTimeline.ts` builds the three named comparisons from these records
     and the replay.
8. **The Learn clock** (`session/foundationSession.ts`). A restore keeps the learner's current
   running state, and a held variant still forces a hold. Only `SET_CLOCK_RUNNING` starts the
   clock.

## Disposition of every assigned source ID

**R** = repaired · **P** = partly repaired (deferred subpart named) · **C** = contained (the
limitation is stated on the surface; the physiology is held).

| ID     | Sev | Disposition | What changed                                                                                                                                                                                                                                                                                            | Held / deferred                                                                                                                      |
| ------ | --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S1-5   | P3  | **R**       | The explorer shows the value a halving button actually set and the delivery ratio it produced. Saturation carries %. No unintroduced "this patient". Formula unchanged.                                                                                                                                 | —                                                                                                                                    |
| S3-2   | P3  | **R**       | The one-mmHg suction change is stated as small. The coefficient is unchanged.                                                                                                                                                                                                                           | —                                                                                                                                    |
| S3-3   | P2  | **R**       | The reversed-direction option is categorised by its own rationale (`incorrect-mechanism`). The key and wording are unchanged.                                                                                                                                                                           | —                                                                                                                                    |
| S4-2   | P2  | **C**       | The Section 4 panel states that the two saturations come from separate formulas and that the model has no dissolved-oxygen or PO₂ term. Nothing is invented.                                                                                                                                            | ECMO-OWNER-04                                                                                                                        |
| S4-3   | P2  | **C**       | Section 4 and Practice state that modeled seconds are compressed and a final reading can still be moving.                                                                                                                                                                                               | Hazard flags and pacing: 05 / ECMO-OWNER-09                                                                                          |
| S4-4   | P3  | **P**       | States that the model's PaCO₂ has no blood-flow term.                                                                                                                                                                                                                                                   | The "Sweep-gas FiO₂" label and the "flow left after" wording belong to 04                                                            |
| S5-1   | P2  | **R**       | The load is settled, so Now equals the reference with a zero change. The change column names the reading it is measured from.                                                                                                                                                                           | —                                                                                                                                    |
| S6-2   | P3  | **P**       | One percentage notation everywhere. The comparison table names the loaded state it reads.                                                                                                                                                                                                               | Placement of the transfer question: 03/04                                                                                            |
| S8-3   | P2  | **P**       | Flow is recomputed at the action. The step says it is one compressed authored event standing for the cause-specific correction.                                                                                                                                                                         | Choosing between causes and a realistic recovery: 04 / ECMO-OWNER-10                                                                 |
| S10-2  | P1  | **C**       | Prompt 01's "teaching transition" naming stands. Practice now says modeled seconds are compressed, and the debrief separates the change at the action from the interval that followed.                                                                                                                  | Exchange timing and risk: 05 / ECMO-OWNER-10                                                                                         |
| S10-3  | P1  | **C**       | The existing feedback keeps the limitation visible, and no copy calls improved flow safe. No hemolysis cost, penalty or coefficient invented.                                                                                                                                                           | 05                                                                                                                                   |
| S11-2  | P2  | **P**       | Both transfer steps name 4.0 L/min, the setting they complete on. Expected responses no longer promise a response the step cannot show. "Neither instant nor linear" now says what the simulation draws.                                                                                                | Transfer steps still do not advance time: 04                                                                                         |
| S14-1  | P2  | **C**       | The gas drill says the recovery looks instant because the source is off for one modeled second, and that recovery is symmetric with the rise. The gas-restore note no longer points at a missing action.                                                                                                | The "delivered" label: ECMO-OWNER-02, 03                                                                                             |
| S17-4  | P2  | **P**       | The capstone's reveal and preview no longer start a held clock (t 28 → 28 over 3 s of wall time; baseline 28 → 31). An unauthored respiratory rate follows work of breathing.                                                                                                                           | "Restore verified gas source" stays disabled by design of that lesson: 04                                                            |
| S17-5  | P2  | **P**       | Task 1 says the simulator is held just before the change, so its values are still the ones the case started from. Task 6 is named as retrieval of Section 6.                                                                                                                                            | Question redesign: 04                                                                                                                |
| VA5-1  | P1  | **C**       | VA sections state that the circuit equations carry no arterial pressure, so VA and VV references read the same circuit numbers. No pressures chosen to look different.                                                                                                                                  | ECMO-OWNER-05                                                                                                                        |
| VA11-1 | P1  | **C**       | Traced: no modeled mixing variable exists. The marker is already drawn and described as "mixing region varies". It is not bound to SpO₂, per the pack's direction.                                                                                                                                      | ECMO-OWNER-12, visual 03                                                                                                             |
| VA13-1 | P2  | **R**       | VA drills open on VA values, not the VV default patient. The VA startup drill authors the femoral 98.5 and MAP 71 its stem quotes.                                                                                                                                                                      | —                                                                                                                                    |
| VA17-3 | P2  | **C**       | The capstone's MAP-from-flow statements carry the vasoplegia exception. That MAP is independent of flow under vasoplegia is true of this model.                                                                                                                                                         | ECMO-OWNER-07                                                                                                                        |
| C1-1   | P1  | **C**       | The reassessment names the limit: breathing is not modeled after support starts. The key is unchanged. The harmful path's lower SpO₂ at the check is that card's modeled consequence (78 → 74.7 at 3 s).                                                                                                | ECMO-OWNER-10                                                                                                                        |
| C1-3   | P2  | **R**       | The debrief compares named immutable pairs. Starting support reads 0 → 4.05, not "unchanged". Same-second actions are grouped as "actions in the same modeled second", with no invented timestamps.                                                                                                     | —                                                                                                                                    |
| C1-4   | P2  | **P**       | Lactate no longer clears untreated (3.2 flat on path A; baseline 3.1 → 1.8), so its fall is attributable to support. Modeled time is labelled as compressed.                                                                                                                                            | Ventilator rest settings and CO₂ pacing: ECMO-OWNER-09                                                                               |
| C2-1   | P2  | **P**       | The debrief shows MAP 54 → 65 over "This run, 0 → 4 s" beside the untreated case over the same seconds. The brief's numbers are labelled as the presentation.                                                                                                                                           | Brief flow 2.7 L/min and pVen −165 remain different from the live opening 2.56 L/min and −139.                                       |
| C3-1   | P0  | **C**       | The stop acts at the speed request that crosses the limit. The banner names this model's pressure interlock, not a device alarm. The request is kept.                                                                                                                                                   | Protective behaviour and alarm: ECMO-OWNER-03                                                                                        |
| C3-2   | P1  | **C**       | The reassessment names that MAP after decompression is not modeled. Heart rate is labelled not modeled. No MAP or tachycardia invented.                                                                                                                                                                 | ECMO-OWNER-10                                                                                                                        |
| C4-1   | P3  | **R**       | PaCO₂ opens at the model's value (46) and no longer "rises" after a new membrane. The membrane fault has no PaCO₂ term: stated in the manifest, no new term.                                                                                                                                            | Membrane CO₂: ECMO-OWNER-10                                                                                                          |
| C5-2   | P3  | **P**       | The brief is labelled as the presentation. Traced: the authored 84% pre-oxygenator saturation was a dead input the console never read.                                                                                                                                                                  | The monitor opening collapsed is layout: 03                                                                                          |
| C5-3   | P1  | **P**       | Untreated SpO₂ holds (78 at 10 s). Repositioning raises it (85 vs 78 at a matched 10 s, in the browser).                                                                                                                                                                                                | The brief says "78% and falling"; untreated SpO₂ is flat because a recirculation deterioration target is not modeled. ECMO-OWNER-10. |
| C6-1   | P1  | **C**       | The drill explains its one-second interruption. In the case, CO₂ recovers over about thirty modeled seconds. The distractor key is unchanged.                                                                                                                                                           | Clinical pacing: ECMO-OWNER-09                                                                                                       |
| VAC1-1 | P2  | **P**       | Pulse pressure (8) and native output (1.2) no longer improve untreated.                                                                                                                                                                                                                                 | Right arm equals femoral until the right arm reaches 96, both from the authored 86: ECMO-OWNER-06/10                                 |
| VAC2-1 | P1  | **P**       | Pulse pressure holds at the authored 6 untreated (baseline widened 8 → 18). Native output opens at the VA value 2.4 (baseline 4.4). Heart rate is labelled not modeled. The reassessment names that pulsatility recovery is not modeled.                                                                | ECMO-OWNER-06                                                                                                                        |
| VAC3-1 | P2  | **C**       | Pressors hold the MAP they bought while the tone problem stands. The speed card and reassessment no longer claim pVen/chatter changes the model does not produce. The reassessment states that extra flow does not lift MAP in this case. The untreated decline is the case's story. No MAP rise added. | ECMO-OWNER-07                                                                                                                        |
| VAC5-1 | P1  | **P**       | No action: right arm 78, pulse pressure 28, native output 3.5, all flat. The ventilation card's gain lands (86) and persists (86 at 8 s).                                                                                                                                                               | The speed/flow path still changes flow without an upper-body response; response model: ECMO-OWNER-10.                                |
| VAC6-1 | P2  | **R**       | The limb note is true for its mode: the limb case describes its own story, and other VA cases keep the held-limb note.                                                                                                                                                                                  | Recovery time course: ECMO-OWNER-10                                                                                                  |
| IV-4   | P2  | **P**       | Pre-trial values stay settled (PaCO₂ 43 flat; baseline climbed 44 → 60 before any trial). Work of breathing rises 20 modeled seconds after the sweep stops, and the clock is labelled compressed.                                                                                                       | Trial duration and the sweep-0 target: ECMO-OWNER-09/11                                                                              |
| IA-3   | P1  | **R**       | Recognition-only wording no longer claims a correction ("recognised and escalated", "escalated, not carried out here"). The fault stays active and the right arm stays at the authored 83.                                                                                                              | —                                                                                                                                    |

Independent review counts: R 9, P 14, C 13 (36). The three downgraded rows retain the concrete improvement while recording the source complaint that remains unresolved.

## Trajectory evidence (matched modeled seconds)

`ECMO-FELLOW-02-trajectories.md` holds the full table: every case, four paths, t = 0/3/8/20, both
trees. `ECMO-FELLOW-02-trajectories.json` holds every row, including every action row read at its
own unchanged simulation time. The paths are:

- **A** time only;
- **B** assessment only;
- **C** the intended treatment;
- **D** a harmful or ineffective path.

Rows where the baseline's no-action path moved as an artifact (baseline → repaired, at 0/3/8/20):

| Case              | Signal, path A         | Baseline                      | Repaired          | Now                                                    |
| ----------------- | ---------------------- | ----------------------------- | ----------------- | ------------------------------------------------------ |
| C5 recirculation  | SpO₂                   | 78.7 / 80.8 / 84.3 / 91.3     | 78 / 78 / 78 / 78 | Path C 92 at 20 s is now attributable to repositioning |
| VAC5 differential | right arm              | 78.7 / 80.8 / 82 / 82         | 78 / 78 / 78 / 78 | Path C 86 / 86 / 86 persists                           |
| VAC2 tamponade    | pulse pressure         | 8 / 14 / 18 / 18              | 6 / 6 / 6 / 6     | MAP story (46 → 40) preserved                          |
| VAC4 VA membrane  | MAP / right arm        | 57 → 69 / 84.7 → 96           | 56 flat / 84 flat | Recovers only after exchange                           |
| VAC7 VA air       | MAP                    | 49 → 60 with the pump stopped | 48 flat           | Rises only after resumption                            |
| C1 initiation     | lactate                | 3.1 → 1.8                     | 3.2 flat          | Falls only on paths C and D                            |
| IV off-sweep      | PaCO₂ before the trial | 44.4 → 60                     | 43 flat           | The trial response is unchanged in kind                |

**Preserved controls** (intended deterioration and responses that already worked):

- hemorrhage: MAP 54 → 46 untreated, 65 held once treated;
- tension pneumothorax: MAP 48 → 42, decompression drops CVP 18 → 8 and airway pressure 38 → 24;
- tamponade: MAP 46 → 40 untreated, decompression lifts it to 71;
- the VV air case still falls off support until resumed;
- the gas case still accumulates CO₂ (88 → 90) and recovers over modeled time after repair;
- a temporizing card still fades.

Identical A and C rows remain where the action genuinely has no modeled effect: VAC1, VAC2 and VAC3
pulse pressure and native output. That is stated on the surface where a key depends on it.

## Files changed, with reasons

All paths are under `src/features/cardiohelp-ecmo/` unless shown otherwise.

| File                                                                                                                    | Why                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/types.ts`                                                                                                       | Observation, ownership and anchor types. `observation` on records and history. `patientOwnership`, `sweepStoppedAt` and `pendingPersistentPatientFields` on the runtime. `modelBoundary` on reassessments. |
| `engine/simulation.ts`                                                                                                  | Field dynamics table, generic and fault targets, `resolvePatientTargets`, settle-at-load, post-oxygenator target, clock gating, interlock trim/restart on clock seconds only, sweep-stop init.             |
| `engine/reducer.ts`                                                                                                     | Wrapper: sweep-stop tracking, action-time recomputation, action observations. Landed patches held for their second. TICK/STEP stop at the reveal.                                                          |
| `engine/clinicalResponse.ts`                                                                                            | Marks non-temporizing patch fields as held levels.                                                                                                                                                         |
| `engine/counterfactual.ts`, `engine/index.ts`                                                                           | Deterministic untreated replay; export.                                                                                                                                                                    |
| `components/practice/debriefTimeline.ts` (new), `EcmoCaseDebrief.tsx`                                                   | Named comparison pairs, same-second grouping, the untreated line, "the response this case expects" with the model boundary.                                                                                |
| `components/PracticeCasePlayer.tsx`                                                                                     | Presentation label, modeled-time note, reassessment model boundary, checklist wording.                                                                                                                     |
| `components/practice/EcmoPracticeActivity.tsx` (+ module CSS)                                                           | Clock counts modeled seconds, says they are compressed, stops at the reveal, disables its controls there.                                                                                                  |
| `components/CircuitAndMonitors.tsx`                                                                                     | Heart-rate and work-of-breathing held notes; mode-true limb note; gas-restore reason.                                                                                                                      |
| `components/cardiohelp-ecmo.module.css`                                                                                 | Styles for the new notes and debrief blocks, at the module's type floor.                                                                                                                                   |
| `components/teaching/*` (8 panels)                                                                                      | S1-5, S3-2, S4-2/3/4, S5-1, S6-2, S14-1, S17-5, VA5-1 and VA17-3 boundaries and named pairs.                                                                                                               |
| `content/practiceSupport.ts`, `clinicalCases.ts`                                                                        | C1, C3 and VAC2 model boundaries. Recognition-only wording (IA-3). Vasoplegia speed-card response.                                                                                                         |
| `content/learnLessons.ts`, `drillSpecs.ts`, `foundationLessonRuntime.ts`, `foundationLearningItems.ts`, `scenarios.ts`  | S8-3, S11-2 and S17-5 copy. S3-3 category. The VA startup drill authors the values its stem quotes.                                                                                                        |
| `session/foundationSession.ts`                                                                                          | A restore never starts the Learn clock.                                                                                                                                                                    |
| `test-support/causalTrajectories.ts` (new), `scripts/cardiohelp-ecmo/dump-causal-trajectories.mts` (new)                | Portable matched-time harness (runs on both trees) and its JSON dump.                                                                                                                                      |
| `__tests__/ecmo-fellow-02-causality-and-time.test.ts` (new, 66), `__tests__/ecmo-fellow-02-surfaces.test.tsx` (new, 24) | Regressions: fail before, pass after.                                                                                                                                                                      |
| `__tests__/ecmo-fellow-01-recovery-and-state-truth.test.tsx`, `engine.reducer.test.ts`, `components.test.tsx`           | Existing tests updated (below).                                                                                                                                                                            |
| `docs/gap-remediation/fellow-feedback/ecmo/ECMO-FELLOW-02-*`                                                            | This handoff, the manifest and the trajectory comparison.                                                                                                                                                  |

No file outside ECMO changed. `learning-module/stage`, `AnswerVerdict.tsx`,
`ChoiceReasoningFeedback.tsx`, global chrome and other modules are untouched.

### Existing tests changed (for review)

None was weakened. Each keeps its invariant and is annotated in place.

- **Prompt-01 test D** (`ecmo-fellow-01…`, stop transition). The interlock now stops the pump at
  the speed request (t = 0), not one tick later. The protected transition is unchanged: stopped
  pump, last calculated pressure visible, the sentence saying so, then channels unavailable at the
  next update.
- **Prompt-01 test E** (explanation-only path). The old premise was that PaCO₂ had drifted after ten
  seconds. It now asserts the opposite, "no drift": PaCO₂ and the right arm are unchanged and the
  fault is still active.
- **`engine.reducer.test.ts`**: an added assertion that the pump is already stopped in the second
  the speed changed.
- **`components.test.tsx`**, three changes:
  - the checklist wording (IA-3);
  - "The response this case expects" replaces "Modeled response";
  - the safety alert is selected as the Now card, because the authored pH 7.18 now raises the
    monitor's acidemia alarm from 0 s. Before, the load step nudged it to 7.21 and hid it.

## Verification

### Commands

```bash
npx jest src/features/cardiohelp-ecmo
npx jest src/features/critical-care src/features/baxter-crrt src/features/mechanical-circulatory-support src/features/icu-simulation src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' 'src/app/\[locale\]/critical-care' src/app/api/analytics src/features/module-beta
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx eslint <changed ECMO paths> && npx prettier --check <changed paths> && git diff --check
npm run build
PORT=3181 npm run start
node verify-02.mjs 3181 repaired
```

`verify-02.mjs` is kept outside Git at
`Interventional-Pulm-Local-Data/renders/output/ecmo-fellow-02-2026-09-22/`, with every log,
results JSON and screenshot.

### Results

| Check                                           | Pre-merge head `1b128e2a`                         | Merged head (with `origin/main` `d98bab79`)                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECMO Jest                                       | 77 suites, **2,454 / 2,454 pass**                 | 77 suites, **2,454 / 2,454 pass**                                                                                                                                                                       |
| Consumer Jest                                   | 154 suites, 3 failures, identical to the baseline | 167 suites (the set now also covers `app/[locale]/cardiohelp-ecmo`, `app/[locale]/critical-care`, `app/api/analytics` and `module-beta`), 2,229 pass, **the same 3 failures**. None names an ECMO file. |
| `tsc --noEmit`                                  | exit 0                                            | exit 0 (8 GB heap; the default 4 GB heap ran out of memory once, before any type error was reported)                                                                                                    |
| ESLint, changed code (35 files)                 | —                                                 | exit 0                                                                                                                                                                                                  |
| Prettier, changed code and docs                 | —                                                 | clean (the new Markdown and JSON docs were formatted with `prettier --write`)                                                                                                                           |
| `git diff --check`                              | clean                                             | clean                                                                                                                                                                                                   |
| `npm run build` (full, including training apps) | exit 0                                            | exit 0                                                                                                                                                                                                  |
| Production-browser journeys (`verify-02.mjs`)   | **29 / 29**                                       | **29 / 29**                                                                                                                                                                                             |

**Exported helpers.** No existing export was removed, renamed or re-typed. The new exports are
additive:

- `observeSimulation`, `resolvePatientTargets` and the other target helpers;
- `replayWithoutAction`;
- `PRESENTATION_DATA_NOTE` and `MODELED_TIME_NOTE`.

Outside ECMO, the importers are the app routes, analytics, the critical-care progress adapters,
content and `module-beta`. The consumer run above covers each of them.

### Fail before, pass after

- The engine regression suite fails **42 of 66** on the baseline and passes 66 of 66.
- The surface suite fails **21 of 24** on the baseline (only the two new modules stubbed so it
  compiles) and passes 24 of 24.
- The three surface checks that pass on the baseline are ones whose premise already held there:
  keys unchanged, an action's readings never rewritten, and a learner-started Learn clock surviving
  a restore.
- The browser journeys pass **12 of 29** on the baseline build and **29 of 29** on the repaired
  build.

### Real Chromium against production builds

Headless Chromium drove the pages through rendered learner controls only: case cards, the speed
buttons, "Step 1 modeled second", "Show explanation without answering", clamp controls, "Restart
case", and the Learn phase controls. It used a fresh profile, no sign-in and unique ports.

Engine state was **read** (never written) from the committed React fiber tree, to set each visible
step beside the trace. An earlier driver read a DOM node's fiber pointer, which can be the stale
half of React's double buffer. That produced three false failures, and they were corrected in the
driver, not the app.

| Check                                                                                 | Baseline `9fbdbddc`                      | Repaired                                                   |
| ------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| C5-3 untreated SpO₂ holds over 10 modeled s                                           | FAIL 78.7 → 85.7                         | PASS 78 → 78                                               |
| C5-3 repositioning beats the matched no-action value                                  | FAIL 85.7 vs 85.7                        | PASS 85 vs 78                                              |
| C5-3 actions at 0 s leave the patient unchanged at the action                         | PASS                                     | PASS                                                       |
| C5-3 monitor shows the traced SpO₂                                                    | PASS                                     | PASS                                                       |
| VAC5-1 untreated right arm, pulse pressure, native output hold                        | FAIL 78.7→82, 26→18, 3.4→2.6             | PASS                                                       |
| VAC5-1 ventilation gain lands and persists                                            | FAIL 85.3 then 82                        | PASS 86, 86                                                |
| VAC2-1 pulse pressure stays at the authored value                                     | FAIL 8 → 18                              | PASS 6 → 6                                                 |
| VAC2-1 native output opens at the VA value                                            | FAIL 4.4                                 | PASS 2.4                                                   |
| VAC2-1 MAP still deteriorates untreated (story)                                       | PASS 45 → 40                             | PASS 46 → 40                                               |
| VAC2-1 heart rate says it is not modeled                                              | FAIL                                     | PASS                                                       |
| C2-1/S8-3 a speed change moves flow in the second it is made                          | FAIL 2.56 at t 0                         | PASS 2.76 at t 0                                           |
| C2-1 MAP change shown over its interval beside the untreated case                     | FAIL                                     | PASS "This run, 0 → 4 s … MAP 54 → 65"                     |
| C1-3 same-second actions grouped                                                      | FAIL                                     | PASS                                                       |
| Debrief: reading it changes only the phase (Prompt 01)                                | PASS                                     | PASS                                                       |
| Clock stopped at the reveal, controls off, no time passes                             | FAIL "8 s paused", step enabled          | PASS "stopped at the reveal", step disabled                |
| Clock counts modeled seconds / says they are compressed                               | FAIL / FAIL                              | PASS / PASS                                                |
| Brief data labelled as the presentation                                               | FAIL                                     | PASS                                                       |
| S17-4 capstone opens held                                                             | PASS                                     | PASS                                                       |
| S17-4 revealing the evolved state leaves the clock held                               | FAIL held = 0, t 28 → 31                 | PASS held, t 28 → 28                                       |
| VV and VA air: opening refuses, isolated + de-aired resumes, repeat inert (Prompt 01) | PASS / PASS                              | PASS / PASS                                                |
| Restart clears modeled time and recorded actions (Prompt 01)                          | PASS                                     | PASS                                                       |
| E8 the recorded action carries its before/after observation                           | FAIL                                     | PASS                                                       |
| C3-1 the model names its protective stop; the requested speed stays                   | FAIL (pump still running at the request) | PASS (stopped at t 0, rpm 3600 kept, "pressure interlock") |
| No page errors (hemorrhage, VV air, VA air journeys)                                  | PASS                                     | PASS                                                       |

The baseline build skipped the unrelated training-app prebuild (`build:training-apps`). The
detached baseline tree shares this worktree's `node_modules` through a symlink, and the navigation
app's Vite config could not resolve its own dependencies that way. The Next.js app, content build
and standalone preparation ran as normal. The repaired build ran the full `npm run build`.

## Prompt-01 preservation

Every Prompt-01 invariant named in the task was rechecked:

- **Air recovery on both tracks, idempotent resumption, restart:** Jest and the browser, on both
  trees.
- **Direct reducer bypass still guarded:** the Prompt-01 suite (all pass). The action-time
  recomputation runs after the reducer's own guards, so it can refuse nothing new and allow nothing
  new.
- **Learn bubble workflows:** unchanged. `RESET_BUBBLE` is deliberately not recomputed at action
  time, which keeps the Prompt-01 reducer contract.
- **Safety events visible:** the Prompt-01 label registry test passes. The C3-1 banner is present in
  the browser.
- **Debrief access alters nothing but the phase:** Jest and the browser. It now also stops the
  clock.
- **Requested speed not conflated with running:** the request stays at 3600 while the pump is
  stopped.
- **Unknown values stay unknown:** a stopped pump's channels stay unavailable, and missing trend
  values stay missing.
- **Recognition is not treatment:** strengthened by IA-3. A recognition-only fault never releases
  its anchors.
- **Authored transitions are not learner interventions:** timed faults are unchanged. S8-3 and S10-2
  steps are named as authored events.
- **Model limitations stay labelled:** extended. Heart rate, work of breathing, the limb note, and
  the C1, C3 and VAC2 boundaries.

**Behaviour change for the reviewer's attention.** The protective stop now occurs at the speed
request that crosses the limit. In the tension-pneumothorax case, clicking up from 3,200 stops the
pump at the 3,450 request with pVen −165 still shown. Before, it stopped on the next clock second
at whatever speed had been requested. A further speed request in that same second is a model update,
so the stopped-pump channels then read as unavailable. The stop explanation already says exactly
this: "values calculated before the stop can remain visible until the next model update". The
request is kept, and no device alarm is claimed. Whether this is the protective behaviour to teach
is ECMO-OWNER-03.

## Deliberately not changed

- **Physiology coefficients, generic targets, fault story targets, answer keys, drill timing and
  hazard thresholds.** The repairs change who owns a value and when it moves, never where the model
  says physiology goes.
- **The VV capstone's own sweep-0 target (64).** Performing the trial corrects and removes the
  compensated-hypercapnia fault, so the trial reaches the no-gas value instead. That is
  ECMO-OWNER-11's scope question.
- **The VA mixing marker** (VA11-1): no modeled variable to bind it to.
- **Advancing time inside transfer steps** (04), **S4-4 labels** (04), **hazard flags** for large
  or rapid CO₂ change (05 / ECMO-OWNER-09).
- **`RESET_BUBBLE` action-time recomputation** (Prompt-01 contract).
- **Layout, chrome, the collapsed monitor, question redesign** (03 / 04).

## Owner decisions (all NOT REVIEWED; none resolved here)

| Decision      | Where it arose in this batch                                                            |
| ------------- | --------------------------------------------------------------------------------------- |
| ECMO-OWNER-02 | S14-1: what the "delivered" gas label may claim                                         |
| ECMO-OWNER-03 | C3-1: protective stop and alarm at 3,600 rpm; now at the request that crosses the limit |
| ECMO-OWNER-04 | S4-2: patient and membrane saturation gap                                               |
| ECMO-OWNER-05 | VA5-1: arterial afterload in the VA model                                               |
| ECMO-OWNER-06 | VAC2-1, VAC1-1: tamponade native output, pulse pressure, heart rate                     |
| ECMO-OWNER-07 | VAC3-1, VA17-3: MAP response to flow under vasoplegia                                   |
| ECMO-OWNER-08 | C7/VAC7 air resumption abstraction (Prompt 01; unchanged)                               |
| ECMO-OWNER-09 | S4-3, C1-4, C6-1, IV-4: clinical pacing, compressed time, CO₂ correction rate           |
| ECMO-OWNER-10 | C1-1, C3-2, C4-1, C5-3, VAC5-1, VAC6-1, S8-3: unrepresented observed responses          |
| ECMO-OWNER-11 | IV-4, IA-3: integrated-case scope, the sweep-0 target                                   |
| ECMO-OWNER-12 | VA11-1: conceptual mixing visual                                                        |

A checked source, a passing test or this draft must not populate any human approval field.

## Items for independent review

1. **The ownership rule in `resolvePatientTargets`.** Check that each case's no-action path now
   moves only where its story says it should. The manifest lists every metric's owner at load and
   its four trajectories on both trees.
2. **The worse-of anchor.** It applies only when support is interrupted at load. Without it the
   VV air case lost its fall; applied always, the VV capstone climbed before its trial.
3. **Release on correction.** Directional anchors and presenting-story fields are handed back to
   the generic model. Recognition-only faults never release.
4. **The C3-1 timing change** above, and the Prompt-01 test D update.
5. **Contained rows.** Confirm that each stated boundary is visible where the key depends on it: C1,
   C3 and VAC2 reassessments; heart rate; work of breathing; S4-2, VA5-1 and VA17-3.
6. **The pH 7.18 acidemia alarm** in the VV initiation case (C1) now shows from 0 s: the authored
   value is no longer nudged to 7.21 by a load step.

## Environment limitations and NOT RUN

- No `.env.local` exists in this worktree, and none was created. Supabase-backed server code logs
  "URL and Key are required to create a Supabase client" in the production server log. The ECMO
  pages render without it, and no journey depended on it.
- The rendered baseline gate ran after the edits (on the detached baseline tree), not before them.
- The in-app browser pane was not used. All browser evidence is headless Chromium via
  `playwright-core`.
- **NOT RUN:** native browser zoom, touch devices and assistive technology; a real CARDIOHELP
  console; any learner observation; translation review; e2e suites of other modules; deployment.

## Independent software sanity review · September 22, 2026

This addendum records the review after the implementer handoff. The PR started at
`dfe2a3e531cb95450532f749b6c0525e8958f69d`. Current main at the initial fetch was
`bf613270a37a30cfd31a915a33758b808dfbff89`; the intervening main range changed only
Mechanical Ventilation paths. A true merge made `3573f5d5c074bf97b5e4328dfeb956f70c393953`.
The review did not rebase, merge the PR, deploy, or close an owner decision.

### Reproduced and corrected

- C1's simultaneous brief said MAP 70 while the t=0 monitor read the generic 72. The case now
  authors 70; the t=0 read and causal samples agree. The authored pH remains 7.18. Its t=0
  acidemia alarm follows the existing loaded-state alarm rule; the calculated bicarbonate is
  labeled at the bedside as arithmetic support, not an independently supplied laboratory result.
  The Practice brief now names the live simulator's t=0 and states when authored narrative values
  may differ from modeled inputs.
- A clinical debrief omitted console actions such as RPM changes unless an intervention card was
  also applied. The debrief now reads the ordered action history, joins intervention descriptions
  to their own action, names setting changes, and acknowledges external gas controls. History IDs
  remain unique after the 100-entry
  display cap. Same-second action observations stay immutable, including delegated rotary actions
  and an RPM action that also emits a protection system event.
- The debrief rounded PaCO₂ to whole mm Hg and could call a 0.1 mm Hg change “unchanged”. It now
  displays the model's one-decimal precision.
- VAC3's reassessment still said RPM escalation caused a more-negative pVen and chatter; the raw
  path gives flow 4.43 → 4.68 L/min at unchanged pVen −36 while MAP continues down. The
  distractor rationales and an at-question model boundary now describe that path. The keyed
  options remain unchanged.
- A persistent vasopressor MAP anchor masked a newly injected tamponade fault: MAP stayed at 65
  after the next tick. An intervention anchor now records the faults active when it landed. A
  later fault's existing MAP target can move the patient; after correction, the earlier held
  treatment level returns. This changes no fault target or response coefficient. It does not
  supply an unmodeled compound response when the later fault has no patient target for that field.
- Manifest samples had mixed conventions: 33 baseline cells took a pre-action reading at the
  listed second while repaired cells took a post-action reading. Both now use the last observed
  row at that modeled second; the separate `initialValue` remains the load reading. All 7,304
  sample cells across both trees match a fresh engine replay, as do the 61 complete path tables
  in each trajectory JSON branch. The manifest's narrative/owner fields remain hand annotations,
  so the traces are evidence of this model's behavior, not independent physiological validation.

The full 36-row disposition table above was checked against the ledger and original walkthrough
where source wording mattered. C2-1, C5-3 and VAC5-1 move from R to P: the live C2 flow/pVen
still differs from the presentation brief, C5's “falling” presentation remains flat untreated,
and VAC5's speed/flow path has no represented upper-body oxygenation response. The final audit is
**9 R, 14 P, 13 C, 0 not reproduced**. No coefficient, generic target, fault target, clinical
answer key or protection threshold was changed to improve a count.

### Independent matched-time probe

This table comes from direct calls to the shipped reducer on the reviewed tree. Actions were
taken at t=0. “Immediate” is the state after all listed actions at that unchanged second;
“untreated” is a separate run with clock steps only.

| Case / signal                                                     | Load | Untreated t=8 | Immediate after action | Treated t=8 |
| ----------------------------------------------------------------- | ---: | ------------: | ---------------------: | ----------: |
| C5 VV recirculation, SpO₂ · ultrasound then reposition            |   78 |            78 |                     78 |        83.6 |
| C6 VV gas loss, PaCO₂ · inspect, reconnect, sweep 4               |   88 |            90 |                     88 |        76.8 |
| VAC5 VA differential hypoxemia, right-arm SpO₂ · native-lung card |   78 |            78 |                     78 |          86 |
| VAC2 VA tamponade, MAP · echo then decompression                  |   46 |            40 |                     46 |          69 |
| C3 VV obstructive drainage, circuit flow · speed request 3450 rpm | 2.47 |          2.47 |                      0 |           0 |

At the C3 speed request the modeled pump stops at t=0 while the requested 3450 rpm remains set;
flow is 0, the computed stop-event pVen/pInt/pArt/Δp are −165/202/184/18 mm Hg, and the existing
`PVEN_STOP` alarm is present. At t=1 the stopped-pump pressure channels are unavailable and no
alarm persists. The learner banner calls this **this simulation's pressure interlock** and explains
that the last pressure is not a running-pump reading. Automatic trim/restart remains clock-gated.
No claim about actual CARDIOHELP stop timing or alarm design follows from this probe.

For the no-action paths, hemorrhage MAP and hemoglobin worsen; C3 MAP/CVP/airway-pressure story
targets worsen; VAC2 MAP worsens while pulse pressure stays narrow; VV air saturation falls;
gas-source-loss PaCO₂ rises; and VA membrane/air cases do not self-correct. A new relevant input
can move a case-authored anchor, a held treatment persists, and a temporizing patch fades. The
untreated replay shown to learners is explicitly labeled as the **same case left untreated from
the start**. It omits _all_ learner actions, so later groups are plan-level comparisons, not
counterfactuals that omit only the action in that group. The interval uses the last action's
after-state, the next action's before-state or frozen reveal state, and matching untreated times.

### Contained answer boundaries checked at the learner surface

| Source IDs            | Where the limitation appears while the answer is read                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S4-2, S4-3            | Section 4 comparison explains separate saturation formulas and no dissolved oxygen/PO₂ term; Section 4 and Practice label compressed modeled time.                  |
| S10-2, S10-3          | The membrane step calls its post-exchange state a teaching transition; its feedback explains the unmodeled exchange/hemolysis cost and never calls extra flow safe. |
| S14-1, C6-1           | The gas-source drill explains its one-second interruption, symmetric modeled recovery and schematic gas path.                                                       |
| VA5-1, VA11-1, VA17-3 | VA teaching names absent arterial afterload, a fixed conceptual mixing region, and the flow-to-MAP assumption with the vasoplegia exception.                        |
| C1-1, C3-2, VAC3-1    | Each Practice reassessment states the missing breathing, post-decompression MAP/HR, or vasoplegia flow/MAP/pVen/chatter response at the question.                   |
| C3-1                  | The console stop banner names the simulation's interlock and separates the speed request from pump running; later pressure loss is described.                       |

The inspected keys stay the same. `ECMO-OWNER-02` through `ECMO-OWNER-12` remain **NOT REVIEWED**
in `OWNER_DECISIONS.md`; this review makes no clinical or device decision for them. Prompt-01
VV/VA air recovery, refused premature/direct-bypass resumption, repeat-resume idempotence,
restart reset, unavailable stopped-pump channels, recognition-only treatment boundary and
reveal-phase behavior were rerun. The six changed old assertions were inspected: they replace
an intervention-only checklist requirement, a “modeled response” label, a hidden-load acidemia
assumption, delayed protective stop expectation and generic VA drift expectations with explicit
state and timing checks; none removes a recovery or safety assertion.

### Final independent verification

- The focused Prompt-02 engine and surface suites plus Prompt-01 regression suite: **3/3 suites,
  146/146 tests passed**. All ECMO Jest suites: **77/77 suites, 2,467/2,467 tests passed**.
- TypeScript, changed engine ESLint, Prettier and `git diff --check` passed. The full production
  build completed through Next.js static generation and standalone output preparation.
- The 26 relevant consumer suites: **23 passed, 3 failed; 342 tests passed, 3 failed**. The
  failures are Critical Care accessibility, learner copy and CRRT station order, identical to the
  detached current-main run. No ECMO or shared-learning consumer test failed.
- Chromium journeys through production learner controls: **29/29 primary** and **10/10 extra**
  checks passed. They cover C5, VAC5, VAC2, C3, the C2 debrief, same-second actions, untreated
  labels, C1 opening provenance, late sweep stop, held Learn preview, VV/VA air recovery, restart
  and frozen reveal. No ECMO page exception was observed. The absent protected `.env.local`
  produces Supabase URL/key errors in the server log, as it does on the baseline, but none of
  these ECMO journeys requires that service.
- Rebuilding the raw trajectory generator after the secondary-fault repair gave byte-identical
  output for all **16 cases and 61 paths**; the new compound-fault test is outside those authored
  single-fault plans. The manifest's **7,304** sampled cells and all full path rows were checked
  against fresh reducer traces on both the baseline and repaired trees.

The final fetch still found `origin/main` at `bf613270a37a30cfd31a915a33758b808dfbff89`,
which is an ancestor of the review merge `3573f5d5c074bf97b5e4328dfeb956f70c393953`.
