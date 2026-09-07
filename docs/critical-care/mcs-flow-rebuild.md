# Mechanical circulatory support — the flow rebuild: what shipped

Companion to [`mcs-flow-rebuild-plan.md`](./mcs-flow-rebuild-plan.md), which is the scope statement
and the Phase 1 plan. This file is the record: what landed, what was measured, what the tests pin,
what was deliberately not done, and what waits for the owner.

Branch `claude/mec-circ-9-5`, cut from `origin/main` at `119a3d08` (the merged ECMO R4 rebuild,
PR #123). Dated 2026-09-05. The earlier MCS packages (M0–M5, `mcs-learn-section-contracts.md`,
`mcs-live-teaching-panels.md`, `mcs-component-test-matrix.md`) describe the content this rebuild
stands on; where they describe the old three-pane Learn runtime, this file supersedes them.

---

## 1. What changed, by commit

| Commit                  | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `f63e771c` the stage    | `src/features/learning-module/stage/` adopted verbatim from `claude/mv-flow-rebuild` — the ECMO R4 lean shell as the ventilation rebuild promoted it — so the two branches add identical files rather than a third copy. The Phase 1 plan.                                                                                                                                                                                                                                                                                                                                                                                  |
| `79691ec8` the sections | Every section on the stage: `components/stage/` (host, simulator pane, teaching column, story problems, source list), `components/circulation-map/` (the loop, the pathways, the answer pins), the content constructs (`supportSpine`, `controlPanel`, `controlPanelSort`, `supportGrammar`, `deviceIncrements`, `sectionSpecs`, `stageLessons`, `stageSources`, `mapAnswerTargets`, `storyProblems`, `casePresentation`, `pathwayResolver`, `learnerCopy`), the Learn route rewired, presentation titles in the four registries, section 1's identification re-authored and its flow account covered until the commitment. |
| this package            | The hub and the Learn landing on the one door and the one map; the old Learn workbench, its three panes and their suites removed, `McsWorkbench` narrowed to Practice and Challenge; the leak pass over the teaching panels and the specs; the option-length rebalance across every item; the contracts: walkthrough, rendered and registry leak scans, the one table against the engine, the stories against the engine, the registries, the map, the door.                                                                                                                                                                |

Untouched: the nine section ids, their order, stages and minutes; the section contracts' clinical
content (the questions, the four levels, the observed signals, the transfers' setups — only labels,
one starting-context sentence, one on-screen sentence and section 1's identification changed, listed
in §5); the engine, except one Learn-only action (`CLEAR_ACTION_LOG`, §2); the progress key
`interventionalpulm:mcs-progress:v1` and its shape; the analytics contract (`mcs:learn:<id>`
lifecycle ids, the three-field aggregate payload); Practice, the Mechanism Studio and Challenge,
which still run on `McsWorkbench` over the case workflow; the nine practice cases and three
capstones; the sources; the 3D anatomy.

## 2. What a section is now

Every section runs on one stage: three panes that scroll on their own inside a viewport-sized
shell, a header with the section's place in the pathway and five controls, a context strip
carrying the mechanism, its setting, the displayed flow, the mean pressure and the alarm, one Now
card, one step list, and one folded sources block in the footer. The stage runs on the dark
palette the module's device surfaces already use; the hub keeps the module's light theme.

Six steps, from the section contract — seven on the section that walks the loop:

| Step | Phase     | What the learner does                                                                                                                                                                                                                                                                                        |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| —    | Recognize | Section 2 only: walks the five stops of the loop, each lit on the circulation map with its plain name, what a device does there, its analogy and its checklist.                                                                                                                                              |
| 1    | Recognize | Answers the contract's identification. The verdict states the outcome; a wrong answer also says what holds. On the two sections whose answers are places, the answer is chosen on the map.                                                                                                                   |
| 2    | Predict   | Commits the prediction. Nothing past this step is reachable before; the verdict states the outcome, the reasoning follows, and its own Continue is the way on.                                                                                                                                               |
| 3    | Act       | Makes the contract's change — the inspect buttons on the Now card, or the section's control opened and highlighted in the simulator pane. Done when the contract's own state predicate holds.                                                                                                                |
| 4    | Observe   | Reads the six authored readings captured on entry to Act beside the live ones.                                                                                                                                                                                                                               |
| 5    | Explain   | Reads the four levels, what the section establishes and does not, the misreading, its rows of the one table and the control strip. Section 2 adds the control-panel sort: seven readings attributed to _you can set it_ / _the console reports it_ / _the patient's loading decides it_, committed as a set. |
| 6    | Transfer  | The transfer patient loads on entry; the learner commits the transfer answer and does the required work in the new patient. Both together record the section — the one thing persisted.                                                                                                                      |

The reducer is the session: mounted once per section on the contract's starting state, ticked at
four steps a second, fed by the Now card's buttons and the controls surface. Back is its own
control on the Now card and walks one step at a time; the step rows stay review-in-place. A URL
into a later phase mounts at the prediction and says so.

**One engine change.** A transfer patient is built with the same controls the learner is then
asked to move — section 6's transfer sets the level to eight and then requires a level change — so
the record of the build counted as the learner's work and the section completed the moment the
transfer answer was committed. `CLEAR_ACTION_LOG` forgets the action ids after the setup and
nothing else; no scored surface dispatches it.

## 3. The constructs the standard asked for

All authored as constructs for this simulation and validated at import.

- **The spine** (`content/supportSpine.ts`): one circulation as five stops — venous return and
  the right atrium, the right ventricle and the lung, the left ventricle, the aortic valve and the
  ascending aorta, the descending aorta and the body — each with a plain name, where you are, what
  a device does there, one analogy, at most four things to check, and what to look at on the
  monitor. Drawn as the **circulation map** (`components/circulation-map/`), a schematic loop with
  the mechanism on screen drawn on it: the balloon in the descending aorta, the transvalvular pump
  across the valve, the right-sided pump from the vena cava to the pulmonary artery, the durable
  pump from the apex to the ascending aorta. A pathway drawn but not in place is dashed and says so;
  while a place is the question it is not drawn at all. The current stop is lit with a caption in
  words and the same sentence in the drawing's description.
- **The control panel** (`content/controlPanel.ts`): "You can change only a few things on any of
  these devices. On the balloon, the assist ratio and the inflation and deflation timing. On the
  transvalvular pump, the performance level. On the durable pump, the speed, and only with an
  order. Everything else on the console is monitoring." The patient's loading — volume,
  resistance, rhythm, the right ventricle — is the other axis. Every Explain step quotes the panel
  as a strip: this setting, not this setting, no setting — find the cause. Only section 3 has a
  _this setting_; the rest are loading problems, which is the module's point.
- **The one table** (`content/supportGrammar.ts`): seven rows of what moved → where the constraint
  lives → the shortlist, each with a stop on the loop and the engine claim behind it. Every device
  section highlights its rows; none restates one. `support-grammar.test.ts` runs every claim
  through the reducer.
- **Named increments** (`content/deviceIncrements.ts`): counterpulsation is the model plus one idea;
  the transvalvular pump is counterpulsation plus exactly two; the durable pump is the transvalvular
  pump plus one; choosing adds no mechanism. The count is in the sentence and in the list, and the
  validator holds them to each other.
- **Section specs** (`content/sectionSpecs.ts`): one new concept, a discrimination objective,
  prerequisites taught earlier, stops, the strip, the table rows, the Practice pairing, six step
  titles and the deny patterns the leak scans hold every pre-commit surface to. Presentation titles
  in all four registries: _A pressure that looks fine · Three devices called support · Is the
  balloon inflating at the right moment? · Timed correctly, still not perfusing · Where is the
  inlet sitting? · A suction alarm at high support · Speed unchanged, resistance rising · An alarm
  at an unchanged speed · Low output on left-sided support._
- **Story problems** (`content/storyProblems.ts`): two pairs that decouple the setting from the
  loading. On the suction section: the level raised for a suction alarm (a small gain, the alarm
  stays, the ventricle empties further) against volume for the same alarm (a larger gain, the alarm
  clears). On the durable-pump section: the speed raised for a low display and a high pressure (a
  small gain, the pressure climbs) against the resistance coming down (a larger gain, the pressure
  falls). Each is committed, then run on a separate copy of the circulation and read as four
  values. `story-problems.test.ts` derives every verdict from an engine run.
- **The map-answer rule** (`content/mapAnswerTargets.ts`): an identification is answered on the
  map only when every one of its answers is a place. Two qualify — where the right-sided pump
  returns its blood, and which side of the heart is limiting delivery — and the pins are a real
  radio group: each pin and each row is a label for the same hidden radio, numbered along the
  blood path, silent until the commitment and then marked in words.
- **Presentation before diagnosis** (`content/casePresentation.ts`): every Practice and Challenge
  case has a presentation title for the accordion and the pairing offered at the end of a section;
  the scenario's own title — the diagnosis — is for its debrief.
- **One door** (`content/pathwayResolver.ts`): the hub, the Learn landing and the accordion's "up
  next" resolve the first incomplete section through one function; the composition line and the
  five groups are derived from the registries at render.

## 4. The leak pass

The rendered scan (`stage-precommit-leak.rendered.test.tsx`) mounts every section on entry and at
the prediction step, removes only the answer control, and holds every text node, every prose
container re-split into sentences and every accessible name — hidden DOM included — to the
section's deny patterns and to the sentences of its keyed answers. Its first run found leaks on
seven of nine sections. What they became:

| Found                                                                                                                                                 | Fix                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 1's monitor showed the flow account whose contents were the prediction; its identification asked about the same account                       | The identification now reads the pressure (what question does it answer on its own); the flow account, its trend lines and the context-strip item are covered until the commitment, on the monitor and in the panel |
| The spine's aorta stop said what the balloon does not do — section 1's answer — on section 1                                                          | Stop cards render before the commitment only on the walk; elsewhere they wait, then fold                                                                                                                            |
| The common model and the eight pathway cards, folded in the teaching pane, said several sections' answers                                             | Not on the stage. They are on the hub, folded under Reference                                                                                                                                                       |
| The controls surface, mounted hidden, carried "High-power / thrombosis pattern" and "Placement state" before the prediction                           | The controls mount once the prediction is committed                                                                                                                                                                 |
| The map drew the right-sided pump's dashed path to the pulmonary artery while asking where it returns; the pin labels were outside the answer control | A pathway not in place is not drawn while a place is the question; the pins are marked as part of the answer control                                                                                                |
| Each panel's alarm band printed the engine's explanation ("Early inflation increases impedance…")                                                     | `AlarmBand` prints explanations only once disclosed                                                                                                                                                                 |
| Section 6's panel: the series paragraph and the right-sided pathway graphic at orientation                                                            | Both wait for the commitment; before it the panel says a second pump can be started and the map is where the question is answered                                                                                   |
| Section 7's panel: "computed from power and speed" in a value note, the dependency list, the afterload paragraph at orientation                       | All three wait; the note and the paragraph say the question is the section's                                                                                                                                        |
| Section 8's panel: the whole high-power account at orientation                                                                                        | Waits; before it a paragraph on what "suspected" means and where the module stops                                                                                                                                   |
| Section 3's on-screen sentence and starting context said "before the aortic valve has closed"                                                         | Reworded: the inflation is set early; the beats are banded                                                                                                                                                          |
| My own copy: "pathways in series carry one stream twice", "computed from power and speed" in a concept and an increment                               | Reworded to what the section asks rather than what it answers                                                                                                                                                       |

Three deny patterns were relaxed on the way, each because the pattern named a fact the section's
own question already gives: section 2 may say the balloon moves no blood (section 1 taught it);
section 3 may name "early inflation" (a category, not what it does); section 8 may name the
high-power pattern (its stem switches it on). The relaxations are commented in the specs.

**The option-length cue.** `stage-registries.test.ts` scores "pick the longest" across four item
families. Before this package the keyed answer was the uniquely longest option in every one of the
nine predictions and nine transfers and seven of nine identifications. Every label was rebalanced —
qualifiers moved into the post-commit rationales, distractors given equally specific wrong
reasoning — until neither "first" nor "longest" scores above chance plus a tenth. Ids are unchanged.

## 5. Copy edited in the contracts

- Section 1's identification: three new options about what a pressure answers on its own
  (ids `driving-pressure`, `blood-moving`, `organs-perfused`); its on-screen sentence and target
  sentence; its primary target is the arterial trace.
- Section 3's starting context and on-screen sentence (the two "before the valve has closed"
  phrases).
- The labels of 46 identification, prediction and transfer options (§4); no rationale, stem or
  explanation changed.
- The nine titles and three short titles, and three pathway descriptions that named the answer
  (sections 4, 5 and 8).

Every item keeps its `sme-review` status; the new items and the stories are `draft`.

## 6. One door, one map

The hub opens on two sentences, the composition line ("9 sections · 2 foundations · 3 mechanisms ·
3 applications · 1 integration · 114 min", counted at render), one Continue, and the pathway as
five groups — the common model, counterpulsation, the transvalvular pump, the durable pump,
choosing — each a disclosure holding its sections, its Practice cases by presentation and its
Challenge, the group holding the next section open. The three routes and the release review
follow. Everything that used to be the front door — the common model, the eight pathway cards, the
device cards, the comparison pathways, the two previews, the sources — is under a Reference heading,
each block folded. The Learn landing is the same door and the same map. `?device=<kind>` with no
section redirects to the track's first section.

## 7. Measured in the browser

Dev server on :3122, an emulated 1440×900 viewport (the Browser pane was hidden, so the numbers
are DOM reads, not screenshots), section 1 at its first step, then section 6 at its first step.

| Measure                   | Section 1, step 1                        | Section 6, step 1                                                                                        |
| ------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Visible controls          | 30 (none on the monitor)                 | 35                                                                                                       |
| Visible words             | 812 (569 outside the monitor)            | 739 (721 outside the monitor)                                                                            |
| Words under 13 px outside | 127 (kickers, badges, units, map labels) | 134                                                                                                      |
| Visible headings          | 3                                        | —                                                                                                        |
| Document scroll           | none (17 px residual, closed by #127)    | none                                                                                                     |
| Internal scrollers        | Simulator 650/1101, Steps 650/903        | Simulator 650/1880, Steps 650/795                                                                        |
| The map                   | —                                        | 567 px wide, labels 15 px, three pins, nothing lit, the right-sided pathway not drawn, first in the pane |

For comparison the old Learn at the same section opened on a phase stepper, an eight-item patient
context bar printing the congestion pattern, and three panes with the whole common model in the
teaching pane; the ECMO R4 drill after its rebuild measured 49 controls and 529 words.

Also driven in the browser before the pane went hidden: sections 1, 2, 3, 5 and 6 from Recognize
to a worked-through completion, the record written once to the same progress key; the identify
verdict "Correct." with the feedback; the covered flow account uncovering on the commitment; the
walk lighting each stop in turn with its caption; the seven-row sort marking each row; the map
answer chosen by its pin, marked "Your answer · correct" after the commitment, nothing lit before
it; the placement control highlighted and the position change enabling Continue; the transfer
patient loading; the hub's Continue resolving to section 2 once section 1 was worked, the group
holding it open.

The 17 px residual was the module header rendering 81 px against the 64 px the shared rule
reserved, the same as ECMO's. It is **closed by PR #127** (the mechanical-ventilation rebuild),
which sizes the activity shells to a real `--site-header-height` token instead of a hardcoded
`4rem`; measured again on a test merge of that main, the document does not scroll at all. Scrolling the simulator pane to
the map, the ECMO approach, could not be made to land here: the monitor above it re-flows for
seconds after a step is entered and its alarm band changes height with the ticks, so a step that
opens the map now leads with it — the map above the monitor, at the top of the pane — and the
pane starts at its top on every step. One document-overflow defect was
found and fixed on the way: a visually hidden label inside a tall shared teaching component was
absolutely positioned against the page and gave the document five thousand pixels of scroll below
a shell that was the right size; each pane's content is now positioned, so the pane contains it.

## 8. What the tests pin

New suites under `src/features/mechanical-circulatory-support/__tests__/`:

- `stage-walkthrough.test.tsx` — every section from its first step to a worked-through completion
  through the interface: the gate, the stated verdicts (correct, not correct, unsafe), the action
  predicate satisfied by a visible control, the before-and-after table, the sort, the transfer
  patient, the one record written once, Back, the folded sources flipping on the commitment, help,
  the answer rotation, the teaching preview, the completion card's router push, the pairing copy,
  the later-phase mount.
- `stage-precommit-leak.rendered.test.tsx` — the composed document at two moments (§4), the step
  list locked past the prediction, the map silent on the place questions, the monitor's causality
  and target text withheld, the flow account covered, and a self-check that the deny set fires on
  the keyed answers.
- `stage-precommit-leak.test.ts` — the same surfaces read from the registries; one title per
  section across the four registries; no digit in any pathway title; no diagnosis in a title.
- `stage-registries.test.ts` — the specs validator and eight ladder defects it refuses; the spine,
  the panel, the sort, the increments, the map-answer rule; one door for a fresh, a returning and a
  finished learner; the groups flattening to the order; presentation before diagnosis; stage sources
  complete; the answer-order scoring.
- `support-grammar.test.ts` — every engine claim run; the serial rule; no numbers in the copy.
- `story-problems.test.ts` — the registry and the engine agreeing with every verdict.
- `circulation-map.test.tsx` — the geometry, the drawing per mechanism, the emphasis, the answer
  as a radio group from pin and row, silence before and marking after the commitment, the hidden
  pathway while a place is the question.
- `one-door.test.tsx` — the hub and the landing.

Removed with the old Learn: `m2-m3-requirements`, `m5-learn-integration`, and the Learn arms of
`components`, `m4-teaching-panels`, `m5-module-surfaces`, `m5-controls-and-surfaces`,
`m5-workbench-routing`, `m5-persistence-analytics`, `m5-context-bar-consistency`; the clinical
distinctions those suites pinned are re-pinned against the registries and the engine in
`clinical-distinctions.test.ts`. The route test follows the new Learn route.

Also green: `critical-care/__tests__/learner-copy` (the 17-term scan over every `.tsx` under the
module's components), `catalogs`, `accessibility`, `criticalCareShellConvergence`,
`hub-pathway-start-alignment`, `release-boundary`, `derived-value-guides`, `clinical-thresholds`,
`dashboard`; `npx tsc --noEmit`; `npx eslint` over the module; the two MCS harnesses
(`review-mcs-section-contracts.ts`, `render-mcs-teaching-panels.ts` — 45 rendered states, 0 flags).

## 9. Deliberately not done

- Practice and Challenge on the lean shell. They keep `McsWorkbench` and the case workflow; the
  hub names their cases by presentation, and a section's completion card offers its paired case.
- Micro-cases after each mechanism.
- Re-pointing the ECMO module at the shared stage package.
- The 3D anatomy view stays behind its launch gate as the third simulator surface, unmounted while
  closed; nothing on the stage points into it.
- Localisation; subject-matter review of anything carrying `draft` or `sme-review`.
- The PAPi engine limitation, unchanged and still recorded in `mcs-model-limitations.md`.

## 10. Open for the owner

- Section 2's Act step selects three mechanisms in turn from the Now card; the walk before it is
  the section's real interaction. Whether the walk should also carry a "try one thing at each stop"
  control is a design call.
- The stage is dark and the hub is light. The ventilation rebuild took the whole module dark; this
  one left the hub as it was.
- The word count outside the monitor on section 6's first step is high because the section's live
  panel is long; folding it to its first block on every step before the commitment (the ECMO
  preview rule) is in place, and the rest is one control away.
