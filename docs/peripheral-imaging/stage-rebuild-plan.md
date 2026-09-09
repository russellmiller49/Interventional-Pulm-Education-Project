# Peripheral imaging course — the module's form on the shared lesson stage

Round 1, 2026-09-08. Branch `claude/fluoroview-stage`, stacked on the draft
(`codex/peripheral-imaging-course`, PR #136). The owner's verdict on the draft: content and
physics strong; the structure must match the critical-care modules, and the 3D must show how each
technology works. This document records the form Claude built. The imaging suite and its assets
are Codex's track, briefed in [codex-3d-brief.md](codex-3d-brief.md); the two meet at
`components/suite/types.ts`.

## What changed, in one paragraph

The single-column course shell (`PeripheralImagingCourse`) is gone. Every section now runs on the
shared lesson stage (`src/features/learning-module/stage/`, never edited here) with the same three
panes, order, widths and floors as ECMO, MV, MCS and hemodynamics: **Steps | Teaching |
Simulator**. Each section walks **Recognize → Predict (commit) → Act → Observe → Explain →
Transfer**; the suite's controls are locked until the prediction is committed; the verdict is
stated in words on the card; the record keeps first decisions as made and never a step index.
The module has one hub, one door, one map, and Learn / Practice / Assess routes under
`/peripheral-imaging`. The spine is the **imaging chain** — source → beam → patient → detector →
reconstruction and registration → display and decision — captioned in words on every step and
lit one stop at a time; two sections (`chain-walk`, `good-image`) were added so the chain and the
five things a learner can change are taught before any technology is. `radial-ebus` (the third
new section) waits on Codex's view (round 3).

## Decisions

| #   | Decision                                                                                                                                                                                                                                                               | Why                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Nested routes `peripheral-imaging/{page,learn,practice,assess}`; `/learn?section=<id>`; `/assess`                                                                                                                                                                      | Same shape as the critical-care modules.                                                                                                                                                                                                                                                                                                |
| 2   | The course lives at `/peripheral-imaging`, not `/fluoroview`, and is gated as a module in development: direct link, noindex, absent from navigation, search and the sitemap (`content/release.ts`, `site-auth/access.ts`, `draft-modules.ts`, `non-public-modules.ts`) | Owner decision, 2026-09-09: the original FluoroView simulator keeps its route until this course is ready to replace it. A separate prefix also avoids `/fluoroview`'s route-and-asset-root collision, so no locale-bypass exemption is needed — the course's own assets all carry a file extension, which is what the redirect keys on. |
| 3   | No entry in `learning-module/moduleRoutes.ts`; the nav base lives in `content/routes.ts`                                                                                                                                                                               | `moduleRoutes.test.ts` pins its exports to eight prefixes.                                                                                                                                                                                                                                                                              |
| 4   | `HandoffContent` dropped from the four routes; `generateMetadata` keeps `localizeHandoffServerValue`; non-English locales get the reviewed-English note                                                                                                                | The handoff clones every element per render and translates only registered ids; none of the course copy is registered.                                                                                                                                                                                                                  |
| 5   | Commitments and lab values are never persisted mid-section; a reload restarts the section at step 1; first attempts are written once at commit                                                                                                                         | The ECMO rule the critical-care modules share. `module-plan.md` §Completion amended.                                                                                                                                                                                                                                                    |
| 6   | `suite-cases` keeps its id as the last Learn section (an attribution sort); its eight decisions moved to Assess as the capstone                                                                                                                                        | Ids stay stable for the record migration; first attempts are not spent in Learn.                                                                                                                                                                                                                                                        |
| 7   | Module-local record (`ip-peripheral-imaging-v2`, zod-strict, correctness recomputed from the item bank at parse); the v1 record is migrated once and left in place                                                                                                     | Not registered in any critical-care catalog or sync.                                                                                                                                                                                                                                                                                    |
| 8   | Pane options byte-identical to the four adopters                                                                                                                                                                                                                       | Owner rule from the MV round.                                                                                                                                                                                                                                                                                                           |
| 9   | Teaching-block details are after-commitment content and are not in the document until the prediction is committed                                                                                                                                                      | The rendered leak scan found two details (projection, dts-interpretation) that named the answer inside a collapsed disclosure.                                                                                                                                                                                                          |
| 10  | The projection section's Observe goal is a state goal (separation ≤ 0.5 mm), not the overlap event                                                                                                                                                                     | The event fires on the first tick of the orbit slider during the Act, so an event goal was met before the step began.                                                                                                                                                                                                                   |

## Registries (all validate at import)

`content/pathway.ts` (the only ordering authority; nineteen sections today, twenty with
`radial-ebus`), `imagingChain.ts` (six stops, `chainCaption`), `controlPanel.ts` (five things you
can change + the learner-copy gate), `grammar.ts` (the one table), `sectionSpecs.ts`,
`labGoals.ts`, `sorts.ts`, `chainAnswerTargets.ts`, `stageItems.ts` (the draft's items as
`ClinicalLearningItem`s, `reviewStatus: 'draft'`), `stageLessons.ts` (steps, `lookIn`, the
authored leak scan), `cases.ts` (the capstone), `pathwayResolver.ts` (the one door).
`engine/labMetrics.ts` holds every readout formula once; `labGoalEvaluation.ts` the goals,
invalidation and history events; `stageSession.ts` the reducer; `learnProgress.ts` the record.

## The seam with Codex

`components/suite/types.ts` is the contract (Claude-owned): `SuiteViewSpec`, `SuiteInputs` keyed
1:1 to the lab controls, `ChainAnswer`, the DOM data-attribute contract, `controlElementId`.
`ImagingSuitePane.tsx` switches on `SUITE_MODES_READY`: a mode Codex has landed renders
`SuiteScenePane`; every other mode renders `SuiteFallback` — the draft's 2D lab body inside a
disabled fieldset under the chain caption strip and, when a step asks for it, the chain answer
fieldset. The flow tests run on `test-support/SuiteTestDouble.tsx`, a DOM-only pane, so nothing in
Claude's track depends on WebGL.

## What is verified

- `npx jest src/features/peripheral-imaging 'src/app/\[locale\]/peripheral-imaging' src/i18n/locale.test.ts --runInBand`
  — registries, stage lessons, items, lab metrics against `physics.ts`, session and invalidation,
  record v2 + v1 migration, case standard, the stage-host walk (a lab section, a chain-answered
  section, a sorted section, every section to its commitment), the rendered pre-commit leak scan,
  the pathway resolver, the hub (one door, jest-axe), the routes, the locale bypass.
- `npx eslint src/features/peripheral-imaging src/app/\[locale\]/peripheral-imaging e2e/peripheral-imaging.spec.ts`
  and `npx tsc --noEmit -p tsconfig.json`.
- `PERIPHERAL_IMAGING_BASE_URL=http://localhost:<port> npx playwright test -c playwright.peripheral-imaging.config.ts`
  — the door, a sorted section to its record, a lab section's lock/goal/reload, the capstone
  standard with one wrong critical decision, the compact layout.
- Browser walk on the dev server (see [validation.md](validation.md)).

## Practice, added 2026-09-09

Sixteen micro-cases in `content/microCases.ts`, one per mechanism and application section and a
second for the three that fill two rows of the diagnostic table. `ImagingCaseActivity` plays one;
the Practice landing lists them in pathway order behind one door; each section's completion card
points at its own case. First decisions are written once under `practice:<id>` and never
rewritten, but a case can be answered as often as the learner likes — that is the difference
between this layer and the capstone. The registry validates at import like every other, and adds
a cueing guard of its own: the keyed choice may not run more than a quarter longer than the
longest distractor. See [validation.md](validation.md) for how the cases were authored and
reviewed.

## Still to do

- Round 2: Codex's views land per `SUITE_MODES_READY`; the hub hero takes the `room` scene.
- Round 3: `radial-ebus` copy, items and sources — waiting on Codex's `rebus` view for the lab, and
  on the owner's metadata check of the four new sources.
- Owner items: when to retire the original FluoroView simulator (`src/components/fluoroview/`) and
  hand `/fluoroview` to this course;
  retire `fluoroview-carm.glb`; nodule density; metadata check of the four new sources; SME
  review of every `draft` item; learner piloting of the time estimate.
