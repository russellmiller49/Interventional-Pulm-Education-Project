# ECMO-01 question decision ledger

All rows are **keep as optional reinforcement**. Interaction framing is rewritten: the learner may answer, reveal the existing explanation without answering, retry, or continue. No score or response history is persisted. Clinical stems, choice IDs, explanations, alternative rationales and source IDs are unchanged. The teaching purposes below describe the existing content; they are not new clinical guidance or review decisions.

No new question was added for gas-to-air entry. The existing transfer is retained as a real optional action with explicit Start and a separately labelled explanation. No question was kept to establish completion, satisfy a quota or protect an answer.

## Learn items (20)

Source: `src/features/cardiohelp-ecmo/content/learnPredictionItems.ts`. Each item contrasts the fitting action with plausible alternatives and explains why the alternatives do not address the described pattern. Feedback describes the choice, not inferred learner competence.

| Stable question ID                                               | Teaching purpose                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ecmo.learn.startup-sensor-orientation.prediction`               | Separate console readings, bedside findings, gas settings and pre-use verification. |
| `ecmo.learn.preload-drainage-collapse.prediction`                | Distinguish drainage limitation and its response to pump demand.                    |
| `ecmo.learn.afterload-return-obstruction.prediction`             | Locate resistance after the membrane from the pressure pattern.                     |
| `ecmo.learn.afterload-oxygenator-resistance.prediction`          | Locate resistance across the membrane rather than infer it from low flow alone.     |
| `ecmo.learn.vv-recirculation.prediction`                         | Compare displayed circuit flow with effective support.                              |
| `ecmo.learn.acute-hypercapnia.prediction`                        | Relate sweep-gas change to acute carbon-dioxide clearance.                          |
| `ecmo.learn.compensated-hypercapnia.prediction`                  | Interpret carbon dioxide together with acid–base context.                           |
| `ecmo.learn.gas-source-interruption.prediction`                  | Distinguish failed gas delivery from a blood-path problem.                          |
| `ecmo.learn.arterial-bubble-stop.prediction`                     | Distinguish pump stop, isolation and actual resumption prerequisites.               |
| `ecmo.learn.transport-power-loss.prediction`                     | Interpret the power source and remaining reserve.                                   |
| `ecmo.learn.va-startup-sensor-orientation.prediction`            | Apply source-of-information distinctions to the VA circuit.                         |
| `ecmo.learn.va-preload-drainage-collapse.prediction`             | Interpret drainage limitation while separating arterial support consequences.       |
| `ecmo.learn.va-afterload-arterial-return-obstruction.prediction` | Separate return-path circuit resistance from patient arterial pressure.             |
| `ecmo.learn.va-afterload-oxygenator-resistance.prediction`       | Localize a membrane pressure gradient in VA support.                                |
| `ecmo.learn.va-differential-hypoxemia.prediction`                | Compare upper-body, lower-body and post-membrane oxygenation sources.               |
| `ecmo.learn.va-lv-loading.prediction`                            | Read the modeled LV-loading pattern and its interpretation limits.                  |
| `ecmo.learn.va-acute-hypercapnia.prediction`                     | Distinguish the gas-clearance control from VA blood-flow controls.                  |
| `ecmo.learn.va-gas-source-interruption.prediction`               | Interpret quiet blood-path readings during a gas-source failure.                    |
| `ecmo.learn.va-arterial-bubble-stop.prediction`                  | Distinguish automatic stop from actual arterial isolation.                          |
| `ecmo.learn.va-transport-power-loss.prediction`                  | Distinguish mains loss from loss of arterial support.                               |

## Foundation items (20)

Source: `content/foundationLearningItems.ts`. Prediction and transfer pairs remain separate because they ask about different constructed states; the transfer does not gate the next section. Map-owned radio answers retain their stable anatomical/sensor targets and source/coordinate tests. Explanations name the relevant finding, mechanism and alternative reasoning before or after an optional response.

| Stable question ID                          | Teaching purpose                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ecmo.foundation.why.prediction`            | Separate oxygen content, blood flow and consumption; transfer to a different oxygen-balance problem. |
| `ecmo.foundation.why.transfer`              | Separate oxygen content, blood flow and consumption; transfer to a different oxygen-balance problem. |
| `ecmo.foundation.path.prediction`           | Locate named pressure measurement sites and the path they describe.                                  |
| `ecmo.foundation.path.transfer`             | Locate named pressure measurement sites and the path they describe.                                  |
| `ecmo.foundation.pump.prediction`           | Predict the response to a speed change and localize a changed pressure pattern.                      |
| `ecmo.foundation.pump.transfer`             | Predict the response to a speed change and localize a changed pressure pattern.                      |
| `ecmo.foundation.sweep.prediction`          | Compare sweep and blood-flow effects, then interpret an unchanged blood path.                        |
| `ecmo.foundation.sweep.transfer`            | Compare sweep and blood-flow effects, then interpret an unchanged blood path.                        |
| `ecmo.foundation.series.prediction`         | Distinguish recirculation from useful support in VV series physiology.                               |
| `ecmo.foundation.series.transfer`           | Distinguish recirculation from useful support in VV series physiology.                               |
| `ecmo.foundation.normal.prediction`         | Establish a coherent VV reference across device, circuit and patient.                                |
| `ecmo.foundation.normal.transfer`           | Establish a coherent VV reference across device, circuit and patient.                                |
| `ecmo.foundation.integration.prediction`    | Distinguish gas-path and recirculation mechanisms in different VV states.                            |
| `ecmo.foundation.integration.transfer`      | Distinguish gas-path and recirculation mechanisms in different VV states.                            |
| `ecmo.foundation.parallel.prediction`       | Compare native and extracorporeal contributions in VA parallel circulation.                          |
| `ecmo.foundation.parallel.transfer`         | Compare native and extracorporeal contributions in VA parallel circulation.                          |
| `ecmo.foundation.va-normal.prediction`      | Separate console/circuit readings from patient and regional VA findings.                             |
| `ecmo.foundation.va-normal.transfer`        | Separate console/circuit readings from patient and regional VA findings.                             |
| `ecmo.foundation.va-integration.prediction` | Integrate regional oxygenation with a changed VA gas-path state.                                     |
| `ecmo.foundation.va-integration.transfer`   | Integrate regional oxygenation with a changed VA gas-path state.                                     |

## Modeled comparisons and attribution

| Existing item                                                 | Decision and purpose                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ecmo.foundation.blood-flow-versus-sweep.story.doubled-sweep` | Keep optional prediction and combine with its real modeled comparison. Contrast the gas and blood-flow axes. Explanation alone produces no run/result.                                                                                                                                                                                                                            |
| `ecmo.foundation.blood-flow-versus-sweep.story.raised-speed`  | Keep optional prediction and its separate reference-based comparison. Contrast pump-speed and carbon-dioxide responses without carrying the earlier sweep change into this state.                                                                                                                                                                                                 |
| Oxygen-delivery attribution (`why-extracorporeal-support`)    | Keep the four-candidate set as reinforcement. `transfuse-red-cells`, `raise-sweep-oxygen-fraction`, `start-an-inotrope`, and `treat-fever-and-deepen-sedation` distinguish oxygen content, flow and consumption. Each existing candidate rationale is directly revealable without filling the set. These are authored examples, not interventions applied to a simulated patient. |

Sources: `content/storyProblems.ts`, `content/deliveryAttribution.ts`. Existing model-direction tests for both story comparisons remain. Rhetorical questions in the six live teaching panels stay as explanatory prompts with mechanism/source teaching available, not additional required responses.

## Practice and former assessment prompts

For **each case below**, keep the optional three-part plan (`goalId`, `control`, `direction`) and the device/circuit-or-gas/patient reassessment as reinforcement. The plan directs attention to the case mechanism; reassessment compares the expected effect with actual observed domains. The authored causal chain, workflow, safety notes and source discussion explain the comparison. Direct explanation is available with no plan or management. Actual readiness, connection, support and observation prerequisites still apply when claiming that an action or response happened; they do not prevent leaving the case.

| Stable case ID                        | Existing concept / case title                                        |
| ------------------------------------- | -------------------------------------------------------------------- |
| `clinical-vv-initiation-ards`         | Initiate VV ECMO for refractory severe ARDS                          |
| `clinical-vv-occult-hemorrhage`       | Occult hemorrhage with drainage insufficiency                        |
| `clinical-vv-tension-pneumothorax`    | Tension pneumothorax causing obstructive low flow                    |
| `clinical-vv-recirculation-migration` | Refractory hypoxemia from VV recirculation                           |
| `clinical-vv-gas-disconnection`       | Sweep-gas disconnection with rapid hypercapnia                       |
| `clinical-vv-oxygenator-thrombosis`   | Oxygenator thrombosis with worsening gas transfer                    |
| `clinical-vv-circuit-air-embolism`    | Air entrainment with emergency circuit isolation                     |
| `va-clinical-initiation-shock`        | Initiate peripheral VA ECMO for refractory cardiogenic shock         |
| `va-clinical-differential-hypoxemia`  | Differential hypoxemia during cardiac recovery                       |
| `va-clinical-tamponade`               | Postcardiotomy tamponade with low VA flow                            |
| `va-clinical-vasoplegia`              | Recovered cardiac function with persistent vasoplegia                |
| `va-clinical-limb-ischemia`           | Cannulated-limb ischemia from distal-perfusion failure               |
| `va-clinical-oxygenator-thrombosis`   | VA oxygenator thrombosis with falling support                        |
| `va-clinical-circuit-air-embolism`    | VA circuit air with emergency arterial isolation                     |
| `vv-off-sweep-capstone`               | VV off-sweep integration and observation of the modeled response.    |
| `va-mixed-circulation-capstone`       | VA mixed-circulation integration across circuit and patient domains. |

The same optional plan/reassessment renderers also handle compatible scenario URLs. Source: `content/clinicalCases.ts`, `content/scenarios.ts`, `PracticeCasePlayer.tsx`. No formal examination, secure item bank, compulsory remediation or independent-performance claim is retained on the public ECMO routes.
