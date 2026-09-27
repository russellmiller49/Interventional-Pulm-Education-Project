# EBUS-PRE-REVIEW-05 — teaching drafts (owner review)

**Everything clinical in this file is DRAFT — NOT REVIEWED** — with one exception recorded on
2026-09-24: the _substance_ of D10 (fasting is required before EBUS) is an owner decision; its wording
remains a draft. Nothing here is in the application.
No question id, key, activity id, accepted action, schema, stored state, media file or source-review
status was changed. Reviewer, role and review date are blank throughout and must stay blank until a
real review happens.

- Baseline: `85acc113be11f9acbd395f49e00fee4b69ceff71` (origin/main at start, 2026-09-23).
- Companion files: `EBUS-PRE-REVIEW-05-decision-packet.md` (the decisions),
  `EBUS-PRE-REVIEW-05-asset-source-manifest.json` (evidence records), `EBUS-PRE-REVIEW-05-status.json`.
- Runtime text quoted below was exported from the course content modules at the baseline.
- The fellow walkthrough is an AI persona's observation source, not clinical validation.

Contents: **A** ten selected reinforcement revisions (plus per-row dispositions and the L21-3
recognition-first scenario) · **B** two image-based storyboards · **C** one depth/gain/contrast/Doppler
consolidation map · **D** small field and copy proposals.

## A. Selected reinforcement revisions (10 of a 108-item bank)

Every item below is **DRAFT — NOT REVIEWED**. Reviewer, role and review date are blank on purpose.
None of these changes is in the application. Item ids, keys and activity ids are unchanged at
`85acc113`; where a draft would change a stem materially, the id it would need is a proposal for the
owner, not a decision.

**How the ten were chosen.** Each one stands for a defect class that recurs across the lane-05 rows,
so the owner can accept or reject the class once rather than item by item:

| Class                                            | What goes wrong                                                         | Representative draft                   | Other rows in the same class (disposition in §A.11) |
| ------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| Off-axis distractor                              | Only the key is a plausible answer                                      | R1 `purpose-predict`                   | L1-8 (tissue-testing, transfer items), L19-4, L18-3 |
| Worked example re-nouned / strawman              | The check repeats the worked example and the wrong answers are absurd   | R2 `prep-predict`                      | L2-5                                                |
| Stem names the problem                           | The question answers itself                                             | R3 `prep-transfer`, R6 `seven-predict` | L2-6, L12-2 (Prompt-04 carry-forward)               |
| Item names a state the learner may not have held | Evidence/question mismatch                                              | R4 `cutaway-observe`                   | L5-1 (carry-forward), L5-6                          |
| Length cue                                       | The key is the longest, most qualified option                           | R5 `depth-observe-v2`                  | L6-4, L8-3, L9-5                                    |
| Re-asks the row just matched                     | Follow-up repeats the matching activity                                 | R7 `hilar-predict`                     | L15-3 (carry-forward)                               |
| Same vignette three times                        | Retrieval with no new surface features                                  | R8 `morphology-observe`                | L16-4, L21-5, L22-4, PR-1                           |
| Meta-question                                    | Asks what the checklist establishes, not a clinical decision            | R9 `recovery-observe`                  | L25-4                                               |
| Guideline recall repeated verbatim               | Case re-asks a lesson item word for word; recall instead of application | R10 `followup-negative`                | CS-2, L26-4                                         |

**Measured bank-wide fact (not a psychometric claim).** In the 108 multiple-choice items exported
from the runtime at `85acc113`, the keyed option is the longest option in 45 (ties resolved by
authored order). Display order is rotated per item by `choiceOrder()`
(`src/features/ebus-guided/content/authoring.ts:49`), so position does not cue the key; length can.
This is reported so the owner can decide whether length balancing is worth a pass. It is not a
reason to hide explanations, delay solutions or add scoring, and none is proposed.

Authored option ids are shown (`a`/`b`/`c`); `*` is the key, `!` an unsafe flag, both read from the
runtime. In every current item the key is authored as `b`.

### R1 — `purpose-predict` · lesson 1 · source IDs L1-8 (and the L1-5 class)

- **Runtime:** `src/features/ebus-guided/content/prepare.ts:31`; lesson `clinical-question`, activity
  `clinical-question:information-needs` (check after the matching task).
- **Current scenario/stem:** "A malignant station 7 aspirate establishes lung carcinoma. The
  contralateral mediastinum has not been examined. Which question remains unresolved?"
- **Current options:** a "Whether the ultrasound probe was linear" — _Probe type is known from the
  procedure and does not resolve nodal extent._ · **b\*** "Whether disease involves other relevant
  nodal stations" — _A result from one station does not supply the rest of the nodal map._ · c "Whether
  the same station should be renamed after cytology" — _Station identity is anatomical; pathology does
  not change its name._
- **Weakness:** option a is not a competing belief; the key is the only sensible answer (L1-8). The
  EBUS-01 question ledger kept the item and noted the same friction.
- **Proposed stem:** unchanged.
- **Proposed options:** a → "Nothing further for staging: a malignant subcarinal node already fixes
  the nodal stage" — _Station 7 is N2 for either primary side, but the unexamined contralateral
  stations have no tissue result, so higher nodal involvement has not been assessed._ · **b\*** unchanged
  · c unchanged (the EBUS-01 ledger identifies it as the real confusion).
- **Key:** unchanged (`b`).
- **Source support:** course text only — lesson 1 paragraph 2 ("A malignant sample from one accessible
  node may answer the first question while leaving other relevant stations unexamined"); lesson 17
  paragraph 2 and its worked example (station 7 = N2 for either side; contralateral mediastinal = N3);
  IASLC ninth-edition N definitions (`iaslc9`, not re-read in this batch — see decision packet §4).
- **Clinical uncertainty:** low; the distractor restates a misconception the lesson already corrects.
- **Teaching purpose:** make the "one positive station completes staging" error a visible, explained
  option.
- **Owner decision:** accept / revise / retain current. L1-5 (matching responses share words with the
  cues) is not redrafted: the matching task's purpose is the three-way distinction and remains
  readable; the owner may ask for reworded responses later.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R2 — `prep-predict` · lesson 2 · source ID L2-5

- **Runtime:** `src/features/ebus-guided/content/prepare.ts:155`; activity `preparation:team-check`.
- **Current scenario/stem:** "The airway plan is documented, but the patient reports a new
  anticoagulant with an uncertain last dose. What should happen next?"
- **Current options:** a! "Proceed because needle aspiration cannot cause important bleeding" —
  _Needle aspiration still carries bleeding risk; the assumption is unsafe._ · **b\*** "Clarify the
  medication history and procedural plan" — _The unresolved medication history may change bleeding
  risk and timing._ · c "Use a fixed hold interval without identifying the medication" — _Different
  drugs, renal function, and thrombotic indications require different decisions._
- **Weakness:** the stem is the worked example with new nouns ("recently prescribed anticoagulant …
  last dose unclear"); option a is a strawman.
- **Proposed scenario/stem:** "On the morning of an elective EBUS, the patient says they were told to
  stop 'the blood thinner' a few days ago. The medication list includes both aspirin and an oral
  anticoagulant, and it is not clear which was stopped or who advised it. What should happen next?"
- **Proposed options:** a! "Proceed, because the patient reports that the blood thinner was stopped" —
  _The report does not establish which drug was stopped, when, or on whose advice; the bleeding and
  thrombotic plan is still unresolved._ · **b\*** "Establish which drug was stopped, when, and for
  what indication before confirming the plan" — _Interruption decisions depend on the drug, the
  indication and patient factors; this course does not supply a universal interval._ · c unchanged
  ("Use a fixed hold interval without identifying the medication").
- **Key:** unchanged position (`b`); the wording of the key changes. Because the stem changes
  materially, the owner would decide whether a new id (for example `prep-predict-v2`) is needed; no id
  is changed here.
- **Source support:** lesson 2 paragraph 1 ("Antithrombotic interruption and laboratory testing depend
  on the drug, indication, patient, and local guidance; avoid a universal hold interval"). The
  rationale deliberately names **no drug-specific interval**. External guidance on antiplatelet and
  anticoagulant handling is summarized, with its limits, in decision packet §4 (row L2-1) and is **not**
  used as this item's support.
- **Clinical uncertainty:** whether the unsafe flag on option a should stay (owner/faculty call).
- **Teaching purpose:** the fellow's real error is accepting an incomplete medication history as
  resolved, not believing needles cannot bleed.
- **Owner decision:** accept / revise / retain current; confirm the unsafe flag.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R3 — `prep-transfer` · lesson 2 · source ID L2-6 (Prompt-04 carry-forward Q6)

- **Runtime:** `src/features/ebus-guided/content/prepare.ts:198`; activity
  `preparation:apply-another-situation` ("Decide when to pause").
- **Current scenario/stem:** "A planned airway conduit may be too narrow for the EBUS scope while
  maintaining ventilation. Which issue needs resolution?"
- **Current options:** a "Whether the image gain can compensate for the narrow conduit" · **b\***
  "Scope fit within the ventilation strategy" · c "Whether specimen labels can be prepared after the
  procedure".
- **Weakness:** the stem names the problem, and both distractors are off-axis.
- **Proposed scenario/stem:** "For general anesthesia, the anesthesia team plans a smaller
  endotracheal tube than the one usually used with your EBUS scope. The patient will need continuous
  positive-pressure ventilation throughout. What should be settled before starting?"
- **Proposed options:** a "Nothing extra: a tube that admits a diagnostic bronchoscope will also admit
  the EBUS scope" — _The EBUS scope occupies more airway space than a small diagnostic bronchoscope._ ·
  **b\*** "Whether the EBUS scope will pass while the ventilation plan remains achievable" — _Scope fit
  is part of the airway and ventilation plan, not an equipment afterthought._ · c "Only whether the scope
  passes; ventilation can be adjusted if problems arise" — _Passage and ventilation around the scope are
  one plan and are agreed before the procedure._
- **Key:** unchanged position (`b`). No tube size or scope diameter appears — those depend on the
  exact scope model and IFU revision (L2-2 hold, packet §4 row L2-2).
- **Source support:** lesson 2 paragraph 2 ("The EBUS scope occupies more airway space than a small
  diagnostic bronchoscope. An airway conduit must accommodate the intended scope without compromising
  the ventilation plan").
- **Clinical uncertainty:** whether to name the conduit types (endotracheal tube, laryngeal mask,
  rigid bronchoscope) at all — owner call, tied to L2-2.
- **Teaching purpose:** recognize a fit-and-ventilation problem from a described setup.
- **Owner decision:** accept / revise / retain current (Prompt 04 labelled the check as guided practice).
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R4 — `cutaway-observe` · lesson 5 · L5-1 (carry-forward Q3), related L5-6

- **Runtime:** `src/features/ebus-guided/content/models.ts:136`, `namesContactMode: 'shadow'`
  (`models.ts:149`), `imagePolicy: 'retained-acquisition'`; activity
  `contact-cutaway-model:review-acquisition`.
- **Current stem:** "Why did changing gain fail to remove the dark region behind the reflector?"
- **Current options:** a "All dark regions represent malignant tissue" · **b\*** "The modeled acoustic
  path is attenuated behind the reflector" · c "Balloon inflation always removes artifacts".
- **Weakness:** the check assumes the reflector state was held and that gain was raised in it. The
  lab requires all five conditions to be inspected before a hold (`MODEL_STEPS.contact`,
  `src/lib/ebus-model-contract.ts:8`) but the held frame can be any of them, and the learner raises gain
  only in the air-gap step. Prompt 04 added a presentation note when the held condition differs; the
  alignment itself is held. The EBUS-01 ledger already proposed "replace — pending EBUS faculty review".
  Prompt 04 also measured that the 3D cutaway renders the reflector and direct-contact states
  identically (0 px difference); the difference is visible only in the echo schematic.
- **Owner options:** (A) replace with a condition-neutral comparison (draft below); (B) keep the item
  and the Prompt-04 note (current behaviour); (C) author one variant per held condition (five keyed
  items — larger change, more review); (D) require the reflector state before the check — **not
  recommended**: it adds an acquisition gate that the self-paced policy does not support.
- **Draft for option A — stem:** "You inspected the air-gap and reflector states in the echo
  schematic. Both leave a dark region. Which difference in mechanism does the model show?"
- **Draft options:** a "Both are corrected by raising gain" — _Gain amplifies returning echoes; it
  cannot restore a missing window or the signal lost behind a reflector._ · **b\*** "The air gap blocks
  transmission at the transducer; the reflector attenuates the path only beyond it" — _The course
  distinguishes a complete air gap at the transducer from a shadow behind a strong reflector._ · c "The
  dark region behind the reflector is a low-echo node" — _A shadow is an acoustic effect; it does not
  describe tissue._
- **Key:** `b` in all options. Option A would need an owner decision on `imagePolicy` (whether the
  item still requires a held image) and on a new id.
- **Source support:** lesson 5 paragraph 2 ("A shadow behind a strong reflector has a different
  mechanism from a complete air gap at the transducer"); model-derived behaviour of the authored
  cutaway (`simulation` source). No clinical recording is involved.
- **Clinical uncertainty:** none new; the mechanism is the lesson's own.
- **Teaching purpose:** the discrimination the lesson objective names (L5-6), without depending on
  which condition was held.
- **Owner decision:** A / B / C (D not recommended). L5-1 stays **unresolved** until then.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R5 — `depth-observe-v2` · lesson 6 · source ID L6-4 (length-cue class: L8-3, L9-5)

- **Runtime:** `src/features/ebus-guided/content/image-items.ts:8`; activity
  `image-depth:review-acquisition`, `imagePolicy: 'retained-acquisition'`.
- **Current stem:** "Compare the previous deep recording with your held shallower view. What explains
  the larger displayed target?"
- **Current options (characters):** a "The change demonstrates a different measured short-axis
  diameter" (64) · **b\*** "The displayed depth range is smaller; the view still needs its far margin and
  surrounding context" (97) · c "The larger display establishes that less tissue beyond the target is
  always preferable" (86).
- **Weakness:** the key carries a teaching clause the other options lack (L6-4). The EBUS-01 ledger
  proposed the same rewrite.
- **Proposed options:** a "The node's short-axis diameter changed between recordings" · **b\*** "The
  displayed depth range is smaller" · c "Less tissue beyond the target is always the better field".
  Rationales unchanged except that the far-margin caveat moves into the key's rationale: _The recordings
  demonstrate field selection. A larger display does not establish a different physical dimension, and
  the far margin and surrounding context still need to be assessable._
- **Key:** unchanged (`b`); claim unchanged. Wording-only, so the id could stay (as Prompt 04 did for
  L1-11); owner confirms.
- **Source support:** lesson 6 paragraphs 1–2 (course text).
- **Clinical uncertainty:** none.
- **Teaching purpose:** field selection versus physical size, without a length cue.
- **Owner decision:** accept / retain current. L8-3's other half (the visible key point "Absent color
  is not clearance for puncture" answering the transfer) is **retained current behaviour** under the
  self-paced policy; key points stay visible.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R6 — `seven-predict` · lesson 12 · source ID L12-2 (carry-forward Q6)

- **Runtime:** `src/features/ebus-guided/content/locate.ts:128`; activity `station-seven:station-decision`.
  Prompt 04 added a purpose line saying the stem names the compartment and the check separates approach
  from station.
- **Current stem:** "A confirmed subcarinal node is sampled through the left main bronchus. Which
  station should be recorded?"
- **Current options:** a "Station 10L because the scope is on the left" · **b\*** "Station 7" · c
  "Station 4L because the image is obtained from a left-sided window".
- **Weakness:** "subcarinal" gives the station away.
- **Proposed stem:** "A node lies below the main carina, between the medial walls of the right and left
  main bronchi. It is imaged and sampled through the left main bronchus. Which station should be
  recorded?"
- **Proposed options:** unchanged. **Key:** unchanged (`b`).
- **Source support:** lesson 12 paragraphs 1–2 (course text); IASLC map (`atlas`, not re-read in this
  batch).
- **Clinical uncertainty:** the description omits the side-specific inferior limits (lesson 12
  paragraph 1); the owner may prefer to add them.
- **Teaching purpose:** derive the station from the anatomical description while the approach
  distractors stay.
- **Owner decision:** accept / retain current. The EBUS-01 ledger and G00 kept this item; with the
  Prompt-04 purpose line, retaining it is defensible.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R7 — `hilar-predict` · lesson 15 · source ID L15-3 second half (carry-forward Q7)

- **Runtime:** `src/features/ebus-guided/content/locate.ts:434`; asked in activity
  `hilar-interlobar:regional-identity` straight after the matching task.
- **Current stem:** "A target lies between the left upper- and lower-lobe bronchi. Which station fits
  this location?" (a "4L" · **b\*** "11L" · c "7") — this is matching row `pair-2` asked again.
- **Proposed stem:** "A target lies beside the right main bronchus, below the lower border of the azygos
  vein and above the right upper-lobe takeoff. Which station fits?"
- **Proposed options:** a "4R" — _The lower border of the azygos vein is the lower boundary of 4R; this
  target is below it._ · **b\*** "10R" — _A hilar node beside the main bronchus below the 4R boundary._ ·
  c "11Rs" — _11Rs lies between the right upper-lobe bronchus and the bronchus intermedius; this target
  is proximal to the upper-lobe takeoff._
- **Key:** position `b`, answer changes from 11L to 10R (a new question, so a new id would be needed).
- **Source support:** lesson 13 paragraph 1 (lower border of 4R = lower border of the azygos vein;
  upper boundary of 10R); lesson 15 paragraphs 1–2 (station 10 hilar, beside the main bronchi; 11Rs
  definition); IASLC map (`atlas`) — **not re-read in this batch**; faculty should confirm the stem is
  unambiguous for 10R.
- **Clinical uncertainty:** moderate — boundary wording must match the atlas the course cites.
- **Teaching purpose:** a hilar-versus-paratracheal-versus-interlobar decision the matching did not
  already ask.
- **Owner decision:** accept / revise / retain current.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R8 — `morphology-observe` · lesson 16 · source ID L16-4 (repetition class)

- **Runtime:** `src/features/ebus-guided/content/plan.ts:60`; activity
  `node-characterization:description-reasoning`.
- **Current stem:** "Which sentence belongs in an ultrasound description?" (a "The node is definitively
  benign because it is oval" · **b\*** "An oval node with homogeneous internal echoes was visualized" · c
  "Molecular testing is adequate because the border is smooth").
- **Weakness:** the oval, homogeneous vignette appears in the worked example, `morphology-predict`, this
  item and the record task — the same surface four times.
- **Proposed stem:** "At station 7 you see a round node with a distinct margin and heterogeneous
  internal echoes. Which sentence belongs in the ultrasound description?"
- **Proposed options:** a "Station 7: malignant-appearing node; metastasis confirmed" — _Appearance can
  raise suspicion but does not establish pathology._ · **b\*** "Station 7: round node, distinct margin,
  heterogeneous internal echoes; pathology not established" — _This reports what is seen and keeps the
  pathology open._ · c "Station 7: heterogeneous node, therefore necrotic and not worth sampling" — _A
  low-echo or heterogeneous area is not proven necrosis, and appearance does not remove an indicated
  target._
- **Key:** position `b`; the wording changes (new id likely).
- **Source support:** lesson 16 paragraphs 1–3 (course text: describe station, shape, borders, internal
  echogenicity; no single feature establishes malignancy; avoid equating a low-echo centre with proven
  necrosis). The item names **no scoring system**; whether to name the Fujiwara features or the Canada
  Lymph Node Score is decision G2/G4 in the packet.
- **Clinical uncertainty:** low for the item; image use is a separate decision (storyboard A, G2).
- **Teaching purpose:** varied retrieval of "describe, don't diagnose".
- **Owner decision:** accept / revise / retain current.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R9 — `recovery-observe` · lesson 25 · source ID L25-4

- **Runtime:** `src/features/ebus-guided/content/complete.ts:143`; activity
  `complications-recovery:recovery-sequence`.
- **Current stem:** "Which outcome can the response checklist itself establish?" (a "That hypoxemia has
  resolved" · **b\*** "The response priorities are identified" · c "That delayed complications are
  excluded").
- **Weakness:** a meta-question about the checklist, with implausible alternatives.
- **Proposed scenario/stem:** "During a staging EBUS, bleeding is controlled and oxygenation has
  returned to its pre-event level. A planned 11L target has not been sampled. What should decide
  whether sampling resumes?"
- **Proposed options:** a "The original plan to sample every listed station, because the event has
  resolved" — _A plan made before the event does not account for it; completing the list is not itself a
  reason to continue._ · **b\*** "A team reassessment of stability, the remaining clinical question and
  the risk of continuing" — _This is the reassessment step of the lesson's response sequence._ · c "The
  number of passes already obtained at other stations" — _Pass counts elsewhere do not answer whether it
  is safe or useful to continue._
- **Key:** position `b`; new question (new id). Unsafe flags: none proposed; faculty may flag option a.
- **Source support:** lesson 25 paragraph 1 and sequence step 3 ("Reassess stability and the need to
  terminate or change the procedure") — course text. No local protocol is implied (L25-3 hold).
- **Clinical uncertainty:** whether any resumption after a bleeding event should be taught at all at
  this level — faculty call.
- **Teaching purpose:** a clinical decision after deterioration rather than a statement about a checklist.
- **Owner decision:** accept / revise / retain current.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### R10 — `followup-negative` · integrated case `assessment-followup` · source IDs CS-2, L26-4

- **Runtime:** `src/features/ebus-guided/content/cases.ts:378`.
- **Current stem:** "In the stated complete negative staging setting, what does the 2026 ERS/ESGE/ESTS
  guideline recommend regarding routine add-on mediastinoscopy?" (a "It is mandatory after every negative
  examination" · **b\*** "It is no longer routinely recommended" · c "It is never an option for any
  subsequent diagnostic question").
- **Weakness:** a near-verbatim repeat of lesson 26's `result-transfer` (`complete.ts:257`); absolute
  distractors. The key itself is supported: the 2026 ERS/ESGE/ESTS guideline, read in full on
  2026-09-23, recommends against add-on confirmatory mediastinoscopy after a negative systematic
  endosonography (PICO 4, strong recommendation, low certainty; packet §4, L26-4).
- **Proposed scenario/stem:** "An endosonographic staging examination samples 4R and 7 with
  representative results without malignancy, but a PET-avid 4L target could not be assessed. A
  colleague says the guideline position on routine add-on mediastinoscopy settles further staging.
  What is the best response?"
- **Proposed options:** a "Agree: the sampled stations were negative, so no further staging discussion
  is needed" — _The examination was not complete; an unassessed target has no tissue result._ · **b\*** "The
  position applies to a complete negative systematic examination; the unassessed 4L target needs its
  own plan" — _Applying a recommendation requires its premise to be met._ · c "Agree: negative stations
  make involvement of the unassessed target unlikely" — _Results at sampled stations do not classify an
  unsampled one._
- **Key:** position `b`; new question (new id). The premise "complete negative systematic
  examination" is the guideline's own condition (PICO 4 recommendation text); its justification
  allows add-on mediastinoscopy when the risk of a false-negative result is high, which the draft does
  not contradict.
- **Source support:** lesson 26 paragraph 2 and worked example (course text: an unsampled target is
  reported separately; inadequate or incomplete sampling is not a reliable negative examination);
  Korevaar et al., _Eur Respir J_ 2026;68(2):2600097, PICO 4 (read in full).
- **Clinical uncertainty:** moderate — faculty should confirm the scenario (a PET-avid unassessed
  4L target) is handled as intended.
- **Teaching purpose:** apply a recommendation's condition instead of recalling its wording twice.
  Preserves the useful design of case 5 (`assessment-distribution`: a supplied final-pathology pattern
  the learner must interpret), which is **not** redrafted.
- **Owner decision:** accept / revise / retain current.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

### A.11 — Lane-05 question rows not redrafted, and why

| Source ID | Runtime item(s)                                                   | Disposition                                            | Reason                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1-5      | `clinical-question:information-needs` matching                    | RETAIN CURRENT BEHAVIOR                                | Word overlap is real but the pairs teach the three-way distinction; R1 fixes the adjacent check                                                                               |
| L7-2      | lesson 7 lab instruction ("stop at example 4 or 5")               | RETAIN CURRENT BEHAVIOR                                | Prompt 04 (P3) kept worked settings visible and labelled the acquisition as guided; the gain criterion is a genuine acquisition property                                      |
| L8-3      | `doppler-transfer` + key point                                    | RETAIN CURRENT BEHAVIOR (exposure) · R5 class (length) | Key points stay visible under the self-paced policy; length balancing follows the owner's R5 decision                                                                         |
| L9-5      | `phantom-transfer`                                                | R5 class                                               | Key 71 characters vs 33/48; balance only if R5 is accepted                                                                                                                    |
| L18-3     | `eus-predict`, `eus-observe`, `eus-transfer`                      | R1 class                                               | EBUS-01 ledger already proposed "rewrite" for `eus-observe` (key echoes "complementary")                                                                                      |
| L19-4     | `route-model-predict-application-v2`, `route-model-observe`       | R1 class                                               | "The node becomes station 8" is implausible; EBUS-01 ledger proposed "combine" for `route-model-observe`                                                                      |
| L21-5     | `assembly-transfer` (repeats lesson 20 `needle-transfer`)         | R8 class                                               | Same "resistance → stop and reassess" surface twice; the L21-3 scenario below gives lesson 21 a new surface                                                                   |
| L22-4     | record decision `without-rose` and `rose-transfer`                | RETAIN CURRENT BEHAVIOR                                | Same answer twice, one in the record and one as transfer; label as intended retrieval rather than rewrite                                                                     |
| PR-1      | `drill-right`, `drill-side`, `drill-subcarinal`, `drill-approach` | Storyboard A + R8 class                                | The `drill-side` laterality check is the useful item and is kept; image-based variety comes from storyboard A                                                                 |
| CS-2      | integrated-case items                                             | R10                                                    | `differential-granulomas` ("granulomas alone are diagnostic of sarcoidosis") is a genuine misconception and is **preserved**; case 5 (`assessment-distribution`) is preserved |

### A.12 — L21-3: a recognition-first needle scenario in separate example state

- **Problem (L21-3):** in lesson 21 the learner presses "Introduce resistance" and "Change imaging
  plane" — they create the complication instead of recognizing it.
- **What stays:** the explicit demonstration controls and the lesson's required model steps
  (`MODEL_STEPS.needle`: `sheath`, `live-tip`, `lost-tip-stop`, `resistance-stop`,
  `protected-removal`, `src/lib/ebus-model-contract.ts:7`). The learner's lab state and held evidence
  are untouched.
- **Draft scenario (optional, after the lab):** "Watch this example." A fixed, scripted sequence on the
  same generic needle model plays in a separate example state:
  1. Tip live in plane, advancing (model state after `live-tip`).
  2. The plane shifts; a short bright line persists, and the 3D view shows the tip outside the plane
     (the existing `lost-tip-stop` geometry). The playback pauses: _"What has changed, and what do you
     do now?"_ Options: stop advancement and restore tip visualization (key) · continue, because the
     line is still visible · freeze the image and continue the pass.
  3. After restoring the window, the assembly meets resistance (the existing `resistance-stop` state):
     _"The tip is visible. What now?"_ Options: stop and reassess with the supervising operator (key) ·
     increase force · retract the sheath to reduce resistance.
- **Rules:** the sequence is fixed (never random), never writes to the learner's observation, held
  frame, progress record or examination draft, and is labelled "Example — not your acquisition". The
  explanation is available before answering; nothing is scored.
- **Source support:** lesson 20 paragraphs 2–3 and lesson 21 paragraphs 1–2 (course text). The third
  option in step 3 ("retract the sheath") would need faculty/device confirmation that it is a
  plausible misconception rather than a device-specific technique question; otherwise drop it.
- **Status:** DRAFT — NOT REVIEWED · reviewer: — · role: — · date: —

## B. Two image-based teaching storyboards

Both are **DRAFT — NOT REVIEWED**. Neither exists in the application. Each panel says where its
picture would come from; where the evidence does not exist, the panel is an explicit
**ASSET REQUIRED** blank, not a stand-in. No patient, pathology, border, vessel, node or station label
is invented. Model labels below are exact model label ids from the case-001 acoustic label volume,
which name **model structures only** and make no claim about any patient image.

### Storyboard A — station-boundary comparison: 2R, 4R or 10R?

Source IDs: L13-4, PR-1 (and PR-2 context), L11-2, L13-2; related L15-2.

- **Learner goal:** place a right paratracheal/hilar target from its relationship to the
  left brachiocephalic vein crossing and the lower border of the azygos vein, not from its shape.
- **Existing evidence:**
  - Lesson 13 text, `locate.ts` (boundaries: 2R/4R at the caudal margin of the left brachiocephalic
    vein where it crosses the trachea; 4R/10R at the lower border of the azygos vein).
  - Model case-001 presets that already exist: `station_4r_node_a::default` (the lesson-13 lab),
    and sector snapshots for `station_2r_node_a__default` and `station_10r_node_a__default`
    (`EBUS-course/apps/web/public/simulator/case-001/sector_snapshots/`). Lesson 13's landmark check
    already names the azygos vein, SVC and left brachiocephalic vein from model ids.
  - Station reference images `media/stations/{2R,4R}/ct/{axial,coronal,sagittal}{,-marked}.jpg`
    (checksums in the manifest). Provenance, rights and who drew the baked-in green station regions:
    **UNKNOWN**.
- **Proposed panels:**
  1. **Model, 4R preset** — the lesson-13 target with the three venous landmarks named (model ids).
     _Model-derived; exists._
  2. **Model, 2R preset** — same camera convention. _Preset exists; its in-plane window has not
     been measured and its target placement has not been faculty-reviewed_ (open item B1 in
     `docs/ebus-guided/remaining-work.md`: "Add the 4R/10R boundary contrast only after the target
     placement and boundary have been reviewed").
  3. **Model, 10R preset** — as panel 2, same caveat.
  4. **CT reference, 2R versus 4R axial (unmarked)** — the images lesson 13 already shows.
     **MEDIA / RIGHTS INPUT REQUIRED** before reuse in a new interaction.
- **Annotations:** only model label names in panels 1–3. The green regions in the "-marked" CT files
  are **not** used as annotations until their author and method are known.
- **Interaction:** the learner is shown one model section at a time (order fixed, not random), chooses
  2R / 4R / 10R, and can open the landmark overlay or the explanation before answering (self-paced
  policy). An optional worked comparison shows all three side by side.
- **Feedback (course sentences only):** "The lower border of the azygos vein is the lower border of 4R"
  / "the caudal margin of the left brachiocephalic vein where it intersects the trachea" / "Its
  sonographic shape cannot distinguish it from a node in 2R" (lesson 13 paragraph 1 and worked example).
- **Limitations to state on screen:** one synthetic anatomy; the model is not registered to the CT
  images (no CT registration exists, `case-transforms.json`); the CT and model are not the same
  patient examination; a model section is not a clinical station survey.
- **Missing evidence:** faculty review of 2R and 10R target placement and boundaries; measured windows
  for the 2R/10R presets; provenance and rights of the CT station images; attribution of the green
  station regions.
- **Clinical review required:** yes — anatomy/station boundaries (faculty or thoracic radiology).
- **Media/rights review required:** yes for panel 4; no for panels 1–3 (course-built model), subject to
  the owner confirming the model's source CT is cleared (`raw-assets/ebus-case-001`, provenance not
  audited in this batch).

### Storyboard B — "What is wrong with this image?" using genuine existing states

Source IDs: L24-3, L5-6, CS-1; related L4, L6-2, L7, L21-3.

- **Learner goal:** name the failure from the picture (no coupling, cropped field, washed-out gain,
  lost needle tip, shadow behind a reflector), then pick the first correction — the lesson-24 question
  order, from pictures instead of words.
- **Existing evidence (each state is something the course already produces):**

| Panel | State                                | Where it comes from                                                                                                                                                                             | Kind                              | What already asserts its meaning                                                                                                  |
| ----- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| B1    | No acoustic contact                  | Lesson 4 linked model (`goal: coupling`, contact index below the 0.45 scan threshold) or lesson 5 cutaway `gap` step                                                                            | Model-derived render              | Lesson 4 and 5 text; `MODEL_STEPS.contact`                                                                                        |
| B2    | Reflector shadow (compare with B1)   | Lesson 5 cutaway `shadow` step — **echo schematic only**; the 3D panel renders reflector ≡ direct (Prompt 04 measurement)                                                                       | Model-derived schematic           | Lesson 5 paragraph 2                                                                                                              |
| B3    | Washed-out gain                      | Recorded `Depth4_Gain_8`, `Depth4.mp4` 14–16 s (the lesson-7 start clip)                                                                                                                        | Recorded clip, provenance UNKNOWN | Lesson 7 worked example ("A stable recording looks washed out at a high gain level") — authored claim, not independently verified |
| B4    | Field too shallow for the far margin | **ASSET REQUIRED — owner confirmation.** Candidate: a `Depth2` or `Depth3` gain-4 window. Whether the target's far margin actually leaves the image in either clip has **not** been established | Recorded clip                     | Lesson 6 describes the concept; no item asserts it of a specific clip                                                             |
| B5    | Shaft visible, tip lost              | Lesson 21 needle model after `lost-tip-stop` (plane changed)                                                                                                                                    | Model-derived                     | Lesson 21 text; `MODEL_STEPS.needle`                                                                                              |
| B6    | Colour display during Doppler        | **Excluded until decision G1** (the only recorded Doppler segment is the one under review)                                                                                                      | —                                 | —                                                                                                                                 |

- **Proposed frames/panels:** one panel at a time in a fixed order; B1 and B2 shown together as a
  pair (the L5-6 two-image discrimination); B3–B5 single panels. Each labelled "Teaching example — not
  your acquisition".
- **Annotations:** none on recorded frames (no expert annotation exists). Model panels may name model
  structures by id.
- **Interaction:** pick the failure, then the first correction (the existing lesson-24 matching pairs:
  re-establish coupling / adjust depth / stop and recover the tip / reassess targeting). Explanation
  available before answering. No score, no attempt record.
- **Feedback:** lesson 24 paragraphs 1–2 and the four existing matching pairs; lesson 4 ("Gain
  amplifies received echoes; it cannot replace missing contact"); lesson 21 ("Frozen images and missing
  contact cannot provide current tip guidance").
- **Separate example state:** the panels are fixed presets or fixed recorded segments loaded into an
  example state that never writes to the learner's lab observation, held evidence or examination
  draft (the same separation Prompt 01 made for demonstrations).
- **Limitations:** model panels are simulated; recorded panels are from one teaching library with
  unknown acquisition source and are not same-case with the model; one control varies per clip.
- **Missing evidence:** B4 confirmation; recording provenance, de-identification and rights for B3/B4
  (G1); an expert check that B3 is a fair "washed-out" example.
- **Clinical review required:** yes — image interpretation of B3/B4 (EBUS faculty).
- **Media/rights review required:** yes for B3/B4.

A text-only case can stay text-only. CS-1 asked for an image in every integrated case; this
storyboard proposes images only where the picture is the decision (`assessment-image` q1–q2 could
point at B1 and B4). The other seven integrated cases are management/record decisions and are
**RETAIN CURRENT BEHAVIOR** unless the owner decides otherwise.

## C. Consolidation map — depth, gain/contrast, Doppler (and the capture lesson that shares the workbench)

**Documentation only. Nothing is merged, renumbered or re-keyed.** This expands Prompt 04's
proposal (Q13, `EBUS-PRE-REVIEW-04-handoff.md`, "Proposal: integrated knobology workbench map") into
the inventory the owner needs to decide. Source IDs: L12-7/L13-5 (Prompt-04 Q13), 04 §D, L6-3, L6-5,
L7-2, L8-1/2/3, L10-1/3/4, L24-3.

### C.1 What exists today (runtime at `85acc113`)

| Lesson (n · id)     | Deep link                                | Activities (`<lesson>:<spec>`) in order                                                                                     | Recorded task id (`lab.goal` → `RecordedFrameSource.taskId`) | Genuine acquisition criterion (`labGoalMet`, `content/types.ts:310`)                                                                     | Checks (ids)                                                                 | What it teaches                                                                 |
| ------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 6 · `image-depth`   | `/ebus-guided/learn?section=image-depth` | `depth-example` → `field-decision` → `depth-comparison` (acquire) → `review-acquisition` (held) → `apply-another-situation` | `depth`                                                      | depth 30–45 mm **and** depth moved last                                                                                                  | `depth-predict`, `depth-observe-v2` (retained-acquisition), `depth-transfer` | Field selection: include the target and what lies beyond it                     |
| 7 · `gain-contrast` | `…?section=gain-contrast`                | `detail-example` → `brightness-decision` → `detail-comparison` (acquire) → `review-acquisition` → `apply-another-situation` | `gain`                                                       | gain 35–65 **and** contrast used **and** gain moved last (the clip on screen must be a gain example — a real lookup property, Prompt 02) | `gain-predict`, `gain-observe-v2`, `gain-transfer`                           | Amplification versus tissue change; contrast can erase intermediate detail      |
| 8 · `doppler`       | `…?section=doppler`                      | `flow-example` → `path-assessment` → `flow-comparison` (acquire) → `review-acquisition` → `apply-another-situation`         | `doppler`                                                    | Doppler on                                                                                                                               | `doppler-predict`, `doppler-observe-v2`, `doppler-transfer`                  | Colour shows detected flow; absent colour is not clearance                      |
| 10 · `capture`      | `…?section=capture`                      | `capture-context` → `plane-decision` → `capture-frame` (acquire) → `review-acquisition` → `apply-another-situation`         | `capture`                                                    | frozen **and** measured **and** saved                                                                                                    | `capture-predict`, `capture-observe-v2`, `capture-transfer`                  | A saved frame is documentation; calipers are pixels, not calibrated millimetres |

Shared by all four: one embedded workbench (`EBUS-course/apps/web/src/guided/GuidedKnobology.tsx`),
one recording library (`knobology_lookup.json`; clip inventory in the decision packet §7 and the
manifest), one acquisition contract (`src/lib/ebus-recorded-contract.ts`), the host's
`Workbench.tsx` passing `recordedTask: lab.goal` (`Workbench.tsx:59`). The same four lessons also open
as **Practice labs** (`PracticePage.tsx`, location kind `practice-lab`, same lesson ids).

**Progress semantics that a merge would have to keep.** The self-paced record
(`ip-ebus-guided-self-paced-v1`, `engine/selfPacedProgress.ts:23`) stores only lesson ids — visited,
reviewed, review-later — plus `lastLocation` (`lesson` / `practice-lab` / `practice-case` /
`integrated-case`). Unknown ids are dropped at read time without rewriting stored bytes
(`selfPacedProgress.ts:81-87`). Held evidence is **session-only**: a reload returns the lesson to its
briefing with nothing held (Prompt 02 contract; confirmed again by Prompt 04). The legacy record
`ip-ebus-guided-v1` (`engine/progress.ts:24`) is read-only and keys observations by
`<taskId>:v<taskVersion>`.

Also teaching the same controls elsewhere (not part of the four-lesson workbench): lesson 4
`acoustic-contact` (model coupling, `goal: coupling`), lesson 24 `difficult-acquisition` (text
matching of the same failures, L24-3), integrated case `assessment-image` (text), and the Practice
list.

### C.2 Repetition versus intended retrieval

| Pattern                                            | Where                                                                                                     | Classification                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Contact before gain"                              | lesson 4 check, lesson 7 transfer (`gain-transfer`), lesson 24 matching row 1, case `assessment-image` q1 | Intentional spaced retrieval across chapters — keep; the owner may vary surface features (R-class "same vignette")                                |
| "Depth reveals the far margin"                     | lesson 6 predict + transfer, lesson 24 predict + matching row 2, case `assessment-image` q2               | Partly repetitive: lesson 24's predict (`difficulty-predict`) is the lesson-6 predict with a new frame; EBUS-01 ledger already proposed "combine" |
| "Absent colour is not clearance"                   | lesson 8 transfer, lesson 8 key point, case `assessment-image` q3                                         | The visible key point answers the transfer (L8-3); retained under the self-paced policy; retrieval in the case is intentional                     |
| Guided-acquisition instructions naming the setting | lessons 6 and 7 (L6-3, L7-2)                                                                              | Retained current behaviour (Prompt 04 P3: worked settings stay visible; the acquisition is labelled guided)                                       |

### C.3 A possible progressive workbench (owner option, not implemented)

One page, four stations in the current order — **Depth → Gain/contrast → Doppler → Capture** — using
the same workbench instance.

- **Stays required inside each station:** its own genuine acquisition criterion (unchanged
  `labGoalMet` branch), its own held evidence and `taskId`. Under the self-paced policy "required"
  means only that the Hold action still needs the real acquisition; no station gates the next one,
  and Continue without an image stays available.
- **Could become optional:** repeating the briefing text when arriving from the previous station;
  the per-lesson `*-predict` check where it restates the station's own briefing (owner call per item).
- **Stays separate:** lesson 4 (model coupling, different renderer); lesson 9 (analytic phantoms);
  lesson 24 (troubleshooting across chapters — see storyboard B); the Practice labs.
- **Deep links:** each `?section=` id keeps working by landing on its station; no id is renamed.
- **Progress:** the four lesson ids remain the stored unit; "reviewed" is still written per lesson id,
  so an existing record keeps its meaning. No schema change.
- **Evidence identity:** `RecordedFrameSource.taskId` stays `depth` / `gain` / `doppler` / `capture`,
  so a held frame from one station can never satisfy another station's criterion.

### C.4 Migration and compatibility risks

1. **Carrying control state between stations.** Today each lesson starts from its own
   `initialDepth`/`initialGain` (lesson 6: 8 cm, gain 43; lesson 7: 4 cm, gain 100; lessons 8 and 10:
   4 cm, gain 43 — `optimize.ts`). A shared page must
   either reset per station (keeps today's acquisition meaning) or carry state (changes what "moved
   last" means for the gain criterion). Carrying state is **not** recommended without a new review.
2. **Gain criterion and "last control moved".** The lookup varies one control per clip
   (`Depth4_Gain_3` says nothing about contrast); a station order that ends on contrast would silently
   make the gain criterion unreachable. The station must keep its own last-action rule.
3. **Deep links opened mid-page.** A link to `?section=doppler` must not mark depth or gain reviewed.
4. **Practice labs** list the four lessons separately; a merged page must not remove those entries or
   their `practice-lab` locations.
5. **Held evidence** is session-only today; a longer single page raises the chance that a reload
   discards more work. That is existing behaviour, not a reason to start persisting acquisitions
   (Prompt 02 explicitly did not authorize it).
6. **Legacy record keys** (`<taskId>:v<version>`) must remain readable; no task version may change
   as a side effect.
7. **Doppler station content** depends on decision G1 (what the Doppler recording is meant to teach).
   Consolidation should not proceed before G1.

### C.5 Preservation requirements if the owner chooses to proceed later

Unchanged: lesson ids, activity ids, question ids and keys, `labGoalMet` branches, `taskId` values,
the one-control-per-clip explanation, recorded-frame provenance lines, `KNOBOLOGY_VIDEO_IMAGE_REGION`,
whole-frame toggle, Practice-lab entries, `?section=` deep links, the self-paced and legacy storage
keys and their parsers. A runtime batch would need its own tests proving each of these.

**Owner decision:** keep four lessons (retain current) / progressive single page (later runtime
batch) / hold until G1 is decided. Status: NOT REVIEWED.

## D. Small field and copy proposals needing owner review

All DRAFT — NOT REVIEWED; none applied.

| #   | Source ID                           | Location                                      | Current                                                                                            | Proposed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Dependency                                                                                                                                                  |
| --- | ----------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | L26-4                               | `complete.ts:192`                             | "…the 2026 ERS/ESGE/ESTS guideline no longer recommends routine add-on mediastinoscopy."           | "…the 2026 ERS/ESGE/ESTS guideline recommends against routine add-on confirmatory mediastinoscopy; it may still be considered when the risk of a false-negative result is high."                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ers2026 PICO 4 (read 2026-09-23). Optional: the current sentence is a fair but softer paraphrase                                                            |
| D2  | registry                            | `sources.ts` `ers2026` title                  | "…clinical practice guideline: endosonography for diagnosis and staging of lung cancer (2026)"     | "ERS/ESGE/ESTS clinical practice guidelines on endobronchial and oesophageal endosonography for the diagnosis and staging of lung cancer (2026)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Title correction only                                                                                                                                       |
| D3  | registry                            | `sources.ts` `chest2024`                      | "(2024)"                                                                                           | "(2024 online; Chest 2025)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Year label only                                                                                                                                             |
| D4  | L3-15                               | lesson 3 paragraph                            | —                                                                                                  | "The ultrasound sector lies in a plane that contains the scope's long axis. In this model, image right is toward the patient's head; check the orientation convention of the processor you use."                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Model fact (`acoustic.ts:197-202`); the processor clause is deliberately unspecific — no device convention was verified                                     |
| D5  | L3-14                               | lesson 3 lab                                  | no 0° reference                                                                                    | "0° is the direction the assisted start faces the target; it is not an anatomical direction."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Model fact (`pose.ts:258-283`)                                                                                                                              |
| D6  | L3-7 / L11-6                        | lessons 3 and 11                              | —                                                                                                  | "In this model the target stays visible over a wide rotation range because the modeled node is large and close to the airway. Do not read the range as the rotation a real node tolerates."                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Observed model behaviour; owner/faculty wording decision                                                                                                    |
| D7  | L25-3                               | lesson 25                                     | "initiate the team's airway and bleeding response"                                                 | append: "The specific response follows your institution's protocol and is practiced in hands-on training."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | No local protocol supplied                                                                                                                                  |
| D8  | NAV-3 Q4                            | `glossary.ts`                                 | terms left undefined                                                                               | TNM — tumor, node, metastasis classification; IASLC — International Association for the Study of Lung Cancer; NSCLC — non-small cell lung cancer; PET — positron emission tomography; FNA — fine-needle aspiration; ERS/ESGE/ESTS — European Respiratory Society / European Society of Gastrointestinal Endoscopy / European Society of Thoracic Surgeons; CHEST — the American College of Chest Physicians and its guideline series; IFU — instructions for use (manufacturer document); central hilar structure — definition to be sourced (ICS/IAB 2023 Table 5 describes a linear, flat, hyperechoic central area; Fujiwara 2010 full text not read) | Requires relaxing the Prompt-04 rule that glossary definitions quote course sentences only                                                                  |
| D9  | L20-2                               | lesson 20 sequence explanation                | "Reconsider the order." (feedback)                                                                 | Option A: add "The target and path are confirmed before the needle is prepared for this pass, so a lost target never meets an exposed needle."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Faculty must confirm the dependency the course intends; option B (accept both orders) changes an accepted sequence                                          |
| D10 | Owner decision 2026-09-24 (fasting) | lesson 2 (`prepare.ts:139`, `prepare.ts:219`) | "Review … fasting status …"; "Drug holds, fasting intervals, … must follow current local guidance" | "Patients should fast before EBUS. Follow the applicable anesthesia and local procedural policy for the required fasting interval."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Substance: OWNER DECISION (fasting required). Wording: DRAFT — NOT REVIEWED. Exact interval: LOCAL / ANESTHESIA POLICY REQUIRED. Not implemented in this PR |

Provisional-staging and report-field proposals are in the decision packet §5.
