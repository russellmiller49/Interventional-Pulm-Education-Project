# Shared physician-language editorial standard

This is an authored editorial policy informed by the supplied examples and the successful peripheral-imaging revision. It is not a clinical practice guideline and is not a verbatim representation of a speaker's style.

## The voice to aim for

Write like an attending explaining an image, waveform, procedure, or bedside decision to a fellow. Name the anatomy, measurement, device, finding, and relevant uncertainty. Use short connected explanations instead of replacing medical concepts with generic words such as “signal,” “state,” “path,” “load,” or “support.” Those words remain appropriate when they are the actual clinical concept.

The goal is precision without formality for its own sake. “Reassess the needle position” is often better than “undertake an additional positional verification of the sampling component.” Conversely, “the thing moved” is not a useful simplification of “the catheter tip is displaced.”

Retain meaningful explanatory physics and physiology. Use clinical vocabulary to make the explanation more usable, not to compress it into unexplained jargon.

## Match the language to the surface

| Surface                         | Desired treatment                                                                    | Avoid                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Module title and navigation     | Recognizable clinical subject, reasonably short                                      | A clever nickname as the only label                           |
| Learning objective              | Observable clinical interpretation or skill already taught                           | Generic “understand the information”                          |
| Core teaching                   | Finding → explanation → significance, when those are supported                       | Unexplained abstraction or an invented protocol               |
| Mechanism drawer                | Precise physics/physiology with terms defined                                        | Deleting equations because a podcast used a mnemonic          |
| Control/readout                 | Actual variable, unit, and state: set, measured, calculated, estimated, or simulated | Renaming a control to imply it measures something it does not |
| Case before response            | Observable situation and available data                                              | Diagnosis/answer in the heading or tooltip                    |
| Case after response             | Explicit mechanism, diagnosis, and rationale as supported                            | Vague feedback such as “better information”                   |
| Bedside dialogue                | Natural, contextually unambiguous clinical shorthand                                 | Banter, disparagement, profanity, copied speaker mannerisms   |
| Glossary                        | Canonical term, accepted aliases, short source-supported definition                  | Acronym expansion guessed from a string match                 |
| Image description/accessibility | Accurate description at the same reveal stage as the visual                          | Hidden answer leaks or inferred image findings                |
| Source quotation/bibliography   | Preserve quotation and bibliographic fidelity                                        | Rewriting the source and leaving quotation marks around it    |

## A sentence-level semantic contract

Before rewriting a clinically meaningful statement, identify what is fixed:

**Who/what → observed data → interpretation → certainty → action → conditions → timing → endpoint.**

Not all sentences contain every element. Preserve the elements that exist. Examples of prohibited changes include turning a test finding into a definitive diagnosis, a response to an intervention into a reason to prescribe it, a local technique into the only acceptable technique, or an association into a causal claim.

Keep wording that distinguishes “set” from “measured” and “calculated” from “directly measured.” Do not choose a more specific noun unless the module identifies the referent. A panel labeled “pressure” might display airway pressure, circuit pressure, arterial pressure, or a relative simulation index. The editor must inspect the data binding.

Changes involving degree of stenosis, area versus diameter, absolute versus relative change, indexed versus unindexed flow, delivered versus prescribed dose, current versus prior imaging, or trial endpoint definitions require particular care. Treat unresolved distinctions as review questions, not permission to invent a correction.

## Clinical terms are not globally banned words

The imaging revision is a style precedent, not a global blacklist.

- **Sweep:** DTS acquisition in imaging, gas-side terminology in ECMO, or a verb in ultrasound acquisition. Determine the domain before editing.
- **Driving pressure:** retain the relevant procedure, variable, and units. Do not transfer a ventilation definition to a jet-ventilation control.
- **State:** valid when distinguishing acidemia/alkalemia from underlying processes; awkward when it replaces a specific finding without explanation.
- **Control variable, trigger, cycle:** legitimate ventilator terminology, not software leakage.
- **Compliance, resistance, pressure, flow:** indispensable physiologic terms; they are not vague merely because they also have engineering meanings.
- **Support, window, recruitment, capture, release, circuit:** preserve when the actual clinical or device meaning is established.
- **Benign:** do not replace everywhere with “nonmalignant.” The supplied pleural talk explains a preference in a specific setting; a benign histopathologic diagnosis or publication title is a different context.
- **Positive/negative:** state what test or observation is positive or negative when needed, but do not rewrite the result into an unsupported diagnosis.

A warning list can prompt review of phrases such as “map-relative hardware location” or “what the evidence buys you.” It must never automatically replace unrelated clinical uses of their component words.

## Abbreviations, spelling, and units

Use US English in newly authored copy. Expand an unfamiliar abbreviation at a sensible entry point; preserve familiar clinical abbreviations on compact controls when the module defines them. Keep official publication titles and verbatim quotations unchanged.

Do not conflate acronyms across domains: EBUS versus EUS-B, PPV as pulse pressure variation versus positive-pressure ventilation, or a ventilator FiO2 control versus an oxygen fraction on another device. The glossary should carry context, not a single universal expansion.

Preserve units and numerical meaning exactly. Unit styling can be normalized only when its meaning is unambiguous and tests/data binding remain valid. Do not “repair” missing units, implied denominators, threshold signs, or an implausible number during a language pass.

Retain patient sex, age, laterality, anatomy, and clinical facts. Use he/his or she/her when sex/gender is explicitly established; do not infer it from a name or stereotype. Do not add patient identifiers or copy identifying anecdotes into module cases.

## Analogies and mnemonics

Useful analogies can stay in a secondary explanatory role. Do not ban an analogy because it sounds conversational, and do not turn it into the formal vocabulary of the interface.

The supplied acid-base “state, process, story” framework is a speaker-described approach, not an instruction to restructure every module. The ventilator bootcamp's machine analogy is not the term for a control variable. The hemodynamic “fill, flow, pressure” framing is not authorization to encode a mandatory order for fluids and vasopressors.

A diagram or mnemonic can simplify; a calculator must implement an explicitly supported model. Do not translate a metaphor into a new physiological equation or scoring rule.

## Examples of editorial transformations

These are authored illustrations, not quotations from the repository or transcript-derived treatment recommendations. Apply only when the facts are already present. For real, merged pairs from this repository, see `approved-examples.md`.

| Artificial or underspecified wording                      | Possible replacement                                             | Necessary context                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| “Select the information source that reduces uncertainty.” | “Which finding would clarify the catheter's position?”           | Catheter position is the stated question                                                       |
| “The pressure number is reassuring.”                      | “The measured blood pressure is within the stated target range.” | The target and measured source already exist; no claim about perfusion added                   |
| “The machine is doing the breath.”                        | “This is a ventilator-initiated breath.”                         | Trigger mechanism is established; this alone does not define every other breath characteristic |
| “Find the right lymph-node bucket.”                       | “Identify the lymph-node station.”                               | The assessment asks station identification                                                     |
| “The tissue looks positive.”                              | “The ultrasound appearance is suspicious.”                       | Existing source says suspicious morphology, not a positive tissue diagnosis                    |
| “The evidence remains old.”                               | “The target contour comes from the earlier acquisition.”         | An actual prior segmentation is being shown                                                    |
| “Dial up the support.”                                    | Name the specific existing control and action.                   | Otherwise leave as unresolved; do not guess which support                                      |

## What not to optimize for

Do not optimize solely for fewer words, fewer syllables, more formal nouns, a lower reading grade, stronger certainty, more imperatives, or universal terminology consistency. Consistency should preserve clinically important distinctions rather than erase them.

A successful edit enables a learner to describe the situation accurately to a colleague and understand the same underlying lesson. It does not merely make the prose sound more authoritative.
