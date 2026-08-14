# Rollout runbook — dedicated Literature Supabase project

Status: **not executable.** This describes a future sequence. No step below has been performed, and
nothing in this repository will perform any of them on its own.

```
authorized:            false
notExecutable:         true
migrationAuthorized:   false
dataImportAuthorized:  false
```

Every step that touches a remote system requires a separate, explicit owner authorization. Two
distinct authorizations are needed: one for the migration, one for the Railway configuration. They
are not interchangeable, and neither is implied by merging the PR.

## Target

```
Project:   IP_Literature
Ref:       itcttmkxdxvwmwcmzmey
Region:    us-west-1
Postgres:  17
```

Explicitly excluded: `tqnhxlwvkkswuckszlee` (`Endoreels`) — authentication only.

## The one approved migration

```
Path:   supabase/migrations/20260727032621_add_literature_explorer.sql
SHA256: c737865cdde3572ed0c0c59c134530bbd7e86e2013d97e0b9edc06c27aa426da
Bytes:  37669
Count:  exactly 1
```

## Prohibited mechanisms

| Mechanism                            | Why                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `supabase db push`                   | Directory-scoped. Would apply all 33 migrations, including 9 deferred Literature ones and 23 unrelated ones. |
| `supabase migration repair`          | Rewrites history without applying SQL, destroying the audit trail.                                           |
| `supabase db reset`                  | Destructive against a remote project.                                                                        |
| Supabase GitHub integration          | Would deploy the whole mixed directory on every merge.                                                       |
| Ad-hoc SQL pasted into the dashboard | Unchecksummed; no receipt binds it to the approved migration.                                                |

## Sequence

### 1. Merge after independent review

Merge this PR only after the independent review in
[`dedicated-supabase-codex-review-handoff.md`](./dedicated-supabase-codex-review-handoff.md)
completes. Record the resulting `main` commit — it becomes the approved repository commit.

> After this merges and before step 12, production Literature reports _not configured_ rather than
> silently reading `Endoreels`. Both render no articles; the new behaviour is the honest one. This
> is expected, not a regression.

### 2. Verify the primary checkout

From the **primary checkout** (`…/Interventional-Pulm-Education-Project`), on `main`, clean, with
`HEAD == origin/main`.

### 3. Capture a read-only observation of the target

Print the statements:

```bash
npm run literature:dedicated:preflight -- --print-observation-sql
```

Run each in a **read-only session** against `IP_Literature`. Each is already wrapped in
`BEGIN READ ONLY; SET TRANSACTION READ ONLY; … ROLLBACK;`. Record the three results into an
observation document:

```json
{
  "projectRef": "itcttmkxdxvwmwcmzmey",
  "hostname": "db.itcttmkxdxvwmwcmzmey.supabase.co",
  "migrationVersions": [],
  "catalog": { "...": "result of statement 2" },
  "prerequisites": { "...": "result of statement 3" }
}
```

Never paste a credential into this document — the verifiers reject one if present, and they never
need it.

### 4. Run the read-only preflight

```bash
npm run literature:dedicated:preflight -- --approved-commit <sha> --observation <path.json>
```

All 20 checks must pass. Any failure — including a missing input — blocks the rollout. The preflight
applies nothing.

### 5. Obtain the migration authorization

The owner must state, in writing, all six of:

- project name `IP_Literature`;
- project ref `itcttmkxdxvwmwcmzmey`;
- migration path `supabase/migrations/20260727032621_add_literature_explorer.sql`;
- migration SHA-256 `c737865cdde3572ed0c0c59c134530bbd7e86e2013d97e0b9edc06c27aa426da`;
- the approved repository commit;
- that exactly one migration operation is permitted.

### 6. Apply exactly the authorized migration

Through a narrowly scoped mechanism that applies **only** that file, as a single transaction, and
records the version `20260727032621` in `supabase_migrations.schema_migrations`. Do not use any
mechanism from the prohibited table.

### 7. If the acknowledgement is lost, do not retry

Go directly to step 8. Do not resend the migration, do not run migration repair, do not compensate,
and do not edit migration history. The correct next action after an ambiguous acknowledgement is
observation, not correction.

### 8. Capture a second observation and run the postflight

Re-capture the observation as in step 3, adding `totalRowCount`, then:

```bash
npm run literature:dedicated:postflight -- --observation <path.json>
```

| Classification     | Meaning                                | Next action                        |
| ------------------ | -------------------------------------- | ---------------------------------- |
| `applied_correct`  | Exact history, exact inventory, 0 rows | Proceed to step 9                  |
| `not_applied`      | Nothing landed                         | Re-authorize from the preflight    |
| `partial_incident` | Half-built schema                      | **Stop.** Read-only reconciliation |
| `applied_drifted`  | Complete but wrong                     | **Stop.** Read-only reconciliation |
| `ambiguous`        | Could not be observed                  | **Stop.** Read-only reconciliation |

### 9. Produce a durable receipt

Record the migration path and SHA-256, the target ref, the approved commit, the classification, the
full object inventory, and the timestamp. Never record a credential.

### 10–11. Stop and re-authorize

The migration authorization is now spent. Railway configuration needs its own.

### 12. Add the Railway variables

Only after a separate authorization naming the Railway service and environment:

```
LITERATURE_SUPABASE_URL=https://itcttmkxdxvwmwcmzmey.supabase.co
LITERATURE_SUPABASE_SECRET_KEY=<sb_secret_… from the IP_Literature project>
LITERATURE_SUPABASE_EXPECTED_PROJECT_REF=itcttmkxdxvwmwcmzmey
```

Do **not** change `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY`. Site
authentication stays on `Endoreels`. Do not add any `NEXT_PUBLIC_LITERATURE_*` variable — the secret
must never reach a browser bundle. Read the variables back afterwards and confirm the service and
environment are the intended ones.

No CSP change is required: the Literature client is server-side only, so
`next.config.mjs`'s `connect-src` does not apply to it.

### 13. Deploy the reviewed commit

Deploy the approved commit — not a newer one.

### 14. Verify

- An authenticated Literature list and search return a **legitimate empty corpus**, not an error.
- Public and anonymous paths remain closed.
- No `NEXT_PUBLIC_*` Literature variable exists.

### 15. Stop

Do not ingest a canary. Do not import the corpus. Both are separate packages requiring separate
authorization.

## Explicitly out of scope

Not implemented and not authorized here: the unavailable-versus-empty UI correction, the
`robots.txt` repair, draft canary ingestion, full corpus ingestion, the V2 real-import operator, the
630-record review overlay, autonomous classifier work, public-beta publication, and automatic
GitHub-to-Supabase deployment.

## Owner decisions still required

1. **Operational CLIs.** `scripts/literature/lib/database.ts` and `gold-import-compensation-cli.ts`
   still read `LITERATURE_SUPABASE_SERVICE_ROLE_KEY` only. Widening them to accept
   `LITERATURE_SUPABASE_SECRET_KEY` was deliberately excluded to avoid entangling this change with
   the protected gold-import tooling. Decide whether that happens in a follow-up.
2. **Legacy alias retirement.** Decide when `LITERATURE_SUPABASE_SERVICE_ROLE_KEY` is removed
   outside production too.
3. **Admin gold-set surfaces.** Confirm it is acceptable that they error against a foundation-only
   database until the review-workflow migrations are separately authorized.
4. **Deferred-migration rollout.** If the gold-set chain is ever applied to `IP_Literature`, all
   nine deferred migrations must go in timestamp order — including the three whose filenames do not
   say "literature".
