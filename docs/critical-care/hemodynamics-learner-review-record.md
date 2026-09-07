# ICU hemodynamics — the 2026-09-07 learner-review round

The ECMO module's R5 round — twelve points from an outside learner, generalised into seventeen
findings in [`learner-review-cross-module-brief.md`](./learner-review-cross-module-brief.md) —
applied to this module. Companion to [`hemodynamics-flow-rebuild.md`](./hemodynamics-flow-rebuild.md),
which this record amends in two places (HLR-OD-1, HLR-OD-4). Branch
`claude/hemodynamics-learner-review`, cut from `origin/main` at `d7cf048f` (the merged ECMO
learner-feedback branch, PR #128). Five commits; the shared package first.

## What the brief got wrong about this module, and where the code won

The brief's hemodynamics appendix was read on 2026-09-06 against a surface PR #125 had already
replaced. Every file it cites for the layout findings — `PacGuidedSkillActivity.tsx`,
`PacAdvancementReasoningPanel.tsx`, `PawpSafetySequencePanel.tsx`, `PressureSystemValidityPanel.tsx`,
`IcuHemodynamicsLab.tsx`, `TaskPanel`, `GuidedLabFrame` — no longer exists. The Learn surface is
`components/stage/HemodynamicsStageHost.tsx` on the shared `learning-module/stage` package.
`ResizablePacWorkspace.tsx` survives for Practice cases only (`HemodynamicNativeWorkspace.tsx:9`),
so the converge-or-patch question the brief asked answers itself: Learn never touches it, and it is
untouched here.

Four statuses moved when read against the code:

| Finding | Brief | Code                                                                                                                                                  |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4      | —     | Applies, narrowly: the locked note covered the uncommitted prediction and not the look-back (`HemodynamicsStageHost.tsx:974-980` before this round)   |
| F6      | ●     | Handled by the stage: the Now card carries no primary until the step's work is done (`:612-637`, `:653-662`); Commit is disabled until a choice       |
| F10     | ●     | Half: `AnswerVerdict` has the other-answers disclosure; the live breach was the Explain step's "Read the reasoning" against a one-line recap          |
| X3–X5   | ●/●/● | Do not apply on the stage: docks are chosen per step, performed steps are sticky by design (`stageProgress.ts:19-24`), every teaching block is scoped |

The brief also counted thirteen items in `pacLearningItems.ts`; three of them
(`pac-pressure-validity-commit-1`, both `catheter-advancement` items) are not used on the stage.

## Two things worse than the twelve, found here

1. **Three numberings for one place on one screen.** The catheter map's legend and pins counted the
   stops from one with the line first; the walk card and the teaching stop card printed the spine's
   zero-based ordinal; the walk counter counted walk position. The first step of `pressure-system`
   read "Stop 1 of 1", "Stop 0 · The line" and a legend row "1 The line" at once, and the first
   step of `waveform-interpretation` read "Stop 1 of 4" beside "Stop 1 · Right atrium" beside a
   legend row "2 Right atrium". See HLR-OD-2 and HLR-OD-3.
2. **Instructions naming things not on screen.** The capstone's first step said "read the bedside
   picture in the strip" and its Observe step said to read "the bedside"; nothing on the stage
   renders a bedside picture — the strip carries Level, Zero, Scale, Tip and Balloon. The
   orientation's Explain step said "Read the reasoning" on a step whose card rendered one line.

## Finding by finding

| Finding | What was there                                                                                                                                     | What shipped                                                                                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1      | Pane names only in `aria-label` and the compact tab row (`StageLayout.tsx:9-13`)                                                                   | Shared `StageLayout` takes `paneCaptions`; this module prints "Steps panel · what to do", "Teaching panel · what to read", "Simulator panel · the monitor, the controls and the catheter map", sticky at the head of each pane. Steps, Teaching, Simulator, left to right — HLR-OD-1.                                           |
| F2      | 63 instructions, none naming a pane; no location on the step model                                                                                 | Shared `StageStepBase.lookIn`, `stageStepLocationErrors`, `NowCard.where`, `LookInLine`. Every one of the 64 steps authors a location; validated at import with the shared rules and this module's copy gate; scanned as pre-commit copy against each section's deny set; printed under the instruction and in the help dialog. |
| F3      | "Read the increment" ×5 named a dashed box with no heading; "the control strip", "the strip below the monitor", "the patterns the reference draws" | The box is labelled "What this section adds" and the instructions say so; the other three name the heading on screen; the capstone's two "bedside" instructions and the Reassess card name what is there.                                                                                                                       |
| F4      | Docks disabled silently on look-back                                                                                                               | Both notes derive from the same two predicates that disable the docks: "locked while you decide" and "paused while you look back", each on the simulator (`data-controls-locked`, `data-controls-paused`).                                                                                                                      |
| F5      | No hover or pressed state on the docks, the map's pins and rows, the Now card's actions or the commitment buttons                                  | All four, scoped to this module (`hemodynamics-stage.module.css`, `catheter-map.module.css`; the drill's buttons in the legacy stylesheet). The shared `.nowPrimary`/`.nowSecondary` classes are left as they are — see below.                                                                                                  |
| F6      | Handled by the stage                                                                                                                               | Nothing. One F6-adjacent case left: the Explain step's Continue does not require the stories to have been tried — below.                                                                                                                                                                                                        |
| F7      | The walk checklist, the teaching stop checklist and the drill's cues: no label, markers reset by preflight                                         | A per-stop `checklistLabel` on the spine ("What to check on the line", "What to look for in this tracing", "What has to be true of a wedge"), `aria-labelledby` on both lists, real markers; the drill's cues under "What identifies it", the heading the atlas panel gives them.                                               |
| F8      | "Read this state as text" vs "Read this display as text" in one teaching column                                                                    | One string.                                                                                                                                                                                                                                                                                                                     |
| F9      | Three numberings, above                                                                                                                            | HLR-OD-2, HLR-OD-3.                                                                                                                                                                                                                                                                                                             |
| F10     | The Explain step's "Read the reasoning" against "Correct. You predicted: …"                                                                        | The Explain step renders the prediction's verdict in full — rationale, how to distinguish it, the other answers — first on the card. Looking back at a committed prediction shows the verdict too.                                                                                                                              |
| F11     | Ten partly-correct or absolute distractors across eight live items                                                                                 | Regraded or rewritten — HLR-OD-4 lists each.                                                                                                                                                                                                                                                                                    |
| F12     | `AnswerVerdict`'s fixed titles heading management decisions                                                                                        | Shared `AnswerVerdict` takes `frames`, defaulted; this module's management decisions and four decision-shaped transfers say "That is the move to make first" / "Defensible, but it leaves a step out" / "That move answers a different problem" — HLR-OD-5.                                                                     |
| X1      | Compact viewport opened on the simulator over a locked dock                                                                                        | Shared `compactPane`, followed not forced; this host derives it from the step's location, overridden to the simulator on the two steps answered by pointing at the map.                                                                                                                                                         |
| X2      | Brief said does not apply                                                                                                                          | Measured: it does, on the shared shell. Not fixed — below.                                                                                                                                                                                                                                                                      |
| X3–X5   | Do not apply on the stage                                                                                                                          | Nothing.                                                                                                                                                                                                                                                                                                                        |

## HLR-OD-1 — the steps lead, and the simulator keeps the width

**This amends `hemodynamics-flow-rebuild.md` §2 and §6.** Neither recorded the order as a decision:
§2 says "three panes that scroll on their own inside a viewport-sized shell" without an order, and
§6's table measured "Simulator 657/1,255, Teaching 657/1,588, Steps 657/1,249" as a fact of the
surface. The workspace label read "Hemodynamics lesson workspace: monitor, teaching, and steps".
It reads "steps, teaching, and simulator" now.

The order is Steps, Teaching, Simulator — the ECMO round's R5-OD-1, taken here for the same two
reasons: the learner reads the instruction first, and a compact viewport opens on the first pane,
which was a monitor over a locked dock while the answer control sat in the pane it could not show.
What §2 does record — the monitor never scaled — is what the fractions protect: 0.26 / 0.29 / the
rest, floors 300 / 280 / 340, the simulator the widest of the three at every measured width.

Measured on the dev server at `pressure-system`, each width a fresh mount:

| Viewport | Steps                                                                                 | Teaching | Simulator | Elements overflowing their pane | Document horizontal scroll |
| -------- | ------------------------------------------------------------------------------------- | -------- | --------- | ------------------------------- | -------------------------- |
| 1600     | 399                                                                                   | 445      | 691       | 0                               | 0                          |
| 1440     | 358                                                                                   | 399      | 619       | 0                               | 0                          |
| 1280     | 316                                                                                   | 353      | 547       | 0                               | 0                          |
| 1024     | 250                                                                                   | 278      | 432       | 0                               | 0                          |
| 900      | one pane, the Steps tab selected on the walk step; Simulator on the map-answered step |          |           | —                               | 0                          |

The monitor: 676 px wide at 1600, no overflow at 1024. These are the ECMO record's numbers to the
pixel, which is what sharing the workspace's fractions should produce.

## HLR-OD-2 — one place, one number: the map's

The spine's `ordinal` is zero-based and its own file says why ("Ordinal 0 is the line because it is
the first thing the pressure meets"). That stays, and stays internal. What a learner reads is the
number the catheter map prints on its pins and in its legend — one-based, the line first — through
`routeStopNumber`, on the walk card and on the teaching stop card. The pins were already pinned by
`stage-host.test.tsx:272` (`ra:2 … wedge:5`); nothing there moved.

## HLR-OD-3 — the walk's position is said in words

"Stop 1 of 4" beside a card headed "Stop 2 · Right atrium" is two numberings for one place. The
walk's status and the map's caption say "First of four stops in this walk." and, on the one-stop
walk, "The only stop in this walk." No counter was renumbered; the only number on the card is the
map's.

## HLR-OD-4 — eight reviewed items are draft again

**This amends `hemodynamics-flow-rebuild.md` §5**, which said "every other H0–H5 item is used as
authored", and the pin at `pac-learning-items.test.ts:16-17`, which held all thirteen at
`sme-review`. The test now pins exactly which eight are `draft`, and that no partly-correct option
carries an absolute. **Each of these needs the owner's eye:**

| Item                      | Option                       | What changed                                                                                                                                                  |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pac-pressure-predict-1`  | `zero-only`                  | Regraded partly-correct → incorrect: zero alone repairing the height and the ringing is false                                                                 |
| `pac-pressure-transfer-1` | `relevel-only`               | Regraded partly-correct → incorrect: re-levelling does not make morphology reliable                                                                           |
| `pac-pressure-transfer-1` | `accept-mean`                | "damping **cannot** affect clinical interpretation" → "Re-level, then read the mean instead of the pulse pressure: a damped line spares the mean." Grade kept |
| `pac-pawp-predict-1`      | `mean-anywhere-deflate`      | Regraded partly-correct → unsafe: deflating without watching the artery return is the omission this module's wedge teaching names                             |
| `pac-pawp-transfer-1`     | `highest-value`              | "positive pressure **always** reveals the true filling pressure" → "Use the highest value of the swing, then deflate and verify return of the PA waveform."   |
| `pac-td-predict-1`        | `average-all`                | "a larger sample **automatically** reduces technique error" → "more curves in the average means less error from any one"                                      |
| `pac-td-transfer-1`       | `accept-because-low-flow`    | "low flow is expected to produce **any** curve shape" → "low flow makes every curve broader and slower, and this one is"                                      |
| `pac-derived-predict-1`   | `assume-normal-flow`         | Regraded partly-correct → incorrect: a substituted denominator is not a defensible partial answer                                                             |
| `pac-derived-transfer-1`  | `ppv-controlled-ventilation` | "the **only** condition that determines PPV validity" → "the condition PPV was validated under"                                                               |
| `pac-derived-transfer-1`  | `ppv-number-valid`           | "valid **whenever** it is displayed" → "the monitor would not display a number it could not calculate"                                                        |
| `hd-capstone-transfer-1`  | `level-and-zero`             | "**every** tracing problem starts there" → "the reference is checked before anything else on a line" (already `draft`)                                        |

Two of the rewrites lengthened a distractor to keep the keyed option from becoming the longest;
`stage-lessons.test.ts:86` holds the set under 0.7.

## HLR-OD-5 — a decision's verdict says it was a move

`AnswerVerdict`'s titles are written for reads. Items typed `management-decision`, and the four
transfers whose stem asks for a move (`hd-capstone-transfer-1`, `hd-advance-transfer-1`,
`pac-pawp-transfer-1`, `pac-td-transfer-1`), pass their own: "That is the move to make first",
"Defensible, but it leaves a step out", "That move answers a different problem". An unsafe choice
keeps the card's words. Reads keep "That read holds".

## HLR-OD-6 — the Explain step carries the verdict

The Explain step's body opens with the prediction's verdict in full rather than the line
"Correct. You predicted: …", so "Read the reasoning" and "Read what changed and why" are true of the
card they are printed on. `data-explain-recap` still wraps it and still starts with the outcome.

## Found by the owner on the dev server, after the round

The stage's header row — Sections, "What do I do now?", Restart, Save & exit — sat under the site
header on a 1846 × 702 window. Two causes, both fixed in the same commit:

- The module shell subtracted a flat 4rem from the viewport where every sibling subtracts
  `--site-header-height` (5rem + 1px on a desktop), so the shell was 17px taller than its space —
  the residual the flow-rebuild record §6 had noted and left. The convergence test that pins the
  rule listed MCS, ECMO and CRRT and not this module or MV; it lists all five now.
- Below the fixed-workspace threshold (a viewport at least 1024 × 700) the stage flows with the
  document, and a learner who scrolls to the panes slid this row under the site's sticky header.
  The shared shell's header is sticky beneath the site header now, in every adopter. Measured at
  1846 × 690: scrolled 285px, the row stays at 81px, the site header's own height.

The catheter map's part labels — monitor, transducer, SVC, RA, RV, PA — rendered black on the
dark schematic. The shared workspace redefines `--muted` as a Tailwind HSL triple (`192 36% 16%`)
for `hsl(var(--token))`, so every `var(--muted, …)` read as a colour inside it is invalid: an SVG
fill falls to black, and a text colour silently inherits the ink — which is why no kicker, step
phase or pane caption on the stage was ever the muted grey it declared. The shell already publishes
the palette's muted colour as `--stage-muted`; the shared stage stylesheet, this module's and the
map's read that now. **The same read is in the MV, MCS and ECMO stage stylesheets** (11, 13 and 11
uses) and is theirs to fix; ECMO's shell names its token differently.

## Left for the next round

Confirmed in the code or measured in the browser, and out of scope here:

- **X2, on the shared shell.** `.now` is `position: sticky` (`lesson-shell.module.css:374-377`),
  and its containing block is the host's `[data-now-focus]` wrapper, exactly as tall as the card,
  so it never sticks: scrolling the Steps pane by 600 px moved the card from 30 px to −570 px below
  the pane's top. Whether a card that can be tall should stick at all is a shared-shell decision.
- **Explain's Continue does not require the stories.** `HemodynamicsStageHost.tsx` `case 'explain'`
  offers Continue regardless; two instructions say "try the story". Optional by design in the
  rebuild record; worth an owner call.
- **The shared button classes have no hover state** (`lesson-shell.module.css:425-466`); this
  module scopes its own. Four modules' to change.
- **The wedge commitments' keyed option is 2.3× and 1.9× the length of its alternatives**
  (`pawpCaptureSequence.ts:300-306`, `:344-348`); the label is pinned by the H2/H3 owner test at
  `h2-h3-reference-and-pac-safety.test.tsx:505`.
- **"It cannot be named" is graded partly correct** on both map-answered items
  (`stageItems.ts:184-189`, `:202-208`) with a rationale that says "It can." The grade is a
  recorded choice (flow-rebuild §5); the card's "Defensible, but not the whole picture" is a stretch.
- **Three legacy items are dead on the stage** but still exported and tested:
  `pac-pressure-validity-commit-1` and both `catheter-advancement` items in `pacLearningItems.ts`.
- **A fourth numbering** sits inside the folded normal-waveform reference: "State 1 of 4" for the
  chambers (`NormalWaveformReference.tsx:165`), post-commit and folded, so no learner meets it beside
  the map's numbers on the same step. Left because it is the H2 owner-reviewed panel.
- **The Practice-side `ResizablePacWorkspace.tsx`** keeps the brief's findings for that surface: a
  compact tablist with no key handling, and no captions. Practice was not walked by the learner.
- **The other two adopters.** Mechanical ventilation and MCS render the shared stage and pass none
  of the new options, by design: their rounds decide their order and their captions.

## Needs the owner

- The eight items in HLR-OD-4.
- HLR-OD-1: the pane order, taken here on the ECMO round's reasoning and no record against it.
- The "cannot be named" grade and the wedge commitments' length, above.
- Whether the Now card should stick (X2).
- The simulator caption's wording: "the monitor, the controls and the catheter map".

## Verification

- `npx jest src/features/icu-hemodynamics` — 30 suites / 402 tests before, 31 / 417 after.
- `npx jest src/features/learning-module src/features/critical-care` — 35 / 309 before, 37 / 328
  after; the shared stage package has its first two suites.
- `npx jest 'src/app/\[locale\]/icu-hemodynamics' src/features/mechanical-ventilation src/features/cardiohelp-ecmo src/features/mechanical-circulatory-support`
  — 124 suites / 3,299 tests, unchanged in count: every adopter of the shared stage and the shared
  verdict card renders as before.
- `npx tsc --noEmit` clean for the modules in play; `eslint` and `prettier` clean on every changed file.
- The dev server on :3120, `pressure-system` driven from the walk through the prediction (the
  verdict "Correct. That read holds", two other answers), the reference, the flush read and
  repaired, to Explain (the verdict, four rows of what changed, two stories, four grammar rows, the
  control strip), then Back twice: the paused note on the simulator with the dock disabled, and the
  verdict again on the prediction. The width table above. The location line on every step reached.

## Rubric section 5, on the finished surface

- Every instruction names the surface it means, and the name is on screen: the pane captions and the
  64 locations, validated together.
- Every heading an instruction names is present at that step: the seven rewrites; "What this section
  adds" labelled; the capstone's "bedside" gone.
- Everything an instruction promises exists where it promises it, open: the verdict on Explain; the
  other answers on the verdict; the stories on the card.
- One control group watched across a section: the docks change with `surface`; the teaching blocks
  fold by phase.
- The primary control does the step's work: no Continue until the goals are met; Commit disabled
  until a choice. The one exception is recorded above.
- Every control the step needs looks interactive; the simulator says when it cannot be operated.
- No two "N of M" counters without a sentence between them: the walk's counter is words; the
  section counter appears twice for the same unit; the step counter is labelled "Step".
