# MCS-PRE-REVIEW-01 — device conflicts and state truth

Prepared 2026-09-21 by an AI authoring assistant (Claude Opus 5) at the owner's request, against
the `MCS_Claude_Implementation_Pack` prepared 2026-09-20. **Nothing in this slice is clinical,
device or source approval.** The atrial-fibrillation trigger model is **CONTAINED, not CORRECTED**:
`MCS-03-05` keeps its `NOT REVIEWED` decision and OD-01 still owns it.

## Delivery

|                          |                                                                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree                 | `…/Interventional-Pulm-Education-Worktrees/claude-mcs-9-21`                                                                                                                                                                                           |
| Branch                   | `claude/mcs-9-21`, cut from `origin/main` at `c717c9ff` (merge of PR #250)                                                                                                                                                                            |
| Base at start            | `c717c9ffae09cb67e19b06a56d37c75487a5605a`, tree clean                                                                                                                                                                                                |
| Edit scope               | `src/features/mechanical-circulatory-support/**` and this slice's two documents. Nothing else.                                                                                                                                                        |
| Not touched              | `learning-module/**` (including both shared verdict components), `critical-care/**`, `hemodynamics-core/**`, `src/lib/**`, routes, catalog, progress storage, analytics, media, migrations, environment. Device Intelligence was not read or changed. |
| Parallel owners at start | PRs #251 (EBUS), #252 (BBT), #253 (PI), #254 (BF), #134 (critical care). No overlap: none of them touches MCS.                                                                                                                                        |
| Merged work preserved    | MCS-01 location-only progress, MCS-02 matched comparisons, MCS-03 source holds and the regraded `assume-ecg` option, MCS-AF-PRESENTATION-01's note at the control. All still present and asserted.                                                    |
| Stop point               | One PR, unmerged. Task 02 not started, G02 not restarted.                                                                                                                                                                                             |

Sidecar: [MCS-PRE-REVIEW-01-condition-inventory.md](MCS-PRE-REVIEW-01-condition-inventory.md) —
all twenty-one numerical conditions in the twelve cases, classified.

## Independent sanity-review correction (2026-09-21)

The independent review reproduced two remaining secondary F19 success signals on the original
PR head: the green monitor all-clear badge and the quiet patient-context fallback in IABP-02 and
CAP-IABP-01. The accompanying minimal repair suppresses the badge while the AF hold applies and
uses the existing containment sentence in the case header; actual alarms remain visible. It also
replaces the F09 test that required the incorrect shared heading to remain. Thus the F19
"every route" statement below describes the repaired version, not the original submitted head.

See [MCS-PRE-REVIEW-01-sanity-review.md](MCS-PRE-REVIEW-01-sanity-review.md) for the pinned
base/head comparison, reproduced defects, browser evidence, and remaining owner decisions.

## Disposition of the assigned subfindings

| Finding                          | Disposition                                                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F19** AF trigger false success | **CONTAINED, not corrected.** The model is unchanged; every route by which selecting the warned-against trigger produced a positive signal is closed.                                   |
| **F26** story baseline identity  | **Reproduced → repaired.** Each story now shows its own baseline, read from the model, before the question. Response magnitude stays with 02/05.                                        |
| **F33** unclassified conditions  | **Reproduced → repaired** for 01's part (classification). Layout is 03's; plain action names are 04's.                                                                                  |
| **F04** numeric identity         | **Reproduced → repaired** for 01's part (instantaneous vs modeled mean, model-only synchrony). Trace/PV-axis readability and the ECG amplitude question stay with 03 — see _Handed on_. |
| **F18** false "unannotated"      | **Reproduced → repaired.** Copy corrected; nothing concealed.                                                                                                                           |
| **F27** "normal" reference       | **Reproduced → repaired** for 01's part (wording). The baseline value itself is an open decision (OD-02).                                                                               |
| **F28** device/model framing     | **Reproduced → repaired** for 01's part (the boundary, with a first-hand source). The estimator itself is 02/05 and OD-02.                                                              |
| **F01** unreadable hub           | **Reproduced → repaired**, both themes, measured.                                                                                                                                       |
| **F09** shared verdict heading   | **Not repaired here — shared-owner follow-up, consumer recorded.** Neither shared component was edited or forked.                                                                       |

---

## A. The atrial-fibrillation trigger false-success pathway (F19)

### Reproduced on the base

Run on `c717c9ff`, learn mode, seed 417, 0.25 s steps, settled 10 s, all three trigger sources at
matched offsets, ratio and elapsed time:

| Rhythm / balloon                       | ECG                                       | Arterial pressure | Internal              |
| -------------------------------------- | ----------------------------------------- | ----------------- | --------------------- |
| Atrial fibrillation, running           | **50%**, `iabp-trigger-unreliable` raised | **74%**, no alarm | **40%**, alarm raised |
| Sinus, running (control)               | 100%, no alarm                            | 90%, no alarm     | 62%, no alarm         |
| Atrial fibrillation, stopped (control) | 0%, no alarm                              | 0%, no alarm      | 0%, no alarm          |

The historical MCS-03-05 figures are confirmed in current code: `computeIabpSupport` rates
pressure `0.74`, ECG `0.5`, internal `0.4` in atrial fibrillation, and raises
`iabp-trigger-unreliable` below `0.6`.

**What made it a false success, and not merely a mis-ranking.** IABP-02's condition is
`timingQualityPercent ≥ 60` and CAP-IABP-01's is `≥ 65`. From each case's own opening state, ECG
reaches 50 and internal 40; only pressure reaches 74. So the _only_ route to either case's stated
signal was the trigger the supplied Cardiosave material advises against, and the module answered
that selection with four positive signals at once: a higher figure, a cleared alarm, a context
strip reading "No active alarm", and a met condition under "Signals to reconcile". The existing
note under the selector was a fifth thing on the same screen, and it lost.

### What changed

| Where                                         | Before                                    | After                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/afTriggerLimit.ts`                   | The MCS-03 sentences                      | Plus `MCS_AF_TRIGGER_CONTAINMENT`: the hold reason, the comparison's lead and scope, and the not-an-all-clear line. Plus `mcsAfTriggerLimitAppliesTo(patient, device)` for callers without a whole state.                                                                                                                                 |
| `content/afTriggerComparison.ts` (new)        | —                                         | `mcsAfTriggerComparison(state)`: rates all three sources on separate copies of the live state, from the same starting state, over the same simulated interval. Forks by setting the device directly rather than dispatching, so no action id is appended and no permitted-action check runs — reading a comparison is not performing one. |
| `components/McsAfTriggerComparison.tsx` (new) | —                                         | The three ratings side by side, open on arrival, with the settings and the matched instant in the caption, the checked Cardiosave sentences, and `MCS-03-05 · NOT REVIEWED`. No button, input or select.                                                                                                                                  |
| `components/McsAfTriggerLimit.tsx`            | One `<p>`                                 | Wrapper carrying the same sentences (still the `aria-describedby` target, so a screen reader is not read the whole table on focus) plus the comparison. Rendered by both selectors, so it reaches the Learn transfer, IABP-02, CAP-IABP-01 and a rhythm set in the studio.                                                                |
| `engine/types.ts`                             | `McsMetricCriterion` had four fields      | Plus a compulsory `classification`, with an optional `held`.                                                                                                                                                                                                                                                                              |
| `content/scenarios.ts`                        | Two AF timing conditions, ordinary        | Both carry `held` with the reason and `MCS-03-05`. Values, labels, ids, metrics and operators unchanged.                                                                                                                                                                                                                                  |
| `engine/reducer.ts`                           | `response` counted every condition        | Held conditions leave numerator and denominator together, so the score cannot move with the trigger choice.                                                                                                                                                                                                                               |
| `components/McsCaseWorkflow.tsx`              | `Signals to reconcile` listed bare labels | Contract sentence, per-condition class, and for a held condition the reason, "whether this run reached it is not shown and is not a result", and the open item.                                                                                                                                                                           |
| `components/McsMonitor.tsx`                   | `NO ACTIVE MODEL ALARMS` alone            | A `held` chip whenever the limitation applies, and — after the sanity review — the green clear badge is suppressed while it applies rather than sitting beside the chip. Every real alarm still renders, unchanged, and the clear badge is untouched in every other rhythm.                                                               |
| `components/McsWorkbench.tsx`                 | Case header `No active modeled alarm`     | Added by the sanity review: while the limitation applies and no alarm is active, the patient-context header carries the same held sentence. An actual active alarm still takes precedence there.                                                                                                                                          |
| `components/stage/McsStageHost.tsx`           | Context strip `No active alarm`           | While the limitation applies and no alarm is active, the strip carries the held line instead. Real alarms still take precedence.                                                                                                                                                                                                          |
| `engine/model.ts` `explainState`              | `Counterpulsation is 74% synchronized.`   | `This model rates counterpulsation 74% synchronized — its own timing index, not a console reading.` In atrial fibrillation, plus the held clause and MCS-03's "read the synchrony figure here as this model's output" sentence.                                                                                                           |

### Verified after

Browser, dev server on port 3122, 1204×987 dark, Learn transfer step with the selector moved to
arterial pressure:

- alarm bar: no clear badge, only `Model limit held · a quiet trigger alarm here is not a correctly
operated device` (the badge sat beside the chip on the originally submitted head; the sanity
  review reproduced that as a residual all-clear and it is now suppressed while the hold applies);
- case header in IABP-02 and CAP-IABP-01: `Active alarm / limitation · Model limit held …`, not
  `No active modeled alarm`;
- context strip: no `No active alarm` anywhere on the page;
- on ECG and on internal triggering, `WARNING · Trigger reliability reduced` still renders in the
  alarm bar and in the case header, and in sinus rhythm the clear badge and `No active modeled
alarm` are both preserved — the suppression is scoped to the hold, not to quiet states;
- causal caption: `This model rates counterpulsation 74% synchronized — its own timing index, not a
console reading. Model limit held for faculty review: in this rhythm the rating disagrees with
the supplied Cardiosave material, so it is not a verdict on the trigger in front of you…`;
- comparison table, open, reading ECG 50% / raised, Arterial pressure 74% / quiet, Internal 40% /
  raised, captioned `Atrial fibrillation, 1:1, inflation 0 ms and deflation 0 ms against this
model's own landmarks, balloon running, all three read at 13.02 simulated seconds`;
- no occurrence of success, corrected, fixed, resolved or all clear anywhere in `<main>`;
- all three sources remain selectable, the primary Continue stays enabled, Try again and the
  explanation stay available.

IABP-02's worked explanation, rendered: the one condition prints as _Usable trigger/timing quality ·
Authored for this simulation · this model's own trigger/timing index, which no IABP console
reports · Held, and not treated as an outcome: … Open item MCS-03-05, still NOT REVIEWED._

### What was deliberately not done

- No engine constant was changed. The three coefficients and the 0.6 alarm threshold are as MCS-03
  left them, and no new ones were invented.
- No alarm was hidden, and no warning was removed.
- ECG is nowhere declared technically reliable. The module has no model or source basis for R-wave
  quality or a console arrhythmia mode, and the comparison says so.
- No case or activity id, route, option id, key or plausibility changed. The MCS-03 regrade of
  `assume-ecg` and the transfer's running-balloon work predicate are pinned by tests.
- Nothing became a quiz lock. Continue, explanation, exit and retry are all still there.

### Still open — CONTAINED, not CORRECTED

1. **`MCS-03-05`.** The model still rates pressure above ECG in atrial fibrillation and still
   clears its trigger alarm only on pressure. Decision `NOT REVIEWED`; the queue file was read and
   not edited.
2. **Both cases' timing conditions are unreachable except on pressure triggering.** They are now
   quarantined rather than corrected. A reviewed model or a reviewed criterion has to come back
   through `mcs-pre-review-01.test.tsx` → _"holds exactly the two atrial-fibrillation timing
   conditions and nothing else"_.
3. **CAP-IABP-01 still opens on internal triggering**, which the supplied Cardiosave material says
   not to keep while the patient generates an output. Unchanged, and part of the same hold.

---

## B. The story problems' baseline identity (F26)

### Reproduced on the base

Both suction stories run `suctionStart` — left performance level 7, `preloadPercent` 55 — on a
separate copy, and the second stem said "from the same starting point" with no referent on screen.
Measured baseline, identical for both stories at the same elapsed time (5.04 s):

|          |                                                                                              |
| -------- | -------------------------------------------------------------------------------------------- |
| Baseline | RAP **2** mm Hg, wedge **10** mm Hg, MAP 61, left pump flow 1.67 L/min, effective 3.74 L/min |
| Setting  | Impella CP · P7 · correct position · right pump off                                          |
| Alarms   | `impella-left-suction`, `impella-left-hemolysis-risk`                                        |
| Patient  | preload 55%, RV contractility 0.85 (the model's reference)                                   |

The section around them (`impella-suction-purge-rv`) starts a _different_ patient: RV contractility
0.36 at the reference preload of 105%. The report's suggested "RAP 5, wedge 8" is not what the
model produces and was **not** used.

### What changed

- `content/storyProblems.ts` — `mcsStoryBaseline(story)` exported (the settled starting state, no
  change applied); `runMcsStory` now builds on it, so the panel and the tests read one run. Each
  story gains `baselineId`, `baselineNote` and `changeScope`, all validated at module load.
- `components/stage/McsStoryProblems.tsx` — a _Where this illustration starts_ panel above the
  question, carrying the baseline id, the support setting (`mcsConfigurationLabel`), RAP, wedge,
  each of the story's own readings, the alarm state and the simulated instant, then the change's
  scope. Every number is read from the model.
- The suction pair's note says what "the same starting point" refers to and that the section's
  patient is a different circulation. The LVAD pair gets the same treatment from its own baseline.

The volume story's scope reads: _"The one change is this model's preload control, 55 per cent to
100 per cent — the whole circulating volume of the simulation, moved in one step. It is not a
specified bolus, it has no dose and no rate, and nothing here says what volume a real patient should
receive or whether they should receive any."_ A test asserts it contains no mL/cc figure and no
"give N" or "over N minutes" phrasing.

### Verified after

Rendered at `learn?lesson=impella-suction-purge-rv`: two baseline panels, both reading
`mcs-story-low-preload-suction-v1`, RAP 2, wedge 10, pump flow 1.7, effective 3.7, MAP 61.0, alarm
`active`, read at 5.04 s. Tests cover: the pair shares one baseline at matched values and time; the
panel precedes the question in document order; reverse replay order returns the same values; a live
session deliberately moved to preload 140% and level 2 changes nothing about either story; opening
and running a story checks no radio, writes nothing to `localStorage` and adds no action id.

### Still open

Response magnitude, the model relationships behind it, and a contrasting reviewed RV-failure story
belong to **task 02/05 and OD-03**. This slice changed no story value and no response.

---

## C. Numbers and device claims

### F33 — the twelve cases' conditions

Twenty-one conditions, all inventoried in the sidecar. **None has a clinical source**, so all are
classified `authored-model-condition`; the `source-supported-clinical` class exists in the type for
OD-04 and requires both a registered source id and an exact scope, enforced by test. The worked
explanation now leads with _"Each condition below is a test on this simulation, not a treatment
target and not a sign that the support is clinically adequate. Meeting one says the model reached a
number this module chose; it does not say a device was correctly operated."_

`MAP ≥50` and `MAP ≥58` are unchanged. No universal MAP 65 was imported, no threshold was replaced
by a direction-only signal, and no arbitrary number was substituted.

### F04 — numeric identity and model-only synchrony

Traced before labelling. The strip readout is `samples.at(-1)[field]` — the newest waveform sample
at the model's current time, generated in `generateMcsWaveformSample` from the modeled mean and
pulse pressure. The tile is the modeled mean (`mapMmHg`) or the derived systolic/diastolic pair.
They are different quantities over different windows, which is why the strip can read 68 while the
MAP tile reads 69 with neither being wrong.

- Every strip readout carries `instantaneous`, and its accessible name now reads _"ART waveform;
  instantaneous sample 68.0 mmHg at the model's current time"_.
- `MAP / PP` and `RAP / PCWP` read `mm Hg · modeled mean…, not the strip sample`; `PAP` reads
  `modeled systolic / diastolic`.
- The `TIMING` tile keeps its value and gains `model index · no console reports this`, plus
  `data-quantity-class="model-index"`. The tile's `span` text is still `TIMING`, so no existing
  selector was re-keyed.
- `McsObservedSignal.level` gains `model-index`, and the three places that levelled
  `timingQualityPercent` as `device-display` now use it. Quantities a console does report keep
  `device-display`.
- **No physical value changed.** The strip and the tile still differ; a test asserts that.

### F27 / F28 — the durable reference and the estimator direction

**Reproduced.** The durable-LVAD reference state settles at **MAP 103** mm Hg, RAP 12, wedge 17,
displayed flow 3.79 L/min, power 5.0 W, PI 3.8, at 5200 rpm, with no active alarm — and Section 7
described it as _"power, pulsatility index and the displayed flow all reading normally"_.

Switching on the high-power pattern at matched elapsed time (both branches taking the same control
dispatch, so only the flag differs): power **5.0 → 7.8 W**, displayed flow **3.79 → 3.79 L/min**.
`computeLvadSupport` computes flow from speed and loading and then adds a flat 2.8 W; the flag never
enters the flow formula.

**Source, read first-hand for this slice.** Abbott, _HeartMate 3™ LVAD — Pump Parameter Overview;
Clinical Considerations_, ©2025, MAT-2007803 v3.0, US-only. Retrieved and read 2026-09-21; file
SHA-256 `873d0243f5226ec849fad4fddb6cb44c3f8311ae8417de593551bc7bb346806a`. Registered as
`abbott-heartmate3-pump-parameters-card`. It states:

> Device power is a direct measurement of pump motor voltage and current. … Flow is an estimate
> that is derived from a calculation of fixed speed, power and the patient's hematocrit value. …
> No single parameter is a surrogate for monitoring a patient's clinical status.

So on that device the arrow runs **power → flow**, and in this model it runs **flow → power**: the
exact reverse. Section 7's keyed feedback, Section 8's flow-account note, its explanation and its
prediction rationale now say so, name the card, and say what is _not_ claimed — the card names the
inputs and gives no estimator equation, so **no controller algorithm is reverse-engineered here and
none is claimed**. What a real controller's displayed flow would do in a high-power state is not
reproduced and is held for OD-02 and task 02.

Section 7's starting context no longer says "reading normally". It names the state as an authored
reference whose mean pressure starts high — higher than the mean blood pressure Abbott's card names
for HeartMate 3 patients, measured its way — cites that figure **as the manufacturer's statement
about its own device, explicitly not adopted as this module's target**, and points at OD-02. No
guideline range was imported; in particular the report's ISHLT 75–90 and <80 figures were **not**
used, because this slice did not verify them. Section 8 carries the same qualification.

The card is attached to the durable-support evidence set, so it appears in the sources those items
already cite. All safety and authorization controls are untouched: `lvad:authorize-speed` still
gates speed, and the unauthorized-speed critical error is unchanged.

### F18 — the false "unannotated" claim

**Reproduced.** `pendingTimingIdentification` is a hard-coded `false` in `McsStageHost`, so the
unannotated branch of `McsTimingFigure` never renders. The recognize step shows the annotated
figure — titled _Timing reference · Annotated demonstration_, with the U/N/I/D landmark lines and
their legend — while its prompt read _"Inspect the unannotated Timing example and balloon band"_,
and the section's starting context promised _"a different unannotated example"_.

Repaired by making the words match the screen, not by hiding anything: the prompt now reads _"Read
the annotated Timing reference and the balloon band — the landmark letters and the model's alarm are
both on screen"_, and the starting context says recognition here is reading the trace against its
landmarks. The landmarks, the legend, the alarm band and the alarm's explanation are all still
rendered and still true; no answer concealment was introduced. The three recognize options are
unchanged.

The dead unannotated branch was left in place — it is accurate when it renders, and an optional
clean reference view belongs to **04**.

---

## D. The hub, and the shared verdict component

### F01 — the hub in a dark browser

**Reproduced,** computed in the browser at 1204×987 with the site in dark mode:

| Element                                        | Foreground           | Background           | Ratio      |
| ---------------------------------------------- | -------------------- | -------------------- | ---------- |
| Pathway group titles (all five)                | `rgb(248, 250, 252)` | `rgb(255, 255, 255)` | **1.05:1** |
| Route-card body text and list items            | `rgb(248, 250, 252)` | `rgb(245, 250, 248)` | **1.01:1** |
| `9 sections, in one order` (not in the report) | `rgb(7, 31, 41)`     | `rgb(12, 19, 34)`    | **1.09:1** |

**Root cause.** `ModuleFrameV2` builds its _light_ palette out of the app's own `--background` and
`--foreground`, and the site's `.dark` class flips those to a near-white ink on a near-black page.
The frame is a descendant of `.moduleShell`, so its `color` won the cascade over the module's
`--ink` for everything inside it — while the module's own surfaces stayed the hand-painted light
cards they are. The result is not a dark theme; it is a light theme with one inherited colour
inverted, which is also why a navy heading ended up on a near-black page.

**Repair, module-local.** One rule in `mechanical-circulatory-support.module.css` pins the
light-theme frame _inside the MCS shell_ to the palette the shell already publishes — all six
`--lm-v2-*` tokens plus `color-scheme: light`. The stage's `data-theme='dark'` block replaces every
one of those tokens itself and is untouched by the rule. Neither the shared component nor any global
token was edited.

One further AA failure the measurement surfaced: the route-card eyebrows were `--teal` `#14847f` on
`#f5faf8` at **4.29:1** at 0.64 rem, below the large-text exemption. A `--teal-text` `#0f6f6b` was
added for small text on the module's tinted cards; `--teal` keeps its fills, borders and accents.

**After,** measured in both themes at 1204×987 and 1280×800 — identical in each, which is the point:

| Element                                               | Before | After                |
| ----------------------------------------------------- | ------ | -------------------- |
| Pathway group titles                                  | 1.05   | **13.52**            |
| Route-card body and list items                        | 1.01   | **12.82**            |
| Route-card eyebrows                                   | 4.29   | **5.68**             |
| Route-card count / chip                               | —      | 16.10 / 7.91         |
| `9 sections, in one order`                            | 1.09   | **15.87**            |
| Increment list, review paragraph, reference summaries | —      | 12.63 / 7.80 / 13.52 |

No probe on the hub is below 4.5:1 in either theme. Keyboard focus rings, the pathway accordion's
disclosure behaviour and the review-governance block are unchanged.

### F09 — the shared alternatives heading

**Reproduced, and not repaired here by design.** The EBUS pre-review fixed the key-aware heading on
`AnswerVerdict` (`How the other answers compare` when the list contains the keyed option).
**MCS renders `AnswerVerdict` nowhere.** Its three verdict surfaces all render
`ChoiceReasoningFeedback`, whose heading is still the unconditional `Why the other answers do not
fit` — so after a wrong or unsafe selection the keyed answer is listed under it, which is the
report's complaint exactly.

**The exact consumers, for the shared owner:**

| Route / surface                          | File                                    | Occurrence                     | Item source               |
| ---------------------------------------- | --------------------------------------- | ------------------------------ | ------------------------- |
| Learn, every section's Predict verdict   | `components/stage/McsStageHost.tsx`     | line ~903, `case 'prediction'` | `contract.predictionItem` |
| Learn, every section's Transfer verdict  | `components/stage/McsStageHost.tsx`     | line ~1244, `case 'transfer'`  | `transfer.item`           |
| Learn, the four story problems' verdicts | `components/stage/McsStoryProblems.tsx` | line ~127                      | `story.item`              |

All three pass `alternatives={item.choices}`, `outcome="stated"`, `frames={mcsVerdictFrames(item)}`,
`explanation` and `evidenceIds`. **Any fix must keep the evidence resolution**
(`resolveCriticalCareEvidence`) and the concept links: swapping MCS to `AnswerVerdict` would drop
the Sources block these surfaces currently render, so that is not the fix to make.

Neither shared component was edited, forked or duplicated. `mcs-pre-review-01.test.tsx` records the
consumer list and preserves selected and alternative reasoning, outcomes, and source links on MCS
surfaces. The independent sanity review removed the assertion that required the incorrect shared
heading to remain: a future shared-owner repair must pass these consumer contracts. The key-aware
heading repair itself remains outstanding; neither shared component was changed here.

---

## Test contracts

Two new suites, and three assertions changed in existing ones.

### `__tests__/mcs-pre-review-01.test.tsx` — 27 tests, the full contract

Covers: the AF ranking across rhythm and balloon state; exactly two held conditions and both in
atrial fibrillation; score identical across all three triggers in both cases, with a non-held
control case that still responds; no met/achieved/success wording in either AF worked explanation on
any trigger; the alarm bar's held chip with a sinus control; the causal caption; the comparison
derived from the engine at a matched instant, leaving action ids and the selector untouched, and
`null` off-condition; the comparison open and controlless in both selectors; the transfer still
continuable with all three sources selectable; the transfer work predicate, key, options and
plausibilities unchanged; the story pair's shared baseline, its difference from the section patient,
document order, change scope, reverse replay, a deliberately changed live session, and no recorded
work; all twenty-one conditions classified with no unsourced clinical claim; the classification
rendered in all twelve cases; `model-index` levelling; the monitor's labels with the physical values
still differing; F18, F27, F28 and F01.

### `__tests__/mcs-pre-review-01-base-guard.test.tsx` — 24 tests, runnable on the base

The full contract cannot run on `c717c9ff` — it imports modules this slice added, so the suite fails
to resolve rather than reporting anything. This second suite asserts the repaired behaviour through
base-available imports only, so each defect produces a named failure there.

**Run on `c717c9ff` with the module sources checked out from the base and only the new test files
present: 24 failed, 24 total.** Every repaired defect is represented:

```
● F19 … does not move the case score between trigger sources
● F19 … marks the disputed condition held wherever the worked explanation prints it
● F19 … does not let the quiet alarm bar read as an all-clear
● F19 … does not narrate the modeled index as a statement about the balloon
● F26 … shows the pair's own baseline and its model values above the question
● F26 … states the scope of the loading change without implying a dose
● F33 … (×12, one per case) prints a classification beside every threshold
● F04 … labels the strip readouts and the modeled means
● F04 … keeps the modeled synchrony index off the device-display level
● F18 … claims no unannotated example
● F27 … does not call the durable reference state normal
● F28 … names the direction of the real controller's flow estimate, with its source
● F01 … sets the shared frame's tokens inside the MCS shell
```

Raw output is in this session's evidence folder, not committed.

### Changed assertions in existing suites, and why

| Suite                                                                 | Assertion                                           | Why                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcs-af-presentation.test.tsx`                                        | _"carries no control of its own"_ forbade `details` | The containment requires the worked comparison to be reachable at the moment of the choice, and it is a disclosure. Narrowed to what the assertion protected: the note still answers nothing, records nothing and cannot be dismissed into hiding the limitation, and the one `details` must be the comparison, open. |
| `mcs-af-presentation.test.tsx` ×2                                     | `aria-describedby` compared to the note root's id   | The id moved to the note's first paragraph so a screen reader is not read the comparison table on every focus. The assertions now resolve the description and check it is inside the note and carries the limitation's own sentences — the same guarantee.                                                            |
| `m5-controls-and-surfaces.test.tsx`, `m5-practice-challenge.test.tsx` | strip label matched `/current value/`               | F04: the label now names the quantity and the window. Matched against the new contract.                                                                                                                                                                                                                               |

No test was deleted or skipped.

## Validation run

| Check              | Command                                                                                                | Result                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| MCS and MCS routes | `npx jest src/features/mechanical-circulatory-support src/app/[locale]/mechanical-circulatory-support` | **39 suites, 805 tests, all passing** (base: 37 / 754)                                                                               |
| Full suite         | `npx jest`                                                                                             | 9 suites / 8 tests failing, **identical set and identical names on the base**, run under matched conditions                          |
| Type check         | `npx tsc --noEmit`                                                                                     | Clean. Needs `NODE_OPTIONS=--max-old-space-size=8192` on this machine; the default heap OOMs on this repo regardless of this branch. |
| Lint               | `npx eslint` over all 23 changed files                                                                 | Clean                                                                                                                                |
| Format             | `npx prettier --check src/features/mechanical-circulatory-support`                                     | Clean                                                                                                                                |
| Whitespace         | `git diff --check`                                                                                     | Clean                                                                                                                                |
| Production build   | `npm run build`, dev server stopped first                                                              | **Exit 0**                                                                                                                           |

**The nine pre-existing failures**, unchanged before and after: the brochure-intake static scan, the
US-status safety boundaries, `training-apps.test.mjs` (no tests), branch-tracing contracts,
critical-care accessibility, critical-care curriculum sequencing, critical-care learner copy, the
Literature foundation manifest, and board-review localized HTML. None is MCS.

One earlier full run reported ten failing suites and nine failing tests; two subsequent full runs
and a targeted run of the same nine suites reported the same eight named failures, so the extra was
not reproducible. It is recorded rather than explained away.

**`critical-care/__tests__/learner-copy.test.ts` deserves a note.** It is failing on the base and it
scans the MCS components directory. The first draft of the held-condition line used the word
"graded", which that scan flags, and it took MCS from 10 static-copy findings to 11. The copy was
reworded ("not treated as an outcome"), which is better copy for a self-paced module anyway.
**MCS contributes exactly 10 findings before and after**, verified by running the scanner's own
logic over the MCS components directory on both trees. The shared exemption list in
`critical-care/__tests__` was not touched.

### Browser journeys

Dev server `claude-mcs` on port 3122, isolated profile, English, signed out, stopped before the
build. Console errors are the usual `500`s from the absent `.env.local` Supabase keys, which are an
environment condition of a fresh worktree and predate this branch.

| Width                    | Theme | Route                                                | Observed                                                                                                                                                                                                                                                           |
| ------------------------ | ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1204×987                 | dark  | hub                                                  | All probes ≥ 4.5:1; frame paper `rgb(245,248,245)`, ink `rgb(23,50,58)`                                                                                                                                                                                            |
| 1280×800                 | light | hub                                                  | Identical ratios to dark — the point of the repair                                                                                                                                                                                                                 |
| 1204×987                 | dark  | `learn?lesson=iabp-timing-triggering&phase=transfer` | Note, comparison open with all three ratings, held chip, held causal caption, no all-clear, all sources selectable                                                                                                                                                 |
| 1204×987                 | dark  | `practice?case=IABP-02`                              | Worked explanation: contract sentence, class line, hold line with `MCS-03-05 · NOT REVIEWED`                                                                                                                                                                       |
| 1204×987                 | dark  | `learn?lesson=impella-suction-purge-rv`              | Two baseline panels with the model's own values above each question                                                                                                                                                                                                |
| 375×812, 390×844         | dark  | transfer step                                        | No horizontal page overflow; the comparison table fits with no internal scroll                                                                                                                                                                                     |
| 390×844 @ 200% root text | dark  | transfer step                                        | Comparison table still 0 overflow. The page shows 2 px of horizontal overflow, entirely from the shared sections-drawer (`learning-pathway_pathwayNavIntro` and its list buttons), which this slice did not touch — recorded for 03, not claimed as repaired here. |

**Not run:** Playwright, native browser zoom, Safari/Firefox, a real phone or touch device,
assistive technology, `es`/`zh-CN` wording, authenticated sync, 1440×900, 768×1024 and 320×740,
and any learner observation. Those are OD-08 and separately executed engineering.

---

## Handed on

| To                        | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared-feedback owner** | F09: the three MCS `ChoiceReasoningFeedback` consumers above, with the requirement that any fix preserve evidence resolution and concept links.                                                                                                                                                                                                                                                                                                                                                                       |
| **Task 02**               | The AF model itself; the LVAD flow estimator and what a real controller shows at high power; the durable reference patient's pressure; story response magnitude; the F04 trace/PV readability and the ECG question below.                                                                                                                                                                                                                                                                                             |
| **Task 03**               | The arterial strip's size when it is the focus, the PV loop's axes, the `×16` trend legend, and the worked-explanation layout. **A traced observation for 03:** the ECG's apparent beat-to-beat amplitude change is a sampling artefact, not modelled alternans — `ecgMv` is a narrow Gaussian (width 0.012 of a cycle) sampled at 50 Hz, so the rendered peak height depends on where the samples fall in the spike. Nothing in the model varies QRS amplitude. Do not "fix" it by changing the samples' physiology. |
| **Task 04**               | Plain-language action names under "Actions performed", the optional clean reference view for the timing recognition step, and the claim-level source audit.                                                                                                                                                                                                                                                                                                                                                           |
| **OD-01**                 | The AF trigger model. Contained here; not corrected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **OD-02**                 | The durable device's scope, the reference patient's pressure, and the flow estimator.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **OD-04**                 | The twenty-one conditions in the sidecar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Review status

**NOT REVIEWED.** No clinical, device, source, media or model decision was made or filled in by the
agent. `MCS-03-claim-review-queue.json` was read and not edited; `MCS-03-05` keeps its `NOT
REVIEWED` decision and its null reviewer fields, and the MCS-01/02/03 and MCS-AF-PRESENTATION-01
handoffs were read and not modified. One source record was added
(`abbott-heartmate3-pump-parameters-card`) for a document fetched and read during this slice, with
its limitations stated; registering a source is not approval of anything it is cited for.
