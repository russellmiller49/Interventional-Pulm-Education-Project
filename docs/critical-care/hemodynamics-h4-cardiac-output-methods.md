# H4 — cardiac-output methods and measurement quality

Scope: the `thermodilution-series` Learn section of ICU Hemodynamics. Persistent activity id,
section id, route, query parameter, storage key, progress version, completion-rule id, scoring, and
mastery are unchanged. `derived-hemodynamics` stays after it; nothing from H5 entered this package.

## The four questions this section makes answerable

1. What quantity is this method trying to estimate?
2. Which inputs were measured, sampled, entered, assumed, or calculated?
3. Was the acquisition technically acceptable and repeatable?
4. When thermodilution and Fick disagree, what should be checked before either is believed?

The claim underneath all four: a cardiac-output result is not trustworthy merely because the monitor
produced a number.

## Where things live

| Concern                                             | File                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Canonical method model (three methods)              | `src/features/icu-hemodynamics/content/cardiacOutputMethods.ts`              |
| Source-support audit and number classification      | `src/features/icu-hemodynamics/content/cardiacOutputSourceBoundaries.ts`     |
| Four paired-method comparison episodes              | `src/features/icu-hemodynamics/content/cardiacOutputComparisons.ts`          |
| Fick calculation, trace, withholding, amplification | `src/features/icu-hemodynamics/engine/fick.ts`                               |
| Curve features, exclusion reasons, series summary   | `src/features/icu-hemodynamics/engine/thermodilution.ts`                     |
| Section completion contract                         | `src/features/icu-hemodynamics/engine/cardiacOutputSection.ts`               |
| Method model panel                                  | `src/features/icu-hemodynamics/components/CardiacOutputMethodModel.tsx`      |
| Trial review card and series readout                | `src/features/icu-hemodynamics/components/ThermodilutionTrialReview.tsx`     |
| Fick workbench                                      | `src/features/icu-hemodynamics/components/FickMethodWorkbench.tsx`           |
| Disagreement lab                                    | `src/features/icu-hemodynamics/components/CardiacOutputDisagreementLab.tsx`  |
| Numeric audit                                       | `scripts/critical-care/audit-cardiac-output-methods.ts`                      |
| Tests                                               | `src/features/icu-hemodynamics/__tests__/h4-cardiac-output-methods.test.tsx` |

Run the audit directly; it has no package script:

```bash
npx tsx scripts/critical-care/audit-cardiac-output-methods.ts
```

## The canonical method model

Three records, never two:

| id                 | name                                    | family             | oxygen-uptake provenance |
| ------------------ | --------------------------------------- | ------------------ | ------------------------ |
| `thermodilution`   | Bolus thermodilution                    | indicator-dilution | not applicable           |
| `fick-direct`      | Direct Fick with measured oxygen uptake | Fick               | measured                 |
| `fick-assumed-vo2` | Fick with an assumed oxygen uptake      | Fick               | assumed                  |

`validateCardiacOutputMethods` runs at import and refuses:

- a Fick record with no declared oxygen-uptake provenance, or a non-Fick record that declares one;
- a record with an assumed oxygen uptake whose learner-facing name contains "direct";
- a record with a measured oxygen uptake whose name does not say so;
- a record whose `vo2` input status contradicts its declared provenance;
- an incomplete record, an unresolvable evidence id, a gap in the acquisition sequence, or a record
  that carries no intracardiac-shunt limitation;
- a set in which the two Fick methods have collapsed into one.

Every value on every surface is labeled with one of five words — **measured**, **sampled**,
**entered**, **assumed**, **calculated** — defined once in `cardiacOutputInputStatusLabels`. Trial
and result states use `cardiacOutputResultLabels`: accepted trial, excluded trial, not yet reviewed,
method result, not interpretable.

`cardiacOutputMethodTextEquivalent` assembles the text alternative from the same fields the panel
renders, so a figure and its alternative cannot describe different methods.

## Source boundaries

**How far the audit went.** `CARDIAC_OUTPUT_VERIFICATION_DEPTH` is `claim-text-audited`. Each source
was audited against its own registered `intendedUse` string in `content/sources.ts`. None of the
documents named in `suppliedFilename` is present in this repository or in the primary checkout, so
**no H4 statement has been checked against source text and a page locator**. Sentence-level
verification is an open review item.

**Claim support is separate from citation resolution.** `cardiacOutputSourceSupportsClaim(id, topic)`
is true only when the record resolves _and_ its registered claim text covers the topic. Mapped:

| Source                      | Topics its registered claim covers                                      |
| --------------------------- | ----------------------------------------------------------------------- |
| `pac-derived-part-2-2021`   | thermodilution measurement, technical validation, interpretation limits |
| `esc-ers-ph-2022`           | Fick-versus-thermodilution framing, repeated cardiac-output measurement |
| `monitor-workflow-supplied` | cardiac-output trial-review workflow                                    |
| `icu-hemodynamics-model-v1` | educational-model boundary                                              |

**Declared gaps** — no registered record's claim covers these, so nothing here asserts one:

`oxygen-uptake-estimating-equation`, `numeric-repeatability-criterion`,
`injectate-protocol-specification`, `oxygen-content-constants`,
`method-performance-in-tricuspid-regurgitation`, `method-performance-in-low-flow`.

### Every number this section can show

| Parameter                                    | Shown            | Classification                        |
| -------------------------------------------- | ---------------- | ------------------------------------- |
| Trials summarized in a series                | 3                | simulation parameter                  |
| Most trials this series allows               | 6                | simulation parameter                  |
| Injectate volume                             | 10 mL            | device or protocol value              |
| Injectate temperature                        | 5 °C             | device or protocol value              |
| Injection-duration window flagged outside of | 0.6–4 s          | simulation parameter                  |
| Required respiratory phase                   | _not shown_      | unsupported                           |
| Numeric agreement criterion between trials   | _not shown_      | unsupported                           |
| Oxygen-uptake estimating equation            | _not shown_      | unsupported                           |
| Oxygen carried per gram of hemoglobin        | 1.34 mL/g        | simulation parameter (model constant) |
| Oxygen dissolved per unit partial pressure   | 0.003 mL/dL/mmHg | simulation parameter (model constant) |

A parameter classified `unsupported` shows no number — enforced by
`validateCardiacOutputSourceBoundaries`. Every other parameter carries its qualifier onto the
surface that displays it.

The widely taught "three trials within ten percent" rule is therefore **not** stated here. Three is
this simulation's series configuration, and the agreement criterion is deferred to local device and
unit protocol.

### Questions this module refuses to answer

`cardiacOutputOpenMethodQuestions` keeps three visible with their status attached rather than
answering them: the direction of thermodilution bias in significant tricuspid regurgitation, the
direction in low-output states, and which method to believe when the two disagree.

## Thermodilution acquisition

Loop: define the question → confirm catheter and signal context → predict an acceptable curve →
acquire → **inspect the raw curve** → decide acceptance → repeat with the same technique → compare →
exclude only with a technical reason → summarize → state what the number cannot establish.

**Review before the number.** `ThermodilutionTrialCard` hides the derived value until the trial has
been reviewed. The figure carries baseline, onset, peak, decay, secondary disturbance, and the
integrated area — all derived from the trace by `thermodilutionCurveFeatures`, and all repeated in
`thermodilutionCurveTextEquivalent`.

**Review before acceptance.** `SET_THERMODILUTION_ACCEPTED` with `accepted: true` is refused unless
`trial.reviewed`. `thermodilutionAcceptedAverage` requires accepted **and** technically usable
**and** reviewed.

**Exclusion needs a reason the curve shows.** Every reason in `thermodilutionExclusionReasons` is a
predicate over the trial:

| Reason                                      | Applies when                                                        |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `delivery-did-not-match-entered-values`     | volume or temperature alert on the trial                            |
| `inadequate-or-variable-indicator-delivery` | prolonged, abrupt, or non-continuous bolus                          |
| `respiratory-phase-inconsistent`            | variable respiratory phase                                          |
| `catheter-position-not-confirmed`           | position alert on the trial                                         |
| `secondary-curve-disturbance`               | a rebound above the running minimum once well down from peak        |
| `curve-does-not-settle`                     | the trace never returns to a tenth of its peak inside the recording |
| `baseline-not-stable`                       | pre-onset spread exceeds 8% of the peak excursion                   |

"This one disagrees with the others" is not expressible: no reason here is satisfied by a
concordant, technically clean trial. The reducer says so in words when a learner tries.

**Repeatability is not accuracy.** The series readout shows the range and spread of the accepted
trials, states whether the technique was consistent, applies no numeric agreement criterion, and
says that a series acquired the same slightly imperfect way every time agrees with itself and is
shifted together. `repeatable-but-biased-series` is a named failure mode on the method record.

**What the model can actually show.** Significant tricuspid regurgitation in this engine broadens the
curve so its decay may not return toward baseline inside the recorded window; it does **not** produce
a visible second excursion. Three learner-facing surfaces say so and none contradicts it: the
open-question record, the thermodilution failure mode, and the alert the generator raises. No
direction of bias is asserted anywhere.

The generic `secondary-curve-disturbance` category is unchanged — it is a real curve-quality problem,
and a test builds a trace that genuinely rebounds after decaying to prove the exclusion reason still
fires for one. What was removed is the claim that the _modeled regurgitant_ curve shows it.

A copy contract enforces this: no tricuspid-regurgitation-specific sentence may contain "secondary
disturbance", "second excursion", or "recirculation disturbance", and the rendered open-question card
must describe a broadened, unsettled curve.

## Fick

`fickCardiacOutput` returns the whole chain: oxygen uptake with its provenance, hemoglobin, both
saturations with their sampling site and timing, the dissolved-oxygen term, both oxygen contents,
their difference (labeled as the denominator), the unit account, and either a flow or a withholding
with its reasons.

**Withheld when** a required input is missing or out of range; the content difference is at or below
zero; the venous specimen did not come from the pulmonary artery; the patient was not in a steady
state; the inputs do not belong to one measurement episode; or an intracardiac shunt is present.

**The shunt boundary fails closed.** Any `intracardiacShuntPresent` withholds, with no way round it.
A companion `shuntSamplingAddressed` flag used to sit beside it, and setting it produced an ordinary
result — from one arterial content and one pulmonary-artery content, which is a single systemic
difference. The flag has been **removed**, not defaulted, so no boolean can wave an under-specified
shunt calculation through. Its only non-`false` use anywhere was the test that had to change.

The withholding names the boundary precisely: _this simple one-difference Fick calculation cannot
represent separate pulmonary and systemic flow, and a dedicated compartmental oximetry and Qp/Qs
calculation is outside this model._ That is narrower than "Fick does not work in shunts", and a test
asserts the copy does not drift into the wider claim.

A central venous specimen is **not** treated as interchangeable with a true mixed-venous one — the
registry carries no claim supporting that substitution in this context, so the calculation is
withheld rather than hedged.

**Units.** 1.34 mL/g × Hb g/dL × saturation (+ dissolved term) = mL/dL for each content; difference
in mL/dL; VO₂ mL/min ÷ (difference mL/dL × 10 dL/L) = L/min. The account is printed with the
conversion in it, and the test asserts hand-computed magnitudes so a conversion regression cannot
change both sides of the expectation.

**Amplification.** `fickErrorAmplification` applies one fixed absolute saturation error to two input
sets. The workbench places a wide and a narrow content difference side by side: same input error,
smaller denominator, larger proportional output error.

## Method disagreement

Four episodes inside `thermodilution-series` — no new persistent activity. Values below come from
the numeric audit.

| Episode                              | Thermodilution                                     | Fick                                | Defensible position                                                            |
| ------------------------------------ | -------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `co-cmp-td-acquisition-poor`         | withheld (three different techniques)              | 5.82 L/min, measured uptake         | Report Fick by name; repeat thermodilution with one technique                  |
| `co-cmp-fick-assumption-limited`     | 7.2 L/min from three reviewed trials               | 6.49 L/min, **assumed** uptake      | Report thermodilution by name; record Fick as an assumption-dependent estimate |
| `co-cmp-both-limited`                | withheld (curves do not finish; one off-technique) | withheld (SVC specimen, not steady) | Withhold both, say why, and repeat                                             |
| `co-cmp-both-acceptable-still-apart` | 4.2 L/min                                          | 3.30 L/min                          | Report both with methods named; trend with one                                 |

Every episode offers an averaging position and none marks it defensible. No universal ranking is
authored; where a direction of bias is unsupported the episode says so and names the open question.

## Section completion

`thermodilutionSectionCompletion` requires all of:

1. an accepted series (three reviewed, technically usable trials);
2. every accepted trial reviewed;
3. every excluded trial carrying a technical reason;
4. the two Fick methods separated by the learner;
5. a method disagreement resolved without averaging.

Committing an answer reveals right-and-why and advances nothing; Continue stays a separate action.
The station's hands-on gate (`pacGuidedObjectiveComplete`) stays the reviewed accepted series.
Nothing here touches the persisted payload, storage key, completion-rule id, scoring, or mastery.

This station's transfer keeps the series the learner built rather than resetting to a new patient
state, because its transfer is the paired-method comparison rather than a repeat of the acquisition.

## Regression falsification

Nine defects were introduced one at a time and reverted. All nine fail loudly.

| Defect                                          | Caught by                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Assumed oxygen uptake named direct Fick      | import-time validator — every suite importing the content fails to load |
| 2. Rejected trial in the accepted average       | `simulation.test.ts` three-curve average; H4 accepted-series check      |
| 3. Invalid trial completes the section          | four checks across `simulation.test.ts` and H4 completion               |
| 4. Exclusion without a technical reason         | three H4 exclusion checks                                               |
| 5. Averaging marked defensible                  | `validateCardiacOutputComparisons` at import — suites fail to load      |
| 6. Reasoning revealed before commitment         | H4 disagreement-lab commitment check                                    |
| 7. Broken unit conversion                       | H4 unit-reconciliation check                                            |
| 8. Repeatability described as proof of accuracy | H4 repeatability check                                                  |
| 9. Method name removed from a result            | H4 method-attachment check                                              |

A later correction pass added three more, run the same way:

| Defect                                                            | Caught by                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| A. Stale tricuspid-regurgitation "secondary disturbance" sentence | three checks in the TR copy contract, including the rendered card |
| B. Stale tricuspid-regurgitation generator alert                  | the TR copy contract's no-secondary-disturbance check             |
| C. Shunt bypass boolean re-added                                  | the no-boolean-bypass check                                       |

## Status

Educational simulation pending SME review and later novice testing. This is not a claim of
procedural competence, bedside readiness, independent PAC competency, or release readiness.

Open items for owner review:

- Sentence-level verification of every H4 claim against source text and locators, once the source
  documents are available.
- Whether the source set should be expanded to support a numeric agreement criterion, an
  oxygen-uptake estimating equation, or a direction of bias in tricuspid regurgitation and low flow.
- Whether the hemoglobin binding capacity and dissolved-oxygen coefficient should be promoted from
  model constants to sourced values.
