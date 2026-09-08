# Shared stage items — the 2026-09-08 round

Branch `claude/critical-care-shared-and-hub`, cut from `origin/main` at `12186250` (the merge of
PR #133). Part A of the shared-and-hub brief; Part B is
[`hub-organisation-record.md`](hub-organisation-record.md).

Five learner-review rounds had just landed — ECMO (#128, #130), hemodynamics (#131), MCS (#132),
MV (#133) — each scoped to one module, and each left behind anything that touched the shared
`src/features/learning-module/` package or crossed a module boundary. This round takes those three
items. Every claim in the brief was checked against `12186250` before anything changed; where a
claim had gone stale the table says so and nothing was manufactured to match it.

## Point by point

| The brief said                                                                      | Found on `12186250`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | What shipped                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 — the other three hosts still focus the Now card with nothing scrolling the pane | True for hemodynamics (`HemodynamicsStageHost.tsx:256`) and MV (`VentilationStageHost.tsx:243`). **Stale for MCS**: `McsStageHost.tsx:281` had scrolled its `role="region"` to the top since `79691ec8` (2026-09-05), two days before ECMO's R6 — the MV record's "MCS still has it" was wrong. The second sites the brief listed (hemodynamics `:560`, MV `:503`) are the "Show me where" spotlight, which focuses a simulator control and scrolls it into view on purpose; ECMO's own drill host leaves its twin alone (`DrillStageHost.tsx:382`).                             | The shared `StageLayout` returns the Steps and Teaching panes to their tops when `stageId` changes — SH-OD-1. ECMO's copy of the layout does the same through the shared function. ECMO's `scrollTaskPaneToTop.ts`, both ECMO host calls and MCS's region scroll are gone; hemodynamics and MV needed no host change at all. One implementation, five hosts.    |
| A1 — check whether the _teaching_ pane has the same defect (R6's open question)     | **It does.** Hemodynamics at 1024 × 768: the Teaching pane is 4 115 px tall in a 456 px viewport. Scrolled to 1 500 and advanced Recognize → Predict, it stayed at 1 500 with the block the new phase foregrounds 1 470 px above the fold. ECMO the same (500 → 500) while its Steps pane, fixed in R6, correctly went 300 → 0.                                                                                                                                                                                                                                                  | Both panes reset. The Simulator pane is deliberately not — SH-OD-2.                                                                                                                                                                                                                                                                                             |
| A2 — two implementations of "here are the other answers"                            | True, but the shared card was further along than the brief allowed: `ChoiceReasoningFeedback` already carried `frames` and `outcome="stated"`, and ECMO already passed both, so only the folded list was module-local. `ECMO_VERDICT_FRAMES` are `AnswerVerdict`'s four titles plus a full stop, byte for byte.                                                                                                                                                                                                                                                                  | ECMO's foundation host passes `alternatives={item.choices}`; `EcmoOtherAnswers.tsx` and its six stylesheet rules are deleted. The vocabulary is `answerVerdictFrames`, exported from `AnswerVerdict` and derived from its own title table so a copy cannot drift — SH-OD-3. The verdict framing is unchanged and was read back from the browser after the swap. |
| A2 — showing them must stay a per-activity choice                                   | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | It is the `alternatives` prop, per call site. ECMO shows them on foundation predictions and transfers and not on story problems; MCS on all three of its surfaces; hemodynamics and MV on neither. The policy question is in "Left for an owner decision".                                                                                                      |
| A3 — 11 reads of `var(--muted…)` in ECMO's stage stylesheet                         | All 11 are `color: var(--muted, #9fb4b7)`; none is `--muted-foreground` inside `hsl()`. From `.workspace` down `--muted` is `192 36% 16%`, so the declaration is invalid and dropped: pane captions, step phases, the objectives summary and boundary notes rendered `rgb(234, 244, 244)` — the full-brightness ink — where `#9fb4b7` was meant. The header (`.sectionsPosition`) and footer reads sit outside the workspace, where `--muted` is still the shell's colour, and were already right. The shared stylesheet documents exactly this trap; MV and MCS had avoided it. | ECMO captures the shell's colour as `--ecmo-stage-muted` on `.workspaceFrame` and all 11 reads point at it — SH-OD-4. Every measured element now renders `rgb(159, 180, 183)` = `#9fb4b7`.                                                                                                                                                                      |
| A3 — check the other three modules' stage stylesheets and the shared one            | No bare reads in `lesson-stage.module.css`, `lesson-shell.module.css`, `ventilation-stage.module.css` or `mcs-stage.module.css`. Hemodynamics has one, `.englishFallback { color: var(--muted) }`, on its module shell where `--muted: #9fb4b7` — outside the workspace, correct.                                                                                                                                                                                                                                                                                                | No change.                                                                                                                                                                                                                                                                                                                                                      |

## SH-OD-1 — the layout owns "a new step starts at the top of its panes"

Every host already passes `stageId={activeStep.id}` to its layout, and a pane belongs to the
layout, not to a host. Wiring the reset from the hosts would have been the fourth and fifth copies
of the same effect, and three implementations already existed on `12186250`: ECMO's helper, MCS's
`scrollTo` on the region, and nothing. So `StageLayout` (shared) and ECMO's copy of it each run one
effect on `stageId` that calls `scrollStagePaneToTop` for the Steps and Teaching panes. The hosts
keep the focus move; focus is theirs.

The function is ECMO's R6 helper lifted into `learning-module/stage/` with one addition: it stops
at the document and never scrolls it. Below the fixed-workspace viewport the panes stack and the
document is the scroller, and a step change yanking the page to the top is the jump R6's own
comment names as the thing to avoid. `scroll-stage-pane-to-top.test.ts` pins that; the layout
tests pin the two panes resetting and the simulator staying put.

Renamed `scrollStagePaneToTop` (it serves both panes now). R6-OD-1 refers to it by the old name.

## SH-OD-2 — the Simulator pane is left where the learner put it

Its scroll position is part of the state the learner is working in — a control they scrolled to,
a trace they are watching — not a reading position that a new instruction supersedes. Observed
during verification, so nobody attributes it to the reset later: MV's simulator pane moved from
120 to 190 on the step change with no reset applied to it. That is the browser's scroll anchoring
answering the pane's own content reflow at Predict; the reset only ever writes zero.

## SH-OD-3 — the verdict vocabulary lives in `AnswerVerdict`, and ECMO imports it

R5's decision to frame ECMO's verdicts in `AnswerVerdict`'s words stands unchanged — the four
strings are identical to the byte, full stop included. Only where they live moves: a hand-typed
copy beside a component that does not use it was how the two cards would eventually disagree.
`answerVerdictFrames` is derived from `verdictCopy` at module load, so it cannot say anything the
drill card does not. `ChoiceReasoningFeedback.test.tsx` asserts the four sentences and that the
card prints them after the stated outcome.

## SH-OD-4 — ECMO reads its captured colour, not `hsl(var(--muted))`

The brief's suggested fix, wrapping the reads in `hsl()`, would have produced `hsl(192 36% 16%)`:
the workspace's muted _background_, dark text on a dark pane. The right token for muted text is
the one the shared shell publishes as `--stage-muted` — the module palette's `#9fb4b7`, captured
on the shell before the workspace redefines `--muted` as a triple. ECMO keeps its own shell, so
its stylesheet captures its own on `.workspaceFrame`, the same mechanism; the eleven reads carry
the same `#9fb4b7` fallback as before for the two that sit outside the frame.
`hsl(var(--muted-foreground))` was considered and rejected: `190 14% 74%` is near the module's
`#9fb4b7` but not it, and it would have been a second mechanism beside the shell's.

## Verification

Dev server run from this worktree on port 3125 (checked in the tab's URL before every reading),
viewport 1024 × 768, one real step change per module driven from the Now card's own primary.
`scrollTop` before → after the step change:

| Module, section                    | Pane      | On `12186250`                                     | With this round                                                  |
| ---------------------------------- | --------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| hemodynamics, `why-measure`        | Steps     | 300 → 300; Now heading 187 px above the pane top  | 300 → 0; heading in view, 113 px down (under the sticky caption) |
|                                    | Teaching  | 1 500 → 1 500; first foregrounded block −1 470 px | 1 500 → 0; first foregrounded block at 30 px, in view            |
|                                    | Simulator | 218 → 218                                         | 218 → 218                                                        |
|                                    | Document  | 0 → 0                                             | 0 → 0                                                            |
| MCS, `mcs-foundations-signals`     | Steps     | region scroll already present (code reading)      | 300 → 0                                                          |
|                                    | Teaching  | not scrolled by anything                          | 250 → 0                                                          |
|                                    | Simulator | —                                                 | 150 → 150                                                        |
| MV, `breathing-with-support`       | Steps     | not scrolled by anything                          | 300 → 0                                                          |
|                                    | Teaching  | not scrolled by anything                          | 400 → 0                                                          |
|                                    | Simulator | —                                                 | 120 → 190 (SH-OD-2)                                              |
| ECMO, `why-extracorporeal-support` | Steps     | 300 → 0 (R6-OD-1)                                 | 300 → 0                                                          |
|                                    | Teaching  | 500 → 500                                         | asserted at 0 in `foundation-workspace-layout.test.tsx`          |

A3, computed `color` inside ECMO's workspace, same section:

| Element                      | On `12186250`                            | With this round                |
| ---------------------------- | ---------------------------------------- | ------------------------------ |
| pane caption (`.paneLabel`)  | `rgb(234, 244, 244)` — the inherited ink | `rgb(159, 180, 183)` = #9fb4b7 |
| step phase (`.stepPhase`)    | `rgb(234, 244, 244)`                     | `rgb(159, 180, 183)`           |
| objectives summary           | `rgb(234, 244, 244)`                     | `rgb(159, 180, 183)`           |
| boundary note                | `rgb(234, 244, 244)`                     | `rgb(159, 180, 183)`           |
| `.sectionsPosition` (header) | `rgb(159, 180, 183)` — already right     | `rgb(159, 180, 183)`           |

A2, the same section at Predict after committing the unsafe choice: the disclosure exists, sits
inside the shared card, holds three rows, is folded, and its summary reads "Why the other answers
do not fit"; the card opens "Not correct, and unsafe. Stopping here — this could harm a real
patient." — before and after the swap.

Tests added: `scroll-stage-pane-to-top.test.ts` (4), `stage-layout.test.tsx` (+2),
`foundation-workspace-layout.test.tsx` (+1), `ChoiceReasoningFeedback.test.tsx` (+4). Full
suites on the final tree: `npm run lint` 0 errors (15 warnings, identical to the baseline run on
`12186250`), `npm test` 743 suites / 11 426 tests, `tsc --noEmit` clean.

## Reported, and correct as it stands

- **Hemodynamics `:560` and MV `:503`** — the spotlight's focus-and-scroll-into-view of a
  simulator control. Not a step-change site; it does what ECMO's drill host does. Unchanged.
- **Hemodynamics `.englishFallback { color: var(--muted) }`** — module-shell scope, where the
  token is the colour. Unchanged.
- **The other answers fold shut.** Rubric §5 asks that what an instruction promises be open at the
  step, not folded; the instruction here says "read why the other answers do not fit", which a
  labelled disclosure the learner opens satisfies as R5 and R6 shipped it, and the shared card's
  own test pins `open === false`. Unchanged; listed below for the owner because the rubric and the
  shipped behaviour do not obviously agree.

## Left for an owner decision

1. **Whether every critical-care activity shows the other answers.** Today it is per call site:
   ECMO's foundation predictions and transfers do, its story problems do not; MCS does on all
   three of its surfaces; hemodynamics and MV do on neither of their `ChoiceReasoningFeedback`
   surfaces (their drills render `AnswerVerdict`, which has always offered it). The mechanism is
   one prop; the policy is yours.
2. **Folded or open**, above.
3. **The shared Now buttons have no hover state** (`lesson-shell.module.css`, `.nowPrimary` and
   `.nowSecondary`: focus-visible only). The MV record left it as "four modules' to change";
   hemodynamics and MCS have since patched it locally with `[data-now-primary]:hover` rules. A
   shared rule would retire both local ones. Outside this brief's three items; not done.

## Not fixed, and still on the list

Everything in the four module records' own "left for a next round" sections. Nothing new from
this round beyond the three owner questions above.
