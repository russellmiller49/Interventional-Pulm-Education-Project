# Flow redesign — validation and instructor handoff

Baseline: `origin/main` at `2b10cb6a`, with the PR #192 onboarding/progression repairs already present. Branch: `codex/branch-tracing-flow-redesign`. Validation ran locally with Chromium/Playwright and real native PNGs. No deployment, merge, production fixture, upload, source export or Slicer operation was performed.

## Executed checks

| Command                                                                                                                                                    | Result and evidence                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --runInBand src/features/bronchial-branch-tracing` before editing                                                                             | 8 suites, 42 tests passed; 1 existing access assertion failed. Log: `/tmp/branch-flow-baseline-tests.log`.                                                                                                                                                                 |
| `npm test -- --runInBand src/features/bronchial-branch-tracing` after implementation                                                                       | 9 suites, 50 passed; the same 1 baseline access assertion failed. No new failing assertion. Log: `/tmp/branch-flow-tests-final.log`.                                                                                                                                       |
| `npm test -- --runInBand src/features/bronchial-branch-tracing/__tests__/flow-contracts.test.ts`                                                           | 9 passed. Registry/history, source provenance, complete local topology, returning-plane selection, native display preservation, source-bound history and recovery of incompatible/damaged drafts. Log: `/tmp/branch-flow-contracts-final.log`.                             |
| `npm run type-check`                                                                                                                                       | Passed. Log: `/tmp/branch-flow-types-complete.log`.                                                                                                                                                                                                                        |
| `npx --no-install eslint src/features/bronchial-branch-tracing e2e/branch-tracing.spec.ts scripts/branch-tracing/flow-coverage.ts`                         | Passed, no warnings. Log: `/tmp/branch-flow-lint-complete.log`.                                                                                                                                                                                                            |
| `npm run build`                                                                                                                                            | Passed through embedded trainer builds, content generation, critical-care and cardiac asset validation, optimized Next build and standalone preparation. Log: `/tmp/branch-flow-build-final.log`. Existing dependency/chunk-size and missing metadataBase warnings remain. |
| `npx --no-install next build --webpack` then `npm run prepare:standalone` after the final enlarged-text repair                                             | Both passed on the final application code. Logs: `/tmp/branch-flow-next-final.log`, `/tmp/branch-flow-prepare-final.log`.                                                                                                                                                  |
| `npx --no-install tsx scripts/branch-tracing/flow-coverage.ts --check`                                                                                     | Matches all 9 runtime registry entries. No asset generation involved.                                                                                                                                                                                                      |
| `BRANCH_TRACING_BASE_URL=http://127.0.0.1:3146 npx --no-install playwright test --config=playwright.branch-tracing.config.ts`                              | 22 passed, 1.2 minutes. Log: `/tmp/branch-flow-browser-complete.log`.                                                                                                                                                                                                      |
| Same Playwright command with `--grep 'short route'` after keeping the map heading visible                                                                  | 1 passed. Log: `/tmp/branch-flow-map-final.log`.                                                                                                                                                                                                                           |
| Same Playwright command with `--grep 'complete Learn\|coached Practice\|Assess withholds\|native marks\|opening journey'` after route-action/layout polish | 5 passed. Log: `/tmp/branch-flow-route-polish.log`.                                                                                                                                                                                                                        |
| Same Playwright command with `--grep '200 percent\|opening journey\|actual pointer'` after enlarged-text and label placement repair                        | 3 passed. Log: `/tmp/branch-flow-accessibility-final.log`.                                                                                                                                                                                                                 |
| `git diff --check`                                                                                                                                         | Passed.                                                                                                                                                                                                                                                                    |

The unchanged baseline failure is `src/features/bronchial-branch-tracing/__tests__/contracts.test.ts:201`: the expectation that `isPublicPath('/airway-anatomy/case-001/case_manifest.json')` is false conflicts with the existing helper returning true. The auth/helper, assertion, route files and release configuration were not modified. Canonical module pages, unprefixed locale redirect, Spanish and Chinese locale routes retain anonymous access and both header/meta noindex behavior in the browser checks.

The rewritten browser tests exercise the task grammar rather than obsolete pane switching or removed action labels. Early test-harness failures came from an invented `/en/branch-tracing` URL, expecting a reference mark while the debrief still displayed its starting slice, and a warm-up continuation label that changes after a visit. Those checks were corrected to the actual routes, source response plane and returning-learner control. An isolated preview restart was also needed after replacing its initial source symlink with a copied source tree, so Next discovered the unchanged proxy. These were not fixed by changing access or answer behavior.

## Real browser journeys

The 22-test suite covers:

- Canonical Overview/Learn/Practice/Assess, locale redirect/aliases and fresh Start.
- Both warm-up intervals in standard axial; mark and uncertainty; comparison and reload; next link to the new orientation bridge.
- Fixed same-image reference/comparison, patient-direction labels, observer explanation, incorrect “bronchoscopic image” response, blocked progression, repeat/reset and saved transformed-state restoration.
- First coached bifurcation/parent relationship, followed by a different local continuity interval and independent opening response.
- Each of the four pattern lessons: its own rendered teaching, daughter/course responses, guided first parent relationship, second source interval and completion.
- Caudal approach prelude, all three connected LB6 divisions, map growth with uncertainty, and read-only previous-division review without changing history.
- Complete Learn: every fork, distal approach, target-inspection gate, full comparison, second route and manual Finish.
- Coached Practice: default single route, immediate junction feedback, target gate, debrief/export, retry marked as supported, and read-only inspection of the preserved first response.
- Assess: four complete routes, reload before recording the first interpretation, no reference marks/model continuation/camera shortcuts before submission, and post-submission CT debrief.
- Failed native image/retry and denied storage/leave-without-saving; failed nodule patch and recovery; recoverable WebGL loss in the optional explorer.
- Native mark preservation across display operations, magnification and reload; actual pointer round trips on an off-center mark in all eight rotation/reflection combinations, including expanded viewing.
- 1440×900, 1280×720, 1024×768, 768×900, 390×844 and 1280×640 layouts; keyboard slice/marking, 200% text, manual stepping and reduced motion. No horizontal document overflow was observed in the exercised states; native image width was checked above 260 px.

Jest also retains source-image/hash/HU-window, graph, nodule registration, camera basis and inverse-coordinate tests. No shared API/style changed, so no additional sibling-module visual regression is claimed. The production build still exercises the existing embedded trainers and shared asset validators.

## Screenshot evidence and visual inspection

Screenshots are local review artifacts in `/tmp/bronchial-flow-evidence`; the Playwright suite regenerates them. Source inputs and renders were not added to Git. The following images were inspected, not merely created:

| Evidence                                                                                            | State and finding                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-standard-full-field.png`                                                                        | 1280×720 fresh full chest, supplied trachea locator, standard R/L/A/P, explicit Focus action.                                                                                                 |
| `02-same-lumen-comparison.png`                                                                      | Recorded local selection/uncertainty with native comparison and optional retry.                                                                                                               |
| `03-observer-reference.png`                                                                         | Identical source slice/crop on both copies, fixed patient schematic, opposite declared observers, clear primary reflection action.                                                            |
| `04-negative-comprehension.png`                                                                     | Standard reference stays fixed; reflected labels move with comparison; misconception feedback and disabled application action.                                                                |
| `05-restored-transform.png`                                                                         | Restored display notice and reflection preserved before continuing.                                                                                                                           |
| `06-guided-parent-relationship.png`, `horizontal-horizontal-parent-pair.png`                        | CT and explicitly oriented parent schematic together; first relation is labeled guided.                                                                                                       |
| `short-route-map-1.png` through `short-route-map-3.png`                                             | Map grows only after recorded divisions; current division, siblings, unresolved learner choice and model continuation are distinct. Map has its own scrolling surface and persistent heading. |
| `complete-route-comparison.png`, `practice-debrief.png`, `independent-debrief.png`                  | Full-route comparison and supported/independent debriefs on native CT.                                                                                                                        |
| `marking-1280-720.png`, `marking-390-844.png`, `text-200-percent.png`, `text-200-percent-image.png` | Native image, labels and response controls remain usable. Laptop warm-up image is roughly 355 px square with Check beside it; narrow screens use document flow.                               |

The visual pass corrected a buried short-route map, clipped viewer heading after phase changes, tiny observer text, overlapping model/learner mark captions, and a full-route primary action buried beneath feedback. It also found that 200% text could clip the working area despite passing a horizontal-overflow assertion. ModuleFrame now detects actual text enlargement and switches this module to document flow; a feature-scoped rule lets the site header scroll away while this enlarged module is mounted. Shared files and other modules' defaults are unchanged. Long references and earlier examples remain disclosures. Optional virtual bronchoscopy is opened by the learner during route work; compatible saved view choices are honored.

## Reproduce locally and review all nine lessons

Use the existing worktree dev command (`npm run dev:codex`, port 3110) when that port is available. The unchanged bundled trainers can be built with the normal build command. Do not stop another worktree's server to run this review.

For this task, the already running 3110 server was left alone. A copied source tree at `/tmp/bronchial-flow-review` served the changed module on 3146, using existing public assets/dependencies and disposable local environment placeholders. No real Supabase service was used. The preview command was:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-review-placeholder \
  node node_modules/next/dist/bin/next dev --webpack --port 3146
```

Run that command from the isolated preview directory, not concurrently in an already running checkout. A regular configured dev server can be used instead by changing `BRANCH_TRACING_BASE_URL`. The committed Playwright config and lesson URLs are unchanged.

| Review                     | Local URL                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Overview                   | [Open course](http://localhost:3146/en/learn/anatomy/branch-tracing)                                              |
| Same lumen                 | [follow-one-airway](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=follow-one-airway)         |
| Observer/display bridge    | [orientation](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=orientation)                     |
| Local bifurcation          | [continuity](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=continuity)                       |
| Craniocaudal pattern       | [vertical](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=vertical)                           |
| In-plane relationship      | [horizontal-horizontal](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=horizontal-horizontal) |
| RB5 relationship           | [horizontal-vertical](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=horizontal-vertical)     |
| Oblique/region comparison  | [horizontal-oblique](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=horizontal-oblique)       |
| Short connected map        | [orientation-changes](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=orientation-changes)     |
| Complete route/uncertainty | [variants-limits](http://localhost:3146/en/learn/anatomy/branch-tracing/learn?lesson=variants-limits)             |
| Coached route              | [Practice](http://localhost:3146/en/learn/anatomy/branch-tracing/practice)                                        |
| Independent worksheet      | [Assess](http://localhost:3146/en/learn/anatomy/branch-tracing/assess)                                            |

Start with empty module storage or a private browser context for fresh-entry review. For resume review, record a response, transform the CT, use Save & exit and reopen the same lesson/route selection. Compare native marks and first responses before and after; a layout or display operation must not write another attempt.

## Checks not performed

Faculty lumen/wall annotation, clinical opening-position approval, additional anatomical variant authoring, unfamiliar-patient evaluation, a first-time learner study and an educational-outcome study remain unexecuted. The source manifest names these gaps individually. Real-device mobile testing, a complete screen-reader walkthrough and a cross-browser Safari/Firefox matrix were not performed. Keyboard/reflow/reduced-motion and scoped axe checks establish only the exercised software behavior. No clinical accuracy, navigation competence or diagnostic-yield claim follows from this validation.

## Exact changed paths

The implementation path list below is generated from the reviewed Git diff and untracked additions before staging. Source CT/graph assets, route/access configuration, shared-stage files, dependencies and unrelated features are absent.

<!-- changed-paths -->

```text
docs/bronchial-branch-tracing/README.md
docs/bronchial-branch-tracing/architecture-decision.md
docs/bronchial-branch-tracing/flow-coverage.json
docs/bronchial-branch-tracing/flow-redesign-validation.md
docs/bronchial-branch-tracing/flow-redesign.md
docs/bronchial-branch-tracing/instructional-update.md
docs/bronchial-branch-tracing/module-brief.md
e2e/branch-tracing.spec.ts
scripts/branch-tracing/flow-coverage.ts
src/features/bronchial-branch-tracing/__tests__/branch-decisions.test.ts
src/features/bronchial-branch-tracing/__tests__/flow-contracts.test.ts
src/features/bronchial-branch-tracing/__tests__/lesson.test.tsx
src/features/bronchial-branch-tracing/__tests__/local-lesson.test.tsx
src/features/bronchial-branch-tracing/__tests__/local-session.test.ts
src/features/bronchial-branch-tracing/__tests__/native-ct.test.ts
src/features/bronchial-branch-tracing/__tests__/orientation.test.ts
src/features/bronchial-branch-tracing/components/BranchTracingLesson.tsx
src/features/bronchial-branch-tracing/components/BranchTracingOverview.tsx
src/features/bronchial-branch-tracing/components/BranchTracingPractice.tsx
src/features/bronchial-branch-tracing/components/CourseOutline.tsx
src/features/bronchial-branch-tracing/components/CtBranchMap.tsx
src/features/bronchial-branch-tracing/components/CtOrientationTeaching.tsx
src/features/bronchial-branch-tracing/components/CtRouteAttemptHistory.tsx
src/features/bronchial-branch-tracing/components/CtRouteWorkspace.tsx
src/features/bronchial-branch-tracing/components/CtViewpointComparison.tsx
src/features/bronchial-branch-tracing/components/LocalCtLesson.tsx
src/features/bronchial-branch-tracing/components/ModuleFrame.tsx
src/features/bronchial-branch-tracing/components/NativeCtViewer.tsx
src/features/bronchial-branch-tracing/components/branch-tracing.module.css
src/features/bronchial-branch-tracing/content/ct-types.ts
src/features/bronchial-branch-tracing/content/lessons.ts
src/features/bronchial-branch-tracing/content/local-exercises.ts
src/features/bronchial-branch-tracing/content/local-teaching.ts
src/features/bronchial-branch-tracing/engine/ct-draft.ts
src/features/bronchial-branch-tracing/engine/ct-session.ts
src/features/bronchial-branch-tracing/engine/local-draft-migration.ts
src/features/bronchial-branch-tracing/engine/local-session.ts
src/features/bronchial-branch-tracing/engine/practice-draft.ts
src/features/bronchial-branch-tracing/engine/progress.ts
src/features/bronchial-branch-tracing/engine/route-draft.ts
src/features/bronchial-branch-tracing/geometry/paired-scope.ts
```
