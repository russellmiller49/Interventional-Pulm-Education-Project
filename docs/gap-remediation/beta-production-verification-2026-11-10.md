# Production verification after PR #461

Date: 2026-11-10 (America/Los_Angeles). Target merge commit:
`657186b194ebe278bf5b9d7696e11315475afd80`.
Source handoff: [beta launch PR 1](beta-launch-pr1-2026-11-10.md).

**Current recommendation: NO-GO / hold for Module Collaborator Recognition pending Gate 3.**
The exact target SHA is deployed successfully and read-only production checks pass. Authenticated
production verification is in progress with explicitly named, existing A/B/C accounts. All
authorized writes and non-admin/public access checks passed. C's uncached private image retrieval
is the remaining live case. No PATCH, migration, account creation, entitlement change, cleanup,
merge, deployment action or invitation was performed.

## Four separate approval gates

| Gate                     | Evidence and boundary for this phase                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Code review           | PR #461 is merged. Its code-review and repair evidence remain in the source handoff. This production check does not supply or retroactively infer a missing independent approval.                                                                                                                                                                           |
| 2. Merge and deployment  | GitHub confirms the owner merged #461 at 20:09:25 UTC (12:09:25 PST). The resulting merge has parents `54a02a1a104a552ea66d85d49bfa02af70fec1de` and `461855b19a127484b1b3c7495862cd0596b0815d`. Observe the existing automatic rollout only; no additional release action is authorized.                                                                   |
| 3. Synthetic live tests  | **Authorized and running.** The owner supplied actual A/B/C identifiers and separately signed-in sessions, confirmed A's pre-existing EBUS review was synthetic and could be replaced, and authorized the bounded procedure with all exclusions retained. A/B live admin-list requests return 403. Private account and record identifiers stay outside Git. |
| 4. Real beta invitations | **Closed.** No invitation or distribution approval is inferred from infrastructure verification. Existing module acceptance/owner gates still apply.                                                                                                                                                                                                        |

The user explicitly prohibited unapproved account creation, production submissions, entitlement
changes, record cleanup and migrations. The handoff additionally states: “This checklist does
not authorize its own writes.” Nothing in this procedure grants those permissions.

## Deployment and read-only evidence

Railway connection: `marvelous-heart`, project `e251e547-04fc-4d0b-bdc4-a73809b2307b`;
production environment `8f179798-b586-4013-a0fb-130c9b4eb088`; service
`Interventional-Pulm-Education-Project`, `4a1754d2-0778-488e-96c7-5ec047b90e6a`.
Reads used the connected Railway tools. No variable values were requested.

| Item                                  | Observed evidence                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target deployment                     | `08d8b84b-bf33-4e4b-96e2-cfa32426bc24`, created 20:09:27.741 UTC; **SUCCESS** at 20:26:45.146 UTC (12:26:45 PST).                                                                                                                                                                                          |
| Target source                         | Confirmed live: Railway reports exact full SHA `657186b194ebe278bf5b9d7696e11315475afd80`, branch `main`, deployment SUCCESS; environment status lists only this active deployment with one running replica.                                                                                               |
| Previous release / rollback candidate | `561529fc-2bce-48e4-9139-3999f85b7eb7`, source `54a02a1a104a552ea66d85d49bfa02af70fec1de`; SUCCESS before replacement, REMOVED at 20:26:49 UTC after replacement, still `canRollback: true`.                                                                                                               |
| Source/configuration                  | Repository `russellmiller49/Interventional-Pulm-Education-Project`, `main`, `checkSuites: false`; one replica in `us-west2`; no staged changes.                                                                                                                                                            |
| Builder evidence                      | Service configuration says `RAILPACK` / V3. This deployment's actual build log says **Nixpacks v1.41.0**, Node 22, `npm install --legacy-peer-deps`, `npm run build`, `npm run start:prod`. Record this distinction; no setting was changed.                                                               |
| Build progress                        | Production webpack compilation and TypeScript passed; all 850 static pages generated at 20:20:26 UTC and standalone packaging completed at 20:20:53 UTC. Image export/push completed; rollout began at 20:24:40 UTC and reached SUCCESS at 20:26:45 UTC. The actual Railway production pipeline completed. |
| Build observations                    | Warnings included dependency deprecations/audit notices, embedded bundle sizes, stale Browserslist data, dynamic dependency extraction and metadataBase fallback to localhost. No failure was reported. These observations are not a dependency or metadata audit.                                         |
| Runtime before replacement            | Old release logs, 19:09 UTC onward: one `Failed to find Server Action` error event at 19:37:57 UTC (three log lines), preceding this rollout. Do not attribute it to #461. No beta submission/retrieval error was identified in that bounded sample.                                                       |
| Environment health                    | Target Online / SUCCESS; 1 running, 0 crashed replicas; no pending rollout work, no warning/critical notifications, no failed/crashed deployments in the inspected window.                                                                                                                                 |
| Aggregate traffic before replacement  | Last-hour Railway snapshot: 283 requests; 222 2xx, 60 3xx, 1 4xx, 0 5xx. This includes the prior release and is not post-release evidence.                                                                                                                                                                 |
| Resource snapshot before replacement  | Last-hour CPU average 0.00317, max 0.03583; memory current 0.500 GB, max 0.562 GB, 61 samples.                                                                                                                                                                                                             |

Read-only HTTP checks ran without cookies or an Authorization header twice: baseline at
**20:17:12–13 UTC (12:17:12–13 PST)** on the preceding release, then **20:29:19–23 UTC
(12:29:19–23 PST)** after target SUCCESS. All results below passed in both runs. Target source
and one healthy running replica were confirmed independently with Railway metadata.

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

The Railway service domain `/health` also returned **200**, `{"ok":true}` at 20:29:21 UTC,
corroborating the custom-domain health check.

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

Target runtime logs from container start at **20:26:37 UTC** through inspection after rollout
showed Next.js starting on `0.0.0.0:8080` and reaching Ready. Observed stderr messages were npm
configuration and metadataBase warnings, not a crash or beta API exception. The metadataBase
warning resolves social metadata against localhost; no configuration was changed to suppress it.

Deployment-scoped HTTP logs, requested from 20:26:45 UTC and returned through **20:30:38 UTC**,
contained **122 distinct requests: 92 2xx, 24 3xx, 6 4xx, 0 5xx**, with no upstream errors.
The two overlapping log batches were deduplicated by timestamp, method, host, path and status;
neither reached the 500-entry cap. The four beta API requests were the expected signed-out 401s:
feedback list, review list, own reviews and synthetic image sentinel. The other two 4xx events
were unrelated `/api/analytics` POST 401s in service traffic; this agent sent only GETs.
Closing `/health` was still 200 / `{"ok":true}` around 20:30 UTC. Current service resource
samples were CPU 0 and memory 0.386 GB; the tool's one-hour averages span both releases and are
not post-release-only measurements. No new target runtime entries appeared during the HTTP
checks. This is a short read-only smoke window; no successful authenticated submission is claimed.

## Initial authorization follow-up and preflight recheck

At the follow-up, the owner authorized the four review POSTs affecting two records, one annotated
PNG/report with a locally blocked send and retry, duplicate replay, B's denied collision, and the
specified verification reads. Synthetic data only; stop on unexpected authorization/data-integrity
behavior. Account creation, entitlement changes, deletion/cleanup, additional submissions,
migrations and invitations remain excluded. This authorization persists; it need not be repeated.

The supplied A/B/C identifiers were still literal bracketed placeholders rather than actual
emails/IDs. Browser inventory exposed one connected Chrome profile; a mapping to three separate
A/B/C test sessions was not established. At that point no signed-in account was inspected or used, and a request for actual account
identifiers, profile/tab mapping and user-completed sign-in was pending.
Do not use an existing clinician account or select an account by guesswork.

At **20:33:11 UTC (12:33:11 PST)**, read-only Railway preflight still confirmed deployment
`08d8b84b-bf33-4e4b-96e2-cfa32426bc24` / exact target SHA / SUCCESS, one running replica,
zero crashed replicas, no pending rollout or recent failure/notification. The preceding deployment
remained `canRollback: true`. No synthetic live request was sent and no new test result is claimed.

## Authorized live execution — in progress

The owner subsequently supplied the actual account mapping and confirmed that A's existing EBUS
review is synthetic and may be replaced. The three named accounts were checked by a narrowly
scoped query: each exists, is email-verified, non-anonymous, not currently banned and registration-
complete; A and B have no active `site_admin`, while C does. Dashboard identities were confirmed
in their separate browser sessions before any production write. A uses `.com`, B uses `.org`
(the same Railway service and Endoreels backend), and C uses a separate `.com` incognito session.
This hostname/session distinction is part of the evidence; no cookies or tokens were exported.

| Live case                                                    | Expected                                                      | Actual so far                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| A own reviews / admin reviews / admin feedback GET           | 200 / 403 / 403                                               | PASS; private, no-store                                                                                                |
| B own reviews / admin reviews / admin feedback GET           | 200 / 403 / 403                                               | PASS on `.org`; private, no-store; own list initially empty                                                            |
| A hub / admin workspace                                      | 11 preview cards, no ready/withheld cards; workspace denied   | PASS; admin route ended at `/en/dashboard?required=site_admin`                                                         |
| A learner save                                               | 200, one own row, server identity/profile and all answers     | PASS at 21:39:25 UTC; all expected answers and profile/email checked in a scoped database read                         |
| A same-record edit and reload                                | 200, same ID/creation time, later update time, changed answer | PASS at 21:41:58 UTC; one row; all selections/comments restored in the real form after reload                          |
| B educator save / forged-identity replay                     | Two 200 responses affecting B only                            | PASS; new B row, three module prompts, reload and same B ID/creation time after the forged replay; A unchanged         |
| Annotated PNG blocked-send / retry / duplicate / B collision | Local failure, then 201, 200 and 409                          | PASS; four marks and draft preserved, identical UUID/PNG; one report/object, owner/path unchanged                      |
| C uncached image retrieval / A/B/signed-out image denial     | 200 PNG / 403 / 403 / 401                                     | A/B/signed-out PASS with private, no-store; C uncached read PENDING console focus                                      |
| Direct browser-role table and Storage denial                 | No private rows or image bytes                                | PASS; A/B valid identities, tables 403/42501, Storage 400/NoSuchKey; anonymous tables 401/42501 and public Storage 400 |
| Existing expired/revoked admin session                       | Denied, if explicitly available                               | UNTESTED; no such session supplied; no grants changed                                                                  |

Both accounts opened all 11 real top-level wrappers in browser windows. The expected real inner
frame and nonempty rendered module DOM were checked, with resource response statuses collected
from the frame tree. No opaque resource statuses or skipped frames occurred in the captured
samples. These are landing-frame/asset smoke checks, not full-course, layout or clinical acceptance.
One asset exception occurred for both accounts: Synchronized Anatomy requested
`scope_orientation_calibration.json` and received **400**. The current loader explicitly falls
back to an empty/default calibration on non-success or transport failure
(`AirwayAnatomyModule.tsx`, `fetchScopeOrientationCalibration`). The viewer did render; this is
recorded as an optional-asset exception, not silently counted as a clean network result or a
clinical calibration judgment. No upload, code or calibration change was made.

A discarded nested-wrapper probe was blocked because wrappers intentionally retain the default
`X-Frame-Options: DENY`; the successful checks used real top-level navigation without altering
security settings. Native Chrome focus interruptions were handled by verifying the active window
and using isolated tab control for B. The accidental tab-capture prompt was canceled and the
synthetic fixture selected through the native file picker. The owner added a box, arrow, drawing
and text note; all four were visually confirmed and survived Continue testing → Continue feedback.

A one-shot browser fetch guard blocked the first send before forwarding any production request.
The UI kept the draft and did not claim it was saved. The real retry returned **201**; the PNG
(13,822 bytes) and report UUID matched the blocked attempt. A's exact multipart replay returned
**200**, B's valid same-ID collision returned **409**, and a scoped database/Storage comparison
confirmed the same A-owned row and path and exactly one private object before/after. The approved
browser guard was removed by reload after success. This does not simulate a production storage
outage or a delayed database commit; those remain local regression-test evidence.

B's two **200** review responses affected its one new educator row. A query with A's identifiers
still returned only B's own review; forged top-level identity, profile and record fields did not
replace A's row or alter B's server-derived identity/profile. A's update timestamp and edited
answer remained unchanged. All four review POSTs and all three live feedback POST attempts are
accounted for; **do not repeat them**. Private receipts retain record IDs, expected/actual statuses,
image digest, exact path and comparison results outside Git. No records/objects were deleted.

The signed-out synthetic image request returned **401**; the public Storage URL returned **400**.
A/B image route requests returned **403**. Direct browser-role reads validated each browser token
against the correct named account (Auth user **200**) and returned **403 / 42501** for both private
tables and **400 / NoSuchKey** for private Storage. Anonymous table probes returned **401 / 42501**.
No auth state or tokens were exported. C's dashboard identity was confirmed; a manual console focus
handoff is pending because the native developer command did not reliably target its window.

At **21:51:40 UTC (13:51:40 PST)**, the target remained Online / SUCCESS with 1 running and
0 crashed replicas, no pending work, failures or warning/critical notifications. No target runtime
entries appeared since the 21:17 UTC account preflight. Last-hour per-path Railway totals were
`/api/module-review`: 2 2xx + 2 expected 4xx + 0 5xx; `/api/module-feedback`: 2 expected 4xx,
0 2xx/5xx. These counts agree with A's two saves and the A/B authorization probes; they are not
substitutes for the scoped persistence and browser checks above.

## Authorized test procedure and execution requirements

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

The owner has authorized this precise bounded write scope. Execution still requires actual A/B/C
identifiers and their separate normal production sessions:

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

| Wrapper suffix after `/en/development-beta/` | Expected iframe path                 | Signed-out baseline | A live                   | B live                   |
| -------------------------------------------- | ------------------------------------ | ------------------- | ------------------------ | ------------------------ |
| `ebus-guided`                                | `/en/ebus-guided`                    | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `eus-b-simulator`                            | `/en/eus-b-simulator`                | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `synchronized-anatomy`                       | `/en/learn/anatomy/airway`           | PASS                | OPEN; optional asset 400 | OPEN; optional asset 400 |
| `branch-tracing`                             | `/en/learn/anatomy/branch-tracing`   | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `peripheral-imaging`                         | `/en/peripheral-imaging`             | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `bronchoscopy-foundations`                   | `/en/bronchoscopy-foundations`       | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `cardiohelp-ecmo`                            | `/en/cardiohelp-ecmo`                | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `baxter-crrt`                                | `/en/baxter-crrt`                    | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `icu-hemodynamics`                           | `/en/icu-hemodynamics`               | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `mechanical-ventilation`                     | `/en/mechanical-ventilation`         | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |
| `mechanical-circulatory-support`             | `/en/mechanical-circulatory-support` | PASS                | OPEN / RENDER PASS       | OPEN / RENDER PASS       |

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

Candidate revalidated before and after rollout: deployment `561529fc-2bce-48e4-9139-3999f85b7eb7`, source
`54a02a1a104a552ea66d85d49bfa02af70fec1de`, created 2026-11-10 02:15:16.636 UTC,
`SUCCESS` before replacement, now `REMOVED` with **`canRollback: true`** and
`canRedeploy: true` after replacement; configuration snapshot
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

The deployed-source/build/health/signed-out gate portion is **PASS**. Remaining blockers:

1. All approved writes, persistence/isolation and non-admin/public denials passed. C's uncached
   image retrieval and filtered admin review/report reads still await the console focus handoff.
2. Owner confirmation of rollback operator/configuration readiness is not recorded in this phase;
   technical candidate eligibility is confirmed.

The handoff's migration-ledger discrepancy remains a separate owner disposition, not a new
approval gate or evidence of missing live tables: three unrecorded migration effects and
differently timestamped earlier entries were documented, with live schema parity at that
inspection. This pass did not re-query or modify the schema. **Do not replay missing migrations,
mark ledger entries applied or run a blanket push.**

Issue an infrastructure **GO for proceeding to Module Collaborator Recognition** only after
the exact deployed SHA/build/runtime checks and all required authorized live cases pass and
rollback readiness is confirmed. Disclose any unavailable optional expired/revoked-session case
and record the owner's migration-history disposition separately; ledger repair is not implied.
Any real persistence, image or isolation failure is **NO-GO**. Pending authorization is **NO-GO / hold**, not an executed-test failure. A GO remains
limited to infrastructure and next-phase planning: it does not approve recognition publication,
module clinical acceptance, readiness changes or gate-4 invitations.
