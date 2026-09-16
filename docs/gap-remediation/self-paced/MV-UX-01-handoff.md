# MV-UX-01 — two learner-facing Mechanical Ventilation display defects

Owner prompt MV-UX-01, given in session on 2026-09-15 after MV-03 (PR #224) and MV-SAFETY-01
(PR #226) merged. Prepared by an AI authoring assistant (Claude) at the owner's request. **Nothing
here is clinical review.** No teaching claim, source classification, review status, physiology,
case parameter or stored-answer meaning was changed.

## Delivery and scope

- **Checkout and branch.** Worktree `…/Interventional-Pulm-Education-Worktrees/claude-mv-ux-01`,
  branch `claude/mv-ux-01`, cut from `origin/main` at `21fc130a` (merge of PR #227). The tree was
  clean, and MV-01, MV-02, MV-03 and MV-SAFETY-01 are all in the base.
- **Bounded.** Only the two defects named in the prompt. G02 was not started, no other MV slice was
  opened, and the MV-03 physiology/model hold was not revisited.
- **Runtime files changed.** Three, all under `src/features/mechanical-ventilation`.
- **Untouched.** `src/features/device-intelligence` was neither read nor changed. No shared
  `learning-module` or `critical-care` file was modified; the proof that neither defect is shared is
  in [Root cause](#root-cause) below. No dependency, backend, storage key, Supabase, upload,
  deployment or publication change; no URL was fetched.

## Defect 1 — malformed purpose line

### Reproduction on the base commit

Dev server on port 3123 at `21fc130a`, `/en/mechanical-ventilation/assess`. The line above the stem
read, verbatim:

> Apply what does this breath hold constant? to a short authored case.

Selecting "Did oxygenation improve at a cost?" gave the line the owner quoted:

> Apply did oxygenation improve at a cost? to a short authored case.

An enumeration of every item on the three saved entries (`learn?entry=placement`,
`learn?entry=review`, `/assess`) found **36 of the 46 unique items** taking this generic line, in
three malformed shapes:

| Shape              | Unit title                           | Rendered line                                                        |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------- |
| Question title     | `Did oxygenation improve at a cost?` | "Apply did oxygenation improve at a cost? to a short authored case." |
| Two-sentence title | `What you set. What you check.`      | "Apply what you set. what you check. to a short authored case."      |
| Imperative title   | `Read the whole breath in order`     | "Apply read the whole breath in order to a short authored case."     |

The six items MV-SAFETY-01 reported are the subset of those 36 that carry a safety note:
`oxygenation-response:check`, `oxygenation-response:final`,
`safety-reassessment-and-human-factors:check`, `…:placement`, `…:final`, and
`high-peak-pressure-integration:final`.

### Root cause

`MechanicalVentilationCourseCheck.tsx` composed the fallback purpose in the JSX:

```
purpose={teaching?.purpose ?? 'Apply ' + unit.title.toLowerCase() + ' to a short authored case.'}
```

The composition — not the content — is the defect. `ventilationLearningUnit.title` is a _display_
title written as a question, as a two-sentence label, or as an imperative; lower-casing it and
embedding it after "Apply " cannot yield a sentence for any of those three shapes. MV-03 items were
unaffected only because `questionTeaching.ts` supplies an authored `purpose` that wins the `??`.

### Repair

- `content/learningCurriculum.ts` gains `ventilationGenericQuestionPurpose(unit)`, which composes
  the line from the unit's authored `outcome` — already a purpose sentence in the same imperative
  voice as the MV-03 purposes — with only its closing period replaced:
  `` `${unit.outcome.replace(/\.$/, '')}, in a short authored case.` ``
- `MechanicalVentilationCourseCheck.tsx` calls that helper instead of building the string inline.

No authored text is re-cased, re-worded or re-keyed. **No clinical teaching content was edited**, so
the prompt's fallback ("if different items genuinely need distinct authored purpose text…") did not
apply: a single formatting repair fixed all 36.

### Before / after

| Item                                                                    | Before                                                               | After                                                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `oxygenation-response:check` / `:final`                                 | Apply did oxygenation improve at a cost? to a short authored case.   | Separate oxygen concentration from pressure support for oxygenation and select reassessment, in a short authored case. |
| `safety-reassessment-and-human-factors:check` / `:placement` / `:final` | Apply the alarm and the person to a short authored case.             | Prioritize a deteriorating patient while localizing a ventilator-related problem, in a short authored case.            |
| `high-peak-pressure-integration:final`                                  | Apply one alarm, different patients to a short authored case.        | Justify a mechanism and priority from the complete patient and waveform pattern, in a short authored case.             |
| `controls-and-goals:check` / `:transfer` / `:final`                     | Apply what you set. what you check. to a short authored case.        | Pair a control with the delivered result that needs checking, in a short authored case.                                |
| `modes-and-breath-delivery:*`                                           | Apply what does this breath hold constant? to a short authored case. | Predict the dependent variable in conventional volume- and pressure-controlled breaths, in a short authored case.      |

The ten authored MV-03 purposes render byte-for-byte as before; the two worked comparisons still
show their own purpose through `VentilationWorkedComparison`.

**Known and unchanged:** a unit's `:check` and `:transfer` items share one generic line, because the
line is derived per unit. That was equally true before this slice. Distinct per-item purposes are
authored content and belong to the remaining teaching batch, not to a UX repair.

## Defect 2 — unchecked radios read as selected

### Reproduction on the base commit

Same page, 1440 px, with the site/OS theme dark. With **nothing selected**, all three radios painted
as solid dark filled dots on the white card. After clicking one, the _checked_ radio painted as a
pale ring — lighter than its unchecked neighbours. The two states read as inverted.

Computed style at the radio on the base commit:

```
color-scheme: "dark"   accent-color: rgb(8, 111, 112)   appearance: "auto"
checked: [false, false, false]
```

### Root cause

`.course` in `ventilation-course.module.css` paints a **fixed light palette** (`background: #f7f9f7`,
`--ink: #17343c`) whatever the site theme is, but never declared `color-scheme`. The site theme's
`color-scheme: dark` therefore inherited down to the native `<input type="radio">`, and the user
agent painted dark-scheme controls on a light card. Nothing about the checked state itself was
wrong: the browser was drawing the wrong scheme.

This is **not** a shared-infrastructure defect, and the proof is MV-local. The same component,
mounted on the lesson stage, already has the fix: `components/stage/task-flow.module.css` line 27
declares

```
.flow [data-reinforcement] { color-scheme: light; --ink: #17343c; --accent: #086f70; background: #f7f9f7; }
```

— the identical palette _plus_ the scheme. `ventilation-course.module.css` carries that palette
without the scheme. No shared `learning-module` or `critical-care` file needed to change.

### Repair (`ventilation-course.module.css` only)

1. `color-scheme: light` on `.course` (the course-check shell) and on `.question` (the
   `[data-reinforcement]` root, so the card carries the scheme with its palette wherever it is
   mounted). This is what makes unchecked read unchecked and checked read checked.
2. The chosen row now carries **three** cues, so it does not depend on color alone: the existing
   tint and accented border, plus `box-shadow: inset 0 0 0 1px var(--accent)`, which doubles the
   border's thickness.
3. `@media (forced-colors: active)` keeps the thickness cue when Windows high contrast drops author
   colors and backgrounds.
4. `.choice input:focus-visible { outline: 3px solid #b56e21; outline-offset: 3px }`, so focus stays
   visible on the control itself even where this module's `.course` root is absent.

No native control was replaced and no JavaScript key handling was added: the `<input type="radio">`
remains the authority on what is checked, and the CSS only makes the row agree with it.

**Disabled state:** no radio on these surfaces is ever disabled (`radio.disabled === false` is
asserted in the new suite), so no disabled styling was invented for a state that does not occur.

### Before / after

| State                            | Before (theme dark)                                                       | After                                                  |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| Nothing selected                 | three solid dark filled dots                                              | three empty light circles with a grey ring             |
| One selected                     | pale ring — _lighter_ than its neighbours                                 | teal filled dot, tinted row, doubled teal border       |
| Computed `color-scheme` at radio | `dark`                                                                    | `light`                                                |
| Checked row computed style       | `background rgb(234,245,241)`, `border rgb(8,111,112)`, `box-shadow none` | same, plus `box-shadow rgb(8,111,112) 0 0 0 1px inset` |

## Files changed

| File                                                                                   | Change                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/features/mechanical-ventilation/content/learningCurriculum.ts`                    | adds `ventilationGenericQuestionPurpose(unit)` (+15 lines, data untouched)     |
| `src/features/mechanical-ventilation/components/MechanicalVentilationCourseCheck.tsx`  | calls the helper instead of composing the string inline                        |
| `src/features/mechanical-ventilation/components/ventilation-course.module.css`         | `color-scheme: light`, the inset ring, the focus rule, the forced-colors block |
| `src/features/mechanical-ventilation/__tests__/mv-ux-01-purpose-and-controls.test.tsx` | new bounded suite (28 tests)                                                   |

## Evidence

### Browser (dev server on port 3123, Chromium, theme emulated dark)

- **Purpose copy.** Every item on all three saved entries was enumerated by driving the picker:
  10 on `/assess`, 28 on `learn?entry=review`, 8 on `learn?entry=placement`. No line matches
  `Apply <lowercased title>`, an embedded question, or a mid-line lower-cased second sentence. The
  ten MV-03 purposes and the two worked comparisons are unchanged.
- **Purpose visible before answering.** On a fresh load the line renders with
  `anyChecked === false`; clicking **Show explanation** first leaves it visible and still checks
  nothing.
- **Unchecked vs checked.** Screenshots at 1440 px before and after the change; computed styles
  recorded in the tables above.
- **Keyboard.** With nothing chosen, the three radios are a single tab stop: Shift+Tab out of the
  card landed on the concept picker in one step, and Tab back entered the group. `ArrowDown` then
  moved focus from index 1 to index 2 _and_ moved the checked state with it
  (`[false, false, true]`), so React's controlled `checked` follows native activation. The focus
  ring on the control measured `rgb(181, 110, 33) 3px`.
- **Wrong answer → feedback → Try again.** On `safety-reassessment-and-human-factors:final`,
  choosing "Record completion because the sound has diminished" gave "This does not fit the case."
  plus its MV-SAFETY-01 **Potential harm in this case** note. **Try again** returned all three
  radios to unchecked and closed the explanation.
- **Continue without a correct answer** advanced to the next item.
- **Reload.** After a reload nothing is checked, no explanation is open, and no
  `ventilation`/`mechanical` key exists in `localStorage` — no fabricated response.
- **Widths.** 320 px, 390 px and 1440 px: `scrollWidth - clientWidth === 0` on each, before and
  after choosing. Choice rows wrap; the 16 px control does not shrink.

### Jest

| Command                                                                                         | Result                                               |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `npx jest src/features/mechanical-ventilation src/app/[locale]/mechanical-ventilation`          | **36 suites, 752 tests, all pass**                   |
| `npx jest src/features/mechanical-ventilation/__tests__/mv-ux-01-purpose-and-controls.test.tsx` | **28 pass**                                          |
| the same new suite against the base commit's two files                                          | **11 fail** — the suite is a real regression guard   |
| `npx jest src/features/critical-care src/features/learning-module`                              | 38 suites pass, **3 fail — pre-existing, see below** |

### Other checks

| Check                                    | Result |
| ---------------------------------------- | ------ |
| `npm run type-check` (`tsc --noEmit`)    | clean  |
| `npx eslint` on the changed TS/TSX       | clean  |
| `npx prettier --check` on all four files | clean  |
| `git diff --check`                       | clean  |

## Failures compared with the base commit

Three critical-care tests fail. They were re-run on this worktree with **every MV change reverted**
(`git checkout -- src/features/mechanical-ventilation`, new test file moved aside) and failed
identically, so they are pre-existing on `origin/main` at `21fc130a` and are **not** regressions from
this slice. None of the three touches the files changed here.

- `critical-care/__tests__/curriculum-sequencing.test.tsx` — "renders CRRT cases in authored station
  order, not alphabetically by title"
- `critical-care/__tests__/learner-copy.test.ts` — "keeps static component copy free of grading and
  software-internal labels"
- `critical-care/__tests__/accessibility.test.tsx` — "keeps color-coded circuit, pressure, alarm, and
  trend states readable without color"

## Checks not run

- `npm run lint` and `npx prettier --check .` over the whole repository were not run; linting and
  formatting were run on the changed files only, because the repository-wide runs would report the
  pre-existing state of unrelated files.
- No Playwright/e2e run, no production build, no visual-regression baseline.
- **Space-key activation was not proven in the browser.** The automation's synthetic key events do
  not trigger default activation for a programmatically focused element — a control check showed
  `Space` and `Return` also failing to activate a plain focused `<button>` — so this is a harness
  limit, not module behavior. Keyboard activation is covered instead by the verified `ArrowDown`
  navigation above and by the jsdom suite; no key handling was added or changed by this slice.
- Only Chromium was exercised. Safari and Firefox paint native radios differently, though
  `color-scheme` is the same mechanism in all three.
- Windows high-contrast mode was not exercised on a real Windows host; the `forced-colors` block is
  written from the specification, not from an observed run.

## Confirmations

- **No clinical behavior changed.** No stem, choice label, keyed answer, rationale, MV-SAFETY-01
  safety note, MV-03 teaching record, evidence id, source classification or review status was
  edited. The new purpose lines are composed from each unit's existing authored `outcome`; no
  clinical sentence was written for this slice.
- **No model behavior changed.** No simulation physics, case parameter, device profile or engine
  file was touched, and the MV-03 live-case exclusion is intact.
- **No progress or storage behavior changed.** No storage key, no serialized shape, no stored-answer
  identity. Question ids, choice ids and their order are unchanged, so legacy bytes keep their
  meaning. Nothing on these surfaces was saved before and nothing is saved now
  (`localStorage.length === 0` after a full pass, asserted in the new suite).
- **No grading, mastery, completion or answer gating** was introduced. `Continue` still works with
  no answer, `Show explanation` still works before answering, and no code reads `unsafe`, `safety`
  or `correctId` to change an outcome.
- **Device Intelligence untouched.** `src/features/device-intelligence` was not read and not
  changed; it appears nowhere in the diff.

## Next slice (not started)

1. Per-item authored purposes for the 36 items that still share a per-unit line. That is teaching
   content, not formatting, and belongs with the remaining MV teaching batch.
2. `MechanicalVentilationCaseActivityV2` mounts the same reinforcement card on a theme-following
   surface (`hsl(var(--background))`) while the card's descendant styles are unconditionally light.
   The `color-scheme` added to `.question` makes its controls correct, but the surrounding contrast
   on that one surface has not been reviewed.
