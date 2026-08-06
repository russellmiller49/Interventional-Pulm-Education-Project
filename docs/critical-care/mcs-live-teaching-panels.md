# MCS Learn: the nine live teaching panels — clinical review packet

**Package:** M4 — live teaching panels
**Branch:** `claude/mcs-m4-live-teaching-panels-2026-08-06`
**Scope:** one bespoke, state-driven teaching panel per Learn section. No engine change, no new
activity, no new case, no controller fidelity.

This document exists to be argued with. Everything below is a claim the module makes on screen, and
each row names the question a physician reviewer should put to it.

---

## What M4 changed, and what it did not

The M2/M3 learning contract is still the authority for every section's clinical question, task,
action, explanation, boundaries and transfer. M4 did not author a competing task, answer or
completion rule anywhere.

What M4 added is a live figure per section, computed from the state on screen, and a disclosure rule
that decides how much of the section's own teaching may be shown before the learner has committed an
answer.

| Landed in M2/M3, unchanged                                          | Where it is now                             |
| ------------------------------------------------------------------- | ------------------------------------------- |
| Clinical question                                                   | Teaching-pane header, every phase           |
| What you are seeing / what the target represents / why this surface | Teaching pane, every phase                  |
| How the action affects the model, the flow-account note             | Teaching pane, **after** the answer verdict |
| What this establishes / does not establish / one misinterpretation  | Teaching pane, **after** the answer verdict |
| The four causal-ladder explanations                                 | Teaching pane, **at Explain**               |
| The common model and the eight pathway cards                        | Foundation disclosure, unchanged            |
| The learner-action pane's own before-and-after table                | Unchanged, in Observe                       |

The disclosure rule is one function, `mcsRevealStage(phase, predictionCommitted)`, with five stages:
`orientation`, `mechanism`, `observation`, `explanation`, `transfer`. Withholding means the sentence
is **not in the DOM**, not that it is hidden with a stylesheet.

---

## One row per panel

| Section id                         | Panel                             | Clinical question it answers                                                                        | Live inputs                                                                                                                                                   | Visual relationship                                                                                                                                                                                            | Numeric guide / evidence surface                                                                                                                                                        | Model boundary stated on screen                                                                                                                                                                                                                                                                                    | Central “do not infer”                                                                                                                                                         | Physician-review question                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mcs-foundations-signals`          | `SignalToPerfusionPanel`          | What does each level of the causal ladder actually tell me right now?                               | MAP, pulse pressure, PCWP, RAP; native / device / effective flow; SvO₂; CPO                                                                                   | Four stacked rungs, the fourth deliberately empty                                                                                                                                                              | `mcs.cardiacPowerOutputW`                                                                                                                                                               | The rungs are a teaching order, not a measurement chain; the rung is titled “Oxygen delivery — not directly calculated” because hemoglobin and arterial oxygen content are not modeled                                                                                                                             | A preserved mean pressure is not adequate perfusion, and SvO₂ is a modeled delivery–consumption balance signal rather than a delivery measurement                              | Is “Oxygen delivery — not directly calculated”, with SvO₂ labelled a modeled delivery–consumption balance signal, the right way to teach this rung?                                                                                                                                                                      |
| `mcs-foundations-mechanisms`       | `SupportPathwayMechanismsPanel`   | Which of these mechanisms actually moves blood, and from where to where?                            | Device topology, native / device / effective flow, pulse pressure, LVEDV, MAP                                                                                 | Source → active component → destination schematic per pathway in place, then a six-mechanism comparison table read from the pathway cards                                                                      | none (topology, not interpretation)                                                                                                                                                     | Two of the six mechanisms are described and not simulated; the schematic is a compartment statement, not a scale drawing; insertion route is not drawn                                                                                                                                                             | Ranking mechanisms by the size of the number on their display                                                                                                                  | Are the seven “required distinctions” stated in the right words — particularly the qualified VA row (“may increase” LV afterload, configuration-dependent) and the VV row (no direct arterial pump-flow stream, with possible indirect effects on native output), both of which are comparison-only here?                |
| `iabp-timing-triggering`           | `IabpTimingTriggeringPanel`       | Is the balloon inflating at the right moment?                                                       | Waveform buffer, trigger, assist ratio, inflation/deflation offsets, timing synchrony, assisted-beat index                                                    | ECG above the arterial trace on one axis with four marked landmarks (notch, inflation, deflation, next upstroke) and banded assisted beats                                                                     | none; the synchrony percentage is labelled a simulation value                                                                                                                           | The notch is placed at the engine's fixed cycle fraction rather than detected from the trace; the trace is modeled, not recorded; no product console is imitated                                                                                                                                                   | The synchrony percentage is not a validated bedside score and nothing asks for a particular value of it                                                                        | Is placing the dicrotic notch at a fixed cycle fraction acceptable for teaching timing, or does it need to be detected from the modeled trace?                                                                                                                                                                           |
| `iabp-efficacy-limits`             | `IabpEfficacyLimitsPanel`         | The balloon is timed correctly and the patient is still not perfusing — is that a timing problem?   | Timing synchrony, MAP, pulse pressure, native / effective flow, SvO₂, CPO, retained trend                                                                     | Two accounts side by side (device performance vs what the circulation is receiving) and a two-line trend on one time axis                                                                                      | `mcs.cardiacPowerOutputW`                                                                                                                                                               | The two trend lines are scaled separately so both fit a narrow pane, so a crossing means nothing; the retained trend is minutes, not a shift                                                                                                                                                                       | An augmented arterial trace is not proof of sufficient cardiac output                                                                                                          | Is “support ceiling” the right framing, and is the separately-scaled two-line trend honest enough with its label, or should it be a table?                                                                                                                                                                               |
| `impella-unloading-placement`      | `ImpellaUnloadingPlacementPanel`  | The setting has not changed and the flow has fallen — where is the inlet sitting?                   | Placement state, performance level, pump pressure gradient, left device flow, effective flow, LVEDV, PCWP, aortic-valve opening, alarms                       | A five-link chain: position → gradient → estimated flow → chamber size → delivery                                                                                                                              | `clarification.mcs.impella-cp-flow-measurands` and `conflict.mcs.impella-cp-textbook-flow`, in separate disclosures with different framing                                              | The three placement states are teaching states, not measurements; LVEDV is an educational surrogate; real position needs imaging, qualified operators, current IFU and local standards                                                                                                                             | Raising the performance level because a displayed flow fell                                                                                                                    | Do the position/unloading claims read as physiology rather than as placement instruction, and is the split between the manufacturer clarification and the textbook disagreement clear at a glance?                                                                                                                       |
| `impella-suction-purge-rv`         | `ImpellaSuctionPurgeRvPanel`      | A left-sided pump at high support is in suction — more support, or more delivery to the left heart? | Both pathways, left and right device flow, pump balance, effective flow, RAP, PCWP, PVR, suction, position, purge, PAPi                                       | Two serial pathways drawn separately, then a four-domain reconciliation table with a “can settle / cannot settle” pair per domain                                                                              | `mcs.pulmonaryArteryPulsatilityIndex`, plus the simulator PAPi boundary                                                                                                                 | Haemolysis is not modeled and neither is purge-system behaviour; a purge warning changes no modeled blood flow; PAPi moves only weakly with right-sided support, and through RAP                                                                                                                                   | Adding the two pump flows; reading pump balance as an output; using PAPi alone to judge right-sided support                                                                    | Is the four-domain differential the right decomposition, and is the purge row clearly _not_ a suction row?                                                                                                                                                                                                               |
| `lvad-parameters-assessment`       | `LvadParametersAssessmentPanel`   | The speed has not changed and the displayed flow has fallen — what does that number measure?        | Speed, power, PI, displayed flow, gradient, MAP, SVR, RAP, PCWP, LVEDV, aortic-valve opening, effective flow, CPO                                             | A five-step dependency chain, then a worked cardiac-power example shown only when the live state demonstrates it                                                                                               | `mcs.cardiacPowerOutputW`                                                                                                                                                               | Displayed flow is estimated rather than measured directly and this simulation does not reproduce any controller’s proprietary calculation; pump power is the electrical power needed to hold the set speed under hydraulic and mechanical load; the module publishes no universal speed, power, PI or alarm target | A rising cardiac power is not evidence that perfusion improved                                                                                                                 | Is the speed → power → estimated-flow → PI chain the right teaching order, are the power and PI definitions accurate, and is the CPO/afterload paradox stated safely for a trainee who may see it at a bedside?                                                                                                          |
| `lvad-alarms-emergencies`          | `LvadAlarmsEmergenciesPanel`      | Power has climbed and the displayed flow has not moved — which is the signal?                       | Alarms with priority, power path, controller state, speed, power, displayed flow, PI, effective flow, loading signals                                         | An eight-domain localization table whose three columns separate current modeled evidence, what that evidence raises, and what remains in the differential                                                      | none (no interpreted number; the alarm band is modeled state, not a threshold)                                                                                                          | In this model the pattern raises power and leaves delivery where it was; hemolysis is not modeled; physical collapse or progressive obstruction is not modeled; the preload domain carries readings only and no verdict                                                                                            | High power alone does not establish pump thrombosis, and an unchanged flow display is not reassurance                                                                          | Is “suspected high-power pattern” strong enough, is the evaluation list (clinical status, power and flow trends, device logs, hemolysis evaluation, imaging, loading and inflow/outflow causes) right, and is the unmodeled-hemolysis/obstruction boundary prominent enough to stop a learner reading absence as safety? |
| `mcs-device-selection-integration` | `DeviceSelectionIntegrationPanel` | Is the limiting problem the left ventricle, or what is reaching it?                                 | RAP, PCWP, pathways in place, LVEDV, aortic valve, preload, SVR, PVR, rhythm, position, tamponade, contractility, native / device / effective flow, CPO, PAPi | The ACC consensus–described filling-pressure congestion pattern, then the seven common-model questions with a live answer and an explicit limit beside each; two of the seven answer by naming what is missing | `mcs.cardiacPowerOutputW`, `mcs.pulmonaryArteryPulsatilityIndex`, the simulator PAPi boundary, and the three MCS-local congestion sources (ACC 2025, Ortega-Hernández 2023, Garan 2020) | The four-cell grid is an educational operationalization of consensus prose; this simulation models no gas-exchange failure state; its fixed arterial saturation is a model constant; two filling pressures are not a complete profile                                                                              | A congestion pattern says where filling pressures are elevated; it does not name the cause of shock, prove isolated ventricular failure, measure perfusion, or select a device | Does the ACC-described filling-pressure congestion pattern remain clearly separate from diagnosis of the dominant shock mechanism and from support-device selection?                                                                                                                                                     |

---

## Boundaries flagged for physician review, by section

1. **Oxygen delivery vs SvO₂ (section 1).** The rung is titled “Oxygen delivery — not directly
   calculated”. SvO₂ is labelled a _modeled delivery–consumption balance signal_, influenced by the
   modeled balance among blood flow, oxygen availability assumptions, and tissue consumption and
   extraction assumptions; a second box says whole-body oxygen delivery is not calculated here
   because hemoglobin and arterial oxygen content are not modeled. The panel no longer says the
   simulation “fills three” rungs — it says it directly populates pressure and flow. No SvO₂ value is
   set as something to reach. **Review:** is the balance-signal wording clear enough that a learner
   does not read SvO₂ as delivery?
2. **Pathway loading statements (section 2).** Each pathway prints one “chamber primarily unloaded”
   and one “chamber or vascular bed potentially loaded”, taken verbatim from the standardized cards.
   The two extracorporeal comparison rows are now qualified: VV provides gas exchange with **no
   direct arterial pump-flow stream**, while improved gas exchange and altered RV loading may
   indirectly affect native output; VA creates an extracorporeal arterial pathway and **may**
   increase LV afterload and loading, particularly with peripheral retrograde return, higher circuit
   flow, and limited native ejection. **Review:** both qualifications, which are comparison-only
   content — nothing here simulates an extracorporeal circuit.
3. **IABP timing landmarks (section 3).** The dicrotic notch is drawn at the engine's fixed cycle
   fraction, which is also the zero point the inflation offset is measured from. **Review:** is a
   fixed landmark acceptable for teaching the relationship, given the trace itself is modeled?
4. **Support-ceiling framing (section 4).** The panel keeps a technical-performance account and a
   physiologic account visually apart, and says the device display has no way of reporting when they
   disagree. **Review:** is that framing right, and is “ceiling” the word to use with trainees?
5. **Position/unloading claims and the two Impella evidence surfaces (section 5).** Placement is a
   modeled teaching state; the chain checks the unloading claim at the chamber rather than assuming
   it. The manufacturer figures render as a _measurement clarification_ (three measurands) and the
   textbook pair as a _held disagreement_ (two positions), in separate disclosures, with a sentence
   on each saying which kind of thing it is. Nothing is averaged. **Review:** both framings, and the
   sentence that real position is an imaging question.
6. **Suction / purge / RV differential and the PAPi boundary (section 6).** Four domains, each with
   what it can and cannot settle. Purge is stated to raise an alarm and change no modeled blood flow.
   PAPi renders through its guide with the simulator boundary beside it and an explicit statement
   that it must not be used alone. **Review:** the decomposition and the purge wording.
7. **Speed–power–flow–PI and the CPO/afterload relationship (section 7).** The chain is stated as a
   dependency, not as six gauges. Pump power is now **the electrical power required to maintain the
   set speed under the current hydraulic and mechanical load** — related to flow but not one-to-one,
   disruptable by mechanical drag, not a direct measure of systemic delivery, and not a diagnosis of
   thrombosis from one value. Pulsatility index is **the magnitude of cyclic variation in estimated
   pump flow or power**, influenced by contractility, preload, afterload and speed without being a
   direct measure of any of them, and unable on its own to diagnose hypovolemia, RV failure, recovery
   or adequate unloading. Persistent aortic-valve closure is no longer dismissed as expected: it is
   “not automatically a controller fault”, to be interpreted with unloading goals, LV size, aortic
   insufficiency and the implanting program’s strategy. The module refuses **universal** targets
   rather than the existence of device settings. The cardiac-power paradox is claimed only when the
   live state shows it, with both raw values printed. **Review:** the causal order, the two
   definitions, and the paradox wording.
8. **High power, unmodeled hemolysis, unmodeled obstruction (section 8).** The panel says the
   modeled pattern raises power and leaves delivery unchanged, says this module does not teach the
   converse, and names hemolysis and physical collapse/progressive obstruction as unmodeled. The
   evaluation is now stated as clinical status, power and flow trends, device logs where available,
   hemolysis evaluation, focused imaging, and assessment for loading and inflow/outflow causes. The
   localization table has three columns — current modeled evidence, what this raises, what remains in
   the differential — and the preload/right-sided row is **readings only with no modeled verdict**: a
   raised right atrial pressure no longer marks the domain as a positive finding. **Review:** whether
   “suspected” and those two absences are prominent enough.
9. **Congestion pattern to pathway (section 9).** See the dedicated section below. **Review
   question:** does the ACC-described filling-pressure congestion pattern remain clearly separate
   from diagnosis of the dominant shock mechanism and from support-device selection?

---

## The filling-pressure congestion framework (section 9)

### What it replaced

The first version of this panel classified with an unsourced rule: right-dominant at a
right-atrial-to-wedge ratio of 0.85 or more, left-dominant at 0.60 or less, and a wedge of 20 mm Hg
or more as the general left-congestion threshold. None of those numbers came from a published source.
They have been removed from executable code, and a test asserts their absence rather than trusting a
reviewer to notice them returning.

### The primary framework

**ACC consensus–described filling-pressure congestion pattern.** Sinha SS, Morrow DA, Kapur NK,
Kataria R, Roswell RO. _2025 Concise Clinical Guidance: An ACC Expert Consensus Statement on the
Evaluation and Management of Cardiogenic Shock._ J Am Coll Cardiol. 2025;85(16):1618–1641, section
4.4, Invasive Hemodynamics, pages 1626–1627. Rendered on screen as **Expert consensus statement**,
with the citation, the locator, and the evidence id `acc-cs-concise-clinical-guidance-2025`.

The source describes LV-dominant congestion as often characterized by a wedge or LV end-diastolic
pressure above 15 mm Hg; RV-dominant congestion as an elevated right atrial or central venous
pressure above 15 mm Hg with a relatively normal wedge; and a biventricular profile as elevation of
both. It suggests integrating invasive hemodynamics with echocardiography or point-of-care ultrasound.

The four categories this module operationalizes from that prose:

| Live state             | Category shown                                         |
| ---------------------- | ------------------------------------------------------ |
| RAP > 15 and PCWP ≤ 15 | RV-predominant filling-pressure congestion pattern     |
| PCWP > 15 and RAP ≤ 15 | LV-predominant filling-pressure congestion pattern     |
| RAP > 15 and PCWP > 15 | Biventricular filling-pressure congestion pattern      |
| RAP ≤ 15 and PCWP ≤ 15 | Neither filling pressure is elevated by this framework |

**The boundary is strictly greater than 15.** At exactly 15 mm Hg a pressure is not above the
threshold the source describes, and the module does not round it upward. Each pressure is judged
against the threshold on its own: no ratio between them changes the answer.

**The grid is labelled as an operationalization wherever it appears:** _“An educational
operationalization of the ACC consensus description of filling-pressure congestion patterns. The
consensus statement describes these patterns in prose; it did not publish or validate this software
grid.”_ The panel does not claim the ACC published a validated algorithm.

**The fourth category is never called euvolemic.** It reads “Neither filling pressure is elevated by
this framework”, and states that this does not establish true euvolemia, adequate preload, adequate
forward flow, or adequate organ perfusion.

### Why it is a pattern and not a diagnosis

The panel prints, beside the classification: _“This pattern describes where filling pressures are
elevated. It does not independently establish the cause of shock, prove isolated ventricular failure,
measure organ perfusion, or select a support device.”_ It then names what to reconcile it with —
cardiac output or effective flow, pulmonary artery pressures, PA saturation when measured,
echocardiography, clinical examination, gas-exchange requirements, and trajectory — and lists what no
reading on the screen contains: local expertise, vascular access and anatomy, contraindications,
expected duration of support, whether gas exchange is part of the problem, and the patient's goals.

The first common-model question now answers: _“Filling pressures identify a [pattern]. The dominant
shock mechanism is not fully determined by these two pressures.”_

### The cohort definition, kept separate

**Ortega-Hernández JA, González-Pacheco H, Gopar-Nieto R, et al.** _Dynamic Invasive Hemodynamic
Congestion Profile Impacts Acute Myocardial Infarction Complicated by Cardiogenic Shock Outcomes: A
Real-World Single-Center Study._ J Card Fail. 2023;29(5):745–756. Rendered as **Single-center
retrospective cohort study**, evidence id `ortega-hernandez-ami-cs-congestion-2023`, in its own
dashed-border block inside a keyboard-operable disclosure.

Its cut points were RAP ≥ 12 mm Hg and PCWP ≥ 18 mm Hg, used to sort 295 AMI-CS patients at one
center into four profiles and reassessed serially over the first 24 hours; a persistent congestive
profile was associated with higher in-hospital mortality and the biventricular profile carried the
highest. The module states that these are cohort operational definitions and prognostic associations,
not universal thresholds and not treatment targets.

Where the study's own word is preserved, it is qualified immediately: _“Euvolemic was the study's
label for the quadrant below both cohort cutoffs. It does not independently establish total-body
euvolemia or adequate perfusion.”_

**15, 12 and 18 are never averaged.** The panel prints an explicit statement that no compromise value
is created from them, and a test asserts no intermediate figure appears. The ACC framework is the one
that classifies, because this module addresses cardiogenic shock more broadly than a single-center
AMI-CS cohort.

### The complete-profile boundary

**Garan AR, Kanwar M, Thayer KL, et al.** _Complete Hemodynamic Profiling With Pulmonary Artery
Catheters in Cardiogenic Shock Is Associated With Lower In-Hospital Mortality._ JACC Heart Fail.
2020;8(11):903–913, Classification of PAC Usage, page 905. Rendered as **Multicenter registry
analysis**, evidence id `garan-cswg-complete-pac-profile-2020`.

A complete profile there required five measured components — right atrial pressure, pulmonary artery
systolic pressure, pulmonary artery diastolic pressure, wedge pressure, and pulmonary artery oxygen
saturation. Derived values including cardiac index, cardiac power output, PAPi and vascular resistance
were recorded but did not count toward completeness. The panel uses this to say what two filling
pressures are not, and to state that this simulation's mixed venous saturation is a modeled balance
signal rather than a measured pulmonary artery saturation. Garan supplies no filling-pressure cut
point and is not used for one.

### The right-atrial-to-wedge ratio

Retained as context only. It is labelled a **derived arithmetic relationship** with no unit, and the
0.6 figure is identified solely as an adverse-outcome association listed in the cited consensus
statement — never as a phenotype boundary, a congestion-profile boundary, a device rule, or a target.
The source prints “>0.6 mm Hg”; the module carries the ratio without units, because a ratio has none.

### Source-registration limitation, for a serialized follow-up

None of these three papers is in `docs/critical-care/source-manifest.json`, which this package does
not own, and none is in `mcsSources`, because `McsSource['sourceType']` lives in `engine/types.ts` —
frozen for this pass — and its six members (`guideline`, `manufacturer`, `fda-labeling`,
`fda-safety-notice`, `reference-package`, `educational-model`) contain no accurate description of a
peer-reviewed cohort study or a registry analysis. Rounding either study into `guideline` or
`reference-package` would have been a false claim about the kind of evidence it is.

The same gap exists one level up: `CriticalCareValueReferenceKind` offers `guideline-recommendation`
and `cohort-observation` and nothing between them, and the ACC document states in its own preface
that Concise Clinical Guidance is transitional guidance issued _before_ the evidence required for an
expert consensus decision pathway or a clinical practice guideline — so a badge reading “Guideline
recommendation” would overstate it. The congestion material therefore prints its own accurate source
kind in words rather than borrowing that vocabulary.

**Smallest serialized follow-up:** add a `peer-reviewed-study` (or `cohort-study` plus
`expert-consensus`) member to `McsSource['sourceType']` in `engine/types.ts`, register the three
papers in `mcsSources` so they appear in the module Sources panel and resolve through
`criticalCareEvidenceById`, and add the three to the shared source manifest. None of that changes any
claim on screen; it changes only where the bibliographic record lives.

---

## What this module still does not claim

- No universal treatment target, for any value, anywhere. Cut points render as cohort observations
  through an authored guide; simulator rules render as simulation boundaries; the congestion
  framework renders with its own source kind, citation, locator and evidence id in words.
- No congestion category, filling pressure, ratio, or derived value selects, recommends, prefers or
  indicates a support pathway.
- No product alarm limit is reproduced. No controller display is imitated — that is M6.
- No insertion, advancement, repositioning, anticoagulation or purge-fluid instruction.
- No patient-level outcome: no recovery, no survival, no duration of support.
- Working through a section records participation in an educational module. It does not establish
  readiness for independent device selection, insertion, operation, or troubleshooting.

---

## Review status

**Formal novice testing has not yet occurred and remains M7.** Nothing in this package has been put
in front of a learner who did not build it. What has been done is: every panel rendered against
reducer-produced states at all five reveal stages and both pane widths; every Learn section walked
through all six phases in a browser at 1600×900, 1440×900, 1280×720 and 1024×768; and eight
deliberate defects introduced one at a time to confirm the checks fail for the intended reason. The
correction pass added thirteen more deliberate defects covering the congestion framework and every
reworded clinical claim, each confirmed to fail for its intended reason and then restored.

Run the review surface with:

```bash
npx tsx scripts/critical-care/render-mcs-teaching-panels.ts
```

`MCS_SECTION=<id>` narrows it to one section and `MCS_REVEAL_STAGE=<stage>` to one stage. It exits
non-zero on a missing panel, a duplicate panel, a missing text equivalent, a missing model boundary,
a non-finite reading, a missing evidence record, unsupported target language, answer leakage in a
pre-commitment state, a clarification/disagreement reversal, a summed serial flow, an empty figure,
or a figure wide enough to widen the pane.
