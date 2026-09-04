# R4 — the learner-facing vocabulary table

The words this module says to a learner, and the words it says only to itself. Produced by a
six-agent language audit of every learner-facing string in `src/features/cardiohelp-ecmo` on
2026-09-04, reviewed by a completeness pass that overruled eleven of its proposals, and applied in
one commit across 40 files.

Why this file exists: the module was rebuilt against an educational framework, and the framework's
own nouns leaked into the text. An owner review of the first foundation section found the effect
plainly. "Apply the ledger to a different failing term" is not a sentence a fellow reads and acts
on; it is the design document speaking. The substitutions below carry no clinical claim either way.
Every one of them says the same thing in the words a bedside clinician would use.

## The table

| Concept                                                | Say                                                                   | Never say                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The two multiplicative parts of oxygen delivery        | component of oxygen delivery; oxygen content; blood flow              | term, the delivery ledger, the delivery equation, a step of delivery |
| Oxygen consumption, in relation to delivery            | the other side of the balance; the demand side                        | the other side of the ledger, a third term, part of oxygen delivery  |
| A component or function that has stopped working       | impaired; has been lost; spent; deteriorating                         | has given way, failing, failed                                       |
| A thing on the console or blender the learner can move | control for the thing; setting for its value                          | knob, lever, dose knob, the knob strip                               |
| The four pump and pressure patterns                    | pressure pattern; the four patterns                                   | grammar, grammar row, the diagnostic grammar                         |
| The capstone table of explanations against findings    | the comparison table; what each explanation predicts                  | hypothesis matrix, the matrix                                        |
| The four things read at startup                        | enumerate them; "four sources of information" where a count is needed | information domains, four domains, multi-domain                      |
| The three things reassessed after an action            | the device, the circuit and the patient                               | three domains, in each domain                                        |
| The last step of a lesson, and the case it uses        | carry the reasoning to a new circuit; the new case; the new patient   | the transfer item, the transfer patient, the transfer case           |
| The answer a learner enters                            | your prediction; commit (the verb the button uses)                    | the commitment, a partial commitment                                 |
| A deliberately small change the simulation allows      | small — the label already states the size                             | bounded, one bounded step, a bounded action                          |
| Where a fixed value in the simulation came from        | set for this simulation; this case sets                               | authored, injected, encoded, scenario-triggered                      |
| The path or response a case expects                    | the path this case teaches; expected in this case                     | the authored path, the authored response, authored expectation       |
| Less help in Practice or the challenge                 | starting fresh, with less prompting                                   | from a clean state with fewer cues, no scaffolding, cue              |
| The debrief's record of what the learner did           | the debrief; the record of this run                                   | reasoning trace                                                      |
| The module referring to itself                         | this module                                                           | this draft, the spine claim, the taught answer                       |
| The circuit currently loaded on screen                 | the circuit on screen; this circuit                                   | state on screen, this state, the modeled X, the runtime              |

Two things the table does **not** touch. Identifiers, attribute names, type names and code comments
keep the module's internal vocabulary, because that is what it is for: `EcmoKnobStrip`,
`data-grammar-row`, `activeFaults`, `'this-knob'` and the `localizationCards.ts` row ids are all
unchanged. And the word "modeled" stays wherever it marks simulated-versus-measured, which is a
model boundary rather than jargon.

## What the completeness pass overruled

Eleven of the audit's own proposals were rejected or amended, all for the same class of reason: a
plainer word that also changes a claim is not an improvement.

- **"It holds a physiologic variable"** was not to become "it holds oxygen delivery and carbon
  dioxide clearance". On VV support the circuit holds the oxygen-content component while cardiac
  output stays entirely the patient's, so support does not hold delivery. It reads "it holds that
  component", pointing back at the component the previous sentence named.
- **Consumption is never a component of oxygen delivery.** Two proposals would have made it one
  while removing the ledger metaphor. Consumption sits on the other side of the balance.
- **"The sources for this drill place the dominant control on the gas side"** was not to become
  "the published guidance places…". That drill's source set includes this module's own bounded
  educational model, so "published guidance" would imply a consensus literature the module has not
  cited. It reads "the sources cited here".
- **"Go to the next unmatched control"** was not to become "the next control not yet set". A
  control moved to a value that does not match the written order _is_ set, and unmatched. It reads
  "the next control that does not match the order".
- **"Half of this is the taught answer"** was not to become "half of this is right". The module is
  draft-gated and not clinically reviewed; that sentence is one of the places it was careful to
  hedge. It reads "half of this holds".
- **"No injected problem"** was not to become "no fault present". "Fault" is the engine's own enum
  name. It reads "no problem introduced".
- **"Not a pressure pattern in the grammar"** was not to become "not a pressure pattern used for
  localization", which asserts a purpose the original did not. It reads "not one of the four
  pressure patterns", matching the card's own heading.
- **"That is remediation of the plan you committed"** was not to become "a recovery from the plan
  you committed", which inverts the sentence. It reads "a correction after the plan you committed".

## Coupled contracts moved in the same commit

Nine test pins read a literal that the table changes. Each was moved with the copy, never softened:

| Contract                                                                     | Was                                                        | Is                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `resumption-copy-contract` — the resumption abstraction, named in four files | "This bounded simulation action stands in for…"            | "This single simulated action stands in for…"                                      |
| `resumption-copy-contract` — the bedside control's own hedge                 | `/bounded simulation abstraction/i`                        | `/deliberate simplification\. It stands in for the device- and program-specific/i` |
| `cross-surface-consistency` — the outside-pattern note, two capstones        | "Not a pressure pattern in the grammar."                   | "Not one of the four pressure patterns."                                           |
| `drill-specs` — the find-the-cause verdict                                   | `/No knob answers/`                                        | `/No setting answers/`                                                             |
| `drillSpecs.ts` import-time validator, three clause patterns                 | "this is the knob" / "not this knob"                       | "this is the setting" / "not this setting"                                         |
| `localization-card` — the clean-circuit sentence                             | `/no injected problem/i`                                   | `/no problem introduced/i`                                                         |
| `components` — the startup lesson title                                      | "Start with four information domains"                      | "Start with four sources of information"                                           |
| `components` — the safety-interruption restart                               | `/Restart from the clean case/i`                           | `/Restart this case from the beginning/i`                                          |
| `learn-walkthrough` — the simulator-task status                              | "completes when the simulator reaches the requested state" | "is done once the simulator reaches the state you were asked for"                  |
| `vv-foundation-lessons` — the recirculation-share boundary                   | `/the case authors where this starts/i`                    | `/each case sets where this starts/i`                                              |

One replacement tripped a rule rather than a pin: "the patient's values change only as time passes"
matched the substring ban on `pass`, which is grading vocabulary. It reads "as the case moves
forward in time".

## Left for an owner decision

- **The fourteen Practice case titles in `src/features/critical-care/content/activities.ts` are
  diagnosis names** — "Occult hemorrhage with drainage insufficiency", "Oxygenator thrombosis with
  worsening gas transfer". The ECMO module's own surfaces render `presentationTitle()` instead, so
  the leak is confined to the shared critical-care catalog and pathway pages. Renaming them touches
  a registry three other labs read, and is not in this round.
- **`sectionSpecs.ts` no longer carries the approved ladder's wording verbatim** for three
  objectives and one concept. The file header records the departure and points here. The
  discriminations themselves are unchanged.
