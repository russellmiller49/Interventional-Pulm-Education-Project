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

The breath grid stays absolute — which keeps a patient-triggered breath aligned with the neural
effort — but a new cycle length is adopted only between breaths, and only when it would not shorten
the expiration in progress. Constant-rate schedules are bit-identical to base.

### Gas provenance (`presentingGas` in `runtimeCases.ts`; `engine/arterialGas.ts`)

Missing HCO₃⁻ from the supplied pH and PaCO₂; missing PaO₂ from the supplied SpO₂ on the engine's
curve; each value tagged `case-source` / `derived` / `model-default`; the baseline specimen carries
it; labels say "Starting gas set by the simulator — this case supplies no presenting blood gas"
(MV-04, 09, 10, 11, 13, 14, 15) or "…completed by the simulator" (MV-05, 06, 07, 08, 12), with a line
naming what was derived and from what. The authored casebook file is unchanged.

### Readiness, reportability and teaching surfaces

- `measurements.exhaledVtSource`; `content/measurementReadiness.ts`; consoles print `---`, panels
  "Awaiting a completed breath", `VT_LOW` and the coaching VT reading require an exhaled breath.
- Deep sedation and neuromuscular blockade set `canCommunicate` false. Practice bedside: dyspnea
  gated on assessment like pain and delirium, labelled "Patient report · modeled" or "Internal index ·
  not a patient report"; pain labelled likewise; the consciousness boundary printed beside them.
  Section 13 and the dyssynchrony panel follow the same contract; coaching dyspnea/pain readings are
  null when the patient cannot report.
- PEEP band `ardsPeepBand` (8 ≤ PEEP < 14 recruited) for lung state and resolution.
- Section 9: time-control sentence computed from the arms (`peepComparisonTimeControl`); live panel
  names its trend window and says "not yet trended" without one. Section 10: the model stated
  (`data-co2-model`), descriptors named as unused. Section 13: MV-14's real opening alarms as a
  labelled separate reference when the live patient has none (`content/referenceAlarmSet.ts`).
- Practice: MV-13's stem mismatch stated beside it; MV-06/12/14 explanation notes where the authored
  expected response claims what the model does not do (`content/caseModelNotes.ts`).

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
| MV-01            | PEEP 13                                  | 422 · 29.3/18.3 · 0.1 · 92 · 52 · 77 · 1.0         | same control                                |
| MV-01            | PEEP 16                                  | 422 · 42.4/31.4 · 0 · 91 · 52 · **60** · 3.0       | same control                                |
| MV-01            | FiO₂ 100                                 | 422 · 24.9/13.9 · 0 · 96 · 52 · 77 · 3.0           | same control                                |
| MV-02            | flow 70 + treat drive                    | 397 · 23.8/5.5 · 1.1 · 94 · 30 · 73 · **5.0**      | 387 · 17.4/6.2 · 1 · 94 · 30 · 73 · 6.0     |
| MV-05            | PS 12 + ETS 40 (+ hold)                  | **321** · 17/7.1 · **6.1** · 92 · 39 · 97 · 0.4    | 229 · 23/13.3 · 13.5 · 92 · 62 · 88 · 3.0   |
| MV-05            | PS 24 (harmful)                          | 347 · 29/17.4 · **16.2** · 92 · 49 · **82** · 4.3  | same control                                |
| MV-06            | bag + bronchodilator + rate 10 + flow 80 | 507 · 62.2/12 · **7.5** · 94 · 86 · 42 · 3.9       | 500 · 70.2/39.3 · 33.9 · 94 · 85 · 42 · 3.0 |
| MV-06            | rate 30 (harmful)                        | 500 · 80/49.2 · 42.2 · 94 · 75 · **25** · 3.0      | same control                                |
| MV-08 condensate | inspect + drain                          | 433 · 14.8/11.2 · 0 · 98 · **43** · 90 · 0.0       | 235 · 14.9/11.1 · 0.4 · 98 · 29 · 90 · 3.0  |
| MV-12            | PS 11 only                               | 506 · 16/9.2 · 0 · 97 · 33 · 82 · 0.0              | 643 · 26.9/17.5 · 0 · 97 · 28 · 82 · 3.0    |
| MV-13 secretions | inspect + suction                        | 460 · **22.7**/8.7 · 0.2 · 88 · 43 · 95 · 1.0      | 461 · 43.7/10.6 · 2.1 · 88 · 43 · 95 · 3.0  |
| MV-13 secretions | bronchodilator (wrong branch)            | identical to control                               | —                                           |
| MV-14 unstable   | decompress + drainage                    | 420 · **28.2/16.2** · 0.1 · 76 · 42 · **68** · 1.0 | 420 · 58/46 · 0 · 76 · 42 · 42 · 3.0        |
| MV-15            | ask and treat                            | 448 · 16/7.5 · 0.8 · 94 · 39 · 103 · **3.6**       | 392 · 12.9/7.4 · 0.7 · 94 · 42 · 103 · 8.0  |
| MV-15            | deepen sedation                          | 131 · 12.7/9.8 · 0.4 · 94 · **75** · 103 · 2.1†    | same control                                |

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
- A new breath period is adopted only between breaths.
- `exhaledVtSource: 'predicted'` is never printed as an exhaled volume.
- `physiologyReference` and `breathClock` stay in-memory; MV-03 stays excluded; the alarm-limit item
  stays held.

## Stop

One PR, opened and stopped. No merge, no deploy, no batch 03, no G02 restart.
