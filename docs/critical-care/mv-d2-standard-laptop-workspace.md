# MV D2 — the standard-laptop Learn workspace

What changed, why, and what was measured. Companion to
[`mv-d0-d1-novice-runway.md`](./mv-d0-d1-novice-runway.md), which named this problem as the next
open item.

The objective was not a visual redesign. It was to let a learner use the existing reasoning
simulator on a 1280 × 720 laptop while the live physiologic evidence and the current decision stay
visible together. No lesson content, sequence, engine behaviour, scoring, or feedback timing was
changed to make the layout easier.

## 1. The measured failure

`scripts/critical-care/measure-mv-learn-layout.mjs` drives Chromium through nine representative
Learn states at four viewports and records geometry. Run it against a dev server:

```bash
MV_LAYOUT_LABEL=before node scripts/critical-care/measure-mv-learn-layout.mjs
```

Pre-change, in the `act` state:

| Viewport       | Shell gives the viewport | Viewport content height | Hidden below the fold | Nested scroll depth   |
| -------------- | ------------------------ | ----------------------- | --------------------- | --------------------- |
| 1600 × 900     | 557 px                   | 948 px                  | 391 px                | 5                     |
| 1440 × 900     | 557 px                   | 948 px                  | 391 px                | 5                     |
| **1280 × 720** | **377 px**               | **948 px**              | **571 px**            | **5**                 |
| 1024 × 768     | 480 px                   | 1078 px                 | 599 px                | 1 (one pane rendered) |

Opening the causal debrief grew that content to 1365 / 1403 / **1421** / 1605 px.

The cause was two rules working against each other. The Learn viewport was
`grid h-full min-h-0 content-start gap-3 overflow-auto p-3` — one scroll container sized by its
content — and inside it the workspace wrapper was `min-h-[40rem]`. So the shared
`ResizableTeachingWorkspace` stood 638 px tall inside a 377 px window. Its three panes each have
`overflow: auto`, but they could only scroll _within_ a block that was itself 261 px taller than
the space it had, so the only way to reach a learner control was to scroll the whole viewport —
which took the ventilator off the top. At 1280 × 720 the "Your turn" card was 10 % visible
(`ratio 0.102`), and in **0 of 9** states were a readable trace and the current task on screen
together.

Three other findings came out of the same pass:

- **Help did nothing visible.** `onHelp` sets `hintVisible`, which renders only inside
  `TaskPanel` — which lives in `TaskDrawer`, a `<details>` that is closed by default. Pressing Help
  changed nothing a learner could see, at any viewport.
- **Pause left the screen.** `VentilationRunControl` was the first child of the "Your turn" pane,
  so it scrolled away with the pane, and at widths where the shared workspace collapses to one
  tabbed pane it was tabbed away entirely while the simulation clock kept running.
- **The debrief pushed the evidence out.** It was appended below the workspace in the same scroll
  container.

## 2. The pane and scrolling strategy

The Learn viewport is now a fixed-height grid that never scrolls. Its rows are the persistent strip
and the workspace, and the workspace row is `minmax(0, 1fr)`:

```
learnViewport  (height:100%, overflow:hidden, rows: auto / minmax(0,1fr))
├─ learnRail   section rail | run control        ← persistent chrome, ~85 px
└─ workspaceFrame (height:100%)                  ← the remaining height
   └─ ResizableTeachingWorkspace
      Ventilator | Teaching | Your turn          ← three independently scrolling panes
```

`ResizableTeachingWorkspace` is `height: 100%`; giving the frame a definite height is what makes
that percentage resolve, and therefore what makes the panes scroll on their own instead of growing.
The conceptual order — live ventilator/waveforms → teaching explanation → learner action — is
unchanged.

Three things moved, and nothing was deleted:

| Was                                                                                                           | Is                                                                | Why                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Patient card inside the viewport (98 px) repeating the context strip's patient description and immediate goal | Case identifier **and title** lead the clinical context strip     | The strip already carried the description and the goal. The title leads the strip because the shared "Current task" pill is absolutely positioned over the strip's right edge. |
| Measurement row below the workspace (80 px)                                                                   | Same seven readings, inside the Ventilator pane under the console | They are readouts of that surface; reaching them no longer moves the current task.                                                                                             |
| `DebriefPanel` appended below the workspace                                                                   | The Teaching pane, during `explain`                               | The debrief _is_ the teaching explanation for that phase, and in a pane it cannot displace the evidence.                                                                       |
| Run control as the first child of the "Your turn" pane (154 px of a 228 px pane)                              | Beside the section rail, in the persistent strip                  | One control, one state, one `aria-pressed`. It now costs the workspace no height and no pane scroll or pane tab can take it away.                                              |

Help now renders its answer in the "Your turn" pane, from the same `hintVisible` state and the same
single Help button — placed after the task it explains and styled tightly so it does not push the
control the learner is about to press out of the pane.

**Laptop density.** `useVentilationWorkspaceDensity` measures the Learn viewport's own box — not
the window, because what matters is the height the shared shell has left after its header, context
strip, and bottom bar, and that is not a function of display size (1024 × 768 has _more_ room than
1280 × 720). Below 500 px it sets `data-mv-density="laptop"`, which:

- tightens the viewport's own gutters and the task card's padding;
- drops the section rail's static "Jump ahead or revisit any section" line and its uppercase
  eyebrow, which repeats the nav's own accessible name — every section button keeps its number,
  short title, full-title `aria-label`, and enabled state, so the rail still gates nothing;
- re-scopes the compact console sizes that previously existed only on the unrouted lab surface, so
  the Learn console stops paying full price for a screen it cannot show.

Nothing scales or transforms: traces and labels stay real vectors and real text at a smaller but
still readable size.

**Viewport cap.** At and below 1199 px the shared shell keeps a 30 rem minimum on the simulation
viewport while its own grid row is shorter — at 1024 × 768 that is a 480 px box inside about
407 px, and because the frames above it clip rather than scroll, roughly 70 px sat behind the
bottom bar. That predates this package and lives in `learning-module-v2.module.css`, which this
module does not own. The hook measures the distance from the viewport's top to the bottom bar's top
and caps the viewport there, so the workspace stays inside the space a learner can see. **This is a
workaround for a shared-shell rule and is flagged for owner review** (§6).

## 3. 1280 × 720 acceptance

Measured in the `act` state after the change:

|                                              | Before                           | After                                         |
| -------------------------------------------- | -------------------------------- | --------------------------------------------- |
| Learn viewport scroll height / window        | 948 / 377 px                     | **377 / 377 px** (does not scroll)            |
| Workspace height                             | 638 px in a 377 px window        | 272 px, fills its row                         |
| Nested scroll depth                          | 5                                | 2 (a 125 px bedside disclosure inside a pane) |
| Readable trace visible                       | 0 px past the fold in 9/9 states | **146 px**                                    |
| "Your turn" objective + controls             | 10 % of the card                 | objective whole, **77–138 px** of controls    |
| Pause visible without scrolling              | no                               | **yes, every state**                          |
| Help produces something visible              | no                               | **yes**                                       |
| Debrief content height added to the viewport | +473 px                          | **0** (it is a pane)                          |
| Document horizontal overflow                 | 0                                | 0                                             |

The acceptance threshold for "a readable trace" is 100 px of visible trace height — the module's own
compact-trace size (`min-height: 105px` in the legacy lab compaction), not a new number.

## 4. Help and pause

- **Pause** is chrome: one `VentilationRunControl`, in the strip, visible without scrolling in
  **36 of 36** measured states — every Learn phase at every one of the four viewports. Semantics,
  `aria-pressed`, the step button, the simulation clock, and `SET_PAUSED` are unchanged.
- **Help** is the shared header button, unchanged, still calling `showHint` — which still persists
  a hint-count checkpoint and fires `recordHintUsed`. Its answer now also renders in the "Your turn"
  pane as `[data-mv-learn-hint]` with `role="status"`. There is no second Help control and no
  second state; `TaskPanel`'s own hint rendering is untouched.
- Opening Help does not move the run control (asserted at all four viewports) and does not cover it
  (they are in different regions).

## 5. Viewport and state results

`node_modules/.cache/mv-learn-layout/<label>/report.json` holds the full matrix and a PNG per
viewport/state. Summary after the change, across nine states × four viewports:

- **Live evidence held in place: 36/36.** The Ventilator pane's `scrollTop` is 0 in every record,
  including every verdict and debrief state.
- **Pause visible without scrolling: 36/36.**
- **Waveform + task together: 32/36 — every state except `predict-verdict`.** In that state the harness
  clicks "Commit prediction", which scrolls the _task_ pane to reach the button; the objective then
  sits above that pane's fold. The evidence pane does not move and the trace stays whole.
- **1600 × 900 and 1440 × 900:** three panes, 432 px workspace, all three traces reachable in the
  ventilator pane, no empty space.
- **1280 × 720:** three panes, 272 px workspace. Accepted tradeoff: the first trace is whole and the
  second and third are one pane-scroll away.
- **1024 × 768:** three panes, 317–375 px workspace, no horizontal overflow inside any pane. The
  Learn viewport's side gutter is dropped at laptop density specifically so this width sits
  decisively on the three-pane side of the shared 960 px threshold rather than two pixels from it;
  the layout spec still accepts the tabbed arrangement if a host's scrollbar pushes it over.

## 5a. Paused-trace annotations

Pause is a persistent learner control and the held trace is part of the evidence surface, so the
labels on it have to be readable. They were not.

The annotations were SVG `<text>` inside `viewBox="0 0 1000 120"` with `preserveAspectRatio="none"`,
so their 9 px nominal size was scaled by `width / 1000` horizontally and `height / 120` vertically —
tall, thin smears that got worse the narrower the workspace became, which is the opposite of what a
laptop layout needs:

| Viewport   | Trace box | Horizontal scale | Nominal | **Rendered width per em** | Rendered height |
| ---------- | --------- | ---------------- | ------- | ------------------------- | --------------- |
| 1600 × 900 | 389 × 159 | 0.389            | 9 px    | **3.5 px**                | 11.9 px         |
| 1440 × 900 | 320 × 159 | 0.320            | 9 px    | **2.9 px**                | 11.9 px         |
| 1280 × 720 | 251 × 159 | 0.251            | 9 px    | **2.3 px**                | 11.9 px         |
| 1024 × 768 | 144 × 145 | 0.144            | 9 px    | **1.3 px**                | 10.9 px         |

The correction keeps the dashed reference lines in the SVG, where they belong — they are positioned
from the data and already use `vectorEffect="non-scaling-stroke"` — and moves the labels out of the
scaled coordinate system into HTML chips laid over the same grid cell. Because they are HTML they
are sized in CSS pixels, so the size on screen is the size declared, at every viewport:

| Viewport   | Chip size   | Chips overlapping | Chips outside the trace | Scroll containers |
| ---------- | ----------- | ----------------- | ----------------------- | ----------------- |
| 1600 × 900 | **10.4 px** | 0                 | 0                       | 5 (unchanged)     |
| 1440 × 900 | **10.4 px** | 0                 | 0                       | 5 (unchanged)     |
| 1280 × 720 | **10.4 px** | 0                 | 0                       | 5 (unchanged)     |
| 1024 × 768 | **10.4 px** | 0                 | 0                       | 6 (unchanged)     |

- **The size is not a new number.** `--wave-annotation-size` is `0.65rem`, the same baseline
  `.waveformLabel strong` already uses for the trace's own channel label. It is deliberately _not_
  compacted at laptop density, so narrowing the workspace can no longer shrink it.
- **Overlap and clipping.** `annotationChipLayout` centres each chip on its own line, then separates
  neighbours by one chip height and clamps them inside the trace. A plateau one cmH₂O under the peak
  — the standing case in an obstructed patient — now reads as two chips instead of one smear. The
  dashed lines stay on their true values; only the chips move.
- **What could not fit inline.** A chip has room beside its line for the name and the value, not for
  the clause that says what the level _is_. Those clauses now read in the console's existing visible
  text equivalent ("Held trace, labelled levels: …"), which appears only while the trace is held.
  Using a surface that already exists means pausing adds no block, resizes no screen, and creates no
  scroll container — the counts above are identical to the pre-correction run.
- **No word of either clause changed**, and the trace's screen-reader caption still carries the full
  labels unabbreviated. Forced colours get an explicit block, because the chip's halo background and
  token ink are dropped by the UA and it would otherwise be text floating over a trace.

Waveform data and engine serialization are untouched: the dump is byte-identical.

## 6. Known limitations and owner review

Found during the render review. The first two are this package's; the rest are pre-existing and are
recorded here rather than fixed, because they are outside D2's scope or outside this module.

1. **The 1024 × 768 viewport cap is a workaround.** `.nativeViewport { min-height: 30rem }` at
   ≤ 1199 px exceeds the row the shell gives it, and `.nativeWorkbenchFrame` clips rather than
   scrolls. MV caps its own viewport in JS to stay inside the visible box. The proper fix is in
   `learning-module-v2.module.css`, which this module does not own. **Owner review requested.**
2. **`predict-verdict` scrolls the task pane past the question.** Committing an answer brings the
   verdict into view and the stem goes above that pane's fold, with no upward affordance. The
   evidence is untouched and the verdict restates the chosen answer. Worth revisiting in a later
   package (anchor the scroll, or keep the stem sticky).
3. **Pre-existing, unchanged by this package:**
   - The shared "Current task" pill is absolutely positioned over the context strip's right edge and
     overlaps whatever lands there. Mitigated here by leading the strip with the case title rather
     than trailing it.
   - Disabled primary buttons measure about 2.1:1. Disabled controls are exempt from WCAG 1.4.3 and
     the enabled variant is fine, but they are the largest elements in the pane.
4. **Copy that assumes all three traces are on screen.** At ≤ 1280 the recognition and observation
   objectives say "all three traces" while one is in the visible pane and the rest are a pane-scroll
   away. Lesson content was deliberately not edited to fit the layout; if this should read
   differently it is a content decision, not a layout one.

## 7. What guards this

| Claim                                                                                                                                                                                                                                                                                                                                | Guard                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewport is a fixed-height grid, does not scroll as one block, ends in a `minmax(0, 1fr)` row                                                                                                                                                                                                                                        | `__tests__/layout-regression.test.ts` via `test-support/learn-layout-contract.ts` — including two tests that reconstruct the pre-D2 rules and prove the contract rejects them |
| Workspace frame has a definite height and no rem minimum                                                                                                                                                                                                                                                                             | same                                                                                                                                                                          |
| Compact console sizes reachable at measured laptop density                                                                                                                                                                                                                                                                           | `layout-regression.test.ts`                                                                                                                                                   |
| Run control is a strip, and carries its own ink                                                                                                                                                                                                                                                                                      | `layout-regression.test.ts`                                                                                                                                                   |
| Evidence and task coexist; pane order; measurements with the console; pause outside the panes in every phase; one pause control; Help answers in the pane in every phase; Help does not hide pause; the verdict does not move the evidence; the debrief is a pane; no pane is remounted across a phase change; identifiers unchanged | `__tests__/learn-workspace.test.tsx` (12 tests)                                                                                                                               |
| Readable trace + task + no viewport scroll + no page horizontal overflow + no pane horizontal overflow, at 1600/1440/1280/1024; Help and pause in every phase; Help never moves pause; a verdict never moves the evidence; pane scroll survives a phase change; no pane trapped inside another scroller                              | `e2e/mechanical-ventilation-learn-layout.spec.ts` (15 tests)                                                                                                                  |
| Paused-trace annotations use the trace-label baseline, are not sized in a pane-scaled unit, share the trace's grid cell, and survive forced colours; chip placement separates and contains adversarial levels; the full clause is shown in a visible text equivalent and in the caption                                              | `__tests__/waveform-annotations.test.tsx` (15 tests; `annotationChipLayout` is pure and exported)                                                                             |
| Rendered chip size at least 10px, no chip overlap, no chip outside the trace, at 1600/1440/1280/1024 while paused                                                                                                                                                                                                                    | `e2e/mechanical-ventilation-learn-layout.spec.ts`                                                                                                                             |
| No engine change                                                                                                                                                                                                                                                                                                                     | `npm run dump:mv-waveforms` byte-identical to the pre-change baseline                                                                                                         |
| D0/D1 corrections                                                                                                                                                                                                                                                                                                                    | the existing 20 MV suites, all green (486 tests)                                                                                                                              |
