# SOCRATES authoring and curriculum follow-up

Scope: SOCRATES only, following merged PR #270. Base:
`4bd1368d13cb297b7076f4d7655de849f444e0ff`. Fresh branch:
`codex/socrates-steve-followup-20260923`. No overlapping SOCRATES open PR
was found at preflight. Existing worktrees and drafts were preserved.

## Design and preservation

The learner is reviewing histology images with authored interpretations. This
change repairs author preview and curriculum navigation, without changing clinical
statements, scoring, study design or competence claims. The existing SOCRATES
viewer and reveal flow remain the reference; a critical-care stage migration is
outside this task.

- Training and draft preview share `TrainingLesson` and `StudyViewer`. The draft
  controller uses allowlisted projections and local reveal state only. It does not
  mount the participant controller or call progress, enrollment or save APIs.
- A verbatim learner narrative is an optional v2 extension. It is canonical when
  present: classification fields are derived from explicit source labels; independent
  structured teaching fields cannot silently contradict it. Source provenance and
  original cell values stay in protected author metadata. Neither reaches initial
  learner/testing projections.
- Modules have stable identities, authored purposes, display order, recommended-start
  metadata and planned counts. Membership references existing case UUIDs with a
  separate position and source order. Release approval is separate from source
  membership. Case documents, diagnosis categories and study revisions are not
  duplicated or reordered.
- The bounded operator workflow inspects the original workbook, reconciles both
  sheets, maps case number plus series and actual image identity, then produces a
  private plan. Explicit apply uses optimistic revisions and one database transaction.
  This task applies only synthetic fixtures to a disposable database.

## Baseline and reproduction

Baseline: 21 SOCRATES suites / 135 tests passed. Two new synthetic tests failed at
the missing unsaved vignette in both browser and protected draft previews before
the repair. The repaired preview tests pass, including zero participant API/save
calls, no regions, reveal boundaries and return to editing.

The workbook SHA-256 was independently rechecked:
`f4a06fb8ccb06f7993fcfca156c4138df0bc4368e100a0444366c68e7ff2f279`.
The workbook's Case 041 / Series 4 was used in a private local source-text
reproduction at position 6: the former renderer omitted it, the initial projection
withheld it, and the shared post-reveal renderer returned every character exactly
with zero regions. This was a text render using a synthetic viewer fixture, not
an image-identity or saved-draft check. It is **not** evidence of the saved live draft. Actual saved
Case 41, production deployment SHA and remote migration state remain NOT VERIFIED.

## Source decisions remain open

The source contains 59 case-series entries and 55 case numbers, rather than the
email's approximate 50. The six planned module counts are 20/5/8/14/6/6.
All source case-series to database UUID/image matches require owner reconciliation.
The core/advanced conflict and two possible exclusions remain held in private
plans. The actual provider annotation key also needs review. Planned counts do
not establish release approval or availability.

## Steve's requests and evidence

| Request                               | Reproduced cause / previous behavior                                                                                                                                                                   | Change and evidence                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case 41 text missing in preview       | The builder passed only slide and regions to `SocratesDemo`; whole-case content never reached it. Two regression tests failed before the fix. The actual saved Case 41 incident is still NOT VERIFIED. | Shared `TrainingLesson` plus a local draft controller renders unsaved vignette and revealed teaching without regions or participant writes. Browser/protected tests cover return; protected PostgreSQL and browser journeys cover exact save/reload and stale rejection.                                                    |
| Explain Sort order                    | It sorts within alphabetized diagnostic groups, with UUID ties; it cannot create a mixed-diagnosis core.                                                                                               | “Diagnostic-list order” and inline help preserve existing values. Module membership has its own order. Source Case 041 / Series 4 is position 6.                                                                                                                                                                            |
| Recommended core and optional modules | Diagnosis-only grouping had no independent membership model.                                                                                                                                           | Six source modules, purposes, planned/available counts, ordered approved memberships and scoped navigation. Real progress distinguishes opened/revealed/completed by revision and paginates own-user records. SQL checks prove curriculum edits leave studies, pinned revisions, enrollments, attempts and progress intact. |
| Annotation / color key help           | An unreviewed placeholder entry was unclear; an incomplete entry could be marked reviewed.                                                                                                             | Exact hex plus picker, provider-mapping instructions, invalid/placeholder messages, disabled review for incomplete keys, reset on edit, and pending learner state. Legacy drafts still load; incomplete “reviewed” keys cannot be saved as reviewed or displayed as reviewed. Round display settings stay explicit.         |
| Avoid retyping descriptions           | Staging was not an application package; structured fields lacked a lossless home for every paragraph.                                                                                                  | A canonical verbatim narrative and protected original source values, plus inspect/map/plan/apply CLI. Real-source dry run is blocked by all 59 unresolved identities; synthetic apply verifies atomicity, optimistic revisions, preserved fields and idempotence.                                                           |

## Workbook reconciliation and dry run

The standard-library XLSX reader was independently compared with read-only
`openpyxl` values and the supplied staging `sourceValues`; values agree. Source
workbook, staging, mapping and text-render artifacts remain outside Git/public.

| Check                                       | Result                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Case-series entries / distinct case numbers | 59 / 55; repeated case numbers with different series remain distinct.                                                                                  |
| Module counts                               | 20 / 5 / 8 / 14 / 6 / 6, exact source order.                                                                                                           |
| Overall order / duplicate-sheet agreement   | Consecutive 1–59 / exact.                                                                                                                              |
| Common-pitfall narratives                   | All 8 retained verbatim, along with alternate magnification and general observations.                                                                  |
| Narrative parsing issues in this source     | 0; missing or ambiguous fields in other inputs are held for review.                                                                                    |
| Supplied mapping checklist                  | 59 blank target UUIDs and 59 blank target revisions.                                                                                                   |
| Dry-run rows                                | 59 unmapped; 0 ambiguous, conflicting, stale, ready or no-op targets **without a database snapshot**. These zeros do not establish live compatibility. |
| Apply allowed                               | No. No current target snapshot was supplied or verified.                                                                                               |
| Membership holds                            | 3: core/advanced decision for 430/2; retention decisions for 357/2 and 436/1.                                                                          |

The approximate 50-case email history does not remove any of the 59 entries.
Provider color mapping, actual source/image matches, current author edits and all
release readiness require owner review. Full narratives remain after-reveal content;
internal notes, curriculum role and teaching objective remain protected metadata.

## Validation record

Baseline at `4bd1368d13cb297b7076f4d7655de849f444e0ff`: 21 suites / 135 tests passed.
The two failing preview reproductions and repaired tests are retained in the
ignored local validation logs. Final counts below describe distinct final runs;
retries and overlapping earlier runs are not added together.

- Jest: **24 suites / 157 tests passed**, covering builder, study, demo, routes and importer.
- Workbook reader: **6 synthetic-workbook tests passed**.
- Disposable PostgreSQL 17: **80 checks passed**, applying the existing historical
  migrations plus both forward migrations. Includes real RLS, source/narrative
  round trips, canonical-text conflict rejection, stale case/module rejection,
  privacy projection, import mutation guards, failed-membership and stale-second-case
  rollback, successful receipt retry, unchanged import and study-data invariance.
- TypeScript, focused ESLint and `git diff --check`: passed. TypeScript used an
  8 GB heap after the default Node heap proved insufficient.
- Full production build: completed training-app builds, content generation, both
  asset validations, Next webpack production compile/type check/prerender and
  standalone preparation. Existing large-chunk and Mermaid dependency warnings,
  Node deprecation notices, local metadata-base fallback and the `next start`
  standalone warning are recorded; none was suppressed.
- Production Chromium: **9 journeys passed** against the full production build,
  then the same 9 passed after improving screenshot readiness/scroll waits using
  that unchanged build. This is 9 distinct journeys, not 18 tests. The initial
  browser-only counter was corrected to exclude ordinary site page-view analytics
  and inspect SOCRATES/database mutations; the draft journeys produce none.

Screenshots were opened and inspected at 1440×900 and 390×844, including 200% root
font sizing. Both image panes are painted, the preview status/return control is
clear, all six modules are visible in order with separate counts, long narrative
paragraphs wrap without horizontal clipping, and the mobile layout stacks the
panes and teaching panel. A loading-state capture and an unfinished-scroll capture
were replaced after visual inspection. Browser assertions also check keyboard
focus on the revealed heading and return button, no overflow, native and fallback
fullscreen, paired pan/zoom, module scope, save/reload and answer boundaries.

Local screenshot evidence is retained under ignored `test-results/socrates/`:
`modules-{1440,390}.png`, `preview-{1440,390}.png`,
`preview-text-200-{1440,390}.png`,
`preview-text-200-detail-{1440,390}.png`, and
`narrative-{1440,390}.png`. Validation logs are under
`test-results/socrates-followup/`; private source-text render artifacts stay in
the external Local-Data validation directory. No screenshot contains source
workbook text or private author notes; clinical annotations are not validated by
these synthetic teaching journeys.

Reproduce with:

```sh
npx jest --runInBand src/features/socrates-builder src/features/socrates-study \
  src/features/socrates-demo 'src/app/\[locale\]/socrates' src/app/api/socrates \
  scripts/socrates/import-plan.test.ts
python3 scripts/socrates/inspect_workbook_test.py
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
node scripts/socrates/rehearsal.mjs
node scripts/socrates/browser-rehearsal.mjs --production
git diff --check
```

The browser command runs the **full** production build, starts the built Next app
on port 3119 and cleans up its own processes/container. It uses real PostgreSQL
and real image tiles, with synthetic Auth/PostgREST and teaching content. It never
starts/resets the shared Supabase stack. Local test CSP bypass allows the disposable
Auth adapter; production CSP and image allowlists are unchanged. It does not verify
real Supabase Auth, production credentials, source Case 41 pixels, production
deployment SHA or remote migration state.

## Author handoff and draft reply

See the [short author guide](socrates-author-guide.md) and
[private operator guide](socrates-workbook-import.md). The operator guide names
both forward migration files and the later authorized staging, mapping, import,
review and release steps. Historical migrations are unchanged.

Draft response to Steve (not sent):

> I found that the preview was showing the image and drawn regions but was not
> receiving the whole-case text. The proposed fix now shows the current draft's
> teaching text after you select Reveal teaching interpretation, even without any
> regions. Returning to editing preserves your changes; saving and publishing are
> separate. I have not yet checked your actual saved Case 41 draft.
>
> Sort order now has clearer wording: it orders cases within a diagnosis list.
> The new module view has a recommended core and five optional modules, with
> available cases shown separately from the planned count. The annotation key now
> explains how to enter the provider's actual label, hex color and meaning, and
> makes incomplete entries visibly pending review.
>
> Your workbook can be imported without retyping or losing paragraphs. Before
> that happens, we need to match each case and series to its existing image and
> saved draft, review differences, and settle the three membership decisions.
> The workbook contains 59 entries, so none have been removed to match the earlier
> approximate count. These changes are awaiting independent review and are not live.

No merge, deployment, remote migration, production import, clinical publication
or real study activation occurred. Synthetic publication/activation is confined
to isolated tests. Implementation readiness is separate from **CLINICAL CONTENT
READY** and **LIVE FIX VERIFIED**; neither of those is claimed.

Disposition: **READY FOR INDEPENDENT REVIEW**.

## Exact changed-file scope

Application/import implementation commit: `b7d5add9c6d2c50934565cc08aa09ecdc9e06e32`.
The following final documentation and browser-capture refinements do not change
application behavior. Final PR head is recorded in the PR handoff; a document
cannot embed its own commit hash. Base and last fetched current main both remain
`4bd1368d13cb297b7076f4d7655de849f444e0ff`.

40 tracked files differ from base; no dependencies, private inputs, generated
builds or screenshot binaries are committed.

```text
docs/local-authoring-assets.md
docs/socrates-author-guide.md
docs/socrates-steve-followup.md
docs/socrates-training-study.md
docs/socrates-workbook-import.md
e2e/socrates-study.spec.ts
scripts/socrates/browser-rehearsal.mjs
scripts/socrates/followup-rehearsal.mjs
scripts/socrates/import-plan.test.ts
scripts/socrates/import-plan.ts
scripts/socrates/import-rehearsal.mjs
scripts/socrates/inspect_workbook.py
scripts/socrates/inspect_workbook_test.py
scripts/socrates/rehearsal.mjs
scripts/socrates/serve-fixture.mjs
scripts/socrates/start-browser-app.mjs
scripts/socrates/workbook-import.ts
src/app/[locale]/socrates/page.tsx
src/app/[locale]/socrates/training/[caseId]/page.tsx
src/features/socrates-builder/case-content.ts
src/features/socrates-builder/components/CaseContentEditor.tsx
src/features/socrates-builder/components/DraftLearnerPreview.tsx
src/features/socrates-builder/components/SocratesBuilder.tsx
src/features/socrates-builder/curriculum-source.ts
src/features/socrates-builder/learner-narrative.ts
src/features/socrates-builder/schema.ts
src/features/socrates-study/__tests__/access.test.ts
src/features/socrates-study/__tests__/builder.test.tsx
src/features/socrates-study/__tests__/draft-preview.test.tsx
src/features/socrates-study/__tests__/narrative-curriculum.test.tsx
src/features/socrates-study/components/CurriculumDirectory.tsx
src/features/socrates-study/components/TrainingCase.tsx
src/features/socrates-study/components/TrainingLesson.tsx
src/features/socrates-study/components/shared.tsx
src/features/socrates-study/components/study.module.css
src/features/socrates-study/curriculum.ts
src/features/socrates-study/projections.ts
src/features/socrates-study/server/service.ts
supabase/migrations/20260923040205_socrates_curriculum_narrative_import.sql
supabase/migrations/20260923042038_socrates_protected_workbook_import.sql
```
