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

| Section id                         | Panel                             | Clinical question it answers                                                                        | Live inputs                                                                                                                                                   | Visual relationship                                                                                                                        | Numeric guide / evidence surface                                                                                                           | Model boundary stated on screen                                                                                                                                                        | Central “do not infer”                                                                                               | Physician-review question                                                                                                                                                                          |
| ---------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcs-foundations-signals`          | `SignalToPerfusionPanel`          | What does each level of the causal ladder actually tell me right now?                               | MAP, pulse pressure, PCWP, RAP; native / device / effective flow; SvO₂; CPO                                                                                   | Four stacked rungs, the fourth deliberately empty                                                                                          | `mcs.cardiacPowerOutputW`                                                                                                                  | The rungs are a teaching order, not a measurement chain; this engine calculates no whole-body oxygen delivery because haemoglobin and arterial oxygen content are not modeled          | A preserved mean pressure is not adequate perfusion, and SvO₂ is a balance signal rather than a delivery measurement | Is “oxygen-delivery **evidence**” with a modeled SvO₂ beside an explicit “not calculated” box the right way to teach this rung, or should the rung be renamed?                                     |
| `mcs-foundations-mechanisms`       | `SupportPathwayMechanismsPanel`   | Which of these mechanisms actually moves blood, and from where to where?                            | Device topology, native / device / effective flow, pulse pressure, LVEDV, MAP                                                                                 | Source → active component → destination schematic per pathway in place, then a six-mechanism comparison table read from the pathway cards  | none (topology, not interpretation)                                                                                                        | Two of the six mechanisms are described and not simulated; the schematic is a compartment statement, not a scale drawing; insertion route is not drawn                                 | Ranking mechanisms by the size of the number on their display                                                        | Are the seven “required distinctions” stated in the right words — particularly VA loading the LV and VV adding no systemic flow, both of which are comparison-only here?                           |
| `iabp-timing-triggering`           | `IabpTimingTriggeringPanel`       | Is the balloon inflating at the right moment?                                                       | Waveform buffer, trigger, assist ratio, inflation/deflation offsets, timing synchrony, assisted-beat index                                                    | ECG above the arterial trace on one axis with four marked landmarks (notch, inflation, deflation, next upstroke) and banded assisted beats | none; the synchrony percentage is labelled a simulation value                                                                              | The notch is placed at the engine's fixed cycle fraction rather than detected from the trace; the trace is modeled, not recorded; no product console is imitated                       | The synchrony percentage is not a validated bedside score and nothing asks for a particular value of it              | Is placing the dicrotic notch at a fixed cycle fraction acceptable for teaching timing, or does it need to be detected from the modeled trace?                                                     |
| `iabp-efficacy-limits`             | `IabpEfficacyLimitsPanel`         | The balloon is timed correctly and the patient is still not perfusing — is that a timing problem?   | Timing synchrony, MAP, pulse pressure, native / effective flow, SvO₂, CPO, retained trend                                                                     | Two accounts side by side (device performance vs what the circulation is receiving) and a two-line trend on one time axis                  | `mcs.cardiacPowerOutputW`                                                                                                                  | The two trend lines are scaled separately so both fit a narrow pane, so a crossing means nothing; the retained trend is minutes, not a shift                                           | An augmented arterial trace is not proof of sufficient cardiac output                                                | Is “support ceiling” the right framing, and is the separately-scaled two-line trend honest enough with its label, or should it be a table?                                                         |
| `impella-unloading-placement`      | `ImpellaUnloadingPlacementPanel`  | The setting has not changed and the flow has fallen — where is the inlet sitting?                   | Placement state, performance level, pump pressure gradient, left device flow, effective flow, LVEDV, PCWP, aortic-valve opening, alarms                       | A five-link chain: position → gradient → estimated flow → chamber size → delivery                                                          | `clarification.mcs.impella-cp-flow-measurands` and `conflict.mcs.impella-cp-textbook-flow`, in separate disclosures with different framing | The three placement states are teaching states, not measurements; LVEDV is an educational surrogate; real position needs imaging, qualified operators, current IFU and local standards | Raising the performance level because a displayed flow fell                                                          | Do the position/unloading claims read as physiology rather than as placement instruction, and is the split between the manufacturer clarification and the textbook disagreement clear at a glance? |
| `impella-suction-purge-rv`         | `ImpellaSuctionPurgeRvPanel`      | A left-sided pump at high support is in suction — more support, or more delivery to the left heart? | Both pathways, left and right device flow, pump balance, effective flow, RAP, PCWP, PVR, suction, position, purge, PAPi                                       | Two serial pathways drawn separately, then a four-domain reconciliation table with a “can settle / cannot settle” pair per domain          | `mcs.pulmonaryArteryPulsatilityIndex`, plus the simulator PAPi boundary                                                                    | Haemolysis is not modeled and neither is purge-system behaviour; a purge warning changes no modeled blood flow; PAPi moves only weakly with right-sided support, and through RAP       | Adding the two pump flows; reading pump balance as an output; using PAPi alone to judge right-sided support          | Is the four-domain differential the right decomposition, and is the purge row clearly _not_ a suction row?                                                                                         |
| `lvad-parameters-assessment`       | `LvadParametersAssessmentPanel`   | The speed has not changed and the displayed flow has fallen — what does that number measure?        | Speed, power, PI, displayed flow, gradient, MAP, SVR, RAP, PCWP, LVEDV, aortic-valve opening, effective flow, CPO                                             | A five-step dependency chain, then a worked cardiac-power example shown only when the live state demonstrates it                           | `mcs.cardiacPowerOutputW`                                                                                                                  | The displayed flow is computed from power and speed against an assumed viscosity; this module publishes no speed, power, PI or alarm value for a durable pump                          | A rising cardiac power is not evidence that perfusion improved                                                       | Is the speed → power → estimated-flow → PI chain the right teaching order, and is the CPO/afterload paradox stated safely for a trainee who may see it at a bedside?                               |
| `lvad-alarms-emergencies`          | `LvadAlarmsEmergenciesPanel`      | Power has climbed and the displayed flow has not moved — which is the signal?                       | Alarms with priority, power path, controller state, speed, power, displayed flow, PI, effective flow, loading signals                                         | An eight-domain localization table whose two columns separate what is present in the model from what is still in the differential          | none (no interpreted number; the alarm band is modeled state, not a threshold)                                                             | In this model the pattern raises power and leaves delivery where it was; haemolysis is not modeled; physical collapse or progressive obstruction is not modeled                        | High power alone does not establish pump thrombosis, and an unchanged flow display is not reassurance                | Is “suspected high-power pattern” strong enough, and is the unmodeled-haemolysis/obstruction boundary prominent enough to stop a learner reading absence as safety?                                |
| `mcs-device-selection-integration` | `DeviceSelectionIntegrationPanel` | Is the limiting problem the left ventricle, or what is reaching it?                                 | RAP, PCWP, pathways in place, LVEDV, aortic valve, preload, SVR, PVR, rhythm, position, tamponade, contractility, native / device / effective flow, CPO, PAPi | The seven common-model questions with a live answer and an explicit limit beside each; two of the seven answer by naming what is missing   | `mcs.cardiacPowerOutputW`, `mcs.pulmonaryArteryPulsatilityIndex`, plus the simulator PAPi boundary                                         | This engine models no gas-exchange failure state; its fixed arterial saturation is a model constant; the phenotype reading has an explicit unresolved branch                           | Filling pressures support phenotype reasoning and do not select a device; no single number produces one              | Is the phenotype-to-pathway framing safe without a device recommendation, and does the “not resolved by these two pressures” branch appear often enough to be believed?                            |

---

## Boundaries flagged for physician review, by section

1. **Oxygen delivery vs SvO₂ (section 1).** The panel names the rung “oxygen-delivery evidence”,
   prints a modeled SvO₂ as a downstream balance signal, and prints a second box saying whole-body
   oxygen delivery is _not calculated by this engine_ because haemoglobin and arterial oxygen content
   are not modeled. No SvO₂ value is set as something to reach. **Review:** is “evidence” the right
   word, and is the pairing clear enough that a learner does not read SvO₂ as delivery?
2. **Pathway loading statements (section 2).** Each pathway prints one “chamber primarily unloaded”
   and one “chamber or vascular bed potentially loaded”, taken verbatim from the standardized cards.
   **Review:** the VA-ECMO row says an arterial return can load the left ventricle, and the
   right-microaxial row says the pulmonary bed and through it the left heart — both are
   comparison-only content here.
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
   dependency, not as six gauges. The cardiac-power paradox is claimed **only when the live state
   shows it**, with both raw values printed. **Review:** the causal order and the paradox wording.
8. **High power, unmodeled haemolysis, unmodeled obstruction (section 8).** The panel says the
   modeled pattern raises power and leaves delivery unchanged, says this module does not teach the
   converse, and names haemolysis and physical collapse/progressive obstruction as unmodeled.
   **Review:** whether “suspected” and those two absences are prominent enough.
9. **Phenotype to pathway (section 9).** The relationship between RAP and PCWP is stated as a
   reading with an unresolved branch, and the four bedside factors it cannot contain are printed
   immediately beneath it. Gas exchange is named as information this simulation does not establish.
   **Review:** whether any part of this could be read as a selection rule.

---

## What this module still does not claim

- No universal treatment target, for any value, anywhere. Cut points render as cohort observations
  through an authored guide; simulator rules render as simulation boundaries.
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
deliberate defects introduced one at a time to confirm the checks fail for the intended reason.

Run the review surface with:

```bash
npx tsx scripts/critical-care/render-mcs-teaching-panels.ts
```

`MCS_SECTION=<id>` narrows it to one section and `MCS_REVEAL_STAGE=<stage>` to one stage. It exits
non-zero on a missing panel, a duplicate panel, a missing text equivalent, a missing model boundary,
a non-finite reading, a missing evidence record, unsupported target language, answer leakage in a
pre-commitment state, a clarification/disagreement reversal, a summed serial flow, an empty figure,
or a figure wide enough to widen the pane.
