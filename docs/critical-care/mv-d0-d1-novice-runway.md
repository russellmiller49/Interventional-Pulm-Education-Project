# Mechanical Ventilation — D0/D1: novice runway and confirmed corrections

Branch `claude/mv-d0-d1-novice-runway-2026-08-04`, from `origin/main` at `9f829e2e`.

The package: add the beginner runway the module lacks, and fix the internal contradictions already
confirmed against it, without touching layout, timing, physiology, or any other module.

Nothing outside `src/features/mechanical-ventilation/**` changed except one new MV-local harness
under `scripts/critical-care/` and this document. No pathway file, no shared component, no
`package.json`, no engine behaviour, no route, activity id, storage key, or publication status.

---

## 1. The runway

`components/MechanicalVentilationNoviceRunway.tsx`, rendered through `PathwayLanding`'s `notice`
slot — the only node that shared, locked component places between the hero and the section list,
which is exactly where "before lesson 1" belongs. It therefore adds **no section or activity id**,
and `learningPathways.ts` is untouched. Recommended, not required: every section stays one click
away, nothing gates, and the copy says so.

Five panels, each independently reachable:

| Panel                    | What it carries                                                                                                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The controls**         | All nine: FiO₂, PEEP, tidal volume, rate, inspiratory flow, inspiratory time, pressure support, trigger sensitivity, cycling threshold. Each gets three fields — what it changes, **what it does not guarantee**, and what to reassess. |
| **One normal breath**    | Trigger → inspiration → what is held → cycle → expiration, marked on a drawn breath, with pressure/flow/volume named against their own zero lines.                                                                                      |
| **Mode names**           | Generic breath type → _starts / holds / ends_, with all four consoles' own labels beside it as examples.                                                                                                                                |
| **Starting a patient**   | The sequence: name the two goals, reason breath size against predicted body weight, choose a breath type that matches what the patient can do, set alarms as a boundary, reassess specifically.                                         |
| **Urgent, or abnormal?** | Stabilize-first against localize-first, and that the distinction is about the patient rather than the number.                                                                                                                           |

**The middle field is the point.** A control described only by what it changes invites the learner
to treat it as a guarantee, which is the misreading the rest of the module exists to prevent. More
oxygen does not reach blood that bypasses ventilated lung; more PEEP is not recruitment; a set tidal
volume is not a delivered one.

### Two restraints

**No numbers the source layer withholds.** Tidal volume is taught as reasoned per kilogram of
_predicted_ body weight, with what predicted body weight is derived from — height and sex, not the
weight on the bed, because an oedematous patient does not have a bigger lung. The
millilitres-per-kilogram figure is explicitly deferred to reviewed sources and local practice. This
module's clinical reconciliation is still open and its numeric thresholds are deliberately absent;
supplying one here would be the single thing the rest of the module is careful not to do. A test
asserts no universal target appears in any panel.

**No second waveform engine.** The normal breath is drawn closed-form from the equation of motion
and rendered through `tracePath` from `teaching/shared` — the same approach and the same primitive
the waveform-anatomy panel already uses for its comparison columns. The claim is about shape and
sequence, not about a particular patient.

### The competency boundary, and the word it cannot use

The runway states that it supports supervised learning and that working through it does not
establish readiness to manage a ventilated patient independently.

It cannot say that in the obvious words: `critical-care/__tests__/learner-copy.test.ts` bans
`competent` and `competency` from static component copy across all seven critical-care features, and
that test has **no override mechanism** (unlike the item-level lint, which takes a
`learnerCopyOverrideReason`). The wording follows the house precedent already used by the module
frame and the lab banner — "supervised", "not a substitute for", "responsible for the patient".

---

## 2. Corrections

### "Modes sit third"

The landing said it; Modes is fourth and has been since `waveform-anatomy` was authored as the new
opener. Corrected. The per-panel section numbers in the file headers had drifted the same way and
for the same reason — every one still counted from before `waveform-anatomy` existed, so Mechanics
called itself Section 1 and the capstone Section 9 of ten. All ten renumbered.

### The transfer that asked for a breath it never displayed

`waveform-anatomy`'s transfer asks the learner to name the controlled variable of a pressure-targeted
breath. It ran on **MV-02**, which is volume-controlled — and with flow starvation scooping the
pressure trace, it is the most emphatically volume-controlled breath in the casebook. Measured:

```
MV-02  inspiratory flow  40, 40, 40 … 40 L/min   (constant, all 29 samples)
       airway pressure   17, 16, 15 … 8, 8, 8 … 13, 14   (a concave scoop)
```

The item marked `pressure` best and `volume` an incorrect mechanism. The activity header above it
read _"Volume-control flow starvation during high respiratory drive"_ and the mode chip read
`volume-ac`. A learner reading the trace correctly was told they were mistaken, and the screen
printed the rejected answer twice.

Now runs on **MV-04**, the only pressure-targeted assist/control case:

```
MV-04  airway pressure   flat at 26.0 for the whole second half of inspiration
       inspiratory flow  55.3 → 40.4, falling away from its early peak
```

The stem was rewritten to describe _that_ breath. The old "flow that decays smoothly toward zero"
clause is gone, because MV-04's inspiratory time is shorter than its time constant so the flow does
not reach zero — and the reverse-triggered effort re-accelerates it late in the breath. Primary
stays MV-01, so the pair is now an actual transfer: one controlled variable to the other.

Both copies were fixed. **`content/lessons.ts`'s `prediction`/`transfer` blocks are dead** — nothing
renders them; `MechanicalVentilationLessonActivity` reads `lessonLearningItems.ts`. They are kept in
sync here rather than left to drift further, but this is worth knowing before authoring against
either file.

### Plateau validity

The rule is now stated once, in `content/plateauValidity.ts`, and every surface that reads a plateau
asks it: the console annotation and dynamic-lung gap, the mechanics figure and its readouts, the
dyssynchrony load domain, and the authored answers for mechanics and the capstone.

> A plateau-based mechanics claim — the elastic/resistive split, the peak-to-plateau difference read
> as resistance, static compliance attributed to a hold — is made only when the patient has been
> quiet across the recent trace. When they have not, the surface withholds the claim, says why, and
> names the direction of the error.

**What was wrong.** The engine has published `plateauIsInterpretable` since the hold was rebuilt,
and the console readout and the panel's validity note both already said so. What no surface did was
stop _crediting_ the inference. In the same render, on MV-13:

- the trace annotation read `Pplateau 10 — elastic load only; gap to peak is resistive`
- the readout beside it read `not interpretable: patient effort 8 cmH₂O`
- the figure drew `Elastic +3` where the relaxed elastic pressure was 18
- the note underneath read `Plateau not interpretable`

Not an edge case. The casebook has **no passive volume-controlled patient**, so this was the normal
state of all four lessons that teach the split. Effort is not even authored on those cases — MV-01
and MV-13 have no `Pmus_peak_cmH2O` in their hidden model and take the 8 cmH₂O default.

**Why the rule asks over a window, not at an instant.** The engine's flag is instantaneous and the
patient keeps breathing through an occlusion, so the neural breath re-fires under the closed valves.
Measured on MV-13, 0.1 s steps from the moment the hold arms:

```
t+0.0  f (effort 7.7, plateau 10.3)      t+2.6  f (effort 2.9, plateau 14.5)
t+0.3  T (effort 1.5, plateau 16.4)      t+2.9  f (effort 8.0, plateau  9.4)
t+0.4  T (effort 0.0, plateau 17.8)      t+3.3  T (effort 1.5, plateau 15.8)
…      T                                 t+4.0  T (effort 0.0, plateau 17.3)
                                          relaxed plateau = 18.0
```

Gating each render on the raw flag would make the interpretation appear and disappear about three
times per hold. It would also teach the opposite of what the module already says — _"repeat the
occlusion over several breaths and watch whether the value settles"_. A plateau that swings
17.4 → 9.4 → 17.3 inside one maneuver **is** reporting the patient. So the question asked is the
clinical one, is this patient passive, over a window long enough to contain a whole neural breath.

**Withholding is not hiding.** The measured numbers stay on screen exactly as a ventilator would
show them. What is withheld is the interpretation laid over them.

_(A first measurement of this suggested the flag was stably false through the whole hold. It was
wrong: `TICK` is a no-op while `paused` is true, which `createInitialSimulationState` returns, so
nothing was advancing. The numbers above are from an unpaused run.)_

### Two authored premises that were false against their own runtime

Found while auditing the plateau surfaces, both in the capstone, both corrected with it:

- **Prediction** claimed _"expiratory flow still returns to zero before the next breath"_ on MV-13.
  It runs **−3.2 L/min** at the next breath with 79–87 mL retained. That premise was load-bearing —
  it was the stated reason for rejecting the auto-PEEP distractor.
- **Transfer** described _"plateau pressure has risen with an unchanged peak-to-plateau difference"_
  while loading **MV-06**: a 40.7 cmH₂O gap, 33.9 of intrinsic PEEP, and hypotension. The guided
  actions on the same screen are an expiratory hold and manual release. The question and the screen
  taught two different mechanisms. The transfer now asks what takes priority in obstructive shock,
  and keeps the measurement-validity answer as the reasonable-but-not-first option — the right habit
  at the wrong moment.

### Adaptive and dual-control

Section 1's rule — a ventilator sets one of pressure or volume and cannot set both — stays exactly
as it is. It is what makes a trace readable at sight. The **Modes** panel now puts it down again:
the adaptive modes hold pressure within a breath while adjusting that pressure across breaths to
chase a volume, so neither answer describes them alone — and the delivered volume can look steady
while the pressure needed for it climbs, which is why the pressure trace is the one to read there.
Names come from the active console's own source-bound profile, so they are one manufacturer's
examples rather than universal vocabulary. Tests pin that the simple rule survives in section 1 and
the caveat arrives in section 4.

### The debrief

It opened, in Learn, on a block headed **"Educator mechanics and hidden risk record"**: the
reproducibility key, the internal branch token, six risk accumulators, and a ring-buffer depth.
Eleven of the fifteen cases have a one-element branch list, so that token was a bare answer key
printed under the question — MV-11's is `rise-time-mismatch`, which is the mechanism being asked for.

All of it now sits behind the build-environment gate the lab's calibration panel already uses
(`shouldRenderVentilationCalibration`, exported so a test pins the predicate rather than reaching
for `process.env`). It is the only authorization mechanism this feature has; `showEducatorOverlay`
is a learner-pressable display toggle despite its name and would have hidden nothing.

In its place the debrief now answers the case — what this patient turned out to have, in words, and
why the learner's action did or did not move the numbers. Suctioning a bronchospastic airway leaves
the resistance where it was, and the learner is owed that sentence. The branch remains the lookup
key and is never the output; only MV-13 and MV-08 have branches that change what is wrong and what
fixes it, so only they carry a resolution.

**Possible against present.** The authored `visibleFindings` list is a teaching menu, not an
examination of one patient: MV-13 names all three candidate causes at once, each tagged with its own
branch name, and MV-08 prints "branch A"/"branch B" to the learner. `content/caseFindings.ts`
classifies each authored finding as _present_, _still-to-be-separated_, or
_would-appear-if-you-look_, against the SHA-pinned snapshot by index, and the bedside panel and
reference drawer render them apart. Only what the source text itself marks as conditional is
reclassified — downgrading a real finding to a hypothetical would be the same defect pointing the
other way.

The faculty **run tips** are gone from the learner's reference drawer entirely. MV-13's told the
learner the case has three randomized versions; MV-08's enumerated its own branch set.

---

## 3. Verification

```
npm run type-check                  clean for MV *
npm run lint                        0 errors, 0 MV findings (18 pre-existing warnings elsewhere)
npx jest src/features/mechanical-ventilation      19 suites / 468 tests
npx jest src/features/critical-care               22 suites / 176 tests, incl. learner-copy + public-client-boundary
npm run test:a11y                   4 passed
npm run validate:critical-care-assets   19 assets validated
npm run dump:mv-waveforms           no flags, byte-identical to main — confirming no engine change
npm run render:mv-console           4 consoles
npm run render:mv-teaching          10 panels
render-mv-novice-runway.mts         20/20 blocks clean at the four widths
```

\* `src/lib/board-review-loader.ts` and `src/lib/mdx-utils.ts` report missing
`contentlayer/generated` in a fresh worktree. Pre-existing and unrelated — contentlayer takes 40+
minutes locally on the MDX corpus and has never been generated here.

### Render review

New MV-local harness, `scripts/critical-care/render-mv-novice-runway.mts`. `package.json` is locked
for this round, so it is invoked directly:

```bash
npx esbuild scripts/critical-care/render-mv-novice-runway.mts --bundle --platform=node --format=cjs --log-level=error --loader:.module.css=local-css --outfile=node_modules/.cache/mv-console/runway.cjs && node node_modules/.cache/mv-console/runway.cjs
```

It renders all five panel states at 1600×900, 1440×900, 1280×720 and 1024×768 — framed at the
content column `PathwayLanding` actually gives them (`max-w-6xl` = 1152px, less padding), because
reviewing the primer at 1600px of unconstrained width would answer a question nobody is asking.

**Result: 20/20 blocks with zero horizontal overflow, zero nested scrollers, and no clipped text.**

One defect found and fixed by looking: `.figure svg` is `width:100%`, which is right in the
workspace's 420px middle pane and wrong on a full-width landing — the breath figure scaled its
300×186 viewBox to **1105×685**, so one trace filled the screen. A `.wideSurfaceFigure` cap brings it
to 480×298. The stage marker also struck through the trace labels and now starts below them.

---

## 4. For the owner

### Needs a clinical read

- **The runway's copy, all five panels.** Authored against the module's own objectives and holding
  the no-thresholds rule, but no clinician has read it. It is the first thing a novice will meet.
- **The MV-13 and MV-08 branch resolutions** in `content/caseFindings.ts` — six short passages
  saying what each version of the patient had and why an action did or did not move the numbers.
- **The capstone's two rewritten items.** The transfer's credited answer changed from
  _establish measurement validity_ to _relieve the trapped gas_, because the runtime it loads is an
  unstable obstructive-shock patient and the guided actions on the same screen are an expiratory
  hold and manual release. That is a change to what is credited, and it should be confirmed.

### Fixed in the second round — four lessons that disagreed with their own patient

All four were found by the adversarial pass over the first round and are now corrected, each with a
regression test taken at the exact learner observation point: the session is built unpaused, the
guided actions dispatch, and `runResponse` fires one `TICK { seconds: responseSeconds }`.

| Lesson                      | Was                                                                                                                                                                  | Is                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `oxygenation-response`      | PEEP 5 → 7, one below the recruitment window. SpO₂ 84.00 → 91.87, but shunt 0.30 → 0.30, compliance 25 → 25, MAP 77 → 77, **plateau 13.90 → 15.90 (rising)**         | PEEP 5 → 8. SpO₂ 84.00 → 93.93, shunt 0.30 → 0.20, plateau 13.90 → 13.30, peak 24.90 → 24.30, exhaled VT unchanged at 422 mL                 |
| `waveform-reading-sequence` | Stem names condensate; MV-08 selects `cardiogenic-oscillation` on attempts 1, 2 and 4, so the finding was absent on a learner's first two runs                       | Variant pinned to `branch: 'condensate'`, resolved to attempt 3 and memoized. `airway.condensate` true, autotrigger fraction 0.68            |
| `triggering-and-cycling`    | ets +10 %; MV-10's time constant is 1.76 s, so the criterion needed 4.05 s at 10 % and 2.83 s at 20 % — both past the 1.5 s `tiMaxSeconds` cap. **Ti 1.50 → 1.50 s** | ets → 50 %. Ti 1.50 → 1.21 s, intrinsic PEEP 8.90 → 5.60, expiratory flow at next breath −24.30 → −15.30 L/min                               |
| `ventilation-and-co2`       | "expiratory flow remains above zero", inverting the module's own sign convention against a measured −55.0 L/min                                                      | "has not returned to zero before the next inspiration", plus a copy contract over every stem, explanation, label and rationale in the module |

**Why the oxygenation fix is a step change and not an engine change.** The recruitment window is
gated at a set PEEP of 8 and stays exactly where it was; the maneuver moved into it. The credited
copy now names only what the learner can observe — the same tidal volume arriving for less pressure
— and deliberately no longer leans on compliance, which is model truth rather than something this
patient's trace reveals, since the plateau it would be computed from is not interpretable here. MAP
stays in the prediction and is stated as unchanged: a direction of "no change" is a real prediction,
and it is the answer to why the signal is checked at all.

**Why the cycling step is decisive rather than incremental.** A ten-point nudge cannot move a breath
that the safety backstop is already ending. Raising the expiratory trigger into the 40–60 % region is
the ordinary move in obstructive physiology, and the breath still outlasts the patient's own
inspiration afterwards — the maneuver improves the mismatch without pretending to abolish it.

**The capstone priority is now conditional on the patient, not assumed.** MV-06 at the observation
point measures MAP 33 mmHg, systolic 49, intrinsic PEEP 33.9, expiratory flow −55.0 L/min. A test
ties the credited "relieve the trapped gas" to that instability, so if the runtime ever stops being
an unstable obstructive-shock patient the credit stops being defensible and the suite says so.

Each regression test was confirmed to fail against its own restored defect — PEEP +2 fails three,
unpinning the branch fails four, the clamped cycling step fails two, the inverted sign fails two —
and to pass again once restored.

### Unchanged, deliberately

Practice and Assess timing, the shared `AnswerVerdict`, the six-phase machine, the 1280×720 workspace
density problem (D2), the engine, and publication status.
