# HD-PRE-REVIEW-03 — Waveforms and visual workbench

ICU Hemodynamics, Batch 03 of the fellow-walkthrough remediation pack
(`Interventional-Pulm-Local-Data/module_update_9_19/HD_Claude_Implementation_Pack`,
`03_HD_WAVEFORMS_AND_VISUAL_WORKBENCH.md`). This handoff covers everything in the batch that the
two earlier slices did not. It does not replace them:

- `HD-PRE-REVIEW-03-display-range-handoff.md` — L3-02 in the reference figure (PR #314, slice 1).
- `HD-PRE-REVIEW-03-atlas-readability-handoff.md` — L4-06 atlas prose contrast (PR #314, slice 2).

Tasks 01 and 02 keep their handoffs in the repository's earlier directory,
`docs/gap-remediation/fellow-walkthrough/hemodynamics/`. This one sits beside the two #314 slice
handoffs, which is the location `COMMON_CONTRACT.md` §6 names.

**Nothing here is clinical, source, device or learner approval.** A clean technical PR is not a
release decision. Not merged, not deployed; Task 04 not started; G02 not reopened.

## Base and head

|                         |                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Execution base          | `047d30b3aa124f75bff5299597fe583fff53a824` — the merge of PR #314 into `main` (2026-10-03 06:54 UTC)              |
| Branch                  | `claude/hd-pre-review-03-10-3`, created from `origin/main` at that commit                                         |
| Implementation head     | `0b4a16a5b4c85e28644c4f999ddd5e960ebe3008` — every test, build and browser result below was produced on this tree |
| PR head                 | the docs-only commit after it, which adds this file and `HD-PRE-REVIEW-03-status.json`                            |
| Checkout                | `Interventional-Pulm-Education-Worktrees/codex-hemodynamics10-3`, own dev server on port 3125                     |
| Ownership check at base | no open ICU Hemodynamics PR; shared-stage PR #134 and the Thoracoscopy stack untouched; no HD worktree delta      |

## What #314 already settled, and how it was treated

Verified on the execution base, then preserved:

| #314 contract                                                        | State on this head                                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Samples keep their own coordinates; nothing is clamped to the axis   | Unchanged. `TRACE_TOP` 66, `TRACE_BOTTOM` 192, clip rectangle `y=66 height=126`: still asserted by #314's own spec, which passes 4/4                                |
| Out-of-range portions are clipped by geometry, with a visible notice | Unchanged in the figure. The same rule now also governs the three other renderers that still clamped (below)                                                        |
| No landmark is pinned to the axis edge                               | Unchanged                                                                                                                                                           |
| Deliberate wrong-scale examples stay explicit                        | Unchanged (`fault.scaleMaxMmHg`)                                                                                                                                    |
| ECG and respiration lanes are independent of the pressure plot       | Unchanged in coordinates; the lanes are now placed as translated groups so the labels between them have room                                                        |
| Atlas prose contrast in both themes                                  | Unchanged; #314's spec passes 6/6. The same light-card ink now also covers the atlas where it is opened from Learn                                                  |
| The range notice is part of the image's accessible text              | **Changed in form, as the brief invited (§H):** the notice is the image's `aria-describedby` description, not a suffix of its name. The visible notice is unchanged |

Two #314 assertions were updated for that last row, and say so in place:
`waveform-display-range.test.tsx` and `h2-h3-reference-and-pac-safety.test.tsx` now require the
canonical description as the accessible **name** and the notice as the accessible **description**;
`e2e/icu-hemodynamics-display-range.spec.ts` asserts the same with `toHaveAccessibleDescription`.
`recognition-practice.test.tsx` reads landmark and label positions from the new hooks
(`circle[data-atlas-landmark]`, `[data-atlas-label]`); what it asserts is the same.

One harness change to #314's spec: it read the page's theme class before the theme provider had
set it, so on a freshly started server it pressed the toggle on a page that was about to choose the
wanted theme by itself. On the pristine base checkout's own server its two light-theme conditions
fail for that reason in every run (three runs; `html` stays `dark`, and at 390 px the toggle is not
on screen to press). The spec now waits for the class before deciding. No assertion about the
figure changed.

## Dispositions — all 27

`Fixed` means reproduced on the base, changed, and covered by a test that fails on the base or
measures the rendered result. `Held` means the model was left as it is and the surface now says
what it does not show.

| ID    | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Review group |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| X-01  | **Fixed.** Catheter-map labels are page text at 0.8 rem (12.8 px; they were a 10 px SVG font rendered 7 px tall at 390 px). Under a 30 rem container the four device labels become one-letter keys with a legend, and an abbreviation key is printed. The mPAP tag is out of the trace (L2-01).                                                                                                                                                                | —            |
| L1-01 | **Fixed; distances held.** A labelled catheter schematic on the module's existing right-heart drawing names four parts (distal opening, balloon, thermistor, proximal port) and what each carries. It gives no distances and says so. PAC and PAWP are expanded at first use.                                                                                                                                                                                  | R6           |
| L1-05 | **Fixed, HD-locally.** Sources open in the page beneath the lesson (`position: static`) instead of floating over the task list. The shared `StageSourcesFooter` is untouched; the override is scoped to the hemodynamics stage, following the Bronchoscopy Foundations precedent. Keyboard open, Escape close and focus return are measured.                                                                                                                   | —            |
| L2-01 | **Fixed.** Axis numbers, the reference value and marker names are page text in gutters and a track around the plot. No text is drawn inside any strip's SVG.                                                                                                                                                                                                                                                                                                   | —            |
| L2-04 | **Fixed.** The leveling drawing fills its card with labels at 0.8 rem or more; `mmHg` is no longer capitalised to `MmHg`; the three figures are rows, not one-word-per-line tiles. The card stays a light card (see carry-forwards).                                                                                                                                                                                                                           | —            |
| L2-05 | **Fixed — an illustration-versus-source error.** The reference point is drawn midway between the front and the back of the chest (measured: 50 % of chest depth) with a line through the chest. The registered source places the zero position at mid-chest in the anteroposterior dimension at the fourth intercostal space. Position-specific conventions (lateral, prone, head-up) are not drawn and remain an owner decision.                              | R2 R6 R8     |
| L2-06 | **Fixed.** A comparison against a reference keeps one pressure axis for its whole range of transducer heights (−10 to 50 mmHg here) and says the axis is fixed. Where an axis does change, a notice says so and that the pressure did not. The earlier part of a sweep is dimmed and separated from the current part by a named seam. The card reports the channel on the monitor. An alarm on a channel the monitor does not draw is named with that channel. | —            |
| L2-08 | **Fixed — an implementation difference.** Learn drew its own distortion; Practice's troubleshooting atlas drew another. Learn now takes its beats from the atlas' transforms. Source 25/10 mmHg is drawn as 28/7 underdamped and 21/12 overdamped, mean within 1.5 mmHg, and each panel prints source and drawn values. The report's suggested 31/8 and 20/13 were not used.                                                                                   | R3           |
| L2-09 | **Fixed.** Three responses in one row from a 58 rem container, each with the whole test and the release enlarged in time, on one axis and one time base, with rows aligned across the three. The flush is named above the plot. The test is named "fast-flush test"; "square-wave test" was **not** added because no registered source uses it.                                                                                                                | —            |
| L2-11 | **Fixed.** In two columns the monitor stays in view beside the flush result and the choices. Goals are a progress list with words ("done", "not yet done"), no circle that reads as a radio button. The release chart's labels are page text at 0.75 rem.                                                                                                                                                                                                      | —            |
| L2-13 | **Fixed.** The arterial display-scale control is offered only where an arterial tracing is on screen; elsewhere a sentence says why it is absent. It never touches the catheter channel.                                                                                                                                                                                                                                                                       | —            |
| L3-01 | **Fixed.** Reference-figure labels are page text at 0.85 rem (13.6 px; they rendered at 41 px), laid out in tracks outside the plot with leader lines to their landmarks. No two overlap and none covers the plot, from 320 px to 1440 px and at 200 % root text.                                                                                                                                                                                              | —            |
| L3-02 | **Resolved by #314** in the reference figure; verified here. **Extended** to the live strip, the fast-flush figure and the troubleshooting figure, which still moved out-of-range samples onto the axis.                                                                                                                                                                                                                                                       | —            |
| L3-03 | **Held, with a truthful limitation.** The right-ventricular fall never rises again (no notch) but has a change of slope at about 14 mmHg. No source settles whether that shoulder should be drawn. The comparison says what it is. The "notch at 11 on one beat, 14 on the others" was the reference figure's respiratory swing; the side-by-side comparison draws none.                                                                                       | R3           |
| L3-05 | **Fixed.** While the walk chooses the chamber the reference shows a progress indicator, not disabled tabs. Where browsing is intended the tabs remain tabs. Map positions are labelled "Map stop N", so they are not read as the walk's count.                                                                                                                                                                                                                 | —            |
| L3-06 | **Fixed.** Right ventricle and pulmonary artery side by side on one 0–40 mmHg axis and one time base, plots at the same height, with a feature-by-feature table beneath. They stack below 21 rem per figure.                                                                                                                                                                                                                                                   | —            |
| L3-07 | **Held, with a truthful limitation.** Measured in the generator, not from pixels: the arterial upstroke begins at phase 0 and the ventricular one at the R wave (36 ms apart at 75 beats a minute), and the arterial peak is drawn 0.12 of a cycle before the T wave where the source puts it at the T wave. The comparison says the ECG timing is schematic.                                                                                                  | R3           |
| L4-02 | **Partly fixed; rhythm held.** The instruction no longer tells the learner to use an ECG that is not there. No empty ECG lane is reserved. A long legend term no longer prints across its definition. Each figure states that it has no rhythm strip and is one beat repeated evenly. No jitter was added.                                                                                                                                                     | R3           |
| L4-04 | **Fixed — source-backed, for the authored example only.** The example now draws one systolic wave from the c wave to the v wave, with no fall between them, and its "x lost" mark sits on that rise. The registered source describes the systolic c–v wave as obliterating the x descent. The live model's tricuspid-regurgitation amplitudes are untouched. The figure says it is one example.                                                                | R3           |
| L4-06 | **Resolved by #314**; verified here (its spec passes 6/6). The same ink rule now covers the atlas opened from Learn, measured in both themes.                                                                                                                                                                                                                                                                                                                  | —            |
| L5-04 | **Partly fixed; one structure held.** The catheter is thicker and brighter with a marked tip, the legend says the see-through view is a drawing convention, chamber names can be switched on, and the status line is page text beneath the view. The unlabelled pale structure belongs to the shared cardiac model, which this batch does not own.                                                                                                             | R6           |
| L5-05 | **Fixed.** "Hold and enlarge the last two beats" keeps a still copy on an axis fitted to it, labelled held, not live, with the model time it was taken at. The live strip keeps running. A frozen monitor says it is frozen, when it stopped, and where the model is now. A raised venous pressure gets a fitted axis, not a clip.                                                                                                                             | —            |
| L7-02 | **Limitation stated; morphology held.** In this model a prolonged, uneven injection changes the curve's height and noise, not its shape. The trial card and the source boundary say so; no hump was drawn. Whether the automatic quality line should be shown before review is Task 04's.                                                                                                                                                                      | R3 R4        |
| L9-04 | **Fixed.** On the five-channel monitor every tag is outside its trace and all five plots start and end at the same place. The mixed-venous cell gives the actual reason no sample is available and never a value.                                                                                                                                                                                                                                              | —            |
| P-03  | **Fixed.** Checkpoints are always visible. After a response is observed, "Back to actions and measurements" returns to the same case: spent actions stay spent and the model clock does not go back.                                                                                                                                                                                                                                                           | —            |
| P-06  | **Fixed.** The troubleshooting atlas opens inside Learn §2 and §6 as a reference (it cannot alter the lesson's patient), and §7 links to the thermodilution lab in Practice. Both are the existing components and data.                                                                                                                                                                                                                                        | —            |
| P-07  | **Fixed.** No signed zero; the broken sentence is rewritten; the prompt with nowhere to type says there is nothing to enter; "Eight practice cases"; one `main` landmark; the case brief says what "ZERO REQUIRED" asks.                                                                                                                                                                                                                                       | —            |

## Canonical model reuse

No third waveform generator was added.

| Need                              | Reused                                                                         | What changed                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Learn's damped and resonant beats | `troubleshootingWaveforms.ts` transforms (Practice's atlas)                    | `dynamicResponseBeatFraction` exposes one transformed beat; the atlas' own numbers are unchanged         |
| Fast-flush plateau and ringing    | the existing fast-flush generator                                              | only its baseline beats now come from the atlas                                                          |
| RV-versus-PA comparison           | the existing `rv-normal` and `pa-normal` atlas entries                         | none to the traces                                                                                       |
| Troubleshooting atlas in Learn    | `TroubleshootingPanel`                                                         | mounted as a reference; its figure now clips instead of clamping                                         |
| Catheter schematic                | the right-heart outline and route already used by the reference anatomy figure | four part marks and a caption                                                                            |
| Tricuspid-regurgitation example   | the atrial component model                                                     | an authored `systolicFusion` flag joins c and v for that entry; `rightAtrialAmplitudesFor` never sets it |
| Held copy                         | the monitor's own sample buffer                                                | a still slice of the same samples; nothing is resampled, smoothed or dispatched                          |

## Waveform discrepancy matrix

Built before any morphology was touched. Numbers are from the generators
(`hd-pre-review-03-discrepancy-matrix.test.ts`), not from screenshots.

| ID    | Source statement                                                                                       | Generator and what it produces                                                                                                                                                        | Rendered geometry and annotation                                                      | Accessible description               | Problem type                               | Outcome                              |
| ----- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------ | ------------------------------------ |
| L2-08 | Underdamping overshoots systole and undershoots diastole; damping does the reverse; the mean is spared | Base, Learn: 25.7/9.6 underdamped, 20.0/12.4 overdamped. Atlas: 28.2/6.5 and 20.8/11.9 from the same 25/10 source. Head, Learn: 28.2/6.5 and 20.8/11.9, means 15.2                    | Path sampled in the browser; values printed beside each panel                         | States source and drawn values       | Implementation difference (two models)     | Repaired by reuse                    |
| L3-03 | RV has no dicrotic notch; PA has one                                                                   | RV: fall is monotone from phase 0.16 to 0.5, no dip with a rebound; slope changes at phase 0.39 near 14 mmHg. PA: a dip then a rise just after the notch phase                        | Labels on their landmarks; comparison drawn without a respiratory swing               | Unchanged                            | Model property, no source for the shoulder | Held; stated                         |
| L3-07 | PA systolic peak at about the T wave                                                                   | PA upstroke from phase 0; RV upstroke from the R wave (phase 0.045, 36 ms at 75/min). PA peak at phase 0.18; T-wave peak at 0.30                                                      | ECG landmark lines cross both plots at the same x                                     | Unchanged                            | Model timing, source-owner decision        | Held; stated                         |
| L4-02 | Cannon a waves and atrial fibrillation are defined by rhythm                                           | Both entries are one beat repeated at an even rate; the AF entry does remove the a wave (rise < 0.6 mmHg where the normal trace rises > 2)                                            | No ECG lane; pressure plot directly under its labels                                  | Now includes the stated limit        | Not modeled                                | Limit stated; no jitter              |
| L4-04 | The systolic c–v wave of tricuspid regurgitation obliterates the x descent                             | Base: 16.1 at the c wave, falling to 12.5, then 21.6 at the v wave (133 falling samples of 2000). Head: 14.7 rising to 20.3, no fall; mean still 14.0; y descent and a wave unchanged | Trace between the "x lost" and "c-v" landmarks never falls (browser: 0 falling steps) | Now includes "one example"           | Authored example contradicts its source    | Repaired for the authored entry only |
| L7-02 | Poor injection technique degrades a thermodilution curve                                               | Prolonged, uneven trial: same onset and time to peak within one 50 ms sample, no secondary disturbance by the module's detector, smaller peak                                         | One smooth excursion                                                                  | Trial text names the technique alert | Unsupported authored description           | Limit stated; no hump                |

The held rows do not assert that the model is right. Each test measures the property and requires
the statement shown to the learner to be present exactly while the property holds, so a later
correction of the generator fails the test until the now-false statement is removed.

## Major workbench and visual changes

- **One label rule for every figure.** Labels are page text in rem, placed in tracks outside the
  plot by a pure layout function (`waveformLabelLayout.ts`) from the width the figure is actually
  drawn at and the reader's text size (`useRenderedMetrics`). They follow text enlargement; no font
  cap was used.
- **Live strip** (`WaveformStrip`): unclamped samples behind a clip path, an off-scale mark instead
  of a flat line, ticks and the reference tag in gutters of fixed width so stacked channels align,
  marker names in a track that keeps them inside the strip at any width.
- **Display seams** (`engine/displaySeams.ts`): when the transducer height, the zero or the line
  response actually changes, the display records where; the strip opens the trace there and dims
  what was drawn before. A seam is display metadata only.
- **Lesson fixtures open on their own tracing** (`withOpeningTrace`): a fixture that zeroed its
  transducer used to open with twelve seconds of unzeroed samples still in the buffer — the "step
  in the middle of the strip". Only the display buffer is regenerated.
- **Reference figure** (`WaveformAtlasFigure`): lanes moved apart by what the labels need; ECG
  names spread and tied to their lines; a reading point marked at the base of the c wave on the
  right-atrial figure (Task 02's carry-forward); figures compared in a row reserve the same label
  tracks and share caption rows, so their plots align.
- **Leveling, fast-flush and troubleshooting figures** rebuilt on the same rule.
- **Monitor**: pinned comparison axis, axis-change notice, frozen note, held copy, mixed-venous
  availability, alarm channel naming.
- **Practice**: visible checkpoints, a return to actions, one `main`.

## Clinical and learner copy changed

| Where                             | Before                                                                                    | After                                                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4 Task 3 instruction             | "Use the ECG and the affected wave or descent to distinguish mechanisms."                 | "Find the wave or descent each one changes. These two examples draw the pressure pattern only: the rhythm that defines each, and the ECG that would show it, are not modeled here." |
| §1 origins                        | "PAC pressure channel"; "PAWP reflects…"                                                  | "Pulmonary artery catheter (PAC) pressure channel"; "the pulmonary artery wedge pressure (PAWP) reflects…"                                                                          |
| Injection-duration boundary       | "The window this simulation flags outside of. …"                                          | "This simulation raises a technique alert for an injection outside this window. … this model does not redraw the curve for a prolonged or interrupted bolus…"                       |
| Thermodilution prompt             | "Say what an acceptable curve should look like for this patient before you generate one." | "Before you generate a curve, decide for yourself what an acceptable one should look like for this patient. There is nothing to enter here…"                                        |
| Practice landing                  | "Eight preserved management cases"                                                        | "Eight practice cases"                                                                                                                                                              |
| Troubleshooting table             | "…fails to transition to wedge despite attempted inflation."                              | "…fails to transition to wedge when inflation is tried." (the Learn copy gate bans "attempted")                                                                                     |
| Leveling card (new caption)       | —                                                                                         | "A schematic side view, not to scale. The reference point is drawn midway between the front and the back of the chest at the fourth intercostal space…"                             |
| RV-versus-PA note (new)           | —                                                                                         | The two statements in `content/waveformModelLimits.ts` (slope change is not a notch; ECG timing is schematic)                                                                       |
| TR, cannon a, AF figures (new)    | —                                                                                         | `renderingLimit` on each entry in `content/waveformAtlas.ts`                                                                                                                        |
| Prolonged-injection trial (new)   | —                                                                                         | "What this model draws: a prolonged or interrupted injection does not add a second peak or a notch here. …"                                                                         |
| Catheter schematic (new)          | —                                                                                         | Four parts and "A schematic, not to scale. … this drawing gives no distances."                                                                                                      |
| Alarm under a one-channel monitor | "ART MAP LOW"                                                                             | "On the arterial line, which this task's monitor does not show: ART MAP LOW"                                                                                                        |

No clinical number, threshold, answer key, rationale or source mapping changed.

## Viewport and visual matrix

Real Chromium, the lesson's own controls, no seeded state. "Root text" is CSS `font-size` on the
root element; **native browser zoom was not exercised**. Every journey also requires an empty
console apart from the local `/api/analytics` 500 (no analytics database in this checkout; the
same on the base).

| Journey (`e2e/icu-hemodynamics-pre-review-03.spec.ts`)      | 1204×987 dark | 1440×900 light | 1024×768 dark | 390×844 light | 320×740 dark | 1204×987 light 200 % | 390×844 dark 200 % |
| ----------------------------------------------------------- | :-----------: | :------------: | :-----------: | :-----------: | :----------: | :------------------: | :----------------: |
| Live strip labels off the trace; pure offset keeps one axis |     pass      |      pass      |     pass      |     pass      |     pass     |         pass         |        pass        |
| Dynamic-response examples on one axis                       |     pass      |      pass      |     pass      |     pass      |     pass     |         pass         |        pass        |
| Flush task: monitor beside controls and result              |     pass      |      pass      |     pass      |     pass      |     pass     |          —           |         —          |
| Reference-figure labels separate and on their landmarks     |     pass      |      pass      |     pass      |     pass      |     pass     |         pass         |        pass        |
| RV and PA compared on one axis                              |     pass      |      pass      |     pass      |     pass      |     pass     |         pass         |        pass        |
| Rhythm patterns state limits; TR draws one wave             |     pass      |      pass      |     pass      |     pass      |     pass     |          —           |         —          |
| Help and Sources by keyboard, lesson state unchanged        |     pass      |      pass      |       —       |     pass      |     pass     |          —           |         —          |
| Right-atrial tracing held and read wave by wave             |     pass      |      pass      |     pass      |     pass      |     pass     |          —           |         —          |
| Schematic labels readable                                   |     pass      |       —        |       —       |     pass      |     pass     |         pass         |        pass        |
| Capstone monitor: tags off traces, channels aligned         |     pass      |      pass      |     pass      |     pass      |     pass     |          —           |         —          |
| Practice returns to actions without reset                   |     pass      |       —        |       —       |     pass      |      —       |          —           |         —          |
| Troubleshooting atlas reachable from Learn, both themes     |  pass (both)  |       —        |       —       |       —       |      —       |          —           |         —          |
| Thermodilution controls readable, both themes               |  pass (both)  |       —        |       —       |       —       |      —       |          —           |         —          |
| 3D course: convention stated, chamber names by keyboard     |     pass      |       —        |       —       |       —       |      —       |          —           |         —          |

64 journeys, 64 pass. #314's two specs add 1024×768 at 200 %, 390×844 at 200 % and 320 at 200 % for
the figure and the atlas prose (10 journeys, 10 pass).

Stated limits of that matrix:

- **390 px with 200 % root text** is equivalent to a 195 px screen. There the reference figure and
  the catheter schematic keep a least drawing width (12.5 rem and 13.5 rem) and scroll sideways
  inside their own card; the page does not scroll and no label is cut. That inner scroller was not
  made a tab stop, so keyboard scrolling of it relies on the browser.
- **Whole-page overflow at 200 % root text on a desktop width is 76 px at 1204 and 125 px at 1024,
  identical on the base.** Its source is the site's global header navigation (the last link ends at
  1280 px), not the lesson. Task 02's handoff attributed it to the Learn pathway strip; hiding that
  strip's panel leaves the 76 px unchanged. Global chrome is outside this batch.
- Contrast was computed for text against its nearest opaque backdrop. Text over gradients, focus
  rings and non-text contrast were not measured. No screen reader was run.
- Chromium only.

## Numeric-versus-render checks

| Change                           | Numbers                                                                                                          | Geometry                                                                                 | Image                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| Underdamped and overdamped beats | Learn equals atlas to 0.1 mmHg; mean within 1.5 mmHg of source                                                   | printed "drawn as" values read from the page: 25/10, 21/12, 28/7                         | `head/…/dynamic-response.png`            |
| TR example                       | 0 falling samples between c and v; mean 14.000; other phases shifted by one constant                             | browser path: 0 falling steps between the two landmarks; c-v above "x lost"              | `head/…/tr.png`                          |
| Pure leveling offset             | reducer changes no stored measurement, episode or series; only the displayed samples shift                       | axis ticks identical before and after; one seam; `earlier` and `current` traces; no clip | `strip-before.png`, `strip-after.png`    |
| Opening buffer                   | the zeroed fixture reads exactly its 5 mmHg zero offset below the unzeroed line at every sample time; idempotent | no seam on open                                                                          | `head/L2-04-06-s2t2-*.png`               |
| Leveling reference point         | drawn at (anterior + posterior) / 2                                                                              | measured between 40 % and 60 % of rendered chest depth                                   | `leveling-card.png`                      |
| Held copy                        | every held sample is drawn, point for point; no dispatch                                                         | taller plot, five wave names, no overlap, live strip still advancing                     | captured in the journey                  |
| Display range in three renderers | unclamped coordinates in the path data                                                                           | clip path present; no run of samples on the axis edge                                    | `flush-workbench.png`, `learn-atlas.png` |

## Evidence

Outside Git, as the pack requires:
`Interventional-Pulm-Local-Data/renders/output/hd-pre-review-03-2026-10-03/`

- `base/` — 30 full-page captures and `capture-all.json` (measured geometry) on the execution base.
- `head/` — the same 30 captures by the same file names on the implementation head.
- `head/playwright-task03/` — per-journey screenshots and the measured geometry as JSON.
- `logs/` — Jest and Playwright logs for base and head, and
  `playwright-existing-specs-identity.txt` (failing tests compared by name).

Before and after, measured:

| Finding             | Base                                                                                       | Head                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| L3-01               | figure labels 41 px tall; `mmHg` over `ECG`; trace 67 px tall in a 749 px figure           | labels 13.6 px; no collisions; plot at least 90 px                                        |
| L2-04               | drawing 242 px wide in a 502 px card; labels 5–6 px; "69 MmHg MAP"                         | labels at least 12.8 px; "16.3 mmHg", "23.6 mmHg", "Reads high"; pulmonary-artery channel |
| L2-06               | ticks 0/20/40 → 0/40/80, no notice; `model mPAP 24` on the trace                           | ticks unchanged; seam named; tag in the gutter                                            |
| L2-08               | underdamped beats 25.7/9.6                                                                 | 28.2/6.5, printed as 28/7                                                                 |
| L2-09               | three panels 390 px tall each, stacked over 1,312 px                                       | one row at 1204 px and 1440 px, rows aligned to 1 px                                      |
| L2-11               | monitor at 412–724 px, choices at 1193–1476 px in a 987 px window; goal marks were circles | monitor's tracing whole and uncovered with the choices in view; no circles                |
| L3-06               | two figures 925 px and 914 px tall, stacked                                                | side by side from 1024 px, plot tops and bottoms within 1 px                              |
| L1-05               | sources panel `position: absolute`, overlapping the task list                              | `position: static`, no overlap, inside the window                                         |
| X-01                | map labels 10 px font, 7 px tall                                                           | 12.8 px                                                                                   |
| P-07                | "Eight preserved management cases"; two `main`, one nested                                 | "Eight practice cases"; one `main`                                                        |
| HD-02 carry-forward | reason list 1.08:1, unavailable buttons 2.43:1                                             | 5.44:1 each, both themes                                                                  |

## Task 01 and Task 02 preservation

Nothing in the catheter transition rule, balloon safety, release logic, PA-return episode,
flush interlocks or safe abandon was edited; nothing in series identity, wedge acquisition,
provenance labels, cursor placement, Fick provenance or the matched comparison was edited.

- Engine changes are confined to: display seams (metadata), `withOpeningTrace` (display buffer),
  axis helpers, `mixedVenousAvailability` (a reason, never a value), one exported transformed beat,
  the authored fusion flag, and a number formatter.
- `hd-pre-review-03-workbench.test.tsx` asserts that a seam-producing action changes no
  measurement, episode, series, catheter flag or stored value, that `withOpeningTrace` changes
  nothing but the buffer, and that Task 02's line isolation holds (only the arterial line is damped
  in the arterial transfer).
- The focused Task 01 and Task 02 suites pass unchanged: `hd-pre-review-01-*` and
  `h2-h3-reference-and-pac-safety` (4 suites, 72 tests), `hd-pre-review-02-*` (6 suites, 87 tests).
- Tags moved to gutters keep Task 02's words: "model mPAP", "end-exp · c-base", stored and cursor
  labels are the same strings in new positions.
- The held copy is local view state. It dispatches nothing and is not a measurement.

## Tests

| Check                                                                                                          | Result                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `hd-pre-review-03-base-regressions.test.tsx` on the pristine base (`047d30b3`)                                 | **11 failed of 11**, each on its assertion — the reproduction                                                                   |
| The same file on the head                                                                                      | 11 passed                                                                                                                       |
| Task 03 Jest: base-regressions, renderers, discrepancy-matrix, workbench, narrow-layout                        | 5 suites, 89 tests passed                                                                                                       |
| `jest src/features/icu-hemodynamics "src/app/\[locale\]/icu-hemodynamics" --runInBand`                         | **56 suites, 731 tests passed** (base: 47 suites, 630 tests in the feature directory)                                           |
| Consumer suites: `critical-care`, `learning-module`, `module-beta`, `app/api/critical-care`, `cardiac-anatomy` | 46 of 49 suites pass; **3 failures, identical on the base by test name and by failure detail** (below)                          |
| `e2e/icu-hemodynamics-pre-review-03.spec.ts`                                                                   | 64 passed                                                                                                                       |
| `e2e/icu-hemodynamics-display-range.spec.ts`, `…-atlas-readability.spec.ts` (#314)                             | 4 passed, 6 passed                                                                                                              |
| `e2e/icu-hemodynamics-pac-layout.spec.ts`                                                                      | 2 passed                                                                                                                        |
| `e2e/icu-hemodynamics-flow.spec.ts`, `…-targeted.spec.ts`                                                      | 8 passed, **16 failed — the same 16 test names fail on the base** (below)                                                       |
| `tsc --noEmit`                                                                                                 | clean. After the build has populated `.next`, the default Node heap runs out; run with `NODE_OPTIONS=--max-old-space-size=8192` |
| ESLint, changed paths and the two specs, `--max-warnings 0`                                                    | clean                                                                                                                           |
| Prettier, `git diff --check`                                                                                   | clean                                                                                                                           |
| `npm run build` (dev server stopped first)                                                                     | passed (exit 0); the one compile warning is a third-party `mermaid`/`langium` dynamic `require`, unrelated to this module       |

### Baseline failures, compared by identity

Not repaired; none is in this batch's scope.

Jest, consumer suites — the same three on base and head, with byte-identical failure detail:

- `activity library ordering (WP10 §4 bug A) › renders CRRT cases in authored station order, not alphabetically by title`
- `critical-care accessibility surfaces › keeps color-coded circuit, pressure, alarm, and trend states readable without color`
- `critical-care learner-copy framing › keeps static component copy free of grading and software-internal labels`
  (90 entries on both; none in `icu-hemodynamics`)

Playwright — the same sixteen on base and head; none fails on the head only:

- `icu-hemodynamics-flow.spec.ts`: pressure flow preserves independent baselines…; blinded waveform
  progression…; advancement uses actual transit…; wedge requires capture…; thermodilution ledger
  precedes Fick…; clinical question and all seven attribution decisions…; derived inputs withhold
  only dependent results…; integration restores actual line…; Practice preserves all
  interventions…; Challenge keeps safety interrupts (deferred, immediate).
- `icu-hemodynamics-targeted.spec.ts`: teaching, visual question and map submission at 1440, 1280
  and 390; pressure demonstrations…; normal components, assisted retry….

These specs were already recorded as red in the Task 01 and Task 02 handoffs. On the base, two more
tests fail — #314's display-range spec in its two light-theme conditions — for the harness reason
given above; they pass on the head.

### Not run

Full repository Jest outside the suites named; non-Chromium browsers; native browser zoom; a screen
reader; production or beta acceptance; any deployment. The 3D view was exercised in headless
Chromium only as far as its page-level text and controls; its WebGL rendering is not asserted.

## Source and model assumptions

- Sources were read in place from the private reference library and are not copied here.
  Paraphrased: the registered catheterization text puts the zero position at mid-chest in the
  anteroposterior dimension at the fourth intercostal space, and describes overshoot and undershoot
  with an underdamped system and the reverse with a damped one; the registered pulmonary-artery
  catheter review describes the systolic c–v wave of tricuspid regurgitation as obliterating the x
  descent, and places the thermistor near the tip, the balloon at the tip and a proximal port in
  the right atrium without giving distances.
- "Square-wave test" appears in no registered source; "fast-flush test" does.
- The drawn values for a damped or resonant line are this model's, for this source signal. They are
  labelled as illustrations of direction, not targets.
- The reference comparison axis is derived from the baseline's own samples plus the control's range,
  so it holds every reachable value without clipping.

## Holds for human review

For each: what the reviewer has to decide.

| Item                                    | Group    | Learner impact now                                         | Owner                                            | Safe presentation in place                             | Decision needed                                                                                  | Next      |
| --------------------------------------- | -------- | ---------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------- |
| L3-03 RV slope change                   | R3       | A shoulder at ~14 mmHg can be taken for a notch            | `engine/waveformMorphology.ts`                   | Comparison and note say it is not a notch              | Should the ventricular fall be drawn without that change of slope? Against which source tracing? | Prompt 05 |
| L3-07 ECG timing                        | R3       | PA upstroke leads RV by 36 ms; PA peak ahead of the T wave | `engine/waveformMorphology.ts` (`CARDIAC_PHASE`) | Note says the ECG timing is schematic                  | Shift PA onset and peak to the sourced timing, or keep schematic timing and the note?            | Prompt 05 |
| L4-02 rhythm examples                   | R3       | Cannon a and AF are drawn at an even rate with no ECG      | `content/waveformAtlas.ts`                       | Limit printed under each figure; instruction corrected | Author a synchronized rhythm example for each, with a source tracing, or keep schematics?        | Prompt 05 |
| L4-04 TR example                        | R3       | One fused systolic wave                                    | `content/waveformAtlas.ts`, `systolicFusion`     | "One example" note                                     | Confirm the fused example and its amplitudes; decide whether the live model's TR should fuse too | Prompt 05 |
| L7-02 injection technique               | R3 R4    | A prolonged injection does not change the curve's shape    | `engine/thermodilution.ts`                       | Note on the trial and in the source boundary           | Should technique alter the contour, and how, from which source?                                  | Prompt 05 |
| L2-05 leveling conventions              | R2 R6 R8 | Supine reference point only                                | `components/LevelingVisual.tsx`                  | Caption says what the drawing shows and does not       | Wording for lateral, prone and head-up positions; whether to draw them                           | Prompt 05 |
| L1-01 catheter geometry                 | R6       | No distances                                               | `components/NormalWaveformAnatomyFigure.tsx`     | "gives no distances"                                   | Whether to show device-specific distances, and for which catheter                                | Prompt 05 |
| L5-04 central structure in the 3D heart | R6       | An unlabelled pale structure                               | shared `cardiac-anatomy` model                   | Legend states the drawing convention                   | Name it, hide it in this view, or leave it                                                       | Prompt 05 |
| L2-08 drawn values                      | R3       | 28/7 and 21/12 are model values                            | `engine/troubleshootingWaveforms.ts`             | Labelled as this model's drawing, not targets          | Confirm the size of distortion to teach                                                          | Prompt 05 |

## Carry-forwards

**From Task 02, dispositioned here**

| Item                                              | Outcome                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Value tags drawn over the trace                   | Done. No tag intersects a trace at any matrix condition; labels unchanged                                                                     |
| Reading marker on the §3 right-atrial figure      | Done. A ring at the base of the c wave, inside the end-expiratory window                                                                      |
| Placeholder and disabled contrast, thermodilution | Done. 1.08:1 and 2.43:1 became 5.44:1 in both themes; the selected reason is no longer near-white on white                                    |
| 76 px overflow at 1204×987, 200 % root text       | **Not done, and re-attributed.** The source is the global site header, not the Learn pathway strip; identical on the base; outside this batch |
| Manual wedge cursor in Practice                   | **Not taken.** Optional in Task 02's handoff; it is measurement behaviour, not a visual change                                                |

**To Task 04 (self-paced teaching and flow)**

| Item                                                       | State                                       | What 04 decides                                                       |
| ---------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| L7-02 quality line shown before review                     | Unchanged                                   | Whether the automatic check should wait for the learner's own reading |
| Leveling and reference cards are light cards in dark theme | Readable (contrast measured); not re-themed | Whether to theme them, with the atlas, in one pass                    |
| P-03 "More actions remain available" wording               | New, plain                                  | Final wording with the rest of the Practice flow                      |
| L3-05 walk position versus map stop                        | "Map stop N" label only                     | Whether the walk needs its own position line                          |

**To combined acceptance (06) or the owner of the surface**

- Global header overflow at 200 % root text (site chrome).
- The sixteen red flow and targeted journeys (HD end-to-end spec owner).
- A tab stop, or another keyboard route, for the figure's inner scroller at 390 px with 200 % text.
- Native browser zoom and a screen-reader pass.
