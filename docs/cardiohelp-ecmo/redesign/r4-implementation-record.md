# R4 — the flow rebuild: what shipped

What R4 adds, the decisions as taken, what was measured before and after, what the tests pin, and
what was deliberately not done. The approved plan
(`~/.claude/plans/please-review-the-ecmo-squishy-fairy.md`, mirrored in the increment list below) is
the scope statement; the owner decisions are in [`r4-owner-decisions.md`](./r4-owner-decisions.md)
and the engine corrections in [`r4-scoring-honesty-record.md`](./r4-scoring-honesty-record.md).

Base: `origin/main` at `42dcea42` (R3 = PR #117). Branch `claude/ecmo-9-3`, sixteen commits, one per
increment. Prompted by a learner's written feedback on the sibling critical-care labs — too many
controls at once, an inert phase bar, a hidden objective, a dead Help button, small text, references
that could not be opened — read against the `medical-education-modules` teaching standard.

---

## 1. What R4 adds

| Increment             | Commit                 | What it is                                                                                                                                                                                                        |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I0 session core       | `3ff4a9b8`             | `session/useEcmoSessionCore.ts`, `session/ecmoSessionAnalytics.ts`, `components/useAlarmAudio.ts`: the simulation session lifted out of the workbench, payloads pinned byte-identical                             |
| I2 citations          | `a6968756`             | `content/evidenceResolver.ts`, `components/evidence/EcmoSourceList.tsx` + `EcmoCitation.tsx`: one citation surface with class badge, claim scope, open link, copy; five raw-id surfaces replaced; DOIs registered |
| I3b content shape     | `df2f09a7`             | `content/controlPanel.ts`, `drillSpecs.ts` (knob strip + grammar row + deny patterns per drill), `sectionSpecs.ts` (one concept, one discrimination, prerequisites per section), `trackIncrements.ts`             |
| I3c answer order      | `f73d98b7`             | `content/choiceOrder.ts`: deterministic per-item rotation; best labels trimmed so length is at chance                                                                                                             |
| I1a drill stage       | `288a86e7`, `7ec47151` | `components/stage/` and `components/shell/`: one step list, one Now card, per-step surface disclosure, Sections drawer, data-driven Explain for all twenty drills                                                 |
| I3a ladder            | `7ec744c7`             | Every pathway row, lesson title, objective, minute, observe step, transfer step and unit renamed by presentation; `learn-precommit-leak.test.ts`                                                                  |
| I1b/I1c foundations   | `84c562d9`             | `FoundationStageHost` puts the ten foundation sections on the same stage; the old Learn workspace, player and step teaching deleted; Learn suites rewritten on `test-support/learnStageHarness.tsx`               |
| I4 Practice/Challenge | `98c7676a`             | `components/practice/`: connected activity + props view, five-stage progression, Now card per stage, surfaces per stage, Case options disclosure, clues behind Help, masking by mode, `EcmoCaseDebrief`           |
| I3e one door, one map | `89d23adc`             | Hub accordion opened in place, Learn landing on the same map, control-panel moment and two story problems on `blood-flow-versus-sweep`                                                                            |
| I5 rationales         | `62fd0d32`             | 126 authored + 9 fallback reassessment rationales, shown only in the debrief                                                                                                                                      |
| I3f/I3g               | `f9e8b0d5`             | Mechanism pairing with an honest next-in-unit fallback; capstone matrices quote the grammar rows                                                                                                                  |
| I6 scoring honesty    | `544b8932`             | The nine lifted defects, corrected in the engine with `scoring-honesty.test.ts`                                                                                                                                   |
| I5 presentation       | `3bd0f432`             | Presentation titles for 14 cases and 2 capstones, discrimination objectives, B6-003/B6-015 copy, penalty registrations                                                                                            |
| I3d rendered scan     | `7ee8bf39`             | `learn-precommit-leak.rendered.test.tsx` over all twenty drills at two moments, and the component leaks it found                                                                                                  |
| I7 records            | this commit            | This file, the owner-decision and scoring records, the D-5 baseline, the B6 banner, the navigation-competence check on the participant sheet, the per-step teaching preview on foundations                        |

Untouched: route paths and the `?lesson/?track/?case/?phase` names; scenario, section and activity
ids; the progress key `cardiohelp-ecmo-progress-v1` and envelope v2; the module nav titles and the
activity-frame CSS contract; the 3D assets; draft PR #94; the other critical-care labs.

## 2. Decisions taken during implementation

Recorded in `r4-owner-decisions.md`. Two that changed on contact with the code: Practice's Manage
stage now completes when the case's required work is done rather than at the first corrected
fault (an initiation case's readiness check used to end a stage the learner was still in), and the
foundation teaching column shows only its first block before the prediction is committed, with one
control to show the rest (the R4 baseline measured a teaching pane holding twelve screens).

## 3. Measured before and after

Dev server `claude-worktree` on :3120, viewport 1440×900, first step of each surface (Practice at
its Brief stage), DOM probe: visible interactive controls, visible words, words under 13 px, visible
headings, internal scrollers. The console facsimile is a scaled device and is exempt from the type
floor; the "outside console" columns exclude it. Closed `<details>` content is not counted.

| Surface                                           | Controls (all / outside console) | Words (all / outside) | Words < 13 px | Words < 14 px outside console                           | Headings | Document scrolls                                                              |
| ------------------------------------------------- | -------------------------------- | --------------------- | ------------- | ------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Drill `preload-drainage-collapse` — before        | 91                               | 1075                  | 777           | —                                                       | 13       | two 441 px panes holding 3111 / 1120 px                                       |
| Drill — after                                     | 49 / 29                          | 529 / 380             | 148           | 60 (kickers, badges, step-phase labels, SVG map labels) | 7        | no; Simulator 647/2190, Teaching 647/3996, Steps 647/744                      |
| Foundation `circuit-flow-path` — before           | 93                               | 2595                  | 536           | —                                                       | 18       | two 678 px panes holding 3705 / 8713 px                                       |
| Foundation — after                                | 51 / 31                          | 452 / 303             | 134           | 46                                                      | 5        | no; Simulator 635/2823, Teaching 635/3691 (first block + walk), Steps 635/692 |
| Practice `clinical-vv-occult-hemorrhage` — before | 75                               | 1140                  | 800           | —                                                       | 15       | one 560 px viewport holding 4699 px                                           |
| Practice — after                                  | 47 / 27                          | 373 / 221             | 107           | 16                                                      | 4        | no (after the §7 fix); Case workflow 636/902, Simulator 636/2612              |

Every word under 14 px outside the console is a kicker, a badge, a step-phase label or an SVG
label on the circuit map; no sentence of teaching or task copy is below the floor.

## 4. What the tests pin

Protected scope (`npx jest src/features/cardiohelp-ecmo src/features/critical-care
src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' --runInBand`): 100 suites, 2348
tests at `7ee8bf39`; baseline was 88 suites, 1848. New contracts: `session-core`, `evidence-surface`,
`control-panel`, `drill-specs`, `section-specs`, `choice-order`, `learn-precommit-leak` (content)
and `.rendered` (twenty drills on the real stage), `story-problems` (verdicts derived from engine
runs), `hub-accordion`, `drill-stage-pairing`, `reassessment-rationales`, `scoring-honesty`, plus
the rewritten Learn suites, the Practice suites against `EcmoPracticeCaseView`, and the foundation
suites against `FoundationStageHost`. `npm run type-check`, `npm run lint` (0 errors), `npm run
test:a11y` (16/16) and `npm run render:ecmo-teaching` (16 panels, 83 rendered states) pass.

## 5. Deliberately not done

- Two-minute micro-cases after each mechanism (`content/microCases.ts`).
- Practice cases for `va-lv-loading`, `va-acute-hypercapnia`, `va-gas-source-interruption` (unit
  `va-5-lv-loading-gas` has none; the pairing map records the gap).
- Porting the fourteen held PR #94 panels as deeper content.
- Re-mapping transfer steps to same-principle scenarios (needs Practice-case runtimes inside Learn).
- Generalising the lean shell to the other critical-care labs the learner reviewed.
- Localisation: the module stays English-only with the reviewed-English fallback note.
- Two operable control labels that name their action pre-commit ("Perform tip-to-tip circuit and
  sensor check", "Restore verified gas source") are owner decisions left open and pinned by the
  rendered scan.

## 6. Limitations still true

The engine is a bounded teaching model: every drainage-limited cause resolves through one action,
PaCO₂ responds to sweep as a straight line, the venous-estimate outlet saturation and its two-per-
second rate are authored, and recognition-only faults stay active because the treatments that would
change them are not simulated. The dev worktree has no Supabase environment, so analytics posts
return 500 there; the client tolerates it. Every reworded item carries `reviewStatus: 'draft'` and
waits for subject-matter review before the next human round.

## 7. Verified in the browser

The Learn stage does not scroll the document at 1440×900 (`window.scrollY` stays 0 after a forced
scroll; the three panes scroll internally). The Practice page was found to scroll by about 1400 px
on first measurement: the surfaces contain absolutely positioned labels whose containing block was
the page, so they escaped the column's clip and gave the document a scrollable overflow. The two
Practice columns are now `position: relative` (the containing block is the scroller) and the
document's scroll height equals its body again. A residual 17 px remains on every module route:
the frame sizes its activity mode to `100dvh − 4rem` while the site header measures 81 px — a
module-frame constant outside R4's scope, recorded here rather than papered over.

Keyboard: the step list, Sections drawer, surface disclosures and clamp controls are reachable and
operable with Tab, Enter and Escape (drawer), pinned by the stage suites and the a11y suite. The
preview pane cannot screenshot this module reliably and suspends requestAnimationFrame, so
computed-style and DOM reads are the evidence, as in R3. The dev worktree has no Supabase
environment, so `/api/analytics` posts return 500 there; the client tolerates it and the first
request through the auth proxy can redirect — the probe re-ran the affected page.
