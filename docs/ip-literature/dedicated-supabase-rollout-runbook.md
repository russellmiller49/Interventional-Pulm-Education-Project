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

Three separate owner authorizations are needed, in this order: the migration, the capability-gating
package, and the Railway cutover. None is implied by merging this PR, and none implies another.
Layer 3 must exist and have been independently reviewed **before** the migration authorization is
sought — see the sequence below.

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

Nine steps, in exactly this order. The load-bearing property is that **Layer 3 comes before the
migration authorization**: until a provider-bound adapter exists, nothing can establish which
database was observed, so an authorization obtained earlier would be an authorization to act on
evidence no one can attribute. Every other document states the same nine steps in the same order.

1. Merge this preparation PR after independent review.
2. Implement and independently review Layer 3.
3. Obtain the exact owner migration authorization.
4. Run the provider-bound preflight.
5. Apply exactly the foundation migration.
6. Run the provider-bound postflight, and stop.
7. Implement and deploy capability gating, while the runtime stays disabled.
8. Obtain the Railway authorization and cut over.
9. Stop, before any canary or ingestion.

### 1. Merge this preparation PR after independent review

Merge this PR only after the independent review in
[`dedicated-supabase-codex-review-handoff.md`](./dedicated-supabase-codex-review-handoff.md)
completes. Record the resulting `main` commit — it becomes the owner-approved commit.

> After this merges and until the capability-gating package of step 7 ships, production Literature
> reports _not configured_ rather than silently reading `Endoreels` — and it reports that even if
> the step-8 variables are set, because the production runtime is not activated. Both render no
> articles; the new behaviour is the honest one.

### 2. Implement and independently review Layer 3

A separate, independently reviewed change must implement the project-scoped read-only Supabase
adapter (`supabase_project_scoped_read_only_mcp_v1`). **Nothing after this step may begin until it
has shipped and been reviewed.** Until then the preflight blocks, the postflight classifies as
`provider_attestation_required`, and no migration may be applied. **Do not work around this with a
hand-written JSON file.**

The CLIs in this repository are not a migration path. They hold no credential, open no connection,
apply nothing, and exit nonzero on every invocation; the migration is applied by the provider
through the approved mechanism, never through them.

### 3. Obtain the exact owner migration authorization

The owner must state, in writing, all seven of: project name `IP_Literature`; project ref
`itcttmkxdxvwmwcmzmey`; the migration path; the migration SHA-256; the owner-approved commit; the
application mechanism `supabase_connector_apply_migration_v1`; and that exactly one migration
operation is permitted.

### 4. Run the provider-bound preflight

Four parts, all before anything is applied.

**4a. Verify the primary checkout.** From the **primary checkout**
(`…/Interventional-Pulm-Education-Project`), on `main`, clean, with
`HEAD == origin/main == the owner-approved commit`, exactly. A descendant is not accepted; if `main`
has moved, obtain a new authorization.

**4b. Print the phase-specific query plans.**

```bash
npm run literature:dedicated:preflight -- --print-query-plans
```

Three ordered plans, each with its own SHA-256 identity: the **preflight plan** (existence-safe on
a brand-new project — the history existence probe runs first and the versions statement is
conditional on it; nothing references `supabase_migrations.schema_migrations` or any Literature
relation unconditionally), the **postflight existence probe**, and the **postflight complete
plan** (history versions, full catalog, prerequisites, and the row count, valid only after the
probe proved the referenced relations present). Every statement is wrapped in
`BEGIN READ ONLY; SET TRANSACTION READ ONLY; … ROLLBACK;`. The identities are distinct, so one
phase's capture cannot be substituted for another's. In the authoritative gate, migration history
comes from the provider's project-scoped `list_migrations` operation, not from a manually
assembled SQL result.

**4c. Capture evidence through the connector.** Run the appropriate plan through the project-scoped
read-only connector from step 2. The evidence documents have **no** `projectRef` or `hostname`
field — target identity comes from the adapter, not the body, and a document that declares its own
project is rejected. Never paste a credential anywhere.

**4d. Run the preflight.**

```bash
npm run literature:dedicated:preflight -- \
  --owner-approved-commit <sha> \
  --application-mechanism supabase_connector_apply_migration_v1 \
  --evidence <path.json>
```

Every Layer 1 (repository) and Layer 2 (evidence content) check can pass **non-authoritatively**.
While the provider-bound Layer-3 adapter is unimplemented, the best reachable verdict is
`provider_attestation_required`, and **no migration may be applied on the strength of this
repository's output**. The success verdict does not exist in this PR; the separately reviewed
provider-adapter PR of step 2 introduces the first one. The preflight applies nothing.

**Every invocation of both CLIs exits nonzero** — including
`--print-query-plans`, which still prints the plans but is not a success. Do not chain either
command with `&&`; there is no passing exit status to chain on.

### 5. Apply exactly the foundation migration

One `apply_migration` call through the approved mechanism, carrying exactly the immutable SQL
bytes. No retry.

**If the acknowledgement is lost, do not retry.** Go to step 6. Do not resend, do not repair
history, do not compensate.

### 6. Run the provider-bound postflight, and stop

Re-capture evidence through the connector first, exactly as in step 4c, using the postflight
existence probe and then the postflight complete plan.

```bash
npm run literature:dedicated:postflight -- --owner-approved-commit <sha> --evidence <path.json>
```

While Layer 3 is unimplemented, the classification is **always** `provider_attestation_required`
and the next action is **always** `stop_read_only_reconciliation` — the command exits nonzero for
every input. What varies is the explicitly non-authoritative _content assessment_, which exists
for the human reconciling with the owner:

| Content assessment                                | The evidence content shows…                       |
| ------------------------------------------------- | ------------------------------------------------- |
| `catalog_matches_expected_nonauthoritative`       | One recorded migration, exact catalog, 0 rows     |
| `content_absent_nonauthoritative`                 | No history and no Literature objects              |
| `content_partial_incident_nonauthoritative`       | A state no single successful transaction produces |
| `content_drifted_nonauthoritative`                | Complete inventory, but something changed         |
| `content_observation_incomplete_nonauthoritative` | The observation itself did not complete           |

No assessment authorizes anything: each is a statement about a document, not a proven database.
The provider-bound gate from step 2 is the only thing that will ever turn content into a decision.

**Produce a durable receipt.** Record the migration path and SHA-256, the project ref, the
query-plan identities, the owner-approved commit, the mechanism, the classification, the catalog
artifact checksum, and the timestamp. Never record a credential. **A persisted receipt is audit
evidence and can never be re-ingested to authorize anything.**

**Then stop.** The foundation migration does NOT authorize Railway cutover.

### 7. Implement and deploy capability gating, while the runtime stays disabled

> The runtime enforces this, not just the runbook. While
> `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION` is `not_activated`, a valid strict configuration
> resolves to `not_activated` / `dedicated_runtime_not_activated` and **no Supabase client is
> constructed**. Setting the step-8 variables before the capability-gating package ships changes
> nothing at runtime: the Literature module keeps reporting "not configured" and no mutating RPC
> is reachable. Activation is a reviewed code change, not a variable.

This is the M-4 correction. Cutting Railway over immediately after the migration would expose the
admin gold-set route, whose RPCs the foundation migration does not create — it would render raw
errors and a `literature:local:start` instruction in production.

Before any Railway change:

1. Implement and independently review a **separate capability-gating / unavailable-versus-empty
   package.**
2. That package must hide or type-gate the gold-set destination while the nine deferred Literature
   migrations are absent, and must never show local-development instructions in production. It
   should adopt the typed `resolveLiteratureDatabaseBinding()` result rather than the nullable
   helper, and it is the **first change permitted to set
   `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION` to `activated_by_reviewed_cutover`** — the source
   constant that lets a production Literature client be constructed at all.
3. Merge and deploy it.

Keep the dedicated Railway variables **unset** until that is done, and keep the runtime disabled
for the whole of this step: deploying the gating work is not the cutover.

### 8. Obtain the Railway authorization and cut over

The exact raw values, byte for byte — the URL includes the **trailing slash**, which the strict
contract requires:

```
LITERATURE_SUPABASE_URL=https://itcttmkxdxvwmwcmzmey.supabase.co/
LITERATURE_SUPABASE_SECRET_KEY=<sb_secret_… from the IP_Literature project>
LITERATURE_SUPABASE_EXPECTED_PROJECT_REF=itcttmkxdxvwmwcmzmey
```

These variables are **reserved for this cutover**. Setting them at any earlier point validates
them and nothing more — no client is constructed and no remote RPC becomes reachable until the
capability-gating package has flipped the activation constant.

Leave `LITERATURE_SUPABASE_RUNTIME_MODE` **unset** — absent means the strict hosted contract, which
is what production wants. Do **not** change `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, or
`SUPABASE_SERVICE_ROLE_KEY`; authentication stays on `Endoreels`. Do not add any
`NEXT_PUBLIC_LITERATURE_*` variable. Read the variables back and confirm the service and environment.

No CSP change is required: the Literature client is server-side only.

Then deploy the reviewed commit and verify:

- Authenticated Literature list, search, and detail return a **legitimate empty corpus**, not an error.
- The admin surface shows the gated empty state, not a raw RPC error.
- Public and anonymous paths remain closed.
- No `NEXT_PUBLIC_*` Literature variable exists.

### 9. Stop, before any canary or ingestion

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
