# Bronchoscopy Foundations: section authoring guide

This guide is for whoever rewrites one Learn section of `/bronchoscopy-foundations`, a person or an
agent. It replaces the first guide (in Git history before 2026-10-08), whose rules produced a course
that was long, withheld numbers and deferred instead of teaching.

The course teaches a first-year fellow what to know and do before and during their first supervised
bronchoscopies. Write for a tired fellow on a phone.

## What you write

One file: `src/features/bronchoscopy-foundations/content/sections/<section-id>.ts`, exporting
`section: BronchSectionDefinition` with `authoringContract: 2`, plus the section's entry in
`content/courseFlow.ts`. The contract is `content/types.ts`.

Read the old section in full before you start. Mine its rationales and its common-errors card. Do
not keep its prose.

Check your work until it prints ✓ and the numbers under it are inside the caps:

```bash
npx tsx scripts/bronchoscopy-foundations/check-section.ts <section-id>
```

Do not edit the scope engine, the 3D assets, `learning-module/`, or another section. If one of them
is wrong, stop and say so.

## The ten rules

Each rule is a check in `content/authoringRules.ts`. A rewritten section that breaks one does not
build.

1. **Voice.** Second person, active, imperative. Sentences average 20 words or fewer; none is over 30. A paragraph has at most three sentences.
2. **Length and time.**
   - At most 1,000 teaching words in a section and 120 on a screen.
   - A question's stem and case together are 60 words or fewer. An option is 20 or fewer, a
     rationale 35, an explanation 60.
   - `minutes` is at least the reading time at 200 words a minute plus `activityMinutes`, the
     measured time of the activities.
3. **Numbers come from the register.** Write `${num('platelets-biopsy')}`, never the digits. The
   card then names its sources in one line and says "Check your local protocol" once.
   - A number that is not in `content/numbers.ts`: add its row as `to-extract` and stop. Never type
     a value from memory.
   - A case states its own values (age, weight, vitals, labs) in its `situation` and its monitor
     readings. Those are written for the case and need no register row.
   - Digits that are names are allowed: RB1, LB1+2, 6 o'clock, grade 2.
4. **First moves, not deferral.** Every complication gets a first-move card (`role: 'first-moves'`):
   `steps` in the order you make them, and `callForHelp`. Calling the attending is one step, never
   the whole answer, and never the key to a question.
5. **No course-talk.** A lesson does not say "model boundary", "authored", "declared", "teaching
   profile", "this course does not" or "the lecture". The hub says once what an online course
   cannot establish. A simulator view carries one line under it (`view.boundary`). Disagreements
   between sources go in a register row's `note`, which the sources panel shows.
6. **Picture before words.** Teach anatomy, findings and accessory states on images, with the
   orientation stated. Anything you can see is assessed on an image.
7. **Hook, teach, do.** The section opens with its clinical question and its hook (`anchor`): an
   analogy of 35 words or fewer, one precise sentence, and a four-item checklist. The closing
   screen repeats the checklist.
8. **Check what was not just shown.** The prediction comes before the teaching that answers it.
   The check after the teaching uses new details, never the worked example's case.
9. **Assess the decision.**
   - The key is a concrete clinical action.
   - Distractors are real fellow errors. Include a "pause and…" answer that is wrong.
   - Flag a choice `unsafe` only when it is the section's harmful reflex. Name that reflex in
     `harmfulReflexPatterns`.
   - At most one question about documentation wording.
10. **Nomenclature.** RB1–RB10; LB1+2, LB3, LB4–LB6, LB7+8, LB9, LB10. The standard view is from
    the head of the bed with the membranous wall at 6 o'clock. Variants get one sentence.

## The shape of a rewritten section

The flow in `courseFlow.ts`, in order:

1. **Hook.** A `teach` screen with `anchor: true` and no cards.
2. **Prediction.** A `check`. It may not be answerable from the hook; `precommitDenyPatterns` holds
   the phrases that would give it away.
3. **Teaching screens.** `teach`, each with a picture and at most 120 words.
4. **Activities.** `practice` and `observe`.
5. **Check.** A `transfer` with new details.
6. **Close.** A `debrief` with `anchor: true`. It repeats the checklist.

A section states one or two `outcomes`. Each is assessed at least three times: by the activity, and
by the questions that list it in `outcomeIds`.

The fields the first contract required and a rewritten section leaves out: `recognizeTitle`, `why`,
`newConcept`, `incrementSentence`, `controlStrip`, `modelBoundary`, `physicalSkillNote` and `steps`.

## Numbers and the faculty gate

`content/numbers.ts` holds every clinical number once: its value, class, sources with their grade,
the date it was checked and by whom, and the faculty signature.

- `verified` means checked against the source text. `signed` means Russell Miller has approved it.
- The check script lists the rows a section uses and the ones still waiting for a signature.
- A published course may use only signed rows. `publishBlockers` enforces that when the release
  stage is `published`.
- Where guidelines differ, the row teaches one value and its `note` carries the other. The
  institution's own value, set in `INSTITUTION_VALUES`, replaces the guideline value everywhere.

Local policy works the same way. A card that depends on a policy lists it in `localPolicyIds`. The
learner sees the institution's wording only when `INSTITUTION_POLICIES` has it; otherwise the card
shows nothing extra.

## What the checks cannot judge

Clinical accuracy, whether a distractor is a real error, and whether the picture shows what the
words say. Those are yours first and the faculty reviewer's last. Report, with the section:

- its word counts and its computed and stated minutes, from the check script
- every register row it uses
- anything in the brief you could not do, and why

## Sections not yet rewritten

A section without `authoringContract: 2` still builds under the first contract. The same rules
measure it without failing it:

```bash
npx tsx scripts/bronchoscopy-foundations/check-section.ts --all --report
```

The last lines of that report are the course totals: words, minutes, questions that show an image,
and how often a test-wise reader finds the key without knowing the medicine.
