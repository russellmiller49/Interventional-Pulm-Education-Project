# Production verification after PR #461

Date: 2026-11-10 (America/Los_Angeles). Target merge commit:
`657186b194ebe278bf5b9d7696e11315475afd80`.
Source handoff: [beta launch PR 1](beta-launch-pr1-2026-11-10.md).

**Current recommendation: NO-GO / hold for Module Collaborator Recognition.** The target
deployment has not yet completed, and authenticated production verification is not authorized
or complete. This is a pending infrastructure decision, not a finding that the repair failed.
No account was selected or used, and no production POST, PATCH, migration, account creation,
entitlement change, cleanup, merge, deployment action or invitation was performed in this pass.

## Four separate approval gates

| Gate                     | Evidence and boundary for this phase                                                                                                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Code review           | PR #461 is merged. Its code-review and repair evidence remain in the source handoff. This production check does not supply or retroactively infer a missing independent approval.                                                                                                                                                      |
| 2. Merge and deployment  | GitHub confirms the owner merged #461 at 20:09:25 UTC (12:09:25 PST). The resulting merge has parents `54a02a1a104a552ea66d85d49bfa02af70fec1de` and `461855b19a127484b1b3c7495862cd0596b0815d`. Observe the existing automatic rollout only; no additional release action is authorized.                                              |
| 3. Synthetic live tests  | **Pending.** The owner must name two existing dedicated non-admin test accounts, A and B, and a separate existing admin account C, and explicitly authorize the bounded synthetic writes below. No identities, credentials or usable test sessions were supplied in this request. Deployment approval does not authorize these writes. |
| 4. Real beta invitations | **Closed.** No invitation or distribution approval is inferred from infrastructure verification. Existing module acceptance/owner gates still apply.                                                                                                                                                                                   |

The user explicitly prohibited unapproved account creation, production submissions, entitlement
changes, record cleanup and migrations. The handoff additionally states: “This checklist does
not authorize its own writes.” Nothing in this procedure grants those permissions.

## Deployment and read-only evidence

Railway connection: `marvelous-heart`, project `e251e547-04fc-4d0b-bdc4-a73809b2307b`;
production environment `8f179798-b586-4013-a0fb-130c9b4eb088`; service
`Interventional-Pulm-Education-Project`, `4a1754d2-0778-488e-96c7-5ec047b90e6a`.
Reads used the connected Railway tools. No variable values were requested.

| Item                                  | Observed evidence                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target deployment                     | `08d8b84b-bf33-4e4b-96e2-cfa32426bc24`, created 20:09:27.741 UTC; **BUILDING** initially, **DEPLOYING** at 20:24:40.782 UTC; rollout pending at 20:26 UTC.                                                                                                         |
| Target source                         | Railway metadata reports the exact full target SHA, branch `main`. This proves the queued build source, not yet the serving source.                                                                                                                                |
| Previously successful serving release | `561529fc-2bce-48e4-9139-3999f85b7eb7`, source `54a02a1a104a552ea66d85d49bfa02af70fec1de`, `SUCCESS`.                                                                                                                                                              |
| Source/configuration                  | Repository `russellmiller49/Interventional-Pulm-Education-Project`, `main`, `checkSuites: false`; one replica in `us-west2`; no staged changes.                                                                                                                    |
| Builder evidence                      | Service configuration says `RAILPACK` / V3. This deployment's actual build log says **Nixpacks v1.41.0**, Node 22, `npm install --legacy-peer-deps`, `npm run build`, `npm run start:prod`. Record this distinction; no setting was changed.                       |
| Build progress                        | Production webpack compilation and TypeScript passed; all 850 static pages generated at 20:20:26 UTC and standalone packaging completed at 20:20:53 UTC. Image export/push completed and rollout began at 20:24:40 UTC; deployment success remains pending.        |
| Build observations                    | Warnings included dependency deprecations/audit notices, embedded bundle sizes, stale Browserslist data, dynamic dependency extraction and metadataBase fallback to localhost. No failure was reported. These observations are not a dependency or metadata audit. |
| Runtime before replacement            | Old release logs, 19:09 UTC onward: one `Failed to find Server Action` error event at 19:37:57 UTC (three log lines), preceding this rollout. Do not attribute it to #461. No beta submission/retrieval error was identified in that bounded sample.               |
| Environment health                    | No warning/critical notifications or failed/crashed deployments in the inspected two-hour window; target rollout still pending.                                                                                                                                    |
| Aggregate traffic before replacement  | Last-hour Railway snapshot: 283 requests; 222 2xx, 60 3xx, 1 4xx, 0 5xx. This includes the prior release and is not post-release evidence.                                                                                                                         |
| Resource snapshot before replacement  | Last-hour CPU average 0.00317, max 0.03583; memory current 0.500 GB, max 0.562 GB, 61 samples.                                                                                                                                                                     |

Read-only HTTP baseline at **20:17:12–13 UTC (12:17:12–13 PST)**, with no cookies or
Authorization header. These responses belong to the release serving during the target build;
repeat them after target `SUCCESS` before crediting them to #461.

| GET request                                                       | Expected                                       | Actual                                               |
| ----------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| `/health`                                                         | 200, `{"ok":true}`, uncached                   | PASS; `Cache-Control: no-store`                      |
| `/en/development-beta`                                            | 307, `/en/login?next=%2Fen%2Fdevelopment-beta` | PASS; `private, no-store`                            |
| `/en/login?next=%2Fen%2Fdevelopment-beta`                         | 200, sign-in form                              | PASS; email/password inputs and sign-in text present |
| `/api/module-feedback`                                            | 401 JSON                                       | PASS                                                 |
| `/api/module-review`                                              | 401 JSON                                       | PASS                                                 |
| `/api/module-review/mine`                                         | 401 JSON                                       | PASS                                                 |
| `/api/module-feedback/00000000-0000-4000-8000-000000000001/image` | 401 before record lookup                       | PASS; synthetic sentinel ID                          |
| `/en/admin/module-feedback`                                       | 307 to login, preserving `next`                | PASS                                                 |

Every API denial above returned `Cache-Control: private, no-store` and the sign-in-required
JSON error. No live POST or PATCH was sent, including unauthenticated write probes.

Per-path Railway last-hour aggregates collected after this baseline showed one 4xx and zero 5xx
for each of `/api/module-feedback`, `/api/module-review` and `/api/module-review/mine`,
consistent with these signed-out probes. They establish no authenticated submission success.

The existing read-only route checker also passed for all 11 modules:

```sh
npx tsx scripts/module-beta/verify-hub-routes.ts --base-url=https://interventionalpulm.com
```

It checks wrapper 307/login/`next`, real standard-route 200, `X-Frame-Options: SAMEORIGIN`,
and CSP `frame-ancestors 'self'`. It does not load module assets or authenticate anyone.

## Exact authenticated procedure — prepared, not executed

### Owner authorization and preflight

Record A, B and C's existing account identifiers and browser profiles privately. A and B must
be dedicated synthetic test accounts, registered, email-verified, profile/consent-complete,
and without an active `site_admin` grant. C must be a distinct, email-verified existing admin
test/operator account with an active grant whose expiry is absent or strictly in the future.
Check only those named users. Never enumerate accounts or use an existing clinician's account.
If an account fails preflight, stop that account's test; do not complete registration, reset
passwords, resend verification, grant access, or create a replacement without permission.

Use three separate normal browser profiles and a fourth clean signed-out context. The owner
signs in through the normal production flow; do not request passwords or tokens in chat.
No local-preview cookies, intercepted successful API responses, service keys in the browser,
or saved authentication-state/HAR exports. Disable browser cache for the image checks.

Authorize this precise bounded write scope before execution:

- Module under test: `ebus-guided`; two overall-review records, one for A and one for B.
- Four overall-review POSTs: A's learner submission, A's edit, B's educator submission, and
  B's identity-forgery replay described below. Replays must affect only B's own record.
- One synthetic annotated report/image from A; one locally blocked send (never forwarded),
  one actual send, one same-user duplicate POST, and one B collision POST expected to be denied.
  Normal success creates exactly one report and one private PNG; denied/idempotent requests
  must not create additional rows or images. Unexpected ambiguous failures may leave private
  orphan images; stop and record rather than authorize unbounded retries or cleanup.
- Scoped verification reads of those synthetic records, A/B/C's account eligibility, and
  C's view of the synthetic report/reviews. Workspace pages can fetch existing feedback;
  inspect only the synthetic entries and do not export lists or unrelated records.
- **No cleanup is included.** Keep the synthetic rows/objects until separate, ID-scoped
  cleanup authorization. No status/notes PATCH is needed for this procedure.

Before the first test, recheck target `SUCCESS`, exact deployed SHA, running replica, health,
and rollback eligibility. Record UTC times and browser versions privately. Stop if another
deployment replaces the target. Do not treat responses from a build-in-progress as target evidence.

### 1. Both non-admin accounts: all 11 wrappers

As A, open `/en/development-beta`; dismiss/read the first-visit feedback guide. Confirm exactly
11 “Test with feedback” cards under “Still in development”, none “Ready for review”, and no
cards for `live-anatomy`, `dolphin-bronchoscopy`, `devices` or `literature-atlas`.
Walk every wrapper below. Repeat the wrapper access/asset check as B. For each, verify the outer
page loads, the real iframe URL matches, recognizable module UI renders, and ordinary module
navigation/visual controls work. Do not submit assessments or save learner progress as part of
this bounded test. Inspect actual required asset requests, including lazy assets after navigation: no 404/5xx, unauthorized login HTML, frame denial or browser runtime error. A 200
outer page alone is insufficient. Record module-specific failures without changing module labels.

| Wrapper suffix after `/en/development-beta/` | Expected iframe path                 | Signed-out baseline | A live   | B live   |
| -------------------------------------------- | ------------------------------------ | ------------------- | -------- | -------- |
| `ebus-guided`                                | `/en/ebus-guided`                    | PASS                | UNTESTED | UNTESTED |
| `eus-b-simulator`                            | `/en/eus-b-simulator`                | PASS                | UNTESTED | UNTESTED |
| `synchronized-anatomy`                       | `/en/learn/anatomy/airway`           | PASS                | UNTESTED | UNTESTED |
| `branch-tracing`                             | `/en/learn/anatomy/branch-tracing`   | PASS                | UNTESTED | UNTESTED |
| `peripheral-imaging`                         | `/en/peripheral-imaging`             | PASS                | UNTESTED | UNTESTED |
| `bronchoscopy-foundations`                   | `/en/bronchoscopy-foundations`       | PASS                | UNTESTED | UNTESTED |
| `cardiohelp-ecmo`                            | `/en/cardiohelp-ecmo`                | PASS                | UNTESTED | UNTESTED |
| `baxter-crrt`                                | `/en/baxter-crrt`                    | PASS                | UNTESTED | UNTESTED |
| `icu-hemodynamics`                           | `/en/icu-hemodynamics`               | PASS                | UNTESTED | UNTESTED |
| `mechanical-ventilation`                     | `/en/mechanical-ventilation`         | PASS                | UNTESTED | UNTESTED |
| `mechanical-circulatory-support`             | `/en/mechanical-circulatory-support` | PASS                | UNTESTED | UNTESTED |

### 2. A: complete learner review and same-record editing

Use these fixed synthetic choices for reproducibility; they are test inputs, not clinical or
teaching judgments. Give both comment fields a unique synthetic-run marker, kept privately.

| Fields     | Synthetic values                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Common     | `coverage=less-than-half`, `experience=new`, `overall=3`, `clarity=3`, `easeOfUse=3`, `interactive=3`, `level=about-right`, `readiness=not-ready` |
| A learner  | `confidenceBefore=1`, `confidenceNow=2`, `wouldUse=probably-not`                                                                                  |
| B educator | `accuracy=cant-judge`, `consistent=in-parts`, `wouldAssign=no`; each exact current module prompt has `verdict=not-reached`                        |

On `/en/development-beta/ebus-guided`, choose **Overall review → A learner**. Use synthetic
answers for this infrastructure test, explicitly labelled as such in both comment fields.
Do not interpret the synthetic ratings as module acceptance. Complete all common fields:
coverage, prior experience, overall, clarity, ease of use, interactivity, level and readiness;
also confidence before/now and would-use. Choose readiness `not-ready` to avoid a synthetic
readiness endorsement. Submit using **Send review**.

Expect `POST /api/module-review` **200**, a saved confirmation and a returned review. Keep its
ID, `created_at`, `updated_at`, track and answer values privately. Reload; expect
`GET /api/module-review/mine` **200**, `reviewsOpen: true`, the same module review and all
answers restored. Choose **Edit overall review**, change only the synthetic one-fix answer,
then **Update review**: expect **200**, the same ID and creation time, a later update time,
and the edited answer after another reload. The owner checks exactly one row for A + this
module with a narrowly scoped database read; row counts alone do not prove saved answers.

### 3. B: educator review, isolation and forged identity fields

Before B submits, `GET /api/module-review/mine` must be **200** and exclude A's review ID and
answers. Adding A's account/record identifiers as query parameters must not expand B's result.
`GET /api/module-review` and `GET /api/module-feedback` must return **403**, uncached JSON.
Opening `/en/admin/module-feedback` must redirect away to `/en/dashboard?required=site_admin`
(307), with no workspace or private data rendered.

On the same wrapper, B chooses **An educator or practicing clinician**. Complete the common
fields plus accuracy, consistency, would-assign and **every current module-specific prompt**.
Use the prompts exactly as rendered by the current form; do not paste stale wording. Label
comments synthetic and use readiness `not-ready`. Submit through the UI: expect **200**,
B's own distinct review ID, persistence on reload and no A review in B's `/mine` response.

Within the explicitly approved forgery replay, repeat B's valid educator JSON once from B's
same-origin session, adding top-level `id`/`reviewId` = A's synthetic review ID,
`user_id`/`userId` = A's test ID, `tester_email` = A's test email, and `profile_snapshot` = A's
test profile. Preserve the valid `moduleId`, `track` and `answers`. Expected **200** with B's
original review ID: unknown identity fields are ignored and server identity prevails. Verify
the stored user/email/profile are B's, B still has one row for the module, and A's ID, creation
time, update time and edited answers are unchanged. Reload both accounts. Stop immediately
on any cross-account data or overwrite; do not probe other users or modules.

### 4. A: annotated PNG, one blocked send, retry and idempotency

On the same module, choose **Give feedback**, enter a synthetic comment and selected-text
reference, and upload a synthetic PNG containing no patient/account information. Add a **Box**,
**Arrow**, **Draw** stroke and **Text** note; confirm four annotations. Choose **Continue
testing**, then **Continue feedback** and confirm the comment, page context and marks remain.

Locally block only the first `POST /api/module-feedback` before it reaches production, using
browser request blocking or a one-shot browser route abort. Capture only the multipart report
UUID and SHA-256 of the annotated PNG privately, not cookies, request bodies or object paths.
Attempt **Send feedback**: expect a browser network failure (no server HTTP status), no saved
confirmation, and the same open draft/image/marks. Do not reload the page while it is unsent:
server-mode drafts live in this page's memory.

Remove that local block and send once. Expect the **same UUID and PNG bytes**, real
`POST /api/module-feedback` **201** (or **200** only if reconciling an already persisted attempt),
saved confirmation and the returned report ID. Reload only after success. The owner verifies
one row for this exact report ID owned by A and a non-null screenshot reference; C's actual
download in step 5 establishes the object exists and contains the annotated bytes.

Replay that exact same A multipart submission once: expect **200**, the same report ID, one
row and no replacement upload. As B, replay once with that same synthetic report ID: expect
**409**, A's report/image unchanged and no B row/object created. These extra POST attempts
require the bounded authorization above. Do not inject server/storage outages, delayed commits
or production configuration failures; those remain local regression-test evidence only.

### 5. C: private admin retrieval and access-denial matrix

Use C's separate, eligible admin session. Open the feedback workspace and locate only A's
synthetic report; its API may be scoped with `module=ebus-guided&user=<A-test-ID>`. Do not
change status/notes or export feedback. View the synthetic overall reviews and confirm A's
edited answer and B's distinct identity; restrict inspection to the synthetic entries.

Choose **View annotated screenshot** / open
`/api/module-feedback/<synthetic-report-ID>/image` with cache disabled. Expect **200**,
`Content-Type: image/png`, `Cache-Control: private, no-store`,
`X-Content-Type-Options: nosniff`. Compare the downloaded PNG's SHA-256 with A's submitted
annotated PNG, decode it, and visibly confirm the box, arrow, drawing and text. Record only
the comparison outcome publicly. Reload and retrieve uncached again; it must still work.

| Context / endpoint                                             | Expected result                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| C, GET `/api/module-review` and `/api/module-feedback`         | 200; inspect only approved synthetic entries                                              |
| C, GET synthetic `/image`                                      | 200 PNG with exact marks/bytes and private/no-store                                       |
| A, GET synthetic `/image`                                      | 403 JSON, private/no-store; no PNG bytes                                                  |
| B, GET synthetic `/image`                                      | 403 JSON, private/no-store; no PNG bytes                                                  |
| Clean signed-out context, GET synthetic `/image`               | 401 JSON, private/no-store; no PNG bytes                                                  |
| A/B, GET both admin list APIs                                  | 403 JSON; no list data                                                                    |
| A/B browser-role direct table GETs, scoped to synthetic IDs    | Permission denied, no rows (normally 401/403 with permission error); record actual status |
| A/B browser-role Storage download of the exact synthetic image | Non-success/error and no image bytes; record actual status                                |
| Signed-out public-bucket URL for that exact image              | Non-success and no image bytes; record actual status                                      |

For direct Storage checks use the existing normal browser client with its public API key and
own user token, never a service key. Check the authenticated object endpoint and public object
endpoint for the private `module-beta-feedback` bucket. Keep the exact private path and all
headers/tokens out of transcripts and public evidence. Successful admin server retrieval does
not imply direct browser-role Storage permission. Supabase's [private-bucket documentation](https://supabase.com/docs/guides/storage/serving/downloads#private-buckets)
describes the authenticated download route; the project's policies should still deny it here.

An **already existing, explicitly named expired/revoked admin test session** may additionally
request the image: expect **403** if still signed in, or **401** if unauthenticated. If none is
authorized/available, mark this optional case **UNTESTED**; do not create
a fourth account or change a grant to manufacture the case. Local expiry tests are not live proof.

### 6. Evidence, monitoring and stopping rules

Record start/end/deployment SHA, account labels, browser versions, test case, expected/actual
status and pass/fail/untested. Keep the mapping to test account IDs, review/report IDs,
creation/update times, PNG hashes and object inventory in the private owner record outside Git.
Do not publish feedback text, emails, tokens, screenshots or private object paths. Retain only
sanitized outcomes in this report. No test cleanup is authorized by default.

Capture Railway aggregate 2xx/3xx/4xx/5xx totals and per-path totals for `/api/module-review`,
`/api/module-review/mine` and `/api/module-feedback` before/after the authorized window; classify
the expected 401/403/409 probes. Inspect bounded, redacted runtime errors without request bodies.
Check the replica and `/health` through the window. Distinguish the old-release Server Action
event from any new event. Stop on failed persistence/edit/isolation/retrieval, missing images,
unexpected access, uncontrolled retry, changed deployed SHA or service degradation. Notify the
owner with the failed deployment and sanitized reason; execute no rollback without authorization.

## Rollback readiness

Candidate revalidated initially: deployment `561529fc-2bce-48e4-9139-3999f85b7eb7`, source
`54a02a1a104a552ea66d85d49bfa02af70fec1de`, created 2026-11-10 02:15:16.636 UTC,
`SUCCESS`, `canRollback: true`, `canRedeploy: true`; configuration snapshot
`561da18a-2366-45b1-bdd2-9381658f7b0b` present in metadata. No rollback/redeploy was executed.

Operator remains Russell Miller or an explicitly named delegate. Intended mechanism remains
**Railway service → Deployments → candidate menu → Rollback → confirm**. Railway documents
that [rollback restores the image and custom variables, subject to retention](https://docs.railway.com/deployments/deployment-actions#rollback).
Tool eligibility is verified; operator access and acceptance of that retained configuration
snapshot still need owner confirmation without exposing variable values. Revalidate eligibility
after rollout and immediately before any authorized rollback. Do not substitute Deploy Latest,
Redeploy, a new merge, a migration or an entitlement change.

After an authorized rollback, confirm the restored deployment/source, health and read-only
gate checks; record the failed target and reason. Rollback does not remove synthetic rows or
private orphan objects. Cleanup remains a separate authorization.

## Blockers and decision criteria

1. Target rollout is pending: serving target SHA, completed deployment and target
   runtime checks remain unconfirmed. Baseline HTTP successes cannot close this blocker.
2. A/B/C have not been named or authorized; every authenticated case remains **UNTESTED**.
3. Owner confirmation of rollback operator/configuration readiness is not recorded in this phase.
   The handoff's migration-ledger discrepancy remains a separate owner disposition, not a new
   approval gate or evidence of missing live tables: three
   unrecorded migration effects and differently timestamped earlier entries were documented,
   with live schema parity at that inspection. This pass did not re-query or modify the schema.
   **Do not replay missing migrations, mark ledger entries applied or run a blanket push.**

Issue an infrastructure **GO for proceeding to Module Collaborator Recognition** only after
the exact deployed SHA/build/runtime checks and all required authorized live cases pass and
rollback readiness is confirmed. Disclose any unavailable optional expired/revoked-session case
and record the owner's migration-history disposition separately; ledger repair is not implied. Any real persistence, image or isolation failure is
**NO-GO**. Pending authorization is **NO-GO / hold**, not an executed-test failure. A GO remains
limited to infrastructure and next-phase planning: it does not approve recognition publication,
module clinical acceptance, readiness changes or gate-4 invitations.
