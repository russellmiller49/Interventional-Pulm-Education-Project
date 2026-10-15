# Mechanical ventilation and hemodynamics: both Learn pathways in the ECMO format

Owner feedback, 2026-10-15; plan approved by the owner and implemented in five slices
(shared kit, hemodynamics cases, ventilation console and host, ventilation sections 1–5,
ventilation clean-up). This page is the record of what the plan asked for and what was built.

## Why

- **Mechanical ventilation.** Section 1 was a wall of text; it was unclear what to look at; some
  copy did not read the way clinicians talk. The console, the "experiment" panel and the one-breath
  inspection were three ways to meet the simulator, two of them behind disclosures. The owner
  asked for the ECMO format, with the one-breath teaching inside the console.
- **Hemodynamics.** The cases were good but sat outside the sections: from a section the learner
  jumped to Practice, and from the case there was no way back.

Owner decisions:

1. Hemodynamics: each paired case becomes the embedded last task of its section; Practice stays
   as the list of all cases.
2. Hemodynamics: one case per section (table below).
3. Mechanical ventilation: shell and console rebuild for all 14 sections; copy re-sequence and
   clinician-voice rewrite for sections 1–5 only (6–14 keep their copy for a later pass).

## Shared stage kit (`src/features/learning-module/stage/`)

- `NowCard` takes `pinActions` (the action row rides the bottom of the view,
  `[data-now-footer="pinned"]`) and `primaryBeforeContent`. A card without either renders as before.
- `FlowContent` — teaching beside the visual, visual-first or stacked; lifted from ECMO's
  `ActivityContent`, which keeps its own copy.
- `FitWidthSurface` — lifted from ECMO, which keeps its own copy.

## Hemodynamics: the case is the last task of its section

| #   | Section                 | Last task                                                    |
| --- | ----------------------- | ------------------------------------------------------------ |
| 1   | why-measure             | none (orientation)                                           |
| 2   | pressure-system         | HD-08                                                        |
| 3   | waveform-interpretation | HD-04                                                        |
| 4   | waveform-components     | HD-07                                                        |
| 5   | catheter-advancement    | HD-03                                                        |
| 6   | pawp-capture            | HD-06                                                        |
| 7   | thermodilution-series   | HD-01                                                        |
| 8   | derived-hemodynamics    | HD-05; HD-02 offered on the completion card as a second case |
| 9   | pac-signal-validation   | none new (already runs HD-08's patient; Assess opens HD-07)  |

- `HemodynamicCaseActivity` has an `embedded` variant: no module frame, a one-line strip naming
  the case and its section, Exit case and the end of the case return to the section, whose
  completion card then shows. The `nextLearn` query is gone.
- One engine at a time: on the case step the section's patient stops ticking
  (`useHemodynamicsStageSession(initial, running)`) and its monitor and docks are not mounted.
- Section minutes include the case (about 10 min each; corrected after launch).
- The thermodilution link, the accordion's case chips and the hub's "Open the cases" no longer
  leave the section; `/icu-hemodynamics/practice?case=HD-0x` still opens any case on its own page.

## Mechanical ventilation

### One console, one clock

- `MechanicalVentilatorConsole` always draws the native facsimile. The slider "teaching interface"
  and the hidden full-console toggle are gone. New props: `mode` (`observe` disables every therapy
  change and keeps the screens navigable), `guidedControlId` (marks one control,
  `data-guided-help`), `inspection` (a frozen breath drawn in the trace slot of the main screen),
  `onPendingChange` (the knob-and-confirm consoles report a pending edit).
- Stable ids in `content/consoleControlIds.ts` (`mv-control-*`, `mv-screen-*`, `mv-hold-*`,
  `mv-mode-*`, `mv-knob`, `mv-clock-*`, `mv-action-*`, `mv-quick-*` for the teaching patient).
- `VentilationClockBar` (Run/Pause, One breath, speed, model time, a frozen/live badge) is the only
  transport on the page.
- Paused, the console holds one breath still for reading: the marked baseline on a marked question
  (its evidence sentence withheld until the prediction is committed), the baseline on a
  pause-or-inspect task, the opening breath before anything has run, and the learner's last breath
  after. Live, it draws its own traces.

### Guided tasks and capture

- `content/guidedConsoleTask.ts` resolves each goal to the control id and one sentence in the
  selected console's labels and units, including "press the knob" / "press ACCEPT" on the three
  consoles that hold an edit. `satisfied` is `labGoalMet`.
- A setting goal is met when the console shows the goal's value in its own units: the PB980 sets
  rise time as a percentage and the AVEA on a 1–9 scale, so "rise time 100 ms" is that console's
  nearest step (before this, Section 12's first task could not be completed on those two).
- `RUN_AND_CAPTURE` runs the response interval in the live clock's 0.1-s steps and captures through
  `COMPARE`; its events equal a live run's. A live run that reaches the gate captures by default,
  and is held when the comparison no longer isolates one change.
- `content/stepCompletion.ts` says when each kind of step is performed.

### The host

- Shared `SectionHeader` and `SectionsDrawer`; one pinned Now card per task (`Task N of M · Part x
of 2`, one instruction, Back under the kicker, "Why this matters"); `FlowContent` with the
  teaching column beside `VentilationConsoleSurface` (clock bar, one-line breath map, console,
  readings, and only the side cards a round needs); "What this section is for" on the first task;
  "Tasks in this section" opens any task; the last task's primary action is Continue to the next
  section.
- A saved position past the end of a reorganised section reopens at the first task and says so.

### Sections 1–5

- Section 1 is eight tasks: why a ventilator exists (console running), watch one breath, the
  marked phase at A, pause or inspect expiration, the explanation, the marked phase at B, inspect
  inspiration, the explanation.
- The marker sentence ("gas moving out … volume falling") is withheld until the prediction is
  committed; Section 1's deny patterns cover it.
- Copy for sections 1–5 rewritten in an attending-to-fellow voice; clinical meaning, numbers and ids
  unchanged.

### Removed

`VentilationExperimentPanel`, `VentilationTaskWorkbench`, `VentilationSimulatorPane`,
`VentilationTaskWorkspace`, `VentilationCaseLayout`, `useVentilationLabProgress`,
`useVentilationLearningProgress`, the ignored `renderer` prop and the `ventilationLearnV2` flag.

## Design decisions recorded

- Compliance/resistance and bedside interventions stay as small cards beside the console; they are
  not ventilator controls on any of the four devices.
- Auto-capture is the default, held on confounds — a deliberate change from the earlier opt-in.
- Below the console's own minimum width it scales via `FitWidthSurface`; the clock bar and the Now
  card stay full size.
- Instructions use each device's `controlLabels` and `commitBehavior`; the Evita's white screen has
  its own highlight and frozen-breath palette.

## Follow-ups not in this work

- `src/features/critical-care/progress/adapters/hemodynamics.ts` reads only the old v1/v2 ledgers,
  so self-paced hemodynamics progress never reaches account sync.
- Ventilation sections 6–14: the same copy pass as sections 1–5.
