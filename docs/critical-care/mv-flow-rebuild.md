# Mechanical ventilation — the flow rebuild: what shipped

Companion to [`mv-flow-rebuild-plan.md`](./mv-flow-rebuild-plan.md), which is the scope statement
and the Phase 1 plan. This file is the record: what landed, what was measured, what the tests pin,
what was deliberately not done, and what waits for the owner.

Branch `claude/mv-flow-rebuild`, cut from `codex/mechanical-ventilation-update` at `7976e5b3`
(itself on `origin/main` at `119a3d08`, the merged ECMO R4 rebuild). Dated 2026-09-05.

---

## 1. What changed, by commit

| Commit                         | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `34c9c8af` the stage           | `src/features/learning-module/stage/` — the ECMO lean shell's step model, shell, Now card, step list, Sections drawer, context strip, help dialog, folded sources footer, teaching scope and choice rotation, promoted to a shared package. `mechanical-ventilation/content/{breathSpine,controlPanel,breathGrammar,sectionSpecs,stageItems,stageLessons,stageSources,pathwayResolver,casePresentation}.ts`. `components/breath-map/`, `components/stage/` (host, simulator pane, teaching column, progress derivation, session hook, source list), the hub, the Learn landing, the pathway accordion, the Practice picker, the module frame with activity mode. Routes rewired. |
| `a211f3ca` the deletions       | The Codex live-learning activity, course home and course practice; the pre-Codex lesson activity, learn workspace, novice runway, practice wizard and learning items; their suites, the novice-runway render script, the Codex Playwright spec and config.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `6b535ee1` the contracts       | Pure and rendered pre-commit leak scans over all fourteen sections, the one-door resolver and accordion, the grammar rows run against the engine, the walk, the map answer and the settings sort.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `77cabdd8` stories, vocabulary | Two story problems on the carbon-dioxide section with engine-derived verdicts; the ECMO vocabulary table applied to the new copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `4f8b528b`, `20df5404`         | The map lights nothing while it is the question; sliders wait for their step; numbered stop labels with a legend; the Practice builds-on line and the knowledge-check copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Untouched: the fourteen unit ids, their order, stages, prerequisites and minutes (the
critical-care activity catalog and learning pathway still project from `learningCurriculum.ts`);
the twenty-eight experiment rounds' predictions, rationales, goals and intervals (six sentences of
their copy were edited, listed in §5); the passive patient `MV-LAB`; the fifteen cases and the case
activity; the ten-item knowledge check; the four device profiles and the console; the saved-record
key `mechanical-ventilation-live-learning-v1`.

## 2. What a section is now

Every section runs on one stage: three panes that scroll on their own inside a viewport-sized
shell, a header with the section's place in the pathway, a context strip carrying the five things
the learner can change, one Now card, one step list, and one folded sources block in the footer.

Eight steps, the first five from experiment round 1 and the last three from round 2:

| Step | Phase     | What the learner does                                                                                                                                                                                                                    |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Recognize | Reads the framing and watches the running patient. Section 2 walks the four stops of the breath map instead; sections 8, 11 and 12 ask _where on the breath_ the problem lives, answered by choosing a stop on the map.                  |
| 2    | Predict   | Commits an answer before the change is made. The controls lock while deciding; the verdict states the outcome and unlocks them.                                                                                                          |
| 3    | Act       | Makes the round's change on the console or with the quick controls beneath it. Done when the engine holds the change.                                                                                                                    |
| 4    | Observe   | Lets the response interval elapse while watching the named readings. Compare unlocks when it has.                                                                                                                                        |
| 5    | Explain   | The verdict recap, the before-and-after table, the explanation; on the right the analogy, precise statement, checklist, the one table, the control strip, the live teaching panel and the boundary. Section 3 adds a settings sort here. |
| 6–8  | Transfer  | Round 2 in a new setup: predict again, make the change and watch, what changed.                                                                                                                                                          |

The lab session (`engine/learningLab.ts`) stays the authority on where the learner is. The stage
derives the live step from the round, the phase, the goals and the commitments
(`components/stage/stageProgress.ts`), so a reload lands on the step that was left with the patient
paused where it was. The one exception is a step the learner has done but not yet moved past — a
verdict still being read — which the host holds until Continue.

The reflection text box and its twelve-character gate are gone. Finishing a round needs its reveal
to have happened and nothing else. The location answer and the settings sort are recorded beside
the prediction in the same saved record.

## 3. The teaching structure the Codex build authored and never rendered

Each unit's analogy, precise statement, checklist, worked example, why-it-matters and boundary
(`learningCurriculum.ts`) now render in the teaching pane on the Explain step and fold to their
headings on the transfer. Nothing post-commitment is in the document before the commitment.

New, and authored as constructs for this simulation:

- **The breath spine** (`content/breathSpine.ts`): four stops — trigger, inspiration, cycling,
  expiration — each with a plain name, the console words, one analogy, what to look at on each
  trace, a checklist of at most four items, and one thing to try. Drawn as the **breath map**
  (`components/breath-map/`), a schematic of one passive volume-controlled breath on three traces
  under the live console, with the current stop lit, a caption in words, and — when a section asks
  where the problem lives — the stops as a radio group of numbered pins and rows.
- **The control panel** (`content/controlPanel.ts`): "You can change five things on this
  ventilator: the mode, the size of the breath, the rate, the PEEP, and the oxygen." Three shaping
  settings are met at their stop. Two axes, oxygenation and ventilation. Every Explain step quotes
  the panel as a strip: this control, not this control, no control.
- **The one table** (`content/breathGrammar.ts`): eight rows of what moved → where on the breath →
  the shortlist, grown from the curriculum's decision table and given a location on the spine or an
  axis. Every mechanism section highlights its rows; no section restates one. The direction claims
  are run against the engine by `breath-grammar.test.ts`.
- **Section specs** (`content/sectionSpecs.ts`): one new concept, a discrimination objective, a
  presentation-named first step, the stops lit, the control strip, deny patterns, the Practice
  pairing. Validated against the curriculum and the grammar at import.
- **Presentation titles** for the fifteen cases (`content/casePresentation.ts`), used on the
  accordion, the Practice picker and the pairing offered at the end of a section.
- **Two story problems** on the carbon-dioxide section (`content/storyProblems.ts`): the oxygen
  setting reached for a carbon dioxide problem, the rate setting reached for a patient who cannot
  empty. Each is committed, then followed by the readings an engine run of that story produced.

## 4. One door, one map

`content/pathwayResolver.ts` is the single resolver. The hub hero, the Learn landing and the
accordion's "Up next" all call `nextIncompleteVentilationSection`, which walks the canonical order
and returns the first section without a completed record — section one for a fresh learner. The
composition line ("14 sections · 1 orientation · 2 foundations · 7 mechanisms · 3 applications ·
1 capstone · 102 min") is counted from the registry at render. The accordion groups by stage,
which are contiguous runs of the one order, and `pathway-resolver.test.tsx` asserts that
flattening the groups reproduces it.

The module nav reads Overview | Learn | Practice | Assess, the critical-care grammar; the frame is
back on the dark theme the other labs use, with the activity-mode rule that hands a section the
viewport.

## 5. Copy edited in the experiment rounds

Six sentences of the Codex rounds' learner copy changed, all for one of three reasons:

| Reason                               | Where                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A banned term in an answerable item  | "50%" in a cycle-off explanation; "test it" in a circuit explanation; "points toward" in a hold rationale                                                                                        |
| The pre-commit scan found the answer | Section 1's look ("Find inward flow above zero, outward flow below zero…") named the keyed pairing; section 9's introduction named the case's mechanism ("the original recruitment case")        |
| The vocabulary table                 | "authored" → set for this simulation (six places); "bounded" → small / simplified (three places); the "authored branch" and "authored case" qualifiers dropped where the sentence needed neither |

The full experiment copy still carries `reviewStatus: 'draft'` through the items derived from it.

## 6. Measured in the browser

Dev server on :3120, viewport 1440×900, section 4 (`mechanics-load-and-pressure`) at its first step,
DOM probe over the activity shell. The console facsimile is a scaled device surface and is
excluded from the "outside console" columns.

| Measure            | Value                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| Visible controls   | 36 (23 outside the console)                                                 |
| Visible words      | 688 (543 outside the console)                                               |
| Words under 13 px  | 145 (68 outside the console: kickers, badges, the map legend and labels)    |
| Visible headings   | 5                                                                           |
| Document scroll    | none (`window.scrollY` stays 0 after a forced scroll; body overflow hidden) |
| Internal scrollers | 3 — Simulator 650/1302, Teaching 650/796, Steps 650/806                     |

For comparison the Codex first screen measured 688 words with two patient-mechanics sliders and
the four-phase tab strip visible before anything had been read; the ECMO drill after R4 measured
49 controls and 529 words.

Also driven in the browser: the hub's Continue resolving to section one and reading "Resume" when
a saved record exists; the Learn landing opening the group holding the next section; section 1
from Recognize through the committed prediction (verdict "Correct. That read holds", controls
unlocked, sources claims unfolded); section 2's walk with each stop lit in turn and the patient
sliders absent; section 8's location question with nothing lit until the commitment, then the
trigger stop lit and the row marked "your answer · correct", the bedside findings appearing only
then; Practice with every case named by presentation; Assess with the knowledge check gated on the
fourteen sections.

The preview pane reports the tab hidden, so its clock is throttled to about one tick a second.
"Advance one breath" steps the engine a breath at a time regardless, which is how section 4 was
driven to its Explain step in the browser: resistance to 2× and an inspiratory hold at the Act
step, three breaths, Continue, five more breaths, "Compare before and after", and the reveal read
peak 20.2 → 25.8, plateau 13.5 → 13.8, exhaled volume 427 → 427 — the resistive-load row's claim,
with both mechanics rows highlighted in the one table and the strip reading no control / not this
control. The timed paths are also pinned by the component suites below, which run the same reducer
under fake timers.

## 6b. Owner review, first finding

The owner opened section 1 and stopped at the prediction: "the answer is flow below zero but there
are no numbers or zero line in the waveform." True on every device profile — the flow trace's
range is symmetric (−100 to 100 L/min, or −80 to 80 on the AVEA), so zero was the exact midpoint
of the trace, and nothing marked it; the generic grid drew two horizontal rules at fixed thirds of
the box, one just above zero and one just below, and none on it.

`WaveformStrip` now draws a solid zero rule on any trace whose range spans zero, and the same
rule along the floor of a trace whose range starts at zero (pressure, volume); the horizontal grid
sits at the quarter points of the plotted range, so the middle rule _is_ zero on a symmetric
scale; and the scale's maximum, zero and minimum print at the right edge of every trace, as HTML
so the numbers do not smear in the non-uniformly scaled SVG. The trace's text equivalent names the
sign convention: above the zero line gas is moving in, below it gas is moving out. Both stroke and
type use the screen's own tokens, so they flip with the Evita's white screen.

## 6c. Owner review, second finding

On the same section's Act step: "I don't understand what it is trying to replay here. It makes it
sound like there is a setting that is being changed but it's just freezing the tracing and doesn't
explain anything." Three things were wrong at once, and the screenshot showed a fourth.

- **Generic step names.** Every Act step was titled "Make the change" and every Observe step
  "Watch the response", whatever the round asked for. Section 1's round asks for a pause, which
  changes nothing. Steps that carry a round now name the action in the learner's words
  (`roundActionTitle`): "Freeze the traces while gas is leaving", "Narrow the airways, then perform
  an inspiratory hold", "Set the rate to 26 /min". A round's maneuver — pause, hold or change — is
  classified once (`roundManeuver`) and drives the titles, the instruction's closing note ("Pausing
  only freezes the display. No setting changes…"), the waiting and done status lines, and the
  Observe step, which for a pause becomes "Read the frozen traces".
- **A teaching pane with nothing open.** At the Act step every block was folded to its heading.
  Steps that carry a round now have a guide (`VentilationStepGuide`) and the pane opens it: what the
  maneuver does and does not do, the round's own look line, the three-trace reading for a pause,
  and the readings that will move for a change.
- **A pause has no before and after.** The reveal compared three readings that a pause cannot
  move. For a pause round the reveal now reads the frozen traces off the saved snapshot's last
  sample — flow against its zero line, volume's direction, pressure against the PEEP baseline —
  and no readings panel is shown while the learner acts.
- **The step list ran ahead of the learner.** Observe showed as done while the Act step was on
  screen, because a pause round's observation is complete the instant its act is and the list read
  the lab's state. The list now calls done only the steps the learner has moved past, plus the
  current one when its own work is finished.

The round's task copy also told the learner to use "Advance one breath", which lands the display at
a breath boundary where flow is back at zero and the pause does not count; it now says to press
Pause while the flow trace is below its zero line, and to press Run and try again if missed.

## 7. What the tests pin

`npx jest src/features/mechanical-ventilation src/features/critical-care src/features/learning-module 'src/app/\[locale\]/mechanical-ventilation' --runInBand`:
61 suites, 877 tests at `6b535ee1` (62 suites, 901 tests before the deletions, of which two
failed on this branch's starting point — `learner-copy.test.ts` on Codex copy, and the routes
suite on the renamed components).

New contracts:

| Suite                                    | What it asserts                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage-host.test.tsx`                    | The whole walk of a section under fake timers: locked controls at Predict, the stated verdict, the auto-performed Act, Observe unlocking only after the interval, the reveal blocks, the transfer, completion recorded; looking back and returning; restore on the live step, paused; restart from nothing. |
| `stage-lessons.test.ts`                  | Fourteen lessons in canonical order, one first prediction and one transfer prediction each, gates after the prediction, and the pure pre-commit scan over every pre-commit surface against each section's deny set.                                                                                         |
| `stage-precommit-leak.rendered.test.tsx` | Every section mounted on the real stage, scanned at the first step and at the prediction step reached the way a learner reaches it, hidden nodes and attributes included, the prediction fieldset excused.                                                                                                  |
| `stage-interactions.test.tsx`            | The walk lights each stop in order; the map answer is one radio group with pins numbered along the breath, silent until committed, locking after, and the bedside findings withheld until then; the sort comes after the first reveal, commits as a set and grades each row in words.                       |
| `pathway-resolver.test.tsx`              | Fresh learner → section one; gaps honoured; counts derived; groups flatten to the one order; exactly one group open; Up next is the resolver's section; no case named by diagnosis.                                                                                                                         |
| `breath-grammar.test.ts`                 | Resistive and elastic loads, incomplete emptying, and both axes, each run on the engine; every mechanism section highlights a row and its strip agrees with the row about the control.                                                                                                                      |
| `story-problems.test.ts`                 | Two stories on the carbon-dioxide section, clean copy, no length cue, and each story's readings moving the way its keyed answer says.                                                                                                                                                                       |

Retired with the code they pinned: `learning-flow-ui`, `lesson-answer-verdict`, `lesson-v2`,
`learn-workspace`, `novice-runway`, `lesson-runtime-agreement`, the Codex Playwright spec. The
verdict behaviours the retired suite protected — plausibility attribute, the echoed choice, the
rationale, the other answers, Continue as the caller's, an unsafe answer as an alert — live in
`learning-module/components/__tests__/AnswerVerdict.test.tsx`, which the stage consumes unchanged.

## 8. Deliberately not done

- Re-pointing the ECMO module at `learning-module/stage/`. The promoted package is a copy of the
  ECMO shell with the names generalised; ECMO keeps its own until its owner chooses to switch.
- Presentation titles inside the case activity itself; only the picker, the accordion and the
  pairing are renamed here.
- Micro-cases after each mechanism.
- A Playwright spec for the new stage. The retired one drove the Codex surfaces; the component
  suites cover the same paths.
- Localisation; the module is English-only with the reviewed-English fallback note.
- The shared critical-care progress store is not written for Learn. The saved record is the
  completion authority, as it was on the Codex branch; the MV Learn activities are
  `completionEvidenceAuthority: 'none'` and would be recorded as in-progress regardless.

## 9. Open for the owner

- Subject-matter review of everything carrying `reviewStatus: 'draft'`: the twenty-eight round
  items, the three location items, the two story problems, the settings sort, the presentation
  titles, the control panel and the grammar rows.
- Whether "Correct." / "Not correct." on this module's verdicts is wanted here as on ECMO
  (R4-OD-5 applied it to ECMO only; this module now passes `outcome="stated"` too).
- The Codex knowledge check keeps its light card inside the dark frame, and its 80% standard.
- Whether the hub should offer the placement check ("adjust the guidance") as a secondary door.
