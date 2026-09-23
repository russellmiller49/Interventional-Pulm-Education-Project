# MV-PRE-REVIEW-02 — initialization, causality and gas exchange

Batch 02 of the Mechanical Ventilation pre-owner-review pack
(`Interventional-Pulm-Local-Data/module_update_9_19/MV_Claude_Implementation_Pack/02_MV_INITIALIZATION_CAUSALITY_AND_GAS_EXCHANGE.md`),
read with `COMMON_CONTRACT.md`, the assigned rows of `FEEDBACK_LEDGER.md`, `SOURCE_AND_CODE_NOTES.md`,
`SOURCE_EVIDENCE_TABLES.md`, `CROSS_MODULE_COORDINATION.md` and the merged
`MV-PRE-REVIEW-01-handoff.md`. Prepared 2026-09-22 by an AI authoring assistant (Claude) at the
owner's request.

**Nothing here is clinical, device, media, source or release approval.** Every modeled response
this batch touched is a model statement; every owner decision it names is `NOT REVIEWED`. The
companion `MV-PRE-REVIEW-02-causal-matrix.md` has one row per relationship with its classification.

## Delivery and scope

- **Base.** `origin/main` fetched at `bf613270a37a30cfd31a915a33758b808dfbff89` (merge of PR #259), the
  SHA the task expected. Unmoved at the start of the work.
- **Checkout.** New worktree `…/Interventional-Pulm-Education-Worktrees/claude-mechanical-vent-02-9-22`,
  new branch `claude/mechanical-vent-02-9-22` from that SHA. The Batch-01 worktree and branch were not
  touched. No branch was reset, rebased or force-pushed.
- **Module-local.** Every runtime, content and test change is under `src/features/mechanical-ventilation`,
  plus one new harness script (`scripts/critical-care/mv-causal-inventory.ts`, no package.json entry)
  and these documents. No shared stage, shared `AnswerVerdict`, critical-care registry, progress
  store, other clinical engine, device-intelligence, backend, dependency or deployment change.
- **Untouched by instruction:** alarm thresholds and configured limits, the device facsimiles,
  answer keys, sources, review fields, `content/source-cases.v1.json` (hash-pinned, byte-identical),
  and the live exclusion of clinical case MV-03 (it still renders only the held worked explanation;
  its paired-breath/initialization hold is not cleared).
- **Environment.** No `.env.local` was created, modified or deleted. The dev and production servers
  for browser checks read the primary checkout's existing configuration into their own process
  environment only. A read-only detached worktree at `bf613270` was created in the session
  scratchpad to reproduce baseline failures and generate the "before" inventory, and removed
  afterwards.

### Heads

|                                         | SHA / reference                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Base (`origin/main` at start and end)   | `bf613270a37a30cfd31a915a33758b808dfbff89`                                                |
| Engine, content and test changes        | `470a35dd`                                                                                |
| Handoff, matrix, inventory, final fixes | `54bb7c5f` (the head every check in §11–12 was run against)                               |
| Heads recorded; independently reviewed  | `dea2738a` — Codex sanity review: NOT READY TO MERGE, five findings                       |
| Sanity-repair pass                      | see §15 (every check in §15 was run against it)                                           |
| Re-review repair pass                   | see §16                                                                                   |
| Final-gate repair (alarm history)       | see §17                                                                                   |
| Pull request                            | [#271](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/271) |

`git merge-tree --write-tree origin/main HEAD` is clean; `origin/main` did not move during the work.

## 1. The causal inventory

`src/features/mechanical-ventilation/test-support/causalInventory.ts` replays a case through the real
reducer exactly as the Practice page drives it (un-pause, speed, 0.1 s wall ticks × speed), applies
each arm's actions at fixed **model** times, and snapshots at fixed model times. Each snapshot
carries settings, branch and airway flags, effective mechanics, exhaled VT **with its source**
(completed inflation on the trace vs analytic prediction), rate, peak (and source), plateau
estimate and acquisition status, intrinsic PEEP, minute ventilation, trigger-evidence status, the
live gas state, **every sampled ABG separately** (pending specimens show no values), SpO₂, MAP/BP/HR,
symptom scores, RASS, `canCommunicate`, report availability, active alarms, the configured high
pressure limit, risk, critical errors and the action log.

- **Cases:** all 14 live cases (MV-01, 02, 04–15), every authored branch — **22 branches**. MV-03 is
  excluded by construction (`HELD_CASE_IDS`).
- **Timepoints:** 0, 30, 60, 150, 180 s, plus the time of the first completed inflation inside the
  case. Evidence tables: `MV-PRE-REVIEW-02-inventory/before.md` (base engine, same harness) and
  `after.md` (head), regenerated with `npx tsx scripts/critical-care/mv-causal-inventory.ts`.
- **Arms:** no action and assessment-only (assess + review waveforms at 12 s) for every branch; for
  the priority cases, from the same start state at 12 s:

| Case               | Appropriate authored action                                            | Ineffective / harmful       | Other arms                   |
| ------------------ | ---------------------------------------------------------------------- | --------------------------- | ---------------------------- |
| MV-01              | PEEP 5 → 10                                                            | PEEP 5 → 16                 | PEEP 5 → 13; FiO₂ → 100 only |
| MV-02              | flow 40 → 70 + treat drive                                             | treat drive only            | —                            |
| MV-05 (3 branches) | PS 18 → 12 + ETS 25 → 40 + expiratory hold                             | PS 18 → 24                  | PS 12 only; ETS 40 only      |
| MV-06              | disconnect/bag + bronchodilator + rate 10 + flow 80                    | rate 24 → 30                | —                            |
| MV-08 (3 branches) | inspect + branch-specific fix (drain / correct leak / trigger 2 L/min) | —                           | —                            |
| MV-12              | PS 22 → 11 + reduce sedation                                           | reduce sedation only        | PS 11 only                   |
| MV-13 (3 branches) | inspect + the treatment that reaches that branch                       | the treatment that does not | —                            |
| MV-14 (2 branches) | decompress + pleural drainage (recovery path)                          | disconnect/bag only         | —                            |
| MV-15              | board + treat pain + relieve bladder + PS 11 + ramp 100                | deepen sedation             | —                            |

MV-04, 07, 09, 10, 11 are controls (no action, assessment only). **Branch coverage is the 22
branches listed in the inventory files**, on the Hamilton C6 profile; the other three consoles were
exercised for initialization equality, MV-12's opening readouts and MV-13's alarm logic only.

**Scheduling.** 1×, 5× and 30× produce identical snapshots at every sampled model time — on base
and head, for MV-01/05/06/13/14 no-action and (head, in the regression suite) MV-14 decompression
and MV-05 PS change. The reducer hands the engine the same 0.02 s steps whatever the speed. Hidden-tab
`requestAnimationFrame`/interval suspension is a browser schedule, not physiology, and is not
exercised by the replay.

## 2. Reproduced on the base first

Engine replays at identical model time (full tables in the inventory files):

| Case · branch  | Base, no action, 0 → 180 s                                                               | Head, no action, 0 → 180 s                                       |
| -------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| MV-01          | SpO₂ 84 → 94, PaO₂ 54 → 76, SPO2_LOW **cleared**, BP 108/62 → 116/58, HR 112 → 115       | SpO₂ 84 → 84, PaO₂ 54 → 54, SPO2_LOW held, BP 108/62, HR 112     |
| MV-02          | dyspnea 6.0 → 2.5 (case success "dyspnea ≤ 4" met by waiting)                            | 6.0 → 6.0                                                        |
| MV-05          | VTE **1400\*** at open → 229; PaCO₂ 62 → 92 (pH 7.33 → 7.04); dyspnea 3 → 8.4            | VTE 229 at open (a delivered breath); PaCO₂ 62 → 62; dyspnea 3.0 |
| MV-06          | MAP 48 → 25, HR 142 → 176, SpO₂ 94 → 98                                                  | MAP 48 → 42 (obstructive-shock ceiling), HR 147, SpO₂ 94         |
| MV-07          | VTE 415\* → 176; PaCO₂ 48 → 87; SpO₂ 96 → 85                                             | VTE 176 at open; PaCO₂ 48; SpO₂ 96                               |
| MV-08 (all 3)  | SpO₂ 98 → 86, PaO₂ 110 → 52; PaCO₂ 29 → 23                                               | SpO₂ 98, PaO₂ 110, PaCO₂ 29                                      |
| MV-12          | VTE **1021\*** → 643; PaCO₂ 28 → 41 (success "PaCO₂ 35–50" met by waiting); SpO₂ 97 → 86 | VTE 643 at open; PaCO₂ 28; SpO₂ 97                               |
| MV-13 (all 3)  | SpO₂ 88 → 94 beside PaO₂ 83 → 73                                                         | SpO₂ 88, PaO₂ 56                                                 |
| MV-14 unstable | SpO₂ 76 → 97 (PaO₂ 76 → 99), HR 138 → 159                                                | SpO₂ 76 (PaO₂ 41), HR 139, MAP 43 → 42                           |
| MV-14 stable   | MAP 67 → 42, SpO₂ 76 → 97                                                                | MAP 67 → 42 (authored obstructive shock), SpO₂ 76                |
| MV-15          | dyspnea 8.0 → 6.1, SpO₂ 94 → 91                                                          | 8.0 → 8.0, SpO₂ 94                                               |

`*` = the analytic prediction printed as an exhaled volume.

Also reproduced on base: the 4 s priming ended mid-cycle and the rewound clock restarted the
breath schedule, so the last prepared expiration was cut short in 13/14 cases (MV-10 lasted
0.02 s of 1.0; MV-13 0.54 of 2.55; MV-06 0.9 of 1.9 with flow still −22 L/min); every opening alarm
was stamped `startedAt 4` in a case at t = 0; MV-05's first step turned the authored pH 7.33 into
7.21; MV-14 opened with SpO₂ 76 % beside PaO₂ 76 mmHg; PEEP 13 read compliance 25 between 32 (12)
and 18 (14); MV-05's authored correction (PS 12 + ETS 40) delivered **1–2 mL** breaths; deep
sedation left `canCommunicate` true; MV-13 showed no alarm with limit 60 and peak 42–44; Section 13
sorted an empty list; Section 10 listed a dead-space fraction and VCO₂ the model never reads.

## 3. Root causes

1. **Two observation epochs at case open (C4).** `createInitialSimulationState` advanced 4 s from
   t = 0, then set the clock back to 0 and shifted the samples. Every periodic signal is a function
   of absolute time, so the schedule restarted at zero while the buffer still held the old one.
   Four seconds also held no completed inflation with its onset for the slow cases, so
   `observedTidalVolumeMl` was undefined and `deriveMeasurements` fell back to the equilibrium
   prediction (clamped at 1400 mL). Alarms were reconciled on the primed patient at t = 4.
2. **A CO₂ anchor that compared two different minute ventilations (C1/C5).** The target was
   `authored PaCO₂ × baselineMV / currentMV`, but `baselineMinuteVentilation` was computed from the
   initial settings at pressure equilibrium times the _neural_ rate while `currentMV` is the trace's
   delivered volume times the delivered rate — the exact mismatch the engine's own
   `observedTidalVolumeMl` comment describes for VT. At the authored settings the ratio was 24:1 on
   MV-05.
3. **Absolute targets that ignored the presentation (C1).** The oxygenation target is a generic
   FiO₂/PEEP/shunt formula; at the authored inputs it put an 8 %-shunt patient on FiO₂ 0.3 at PaO₂ 50
   (MV-08 desaturated) and a tension pneumothorax on FiO₂ 0.6/PEEP 12 at PaO₂ 100 (MV-14 improved).
   Heart rate, dyspnea and the MAP loads likewise re-applied the authored state as an increment on
   top of itself. Systolic/diastolic were rebuilt from MAP with fixed ratios.
4. **Gas fallbacks off the engine's own equations (C5).** A missing HCO₃⁻ defaulted to 24 beside a
   supplied pH and PaCO₂; a missing PaO₂ came from `30 + 0.6·SpO₂`, which crosses the engine's
   saturation curve nowhere useful.
5. **An unmapped PEEP (S9-2).** `8 ≤ PEEP ≤ 12` and `PEEP ≥ 14`; 13 fell through to the PEEP-5 lung.
6. **Breath-clock re-gridding (found by the MV-05 appropriate-action arm).** On pressure support the
   delivered rate is recomputed from the missed-effort fraction, which depends on the trapped
   pressure the last breath left; `time mod (60/rate)` re-gridded instantly on every change, cutting
   one-sample breaths that shortened the measured expiratory time, raised modeled auto-PEEP and
   changed the rate again.
7. **Reportability routes (C6).** Deep sedation (RASS −5) and paralysis did not remove the ability to
   answer; Practice printed dyspnea before anyone asked; Section 13 and coaching said "reported".
8. **Displayed descriptors presented as model drivers (S10-1)** and **a sorting panel bound to a
   patient with nothing to sort (S13-1).**

## 4. What changed

### The case-open equilibrium contract (`PhysiologyReference`, `engine/types.ts`)

A case's presentation is the state it is authored to be in _at the settings it opens with_. The
slow relationships keep their coefficients and act only on **changes** from the case-open inputs:

- PaCO₂ target = authored PaCO₂ × anchor MV ÷ delivered MV, where the anchor is the harmonic mean of
  the delivered MV over the second half of the prepared history (breath-to-breath variation on
  MV-07/09 made a single instant the wrong anchor).
- PaO₂ target = authored PaO₂ + (oxygenation relationship now − at open); SpO₂ = authored SpO₂ +
  (curve at PaO₂ now − curve at authored PaO₂). The engine's curve has no Bohr shift, so supplied
  pairs up to 3 points off it are kept as supplied.
- MAP = authored MAP − (circulatory load now − at open); HR = authored HR + (load now − at open);
  dyspnea = authored + (burden now − at open). BP keeps its authored shape and scales with MAP.
- **Kept absolute** because they are authored fault states, not generic terms: the obstructive-shock
  ceiling (42), case-resolution floors and relief, and the existing deep-sedation dyspnea bound
  (`RASS ≤ −4`, now the named constant `DEEP_SEDATION_RASS` — not a new threshold).

Consequence, stated plainly: untreated patients no longer drift for reasons the case does not
contain, and a response is attributable. Evolution that the model _does_ represent still happens
untreated (MV-06 and MV-14-stable fall to the obstructive-shock ceiling). Deterioration that no
relationship represents (MV-08's worsening alkalosis, MV-14's falling saturation, progression of
MV-06 below the ceiling) does not appear, and is an owner decision (§7) rather than something added.

### Prepared mechanical history (`createInitialSimulationState`)

Sixty seconds of the case's own settings on the case's own lung, run at **negative time** and never
rewound (`positiveModulo` keeps every periodic signal continuous through zero); the buffer keeps the
last 12 s, snapped to the 50 Hz grid; `isPreparedHistorySample` (t ≤ 0) names them. Slow physiology,
risk, trends, alarm history, actions, holds and `lastResponse` are discarded; alarms are evaluated on
the presented patient at t = 0. The Learn lab's own warm-up re-opens its alarm epoch the same way
(`reopenAlarmEpoch`). Cost: ~12 ms per case open.

### `BreathClock` (`engine/types.ts`, `advanceBreathClock`)

_Revised in the sanity-repair pass (§15.1)._ The clock holds the cycle in progress and the onset
that will end it. No setting change moves that onset; a new rate becomes authoritative at it — a new
schedule anchored at that breath — or, when the requested rate is the patient's own rhythm, the
schedule rejoins the neural effort grid at the first effort after that breath has finished inspiring
(which is what keeps a patient-triggered breath aligned with the effort, MV-07). Constant-rate
schedules are the absolute grid and bit-identical to base. The first version kept an absolute grid
and recomputed it from the newest period, which let repeated changes postpone the next breath.

### Gas provenance (`presentingGas` in `runtimeCases.ts`; `engine/arterialGas.ts`)

Missing HCO₃⁻ from the supplied pH and PaCO₂; missing PaO₂ from the supplied SpO₂ on the engine's
curve; each value tagged `case-source` / `derived` / `model-default`; the baseline specimen carries
it; labels say "Starting gas set by the simulator — this case supplies no presenting blood gas"
(MV-04, 09, 10, 11, 13, 14, 15) or "…completed by the simulator" (MV-05, 06, 07, 08, 12), with a line
naming what was derived and from what. The authored casebook file is unchanged.

### Readiness, reportability and teaching surfaces

- `measurements.exhaledVtSource`; `content/measurementReadiness.ts`; consoles print `---`, panels
  "Awaiting a completed breath", `VT_LOW` and the coaching VT reading require an exhaled breath.
- Deep sedation and neuromuscular blockade set `canCommunicate` false, decided from the whole
  effect set so a communication board cannot restore it (`patientCanCommunicate`, §15.2). Practice
  bedside: dyspnea
  gated on assessment like pain and delirium, labelled "Patient report · modeled" or "Internal index ·
  not a patient report"; pain labelled likewise; the consciousness boundary printed beside them.
  Section 13 and the dyssynchrony panel follow the same contract; coaching dyspnea/pain readings are
  null when the patient cannot report.
- PEEP lung state `ardsLungStateForPeep` (8 ≤ PEEP < 14 recruited, 13 held as containment); case
  resolution reads the separate authored range `ardsPeepInAuthoredSuccessRange` (8–12) (§15.3).
- Section 9: time-control sentence computed from the arms (`peepComparisonTimeControl`); live panel
  names its trend window and says "not yet trended" without one. Section 10: the model stated
  (`data-co2-model`), descriptors named as unused. Section 13: MV-14's real opening alarms as a
  labelled separate reference when the live patient has none (`content/referenceAlarmSet.ts`).
- Practice: MV-13's stem mismatch stated beside it, read from the live console (§15.5); MV-06/12/13/14
  explanation notes where the authored expected response claims what the model does not do, and on
  MV-13/MV-14 the same boundary on the action feedback and the coaching card (§15.4)
  (`content/caseModelNotes.ts`).

## 5. Repair versus containment

See the matrix (22 rows). Summary by assigned ID:

| ID                 | Outcome                                                                                                                                                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1**             | **Physiology corrected** for the causes demonstrated (epoch, CO₂ anchor, absolute targets, BP shape, breath clock). **Contained** where the case claims responses no relationship represents (MV-06 MAP relief, MV-12 CO₂ with sedation change, MV-13/14 oxygenation). **Open**: which cases evolve untreated and how (D1). |
| **C3**             | **Contained**; limit, thresholds and delivery untouched; mismatch stated beside the stem on all consoles; **open** D4.                                                                                                                                                                                                      |
| **C4**             | **Physiology corrected** (epoch) and **observation labeling corrected** (readiness).                                                                                                                                                                                                                                        |
| **C5 (numerical)** | **Physiology corrected** (tuple coherence under the engine's own equations) and **observation labeling corrected** (provenance). **Open** D2: the intended gases for the seven cases without one, and the derived values.                                                                                                   |
| **C6**             | **Observation labeling corrected** (reportability routes and surfaces); **contained** (consciousness boundary); **open** D2.                                                                                                                                                                                                |
| **S9-1**           | **Corrected** (flat control arm; sentence and window computed from what ran).                                                                                                                                                                                                                                               |
| **S9-2**           | **Contained with explicit bounded behaviour**; **open** D3.                                                                                                                                                                                                                                                                 |
| **S10-1**          | **Path B**: explanation aligned with the model that runs; **open** option C (D2).                                                                                                                                                                                                                                           |
| **S13-1**          | **Observation labeling corrected**: a real, labelled reference alarm set; nothing added to the live patient.                                                                                                                                                                                                                |

Batch-01 coordination items (S2-1, S4-1, S7-5, C9) were not reopened; see §9.

## 6. Matched-time evidence (head)

At 180 s, arm vs no-action from the same start state (exhaled VT · peak/plateau estimate · PEEPi ·
SpO₂ · PaCO₂ · MAP · dyspnea; `†` = index, not a report). Base values for every arm are in
`MV-PRE-REVIEW-02-inventory/`.

| Case             | Arm                                      | Arm @180                                           | No action @180                              |
| ---------------- | ---------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| MV-01            | PEEP 10                                  | 422 · 26.3/15.3 · 0.1 · **92** · 52 · 77 · 1.0     | 422 · 24.9/13.9 · 0 · 84 · 52 · 77 · 3.0    |
| MV-01            | PEEP 13                                  | 422 · 29.3/18.3 · 0.1 · 92 · 52 · 77 · 3.0         | same control                                |
| MV-01            | PEEP 16                                  | 422 · 42.4/31.4 · 0 · 91 · 52 · **60** · 3.0       | same control                                |
| MV-01            | FiO₂ 100                                 | 422 · 24.9/13.9 · 0 · 96 · 52 · 77 · 3.0           | same control                                |
| MV-02            | flow 70 + treat drive                    | 397 · 23.8/5.5 · 1.1 · 94 · 30 · 73 · **5.0**      | 387 · 17.4/6.2 · 1 · 94 · 30 · 73 · 6.0     |
| MV-05            | PS 12 + ETS 40 (+ hold)                  | **415** · 17/14.9 · **4.7** · 92 · 38 · 97 · 0.4   | 229 · 23/13.3 · 13.5 · 92 · 62 · 88 · 3.0   |
| MV-05            | PS 24 (harmful)                          | 347 · 29/17.4 · **16.2** · 92 · 49 · **82** · 4.3  | same control                                |
| MV-06            | bag + bronchodilator + rate 10 + flow 80 | 507 · 62.2/12 · **7.5** · 94 · 86 · 42 · 3.9       | 500 · 70.2/39.3 · 33.9 · 94 · 85 · 42 · 3.0 |
| MV-06            | rate 30 (harmful)                        | 500 · 80/49.2 · 42.2 · 94 · 75 · **25** · 3.0      | same control                                |
| MV-08 condensate | inspect + drain                          | 433 · 14.8/11.2 · 0 · 98 · **43** · 90 · 0.0       | 235 · 14.9/11.1 · 0.4 · 98 · 29 · 90 · 3.0  |
| MV-12            | PS 11 only                               | 506 · 16/9.2 · 0 · 97 · 33 · 82 · 0.0              | 643 · 26.9/17.5 · 0 · 97 · 28 · 82 · 3.0    |
| MV-13 secretions | inspect + suction                        | 460 · **22.7**/8.7 · 0.2 · 88 · 43 · 95 · 1.0      | 461 · 43.7/10.6 · 2.1 · 88 · 43 · 95 · 3.0  |
| MV-13 secretions | bronchodilator (wrong branch)            | identical to control                               | —                                           |
| MV-14 unstable   | decompress + drainage                    | 420 · **28.2/16.2** · 0.1 · 76 · 42 · **68** · 1.0 | 420 · 58/46 · 0 · 76 · 42 · 42 · 3.0        |
| MV-15            | ask and treat                            | 448 · 16/7.5 · 0.8 · 94 · 39 · 103 · **3.6**       | 392 · 12.9/7.4 · 0.7 · 94 · 42 · 103 · 8.0  |
| MV-15            | deepen sedation                          | 143 · 12.7/9.8 · 0 · 94 · **76** · 103 · 2.1†      | same control                                |

On base, the MV-01 control rose to SpO₂ 94 and MV-14's to 97 — the "response" to PEEP and to
decompression was mostly waiting — and MV-05's appropriate correction delivered 1 mL breaths while
PaCO₂ climbed to 92 in both arms.

## 6a. Initialization — opening values, head

Every live case opens on a delivered breath: MV-04 657, MV-05 229, MV-07 176, MV-12 643 mL (base:
512, 1400, 415, 1021 — all the prediction). Opening alarms now include VT low on MV-05, MV-07 and
MV-09 because their **delivered** breaths are under the engine's existing 250 mL rule; on base the
same alarm appeared within the first minute. Changing the display device re-opens the case; where
the device adaptation leaves the settings identical the patient, measurements and waveforms are
identical across the four consoles (asserted), and where it does not (rise-time bounds on the PS
cases, documented in each case's adaptation notes) the difference is a different ventilator setting,
not a different patient. Restart produces a state equal to a fresh open (asserted).

## 7. Owner and model decisions still open

All `NOT REVIEWED`. Numbered by the pack's groups.

1. **D1 — which cases evolve untreated, and how.** The model now holds each presentation unless a
   represented input changes. Specify, per case, any intended ongoing process and its rate: MV-06
   (progression below the obstructive ceiling; base fell to MAP 25 by double-counting trapping),
   MV-08 (casebook: "Respiratory alkalosis stops worsening" implies it worsens untreated), MV-14
   (casebook: "SpO₂ falls", "Hypotension progresses rapidly"), MV-13 (post-event trajectory).
2. **D1/D2 — fault-linked oxygenation.** MV-14 decompression and MV-13's matching treatment restore
   mechanics but not saturation, because no relationship links the fault to oxygenation. Specify the
   O₂ effect each fault carries (e.g. a fault shunt) and what correction restores.
3. **D1 — MV-06 decompression response.** The authored rescue (MAP ≥ 72 after disconnection) is
   unreachable behind the obstructive ceiling; making it reachable as written would be permanent,
   against the casebook's "transiently". Specify magnitude and duration.
4. **D2 — CO₂ model.** Anchored `PaCO₂ ∝ 1/VE`, no chemoreflex; delivered MV at presentation is
   implausibly low on some PS cases (MV-05 1.9, MV-07 1.7 L/min), so relative responses are large
   (MV-05 correction 62 → 39–45 mmHg in 3 min; MV-07 trigger fix 48 → 31). If VCO₂ and dead space
   should drive CO₂ (S10-1 option C), specify fixed-volume vs fractional dead space and VCO₂ per case.
5. **D2 — presenting gases.** Confirm or replace the derived HCO₃⁻ (MV-05 31.6, MV-06 26.7, MV-07 26.2,
   MV-08 22.4, MV-12 21.6) and supply gases for MV-04, 09, 10, 11, 13, 14, 15. No compensation,
   temperature correction, co-oximetry or metabolic process was inferred.
6. **D2 — reportability and consciousness.** Whether shock, hypoxemia or delirium should remove the
   ability to answer, and whether RASS should be reassessed by the model at all.
7. **D3 — PEEP 13.** Hold the recruited state (current bounded behaviour), begin overdistension, or
   author its own state. Also: PEEP 6–7 are unrecruited though the hidden curve says "5-12 improves",
   and the generic PEEP term drops from 24 to 20 above 12 in every case.
8. **D4 — MV-13 / Section 13 alarms.** Which profile, limit and delivery behaviour at the pressure
   limit are intended; whether the live case should open alarming. Held together with MV-SAFETY-01's
   alarm-limit item.
9. **D5 — trigger model.** See §8.

## 8. D5 carry-forward — trigger evidence

Inspected on the new engine: over 60 s per live case, checked every 0.1 s, trigger evidence is only
`model-estimate` or `not-applicable`, never `measured`, and no inspiration onset in the buffer is
preceded by appreciable modeled effort (regression-tested). The reason is structural. `effortAt` is
a neural oscillator on the absolute grid `time mod (60/neural rate)`; on pressure support the
machine's breaths are a _separate_ grid at `neural rate × (1 − missed fraction)`, so when every effort
is captured the two grids coincide and the effort begins on the same sample as the breath; when
efforts are missed the grids beat against each other. `triggerDelayMs` is a phenotype parameter
(`80 + 400·missed` for weak trigger; `100 + 450·missed` for COPD), not a consequence of anything on
the trace. Batch 01's labelling is therefore still the honest one and was not touched.

**Correction (sanity-repair pass §15.6, re-corrected in §16.3).** That inspection ran with no action.
A census of every inventory arm found `measured` on MV-05's pressure-support and cycling arms at
grid coincidences (54 onsets at `dea2738a`). §15.6 then called those labels "an interval between two
events on the trace"; that was also wrong. The number printed beside `measured` was always
`measurements.triggerDelayMs`, the phenotype's assigned delay, and the re-review timed the events it
fell on at 40–360 ms against a printed 264–315 ms. `measured` has been removed (§16.3): every live
trigger delay is now a model estimate, not applicable or unavailable, and no live value is a
measurement.

What a model would need before `measured` could be reachable: breath onset determined by the effort
(onset = the time Pmus, net of trapped-gas threshold load, crosses the configured flow or pressure
trigger, plus a device response latency); missed efforts as efforts that never cross it; the
delivered rate an output of that, not an input. That would also remove the grid-beating that the
`BreathClock` fix only tames. It is a trigger-physiology redesign and is left for D5.

## 9. Batch-01 contracts preserved

- **Plateau acquisition** (estimate vs acquired identity, the six states, `supportsMechanicsClaim`,
  frozen display, latched condition changes): unchanged code; all 70 Batch-01 regression tests pass.
- **ABG specimens**: baseline is still supplied history (now with provenance), repeats immutable, per
  specimen availability, earlier results kept. Two Batch-01 tests used untreated drift as the way to
  make the live gas differ from a specimen; they now move it by a real action (FiO₂ 100; trigger
  1.5 L/min) and assert the same contract.
- **Post-action evidence**: unchanged. The one coaching test that asserted the "moved on its own
  trajectory" copy after a hold now gets the "nothing about the patient changed" copy, because
  nothing drifts.
- **Trigger evidence**: §8. **MV-03**: excluded. **Stores**: `physiologyReference` and `breathClock`
  live only on the in-memory simulation state; the lab checkpoint stores events, not state, and the
  self-paced and legacy stores are untouched (existing storage-preservation tests pass).

## 10. Tests

**New:** `__tests__/mv-pre-review-02-causality.test.tsx` — 126 tests: opening breath, whole prepared
expiration, alarm epoch and authored presentation for all 22 branches; restart and device change;
console dashes and no `VT_LOW` on a predicted volume; 180 s no-action stability for all 22 branches;
matched-time attribution for MV-01, 05, 07, 08, 13, 14, 15; scheduling invariance (3 arms × 3 speeds);
gas coherence for all 14 cases; provenance; CO₂ proportionality; PEEP 13; the computed Section 9
sentence and window; Section 10; MV-13 on 4 consoles × 3 branches; Section 13 reference vs live;
reportability; D5.

**Assertions that fail on the unmodified base for the defect.** A 21-assertion check written only
with symbols that exist on `bf613270` was run in the base worktree: **20 failed, 1 passed** (the
passing one is the guard that no high-pressure alarm is injected on MV-13), and all 21 pass on the
head. The failing 20: MV-05 and MV-12 open on a completed breath; opening alarms start at 0; MV-13's
last prepared expiration is whole; untreated SpO₂ holds on MV-14, MV-08, MV-01; untreated PaCO₂ holds
on MV-05, MV-12; untreated dyspnea holds on MV-02, MV-15; MV-01's BP keeps its shape; MV-05's
authored correction delivers real breaths; MV-05's tuple is coherent; MV-14's PaO₂ is on the curve;
MV-14's baseline is not called supplied; PEEP 13 keeps the recruited compliance; deep sedation
removes the report; Section 13 does not sort an empty list; Section 10's delivery tier does not list
the dead-space fraction.

**Changed test contracts** (each asserted the defect):

- `physics-waveforms` — "changes waveforms immediately": exhaled VT changed on the key press only
  because MV-12 opened on the prediction; it now changes on the next delivered breath.
- `peep-comparison` — "retains improvement while waiting" → the wait-only arm stays within 0.5 %;
  "intermediate reversal" `[…32, 25, 18…]` → `[…32, 32, 18…]`.
- `peep-comparison.rendered` — the time-control paragraph instead of "Oxygenation also rises while
  waiting".
- `post-action-coaching` — the held-reading copy after a hold.
- `mv-pre-review-01-evidence` ×2, `mv-pre-review-01-sanity-repairs` ×1 — see §9.

## 11. Commands (head unless marked; node 26.5.0; `NODE_OPTIONS=--max-old-space-size=8192`)

| Command                                                                                                                    | Result                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/mechanical-ventilation` (base `bf613270`)                                                           | 38 suites, 828 tests, all passing                                                                                                                                                                                                                                 |
| `npx jest src/features/mechanical-ventilation`                                                                             | 39 suites, **954 tests, all passing**                                                                                                                                                                                                                             |
| consumer suites: MV routes, `src/features/critical-care`, `learning-module`, `icu-simulation`, `draft-modules.hamilton-c6` | 50 suites, 463 tests, **460 passing, 3 failing** — the same three as base (below)                                                                                                                                                                                 |
| `npx tsc --noEmit -p tsconfig.json`                                                                                        | clean, exit 0 — on the final head. The first full run after the new suite was written failed (TS2345: the suite's `DEVICE` constant was typed `string`); fixed and re-run. The production build's own type pass excludes tests, so only the full run catches this |
| `npx eslint src/features/mechanical-ventilation scripts/critical-care/mv-causal-inventory.ts`                              | clean                                                                                                                                                                                                                                                             |
| `npx prettier --check` on the module and script                                                                            | clean                                                                                                                                                                                                                                                             |
| `git diff --check`                                                                                                         | clean                                                                                                                                                                                                                                                             |
| `npm run build` (dev server stopped first)                                                                                 | succeeded                                                                                                                                                                                                                                                         |
| `npx tsx scripts/critical-care/mv-causal-inventory.ts` (base and head; `--speeds`)                                         | inventory files in `MV-PRE-REVIEW-02-inventory/`                                                                                                                                                                                                                  |

**Pre-existing failures, reproduced on `bf613270`** in the read-only base worktree with the same
node_modules, identical names: `critical-care/__tests__/accessibility.test.tsx` ("keeps color-coded
circuit, pressure, alarm, and trend states readable without color"),
`curriculum-sequencing.test.tsx` (CRRT "PrisMax troubleshooting challenge" ordering) and
`learner-copy.test.ts`. The learner-copy scanner flags **19** strings on base and the **same 19** on
the head (diffed), so this batch's copy adds none.

## 12. Browser checks

Built-in Chromium, this worktree's `next dev --port 3124 --webpack` (process cwd verified), then the
production build via `node server.js` on 127.0.0.1:3125. The pane reported `document.hidden`, so
every time advance used the page's own **One breath** control, never the animation loop.

- **Dev, 1280×1000.** MV-05: VTE 229 at open; bedside dyspnea/pain/delirium "Assess patient"; the
  consciousness boundary; ABG 7.33 / 62 / 68 / **32** with "…completed by the simulator" and the
  derivation line; VT low active. Advanced to 180.0 s: HR 108, SpO₂ 92, BP 124/70, MAP 88, VTE 234.
  MV-13 at 30 s: the stem note, Ppeak 43, no active alarm, SpO₂ 88. MV-14: 12.5 s SpO₂ 76, MAP 42;
  decompression at 12.5 s, at 62.5 s MAP 64, SpO₂ 76; latched card "58 → 31 fell … SpO₂ 76 → 76
  unchanged … MAP 42 → 55 rose"; the explanation's model note. MV-15: after assessment "8.0 / 10 ·
  Patient report · modeled"; after deep sedation at 94 s "3.2 / 10 · Internal index · not a patient
  report", RASS −5. Section 9: the computed time-control sentence ("stays at 84.0 % … from 30 to
  75 s"); Section 10: the model paragraph with the anchor "40 mmHg at 6.7 L/min"; Section 13: the
  reference MV-14 set (SpO₂ low, blood pressure low, pressure limitation) with its label.
- **Dev, 390×844.** Section 13 note and MV-13 stem note: no horizontal page overflow (scroll width
  390).
- **Production.** MV-05: VTE 229 at open, derivation line, 180.0 s unchanged vitals. MV-12 on all
  four facsimiles (`data-device` hamilton-c6 / drager-evita-v800-v600 / puritan-bennett-980 /
  carefusion-avea): VTE/VTe/Vte **643**, minute volume 5.1 (base opened at 1021).
- Console errors: only `/api/analytics` 401s from the local backend.

Process hygiene: both servers were stopped. Stopping the production wrapper used
`pkill -f "node server.js"`, a pattern that could also have matched another session's wrapper; the
other sessions' Next servers (ports 3134 and 3254) were still listening afterwards and were not
touched, but a wrapper process of theirs may have been ended by it.

## 13. NOT RUN

- Native browser zoom, 200 % root-text enlargement and 320 px width on the new surfaces; Firefox,
  Safari, hardware, real assistive technology; keyboard-only and screen-reader journeys; the es and
  zh-CN locales; dark scheme screenshots (the new elements reuse existing themed classes).
- Browser walk-throughs of every case, every arm and every console — replaced by the engine replays
  above, with representative browser checks.
- Deployed build and beta-wrapped routes.
- Any clinical, device, media or source review.

## 14. What must not be undone

- The case opens at negative time and is **never rewound**; anything that re-bases time must move the
  alarm epoch with it (`reopenAlarmEpoch`) and keep the breath schedule continuous.
- Slow targets are anchored at `physiologyReference`. Re-introducing an absolute target re-introduces
  untreated drift; an intended untreated process must be added as an explicit, authored term.
- The CO₂ anchor must be the same definition of minute ventilation the model compares with.
- The breath clock's next onset is fixed when its cycle begins; a new period takes effect there and
  nowhere else, and a patient-rhythm schedule sits on the effort grid. Anything that re-bases time
  moves the clock with it (`shiftBreathClock`).
- Case resolution reads authored success criteria, never a containment lookup (`isCaseResolved`).
- Reportability is derived from the whole effect set (`patientCanCommunicate`), never by the order
  of assignments.
- `advanceSimulation` starts each call from the published state and never re-derives it at call
  entry; anything that changes an input re-derives through the reducer at its own model time.
  Measurements must not read their own previous output (the expiratory-time fallback reads the
  breath clock). The trajectory must not depend on how the caller batches time.
- Parameters of a settings-selected lung state (shunt, like the mechanics) are rebuilt from the case
  every derivation; only slow running state is copied forward.
- No live trigger delay is labelled measured; `triggerDelayMs` is the phenotype's assigned value.
- `exhaledVtSource: 'predicted'` is never printed as an exhaled volume.
- `physiologyReference` and `breathClock` stay in-memory; MV-03 stays excluded; the alarm-limit item
  stays held.

## 15. Sanity-repair pass — the independent review of `dea2738a`

An independent Codex sanity review of `dea2738a` returned **SANITY REVIEW: NOT READY TO MERGE** with
five bounded application defects. This pass repairs those five and nothing else; the work in §1–14
that the review passed is kept. Prepared 2026-09-22 by an AI authoring assistant (Claude). The
repeated background-job completion/failure notices at the end of the review transcript came from
the review harness's polling, not from the application; they are not findings and nothing was
re-run because of them. Every check below was run once, on the repaired tree.

### Heads and drift

|                                                      | SHA                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Previous (reviewed) head                             | `dea2738adda650bef83415bab0f4770ca0b7996a`                                                                                                  |
| `origin/main` at the review and at the start         | `bc65b44a73b4de034077d8432c0e78b35f6e45e6`                                                                                                  |
| `origin/main` at the end (moved during the pass)     | `4bd1368d13cb297b7076f4d7655de849f444e0ff` — PRs #269 (EBUS), #268 (CRRT), #260 (BBT); no mechanical-ventilation file, no dependency change |
| `origin/claude/mechanical-vent-02-9-22` at the start | `dea2738a…` — unmoved                                                                                                                       |
| Repair commit                                        | `b6e575a9` (engine, content, components, tests)                                                                                             |
| This documentation                                   | committed on top of `b6e575a9`; the final head is reported in the PR                                                                        |

Reproduction scripts (read-only against both trees; the review's own `clock.mts` and `probe.mts`
from its scratch directory, plus two written for this pass) were run against `dea2738a` in the
session's detached checkout at that SHA and against the repaired tree.

### 15.1 Breath clock — successive rate changes suppressed breaths

**Root cause.** `BreathClock` held only `periodSeconds`, and the phase was still
`time mod period` on an absolute grid recomputed from whichever period was latched. The adoption
rule let a new period take over anywhere in an expiration where the new grid's phase was no later
than the current one, which put the next onset at `time + P_new − phase_new` — up to almost a whole
new period after the breath that was due. The next change could do the same again, so the onset was
never a fact the clock held and repeated changes compounded.

**Repair** (`engine/types.ts` `BreathClock`, `engine/simulation.ts` `advanceBreathClock` /
`breathClockAtOnset`). The clock holds `periodSeconds`, `anchorSeconds` and `nextOnsetSeconds`. The
next onset is fixed when a cycle begins, and no setting change moves it; it is processed on the first
step past it, once. At that onset the requested period becomes authoritative: the same period
continues its own grid (onsets computed as `anchor + k·period`, not accumulated, so a constant rate
is the absolute grid, sample for sample); the patient's own rhythm (requested period equal to the
neural effort cycle, with an effort) rejoins the effort grid at the first effort after that breath
has finished inspiring; any other period starts a new schedule anchored at that onset. Two callers
follow the clock: the hold-arming limit in the reducer now covers the cycle in progress
(`PERFORM_HOLD` right after a rate increase otherwise gave up before the boundary), and the Learn
lab's warm-up re-base moves the clock with the time origin (`shiftBreathClock`). `effortAt`, the
missed-effort fraction and the trigger delay are untouched.

A first version of the rejoin rule waited for the effort nearest one full cycle after the boundary.
The all-arm census showed it passing over the patient's effort 2.1 s after the boundary on MV-08
(cardiogenic oscillation, after the trigger fix) and leaving a 9.66 s gap; it was replaced before
anything was committed. The rule now bounds the transition to (inspiration, inspiration + one
effort cycle].

| Scenario (review's `clock.mts`, MV-LAB unless named)                     | `dea2738a` max onset gap                    | repaired                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------- |
| 16 ↔ 20 every 0.1 / 0.2 / 0.5 / **1** / 2 s                              | 15.00 / 12.00 / 11.24 / **12.02** / 12.00 s | 3.76 s each                                                                      |
| single late-expiratory change 16 → 20 at 3.6 s                           | **5.98 s**                                  | 3.76 s                                                                           |
| 16 → 30 / 16 → 40 at 3.6 s                                               | 4.00 / 4.50 s                               | 3.76 s                                                                           |
| inspiration-time (0.1 s) and early-expiration (0.8 s) changes, all rates | 3.76–7.50 s (period-bound)                  | same                                                                             |
| MV-05 PS 12 + ETS 40 (168 s)                                             | min VT 220 mL, max gap 5.32 s               | min VT 249 mL, max gap 7.50 s (the 8/min cycle in progress, no longer cut short) |

Minimum inspiratory time is unchanged in every MV-LAB scenario (0.62 s). No one-sample breath
anywhere: across all 82 inventory arms the shortest inspiration is 0.20 s, MV-09's own no-action
breath, identical on both heads. No arm's longest onset gap grew except MV-05's authored correction
with its expiratory hold (9.14 → 11.52 s: the 7.5 s cycle in progress, now not shortened, plus the
4 s hold, which occludes the next breath — hold behaviour both heads share); several shrank (MV-05
PS-only 8.50 → 7.50, ETS-only 8.86 → 7.50, MV-06 rate-up 3.50 → 2.52, MV-08 leak fix 8.56 → 7.52,
MV-15 deepen sedation 3.86 → 3.00 s). Seen, not changed: a 4 s expiratory hold that outlasts the
cycle leaves a partial inspiration after release on both heads (MV-LAB `expiratory` row, 0.38 s).

Consequences in the inventory (`MV-PRE-REVIEW-02-inventory/after.md`, regenerated): only MV-01 PEEP
13 (§15.3), MV-05's pressure-support and cycling arms (steadier breaths; the authored correction at
180 s VT 386, PEEPi 4.8, PaCO₂ 37 — §6 updated), MV-06 rate 30 (MAP 34 → 33 at 30 s), MV-08 leak fix
(at 60 s the breath the old schedule had already established at 53.6 s, 235 mL, is the last
completed one and the engine's existing 250 mL rule flags it; at 60 s the schedule is on the effort
grid) and MV-15 deepen sedation (the post-effect breath lands before 60 s). `speeds-after.md`
regenerated byte-identical.

### 15.2 Communication board over deep sedation or paralysis

**Root cause.** `deriveEffectivePatient` set `canCommunicate` in three assignments in code order —
deep sedation false, blockade false, then `communication-board` true — and the effect set carries
no order, so the board won whichever action came first.

**Repair.** `patientCanCommunicate(authored, effects)` in `engine/physics.ts`, called once after all
effects: deep sedation or neuromuscular blockade → cannot answer; otherwise the case's authored
value or a board. No RASS threshold; the two incapacitating states are the same actions as before.
Bedside labels and coaching readings already read `patientReportAvailability`, so both follow.

| Sequence (review's `probe.mts`; NMB on an MV-15 fixture with MV-04's action)     | `dea2738a`                              | repaired                          |
| -------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| board alone                                                                      | report                                  | report                            |
| deep sedation alone / NMB alone (MV-04)                                          | index                                   | index                             |
| deep sedation → board; board → deep sedation; assess → sedation → board → assess | RASS −5, **"Patient report · modeled"** | RASS −5, "Internal symptom index" |
| NMB → board (fixture)                                                            | `canCommunicate` **true**               | false                             |

The probe's other checks: 253/259 → 258/259; the one it still fails, "MV-14/stable 1×/5×/30×", is
an alarm `startedAt` of 11.8 s at 1× against 12.0 s at 5× and 30× (alarms are stamped once per
advance call). Patient, measurements and waveforms are identical, and so is the difference on
`dea2738a`. **Superseded by §17:** the per-call stamping was also dropping
alarm-history events; alarms are now evaluated at every fixed step and the stamp is 11.78 s at every
speed.

### 15.3 PEEP 13 — containment separated from success

**Root cause.** `isCaseResolved` read the same `ardsPeepBand() === 'recruited'` (8 ≤ PEEP < 14) that
the lung-state lookup used, so the mechanical hold at 13 also answered "has the authored success
range been reached".

**Repair.** Two functions for two questions (`engine/physics.ts`): `ardsLungStateForPeep` (the
mechanical state; 13 still held at the recruited state) and `ardsPeepInAuthoredSuccessRange` (the
casebook's "PEEP 8-12"), which is all `isCaseResolved` reads. Nothing about the physiology at 13 was
invented or changed.

| MV-01, 180 s   | 6        | 7        | 8         | 12        | **13**           | 14            |
| -------------- | -------- | -------- | --------- | --------- | ---------------- | ------------- |
| lung state     | baseline | baseline | recruited | recruited | recruited (held) | overdistended |
| resolved       | no / no  | no / no  | yes / yes | yes / yes | **yes → no**     | no / no       |
| corrective pts | 0 / 0    | 0 / 0    | 30 / 30   | 30 / 30   | **30 → 0**       | 0 / 0         |
| dyspnea index  | 3 / 3    | 3 / 3    | 1.0 / 1.0 | 1.0 / 1.0 | **1.0 → 3.0**    | 3 / 3         |

(`dea2738a` / repaired.) Compliance 0.032 and shunt 0.20 at 13 are unchanged, as are PEEP 14's
overdistension (compliance 0.018, MAP 61) and the unrecruited 6–7. A PEEP between 12 and 13 (the
test uses 12.5) is also outside the authored range. D3 remains `NOT REVIEWED`.

### 15.4 Unsupported response claims, where the learner meets them

**Root cause.** The first repair stated MV-14's oxygenation boundary only in the optional case
explanation. The action path still carried the authored claims: the feedback printed the moment the
action is taken (`lastResponse`, from the intervention's authored `response`) and the coaching card
written once its response has been observed. MV-13 had no equivalent statement anywhere.

**Repair.** `content/caseModelNotes.ts`:

- `interventionSimulatedResponse` + `composeInterventionResponse`, applied when each case's own
  interventions are built (`runtimeCases.ts`): the feedback keeps the authored expectation, labelled
  "Clinically expected:", and says in the same line what the simulation shows. MV-14 only, because
  only its two responses claim something the model does not do.
- `faultOxygenationBoundary`, a new `modelBoundary` field on the coaching card, rendered as "What
  this simulation does not model": derived from the card's own readings, it names what moved toward
  better and what SpO₂ did, and says the model has no link from this fault to oxygenation. It never
  says oxygenation improved when the saturation did not move, and does not credit the action with a
  saturation moved by something else (tested with FiO₂ raised during the interval). MV-13's four
  branch treatments and MV-14's two; identical wording on every MV-13 branch, so no branch leaks.
- The decompression coaching profile's "expect the improvement to need securing rather than to hold
  on its own" and "a response that fades is the expected course" now separate the bedside
  expectation from the model, which has no decay.
- `caseResponseModelNote`: MV-14's note adds that the improvement does not fade; MV-13 gets a note.

No oxygenation relationship, recovery or decay model was added.

| Surface                               | `dea2738a`                                                                                                                                                    | repaired                                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MV-14 decompression — action feedback | "Compliance, oxygenation, and blood pressure improve abruptly but temporarily." (SpO₂ 76 → 76)                                                                | "Clinically expected: … In this simulation compliance and blood pressure improve …, and the improvement does not fade — the model has no decay for it. SpO₂ is not linked to the pneumothorax here, so it does not change. …"                                                          |
| MV-14 decompression — coaching        | "a response that fades is the expected course"; "expect the improvement to need securing rather than to hold on its own"; SpO₂ row "unchanged" with no reason | the bedside expectation and "this simulation does not model that loss"; model boundary "Peak airway pressure, mean arterial pressure and reported breathing discomfort moved toward better …; SpO₂ did not change. In this simulation oxygenation is not linked to the pneumothorax …" |
| MV-14 drainage — action feedback      | "The compliance and hemodynamic improvement is sustained." (implies it would otherwise fade)                                                                  | expectation kept + "the improvement after decompression does not fade whether or not drainage is placed; drainage adds a further gain in compliance. SpO₂ is not linked …"                                                                                                             |
| MV-14 expected response / explanation | note: saturation not linked                                                                                                                                   | + the improvement does not fade, so the temporary relief is not shown                                                                                                                                                                                                                  |
| MV-14 debrief                         | the casebook debrief makes no oxygenation claim; `CaseWorkflow`’s debrief repeats `lastResponse`                                                              | unchanged; repeats the qualified text                                                                                                                                                                                                                                                  |
| MV-13 treatments — action feedback    | no oxygenation claim in any of the four                                                                                                                       | unchanged                                                                                                                                                                                                                                                                              |
| MV-13 treatments — coaching           | SpO₂ 88 → 88 "unchanged", no reason                                                                                                                           | model boundary, e.g. secretions + suction: "Peak airway pressure, trapped end-expiratory pressure and reported breathing discomfort moved toward better …; SpO₂ did not change. … not linked to the airway obstruction …"                                                              |
| MV-13 explanation                     | no note                                                                                                                                                       | note: saturation not linked to the obstruction; the casebook's expected recovery held for faculty review                                                                                                                                                                               |

Reviewed and not changed: MV-13's casebook success criterion "Oxygenation and delivered/exhaled VT
recover" is not rendered on any learner surface; the answer-key label "Plateau pressure falls while
oxygenation and MAP recover" is left as authored (the explanation note sits beside it); the
bronchodilator's "Airway resistance begins to fall over 5–15 simulated minutes" is a timing statement
(the model applies the whole fall at 300 s) rather than an oxygenation or decay claim, and is noted for
D1 rather than rewritten.

### 15.5 MV-13's alarm note matches the console

**Root cause.** The note interpolated the current limit into a sentence that always went on to say
the limit was above the peak and no alarm was active.

**Repair** (option B, with the case-entry context labelled as such). The note has three parts: what
the case opened with (the fixed opening limit from the case definition), one sentence read from the
current limit, peak and alarm list — active / will sound when the simulation next runs (a limit
changed while paused, since alarms are evaluated only when the model advances) / still showing from
the last evaluated breath / none, naming the pressure-limitation alert when it shows — and the
unchanged boundary that delivery at the limit is not modeled, held for RT and device review.
Limits, the alarm predicate, delivery and physiology are unchanged.

| Limit (peak 43.2) | alarms              | `dea2738a`                                                                                 | repaired                                                                                                                          |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 60 (opening)      | —                   | "limit at 60 … above the peak … no active high-pressure alarm"                             | entry sentence only                                                                                                               |
| 44                | pressure limitation | "limit at 44 … above the peak … no active high-pressure alarm"                             | "Now the limit is 44 cmH₂O, still above the peak of 43.2 cmH₂O, so no high-pressure alarm is active; … pressure-limitation alert" |
| 43, 40            | **high pressure**   | "limit at 40 cmH₂O — above the peak … the console shows **no active high-pressure alarm**" | "Now the limit is 40 cmH₂O and the peak, 43.2 cmH₂O, has reached it, so the console's high-pressure alarm is active."             |

### 15.6 Found while validating — D5 reachability of `measured`

The census behind §15.1 also counted trigger-evidence status at every 0.1 s of every arm. §8's
"never `measured`" held only without action: MV-05's pressure-support and cycling arms reached it at
grid coincidences on both heads (54 onsets at `dea2738a`, 63 repaired, the same nine arms), and no
other arm did. **Superseded by §16.3:** this section originally called those labels an interval
between two events on the trace. They were not — the helper printed the phenotype's assigned
`triggerDelayMs` — and the status has since been removed.

### 15.7 Validation (repaired tree; node 26.5.0; `NODE_OPTIONS=--max-old-space-size=8192`)

| Check                                                                                                                               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `__tests__/mv-pre-review-02-sanity-repairs.test.tsx`                                                                            | 43 tests, all passing: the adversarial clock scenarios (exact 16 ↔ 20 alternation; late-expiratory; inspiration-time and early-expiration at 8/20/40; repeated changes before the onset; constant-rate absolute grid incl. 4 modes × 5 rates set at t = 0; MV-05 PS 12 + ETS 40 over 168 s; MV-07 and MV-08 rejoins; no `measured` at clock transitions; hold arming after a rate increase; Learn-lab re-base); all seven board/sedation/NMB orders with bedside and coaching; PEEP 6/7/8/12/13/14 state, resolution, corrective points and relief; MV-14 feedback/coaching/FiO₂ confound/drainage/explanation/rendered Practice page; MV-13 two branches, a missed treatment, explanation; MV-13 note at entry, lowered while paused, active, stale, pressure-limitation, delivery unchanged |
| `npx jest src/features/mechanical-ventilation`                                                                                      | 40 suites, **997 tests, all passing** (954 before this pass, one assertion in this PR's own suite corrected: it had pinned PEEP 13 as resolved)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Consumers: `src/features/critical-care`, `learning-module`, `icu-simulation`, MV routes, `hamilton-c6`, `draft-modules.hamilton-c6` | 51 suites, 466 tests, 463 passing, **3 failing — the same three failing on current `origin/main` `bc65b44a`**, run in a read-only checkout at that SHA: accessibility (color-coded states), curriculum-sequencing (CRRT order), learner-copy. The learner-copy scanner's flagged strings are identical on main, `dea2738a` and the repaired tree (19); the messages differ only in the checkout path of the stack line                                                                                                                                                                                                                                                                                                                                                                        |
| Reproductions, both heads                                                                                                           | review's `clock.mts` (35 journeys), review's `probe.mts` (259 checks: 253 → 258), `responses.mts`, `trigger-census.mts` (82 arms, 22 branches, 0–180 s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Causal inventory, all 14 live cases / 22 branches / every arm, and `--speeds`                                                       | regenerated; differences exactly as §15.1. The `--speeds` file covers no-action arms only; **the combined MV-05 PS/ETS arms were not speed-invariant on this head — see §16.1**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npx tsc --noEmit -p tsconfig.json` (full, tests included)                                                                          | clean, on the final tree                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npx eslint src/features/mechanical-ventilation scripts/critical-care/mv-causal-inventory.ts`                                       | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npx prettier --check` (module, script, handoff, matrix, inventory)                                                                 | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `git diff --check`                                                                                                                  | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run build` (primary checkout's configuration read into the process only)                                                       | succeeded, 767/767 pages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Chromium** (built-in pane, this worktree's production build, `node server.js` on 127.0.0.1:3126,
process cwd verified; the pane reported `document.hidden`, so time advanced only through the page's
own **One breath** control; every setting and action through the page's controls):

- **1** MV-01 Practice: Rate tile 24 ↔ 25 alternated between breaths; the component's waveform
  buffer (read for inspection) shows onsets 45.0 / 47.4 / 50.0 / 52.4 s — gaps 2.4, 2.6, 2.4 s (the
  2.6 s cycle is the rejoin to MV-01's own 24/min effort grid), VTE 422 mL, no alarm.
- **2** MV-15 Practice, both orders: RASS −5; dyspnea and pain "Internal index · not a patient
  report"; the coaching card after the board lists peak, VTE, SpO₂ and MAP only.
- **3** MV-01 Practice, PEEP tile to 13 vs 12, bedside at 30 s: SpO₂ 88 in both (held lung state);
  dyspnea 3.0 at 13, 1.7 at 12 (resolution relief only inside the authored range).
- **4** MV-14 Practice: decompression status line as in §15.4, monitor SpO₂ 76; coaching card at
  42.5 s — peak 58 → 31, SpO₂ 76 → 76 unchanged, MAP 42 → 55, the model boundary and the no-fade
  wording; explanation note beside "Authored expected response". MV-13 secretions: suction card —
  peak 44 → 25, SpO₂ 88 → 88, the obstruction boundary.
- **5** MV-13 Practice: opening note; Alarms tab → High pressure tile → 40 while paused: note
  "…raises its high-pressure alarm when the simulation next runs", no signal yet; after two breaths
  the console banner "HIGH High pressure" and the note "Now the limit is 40 cmH₂O and the peak,
  43.8 cmH₂O, has reached it, so the console's high-pressure alarm is active."
- Console errors: only `POST /api/analytics` 401s from the unauthenticated local server (as in §12); none from these changes. Server stopped by its own PIDs after checking their cwd; the
  other sessions' servers (3110, 3134, 3254) were not touched.

### 15.8 D1–D5 after this pass — all `NOT REVIEWED`

- **D1** — untreated progression, acute chronology and transient rescue: open. No decay, recovery
  or progression was added; MV-14's relief is stated as not fading because the model has none.
- **D2** — intended gases, CO₂/drive, fault-linked oxygenation, consciousness: open. The fault-linked
  oxygenation boundary is now stated on the action path (§15.4), not settled.
- **D3** — PEEP 13 and PEEP 6–7 physiology: open. The code no longer resolves the case at 13; what 13
  should do is unchanged and undecided.
- **D4** — MV-13 / Section-13 alarm policy: open. The note describes the console; limits unchanged.
- **D5** — trigger causality: open, with §15.6's correction to what "never measured" covered (itself
  corrected in §16.3: no live trigger delay is measured).

### 15.9 Integration

`origin/main` moved from `bc65b44a` to `4bd1368d` during the pass (three merges, none touching this
module or its dependencies). `git merge-tree --write-tree origin/main b6e575a9` is clean. The merged
tree was checked out, detached, in the session scratchpad and the MV plus consumer suites run once:
91 suites, 1,464 tests, **1,461 passing, 3 failing** — the same accessibility, curriculum-sequencing
and learner-copy tests, which also fail on `4bd1368d` alone (run in a second detached checkout).
Both temporary checkouts were removed. The branch itself is not rebased or merged with main; the
repair and documentation commits are pushed to `claude/mechanical-vent-02-9-22` as fast-forwards on
PR #271. Not merged, not deployed; Batch 03 not started.

### 15.10 NOT RUN in this pass

- Firefox, Safari, hardware, assistive technology, keyboard-only and screen-reader journeys, native
  zoom / 200 % text / 320 px on the changed surfaces, dark-scheme screenshots, es and zh-CN.
- A browser walk of every case and arm (engine replays and the census stand in for them); the MV-05
  PS 12 + ETS 40 correction and MV-07/MV-08 rejoins were checked in the engine only.
- Deployed build; beta-wrapped routes.
- Any clinical, device, media or source review. Nothing here is one.

## 16. Re-review repair pass — the independent re-review of `1b52c008`

The independent re-review of `1b52c008` returned **SANITY REVIEW: NOT READY TO MERGE** with three
bounded issues; the five §15 repairs otherwise passed and are kept. Prepared 2026-09-22 by an AI
authoring assistant (Claude). Every check below was run once, on the repaired tree; before-values
come from the same scripts run in a read-only detached checkout of `1b52c008`, removed afterwards.

### Heads

|                                                      | SHA                                                   |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Previous (re-reviewed) head                          | `1b52c008c31cc4ad11afdb69d8b89f211dd40339`            |
| `origin/main` at the start and at the end            | `4bd1368d13cb297b7076f4d7655de849f444e0ff` — no drift |
| `origin/claude/mechanical-vent-02-9-22` at the start | `1b52c008…` — unmoved                                 |
| Repair commit, then this documentation on top of it  | reported in the PR; pushed as fast-forwards           |

### 16.1 R1 — simulation-speed invariance

**Root cause.** Two things combined.

1. **A per-call refresh.** `advanceSimulation` began every call by re-deriving the patient and the
   measurements from the state it was handed (`deriveEffectivePatient(state)`,
   `deriveMeasurements(state)`), although the previous call had just published them from the same
   fixed steps. One extra derivation per outer call means the number of derivations depended on the
   caller's batching: 180 in 18 s at 1×, 36 at 5×, 6 at 30×.
2. **A derivation that fed on itself.** When the 12 s buffer holds no completed expiration,
   `deriveMeasurements` fell back to `60 / previously reported rate − Ti`, and on pressure support that
   rate is computed from the missed-effort fraction, which is computed from the trapped pressure this
   expiratory time sets. After MV-05's combined correction the recurrence alternated 16 ↔ 19/min
   (PEEPi 6 ↔ 4.2 cmH₂O) on every derivation. The §15 clock made both visible: it completes the 7.5 s
   cycle in progress, which lengthens the window with no completed expiration in the buffer, and it
   reads the requested cycle once at each onset, so it adopted whichever parity that onset's step
   landed on. PS-only and ETS-only never entered the fallback window, so they stayed invariant.

**Repair — one fixed-step order** (`engine/simulation.ts` `advanceSimulation`, `engine/physics.ts`
`deriveMeasurements`).

1. The step starts from the published state (`state.patient`, `state.measurements`); nothing is
   re-derived at call entry. Every action that changes an input already re-derives through the
   reducer at the model time it happens (`refreshMeasurements`, `applyIntervention`, `CONFIRM_MODE`,
   teaching mechanics), so no input change is missed.
2. Per step: state entering → effective patient → breath clock (reads the measurements the previous
   step published) → waveform sample → lung volume → measurements published by this step → slow
   physiology. Unchanged apart from (1).
3. The expiratory-time fallback reads the machine's cycle in progress (`breathClock.periodSeconds`,
   fixed at the onset that began it) instead of the previously reported rate, so no measurement reads
   its own previous output.

No speed, case or setting is special-cased; nothing is rounded after the fact; the CO₂ anchor
equation, prepared history and PhysiologyReference are untouched (every opening row of the inventory
is unchanged).

| MV-05, VTE mL at 30 / 60 / 180 s as 1× · 5× · 30× (all three branches identical) | `1b52c008`                                                      | repaired                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| PS 12 + ETS 40                                                                   | 438·438·**363** / 344·344·**308** / 386·386·**420**             | 438·438·438 / 344·344·344 / 386·386·386 |
| PS 12 + ETS 40 + expiratory hold                                                 | 438·**397**·**318** / 344·**252**·**300** / 386·**406**·**409** | 266·266·266 / 275·275·275 / 415·415·415 |
| PS 12 only · ETS 40 only · unchanged                                             | invariant                                                       | invariant, values unchanged             |

"Identical" is the complete state — patient, measurements, the whole waveform buffer, breath clock,
hold state and records, risk, trends and the alarm set — compared with deep equality. The published
rate/PEEPi on the combined correction: with only the refresh removed it changed 89 times in 48 s (333
with the hold), every change a single-step blip; with the fallback repaired, 13 (11), each lasting a
breath, as on `dea2738a`. Alarm `startedAt` stamps still differ by call granularity (`reconcileAlarms`
runs once per call); that is a stamp resolution, identical on the base, and the alarm set is equal.
**Superseded by §17:** the same once-per-call reconciliation lost MV-01's transient pressure
limitation at 5× and 30×; the alarm record is now part of the fixed step and identical at every speed.

**Census — every live case, all 22 branches, every scripted arm (82), reducer TICK at 1×, 5×, 30×,
complete state at 30, 60, 150, 180 s:** `1b52c008` 77/82 invariant (MV-05's three PS/ETS + hold arms,
MV-14's two decompression arms); repaired 80/82. The two MV-14 arms perform drainage at 28 s, which is
not on the 30× tick (3 s), so at 30× the harness applies it at 30 s — a different action time, as
`runInventoryArm` documents. On those arms 1× = 5× as written, and with the drainage at 30 s all three
speeds are identical. Direct engine calls from the same state (0.02 / 0.1 / 0.5 / 3 s chunks, 48 s,
with and without the hold) are identical, and so is the causal-inventory harness for every MV-05 arm.
`speeds-after.md` regenerated byte-identical; `after.md` changed only in MV-05's PS/ETS/hold arm (§6
updated: 180 s VT 415, PEEPi 4.7, PaCO₂ 38).

Clock stress retained: 16 ↔ 20 alternation (max gap 3.76 s), late-expiratory change, MV-07 and MV-08
effort-grid rejoins, no gap above the §15.1 bounds, shortest inspiration 0.20 s (MV-09's own, both
heads); all 43 §15 tests pass unchanged.

Seen, not changed: the page's **One breath** control advances `60 / effective rate` in one call, and
`advanceSimulation` divides a call into `ceil(seconds / 0.02)` equal steps, so that path runs on a
slightly different time grid from playback ticks, which are always exactly 0.02 s. It is
deterministic — the browser run below reproduces exactly — but not the same discretization as 1×
playback. `CONFIRM_MODE` still finds its breath boundary with `time mod (60 / rate)`, which is exact
only on the absolute grid.

### 16.2 R2 — PEEP reversal restores the baseline shunt

**Root cause.** `deriveEffectivePatient` rebuilds the mechanics from the case every call but copied
`gasExchange` from the running patient. The shunt fraction lives in that object, and MV-01's lung-state
lookup writes it only for the recruited (0.20) and overdistended (0.24) states, so the value of the last
band visited survived the return to baseline. Compliance returned because it is rebuilt; the shunt did
not because it was copied.

**Repair.** The shunt is rebuilt from the case on every derivation, like the mechanics
(`gasExchange: { ...running gases, shuntFraction: case value }`); the band then overrides it as before.
The three discrete bands are unchanged; no curve, hysteresis or interpolation.

| MV-01, after 180 s at PEEP _n_ and 360 s back at 5 | `1b52c008` shunt · PaO₂ · SpO₂ | repaired shunt · PaO₂ · SpO₂ |
| -------------------------------------------------- | ------------------------------ | ---------------------------- |
| 5 → 6 → 5, 5 → 7 → 5                               | 0.30 · 54.0 · 84.0             | 0.30 · 54.0 · 84.0           |
| 5 → 8 → 5, 5 → 12 → 5, 5 → 13 → 5                  | **0.20 · 72.0 · 90.6**         | 0.30 · 54.0 · 84.0           |
| 5 → 14 → 5, 5 → 16 → 5                             | **0.24 · 64.8 · 88.7**         | 0.30 · 54.0 · 84.0           |

In every path after the return: compliance 0.025 (as before), not resolved, 0 corrective points,
dyspnea index 3.0. While set: 8 and 12 resolve (30 points, index 1.0); 13 keeps the recruited
mechanics (0.032, shunt 0.20) and is not resolved, earns no corrective points and takes no relief; 14
and 16 keep overdistension. D3 remains `NOT REVIEWED`.

Seen, not changed (same mechanism, outside R2): `human` is also copied from the running patient and
the comfort effects are relative (`treat-pain` −5, `relieve-bladder` −2, `reorient` −3,
`reduce-noise` −1), so each is re-applied every step until its floor. On MV-15 pain settles at 1 after
treatment and 0 after bladder relief, and delirium at 1 after reorientation, where one application
would give 2, 5 and 4. Identical on `dea2738a` and on the base. Flagged as a follow-up.

### 16.3 R3 — trigger delay is a model estimate, never "measured"

**Root cause.** The helper's `measured` branch printed `measurements.triggerDelayMs`, the delay the
model assigns the phenotype (`80 + 400·missed`, `100 + 450·missed`). Nothing in the runtime times an
interval between an effort and a delivery. Reproduced on `1b52c008` (MV-05 corrected arm, the review's
example first): onset 55.92 s printed **"267 ms"** as measured where the effort had crossed the
engine's detection floor 140 ms before the onset; the other 20 events on the PS/ETS and PS-only arms
printed 264–315 ms against 40–360 ms. §8, §15.6, matrix row 21 and the Batch-01 handoff called these
intervals; each is corrected with a dated note.

**Repair** (`engine/triggerEvidence.ts`). `measured` is removed from `TriggerDelayStatus`. An effort
building into the onset is still recognised and said ("A modeled effort was already under way … but
the simulator does not time the interval …"), and the number reads `NNN ms · model estimate`.
`not-applicable` and `unavailable` are unchanged; zero stays distinct from absent (`delayMs` null with
"—"). The Timing view loses its "Measured trigger delay is N" sentence; the dyssynchrony integration
row's bearing is "Not discriminating", since no live value is a measurement. The Batch-01 fixture that
asserted `measured` with `delayMs === triggerDelayMs` now asserts the estimate. No trigger physiology,
threshold or event-pair heuristic was added.

**Live classification census** (every 0.1 s tick of every live case, all 22 branches, all 82 arms,
0–180 s, 1×):

| Status         | `1b52c008` | repaired                                   |
| -------------- | ---------- | ------------------------------------------ |
| model estimate | 123,986    | 126,635                                    |
| not applicable | 21,004     | 20,965                                     |
| unavailable    | 0          | 0 (the empty-buffer test still returns it) |
| measured       | **2,610**  | **0** — the status no longer exists        |

### 16.4 Batch-01 and §15 contracts

Unchanged and re-verified by the full suite: acquired plateau identity, `supportsMechanicsClaim`, hold
change-back invalidation, frozen-waveform hold acquisition, ABG specimen immutability and overlapping
availability, post-action evidence coverage, A/B markers, absent/unknown/zero trigger distinctions;
§15's clock bounds, reportability, PEEP-13 success semantics, response-claim containment and MV-13
alarm wording.

### 16.5 Validation (repaired tree; node 26.5.0; `NODE_OPTIONS=--max-old-space-size=8192`)

| Check                                                                                                             | Result                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `__tests__/mv-pre-review-02-rereview-repairs.test.tsx`                                                        | 31 tests, all passing: 15 MV-05 branch × arm complete-state 1×/5×/30× comparisons at 30/60/180 s; direct engine chunking; no single-step flicker; inventory harness for every MV-05 arm; seven PEEP reversal paths (compliance, shunt, PaO₂, SpO₂, resolution, corrective points, dyspnea); PEEP-13 containment; shunt derivation; live trigger census; the building-effort estimate; absent/unknown/zero; Timing and dyssynchrony views |
| `npx jest src/features/mechanical-ventilation`                                                                    | 41 suites, **1,028 tests, all passing** (997 before; one Batch-01 fixture assertion corrected — it pinned `measured`)                                                                                                                                                                                                                                                                                                                    |
| Consumers (critical-care, learning-module, icu-simulation, MV routes, `hamilton-c6`, `draft-modules.hamilton-c6`) | 51 suites, 466 tests, 463 passing, **3 failing — the same accessibility, curriculum-sequencing and learner-copy tests that fail on `origin/main` `4bd1368d` alone** (detached checkout at that SHA, this session). The learner-copy scanner's findings are the same 18 as on `1b52c008`                                                                                                                                                  |
| Census scripts, both heads                                                                                        | 82-arm cross-speed + trigger census; MV-05 arm speeds; reversal paths; the review's measured-vs-trace timing                                                                                                                                                                                                                                                                                                                             |
| Causal inventory + `--speeds`                                                                                     | regenerated; changes only as §16.1                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npx tsc --noEmit -p tsconfig.json` (full)                                                                        | clean                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npx eslint` (module + inventory script)                                                                          | clean                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npx prettier --check` (module, script, docs)                                                                     | clean                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `git diff --check`                                                                                                | clean                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run build`                                                                                                   | succeeded, 767/767 pages                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Chromium** (built-in pane; this worktree's production build, `node server.js` on 127.0.0.1:3126,
process cwd verified). The pane was **hidden** throughout this pass, so pointer input could not be
composited; the page's own buttons were activated with DOM `click()` (the same React handlers, without
pointer hit-testing) and state was read from the rendered component for inspection.

- **MV-05 Practice**, one playback path: six breaths, ΔPsupport 18 → 12 and ETS 25 → 40 at 12.86 s,
  eight breaths → 30.0 s: VTE 439 mL, rate 18, PEEPi 4.3, PaCO₂ 58.4. Replaying the identical action log
  in the engine reproduces the browser's patient, measurements, clock and all 600 waveform samples
  exactly; from that post-correction state, 18 s at 0.1 / 0.5 / 3 s chunks gives identical complete
  state (VTE 331 each).
- **MV-01 Practice**, PEEP 5 → 13 → 5: displayed SpO₂ 84 → 90 over 60 s at 13 (shunt 0.20, compliance
  0.032); back at 5 the shunt is 0.30 at once and displayed SpO₂ falls 90 → 88 → 86 → 85 → 84 by 240 s
  (PaO₂ 74.6 → 54.4).
- **Learn Section 7** (Timing view, MV-07 round): "Trigger delay 330 ms · model estimate" and "Modeled
  trigger delay for this phenotype is 330 ms, not measured on this breath"; no "Measured trigger delay"
  anywhere on the page. MV-05 is not the patient of any Learn surface that shows the trigger delay, and
  Practice shows none, so the corrected-MV-05 rendering is verified by the test that mounts both panels
  on that state.
- Console errors: only `POST /api/analytics` 401s from the unauthenticated local server. Server stopped
  by its own PIDs after checking cwd; other sessions' servers (3110, 3134, 3254) untouched.

### 16.6 D1–D5 — all `NOT REVIEWED`

- **D1** untreated progression, acute chronology, MV-06 transient response: open.
- **D2** intended gases, CO₂/drive, fault-linked oxygenation, consciousness: open.
- **D3** PEEP 13 and PEEP 6–7 physiology: open. 13 stays containment, not success; restoring the
  baseline on return is reversibility, not a hysteresis decision.
- **D4** device-specific alarm policy: open.
- **D5** trigger causality and true effort-to-delivery timing: open. No live value is a measured
  interval; a `measured` status would need the trigger-event model §8 describes.

### 16.7 Integration

`origin/main` `4bd1368d` did not move during this pass; the branch is not rebased or merged. The repair
and documentation commits are pushed to `claude/mechanical-vent-02-9-22` as fast-forwards on PR #271.
Not merged, not deployed; Batch 03 not started.

### 16.8 NOT RUN in this pass

- Pointer-driven browser input (pane hidden; DOM `click()` used instead), Firefox, Safari, hardware,
  assistive technology, zoom / 200 % text / 320 px, dark scheme, es and zh-CN.
- A browser walk of every arm (the engine census stands in); the MV-05 hold arm in the browser.
- Deployed build; beta-wrapped routes.
- Any clinical, device, media or source review.

## 17. Final-gate repair — alarm history under coarse outer batching

The independent final gate on `d4d3cef2` confirmed all three §16 repairs (MV-05 speed/batching
invariance, PEEP reversal, trigger delay as a model estimate) and found one blocker: an alarm-history
event that the model raises was lost when the same model time was handed to the engine in coarser
calls. This pass repairs that and nothing else. Prepared 2026-09-23 by an AI authoring assistant
(Claude). Every check below was run once on the repaired tree; the before values come from the same
scripts run in a read-only detached checkout of `d4d3cef2` (session scratchpad), and consumer
baselines from one of `origin/main` `a306d825`; both were removed afterwards.

### Heads

|                                                      | SHA                                                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Previous (gated) head                                | `d4d3cef2b45ceeaa74933554974ec0d09dc22c4c`                                                                                       |
| `origin/main` at the start and at the end            | `a306d8250ec10207c750f46407f151c06d487707` — the expected SHA, no drift; no mechanical-ventilation file changed since `bf613270` |
| `origin/claude/mechanical-vent-02-9-22` at the start | `d4d3cef2…` — unmoved                                                                                                            |
| Repair commit                                        | `5e364e18` (engine and tests)                                                                                                    |
| This documentation                                   | committed on top of `5e364e18`; the final head is reported in the PR                                                             |

### 17.1 Root cause

`advanceSimulation` ran every fixed 20 ms step of the outer call, built the state it would publish,
and only then called `reconcileAlarms` once, on that final state. The alarm history was therefore a
sample of the model taken at call ends — every 0.1 s at 1×, 0.5 s at 5×, 3 s at 30× — and an alarm
that was active only between two call ends never reached it.

MV-01, fresh epoch, PEEP 5 → 16 at exactly 12 s, stepped at 20 ms (repaired and previous heads alike;
the model trajectory is the same):

| Step (s) | Peak (cmH₂O, limit 40) | Active alarms                                                                    |
| -------- | ---------------------- | -------------------------------------------------------------------------------- |
| 12.02    | 25                     | SpO₂ low                                                                         |
| 12.86    | 37.6                   | SpO₂ low, **pressure limitation** (the ≥ limit − 3 band)                         |
| 12.92    | 40.4                   | high pressure, SpO₂ low — high pressure replaces the limitation (same `if/else`) |
| 25.66    | 42.5                   | high pressure — SpO₂ low clears                                                  |

The limitation lasts three steps (12.86, 12.88, 12.90). The 1× call ending at 12.90 s falls inside
it; no 5× call end (12.5, 13.0) and no 30× call end (12, 15) does. The same sampling dated every start
at the first call end after it — high pressure at 13.0 / 13.0 / 15.0 s — which is the
"`startedAt` variation" §15.2 and §16.1 accepted as a stamp resolution. It was not a separate
mechanism: MV-14-stable's blood-pressure alarm (11.8 / 12.0 / 12.0 s) and MV-15's low-VT alarm after
deeper sedation (58.7 / 59.0 / 60.0 s, ids `VT_LOW-58` / `-59` / `-60`) came from it too.

### 17.2 Repair — the alarm record is part of the fixed step

`engine/simulation.ts` `advanceSimulation`: `reconcileAlarms` now runs at **every fixed step**, after
slow physiology and risk, on the state that step would publish (its time, patient, measurements and
settings), and the resulting record (`alarms`, `alarmHistory`) is carried into the next step. The call
publishes the last step's record; nothing is reconciled at call exit any more. The last step is
evaluated on exactly the state the call-exit evaluation used, so the published active set is unchanged
by construction. The case-open epoch (t = 0) and `reopenAlarmEpoch` are unchanged.

Not changed: `alarmDescriptors` (codes, thresholds, priorities, messages), the configured limits, any
physiology, case logic, clinical alarm policy, reducer action or UI. The 82-arm census takes 20.0 s
against 19.5 s before.

**Fixed-step transition semantics** (documented on `reconcileAlarms`):

- **Newly active** — a code absent at the previous step and present now gets one entry, `startedAt` =
  this step's model time, id `CODE-⌊t⌋` (unchanged id scheme).
- **Continuing** — the same entry every step: id, `startedAt` and `acknowledgedAt` kept; no entry per
  20 ms step.
- **Cleared** — stays in the history, `active: false`; leaves `alarms`.
- **Later reactivation** — the existing contract is **one entry per code**, not one per episode, and it
  is kept: a returning code reuses its entry, with its first `startedAt` and any acknowledgement. The
  82 arms contain 22 reactivations (low VT on MV-05's PS-only and PS 12 + ETS 40 + hold arms, all
  three branches, and on MV-08's leak fix), all identical at every speed. Whether a returning alarm should instead open a
  new, unacknowledged episode is an alarm-policy question (D4), not changed here.
- **Order and cap** — the history lists the active codes in evaluation order, then the inactive ones
  in the order the previous record held them; `alarms` is the active set by priority; the history is
  capped at 20 (eight codes exist, so the live model never reaches it; the test seeds 24 entries).
  With the record carried per step, the order no longer depends on which states a call end happened
  to sample.
- **Acknowledgement** — `ACK_ALARM` acts between calls at its model time, as before, and the entry
  carries it.

### 17.3 MV-01 — before and after

MV-01, fresh state, reducer ticks to exactly 12 s, PEEP 5 → 16, ticks to exactly 30 s:

| Speed | `d4d3cef2` alarm history at 30 s                                                                    | repaired                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1×    | `HIGH_PRESSURE-12` active 13.00 · `SPO2_LOW-0` inactive 0 · `PRESSURE_LIMITATION-12` inactive 12.90 | `HIGH_PRESSURE-12` active 12.92 · `SPO2_LOW-0` inactive 0 · `PRESSURE_LIMITATION-12` inactive (medium) 12.86 |
| 5×    | `HIGH_PRESSURE-12` active 13.00 · `SPO2_LOW-0` inactive 0 · **no pressure limitation**              | identical to 1×                                                                                              |
| 30×   | `HIGH_PRESSURE-14` active 15.00 · `SPO2_LOW-0` inactive 0 · **no pressure limitation**              | identical to 1×                                                                                              |

Active alarms at 30 s: high pressure only, at every speed, on both heads. On the repaired tree the
three records are identical to the last bit — codes, ids, priorities, active flags, stamps, order, no
acknowledgement — and so is the record after one 18 s call from 12 s or any 3 / 0.5 / 0.1 / 0.02 s
split of it.

### 17.4 Complete-state replay with alarm history

Every live case (14), branch (22) and scripted arm (82); reducer `TICK` 0.1 s × speed at 1×, 5×, 30×;
state at 0, 30, 60, 150 and 180 s compared with deep equality on **every field except `speed`** —
patient, measurements, the whole waveform buffer, trends, the ventilator (clock, holds), hold records,
risk, critical errors, interventions, gas samples, and the alarm record whole. Each action is applied
at its own model time at every speed: a tick that would carry the model past an action or a sample is
replaced, up to it, by 1× ticks — this is how MV-14's drainage at 28 s (not on the 30× tick) is
applied at 28 s at 30× too.

| Arms (of 82)                                                     | `d4d3cef2`                                                                                                   | repaired                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| identical complete state                                         | 76                                                                                                           | **82**                                                               |
| alarm event missing at a speed                                   | 1 — MV-01 PEEP 16 (pressure limitation at 1× only)                                                           | 0                                                                    |
| timestamp-only (`startedAt`, and the id derived from it)         | 5 — MV-14 stable ×4 (blood pressure low 11.8 vs 12.0 s), MV-15 deepen sedation (low VT 58.7 / 59.0 / 60.0 s) | **0**                                                                |
| any other field                                                  | 0                                                                                                            | 0                                                                    |
| harness action time (actions on the first tick at or after them) | MV-14 decompress ×2 (drainage applied at 30 s at 30×; interventions and trends differ) — as §16.1            | same 2, same classification; identical once the action time is equal |

**No timestamp-only difference remains, not even within a step.** Every speed runs the same 0.02 s
steps on the same floating-point grid (0.1 / 5, 0.5 / 25 and 3 / 150 are all exactly 0.02), so the
stamps are bit-identical.

**What the repair changed at 1×**, every arm and sample, `d4d3cef2` against repaired: every field
outside the alarm record is byte-identical; the active alarm codes are identical in every snapshot,
and so are the history's codes and active flags; in six arms the stamps moved earlier by at most
0.08 s (from the end of the 0.1 s call to the step the condition began: MV-01 13.00 → 12.92 and
12.90 → 12.86, MV-14 stable 11.80 → 11.78, MV-15 58.70 → 58.68), ids unchanged. The causal inventory
and its `--speeds` form regenerate byte-identical to `d4d3cef2`, so the inventory files are unchanged.

**Episode census** (every arm, 0–180 s, 20 ms): 97 alarm episodes; one is shorter than a 30× call —
MV-01's 0.06 s pressure limitation; 22 are reactivations (§17.2).

### 17.5 The three §16 repairs and earlier contracts

- **R1** — the 15 MV-05 branch × arm comparisons at 1× / 5× / 30× now include the whole alarm
  record and the critical errors (the helper used to keep only the active codes); the direct-engine
  chunking test compares the alarm record too; the no-flicker and harness tests are unchanged. All
  pass. The fixed-step physiology is byte-identical to `d4d3cef2` (above), so breath timing — no
  one-sample breaths, onset gaps within the §15.1 bounds — is untouched and its §15 tests pass.
- **R2** — PEEP reversal returns shunt, compliance, PaO₂ and SpO₂ to the opening values; PEEP 13
  stays containment, not success. Unchanged, passing.
- **R3** — the live trigger delay is a model estimate; the measured count stays zero; D5 stays open.
  Unchanged, passing.
- Prepared history, `PhysiologyReference`, the CO₂ anchor, gas provenance, reportability, MV-13's
  alarm wording, Section 13's reference alarms, plateau acquisition, ABG specimens, post-action
  evidence and A/B markers are untouched and re-verified by the full suite.

### 17.6 Tests

- **New `__tests__/mv-pre-review-02-alarm-history.test.ts`** (25 tests): the gate's MV-01
  reproduction at 1× / 5× / 30× (codes, ids, priorities, active flags, stamps, order); transitions
  dated at the step, and one 18 s call equal to any split; an alarm that appears after a control change
  and stays active (one entry); a limitation replaced by the high alarm inside one coarse call; an
  opening alarm that clears and stays clear; acknowledgement; blood pressure low from untreated
  physiologic evolution (MV-14 stable); low VT after an intervention (MV-15); reactivation as one
  entry per code (MV-05 PS 12, acknowledged at 3 s); cap and order; the 14 / 22 / 82 count; and the
  complete-state census, one test per live case. Run against `d4d3cef2` (the file copied into the
  read-only checkout), 11 of the 25 fail: the MV-01 reproduction and step dating, appears-and-stays,
  limitation inside one call, opening alarm that clears, acknowledgement, MAP low, VT low, and the
  MV-01, MV-14 and MV-15 census cases. Reactivation, cap and order, the count and the other eleven
  census cases pass there, because they were already speed-invariant.
- **`__tests__/mv-pre-review-02-rereview-repairs.test.tsx`** — the R1 complete-state helper includes
  `alarms`, `alarmHistory` and `criticalErrors` whole; the direct-engine chunking test compares the
  alarm record. These 31 also pass on `d4d3cef2`: MV-05's arms never carried a differing stamp, so
  the discriminating guard is the new file's census, not this helper.

### 17.7 Validation (repaired tree; node 26.5.0; `NODE_OPTIONS=--max-old-space-size=8192`)

| Check                                                                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. New alarm-history regressions (`mv-pre-review-02-alarm-history.test.ts`)                                                                                      | 25 tests, all passing (11 fail on `d4d3cef2`, §17.6)                                                                                                                                                                                                                                                                                                          |
| 2–3. Complete-state speed invariance with alarm history; 14 cases / 22 branches / 82 arms at equal action times                                                  | jest census (14 per-case tests) and the session census script: **82/82** identical at 1×, 5×, 30× (`d4d3cef2`: 76/82). Tick-granular action times: 80/82, the two MV-14 decompress arms — harness action time only                                                                                                                                            |
| 4. R1–R3 (`mv-pre-review-02-rereview-repairs.test.tsx`)                                                                                                          | 31 tests, all passing                                                                                                                                                                                                                                                                                                                                         |
| 5. `npx jest src/features/mechanical-ventilation`                                                                                                                | 42 suites, **1,053 tests, all passing** (1,028 before + 25)                                                                                                                                                                                                                                                                                                   |
| 6. Batch-01 regressions (within 5)                                                                                                                               | `mv-pre-review-01-evidence` 34, `mv-pre-review-01-sanity-repairs` 37 — all passing                                                                                                                                                                                                                                                                            |
| 7. Batch-02 causality and sanity (within 5)                                                                                                                      | `mv-pre-review-02-causality` 126, `mv-pre-review-02-sanity-repairs` 43 — all passing                                                                                                                                                                                                                                                                          |
| 8. Physics and waveforms (within 5)                                                                                                                              | `physics-waveforms` 173, `breath-grammar` 6 — all passing                                                                                                                                                                                                                                                                                                     |
| 9. Post-action coaching (within 5)                                                                                                                               | `post-action-coaching` 51 — all passing                                                                                                                                                                                                                                                                                                                       |
| 10. Consumers: MV routes, `hamilton-c6-ventilation` route, `critical-care`, `learning-module`, `icu-simulation` (feature and route), `draft-modules.hamilton-c6` | 53 suites, 479 tests, 476 passing, **3 failing — the same three fail on `origin/main` `a306d825` alone** (read-only checkout, same node_modules; 480 tests there, main carries one more): accessibility (color-coded states), curriculum sequencing (CRRT station order), learner copy. Learner copy flags the same 19 strings on `d4d3cef2` and on this head |
| 11. `npx tsc --noEmit -p tsconfig.json` (full)                                                                                                                   | clean. The first run failed on the new test (a seeded state inferred with a mutable `alarmHistory`); annotated, re-run clean, and that one test re-run passing — a type-only edit after the suite run                                                                                                                                                         |
| 12. `npx eslint src/features/mechanical-ventilation scripts/critical-care/mv-causal-inventory.ts`                                                                | clean                                                                                                                                                                                                                                                                                                                                                         |
| 13. `npx prettier --check` (module, script, this handoff)                                                                                                        | clean                                                                                                                                                                                                                                                                                                                                                         |
| 14. `git diff --check` (staged, both commits)                                                                                                                    | clean                                                                                                                                                                                                                                                                                                                                                         |
| 15. `npm run build`                                                                                                                                              | succeeded, 767/767 pages, standalone prepared                                                                                                                                                                                                                                                                                                                 |
| Causal inventory and `--speeds`                                                                                                                                  | regenerated byte-identical to `d4d3cef2`; inventory files unchanged                                                                                                                                                                                                                                                                                           |

Each check was run once on the repaired tree, apart from the tsc re-run and the one-test re-run noted
in row 11. The new test file was also run during development, before the validation run.

### 17.8 Chromium

This worktree's production build, `node server.js` on 127.0.0.1:3129 (process cwd verified as this
worktree's `.next/standalone`; the primary checkout's `.env.local` read into the process environment
only). The pane was **hidden**, so the page clock did not run and pointer input could not be
composited: the page's own buttons were activated with DOM `click()`, and engine state was read from
the React fiber of `[data-device]`. The fiber the DOM node points to can be the stale alternate
(PEEP read 15 after 16 was committed); the reader takes the fiber in the committed tree.

- **MV-01 Practice, PEEP 5 → 16.** **One breath** ×5 (2.5 s calls) to 12.5 s; PEEP 5 → 16 with the
  console's own increment control (11 presses, paused, one model time); **One breath** ×7 to 30.0 s.
  After the first call after the change (12.5 → 15 s, a single coarse call containing the whole
  episode), the engine record holds `PRESSURE_LIMITATION-12` inactive (12.86), `HIGH_PRESSURE-12`
  active (12.92) and `SPO2_LOW-0` active; SpO₂ low clears between 25 and 27.5 s; at 30 s the record is
  the gate reproduction's (§17.3). Replaying the browser's action log in the engine reproduces it
  exactly; on `d4d3cef2` the same log gives `HIGH_PRESSURE-14` at 15.00 and no pressure limitation.
- **Console alarm behaviour, unchanged.** The alarm bar shows "HIGH · High pressure" from the first
  call after the change (the top active alarm, as before); Monitoring at 30 s: Ppeak 43, PEEP/CPAP 16,
  SpO₂ 85. The Alarms screen lists active messages only — "High pressure · high priority · started
  13 s" (`startedAt.toFixed(0)`; the same path on `d4d3cef2` prints 15 s, the call end). That start
  time is the one learner-visible difference: it now dates the transition at every speed.
- **No alarm-history surface exists** in the module (no component reads `alarmHistory`), so the
  inactive limitation is visible only in engine state. No UI was added.
- **MV-13 smoke (secretions branch).** Opens with limit 60, peak 43.7, "No active alarm", and the
  unchanged opening note. Limit → 40 while paused: the note says the console raises its alarm "when
  the simulation next runs", and no alarm is shown yet (alarms are evaluated only when time advances —
  unchanged). One breath (3 s): console "HIGH · High pressure"; note "Now the limit is 40 cmH₂O and the
  peak, 43.8 cmH₂O, has reached it, so the console's high-pressure alarm is active"; the alarm is dated
  0.02 s, the first step after the change.
- Console errors: only `POST /api/analytics` 401s from the unauthenticated local server. The server
  was stopped by its own PID after checking its cwd; other sessions' servers (3137, 3138, 3151) were
  not touched.

### 17.9 Seen, not changed

- **Critical errors are still observed at call exit.** `withCriticalErrors` reads the risk indices
  once, on the state the call publishes — the same outer-call pattern. A risk index that crossed its
  threshold and fell back within one call would not be recorded at 30× but would be at 1×. It did not
  happen in any of the 82 arms (critical errors are part of the complete-state census and are
  identical), it is not alarm history, and it is flagged as a follow-up rather than changed here.
- **Acknowledging one alarm re-stamps the others.** `ACK_ALARM` with an `alarmId` sets the new
  `acknowledgedAt` on every history entry that was already acknowledged (MV-01: SpO₂ low acknowledged
  at 6 s reads 15 s after high pressure is acknowledged at 15 s, and the next step publishes that).
  Pre-existing, independent of speed (it happens at the action's model time), unchanged.
- Paused alarm-limit changes still show on the console only once time advances (§16), unchanged.
- The pre-existing items outside this repair are not worsened and stay open: repeated comfort
  effects (§16.2), the 4 s hold spanning a cycle, the **One breath** time grid (§16.1), and the
  mode-change boundary's fixed-grid assumption (§16.1).

### 17.10 D1–D5 — all `NOT REVIEWED`

Unchanged from §16.6. D4 (device-specific alarm policy) now also holds whether a returning alarm
should be a new, unacknowledged episode.

### 17.11 Integration

`origin/main` `a306d825` did not move during this pass; the branch is not rebased or merged.
`git merge-tree --write-tree origin/main HEAD` is clean. The repair and documentation commits are
pushed to `claude/mechanical-vent-02-9-22` as fast-forwards on PR #271. Not merged, not deployed;
Batch 03 not started; the rest of Batch 02 not reopened.

### 17.12 NOT RUN in this pass

- Pointer-driven input (pane hidden; DOM `click()` used), Firefox, Safari, hardware, assistive
  technology, zoom / 200 % text / 320 px, dark scheme, es and zh-CN.
- Real-time playback at 1× / 5× / 30× in the browser: the hidden pane suspends the page clock. Speeds
  are covered by the engine census; the browser path used **One breath** (2.5 s and 3 s calls), itself
  a coarse batching.
- A browser walk of every arm; the deployed build; beta-wrapped routes.
- Any clinical, device, media or source review; D1–D5.

## Stop

One PR, opened and stopped. No merge, no deploy, no batch 03, no G02 restart. The sanity-repair pass
(§15) pushed five bounded repairs to the same PR and stopped there; the re-review pass (§16) pushed
three more and stopped there; the final-gate pass (§17) pushed one alarm-history repair and stopped
there.
