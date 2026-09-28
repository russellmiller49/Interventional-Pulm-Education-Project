# MV-PRE-REVIEW-03 — workbench, waveforms and experiment flow

Batch 03 of the Mechanical Ventilation pre-owner-review pack
(`Interventional-Pulm-Local-Data/module_update_9_19/MV_Claude_Implementation_Pack/03_MV_WORKBENCH_AND_EXPERIMENT_FLOW.md`),
read with `COMMON_CONTRACT.md`, the assigned rows of `FEEDBACK_LEDGER.md`, `SOURCE_AND_CODE_NOTES.md`,
`CROSS_MODULE_COORDINATION.md`, the walkthrough DOCX, and the merged `MV-PRE-REVIEW-01-handoff.md` and
`MV-PRE-REVIEW-02-handoff.md`. Prepared 2026-09-28 by an AI authoring assistant (Claude) at the owner's
request.

**Nothing here is clinical, device, media, source or release approval.** This batch changed how the
Learn workbench, waveforms, experiment and navigation are presented. It changed no physiology, case
trajectory, gas model, alarm policy, answer key, source or review status, device behaviour, global
site chrome, or D1–D5 decision. The four console facsimiles were checked for display only; visual
parity is not manufacturer-workflow validation.

## Delivery and scope

|                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected base                       | `2bc539f4e96fe66d196aae9ae08fad4c8131e79a`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Actual base (fetched `origin/main`) | `756c9aee7d7119f3817b5d85aaf73f9efa573418` (merge of PR #285). `main` had moved 41 commits; none touches `src/features/mechanical-ventilation`, `src/features/learning-module`, `src/features/critical-care` or the MV routes (`git diff --stat 2bc539f4 756c9aee -- …` is empty).                                                                                                                                                                                            |
| Branch / worktree                   | `claude/mechanical-vent-03-9-25` in a new worktree `…/Interventional-Pulm-Education-Worktrees/claude-mechanical-vent-03-9-25`. The session opened in `…/codex-mv-03`, a worktree last used on `codex/mv-03`; it was not used for any work. The Batch-01 and Batch-02 branches and worktrees were not touched.                                                                                                                                                                 |
| Implementation head                 | `0de3896d` (browser and test evidence below is from `d39d5d24` → `0de3896d`; see [Heads](#heads))                                                                                                                                                                                                                                                                                                                                                                             |
| Final head                          | the commit that adds this document and its screenshots (recorded in the PR)                                                                                                                                                                                                                                                                                                                                                                                                   |
| Files                               | all runtime, content and test changes under `src/features/mechanical-ventilation`; this document and `MV-PRE-REVIEW-03-screenshots/`. No shared `learning-module` stage file, shared `AnswerVerdict`, critical-care registry, progress store, other clinical engine, device-intelligence, backend, dependency or deployment change. No `.env.local` was created, modified or deleted; servers read the primary checkout's existing configuration into their own process only. |
| Held                                | Live clinical case MV-03 stays excluded. The alarm-limit harmful choice, D1–D5 and every source/review hold are unchanged. `content/source-cases.v1.json` is untouched.                                                                                                                                                                                                                                                                                                       |

### Heads

| Commit     | What                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `de71e6fe` | The batch: experiment panel, navigation, lesson structure, V1/V3/V4/V2, sampling, S2-1, B2, tests                                                                                                                                                             |
| `d39d5d24` | Two layout fixes found in the browser matrix: the control column comes first when the workbench stacks (phones), and the lesson's grid track can no longer grow past its box at 200 % text on 320 px                                                          |
| `ff7476dc` | S2-1 correction found while reading the production screenshots (see [S2-1](#s2-1--numerical-oddities-investigated-before-any-cosmetic-change))                                                                                                                |
| `0de3896d` | Test-only: the full type-check at `ff7476dc` failed on two TS2339 errors in the new suite (reading `ratePerMin` / `vtMl` off the settings union); narrowed, re-run clean. The production build's own type pass excludes tests, so only the full run caught it |

## 1. Reproduced on the base first

Every item below was reproduced on `756c9aee` before any edit, against this worktree's `next dev
--webpack` on port 3126, in headless Playwright Chromium (1× DPR, `document.visibilityState ===
'visible'`, so the page's own 100 ms clock ran — not the Appendix-B hidden-tab artefact). Each run used
a fresh browser context (clean `localStorage`).

### N4 / N7 — the task, the controls and the evidence on the base

Real sequence per run: open the section → top Continue to the experiment step → change the requested
control from paused (or request the hold, or select an interval in Section 1) → wait 1.5 s → set 5× →
Run → wait until Capture enabled → Capture → bottom Continue. Positions are `getBoundingClientRect().top`
in CSS px at the moment named; the site header is `position: sticky`, 0–81 px, at every desktop size;
the document is the only scroll owner (no element had its own vertical scroll).

| Viewport  | Section | Heading after entry    | Run (separate row) | Control | Readings | Capture | Heading after bottom Continue | Focus after bottom Continue |
| --------- | ------- | ---------------------- | ------------------ | ------- | -------- | ------- | ----------------------------- | --------------------------- |
| 1280x1000 | 1       | 352                    | 632                | —       | 1260     | 1624    | -1419                         | Continue button             |
| 1280x1000 | 2       | 430                    | 689                | 875     | 1317     | 1659    | -751                          | Continue button             |
| 1280x1000 | 5       | 430                    | 689                | 907     | 1317     | 1711    | -803                          | Continue button             |
| 1280x1000 | 7       | 430                    | 689                | 875     | 1317     | 1659    | -805                          | Continue button             |
| 1280x1000 | 9       | 430                    | 1609               | 1795    | 2387     | 3038    | -4093                         | document body               |
| 1280x1000 | 14      | 430                    | 689                | 1128    | 1719     | 2092    | -1184                         | Continue button             |
| 1427x1000 | 1–14    | identical to 1280×1000 |                    |         |          |         |                               |                             |
| 1280x900  | 1       | 302                    | 582                | —       | 1210     | 1574    | -1469                         | Continue button             |
| 1280x900  | 2       | 430                    | 689                | 875     | 1317     | 1659    | -801                          | Continue button             |
| 1280x900  | 5       | 430                    | 689                | 907     | 1317     | 1711    | -853                          | Continue button             |
| 1280x900  | 7       | 430                    | 689                | 875     | 1317     | 1659    | -855                          | Continue button             |
| 1280x900  | 9       | 430                    | 1609               | 1795    | 2387     | 3038    | -4144                         | document body               |
| 1280x900  | 14      | 430                    | 689                | 1128    | 1719     | 2092    | -1234                         | Continue button             |
| 1024x768  | 1       | 219                    | 516                | —       | 1187     | 1573    | -1638                         | Continue button             |
| 1024x768  | 2       | 438                    | 691                | 878     | 1363     | 1727    | -927                          | Continue button             |
| 1024x768  | 5       | 438                    | 691                | 910     | 1363     | 1799    | -999                          | Continue button             |
| 1024x768  | 7       | 438                    | 691                | 878     | 1363     | 1727    | -1002                         | Continue button             |
| 1024x768  | 9       | 438                    | 1695               | 1881    | 2495     | 3271    | -4666                         | document body               |
| 1024x768  | 14      | 438                    | 691                | 1130    | 1743     | 2143    | -1359                         | Continue button             |

- **N4 reproduced** at every size: after the bottom Continue the step changed while the new heading
  was 751–4666 px above the viewport and focus stayed on the button (the walkthrough measured
  ~870 px at 1280×900; this base gave 801 px for Section 2).
- **N7 reproduced**: Run lived in a separate "Playback / inspection" row; the requested control was
  below the fold at 1280×1000 in Sections 9 and 14; Capture was 1573–3271 px down. Changing the
  control while paused did nothing visible for 1.5 s. The status copy was "The requested action is
  present. Check the measurement status and response interval." and Section 1 printed "Observe for
  0 simulated seconds".
- **T1 reproduced**: every section's teaching sat inside a closed `<details>` titled "Teaching and
  worked references", with further closed panels inside it from Section 6 on.

### The other assigned findings on the base

| ID                 | What the base showed                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1                 | Section 5 idealized comparison: flow axis `400` / `-400` L/min; VC's 24 L/min square flow and PC's 55 L/min decelerating flow both near-flat.                                                                                                                                                                                                                                                                                                                                             |
| V2                 | Optional question card `rgb(247, 249, 247)`; bedside "Live patient status" card `rgb(255, 255, 255)`; Section 11 reading-sequence card `rgb(246, 248, 245)` with an SVG containing **no `<text>` at all** (four unnamed traces).                                                                                                                                                                                                                                                          |
| V3 / S1-4 sampling | `labSnapshot` kept one sample in four (`index % 4 === 0`): captured baselines and results were 80 ms records beside the 20 ms reference. Held records were halved above 150 samples.                                                                                                                                                                                                                                                                                                      |
| V4                 | Practice MV-14 (PEEP 12) on all four facsimiles: the plateau readout printed `46?` — a bare `?` with no legend. At 100 % root text PEEP `12` stayed on one line at 1024–1427 px on the current base (not reproduced as the walkthrough described it at DPR 2); **at 200 % root text** PEEP `12` broke onto two lines ("1" / "2") on the C6, Evita and AVEA and the plateau `46?` onto three; the PB980 banner layout did not wrap. The readout `<dd>` inherits `overflow-wrap: anywhere`. |
| S2-1               | See [S2-1](#s2-1--numerical-oddities-investigated-before-any-cosmetic-change). Walk step: "Cursor at 0.00 s" beside "At the cursor in the inspiratory interval, the flow segment is nearly level…".                                                                                                                                                                                                                                                                                       |
| S6-2               | Sections 1–5 rendered a different teaching layout (`FoundationTeaching`) from Sections 6–14 (`StageBlock` panels), and Section 1–5 read steps printed a second "Learn the relationship" block with the same unit text.                                                                                                                                                                                                                                                                    |
| S7-2               | Batch 01's repair holds: Section 7 steps 6 and 7 draw "Effort · model (cmH₂O)" on the live figure. Nothing to repair beyond keeping it in the new layout (verified below).                                                                                                                                                                                                                                                                                                                |
| B2                 | See [B2](#b2--one-pathway-click-reset-the-page).                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## 2. Disposition by assigned finding

| ID                       | Disposition                                                                                                 | What was done                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N4**                   | **Reproduced → repaired**                                                                                   | Explicit Continue (top and bottom), Back, the step chooser, Restart, the section chooser and the last step's "Continue to …" link bring the new step's `<h2>` into view and focus it. Nothing else does. See [N4](#n4--explicit-navigation-only).                                                                                                                |
| **N7**                   | **Reproduced → repaired**                                                                                   | An "Experiment" panel inside the step card, under the instruction: stage chip, headline, goal checklist, model-time response interval, Run experiment / Pause, Advance one breath, speed, Capture result and an opt-in automatic capture. Engine-language copy removed; no interval line when the round has none. See [N7](#n7--the-experiment-beside-the-task). |
| **T1**                   | **Reproduced → repaired**                                                                                   | The wrapper is gone. Each step shows the lesson in one shape with three named disclosures. See [T1 / S6-2](#t1--s6-2--one-lesson-shape).                                                                                                                                                                                                                         |
| **S6-2**                 | **Reproduced → repaired**                                                                                   | Sections 1–5 and 6–14 now render the same lesson structure; 1–5 are shorter (no mechanism panel) and add their worked demonstration as the evidence part.                                                                                                                                                                                                        |
| **V1**                   | **Reproduced → repaired**                                                                                   | One scale fitted to the displayed VC/PC pair, shared by both modes: pressure 0–20 cmH₂O, flow ±60 L/min, volume 0–500 mL at the reference. The all-settings ±400 scale is kept as an explicit choice. Row labels with units; zero marked. Waveform values unchanged.                                                                                             |
| **V2**                   | **Reproduced → repaired (module-local)**                                                                    | Question card, bedside card, ARDS reference card and all nine mechanism panels on the module's dark palette; the reading-sequence figure names each row with unit and scale. Global theme untouched.                                                                                                                                                             |
| **V3**                   | **Reproduced → repaired**                                                                                   | Side-by-side or overlay view; inspiration zoom that crops the same seconds of both breaths; full-resolution records; a text description drawn from the samples.                                                                                                                                                                                                  |
| **V4**                   | **Reproduced (plateau `?` at 100 %, digit wrap at 200 % root text) → repaired**                             | The plateau's acquisition state printed as a word under the value on every facsimile; numbers never break between digits; the label column is in rem.                                                                                                                                                                                                            |
| **S2-1 (presentation)**  | **Investigated → labelled; one demonstrated capture error repaired**                                        | The 80 ms thinning (duration 3.68 s) is repaired; 427 vs 420 mL is a real, alternating model output and is now explained, not rounded; the worked sentence is printed only beside a cursor it describes.                                                                                                                                                         |
| **S1-4 (sampling half)** | **Repaired**                                                                                                | Captured baselines are now 20 ms records like the reference.                                                                                                                                                                                                                                                                                                     |
| **S7-2 (visual half)**   | **Verified, nothing to change**                                                                             | Effort row present, labelled, on the same time axis, at 1280 and 390 px.                                                                                                                                                                                                                                                                                         |
| **B2**                   | **Hub path: not reproduced / unconfirmed. Same-component race on the Learn landing: reproduced → repaired** | See [B2](#b2--one-pathway-click-reset-the-page).                                                                                                                                                                                                                                                                                                                 |

## N4 — explicit navigation only

`components/stage/revealTaskHeading.ts`, called only from the host's navigation handlers:

- **Pinned chrome is measured at the moment of navigation**: every `position: fixed | sticky`
  element currently pinned across the top (top ≤ 1 px, at least half the viewport wide, at most half
  its height). Measured values: 81 px at desktop sizes, 73 px at 390/320, ~377 px at 1280×1000 with
  200 % root text (the site header wraps). No fixed offset exists anywhere.
- **Scroll owner**: `heading.scrollIntoView({ block: 'start', behavior: 'instant' })` with
  `scroll-margin-top` set to the measured inset + 12 px, so whichever ancestor scrolls is moved. In
  the task flow that is the document.
- **Instant, explicitly.** The site sets `html:focus-within { scroll-behavior: smooth }`; with
  `behavior: 'auto'` the scroll became smooth and the step's own re-render cancelled it — measured
  on the first attempt (heading left at −580 px). `'instant'` also satisfies reduced motion.
- A step change aligns the heading under the chrome (at 1280×900 a heading left at 430 px put the
  requested control below the fold). A section change scrolls only when the heading is under the
  chrome, below the fold or in the lower half of what is left, so the new section's title is not
  scrolled away on arrival (1280×900: stays at 430; 1024×768: moved to 93).
- Focus moves to the `<h2>` (`tabIndex=-1`, `aria-describedby` → the "Step n of m · Application k"
  line) with `preventScroll`. `:focus-visible` shows the ring for keyboard users.
- A section change goes through the router and remounts the host; the chooser leaves a one-shot,
  15-second request that the new section's first render consumes. A reload, a link from elsewhere
  or browser back never sets it.
- Nothing listens for focus. Ticks, Run/Pause, captures, control edits and disclosures never call it.

Production build, measured (`nav-keyboard` probe, reduced-motion context):

| Viewport | 3 × bottom Continue                        | 2 × Back    | Keyboard Tab→Enter on Continue | Step chooser → 7 | 3 s of Run (Space)                  | Section chooser → 8                |
| -------- | ------------------------------------------ | ----------- | ------------------------------ | ---------------- | ----------------------------------- | ---------------------------------- |
| 1280×900 | heading 93 (chrome 81), focused, each time | 93, focused | 93, focused                    | 93, focused      | focus stays on Run; page moved 0 px | 430 (already comfortable), focused |
| 1024×768 | 93, focused                                | 93, focused | 93, focused                    | 93, focused      | stays on Run; 0 px                  | 93, focused                        |
| 390×844  | 85 (chrome 73), focused                    | 85, focused | 85, focused                    | 85, focused      | stays on Run; 0 px                  | 85, focused                        |

## N7 — the experiment beside the task

`content/experimentStatus.ts` names the state that `labGoalMet`, `labReadyToCompare`, the round's
`seconds` and the session's `readySince` already define; it adds no gate. Stages:

| Stage                  | When                                                                                      | Headline (examples)                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not-started`          | round not in its experiment phase (e.g. a jump straight to an observe step)               | "Not started. Start the experiment from its baseline to record a result." + a Start button                                                                     |
| `awaiting-action`      | a requested change / maneuver / interval selection not in place                           | "Paused. Next: set the inspiratory flow to 60 L/min."                                                                                                          |
| `awaiting-measurement` | a requested hold is queued or running, or (Section 4) the last hold was not interpretable | "Hold requested; the valves close at the next breath boundary. It happens only while the experiment runs."                                                     |
| `awaiting-effect`      | a bedside action was selected and its modeled delay has not elapsed                       | "Treat the pain: selected; its modeled effect starts in 118 s of model time."                                                                                  |
| `awaiting-interval`    | everything in place; interval running                                                     | paused: "Change in place. Run the experiment to let the patient respond: 0.0 of 12 s so far." running: "Running. Response interval 4.0 of 12 s of model time." |
| `ready`                | `labReadyToCompare`                                                                       | "Ready to capture. Everything requested is in place and 12 s of model time have passed."                                                                       |
| `captured`             | a response exists                                                                         | "Result captured at 13.0 s of model time. Reset the patient to repeat it."                                                                                     |

- **Cancelled / invalidated**: undoing the requested change drops `readySince`; the panel says "The
  requested change is no longer in place, so the response interval stopped…" (derived from the
  previous stage during render). Reset, device change and a new application remount the panel.
  Confounds are still listed by the workbench.
- **Run**: the only thing that starts the clock is Run experiment (or Advance one breath). A control
  edit leaves `paused: true`, the time unchanged and no response — asserted.
- **Automatic capture**: a checkbox, off by default and off again after any reset/device/application
  change. It dispatches the ordinary `COMPARE` when `labReadyToCompare` becomes true and the
  comparison has no confounds; with confounds it says it is held and leaves Capture to the learner.
  It runs from session state (model time), so it does nothing while paused or hidden, and respects
  speed and one-breath stepping. Manual Capture and Pause/inspect remain.
- **Announcements**: a polite status region whose text depends only on the stage and the run state
  — identical at 4 s and 7 s of the same interval (asserted) — so it speaks transitions, not ticks.
  The model-time readout is `aria-live="off"`.
- The workbench's own playback row is hidden on experiment steps (one clock control per patient).
- **Adjacency**: readings moved above the live trace; the bedside and PBW cards moved into the signal
  column; Section 9's worked PEEP comparison and the lesson follow the workbench on experiment steps.
  Below 1000 px the control column stacks first.

Production, after (`after` probe; same real sequence as the base table; positions in CSS px):

| Viewport  | Section | Heading after entry    | Run | Capture | Requested control | Readings | Heading after bottom Continue (pinned chrome bottom) | Focus       | Page overflow |
| --------- | ------- | ---------------------- | --- | ------- | ----------------- | -------- | ---------------------------------------------------- | ----------- | ------------- |
| 1280x1000 | 1       | 93                     | 330 | 384     | on the figure     | 1054     | 93 (81)                                              | new heading | none          |
| 1280x1000 | 2       | 93                     | 353 | 407     | 730               | 600      | 93 (81)                                              | new heading | none          |
| 1280x1000 | 5       | 93                     | 353 | 407     | 762               | 600      | 93 (81)                                              | new heading | none          |
| 1280x1000 | 7       | 93                     | 353 | 407     | 730               | 600      | 93 (81)                                              | new heading | none          |
| 1280x1000 | 9       | 93                     | 353 | 407     | 730               | 600      | 93 (81)                                              | new heading | none          |
| 1280x1000 | 14      | 93                     | 353 | 407     | 730               | 600      | 93 (81)                                              | new heading | none          |
| 1427x1000 | 1–14    | identical to 1280×1000 |     |         |                   |          |                                                      |             | none          |
| 1280x900  | 1–14    | identical to 1280×1000 |     |         |                   |          |                                                      |             | none          |
| 1024x768  | 1       | 93                     | 346 | 400     | on the figure     | 1114     | 93 (81)                                              | new heading | none          |
| 1024x768  | 2       | 93                     | 348 | 401     | 725               | 595      | 93 (81)                                              | new heading | none          |
| 1024x768  | 5       | 93                     | 348 | 401     | 757               | 595      | 93 (81)                                              | new heading | none          |
| 1024x768  | 7       | 93                     | 348 | 401     | 725               | 595      | 93 (81)                                              | new heading | none          |
| 1024x768  | 9       | 93                     | 369 | 423     | 746               | 617      | 93 (81)                                              | new heading | none          |
| 1024x768  | 14      | 93                     | 348 | 401     | 725               | 595      | 93 (81)                                              | new heading | none          |
| 390x844   | 2       | 85                     | 402 | 537     | 976               | 1067     | 85 (73)                                              | new heading | none          |
| 390x844   | 14      | 85                     | 381 | 516     | 955               | 1193     | 85 (73)                                              | new heading | none          |
| 320x740   | 2       | 85                     | 546 | 703     | 1215              | 1307     | 85 (73)                                              | new heading | none          |
| 320x740   | 14      | 85                     | 499 | 657     | 1168              | 1447     | 85 (73)                                              | new heading | none          |

All 36 runs (6 sections × 1280×1000, 1427×1000, 1280×900, 1024×768, 390×844, 320×740) completed the
sequence, captured, landed the heading at pinned chrome + 12 px with focus after the bottom Continue
and after Back, and had no horizontal page overflow. At 1280×1000–1024×768 the instruction, Run,
Capture, readings and the requested control share one view. Section 1's maneuver is on the
captured-breath figure inside the panel (Run 330, Capture 384; figure below). On phones the order is
instruction → panel → control → readings → trace (control at 955–1215 px; it was 2013–3418 px before
`d39d5d24`).

## T1 / S6-2 — one lesson shape

`VentilationTeachingColumn` now renders every section, in this order:

1. **The idea** (`spec.newConcept`) and **By the end you can** (`spec.objective`) — always shown.
2. **For this step** — the breath-landmark card on a walk or single-stop step; the "While you do
   this" guide on an experiment step; "The picture and the checklist" (analogy, explanation, checklist)
   otherwise; on explain steps also "Why it matters" and this section's row(s) of the one table.
3. **Evidence the step reads** — Sections 1–5: the worked demonstration (Section 1–2 captured
   reference, Section 3 setting map, Section 4 reference hold, Section 5 idealized comparison) with
   its reading sentence before it and its limit directly after it. Sections 6–14 on reading steps: the
   separate normal breath, the normal-timing illustration or the ARDS reference.
4. **Worked example**, **More detail** (why a ventilator exists, the full one table, which control if
   any, the live mechanism panel, story problems, playback note) and **Model limits**, always in that
   order, as named `<details>`. On reading and explain steps the model limit is shown instead of
   folded, so it appears exactly once (asserted for all 14 sections × every step kind). Sources: the
   page footer, now headed "Sources" (`#mv-section-sources`), linked from every lesson.

No lesson content was deleted or reworded: the Section 1–5 `foundationTeaching` title, purpose,
explanation, worked sentence and boundary are all still printed, and the duplicate
"Learn the relationship" block is gone because its text is part of the lesson. The marked Section 1
reference stays in the step card on its read/predict/explain steps (Batch 01).

## V1 — the VC/PC scale

The reference signals are unchanged (`idealBreaths`): VC 24 L/min square; PC 55.5 L/min at the start
of inspiration decaying to ~7; both expire from 48 L/min. The old axis came from the extreme offered
change (twice the compliance at a quarter of the resistance), rounded to ±400. `idealPairAxes` takes
the two breaths on screen and gives one axes object to both modes, so neither is normalised on its
own: VC fills 40 % of the ±60 half-range and PC's peak 92 %; their on-screen heights keep the
55.5 : 24 ratio (asserted). Flow stays symmetric so inspiration and expiration read alike. The
fixed all-settings scale is one button away ("Fixed across every offered setting", `aria-pressed`),
and the note under the figure states which scale is in use and that "fitted" re-fits when the
illustration mechanics change. Nothing is off-scale on either scale, so no off-scale marker is drawn.
Row titles carry units; scale values are right-aligned in their own gutter (the −400 / "volume (mL)"
crowding is gone); zero is labelled on the flow row.

## V3 — overlay and inspiration zoom

In the retained comparison (beside the task after capture, and in the explanation):

- **View**: Side by side | Overlay, as `aria-pressed` buttons (keyboard-operable; a pressed button
  carries a check mark and a heavier border, not colour alone). Radios were avoided so that "no
  answer radio is pre-checked" stays a meaningful invariant.
- **Overlay**: both breaths from their own onset on the same physical axes; baseline dashed at 75 %
  opacity, result solid; legend in words.
- **Zoom to inspiration**: a crop of 0 to (longer sampled inspiration + max(0.3 s, 50 %)) — 0.93 s
  for the Section 2 pair — applied identically to both breaths. The same seconds map onto a wider
  plot; samples outside are not drawn (one sample beyond each edge is kept, clipped, so a line leaves
  the plot where it really goes). Each figure still reports its own measured duration and says
  "Showing 0.00–0.93 s of this 3.74-s breath … nothing is retimed or resampled"; the whole breath is
  one press away.
- **Text equivalent** (both views): for each breath drawn, its inspiratory flow in samples and
  seconds, its onset-to-onset duration, the volume it received (peak less the sample before its
  onset — the ventilator's own exhaled-volume definition), peak flow and peak pressure, and a line
  saying the readings table is what the ventilator published at capture and is not all taken from the
  drawn breath.
- Changing the view changes no evidence (the captured record is byte-identical before and after,
  asserted).

## Sampling integrity

- `labSnapshot` now keeps `state.waveforms` whole: 601 samples at 20 ms for the 12-second buffer.
  The thinning existed to bound a saved lab checkpoint; nothing saves one any more
  (`useVentilationLabProgress` has no importer; the self-paced host keeps runs in memory). The
  legacy parser's bound grew from 160 to 800 samples, so every record that parsed before parses
  identically.
- `updateHoldAcquisition` no longer halves held records above 150 samples. Hold values,
  interpretability and revision are unchanged; only the drawn record is finer.
- Nothing is interpolated or synthesised. Extrema and phase boundaries are whatever the engine
  sampled (asserted: peak pressure of the snapshot equals the buffer's).
- Every captured figure prints its measured spacing: "samples every 20 ms, so a time is resolved to
  one sample". A legacy 80 ms record would say "every 80 ms".

## S2-1 — numerical oddities investigated before any cosmetic change

| Observation                                                            | Traced to                                                                                                                                                                                                                                                                                                                                                                | Disposition                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Breath duration 3.68 / 3.73 / 3.74 / 3.76 s at 16/min (3.75 s)         | The captured record kept one sample in four, so both onsets had to land on 80 ms positions (±0.08 s). At 20 ms the onset-to-onset duration is 3.74 or 3.76 s — the cycle is 187.5 samples                                                                                                                                                                                | **Capture error repaired** (full resolution); duration **labelled** with its sample spacing. Not forced to 3.75.                                                                                                                                                                                                    |
| Exhaled 427 mL vs selected 420 mL                                      | Real model output. The engine integrates flow in 20 ms steps; the 0.63-s inspiration at 40 L/min is 31.5 steps, and because onsets fall at different points between samples, **successive breaths receive 31 or 32 steps: 413 or 427 mL** (one-minute replay: 8 of each). At 60 and 30 L/min the flow time is a whole number of steps and every breath is exactly 420 mL | **Labelled, not rounded**: the reading keeps its value and gains "…successive breaths receive 31 or 32 steps — about 413 or 427 mL", printed only for square-flow volume control whose flow time is not a whole number of steps and whose exhaled volume is within one step of the selection. Delivery not changed. |
| "At the cursor in the inspiratory interval…" beside "Cursor at 0.00 s" | The walk opens on Trigger and the figure's cursor follows the landmark; the worked sentence was written for mid-inspiration. On multi-stop steps the figure used the first stop (Trigger)                                                                                                                                                                                | **Repaired**: off the walk, the figure uses the stop its worked sentence reads; on the walk the sentence is printed only when the cursor is at Inspiration, and otherwise says which landmark it reads.                                                                                                             |

The first S2-1 note I wrote (`de71e6fe`) described a one-sided overshoot ("stops at the first step
that reaches the selected volume"). Reading the production screenshots, the drawn breath had 31
inspiratory samples and received 413 mL; a one-minute tally found the alternation, and `ff7476dc`
states it. Two related quantities are **seen, not changed** (below): the "Inspiratory time" reading is
the calculated 0.63 s while the drawn breaths flow for 0.62 or 0.64 s, and the Batch-01 volume anchor
starts at the first inspiratory sample, which already holds one step (13 mL at 40 L/min).

## S7-2 — visual completion

Section 7 steps 6 and 7: the live figure has four rows with the third "Volume from breath start (mL)"
and the fourth "Effort · model (cmH₂O)", scale −25 to 5 with zero marked, the same x-scale as the
others, and the model-signal note under the figure. Present at 1280 and 390 px. The retained
comparison now draws the effort row too when the step's presentation asks for it. No trigger
physiology was touched.

## V4 — the four facsimiles

The plateau readout prints the value and, under it, one word from `plateauAcquisition(state).status`,
with the projection's full `detail` as its tooltip: estimate · hold running · not valid · outdated ·
measured (a surface that withholds an unacquired value drops the row, so "not acquired" never reaches
a readout). Amber is kept for anything that is not a valid acquisition, but the word carries the
meaning. The console's visible text equivalent still carries the full clause, including the effort
reason. `.waveformReadouts dd` is `white-space: nowrap; overflow-wrap: normal`; the label may wrap
between words; the label column is 5.75 rem (92 px at 16 px root), 4.25 rem below 620 px.

Browser (dev and production, 1280×1000):

| Facsimile (`data-device`) | Open (MV-14)  | Hold requested    | After the hold (MV-14, effort) | Section 4 passive patient after a hold | …after changing resistance | PEEP 12 at 100 % / 200 % root text |
| ------------------------- | ------------- | ----------------- | ------------------------------ | -------------------------------------- | -------------------------- | ---------------------------------- |
| hamilton-c6               | 46 · estimate | 46 · hold running | 52 · not valid                 | 13 · measured                          | 13 · outdated              | 1 line / 1 line                    |
| drager-evita-v800-v600    | 46 · estimate | 46 · hold running | 52 · not valid                 | 13 · measured                          | 13 · outdated              | 1 line / 1 line                    |
| puritan-bennett-980       | 46 · estimate | 46 · hold running | 52 · not valid                 | 13 · measured                          | 13 · outdated              | 1 line / 1 line                    |
| carefusion-avea           | 46 · estimate | 46 · hold running | 52 · not valid                 | 13 · measured                          | 13 · outdated              | 1 line / 1 line                    |

Each hold used the facsimile's own control (C6 Tools → Inspiratory hold; Evita Procedures; PB980
Inspiratory pause; AVEA MANEUVER). No `\d?` appears in any console's text. Jest renders all five
states on all four devices from engine states and asserts the word, the tooltip, the absence of a
bare `?`, and that rendering leaves the patient state byte-identical.

## V2 — module-local theme

- Question card in the Learn flow: dark surface, `color-scheme: dark`, the card's stylesheet now
  reads variables whose defaults are its old light values (the Applications page and MV-UX-01's
  light-scheme contract are unchanged). The chosen row keeps tint + accent border + inset ring.
- Bedside "Live patient status" card, and the Section 6 ARDS reference: dark token values scoped to
  the Learn flow; the navy vital-sign strip keeps its own surface.
- Mechanism panels (`mechanical-ventilation-teaching.module.css`, used only by the nine panels): all
  145 colour literals mapped by role onto the module palette (surfaces, text, accent, the three
  verdict tints, benefit/cost, trend, effort/zero-flow red); pressed toggles keep a bright fill with
  dark text as their selection cue. Rendered with `npm run render:mv-teaching` and checked by eye;
  every surface background has relative luminance < 0.45 (asserted).
- Reading-sequence figure: four rows titled "Pressure (cmH₂O)", "Flow (L/min)", "Volume (mL)",
  "Patient effort · model (cmH₂O)", each with its scale (−5/45, −80/0/80, 0/800, −25/5), drawn from one
  table that also drives the traces, and capped at 30 rem wide.

## B2 — one pathway click reset the page

Bounded matrix, fresh browser contexts, dev and production, 1× and 6× CPU throttling:

| Scenario                                                                                                | Runs                         | Result                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub → "Browse all 14 sections" (clicked as soon as it responded) → Section 1 "Up next" chip             | 5 × 2 throttles × dev + prod | 20/20 navigated on the first click (266–437 ms)                                                                                                                                                                                                                                                                                                                               |
| Learn landing, chip clicked at first paint (before hydration: `data-hydrated=false`)                    | same                         | 20/20 navigated (full navigation before hydration, client after)                                                                                                                                                                                                                                                                                                              |
| …then browser Back and the chip again                                                                   | same                         | 20/20 navigated                                                                                                                                                                                                                                                                                                                                                               |
| **Learn landing with stored progress** (Sections 1–5 visited), chip clicked 0–1500 ms after first paint | 5 delays × 2 throttles       | **Reproduced on the base component**: first paint opened stage 1 with Section 1 "Up next"; the storage read after hydration collapsed stage 1 and opened stage 3 with a different "Up next". A click in that window found its target gone (1× at 400 ms; Playwright timed out on a hidden element; a person's click lands on whatever moved under it while the page shrinks). |

Cause: `VentilationPathwayAccordion` chose its open group and "Up next" chip from the empty progress
that the server and first client render see, and chose again when stored progress arrived. Repair: the
accordion opens nothing and marks nothing until progress is read, chooses the open group once, and
never closes a group afterwards. Production after the repair: returning learner `00000 → 00100`,
fresh learner `00000 → 10000`, no collapse, no "Up next" change, at 1× and 6×.

**The walkthrough's exact path (the hub's "Browse all" accordion, which only appears after
hydration) was not reproduced and remains unconfirmed.** The repair addresses the demonstrated race
in the same component; it is not claimed to be the event the walkthrough saw once.

## Protected Batch-01 / Batch-02 contracts

UI consumes the existing projections; none was re-derived:

- Plateau: `plateauAcquisition` (status, value, detail, `supportsMechanicsClaim`) is the only source
  for the console word, the readings row and the integration panel. Every live case still opens on
  `reference-estimate` (asserted).
- Experiment gates: `labGoalMet` / `labReadyToCompare` unchanged; the panel and automatic capture read
  them. Reading, revealing, navigating and opening disclosures record no run, capture or action
  (asserted).
- Marker identity, cursor independence, phase-label toggle (Batch 01): unchanged; the marked Section 1
  reference still sits in the step card.
- ABG specimens, post-action evidence, trigger labels, BreathClock, PEEP reversal, PEEP-13
  containment, speed and alarm-history invariance (Batch 02): no engine file changed except the
  capture/record thinning above; their suites pass unchanged (counts below).
- Legacy stores: parse bound only widened; no storage key or schema field changed.

## Tests

**New:** `__tests__/mv-pre-review-03-workbench.test.tsx` — 64 tests: experiment stages from real
sessions (paused edit does not run; interval; undo cancels; hold in progress; zero-interval round);
Run and Capture inside the step card with no engine copy for all 14 sections; opt-in automatic capture
only once ready, never with confounds; explicit navigation reveal/focus for Continue, bottom Continue,
Back and the chooser, and no scroll/focus on ticks, Run/Pause, control changes or disclosures; no
global focus listener; section-change one-shot; the lesson shape for all 14 sections × every step
kind; V1 axes and labels; full-resolution sampling; S2-1 413/427 alternation and the note; the
worked-sentence/cursor rule; V3 zoom/overlay/description and evidence immutability; S7-2 effort row;
V4 five states × four devices; V2 surfaces and labelled reading rows; B2 accordion; earlier-contract
checks.

**Assertions that fail on the base for the defect.** An 11-assertion probe using only symbols that
exist on `756c9aee` was run in a read-only detached worktree at that SHA (with this worktree's
`node_modules`), then removed: **11 failed on the base, 11 passed on the head** — snapshot keeps 20 ms
samples; no "Observe for 0 simulated seconds"; Run inside the step card; bottom Continue focuses the
new heading; no "Teaching and worked references"; no bare `?` on any console; readout values
`nowrap`; default VC/PC flow axis not ±400; Learn question card not light-scheme; worked sentence not
beside a 0.00 s cursor; stored progress does not first open stage 1 and then collapse it.

**Changed test contracts** (each encoded the old UI, not a clinical or evidence rule):

- `stage-teaching-disclosure` — the wrapper `<details>` is replaced by "the lesson is present, not
  inside a `<details>`, has its idea part and a More detail disclosure".
- `stage-learner-review`, `peep-comparison.rendered` — "Capture observed response" → "Capture result";
  "Run" → "Run experiment".

## Commands (node 26.5.0; `NODE_OPTIONS=--max-old-space-size=8192`)

Suite totals in the "Head" column were run at `ff7476dc`; `0de3896d` changes only type narrowing in
the new test file, whose 64 tests were re-run there and pass.

| Command                                                                                                                                                                                                                         | Base `756c9aee`                                  | Head                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/mechanical-ventilation`                                                                                                                                                                                  | 42 suites, 1053 tests, all passing               | 43 suites, **1117 tests, all passing**                                                                                                                                                                                                                                |
| MV + consumers: `…/mechanical-ventilation`, `src/app/[locale]/mechanical-ventilation`, `src/features/critical-care`, `src/features/learning-module`, `src/features/icu-simulation`, `src/lib/draft-modules.hamilton-c6.test.ts` | 92 suites, 1517 tests: 1514 passed, **3 failed** | 93 suites, 1581 tests: 1578 passed, **the same 3 failed**                                                                                                                                                                                                             |
| Batch-01/02 regression suites at head                                                                                                                                                                                           | —                                                | `mv-pre-review-01-evidence` 34, `-01-sanity-repairs` 37, `-02-causality` 126, `-02-sanity-repairs` 43, `-02-rereview-repairs` 31, `-02-alarm-history` 25, `peep-comparison` 25, `post-action-coaching` 51, `learning-lab` 16, `waveform-annotations` 17 — all passing |
| `npx tsc --noEmit -p tsconfig.json` (full, tests included)                                                                                                                                                                      | —                                                | **failed at `ff7476dc`** (2 × TS2339, test file only); clean, exit 0, at `0de3896d`                                                                                                                                                                                   |
| `npx eslint src/features/mechanical-ventilation`                                                                                                                                                                                | —                                                | clean, exit 0                                                                                                                                                                                                                                                         |
| `npx prettier --check "src/features/mechanical-ventilation/**/*.{ts,tsx,css}"`                                                                                                                                                  | —                                                | clean                                                                                                                                                                                                                                                                 |
| `git diff --check 756c9aee..HEAD`                                                                                                                                                                                               | —                                                | clean                                                                                                                                                                                                                                                                 |
| `npm run build` (this worktree's dev server, then its production server, stopped first)                                                                                                                                         | —                                                | succeeded at `d39d5d24` and again at `0de3896d`                                                                                                                                                                                                                       |
| `npm run render:mv-teaching`                                                                                                                                                                                                    | —                                                | wrote the gitignored preview; nine panels checked by eye                                                                                                                                                                                                              |

**Baseline debt, reproduced on the exact base** in the read-only worktree with the same
`node_modules` and identical names: `critical-care/__tests__/accessibility.test.tsx` ("keeps
color-coded circuit, pressure, alarm, and trend states readable without color"),
`curriculum-sequencing.test.tsx` (CRRT "renders CRRT cases in authored station order"),
`learner-copy.test.ts`. The learner-copy scanner's full failure output is byte-identical on base and
head, so this batch's copy adds no flagged string.

## Browser checks

Headless Playwright Chromium (bundled build), fresh context per run, `deviceScaleFactor` 1, pages
visible (the clock ran; every run also used Run and 5× where timed). Dev: `next dev --webpack` on 3126. Production: `npm run build` → `node server.js` on 127.0.0.1:3127. The built-in pane was not used
for evidence (it reports `document.hidden`, which suspends the clock).

- **Six sections × six viewports**, production: 36/36 as tabulated above.
- **Navigation / keyboard**, production, three viewports: as tabulated in N4.
- **200 % root text** (`html { font-size: 32px }` — root-text enlargement, not CSS zoom, not native
  zoom): Learn Sections 2 and 14 at 1280×1000, 390×844, 320×740 — heading focused under the measured
  chrome, no page overflow at 390 and 320 (Section 14 at 320 overflowed 10 px before `d39d5d24`), Run
  and Capture reachable. At 1280×1000 the page overflows 51 px because of a **global site-header link**
  (platform lane). Practice consoles at 200 %: see V4.
- **Four facsimiles**: as tabulated in V4 (dev and production).
- **B2**: as tabulated (dev and production).
- **Reduced motion**: navigation probe ran with `prefers-reduced-motion: reduce`; scrolling is
  instant regardless.
- Console: no uncaught page error in any probe (a `pageerror` listener was on every page); the one
  console error per load is `401 /api/analytics` from the local backend.

## Screenshots

In `MV-PRE-REVIEW-03-screenshots/` (downscaled; signed-out, no account data). "Before" images are
from the base `756c9aee` (dev), except `before-v2-reading-sequence.png`, captured on the working tree
after the lesson restructure but before the V2 change, when that panel was still the base component.
"After" images are from the production build.

| Finding   | Before                                                                                                | After                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| N4        | `before-n4-s2-after-bottom-continue-1280x900.png` (old console and readings; new heading off-screen)  | `after-n4-s2-after-bottom-continue-1280x900.png`                                                                                        |
| N7 / T1   | `before-n7-t1-s2-task-1280x1000.png` (Run in a separate row, "Teaching and worked references" closed) | `after-n7-s2-task-1280x900.png`, `after-n7-s2-ready-1280x900.png`, `after-n7-s14-task-1280x1000.png`, `after-phone-s2-task-390x844.png` |
| T1 / S6-2 | —                                                                                                     | `after-t1-lesson-breathing-with-support.png`, `after-t1-lesson-expiration-and-air-trapping.png`                                         |
| V1        | `before-v1-idealized.png`                                                                             | `after-v1-idealized.png`                                                                                                                |
| V2        | `before-v2-question-card.png`, `before-v2-reading-sequence.png`                                       | `after-v2-question-card.png`, `after-v2-reading-sequence.png`                                                                           |
| V3        | —                                                                                                     | `after-v3-zoom-side-by-side.png`, `after-v3-zoom-overlay.png`                                                                           |
| V4        | `before-v4-c6-100.png` (`46?`), `before-v4-c6-root200.png` ("1"/"2", "46"/"?")                        | `after-v4-c6-pressure-100.png`, `after-v4-c6-pressure-root200.png`                                                                      |

## Seen, not changed (deferred)

- **"Inspiratory time" reading vs drawn inspiration** (Section 2): the reading is the calculated flow
  time (0.63 s); drawn breaths flow for 31 or 32 samples (0.62 or 0.64 s). Both are true; whether the
  reading should be relabelled "set/calculated" is a copy decision for batch 04 or the owner.
- **Volume anchor one step late** (Batch 01 `anchorBreathVolume`): "Volume from breath start" is
  zeroed at the first inspiratory sample, which already holds one 20 ms step (13 mL at 40 L/min), so
  the drawn rise is one step smaller than the received volume. Rendering-boundary only; left for the
  batch that owns that contract.
- **Section 1 step 3 look line** says "Read all three traces at interval A, marked on the captured
  breath below" on the experiment step, where the inspection figure carries no marker. Authored copy;
  batch 04.
- **C6 left monitor column at 200 % root text** overlaps the waveform label column (present before and
  after; fixed-px console grid). The overlap no longer splits numbers.
- **Global site header** at 200 % root text: wraps to ~377 px and overflows 51 px at 1280 wide.
  Platform lane (PI prompt 05); not an MV change.
- **`VentilationWaveformAnatomy` panel** (render-harness only; not mounted by the Learn host) has one
  unstyled button.

## NOT RUN

- Native browser zoom; Firefox and Safari; real devices; DPR 2 (all runs were DPR 1 — DPR, CSS zoom,
  native zoom and root-text enlargement were not conflated; only the last was tested).
- Real assistive technology (VoiceOver, NVDA). Semantics were checked in code and jsdom (heading focus
  - `aria-describedby`, polite status region, `aria-pressed` toggles), not with a screen reader.
- Light site theme screenshots: the module frame paints its own dark palette in both site themes; not
  re-screenshotted.
- The es and zh-CN locales; the deployed build; beta-wrapped routes.
- Bounded all-case physiology replays and 1×/5×/30× comparisons: no physiology, clock or alarm code
  changed; the Batch-02 invariance suites were run instead and pass.
- Every section at 1× wall-clock time (5× and Advance one breath were used for timed intervals).
- Any clinical, device, media or source review.

## What must not be undone

- Focus and scroll move only from explicit navigation handlers. Do not add a global
  `focusin`/`scrollIntoView` handler, and keep `behavior: 'instant'` (the site's smooth scrolling
  cancels an `'auto'` scroll).
- The experiment panel reads `labGoalMet` / `labReadyToCompare`; automatic capture stays opt-in,
  confound-held and state-driven (no timers, no polling).
- Captured records keep their source resolution; thin at drawing time if ever needed, preserving
  extrema and phase boundaries.
- VC and PC share one axes object; never scale a mode on its own.
- The plateau word comes from `plateauAcquisition`; do not reintroduce a glyph without a legend.
- The pathway accordion must not choose its open group or "Up next" before stored progress is read.

## Stop

One PR, opened and stopped. No merge, no deploy, no batch 04, no G02 restart.
