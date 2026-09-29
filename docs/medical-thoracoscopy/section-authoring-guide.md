# Medical Thoracoscopy — section authoring guide

For whoever writes one Learn section, person or agent. Read the
[learning contract](learning-contract.md), the [fidelity contract](fidelity-contract.md) and the
[module plan](module-plan.md) first.

A section is data: one file in `content/sections/`, in the shape `content/types.ts` gives, checked
by `content/sectionValidation.ts` when it is imported. The rules below are the reasons for those
fields; the validator enforces the ones a program can check.

## Before writing

1. Find the section's row in the module plan's ladder. It names the one new concept, what the
   section rests on and what uses it later.
2. If the section needs a concept that no earlier section teaches, stop and fix the ladder. Do not
   teach two concepts to get round it.
3. List the claims the section will make. Each needs a category and a source before it is written
   (see the fidelity contract). A claim with no source is not written as fact.

## What a section contains

| Part                         | Rule                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Objective                    | What the learner will be able to explain. One sentence                                                        |
| Suggested background         | Earlier sections that help. A suggestion, never a lock                                                        |
| Position on the spine        | Which phase of the procedure this is                                                                          |
| The one new concept          | Exactly one, stated as a count: "the survey, plus one tool"                                                   |
| Clinical question            | The decision this section helps the learner make                                                              |
| A concrete picture first     | An analogy or image, then the precise statement, then a checklist of four items or fewer, then an application |
| Worked example               | Shown in full. It is a valid alternative to a question                                                        |
| Optional activity            | Can be explained before answering, tried again, or left                                                       |
| Transfer example             | A different situation that tests the same principle. Not the same stem with the nouns changed                 |
| Harmful reflex               | The tempting wrong move, with an immediate explanation of the risk                                            |
| What the model leaves out    | Stated in the section, in the learner's words                                                                 |
| Signals and their provenance | Each labelled measured, derived or authored                                                                   |
| Claim references             | One per claim, by claim ID                                                                                    |
| Used again by                | The forward link that justifies the section's place                                                           |

Misconceptions are recorded when they are real and documented. There is no quota.

## Questions

A question is kept only for a named teaching purpose. For each one record: keep, rewrite,
replace, combine or remove, and why.

- The explanation is available before any answer.
- A wrong answer gets specific feedback. It never blocks Continue.
- Correct options are not always in the same position.
- A title, objective, step label or status line never gives the answer away. An optional
  prediction may hold back its own interpretation until the learner asks. It may not hold back
  foundational teaching.
- Nothing is counted, scored or stored.

## Numbers

- Teach direction, pattern and change from the patient's own baseline.
- A numeric threshold, target or cutoff appears only with a source and a note that institutions
  differ. Never invent one to make a sentence sound authoritative.
- Device dimensions carry their source document and revision. Where manufacturer documents
  disagree, the section uses the modelled value and says it is unresolved.
- Trial results are given with their population and endpoint. A comparison that was not
  significant is not described as showing equivalence.
- Section minutes are authoring estimates until piloted.

## Procedural steps that carry risk

Sedation, local anaesthetic dosing, energy settings, talc dose, suction settings, drain management
and reprocessing are taught as principle, followed by "per the current instructions for use and
your local protocol". Never as an invented universal sequence or number.

A port site or biopsy region is a reviewed teaching example. It is never described as universally
safe.

## Words

Write plain clinical prose for physicians beginning thoracoscopy. Clinical term first.

| Do                                                                              | Do not                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Name the surface an instruction means: which pane, which heading, which control | Say "above", "below" or "the panel"                          |
| Use one term for one thing on every surface                                     | Alternate between synonyms                                   |
| Say "model-estimated visible regions"                                           | Say "coverage" as if it measured an examination              |
| Say "Cases" for `/assess`                                                       | Say "assessment", "test" or "quiz"                           |
| Say what the learner sees                                                       | Use developer language: state, engine, payload, render, node |
| Give each control the name printed on it                                        | Refer to a control by its function only                      |

The repository's learner-copy check refuses grading language and software-internal words. It also
trips on clinical words that look like grading: "points", "graded", "pass", "test", "route" and
the percent sign. Reword first. Ask for a named exemption only when no rewording exists, as with
"graded talc".

## The sponsor

- Describe the device. Do not praise it. No superlatives and no unsourced comparisons.
- Device facts come from manufacturer documents, with revision. The manufacturer's fact-check
  covers device facts, market availability and trademarks, and nothing else.
- One short, sourced, neutral note that rigid and semi-rigid instruments are both in use.
- No competitor imagery. No manufacturer logo or wordmark.
- Every device model is labelled "Educational rendering from published dimensions" until it is
  built from manufacturer CAD.

## Before handing a section over

Run the review as a separate pass, looking for one failure at a time:

1. **Causal contradiction.** Does any text say one thing while the simulation does another?
2. **Answer leakage.** Read every title, label and status line as a learner who has not answered.
3. **Unsafe path rewarded.** Can the learner reach a good-looking result by a route the text
   calls unsafe?
4. **Order.** Is every term used after the section that introduces it?
5. **Terms.** One name per thing, matching the controls and the panes.
6. **Density.** Could a paragraph be a table, or a table a sentence?

Then queue every claim NOT REVIEWED. A section is not reviewed because it passes its checks.
