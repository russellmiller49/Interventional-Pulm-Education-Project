> **Ported record.** Body verbatim from draft
> [PR #94](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/94)
> at head `3860181e`, brought onto `main` by R0. Nothing below this block was edited.
>
> **Status under the redesign:**
>
> - **B6-011** (hub entry and counts do not match the stated curriculum) is **addressed by R1**.
>   The hub and the Learn landing now resolve their primary call to action through one shared
>   next-incomplete-section resolver over the canonical seventeen-section pathway, and every
>   displayed count is derived from the registries instead of written into the copy. The item's
>   own proposed test — assert the hub call to action against the pathway's first incomplete
>   section for a fresh progress object — is implemented as
>   `__tests__/hub-landing-door-alignment.test.tsx`.
> - **Status under R4 (2026-09-03/04, branch `claude/ecmo-9-3`; owner decision R4-OD-1 lifted
>   D-4 for the engine and scoring items):**
>   - **B6-001, B6-002, B6-004, B6-005, B6-006, B6-007, B6-012 — closed in the engine (R4 I6).**
>     Each is excluded by `__tests__/scoring-honesty.test.ts`, driven end to end with a positive
>     sibling path; `docs/cardiohelp-ecmo/redesign/r4-scoring-honesty-record.md` records what each
>     became.
>   - **B6-003, B6-015 — closed in copy and policy (R4 I5).** Resumption reads "per the current IFU
>     and approved local protocol" everywhere; backup readiness is stated as a bedside obligation
>     the simulator does not represent or credit; the transport scenarios author their own
>     reassessment guidance. `resumption-copy-contract.test.ts` bans the missed phrase forms.
>   - **B6-008 — closed (R4 I3a, I3d, I4, I5).** Titles, objectives, rail labels, unit copy,
>     observe steps and transfer steps are presentation-named; the pure-content scan
>     (`learn-precommit-leak.test.ts`) and the rendered scan over all twenty drills
>     (`learn-precommit-leak.rendered.test.tsx`) hold every pre-commit surface to each drill's deny
>     patterns; Practice masks the diagnosis until the debrief. Two operable control labels remain
>     disclosed by owner decision (see `r4-owner-decisions.md`).
>   - **B6-009 — closed (R4 I3c).** Deterministic per-item rotation and the length rule in
>     `choice-order.test.ts`; rationales likewise balanced (`reassessment-rationales.test.ts`).
>   - **B6-010 — closed (R4 I3f).** `pairedCaseForLesson` maps by mechanism with an honest
>     next-in-unit fallback; the three VA drills without a case are a recorded gap.
>   - **B6-016, B6-017 — closed (R4 I2, I4).** Learn verdicts carry the item's claim-scoped sources;
>     safety events reach the learner through authored labels only.
>   - **B6-013, B6-014, B6-018, B6-019, B6-020 — unchanged.** Not in the R4 scope; they keep the
>     priority they were admitted with.
> - The refuted/narrowed table at the end retains its dispositions unchanged.

No human observation is being reported.

# B6 confirmed defects and prioritized backlog

This backlog contains only findings with a concrete source location or engine/browser reproduction and a second review. Synthetic review does not establish how often a human learner will encounter, notice, or be harmed by a problem. Items that would alter Practice, Assess, the engine, persistent contracts, or the six frozen pilot panels are documented for later owner action and are not fixed in B6.

Priority scale: **P0** active safety or causal contradiction; **P1** answer leakage or inability to complete the intended task; **P2** sequencing, observability, or major cognitive-load problem; **P3** clarity, density, accessibility, or visual polish; **P4** optional enhancement.

## Admitted backlog

### B6-001 — VA preload verdict contradicts the engine (P0)

- **Failure class:** causal/content contradiction.
- **Location and reproduction:** `content/learnPredictionItems.ts` says flow “still creeps upward” as speed is increased in `va-preload-drainage-collapse`. Independent engine sweeps reproduced the opposite once drainage-limited: approximately 3.10 L/min at 3000 RPM, 2.96 at 3300, 2.83 at 3600, 2.70 at 3900, and 2.56 at 4200, with progressively more-negative pVen. `engine/simulation.ts` and `drainage-capacity-sweep.test.ts` support the falling direction.
- **Second review:** Zeno’s perfusion audit identified the stale sentence; Zeno’s later independent engine cross-examination reproduced the series, and the integration lead separately reproduced the 3600/4000/4800 direction. Same-identity duplication was not counted as a vote; the source and engine are the proof.
- **Educational harm:** the postcommit verdict undermines the dangerous-reflex correction by describing a reward for more pump demand that the live circuit does not deliver.
- **Proposed test:** derive the verdict-direction assertion from a drainage-capacity RPM sweep and reject “creeps upward” while the fault is active.
- **Scope and owner:** prediction copy is frozen for B6; owner may make a post-human copy correction without changing answer, IDs, Practice, Assess, or model.
- **Human-testing question:** after the live correction, does a learner predict that reducing excessive speed can improve drainage-limited flow?

### B6-002 — Bubble isolation can be skipped while still earning mastery (P0)

- **Failure class:** safety/scoring invariant failure.
- **Location and reproduction:** for both bubble scenarios, an engine-level path can trigger the stop, leave both near-patient clamps open, dispatch fault correction/reset, reassess, and resume. The reproduced terminal state had pump running, clamps open, no critical error, all five credit fields, score 100, and mastery. Guided steps impose order, but `engine/reducer.ts` does not require clamp history before correction/resumption.
- **Second review:** Lagrange reproduced the bypass in both modes; Zeno independently confirmed that reducer resumption checks air correction/clearance but does not validate the prior clamp history. Existing bubble suites cover the scripted path and unsafe reopening, not never isolating.
- **Educational harm:** a safety-critical action explicitly taught as necessary is optional to the scoring engine.
- **Proposed test:** in both modes, correction/reset/resumption must not award cause credit or mastery unless the documented return-then-drainage isolation history occurred.
- **Scope and owner:** engine/Practice/Assess behavior is frozen in B6; changing this requires model/scoring review after human reconciliation.
- **Human-testing question:** does the guided sequence make physical isolation distinct from a pump stop, and can a human learner explain why both limbs matter?

### B6-003 — Bubble Practice copy teaches ordered unclamping that the model disclaims (P0)

- **Failure class:** safety-copy/model-boundary contradiction.
- **Location and reproduction:** learner-facing strings in `content/clinicalCases.ts` and `content/practiceSupport.ts` say “ordered unclamping,” “both clamps are reopened in order,” or “unclamp and resume … in a bounded, ordered sequence.” The engine and current safety boundary deliberately use one atomic `RESUME_SUPPORT_AFTER_BUBBLE` transition and refuse to teach where clamp opening, pump restart, and reset occur relative to one another.
- **Second review:** Zeno identified the stale Practice wording in the circuit audit and independently reproduced the exact variants during adversarial review. The integration lead verified that `resumption-copy-contract.test.ts` misses these forms.
- **Educational harm:** the prose can be carried as a universal physical sequence even though the module lacks source authority to teach it.
- **Proposed test:** ban the missed phrase variants and require the canonical “current IFU and approved local protocol” bounded-resumption wording.
- **Scope and owner:** Practice copy is explicitly frozen in B6; owner must reconcile and change it in a separate package.
- **Human-testing question:** does the existing Practice wording leave a learner believing the module taught a universal clamp-opening order?

### B6-004 — Unsafe transport RPM reduction can still receive full mastery (P0)

- **Failure class:** safety/scoring inconsistency.
- **Location and reproduction:** in both transport scenarios, lowering RPM from 3200 to 2200 while on battery reduced flow from about 4.05 to 2.78 L/min, generated no safety error, and still allowed score 100/mastery after AC restoration. Prediction copy explicitly marks slowing the pump to stretch reserve as unsafe; the runtime has no transport-specific RPM guard or adequate-flow recovery condition.
- **Second review:** Lagrange reproduced both modes; the integration lead confirmed the absence of a corresponding penalty in scenario/reducer contracts and the lack of a negative-path test.
- **Educational harm:** the simulator can reward the exact circulatory/gas-support tradeoff the explanation calls unsafe.
- **Proposed test:** map the transport speed-reduction path to a critical error or mastery block and require restoration of appropriate modeled support before completion, without inventing a universal flow target.
- **Scope and owner:** shared engine and Assess/Practice behavior are frozen; owner/model-version decision required.
- **Human-testing question:** when reserve power is shown, does a learner consider reducing support to extend runtime, and what visible cue changes that plan?

### B6-005 — Wrong committed Assess plan can still master after later actions (P0)

- **Failure class:** assessment-credit mutation.
- **Location and reproduction:** a wholly wrong goal/control/direction in `vv-off-sweep-capstone`, followed by the correct action and reassessment, ended with goal false but control, direction, cause, and reassessment true, score 85, and mastery. Later action handling in `engine/reducer.ts` overwrites control/direction credit derived from the committed plan.
- **Second review:** the assessment lens and later safety audit independently exercised the path; the integration lead traced the state mutation in reducer source. The two audit roles shared an identity, so the executable reproduction and source—not nominal role count—support admission.
- **Educational harm:** unsafe or incoherent initial reasoning can be hidden by later simulator operation while still producing a mastery claim.
- **Proposed test:** committed prediction credit remains immutable unless an explicit remediation/recommit contract exists; a wrong initial plan cannot independently satisfy mastery.
- **Scope and owner:** Assess/scoring is out of B6 scope; requires an assessment-owner decision and likely progress-contract review.
- **Human-testing question:** after a wrong prediction, do learners understand whether later correction is remediation, a new attempt, or mastery of the original decision?

### B6-006 — Recognition/escalation is modeled as physiologic treatment (P0)

- **Failure class:** causal action-response contradiction.
- **Location and reproduction:** the VA differential action is described as verifying/escalating rather than resolving the state, but it starts improving right-radial saturation. In `va-lv-loading`, assessment/expert escalation increases pulse pressure and opens the aortic valve. Relevant action definitions are in `content/learnLessons.ts`; response curves are in `engine/simulation.ts`.
- **Second review:** Lagrange reproduced both actions; the integration lead confirmed the action copy and simulator response. The frozen VA differential panel itself warns that escalation is not a bedside maneuver that resolves the physiology.
- **Educational harm:** a learner may infer that naming/escalating a problem produces the improvement, or that the omitted treatment steps are clinically irrelevant.
- **Proposed test:** observation/escalation alone leaves physiology unchanged, or the action label explicitly represents a completed intervention whose boundaries and evidence are approved.
- **Scope and owner:** shared model and a pilot are frozen. Owner must choose action semantics and model version after human testing.
- **Human-testing question:** what action does a learner believe occurred when the values improve after “assess and escalate”?

### B6-007 — Zero sweep leaves post-oxygenator saturation pinned fully oxygenated (P1)

- **Failure class:** signal/causal contradiction.
- **Location and reproduction:** `engine/simulation.ts` correctly requires connected gas and sweep above zero for patient exchange, but calculates post-oxygenator saturation from source connection without sweep. In `vv-off-sweep-capstone`, sweep 0 with unchanged circuit flow left PO saturation at 99% while SpO₂ fell to about 82% and PaCO₂ rose to about 72 mmHg.
- **Second review:** Zeno reproduced the state and located the split equations; the integration lead verified that zero-sweep tests omit PO saturation. Existing scenario copy says the trial removes membrane gas exchange.
- **Educational harm:** a fully saturated blood-out value can falsely reassure that oxygen transfer persists with sweep off.
- **Proposed test:** with sweep zero, PO saturation cannot remain pinned at the fully oxygenated reference; test the relationship/direction without inventing an exact clinical endpoint.
- **Scope and owner:** model/Assess change, frozen in B6 and requiring model-version review.
- **Human-testing question:** does the PO value lead a learner to conclude that oxygen transfer continues during a sweep-off trial?

### B6-008 — Precommit content exposes diagnoses and best responses (P1)

- **Failure class:** answer leakage.
- **Location and reproduction:** titles/objectives render before prediction. The frozen preload panel states that drainage cannot supply pump demand; the frozen gas panel displays source state as “Interrupted.” The teaching narrative is visible beside all ten foundation predictions. Prior transfer steps also introduce the next lesson’s mechanism before its gate.
- **Second review:** the physician, perfusion, instructional-design, assessment, and safety lenses independently identified different cue paths. Source inspection confirms that the gate only withholds postcommit blocks, not page title/objective/state labels.
- **Educational harm:** successful choice can reflect label matching rather than causal prediction, concealing the unsafe mental model the task is meant to reveal.
- **Proposed test:** a precommit semantic-leak allow/deny contract covering diagnosis, causal chain, best workflow, and uniquely identifying state labels, reviewed per lesson rather than a fragile exact-string list.
- **Scope and owner:** frozen six and lesson copy remain unchanged; B6 contracts apply the stricter rule to fourteen drafts. Owner decides the desired scaffold level for pilots after human testing.
- **Human-testing question:** which visible cue first made the mechanism apparent before the learner compared signals?

### B6-009 — Answer position and length provide nonclinical shortcuts (P1)

- **Failure class:** assessment construction/cueing.
- **Location and reproduction:** the best choice is first in all 20 Learn items, all 20 foundation prediction/transfer items, and all 42 Practice reassessment questions. It is uniquely longest in 15/20 Learn items, 17/20 foundation items, and 34/42 Practice reassessments.
- **Second review:** Zeno’s circuit inventory and Lagrange’s assessment review independently computed the patterns; source arrays preserve authored order at render.
- **Educational harm:** a learner can use “first” or “most detailed” when causal reasoning is uncertain, inflating apparent task success.
- **Proposed test:** deterministic, accessible answer-order balancing or shuffling with stable choice IDs; add length-distribution review without forcing artificial equality.
- **Scope and owner:** changes would touch protected Learn/Practice/assessment behavior and require a separate owner-approved package.
- **Human-testing question:** when uncertain, does a learner cite answer position or detail as a reason for choice?

### B6-010 — Learn-to-Practice call to action can promise the wrong mechanism (P1)

- **Failure class:** transfer-routing mismatch.
- **Location and reproduction:** `LearnLessonPlayer.tsx` selects the first case in a curriculum unit rather than a mechanism-matched case. Examples route VA bubble or transport lessons to limb ischemia and VA oxygenator resistance to vasoplegia.
- **Second review:** nurse-education, instructional-design, and safety lenses independently identified mismatches; the curriculum matrix confirms that three VA mechanisms have no dedicated Practice case.
- **Educational harm:** the learner is told to transfer a just-taught mechanism, then sees a different causal problem, weakening retrieval and trust in the pathway.
- **Proposed test:** every visible transfer CTA resolves to an explicitly authored mechanism match, or its copy truthfully says “next case in this unit.”
- **Scope and owner:** protected curriculum/Practice routing is frozen; owner decision required.
- **Human-testing question:** what mechanism does the learner expect to practise after selecting the CTA, and is the actual case understood as related?

### B6-011 — Hub entry and counts do not match the stated curriculum (P2)

- **Failure class:** pathway sequencing/count mismatch.
- **Location and reproduction:** `CardiohelpHub.tsx` labels its primary recommendation “Start the curriculum,” but a fresh learner is sent to `startup-sensor-orientation` while both 17-section pathways begin with six foundation/physiology sections and the Learn landing page says to start with physiology. Hub copy says “Ten lessons per track,” which is ambiguous beside the 17 visible sections.
- **Second review:** nurse-education audit identified the entry/count mismatch; independent curriculum cross-examination traced `curriculum.ts`, `learningPathways.ts`, and the hub/landing copy. Existing tests explicitly ratify the startup-drill recommendation but do not test consistency with the pathway narrative.
- **Educational harm:** the primary entry bypasses the prerequisites presented first by the pathway, and unexplained counts obscure the intended sequence and workload.
- **Proposed test:** define whether a fresh Start CTA resolves to the first foundation or the first drill, then assert matching hub/landing copy and registry-derived counts such as “17 sections: 7 foundations/integration + 10 drills.”
- **Scope and owner:** routes and persistent contracts are frozen; owner must define the intended runway and terminology before implementation.
- **Human-testing question:** where does a learner expect “Start curriculum” to begin, and what do they understand “Ten lessons” to include?

### B6-012 — Bubble controls move patient physiology without elapsed time (P2)

- **Failure class:** temporal-causality contradiction.
- **Location and reproduction:** at unchanged simulation time during the bubble sequence, repeated clamp/correction/resumption actions changed SpO₂ in 0.7-point increments. The guided order is otherwise guarded, and an explicit later step moves the patient in the intended recovery direction.
- **Second review:** Zeno captured the exact same-time state sequence; the integration lead traced reducer/action recomputation and confirmed no test asserts patient invariance when time is unchanged.
- **Educational harm:** learners may attribute oxygenation changes to the clamp choreography itself rather than elapsed loss/restoration of support.
- **Proposed test:** clamp/correction actions leave patient variables invariant if simulation time is unchanged; clinical movement occurs only on `STEP`/`TICK`.
- **Scope and owner:** engine-wide Learn/Practice/Assess trajectory change; model-version review required.
- **Human-testing question:** are same-time changes noticed, and what cause does the learner assign to them?

### B6-013 — Immediate gas-fault observation uses a misleading reference state (P2)

- **Failure class:** observability/trajectory mismatch.
- **Location and reproduction:** the frozen VV lesson opens around SpO₂ 93.7%, drifts upward before injection, and is around 95.8% at the guided fault observation; only later does it decline to the narrated endpoint. Blood flow/pressures and gas-transfer direction are otherwise correct.
- **Second review:** the integration lead reproduced the t0/t4/t5/t9 series; Lagrange and Zeno independently distinguished the immediate-observation mismatch from the ultimately correct gas-path model.
- **Educational harm:** the action point can appear to improve the patient relative to the lesson opening, obscuring the intended causal contrast.
- **Proposed test:** define the reference frame used by the guided observation and assert the stated direction at that frame; do not encode an exact bedside magnitude.
- **Scope and owner:** pilot/trajectory is frozen; owner may change setup timing or copy after human findings.
- **Human-testing question:** which earlier value does the learner use as the baseline when judging the fault response?

### B6-014 — “Unpressurised” overstates stopped-pump knowledge (P2)

- **Failure class:** terminology/model-boundary contradiction.
- **Location and reproduction:** startup copy calls the state “stopped and unpressurised,” while the same panel and `engine/simulation.ts` correctly say a primed stopped circuit has static pressures the model does not represent. Pressure truthfulness tests guard unavailable readouts, not this word.
- **Second review:** Wegener’s physician audit and Zeno’s independent source/engine cross-examination reached the same concrete contradiction. Minority objection: the word may have intended “no pump-generated dynamic pressure,” but the qualification is absent.
- **Educational harm:** unavailable modeled values can be remembered as physical zero pressure.
- **Proposed test:** reject unqualified “unpressurised” in learner copy; allow language explicitly limited to pump-generated pressure while retaining the static-pressure boundary.
- **Scope and owner:** frozen pilot and prediction copy; later copy-only owner decision.
- **Human-testing question:** does the word evoke zero pressure, or merely absence of a flow-related gradient?

### B6-015 — Backup readiness is credited without a represented state (P2)

- **Failure class:** unobservable completion criterion.
- **Location and reproduction:** `RESTORE_AC_POWER` simultaneously satisfies copy asking the learner to confirm backup-console/emergency-drive readiness, but the engine has no backup availability or verification state.
- **Second review:** Lagrange identified the state gap; the integration lead confirmed the absence across engine types, console state, scenario predicates, and tests.
- **Educational harm:** a learner receives credit for a check the interface cannot perform or observe.
- **Proposed test:** either add an explicit non-persistent verification action/state with source/boundary review, or describe backup readiness as an out-of-model verbal obligation and withhold simulated credit.
- **Scope and owner:** potential engine/type/persistence change; owner decision required after human testing.
- **Human-testing question:** what visible action does the learner believe confirmed backup readiness?

### B6-016 — Evidence shown in Learn is not the item’s claim-scoped evidence (P2)

- **Failure class:** provenance-surface wiring.
- **Location and reproduction:** all 20 predictions carry item-level evidence arrays, but their `AnswerVerdict` does not render citations. The workbench drawer renders the usually narrower scenario array. It also omits each evidence record’s `supports` statements. Six live scenarios omit the model ID carried by their predictions, and the VA differential live scenario omits its direct dual-circulation source.
- **Second review:** Wegener’s evidence audit mapped each array/surface; the integration lead confirmed component wiring and the difference from foundation feedback, which does render item-level sources.
- **Educational harm:** learners see authority without knowing which claim it supports, and modeled live responses can appear without the registered model boundary.
- **Proposed test:** after commitment, every prediction evidence ID is reachable from the verdict/drawer, every displayed source has claim-scope text, and scenario/transfer evidence is a reviewed superset where live model claims appear.
- **Scope and owner:** learner surface and scenario arrays are frozen for B6; fourteen draft panels render their own claim-scoped support.
- **Human-testing question:** can a learner identify which source supports the mechanism versus which only supports device behavior or a model limitation?

### B6-017 — Raw internal identifiers can appear in learner-facing feedback (P3)

- **Failure class:** clarity/internal-state leakage.
- **Location and reproduction:** Practice final debrief can render raw critical-error IDs; some foundation/evidence surfaces also expose raw evidence IDs instead of resolved titles.
- **Second review:** assessment and accessibility audits found separate surfaces; the integration lead confirmed the render paths.
- **Educational harm:** implementation tokens are not a causal safety explanation and are especially opaque to screen-reader and second-language readers.
- **Proposed test:** learner-visible text contains no unresolved registry/error identifier; IDs may remain only in data attributes and logs.
- **Scope and owner:** Practice/foundation copy surfaces are outside B6; B6 panels resolve source titles and keep IDs nonvisual.
- **Human-testing question:** when an identifier appears, is it interpreted as a code to remember, an alarm, or a broken label?

### B6-018 — Foundation compact tab-list keyboard contract is incomplete (P1)

- **Failure class:** accessibility/keyboard semantics.
- **Location and reproduction:** `ResizableTeachingWorkspace.tsx` gives foundation compact tabs a roving `tabIndex` and click handlers but no Arrow, Home, or End handler. Because nonselected tabs are removed from sequential tab order, keyboard-only navigation cannot select another foundation panel through the announced tab interaction model.
- **Second review:** accessibility audit identified the implementation; independent curriculum/accessibility cross-examination reproduced the source contract. The simulator tabs were checked separately and do implement the standard keys.
- **Educational harm:** a keyboard-only learner can be trapped on the initially selected foundation panel at compact widths.
- **Proposed test:** keyboard tests for ArrowLeft/Right (or orientation-appropriate keys), Home, End, focus/selection synchronization, and no pointer rescue.
- **Scope and owner:** shared existing UI is outside the B6 panel-authoring surface; owner may address separately.
- **Human-testing question:** after correction, can a keyboard-only learner discover, change, and understand the foundation compact tabs without pointer assistance?

### B6-019 — Several horizontal data surfaces lack a named focusable scroller (P3)

- **Failure class:** accessibility/compact-layout reachability.
- **Location and reproduction:** several foundation tables use horizontal overflow without a named, focusable container; `SignalRegister` provides the stronger counterexample with `tabIndex=0`, role/group naming, and a text equivalent.
- **Second review:** accessibility audit identified the tables; integration source review confirmed the missing contract and compact-width risk.
- **Educational harm:** clipped columns can be unreachable to keyboard users in a narrow pane.
- **Proposed test:** any element with content-width overflow has a named focusable scroll region or a responsive non-scrolling alternative, plus a complete text equivalent.
- **Scope and owner:** B6 draft panels inherit the compliant `SignalRegister`; foundation remediation is separate.
- **Human-testing question:** at laptop and compact widths, can a keyboard-only learner reach and understand every clipped column?

### B6-020 — Simulator thresholds lack a complete provenance taxonomy (P3)

- **Failure class:** source gap/numerical interpretation.
- **Location and reproduction:** alarm defaults, pressure-stop bands, battery alerts, pH/right-radial alerts, backflow timing, and a chatter threshold are encoded in `engine/simulation.ts`. The console correctly labels editable device limits as simulated settings, while not every hidden cut point has a declared device/configured/model class and evidence record.
- **Second review:** Zeno catalogued the cut points; Wegener’s evidence audit independently found that current tests resolve IDs but do not check claim fit. Exact thresholds were not proven clinically wrong.
- **Educational harm:** a hidden simulation boundary may be remembered as a universal device or treatment threshold.
- **Proposed test:** every numeric cut point declares `device specification`, `configured device setting`, or `bounded model`, resolves to evidence or visible caveat, and is never rendered as a universal target.
- **Scope and owner:** provenance labeling can be nonbehavioral; changing threshold behavior requires model-version review.
- **Human-testing question:** can learners distinguish configured alarm limits and bounded-model alerts from bedside treatment targets?

## Refuted or narrowed findings

| Candidate finding                                                                   | Adversarial disposition                                                                                                                                                                       | Preserved objection or follow-up                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The blood-flow-versus-sweep foundation is clinically wrong                          | **Refuted as a confirmed defect.** Surrounding prose, panel, items, and tests say “principally,” acknowledge coupling, and avoid interchangeability.                                          | The short takeaway “Blood flow is the oxygenation control; sweep is the CO₂ control” may outcompete the qualification in recall. Owner may require “principally”; human testing should ask for an explanation of coupling. |
| The VV integration panel fails to show a gas-source pattern                         | **Refuted.** The pre/post matrix shows unchanged blood flow/pressures, lower PO saturation, higher PaCO₂, and lower pH after the timed fault; targeted tests guard it.                        | One phrase says little else moves CO₂ “this quickly.” Qualify timing as modeled-case behavior.                                                                                                                             |
| Gas restoration should immediately normalize patient values                         | **Refuted.** The real control immediately restores source/fault state; patient values improve only after an explicit reassessment step, which is defensible.                                  | Add a test that makes the temporal distinction explicit; ask humans whether they understand it.                                                                                                                            |
| The VA limb Practice workflow falsely claims to perform a catheter procedure        | **Refuted as stated.** The case requires bilateral assessment, blocks rescue before assessment, uses a generic specialist action, and explicitly disclaims catheter-manipulation instruction. | Static opening values differ slightly from initial live state; label as prior sample or align them. Add end-to-end prerequisite/final-state coverage.                                                                      |
| Copy count proves excessive cognitive load                                          | **Refuted as proof.** Word counts are objective; burden and skipping remain synthetic hypotheses requiring human observation.                                                                 | Preserve counts and test which sections are read, skipped, or used as reference rather than assuming harm.                                                                                                                 |
| The gas-interruption panel is inherently indefensible because it shows source state | **Unresolved design disagreement.** One audit treats visible source state as necessary signal reading; another treats `Interrupted` as the answer itself.                                     | Frozen pilot remains unchanged; test what evidence a human learner uses before choosing.                                                                                                                                   |
| The capstone is inaccessible because its prerequisite IDs cannot be satisfied       | **Refuted.** Hub and Assess copy intentionally expose the capstone as an open challenge; completion helpers provide recommendation/context state rather than access gating.                   | `prerequisite`, `unlock`, and `capstone-unlocked` nomenclature may still imply gating or readiness. Preserve persistent IDs and resolve the product meaning with the owner.                                                |
| Simulator bedside/pressure tabs lack Arrow, Home, and End support                   | **Refuted.** `EcmoLearnWorkspace.tsx` implements ArrowLeft/Right/Up/Down, Home, End, focus, and selection synchronization; focused tests cover wrapping and endpoints.                        | The foundation compact tabs are a separate confirmed defect and still require remediation/testing.                                                                                                                         |

## Backlog admission boundary

No item above authorizes a B6 change to Practice, Assess, progress, scoring, routes, persistent IDs, publication status, engine response, the six frozen pilot files, or B5 human-study materials. The fourteen draft panels may avoid repeating a defect, expose a truthful model boundary, and add tests that protect their own contracts. Correcting frozen behavior requires the reconciliation workflow in `b6-human-findings-reconciliation-template.md` and an owner-approved follow-on package.
