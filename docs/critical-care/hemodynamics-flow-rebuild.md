# ICU hemodynamics — the flow rebuild: what shipped

Companion to [`hemodynamics-flow-rebuild-plan.md`](./hemodynamics-flow-rebuild-plan.md), which is
the scope statement and the Phase 1 plan. This file is the record: what landed, what was measured,
what the tests pin, what was deliberately not done, and what waits for the owner.

Branch `claude/hemodynmaics-9-5`, cut from `origin/main` at `119a3d08` (the merged ECMO R4
rebuild) with the open H5 derived-hemodynamics branch merged in first (`fc91c4c5`) so the derive
section is built on the canonical metric model rather than forking it. Dated 2026-09-05.

---

## 1. What changed, by commit

| Commit                      | What it is                                                                                                                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1a42adad` the stage        | `src/features/learning-module/stage/` — the ECMO lean shell promoted to a shared package, byte-identical to the copy the mechanical-ventilation rebuild introduced on `claude/mv-flow-rebuild`, so the two branches merge without a conflict there. ECMO keeps its own copy until its owner chooses to switch. |
| `d4ad9e72` the registries   | The plan; `content/{routeSpine,controlPanel,signalGrammar,sectionSpecs}.ts`; the shared catalog and pathway gain an orientation section ahead of the runway and split the waveform section in two; every section title becomes a presentation.                                                                 |
| `a4702666` the content      | `content/{stageItems,questionSort,storyProblems,mapAnswerTargets,pathwayResolver,stageLessons,stageSources}.ts`, `engine/{stageRuntime,learnProgress}.ts`.                                                                                                                                                     |
| `2104090d` the sections     | `components/stage/` (host, simulator pane, docks, teaching column, source list, story problems, question sort, progress derivation, session hook), `components/catheter-map/`, the module frame with activity mode, the monitor's withheld chamber label, the Learn route rewired.                             |
| `d616c56c` the browser walk | What driving every section found: sticky performed steps, a stop passed counts as reached, the advancement transfer's two docks, the artery-is-back and reassess controls, the places-only drill, the derive section's outstanding list, measured-time ticking, a development-only clock seam.                 |
| `49619d8b` one door         | The Overview and the Learn landing on one Continue and one map; the old Learn activities, section switcher, readiness cards, orientation, prebrief, reasoning, wedge-sequence and validity panels, and the orphaned single-page lab deleted.                                                                   |
| the tests                   | The new stage suites; the H0–H5 suites kept for their content and re-pointed away from the deleted components; two suites that pinned only the deleted activities retired.                                                                                                                                     |

Untouched: the engine (`engine/reducer.ts`, `simulation.ts` and the rest, save two new files), the
bedside monitor's waveforms, the eight Practice cases and `HemodynamicCaseActivity`, the challenge,
the storage key and schema of the case ledger (`icu-hemodynamics-progress-v2`), the seven existing
section ids and their order, every prediction and transfer item H0–H5 authored (two are edited,
listed in §5), the H4 and H5 completion contracts, the shared critical-care envelope.

## 2. What a section is now

Every section runs on one stage: three panes that scroll on their own inside a viewport-sized
shell, a slim header with the section's place in the pathway, a context strip carrying the five
things the learner can change, one Now card, one step list, and one folded sources block in the
footer. The monitor is never scaled; beneath it the dock the current step needs, and beneath that
the catheter map.

The steps, in the shape every section shares: **Recognize → Predict → Act → Observe → Explain →
Transfer (predict) → Transfer (do it) → Transfer (what carried over)**. Sections whose material has
no engine goal at a phase omit that phase rather than invent one, so the orientation has five
steps and the two waveform sections six.

| Step      | What the learner does                                                                                                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recognize | Reads the framing and the increment sentence. Section 2 walks the line; section 3 walks the four places, the tip moving to each and the monitor showing what that place writes; section 8 sorts six flowsheet quantities by how they reached the record.                                                                                                           |
| Predict   | Commits before anything moves. The docks lock while deciding; the verdict states the outcome. Sections 3 and 4 answer on the catheter map, with the monitor's chamber label withheld and the tip not drawn.                                                                                                                                                        |
| Act       | The hands-on work, judged by predicates on the engine: level and zero; name five tracings; freeze and find the five waves; advance and confirm each place on the map; occlude, cursor, store, deflate; read every curve and decide it; work the derived episodes; restore the capstone's line, tip and series. The orientation attributes seven questions instead. |
| Observe   | Reads the response: the flush run, read, said and repaired; the ventricle against the artery; the wedge's plausibility and the artery's return; which Fick result was measured; reassess.                                                                                                                                                                          |
| Explain   | The verdict recap, what actually changed, the rows of the one table this section fills in, the control strip, the section's deeper reference folded shut, the model boundary — and on two sections, the story problems.                                                                                                                                            |
| Transfer  | A different situation, same principle: a new patient or a new line, predicted, then done, then read.                                                                                                                                                                                                                                                               |

Nothing about a commitment is persisted. A reload starts a section at its first step; a URL naming
a later phase fails closed at the first step. The only thing written is the completion record, in
a module-local store (`icu-hemodynamics-learn-v1`), because the shared critical-care envelope
downgrades every completion on an activity whose evidence authority is `none` — eight of the nine.

## 3. The teaching structure

New, and authored as constructs for this simulation, all badged as such where shown:

- **The spine** (`content/routeSpine.ts`): five stops — the line, the right atrium, the right
  ventricle, the pulmonary artery, the wedge — each with a plain name, the monitor's word for it,
  one analogy, the precise statement, a checklist of at most four, and one thing to try. Drawn as
  the **catheter map** (`components/catheter-map/`): the right-heart schematic the normal-waveform
  reference already draws, continued leftward through the tubing, stopcock, flush bag, transducer
  and monitor as one path, with the current stop haloed and captioned in words, the simulated tip
  drawn when the step allows, and — when a step asks where the tip is — the places as a radio
  group of numbered pins and rows, with an off-map row for "it cannot be named".
- **The control panel** (`content/controlPanel.ts`): "You can change five things on this
  monitoring system: where the transducer sits, what it calls zero, the display scale, where the
  catheter tip is, and whether the balloon is up. Three more are checks you run, not settings."
  Two axes, the reference and the response, stated once on section 2 and reused on every Explain
  step as a strip: this one / not this one / the harmful reflex / monitoring only here.
- **The one table** (`content/signalGrammar.ts`): eleven rows of what you see → where it lives →
  the shortlist → the first move, each with a stop on the spine or one of two places off it (the
  technique, the inputs). Every section highlights its rows; none restates one; the direction
  claims are run on the engine by `signal-grammar.test.ts`.
- **Section specs** (`content/sectionSpecs.ts`): one new concept, a discrimination objective, the
  increment sentence, the stops lit, the rows highlighted, the control strip, the deny patterns,
  the model boundary, the Practice pairing. Validated against the pathway, the grammar and the
  learner-copy gate at import.
- **The question sort** (`content/questionSort.ts`) on the orientation section, and **three story
  problems** (`content/storyProblems.ts`): a fresh zero for a ringing line, a lower transducer for
  a narrow tracing, more balloon for a wedge that does not look right — each committed, then
  followed by the readings an engine run of that story produced.
- **The teaching patient**: the module's first case with a quiet, normal circulation in place of
  its shock, so every section but the capstone opens on the normal state.

The deeper references H0–H5 authored — the validity sequence, the normal-waveform reference and
its faulted-display challenges, the abnormal-pattern atlas, the stop conditions, the wedge sequence
and its validity checks, the three-record cardiac-output model, the Fick episodes, the derived
records — render in the teaching column on the Explain step, folded to their headings, behind the
commitment.

## 4. One door, one map

`content/pathwayResolver.ts` is the single resolver. The Overview hero, the Learn landing and the
accordion's "Up next" all call `nextIncompleteHemodynamicsSection`, which walks the canonical order
and returns the first section without a completed record — section one for a fresh learner. The
composition line ("9 sections · 1 orientation · 2 foundations · 4 mechanisms · 1 application · 1
capstone · 121 min") is counted from the registry at render. The accordion groups by stage as
contiguous runs of the one order (the pathway interleaves a foundation between two mechanism runs
on purpose, so a stage may appear twice), and `pathway-resolver.test.tsx` asserts that flattening
the groups reproduces it. Case chips name the presentation, never the short diagnosis.

## 5. Copy edited in the existing items

Two items changed and every other H0–H5 item is used as authored:

| Item                                                 | What changed and why                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pac-advance-commit-ra` (as `hd-advance-predict-1`)  | The keyed choice spelled out the ventricular morphology it expected, which on the stage made the longest option the keyed one and handed the Act step its answer. The label is trimmed to "Advance, expecting the ventricular shape to appear next." and the morphology kept in the rationale. |
| `pac-waveform-transfer-1` (as `hd-place-transfer-1`) | Gains a fourth choice, "It cannot be named from this description", so the transfer can be answered on the map with the same off-map option as the prediction; it is `reasonable-but-incomplete`, never keyed.                                                                                  |

The tricuspid-regurgitation item moved from the place-naming section to the new section that
reads waves inside a named place; the true-wedge item that used to open catheter advancement is
retired (its question is the wedge section's plausibility commitment). Every item authored or
edited here is `draft`.

## 6. Measured in the browser

Dev server on :3120, viewport 1440×900, each section's first step, DOM probe over the whole page.
The monitor is a device surface and is excluded from the "outside monitor" columns.

| Section, moment                 | Controls | Words (outside monitor) | Words < 13 px (outside) | Headings | Internal scrollers                                             |
| ------------------------------- | -------- | ----------------------- | ----------------------- | -------- | -------------------------------------------------------------- |
| `pressure-system`, before       | 60       | 3,269                   | 3,025                   | 27       | three 423 px panes holding 736 / 4,416 / 5,828 px, task 862 px |
| `pressure-system`, now          | 50       | 1,386 (1,207)           | 248 (164)               | 3        | Simulator 657/1,255, Teaching 657/1,588, Steps 657/1,249       |
| `thermodilution-series`, before | 47       | 6,560                   | 5,643                   | 27       | panes holding 736 / 7,771 / 8,694 px                           |
| `thermodilution-series`, now    | 73       | 1,856 (1,677)           | 667 (583)               | 7        | Simulator 657/3,102, Teaching 657/1,373, Steps 657/828         |

The thermodilution first step keeps three trial cards on screen (the prediction is about them),
which is where its controls and small type come from. Document scroll: `window.scrollY` stays 0
after a forced scroll; the residual 17 px (site header 81 px against the 4 rem the shell subtracts)
is the one the ECMO record already notes.

Also driven in the browser, on every section: the walk moving the tip and the monitor's label with
it; the prediction step withholding the chamber name (the rail reads "PAC · distal"), the map
lighting nothing and drawing no tip until the commitment, then the keyed place haloed and the
chosen row reading "your answer · correct"; the docks locking while deciding; level and zero met
as goals; the flush run, read, said ("Correct. This is underdamped response…") and repaired; the
before-and-after table; two story problems running on the engine; the transfer on the damped line;
the completion record written once; the question sort graded row by row; the recognition drill
reaching five; the freeze; the tip advanced and each place confirmed on the map only once the
tracing had settled there, with the ventricle-against-artery table on Observe; the wedge occluded,
settled, cursored, stored and deflated inside the simulation's release interval, the plausibility
and return commitments, the artery-is-back confirmation; three curves reviewed, one excluded with a
reason, a replacement injected by holding the control, the series established, the provenance
commitment, the disagreement scenario; the provenance drill and the SVR prediction on the derive
section; the capstone's three restorations on HD-08, the reassess, the arterial-line transfer; the
hub's Continue resolving to the first unfinished section with the right group open.

The preview tab is hidden and Chrome throttles its timers to once a minute after a few minutes, so
the catheter in transit and the balloon settling were driven through a development-only clock
seam (`window.__hemodynamicsStage.tick`, never present in production); the component suites below
cover the same paths under fake timers.

## 7. What the tests pin

`npx jest src/features/icu-hemodynamics src/features/critical-care src/features/learning-module 'src/app/\[locale\]/icu-hemodynamics' --runInBand`
(counts in the summary at the end of this file).

| Suite                                    | What it asserts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage-registries.test.ts`               | Every registry validates at import: the spine, the panel, the grammar, the specs, the items, the sort, the stories, the map answers, the lessons.                                                                                                                                                                                                                                                                                                                                                                           |
| `stage-lessons.test.ts`                  | Nine lessons in canonical order; one prediction and one transfer each; gates after the prediction; Recognize first, Transfer last; no digit in a title; no pre-commit authored surface carrying a deny phrase; the keyed choice neither first nor longest across the set; every distractor has a rationale; every objective names a discrimination.                                                                                                                                                                         |
| `stage-precommit-leak.rendered.test.tsx` | Every section mounted on the real stage over the real engine, scanned at the first step and at the prediction step reached the way a learner reaches it, hidden nodes and attributes included, the answer fieldsets excused; no verdict attribute, no source claims, locked rows show only their ordinal; the map lights nothing and draws no tip while a section asks where the tip is.                                                                                                                                    |
| `stage-host.test.tsx`                    | The whole of the pressure-system section under fake timers, Back without losing a commitment, restart from nothing, a URL naming a later phase failing closed; the sort committed as a set and graded in words; the map as one radio group of numbered pins, silent until committed, the off-map row never keyed; a place confirmed only once the tracing has settled; the wedge stored and deflated, the release by the simulation not counted; the capstone's three restorations, the reassess and the arterial transfer. |
| `pathway-resolver.test.tsx`              | Fresh learner → section one; the first unfinished section whatever was opened last; nothing once every section is done; every count derived; groups flatten to the one order; every case by presentation; exactly one group open; Start / Continue / complete from the same resolver; the Overview and the Learn landing on the same door and map.                                                                                                                                                                          |
| `signal-grammar.test.ts`                 | Offset moves every pressure by one amount and no shape; scale changes nothing underneath; damping narrows and resonance widens the pulse pressure around a preserved mean, with the flush finding to match; the ventricle and the artery share a peak and differ in their floor; a false wedge sits above the artery diastolic; a second inflation is refused and recorded; a poor injection is a curve the series refuses; a missing input withholds.                                                                      |
| `story-problems.test.ts`                 | Each story's verdict read off an engine run of the story.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `stage-sources.test.tsx`                 | One source set per lesson, resolved, nothing cited twice, both items covered; cited once in the footer, shut, claims only after the commitment.                                                                                                                                                                                                                                                                                                                                                                             |
| `learn-progress.test.ts`                 | The record's own key beside the case ledger, one completion per section, malformed records refused, duplicates dropped.                                                                                                                                                                                                                                                                                                                                                                                                     |

The H0–H5 suites keep every content assertion — the validity sequence, the normal reference and
its one axis, "no balloon volume or inflation-time limit anywhere", the advancement stop logic
derived blind to the waveform match, the wedge commitments, the three-record cardiac-output model,
the canonical derived records and evaluator — and are re-pointed from the deleted activities to
the runtime's goal predicates where a behaviour survived as one. `pac-guided-skill-verdict` and
`pac-signal-validation-activity` are retired with the activities they pinned; the verdict's
behaviours live in `learning-module/components/__tests__/AnswerVerdict.test.tsx`.

## 8. Deliberately not done

- Micro-cases after each mechanism.
- Shock-phenotype teaching — the pressure–flow–resistance grammar the Practice cases apply. The
  Learn pathway teaches measurement validity; Practice applies phenotypes the Learn layer does not
  teach, which the plan records as an H6 package with its own sources.
- The 3D heart on the stage. The catheter map is where answers go; a drawing the preview pane
  cannot verify would be a second map.
- Re-pointing the ECMO module at `learning-module/stage/`.
- The inline citation lists inside the folded deeper-reference panels (the method model, the
  derived records, the troubleshooting atlas) — they cite what they say when they stand alone, and
  inside the stage they sit behind a fold; the footer is the lesson's one list.
- Localisation; the module stays English-only with the reviewed-English fallback note.
- Writing the shared critical-care envelope for Learn completion (§2).

## 9. Open for the owner

- Subject-matter review of everything carrying `draft`: the orientation's two items, the
  place-naming prediction, the tamponade transfer, the capstone's two items, the three story
  problems, the question sort, the spine's five stops, the control panel, the eleven grammar rows,
  the nine section specs and every step's copy.
- The 10-second balloon release leaves about four simulated seconds to place the cursor, store and
  deflate once the occlusion has settled. It is the rail the H3 station had; whether it is too
  tight for a novice is a human-testing question.
- The Learn sections run on a normal teaching circulation built from the first case's definition
  with normal parameters, under the first case's id. If the case ledger is ever extended to Learn,
  the teaching patient should get an id of its own.
- The legacy case calculator's `inputsStale` flag annotates a withheld reason but does not itself
  withhold a computable value; the canonical H5 evaluator does. Practice-side, not touched here.
