# Mechanical ventilation — the 2026-09-07 learner-review round

The ECMO module's R5 round — twelve points from an outside learner, generalised into seventeen
findings in [`learner-review-cross-module-brief.md`](./learner-review-cross-module-brief.md) —
applied to this module. Companion to [`mv-flow-rebuild.md`](./mv-flow-rebuild.md), which this
record amends in one place (MVLR-OD-3), and to
[`mv-d2-standard-laptop-workspace.md`](./mv-d2-standard-laptop-workspace.md), whose pane-order
decision it re-guards and whose widths it re-measures (MVLR-OD-1). Branch `claude/mv-learner-review`,
cut from `origin/main` at `c178ee84` (the merged hemodynamics learner-review branch, PR #129).
Eight commits; the shared package first and twice.

## What the brief got wrong about this module, and where the code won

The brief's mechanical-ventilation appendix was read on 2026-09-06. Three things had moved by the
time this round started, and four of its statuses were wrong when read against the code.

- **Prompt 0 was already done.** The hemodynamics round landed `paneOrder`, `paneCaptions`,
  `defaultWidthFractions`, `paneMinimums` and `compactPane` on the shared `StageLayout`, `lookIn`
  and `stageStepLocationErrors` on `stageModel`, `NowCard.where` and `LookInLine`, and `frames` on
  `AnswerVerdict`. MV passed none of them, so F1, F2 and X1 were adoption work only.
- **"Section 2 of 17" does not exist.** MV prints "Section N of 14" (`VentilationStageHost.tsx`,
  the header and the Sections drawer; `VentilationTeachingColumn.tsx:79`). The four "Stop N of 4"
  readouts on one screen — map caption, walk status, walk card, teaching stop card — are one
  numbering that agrees with itself. F9 stays does-not-apply.

| Finding | Brief | Code                                                                                                                                                                                                    |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4      | ○     | Applies, narrowly: the locked note fired only for `session.phase === 'predict'`; a look-back disabled the console with no note, and the quick-controls caption then read "Commit your prediction first" |
| F10     | ○     | Half: `AnswerVerdict` has the other-answers disclosure, but every Explain step said "Read the verdict on your prediction … then the explanation" over a one-line "Correct. You predicted: …" recap      |
| F12     | —     | Applies: prediction items were headed "That read holds" / "That mechanism predicts a different pattern", and the explanation sat under "How to distinguish it"                                          |
| X4      | ●     | Worse than described: RESET also set `phase: 'explore'` with no prediction committed (`learningLab.ts:305`), so Reset while deciding sent the learner from Predict back to Recognize                    |

## Two things worse than the twelve, found here

1. **The stage header sat a site-header height too low, in every adopter.** The hemodynamics
   round made the shared shell's header sticky `top: var(--site-header-height)` "inert in the fixed
   workspace, where the document never scrolls". Inside that workspace the module frame is
   `overflow: hidden` and starts directly under the site header, and an overflow-hidden ancestor is
   the scrollport a sticky offset resolves against, scrolled or not. Measured at 1440 × 900: header
   at 162–223 px over a context strip at 142–184 px and the head of the panes — on MV, MCS and
   hemodynamics at every viewport of at least 1024 × 700. Fixed in the shared shell (`234f4421`):
   the offset is zero inside the fixed workspace, and stays for the document-flow mode. Measured
   after: header 81–142, strip 142–184, panes from 184, at 1024, 1280, 1440 and 1600 wide on this
   module; on hemodynamics' `pressure-system` and MCS's `impella-unloading-placement` at 1440.
2. **A wrong answer was handed the right answer's reasoning, in two sections.** The brief's own
   "outranks the twelve" item, confirmed verbatim and fixed (`876b8019`; MVLR-OD-4).

## Finding by finding

| Finding | What was there                                                                                                                                                                                                         | What shipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1      | Pane names only in `aria-label` and the compact tab row; MV passed no caption                                                                                                                                          | "Simulator panel · the live ventilator, the quick controls and the breath map", "Teaching panel · what to read", "Steps panel · what to do", sticky at the head of each pane, in the shell's muted grey (`rgb(159,180,183)`, measured). The order is unchanged — MVLR-OD-1.                                                                                                                                                                                                                             |
| F2      | 114 steps across fourteen sections, none naming a pane; no location on the step model                                                                                                                                  | Every step authors a `lookIn`, generated per step kind in `stageLessons.ts` from what the steps already know (the toolbar's Pause, "Quick controls for this step", "Readings to watch", the numbered stops on the map, the choices and the verdict on the card, "The picture and the checklist") with a `recognizeLookIn` override on two section specs. Validated at import with the shared rules and the copy gate; scanned as pre-commit copy; printed under the instruction and in the help dialog. |
| F3      | "Read the four short paragraphs on the right" (`sectionSpecs.ts:80`) and "then the explanation on the right" (`stageLessons.ts:317-318`) — the Teaching pane is the middle one                                         | Both name the heading and the pane: "under “Why a ventilator exists”", "the explanation under it. The Teaching panel opens on the picture and the checklist." The method block gained the `<h3>` those words point at, printed open or folded; section 12's first step names "Patient and circuit findings, below the breath map".                                                                                                                                                                      |
| F4      | Console dead on a look-back with no note; quick-controls caption false                                                                                                                                                 | Both notes derive from the two predicates that disable the controls (`data-controls-locked-note`, `data-controls-paused-note`); the caption reads "Paused while you look back."; neither claims the transport toolbar is off, because it is not.                                                                                                                                                                                                                                                        |
| F5      | `.toolButton`/`.select` had rest, focus and disabled states only; the shared Now-card classes have no hover                                                                                                            | Hover and pressed states on the transport, hold and intervention buttons, the Now card's actions and the prediction's choice rows, scoped to this module's shell (`mechanical-ventilation-module.module.css`), as hemodynamics did. The shared classes are left as they are.                                                                                                                                                                                                                            |
| F6      | Does not apply: no Continue until the goals are met (`VentilationStageHost.tsx`, the `simulator-task` case)                                                                                                            | Nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F7      | `stop.checklist` as a bare `<ul>` on the walk card and in the teaching column; Tailwind v4 preflight had reset the markers                                                                                             | One label for all four stops — `BREATH_STOP_CHECKLIST_LABEL`, "Questions to ask at this stop", because every item on every stop is a question — `aria-labelledby` on both lists, `list-style: disc` back (measured `disc`, `list-item`). The opposite of ECMO's R5-OD-2, by design: see MVLR-OD-2.                                                                                                                                                                                                      |
| F8      | The readout's "?" was `aria-hidden` and the visible console text equivalent omitted the caveat; the breath map's description was read twice                                                                            | The visible text equivalent carries "— not interpretable: patient effort N cmH₂O against this measurement" (`MechanicalVentilatorConsole.tsx`, waveform text); the map's screen-reader-only duplicate of its `<desc>` is gone.                                                                                                                                                                                                                                                                          |
| F9      | Does not apply; the brief's quoted strings do not exist                                                                                                                                                                | Nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F10     | Explain rendered "Correct. You predicted: …" under an instruction promising the verdict and the explanation                                                                                                            | The Explain step renders the prediction's verdict in full, first on the card, and the round's explanation is the paragraph inside it (once, measured) rather than a second copy below; a look-back at a committed prediction shows the verdict too.                                                                                                                                                                                                                                                     |
| F11     | Swapped rationales, a stem stating its key's direction, five settings-or-alarm distractors under stems asking for a finding, a rationale handing the wrong answer the key's reasoning, and seven uniquely-longest keys | MVLR-OD-4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F12     | Signal-read titles and heading on response predictions                                                                                                                                                                 | Prediction items pass "That prediction holds" / "That mechanism predicts a different response" and head the paragraph "The explanation" — the shared card gained an optional `explanationHeading` (`7492f224`), defaulted. The three location items are reads and keep the card's words. MVLR-OD-5.                                                                                                                                                                                                     |
| X1      | Compact viewport opened on the simulator with the answer choices in the pane it could not show                                                                                                                         | Shared `compactPane`, followed not forced: the step's location, and the Steps pane once the step's work is done or on a look-back, where the next action is.                                                                                                                                                                                                                                                                                                                                            |
| X2      | Brief: applies                                                                                                                                                                                                         | Confirmed and measured, not fixed — below.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| X3      | `observe.watch` never read (`stageLessons.ts:73,305`; the host reads `guide.watch`)                                                                                                                                    | Gone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| X4      | Unqualified Reset; see the table above                                                                                                                                                                                 | A title saying what it keeps and what it clears; a visible line once there is something to clear, `aria-describedby` from the button; disabled with a reason while deciding and on a look-back.                                                                                                                                                                                                                                                                                                         |
| X5      | Does not apply: every teaching block is scoped by `StageBlock`                                                                                                                                                         | Nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Also from the brief's "found in this module" list: the two stale doc comments in `AnswerVerdict.tsx`
are corrected (`7492f224`); `mv-flow-rebuild.md` §2 row 5 no longer says the teaching is "on the
right" (MVLR-OD-3); the eleven and eight reads of `--muted` in `ventilation-stage.module.css` and
`breath-map.module.css` — invalid inside the shared workspace, where the token is a Tailwind HSL
triple — read `--stage-muted` now, and the review suite refuses the old read.

## MVLR-OD-1 — the order stays, and is guarded again

**This re-guards `mv-d2-standard-laptop-workspace.md` §2 and amends its §7.** §2 records the
conceptual order — live ventilator → teaching → learner action — as unchanged, and §7 named
`__tests__/learn-workspace.test.tsx` as its guard, a file the flow rebuild (PR #127) deleted. The
order is now pinned by `__tests__/stage-learner-review.test.tsx` (`['simulator', 'teaching',
'task']`), and §7's row says so.

It is **not flipped**. ECMO (R5-OD-1) and hemodynamics (HLR-OD-1) both moved to Steps · Teaching ·
Simulator on the learner's "more natural read" and because a compact viewport opens on the first
pane. MCS, like MV, passes no `paneOrder`, so the four adopters of the same stage are split two and
two. The compact-viewport half of the argument is answered here by `compactPane` regardless of
order; the reading-order half is a preference the owner should settle across the modules rather
than one session per module. **Owner decision requested**; if it flips, the fractions that keep the
ventilator widest are the ones hemodynamics uses (0.26 / 0.29 / the rest, floors 300 / 280 / 340)
and the guard is one line.

### D2's widths, re-measured on the stage

D2 §3 and §5 validated 1600 × 900, 1440 × 900, 1280 × 720 and 1024 × 768 on the pre-rebuild
surface. Measured on the dev server at `mechanics-load-and-pressure`, Explain step (the widest
teaching state), each width a fresh mount:

| Viewport   | Simulator | Teaching | Steps | Elements overflowing their pane | Document horizontal scroll | Header / strip top |
| ---------- | --------- | -------- | ----- | ------------------------------- | -------------------------- | ------------------ |
| 1600 × 900 | 660       | 445      | 430   | 0                               | 0                          | 81 / 142           |
| 1440 × 900 | 592       | 399      | 385   | 0                               | 0                          | 81 / 142           |
| 1280 × 720 | 523       | 353      | 341   | 0                               | 0                          | 81 / 142           |
| 1024 × 768 | 413       | 278      | 269   | 0 (was 81 — below)              | 0                          | 81 / 142           |

The simulator is the widest pane at every width, three panes at all four, the compact threshold
unmoved. Two layout defects were found by the measurement and fixed in the same round:

- **At 1024 the teaching column was 300 px wide in a 263 px pane.** The column's single implicit
  grid track is sized by its widest item's min-content, and the knob strip's rows — `auto 1fr` with
  a no-wrap pill — had a min-content of 300 px, so every block in the pane ran 37 px past its edge
  (81 elements, none inside a scroller). The strip's text column is `minmax(0, 1fr)` now, and the
  shared stage's three columns are `grid-template-columns: minmax(0, 1fr)`, the trap the MCS and
  hemodynamics records both name, so no item can widen a column past its pane in any adopter.
- The stage header, above.

Not a defect: shrinking the emulated viewport in place without a `resize` event left the first two
panes at their old pixel widths and starved the third to zero. Dispatching `resize` re-fits them
(488 / 228 / 244 at 1024), which is what a real window resize does.

## MVLR-OD-2 — one label for the four stop checklists

ECMO's R5-OD-2 authored the label per stop because its six lists were different kinds of thing.
Here they are one kind: all eleven items across the four stops are questions to ask of the running
breath ("Who started this breath: the patient or the timer?", "Did expiratory flow reach zero before
the next breath started?"), and `breathSpine.ts` already holds them to four items each as "the
bedside residue". So the label is one constant on the spine, printed on the walk card and in the
teaching column, and both lists carry it as their accessible name.

## MVLR-OD-3 — the flow-rebuild record said "on the right"

**This amends `mv-flow-rebuild.md` §2, row 5**, which described the Explain step's teaching as "on
the right". The Teaching pane has been the middle pane since the stage was adopted
(`teaching-workspace.module.css`, primary is column 1), and the two instructions that said "on the
right" were written from that row. The row names the pane now and says what it used to say.

## MVLR-OD-4 — the item sweep

All twenty-eight round items stay `reviewStatus: 'draft'`. What changed in
`content/learningExperiments.ts`, each needing the owner's eye:

| Round                                                                  | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `earlierCycle` (sections 7 and 11, round 2)                            | `rationales[0]` — served to "Longer machine inspiration" — was the key's own mechanism ("An earlier flow-cycle criterion ends support sooner"); the key had a generic next-step line. Swapped; the wrong answer's rationale now says "not later". The stem "If a higher cycling threshold ends machine inspiration **earlier**" stated the direction the key names, which `activity-contract.md:70-73` forbids; it asks what to look for. "A higher oxygen setting" was a setting under a stem asking for a change on the traces; it is "A larger delivered volume". |
| `lung-protection` round 1                                              | `rationales[0]` gave the wrong answer ("A larger pressure requirement") the key's reasoning; it negates the wrong answer.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `triggering-and-cycling` round 1                                       | "A higher oxygen fraction" was a setting under a stem asking for a response; it is "Larger breaths with each captured effort", wrong because the trigger does not size the breath.                                                                                                                                                                                                                                                                                                                                                                                   |
| `triggering-and-cycling` round 2                                       | "A higher mandatory breath rate" likewise; it is "Breaths that start with no effort". `rationales[0]` described the opposite setting without saying so; it says "Lowering it does the reverse."                                                                                                                                                                                                                                                                                                                                                                      |
| `high-peak-pressure-integration` rounds 1 and 2                        | "The selected volume increases", "A larger inspiratory flow setting alone" and "A louder alarm alone" were a setting, a setting and an alarm under stems asking for an observation during a hold; they are findings on the traces now.                                                                                                                                                                                                                                                                                                                               |
| `stiffVolume` (sections 2, 4, 5), the two above, both high-peak rounds | The key was the uniquely longest option in seven of the twenty-eight rounds; a distractor was lengthened or the key trimmed in each. `stage-lessons.test.ts` refuses a stem that contains its own key and a key a learner could pick by length.                                                                                                                                                                                                                                                                                                                      |

## MVLR-OD-5 — a prediction's verdict says it was a prediction

`AnswerVerdict`'s titles and its "How to distinguish it" heading are written for signal reads. This
module's twenty-eight round items are response predictions, and every Explain instruction promises
"the explanation"; so a prediction's verdict is headed "That prediction holds" / "That mechanism
predicts a different response" and its paragraph "The explanation", through the shared card's
`frames` and a new, defaulted `explanationHeading`. The three location items are `signal-recognition`
and keep "That read holds" / "How to distinguish it". `mv-flow-rebuild.md` §9 asked the owner whether
"Correct." / "Not correct." was wanted here; this round takes the wording one step further and the
question still stands.

## Left for the next round

Confirmed in the code or measured in the browser, and out of scope here:

- **X2, on the shared shell.** `.now` is `position: sticky` (`lesson-shell.module.css:399`) inside
  the host's `[data-now-focus]` wrapper (`VentilationStageHost.tsx:1106`), exactly as tall as the
  card, so it never sticks: scrolling the Steps pane by 600 px moved an 836 px card from 30 px to
  −570 px below the pane's top. Same finding as hemodynamics; whether a card that tall should stick
  at all is a shared-shell decision.
- **The same item is met three times as if new.** `flow` is round 1 of section 2, round 2 of
  section 1 with its options rotated (`learningExperiments.ts:298`), and round 2 of section 10 with a
  new introduction and the same stem and choices; `stiffVolume` is in sections 2, 4 and 5; `oxygen`
  in 3 and 8 verbatim; `earlierCycle` in 7 and 11 verbatim (`:304,332,353,390,478,603`). Fresh items
  are the owner's to author.
- **Three round titles contain "test"** (`learningExperiments.ts:242,453,579`: "Test the
  measurement in an active patient", …), a banned learner-copy term; they are Explain-step titles
  and are not run through the copy gate today. Whether "test" as a verb should be exempt or the
  titles reworded is a copy decision.
- **`layout-regression.test.ts:46,50`** still asserts the D2 viewport contract against
  `mechanical-ventilation-v2.module.css`, whose `.learnViewport` no longer has a consumer since PR
  #127 (the case activity still imports the file). The guard is real and the rule is dead.
- **The shared button classes have no hover state** (`lesson-shell.module.css:464`); this module
  scopes its own, as hemodynamics did. Four modules' to change.
- **`mv-d2-standard-laptop-workspace.md` §7** names guards this round did not restore: pause
  outside the panes in every phase, Help answering in the pane, the debrief as a pane. Those claims
  were about the retired surface; the stage's equivalents (the transport toolbar in the simulator
  pane, the help dialog, the teaching column) are pinned by `stage-host.test.tsx` and the review
  suite, but the row is not rewritten claim by claim.
- **The flowing-mode sticky header was not re-verified.** Below 1024 × 700 the document should
  scroll and the row should hold under the site header (`top: var(--site-header-height)`, unchanged
  here); under viewport emulation at 1280 × 690 `window.scrollTo` did not move the document, so
  that mode is asserted by the stylesheet guard and the hemodynamics round's measurement only.
- At 1024 × 768 the Teaching pane's `scrollWidth` is 274 against a `clientWidth` of 263 on the
  Explain step: the grammar table scrolls inside its own wrapper, nothing is uncontained, and the
  pane hides horizontal overflow.

## Needs the owner

- MVLR-OD-1: the pane order, across the four adopters.
- MVLR-OD-4: the seven rewritten items, and the repeated items above.
- MVLR-OD-5: the prediction-shaped verdict wording, together with §9's standing question.
- The "test" round titles.
- Whether the Now card should stick (X2).
- The simulator caption's wording: "the live ventilator, the quick controls and the breath map".

## Verification

- `npx jest src/features/mechanical-ventilation` — 26 suites / 565 tests before, 27 / 580 after
  (`stage-learner-review.test.tsx` new; `stage-lessons.test.ts` and `components.test.tsx` extended).
- `npx jest src/features/learning-module src/features/critical-care` — 37 / 328 before, 38 / 333
  after (`AnswerVerdict.test.tsx` extended; `lesson-shell-header.test.ts` new).
- `npx jest src/features/mechanical-ventilation src/features/icu-hemodynamics src/features/mechanical-circulatory-support`
  after the two shared stylesheet changes — 86 suites / 1,659 tests, green.
- `npx tsc --noEmit` clean for the modules in play; `eslint` and `prettier` clean on every changed
  file.
- The dev server on :3123 (this worktree's own `claude-mv` launch entry; :3120 belonged to another
  session's checkout), `mechanics-load-and-pressure` driven from Recognize through the prediction
  (locked note, Reset waiting with its reason, the verdict "Correct. That prediction holds" with
  "The explanation" and two other answers), Act (the location line, the quick-controls caption, the
  Reset note appearing after the change and describing the button), Observe (the printed "Readings
  to watch"), Explain (the verdict in full, the explanation once, the before-and-after, "The picture
  and the checklist" open in the Teaching pane with decimal markers), then Back (the paused note,
  the paused caption, Reset paused, the transport live). `waveform-anatomy`'s walk card and stop
  block (label, `aria-labelledby`, disc markers, one map description), the first steps of
  `breathing-with-support` and `safety-reassessment-and-human-factors` (the location line naming
  what is open on the pane). The width table above. Pane captions and kickers measured in the
  shell's muted grey.

## Rubric section 5, on the finished surface

- Every instruction names the surface it means, and the name is on screen: the three captions and
  the 114 locations, validated together at import.
- Every heading an instruction names is present at that step: "Why a ventilator exists" open on the
  first step; "The picture and the checklist" printed on the method block open or folded; "Readings
  to watch" printed; "Patient and circuit findings" below the map.
- Everything an instruction promises exists where it promises it, open: the verdict, the
  explanation and the other answers on Explain; the choices, the quick controls and the readings on
  their steps.
- One control group watched across a section: the quick controls change with the step's goals; the
  teaching blocks fold by focus.
- The primary control does the step's work: no Continue until the goals are met; Commit disabled
  until a choice; Reset waits while a prediction is being decided.
- Every control the step needs looks interactive, and the simulator says when it cannot be
  operated, in both states that turn it off.
- No two "N of M" counters without a noun between them: "Step", "Stop", "Section" — and the four
  "Stop N of 4" readouts are one numbering.
