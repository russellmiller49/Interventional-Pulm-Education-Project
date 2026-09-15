# MCS-01 — Open mechanism exploration and optional cases

The [SHARED-01 follow-up](#shared-01-follow-up--2026-09-15) records the current
integration scope and validation for PR #217. Earlier sections retain the original
MCS-01 implementation evidence.

## Scope and implementation brief

The owner's MCS-01 prompt and v2 `LEARNING_DESIGN_BRIEF.md` authorize self-paced
learning across MCS Learn, Practice, and the existing Assess URLs. Questions teach
named mechanisms; they do not establish competence. All 9 lessons, 68 authored
tasks, 9 guided cases, and 3 former capstones retain their stable IDs. Former
capstones are optional integrated walkthroughs.

Started clean on `codex/mcs-01` at `3cacff099967a7f3bb5cfa8b818460f1c939bdc9`,
equal to `origin/main`. MCS matched the historical prompt baseline
`9ef04539118b889a344992c63ba35808ee477f0e`; newer repository work was preserved.
Reference: `docs/critical-care/mcs-flow-redesign.md` and its recorded assessment
limitations. This task changes access, teaching presentation, and local progress;
it does not recalibrate physiological models or update clinical recommendations.

The existing stage, NowCard, workbench, monitor, waveform engine, anatomy,
references, authored cases, and task controls are reused. Learn offers the full
task map, optional comparisons, Hint, Show explanation, retry, and Continue.
Supported exploration is available beside recommended task controls. Case
explanations can open with no answer or performed action. Actual captures require
actual model observation; authored examples are explicitly labeled.

Progress boundary: append only location/visited fields in a `selfPaced` member of
the existing MCS local envelope. Preserve every historical top-level record.
No answer, action, score, assistance, or attempt events are written. Reload opens
the saved topic/phase or case with baseline model state; it does not replay work.
Unparseable/future envelopes remain unchanged, with no saved resume update.

### Initial shared integration slice

Only MCS catalog definitions and MCS filtering/projection in existing critical-care
progress readers need shared edits. Module-local policy marks MCS noncredit,
removes mastery/prerequisite requirements, and retains old route modes for links.
Merged/public readers exclude historical normalized MCS scores and completion;
the MCS adapter projects current visits as in-progress, without attempt evidence.
Targeted consumer tests cover this slice. Shared learning-module components,
other modules, Device Intelligence, global routes, authentication, consent, assets,
dependencies, and backend state are outside the change.

### Superseded contracts

The v2 owner decision supersedes older H1/H5/H6/H7 requirements for next-incomplete
credit, withholding answers/causes, compulsory response/action lists, and first
attempt persistence. Continue now means navigation, never completion. Historical
scoring functions remain compatibility-only. H8 model/device restrictions, H9
honest progress, H10 clinical language, H11 scope, and H12 real interaction checks
still apply. No new three-pane layout or assistance dashboard is introduced.

## Initial implementation evidence

- Baseline: `npx --no-install jest --runInBand src/features/mechanical-circulatory-support 'src/app/\[locale\]/mechanical-circulatory-support'`:
  **32 suites, 745 tests passed**; `/tmp/mcs-01-baseline-jest.log`.
- Initial migration: 21 failed/11 passed suites; 97 failed/208 passed tests.
  Catalog schema rejected empty competency IDs, preventing 440 tests from running.
  Fixed by retaining the schema-required tags while removing credit authority.
- Next run: 17 failed/15 passed suites, 179 failed/566 passed tests (745 total).
  Exposed the superseded exam contracts requiring explicit replacement.
- Third run: 13 failed/19 passed suites, 65 failed/633 passed tests (698 total);
  `/tmp/mcs01-third-jest.json`. Failures include old title/answer gates, old score
  persistence, selector ambiguity, and empty hints on integrated cases. These
  were resolved through the replacements below; their failed evidence is retained.
- TypeScript passed after the runtime migration and final runtime checks. An intermediate test-only typecheck caught unsupported Testing Library `exact` options and a nullable numeric test expression; both were corrected.
- Initial real-browser IABP lesson: Show explanation before answering left all
  radios unselected; no page errors. Visual inspection caught wording assuming a
  prior answer and weak optional-button presentation; both were corrected.

- Expanded migration run: **52 suites; 880 passed / 32 failed tests (912 total)**.
  Failures included MCS contracts and three broader existing failures listed below.
- After consumer replacements: **46 suites, 860 tests passed**.
- With all four optional story example checks: **47 suites, 864 tests passed**.
- Complete release regression: **47 suites, 867 tests passed** (34 MCS/route suites,
  735 tests; 13 shared-consumer suites, 132 tests). No skipped or zero-test suites.
- Final transfer-observation retry correction: **3 suites, 74 tests passed**.
  Retry now clears both the main transfer answer and its optional observation.
- Final resume ordering correction adds a timestamp for the current location only.
  This lets a newly visited MCS topic outrank an older non-MCS global Continue
  target. Historical stores and per-topic visit chronology remain unchanged.
  The focused final resume run passed **9 suites / 123 tests**, recorded in
  `mcs01-resume-jest.json`.
- Scoped ESLint and formatting passed; `git diff --check` passed.

The complete release command was:

```sh
npx --no-install jest --runInBand \
  src/features/mechanical-circulatory-support \
  'src/app/\[locale\]/mechanical-circulatory-support' \
  src/features/critical-care/progress/__tests__ \
  src/features/critical-care/__tests__/catalogs.test.ts \
  src/features/critical-care/__tests__/dashboard.test.ts \
  src/features/critical-care/__tests__/public-client-boundary.test.ts \
  src/features/critical-care/__tests__/clinical-thresholds.test.ts \
  src/features/critical-care/__tests__/derived-value-guides.test.tsx \
  src/features/critical-care/__tests__/release-boundary.test.ts \
  src/features/critical-care/__tests__/hub-pathway-start-alignment.test.ts \
  src/features/critical-care/components/CriticalCareAccountSync.test.tsx \
  --json --outputFile=/tmp/mcs01-release-jest.json
npx --no-install tsc --noEmit --pretty false
```

ESLint and Prettier were limited to the explicit changed TypeScript/CSS/Markdown
paths. Test logs and machine-readable results are preserved outside Git at:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/mcs-01-2026-09-14`.
The baseline source and old assertions remain at the starting commit. The final
MCS count differs from 745 because exam-security/assistance matrices were replaced
by focused self-paced and safety checks; this is not a claim that every old test
was retained verbatim.

### Broader existing failures — not hidden or changed

The expanded check also ran the shared accessibility, curriculum-sequencing and
learner-copy suites. Each has one pre-existing failing test. Running their exact
starting-commit source from a temporary Git archive reproduced **36 passed / 3
failed tests, 3 suites**:

- Accessibility: the CRRT pressure lab lacks the expected circuit image label.
- Curriculum sequencing: the CRRT authored-order expectation omits its existing
  `PrisMax troubleshooting challenge` row.
- Learner copy: a cross-module static-word scan flags existing clinical uses of
  “assessment” and technical captions in several modules. The migration removed
  MCS examination wording; clinical terminology and existing model provenance
  captions are not reinterpreted as examination gates.

The baseline archive contained tracked source, Jest configuration, the English
messages and the asset manifest, with installed dependencies linked read-only.
Initial archive harness attempts lacked the asset manifest/correct working
location and could not execute; those attempts are not verification. The corrected
run is `mcs01-shared-baseline-jest-valid.json`. No CRRT or ventilation files changed.

### Genuine browser evidence

`node /tmp/mcs01-browser-full.cjs` drove Chromium against this worktree's isolated
Next dev server on port 3137. The local development authentication path remained
intact; temporary credentials were not included in evidence. External requests and
analytics requests were blocked by the test browser.

**25 successful scenario/viewport checks, zero page errors**:

- All 12 exact case URLs: explanation with no answer/action; authored hints;
  wrong answer, compare and retry; keyboard adjustment; reset and reload with no
  replayed answers. All three LVAD cases retain the speed authorization interlock.
- All 9 lessons: keyboard Show explanation with unselected answers; full patient
  controls before answering; jump to Observe with no fabricated capture; jump to
  Transfer and back to an unvisited action as fresh exploration.
- Learn and integrated cases at both 390 × 844 and 320 × 844: page scroll width
  equals viewport width. Screenshots were opened and visually inspected, along
  with the 1440 × 1000 desktop states.

Earlier browser harness failures used a missing lesson ID field and sent Enter
before hydration had finished. Corrected to the registry's `sectionId` and waited
for the real location effect before keyboard interaction; the final full run
passed. The corrections are recorded rather than counted as successful checks.

Inspected screenshots: `mcs01-learn-desktop.png`, `mcs01-integrated-desktop.png`,
`mcs01-learn-390.png`, `mcs01-case-320.png`. Narrow companion screenshots and
`mcs01-browser-full.json` are in the same local evidence folder.

At the initial handoff, not run: whole-repository tests, full production/embedded-training-app build,
publication/deployment, backend mutations, native browser 200% zoom, screen-reader
or human usability matrix, device IFU/recall refresh, clinical approval. Route
compilation was exercised in the development browser; it is not a production-build
claim. Existing unlisted-preview release status is unchanged.

## Old-to-new contracts

| Area / tests                                                                          | Old contract                                                                         | Current contract                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Case presentation, one-door, route/nav and registry tests                             | Mask diagnosis/topic titles and call capstones Challenge                             | Meaningful clinical titles, guided cases and optional integrated walkthroughs; stable legacy Assess URLs                                         |
| `stage-precommit-leak*`, walkthrough and introduction tests                           | Hide teaching/causes until response; disable later tasks and Continue                | Open teaching, sources and all 68 task links; Show explanation without an answer; Continue is navigation only                                    |
| M5 case/control tests and reducer                                                     | Scenario action allowlists act as exam permissions                                   | Supported patient/device/fault controls remain open; device family, pump configuration, unknown IDs and LVAD speed authorization remain enforced |
| Actual capture, model, topology, source and threshold tests                           | Physics, real intervals, bounded controls and honest captures                        | Preserved; no physics or source registry changes; skipped Observe explicitly has no captured result                                              |
| `story-self-paced`, story model tests                                                 | Predict before running a provided story                                              | Optional prediction, Hint, direct worked example and retry on a separate model copy                                                              |
| M5 persistence/analytics tests                                                        | Record scores, assistance and completed attempts                                     | Save only visits/current location; preserve historical fields exactly; no graded/help/action events                                              |
| `self-paced-consumers`, shared adapters/selection/account/dashboard/integration tests | Historical MCS scores/normalized outcomes affect summaries, preparation and Continue | Exclude historical grades from current projection, recommendations and completion; project current visits only, no inferred attempt evidence     |
| Review/deep-link/retry                                                                | Earlier indexes imply a prior captured review                                        | Review only an actual saved snapshot; fresh entry uses authored setup and an empty action log; repeat the task without penalty                   |

Question decisions and named concepts are enumerated in
[MCS-01-question-ledger.md](MCS-01-question-ledger.md): **51 reinforcement entries**,
including one seven-candidate sort and four worked story comparisons. Existing
clinical keys and evidence IDs were retained, not newly approved.

## Legacy data and mixed restrictions

The existing `interventionalpulm:mcs-progress:v1` envelope gains only `selfPaced`:
visited lesson/case IDs; last activity, section, device and phase; and the current
location's timestamp. That timestamp orders resume candidates, not attempts or
help use. Legacy scores, first responses, critical errors, assistance fields and
unknown top-level fields remain unchanged. Corrupt/future envelopes are not
rewritten. Historical normalized critical-care records are read-only and ignored
for MCS current outcomes/resume. Legacy completion does not become an inferred
visit. There is no migration, second storage key, grading service, or assistance
history. Old scoring utilities remain dormant compatibility code with no current
UI writer/consumer.

The scenario allowlist was a mixed pedagogical predicate. The replacement checks
supported control IDs and device topology, retaining reducer safety restrictions.
Recommended Learn task controls remain focused; the full supported controls are
available separately through the same reducer. Turning on a disabled Impella side
is a configuration change; selecting a position/purge/controller/tamponade fault
creates a model condition and does not claim its clinical treatment. View/playback
controls say what they change. Reset returns to the original patient/device setup
and clears current responses/actions. Immutable earlier snapshots are marked as
review; “Explore this task again” starts fresh supported work.

## Review holds and next slice

No code or test result supplies clinical approval. Preserve the existing holds in
`mcs-flow-redesign.md`, `mcs-model-limitations.md`, `mcs-live-teaching-panels.md` and
`mcs-targeted-teaching-repair-2026-09-13.md`:

- Faculty review of control meaning and causal interpretation where ambiguous.
- CP manufacturer-measurand clarification and held textbook-flow disagreement.
- PAPi is not validated as a direct right-pump response signal; the model's
  numerator constrains that response. RP flow remains serial, not extra systemic
  output.
- High-power model patterns can raise electrical power without reducing flow;
  stable modeled flow does not exclude clinical danger.
- Rising modeled CPO during high afterload does not establish improved perfusion.
- Authored IABP contours do not establish every clinical timing phenotype.
- Source registries, reviewed-English fallback, rights/asset facts, existing safety
  notices and model limitations remain; no current IFU/recall review is claimed.

The next slice is faculty review of the exposed control descriptions and causal
teaching, plus human accessibility/usability checks. A later serialized integration
pass can repair the existing cross-module audits and unrelated shared-suite
failures. No independent-case permission matrix, scoring standard or prospective
assistance dashboard is required. There is no deferred shared MCS integration
needed for this PR's self-paced operation.

## Structured-module acceptance reconciliation

| Rule | Outcome for this scope                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| H1   | PASS under v2: one overview/curriculum, location-based Continue; integrated case label replaces examination semantics         |
| H2   | PASS: reference teaching and meaningful optional activities preserved; model examples remain distinct from work               |
| H3   | NOT APPLICABLE to a new layout: existing shared components and current task presentation reused                               |
| H4   | PASS: one NowCard, existing task locations, freely navigable task map                                                         |
| H5   | PASS under v2: actual teaching and sources render without answer-security masking                                             |
| H6   | PASS under v2: no visit/Continue/answer implies completion; genuine captures require real observations                        |
| H7   | PASS under v2: optional comparison, reveal and retry, immediate safety feedback; no first-attempt surveillance                |
| H8   | PASS for software checks: model, assets, topology, bounds and safety retained; clinical interpretation remains pending review |
| H9   | PASS: legacy preservation and current visit/location-only progress, tested through shared readers                             |
| H10  | PASS for scoped copy; existing clinical/source review holds remain                                                            |
| H11  | PASS: only MCS, the required four shared production consumers and targeted tests; no Device Intelligence edits                |
| H12  | PASS for executed rendered/browser checks; human/assistive-technology and native zoom matrix not run                          |

## Initial changed paths

- `docs/gap-remediation/self-paced/MCS-01-handoff.md`
- `docs/gap-remediation/self-paced/MCS-01-question-ledger.md`
- `src/app/[locale]/mechanical-circulatory-support/assess/page.tsx`
- `src/app/[locale]/mechanical-circulatory-support/routes.test.tsx`
- `src/features/critical-care/__tests__/dashboard.test.ts`
- `src/features/critical-care/content/activities.ts`
- `src/features/critical-care/progress/__tests__/account-sync.test.ts`
- `src/features/critical-care/progress/__tests__/adapters.test.ts`
- `src/features/critical-care/progress/__tests__/integrated.test.ts`
- `src/features/critical-care/progress/__tests__/selection.test.ts`
- `src/features/critical-care/progress/adapters/mcs.ts`
- `src/features/critical-care/progress/index.ts`
- `src/features/critical-care/progress/publicClient.ts`
- `src/features/mechanical-circulatory-support/__tests__/common-model.test.ts`
- `src/features/mechanical-circulatory-support/__tests__/components.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/flow-presentation.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/m5-controls-and-surfaces.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/m5-module-surfaces.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/m5-persistence-analytics.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/m5-practice-challenge.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/m5-workbench-routing.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/model.test.ts`
- `src/features/mechanical-circulatory-support/__tests__/one-door.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/self-paced-consumers.test.ts`
- `src/features/mechanical-circulatory-support/__tests__/stage-learner-review.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/stage-precommit-leak.rendered.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/stage-precommit-leak.test.ts`
- `src/features/mechanical-circulatory-support/__tests__/stage-registries.test.ts`
- `src/features/mechanical-circulatory-support/__tests__/stage-walkthrough.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/story-self-paced.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/targeted-introductions.test.tsx`
- `src/features/mechanical-circulatory-support/components/McsCaseWorkflow.tsx`
- `src/features/mechanical-circulatory-support/components/McsContinueCta.tsx`
- `src/features/mechanical-circulatory-support/components/McsControls.tsx`
- `src/features/mechanical-circulatory-support/components/McsHub.tsx`
- `src/features/mechanical-circulatory-support/components/McsModuleNav.tsx`
- `src/features/mechanical-circulatory-support/components/McsPathwayAccordion.tsx`
- `src/features/mechanical-circulatory-support/components/McsRouteOrientation.tsx`
- `src/features/mechanical-circulatory-support/components/McsWorkbench.tsx`
- `src/features/mechanical-circulatory-support/components/stage/McsCapturedResults.tsx`
- `src/features/mechanical-circulatory-support/components/stage/McsIntroTeaching.tsx`
- `src/features/mechanical-circulatory-support/components/stage/McsPrerequisiteReference.tsx`
- `src/features/mechanical-circulatory-support/components/stage/McsStageHost.tsx`
- `src/features/mechanical-circulatory-support/components/stage/McsStoryProblems.tsx`
- `src/features/mechanical-circulatory-support/components/stage/McsTaskControls.tsx`
- `src/features/mechanical-circulatory-support/components/stage/mcs-stage.module.css`
- `src/features/mechanical-circulatory-support/content/casePresentation.ts`
- `src/features/mechanical-circulatory-support/content/pathwayResolver.ts`
- `src/features/mechanical-circulatory-support/content/sectionLearningContracts.ts`
- `src/features/mechanical-circulatory-support/content/selfPacedCatalog.ts`
- `src/features/mechanical-circulatory-support/content/stageLessons.ts`
- `src/features/mechanical-circulatory-support/engine/learningProgress.ts`
- `src/features/mechanical-circulatory-support/engine/reducer.ts`
- `src/features/mechanical-circulatory-support/engine/types.ts`
- `src/features/mechanical-circulatory-support/test-support/mcsStage.tsx`
- `src/features/mechanical-circulatory-support/test-support/mcsWorkbench.tsx`

## SHARED-01 follow-up — 2026-09-15

### Base, scope and merge

This updates existing PR #217 and `codex/mcs-01`, starting from its pushed commit
`2ce038c1a478e9fe789307dc919748e17a9b67c1`. SHARED-01 PR #215 was verified merged;
`origin/main` was fetched at `6aa515947fd56b1d27da392c76d06539c8274f42` and merged
normally into the existing branch. No rebase or force push is used. The baseline
checks use a complete detached checkout of that exact base at
`/tmp/mcs01-shared215-base`, with installed dependencies linked and no copied
local authoring inputs or secrets.

The only textual merge conflict was `account-sync.test.ts`. Both branch-specific
expectations were obsolete: MCS-01 expected historical ECMO completion and
SHARED-01 expected historical MCS completion. The combined expectation excludes
**MCS, ECMO, HD, MV and CRRT**. ICU remains the unaffected account/graded consumer.
Generic graded tests now use actual ICU activities or explicit test-only
fixtures, without restoring any converted module's grading authority.

This follow-up implements the owner's explicitly scoped shared integration:

- Full, public and restricted progress readers exclude all five converted
  modules' normalized historical activity rows. MCS resume comes only from its
  validated module-store location, even when normalized history has a newer date.
- Raw dashboard and recommendation inputs reject historical completion, scores,
  attempts and help/competency records before catalog downgrading could turn them
  into false visits. Current MCS/CRRT adapter visits remain ungraded in-progress
  navigation, with no invented visit chronology. MCS lesson, practice and
  integrated-case locations retain their exact route, device and phase.
- CRRT's existing explicit shared selection pointers remain supported alongside
  its module-store visits. HD, ECMO and MV historical pointers remain inert.
- Raw personal-history and assumed-concept readers exclude converted historical
  records from recent activity, retry suggestions, encountered concepts and
  Continue. Historical export and stored values remain available. Current MCS
  navigation continues through its module and full/public dashboard readers.
- Public and full account GET, hydration, projection and POST exclude all five
  converted modules. Mixed subset reconciliation preserves historical rows and
  unrelated ICU navigation; MCS visits are never uploaded as coarse completion
  or copied back over normalized historical grades. Actual public and restricted
  sync mounts read old account data without POSTing or rewriting stored JSON.
- Catalog authority remains noncredit/no completion evidence/no mastery/no
  prerequisites for all five converted modules. ICU authority remains unchanged;
  ICU preparation/recommendations receive no historical HD or MCS completion.

No module engines, source teaching, route infrastructure, schemas, dependencies,
backend data or Device Intelligence are changed by this follow-up. The incoming
SHARED-01 HD explanation changes and shared `ScenarioTeachingDebrief` behavior
remain identical to the updated base. The one learning-module change beyond that
base is a targeted MCS navigation-label consumer test. CRRT's only module-local
change is replacing an obsolete MCS fixture with ICU in its compatibility test.
MCS-02 is not started; PR #217 remains open for review.

### Integration failures resolved separately from the base

Early combined checks exposed outdated graded MCS fixtures in account sync,
monotonic merge, recommendation, dashboard and public subset tests; catalog and
ICU readiness assertions that still counted MCS; and an artificial MCS resume
payload in the hub test. Tests now assert the combined policy or use an unaffected
fixture. A first filter also rejected CRRT's supported explicit selection
pointer; it was corrected and its existing consumer test retained.

The first complete combined run had **269 suites / 5,063 tests: 264 suites and
5,058 tests passed; five tests failed**. In addition to the three reproduced base
failures below, it exposed two integration expectations: the shared shell still
expected the MCS “Challenge” label, and an MCS compatibility test used historical
ECMO selection as an unaffected resume. The shell now expects “Integrated cases”
for MCS only; the compatibility test uses a real CRRT selection and verifies it
exists before a newer MCS location replaces it.

### Final verification

| Check                                     | Updated base `6aa51594`                                         | Combined MCS-01 branch                                            |
| ----------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Complete requested suite set              | 267 suites: 264 passed, 3 failed; 5,053 passed / 3 failed tests | 269 suites: 266 passed, 3 failed; 5,060 passed / 3 failed tests   |
| Remaining integration failures            | —                                                               | **0**; the three remaining failures also fail on the updated base |
| Final focused shared boundary run         | —                                                               | 16 suites / 127 tests passed                                      |
| Type-check (8 GB heap)                    | Passed                                                          | Passed                                                            |
| Full production build                     | Passed                                                          | Passed                                                            |
| Scoped ESLint, formatting and diff checks | —                                                               | Passed                                                            |

The final complete run has no skipped tests or runtime-error suites. It covers all
MCS, HD, ECMO, CRRT, MV, critical-care and learning-module tests plus MCS routes,
including the corrected shared shell and MCS/CRRT selection assertions.

Type-check resource note: the combined checkout's post-build default-heap run
terminated at Node's roughly 4 GB heap limit. The earlier pre-build type-check
passed. Final type-checks on both the updated base and combined branch passed
with `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`; no TypeScript
configuration, dependency or source workaround was introduced. The default-heap
failure is retained in `mcs01-shared215-final-typecheck.log`, separately from the
successful `*-typecheck-8gb.log` results.

The same complete suite selector was used on the updated base and combined branch:

```sh
npx jest --runInBand src/features/mechanical-circulatory-support src/features/icu-hemodynamics src/features/cardiohelp-ecmo src/features/baxter-crrt src/features/mechanical-ventilation src/features/critical-care src/features/learning-module 'src/app/\[locale\]/mechanical-circulatory-support' --json --outputFile=<evidence.json>
```

The base invocation used the repository's `npm test --` wrapper, which adds
`--passWithNoTests`; it executed 267 suites with no empty-run result. The final
combined invocation called Jest directly. Both builds ran the canonical
`npm run build`: both embedded training applications, Contentlayer, critical-care
and cardiac asset validation, `next build --webpack`, and standalone preparation.
No deployment or backend mutation was performed. Original Chromium evidence
above was not rerun or relabeled as new browser evidence.

### Failures reproduced on updated base

- `critical-care/__tests__/accessibility.test.tsx`: the CRRT circuit diagram does
  not expose the image label expected by the existing test.
- `critical-care/__tests__/curriculum-sequencing.test.tsx`: the authored-order
  expectation omits the existing “PrisMax troubleshooting challenge” row.
- `critical-care/__tests__/learner-copy.test.ts`: the existing cross-module static
  scan flags clinical terminology and technical/provenance captions. The base
  has 24 flagged captions and MCS-01 has 21; no newly flagged caption is introduced.

These three failures were reproduced at `6aa51594`, not inferred from the earlier
MCS baseline. Their tests and unrelated runtime are preserved. They remain a
separate cross-module maintenance slice and are not repaired by restoring grades.

Evidence logs and JSON results are preserved outside Git in
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/mcs-01-shared215-2026-09-15`.

### Follow-up paths beyond the merged base and prior MCS implementation

- `src/features/baxter-crrt/__tests__/selfPacedConsumers.test.ts`
- `src/features/critical-care/__tests__/dashboard.test.ts`
- `src/features/critical-care/__tests__/public-client-boundary.test.ts`
- `src/features/critical-care/components/AssumedConceptStrip.tsx`
- `src/features/critical-care/components/CriticalCareHistoricalSync.test.tsx`
- `src/features/critical-care/components/CriticalCareHub.test.tsx`
- `src/features/critical-care/components/CriticalCareLibraries.test.tsx`
- `src/features/critical-care/components/CriticalCareProgressView.tsx`
- `src/features/critical-care/dashboard.ts`
- `src/features/critical-care/progress/__tests__/account-sync.test.ts`
- `src/features/critical-care/progress/__tests__/hd-ecmo-self-paced.test.ts`
- `src/features/critical-care/progress/__tests__/integrated.test.ts`
- `src/features/critical-care/progress/__tests__/merge-recommendation.test.ts`
- `src/features/critical-care/progress/accountSync.ts`
- `src/features/critical-care/progress/index.ts`
- `src/features/critical-care/progress/publicAccountSync.ts`
- `src/features/critical-care/progress/publicClient.ts`
- `src/features/critical-care/progress/recommendation.ts`
- `src/features/critical-care/progress/utils.ts`
- `src/features/critical-care/publicDashboard.ts`
- `src/features/learning-module/__tests__/criticalCareShellConvergence.test.tsx`
- `src/features/mechanical-circulatory-support/__tests__/self-paced-consumers.test.ts`
- `docs/gap-remediation/self-paced/MCS-01-handoff.md`
