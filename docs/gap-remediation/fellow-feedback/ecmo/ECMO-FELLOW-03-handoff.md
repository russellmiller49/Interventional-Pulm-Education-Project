# ECMO-FELLOW-03 — console and visual workbench

> Independent adversarial review, September 24–25: see [ECMO-FELLOW-03-sanity-review.md](ECMO-FELLOW-03-sanity-review.md). It supersedes this implementation-time report's geometry, label-placement, validation and readiness claims. Review repairs are `62b8ca21` and `8ff74d3c`; current main `d26446f2` was integrated by true merges. Current dispositions are **17 repaired / 7 partial**. The detailed measurements below remain historical evidence, not independent acceptance.

Implementation: September 23, 2026. Prepared by Claude (AI implementation). **Not reviewed by a
clinician, a perfusionist or a device specialist.** This is a software, layout and teaching-visual
remediation. It is not clinical validation, device validation or release approval, and it closes no
`OWNER_DECISIONS.md` hold.

**Result.** The console reflows by its own width, so no control is clipped at 1280×961, 1280×800
or 1024×768. The task, its control and the reading it asks for now sit together in S2, S3, S7, S8
and Practice C5. Wide teaching tables recompose into labelled cards when their own box is narrow.
The VV and VA capstone comparisons show every hypothesis, filterable, with the reasoning on
request. The drawings add these presentation changes; their clinical interpretation still requires review:

- the VV return runs up the venous side;
- the VA right-arm site is on the patient's right;
- the 3D labels are legible and do not collide;
- two new schematics say plainly that they compute nothing.

Of the 24 assigned source IDs:

- **17 are repaired**;
- **7 are partly repaired** (S2-2, S2-8, S6-1, S7-2, VA6-1, VA7-3, VA11-1), with the remaining subpart and its owner
  named.

None is classified "not reproduced". Every row reproduced on the baseline production build before
any change.

No equation, answer key, clinical threshold, alarm or device behaviour, persistence, scoring or
source approval changed. The two new diagrams are conceptual teaching adaptations awaiting clinical
review. They are not physiology or device validation.

**Evidence provenance.** The source rows come from `CARDIOHELP_ECMO_learner_walkthrough.docx`, an
AI-assisted browser walkthrough written in a first-year-fellow persona. It is not a learner study
and not a clinical or device review. Every row was reproduced against production builds of the
baseline SHA with a scripted Chromium using real learner controls. The same script was then run
against this branch.

## Scope, Git and isolation

- **Task file:** `03_ECMO_CONSOLE_AND_VISUAL_WORKBENCH.md`.
  - Read with `00_START_HERE.md`, `FEEDBACK_LEDGER.md` (and `.json`), `SOURCE_AND_CODE_NOTES.md`,
    `CROSS_MODULE_COORDINATION.md`, `OWNER_DECISIONS.md` and `SHARED_FEEDBACK_HANDOFF.md`, all in
    `Interventional-Pulm-Local-Data/module_update_9_19/ECMO_Claude_Implementation_Pack`.
  - Also read: the Prompt-01 and Prompt-02 handoffs, and the repository `AGENTS.md` and `CLAUDE.md`.
- **Branch `claude/ecmo-fellow-03`** is in the worktree
  `Interventional-Pulm-Education-Worktrees/claude-ecmo03`.
  - The desktop harness pinned this session to that worktree.
  - `CLAUDE.md` names the permanent `…/claude` worktree. That worktree was not used or touched,
    and neither was any other session's worktree.
  - Two temporary detached worktrees were made in this session's scratch directory and removed at
    the end: the `a306d825` baseline (for the baseline build and the failing-before run) and a clean
    `85acc113` checkout (for the consumer-suite comparison).
  - This follows the per-task worktree practice the earlier ECMO prompts used.
- **Baseline:** `a306d825` (`origin/main`, PR #265). Every "before" in this document was measured
  there, either on a production build or in Jest.
- **Main moved during the session** to `85acc113` (PR #275, CRRT-FELLOW-04).
  - Main's changes since `a306d825` are CRRT paths plus two critical-care title strings
    (`activities.ts`, `learningPathways.ts`).
  - No path overlaps this branch, which changes only `src/features/cardiohelp-ecmo/**` and this
    document.
  - It was merged, not rebased (`f2c47d1f`). Every check below ran on the merged tree.
- **Commits on the branch:**

| SHA        | What                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| `000020cd` | Runtime: console reflow and visual workbench                              |
| `c9bd4ac6` | Tests: the Prompt-03 contract; existing suites follow two renamed texts   |
| `f2c47d1f` | Merge `origin/main` `85acc113`                                            |
| `da60ffe7` | Runtime: 3D scene labels whole and clear of each other (found post-merge) |
| `8ef61141` | Runtime: restack the S3 before/after comparison when it cannot fit        |
| `61de041b` | Runtime: the last 320 px / 200 % page overflows, fixed at their source    |
| _(this)_   | Docs: this handoff                                                        |

- **Ports:** only this worktree's own processes were used, and all were stopped before each
  production build.
  - 3151: baseline production standalone, an APFS clone of the `a306d825` build.
  - 3152: branch production standalone before the merge.
  - 3153: final production standalone, rebuilt at each runtime commit. The last build is from
    `61de041b`, and every "final" number below comes from it, unless it is marked as from the
    `da60ffe7` build (the full 15-journey acceptance run, whose later commits only change
    320 px / 200 % reflow and the S3 comparison — those journeys were re-run).
  - No other worktree's server or watcher was stopped.
- **Browser isolation:** Playwright-launched Chromium with a fresh context per page.
  - The owner's signed-in profile was not used, and `.env.local` was not changed.
  - Third-party hosts were blocked, and `/api/*` answered with an empty stub payload, as in the
    repository's own `e2e/ecmo-layout.spec.ts`.
- **Real WebGL:** the full Chromium binary in new-headless mode
  (`channel: 'chromium'`) renders on the Mac's GPU: `ANGLE (Apple, ANGLE Metal Renderer: Apple M5
Max)`, WebGL 2.0. The fallback test uses the headless shell with GPU and WebGL switched off.

### PR #134 (coordination only)

PR #134 (`claude/critical-care-shared-and-hub`) is **still open and unmerged**. It was read as
coordination evidence. None of its code was copied or merged.

- **ECMO intents.** Its ECMO changes (StageLayout pane order, `EcmoOtherAnswers`, the
  foundation-workspace test, `FoundationStoryProblems`, and the scroll helper) aim at the same
  task/visual co-location this batch had to solve.
  - This batch solves that inside the ECMO flowing layout instead: comparison-first S3, drill
    question-first, the pArt/MAP pair, and a reveal-only scroll helper.
  - It edits none of #134's shared files.
- **Not taken, by design:** its shared `learning-module/stage/StageLayout.tsx`, `AnswerVerdict.tsx`,
  `scrollStagePaneToTop`, critical-care hub and progress-sync changes. They belong to the shared
  lane, per the pack.
- **Future conflict.** #134 and this branch both edit four ECMO files: `DrillStageHost.tsx`,
  `FoundationStageHost.tsx`, `EcmoLessonStage.module.css` and `scrollTaskPaneToTop.ts`.
  - If #134 is revived, it must be re-derived against this branch, not merged over it.
- **Muted text token (observation, not changed).** #134's record notes that ECMO muted text renders
  at full ink. That is still true.
  - Inside the workspace, `--muted` is an HSL triple, not a colour, so `color: var(--muted)` falls
    back to inherited ink (`rgb(234, 244, 244)`).
  - This is a hierarchy issue, not a contrast failure. Fixing it touches the module-wide token
    contract and is left to its owner.

## Dispositions (24 source IDs)

Legend:

- **R** — repaired.
- **P** — partly repaired; the remainder and its owner are named.

"Before → after" is measured on production builds: 3151 (baseline) against 3153 (final), at
1280×961 unless stated.

| ID     | Sev | Disp. | What changed (before → after)                                                                                                                                                                                                                                                                                                                                                                                   | Remaining / owner                                                                                                         |
| ------ | --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| S1-2   | P2  | R     | Now-card primary ink is stated where the module-shell `button { color: inherit }` rule cannot override it. Contrast normal 1.38 → 10.95:1, hover/focus 13.03:1, pressed 8.21:1. 3 px focus outline kept.                                                                                                                                                                                                        | The ECMO frame is dark-only (`theme="dark"`), so there is one theme to measure. Disabled appearance unchanged.            |
| S2-2   | P2  | P     | The VV return is drawn up the venous side into the vein. The legend says red marks oxygenated blood and that in VV it returns into a vein, not an artery. Anterior view declared. Label-over-line crossings VV 11 → 5, VA 25 → 7; text-on-text 0 → 0. Smallest rendered label beside the task 5.3 → 6.9 px. A keyboard "Show the circuit at full width" toggle renders it at 10.9 px (1280) and 12.5 px (1920). | The ≥12 px ask is met only at full width on wide screens. A larger or zoomable map is a further **03** design item.       |
| S2-3   | P2  | R     | Labels 9.3 → 12 px; pushed-back labels 34 % → 90 % opacity; mode pill on its own dark ground. Pills sit above their object on a leader and are placed so none collide or sit under the HUD. A keyboard "Find on the model" list emphasises any one label.                                                                                                                                                       | —                                                                                                                         |
| S2-4   | P2  | R     | Circuit pArt and patient MAP sit in one pair, each named by its measurement site, both read from the one live state. Gap 1,258 → 25 px.                                                                                                                                                                                                                                                                         | —                                                                                                                         |
| S2-5   | P2  | R     | A compact "Model reference" line keeps the model and "clock held" visible. The clock, variant-boundary and observation-only text moved into "About this model". Nothing that qualifies a visible result is hidden.                                                                                                                                                                                              | —                                                                                                                         |
| S2-8   | P3  | P     | The real `aria-pressed` pressure toggles now show a pressed state. The task list says "Task n", matching the header's "Task n of m".                                                                                                                                                                                                                                                                            | "ΔP" vs "Δp trend" vocabulary: **04** (teaching copy).                                                                    |
| S3-1   | P2  | R     | The comparison block (Repeat/Reset first, then the result) leads the step. Run → result 792 → 246 px; the post-run scroll jump 905 → 119 px, and it scrolls only when the result is not already visible. Nothing reruns on resize or disclosure.                                                                                                                                                                | —                                                                                                                         |
| S4-1   | P2  | R     | The console reflows on its own width (three container arrangements). Clipped controls 8 → 0 at 1280×961 and 1280×800. Hints 9 → 14 px, tabs 9.2 → 12 px, status bar 9.6 → 12 px. A key under the device explains the tab abbreviations and ≡.                                                                                                                                                                   | —                                                                                                                         |
| S5-2   | P2  | R     | Teaching tables become labelled cards when their own box is narrower than 36 rem, with a label on every value. Units and column relationships are kept. Letter-by-letter breaking is gone.                                                                                                                                                                                                                      | —                                                                                                                         |
| S5-5   | P3  | R     | The per-signal sentences stay available in a "Read as sentences" disclosure. The table itself remains the accessible structure. "serieswith" is fixed (an SWC whitespace trap), and saturations carry %.                                                                                                                                                                                                        | —                                                                                                                         |
| S6-1   | P2  | P     | A VV series-loop schematic: seven nodes, a distinct dashed recirculation short-circuit, and "Schematic · not to scale" with a caveat. It sits before the existing text list, which is kept.                                                                                                                                                                                                                     | Clinical review of the schematic: **05** (teaching adaptation).                                                           |
| S7-1   | P2  | R     | The signal register becomes labelled cards on a narrow box (the minimum cell was 38 px). pAux is explained under the console from the IFU (rev. 2.3, pp. 45, 91, 110), with the statement that this model has no pAux sensor. The control is not removed.                                                                                                                                                       | —                                                                                                                         |
| S7-2   | P2  | P     | The "+" setpoint control is no longer clipped at 1280 px. The dial, readings and task sit together. From the keyboard at 1280 the probe now reaches 3,000 rpm requested (0 at baseline), the same as at wider screens.                                                                                                                                                                                          | Ramp rate unchanged by owner decision (Prompt 01). Live response before the "Let the circuit respond" step: **01/02/04**. |
| S8-2   | P2  | R     | The drill's question and options lead the Now card, before the teaching and the simulator. Heading → options 3,435 → 184 px. Recognise/predict steps show readings before the console.                                                                                                                                                                                                                          | On a phone the readings sit well below the options (single column). Noted, not changed.                                   |
| S17-1  | P1  | R     | The capstone matrix shows every hypothesis: a table at ≥1280, one card per signal row when the comparison does not fit. A hypothesis filter can never hide the last hypothesis, and "Show all" restores everything. Visible columns 0 → 4 at 1280 (1 → 4 at 1440). No response gate.                                                                                                                            | —                                                                                                                         |
| S17-2  | P2  | R     | The discriminator shows in each cell and the reasoning is on request (collapsed by default). No row is deleted. Words before the first prediction 3,978 → 2,346; page height 12,635 → 6,932 px.                                                                                                                                                                                                                 | —                                                                                                                         |
| VA5-2  | P3  | R     | As S5-5: saturations and NIRS in %, the right-arm/post-oxygenator gap in percentage points, "parallelwith" fixed, sentences in a disclosure.                                                                                                                                                                                                                                                                    | —                                                                                                                         |
| VA6-1  | P1  | P     | The missing diagram now exists: a conceptual aorta showing both streams, the coronary origins at the root, the arch branches and the right-radial site. The learner can switch between two hand-placed illustrations. It is labelled "conceptual" and "not computed", and it never claims coronary oxygenation from a radial value.                                                                             | Clinical review of the illustrations: **05** (ECMO-OWNER-12).                                                             |
| VA7-2  | P2  | R     | The R ARM site and its value are drawn on the patient's right (viewer's left, anterior view). The native-ejection cue and labels are de-collided.                                                                                                                                                                                                                                                               | —                                                                                                                         |
| VA7-3  | P2  | P     | The aortic-streams diagram is introduced in Section 6, where it is taught, and reused in the VA11 drill.                                                                                                                                                                                                                                                                                                        | Human review of the reused illustration: **ECMO-OWNER-12 / 05**.                                                          |
| VA11-1 | P1  | P     | Still no state-driven marker: there is no modeled mixing variable (traced in Prompt 02). A conceptual comparison lets the learner move the band between two hand-placed illustrations, and the map's mixing note is always visible. Nothing animates to fake a computed position.                                                                                                                               | A reviewed model binding: **ECMO-OWNER-12 / 05**.                                                                         |
| VA17-1 | P1  | R     | As S17-1, VA: visible columns 1 → 5; page height 22,072 → 11,539 px.                                                                                                                                                                                                                                                                                                                                            | —                                                                                                                         |
| C1-5   | P3  | R     | Before support starts, the strip reads sweep as "set · support not started" (speed was already "requested" from Prompt 01). The self-paced actions are bordered buttons. "Compare this prediction" became "Record prediction for the debrief", which says what it does.                                                                                                                                         | The debrief's "Next" target is the authored next case by design (Prompt 01), unchanged.                                   |
| C5-2   | P3  | R     | For the two oxygenation-focus cases, Manage leads with the patient monitor, open. The brief/live labelling is Prompt 02's.                                                                                                                                                                                                                                                                                      | —                                                                                                                         |

**Current counts:** 17 R and 7 P (S2-2, S2-8, S6-1, S7-2, VA6-1, VA7-3, VA11-1). The three additional partials preserve required human review of the new teaching diagrams.

### Lane-03 remainders routed here by Prompts 01 and 02

- **Prompt 01:** the off-screen "+" (S7-2); tab-label naming and ≡ (console key); "steps" vs
  "tasks" (Task n); and 320 px/200 % Practice overflow from the track toggle, the self-paced row and
  the Now-card action row. All four are repaired; see the matrix for the overflow numbers.
- **Prompt 02:** the collapsed monitor in C5 (C5-2, repaired); VA11-1's visual (above).
- **Not in this prompt's ID list, so not changed:**
  - S6-2 transfer-question placement (03/04);
  - the S14-1 "delivered" label (ECMO-OWNER-02).

## Browser matrix

**Viewports.** Nine were driven with the same script against the baseline (3151) and the final
build (3153):

- 1280×961, 1280×800, 1440×900, 1920×1080, 1024×768, 390×844 and 320×740;
- 1280×961 and 320×740 again at **200 % root font size**.

**How "200 %" was produced.** Each method scales something different, so each is labelled:

| Method                                            | Tested? | Notes                                                                                                                                   |
| ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Root font size 200 % (`html { font-size: 32px }`) | **Yes** | Scales every rem-based size: type, the console's container thresholds, and the table and comparison thresholds.                         |
| CSS `zoom`                                        | No      | Not driven. Prior lanes (PI-OUTLINE-01, PI-WRAP-01) record `vw`/`rem` traps under CSS zoom; not re-verified here.                       |
| Native browser zoom                               | No      | Playwright cannot drive Chrome's native zoom. Root-font 200 % stands in for text scaling only; px-sized elements do not scale under it. |
| Device pixel ratio                                | DPR 1   | `deviceScaleFactor: 1` throughout. The 3D canvas caps DPR at 1.7 (`dpr={[1, 1.7]}`, unchanged). No DPR 2 run.                           |

**Theme.** The ECMO module frame is dark-only (`theme="dark"`), and the browser ran in
`prefers-color-scheme: dark`.

### Page horizontal overflow (document `scrollWidth`; ✗ = scrolls sideways)

Every journey at the seven plain viewports: **no overflow before or after**, except as listed here.

| Journey                    | 320×740 @ 200 %, baseline → final |
| -------------------------- | --------------------------------- |
| S2 pArt/monitor            | ✗ 462 → 320                       |
| S3 pump change (after Run) | ✗ 380 → 320                       |
| S4 console                 | ✗ 380 → 320                       |
| S7 console task            | ✗ 462 → 320                       |
| S8 troubleshooting         | ✗ 462 → 320                       |
| S17 capstone               | ✗ 357 → 320                       |
| VA17 capstone              | ✗ 357 → 320                       |
| S5/S7 tables               | ✗ 326 → 320                       |
| VA11 drill                 | ✗ 459 → 320                       |
| Practice C5                | ✗ 412 → 320                       |
| Practice C1                | ✗ 380 → 320                       |
| S1 (Continue)              | ✗ 380 → 320                       |
| S6, VA6, S2-3D             | 320 → 320                         |

Each overflow was fixed at its source, not hidden:

- the no-wrap "BOUNDED MODEL" badge in the circuit panel heading;
- a simulator-surfaces grid with no explicit column, which grew to its widest child;
- whole-word table headers in fixed columns (the S3 comparison);
- attribution `<select>`s as wide as their longest option;
- the track toggle and self-paced rows (the observation Prompt 01 routed here);
- the header chrome.

No `overflow-x: hidden` was added to the page. One element scrolls in place by design: the shared
launch gate, inside the bedside tab (see observations).

**Every Learn step, both tracks** (the registry inventory `scripts/critical-care/ecmo-layout-inventory.mts`,
34 sections and 240 steps), on the final build:

| Viewport                      | Steps measured | Page overflow |
| ----------------------------- | -------------- | ------------- |
| 320×740 @ 200 % (every step)  | 214 of 240     | **0**         |
| 320×740 (first step of each)  | 34 of 34       | 0             |
| 1280×961 (first step of each) | 34 of 34       | 0             |

- **The 26 unmeasured steps** are steps 2–9 and 2–6 of the two operational emergency drills in each
  track (`arterial-bubble-stop`, `transport-power-loss`). The sweep could not open their task
  history before the drill is acted on.
- Their first steps were measured. The repository's `ecmo-focus` spec drives those drills
  separately (below).
- **Before this final pass**, the same sweep found 8 steps still overflowing at 320 px / 200 %
  (334–443 px): the why-ECMO attribution, the gas-source transfer, and the integration capstones.
  `8ef61141` and `61de041b` fixed them.

### Geometry (baseline → final, production builds)

| Measure                                         | 1280×961                                      | 1280×800    | 1440×900                       | 1920×1080                      | 1024×768                     | 390×844                      | 320×740       | 1280×961 @ 200 %     | 320×740 @ 200 % |
| ----------------------------------------------- | --------------------------------------------- | ----------- | ------------------------------ | ------------------------------ | ---------------------------- | ---------------------------- | ------------- | -------------------- | --------------- |
| S2 pArt → patient MAP (px)                      | 1,258 → 25                                    | 1,258 → 25  | 1,317 → 25                     | 1,318 → 24                     | 1,838 → 670                  | 2,278 → 1,095                | 2,539 → 1,278 | 2,444 → side by side | 7,113 → 5,839   |
| S3 Run → result (px)                            | 792 → 246                                     | 792 → 246   | 792 → 246                      | 792 → 246                      | 792 → 246                    | 1,160 → 334                  | 1,346 → 358   | 2,060 → 615          | 6,380 → 1,367   |
| S3 scroll jump after Run (px)                   | 905 → 119                                     | 905 → 280   | 901 → 176                      | 901 → 0                        | 942 → 349                    | 1,431 → 591                  | 1,680 → 684   | 2,335 → 977          | 7,506 → 2,464   |
| S4 console controls clipped                     | 8 → 0                                         | 8 → 0       | 0 → 0                          | 0 → 0                          | 0 → 0                        | 0 → 0                        | 0 → 0         | 9 → 0                | 5 → 0           |
| S4 hint / tab / status type (px)                | 9 / 9.2 / 9.6 → 14 / 12 / 12                  | same        | 9 / 10.4 / 10.8 → 14 / 12 / 12 | 9 / 10.7 / 11.5 → 14 / 12 / 12 | 9 / 8.3 / 9.1 → 14 / 12 / 12 | 9 / 7.7 / 9.1 → 14 / 12 / 12 | same as 390   | ×2                   | ×2              |
| S7 "+" clipped                                  | yes → no                                      | yes → no    | no → no                        | no → no                        | no → no                      | no → no                      | no → no       | yes → no             | no → no         |
| S8 heading → options (px)                       | 3,435 → 184                                   | 3,435 → 184 | 3,210 → 184                    | 3,210 → 184                    | 4,386 → 205                  | 7,189 → 465                  | 8,151 → 619   | 14,733 → 628         | 31,479 → 2,935  |
| S17 hypotheses visible / page height (px)       | 0 → 4 / 12,635 → 6,932                        | same        | 1 → 4 / 11,809 → 6,636         | 1 → 4 / 11,809 → 6,591         | 3 → 4 (cards)                | 0 → 4 (cards)                | 0 → 4 (cards) | 0 → 4 (cards)        | 0 → 4 (cards)   |
| VA17 hypotheses visible / page height (px)      | 1 → 5 / 22,072 → 11,539                       | same        | 1 → 5 / 20,285 → 10,554        | 1 → 5 / 20,285 → 10,508        | 4 → 5 (cards)                | 0 → 5 (cards)                | 0 → 5 (cards) | 0 → 5 (cards)        | 0 → 5 (cards)   |
| S1 Continue contrast (normal / hover / pressed) | 1.38 → 10.95 / 13.03 / 8.21 at every viewport |             |                                |                                |                              |                              |               |                      |                 |
| Phone chrome, S2 header + strip (px)            | 145 → 145                                     | 145 → 145   | 127 → 127                      | 115 → 115                      | 167 → 167                    | 393 → 322                    | 501 → 384     | 434 → 434            | 1,654 → 1,450   |

Notes on the table:

- **S17 words before the first prediction:** 3,978 → 2,346. **VA17:** 7,864 → 4,368.
- **Capstone layout:** a table at ≥1280 px at normal text; one card per hypothesis below that and
  at 200 %.
- **Hiding a hypothesis** leaves 3 of 4 (VA: 4 of 5), and "Show all" restores every one. The last
  hypothesis cannot be hidden.
- **S5/S7 tables:** the S7 signal register's narrowest cell was 38 px with 4 single-word cells
  broken letter by letter at 1280. It is now one labelled card per signal.
  - The VV and VA normal-state tables stay tables at ≥1024 px and become cards at 390, 320 and
    200 %. At baseline their narrowest cell there was 21–46 px, with up to 42 words broken.
- **S7 at 1280×961 @ 200 %:** the dial, requested speed and response no longer fit in one viewport.
  The reflowed console is taller, which is the cost of not clipping controls. At normal text they
  are co-visible at every viewport.
- **S8 at 390/320:** the question is now near the heading. The readings sit 5–6 k px below the
  options in the single column. Noted as a limit, not changed.
- **S2 at 1024 and below:** the row measures pArt to the full patient-monitor card. The pArt/MAP
  pair itself, with both values side by side, is present at every viewport. In the single column
  the full monitor card sits 670–1,278 px below it.

### Diagram and labelling checks

| Check                                      | Baseline                      | Final                                                                                    |
| ------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------- |
| VA6 aortic-streams diagram present         | no                            | yes, all 9 viewports. The illustration switch moves the band distal → proximal.          |
| S6 series-loop diagram, nodes              | no / 0                        | yes / 7, all 9 viewports                                                                 |
| VA11 right-arm site on patient's right     | no                            | yes, all 9                                                                               |
| VA11 mixing note visible without scrolling | no at ≥1024                   | yes, all 9                                                                               |
| C5 Manage surface order                    | console first, monitor closed | monitor first and open, all 9                                                            |
| C1 strip before support                    | "SWEEP 2.0 L/min"             | "SWEEP 2.0 L/min set · support not started"                                              |
| Map label-over-line crossings (VV / VA)    | 11 / 25                       | 5 / 7 (text-on-text: 0 / 0 both)                                                         |
| Map smallest rendered label, 1280          | 5.3 px                        | 6.9 px beside the task; 10.9 px full width (keyboard toggle); 12.5 px full width at 1920 |

## 3D: real WebGL and fallback

- **Renderer:** real WebGL 2.0 on `ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max)`, with the
  full Chromium binary in new-headless mode, for both builds.
- **Scene labels at the default camera** (VV, S2):

| Viewport  | Label px | Pushed-back opacity | Pill overlaps | Under HUD/toggle | Narrowest pill | Chars/line (min) | Finder buttons | Mode pill ground                                    |
| --------- | -------- | ------------------- | ------------- | ---------------- | -------------- | ---------------- | -------------- | --------------------------------------------------- |
| 1280×961  | 9.3 → 12 | 0.34 → 0.9          | 0 → 0         | — → 0            | 119 px         | 11.5             | 0 → 8          | green `rgb(118,214,155)` → dark `rgba(3,20,24,.95)` |
| 1280×800  | 9.3 → 12 | 0.34 → 0.9          | 0 → 0         | — → 0            | 119 px         | 11.5             | 0 → 8          | same                                                |
| 1440×900  | 9.3 → 12 | 0.34 → 0.9          | 0 → 0         | — → 0            | 119 px         | 11.5             | 0 → 8          | same                                                |
| 1920×1080 | 9.3 → 12 | 0.34 → 0.9          | 0 → 0         | — → 0            | 119 px         | 11.5             | 0 → 8          | same                                                |
| 1024×768  | 9.3 → 12 | 0.34 → 0.9          | 2 → 0         | — → 0            | 119 px         | 11.5             | 0 → 8          | same                                                |

- **Pre-fix regression, caught by this run.** An intermediate build (3152) broke every pill into
  one letter per line: 34 px wide and 533 px tall.
  - Cause: drei renders each pill in a 0 px-wide wrapper, and the Learn flow's
    `overflow-wrap: anywhere` reached it.
  - `da60ffe7` fixes it and adds the collision placement. A contract test pins both.
- **At ≤768 px** (390 and 320) the scene hides its labels by design (unchanged, `(max-width: 768px)`)
  and keeps its static text list.
- **Not measured:** the 3D labels at 1280 × 961 with 200 % text. They are shown there, and their
  rem-based size doubles. The placement pass applies, but no overlap count was taken.
- **Finder.** Pressing "Femoral vein — drainage" in "Find on the model" emphasises exactly that
  pill. It moves no camera.

### WebGL unavailable (fallback)

This ran on the headless shell with `--disable-gpu --disable-software-rasterizer --disable-webgl`,
where WebGL context creation fails. It was run against the final build.

| Page                     | Fallback text | Canvas | Finder / labels toggle | Diagnostic map | Clamp from keyboard                                                   | Page errors |
| ------------------------ | ------------- | ------ | ---------------------- | -------------- | --------------------------------------------------------------------- | ----------- |
| Learn S2 circuit walk    | shown         | none   | hidden / hidden        | present        | (controls read-only in this foundation lesson, as designed)           | 0           |
| Practice VV air embolism | shown         | none   | hidden / hidden        | present        | Enter on drainage clamp: `aria-pressed` false → true, isolation shown | 0           |

Both pages report `scrollWidth` 1280 at 1280 px.

### Beta wrapper

| Build               | `/en/development-beta/cardiohelp-ecmo` | Public `/en/cardiohelp-ecmo` |
| ------------------- | -------------------------------------- | ---------------------------- |
| Baseline `a306d825` | **500**                                | 200                          |
| Final               | **500**                                | 200                          |

- The 500 is thrown in `middleware.js`: "Your project's URL and Key are required to create a
  Supabase client!". This worktree has no `.env.local`, by rule.
- It is identical on the baseline build, so the wrapper could not be exercised here.
- Its ownership (the beta wrapper, feedback storage) is outside this lane. Nothing was changed to
  work around it.
- **A signed-in smoke on an environment with credentials remains to be done by the owner.**

## Regression protection (Prompt 01 and Prompt 02)

The two earlier lanes' own production-browser scripts were re-run against the final build, with
their assertions unmodified. They come from `renders/output/ecmo-fellow-01-2026-09-21/verify.mjs` and
`renders/output/ecmo-fellow-02-2026-09-22/verify-02.mjs`. Only three mechanical changes were made:

- this worktree's Playwright path;
- `127.0.0.1:3153`;
- the `/api` stub.

One stale selector in Prompt-01's script was widened: `/Step 1 second/` →
`/Step 1 (modeled )?second/`. Prompt 02 renamed that button, and the assertion is unchanged.

| Script                      | Result                                                                                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt 01 (`verify.mjs`)    | **29 / 31.** Pass: VV and VA air (refusal → isolate + de-air → resume → repeat press inert); safety card, explanation, restart kept, debrief after the safety event with readings; C7-2 harmful badge; C3-1 protective stop; resume control at 4 viewports; keyboard at 320 px / 200 %. |
|                             | The 2 failures are "no page errors" on the air cases. They are RSC prefetches of global site-nav pages (`/en`, `/en/search`, `/en/board-prep`, …) returning 500 for the same missing Supabase env. Prompt 01's own run recorded the same two.                                           |
|                             | **Prompt 01's own run failed "320 px / 200 % text: no horizontal page scroll"; it now passes.**                                                                                                                                                                                         |
| Prompt 02 (`verify-02.mjs`) | **29 / 29.** Includes: authored values at t = 0; untreated C5 / VAC5 / VAC2 truth; the same-second grouping; the reveal stopping the clock with no time passing; S17-4 held capstone; C3-1 stop at the crossing request; the Prompt-01 restart; E8 before/after observation.            |

The Jest guards also pass: `ecmo-fellow-01-recovery-and-state-truth`, `ecmo-fellow-02-causality-and-time`
and `ecmo-fellow-02-surfaces`, 146 / 146 on the merged tree. So do the full ECMO suite below and the
repository's own ECMO layout and focus specs.

## Verification (final merged tree, `origin/main` `85acc113` integrated)

| Check                                                                                   | Result                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ECMO Jest (`src/features/cardiohelp-ecmo`)                                              | **78 suites, 2,499 tests, all pass.** The baseline gate at `a306d825` was 77 / 2,467.                                                                                                                                                                                      |
| New contract `ecmo-fellow-03-console-and-visual-workbench.test.tsx`                     | 28 tests. **Failing-before:** against `a306d825` with compile-only stubs for the new modules, **27 fail** at their assertions. The one that passes is the "wide header unchanged" preservation guard.                                                                      |
| Consumer suites (critical-care, learning-module, app, module-beta)                      | 83 suites, 815 tests, **3 fail**: CRRT station order, the critical-care colour-accessibility sweep, and MV/MCS/CRRT learner-copy. The **same 3 fail on clean `origin/main` `85acc113`** and on `a306d825`. None names an ECMO file, and the ECMO learner-copy test passes. |
| TypeScript (`tsc --noEmit`, 8 GB heap)                                                  | exit 0                                                                                                                                                                                                                                                                     |
| ESLint, changed paths                                                                   | exit 0                                                                                                                                                                                                                                                                     |
| Prettier `--check`, changed paths                                                       | clean                                                                                                                                                                                                                                                                      |
| `git diff --check`                                                                      | clean                                                                                                                                                                                                                                                                      |
| `npm run build`                                                                         | exit 0; only the pre-existing mermaid/langium "critical dependency" warning, as on the baseline build                                                                                                                                                                      |
| `e2e/ecmo-layout.spec.ts` + `e2e/ecmo-focus.spec.ts` against the final production build | **30 / 30 pass** (12.3 min). This includes the Tab-order specs with the new "Find on the model" buttons, and the 200 % CSS text spec.                                                                                                                                      |
| Production acceptance probe (9 viewports × 15 journeys, baseline vs final)              | Tables above; 0 page errors. The 3D, S2 and S3 journeys were re-run on the `61de041b` build with identical results.                                                                                                                                                        |
| All-steps overflow sweep (240 steps, both tracks)                                       | 0 overflowing of the 214 reachable at 320 px / 200 %; 0 of 34 at 320 and 1280                                                                                                                                                                                              |

## Scope limits: what did not change

- **No physiology, equation, coefficient, answer key, threshold, alarm or device behaviour.** No
  persistence, scoring, mastery or storage contract, and no source approval or owner decision.
  - The one engine-adjacent read is the pArt/MAP pair. It displays two values the live state
    already holds, each named by its existing measurement site.
- **The two schematics compute nothing.**
  - The VV loop and the VA aortic streams are teaching adaptations of relationships the existing
    text states.
  - The VA band's two positions are hand-placed and learner-chosen, and are labelled as such. It
    never moves on its own and is not bound to SpO₂ or flow.
  - **Awaiting clinical review** (ECMO-OWNER-12 for the VA mixing visual).
- **The 3D placement pass moves pills along their own leaders.** The camera, anchors, emphasis
  semantics and label words (`content/circuitSceneAnchors.ts`) are unchanged.
- **Not touched:** shared files (`learning-module/**`, `AnswerVerdict.tsx`, shared feedback, global
  header/footer/navigation, feedback storage, the beta wrapper). The whole diff is under
  `src/features/cardiohelp-ecmo/**` plus this document.
- **No large raw media committed.** Screenshots and logs are in Local-Data (below).

## Observations and open items, with owners

| Observation                                                                                                                                                                                                                                                                                                                                                                      | Owner                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **2D/3D cannulation laterality disagree.** The 2D map (anterior view) draws drainage in the patient's right femoral vein and return on the left. The 3D bedside scene anchors drainage in the patient's **left** femoral vein and return on the right. Neither was changed: which side is authored truth is a content decision.                                                  | Clinical/content owner (05)          |
| The pressure-zone map meets ≥12 px only at full width on wide screens (S2-2 remainder). Beside the task it is 6.9–8.6 px rendered.                                                                                                                                                                                                                                               | 03 follow-up (map design)            |
| "ΔP" (derived difference) vs "Δp trend" vocabulary (S2-8 remainder).                                                                                                                                                                                                                                                                                                             | 04                                   |
| Hold-to-ramp rate and live flow response before "Let the circuit respond" (S7-2 remainder).                                                                                                                                                                                                                                                                                      | Owner decision via 01; 02/04         |
| A modeled mixing-region binding (VA11-1 remainder).                                                                                                                                                                                                                                                                                                                              | ECMO-OWNER-12 / 05                   |
| ECMO muted text renders at full ink (`--muted` is an HSL triple inside the workspace). This is hierarchy, not contrast.                                                                                                                                                                                                                                                          | Module token owner                   |
| S7 at 1280 × 961 with 200 % text: dial and response are no longer co-visible in one viewport, the cost of not clipping controls.                                                                                                                                                                                                                                                 | 03 (known limit)                     |
| S8 at phone widths: readings sit 5–6 k px below the options in the single column.                                                                                                                                                                                                                                                                                                | 03/04 (known limit)                  |
| The debrief's "Next" is the authored next case by design (Prompt 01), unchanged.                                                                                                                                                                                                                                                                                                 | —                                    |
| CSS zoom, native browser zoom and DPR ≥ 2 were not driven.                                                                                                                                                                                                                                                                                                                       | Next browser pass                    |
| Beta wrapper not exercisable without credentials (500 in middleware on baseline and final).                                                                                                                                                                                                                                                                                      | Platform/beta owner, signed-in smoke |
| The shared `SimulationLaunchGate` (the bedside tab's device-suitability card) carries its own 1.25 rem gate padding and ≥1.2 rem card padding. At 320 px with 200 % text that leaves under 100 px for its text. ECMO now keeps its words whole and lets the gate scroll inside the bedside tab instead of widening the page. The gate's own narrow layout is the shared owner's. | Shared learning-module owner         |
| PR #134 (open) edits 4 of the same ECMO files. It must be re-derived, not merged over this.                                                                                                                                                                                                                                                                                      | Shared-lane owner                    |

## Readiness

The independent review in [ECMO-FELLOW-03-sanity-review.md](ECMO-FELLOW-03-sanity-review.md) is authoritative for the current branch. Its final checks use a production build after current-main integration and the review repairs. Software/runtime merge readiness, clinical/device content readiness and release readiness are recorded separately there. No owner decision was closed; the new schematics and the 2D/3D femoral-side conflict remain held for human review.

## Evidence

Evidence is in `Interventional-Pulm-Local-Data/renders/output/ecmo-fellow-03-2026-09-23/` (not in
Git):

- `acceptance/`: the probe script, baseline, intermediate and final JSON, the summary, and
  screenshots per label;
- `regress/`: the Prompt-01/02 script copies and logs;
- `final-evidence/`: e2e, fallback/beta, sweep, Jest JSON, and tsc/eslint/prettier logs;
- `probe/`: every geometry script used above.
