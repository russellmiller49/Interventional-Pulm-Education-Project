# MCS-PRE-REVIEW-02 — independent sanity review

**SANITY REVIEW: NOT READY TO MERGE**

This disposition applies to PR #264 at its unchanged reviewed head. Concrete defects were reproduced,
then repaired on a separate local Codex branch. The repair is not on Claude's PR branch. Integrate
and review that patch before reconsidering the PR; this is not clinical validation or owner approval.

## Revisions and scope

| Item                                   | Revision                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| Authorized base                        | `c1fb8a0d4d0704ea7fc3050d34512104edba79b7`                   |
| Reviewed PR head                       | `0edf4e05c0108713a78765832c7e416c0da98cf1`                   |
| PR commits                             | `7bc5bd13b800b80bbd7cfbfae4821448d9dce41a`, then `0edf4e05…` |
| First implementation commit's parent   | Exact authorized base above                                  |
| Main at review start                   | `d98bab79af9231eb1857e2da96cb75ca2068d85c`                   |
| Latest main checked                    | `bf613270a37a30cfd31a915a33758b808dfbff89`                   |
| Merge base, main / PR                  | `c1fb8a0d4d0704ea7fc3050d34512104edba79b7`                   |
| Local core repair                      | `0f9a2220fc401d4f2dc0b724c35695a1d92e47aa`                   |
| Compact-table repair / final code head | `bd1e95bf87d0f4ae67996ae5efc75ccae526baab`                   |
| Local branch                           | `codex/mcs-pre-review-02-sanity`                             |

[PR #264](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/264)
was MERGEABLE/CLEAN at initial inspection. A later GitHub response briefly returned UNKNOWN after
main advanced; local disposable merges independently established clean integration. Final GitHub
status is saved with the evidence. No force-push, PR-branch edit, main commit, deployment, or
Prompt-03 implementation occurred. Only disposable integration trees combine revisions locally.

Read the repository instructions, local-data map, implementation-pack contracts and ledger,
source/code notes, coordination and owner decisions, original fellow walkthrough, Prompt-01
handoff/review, entire PR diff before its tests, Prompt-02 handoff/packet and claim queue. The
walkthrough is an AI-persona report, not human validation. The interventional-pulm-education,
medical-education-modules, structured-medical-modules and PDF skills informed the review.

## Engine classification and numerical invariance

| Engine change in original PR                                              | Class | Independent result                                                      |
| ------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------- |
| Five named constants: 0.58, 100, 2.8, 0.42, 2.5                           | A     | Exact extraction of unchanged literals                                  |
| Named circulating-volume factor in existing minimum                       | A     | Same operands, clamps and ordering                                      |
| Limiter names, IABP/Impella/LVAD diagnostic objects, required state field | B     | Published existing intermediates; no feedback into physical computation |
| Alarm labels and explanations                                             | C     | IDs/predicates unchanged; wording reviewed separately below             |
| Numerical / physiological behavior                                        | D     | **None found**                                                          |

Independent `probe.cjs` bundles each revision's actual production model/reducer with esbuild. It
runs 61 plans with seeds 417 and 913: reference/no-action; RV weakening/restoration; low/high
preload; mixed dysfunction; RP off/on; malposition; high support; afterload; high-power flag;
stopped/disconnected support; AF and sinus with all three triggers; all five IABP references;
and every case. It compares initial and settled states, each action, 0.02/0.48/7.5/44-second
advances, inspection, reassessment, explanation/completion and reset. Filled/underfilled P6/P8
replays are also compared.

**1,422 exact deep comparisons passed for base versus original head, and again for base versus
local repairs.** Compared: patient/device/parameters, all compartments, support transfers,
all pre-existing derived metrics, complete waveforms and trends, alarm objects except intentional
prose, time/seed, action IDs, critical errors, score, mastery, completion, criterion thresholds,
held status and evaluated predicates. Diagnostics and intentional prose are excluded. Display
geometry is inspected separately. No unexplained numerical exception exists. Transfer/story
choice IDs and keys, every case ID and success condition also match the base.

Read-only build instrumentation exposes the existing local variables immediately before
`deriveMcsMetrics` returns; it does not replace or duplicate a physiological equation. This supplies
unrounded wedge/LVEDV evidence where the public metrics already round them.

## Reproduced defects and repairs

1. **Replay arms were not matched.** Original zero/one/two-action arms ended at
   16.00/16.02/16.04 seconds because reducer refresh advances one fixed step. The existing test
   tolerated a 0.05-second mismatch while claiming identical time. The repair aligns each action
   slot using production advancement, then observes all arms equally. It rejects differing
   observation intervals. A flag-only arm now has exactly equal modeled flow to control and +2.8 W.
2. **F24 delta claims exceeded available data.** Rounded metrics were compared to idle-drift
   deadbands and zero was printed as “+0 … below this model's resolution.” A displayed 0.40
   difference could fall below 0.4 through binary subtraction. Nonzero rounded differences now
   print normally; equal displayed values say “No resolvable displayed change.” No false precision
   or unsupported temporal ordering remains. The additional column also overflowed the compact
   table; a labeled, focusable local scroll region and wrapping delta text now make it reachable.
3. **F21/F25 documentation generalized a limited sample.** All three preload branches are
   reachable, including settled LV-compartment-limited suction. The wedge has a small indirect
   RV response. Corrected the packet, handoff and teaching copy; no recalibration.
4. **The limiter explanation conflated circulating volume with the LV compartment and monitor.**
   Each branch now names its actual input; the scale is dimensionless and can exceed one.
   The alarm states the full running/P5/minimum predicate and remains explicitly model-only.
5. **F17 SVG footer clipped.** Its second line occupied 385.68 SVG units in a 320-unit viewBox.
   Reproduced in desktop/mobile screenshots. Moved prose into a wrapping HTML caption without
   moving contour points. Clarified that late-deflation bands can spill into an unassisted beat.
6. **F26 compared response magnitude to a bedside fluid challenge without support.** Replaced
   that claim with a model-scale boundary; no dose/rate and isolated-story identity remain.
7. **F27 cost prose named only one of two possible factors.** It now describes the actual
   minimum and the percentage relative to otherwise identical modeled loading, not a measured
   outlet cost or percentage of the speed-only request.
8. **F28 contradictory estimate labels remained.** Durable monitor/flow-account labels and
   transfer copy now identify modeled transfer; real controller estimates remain source-specific.
   Added the exact modeled-transfer/rounded-display/systemic-delivery distinction to the reachable
   Section-8 panel. Section-7's standalone teaching component is not mounted by the current stage;
   browser evidence does not pretend otherwise.
9. **F29 key rationale recommended against LV unloading too broadly.** Narrowed it to the
   observed failure of level escalation to resolve this model's RV-delivery minimum.
10. **F35 debrief claimed the learner had changed the RV even after no action.** It now identifies
    a worked comparison, explicitly disclaims an action taken by the learner, and states both
    authored criteria without making them clinical targets.
11. **Proposed 0.26 blend arithmetic was misleading.** A direct post-hoc blend produces rounded
    reference/RV-weakened/LV-weakened wedge values 19/18/23, not 20/18/24. The proposal now says
    it does change the reference value and is neither a coupled-model replay nor an approved spec.

Three new independent tests were run and failed before repairs (timing, deltas, branch explanation).
All five final independent tests pass, including a minimum tie and mismatched-interval rejection.
Existing assertions that enshrined wrong wording/timing were corrected; clinical keys were not.

## Diagnostics and state lifecycle

All writers are constructor/advance paths in `engine/model.ts`. Readers are teaching selectors and
test/replay code; no reader feeds a diagnostic back into flow, criteria, scoring, completion or
interlocks. The required TypeScript field is populated at creation and each refresh. Independent
checks compare it to a fresh production support computation at initial state, after each control,
after advancement and after reset across all three limiter branches. Reordered replay arms match.

Retry/restart, explanation-before-answer, capture/revisit and persistence suites pass. Browser
case explanation → baseline retry → explanation → reload succeeds for LVAD-02, IABP-02 and
CAP-IABP-01. No answer is required. Progress stores visits/location and historical grades, not
`McsSimulationState`; reload constructs new state. No legacy simulation hydration path needs a
diagnostics migration. No new scores, attempt log or patient-state persistence was introduced.

## Findings and quantitative evidence

All compared intervention arms below use the same seed, constructed baseline, aligned action
slots and observation interval. Unless stated otherwise: eight-second settle and eight-second
observation. Slots can add 0.02 seconds each. Historical numbers from differently timed replays
are not represented as identical measurements.

### F14 — reference patient versus transfer

Authorized base has the “low native output” wording but transfer native flow is 4.46 L/min versus
4.51 control, wedge 26 versus 20, LVEDV 149 versus 134 at matched time. Head correctly removes
the unsupported low-output assertion, preserving the patient, keys and high-pressure problem.
This does not call 4.46 universally normal or invent a 2.5–3 L/min patient.

### F17 — source, live trace and authored contour

Read and rendered Getinge _The IABP Numbers Game_, local `the_iabp_numbers_game_booklet-83440-en.pdf`,
printed p.3 / PDF p.5. SHA256:
`2870fecd9fb6d8d605e323fe9352e9040e23462431a00e9837e60a342a8e2580`.
The source supports the five landmark relationships: ideal augmentation above systole, inflation
at the notch/sharp V, lower assisted end-diastolic pressure after deflation before ejection,
and lower assisted systole. The quoted source page supplies no universal 15–20 mm Hg decrement.
The module draws its own polyline; no source image was copied. Geometry is schematic, not a
validated clinical magnitude. Source-specific “ideally” is preserved; rights/device review stays open.

Production inflation/deflation derive from cardiac phase (0.42/0.92 plus millisecond offsets,
bounded phase ranges), assist ratio selects beats, and prior-assisted-beat state accounts for late
spill across a cycle boundary. The sampled augmentation bump does not implement the complete
clinical deflation contour. Original/head samples match exactly. At the actual ±120 ms demonstration
settings, min/max arterial samples in mm Hg are:

| Aligned     | Early inflation | Late inflation | Early deflation | Late deflation |
| ----------- | --------------- | -------------- | --------------- | -------------- |
| 56.02–98.36 | 53.12–96.05     | 56.87–96.63    | 56.36–96.68     | 47.77–87.57    |

All five fit 40–120 without clipping. Live timing events remain visible beside the authored
reference; its explicit not-this-patient/not-model-output labels and coordinate-only magnitude
warning remain. The original augmented peak near 92 versus systolic near 98 and ~0.5 mm Hg
assisted/unassisted end-diastolic difference remain contained, not tuned. Authored recognition is
not equivalent to live clinical waveform practice. The source citation is a teaching anchor, not approval.

### F19 — contained, not corrected

AF ECG/pressure/internal ratings remain **50/74/40**, with the original **0.6** threshold.
Base/head equivalence covers all triggers, sinus and stopped controls. Prompt-01 containment remains
in Learn, headers/alarms, cases and worked results; IABP-02 and CAP-IABP-01 each render their held
condition without reporting achievement. Held conditions stay excluded from scoring.

Read the exact supplied Cardiosave troubleshooting booklet, printed pp.3 and 5 / PDF pp.5 and 7.
SHA256: `98fe5bc2fc0e6927c527e79212236a7f10eaee6eaae5944837555d836940c468`.
It favors adequate ECG/R-wave triggering in arrhythmia, cautions against pressure triggering in
sustained irregular rhythm and against remaining on internal triggering with native output.
It supplies no implementable synchrony equation that would justify changing these coefficients.
Other Cardiosave revisions/jurisdictions were not treated as the same IFU. MCS-03-05 remains NOT REVIEWED.

### F21/F25 — three minima, indirect wedge response, OD-03 remains open

Reference RV 0.85 → 0.20: RAP **11 → 22**, effective flow **4.51 → 2.55**, displayed wedge
**20 → 20**, LVEDV **134 → 127**. Conserved LV volume is **238.53 → 175.13 mL**, pulmonary-venous
pressure **16.2799 → 11.6628 mm Hg**. Unrounded derived wedge changes **20.4214 → 20.0727**:
small indirect response, then rounding. It is distinct from the pulmonary-venous compartment pressure.

Fourteen supported-control combinations were sampled at 0/0.2/1/8/30/60 seconds, including low/high
preload, severe RV/LV dysfunction, high PVR, tamponade, PEEP, tachycardia, high support, RP and combinations.
Counterexamples to the original universal RV-limit claim:

- Reference at 0.2 s: LV compartment **97.81 mL**, filling factor **0.857**, LV minimum.
- Preload 50%, RV 1.4, PVR 0.5: circulating volume **0.556**, minimum at early and settled times,
  active suction with default P5.
- Add LV 1.4 and P9: at 60 s LV compartment **45.76 mL**, filling factor **0.244**, active suction.
- Durable low-volume/strong-contractility at 60 s: LV filling **0.186**, LV minimum; suction is
  **false** because the full durable predicate also requires sufficient device flow. No branch
  name alone establishes suction.

Ties name RV first, LV second, circulating volume last; the named factor is one minimum.
These counterexamples refute universal inertness, not establish clinical validity. Neither LV
filling calibration nor displayed-pressure coupling is changed; both remain OD-03.

### F24 — rounded data and positive control

| Filled comparison | LVEDV display | Wedge display | Left flow display |
| ----------------- | ------------- | ------------- | ----------------- |
| P5 → P6           | 118 → 114     | 18 → 18       | 2.44 → 2.84       |
| P5 → P8           | 118 → 107     | 18 → 17       | 2.44 → 3.49       |

Production raw P5/P6/P8 LVEDV: **117.571478 / 113.886478 / 107.200820**; wedge:
**18.315595 / 17.794018 / 16.912329**. Underfilled raw wedge:
**10.886208 / 10.588348 / 10.043568**. UI receives rounded metrics, not those locals.
P6 now says “No resolvable displayed change” for wedge, −4 mL and +0.40 L/min for the others;
P8 prints −1 mm Hg, −11 mL, +1.05 L/min. Unrounded evidence supports a model response, not clinical
unloading magnitude. No amplitude, baseline or false decimal precision was added.

### F26 — isolated volume story

Production total circulating volume is `4100 × fraction + 260`: 55% → 100% gives
**2515 → 4360 mL**, **+1845 mL**. This rescales the entire model; it is not administered fluid.
Story controls/baselines remain isolated from the live section. Both stories ran before any answer,
repeated identically after retry and retained no-dose/no-rate wording. No RV-failure contrast shipped.

### F27 — unsupported baseline alarm versus the actual multiplier

The full alarm predicate includes running support and `baseline.mapMmHg > 100`.
It does not read displayed MAP or decide which factor currently limits transfer.

| State                  | Displayed MAP | Baseline MAP | Pump flow |
| ---------------------- | ------------- | ------------ | --------- |
| Reference              | 103           | 67.5         | 3.80      |
| SVR 1400               | 116           | 74.5         | 3.58      |
| SVR 1900               | 140           | 87.2         | 3.18      |
| SVR 2200               | 153           | 96.0         | 2.99      |
| SVR 2200, preload 145% | 155           | 119.5        | 3.47      |

The diagnostic carries exactly the flow formula's minimum of the baseline-derived and conserved
arterial-minus-pulmonary-venous gradient factors. Full compartment pressures and unrounded factors
are in the JSON evidence. Early high-SVR/high-volume state: baseline factor **0.809** versus gradient
factor **1.000**; the baseline factor wins. Later the gradient factor wins. The multiplier's
percentage is conditional on otherwise identical modeled filling/tamponade factors, not a clinical
cost or speed-only flow deficit. The unchanged threshold remains authored, OD-02/OD-04.

### F28 — generic model, source-specific HM3 comparison

Speed/loading generate modeled transfer, power is derived afterward, and the flag adds **2.8 W**.
Matched flag/control have identical flow. No hematocrit term or Abbott estimator exists. Checked
all HeartMate/HM3/controller/estimated-flow wording across MCS; repaired contradictory durable
surface labels and kept source-specific hardware statements distinct from generic simulation.

Read [Abbott's official parameter card](https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/hcp/education-training/heart-failure/documents/hf-heartmate3-lvad-pump-parameters.pdf):
measured electrical power, estimated flow using speed/power/hematocrit, no full algorithm on the card.
No reverse engineering or estimator-bias simulation is claimed. Modeled transfer, its rounded
display and effective systemic flow remain separate concepts. Product identity stays OD-02.

### F29 — congestion and limitation answer different questions

Starting matched state: RAP **18**, wedge **18**, ratio **1.00**, PAPi **0.5**, effective flow
**2.74** (phase-dependent rounded 2.75 in the original sample), suction active, RV minimum.
The panel correctly says biventricular congestion under its existing framework. P8 gives left flow
**0.51 → 0.76**, effective **2.74 → 2.95**, suction retained. RP gives left flow **1.25** and effective
**3.60**. Read stem, options, feedback, transfer and debrief: no modest-wedge assertion or lower
wedge was invented, no panel was hidden, and the key was not changed. The bounded repair avoids
turning this comparison into a general recommendation against left unloading.

### F35 — entire LVAD-02 condition, not PAPi alone

| Arm        | PAPi | RAP | Pump flow | Effective flow | Both conditions met? |
| ---------- | ---- | --- | --------- | -------------- | -------------------- |
| No action  | 0.5  | 20  | 1.16      | 3.12           | No                   |
| RV → 0.9   | 1.6  | 11  | 2.82      | 5.22           | Yes                  |
| PVR → 2.5  | 0.5  | 18  | 1.52      | 3.62           | No                   |
| Both       | 2.1  | 8   | 3.66      | 6.03           | Yes                  |
| Speed 5800 | 0.5  | 20  | 1.34      | 3.26           | No                   |

PAPi is not flat, and success requires **PAPi ≥1 AND device flow ≥2.8**. No re-key or threshold
change was necessary. Derived-value guidance retains cohort/phenotype limitations and no universal
normal interval. The repaired no-action debrief identifies the RV-restoration worked example,
not a learner action, and does not make either criterion a treatment target.

## Owner packet audit

OD-01/02/03/04 remain questions for owners, with OD-06 rights and OD-08 release decisions also open.
All ten claim-queue entries still have **NOT REVIEWED**, reviewer/role/date/version/requiredChanges/
disagreement null. MCS-03-05 is untouched by this repair. The original PR's queue change only records
MCS-03-07 wording history; it does not grant approval. Packet corrections distinguish observed facts,
source statements, interpretation and future proposals. The 0.26 blend, recalibration, afterload
repointing and RV-volume story remain unimplemented. Historical handoff observations are explicitly
superseded where inaccurate rather than represented as exact new measurements.

## Verification and browser evidence

| Check                     | Result                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Original MCS + routes     | 79 suites / 1,238 tests pass                                                                           |
| Repaired MCS + routes     | 80 suites / 1,243 tests pass                                                                           |
| Independent tests         | Three failed on original; final five pass                                                              |
| Model invariance          | 1,422 exact checks base/original; 1,422 base/repaired                                                  |
| Full original suite       | 918 passed suites, 9 failed, 2 skipped; 13,602 passed tests, 8 failed, 3 skipped, 1 todo               |
| Full authorized base      | 917 passed suites, same 9 failures, 2 skipped; 13,572 passed tests, same 8 failures, 3 skipped, 1 todo |
| TypeScript                | Repaired pass; integration pass with 8 GB Node heap                                                    |
| ESLint                    | Entire MCS feature, `--max-warnings=0`, pass                                                           |
| Prettier / diff check     | All repair paths pass; commit hooks pass                                                               |
| Repaired production build | Pass at `0f9a2220`; final table repair also built in latest-main integration                           |
| Latest-main integration   | Clean merge; type check and final production build pass; original 79/1,238 and repaired 80/1,243 pass  |

Full-suite failure signatures match exactly: critical-care accessibility, curriculum sequencing,
learner copy; brochure static scan; US-status safety boundary; training-app test-suite loading;
literature migration count; BBT public-route contract; board-review locale fallback. Their
normalized failing test names and both JSON results are preserved. An earlier full run overlapped
edits and is explicitly discarded; the reported original run is from an immutable detached checkout.

Browser: Chromium/Playwright, 1440×1000 and 390×844 (first original screenshot 1440×900).
Visited every step in affected lessons 3–9, all five timing references, F24 P6/P8/reset, Section-4
explanations, suction/limiter panel, both story examples and retry, Section-9 congestion and key,
Section-7 generic boundary and reachable Section-8 afterload/alarm evidence. LVAD-02/IABP-02/
CAP-IABP-01 explanation-before-answer, restart, repeat and reload also pass. No page errors in
completed lesson/case runs. The inherited worked-case debrief lays out its content in a very narrow first grid column even
on desktop; it and unchanged fixed-header/compact-layout issues
are not certified as a general responsive redesign; Prompt 03 was not started.

Screenshots were actually captured and inspected. The authored caption now wraps at 390 px and
at root font size 200% without horizontal document overflow. The four-column unloading table
now scrolls within its labeled keyboard-focusable region at 390 px and 200% text; its rightmost
delta cells are reachable rather than clipped. The extra table repair passes 14 relevant tests. Used the application's actual theme
toggle in both directions and also recorded geometry/style probes. At 200% text, fixed site chrome
can overlap a long element screenshot; it is documented as an existing surrounding-layout issue,
not concealed or claimed repaired. The standalone Section-7 teaching component remains unmounted;
its logic is tested, while live browser claims refer only to reachable content.

Case clicks before hydration and optional prerequisite screens initially caused automation waits;
reruns used the actual prerequisite button and hydrated controls. No forced clicks or simulated
physiology bypass were used. Analytics was stubbed with HTTP 204 in browser probes; no patient,
model, source, authentication or database response was fabricated. Local credentials were not copied.

Production setup limitations: a first disposable build lacked nested training-app dependencies;
reused installed dependencies and reran. A fresh `tsc` hit the default 4 GB heap; 8 GB rerun passed.
No source/config changes were made to evade these checks. Build warnings are retained in logs.

## Clinical release holds and boundary

Still unsuitable as validated clinical/device training: AF trigger selection and its two held cases;
live IABP clinical contour recognition; generic durable-pump/controller-estimator and high-afterload
interpretation; unvalidated suction/pressure coupling and volume-response magnitudes; all twelve
cases' authored numerical conditions. Device scope, source/IFU reconciliation, rights and owner
approvals remain open. A repaired technical baseline does not resolve any of these holds.

**No PR was merged. Nothing was deployed. Prompt 03 was not started.**
Shared ChoiceReasoningFeedback and hemodynamics-core were not edited; Prompt-01 AF containment
was not removed. The separate local patch preserves Claude's exclusive branch ownership.

## Evidence location and replay

Local derived evidence: `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/mcs-pre-review-02-sanity-2026-09-22`.

Key files: `probe.cjs`, `head-results.json`, `repaired-model-results.json`, `additional-results.json`,
`independent-original-failures.log`, `full-suite-comparison.json`, immutable `original-full.json` and
`base-full.json`, focused/type/lint/format/build logs, `browser-results.json` (sections 3–5),
`browser-sections6-9.json`, `browser-cases.json`, `browser-extra.json`, geometry JSON and PNGs.
`original.diff` and `changed-files.txt` preserve the complete 23-file PR scope; `repair.patch`
preserves the separate reviewed repair. Raw source PDFs and authoring inputs were not committed.

To reproduce the cross-revision analysis, create a detached authorized-base checkout with access
to the same installed dependencies, run from the desired head checkout and set
`MCS_REVIEW_BASE_DIR` to that base and `MCS_REVIEW_OUTPUT_DIR` to a writable evidence directory.
Run `node /absolute/path/to/probe.cjs head`. The helper bundles production code and asserts exact
physical equality; it exits on any mismatch. It never changes either checkout's source.
