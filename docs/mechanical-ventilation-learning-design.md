# Mechanical ventilation: learning-flow rebuild

Design date: 2026-09-05. Audience confirmed by the course author: mixed experience, with a
beginner path and an experience-based entry. Clinical review status remains tester preview.

## Needs assessment and scope

The existing module has ten lessons, fifteen original casebook scenarios, four device consoles,
live waveform-derived diagrams, a bounded physiology engine, and substantial source material.
Keep those assets and case IDs. The original entry offers an overview, a tabbed primer, a
different pathway, device setup, and a three-pane simulation before a novice has a mental model.
Lesson 1 already tests compliance and controlled variables. A long primer is not a completed
foundation. No learner analytics were supplied; these are a structural audit, not observed
drop-off findings.

Teach adult invasive ventilation reasoning (Miller: knows how), for residents, fellows, and ICU
clinicians. Assume basic respiratory anatomy and familiarity with oxygen saturation and blood
gases. Use 5–10 minute sittings, with phone-readable lessons and desktop/tablet console practice.
Exclude neonatal ventilation, independent bedside competence, liberation protocols, and a
complete ARDS management course. Retain current clinical/device review boundaries.

## Alignment and sequence

One spine: start a breath → deliver support → end inspiration → allow expiration. Reassemble
that breath with the patient, gas exchange, and circulation during application.

| Objective                                                                                  | Bloom / Miller         | Units that teach it | Checks                                                |
| ------------------------------------------------------------------------------------------ | ---------------------- | ------------------- | ----------------------------------------------------- |
| Read a breath and distinguish a setting from its measured result                           | Interpret / knows how  | 1–3, 5              | breath, waveform, controls, mode checks and placement |
| Distinguish resistive, elastic, and trapped-pressure contributions; assess lung protection | Analyze / knows how    | 4, 6–7              | mechanics, protection, expiration checks              |
| Localize patient–ventilator mismatch within the breath                                     | Analyze / knows how    | 8, 11–12            | timing, reading, interaction checks                   |
| Separate oxygenation from ventilation and select reassessment                              | Apply / knows how      | 9–10                | oxygenation and CO₂ contrast cases                    |
| Prioritize assessment and stabilization, then justify a mechanism                          | Prioritize / knows how | 13–14               | safety, integration, mixed final check                |

## Lesson specs (before authoring)

Each row is a lesson spec; shared fields below apply to every row. Prerequisites are earlier
unit numbers, audited in code as a directed graph. The check and transfer test the stated
discrimination in distinct situations. Integration units introduce no new concepts.

| # / stable ID                            | Stage / minutes / scaffold     | Prerequisites; new concept or combination                           | Clinical question / prediction                                         | Wrong mental models to repair                                                    | Retain / reuse later                                        |
| ---------------------------------------- | ------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1 breathing-with-support                 | Orientation / 5 / worked       | None; the breath cycle                                              | What is the machine supporting, and where is gas moving?               | Machine substitutes for all gas exchange; expiration is another delivered breath | Normal-breath drawing → all units                           |
| 2 waveform-anatomy                       | Foundation / 6 / worked        | 1; three views of the same breath                                   | Which observation describes flow versus accumulated volume?            | Treat volume as a speed; confuse airway pressure with gas movement               | Normal-breath traces → 4, 5, 7, 11                          |
| 3 controls-and-goals                     | Foundation / 6 / worked        | 1, 2; setting versus delivered result                               | What must be checked after a setting change?                           | Setting guarantees delivery; alarm acknowledgement treats the cause              | Existing control knowledge, small decision panel → 5, 9, 10 |
| 4 mechanics-load-and-pressure            | Mechanism / 8 / completion     | 2, 3; pressure components                                           | Which measurement separates load during a passive breath?              | Peak equals lung distension; effort-contaminated plateau is valid                | Pressure decomposition → 6, 7, 14                           |
| 5 modes-and-breath-delivery              | Mechanism / 8 / completion     | 2, 3, 4; controlled versus dependent variable                       | What changes when mechanics change at fixed settings?                  | Mode name guarantees volume and pressure; mode switch cures disease              | Mode comparison and consoles → 6, 8, 11                     |
| 6 lung-protection                        | Mechanism / 7 / completion     | 4, 5; volume scaled to predicted body weight                        | Which basis and signals assess lung protection?                        | Actual weight scales lung size; normal oxygenation proves safe ventilation       | AARC 2024 / ATS 2024; MV-01 → 9, 14                         |
| 7 expiration-and-air-trapping            | Mechanism / 8 / completion     | 1, 2, 4, 5; incomplete emptying                                     | What follows when the next breath precedes emptying?                   | Higher rate necessarily improves ventilation; set PEEP equals total PEEP         | Existing obstructive cases MV-05/06 → 8, 10, 14             |
| 8 triggering-and-cycling                 | Mechanism / 8 / guided         | 1, 5, 7; patient and machine clocks                                 | Does mismatch occur at the beginning or end of inspiration?            | Cycling is triggering; missed effort means absent drive                          | Timing diagram; MV-07/09/10 → 11, 12                        |
| 9 oxygenation-response                   | Mechanism / 7 / guided         | 3, 4, 6; oxygenation benefit versus pressure cost                   | What else needs reassessment after oxygenation improves?               | FiO₂ equals PEEP; saturation proves a PEEP change is tolerated                   | Oxygenation diagram, MV-01 → 13, 14                         |
| 10 ventilation-and-co2                   | Mechanism / 7 / guided         | 3, 5, 7, 9; effective alveolar ventilation                          | Which response belongs to CO₂ clearance, and when?                     | Oxygen treats CO₂ retention; more rate always helps                              | CO₂ response diagram, MV-05 → 11, 14                        |
| 11 waveform-reading-sequence             | Application / 7 / guided       | 2, 4, 5, 7, 8, 10; combine the breath read                          | Which additional observation resolves an ambiguous pattern?            | Single trace diagnoses a cause; mode name replaces patient assessment            | Existing synchronized reading panel → 12–14                 |
| 12 dyssynchrony-mechanisms               | Application / 8 / independent  | 5, 8, 11; combine effort, delivery, and timing                      | What distinguishes insufficient flow, mistiming, and excessive assist? | Sedation fixes every mismatch; high rate defines the cause                       | Dyssynchrony panel, MV-02/03/04/07/08/09/10/11/12 → 14      |
| 13 safety-reassessment-and-human-factors | Application / 7 / independent  | 3, 6, 9, 10, 11, 12; combine patient and device assessment          | What comes first in a deteriorating patient?                           | Documentation is treatment; alarm silence proves resolution                      | Safety panel, MV-13/14/15 → 14                              |
| 14 high-peak-pressure-integration        | Integration / 10 / independent | 4, 6, 7, 8, 9, 10, 11, 12, 13; combine previously taught mechanisms | How do similar alarms lead to different explanations?                  | Reuse prior diagnosis; delay stabilization for a perfect hold                    | Discriminator and all practice cases → final mixed check    |

Shared lesson-spec fields:

- Signals/provenance: new short cases are explicitly authored teaching cases; existing simulator
  values remain authored, not patient measurements. Textbook relationships use the existing Tobin
  evidence registry. New guideline claims use the 2024 AARC assessment and ATS ARDS guidelines.
- Analogy → precise statement → three/four-item checklist → reasoned example → completion or
  independent micro-case → option-specific feedback → transfer → key points → named next unit.
- Commit boundary: while a question is pending, render its observations, neutral heading, and
  choices only. Teaching figures, checklists, source titles that cue mechanisms, worked reasoning,
  feedback, and next-case links are unmounted. Prior retrieval uses its own neutral surface.
- Misconceptions: adapt the supplied casebook's unsafe/incorrect actions and existing lesson item
  rationales; these are curriculum-authored distractors, not measured prevalence claims.
- Action → system → patient: selecting an answer records reasoning only; it does not change a
  patient. Live experiments use the existing reducer and elapsed simulation time, labelled as
  demonstrations. No new physiology or clinical scoring algorithm is introduced.
- Harmful reflex: each safety-sensitive item tags unsafe choices. Later correct answers do not
  erase the original observation. Final-check passing requires both the stated accuracy and no
  unsafe choices. Reading/example exploration earns no assessment credit.
- Model boundary: passive single-compartment diagrams omit heterogeneity and patient effort;
  simulator responses are bounded approximations. Emergency procedures defer to current local
  protocol and trained supervision.
- Load: five control families rather than nine individual controls at entry; only three trace
  names in unit 2; device-specific controls remain in optional experiments and practice.
- Numbers: lesson duration and passing thresholds are authored course design; simulated numbers
  are marked at point of use, source/date in the registry; ATS ARDS tidal volume 4–8 mL/kg PBW
  and plateau <30 cmH₂O are guideline-defined, exact, dated, and explicitly ARDS-scoped.
- Transfer uses a changed context or reverse discrimination; it is not the same stem with a new
  patient name. Each subsequent lesson retrieves an earlier concept; stage endings mix concepts.

## Progress, placement, and practice

One registry drives the hub, grouped path, navigation, estimates, and next-incomplete resolver.
Keep old lesson and case IDs valid. A separate versioned learning record stores only item IDs,
choices, confidence, phase, timestamps, and duration; old simulator history stays readable.
Resume restores the exact instructional phase and committed choices, not invented patient state.
Storage failures show a clear session-only notice.

Eight-item placement check is ungraded placement, with explanation delayed until all commits.
Strong objective-level evidence collapses worked guidance, but grants no completion or skipped
unit credit. Learners can always restore full explanations. No "mastered" label is introduced.
Unit completion requires both micro-cases and the earlier retrieval item to be committed and
reviewed. Show first-attempt accuracy separately from completion; missed items go to review.
The final mixed check unlocks after the complete learning path and is a limited knowledge check,
not a clinical credential. Criteria: at least 80% with no unsafe answer; show numerator and
denominator. Feedback and targeted remediation appear after the final commit.

Practice opens with the clinical task, one recommended case, and an optional case library; saved
console and support are adjustable secondary choices on the same screen. Use an interleaved case
order and keep all 15 cases available. Match lesson-to-case links by mechanism, and distinguish
an explanatory case run from the independent mixed check. Reuse existing case runtime, review
contracts, scoring, and device limits.

## Evaluation and verification

Record only local first choices, confidence, completion dates, and active unit time. Use a local
review queue for missed/uncertain concepts, then re-serve after approximately 7 and 30 days
(authored scheduling heuristic). No notification or new server data collection is implied.
Pilot with 3–5 target learners: find the start; explain current stage; make a decision; interpret
feedback; leave and resume. Compare actual times with estimates and identify confident errors.

Verify registry/prerequisite closure, counts and CTA agreement, persistence and invalid storage,
commit boundaries (including accessibility surfaces), unsafe-answer scoring, placement without
completion credit, named final-check locks, lesson/case pairing, mobile/desktop rendering,
keyboard operation, and existing engine tests. Run the skill's cueing script on the new item set
and conduct a separate rendered review. Clinical review and user pilot remain human validation.

## Implementation review — September 5, 2026

The implemented course has 14 units, 28 unit decisions, 8 placement items, and 10 distinct final
items. The shared activity catalog derives Learn from the same registry and includes the new
non-credit final check. The older seeded simulation challenge retains its stable link and
separate identity. Existing lesson IDs, all 15 case IDs, four console profiles, waveform assets,
casebook knowledge, physiology, and original simulation history remain available.

The course stores its instructional record in this browser. It does not synchronize this new
record to an account. Placement adjusts guidance by objective and grants no unit completion.
The final check names every missing unit and requires the entire path; a passed result reports
only the authored knowledge-check standard. Legacy simulator runs retain their existing
contracts and are not reinterpreted as results from the new check.

Editorial and rendered review found and repaired answer-position bias, distinctive key wording,
one nonparallel option, pre-question explanation exposure, serialized-unit numbering, keyboard
focus after commitment, mobile console button names, low-contrast unavailable readouts, and an
empty notification tray that covered mobile content. The skill's final cueing audit passes:
46 three-choice items, keys A/B/C = 16/15/15, first-option strategy 35%, longest-option strategy
38%, and mean key/distractor length ratio 1.04. No P1/P2 cueing flags remain. The three remaining
P3 parallelism alerts are heuristic false positives: all options in those items are imperative
verb phrases (the detector does not recognize every verb, such as “reassess”). Copy-density
checks pass for every unit, including its assigned item text. These checks do not establish
clinical accuracy or psychometric validity.

Verification evidence:

- Production build, TypeScript, and changed-file lint pass. Full repository lint has no errors
  and 15 pre-existing warnings.
- The full repository Jest run passed 11,274 tests and exposed four failing assertions across
  three suites. The old catalog expectations and new copy were repaired. The unrelated CLI
  test expected empty stderr but encountered Node 26's `module.register()` deprecation warning;
  it passes on the installed Node 20 runtime. A subsequent 27-suite run covering ventilation
  and all three affected suites passed all 589 tests. Final focused catalog, curriculum, route,
  learning-state, and interaction checks also pass.
- Eight Playwright scenarios pass at 1440, 1024, 390, and 320 px. They exercise the complete
  14-unit path, preserved incorrect first choice, resume, placement without completion credit,
  final-check gating and completion, retained live experiment, and all 15 practice case links.
  Use `npx playwright test --config=playwright.ventilation.config.ts` on worktree port 3110.
- Rendered axe checks of the course root pass for the hub, lesson entry, interactive normal
  breath, worked example, pending decision, committed feedback, matched practice, final gate,
  and the open live mechanics experiment on mobile. Keyboard-only radio selection, confidence,
  commitment, feedback focus, and continuation were exercised. Desktop/mobile screenshots
  were inspected and no horizontal overflow was found at the tested widths. This is a scoped
  accessibility check, not a conformance certification.

Still required for public release: independent clinical/device review under the existing release
checklist, a 3–5 learner pilot across both experience levels, and review of actual timing and
confident-error patterns. No publication status, professional credit, or supervised performance
claim is advanced by this rebuild.
