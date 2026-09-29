# Handoff — MT-03a survey specs

| Field               | Value                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 6 of the first build round; work package MT-03                                                                               |
| Branch              | `claude/mt-03a-survey-specs`                                                                                                 |
| Base                | `origin/main` `756c9aee7d7119f3817b5d85aaf73f9efa573418`                                                                     |
| Prerequisite slices | `claude/mt-01c-curriculum-hub` at `8e0bbfa5` (which carries slices A, B and 1 to 4), merged as the first commit (`5f17b415`) |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-03a-survey-specs.md`        |
| Owner decision      | OD-08; the approved first-round plan, sections 4.1, 4.2 and 5 (row 6)                                                        |
| Date                | 2026-09-28                                                                                                                   |

## Why

The first three sections the course will open are 6 (a normal hemithorax from inside), 7 (the four
controls) and 11 (a survey in order). Their lesson and 3D scene come later in the round; this
slice writes what they teach, as data a program can check, with every statement tied to a claim
and every claim to a source it has actually been read in.

## What changed

| Path                                                                                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/medical-thoracoscopy/content/types.ts`                                                                 | New. The section spec: objective, background, the one concept and its increment, the clinical question, analogy, precise statement, a checklist of four or fewer and an application, blocks placed before or after the question, a worked example, the section's activity, an optional question (a prediction or a retrieval), a transfer, the harmful reflex, misconceptions, what the model leaves out, signals with their provenance, and what uses the section again                                                                                                                       |
| `src/features/medical-thoracoscopy/content/sectionValidation.ts`                                                     | New. Every rule a program can check: copy gate, one-sentence objective, the increment as a count, checklist length, background earlier and reuse later, three or four choices with one best, answer phrases kept out of the title, objective, clinical question, prompt, stem and (for a prediction) the blocks before it, a harmful reflex that says what is not modeled, signal labels from the fidelity contract, the survey in the zone order, and the claim register and the section agreeing both ways. Across sections: unique question ids and the best choice not always in one place |
| `src/features/medical-thoracoscopy/content/sections/{normal-pleural-space,four-controls,systematic-survey,index}.ts` | New. The three sections, checked as the index loads; the index also refuses a spec the curriculum does not mark written, and a written section without a spec                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/features/medical-thoracoscopy/content/data/pleural-zones.json`, `pleuralZones.ts`                               | New. The survey zones: seven regions of the right parietal pleura in survey order, each with where it is, its boundary in words for the anatomy slice, and why it comes where it does. Labelled an authored construct                                                                                                                                                                                                                                                                                                                                                                          |
| `src/features/medical-thoracoscopy/content/{controlPanel,landmarks,modelBoundaries,teachingExamples}.ts`             | New. The four controls of the model and what the team manages; the landmarks that name each region and where the model gets them; the model boundaries by name; the one teaching example, "The space, ready to look"                                                                                                                                                                                                                                                                                                                                                                           |
| `src/features/medical-thoracoscopy/content/curriculum.ts`                                                            | Sections 6, 7 and 11 are `written`: not links, not recordable, not yet open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/features/medical-thoracoscopy/components/hub/LearnLanding.tsx`                                                  | Asked for a section that is not open, Learn now says "This section is in preparation", which is true of a written section too                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/features/medical-thoracoscopy/content/data/claim-register.json`                                                 | Claims MT-C-0004 to MT-C-0023 added; MT-C-0001 given sources (revision 2); the first three claims list the written sections                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/features/medical-thoracoscopy/content/{data/sources.json,sources.ts}`                                           | Six sources added; the BTS 2023 statement now read in part, with the parts named in a new `readParts` field                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/features/medical-thoracoscopy/test-support/renderRegisters.ts`                                                  | Prints the parts of a source read in part, and a claim's note on its sources beside the sources                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `docs/medical-thoracoscopy/registers/{claim-review-queue.md,source-register.md,traceability.json}`                   | Printed again; traceability rows for the three sections now `written`, with content, claims and tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/medical-thoracoscopy/{README,section-authoring-guide,owner-decisions,module-plan}.md`                          | Where written sections live; open items T11 to T13; section 6 now rests on 3 and 5 in the ladder                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/features/medical-thoracoscopy/__tests__/{sectionSpecs,surveyContent}.test.ts`                                   | New. `curriculum.test.ts` and `registers.test.ts` updated where they pinned the state before this slice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Not changed: the shared lesson stage and frame, the progress record, navigation, and the device
definitions.

## Claims and assets touched

- **Added**: MT-C-0004 to MT-C-0023: 13 clinical evidence, 6 authored simulation assumptions, 1
  derived measurement. Every decision is NOT REVIEWED and every claim blocks publication.
- **Changed**: MT-C-0001 to revision 2 (three sources describing air replacing the fluid and the
  lung coming away); MT-C-0001 to MT-C-0003 now list the three written sections.
- **Assets**: none.

## Sources

| Source                                             | Read                                                                                                              | Used for                                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| BTS clinical statement on pleural procedures, 2023 | The medical thoracoscopy section, the image-guided biopsy practice points and appendix 4, in the online-first PDF | Ribs seen through normal pleura; parietal biopsy; semi-rigid reach; adhesions hiding the back wall                                        |
| Jin et al., Chinese expert consensus, 2020         | Full text                                                                                                         | Diaphragm by its movement; apex; fissures; normal lung; biopsy sites; lung laceration                                                     |
| NCCP-ICS consensus guideline, 2024                 | Full text                                                                                                         | The whole space inspected, with no standard order; first look at the diaphragm; a second port for a rigid telescope; lung injury at entry |
| Bhatnagar et al., Eur Respir Rev 2016              | Full text                                                                                                         | Normal pleura; the space not clear without the gutter and recesses; biopsies after a complete inspection                                  |
| Li et al., Healthcare 2022                         | Full text                                                                                                         | The lung coming away as air enters                                                                                                        |
| Charalampidis et al., J Thorac Dis 2015            | Full text                                                                                                         | The heart in the mediastinum behind the pleura. A general anatomy review with many errors of wording                                      |
| Gallagher et al., Endoscopy 1998                   | Abstract                                                                                                          | The fulcrum effect, in a laparoscopic trainer                                                                                             |

No thoracoscopy source read for the course describes the pivot (the tip moving opposite to the
hand), rolling the telescope, how the heart shows through the mediastinal pleura, or how findings
are recorded. Those are authored, labelled as such, or left out.

## The review pass

After the sections were written, a separate reviewer read them against the authoring guide, the
learning and fidelity contracts and the review rubric, and reported 34 findings: one P0, seven
P1, sixteen P2 and ten P3. Every finding inside this slice was acted on before the commit. The
ones that changed the design:

| Finding                                                                                                                                                   | What changed                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0: the Chest view could show every region as seen after a quick sweep, the very glimpse section 11 warns against                                         | The learner keeps their own note, in words and not stored, and compares it with the Chest view's estimate. The estimate's rule is written down in MT-C-0020 as a default (T12), and the lesson says the model cannot tell a glimpse from a careful look      |
| Roll was said to turn the picture because the telescope looks straight ahead                                                                              | Split: the line of sight stays because the view is straight ahead; the picture turns because the camera is fixed to the eyepiece in this model (T4). Also on the Roll control                                                                                |
| The diaphragm and the heart were taught by movement the model does not have                                                                               | New boundary: nothing in the model moves with breathing or the heartbeat (T13). The diaphragm is taught by its place toward the feet, with its movement as the cue in a patient                                                                              |
| Three chest-wall regions had no landmark of their own, and section 6 used roll and the pivot before section 7                                             | They are told apart by where they lie, which is the course's own division. Section 6's tour is fully guided, uses no control, and says only that the top of the screen is not a fixed direction. Section 6 now rests on section 3 as well, for the telescope |
| Worked examples promised what the unbuilt scene would show                                                                                                | Written as aims and reasoning. Where a region can be reached from the prototype port is for the port record and the engine to establish                                                                                                                      |
| The prediction's answer sat in fields nothing held back                                                                                                   | The types now say when each field appears relative to a question; the validator counts the teaching example and the signal labels as seen before a prediction; tour notes and "what changed" are after or author-only                                        |
| Two transfers were the same situation again, one question repeated its worked example, and one key said more than its stem                                | Replaced: the apex seen at the bottom of a turned picture; the reversal with the picture upside down; which reason applies to the wall around the port; a report sentence built from a stem that gives every fact the key uses                               |
| Statements stretched past their sources ("not from the lung", "firm bands", "sees least well", "no standard order" as a general rule, Gallagher's result) | Reworded to what the sources support. A new authored claim, MT-C-0023, carries the straight-viewing telescope's blind area around its own port                                                                                                               |
| Terms: four names for the costophrenic recess, "straight" for two properties, up and down in a patient on their side, links to sections by descriptions   | One name each; head, feet, front, back, spine and sternum only; forward links use printed section titles, and the validator refuses a title that does not exist                                                                                              |

Not changed, and why: the survey order itself stays (the section's concept is keeping to one
order; the NCCP-ICS guideline lays down none, and the course says so), and the word "scope" in
the names of the Scope view and the control "Where the scope looks" stays under T8.

## Checks run

| Command                                                                                                                                 | Result                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npx jest src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy" --runInBand`                                        | 13 suites, 199 tests, all passing                      |
| The same suites before the review changes                                                                                               | 12 module suites, 186 tests, all passing               |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`                                                                          | Clean                                                  |
| `npx eslint src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy" scripts/medical-thoracoscopy/render-registers.ts` | Clean                                                  |
| `npx tsx scripts/medical-thoracoscopy/render-registers.ts --check`                                                                      | The three printed register pages match their registers |
| `npx prettier --check docs/medical-thoracoscopy src/features/medical-thoracoscopy`; `git diff --check`                                  | Clean                                                  |

The section validator is itself tested: each rule is broken on purpose in `sectionSpecs.test.ts`
and must be refused (checklist length, two best choices, an answer in the stem or in a block
placed before a prediction, background from a later section, an unknown or uncited claim, a
harmful reflex that does not say what is not modeled, the survey out of order, grading words and
digits in headings, an authored label on a derived signal, the best answer always in one place, a
control used before it is taught, and a link to a section title that does not exist).

## Real browser observations

Opened in the Browser pane on this worktree's dev server (`claude-thoracoscopy`, port 3134):
`/en/medical-thoracoscopy/learn?section=four-controls` shows "Section 7 of 19 · Access and
orientation · about 7 min", the title, and "This section is in preparation. It is not open yet,
and nothing is recorded for it." None of the 19 outline entries is a link; sections 6, 7 and 11
show as in preparation; nothing was written to storage. The written sections have no lesson yet,
so there is nothing else of them to see.

## Checks not run

- **The lesson and the scene.** Nothing in these sections can be driven yet; the review could not
  check the text against a running simulation, only against the claims.
- **Clinical review.** Every claim is queued NOT REVIEWED.
- **The full suite, Storybook and the production build.** The next integration point is slice 14.

## Unresolved decisions

- **T11 (new)**: how a written section's clinical statements appear before review. The claim
  register refuses to show clinical evidence as settled fact before a reviewer accepts it; the
  default the lesson will build is a notice on each written section that it has not been
  clinically reviewed, in the unlisted preview only.
- **T12 (new)**: what counts as a region seen. Default: every sample point on the region at some
  moment in view, in range, facing the telescope and unobstructed; no hold time.
- **T13 (new)**: breathing and heartbeat motion. Default: not modeled, and said so.
- **T6, with a new observation**: the prototype port, the right 7th intercostal space on the
  mid-axillary line, lies below the usual lower edge of the safe triangle. The NCCP-ICS guideline
  names the 6th to 7th space on the mid-axillary line for undiagnosed effusions where ultrasound is
  not available. The teaching example now calls it a site chosen for this model and not a
  recommended one. Whether the apex and the diaphragm can be reached from it is for the port record
  (slice 7) and the engine (slice 10).
- **T5, a condition the lesson must meet**: the labelled tip-referenced steering assist must be off
  during section 7's prediction and pivot activity, or it answers the question for the learner.
- **T8**: "scope" in the Scope view and in "Where the scope looks", "telescope" everywhere else.
- **I4, gaps in the sources**: no source read for the course describes a landmark of its own for
  the front, side or back of the chest wall, how the heart shows through the mediastinal pleura,
  or what the ribs look like through normal pleura. The text says only what the sources support.
- T2 and T4, which these sections are written to.
- Whether a survey order should be taught at all, given that the NCCP-ICS guideline recommends
  none: the course keeps one, labelled as its own, because the section's concept is keeping to one.

## What must not happen next

- Do not record a review decision, or describe a written section as reviewed.
- Do not show a written section to learners before the lesson host exists and the curriculum marks
  it available.
- Do not change a zone id or a claim id; the anatomy slice and the survey ledger will read them.

This does not change publication status or constitute clinical approval.
