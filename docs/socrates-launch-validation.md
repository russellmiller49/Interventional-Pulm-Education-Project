# SOCRATES launch-readiness validation — 2026-09-22

Starting fetched `origin/main`: `bf613270a37a30cfd31a915a33758b808dfbff89`.
Reviewed prior SHA: `d98bab79af9231eb1857e2da96cb75ca2068d85c`.
The scoped history audit found no intervening SOCRATES changes; unrelated main
changes were retained. Branch: `codex/socrates-launch-readiness`.
Worktree: `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-socrates-9-22`.
The final commit and PR are reported in the task's completion message.

The [preimplementation audit](socrates-launch-audit.md) was written before code
changes. [Architecture and operation](socrates-training-study.md) covers access,
case packages, privacy, migration, study configuration and release inputs.

## Feature dispositions

| Requested feature                  | Disposition                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FULLSCREEN                         | Implemented on the shared viewer: native API, rejection fallback, Escape/close, inert background, focus restoration, mounted viewer, crop/zoom preservation and paired alignment.     |
| CASE DIRECTORY                     | Implemented unlisted/noindex module catalog, grouping, ordering, direct case links, empty/error/loading states and mobile layout.                                                     |
| STANDALONE VIGNETTE                | Implemented as authored case content and a separate teaching panel.                                                                                                                   |
| LOW/HIGH MAG CONTENT               | Separate persisted arrays, builder controls and sequential training review. Real observations await the study team.                                                                   |
| KEY LEARNING POINTS                | Persisted case array, authoring controls and explicit review/completion step. Real content awaits the team.                                                                           |
| ADEQUACY REASONING                 | Designation/reasoning persisted and revealed in training; excluded from presubmission testing.                                                                                        |
| CANCER REASONING                   | Same structured and protected pathway; optional preliminary diagnosis also supported.                                                                                                 |
| PRIVATE HIGHLIGHT NOTES            | Protected authoring/revision/readiness storage, full JSON round trip, absent from learner/test projections and public snapshots.                                                      |
| ANNOTATION KEY                     | Authorable text-labeled swatches/explanations, reviewed flag and pending-review state; configurable testing visibility. Actual Invenio key is not fabricated.                         |
| TRAINING ENVIRONMENT               | Separate inspect → low/high magnification → interpretation → learning points flow; interactive regions and persisted opened/revealed/completed events.                                |
| TESTING ENVIRONMENT                | Separate component/server projection, verified entitlement/enrollment, configurable survey, immutable final answers, no default feedback or score.                                    |
| ROUND 1 / ROUND 2                  | Configurable labels, case order/membership and pinned revisions; independent progress and immutable activated configuration. Synthetic draft template included.                       |
| CONFIDENCE                         | Protocol-authored response options; persisted with each finalized attempt and available in monitoring/CSV.                                                                            |
| INTERPRETATION TIME                | Server start/submission times and elapsed milliseconds; includes loading, reloads and interruptions, not active-attention time.                                                       |
| PROGRESS MONITORING                | Admin-only participant/round/case completion, training revisions, missing responses, timing/confidence and deterministic coded-ID CSV.                                                |
| STUDY READINESS / DEIDENTIFICATION | Pinned and current readiness both gate activation/access/start/submit/resume; content, imaging, identifier matching, de-identification, secondary ROSE and technical holds supported. |

## Database and compatibility

New migration: `20260922201126_socrates_training_study_v2.sql`.
Neither historical SOCRATES migration was changed. Schema v2 retains the old
geometry/workflow package and adds structured case content, legend/readiness
tables, explanations and study/progress/attempt tables. Old/v1 import and existing
publications remain readable. The public anonymous sandbox remains guarded v1.
Rich persistence was enabled only after actual PostgreSQL round trips passed.
No migration was applied to shared local Supabase or a remote database.

The disposable PostgreSQL 17 rehearsal applies both historical migrations unchanged
followed by the new migration. It exercises real SQL constraints, grants, RLS and
transactional RPCs with synthetic roles and identities. The final checks cover:

- Paired descriptor, explanation, case, legend and private-note persistence; protected
  reload; old save/publication; malformed/unmapped input rejection.
- Public snapshots strip private/source markers; participants cannot read readiness,
  answer snapshots or administration; anonymous research reads and sandbox v2 writes fail.
- Every readiness boundary, postactivation safety holds, frozen configuration,
  training reveal/completion ordering and independent Round 1/Round 2 counts.
- Own attempt reuse, required responses, elapsed time/confidence/missingness,
  other-user read/write denial, final idempotence and simultaneous submissions
  returning the same immutable winning result.

## Exact validation commands and results

| Check                                                   | Result                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing + new SOCRATES and existing access Jest suites | **22 suites, 170 tests passed; 0 failed.** Includes all 16 unchanged SOCRATES regression suites, 5 new study suites and the existing site-access suite. |
| PostgreSQL migration/RLS/transaction rehearsal          | **42 checks passed; 0 failed.**                                                                                                                         |
| Full repository lint                                    | **0 errors, 15 warnings** in unchanged files.                                                                                                           |
| Full type-check                                         | **Passed, 0 errors**, serially after the development server stopped.                                                                                    |
| Production build                                        | **Passed**, including 776 generated pages and the standalone output.                                                                                    |
| Playwright Chromium                                     | **5 journeys passed; 0 failed**, with painted images, at all three required viewport sizes.                                                             |

```sh
npm test -- --runInBand \
  src/features/socrates-builder \
  src/features/socrates-demo \
  src/app/api/socrates-invenio \
  'src/app/\[locale\]/socrates-demo' \
  'src/app/\[locale\]/socrates-builder' \
  src/features/socrates-study \
  src/lib/site-auth/access.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
npm run lint
NODE_OPTIONS=--max-old-space-size=8192 npm run build
node scripts/socrates/rehearsal.mjs
PLAYWRIGHT_BROWSERS_PATH=/tmp/socrates-playwright-browsers \
  PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/socrates-playwright-browsers \
  PLAYWRIGHT_SKIP_BROWSER_GC=1 node scripts/socrates/browser-rehearsal.mjs
```

The existing SOCRATES regression suites are unchanged. An earlier isolated run was
16 suites / 91 tests passing. The first type-check attempt exhausted Node's default
heap; the required command was rerun with an 8 GiB heap. This is a documented local
resource adjustment, not an asserted baseline code failure. One concurrent dev/type-check
run also encountered TS6053 while Next regenerated `.next/dev/types` (10 missing
generated files). The full serial type-check subsequently passed. Do not run these
commands concurrently against the same checkout. Both production builds passed.
Lint reports 15 warnings in unchanged files; the build reports existing dependency
and chunk-size warnings. No remaining failure is claimed to be baseline-equivalent.

Long runs use `~/bin/codex-run-and-wake --current-thread --name <name> --log <log> -- <command>`.
Validation job: `20260922T211654-bd3db8fe7586`, log
`/tmp/socrates-release-validation.log` (Jest/lint/build passed; generated-type race
above made the combined job exit 1).
Serial type-check job: `20260922T212025-f83c21aaf679`, log
`/tmp/socrates-serial-typecheck.log` (exit 0); it waited for build/browser cleanup
using filesystem completion events rather than model polling.

Browser job `20260922T211655-ef7f0dd3945a`, log
`/tmp/socrates-release-browser.log`, passed its 42 SQL checks and first 2 journeys.
The browser then crashed, and subsequent launches found the shared Chromium
executable missing: 2 journeys passed and 3 failed. The helper was cancelled after
shutdown hung; its ports and disposable database were verified removed. The runner
now bounds shutdown of its own child processes. A fresh Chromium installation at
an isolated path completed successfully in job `20260922T212241-5209933b2789`, log
`/tmp/socrates-browser-install.log`. The fresh browser rehearsal is job
`20260922T212554-ea2e2b4d99ef`, log `/tmp/socrates-isolated-browser.log`: **42 SQL checks and 5 browser journeys passed**, exit 0, total 2 minutes 29 seconds including setup/cleanup. Its ports and disposable database were verified removed after completion.

Earlier full browser job `20260922T210346-7aea5d84ca9e` passed all five journeys;
the painted-image job `20260922T210852-f9b447f3c76a` also passed all five. The final
suite retains per-pane painted-pixel assertions so an empty pane cannot pass the
screenshot check. The subsequent combined regression run caught a duplicate viewer
callback and lint caught a ref read during rendering; both were corrected without
changing existing tests. A new SQL regression covers preserving a legacy published
link while its draft upgrades to v2. Initial browser findings (origin mismatch, image-request
queuing, resize zoom drift and 200% text footer overflow) were fixed and retested.

## Browser evidence

Playwright Chromium uses the real Next routes/components/actions and a fresh
isolated PostgreSQL database. The fixture supplies synthetic Auth and a minimal
PostgREST-compatible adapter that executes the actual SQL/RLS; the application has
no fixture-only branch. Original Invenio DZI/JPEG assets are fetched live through
the authenticated fixed-origin relay. No source image tiles are committed.

| Journey             | Coverage                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog → training  | Category/title navigation, initial answer/privacy absence, both image panes, native expansion, pan/zoom, relative zoom/source center preservation, navigator alignment, teaching sequence, legend, completion/reload.                                   |
| Participant testing | Dedicated neutral test DTO, single-image native expansion, Round 1 survey/finalization, time/confidence, repeat-submit equality, reload, Round 2 paired configuration; another participant gets 404 for the attempt and 403 for admin/dashboard/export. |
| 1280 × 800          | Rejected native request uses enlarged fallback, all three modes, paired navigation alignment, Escape/focus, panel access, no horizontal overflow and 200% text.                                                                                         |
| 390 × 844           | Same fallback/mode/keyboard/text checks with vertically stacked images; testing controls remain within the viewport and keyboard focusable.                                                                                                             |
| Admin and authoring | Completion/missingness/response data, coded CSV, standalone case edits, internal notes, transactional save and protected reload.                                                                                                                        |

Desktop journey size is 1440 × 900. Testing survey layout is also checked at
1280 × 800 and 390 × 844. Screenshots are local, uncommitted QA artifacts under
`test-results/socrates/`: `training-1440.png`, `training-1280.png`,
`training-390.png`, `testing-1440.png`, `testing-1280.png`, `testing-390.png`,
and `admin-1440.png`. Visual inspection confirmed painted paired images, readable standalone teaching content, unclipped mobile survey fields and the populated admin dashboard. Failed runs retain Playwright traces.

The synthetic localhost Auth endpoint is outside the site's production CSP.
The final browser configuration explicitly bypasses browser CSP for this isolated
fixture, removing the fixture-only background Auth fetch errors. Production CSP is
unchanged; server identity/entitlement checks and both fixed-origin relay restrictions
are still exercised. This is not a production Supabase Auth/CSP, email or load test.
Staging migration/auth verification is required during a later authorized release.

## Outstanding study-team inputs

Provide Steve's actual vignettes, low/high observations, learning points,
designation reasoning, reviewed image/source authorizations and the genuine Invenio
key. Approve survey wording/options, confidence scale, version, case membership and
order, training requirements, cross-round timing, feedback policy and data retention.
Keep testing-only answers unpublished and use disjoint training/testing sets where
required by protocol. Review image pixels and all authored text for identifiers;
the application does not automatically de-identify pixels or free text.

No study is seeded or activated. No UCSD case is asserted ready. No merge or
deployment occurred.

## Changed-file manifest

55 files in this change; existing regression test files and historical migrations remain unchanged.

```text
docs/socrates-invenio-comparison.md
docs/socrates-launch-audit.md
docs/socrates-launch-validation.md
docs/socrates-training-study.md
e2e/socrates-study.spec.ts
playwright.socrates.config.ts
public/socrates-study-template.json
scripts/socrates/browser-rehearsal.mjs
scripts/socrates/rehearsal.mjs
scripts/socrates/serve-fixture.mjs
scripts/socrates/start-browser-app.mjs
src/app/[locale]/admin/socrates/page.tsx
src/app/[locale]/socrates-builder/actions.ts
src/app/[locale]/socrates-demo/page.tsx
src/app/[locale]/socrates/layout.tsx
src/app/[locale]/socrates/loading.tsx
src/app/[locale]/socrates/page.tsx
src/app/[locale]/socrates/testing/[attemptId]/page.tsx
src/app/[locale]/socrates/testing/page.tsx
src/app/[locale]/socrates/training/[caseId]/page.tsx
src/app/api/socrates/[...path]/route.ts
src/app/api/socrates/images/[...path]/route.ts
src/features/socrates-builder/case-content.ts
src/features/socrates-builder/components/CaseContentEditor.tsx
src/features/socrates-builder/components/SocratesBuilder.tsx
src/features/socrates-builder/components/socrates-builder.module.css
src/features/socrates-builder/database-compatibility.ts
src/features/socrates-builder/schema.ts
src/features/socrates-builder/server/data.ts
src/features/socrates-builder/types.ts
src/features/socrates-demo/components/ComparisonSlideViewer.tsx
src/features/socrates-demo/components/DeepZoomViewer.tsx
src/features/socrates-demo/components/ExpandableViewer.tsx
src/features/socrates-demo/components/expandable-viewer.module.css
src/features/socrates-demo/types.ts
src/features/socrates-study/__tests__/access.test.ts
src/features/socrates-study/__tests__/builder.test.tsx
src/features/socrates-study/__tests__/fullscreen.test.tsx
src/features/socrates-study/__tests__/model.test.ts
src/features/socrates-study/__tests__/routes.test.ts
src/features/socrates-study/components/AdminDashboard.tsx
src/features/socrates-study/components/StudyDirectory.tsx
src/features/socrates-study/components/StudyViewer.tsx
src/features/socrates-study/components/TestingCase.tsx
src/features/socrates-study/components/TrainingCase.tsx
src/features/socrates-study/components/shared.tsx
src/features/socrates-study/components/study.module.css
src/features/socrates-study/model.ts
src/features/socrates-study/projections.ts
src/features/socrates-study/reporting.ts
src/features/socrates-study/server/service.ts
src/features/socrates-study/testing/fixtures.ts
src/lib/site-auth/access.ts
src/proxy.ts
supabase/migrations/20260922201126_socrates_training_study_v2.sql
```
