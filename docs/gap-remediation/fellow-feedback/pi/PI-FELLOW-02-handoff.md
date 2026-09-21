# PI-FELLOW-02 — Peripheral Imaging: the figure, the instruction and the control together

Implementation: September 20, 2026. Prepared by Claude (AI implementation).

**Result: all seventeen assigned findings were reproduced on the current build and repaired.** None
was already resolved, none failed to reproduce, and none is blocked on a source or owner decision.
Four things that came up along the way need the owner's eye and are listed under
[Draft-review decisions](#draft-review-decisions); none of them blocks this PR.

The change is PI-local and presentational: where things sit, what colour they are, how the 3D
camera takes input, where labels are drawn, two optional viewing aids and one enlarged graphic. No
clinical claim, source record, question, option, answer key, rationale, authored example, lab goal,
metric, equation, unit, pulse parameter, image asset, progress key, release flag, clinical-review
hold or storage schema was changed; no learner state is read, reset or written differently; and
nothing about the self-paced contract was relaxed.

**Evidence provenance.** Every source row comes from _Peripheral Bronchoscopy Imaging — First-Year
Fellow Walkthrough Feedback Log.pdf_ (48 pages, dated September 18, 2026), an **AI-assisted browser
walkthrough written in a first-year-fellow persona**. It is not a learner study, not participant
data, and not clinical, media or device approval. "Reproduced" below means an agent reproduced the
application behaviour on a local build at the SHA below — not that a human learner met it.

## Scope and baseline

- Task file `02_PI_WORKBENCH_AND_VISUALS.md`, with `00_START_HERE.md`, `FEEDBACK_LEDGER.md`,
  `SOURCE_CONTEXT.md` and the PDF, read at
  `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/module_update_9_19/PI_Claude_Implementation_Pack`.
- Branch `claude/pi-2-9-19`, worktree `Interventional-Pulm-Education-Worktrees/claude-pi-2-9-19`.
  Starting SHA **`c717c9ffae09cb67e19b06a56d37c75487a5605a`**: `git fetch origin` returned the same
  commit for `HEAD` and `origin/main`, and the tree was clean. It contains the merged PI-FELLOW-01
  (PR #248), so the start condition — batch 01 reviewed and merged — holds. The pack's preparation
  snapshot `77a141cc` was not used as a rollback point.
- **Checkout note.** The harness pins the session to this dated worktree rather than the permanent
  `claude` one. It was clean, level with `origin/main` and owned by no other session.
- Open PRs at the start: #134 (critical-care shared stage and hub), #114 and #98 (literature,
  draft). **None touches a file this batch changes.** Batch 03 had not started; no other session was
  working in PI source.
- Read before implementing: [PI-FELLOW-01](PI-FELLOW-01-handoff.md),
  [SYSTEMIC-UX-01](../../systemic-ux/SYSTEMIC-UX-01-handoff.md) and its
  [post-merge regression](../../systemic-ux/SYSTEMIC-UX-01-postmerge-regression.md),
  [SYSTEMIC-UX-02](../../systemic-ux/SYSTEMIC-UX-02-handoff.md), the
  [G02 PI consolidated release audit](../../self-paced/G02-PI-consolidated-release-audit.md),
  [PI-FOCUS-01](../../self-paced/PI-FOCUS-01-handoff.md),
  [PI-OUTLINE-01](../../self-paced/PI-OUTLINE-01-handoff.md),
  [PI-WRAP-01](../../self-paced/PI-WRAP-01-handoff.md) and
  [PI-HELP-01](../../self-paced/PI-HELP-01-handoff.md).
- SYSTEMIC-UX-01's comparison layout (projection, C-arm and controls in adjacent columns) was
  **extended, not replaced**: it is untouched, its own browser checks still pass, and the component
  walk and the multiplanar workbenches — which it did not cover — now follow it.
- Storage mode for every finding: anonymous, local, `ip-peripheral-imaging-self-paced-v1` only. No
  finding here involves stored state, and no probe seeded any.
- Evidence retained outside Git at
  `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/pi-fellow-02-2026-09-20-c717c9ff/`
  (`before/`, `after/`, `probes/`, `production-build.log`, `beta/`).

## Disposition of every assigned source ID

All rows: direct route on a local build, anonymous, 1280 × 900, dark, unless the row says otherwise.

| ID       |  PDF page | Route · section · task                                                          | Status                    | What the current build did → what changed                                                                                                                                                                                                         |
| -------- | --------: | ------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O3**   |         4 | `/peripheral-imaging` · Before you start                                        | **Reproduced → repaired** | Heading alone in the left half of a two-column card, five entries stacked in the right half. Heading now leads; the entries share the card's width in two columns.                                                                                |
| **O5**   |         5 | `/peripheral-imaging` · suite picture                                           | **Reproduced → repaired** | Components named only in the caption. Six short labels now sit on the picture at **model-computed anchors** (see [O5](#o5--on-figure-labels-from-the-model)). Caption kept as the text equivalent.                                                |
| **1.9**  |        13 | `learn?section=imaging-questions` · activity 4, after Check                     | **Reproduced → repaired** | "Why the other answers do not fit": `rgb(159,180,183)` at 14 px on a lightened panel. Now body ink `rgb(234,244,244)` at 16 px. PI-local; the shared verdict is not edited.                                                                       |
| **2.2**  |        16 | `learn?section=chain-walk` · activity 2                                         | **Reproduced → repaired** | A 350 px wheel over the scene left `scrollY` at 0. The wheel now always scrolls the page; zoom and rotation are explicit buttons. See [B](#b-wheel-and-camera).                                                                                   |
| **2.3**  | 17 (p.23) | same                                                                            | **Reproduced → repaired** | Scene at y = 448, component text at **y = 1739**, 0% on screen, and still 0% after each "Next component". Text now beside the scene at y = 406. See [A](#a-the-learning-loop-per-workbench).                                                      |
| **2.4**  | 17 (p.25) | same · scene labels                                                             | **Reproduced → repaired** | Pins parked in two edge columns with leaders across the figure; "Tool tip" over "Authored target" by 45 × 12 px. One layout pass now places every label beside its own object; zero overlaps in every preset.                                     |
| **2.5**  | 18 (p.25) | same · view buttons                                                             | **Reproduced → repaired** | Beam view drew all six labels at one point; Anterior shows the detector's back; Step's effect was invisible. **No preset removed**: each now states what it shows, labels no longer pile up, and Step says what it steps.                         |
| **2.9**  |        19 | `learn?section=projection` · activity 1 (every demonstration)                   | **Reproduced → repaired** | Cue at y = 1072, under the figure and controls, 0% on screen. Now first, at y = 484, above the figure.                                                                                                                                            |
| **2.10** |        20 | every interactive screen                                                        | **Reproduced → repaired** | Dock `rgb(247,250,250)`, cue `rgb(237,246,245)`, example buttons `#f0f7f7` inside the dark shell. All read the host palette now (dock `rgb(16,38,43)`). Image pixels untouched.                                                                   |
| **2.13** | 21 (p.27) | `learn?section=good-image` · activity 4                                         | **Reproduced → repaired** | Footer said "the changes listed below"; the list was at y = 1149, 0% on screen, 750 px under the controls. It now leads the control dock (y = 427, fully on screen) and the footer says "listed with the controls".                               |
| **2.15** |        21 | every section · footer                                                          | **Reproduced → repaired** | `rgba(10,32,40,0.97)`. Now `rgb(10,32,40)`. Position, size and the measured focus clearance are unchanged.                                                                                                                                        |
| **3.8**  | 31 (p.32) | `learn?section=time` · activity 1                                               | **Reproduced → repaired** | Six-pulse strip 114 px across in a 1222 px card; captions drawn inside the SVG. Strip now 259 px at the same default values, captions are ordinary text at one size, and the readouts a change moved are marked. See [3.8](#38--the-pulse-strip). |
| **4.2**  | 33 (p.38) | `learn?section=dts-acquisition` · activity 3; `dts-interpretation` · activity 2 | **Reproduced → repaired** | No mark for tool or target. Optional, off-by-default teaching overlay from the model's own coordinates. See [4.2](#42--the-dts-teaching-overlay).                                                                                                 |
| **4.3**  |        34 | same · filmstrip                                                                | **Reproduced → repaired** | Thirteen thumbnails 66 px wide (report: ~45 px). Each now opens the same projection enlarged in place (384 px) with Previous/Next, Escape and focus return.                                                                                       |
| **6.2**  |        41 | `learn?section=tool-confirmation` · activity 1                                  | **Reproduced → repaired** | Controls above the planes here, right of the image in comparison sections, below elsewhere. Multiplanar workbenches now follow the comparison arrangement: image left, controls right.                                                            |
| **6.4**  |        41 | same · activity 2                                                               | **Reproduced → repaired** | The slab replaced the thin planes. With the slab on, each plane now shows its thin section beside the slab through it.                                                                                                                            |
| **PR3**  | 46 (p.47) | `practice?case=…` · before a choice                                             | **Reproduced → repaired** | "Check my answer": `rgb(4,33,31)` at 55% opacity on **no background at all**. Cause and repair in [PR3](#pr3--the-disabled-check-action).                                                                                                         |

## A. The learning loop, per workbench

Each touched workbench's causal triad — the control the learner changes, the output that changes,
and the one instruction saying what to watch — and where it now sits.

| Workbench (example task)                                | Control                    | Output                                    | Instruction                        | Arrangement now                                                                                                                                     |
| ------------------------------------------------------- | -------------------------- | ----------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Component walk** (`chain-walk` activity 2)            | Next component             | the highlighted component in the 3D scene | the current component's card       | Scene left, card right and pinned beside it, Next in the footer. At the beam stop: slider beside the compact projections, directly under the scene. |
| **Projection comparison** (`projection`, `good-image`)  | obliquity / field / zoom   | current projection beside its baseline    | Look-for cue; the step's checklist | SYSTEMIC-UX-01's three columns, unchanged. Cue now above them; checklist now at the head of the control column.                                     |
| **Guided multi-control task** (`good-image` activity 4) | six sliders                | current projection                        | the checklist                      | Checklist leads the dock the sliders are in; ticks where the learner is looking.                                                                    |
| **DTS plane** (`dts-acquisition`)                       | plane depth, sweep         | reconstructed plane                       | Look-for cue; optional overlay     | Plane left, controls right (was: controls below). Filmstrip below, enlargeable.                                                                     |
| **Sampling slab / thin plane** (`tool-confirmation`)    | plane sliders, slab toggle | three planes; thin + slab pairs           | Look-for cue; checklist            | Planes left, controls right (was: controls above). Slab on → matched pairs.                                                                         |

### Measured, on the direct route

Fractions are of the element's height inside the band the pinned header and footer leave uncovered
(1280 × 900: y 233–828; 1024 × 768: y 233–696). They are rendered rectangles, not document
screenshots.

| Component walk                         | 1280 × 900 before |         after | 1024 × 768 before |         after |
| -------------------------------------- | ----------------: | ------------: | ----------------: | ------------: |
| Component text, top edge (y)           |              1739 |           406 |              1757 |           402 |
| Component text on screen, at entry     |                0% |           71% |                0% |           37% |
| … after each of three "Next component" |       0 / 0 / 22% | 66 / 86 / 85% |        0 / 0 / 0% | 41 / 46 / 48% |
| Page scroll caused by pressing Next    |                 — |             0 |                 — |             0 |
| Wheel over the scene scrolls the page  |                no |           yes |                no |           yes |
| Overlapping scene labels               |                 1 |             0 |                 1 |             0 |

At 1024 × 768 the card is 803 px tall in a 331 px column, so under half of it fits the 463 px band:
its heading, the precise statement and "In the suite / What you control here" are on screen with the
highlight, and the checklist and analogy are a short scroll down, with the card pinned so the scene
stays beside it. That is the honest figure, not a claim that the whole card fits.

**Successive changes and post-scroll** are both exercised by the committed test: four "Next
component" presses with `scrollY` held at 0 and the triad re-measured after each, then a wheel down
to the projections and back.

**Beam-geometry stop** (the only stop with a control): with the obliquity slider focused, thirty
arrow-key presses move the caption to "Orbit 30°" and change the current projection's pixels with
no scroll, while the slider (100%), the projection (>95%) and the card (>200 px) are on screen
together. The reduced projection is 230 px, not a thumbnail, and is still enlarged by the browser's
own zoom. **Limitation:** at 1280 × 900 the 3D scene is scrolled out of view at that moment (about
60 px of it on the development build, 11 px on the production build). The slider → projection pair
is the task at that stop and the card stays beside it; watching the C-arm turn in 3D needs a scroll
back up. Shrinking the scene enough to fit all four would make it the thumbnail this batch was asked
not to create.

### Compact and enlarged text

Below 1001 px, and wherever enlarged text has made the activity unpin its chrome
(`data-chrome-pinned="false"`, PI-FOCUS-01's existing measurement), the walk is **one column in
reading order — scene, then its text — with no pinned side column and no fixed-height panel**:
asserted as `position: static` and `scrollHeight == clientHeight`. Checked at 390 × 844, 320 × 740,
1280 × 900 at 200% root text and 390 × 844 at 200% root text; no horizontal page overflow at the two
normal-text widths. A media query cannot see enlarged text (`rem` there is the browser's initial
size), which is why the side-by-side layout is tied to that measurement rather than to a width.

## B. Wheel and camera

- **The wheel belongs to the page, always.** `OrbitControls` runs with `enableZoom={false}`, which
  is also the condition under which it stops calling `preventDefault` on wheel events. There is **no
  camera mode**, so nothing to enter, exit or be left in, and nothing captured on hover.
- **Ctrl/Cmd + wheel is not cancelled**: a synthetic `ctrlKey` wheel on the canvas returns
  `defaultPrevented === false`.
- **Explicit controls**, in the existing view toolbar: Rotate left / right (15° about the vertical
  axis), Zoom in / out (×1.25, inside the rig's existing distance limits) and Reset view. Native
  buttons with accessible names — the first keyboard access the 3D camera has had. Tested with
  Enter and Space; each changes the drawn pixels and Reset restores the preset's exact frame.
- **Pointer**: drag-to-rotate is unchanged and tested.
- **Touch**: the controls write `touch-action: none` inline on connect, which made the figure a
  place a touch scroll could not start. A stylesheet rule now sets `pan-y pinch-zoom`: a vertical
  swipe scrolls the page, a pinch is the browser's zoom, a sideways drag turns the view. Asserted as
  a computed style; **not exercised on a touch device** (see limitations).
- **Presets (2.5)**: all six kept. Each shows a one-line statement of what it is for, including
  what is in the way — e.g. Anterior: "At 0° the detector is nearest you and covers the chest; the
  tube is beneath the table." The test holds that each preset changes the drawn scene, not merely
  the pressed button. **Step** keeps its accessible name and gains a description of what it steps
  in this view ("Rotate the C-arm by one degree", "Advance by one pulse", …), since a one-degree step
  was reported as doing nothing visible.

## C. Annotations and explanatory visuals

### 2.4 / O5 — labels from known anchors

`labelLayout.ts` (pure) places every DOM label of the scene in one pass: beside the projected
position of the object it names, on that object's own side of the figure, then moved — vertically
first — only as far as needed to clear its neighbours and stay inside the figure. A label that has
had to give way keeps a leader to its object. **Anchors are the existing `chainStopAnchors` and
`projectionMarkers`; no anatomy, tool or equipment geometry moves.** "Tool tip" and "Authored
target" now anchor on the tip and the target themselves and leave in opposite directions, so they
are apart even in the frontal view where the two objects are superimposed.

Browser check, all six presets, then a C-arm move to 47°, then a resize to 1024 × 768: eight labels,
**zero overlapping rendered bounds**, every label inside the figure, and every label either within
40 px of its object or joined to it by a leader; in the Suite view the X-ray-tube label is within
60 px of the tube and **below** the detector's label, which is the specific misreading the report
described. Labels are re-laid on every rendered frame, and a `ResizeObserver` requests a frame when
a label's own size changes, so they do not trail their objects through a preset change.

### O5 — on-figure labels from the model

The overview picture is a pre-rendered still, so its labels cannot be laid out live. They are not
placed by eye either: `cameraPose.ts` (extracted unchanged from `CameraRig`) is the pose the still
was rendered with, and `hub-hero.test.ts` projects the suite's own anchor for each component through
it at the still's size and holds the declared percentages to within 0.1%. A re-rendered picture that
moves a component fails that test instead of mislabelling the figure. Labels hide below a 34 rem
picture, where six would not be readable; the caption carries the names at every size.

### 4.2 — the DTS teaching overlay

Optional, **off by default**, a checkbox under the plane. It is an SVG over the canvas; the canvas's
pixels are never drawn on, and the test holds the canvas data URL identical with the overlay on.

- **Coordinates come from the model, and are pinned to their sources by test**: the target's centre,
  radius and the tool's plane from the projection manifest; the tool's extent from the literal the
  generator drew it with (`build-dts-projections.py`: a 1.8 mm cylinder from 60 mm short of the
  target centre to it, 18 mm from the target's plane); the pixel mapping from
  `reconstructTeachingPlane`.
- **Verified against the image**: on the tool's plane, the sharpest thin horizontal structure in
  the reconstructed canvas is on the row the overlay names, inside the bracket (committed check);
  the bracket's ends match the line in the report's own screenshot.
- **Modeled location is not confirmation.** A solid outline is drawn only where the selected plane
  passes through the object (tool: within its 1.8 mm radius, so one slider step away is already out;
  target: within its 9 mm sphere). Otherwise the mark is dotted, dimmer, and says
  "Modeled target · 18 mm from this plane". The note under the image says it is "drawn from the
  model's authored coordinates, not something detected in this image". Outlines are drawn around an
  object, never over it.
- On the planning-CT layer no tool is marked, and the note says why: that CT predates the tool.
- **A check never offers it.** Marking which plane holds the tool would answer the section's own
  question, so the toggle is absent on the fixed example (tested), where Show the explanation
  remains available as always.

### 4.3 — projection thumbnails

A thumbnail is now a button that opens **that same projection** enlarged in place (384 px), with
Previous / Next to step through the sweep and watch the tool shift. The enlarged canvas is a copy of
the thumbnail's own canvas and carries its position and angle ("Projection 1 of 13 · −15°"); the
test holds the two data URLs equal. Not a modal: Escape or Close returns focus to the thumbnail that opened it, even after
Previous/Next changes the displayed projection (corrected during the sanity review below). Native browser zoom is untouched.

### 3.8 — the pulse strip

The strip is 259 px across at the default values, from 114 px. **The scale is fixed, not fitted**:
14 units/mm for the strip and 1,000 for the detail, each chosen so the largest value the controls
allow still fits (40 mm/s at 3.75 pulses/s is 53 mm over six pulses; 40 mm/s for 20 ms is 0.8 mm). A
fitted scale would keep the picture the same size whatever the learner changed, which is the
opposite of the point. Captions are ordinary text at one size. **No equation, pulse parameter, unit
or safety sentence changed**; the drawn numbers are `temporal()`'s own and the "not image lag" and
tube-loading sentences are verbatim.

"Emphasize the current causal readout" is done from behaviour rather than from an authored list: a
readout is marked from the control change that moved it until the next one. Changing pulse width
alone marks exactly the readouts whose values changed and leaves inter-frame travel unmarked
(tested). All readouts remain; none is hidden.

### 6.4 — slab beside thin plane

With "Combine depths into a teaching slab" on, each plane shows its thin section at the slider
position beside the slab through it — same model, same inputs, drawn twice. Three pairs across on a
desktop; one pair per row on a phone, still side by side at >130 px each; stacked only under 22 rem.

## D. Routine presentation polish

O3, 1.9, 2.10 and 2.15 are in the disposition table. Preserved and re-run: PI-FOCUS-01's measured
clearance and enlarged-text unpin, PI-OUTLINE-01, PI-WRAP-01 and PI-HELP-01 — all their committed
browser checks pass unchanged.

### PR3 — the disabled Check action

**Cause.** The practice and integrated-case decisions use the shared action classes, which read
`--stage-*` tokens that only the shared lesson shell defines. PI does not render that shell, so
"Check my answer" had **no background at all** — dark ink on the dark page at 55% opacity — beside a
bright "Show the explanation".

**Repair, PI-local.** The tokens are supplied from the PI palette for `[data-case-decision]`, and
the disabled action is drawn readable (`#c3d6d8` on `#17343a`, above 4.5:1, opacity 1). It is
**natively `disabled` until a choice is made** (tested before and after a choice). The report's
suggestion to "make Show the explanation the quieter of the two" was **not** taken in the sense of
demoting it: the explanation is a first-class way to learn here (PI-01). It is a bordered button
like everywhere else, enabled before any answer, and the test opens it with no answer chosen.

## Tests

All committed. The browser checks were run against a local **development** build on the direct
routes and then against a local **production** build; see the run table.

| File                                                   | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/label-layout.test.ts` (new, 7)              | 2.4/2.5: a label stays beside its object; its object's side; six coincident anchors (beam's eye) separate inside the figure; tip and target never overlap when superimposed; phone width; anchors are never mutated.                                                                                                                                                                                                                                                                                                                                                          |
| `__tests__/dts-overlay.test.ts` (new, 4)               | 4.2: the tool literal and plane depth are the generator's; the plane geometry is the reconstruction's; target centred, tool ending at it; in-plane only where the plane passes through the object.                                                                                                                                                                                                                                                                                                                                                                            |
| `__tests__/hub-hero.test.ts` (+2)                      | O5: every on-figure label is at the model-projected position of its component, to 0.1%; labels on one side are apart.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `__tests__/workbench-loop.rendered.test.tsx` (new, 10) | 2.13: goals go to the pane, not the Now card; a real control change ticks that list; skip still leaves; nothing listed as live while looking back. 2.9: cue precedes the figure (four sections). 2.3: the walk marks itself. Explanation available before an answer with Check natively disabled.                                                                                                                                                                                                                                                                             |
| `e2e/peripheral-imaging.spec.ts` (+16)                 | Every assigned ID in a real browser: wheel, Ctrl+wheel, touch-action, keyboard camera, pointer drag; the walk's triad at three sizes through four changes and a wheel round-trip; the beam stop; label bounds across six presets, a C-arm move and a resize; cue, dark surfaces, opaque footer, checklist geometry and live ticking; pulse strip and marked readouts; DTS overlay truth and pixel agreement, enlargement identity and focus return; no overlay on a check; multiplanar arrangement and slab pairs; PR3, 1.9, O3, O5; four compact / enlarged-text conditions. |
| `test-support/stageHarness.tsx`                        | `goalStates()` reads the checklist from the dock or, for a step with no pane, the Now card. Never both.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Runs — failures and reruns kept distinct

| Run                                                                                                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New browser checks, first run (dev build)                                                                             | **12 of 18 passed.** Three failures were **defects in this change**: `touch-action` was still `auto` (an effect cannot outlast the controls' reconnect — moved to a stylesheet rule); the pulse card's last caption picked up the card's 12 px footnote rule; the walk stayed two-column at 200% text (a `rem` media query does not see root text). Three were **faults in the tests**: comparing pixels across a click on the already-selected preset; a luminance bound that the dark pressed button exceeds; and my own over-specified demand that most of the 3D scene be on screen at the beam stop, now recorded as a limitation instead. |
| Same, second run                                                                                                      | 17 of 18. The 200%-text check had not actually enlarged text: React hydration drops an inline `<html>` style. Switched to the `addStyleTag` method the existing checks use and **added an assertion that root text is 32 px** so it cannot no-op silently again.                                                                                                                                                                                                                                                                                                                                                                                |
| Same, third run                                                                                                       | 17 of 18: label overlap at 200% text, only while the scene was off screen (it draws no frames when not visible). Labels now re-lay when their own size changes, and the check looks at the scene before measuring it.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Whole PI browser suite (dev build), 50 checks                                                                         | **49 of 50.** The failure was a **regression this change caused**: the Step button's accessible name had changed, which an existing check — and any assistive-technology user — relied on. Name restored; the purpose is carried by `aria-describedby`. Rerun of that check: pass.                                                                                                                                                                                                                                                                                                                                                              |
| `jest src/features/peripheral-imaging src/features/learning-module 'src/app/[locale]/peripheral-imaging' --runInBand` | **58 suites, 477 tests passed** (was 55 / 450 at PI-FELLOW-01).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `playwright.systemic-ux.config.ts`, the six `pi:` checks (dev build)                                                  | 6 of 6 — SYSTEMIC-UX-01's projection / obliquity / C-arm adjacency is intact at 1600, 1440, 1024, 390, 320 and 200% text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                                           | Exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `eslint` on changed paths                                                                                             | 0 errors, 0 warnings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `prettier --check` on changed paths; `git diff --check`                                                               | Clean.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Production build and the runs against it                                                                              | See [Production build and the beta-wrapped route](#production-build-and-the-beta-wrapped-route).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Production build and the beta-wrapped route

`NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid
NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only NODE_OPTIONS=--max-old-space-size=8192 npm run build` —
**exit 0**, zero errors, with this worktree's dev server stopped. Values came from the process
environment; no `.env` file was read, written or copied, and nothing was deployed. Known warnings,
all pre-existing and recorded by G02 and PI-FELLOW-01, retained rather than hidden: `metadataBase`
unset (17), embedded training-app chunks over 500 kB, "Compiled with warnings", and Node `DEP0205`.
The build was served with `next start` on `127.0.0.1:3166`.

| Run against the local production build                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole PI browser suite, first run                                          | **48 of 50.** One **test fault**: the walk check read the highlighted pin mid-transition, which the faster production build exposed; it now waits for the highlight to land. One **unsupported claim of mine**: a soft assertion that some of the 3D scene stays on screen at the beam stop held on the dev build (≈60 px) and not here (11 px). The assertion and the claim were removed and the limitation is stated instead; no assertion about the slider, the projection or the text was loosened. |
| Whole PI browser suite, final run                                          | **50 of 50** (34 pre-existing + 16 new), 5.3 min.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `playwright.systemic-ux.config.ts`: six `pi:` checks + nine public entries | **7 of 7.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### The beta-wrapped route

`/en/development-beta/peripheral-imaging`, owner-local mode, the same production build. On the
development server without that mode the wrapper returns 500 (it reaches for Supabase), which is
batch 05's territory; the mode is fixed at build time, so the wrapper was exercised here instead.

The wrapper is a 65 px toolbar over an iframe that holds the module, so the module sees a viewport
65 px shorter. The outer page does not scroll; the iframe's document does (one page scrollbar — the
wrapper's stacked headers, P4, belong to batch 05 and were not touched).

| Component walk, beta-wrapped                 | 1280 × 900 (frame 835 tall) | 1024 × 768 (frame 703 tall) |
| -------------------------------------------- | --------------------------: | --------------------------: |
| Uncovered band (y)                           |                     233–763 |                     233–631 |
| 3D scene on screen at entry                  |                        100% |                         69% |
| Component text beside the scene, on screen   |                60% (357 px) |                28% (229 px) |
| … after "Next component", page scroll        |                     56% · 0 |                     32% · 0 |
| Wheel over the scene scrolls the framed page |                         yes |                         yes |
| Scene labels · overlapping                   |                       8 · 0 |                       8 · 0 |

At 1024 × 768 inside the wrapper the band is under 400 px tall, so the scene itself does not fully
fit at entry; the text is still beside the highlight rather than 1,300 px below it. `beta/beta.json`,
`beta/beta-walk-*.png`.

## Presentation conditions, labelled accurately

| Condition                                   | What it is                                                                | Covered                                                                                                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1280 × 900, dark                            | the report's context                                                      | every assigned ID                                                                                                                                                                                                                                                          |
| 1440 × 900, 1024 × 768                      | window sizes                                                              | the walk's triad; label layout at 1024                                                                                                                                                                                                                                     |
| 390 × 844, 320 × 740                        | window sizes                                                              | stacked walk, label layout, wheel, no horizontal overflow; slab pairs at 390                                                                                                                                                                                               |
| 200% **root text** (`html{font-size:200%}`) | root font enlargement — **not** CSS `zoom`, **not** DPR, **not** tab zoom | walk at 1280 and 390, verified 32 px; plus the pre-existing focus / outline / Help / wrap checks at their own conditions                                                                                                                                                   |
| CSS `zoom: 2`                               | a different test                                                          | only where the pre-existing Help check already uses it; nothing new claimed                                                                                                                                                                                                |
| Native browser tab zoom                     | a different test again                                                    | **Not executed.** Playwright cannot set tab zoom and the in-app browser pane runs hidden in this session, so the 3D scene never signals ready there. G02's native-zoom result at `d8ffd843` stands; this batch does not change scene sizing rules that result depended on. |
| Light site theme                            | the site header's theme                                                   | The PI module shell is dark in both site themes by design, so "both themes" changes nothing inside it; the pre-existing Help check exercises both site themes and passes.                                                                                                  |

## Draft-review decisions

None blocks this PR. Each is a judgement the owner may want to overrule.

1. **Camera: buttons instead of a camera mode.** The task allowed either. A mode needs an entry, a
   visible exit and a way not to be left in it; four buttons need none of that and give the camera
   keyboard access it never had. Wheel-to-zoom over the 3D scene is gone for good unless asked for.
2. **Anterior preset kept, with its obstruction stated.** At 0° it shows the back of the detector.
   It was not removed or made translucent — altering the drawn equipment to suit a label is outside
   this batch. If the owner would rather the detector go translucent in that view, that is a scene
   change to request.
3. **DTS overlay wording** — "Modeled tool · in this plane", "Modeled target · 18 mm from this
   plane", and the note beneath — has had no clinical or editorial review. It asserts nothing about
   a device or a patient, only about the teaching model.
4. **"· changed" on a readout** is new learner-facing text (two words, generated), likewise
   unreviewed.

## What was deliberately not done

- **No score, mastery threshold, attempt count, weighting, penalty or assistance-use tracking.** The
  checklist moved; it is still a list, every step still has its skip, and nothing new is recorded.
- **No gate.** The overlay, the enlargement, the slab pairs and the camera controls are all optional
  and none unlocks anything. The one real prerequisite — an actual acquisition before work is
  claimed as performed — is untouched.
- **No learner record read, cleared, reinterpreted or migrated.** No id, key or schema changed.
- **No image generated, replaced or redrawn.** The overlay is a separate SVG; the hero PNG is
  byte-identical; stored baselines are untouched (PI-FELLOW-01's checks pass).
- **No clinical, source, media, device, human-review or publication status changed.** Draft content
  is still draft. A model-derived overlay agreeing with a model-derived image is not clinical
  validation and is not described as one.
- **Nothing outside Peripheral Imaging was edited** — not the shared `learning-module` stage or
  `AnswerVerdict`, not EBUS, Device Intelligence, Airway Stent Mechanics or ICU Simulation. The 1.9
  and PR3 repairs are PI stylesheet rules around shared components, not edits to them.
- **No paid API call, deployment, migration, external submission, mass deletion or merge.** No
  protected environment file or stored secret was read, written or exposed; the builds used
  `preview.invalid` values from the process environment.
- **G02 was not rerun**, and batches 03–06 were not started. Reports 2.6, 2.7, 2.8, 2.11, 2.14 and
  the other Teaching/Drafts items seen along the way were left for their own batches.

## Limitations

- Developer verification of application behaviour. Not a learner study, not PI-02, not clinical,
  source, media or release approval.
- **Touch and native browser zoom were not exercised on real hardware**; the touch behaviour is
  asserted as a computed style only.
- At the beam-geometry stop at 1280 × 900 the 3D scene is out of view while the slider and
  projection are used; at 1024 × 768 under half of the component card fits beside the scene. Both
  are stated with their measurements above rather than rounded up.
- The Anterior and Beam presets are explained, not redesigned.
- The DTS overlay's horizontal extent was checked against the generator literal and by eye against
  the report's screenshot; only its **row** is held by a pixel check, because the line is too faint
  against lung for a robust automated extent.
- The live deployment was not exercised, and nothing was deployed.

## Files changed

Application (all under `src/features/peripheral-imaging/`):

- `components/suite/CameraRig.tsx` — wheel to the page; explicit camera commands (2.2)
- `components/suite/cameraPose.ts` (new) — the preset pose, pure; unchanged maths (2.5, O5)
- `components/suite/labelLayout.ts`, `SceneLabels.tsx` (new), `ChainPins.tsx`,
  `views/ProjectionView3D.tsx` — one label layout pass from existing anchors (2.4, 2.5)
- `components/suite/SuiteScene.tsx` — camera buttons, preset purposes, Step description, walk layout
  flag, dock placement, DTS monitor props (2.2, 2.3, 2.5, 4.2)
- `components/suite/LabDock.tsx` — checklist leads the dock; changed-readout marking (2.13, 3.8)
- `components/suite/dtsModel.ts`, `views/TomosynthesisView.tsx` — overlay model and UI; filmstrip
  enlargement (4.2, 4.3)
- `components/suite/views/TimeView.tsx` — the pulse strip (3.8)
- `components/suite/views/SamplingView.tsx` — slab / thin pairs (6.4)
- `components/suite/suite-scene.module.css` — host palette, walk and multiplanar arrangements,
  touch-action, new elements (2.2, 2.3, 2.10, 3.8, 4.2, 4.3, 6.2, 6.4)
- `components/stage/ImagingStageHost.tsx` — goals to the pane; footer wording (2.13)
- `components/stage/ImagingActivityShell.tsx` — `data-step-kind` (2.3)
- `components/stage/LessonDemonstration.tsx` — cue before the figure (2.9)
- `components/stage/imaging-flow.module.css` — walk columns; opaque footer (2.3, 2.15)
- `components/stage/imaging-stage.module.css` — cue and example buttons on the host palette (2.9, 2.10)
- `components/peripheral-imaging-module.module.css` — rationale contrast; case-decision tokens (1.9, PR3)
- `components/PeripheralImagingHub.tsx`, `peripheral-imaging-hub.module.css`, `content/hubHero.ts` —
  intro card; on-figure labels (O3, O5)

Tests: the four files above, `e2e/peripheral-imaging.spec.ts`, `test-support/stageHarness.tsx`.

Documentation: this file.

## Before / after gallery index

`…/renders/output/pi-fellow-02-2026-09-20-c717c9ff/`, `before/` and `after/` share file names.
1280 × 900, dark, direct route, local development build unless named otherwise.

| Workbench                 | IDs             | Files                                                                                                                                     |
| ------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Component walk            | 2.2, 2.3, 2.4   | `walk-1280x900-entry.png`, `walk-1280x900-full.png`, `walk-1024x768-entry.png`, `walk-1024x768-full.png`, `walk.json`                     |
| Camera presets            | 2.5             | `walk-preset-{suite,beam-view,anterior,side,head,target}.png`                                                                             |
| Projection demonstration  | 2.9, 2.10, 2.15 | `lookfor-1280.png`                                                                                                                        |
| Guided multi-control task | 2.13            | `checklist-1280.png`                                                                                                                      |
| Pulse strip               | 3.8             | `pulse-1280.png`                                                                                                                          |
| DTS plane                 | 4.2, 4.3        | `dts-1280.png`, `dts-plane.png`; after only: `dts-plane-overlay-tool.png`, `dts-plane-overlay-lesion.png`, `dts-enlarged.png`, `dts.json` |
| Sampling planes           | 6.2, 6.4        | `sampling-1280.png`, `sampling-1280-full.png`                                                                                             |
| Overview                  | O3, O5          | `overview-1280-full.png`; after only: `overview-hero-{1280,390}.png`, `overview-before-you-start-{1280,390}.png`                          |
| Answer feedback           | 1.9             | `rationale.png`                                                                                                                           |
| Practice case             | PR3             | `practice-1280.png`                                                                                                                       |
| All measurements          | —               | `surfaces.json`                                                                                                                           |
| Beta-wrapped route        | 2.2, 2.3, 2.4   | `beta/`                                                                                                                                   |

## Reproduction index

Every row is `<base>` + the path, dark, anonymous local context.

| ID              | Route                                                    | Steps                                                                                                                |
| --------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| O3, O5          | `/en/peripheral-imaging`                                 | Scroll to the suite picture and to "Before you start".                                                               |
| 1.9             | `/en/peripheral-imaging/learn?section=imaging-questions` | Continue to activity 4, choose an option, Check, open "Why the other answers do not fit".                            |
| 2.2–2.5         | `/en/peripheral-imaging/learn?section=chain-walk`        | Continue once. Wheel with the pointer over the scene; press Next component; press each view button; read the labels. |
| 2.9, 2.10, 2.15 | `/en/peripheral-imaging/learn?section=projection`        | Activity 1 as it opens; scroll and watch the footer.                                                                 |
| 2.13            | `/en/peripheral-imaging/learn?section=good-image`        | Continue three times to activity 4; read the footer and find the list.                                               |
| 3.8             | `/en/peripheral-imaging/learn?section=time`              | Activity 1; scroll to the strip. Activity 4: change pulse width alone and read the readouts.                         |
| 4.2, 4.3        | `/en/peripheral-imaging/learn?section=dts-acquisition`   | Continue twice to activity 3. Tick the overlay box; change the plane. Click a thumbnail; Next; Escape.               |
| 6.2, 6.4        | `/en/peripheral-imaging/learn?section=tool-confirmation` | Activity 1 as it opens. Skip to the lab task and tick "Combine depths into a teaching slab".                         |
| PR3             | `/en/peripheral-imaging/practice?case=signal-practice-1` | Scroll to the actions before choosing anything.                                                                      |
| Beta-wrapped    | `/en/development-beta/peripheral-imaging`                | Needs `NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local` at build time; navigate inside the frame to the routes above.   |

## Independent pre-merge sanity review — September 21, 2026

**SANITY REVIEW: READY TO MERGE — after the three corrections below.** This is the requested bounded engineering review of
PI-FELLOW-02, not a restarted fellow walkthrough, G02 audit, clinical review or learner study.
Prompt 03, curriculum changes, merging and deployment remain outside this task.

### Exact review state

- PR #253, `claude/pi-2-9-19`, expected and actual initial head:
  `1d1d1d0b9b9d781e23f6337c72134ebdc9122965`.
- Freshly fetched `origin/main` and PR base:
  `c717c9ffae09cb67e19b06a56d37c75487a5605a`.
- GitHub reported `MERGEABLE`, merge state `CLEAN`.
- Other open PRs: #254, #252, #251, #134, #114 and #98. **Zero changed-file overlaps.**
  #134 includes shared stage/verdict changes outside this PR's paths; the current-base shared
  component suites were included in validation, without reviewing or merging that other branch.
- The checkout was clean and already at the exact requested head. The owner's explicit instruction
  to correct genuine defects **in the existing PR** governs this continuation on its branch.
- Read this handoff, Prompt 02 from the mapped Local-Data implementation pack, PI-FELLOW-01,
  SYSTEMIC-UX-01 and its post-merge record, SYSTEMIC-UX-02, and the PI focus/outline/wrap/Help
  contracts. Current self-paced behavior takes precedence over generic assessment defaults.

Exact initial changed paths (29; the corrections below stay within these paths):

```text
docs/gap-remediation/fellow-feedback/pi/PI-FELLOW-02-handoff.md
e2e/peripheral-imaging.spec.ts
src/features/peripheral-imaging/__tests__/dts-overlay.test.ts
src/features/peripheral-imaging/__tests__/hub-hero.test.ts
src/features/peripheral-imaging/__tests__/label-layout.test.ts
src/features/peripheral-imaging/__tests__/workbench-loop.rendered.test.tsx
src/features/peripheral-imaging/components/PeripheralImagingHub.tsx
src/features/peripheral-imaging/components/peripheral-imaging-hub.module.css
src/features/peripheral-imaging/components/peripheral-imaging-module.module.css
src/features/peripheral-imaging/components/stage/ImagingActivityShell.tsx
src/features/peripheral-imaging/components/stage/ImagingStageHost.tsx
src/features/peripheral-imaging/components/stage/LessonDemonstration.tsx
src/features/peripheral-imaging/components/stage/imaging-flow.module.css
src/features/peripheral-imaging/components/stage/imaging-stage.module.css
src/features/peripheral-imaging/components/suite/CameraRig.tsx
src/features/peripheral-imaging/components/suite/ChainPins.tsx
src/features/peripheral-imaging/components/suite/LabDock.tsx
src/features/peripheral-imaging/components/suite/SceneLabels.tsx
src/features/peripheral-imaging/components/suite/SuiteScene.tsx
src/features/peripheral-imaging/components/suite/cameraPose.ts
src/features/peripheral-imaging/components/suite/dtsModel.ts
src/features/peripheral-imaging/components/suite/labelLayout.ts
src/features/peripheral-imaging/components/suite/suite-scene.module.css
src/features/peripheral-imaging/components/suite/views/ProjectionView3D.tsx
src/features/peripheral-imaging/components/suite/views/SamplingView.tsx
src/features/peripheral-imaging/components/suite/views/TimeView.tsx
src/features/peripheral-imaging/components/suite/views/TomosynthesisView.tsx
src/features/peripheral-imaging/content/hubHero.ts
src/features/peripheral-imaging/test-support/stageHarness.tsx
```

### Reproduced defects and minimal corrections

| Finding                                           | Reproduction before correction                                                                                                                                                                                                                                    | Correction and regression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2: enlargement keyboard entry and return**     | Enter on projection 1 leaves focus on its thumbnail; immediate Escape leaves the enlargement open. Next then Escape returns to projection 2 rather than the original thumbnail.                                                                                   | `TomosynthesisView.tsx` keeps the opener separately from the displayed index and focuses the nonmodal figure when opened. Previous/Next preserve active-control focus; at the first/last projection focus returns to the figure before the button becomes disabled, keeping Escape operable. Escape/Close return to the opener. The new browser test failed on the original production head and tests immediate Escape, Next, Close, multiple openers, both sweep boundaries, and normal Tab exit. The endpoint extension separately failed before its fix when the newly disabled Next button lost focus. The older test's wrong destination assertion was corrected. |
| **P2: touch scroll dead region remains**          | At 390×844, an emulated vertical swipe starting on the actual canvas leaves document scroll at 271 px. The canvas reports `pan-y pinch-zoom`, but the R3F ancestor reports `none`; checking only the canvas missed the effective prohibition.                     | Extend the existing PI-local touch-action rule to the immediate R3F wrapper. No camera or shared input code changes. A real Chromium input-dispatch regression fails before this CSS correction; with the rule applied the same swipe moves the document 271→499 px (508 px on the final-build rerun, including native momentum). This is emulated touch, not physical hardware.                                                                                                                                                                                                                                                                                       |
| **P2: slab-paired thin sections freeze at −9 mm** | Enable slab comparison, then change axial, coronal and sagittal controls rapidly. Controls end at 6 mm while every thin caption/image stays at −9 mm. The old slab geometry adapter returns the full slab's center, which the new thin panels incorrectly reused. | `SamplingPanels` obtains thin-plane positions with `slab: false`; each MPR slab still combines the existing −60…42 mm range. The 3D slab geometry is untouched. The new browser regression fails before correction and checks final per-axis captions, accessible plane identity, changed thin-image pixels, and unchanged other thin/slab images.                                                                                                                                                                                                                                                                                                                     |

No refactor, new image, clinical teaching, engine formula, question, score, gate, storage key,
publication flag or shared component was changed. Correction paths are the three feature files
above, `e2e/peripheral-imaging.spec.ts`, and this handoff.

### Independent evidence by requested area

- **Wheel/camera:** ordinary wheel over eleven visible scene routes scrolls the page without changing
  the rendered camera. Ordinary, Ctrl and Cmd synthetic cancelable wheel events are not canceled.
  All four camera buttons were activated by keyboard across six presets, two C-arm angles (0° and
  67°), and 1280×900/1024×768. All 24 combinations changed rendered pixels appropriately and Reset
  restored the complete-frame pixel hash of that active preset. A separate final-build probe
  deliberately combined zoom and rotation so the pre-reset image differed: all **24 nontrivial
  resets** matched their reference, including 12 after resizing to 1024×768. The reset effect assigns the
  preset's position, up vector and target; this is not a guessed default. Existing pointer-drag
  and resize checks also pass. Browser gesture non-consumption is distinguished from native tab
  zoom validation; physical touch hardware was not used.
- **Live labels:** recorded **956 visible label rectangles across 120 states** (24 initial states
  plus four camera moves per state): **zero overlaps**. All eight labels appear at each preset;
  four zoomed-in Target states hide the display label whose anchor is behind the camera. Source tracing follows the actual source
  sphere/detector group transforms and the actual target/tool meshes, not their text. Independently
  projecting those model anchors through each preset produced a maximum **0.069 px** discrepancy
  from the rounded runtime anchor coordinates. Displaced labels retain leaders.
- **Overview labels:** independently transformed the source/detector mesh positions and projected
  all six component anchors by camera-basis dot products. Maximum stored-coordinate difference:
  **0.040 percentage points**. Separately re-rendered the actual room fixture into a scratch PNG:
  it is **byte-identical** to the shipped image, SHA-256
  `dfa096a52a72a13b9f59666eaa5acc069fb2045b51a7015af9a56ce8a30ad72c`.
  This closes the circular-validation concern for this head: the existing unit test alone cannot
  prove that arbitrary replacement PNG pixels still match its assumed camera.
- **DTS:** overlay initially hidden; underlying canvas data URL unchanged when enabled; checks
  withhold the toggle and marks. Inverting the reconstruction's world-to-plane mapping gives tool
  x=54.857…164.571, y=128 and target center=(164.571,128), independently matching the overlay's
  unpadded geometry. Tested depths −25, −18, −16, −8, 0, 8, 10 and 25 mm. Solid/dotted state follows
  object intersection; signed model distances equal object depth minus plane depth. Displayed
  “mm from this plane” is the correct unsigned magnitude, without an invented directional sign.
  Planning-CT mode renders only the target mark and explicitly explains the absent tool. The
  modeled-location/not-image-detection note remains visible when enabled. No clinical validation
  is inferred from agreement between two authored-model representations.
- **Projection enlargement:** multiple sweep positions match their thumbnail canvas bytes and
  angle/index (including projections 2, 8 and 13). The focus repair above preserves this identity.
  Previous/Next remain normal buttons; no modal or focus trap is introduced.
- **Thin/slab pairing:** corrected as above. The slabs retain their full, fixed depth interval;
  they are not recentered or represented as a superior clinical image. Each paired thin section
  uses its own live selected position; rapid changes must settle to the final control value.
- **Component walk:** all six cards match the highlighted component on both direct and beta routes
  at 1280×900, 1024×768 and 390×844; additionally exercised 1280×900 with 200% root text. Desktop
  Next preserves document position. Compact/enlarged layouts release pinning and have no fixed
  card-height scroller. At compact widths, native scroll anchoring can move document offset when
  differently sized cards replace each other near the document end; the button stays in ordinary
  document flow. This is not an added programmatic Next scroll.
- **Beam stop:** the existing production test confirms the focused obliquity control, changed
  projection and relevant card remain co-visible. The previously documented 1280×900 limitation
  remains: viewing the 3D scene at this stop requires scrolling back up. It is not a blocker for
  the demonstrated slider→projection teaching loop.
- **Pulse strip:** equations/parameters/units are unchanged in the source diff. Changing pulse
  width moves only fixed-current tube load and within-pulse blur; only those two readouts are
  marked. Unchanged travel, interval and pulse rate remain unmarked. Chromium's accessibility
  snapshot includes the generated “· changed” text. Exact wording remains editorial for Prompt 03.
- **Practice and Prompt 01:** the full PI journeys retain disabled Check before selection,
  selection→Check→explanation→retry, explanation before answering, and ungraded/unrestricted
  navigation. Fixed-example independence, illustrative-scenario framing, chain/CBCT evidence
  framing and saved-baseline/current crop behavior remain covered by rendered/Jest/browser checks.
- **Beta wrapper:** tested independently using the production owner-local build. At each requested
  normal-text size, no new horizontal overflow or hidden primary action; all six highlights/cards
  stay paired and controls are reachable. The 1024 frame shows less card/scene content because the
  wrapper consumes 65 px; ordinary scrolling remains available. At 1280 with 200% root text, an
  unchanged shared-navigation “Intro to Bronchoscopy” link accounts for 51 px document overflow;
  it is outside these PI changes and is not presented as a clean whole-site reflow claim.

### Validation and evidence retention

Validation ran against a local **production** build, served on `127.0.0.1:3167`, with
`NEXT_PUBLIC_MODULE_FEEDBACK_MODE=owner-local`, `NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only` and an 8 GiB Node heap. No stored environment secret
was read or copied.

| Check                                               | Result                                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run build`                                     | PASS, including training apps, content/assets, production compilation, TypeScript and standalone preparation. Rebuilt after the final focus-boundary change.                                                 |
| Focused Jest: PI, shared learning-module, PI routes | **58 suites / 477 tests pass** after the three corrections; another **2 suites / 14 tests pass** after the focus-boundary extension.                                                                         |
| Full PI Playwright production suite                 | **53/53 pass**, including new focus, touch and per-axis slab regressions and prior focus/outline/wrapping/Help/Prompt 01 journeys.                                                                           |
| Final affected production browser rerun             | **7/7 pass** on the final rebuilt source, including immediate Escape, both sweep ends, Close/Tab exit, wheel/pointer behavior, touch scrolling, DTS overlay and per-axis slab pairing.                       |
| Systemic production PI/public-entry checks          | **7/7 pass**, repeated on the corrected build.                                                                                                                                                               |
| Independent probes                                  | Eleven visible-scene wheel contracts, 120 label states, 24 camera/preset combinations, direct/beta six-component walks, DTS geometry/pixels, hero rerender, slab/pulse and emulated-touch evidence retained. |
| Repository `npm run type-check`                     | PASS after correcting a missing canvas type cast in the new test.                                                                                                                                            |
| Changed-path ESLint, Prettier; `git diff --check`   | PASS.                                                                                                                                                                                                        |

Failures and reruns remain distinct. The first PI production run was invalidated after 32 passes
by starting a rebuild in its active output directory; its 18 later failures are retained as
harness interference, not accepted product results. A clean subsequent build passed 51/51 checks
with the initial focus repair. Separate before-fix regressions then demonstrated the touch and
slab defects; their corrected build passed all 53 checks. The final focus test was extended to
both sweep endpoints after reproducing the disabled-button focus loss; its affected rerun is
reported separately above. A type-check failure in the added test was a missing
`HTMLCanvasElement` cast, corrected without altering test behavior.

Retained build warnings match the baseline: embedded training-app chunk size, Mermaid dependency
compilation warnings, missing `metadataBase`, and Node `DEP0205`. No full-repository suite was
run: no shared code changed and no focused failure indicated broader impact.

Evidence is retained outside Git at
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/pi253-sanity-2026-09-21/`:
state/changed-file metadata, build/test logs, failing-before regressions, independent probe scripts,
all label rectangles, reconstructed coordinates, direct/beta screenshots and the scratch hero.
Some exploratory probes initially targeted hidden geometric views or nonexistent controls; these
are retained as probe failures and are not counted as feature passes. The final visible-state
probes and committed regressions provide the acceptance evidence.

No merge or deployment was performed. Editorial DTS phrasing and the generated change-marker
wording remain Prompt 03 items. No clinical, human-review or release hold was cleared.
