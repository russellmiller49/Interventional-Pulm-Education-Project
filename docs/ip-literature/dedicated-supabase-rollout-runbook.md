# Rollout runbook — dedicated Literature Supabase project

Status: **not executable.** This describes a future sequence. No step below has been performed, and
nothing in this repository will perform any of them on its own.

```
authorized:            false
notExecutable:         true
migrationAuthorized:   false
dataImportAuthorized:  false
```

**Production migration is currently blocked** — not by policy alone, but structurally: the
provider-bound target attestation (Layer 3) is not implemented, so the preflight cannot return
anything better than `provider_attestation_required`. See
[provenance](./dedicated-supabase-provenance.md).

Three separate owner authorizations are needed, in order: the migration, the capability-gating
package, and the Railway cutover. None is implied by merging this PR, and none implies another.

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

## The one approved application mechanism

```
supabase_connector_apply_migration_v1
```

Required, and compared byte for byte. An omitted mechanism, a wrapped one
(`bash -lc 'supabase db push'`), a suffixed one (`supabase db push --linked`), or any unrecognised
name is refused. The authorized operation must bind: tool operation `apply_migration`, project ref
`itcttmkxdxvwmwcmzmey`, the exact migration name, the exact immutable SQL bytes and checksum, the
exact owner-approved commit, exactly one tool call, and no automatic retry.

### Prohibited mechanisms

| Mechanism                            | Why                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `supabase db push`                   | Directory-scoped. Would apply all 33 migrations — the 9 deferred Literature ones and the 23 unrelated ones. |
| `supabase migration repair`          | Rewrites migration history without applying SQL, destroying the audit trail.                                |
| `supabase db reset`                  | Destructive against a remote project.                                                                       |
| Supabase GitHub integration          | Would deploy the whole mixed directory on every merge.                                                      |
| Ad-hoc SQL pasted into the dashboard | Unchecksummed; no receipt binds it to the approved migration.                                               |

## Migration-history fidelity

Do **not** assume the recorded version will be `20260727032621`. That is the historical _filename_
version. `apply_migration` takes a migration _name_; the provider assigns the stored version. The
contract therefore requires **exactly one recorded migration** and establishes identity from the
applied-SQL checksum in the attestation. Never write or repair migration history to make it match.

## Sequence

### 1. Merge after independent review

Merge this PR only after the independent review in
[`dedicated-supabase-codex-review-handoff.md`](./dedicated-supabase-codex-review-handoff.md)
completes. Record the resulting `main` commit — it becomes the owner-approved commit.

> After this merges and before step 12, production Literature reports _not configured_ rather than
> silently reading `Endoreels`. Both render no articles; the new behaviour is the honest one.

### 2. Implement Layer 3

A separate, independently reviewed change must implement the project-scoped read-only Supabase
adapter (`supabase_project_scoped_read_only_mcp_v1`). Until then the preflight blocks and no
migration may be applied. **Do not work around this with a hand-written JSON file.**

### 3. Verify the primary checkout

From the **primary checkout** (`…/Interventional-Pulm-Education-Project`), on `main`, clean, with
`HEAD == origin/main == the owner-approved commit`, exactly. A descendant is not accepted; if `main`
has moved, obtain a new authorization.

### 4. Print the read-only query bundle

```bash
npm run literature:dedicated:preflight -- --print-query-bundle
```

Four statements — history, catalog, prerequisites, and the total row count — each already wrapped in
`BEGIN READ ONLY; SET TRANSACTION READ ONLY; … ROLLBACK;`. The bundle prints its own SHA-256, which
the attestation must carry.

### 5. Capture evidence through the connector

Run the bundle through the project-scoped read-only connector. The evidence document has **no**
`projectRef` or `hostname` field — target identity comes from the adapter, not the body, and a
document that declares its own project is rejected. Never paste a credential anywhere.

### 6. Run the read-only preflight

```bash
npm run literature:dedicated:preflight -- \
  --owner-approved-commit <sha> \
  --application-mechanism supabase_connector_apply_migration_v1 \
  --evidence <path.json>
```

Layer 1 (11 checks) and Layer 2 (8 checks) must pass, and Layer 3 must be `attested`. Only
`ready_to_apply` permits proceeding. The preflight applies nothing.

### 7. Obtain the migration authorization

The owner must state, in writing, all seven of: project name `IP_Literature`; project ref
`itcttmkxdxvwmwcmzmey`; the migration path; the migration SHA-256; the owner-approved commit; the
application mechanism `supabase_connector_apply_migration_v1`; and that exactly one migration
operation is permitted.

### 8. Apply exactly the authorized migration

One `apply_migration` call, carrying exactly the immutable SQL bytes. No retry.

### 9. If the acknowledgement is lost, do not retry

Go to step 10. Do not resend, do not repair history, do not compensate.

### 10. Re-capture evidence and run the postflight

```bash
npm run literature:dedicated:postflight -- --owner-approved-commit <sha> --evidence <path.json>
```

| Classification                  | Meaning                                                        | Next action                        |
| ------------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| `applied_correct`               | Attested target, one recorded migration, exact catalog, 0 rows | Proceed to step 11                 |
| `not_applied`                   | Nothing landed                                                 | Re-authorize from the preflight    |
| `partial_incident`              | Half-built schema                                              | **Stop.** Read-only reconciliation |
| `applied_drifted`               | Complete but wrong                                             | **Stop.** Read-only reconciliation |
| `ambiguous`                     | Could not be observed                                          | **Stop.** Read-only reconciliation |
| `provider_attestation_required` | Target identity unproven                                       | **Stop.** Read-only reconciliation |

Only `applied_correct` exits 0. The classification and the exit status always agree.

### 11. Produce a durable receipt

Record the migration path and SHA-256, the attested project ref, the query-bundle identity, the
owner-approved commit, the mechanism, the classification, the catalog artifact checksum, and the
timestamp. Never record a credential. **A persisted receipt is audit evidence and can never be
re-ingested to authorize anything.**

### 12. Stop. The foundation migration does NOT authorize Railway cutover.

This is the M-4 correction. Cutting Railway over immediately after the migration would expose the
admin gold-set route, whose RPCs the foundation migration does not create — it would render raw
errors and a `literature:local:start` instruction in production.

Before any Railway change:

1. Implement and independently review a **separate capability-gating / unavailable-versus-empty
   package.**
2. That package must hide or type-gate the gold-set destination while the nine deferred Literature
   migrations are absent, and must never show local-development instructions in production. It
   should adopt the typed `resolveLiteratureDatabaseBinding()` result rather than the nullable
   helper.
3. Merge and deploy it.

Keep the dedicated Railway variables **unset** until that is done.

### 13. Obtain a separate Railway authorization, then set the variables

```
LITERATURE_SUPABASE_URL=https://itcttmkxdxvwmwcmzmey.supabase.co
LITERATURE_SUPABASE_SECRET_KEY=<sb_secret_… from the IP_Literature project>
LITERATURE_SUPABASE_EXPECTED_PROJECT_REF=itcttmkxdxvwmwcmzmey
```

Leave `LITERATURE_SUPABASE_RUNTIME_MODE` **unset** — absent means the strict hosted contract, which
is what production wants. Do **not** change `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, or
`SUPABASE_SERVICE_ROLE_KEY`; authentication stays on `Endoreels`. Do not add any
`NEXT_PUBLIC_LITERATURE_*` variable. Read the variables back and confirm the service and environment.

No CSP change is required: the Literature client is server-side only.

### 14. Deploy the reviewed commit and verify

- Authenticated Literature list, search, and detail return a **legitimate empty corpus**, not an error.
- The admin surface shows the gated empty state, not a raw RPC error.
- Public and anonymous paths remain closed.
- No `NEXT_PUBLIC_*` Literature variable exists.

### 15. Stop

Do not ingest a canary. Do not import the corpus.

## Explicitly out of scope

Not implemented and not authorized here: the capability-gating / unavailable-versus-empty package,
the `robots.txt` repair, draft canary ingestion, full corpus ingestion, the V2 real-import operator,
the 630-record review overlay, autonomous classifier work, public-beta publication, and automatic
GitHub-to-Supabase deployment.

## Owner decisions still required

1. **Layer 3 adapter.** Who implements and reviews the project-scoped read-only connector.
2. **Operational CLIs.** `scripts/literature/lib/database.ts` and `gold-import-compensation-cli.ts`
   still read `LITERATURE_SUPABASE_SERVICE_ROLE_KEY` only — deliberately unchanged to avoid
   entangling this with the protected gold-import tooling.
3. **Legacy alias retirement.** When `LITERATURE_SUPABASE_SERVICE_ROLE_KEY` is removed entirely.
4. **Deferred-migration rollout.** If the gold-set chain is ever applied, all nine deferred
   migrations must go in timestamp order — including the three whose filenames do not say
   "literature".
