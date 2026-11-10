# Beta launch PR 1 — infrastructure evidence and owner gate

Date: 2026-11-10. Baseline: `54a02a1a104a552ea66d85d49bfa02af70fec1de`.
Branch: `codex/beta-launch-pr1`, existing PR #461. Independently reviewed head:
`e2b0b525c929562e6004d4f683ff8245df795f35`. Repair and evidence SHAs are recorded in the PR handoff.
Refreshed `origin/main` before branching and inspected all 18 open PR titles; none was a beta
feedback/review infrastructure PR. The adjacent Foundations PRs #394 and #379 concern teaching
questions and faculty register signatures; their changed-file lists do not overlap this PR.

**Gate: pending owner-run authenticated production verification.** Local tests and production
metadata do not establish a successful non-admin production submission. No production writes,
account creation, migration repair, email, merge or deployment were performed. Module teaching,
clinical models and publication stages are unchanged. Recognition and outreach are outside this PR.

**Merging PR #461 can trigger production deployment of the changed feedback handler.** Railway's
production service tracks GitHub `main` with `checkSuites: false`; a merge is a release action,
even though this task stops at the open PR. The distinct approval gates and rollback plan below
must be completed before the owner merges.

## Scope and fixes

The existing beta Jest suite and browser suite were green before edits. New regression cases
identified two screenshot failure paths: a failed insert followed by failed cleanup leaves the fixed
image path occupied, preventing retry; an insert whose response is lost can leave a saved report
whose screenshot the error handler deletes.

Independent review reproduced a third case at the reviewed head: the insert returned a transport
error, reconciliation found no row, cleanup deleted the image, and the pending insert then committed
with a missing image. An empty SELECT cannot establish that the insert will never commit.

Uploads retain a unique path per attempt and the report ID remains the idempotency key. **After an
insert attempt begins, this handler never deletes its screenshot.** This holds for returned errors,
thrown transport errors, empty/failed/thrown reconciliation lookups and overlapping retries. A
successful reconciliation can acknowledge only a report owned by the requesting account; another
account's report returns 409. An unresolved save returns 503 with the draft retained. The winning
image is preserved, and losing/failed attempts may leave private orphan objects. No automatic
orphan garbage collection is implemented. Old stored paths remain readable; SQL and storage
policies are unchanged.

Added handler-composition tests use the real `requireFeedbackUser`, synthetic Auth responses and
an in-memory query adapter. They cover complete learner and educator forms, server-derived
identity/profile, stable review ID on edit, two-reviewer isolation, and active/expired/revoked
admin screenshot authorization. They do **not** exercise real Auth, PostgREST, storage or SQL
upserts. Playwright uses local preview access and intercepted feedback/review endpoints; its PNG
annotation bytes, draft/retry, edit/reload and wrapper assertions are browser evidence only.

## Deployment approvals, release and rollback

Read-only Railway inspection during the repair confirmed project `marvelous-heart`
(`e251e547-04fc-4d0b-bdc4-a73809b2307b`), production environment
`8f179798-b586-4013-a0fb-130c9b4eb088`, service `Interventional-Pulm-Education-Project`
(`4a1754d2-0778-488e-96c7-5ec047b90e6a`). The service source is this repository's `main`, with
`checkSuites: false`; its live builder is Railpack. No Railway settings were changed. Pushing this
repair branch does not itself update the configured `main` source.

These are four separate owner decisions; approval at one gate does not approve the next:

| Gate                     | Approval needed                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Code review           | Independent re-review of the repaired commit and regression evidence. This approves the code, not a release.                                                                                                                     |
| 2. Merge and deployment  | Explicit owner approval to merge this PR and deploy the changed handler, after confirming build success and rollback readiness. With the current source settings, merging can begin deployment without waiting for check suites. |
| 3. Synthetic live tests  | Explicit owner authorization naming the existing non-admin accounts and synthetic review/report/image submissions, plus any cleanup. Deployment approval alone does not authorize these writes.                                  |
| 4. Real beta invitations | Explicit owner approval after live smoke tests and each module's existing acceptance/readiness gate. Passing infrastructure tests does not approve invitations.                                                                  |

Release operator and rollback operator: **Russell Miller**, or a specifically named operator he
authorizes before gate 2. Neither operator action is authorized by this document or this task.

1. Record the final independently reviewed PR SHA, confirm no later code changes, and confirm the
   complete production build succeeds using the repository's `npm run build` pipeline and
   `tsconfig.build.json`. Record the resulting `main` SHA if the merge method changes it. Local
   test builds are not evidence that a Railway production build or deployment succeeded.
2. Immediately before gate 2, recheck the current successful deployment and its rollback eligibility.
   The candidate found during this repair is **`561529fc-2bce-48e4-9139-3999f85b7eb7`**, source SHA
   **`54a02a1a104a552ea66d85d49bfa02af70fec1de`**, created **2026-11-10 02:15:16 UTC**, status
   `SUCCESS`, `canRollback: true`. It is the successful deployment preceding this proposed release;
   revalidate it if another release occurs first. No rollback was executed.
3. Before approving release, the operator confirms the intended mechanism in Railway:
   **Service → Deployments → candidate deployment menu → Rollback → confirm**. Check the retained
   image and configuration snapshot: Railway rollback restores both the image and custom variables,
   and older candidates may expire under retention. Do not expose variable values in the record.
   See [Railway deployment actions](https://docs.railway.com/deployments/deployment-actions#rollback).
   If the candidate is unavailable or the operator cannot perform rollback, hold the release until
   an alternative rollback plan is reviewed and approved; do not improvise a redeploy.
4. Only after gate 2 approval, the owner merges and the operator observes the resulting Railway
   build and deployment. Confirm the deployed SHA equals the approved source and the service reaches
   `SUCCESS`; check `/health`, the beta hub's sign-in gate, signed-out feedback/review/image API
   denial, and the documented read-only route checks. Do not send a live POST at this step.
5. After gate 3 approval, run the non-admin A/B checklist below with synthetic data only: submission,
   same-record editing, reviewer isolation, annotated PNG failure/retry, and private admin retrieval.
   Record the deployed SHA, times, expected/actual statuses and sanitized pass/fail results privately;
   never include feedback text, email lists, tokens, private object paths or screenshots in public logs.
6. Monitor Railway service health, request error rates and sanitized feedback API error counts
   through the smoke-test window. Use aggregate metrics; inspect logs only with redaction and avoid
   request bodies. Do not infer successful submission from row counts or mocks.
7. Roll back to the confirmed candidate if new submission/retrieval failures, missing images, access
   regressions or unhealthy service behavior appear. Record the failed deployment and reason,
   perform the confirmed rollback, verify the restored source SHA/health/API behavior and document
   the smoke-test results. A rollback does not delete test rows or orphan images. Hold invitations
   and gate 4 until the owner accepts the live evidence and each module's gate.

## Production schema and migration history

Independently inspected main-site **Endoreels** (`tqnhxlwvkkswuckszlee`), not IP_Literature,
at **2026-11-10 17:59:14 UTC**. Queries returned catalog metadata and aggregate counts only.
No report bodies, account lists or screenshots were fetched.

Reproducible read-only query: [`inspect-production.sql`](../../scripts/module-beta/inspect-production.sql).
Executed with the connected Supabase `execute_sql` tool against the project above; migration
history was also independently obtained with `list_migrations`.

| Checked-in migration version/name                                 | Production history                      | Live object/effect                                 |
| ----------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| `20260912234953_module_beta_feedback`                             | Same name, version **`20260925055413`** | Feedback table and private screenshot bucket exist |
| `20260925055243_expand_module_beta_feedback_catalog`              | Same name, version **`20260925055423`** | `ebus-guided` accepted                             |
| `20261004072344_add_eus_b_simulator_to_module_beta_feedback`      | Same name, version **`20261007011957`** | `eus-b-simulator` accepted                         |
| `20261016025933_add_literature_atlas_to_module_beta_feedback`     | **No version or name entry**            | `literature-atlas` accepted                        |
| `20261103180000_add_dolphin_bronchoscopy_to_module_beta_feedback` | **No version or name entry**            | `dolphin-bronchoscopy` accepted                    |
| `20261109120000_module_beta_reviews`                              | **No version or name entry**            | Review table exists and matches expected schema    |

The live schema matches the cumulative checked-in beta migrations; no schema difference was
detected in the following comparison. History alone cannot establish when or how the unrecorded
effects arrived. Do not label these three effects absent, mark their migration files applied, or
blindly rerun the `CREATE TABLE` SQL. History reconciliation needs a separately authorized,
reviewed plan that first rechecks this inventory and the differently timestamped entries.

- **Reviews:** all 10 column names, types, nullability and defaults match: `id`, `user_id`,
  `tester_email`, `module_id`, `track`, `profile_snapshot`, `answers`, `form_version`,
  `created_at`, `updated_at`. Primary key, `ON DELETE SET NULL` user FK, bounded module-ID
  regex, track choices, JSON object/32,768-byte checks, positive form version, unique
  `(user_id,module_id)` constraint/index and `(module_id,updated_at DESC)` index match.
- **Feedback:** all 13 column names, types, nullability/defaults, primary key, two user FKs,
  page/comment/selection/status/notes checks and all four secondary indexes match the base SQL.
  The final module-ID check matches the November 3 migration exactly in allowed values:
  the 15 current catalog IDs plus retired `therapeutic-bronchoscopy` (16 total).
- **Access:** both tables have RLS enabled, no table policies, and no effective SELECT/INSERT/
  UPDATE/DELETE for `anon` or `authenticated`; no PUBLIC/browser column grants. `service_role`
  has all four permissions. Every checked constraint is validated. The tables are owned by
  `postgres`; RLS is not forced, as expected by the migration's server-access model.
- **Screenshots:** bucket `module-beta-feedback` is private, permits only `image/png`, and limits
  uploads to 3,145,728 bytes. The restrictive `ALL` policy on `storage.objects` excludes this
  bucket for `anon` and `authenticated` in both USING and WITH CHECK, matching the base SQL.
- **Counts:** 1 overall review; 74 detailed reports; 49 non-null screenshot references.
  A reference count does not verify object existence, valid PNG bytes or successful admin retrieval.

This comparison is limited to beta objects and their listed migration history, not the entire
shared Endoreels database or other products' migrations.

## All 11 visible modules

Read-only production check:
`npx tsx scripts/module-beta/verify-hub-routes.ts --base-url=https://interventionalpulm.com`.
Every wrapper below returned **307 to `/en/login?next=…`** when signed out. Every standard route
returned **200**, `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'`.
The local wrapper browser test resolves every catalog ID and checks its frame URL; its inner
module content is synthetic. The separate standard-route test requests the real local pages.

| Module ID (wrapper suffix after `/en/development-beta/`) | Standard route after `/en`        | Live DB accepts ID |
| -------------------------------------------------------- | --------------------------------- | ------------------ |
| `ebus-guided`                                            | `/ebus-guided`                    | Yes                |
| `eus-b-simulator`                                        | `/eus-b-simulator`                | Yes                |
| `synchronized-anatomy`                                   | `/learn/anatomy/airway`           | Yes                |
| `branch-tracing`                                         | `/learn/anatomy/branch-tracing`   | Yes                |
| `peripheral-imaging`                                     | `/peripheral-imaging`             | Yes                |
| `bronchoscopy-foundations`                               | `/bronchoscopy-foundations`       | Yes                |
| `cardiohelp-ecmo`                                        | `/cardiohelp-ecmo`                | Yes                |
| `baxter-crrt`                                            | `/baxter-crrt`                    | Yes                |
| `icu-hemodynamics`                                       | `/icu-hemodynamics`               | Yes                |
| `mechanical-ventilation`                                 | `/mechanical-ventilation`         | Yes                |
| `mechanical-circulatory-support`                         | `/mechanical-circulatory-support` | Yes                |

All 11 stay `preview`. The four withheld catalog entries stay withheld. Signed-out redirects
alone do not prove that a non-admin can open a module after signing in, or that all assets load.

## Initial validation and baseline review (reviewed head)

Commands run from the permanent Codex worktree. Test output is local under `/tmp/beta-pr1-*`;
only sanitized results are committed here. This section preserves the initial evidence at
`e2b0b525`; the independent-review repair validation is recorded separately below.

| Command                                                                                               | Baseline                            | Final                                                                       |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| `npx jest --runInBand src/features/module-beta src/app/api/module-review src/app/api/module-feedback` | 15 suites, 237 tests passed         | 16 suites, 250 tests passed                                                 |
| `npx playwright test --config playwright.module-beta.config.ts`                                       | 11 passed                           | 11 passed, 1 new assertion failed; scoped rerun below passed                |
| `npx tsc --noEmit`                                                                                    | Node's default ~4 GB heap exhausted | Same heap limit; see rerun below                                            |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                           | Not run before edits                | Passed after replacing stale generated types and running `npx next typegen` |
| `npm run lint`                                                                                        | Not run before edits                | Passed with 15 existing warnings, 0 errors                                  |
| Production route command above                                                                        | Not run before edits                | All 11 passed (signed out only)                                             |

The browser failure was an incorrect new expectation: after **Update review**, the existing
confirmation says "Your overall review is updated." The corrected test passed with:
`npx playwright test --config playwright.module-beta.config.ts --grep 'overall review:'`
(1 passed). All 12 scenarios therefore passed across the full run and the scoped rerun, not in
one uninterrupted final full-suite run.

Changed-code lint command (including the script and browser tests omitted by `npm run lint`):

```sh
npx eslint src/app/api/module-feedback/route.ts src/app/api/module-feedback/route.test.ts src/app/api/module-review/authorization.test.ts e2e/module-beta.spec.ts scripts/module-beta/verify-hub-routes.ts --max-warnings=0
```

Passed with zero warnings after renaming the new script's local `module` variable, which the
Next lint rule reserves. The 15 repository-wide warnings are in unchanged files; they include
existing effect-state, image-element and unused-variable warnings.

The October 6 finish-line board's four named Jest paths were checked with:

```sh
npx jest --runInBand src/features/critical-care/__tests__/accessibility.test.tsx src/features/critical-care/__tests__/curriculum-sequencing.test.tsx src/features/critical-care/__tests__/learner-copy.test.ts src/features/bronchial-branch-tracing/__tests__/contracts.test.ts
```

The three current critical-care suites passed (41 tests). The old Branch Tracing `contracts.test.ts`
path no longer exists, so that historical failure was not reproduced. These files are unchanged
by this PR. The historical hemodynamics/MCS browser failures and five unrelated suites on the old
board were not rerun; their old status is not evidence about this baseline. The full-repository
Jest suite, owner-local browser suite and production build were not run for this bounded server
feedback change.

New regression tests failed against the unchanged feedback handler before repair (two behavioral
failures plus the updated path assertion), then passed after repair. Type checking also caught
self-referential mock inference in the new test; explicit mock types fixed it. Stale ignored
`.next/types` contained an October 3 file referencing a removed airway layout and conflicted with
current `.next/dev/types`. A type check while the browser dev server was regenerating types also
reported disappearing generated files. After stopping the browser runner, the ignored stale
`.next/types` directory was moved to a temporary backup and `npx next typegen` recreated it before
the final type check. Neither generated files nor
environment files are part of the PR.

## Scenario matrix

| Scenario                                                               | Automated/local result                                 | Production result                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Verified non-admin complete learner + educator review                  | Passed, real auth helper + synthetic adapters          | Untested                                           |
| Edit same review; same ID and creation time, one row per user/module   | Passed, modeled upsert; browser edit/reload            | Untested real persistence; unique index inspected  |
| Forged account/email/profile/review ID cannot replace server identity  | Passed                                                 | Untested authenticated request                     |
| Reviewer B cannot read or overwrite A; all-review list admin-only      | Passed                                                 | Untested with two accounts                         |
| Annotated PNG failure preserves exact bytes and report ID on retry     | Passed in browser; API upload/retry tests passed       | Untested                                           |
| Upload/insert failure; delayed/lost commit response; overlapping retry | Passed, synthetic error injection; images retained after insert starts | Untested                                           |
| Expired/revoked/missing admin grant denies image before storage read   | Passed, real auth helper + synthetic entitlement query | Untested authenticated request                     |
| Current admin can retrieve an uncached PNG                             | Passed, synthetic storage                              | Untested real retrieval                            |
| Browser roles denied private table/bucket access                       | Live metadata matches intended rules                   | Metadata passed; authenticated HTTP untested       |
| Visible wrappers/catalog and standard route framing                    | Passed, all 11 local wrappers                          | Signed-out gates and 11 standard routes passed     |
| Migration ledger matches repository versions                           | Discrepancies documented                               | **Failed ledger parity**, schema comparison passed |

## Owner-run live verification checklist

This checklist does not authorize its own writes. Before running it, the owner must explicitly
authorize the existing test accounts **A and B**, synthetic review/report submissions, and any
cleanup. Record the deployed commit, time, browsers and account labels privately; keep emails,
session tokens, private object paths and screenshots out of the PR. Both accounts must be registered,
email-verified, profile-complete and have **no active `site_admin`**. Use separate normal browser
profiles; no preview cookies, service keys or admin session for the reviewer steps.

1. As A, open `/en/development-beta`. Confirm exactly 11 cards and walk every wrapper. Check the
   real module frame and asset requests, not just the outer 200 response. No module needs a new
   readiness label for this infrastructure check.
2. On one chosen module, submit a complete overall review using synthetic comments. Record the
   response's review ID and creation time privately; reload and confirm all answers. Edit one
   answer, update, reload: same review ID/creation time, changed answer. The owner verifies one
   database row for **that account + module** without exporting other reviews. Exercise the other
   answer track on an authorized test submission too.
3. As B, `/api/module-review/mine` must exclude A's review; `/api/module-review` and the feedback
   workspace must deny access. A submitted B review must remain B's own record; even forged
   account/record fields cannot change A's row. Run that extra submission only within the explicit
   test-write authorization.
4. As A, upload a synthetic PNG and add a box, arrow, drawing and text note. Block the feedback
   POST in browser devtools for one attempt: no saved confirmation, draft and image remain.
   Unblock and retry: one report, unchanged report ID and annotated PNG. Reload after success.
   This does not reproduce a production storage outage; do not change production infrastructure
   to simulate one.
5. In a separate existing admin session, confirm its `site_admin` grant is active and unexpired;
   open the synthetic report and retrieve the image. Check the marks and `private, no-store`.
   Inspect the synthetic overall review and its updated answer. The image request as A, B and
   signed out must return 403/403/401. Browser-role Storage download and public-bucket URL access
   to that synthetic image must fail. Never copy the private path or image into public evidence.
6. Check an already expired/revoked admin test session if explicitly available: image access must
   fail. Creating/changing entitlements for a live test needs separate owner authorization.
7. Record pass/fail/untested per step and the deployed SHA. Clean up only the explicitly authorized
   synthetic rows/objects. Stop distribution if real submission, edit, isolation or screenshot
   retrieval fails. Record the owner's migration-history disposition separately; do not replay
   `CREATE TABLE` or run a blanket migration push.

Launch requires that owner-run evidence plus the existing per-module acceptance/owner gate in
[`beta-finish-line.md`](beta-finish-line.md). This infrastructure PR grants no clinical acceptance,
publication approval or outreach authorization.
