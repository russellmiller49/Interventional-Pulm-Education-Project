# Mechanical circulatory support: Learn in the ventilation and hemodynamics workspace

October 2026. The owner asked for the lessons and structure of the past week's ECMO, mechanical
ventilation and ICU hemodynamics work to be applied to the mechanical circulatory support (MCS)
module. This page records what was carried over, from which pull request, and what was left for
later.

## Sources of the pattern

| PR         | Module                           | What MCS takes from it                                                                                                                     |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| #399, #400 | ECMO (tester feedback)           | pinned way forward, no control that cannot act, question over its map, changed rows lit, no notes about the simulator in place of teaching |
| #401       | Shared stage kit                 | `NowCard.pinActions`, shared `FlowContent`                                                                                                 |
| #403       | Mechanical ventilation           | one clock on the page, task card "Task N of M", "Tasks in this section"                                                                    |
| #412, #413 | Ventilation, hemodynamics layout | text left, simulator right, each pane scrolls, page locked; one pane below 75rem                                                           |
| #414       | Site header                      | already site-wide; the MCS workspace sits under the measured header height                                                                 |

## What changed

### Layout (from #412 and #413)

- The section is the hemodynamics shape: `div[data-lesson-shell][data-critical-care-activity-shell]`
  with the section header, then the task body as the shared `FlowContent` — the text column
  (`[data-flow-teaching]`) and the simulator (`[data-flow-visual]`).
- `McsModuleFrame` is in activity mode without `flowing`, so it declares
  `data-learning-scroll-owner="workspace"`: from 1024 × 700 the page does not scroll and each
  pane does. Practice and the integrated cases keep `flowing` and the document scroll.
- Two panes only `@container mcs-activity (min-width: 75rem)` (24–30rem text from 90rem). Below
  that — a 1024–1240 px window, or enlarged text — the task body is one scrolling column, text
  first. The one-pane rule outweighs the shared stage's 1100 px two-column rule (0,5,0 against
  0,4,0).
- The text column is block flow, not a grid (the ventilation module measured 11.9 s to first task
  with a grid there). Both panes are `position: relative`.
- Sources end the text column in the desktop workspace (`useWorkspaceLayout`), and follow the task
  body below it.
- In a wide simulator pane (`@container mcs-visual (min-width: 52rem)`) a task that reads or answers
  on the circulation map keeps the map in the left half and its controls, readings and monitor
  beside it, so a control and what it changes are on one screen (owner rule, 2026-10-04).
- The three-pane `StageLayout` branch and the `MCS_TASK_PRESENTATIONS_ENABLED` switch it hung on
  are removed; `McsTaskPresentation` now orders only the text (teaching and task), per kind of
  task, and the simulator always has the right-hand pane.

### The task card (from #401, #403 and the ECMO tester)

- Kicker `Task N of M`; "Back to previous task" under it; "Why this matters" on request.
- One way forward, pinned to the foot of the text pane (`pinActions`): Continue; Next stop on the
  walk; "Continue to the next section: …" on the last task. The step bar that repeated Continue
  above the card is gone.
- The answer row draws only what can act now: Check answer once a choice is made, Show/Hide
  answer on a question until it is answered, Hint while it is open, Try again once there is an
  answer. Nothing is drawn while an earlier task is being looked at.
- "What this section is for" on the first task, "Tasks in this section" on every task (any task
  opens from it), the recap and the paired case on the last.

### One clock (from #403)

- `McsClockBar` at the head of the simulator: Run/Pause, One cardiac cycle, the time, the alarm,
  and the device, setting, displayed flow and mean pressure. It replaces the "Display playback"
  disclosure, the run line and "Run details" over the card, and the context strip above the
  lesson. "All device controls" (the old "Explore all supported controls") moves from the text
  column to the foot of the simulator, still mounted only when opened.

### From the ECMO tester's reports (#399, #400)

- A place question is asked over the map it is answered on (`[data-map-question-callout]`), and
  the map lights nothing until it is answered: the section's numbered stops were a hint and their
  numbers sat beside the answer pins' numbers. The code's own comment already said so; the
  condition did not.
- Before-and-after tables light the rows that changed and dim the rest (`data-changed`).
- Notes about the simulator in place of teaching are removed: the per-task status lines
  ("Optional self-check · …", "Optional model exercise · …"), the two boundary notes in the
  simulator pane, "Provided reference account", "This records an interpretation of modeled
  results…", "This is a model observation…", "Reset this model exercise … not clinical
  repositioning", "Drawn from: …", the map's "teaching schematic" footnote, "Derived teaching
  value" and the other "Modeled …" provenance lines under the readings. The module keeps its one
  boundary statement, in the frame.
- Two instructions that pointed at "the Controls under the monitor" now say "under Controls for
  this task".

## Verification

- A Playwright walk of all 76 task views at 1660 × 900, 1440 × 900 (two panes), 1024 × 768 and
  1440 × 900 at 200 % text (one pane) and 390 × 844: the page never scrolls in the workspace, the
  pinned Continue is always on screen, the text is always beside or above the simulator, nothing
  overflows its pane, no console errors.
- `e2e/mcs-learn-workspace.spec.ts` (new, 5 tests) and the six existing MCS specs: 94 of 94 pass
  against a local dev server with `MCS_E2E_BASE_URL` set (the specs default to ports nothing
  serves). On clean main the six specs gave 76 pass / 17 fail; the 17 were stale copy and model
  values from the teaching-first round (0be5dda9), and are repaired here — including the unloading
  example's filled-state LVEDV, which that round's recalibration moved from 118 to 116 mL.
- `e2e/systemic-ux-stabilization.spec.ts`: the MCS owner is now `workspace`, and its scroller
  finder skips the content of closed disclosures, which Chrome still lays out (it had picked MCS's
  closed Sections drawer). The crrt, mv, mcs and ecmo rows pass at 1600, 1440 and 1024; the three
  bbt rows fail on main with the unmodified helper as well.
- Jest: `src/features/mechanical-circulatory-support` (with the new
  `stage-layout-text-left.rendered.test.tsx`), its routes, `src/features/critical-care` and
  `src/features/learning-module`: 98 suites, 1,546 tests. `tsc --noEmit`, ESLint and Prettier clean.

## Not in this work

- **The paired case as the section's last task.** Hemodynamics embedded each paired case as the
  last task of its section (#402, an owner decision). MCS still sends the learner to Practice from
  the last task ("Take it to a patient case"), and the case has no way back to the section.
- **The hub.** ECMO's hub now opens on one thing to do with the rest under "About this module"
  (#399). The MCS hub still leads with the audience, objectives, a personal-history card and five
  folded reference blocks.
- **Practice and integrated cases** keep their copy ("Privacy boundary", "BOUNDED CONTROLS", "No
  prediction submitted.").
- **Pointing at a control from the text** (ECMO's `onPointControl`) is not carried over; the
  task's own control is still highlighted.
