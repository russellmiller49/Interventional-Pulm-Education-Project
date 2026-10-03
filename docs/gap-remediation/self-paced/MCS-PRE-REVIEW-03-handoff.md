# MCS-PRE-REVIEW-03 — visual workbench and accessibility

Prepared 2026-09-25 by an AI authoring assistant (Claude Opus 5.5) at the owner's request, against
the `MCS_Claude_Implementation_Pack` prepared 2026-09-20. **This is local presentation and
interaction work. Nothing in it is clinical, device, source, media or model approval, and nothing
here claims release readiness.** No physiology, model equation, threshold, answer key, case
condition, AF trigger rating, device identity or alarm changed. MCS-PRE-REVIEW-01's AF containment
and MCS-PRE-REVIEW-02's holds are in force and untouched.

## Read first — final state after independent sanity review

The head first submitted in PR #284 (`c94994f7`) was reviewed independently by Codex on
2026-09-26 and found **NOT READY TO MERGE**: one P1 and nine P2 defects were reproduced on it. Codex
repaired them locally (`0871121d`, `869ae0b6`, `2edd1a6a`) and recorded the review (`1ff63e75`):
[MCS-PRE-REVIEW-03-sanity-review.md](MCS-PRE-REVIEW-03-sanity-review.md) and
[MCS-PRE-REVIEW-03-scope-audit.md](MCS-PRE-REVIEW-03-scope-audit.md). On 2026-09-28 those four
commits were integrated into this branch **by fast-forward to `1ff63e75`** — the exact tree Codex
tested, not a re-implementation — and the repaired head was re-validated (Part 4).

This document keeps the original implementation record as history (Part 1). Where the sanity review
disproved one of its claims, the claim is left in place and marked **Superseded** with the final
behaviour. Parts 2–4 give the sanity findings, the integrated repairs and the final validation.

| Defect on the submitted head (Codex, reproduced)                                                             | Final state on the repaired head                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** ECG: a heart-rate change redrew retained old beats (80→120: peaks 0.955 → alternating 0.534/0.955 mV) | Retained history keeps its observed geometry across increases, decreases, repeated changes and changes near a QRS; stored samples unchanged |
| P2 Rapid double-click on the top Continue advanced two steps                                                 | One activation, one transition, for click, Enter, Space and double-click on both Continue controls, in every navigation state               |
| P2 A monitor the learner closed reopened on revisit                                                          | The learner's open/closed choice is kept per step for the session; the seven monitor-directed steps still open on first arrival             |
| P2 Bottom Continue left the new task > 3,000 px above the viewport                                           | The step bar scrolls into view below the site header at every width and at 200% text                                                        |
| P2 A short trend was padded to a ten-second axis before data existed                                         | The axis spans only recorded samples; caption and accessible name state the recorded interval                                               |
| P2 Cutaway legend words clipped at 320 px / 200% text                                                        | Swatch stacks above its words on phones; no clipped word                                                                                    |
| P2 Case-map labels dark on a dark halo; pump letters dark on dark symbols                                    | Light halo on the light case surface, light letters on dark symbols: 13.52:1 labels, 13.5:1 letters, both browser themes                    |
| P2 Ninth drawer entry ("Integration") clipped at 320 px / 200% text                                          | Section number stacks above its words on phones; all nine entries whole                                                                     |
| P2 Monitor strip labels split into fragments in a fixed 68 px column at enlarged phone text                  | Readout sits above a full-width trace on phones; 0 mid-word breaks in the strips at 390/320 × 100/200%                                      |
| P2 Inherited smooth scrolling could leave focus below the viewport after rapid Tab/Shift+Tab                 | An MCS-scoped rule settles native focus scrolling immediately; no MCS focus stop hidden under the header or below the viewport              |

**F41** is now two dispositions: **CONTRAST — REPRODUCED AND REPAIRED** (the submitted head's "0
failures in both themes" missed the SVG halo and symbol-letter faults above); **SITE-THEME FOLLOWING —
SHARED-OWNER FOLLOW-UP** (the lesson stages remain dark whichever theme the site or browser uses; not
repaired here and not claimed as repaired).

## Identity and scope

|                              |                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worktree                     | `…/Interventional-Pulm-Education-Worktrees/claude-mcs-03` — new for this task; the Prompt-01 (`claude-mcs-9-21`) and Prompt-02 (`claude-mcs-2-9-22`) worktrees were not reused                                                                                                                                     |
| Branch                       | `claude/mcs-pre-review-03-9-24`                                                                                                                                                                                                                                                                                    |
| Authorized starting baseline | `41a34608ec556a59270b4c3b2b5bbb1c924653be` — merge of reviewed PR #264, exactly as named in the task                                                                                                                                                                                                               |
| `origin/main` at start       | `d26446f23b3ed98d7ecd978349eb25c0a33f0689` — 22 commits past the baseline (MV, EBUS, BF, live-beta work). Recorded; the baseline was not moved                                                                                                                                                                     |
| Implementation commits       | `cc38602c` (implementation), `b8d60907` (a hydration wait in one browser check; no product change) and `69a114c2` (the cutaway legend swatches at 320 px, found in the final matrix). This document is committed on top                                                                                            |
| `origin/main` at integration | `2bc539f4e96fe66d196aae9ae08fad4c8131e79a` — see _Latest-main integration_                                                                                                                                                                                                                                         |
| Submitted head               | `c94994f78a23f091c11514760d8299c0a293db9d` — reviewed by Codex: NOT READY TO MERGE                                                                                                                                                                                                                                 |
| Codex repair commits         | `0871121d` (visual and interaction findings), `869ae0b6` (enlarged drawer and monitor words), `2edd1a6a` (focus scrolling) — final code head; `1ff63e75` records the review and scope audit (documentation only)                                                                                                   |
| Integration method           | `git merge --ff-only 1ff63e75` on 2026-09-28: the branch tree equals the tree Codex tested. The fallback patch in Local-Data matches the three code commits by patch-id and was not needed                                                                                                                         |
| Changed paths (final)        | 37 files: the 33 above plus `e2e/mcs-pre-review-03-sanity.spec.ts`, `__tests__/mcs-pre-review-03-sanity.test.tsx` and the two review records; the repairs touch only MCS components, tests and docs — no engine, content, shared or global file                                                                    |
| Report                       | `MCS_ICU_Lab_Fellow_Walkthrough_Findings.docx`, 2026-09-19, SHA-256 `0f6e31dc…3350` — the actual MCS walkthrough, found in Local-Data `module_update_9_19/claude_reviews/`. The pack's `Mechanical_Ventilation_Module_Learner_Walkthrough.docx` was **not** used as MCS evidence                                   |
| Assigned findings            | F03, F04 (presentation), F05, F12, F20, F22, F23, F24 (presentation), F31 (navigation/overlap), F32 (radio appearance/semantics), F33 (layout), F34, F37, F38, F41                                                                                                                                                 |
| Changed paths                | `src/features/mechanical-circulatory-support/**`, `e2e/mcs-pre-review-03.spec.ts`, and this document                                                                                                                                                                                                               |
| Verified unchanged           | `src/features/learning-module/**` (stage, SectionsDrawer, ActivityShell, TaskDrawer, NowCard, SectionHeader), `src/features/critical-care/**`, `src/features/hemodynamics-core/**`, `src/lib/**`, `src/styles/**`, global header/footer, Device Intelligence, every other module, `MCS-03-claim-review-queue.json` |
| Concurrent owners            | No other MCS runtime work open. Open PRs #266/#273/#277/#278/#279/#280/#282 touch other modules; `codex-mcsd-03` sits clean at the baseline                                                                                                                                                                        |

**Shared surfaces were consumed, not edited.** Where a shared component produced an MCS defect —
the Sections drawer, the case page's Current task drawer, stepper and footer, the header's Save &
exit — the repair is a stylesheet rule scoped inside this module's shell, and each is written up
for its owner below.

## Part 1 — Original Prompt-03 implementation (submitted head `c94994f7`)

Everything in Part 1 describes the head as first submitted. Claims the sanity review disproved are
marked **Superseded**; the final behaviour is in Parts 3 and 4.

### What a learner sees

- **A step leads with its way on.** Every Learn step opens with a step bar: which run this is and
  its simulated time on the left, and a primary **Continue** on the right that does exactly what the
  Continue at the foot of the step does. Save & exit stays in the header in the secondary style. The
  seed moved into a closed **Run details** disclosure beside the identity. **Superseded in part:** on
  the submitted head a rapid double-click on the top Continue advanced two steps, and the bottom
  Continue could leave the new task thousands of pixels above the viewport. Final: both controls
  share one handler that treats a native double-click as one navigation, the new step bar scrolls
  into view below the site header, and the top control's accessible name carries its destination
  ("Continue to step 3 of 6", "Continue to next section: …", "Return to current task").
- **"Look here" points at something open.** On the steps whose teaching says "Look here" at a
  monitor region — the Section 1 walk, and Recognize/Predict in Sections 4, 8 and 9 — the full
  monitor starts open, its summary says why, and the named trace or trend is highlighted; the
  arterial strip is drawn twice as tall when it is the target. **Superseded in part:** the submitted
  head re-applied the step default on every visit, so a monitor the learner closed reopened on
  revisit. Final: first arrival uses the step default; afterwards the learner's choice for that step
  is kept for the session. Opening or closing it is display only.
- **One drawing of the circulation per screen** on Section 1's first step; the map numbers the
  places a section lights and names them in the same order.
- **The monitor reads as a monitor.** Pressure (mm Hg) and flow (L/min) are two panels of one
  trend, on fixed scales from zero, with the true value, line style and range of every series in
  words; no "×16" remains and nothing is drawn over the caption. The PV display names both axes
  with units, calls itself this model's plotted surrogate, states the range it plots, and stays on
  screen on a phone. Each modeled QRS is drawn at one height. **Superseded in part (P1):** on the
  submitted head that held only until the heart rate changed — the old beats then lost their
  interpolation and were redrawn sample-to-sample, so retained peaks alternated (0.955 / 0.534 mV at
  80→120). Final: retained beats keep the geometry they were drawn with (Part 3). **Superseded:** the
  trend's time axis was padded to at least ten seconds; it now spans only what was recorded.
- **Section 4's pressure–flow figure** uses the same two-panel chart: a 7 mm Hg wobble looks like 7
  mm Hg and a steady flow is a flat line inside its panel.
- **Pathway drawings explain themselves.** The Impella and durable-LVAD sketches now differ in
  geometry (across the valve vs apex-to-graft around it); source, active component and destination
  are written inside their boxes; the pump cutaway's inlet, outlet and valve labels have leader
  lines to their parts and the line meanings are a legend underneath. **Superseded in part:** at
  320 px with 200% text the legend's words still clipped inside the figure (`69a114c2` fixed only
  the oversized swatches). Final: on phones each swatch stacks above its words.
- **The circulation map** has no phantom teal wedges, no colliding labels, and a lettered key for
  device pathways. **Superseded in part:** on the light case surface its labels were dark ink on a
  dark halo, and the new pathway letters and pin numbers were dark on dark symbols. Final: light
  halo, light letters (13.52:1 / 13.5:1).
- **The Sections drawer** is a vertical list of all nine, with whole words, reachable by keyboard to
  the ninth, closable with Escape. **Superseded in part:** at 320 px with 200% text the ninth entry's
  word "Integration" was clipped although its button fit. Final: the number stacks above the words
  on phones; all nine entries are whole at every tested size.
- **Case pages**: the jump links read as links; Current task no longer covers the patient context;
  all six phases are on screen at every width; the bottom bar no longer covers a phone screen; the
  worked explanation fills its card in three blocks.
- **Radios look like radios**: an empty ring unchecked, a filled centre checked, a dashed ring when
  disabled, a visible focus ring — still native inputs.
- **Both browser themes**: every MCS surface passes a 4.5:1 text-contrast scan in light and dark.
  **Superseded:** that scan read HTML text only and missed the case-map halo and symbol-letter
  faults above, so "every surface passes" was not true of the submitted head. F41 contrast is
  repaired after the sanity repair; whether the lesson stages follow the site theme is not repaired
  (shared-owner follow-up).

### Finding dispositions

The **Disposition** column is final (after the sanity repair); Before/After describe the submitted
head.

| ID                                   | Before (reproduced on `41a34608`)                                                                                                                                                                                                                                                                                                | After                                                                                                                                                                                                                                                                                                              | Disposition                                                                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F03** task / control / evidence    | S1 step 1 at 1204×987: Save & exit the only filled button; Continue at y = 1,755 px (doc 2,610); `Guided reference · seed 417 · 8.00 simulated seconds`; monitor collapsed on every step, including the steps whose words say "Look here" at one of its regions; five-box sketch beside the map; "This section stands at: A · B" | Top Continue at ≤ 258 px on all 68 Learn steps (base: 865–8,690 px), in view at 1204, 1280, 1440, 768, 390 and 320; Save & exit transparent; seed in Run details; monitor open on the 7 steps whose words point at a monitor region, closed on the other 61; one drawing; numbered places                          | **REPRODUCED AND REPAIRED** after the sanity repair — the submitted head double-advanced on a double-click, reopened a closed monitor on revisit and left bottom-Continue focus off screen (Part 3)                                                  |
| **F04** monitor (presentation)       | ART strip ~74 px tall even when it is the step's target; PV sliver with `180 / 0 / 20 mL / 240` and no axis names; "effective flow ×16"; QRS heights varying by 15 of 92 strip units (0.26 mV drawn) with a constant model signal                                                                                                | Focused strip ~150 px; every strip prints its fixed scale; PV axes `LV volume (mL)` / `LV pressure (mm Hg)` + surrogate label + plotted range; ×16 gone; QRS spread < 1 unit. Prompt-01 instantaneous/modeled-mean/model-index labels unchanged                                                                    | **REPRODUCED AND REPAIRED** after the sanity repair — the submitted head redrew retained ECG beats after a rate change (P1) and fragmented phone strip labels (Part 3). The header's "50 Hz deterministic model" wording is copy, left for Prompt 04 |
| **F05** circulation map              | Vessel halos filled (open polylines → teal triangles); label box overlaps S5 ×2, S6 ×1, S7 ×1; balloon label 10 units above "Descending aorta"                                                                                                                                                                                   | Vessel halos stroke-only; 0 overlaps on S1/S5/S6/S7 at every width; device words in a lettered key; "Descending aorta" under its bottom limb                                                                                                                                                                       | **REPRODUCED AND REPAIRED** after the sanity repair (case-map label halo and symbol letters) — arch / left-subclavian / renal landmarks not drawn: OD-06 media brief below                                                                           |
| **F12** Impella vs LVAD pathway      | The two sketches drew the identical path `M415 95 V48 H530 V95`; only a label differed                                                                                                                                                                                                                                           | Impella: a bar from inside the LV box across the drawn aortic-valve bars into the aorta box, open inlet / filled outlet. LVAD: from the LV's apex (bottom) through a pump, back to the aorta beneath the valve without crossing it. Names say "across" / "around"                                                  | **REPRODUCED AND REPAIRED** — topology taken from the circulation map's existing geometry; conceptual, not to scale                                                                                                                                  |
| **F20** pressure and flow            | Each line stretched to its own min/max: MAP 71–78 filled 80% of the figure; flat flow on the frame; axis ends only in a footnote                                                                                                                                                                                                 | Two panels, 0–160 mm Hg and 0–8 L/min (grow in whole steps, and say so), shared simulated-time axis, legend with true values, table alternative. 7 mm Hg now < 3% of the figure                                                                                                                                    | **REPRODUCED AND REPAIRED** after the sanity repair — the submitted head padded a short trend to 10 s; the axis now spans only recorded samples. No intervention time is marked: the state records actions, not their times                          |
| **F22** source/component/destination | Three empty outlined boxes scaled to the card width, words in a list below                                                                                                                                                                                                                                                       | Words inside each box; row on desktop, column on a phone; relationship line pattern named in words                                                                                                                                                                                                                 | **REPRODUCED AND REPAIRED**                                                                                                                                                                                                                          |
| **F23** cutaway labels               | "LV cavity / Inlet →" far left of the inlet; "← Outlet", "← Aortic valve" at open space; "Dashed: insertion direction" in a label slot; colours unexplained                                                                                                                                                                      | Leader lines ending within 12 units of the inlet, outlet and valve coordinates; ventricle and aorta labelled; HTML legend with line swatches and words                                                                                                                                                             | **REPRODUCED AND REPAIRED** after the sanity repair (legend words at 320 px / 200%) — the cutaway remains an authored conceptual drawing; endpoints were not re-drawn                                                                                |
| **F24** unloading (presentation)     | At 390 px only the quantity names were on screen; values scrolled off right                                                                                                                                                                                                                                                      | Rows stack under 30rem with each value labelled; 0 horizontal scroll at 390 and 390 @ 200%. P5→P6 wedge "No resolvable displayed change", P5→P8 −1 mm Hg, −11 mL, +1.05 L/min — unchanged                                                                                                                          | **REPRODUCED AND REPAIRED** (presentation only)                                                                                                                                                                                                      |
| **F31** navigation / overlap         | Jump links rendered as bare lower-case words ("inspect predict response"); Current task over RAP/PCWP/PAPi (1204), Rhythm + MAP (768), Support (390, 320); stepper 3/6 visible at 390, 2/6 at 320, 1/6 at 390 @ 200%                                                                                                             | "Jump to" link list; Current task in flow — 0 covered items at every width; all six phases visible at 1204/768/390/320                                                                                                                                                                                             | **REPRODUCED AND REPAIRED** (UI defects). Neutral titles / hidden alarm names: POLICY CONFLICT, not implemented                                                                                                                                      |
| **F32** radios                       | Learn stage (`color-scheme: dark`): unchecked radios drawn as filled grey discs in both site themes. Case page: already empty rings at this base (Prompt-01's `color-scheme: light` pin), by accident                                                                                                                            | Native inputs painted explicitly on both surfaces: ring / filled centre / dashed disabled / focus ring; forced-colours fallback. Arrow keys and Space verified in Chromium                                                                                                                                         | **REPRODUCED AND REPAIRED** — the verdict wording belongs to Prompt 04                                                                                                                                                                               |
| **F33** worked explanation layout    | Card still a `105px 1fr` grid from a removed score ring: the whole explanation in the 105 px column at 0.66 rem                                                                                                                                                                                                                  | Single-column card with three blocks side by side (teaching / conditions / this run), 0.8125 rem; > 80% of the card used at 1280; stacks on a phone. Condition classes and the held-condition lines unchanged, in all 12 cases                                                                                     | **REPRODUCED AND REPAIRED** — raw action ids remain: see Prompt 04 note                                                                                                                                                                              |
| **F34** case monitor                 | The RP/LV ×16 zero lines were drawn below the plot, through "Why the display changed"; ×16 unexplained; PV hidden under 760 px                                                                                                                                                                                                   | Same chart as F20; every line inside its plot; caption separate; PV on screen at every width                                                                                                                                                                                                                       | **REPRODUCED AND REPAIRED**                                                                                                                                                                                                                          |
| **F37** Sections drawer              | Horizontal strip in a 26rem panel: two tiles visible, "Pressur e and flow", "Three device s"                                                                                                                                                                                                                                     | Vertical list, 9 entries, number + short + full title, 0 split words at 1204/768/390/320/390 @ 200%; Tab reaches the ninth; Escape closes and focus returns to the trigger (shared behaviour, unchanged)                                                                                                           | **REPRODUCED AND REPAIRED** after the sanity repair (ninth entry clipped at 320 px / 200%)                                                                                                                                                           |
| **F38** phone / responsive           | Case page at 390: sticky footer 124 px (15%), 403 px at 200% text; Current task over the context; stepper cut. Lessons at 390 @ 200%: 475–541 px document width from 11rem grid minimums; nested rem padding left ~170 px text columns; backward Tab could park controls under the sticky header                                 | Footer in flow; context stacked under 40rem; stepper wraps; teaching grids `minmax(min(100%,11rem),1fr)`; narrow-screen padding capped by width; `scroll-margin` keeps focus clear of the header; trend axis text enlarged under 600 px. 0 px overflow at 390 and 320, and at 390 @ 200% on every surface measured | **REPRODUCED AND REPAIRED** after the sanity repair (bottom-Continue focus, smooth-scroll focus race, enlarged-phone legend/drawer/strip words) — native browser zoom exercised by Codex; this integration ran an emulation only                     |
| **F41** light / dark                 | Hub disclosures inverted in a dark browser (navy on near-black 1.37:1, grey on white 2.55:1); `--muted` 4.11–4.49:1 and teal text 3.95–4.32:1 on tinted light cards; monitor captions 4.42:1; bright focus ring ~1.9:1 on light cards. Scan: hub 182/190 failures, cases 74–76, each stage step 10                               | 0 failures on 14 surfaces in both themes (one disabled button excluded as inactive). One theme per surface, identical in both browser themes: hub and cases light with a dark monitor, lessons dark                                                                                                                | **CONTRAST: REPRODUCED AND REPAIRED** (after the sanity repair; spot checks, not a WCAG certification). **SITE-THEME FOLLOWING: SHARED-OWNER FOLLOW-UP** — not repaired, below                                                                       |

F01's contrast repair is preserved and extended (see F41); `mcs-pre-review-01` F01 assertions pass.

### Mechanisms, briefly

- **F05 wedge.** `.halo` gave every lit segment a teal `fill`; a vessel is an open `M…L…L` path, so
  SVG closed it and painted the triangle. Vessel halos now carry `style={{ fill: 'none' }}`.
- **F34 overlap.** Flow × 16 of a pump at 0 L/min mapped below the 20–150 domain and the SVG had
  `overflow: visible`, so the line drew outside the plot, over the caption.
- **F33 squeeze.** `.debriefCard { grid-template-columns: 105px 1fr }` outlived its score ring.
- **F37 two tiles.** The shared rail is a horizontal strip for a full-width bar; the stage's
  `overflow-wrap: anywhere` broke its titles mid-word.
- **F32 filled discs.** The stage runs `color-scheme: dark`; Chromium draws an unchecked native
  radio as a filled grey disc on that scheme.
- **F04 ECG.** `ecgMv` is three fixed-amplitude Gaussians by cycle phase; the QRS is 0.012 of a cycle
  wide (~9 ms at 80/min) and samples are 20 ms apart, so straight lines between samples drew a
  different peak each beat. The expression is now exported unchanged as `mcsEcgMillivolts` and the
  strip fills between stored samples with it — every stored sample stays a point on the line, the
  deflection peaks are drawn at their exact phase, and before any heart-rate change inside the
  window the samples are drawn as stored. **No sample changed**; nothing is labelled alternans.
  **Superseded (P1):** deciding the filled tail afresh on every render from the _current_ rate meant
  that after a rate change the old beats no longer matched and were redrawn sample-to-sample —
  history changed shape although no sample changed. The final mechanism is in Part 3.
- **F41 hub residual.** The F01 pin re-pinned the frame's `--lm-v2-*` tokens but not the site tokens
  that Tailwind-classed blocks read, so `bg-background` / `text-muted-foreground` flipped inside the
  light frame. The same rule now pins those tokens.

### Model and source contract

No model code path changed behaviour. The one edit to `engine/model.ts` extracts the existing ECG
expression into `mcsEcgMillivolts` (plus `MCS_ECG_DEFLECTION_PHASES`); `generateMcsWaveformSample`
calls it. Evidence:

- `mcs-pre-review-03-display.test.tsx` compares `mcsEcgMillivolts` with a verbatim copy of the old
  expression at 7 rates × 876 instants with `toBe` (exact), and regenerates every stored sample of a
  live run to its 3-decimal rounding.
- Prompt-02's sanity-review invariance probe (`probe.cjs`), head vs the authorized base: **61 plans,
  1,422 exact comparisons, all passing** — physical state including every waveform sample, trend,
  metric, alarm, score and criterion.

Display-only transforms are declared where drawn: fixed trend scales from zero that grow in whole
steps and print when they grew; a time axis spanning the retained trend (10 s to the window) with
labelled ticks (**superseded:** the final axis spans only the recorded samples, at most the window,
and the scale can return to its default when higher values leave the window); PV fixed 0–250 mL / 0–200 mm Hg, clamped. No value is multiplied, smoothed or
re-shaped. Current/reference identity, the Prompt-01 measurand labels, the F17 authored/live
distinction, F19 containment, F21/F25 model-limit wording, F24 "No resolvable displayed change",
F26 volume-rescaling boundary, F27/F28 generic/unsupported distinctions, F29 congestion vs bottleneck
and F35's two predicates are unchanged and still asserted by their suites.

### Tests actually run (submitted head)

| Check                                          | Command                                                                                                                    | Base `41a34608`                                                                                                                                                                          | Head                                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| New regression contract                        | `npx jest …/__tests__/mcs-pre-review-03.test.tsx` (base-importable only)                                                   | **50 fail / 4 pass** — the 4 are deliberate controls (monitor closed where not pointed at, native radio groups, Prompt-02 P6/P8 numbers, the shared suite's monitor line patterns + axe) | **54 / 54 pass**                                                                                                                   |
| New state-preservation suite                   | `…/mcs-pre-review-03-state.test.tsx`                                                                                       | 10 / 11 fail — structurally: its setup reads the new Run details seed and monitor disclosure. Not evidence that the base mutated state; its live-case test passes on the base            | **11 / 11 pass**, incl. a positive control that a real model step does move the clock                                              |
| New display unit suite                         | `…/mcs-pre-review-03-display.test.tsx` (imports head-only helpers)                                                         | n/a                                                                                                                                                                                      | **8 / 8 pass**                                                                                                                     |
| Browser contract                               | `MCS_E2E_BASE_URL=… npx playwright test e2e/mcs-pre-review-03.spec.ts` (Chromium, dev servers)                             | **23 fail / 2 pass** — the 2 are surfaces with no document overflow at 200% on the base either (the S5 table scrolls inside its own region; the case page)                               | **25 / 25 pass**                                                                                                                   |
| MCS feature + MCS routes                       | `npx jest src/features/mechanical-circulatory-support 'src/app/[locale]/mechanical-circulatory-support'`                   | 43 suites / 872 tests pass                                                                                                                                                               | **46 suites / 945 tests pass**                                                                                                     |
| MCS + all routes + learning-module + hemo-core | `npx jest src/features/mechanical-circulatory-support src/app src/features/learning-module src/features/hemodynamics-core` | —                                                                                                                                                                                        | **98 suites / 1,455 tests pass**                                                                                                   |
| Critical-care consumers                        | `npx jest src/features/critical-care`                                                                                      | 3 failed / 23 passed suites — accessibility, curriculum sequencing, learner copy                                                                                                         | **identical 3**, same failing lines; accessibility stops at its CRRT block (line 237) before the MCS monitor block                 |
| Learner-copy share                             | the scanner's own AST logic over `mechanical-circulatory-support/components`                                               | 10 findings                                                                                                                                                                              | **9** (the seed line moved into Run details; one sketch caption rewritten) — no new finding                                        |
| Invariance                                     | `probe.cjs` from the Prompt-02 sanity review                                                                               | —                                                                                                                                                                                        | **61 plans, 1,422 exact comparisons pass**                                                                                         |
| Type check                                     | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                                                                  | —                                                                                                                                                                                        | clean                                                                                                                              |
| Lint                                           | `npx eslint --max-warnings=0` over every changed/new TS file                                                               | —                                                                                                                                                                                        | clean, 0 warnings                                                                                                                  |
| Format / whitespace                            | `npx prettier --check` over changed files; `git diff --check`                                                              | —                                                                                                                                                                                        | clean                                                                                                                              |
| Production build                               | `npm run build`, this worktree's dev server stopped first                                                                  | —                                                                                                                                                                                        | **exit 0** at the implementation commit (webpack cache-parse warnings only); the final code head is built in the integration below |

**Changed assertion, one:** `targeted-introductions.test.tsx` read the seed out of
`[data-session-identity]`. The seed now lives in Run details (F03), so a helper reads the identity
line plus the seed from there; every comparison it made is unchanged. No test was deleted or
skipped. The shared critical-care accessibility test's MCS-monitor assertions (series names and
line patterns, axe) are also held in `mcs-pre-review-03.test.tsx`, because that suite fails earlier
on CRRT and never reaches them.

### Browser evidence (submitted head)

All in Local-Data `renders/output/mcs-pre-review-03-2026-09-25/` (not committed). Playwright +
headless Chromium against dev servers: head on :3122, the authorized base in a disposable detached
worktree on :3140. Analytics posts answered 204; no other response stubbed. Console `500`s are the
absent-`.env.local` Supabase calls, identical on both trees.

| Evidence                                      | What                                                                                                                                                                                                                                                                | Where                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Before/after matrix                           | 8 surfaces (S1 arrival, S1 drawer, S4 trend, S4 monitor, S5 pathway, S2 LVAD sketch, IABP-01 top, IABP-01 worked) × 1204×987, 1280×800, 1440×900, 768×1024, 390×844, 320×740 × light and dark, plus 390 @ 200% (both themes) and 1280 @ 200%: 120 captures per tree | `matrix-base/`, `matrix-head/` (+ `matrix.json`: overflow, page errors) |
| Journeys                                      | S3 (full IABP lesson incl. timing and the AF transfer), S4, S5, S6 (incl. suction story answered), S7, S8, S9 walked step by step with answers and each section's act; IABP-01 worked end to end — at 1280×800 light and 390×844 dark                               | `journeys-head-1280-light/`, `journeys-head-390-dark/`                  |
| Contrast scan                                 | 14 surfaces × both themes, every disclosure opened                                                                                                                                                                                                                  | `base/contrast-1280.json`, `head/contrast-1280.json`                    |
| Drawer keyboard                               | 5 sizes                                                                                                                                                                                                                                                             | `base/drawer-light.json`, `head/drawer-light.json`, screenshots         |
| Practice geometry                             | 1204, 768, 390, 320, 390 @ 200%                                                                                                                                                                                                                                     | `base/practice-geom.json`, `head/practice-geom.json`                    |
| Map overlaps / charts / diagrams / F24 tables | element captures and measurements                                                                                                                                                                                                                                   | `base/`, `head/`                                                        |
| Invariance                                    | probe log and results                                                                                                                                                                                                                                               | `invariance/`                                                           |

Journeys: 0 page errors, 0 px horizontal overflow on every step of all seven lessons at both sizes.

#### Keyboard, focus and state

- Drawer: Enter opens; 9 Tabs reach the ninth entry, in view and not covered, at 1204/768/390/320
  and 390 @ 200%; Escape closes and focus returns to the trigger. (**Superseded in part:** 320 @ 200%
  was not measured, and there the ninth entry's words clipped although its button was reachable.)
- Radios: Space selects; ArrowDown moves the selection; the focused radio has a 3 px outline;
  unchecked `::before` is `matrix(0,0,0,0,0,0)`, checked is not — on the stage and on the case card in
  a dark browser.
- Focus under chrome: 120 forward-and-back Tabs on S4 (1280, 390) and IABP-01 (1280): 0 focused
  elements under the sticky header or off screen once scrolling settles. At 390 @ 200% the only flag
  is the stacked Clinical context region, which is itself taller than the screen. (**Superseded:**
  Tab traversal did not exercise the bottom Continue, which focused the new task with
  `preventScroll` and reset a region that does not scroll, leaving it more than 3,000 px above the
  viewport; and rapid Tab/Shift+Tab at 320 @ 200% could leave a case slider below the viewport while
  an inherited smooth scroll was still in flight. Both are repaired — Part 3.)
- State: in jsdom with the clock faked and never advanced, eight presentation operations (monitor,
  Run details, drawer + Escape, every other disclosure, theme class, resize, 200% root text, focus
  moves) singly and in sequence leave the simulated time, step, chosen answer, revealed explanation,
  worked-through controls, localStorage and monitor clock identical; the same holds on a live case
  for Current task, jump links and every disclosure. In Chromium: with playback paused, the app's
  own theme toggle (twice), two resizes, monitor and Run details toggles, the drawer and Escape, and
  focus moves leave identity, step, answer and storage (other than the theme preference the toggle
  writes) unchanged.

#### Zoom and text size — named separately

- **Root text 200%** (`html { font-size: 200% }` injected, asserted 32 px): measured on every
  surface above.
- **Native browser zoom: NOT EXECUTED.** Headless Chromium cannot drive it. The closest emulation —
  a 640×400 CSS-px viewport at device scale 2, i.e. a 1280×800 window at 200% zoom — gave 0 px
  overflow on S1, S4, IABP-01 and the hub, with the top Continue in view (`zoom-emulation/`). That is
  an emulation, not a native-zoom result.
- Not run: Safari, Firefox, a real phone or touch device, assistive technology, `es`/`zh-CN`.

### Latest-main integration (submitted head, against `2bc539f4`)

| Item                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` fetched         | `2bc539f4e96fe66d196aae9ae08fad4c8131e79a` (merge of PR #280), 24 commits and 88 files past the baseline: mechanical ventilation (37 files), bronchoscopy foundations (21), module-beta live feedback (9 + `next.config.mjs`, `site-auth`, one migration), docs, e2e                                                                                                                                                                                                                                                                                                                                                                          |
| Path overlap with this branch | **none**. Main touches no MCS path and no shared presentation path (`learning-module`, `critical-care`, `hemodynamics-core`, `styles`); the MCS entries in the beta catalog and access list are unchanged by it                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Disposable worktree           | detached at the final code head `69a114c2`, `origin/main` merged: `31b02184` — **conflict-free** (a first merge of `cc38602c`, `3e230046`, was also conflict-free and passed the same checks). Deps linked from this worktree, including the three nested training-app `node_modules`; `npm run build:content` run first                                                                                                                                                                                                                                                                                                                      |
| Tests                         | MCS + all `src/app` routes + `learning-module` + `hemodynamics-core` + `module-beta` + `site-auth`: **106 suites / 1,547 tests pass**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Type check                    | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Invariance probe              | **61 plans, 1,422 exact comparisons pass** (integrated tree vs the authorized base)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Production build              | `npm run build` **exit 0**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Browser smoke                 | the standalone production server of the integrated build on :3141 with no added environment: `e2e/mcs-pre-review-03.spec.ts` **25 / 25 pass**. Two runs are recorded rather than dropped: on the first integration build one check clicked a case radio before hydration on the faster production server (`b8d60907` makes it wait; it then passed there and on the head); on the second, 13 checks failed because my first build's server was still holding :3141 and serving HTML whose chunks the rebuild had replaced — the new server had failed to bind. With the stale server stopped and the new one confirmed by start time, 25 / 25 |
| Disposal                      | the integration and base worktrees were removed after the run; this branch was never merged into                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Part 2 — Independent sanity findings (Codex, 2026-09-26)

Full record: [MCS-PRE-REVIEW-03-sanity-review.md](MCS-PRE-REVIEW-03-sanity-review.md); every changed
path is classified in [MCS-PRE-REVIEW-03-scope-audit.md](MCS-PRE-REVIEW-03-scope-audit.md). Evidence
is in Local-Data `renders/output/mcs-pre-review-03-sanity-2026-09-26/`.

- **Disposition on the submitted head `c94994f7`: NOT READY TO MERGE** — one P1 and nine P2 defects,
  listed in the Read-first table. They include inherited local defects and defects in the proposed
  changes; none required a model change. The original tests missed history geometry, revisit
  preferences, double activation, word clipping and symbol-level contrast.
- Model/sample invariance passed on the submitted head, on the repaired head and on a latest-main
  integration (61 plans, 1,422 exact comparisons). The one engine edit extracts the existing ECG
  expression unchanged.
- The review confirmed the rest of Prompt 03 as submitted: F12 distinct pathway topology, F22 boxes,
  F24 values (P5/P6 wedge 18/18 "No resolvable displayed change", P5/P8 18/17), F31 case layout in
  all 12 cases, F32 radios in 58 lesson groups and 24 case runs, F33 explanations in all 12 cases,
  and all 68 Learn steps with the seven monitor-directed steps open and the other 61 closed.
- Codex's repaired-head results: 99 suites / 1,467 tests; 85 Prompt-03 tests; production browser
  specs pass; TypeScript, ESLint `--max-warnings=0`, Prettier and `git diff --check` clean; build
  passes; the same three critical-care failures on base and head. Latest-main integration against
  `75252293`: 107 suites / 1,559 tests, 42/42 production browser checks, 16/16 responsive smoke runs,
  1,422 invariance comparisons.

## Part 3 — Integrated repairs (fast-forward to `1ff63e75`)

Integrated exactly as reviewed; nothing re-implemented or added. MCS components, tests and docs
only — no engine, content, scenario, scoring, shared-component or global-stylesheet file.

- **ECG retained history (P1) — `monitorDisplay.ts`.** A presentation-only `WeakMap` remembers the
  rate each immutable stored sample was _observed_ at, the first time the monitor draws it. An
  interval between two samples is filled from `mcsEcgMillivolts` only when both were observed at the
  same rate; unknown history and rate boundaries stay sample-to-sample, and a later rate never
  reinterprets an earlier sample. The subdivision grid belongs to each sample interval, not to the
  window, so retention, resize, re-render and monitor close/reopen leave old geometry unchanged.
  Every stored sample remains a point on the line with its stored value; inserted points exist only
  in display output and never reach the reducer, scoring, predicates or actions. Limitation: history
  first drawn without trustworthy rate provenance is not reconstructed.
- **One activation, one navigation — `McsStageHost.tsx`.** Both Continue controls share one handler;
  the second click of a native double-click (`event.detail > 1`) only returns focus to the task.
  Keyboard activation (detail 0) is unaffected. Review, transfer and last-step rules are unchanged;
  nothing is gated.
- **Disclosure preference — `McsStageHost.tsx`, `McsSimulatorPane.tsx`.** Per-step open/closed choices
  are held in the mounted session; the step default applies only until the learner chooses. No tick,
  action record or progress change.
- **Focus after Continue — `McsStageHost.tsx`, `mcs-stage.module.css`.** On a new step (and on the
  prerequisite-to-task transition) the step bar is scrolled into view with `scroll-margin-top` of
  the site header's height (4rem fallback), replacing a reset of a region that does not scroll.
- **Smooth-scroll focus race — `mechanical-circulatory-support.module.css`.**
  `html:focus-within:has(.moduleShell) { scroll-behavior: auto }` settles native focus scrolling
  immediately on MCS pages only; no shared or global stylesheet is edited.
- **Trend short history — `monitorDisplay.ts`, `McsPressureFlowTrend.tsx`.** `trendWindow` starts at
  the later of the first recorded sample and `end − window`; the caption and accessible name state
  "from X to Y s (Z s of recorded samples; at most the last N s)". Model timing unchanged.
- **Phone text — `mcs-flow.module.css`, `mechanical-circulatory-support.module.css`.** Under 600 px the
  cutaway legend swatch, the drawer section number and the strip readout each stack above their
  words instead of sitting in a fixed column.
- **Case-map contrast — `circulation-map.module.css`.** A light label halo on the light case surface
  (`--mcs-map-label-halo`) and light letters on dark pathway and pin symbols. Anatomy and topology
  unchanged.
- **Tests.** `mcs-pre-review-03-sanity.test.tsx` (ECG point arrays across rate changes and near QRS,
  known-boundary non-reconstruction, short trend, flat and high values inside separate frames, scale
  reversion); the state suite now snapshots the full serialized simulation state passed to the real
  monitor; `e2e/mcs-pre-review-03-sanity.spec.ts` (Continue activations, preference, bottom focus,
  legend words, map contrast in both themes, ninth entry and strip words, slider focus after rapid
  Tab/Shift+Tab). One display-test expectation changed with the trend contract (10 → recorded span).

## Part 4 — Final validation of the repaired head `1ff63e75` (2026-09-28)

Re-run after integration, on this worktree. Evidence and scripts in Local-Data
`renders/output/mcs-pre-review-03-repair-integration-2026-09-28/`.

| Check                                                                                            | Result                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invariance (`probe.cjs`, repaired head vs `41a34608`)                                            | **61 plans, 1,422 exact comparisons pass** — physical state, every waveform sample, trend, metric, alarm, score and criterion                                                                                                                                                          |
| Prompt-03 unit suites (4)                                                                        | **85 / 85 pass**                                                                                                                                                                                                                                                                       |
| Negative control                                                                                 | the sanity unit suite run on the submitted head `c94994f7`: **8 fail / 4 pass** (all seven ECG-history cases and the short trend); **12 / 12** on the repaired head                                                                                                                    |
| MCS + all `src/app` routes + `learning-module` + `hemodynamics-core`                             | **99 suites / 1,467 tests pass**                                                                                                                                                                                                                                                       |
| `src/features/critical-care`                                                                     | 3 failed / 23 passed suites (3 / 233 tests) — **the same three on `41a34608`**: CRRT accessibility block, CRRT station ordering, learner-copy framing. Learner-copy findings 12 on base → 11; the only moved entry is the Run details "Seed" label (base: "· seed")                    |
| TypeScript (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`)                           | clean                                                                                                                                                                                                                                                                                  |
| ESLint `--max-warnings=0` (29 changed TS files); Prettier (37 changed files); `git diff --check` | clean                                                                                                                                                                                                                                                                                  |
| `npm run build`                                                                                  | **exit 0** (existing chunk-size and dependency warnings)                                                                                                                                                                                                                               |
| Production browser specs (`mcs-pre-review-03` + `-sanity`, standalone server)                    | **42 / 42 pass**                                                                                                                                                                                                                                                                       |
| Responsive and drawer smoke (Codex's `final-smoke.cjs`)                                          | **16 / 16** — 1440×900, 1280×800, 1204×987, 768×1024, 390×844, 320×740, 390 and 320 at 200% text, both themes: ninth entry focused and visible, all nine entries' text inside, Escape returns focus, 0 px overflow, map labels inside the drawing                                      |
| ECG in the live browser                                                                          | QRS apex spread ≤ 0.1 of 92 strip units through 80→120→60→138→80 with history spanning two rates; path and clock identical through the app theme toggle, resize 1280↔390, 200% text and monitor close/reopen; one cardiac-cycle step changes both (positive control)                   |
| Continue                                                                                         | **40 / 40**: ordinary, after-answer, transfer, review and last-step states × top and bottom × click, Enter, Space, double-click — one transition each, the same destination as a single click                                                                                          |
| Disclosure preference                                                                            | closed on a monitor-directed step, left, revisited (as a captured review) and returned: the choice held both ways; the next step still opened by default; simulated time and step position unchanged by every toggle                                                                   |
| Focus after Continue                                                                             | **15 / 15** at 1280, 390, 320 (100%) and 390, 320 (200%) for bottom click, bottom Enter and top Space: focus on the new task, step bar below the header (320 / 200%: scroll 15,555 → 1,392 px, focus at 412 px under a 145 px header); emulated 200% zoom (640×400 at DPR 2) passes    |
| Keyboard traversal (Tab ×40, Shift+Tab ×25) at 320 px, 100% and 200%, S4, S6, IABP-01            | **0 MCS focus stops hidden** (base: the Sections trigger at 200% and 2–7 case controls). Site-footer links pass under the sticky site header at 200% on base, submitted and repaired heads alike — shared                                                                              |
| Trend                                                                                            | S4 from t = 0 (one sample, "0.0 to 0.0 s"), then at 2.0, 5.8 and 18.3 s: the line starts at the frame and the caption states the recorded interval; at 58.5 s the monitor window slides to 18.5–58.5 s with every table row inside it; the teaching figure states its own 120 s window |
| Words at 390 / 320 × 100 / 200% × both themes                                                    | cutaway legend 0 and drawer 0 clipped or broken words; 0 px page overflow; monitor strips **0** mid-word breaks (submitted head 4–10, base 4–7); monitor SVG text (PV axes, trend) 30 labels in 10 drawings, 0 outside, 0 overlapping                                                  |
| Case-map contrast (IMP-01)                                                                       | all 11 labels **13.52:1**, pathway letters 13.5:1, light and dark browser themes                                                                                                                                                                                                       |
| Journeys (the original `journeys.cjs`)                                                           | S3–S9 walked step by step with answers and acts, IABP-01 worked end to end, at 1280 light and 390 dark: **0 page errors, 0 px overflow**; S1, S2, S4 and IMP-01 captures likewise                                                                                                      |
| F19 hold in the browser                                                                          | S3 transfer, pressure trigger, 1280 light and 390 dark: "MCS-03-05, still NOT REVIEWED" present; no all-clear; no corrected / resolved / success wording                                                                                                                               |

Not run: a real screen reader, native browser zoom (Codex exercised native Chrome 200% zoom),
Safari, Firefox, a real phone, `es` / `zh-CN`.

**Latest-main integration of the repaired head** is performed after this document is pushed, in a
disposable worktree merged with the then-current `origin/main` and discarded afterwards; the branch
never receives a main merge. Its results are recorded with the evidence above and in the
integration report, not here.

## Residual MCS-local observations (not among the ten; not repaired here)

- **Monitor tile words at enlarged phone text.** In the full monitor's flow-account and derived
  tiles (about 57 px columns at 320 px / 200% text) words and decimal values still break mid-token —
  e.g. "3.|3", "1.|21", "EFFE|CTIV|E", "YE|S"; the header's "8.0 s" breaks at 200% as well. Mid-word
  breaks in the whole monitor, S5 at 390 / 200%, 320 / 200% and S4 at 320 / 200%: base **40 / 68 /
  68**, submitted head 16 / 36 / 39, repaired head **6 / 26 / 29** — all outside the strips, none at
  100% text. Inherited and reduced by this PR, not introduced; it is not the strip-label defect Codex
  reproduced and was left alone rather than broaden the reviewed repair. The strip's pattern (fewer
  columns under 600 px) would likely serve; an MCS-local follow-up for the owner to schedule.

## Shared-owner follow-ups (not patched here)

| Component                                                          | Reproduction                                                                                                                                  | Impact on MCS                                                                                                                                         | Suggested owner / smallest shared contract                                                                                 |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `learning-module/stage/SectionsDrawer` + `curriculum/PathwayNav`   | The full-width horizontal rail inside a 26rem panel shows ~2 tiles and inherits the host's `overflow-wrap`                                    | F37; repaired by an MCS-scoped layout rule                                                                                                            | Stage owner: a list layout for the rail inside the drawer (e.g. `variant="list"`), so MV/HD/ECMO/BF/PI get it too          |
| `learning-module/stage/SectionHeader`                              | `Save & exit` is hard-wired `data-primary="true"`                                                                                             | F03; overridden by an MCS-scoped rule                                                                                                                 | Stage owner: let the host choose which header action is primary                                                            |
| `learning-module/components` `TaskDrawer` / `NativeWorkbenchFrame` | Current task is absolutely positioned over the ClinicalContextStrip                                                                           | F31/F38; placed in flow by an MCS-scoped rule                                                                                                         | Workbench owner: an in-flow slot for the drawer trigger                                                                    |
| `ActivityStepper`, `ActivityChrome` bottom bar                     | Stepper scrolls sideways < 1024 px; footer sticky < 1024 px (124 px of an 844 px phone, 403 px at 200% text)                                  | F38; wrapped / un-stuck by MCS-scoped rules                                                                                                           | Same owner                                                                                                                 |
| `ClinicalContextStrip`                                             | Its screen-reader hint says the row "scrolls sideways"; stacked on a phone in MCS it no longer does                                           | Minor mismatch in the description under 40rem                                                                                                         | Same owner: a stacked variant or a hint tied to actual overflow                                                            |
| Site header / global nav                                           | At 1280×800 with 200% root text a header link ("Intro to Bronchoscopy") overflows the page by 51 px on every route, base and head             | 51 px sideways scroll at desktop 200% text                                                                                                            | PI platform lane (already recorded by CRRT-FELLOW-03)                                                                      |
| Lesson-stage theme convention                                      | The lesson stages of MCS, ECMO, MV, HD, BF and PI all run dark in a light browser; `globals.css` darkens the page for any dark frame          | The report's "lessons stay dark in light mode" (F41). **F41 SITE-THEME FOLLOWING: SHARED-OWNER FOLLOW-UP** — not repaired; this PR does not worsen it | Owner decision for all stage modules together; MCS alone switching would make MCS consistent and the platform inconsistent |
| `critical-care/__tests__/accessibility.test.tsx`                   | Fails at its CRRT block (line 237) on base and head, so its MCS block never runs                                                              | MCS assertions held locally in `mcs-pre-review-03.test.tsx`                                                                                           | Critical-care/CRRT owner                                                                                                   |
| `ChoiceReasoningFeedback` key-aware heading (F09)                  | Unchanged from Prompt 01's record                                                                                                             | Still outstanding                                                                                                                                     | Shared-feedback owner                                                                                                      |
| Page / frame landmarks                                             | Nested `main` landmarks in the inherited page and frame composition (sanity review)                                                           | Screen-reader landmark navigation                                                                                                                     | Site and stage owners                                                                                                      |
| Site footer / site header                                          | At 320 px with 200% text, keyboard focus on site-footer links can sit under the sticky site header (base, submitted and repaired heads alike) | None inside the MCS module (0 MCS stops hidden)                                                                                                       | Site-chrome owner: a site-wide `scroll-padding-top` tied to the header height                                              |

## Handed on

| To                                   | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prompt 04**                        | Plain action names under "Actions performed in this run" (the learn-control label map covers only part of the case action ids, so it was not partially applied); the monitor header's "50 Hz deterministic model" wording; verdict wording under the case prediction (F32's explanatory half); the two unreachable legacy teaching panels (Sections 3 and 7) Prompt 02 handed on — unchanged here                                                                                                       |
| **OD-06** (media brief, not shipped) | F05 asked for an aortic arch with left-subclavian and renal landmarks for balloon position. A schematic arch drawn on this loop would be guessed anatomy used as position teaching. Brief for the owner: one conceptual aortic-arch inset beside the balloon, marked "not to scale, not a positioning guide", with the left subclavian and renal arteries as labelled landmarks and the intended tip/base relationship stated in words from a named source; rights and a reviewer named before it ships |
| **OD-01 … OD-04**                    | Unchanged, below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Holds that remain, exactly

- **F19 / OD-01** — AF trigger conflict CONTAINED, NOT CORRECTED: ECG 50, pressure 74, internal 40;
  both AF timing conditions held and excluded from scoring; pressure never regains an all-clear;
  `MCS-03-05` NOT REVIEWED. Verified by the `mcs-pre-review-01` suites and in Chromium on the S3
  transfer with pressure triggering: held chip present, no all-clear badge or "No active alarm", the
  50 / 74 / 40 comparison, `MCS-03-05` NOT REVIEWED, no success/corrected/resolved wording
  (`head/af-transfer-pressure-1280.png`). Re-verified on the repaired head at 1280 light and 390 dark
  (2026-09-28).
- **F17 / OD-01** — the live IABP trace does not reproduce the canonical relationships; the authored
  reference remains the containment.
- **OD-02** — durable model identity: a generic continuous-flow mechanism with a source-linked
  HeartMate 3 comparison; no HM3 estimator.
- **OD-03** — RV delivery / displayed filling / suction calibration unresolved.
- **OD-04** — authored case thresholds remain model conditions, not clinical targets; every
  condition still prints its class in all twelve cases.
- **OD-06** — aortic arch / left subclavian / renal teaching anatomy remains unapproved and undrawn.
- OD-01 through OD-04 remain **NOT REVIEWED**. The sanity repair changed none of the physiology,
  stored waveform samples, alarms, thresholds, scores, predicates, case keys, AF values or suction
  criteria (1,422 exact comparisons).

## Preservation

Self-paced navigation intact: Continue always enabled (now also at the top), explanation before any
answer, retry and revisit unchanged, no score, attempt gate, first-try record or new persistence.
Real interlocks unchanged (`lvad:authorize-speed`, unauthorized-speed error). No alarm hidden.
Location-only progress, matched comparisons, story isolation and every NOT REVIEWED record
unchanged. Device Intelligence untouched.

## Final disposition and stop point

- **Submitted head `c94994f7`:** SANITY REVIEW — NOT READY TO MERGE (Codex, 2026-09-26).
- **Repaired head:** Codex's exact repair integrated by fast-forward; the P1 and all nine P2 defects
  verified repaired on this branch; model/sample invariance and the automated and browser checks in
  Part 4 pass. The latest-main integration result and the merge-readiness statement are in the
  integration report.
- **Clinical status: NOT REVIEWED.** No clinical, device, source, media or model decision was made.
  One PR, open and unmerged. Nothing deployed. MCS-PRE-REVIEW-04 not started; G02 not restarted.
