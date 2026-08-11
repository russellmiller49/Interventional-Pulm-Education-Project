No human observation is being reported.

# B6 synthetic learner hypotheses

Every learner statement in this document is a synthetic hypothesis for later human testing. Synthetic agents are not participants, users, fellows, nurses, or students, and their behavior is not evidence of human prevalence, comprehension, confidence, timing, or safety performance.

## Method and limitations

Three independent agent identities completed an initial browser-first pass before their own source inspection:

| Agent identity | Assigned lens                            | Black-box outcome                                                                                                                                                                        |
| -------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lagrange       | Complete ECMO novice, pass A1            | Completed all six lessons; the full 14-field report is retained below.                                                                                                                   |
| Zeno           | Complete ECMO novice, pass A2            | Completed all six lessons independently. Context compaction later removed the field-level report; only the coordinator summary is retained below. Nothing was reconstructed from source. |
| Wegener        | ICU observational-exposure lens, pass B1 | Completed all six lessons independently. Context compaction later retained only the coordinator summary. Nothing was reconstructed from source.                                          |

The environment allowed only three child-agent identities. After each browser session was finalized, its child-agent runtime could not reacquire the in-app Browser. The attempted B2, C2, and keyboard-only follow-on passes returned no browser and correctly produced no lesson findings. Additional C, D, E, and F profile reports were not backfilled from source. The coordinator later retained one browser binding for technical QA, but that is not represented as an independent learner pass.

Agent reports were not shared before completion. Agreement is not counted, and disagreement is not resolved by vote.

## Complete-novice pass A1 — retained full report

### `startup-sensor-orientation`

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — First interpretation: zero flow and blank pressures suggested disconnected or unready sensors. First look: the large console values. Ignored: the separate gas panel, patient monitor, and unverified physical circuit. Anticipated action: run the device diagnostic, then start support.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Selected prediction: device diagnostic readiness alone was sufficient. Rationale: the console appeared to be the authoritative whole-system check. Wrong turn: treating the device self-test as verification of circuit, gas supply, backup, and patient.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Live-response change: slight; verification could complete while the pump remained stopped and pressures stayed unavailable. Verdict change: substantial; it separated device, circuit, gas path, and patient information.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Inferred teaching: console readiness is only one part of pre-use verification. Unclear terms: pVen, pInt, pArt, ΔP, SvO₂, IFU, and sweep-gas FiO₂. Boundary misunderstanding: dashes initially read as sensor failure rather than the simulation declining to model stopped-pump pressures. Problem type: interface density plus prerequisite vocabulary. Confidence: low before, moderate after.

### `preload-drainage-collapse`

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — First interpretation: falling flow meant the pump needed more speed. First look: displayed flow, then RPM. Ignored: increasingly negative pVen, drainage chatter, and downstream pressures falling with flow. Anticipated action: increase RPM.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Selected prediction: raise pump speed before finding the cause. Rationale: displayed flow was treated as the treatment target. Wrong turn: assuming pump demand could overcome limited drainage.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Live-response change: strong; reducing demand and correcting the cause produced steadier flow and less-negative pVen. Verdict change: strong; the chosen action was explicitly framed as potentially harmful.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Inferred teaching: localize a drainage-side limitation and quiet collapse before investigating cannula, compression, strain, or volume causes. Unclear terms: preload, drainage chatter, pVen, membrane gradient, and post-pump pressure. Boundary misunderstanding: the modeled chatter threshold initially looked like a bedside cutoff. Problem type: chiefly prerequisite knowledge, with unusually explicit interface cues. Confidence: low before, moderate-high after.

### `vv-recirculation`

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — First interpretation: hypoxemia despite high flow meant inadequate gas exchange. First look: patient SpO₂ and displayed flow. Ignored: high drainage-limb saturation, fully oxygenated post-membrane blood, and unchanged pressures. Anticipated action: increase sweep.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Selected prediction: raise sweep. Rationale: sweep was treated as a general oxygen-support control. Wrong turn: failing to distinguish displayed flow from first-pass useful flow.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Live-response change: strong; correction improved patient oxygenation and lowered drainage saturation while displayed flow remained similar. Verdict change: strong; extra sweep was reframed as a CO₂-side change that would not correct the flow problem.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Inferred teaching: diagnose re-drainage from patient oxygenation, drainage-limb saturation, and displayed flow together. Unclear terms: recirculation, effective flow, pre-oxygenator saturation, systemic mixed-venous saturation, and first-pass flow. Boundary misunderstanding: displayed litres initially appeared to represent unique blood delivered to the patient; the authored share looked measured. Problem type: primarily prerequisite physiology. Confidence: low before, moderate after.

### `gas-source-interruption`

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — First interpretation: rising CO₂ meant the sweep setting was too low. First look: sweep and blood-flow displays. Ignored: the explicit interrupted-source status and unchanged blood-path pressures. Anticipated action: increase sweep.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Selected prediction: turn up sweep. Rationale: the requested setting was treated as proof that gas reached the membrane. Wrong turn: confusing setpoint with delivered gas flow.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Live-response change: strong; restoring the source improved gas exchange while blood flow remained unchanged. Verdict change: strong; a setpoint cannot help when supply continuity is absent.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Inferred teaching: separate blood path from gas path and verify source-to-membrane delivery before changing settings. Unclear terms: sweep, sweep-gas FiO₂, blender, source continuity, and membrane gradient. Boundary misunderstanding: the model’s rapid linear gas response initially looked representative of bedside physiology. Problem type: attention plus prerequisite vocabulary; the relevant status was explicit. Confidence: low before, high after.

### `arterial-bubble-stop`

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — First interpretation: automatic pump stop had isolated the patient. First look: the high-priority alarm and zero flow. Ignored: both near-patient clamps remained open. Anticipated action: clear the air, then resume without separate isolation.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Selected prediction: pump stop already separated patient and circuit. Rationale: air was assumed unable to move while the pump was stopped. Wrong turn: overlooking that the modeled centrifugal pump is non-occlusive.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Live-response change: strong; the authored sequence separated return-limb isolation, drainage-limb isolation, source correction, circuit clearing, and protocol-bounded resumption. Verdict change: strong; the safety distinction became explicit.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Inferred teaching: distinguish pump stop, patient isolation, source correction, and resumption. Unclear terms: arterial bubble channel, intervention latch, non-occlusive pump, reset, and de-airing. Boundary misunderstanding: the simulation initially appeared to teach a bubble threshold and full restart choreography, which it deliberately does not. Problem type: prerequisite device knowledge plus terminology risk because “arterial” appears in a VV circuit returning to a vein. Confidence: low before, moderate-high after.

### `va-differential-hypoxemia`

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — First interpretation: conflicting right-arm and femoral saturations meant one sensor was wrong. First look: the independent-monitor mismatch. Ignored: native pulsatility, aortic-valve opening, native output, and sampling territory. Anticipated action: recheck sensors and wait for agreement.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Selected prediction: verify sensors and hold settings until the values agreed. Rationale: one patient was assumed to have one arterial saturation. Wrong turn: failing to recognize two regional circulations.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Live-response change: modest because the mismatch persisted during the observed interval. Verdict change: major; femoral and post-membrane agreement was shown not to establish cerebral or coronary oxygenation.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Inferred teaching: sampling site is part of the measurement; upper-body oxygenation must be read against native heart, lung, and circuit data. Unclear terms: differential hypoxemia, parallel circulation, native ejection, mixing zone, right-radial sampling, and circuit pArt. Boundary misunderstanding: the escalation was initially expected to provide a definitive bedside correction, although ventilator, cannulation, and cerebral-monitoring decisions remain outside the simulation. Problem type: prerequisite physiology plus a possible saved-track notice mismatch. Confidence: low before, moderate after.

## Complete-novice pass A2 — retained coordinator summary only

The original report completed all six lessons and contained the requested fields. That field-level text did not survive context compaction. The following are only the observations explicitly retained in the coordinator record; omitted fields are unavailable rather than reconstructed.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Across several lessons, persistent titles, objectives, and instructions may reveal the mechanism before commitment, especially drainage limitation, recirculation, the bubble sequence, and differential hypoxemia.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — In the gas-source lesson, the visible source status and source-restoration control may reveal the best action. The transfer step appeared to ask for a return-clamp action while the direct circuit controls were disabled; this requires technical reproduction before defect classification.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — In both the gas-source and bubble lessons, the visible patient saturation immediately after advancing to the event appeared higher than the opening value, despite prose describing loss of support. This was retained as a causal-direction concern, not accepted as a defect without engine reproduction.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Long sentences, device abbreviations, and dense explanatory blocks may compete with the prediction task.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — The VA differential lesson made recognition clearer than correction; the fitting response and model boundary appeared generic.

For each lesson, the individual first interpretation, first look, ignored information, anticipated action, selected prediction, rationale, wrong turn, live-response change, verdict change, inferred teaching, unclear terms, boundary misunderstanding, problem type, and confidence are marked unavailable in the retained record.

## Observational-exposure pass B1 — retained coordinator summary only

The original report completed all six lessons independently. Its detailed field-level text did not survive context compaction. The retained observations are:

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — `startup-sensor-orientation`: dense provenance and patient context were initially ignored; the four-domain separation was learned, while pressure-channel terminology remained unclear.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — `preload-drainage-collapse`: the pattern was recognizable; the verdict clarified that pump-demand reduction is a holding measure rather than correction of the cause.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — `vv-recirculation`: the distinction between displayed and useful flow changed the inferred mental model.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — `gas-source-interruption`: the gas path was identified, but the patient saturation appeared to rise across the event action before later decline.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — `arterial-bubble-stop`: clamp isolation and source correction became clear, while the immediate saturation direction did not visually reinforce loss of support.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — `va-differential-hypoxemia`: recognition was clear, but the generic correction and limited visible resolution weakened the action-to-response link.

The remaining requested fields are unavailable in the retained record and are not inferred from the later source audit.

## Blocked passes

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — B2, C2, and E produced no lesson findings because their finalized child-agent browser sessions could not reconnect. No source inspection, alternate browser surface, or pointer rescue was substituted.

SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Complete profile coverage for early PCCM, transfer-learner, keyboard-only, and English-as-an-additional-language lenses remains a human-preflight gap. Later source-only teacher audits may generate questions for these lenses, but they are not browser walkthroughs.

## Preserved disagreements and questions for human testing

1. SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Are lesson titles and objectives useful guided orientation, or do they make the subsequent prediction non-diagnostic? Test recall and reasoning with the current header visible; do not infer from choice accuracy alone.
2. SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Is explicit gas-source status necessary signal provenance, or does it collapse the prediction into control matching? Ask for the causal explanation, not only the selected action.
3. SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Does the distinction between pump-demand reduction and cause correction survive into a new drainage-limited case?
4. SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Do learners explain why higher displayed flow can coexist with lower useful VV support, or only repeat the verdict phrase?
5. SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — After the bubble lesson, can learners separately name pump state, patient isolation, air-source correction, and locally governed resumption without inventing a universal sequence?
6. SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — How long do learners need to observe a corrected VA differential state before recognizing directional improvement, and does the interface make that observation discoverable?
7. SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Which device abbreviations and long sentences impede reasoning for a clinically trained English-as-an-additional-language reader without requiring the clinical concept to be simplified?
8. SYNTHETIC HYPOTHESIS — REQUIRES HUMAN TESTING — Can a keyboard-only learner leave the programmatically focused current-step status, reach each response and simulator control, operate horizontal signal tables, and complete all six tasks without pointer rescue?
