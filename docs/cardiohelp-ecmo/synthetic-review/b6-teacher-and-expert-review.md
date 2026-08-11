No human observation is being reported.

# B6 synthetic teacher and expert review

This document records independent synthetic audits of the ten foundation sections, twenty Learn lessons and prediction items, six frozen live panels, corresponding Practice cases, model boundaries, value guides, evidence registrations, and Learn-to-Practice transfer. The role labels below describe review lenses, not the credentials or behavior of a human reviewer. Findings do not establish human prevalence, usability, competency, or readiness.

## Method and independence

Three agent identities were reused sequentially because the environment allowed only three child identities. Each audit was read-only and was completed without access to another audit report. The integration lead retained the raw reports, preserved disagreement, and did not use votes as proof. Source locations are relative to `src/features/cardiohelp-ecmo/` unless otherwise stated.

| Synthetic review lens            | Scope completed                                                                              | Main emphasis                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| ECMO-physician lens              | 10 foundations, 20 lessons/predictions, 6 panels, Practice transfer, evidence and boundaries | Causal fidelity and clinical framing                           |
| Perfusion/circuit lens           | Same full inventory                                                                          | Circuit mechanics, device state, action-response consistency   |
| ECMO nurse-educator lens         | Same full inventory                                                                          | Sequence, handoff, transfer, and teachability                  |
| Instructional-design lens        | Same full inventory                                                                          | Authentic prediction, explanation, density, and transfer       |
| Assessment/distractor lens       | Same full inventory                                                                          | Cueing, distractor structure, scoring, and mastery contracts   |
| Accessibility/human-factors lens | Same full inventory                                                                          | Keyboard semantics, focus, resizing, tables, and live regions  |
| Evidence/provenance lens         | Same full inventory                                                                          | Source registrations, value-guide claims, and model boundaries |
| Adversarial clinical-safety lens | Same full inventory plus executable negative paths                                           | Unsafe action handling and causal contradictions               |

The evidence/provenance and adversarial cross-examination results are folded into the classified findings below. Detailed per-lesson coverage is in `b6-curriculum-coverage-matrix.md`; only findings that satisfy the second-review gate enter `b6-confirmed-defects-and-backlog.md`.

## Cross-cutting confirmed defects

### Safety and scoring

- **Confirmed defect — bubble isolation can be bypassed while still earning mastery.** In both `arterial-bubble-stop` and `va-arterial-bubble-stop`, an engine-level path can correct the fault, reset, reassess, and resume with both near-patient clamps never having been closed. The reproduced end state had the pump running, both clamps open, no critical error, all five credit fields, score 100, and mastery. The guided sequence asks for return-then-drainage isolation, but `engine/reducer.ts` does not make that history a prerequisite for correction or resumption. Existing bubble tests cover the correct path and unsafe reopening, not never isolating.
- **Confirmed defect — the explicitly unsafe transport speed reduction is not guarded.** During either transport-power lesson, reducing RPM on battery lowers modeled flow but creates no critical error and does not prevent score 100 after AC restoration. Prediction copy classifies this response as unsafe, while the scenario/runtime has no transport-specific RPM guard or adequate-flow recovery condition.
- **Confirmed defect — later actions can overwrite an initially wrong Assess plan.** In the VV off-sweep capstone, a wholly wrong committed goal/control/direction followed by the correct action and reassessment produced score 85 and mastery. `engine/reducer.ts` updates control and direction credit during later action handling rather than preserving the committed prediction result. This is outside the B6 edit surface and is documented for owner disposition.
- **Confirmed defect — some recognition/escalation actions are modeled as treatment.** The VA differential-oxygenation lesson says verification/escalation is not a maneuver that resolves the state, yet performing it starts improving right-radial saturation. The VA LV-loading lesson makes an assessment/escalation action raise pulse pressure and open the aortic valve. The visible physiology therefore rewards an information-gathering action as though the omitted treatment occurred.
- **Confirmed defect — backup readiness is credited without a represented backup state.** `RESTORE_AC_POWER` also satisfies copy that asks the learner to confirm backup-console and emergency-drive readiness, but no engine state records either confirmation. The task can therefore credit an observation the simulation cannot show.

### Prediction integrity and transfer

- **Confirmed defect — precommit surfaces expose mechanisms or answers.** Lesson titles and objectives render before commitment. The frozen preload panel explicitly says drainage cannot meet pump demand, and the frozen gas panel labels the source `Interrupted`. Across all twenty Learn items, persistent title/objective context materially narrows the answer; all ten foundation prediction items expose their teaching panel and narrative before choice.
- **Confirmed defect — answer position is fixed.** The authored best choice is first in all 20 Learn predictions, all 20 foundation prediction/transfer sets, and all 42 Practice reassessment questions. The best label is also uniquely longest in 15 of 20 Learn items, 17 of 20 foundation items, and 34 of 42 Practice reassessments. This creates a test-taking shortcut independent of the intended causal reasoning.
- **Confirmed defect — recommended Practice transfer can select a thematic rather than causal match.** `LearnLessonPlayer.tsx` selects the first case in a unit. Examples include VA bubble/transport recommendations that lead to limb ischemia and VA oxygenator resistance that leads to vasoplegia. The visible call to action can therefore promise transfer of a mechanism the selected case does not exercise.
- **Confirmed defect — the curriculum hub overstates and bypasses the authored runway.** “Start curriculum” enters the drill sequence rather than the foundation-first route presented on the Learn landing page, while hub copy describes a different count/shape from the 17-section pathway. The capstone itself is intentionally open; only the surrounding `prerequisite`/`unlock` nomenclature remains an owner decision because it can imply access gating that the interface does not enforce.
- **Confirmed defect — raw internal critical-error IDs can reach the Practice debrief.** Internal identifiers are not an explanatory safety rationale and violate the learner-copy requirement to avoid raw enum-like output.

### State and copy consistency

- **Confirmed defect — VA preload prediction copy describes the wrong high-RPM trend.** The item says displayed flow “creeps upward” with more RPM. The reproduced active-fault sweep instead fell after modeled drainage capacity: about 2.83 L/min at 3600 RPM, 2.65 at 4000, and 2.30 at 4800. The intended lesson—that additional demand worsens drainage limitation—remains defensible; the stated visible response does not match the engine.
- **Confirmed defect — Practice bubble-resumption prose still describes an ordered unclamping choreography.** The engine deliberately replaced this with one bounded atomic resumption action so the module would not teach a disputed clamp/pump/reset order. Practice copy that still narrates the old order contradicts that boundary.
- **Confirmed defect — a VA limb Practice action visibly normalizes limb state despite boundary copy saying the simulation cannot reproduce the intervention.** The learner can infer that an omitted procedure has occurred and succeeded when the copy says it is not modeled.
- **Confirmed defect — the startup phrase “stopped and unpressurised” conflicts with the model boundary.** The engine retains static raw pressure values while correctly withholding stopped-pump pressure readouts as `simulation-unmodeled`. “Unpressurised” is stronger than the model can establish; “pump stopped; modeled pressure channels unavailable” would be truthful without implying physical zero pressure.

## Model limitations and source gaps

- **Model limitation — immediate gas-interruption observation can move opposite the narrated reference.** In the frozen VV path, SpO₂ opened around 93.7%, drifted to about 96.5% before fault injection, and was about 95.8% at the guided observation. It eventually declined in the intended direction, but the action-point observation did not show the claimed opening-to-fault deterioration. The analogous VA state also depends on pre-event settling.
- **Model limitation — a compensated-hypercapnia “hold” state continues drifting.** PaCO₂ fell from 58 to about 56.6 on the next engine step without a new control change. The direction is not a bedside claim, but the drift weakens the intended distinction between tolerating a compensated state and actively normalizing it.
- **Model limitation — off-sweep oxygen transfer is simplified.** Patient oxygenation can deteriorate while the authored post-oxygenator saturation remains 99%, making the circuit signal look more capable than the no-sweep gas state warrants. The current model does not represent enough native-lung/circuit mixing detail to turn that value into a clinical decision.
- **Model limitation — the VA circuit uses one arterial carbon-dioxide state.** It cannot show different upper- and lower-body carbon-dioxide territories. Existing copy discloses the simplification; new panels must not imply territory-specific values the engine lacks.
- **Source gap — no executable invariant maps every `plausibility: 'unsafe'` option to a penalty or mastery block.** Some important cases are guarded, including preload and recirculation RPM escalation, but startup, downstream-resistance, oxygenator, and transport negative paths are uneven.
- **Source gap — alert thresholds are authored simulation/device settings, not universal clinical targets.** Existing value guides generally make this distinction. Learner-facing alerts that present the settings without the boundary can nevertheless be mistaken for bedside thresholds.
- **Source gap — “every console reports” circuit flow is broader than the registered device evidence supports.** Circuit blood flow is a general concept; exact sensing, display availability, and terminology remain device-specific. The value-guide statement needs owner review before it is treated as universal device fact.
- **Source gap — the supplied manufacturer material is internally inconsistent about a bubble threshold/alarm detail.** The module appropriately avoids teaching a disputed numeric threshold; any future procedure-level copy requires a resolved IFU/source decision.
- **Source gap — VA “recirculation analogue” language lacks a registered source and risks importing a VV concept into parallel circulation.** It should remain a model analogy, not a bedside equivalence.

## Evidence-surface and claim-to-source audit

- **Confirmed defect — Learn prediction evidence is not rendered with the verdict.** The 20 prediction items carry claim-specific `evidenceIds`, but `LearnLessonPlayer.tsx` renders `AnswerVerdict`, whose contract deliberately has no citations. The workbench drawer resolves the scenario’s usually narrower evidence list instead. Foundations use a citation-capable feedback component, so this is not a platform limitation.
- **Confirmed defect — the in-activity evidence drawer omits `supports`.** It displays source title, citation, and limitation, but not the registry statements describing which claim the source supports. The global Sources panel does render those statements. A learner can therefore see authority without the claim-to-authority link.
- **Confirmed defect — six live scenarios omit `bounded-educational-model` even though their prediction arrays include it.** The affected IDs are `startup-sensor-orientation`, `arterial-bubble-stop`, `transport-power-loss`, `va-gas-source-interruption`, `va-arterial-bubble-stop`, and `va-transport-power-loss`. Live simulated values and fault responses therefore appear without their model provenance in the activity drawer.
- **Confirmed defect — the VA differential live scenario omits its direct dual-circulation source.** The prediction includes `elso-dual-circulation-2024`; the live scenario/pilot drawer does not, even though the panel teaches counter-propagating streams and a configuration-dependent mixing region.
- **Source gap — several foundation surfaces carry different source sets for the same teaching.** Blood-flow-versus-sweep omits the registered sweep/CO₂ textbook chapter and cites adult-VV despite appearing in both tracks. VV series/integration and VA parallel/integration prediction or transfer feedback omit direct sources that the section/runtime already has.
- **Source gap — the oxygen-content illustration lacks claim-fit provenance.** The first foundation calculates with `1.34 × Hb × saturation`, but no cited registry `supports` statement covers the coefficient, dissolved-oxygen omission, or delivery equation. It needs a registered physiology source or a more explicit authored-illustration boundary before release.
- **Source gap — all Practice cases rely in part on `attached-ecmo-case-curriculum`.** Its metadata correctly says it is unpublished, non-independent, and requires adult-ECMO/device review. It can support draft case authorship but cannot independently validate definitive procedures.
- **Source gap — current tests establish that IDs resolve, not that claims fit the registered `supports` and `limitations`.** No automated contract compares an intervention or statement with a source’s declared support scope.
- **Owner decision — value-guide coverage is intentionally incomplete.** Important learner-facing variables without a dedicated guide include RPM, external sweep, sweep-gas oxygen fraction, gas-source state, power/battery state, bubble/reset state, post-oxygenator saturation, right-radial/femoral saturation, native output, pulse pressure, MAP, and limb NIRS. B6 adds only the guides needed by interpreted numbers in the fourteen draft panels.
- **Defensible design choice — source boundaries are unusually explicit.** The IFU scope record limits manufacturer claims, the anomaly record preserves disputed bubble/pressure details, and automated tests prevent encoding those disputed numbers. Model-authored quantities are generally labeled and prohibited from bedside inference.

## Defensible design choices

- The foundations correctly separate four information domains: console/device, physical circuit, gas path, and independent patient monitoring.
- pVen, pInt, pArt, and ΔP are located and qualified; pArt is repeatedly distinguished from patient arterial pressure.
- The current value guides reject universal pArt, ΔP, recirculation, and display-deadband thresholds and label the recirculation coefficient as an authored model value.
- The recirculation pilot distinguishes console drainage saturation from a modeled systemic venous estimate and states that the console cannot measure the latter.
- The bubble pilot uses a bounded resumption transition and explicitly refuses to teach disputed clamp/pump/reset choreography. The reducer bypass is a separate implementation defect.
- The ten foundations form a clinically defensible progression from purpose and circuit path through pressure, gas transfer, VV series physiology, and VA parallel physiology.
- Running every authored best-response sequence produced no critical errors and credited the intended goal, control, direction, and cause. This is technical consistency evidence, not human validation.

## Accessibility and human-factors findings

- **Confirmed defect — the foundation compact tab interface implements roving `tabIndex` but no Arrow/Home/End behavior.** A keyboard-only learner can tab to the selected tab but cannot use the standard tab-list keys to change selection. The simulator bedside/pressure-view tabs do implement Arrow, Home, and End behavior; the broader allegation was refuted.
- **Confirmed defect — foundation exclusive choices use toggle-button (`aria-pressed`) semantics rather than a named single-select radio group.** The visible exclusivity is not conveyed with the expected input model.
- **Synthetic learner hypothesis — transformed console surfaces may shrink interactive targets and text.** `FitWidthSurface` can scale the whole console and tests permit a 0.5 scale, but actual painted target size depends on the rendered layout. Real-browser bounds and zoom evidence are required before classifying this as a defect.
- **Confirmed defect — several foundation tables are horizontally scrollable without a focusable, named scroll container.** The drill `SignalRegister` already provides the stronger pattern and should remain the reference.
- **Synthetic learner hypothesis — multiple nearby live regions may create an announcement-order conflict.** Individual alarms and verdicts can be defensible, but automated source review cannot establish which messages an assistive technology announces, interrupts, or repeats.
- **Source gap — automated review does not establish computed contrast, browser/AT announcement order, or human keyboard comprehension.** Those require dedicated browser and assistive-technology evidence.

## In-app Browser and render-harness review

- The live Learn route was exercised in the in-app Browser at its available physical viewport, 1280 × 720. The document had no horizontal page overflow. At this width, the selected teaching region was a named vertical scroller about 694 px wide and 232 px high; a representative precommit draft was about 2,509 px tall, and its postcommit copy contained about 1,223 words. That is objective density/scroll evidence, not a claim about human burden.
- The same live route preserved a real precommit gate: no mechanism, harmful-reflex, source-support, or model-boundary block rendered before commitment. After a best commitment, those blocks became reachable. After correction, the live question switched from the active-fault question to a current-state question and the notice separated current signals, the earlier mechanism, and the still-possibly-incomplete workflow.
- The VA bubble route initially rendered before its timed cause was active. Browser review caught the active-event question contradicting baseline signals; the shared draft renderer now uses a neutral baseline question until the cause is active, then switches to the authored active question. A contract exercises the true initial state of all fourteen drafts.
- The generated all-panel harness was opened through the in-app Browser in exact 1600 × 900, 1440 × 900, 1280 × 720, and 1024 × 768 frames. Each frame reported the requested inner dimensions and no document-width overflow. Across 291 rendered cells, including 246 drill renders (82 states at three widths), no cell or drill root clipped horizontally. Drill-root text contained no `undefined`, `NaN`, `Infinity`, or `[object Object]`; the literal `[object Object]` appears only in the harness’s reviewer instruction.
- The harness rendered 219 explicitly unavailable signal rows and 258 named, focusable signal/table groups. None required horizontal scrolling in these captures. The compact 1024 frame wrapped to a single column without clipping; the 1600 and 1440 frames used the available width without document overflow.
- ArrowRight moved the selected/focused live workspace tab from Teaching to Current task, confirming the implemented roving-tab behavior for that group. A synthetic Tab dispatch remained on the selected tab, so sequential focus order was not treated as browser-validated keyboard usability. The separately confirmed foundation compact-tab defect and assistive-technology questions remain open.
- The in-app Browser backend exposed a fixed 1280 × 720 physical live route and did not provide viewport resizing. The three other exact sizes therefore validate the real browser-rendered static harness, not live-route breakpoint behavior. Automated layout tests cover the four live-workspace width modes, but neither source nor synthetic browser evidence substitutes for human or assistive-technology usability testing.

## Instructional hypotheses requiring human testing

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — The foundation and pilot text load may exceed a novice’s working memory. Source-derived panel counts ranged from roughly 763–2,108 accessible words before commitment and 1,790–2,541 after commitment; prediction stems, labels, synthesis, and rationales add substantial prose. The counts are objective copy inventory, while the cognitive-load interpretation remains a hypothesis.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — The VV and VA integration sections may require simultaneous device, circuit, gas, and patient reasoning before those distinctions are durable.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Repeated device-specific abbreviations, long prediction labels, and ambiguous referents may burden a clinically trained reader whose first language is not English. The intended concepts should not be simplified; sentence structure and referents should be tested.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — A learner may mistake visible model-boundary copy for evidence that omitted bedside data are unimportant rather than unavailable in this simulator.

## Preserved disagreements

- The instructional-design audit judged the frozen gas-interruption panel’s precommit structure defensible because it asks the learner to connect a visible gas-path state to preserved blood flow. The safety and answer-leak audits classified the word `Interrupted` as a mechanism leak. Both interpretations are preserved; the pilot copy remains frozen for human testing.
- One clinical audit treated blood-flow-versus-sweep wording as a defensible simplification with an explicit model boundary. Another found the categorical formulation too broad for real extracorporeal physiology. The owner must decide whether to narrow the statement after human testing; B6 does not change it.
- The startup panel’s four-domain orientation can be read as essential cueing or as answer narrowing. The owner decision is whether this is scaffolded Learn instruction or an authentic unaided prediction; it cannot be resolved by synthetic review alone.
- High-copy panels may be appropriately thorough reference material or too dense for first-pass Learn use. Word count is not evidence of human burden.

## Human-testing questions generated

1. Before commitment, which titles, objectives, source-state labels, or prior transfer steps reveal the mechanism to a human learner?
2. Does a human learner treat first-position or longest answers as a shortcut when causal reasoning is uncertain?
3. At the gas and bubble pilot action points, which reference state does the learner compare with the visible patient response?
4. Can a keyboard-only learner discover and operate the foundation compact tabs without pointer rescue, and do the already-keyboard-enabled simulator tabs communicate their behavior clearly?
5. Which model-boundary statements are interpreted as “not relevant clinically” rather than “not represented here”?
6. Does the Learn-to-Practice call to action create an expectation of mechanism-matched transfer, and is the actual case surprising?
7. Can a novice keep console, circuit, gas-path, and patient-monitor provenance separate after the orientation lesson?
8. Does the full postcommit explanation support causal revision, or does copy density cause important safety distinctions to be skipped?
