No human observation is being reported.

# B6 remaining-panel clinical review packet

This packet records synthetic review of the fourteen Learn panels outside the frozen six-panel human-test build. Synthetic agents generated draft content, exercised engine states, and challenged clinical and instructional claims. They are not human participants, and their reports do not establish usability, comprehension, competency, readiness, prevalence, or safety performance.

Every panel remains **draft, non-credit-eligible, held from deployment, and held from promotion**. “Advance” below means only that an independent review lens found no panel-local blocker before integration; it never means release approval.

## Independence and disposition method

- Zeno owned the five VV panel drafts. Wegener, who did not author those panels, performed their clinical and live-state review.
- Wegener owned the nine VA panel drafts. Zeno, who did not author those panels, performed their clinical and live-state review.
- Lagrange authored no panel and independently rendered and cross-examined all fourteen for instructional leakage, source alignment, harmful-action response, and Practice/Assess isolation. The initial adversarial result was seven panel-local advances and seven holds.
- The integration lead applied corrections only after the independent reports were complete. Corrected copy is called out below; unresolved disagreements remain visible.
- Clinical, instructional, live-state, and adversarial review are separate lenses even where one independent agent performed more than one lens. No panel was reviewed by its author.

## Review status ledger

| Panel                                      | Independent clinical review            | Instructional / answer-leak review | Independent live-state review              | Adversarial review                  | Current overall status      |
| ------------------------------------------ | -------------------------------------- | ---------------------------------- | ------------------------------------------ | ----------------------------------- | --------------------------- |
| `afterload-return-obstruction`             | Conditional advance                    | Pass                               | Pass with model caveat                     | Hold: apparent RPM benefit          | **HOLD — draft/non-credit** |
| `afterload-oxygenator-resistance`          | Hold: PO signal/source scope           | Hold: precommit leak, corrected    | Hold: missing PO signal, corrected         | Hold: apparent RPM benefit/source   | **HOLD — draft/non-credit** |
| `acute-hypercapnia`                        | Conditional advance                    | Advance                            | Pass                                       | Advance                             | **HOLD — draft/non-credit** |
| `compensated-hypercapnia`                  | Hold: state drift                      | Advance                            | Hold: state drift                          | Advance with owner question         | **HOLD — draft/non-credit** |
| `transport-power-loss`                     | Hold: transfer/backup state            | Hold: runtime leak, corrected      | Pass with unmodeled backup                 | Hold: precommit leak, corrected     | **HOLD — draft/non-credit** |
| `va-startup-sensor-orientation`            | Hold: baseline requirements, corrected | Advance                            | Hold: baseline coverage, corrected         | Advance with owner question         | **HOLD — draft/non-credit** |
| `va-preload-drainage-collapse`             | Hold: competitor/stale upstream copy   | Advance                            | Pass                                       | Advance with frozen-copy dependency | **HOLD — draft/non-credit** |
| `va-afterload-arterial-return-obstruction` | Hold: apparent RPM benefit             | Pass                               | Hold: contextual contradiction             | Hold: apparent RPM benefit          | **HOLD — draft/non-credit** |
| `va-afterload-oxygenator-resistance`       | Hold: leak/source/model                | Hold: precommit leak, corrected    | Hold: apparent RPM benefit                 | Hold: leak/apparent benefit         | **HOLD — draft/non-credit** |
| `va-lv-loading`                            | Hold: action semantics/model           | Advance with owner review          | Hold: WOB/action semantics                 | Advance with owner review           | **HOLD — draft/non-credit** |
| `va-acute-hypercapnia`                     | Hold: WOB invariant                    | Advance                            | Hold: WOB invariant, disclosed             | Advance                             | **HOLD — draft/non-credit** |
| `va-gas-source-interruption`               | Hold: precommit/source scope           | Advance with wording review        | Hold: corrected-state semantics, corrected | Advance with wording review         | **HOLD — draft/non-credit** |
| `va-arterial-bubble-stop`                  | Hold: source/order/model               | Hold: isolation leak, corrected    | Hold: same-time physiology                 | Hold: leak/source/order             | **HOLD — draft/non-credit** |
| `va-transport-power-loss`                  | Hold: source/backup state              | Hold: workflow leak, corrected     | Pass with unmodeled backup                 | Hold: leak/source scope             | **HOLD — draft/non-credit** |

## Panel records

### `afterload-return-obstruction` — VV return-side resistance

- **Intended mental model:** pInt and pArt rising together without a widened membrane gradient localize resistance beyond the membrane; pVen and independent patient observations answer different questions.
- **Prerequisite concept:** pressure-zone locations, flow dependence of pressure, and the distinction between circuit pArt and patient arterial pressure.
- **Best prediction:** keep settings stable for localization, inspect the return path and sensor plausibility, correct the identified cause, then reassess circuit and patient state.
- **Strongest distractor:** raise RPM because the engine can show a short-term increase in displayed flow and oxygenation.
- **Harmful reflex:** repeated speed escalation against a fixed return resistance.
- **Live response:** fault correction lowers the shared post-pump load and permits modeled flow recovery. Higher RPM can also raise displayed flow while increasing pInt/pArt; the postcommit draft now explicitly labels that as an apparent partial benefit with pressure cost, not resolution.
- **Source support:** `ecmo-book-ch9`, `ecmo-book-ch17`, `elso-circuit-2022`, and `bounded-educational-model` support pressure-zone localization, pump loading, general circuit assessment, and only the bounded response shown.
- **Model boundary:** one fixed resistance does not represent positional/intermittent obstruction, hemolysis, or the exact corrective procedure.
- **Flagged owner question:** is the apparent flow/oxygenation gain during RPM escalation an approved contextual distinction, and should the engine apply a stronger negative-path consequence?
- **Reviewer disagreement:** the VV clinical/live reviewer conditionally advanced the panel; the adversarial reviewer held it because the harmful control can look beneficial. The integration copy reconciles the visible benefit but cannot resolve the engine policy.
- **Status:** **HOLD — draft/non-credit** pending owner approval of the contextual distinction and human reconciliation.

### `afterload-oxygenator-resistance` — VV membrane-segment resistance

- **Intended mental model:** a widened pInt-to-pArt gradient interpreted at comparable flow, corroborated by gas-transfer information, localizes concern to the membrane segment without creating an exchange threshold.
- **Prerequisite concept:** return-obstruction comparison, ΔP flow dependence, pressure sensor locations, and post-oxygenator sampling.
- **Best prediction:** inspect the bracketed segment and channel plausibility, integrate gas-transfer evidence, and escalate through the reviewed local exchange pathway.
- **Strongest distractor:** drive the circuit harder to recover flow or exchange the component from one gradient alone.
- **Harmful reflex:** speed escalation against the restricted segment or a procedure decision based on an isolated number.
- **Live response:** correction improves modeled pressure, flow, and post-oxygenator oxygenation direction. The panel now exposes the engine-produced PO saturation and explains that higher RPM may briefly improve flow while worsening membrane load.
- **Source support:** `ifu-anomaly-boundary`, `ecmo-book-ch9`, `ecmo-book-ch17`, `ecmo-book-ch18`, `elso-circuit-2022`, and `bounded-educational-model` support device limits, localization, gas-transfer context, general escalation, and the bounded model only.
- **Model boundary:** no clot burden, hemolysis, viscosity/temperature evolution, trend duration, universal ΔP cutoff, or exchange choreography is modeled.
- **Flagged owner question:** which independent current source authorizes the definitive exchange decision and procedure language for release?
- **Reviewer disagreement:** the adversarial reviewer found a precommit “oxygenator-failure/component exchange” leak and an apparent RPM benefit; the clinical/live reviewer also held for a missing live PO value. The leak was moved postcommit and PO was added, but source and model questions remain.
- **Status:** **HOLD — draft/non-credit** pending source-owner and model-owner resolution.

### `acute-hypercapnia` — VV acute carbon-dioxide control

- **Intended mental model:** acute hypercapnic acidemia is interpreted with pH, bicarbonate, phase, and patient state; external sweep principally changes modeled membrane CO₂ clearance and is distinct from pump speed and sweep-gas oxygen fraction.
- **Prerequisite concept:** blood path versus external gas path and phase-aware blood-gas interpretation.
- **Best prediction:** verify delivered gas continuity, make the bounded authored sweep increase, and reassess blood gas and patient state.
- **Strongest distractor:** raise RPM or sweep-gas oxygen fraction because either appears to be “more ECMO support”; interrupted delivery remains a clinically plausible competitor to check.
- **Harmful reflex:** use the wrong control to normalize CO₂ or ignore an acute acidemic state.
- **Live response:** bounded sweep increase improves modeled PaCO₂/pH direction; RPM changes can change flow/oxygenation while leaving PaCO₂/pH unchanged.
- **Source support:** `ecmo-book-ch16`, `ecmo-book-ch18`, `elso-adult-vv-2021`, and `bounded-educational-model` support acid-base context, sweep physiology, adult VV reassessment, and only the authored curve.
- **Model boundary:** response is rapid, simplified, and one-compartment; no value is a universal PaCO₂, pH, or sweep target.
- **Flagged owner question:** what displayed reassessment window communicates direction without implying bedside kinetics?
- **Reviewer disagreement:** both independent reviews found the panel locally defensible; the remaining hold reflects the global human-test/release gate rather than a known panel-local safety contradiction.
- **Status:** **HOLD — draft/non-credit** until human reconciliation and release-owner approval.

### `compensated-hypercapnia` — VV phase-aware hold decision

- **Intended mental model:** an elevated PaCO₂ does not automatically require normalization when pH, bicarbonate, symptoms, phase, trends, and the patient-centered goal fit an authored compensated state.
- **Prerequisite concept:** acute hypercapnia, compensation, and the distinction between an abnormal number and a treatment goal.
- **Best prediction:** hold the current sweep in this authored case, confirm goals and trends, and reassess rather than normalize a number reflexively.
- **Strongest distractor:** rapidly increase sweep to make PaCO₂ look normal; a concurrent metabolic alkalosis is now retained as a competing explanation rather than silently excluded.
- **Harmful reflex:** abrupt normalization of a modeled compensated state.
- **Live response:** excessive sweep produces the authored hypocapnic/alkalemic direction. A nominal hold still releases the timed fault and drifts PaCO₂/pH over later steps; the panel now discloses that behavior and does not present it as validation of holding.
- **Source support:** the panel-local set is `ecmo-book-ch16`, `ecmo-book-ch18`, and `bounded-educational-model`, supporting contextual acid-base interpretation, sweep control, and only the bounded state. The upstream prediction also registers broader adult-VV and device context; those records are not attributed to this panel-local claim set.
- **Model boundary:** renal history, mixed disorders, and compensation are authored rather than physiologically accumulated; the post-hold drift is a known model limitation, not a clinical forecast.
- **Flagged owner question:** should the engine preserve the state during a credited hold, or should the lesson be reframed around reassessment before the automatic fault release?
- **Reviewer disagreement:** the instructional/adversarial reviewer advanced the original concept, while the clinical/live reviewer held it because the live engine drifts despite unchanged settings. Disclosure preserves the disagreement; it does not solve it.
- **Status:** **HOLD — draft/non-credit** pending model-owner disposition.

### `transport-power-loss` — VV transport power continuity

- **Intended mental model:** a battery percentage is a current device-state indication, not a validated time forecast; temporary power changeover does not justify trading away blood flow while the source and backup plan are secured.
- **Prerequisite concept:** power source versus pump/circuit state and the need to assess patient support independently.
- **Best prediction:** restore verified external power without reducing required support, confirm forward flow and patient state, and perform the approved backup-readiness check outside the model.
- **Strongest distractor:** reduce RPM or wait on the displayed percentage to conserve an assumed reserve interval.
- **Harmful reflex:** lower pump speed and wait rather than securing power.
- **Live response:** lowering RPM reduces flow and modeled oxygenation while the battery continues to decline; restoring power changes the represented source state. Precommit copy no longer explains runtime or backup conclusions before commitment.
- **Source support:** `ifu-console-workflow`, `ecmo-book-ch9`, `elso-circuit-2022`, and `bounded-educational-model` support power status, continuity planning, circuit/patient reassessment, and only the authored battery curve.
- **Model boundary:** no validated remaining-time prediction, external connection reliability, backup availability, or emergency-drive readiness state is represented.
- **Flagged owner question:** should backup readiness become an explicit observable action/state, remain a verbal obligation, or be removed from simulated credit?
- **Reviewer disagreement:** the adversarial reviewer held the original precommit runtime wording; the clinical reviewer held for the absent Practice transfer and unobservable backup state. The answer leak was corrected, but transfer and observability remain open.
- **Status:** **HOLD — draft/non-credit** pending assessment, transfer, and model-owner decisions.

### `va-startup-sensor-orientation` — peripheral femoral VA startup

- **Intended mental model:** shared hardware does not erase VA topology; whole-system startup must establish device, circuit, external gas/power, independent regional/native-heart, perfusion, and cannulated-limb baselines.
- **Prerequisite concept:** the four information domains plus peripheral femoral VA parallel circulation.
- **Best prediction:** complete diagnostic and tip-to-tip circuit verification, identify drainage/arterial-return destinations, and record required upper/lower-body, pulsatility, perfusion, and limb baselines before support.
- **Strongest distractor:** reuse the VV device check unchanged or start because the console is quiet and hardware is familiar.
- **Harmful reflex:** begin support before physical topology and independent monitoring are verified.
- **Live response:** the self-test and represented channel availability change only after the authored inspection/startup sequence; the draft now explicitly records the regional, native-heart, perfusion, and limb baseline obligations.
- **Source support:** `ifu-console-workflow`, `ecmo-book-ch9`, `elso-adult-va-2021`, and `bounded-educational-model` support console workflow, circuit orientation, independent VA assessment, and only the bounded startup state.
- **Model boundary:** stopped-pump pressures remain unavailable rather than proven zero; cannulation, distal-perfusion setup, and hands-on readiness are not certified.
- **Flagged owner question:** which baseline elements are mandatory startup checks versus later transfer content, and what negative-path behavior should guard early speed manipulation?
- **Reviewer disagreement:** the adversarial reviewer advanced the panel with an owner question; the VA clinical/live reviewer initially held it for incomplete baseline documentation. The missing baseline copy was added, but negative-path and release questions remain.
- **Status:** **HOLD — draft/non-credit** pending clinical-owner and human reconciliation.

### `va-preload-drainage-collapse` — VA drainage limitation

- **Intended mental model:** more RPM can worsen drainage-limited blood flow and reduce the circuit contribution to parallel circulation; circuit findings identify the location but not the patient cause.
- **Prerequisite concept:** drainage capacity, pVen/chatter localization, and native-plus-device support.
- **Best prediction:** temporarily reduce pump demand, examine the drainage path and patient causes, correct the cause, and retitrate under local goals.
- **Strongest distractor:** give volume immediately from console data alone or increase RPM to chase displayed flow.
- **Harmful reflex:** escalating speed against an already limited drainage path.
- **Live response:** raising RPM worsens pVen/chatter and can lower displayed flow; the draft now includes a volume-first competitor and keeps patient perfusion separate from circuit localization.
- **Source support:** `ecmo-book-ch9`, `ecmo-book-ch17`, `elso-adult-va-2021`, and `bounded-educational-model` support preload dependence, pressure localization, VA reassessment, and the authored capacity curve.
- **Model boundary:** drainage capacity, chatter threshold, and recovery magnitude are authored; no universal volume, pVen, flow, MAP, or RPM target is claimed.
- **Flagged owner question:** when may temporary demand reduction be taught as the first modeled move without being mistaken for a universal prescription?
- **Reviewer disagreement:** the adversarial reviewer advanced the draft, while the VA clinical reviewer initially held for a missing volume-first distractor and a frozen upstream verdict whose “flow creeps upward” direction contradicts engine sweeps. The distractor was added; the frozen copy remains an owner dependency.
- **Status:** **HOLD — draft/non-credit** pending frozen-copy reconciliation and clinical-owner review.

### `va-afterload-arterial-return-obstruction` — VA arterial-return resistance

- **Intended mental model:** pInt and pArt rising together localize circuit load beyond the membrane, while circuit pArt and patient MAP remain distinct and patient afterload remains clinically possible but incompletely modeled.
- **Prerequisite concept:** VA pressure zones, ΔP comparison, peripheral arterial return, and circuit-versus-patient pressure.
- **Best prediction:** inspect the arterial return path and sensor plausibility, assess patient afterload separately, correct the identified cause, and reassess limb/perfusion state.
- **Strongest distractor:** increase RPM because displayed flow and MAP may rise briefly, or treat pArt as systemic arterial pressure.
- **Harmful reflex:** drive harder against the fixed resistance or act on circuit pArt as if it were patient hypertension.
- **Live response:** modeled correction lowers downstream circuit load and improves flow direction. RPM escalation can raise displayed flow/MAP while pInt/pArt rise; postcommit copy now identifies the apparent gain and its pressure cost.
- **Source support:** `ecmo-book-ch9`, `ecmo-book-ch17`, `elso-circuit-2022`, `ifu-console-workflow`, `elso-adult-va-2021`, and `bounded-educational-model` support localization, device semantics, VA assessment, and the bounded response.
- **Model boundary:** the one fixed circuit resistance cannot distinguish every positional return problem or patient-afterload cause.
- **Flagged owner question:** should the engine penalize/limit the apparent RPM benefit, or is explicit postcommit contextualization sufficient?
- **Reviewer disagreement:** both VA clinical/live and adversarial reviews held the panel for the apparent benefit. The explanation now prevents calling it resolution, but the underlying model behavior remains.
- **Status:** **HOLD — draft/non-credit** pending model-owner approval.

### `va-afterload-oxygenator-resistance` — VA membrane-segment resistance

- **Intended mental model:** pInt separating from pArt with a widened ΔP at lower/comparable flow, supported by post-oxygenator gas data, localizes the membrane segment without turning one number into an exchange trigger.
- **Prerequisite concept:** VA return-obstruction comparison, matched-flow pressure interpretation, gas-transfer sampling, and regional/perfusion reassessment.
- **Best prediction:** inspect the bracketed segment and signal plausibility, integrate gas-transfer evidence, and escalate through the reviewed exchange pathway.
- **Strongest distractor:** increase RPM for flow/MAP, clear the return limb, or exchange from a single gradient.
- **Harmful reflex:** drive a restricted membrane or act on a fixed number without localization and context.
- **Live response:** correction improves pressure, flow, and PO direction. Higher RPM can transiently raise flow/MAP while worsening pInt/ΔP; the draft now states why that is not correction.
- **Source support:** the panel-local set is `ifu-anomaly-boundary`, `ecmo-book-ch9`, `elso-circuit-2022`, and `bounded-educational-model`, supporting bounded device limits, circuit localization/safety context, and only the authored response. Broader VA evidence registered on the upstream prediction is not presented as panel-local support.
- **Model boundary:** no clot burden, hemolysis, viscosity/temperature trend, universal cutoff, or exchange procedure is represented.
- **Flagged owner question:** which current independent source supports the release-level exchange decision/procedure, and is the apparent RPM benefit approved?
- **Reviewer disagreement:** the original precommit matched-flow/component-exchange wording was held as a semantic answer leak and moved postcommit. Both clinical/live and adversarial reviews still hold the engine/source issues.
- **Status:** **HOLD — draft/non-credit** pending evidence and model ownership.

### `va-lv-loading` — native-heart ejection and LV-loading cues

- **Intended mental model:** acceptable circuit flow and MAP do not establish native-heart ejection; pulse pressure, aortic-valve opening, pulmonary congestion, and independent assessment must be integrated.
- **Prerequisite concept:** native and device flow in parallel, territory-aware VA assessment, and circuit pArt versus patient pressure.
- **Best prediction:** characterize the complete pattern and escalate for expert LV-loading/unloading evaluation under local protocol without pretending the simulator selects a device or threshold.
- **Strongest distractor:** increase pump speed or accept flow/MAP as proof that the left heart is adequately ejecting.
- **Harmful reflex:** escalating RPM or treating reassuring console values as resolution.
- **Live response:** the current engine can improve valve/pulse-pressure state after an assessment/escalation abstraction; RPM may improve flow/MAP while adverse ejection cues persist. The harmful-reflex copy now explicitly names pump speed.
- **Source support:** `elso-adult-va-2021`, `ecmo-book-ch9`, `ecmo-book-ch17`, and `bounded-educational-model` support recognition, circuit interpretation, and only the bounded cues.
- **Model boundary:** echo detail, stasis, device selection, unloading procedure, and thresholds are absent; modeled work of breathing does not change and cannot validate the response.
- **Flagged owner question:** should recognition/escalation leave physiology unchanged, or be renamed as an abstract completed downstream intervention?
- **Reviewer disagreement:** the adversarial reviewer advanced the recognition panel with owner review; the VA clinical/live reviewer held because escalation behaves like treatment and the requested work-of-breathing reassessment is invariant. The boundary now exposes both issues.
- **Status:** **HOLD — draft/non-credit** pending action-semantics and model-owner decisions.

### `va-acute-hypercapnia` — VA acute carbon-dioxide control

- **Intended mental model:** external sweep remains the principal modeled CO₂ control, but correct gas-side action never replaces regional oxygenation, native-heart, lung, and perfusion assessment in VA support.
- **Prerequisite concept:** acute VV sweep physiology plus peripheral femoral VA parallel circulation.
- **Best prediction:** verify gas delivery, make the bounded authored sweep adjustment, hold unrelated circulatory/gas-FiO₂ controls, and reassess the complete VA state.
- **Strongest distractor:** use vasopressor support, pump speed, or sweep-gas oxygen fraction for respiratory acidemia; an LV-loading problem remains a competitor requiring its own evidence.
- **Harmful reflex:** treat a CO₂-control problem with circulatory or oxygen-fraction controls.
- **Live response:** sweep changes modeled PaCO₂/pH direction; RPM can change flow/MAP without correcting PaCO₂/pH. Work of breathing does not change in this VA model and is explicitly identified as a clinical obligation rather than a validating signal.
- **Source support:** `ecmo-book-ch16`, `ecmo-book-ch18`, `elso-adult-va-2021`, `elso-dual-circulation-2024`, and `bounded-educational-model` support acid-base interpretation, sweep control, VA regional assessment, and only the represented response.
- **Model boundary:** single-compartment CO₂, rapid kinetics, no territory-specific CO₂, invariant work of breathing, and no universal target.
- **Flagged owner question:** should work of breathing become responsive in the VA engine, or should response copy omit it while retaining bedside reassessment?
- **Reviewer disagreement:** the adversarial reviewer advanced the control distinction; the VA clinical/live reviewer held the mismatch between requested reassessment and invariant signal. The draft now tells the truth but leaves model policy open.
- **Status:** **HOLD — draft/non-credit** pending model-owner disposition.

### `va-gas-source-interruption` — VA external gas-delivery failure

- **Intended mental model:** persistent arterial circuit flow does not prove oxygenated return; a displayed gas setting is not proof that gas reaches the membrane.
- **Prerequisite concept:** setting versus delivery, external gas-path tracing, post-oxygenator sampling, and VA regional assessment.
- **Best prediction:** verify and restore the physical source/blender/tubing path, then reassess post-oxygenator, regional, blood-gas, and perfusion state.
- **Strongest distractor:** turn up a disconnected setpoint, increase RPM, or exchange the membrane before verifying delivery.
- **Harmful reflex:** treat persistent displayed L/min as adequate gas transfer or increase settings without delivered gas.
- **Live response:** increasing the setpoint while disconnected does not restore transfer; source restoration changes the represented source state and later time steps move gas/patient variables directionally. Precommit copy now asks neutrally about continuity rather than naming the complete workflow.
- **Source support:** the panel-local set is `ecmo-book-ch18`, `elso-circuit-2022`, `elso-adult-va-2021`, and `bounded-educational-model`, separating sweep-gas, circuit-safety, VA patient-assessment, and model claims. The upstream prediction additionally registers circuit-orientation, dual-circulation, and neuro-monitoring records; those are not attributed to the narrower panel-local claims.
- **Model boundary:** source hardware, analyser behavior, exact recovery timing, and a variable mixing region are absent; configured sweep/FiO₂ are not presented as measurements.
- **Flagged owner question:** how much of the external path may the precommit question name before coached signal reading becomes answer disclosure, and which evidence IDs must be reachable on the shared live surface?
- **Reviewer disagreement:** the adversarial reviewer conditionally advanced with wording review; the VA clinical reviewer held because the original question named the full workflow and corrected-state copy could contradict live values. The question was neutralized and a current-versus-historical corrected-state notice added.
- **Status:** **HOLD — draft/non-credit** pending human cue-use testing and shared evidence-surface ownership.

### `va-arterial-bubble-stop` — VA arterial-return air event

- **Intended mental model:** the protective pump stop interrupts VA support but does not physically isolate the patient, locate/correct the source, clear the circuit, or authorize resumption.
- **Prerequisite concept:** device intervention versus bedside circuit state, return-side detection versus entry source, and the urgency of interrupted VA support.
- **Best prediction:** follow the current IFU and approved local air-emergency protocol for near-patient isolation and source control, establish a clear circuit, and use the bounded reviewed resumption workflow.
- **Strongest distractor:** acknowledge/reset/restart because flow and MAP are falling, or assume the membrane is necessarily the entry source.
- **Harmful reflex:** reset before protocol-governed isolation and source correction.
- **Live response:** premature reset remains refused. Clamp/correction/resumption actions can also recompute patient values without elapsed time; the panel now explicitly says those same-timestamp changes are not physiological evidence caused by clamp manipulation.
- **Source support:** `ifu-console-workflow`, `ifu-anomaly-boundary`, `elso-circuit-2022`, `elso-adult-va-2021`, and `bounded-educational-model` support the device intervention, disputed-threshold boundary, emergency planning, VA assessment, and only the represented states.
- **Model boundary:** no bubble size/threshold, de-airing procedure, exact clamp/pump/reset choreography, conventional backup circulation, or competency assessment is represented.
- **Flagged owner question:** which current IFU/local protocol establishes exact physical order, and should the engine make isolation history a mastery invariant while removing same-time patient recomputation?
- **Reviewer disagreement:** all independent lenses held the original draft for semantic isolation leakage, weak source support for exact order, or temporal causality. The leak was removed and procedure wording now defers to authoritative current documents; source and engine issues remain.
- **Status:** **HOLD — draft/non-credit** pending device, clinical, assessment, and model-owner decisions.

### `va-transport-power-loss` — VA transport power continuity

- **Intended mental model:** reserve power may preserve current forward support while consequence of delay rises; a percentage does not authorize a time forecast or reduction of required circulatory support.
- **Prerequisite concept:** VA blood flow as circulatory support, power source versus pump state, and independent upper-body/perfusion assessment.
- **Best prediction:** restore verified external power promptly, confirm forward support and the patient state, and perform the approved backup-readiness workflow outside the represented state.
- **Strongest distractor:** reduce RPM to stretch reserve or continue because the pump is still turning and a percentage remains.
- **Harmful reflex:** trade away blood flow/MAP to conserve an assumed battery interval.
- **Live response:** lowering RPM reduces flow and modeled MAP while battery decline continues; source restoration changes power state. Precommit wording no longer states verified alternate-source/backup conclusions.
- **Source support:** `ifu-console-workflow` is limited to represented power controls/status; `ecmo-book-ch9`, `elso-circuit-2022`, `elso-adult-va-2021`, and `bounded-educational-model` support continuity planning, VA reassessment, and the authored battery response.
- **Model boundary:** remaining runtime, source reliability, backup availability/readiness, emergency-drive use, and hands-on transport competency are not represented.
- **Flagged owner question:** should unsafe RPM reduction block mastery, and should backup readiness become an observable state or remain outside simulated credit?
- **Reviewer disagreement:** the original draft was held for precommit workflow leakage and for attributing backup-readiness support too broadly to the IFU. The leak was removed and IFU claim narrowed; the unobservable state and scoring dependency remain.
- **Status:** **HOLD — draft/non-credit** pending assessment/model ownership and human reconciliation.

## Cross-panel release gate

No row may advance from draft on the strength of this synthetic packet. Promotion requires the frozen B5 human findings to be reconciled panel by panel; all relevant P0/P1 dependencies to be resolved; clinical, device, evidence, accessibility, and assessment owners to disposition the questions above; source-scoped copy to be re-reviewed; browser and assistive-technology evidence to be completed on the intended release build; and the full contract suite to remain green without changing Practice, Assess, persistent IDs, scoring, or publication status by accident.
