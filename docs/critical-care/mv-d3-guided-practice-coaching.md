# MV D3 — post-action coaching in Guided Practice

What changed, when it is allowed to speak, and what was measured. Companion to
[`mv-d0-d1-novice-runway.md`](./mv-d0-d1-novice-runway.md) and
[`mv-d2-standard-laptop-workspace.md`](./mv-d2-standard-laptop-workspace.md), which recorded
"Practice and Assess timing" as deliberately unchanged and left this as the next open item.

The objective was to give the Practice learner a concise explanation of what their action did —
without turning Practice into Learn, and without releasing anything before they have acted and
watched. No engine behaviour, no scoring, no storage payload, no activity or case identifier, and no
Assess surface changed.

## 1. The timing contract

```
commit ─────▶ act ─────▶ observe ─────▶ coaching ─────▶ … ─────▶ full debrief
   │           │            │                │                        │
   │           │            │                │                        └ unchanged: definition.debrief,
   │           │            │                │                          expected actions, accepted
   │           │            │                │                          alternatives, branch resolution
   │           │            │                └ concise, branch-specific, built from the readings
   │           │            └ the case's own authored latency for this action, then one of
   │           │              this patient's breaths, both frozen at the moment of the action
   │           └ PERFORM_INTERVENTION; the existing action response is unchanged
   └ COMMIT_PREDICTION records the frame and says nothing about it
```

**Exactly when coaching appears.** `ventilationPostActionCoaching` returns `null` — so the block does
not render at all — unless every one of these holds:

1. `state.experience === 'practice'` — the independent Practice workflow. A guided run has already
   put its mechanism on the screen, so there is nothing being withheld for coaching to release.
2. the Practice **section**, not Assess. `MechanicalVentilationCaseActivityV2` passes
   `coachingEnabled={section === 'practice'}`, and the model checks (1) for itself rather than
   trusting the flag.
3. `state.prediction.committed` — nothing here can precede the commitment.
4. an action has been performed, and the supplied baseline is that action's.
5. `state.simulationTime >= max(record.effectiveAt, record.time + latencySeconds) + settle`, where
   `settle` is one of this patient's breaths, or one length of the displayed trace where the targeted
   reading is computed from that trace.

Between (4) and (5) the workspace shows one neutral line — "The response to this action is still
developing. Read the patient and the traces while it does." — carrying no mechanism, no direction,
and no verdict.

**The observation interval is not a new number.** It is composed only of quantities that already
existed:

| Term                                        | Where it comes from                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `record.effectiveAt`                        | `applyIntervention` has always stamped this from the case's own `latencySeconds`. Until it is reached, `performedEffectIds` excludes the action, so the model genuinely has not responded.                                                                                                                                                                                                                                                                |
| the action's own `latencySeconds`           | Taken as the later of the two. `effectiveAt` is stamped as _immediate_ for an assessment or ventilator action because the effect reaches the **model** at once; the authored latency is a different statement — how long before the learner can read the result. Ordering a gas is authored at 60 s and stamped immediate, so `effectiveAt` alone closed the interval after one breath and latched "the sample has not resulted yet" as the whole report. |
| one breath                                  | `60 / totalRatePerMin` at the moment of the action. The module's own observation vocabulary is already "advance one breath for reassessment" (`ventilationLessonObservationActions`).                                                                                                                                                                                                                                                                     |
| one trace, where the target is read off one | `WAVEFORM_WINDOW_SECONDS`. The displayed peak is the maximum over the whole buffer and the exhaled breath is integrated from it, so neither can report a change until the buffer holds breaths taken after it. Measured on MV-13: suction drops resistance from 30 to 12 the instant the effect lands, and the printed peak sits at 43 cmH₂O for a further 11 seconds before falling to 24.                                                               |

**The block is latched when the interval closes, and is not recomputed afterwards.** It is a report
of the interval the learner watched, not a second monitor. Re-deriving it live meant the parent's
10 Hz tick rewrote the readings and the verdict underneath the learner, with `role="status"`
re-announcing each version.

The breath period is frozen into the baseline rather than read live, because several of these actions
change the rate and a live read would move the finish line. Measured across all fifteen cases and
every prerequisite-free action, the interval is strictly greater than zero in every case — a test
asserts it, so a future action with `latencySeconds: 0` cannot silently make coaching immediate.

**Pausing holds it.** The gate is on `simulationTime`, and a paused `TICK` is a no-op, so a paused
workspace never crosses the interval.

**Safety is untouched.** `state.criticalErrors` renders in the same `role="alert"` box, in the same
place, at the same instant it always did. Coaching is placed _after_ it in the section so a block
that arrives later cannot push the interruption down the screen.

## 2. What the coaching says, and how it is derived

Three claims, kept visibly apart, in this order:

| Block                                     | Content                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Readings                                  | Before → after, at the precision the console and bedside print, with a direction word |
| **What you observed**                     | One sentence naming what moved and what did not                                       |
| **What that supports**                    | What the action does, and what the _targeted_ reading moving or not moving supports   |
| **What it has not shown**                 | The limits of that inference, in the direction the observation actually went          |
| **Reassess next**                         | The signal to check, and over what span                                               |
| **Another immediate stabilizing action?** | Answered either way, from the ventilator's own active high-priority alarms            |

**Each action names the one reading it moves, and which way.** The expected direction is authored per
action rather than inferred from whether the reading going down is "good": removing a patient's own
effort makes the _displayed_ peak pressure rise, and that rise is the expected finding rather than a
deterioration. The classification is three-way — responded, moved the other way, did not move —
because "moved against the action" and "did not move" are different findings and read differently.

An action whose reading the model derives continuously names no target at all. An expiratory hold
does not move `intrinsicPeepCmH2O`: the console shows it whether or not the valves ever closed.

**Nothing is authored per case.** The model never reads `correctMechanismId`, never reads
`branchResolution`, and never calls `isCaseResolved`. It reads two things: the profile of the action
the learner chose (27 of them, one per intervention effect, in `content/postActionCoaching.ts`), and
the numbers before and after. Branch specificity is therefore emergent: draining condensate on the
patient who has water at the sensor and draining it on the patient who has a leak produce different
numbers, so they produce different coaching, and neither run is told what the other would have been.

**"Changed" is one printed unit, which is a display rule and not a clinical one.** A reading changed
when it differs by at least the smallest amount its surface can print — the resolution of the
instrument, not a statement about how much of a change matters to a patient. Comparing the _rounded_
values instead, which is what this did first, made a rounding boundary into a finding: measured on
MV-13 with no action performed at all, the printed peak wanders 43.8 → 43.2 over the same interval an
action is watched across, and two treatments that reach nothing on that patient were reported as
having lowered the pressure.

The older wording of the same rule follows, and still holds: a reading changed when the number the surface
prints changes. Publishing "a fall of N cmH₂O counts" would be exactly the universal target the rest
of this module refuses to invent; "the number on the screen is different" is a fact about what the
learner can see. No threshold is printed anywhere in the block, including the stabilization answer,
which asks only whether the ventilator is currently raising a high-priority alarm.

**Which readings.** Only what the Practice workspace already shows: peak airway pressure, the
peak-to-plateau difference (subject to `plateauValidity`'s existing rule), trapped end-expiratory
pressure, exhaled breath size, delivered and patient rate, SpO₂, MAP, discomfort, pain, delirium,
sedation level, and PaCO₂ once a repeat gas has resulted. The effort fractions, the relaxed pressures,
and the risk accumulators are hidden model quantities and are excluded.

**A setting changed mid-interval is said out loud.** `SET_CONTROL` records no intervention, so nothing
else would notice a learner who suctioned and then raised PEEP while the suction was developing. The
baseline carries the settings it was taken under, and the block adds a clause when they differ.

**The verdict describes the readings, not the action** — "Readings moved toward better / toward worse
/ both ways", and "No better, no worse". A simulated patient is on a trajectory of its own throughout
the interval, so the block also says so whenever a reading that is not the action's target moved.

### Three worked examples, measured

**Successful** — MV-08, the version with water at the flow sensor, inspected then drained:

> Delivered breath rate 28 → 8 /min · fell (target) · exhaled breath size 235 → 437 mL · rose ·
> peak airway pressure 15 → 15 cmH₂O · unchanged · SpO₂ 94 → 90 % · fell
>
> **What that supports** — This action removes water that was moving near the flow sensor. On the
> readings above, the ventilator had been reading that movement as the start of a breath, and it has
> stopped. Some readings went the other way over the same interval, and both are findings — neither
> cancels the other.
>
> **What it has not shown** — The delivered rate falling toward the patient's own is what a false
> trigger stopping looks like. It does not establish that the trigger is now set where it should be,
> and water re-collects. This patient keeps changing whether or not anyone acts, so a reading that
> moved over this interval is not automatically a reading this action moved.

**Ineffective** — the _same_ action on MV-08's circuit-leak version:

> Delivered breath rate 28 → 28 /min · unchanged (target)
>
> **What that supports** — This action removes water that was moving near the flow sensor. On the
> readings above, water near the sensor is not what the ventilator was answering, because removing it
> did not change how often it delivers a breath.
>
> **What it has not shown** — A rate that did not fall is evidence against condensate being the
> trigger source. It does not exclude another signal in the circuit, and it does not exclude a
> genuinely oversensitive trigger.

Note what is _not_ there: the learner is not told what this patient actually has. A non-response
narrows the differential by one; naming the remaining answer is the debrief's job.

**Harmful** — MV-15, sedation deepened:

> **What that supports** — This action suppresses the visible effort without changing what the effort
> was responding to. On the readings above, the visible effort has fallen — but the mechanism that
> produced it has not been touched, and that effort was what made the mechanism visible.
>
> **What it has not shown** — Quiet is not correction. Suppressing effort removes the signal that was
> telling you where the problem is, and it adds a risk of its own.
>
> **Another immediate stabilizing action?** — Yes. The safety interruption above is open and takes
> precedence over any further localizing.

The safety interruption itself appeared the instant the action was recorded, long before any of this.

## 3. Falsifiability

The timing rule was deliberately broken and the suite re-run. The defect reconstructed is the obvious
one: coach from the commitment, before the learner acts and before the interval — implemented by
removing both gates from `ventilationPostActionCoaching` and building a baseline at
`COMMIT_PREDICTION` in `CaseWorkflow`.

```
6 failed, 14 passed

● cannot produce coaching from a commitment alone, however long the clock runs
● withholds coaching from the moment of the action until the interval completes
● shows the coaching as soon as the interval completes, and drops the waiting notice
● does not advance while the simulation is paused
● keeps the safety interruption immediate, before any coaching is due
● ignores a baseline that belongs to an earlier action
```

The first failure prints the whole block rendered under a committed prediction with no action taken;
the second prints it rendered at the instant of the action. Both gates restored: 21 passed.

A permanent version of the same question lives in the suite —
`cannot produce coaching from a commitment alone` hands the model a baseline whose interval has
_already_ elapsed, so the timing gate cannot be what refuses it, and the refusal has to come from
there being no action to coach.

## 4. Defects found by looking, and by an adversarial pass

**A resumed session reported a change it had never measured.** Reloading mid-case restores the
simulation by replay, so the component mounts with an action already in the state and its effect
already applied. The block appeared, comparing that state with itself, and reported that nothing had
moved for an action whose response had happened before the reload. An action already recorded at
mount is now left uncoached, and the next action taken on this device is coached normally. Found in
the browser, not in the tests; a regression test now covers it.

**The smallest text measured 9.6px.** The first pass used 0.6–0.62rem for the reading labels,
direction words, and claim headings. Measured in Chromium at 1600 × 900 it came out at 9.6px, under
the 10px floor D2 settled on for the paused-trace annotation chips. All five are now `0.65rem`, the
same baseline `--wave-annotation-size` and `.waveformLabel strong` already use — 10.4px, measured, at
every one of the four viewports.

A third correction came out of reading the first render: the non-response caveat ("a rate that did
not fall is evidence against …") was printing under a rate that had just fallen. Each profile now
carries two, because the honest limit of a response and the honest limit of a non-response are
different claims.

An adversarial review pass over the finished package — four independent lenses, every finding then
handed to a separate agent instructed to refute it against the running engine — confirmed six more,
all now fixed and each with a regression test:

| Defect                                                                                                                                                                                                                                                                                                      | Fix                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A reading that moved **against** the action selected the same copy as one that did not move. MV-03 printed "the pressures were already reporting the respiratory system" under a peak that had gone 40 → 42.                                                                                                | Three-way classification, with its own sentence for the opposed case.                                     |
| `reduce-sedation` was keyed on the patient's own rate, which its own model effect cannot move. On MV-04 the learner who performed the case's resolving action was told it was evidence against itself.                                                                                                      | Keyed on the sedation level, which the bedside prints and which the effect does move. Same for deepening. |
| The holds were keyed on readings the model derives continuously, so "this occlusion has not produced a usable trapped-pressure reading" printed under the row showing that reading, on every such case.                                                                                                     | Both holds name no target; the plateau caveat is carried by an explicit flag.                             |
| The block re-derived itself at 10 Hz, so readings and verdict rewrote themselves after release.                                                                                                                                                                                                             | Latched at interval close.                                                                                |
| A ventilator setting changed during the interval was silently folded into the action's response.                                                                                                                                                                                                            | The baseline fingerprints the settings; a change adds a clause.                                           |
| "The safety interruption **above**" — the interruption box is hidden once the debrief opens and the errors move below the block. A revealed reading was also announced as "for the first time", which is false after a second gas order, and its clause opened with a mid-sentence label after a full stop. | Wording, in three places.                                                                                 |

Fourteen further findings from the same pass were raised and refuted.

## 4a. The content-engine correction pass

The timing and presentation above were accepted; five content corrections followed before merge.

### MV-13 — a treatment now only reaches the narrowing this patient has

The case declares three mutually exclusive causes, and `branchCorrected` has always required the
matching treatment before the case will resolve. The mechanics did not agree. `deriveEffectivePatient`
let a bronchodilator relax airway muscle by 60 % on the version whose tube is obstructed, let suction
shave 14 % off a patient with nothing to suction, and let taking out the filter cap resistance at 12
on a bronchospastic patient whose filter was never the problem. The pressure therefore fell for a
reason the model had invented, and the new coaching read a mechanism off it.

`treatmentReachesNarrowing` gates the three resistance mutations on the branch, for the
high-resistance phenotype only. **The intended responses are unchanged; only their reach is.** MV-05,
MV-06 and MV-10 keep the 0.62 and 0.86 multipliers exactly as they were — `remove-hme` and
`reposition-ett` exist only on MV-13 — and a test asserts that suction and a bronchodilator still
lower resistance on all three of those cases.

Measured at the coaching observation point, resistance in cmH₂O/L/s and peak in cmH₂O:

| Branch       | Action             | R before → after | Peak before → after | Target   | Branch rule satisfied | Coaching                      |
| ------------ | ------------------ | ---------------- | ------------------- | -------- | --------------------- | ----------------------------- |
| secretions   | **suction**        | 30 → **12**      | 43 → **25**         | **fell** | **yes**               | credits material in the lumen |
| secretions   | bronchodilator     | 30 → 30          | 43 → 43             | held     | no                    | "does not support …"          |
| secretions   | remove-hme         | 30 → 30          | 44 → 44             | held     | no                    | "does not support …"          |
| secretions   | reposition-ett     | 30 → 30          | 44 → 43             | held     | no                    | "does not support …"          |
| hme-or-ett   | suction            | 30 → 30          | 42 → 43             | held     | no                    | "does not support …"          |
| hme-or-ett   | bronchodilator     | 30 → 30          | 42 → 42             | held     | no                    | "does not support …"          |
| hme-or-ett   | **remove-hme**     | 30 → **12**      | 43 → **23**         | **fell** | **yes**               | credits the apparatus         |
| hme-or-ett   | **reposition-ett** | 30 → **12**      | 43 → **24**         | **fell** | **yes**               | credits the tube              |
| bronchospasm | suction            | 30 → 30          | 42 → 43             | held     | no                    | "does not support …"          |
| bronchospasm | **bronchodilator** | 30 → **12**      | 42 → **24**         | **fell** | **yes**               | credits constricted airways   |
| bronchospasm | remove-hme         | 30 → 30          | 43 → 43             | held     | no                    | "does not support …"          |
| bronchospasm | reposition-ett     | 30 → 30          | 43 → 42             | held     | no                    | "does not support …"          |

Two of those rows needed a second correction. `reposition-ett` on the secretions and bronchospasm
versions changes nothing in the model at all, yet the printed peak moved 44 → 43 and 43 → 42 and the
block credited the tube. Measured with **no action performed**, the printed peak on those patients
wanders 43.8 → 43.2 across the same interval — under one cmH₂O, but across a rounding boundary. The
rule is now one printed unit rather than a change of printed value; no clinical threshold was
introduced. Four of the eight non-matching rows therefore read `small-drift` rather than `held` —
visible, and still carrying no valence, no branch correction, and no credit.

The third correction is the settle term above: with the buffer un-refreshed, even the _matching_
treatments read as `rose` or `held` at the observation point.

Falsifiability: with `treatmentReachesNarrowing` restored to `return true`, **all eight non-matching
rows fail** and the four matching rows still pass. Restored: 46 pass.

### MV-14 — securing the space is judged on the mechanics

The pleural-drainage profile targeted the blood pressure rising, but the engine's drainage effect
raises compliance and does not touch the blood pressure. By the time drainage is established the
circulation has already been rescued by the decompression that must precede it, so a blood pressure
that holds was being read as a drainage that had failed.

Retargeted to the pressure the same breath needs, which on this volume-targeted patient is what
compliance moves. Measured as a real sequence — decompression watched to its own observation point,
then drainage watched to its:

| Step                      | Compliance  | Peak              | MAP     | Target         | Verdict  |
| ------------------------- | ----------- | ----------------- | ------- | -------------- | -------- |
| after decompression       | 28 mL/cmH₂O | 58 cmH₂O          | 42 → 45 | MAP, rose      | improved |
| after definitive drainage | 35 mL/cmH₂O | 58 → **28** cmH₂O | 45 → 68 | **peak, fell** | improved |

The block now teaches that the decompression produced the hemodynamic rescue, that drainage secures
the mechanical response, that blood pressure still has to be watched but is not the reading that
answers whether the drainage responded, and that one interval does not show the space will stay
controlled. A test pins the load-bearing half: with the blood pressure held exactly where the
decompression left it, the drainage is still reported as having responded.

### Neuromuscular blockade

> If blockade is complete and the hold is technically valid, repeat the plateau measurement; active
> respiratory effort no longer confounds the pressure split. Blockade is not a way of obtaining a
> plateau — it is temporary, for immediate lung protection while the cause is corrected, and the
> measurement is a by-product of that decision rather than a reason for it.

Replaces "this is the one condition in which the elastic and resistive split means exactly what it
says", which read as an argument for the maneuver.

### The negative stabilization answer

> No active safety interruption or high-priority ventilator alarm is shown. Continue immediate bedside
> reassessment; those two checks alone do not establish that no stabilization or escalation is needed.

Replaces "no high-priority alarm is active, so continue localizing rather than escalating", which
turned the absence of an alarm into a conclusion about the patient. **The positive paths are
unchanged and still immediate.**

### Non-response language, all 27 profiles

Fourteen profiles asserted a mechanism was absent because one action did not move one reading — "the
tube is not the narrowing", "a leak is not what the trigger was answering", "material in the lumen is
not what is narrowing the path". All now read as evidence about what is dominant:

> the response does not support the tube as the dominant narrowing over this interval — correcting it
> did not change the pressure the same breath needs

A sweep over every action of every case at the pure non-response point bans the categorical
phrasings; it is written as a ban rather than as a required sentence because several honest
non-responses name no mechanism at all — sedation that has not moved is a statement about the dose,
and a communication board is not expected to move a monitor. The separate "What it has not shown"
section is untouched and still carries the limits of both a response and a non-response.

## 5. Browser and render review

**In the browser** (`npm run dev` on the Practice route — mechanical ventilation is public-unlisted,
so no credentials are needed), MV-08 run through commit → 30× → inspect circuit → drain condensate:

| Viewport   | Document scroll | Document h-overflow | Task drawer | Drawer scroll height | Coaching block | Block h-overflow | Nested scrollers | Smallest text | Debug tokens |
| ---------- | --------------- | ------------------- | ----------- | -------------------- | -------------- | ---------------- | ---------------- | ------------- | ------------ |
| 1600 × 900 | 1 px            | 0                   | 448 × 606   | 2550 (1842 without)  | 411 × 708 px   | 0                | 0                | 10.4 px       | none         |
| 1440 × 900 | 1 px            | 0                   | 448 × 606   | 2550                 | 411 × 708 px   | 0                | 0                | 10.4 px       | none         |
| 1280 × 720 | 1 px            | 0                   | 448 × 510   | 2550                 | 411 × 708 px   | 0                | 0                | 10.4 px       | none         |
| 1024 × 768 | 1 px            | 0                   | 448 × 558   | 2550                 | 411 × 708 px   | 0                | 0                | 10.4 px       | none         |

- **No new scroll container.** The Practice task surface is the shared shell's task drawer, an
  `<aside>` with `overflow: auto` that already scrolls. Coaching lengthens its content; its own box is
  unchanged, and the document's 1px is the pre-existing `min-h-screen` rounding, identical before and
  after.
- **Evidence and coaching together.** The existing action response callout is directly above the
  block in every state measured.
- **The coaching does not cover the waveform.** The block's rectangle does not intersect the trace's
  at any of the four viewports. The drawer itself overlays the right of the workbench when the learner
  opens it, which is the shared shell's behaviour and is unchanged: the drawer's geometry is identical
  with the block present and absent.
- **Help and pause.** Help, Reset, and Save & exit are shell chrome and are fully within the viewport
  at all four. The run control sits at a constant offset inside the task pane — 626 px at three
  viewports, 629 px at 1024 × 768 — with the coaching block at 1731 px, below it: appearing cannot
  move it.
- **The block is a report, and stays one.** Captured at 1600 × 900 and left running at 30× for 63
  further simulated seconds: the block's text is byte-identical.
- **Paused annotations** are unchanged, and the D2 e2e contract that measures them at all four widths
  is green.
- **Assess** renders the identical component with `coachingEnabled={false}`, asserted both at the
  component boundary and end-to-end.

**Offline**, `scripts/critical-care/render-mv-practice-coaching.mts` renders all four response
branches at the four widths, each framed at the drawer's measured geometry. The branch is a function
of the attempt number, so reaching MV-08's leak version through the interface means finishing the case
several times; the harness builds each one directly from the engine. `package.json` is locked for this
round, so run it directly:

```bash
npx esbuild scripts/critical-care/render-mv-practice-coaching.mts --bundle --platform=node --format=cjs --log-level=error --loader:.module.css=local-css --outfile=node_modules/.cache/mv-console/practice-coaching.cjs && node node_modules/.cache/mv-console/practice-coaching.cjs
```

**Result: 56/56 blocks — zero horizontal overflow, zero elements crossing the pane edge, zero nested
scrollers, 10.4px smallest text, no internal identifiers, 394px block width.** The frame reproduces
the 52px of shell chrome the app measures between the 448px drawer and the 411px block, so the
harness is the slightly harder case. Content heights 674–877px, inside a pane that already carries
1731px above the block.

| Branch                                        | Verdict                      | Readings | Stabilization required |
| --------------------------------------------- | ---------------------------- | -------- | ---------------------- |
| MV-08 condensate, drained — successful        | Readings moved both ways     | 6        | no                     |
| MV-08 leak, drained — ineffective             | Readings moved toward worse  | 5        | no                     |
| MV-15 sedation deepened — harmful             | Readings moved both ways     | 8        | **yes**                |
| MV-14 decompression — successful, interrupted | Readings moved toward better | 4        | **yes**                |

MV-08's ineffective run reads "toward worse" only because SpO₂ drifted a point over the interval while
nothing the action targets moved; the interpretation says plainly that the action did nothing, and the
drift caveat is printed underneath it. That is the honest reading of the numbers, and it is why the
verdict is worded about the readings rather than about the patient or the action.

## 6. Verification

```
npm run type-check                                 clean
npm run lint                                       0 errors, 0 MV findings (19 pre-existing warnings elsewhere)
npx jest src/features/mechanical-ventilation       22 suites / 553 tests
npx jest src/features/critical-care                23 suites / 194 tests
npx jest src/app                                   28 suites / 244 tests
npm run test:a11y                                  11 passed
npm run validate:critical-care-assets              19 assets validated
npx playwright test e2e/mechanical-ventilation-learn-layout.spec.ts   19 passed
npm run dump:mv-waveforms                          identical to origin/main
npm run render:mv-console                          4 consoles
npm run render:mv-teaching                         10 panels
render-mv-practice-coaching.mts                    56/56 blocks clean (14 runs × 4 widths) at the four widths
```

**No engine change**, proven by construction rather than by eye: the waveform dump's bundle has 31
inputs under `src/` and `scripts/`, and none of them is a file this package touches. The dump reads
`engine/*` and `content/{runtimeCases,deviceProfiles,deviceDisplay,schema,source-cases.v1.json}`; D3
adds `content/postActionCoaching.ts` and `components/PostActionCoachingPanel.tsx` and edits
`components/{CaseWorkflow,MechanicalVentilationCaseActivityV2}.tsx` and the component stylesheet.

## 7. For the owner

### Needs a clinical read

- **The 27 action profiles** in `content/postActionCoaching.ts` — for each intervention effect, the
  reading it moves and which way, what the action does, what a response and a non-response each
  support, what to reassess, and the limits of both readings. This is the substantive new clinical
  copy in the package, and the reading-and-direction pairing is the part most worth checking.
- **The reading valences.** Lower is better for peak pressure, the peak-to-plateau difference, trapped
  pressure, discomfort, pain, and delirium; higher is better for SpO₂ and MAP; breath size, delivered
  rate, patient rate, and PaCO₂ carry no valence and are reported as direction only. Those last four
  are deliberately never counted toward "better" or "worse".
- **Whether "No better, no worse" is the right label** for the case where only a valence-free reading
  moved. It is honest, but it is a judgement about presentation.

### Resolved since the first review

**Suctioning helped a little on every version of MV-13**, which was flagged for the owner and is now
corrected — see §4a. The former note read: `deriveEffectivePatient` multiplies airway
resistance by 0.86 for `suction-airway` on branches where secretions are not the cause, so peak
pressure falls 42 → 38 cmH₂O on the tube-obstruction and bronchospasm versions against 43 → 23 on the
secretions one. The coaching reports the direction it sees and leaves the size to the printed numbers,
and its "what it has not shown" clause says explicitly that a directional response does not establish
that this was the whole narrowing. **No engine change was authorized in this package**, and none was
made; if that 0.86 is not intended, it is an engine question rather than a coaching one.

It was not intended. A narrowly scoped engine correction was authorized and applied; resistance now
moves only for the treatment that reaches this patient's narrowing.

**A safety interruption raised by the action itself is not called "opened while you were watching".**
The baseline's critical-error count is taken at the instant of the action, which already includes
anything that action raised. Those cases are covered twice over — the interruption box appears
immediately, and the stabilization answer names it — so the sentence is reserved for an interruption
that accrues during the interval. Worth confirming that is the wanted reading.

### Unchanged, deliberately

The engine, the six-phase machine, scoring and mastery, the replay payload version and every storage
key, case and activity identifiers, the transfer variant, the existing action response and its
challenge-mode deferral, the full debrief and its branch resolution, the development calibration gate,
Assess, and publication status.
