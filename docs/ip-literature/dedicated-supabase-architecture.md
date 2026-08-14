# Dedicated Literature Supabase project

Status: **preparation only.** Nothing in this document has been applied to any remote system.

## Decision

The Literature corpus lives in its own Supabase project, separate from the main application project.

| Role                                                     | Project         | Ref                    |
| -------------------------------------------------------- | --------------- | ---------------------- |
| Site authentication, site-admin identity, all other data | `Endoreels`     | `tqnhxlwvkkswuckszlee` |
| Literature schema and corpus                             | `IP_Literature` | `itcttmkxdxvwmwcmzmey` |

`Endoreels` must never receive the Literature schema or corpus. `IP_Literature` is never used for
Supabase Auth. The split is enforced in code, not by convention — see "Runtime binding" below.

`IP_Literature` runs PostgreSQL 17.6.1 in `us-west-1`, matching `supabase/config.toml`
(`[db] major_version = 17`). As of 2026-08-13 it holds zero public tables and zero recorded
migrations, and it is deliberately not connected to GitHub or Railway.

## Why a dedicated project

The Literature corpus is a 132,350-record bibliographic dataset with its own import pipeline,
review workflow, and retention rules. Keeping it beside authentication data means a single
service-role credential reaches both, one project's storage and connection limits are shared by
two very different workloads, and any Literature migration is a migration against the database that
holds user identity. Separating them makes the blast radius of a Literature mistake exactly the
Literature project.

## The problem this replaces

Production had no dedicated Literature configuration at all:

```
LITERATURE_SUPABASE_URL:              absent
LITERATURE_SUPABASE_SERVICE_ROLE_KEY: absent
NEXT_PUBLIC_SUPABASE_URL:             tqnhxlwvkkswuckszlee
SUPABASE_SERVICE_ROLE_KEY:            present
```

The old resolver fell back to the main-project variables when no Literature override was set, so
the production Literature client service-roled against `Endoreels` — a database with no Literature
schema. Every query failed, and the failures surfaced as an empty Explorer rather than as an
outage. The corrective action is not to add the Literature schema to `Endoreels`; it is to bind
Literature to its own project and to fail closed when that binding is absent.

## Runtime binding

`src/features/literature/server/dedicated-project-contract.ts` holds the rules;
`src/features/literature/server/database-client.ts` applies them. Three variables, all required
together:

```
LITERATURE_SUPABASE_URL
LITERATURE_SUPABASE_SECRET_KEY
LITERATURE_SUPABASE_EXPECTED_PROJECT_REF
```

The resolver reads **none** of `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, or
`SUPABASE_SERVICE_ROLE_KEY`. There is no fallback path to the main project in any mode.

The contract is **strict by default**. The mode comes from `LITERATURE_SUPABASE_RUNTIME_MODE`, a
closed enum, and **not** from `NODE_ENV`: only the exact string `local` relaxes anything, so an
absent, misspelled, or unexpected value in a deployed environment fails safe rather than open.

Under the strict contract the URL must be exactly the canonical origin
`https://itcttmkxdxvwmwcmzmey.supabase.co` — https only, default port, no userinfo, no query, no
fragment, root path only, no trailing-dot host — and the credential must be a current-model
`sb_secret_…` key. Local mode permits a loopback target **and only a loopback target**; it never
accepts an arbitrary remote host.

A `secret` classification is a credential-_class_ check, not authentication. The credential is only
truly accepted when the Supabase provider validates it.

`tqnhxlwvkkswuckszlee` is rejected as a Literature target in **every** mode, not only production.

### Failure states are typed, not collapsed

`resolveLiteratureDatabaseBinding()` returns a discriminated union carrying one of twenty-one reason
codes — `not_configured`, `partial_configuration`, `ambiguous_credentials`, `project_ref_mismatch`,
`prohibited_project_ref`, `loopback_not_permitted_in_production`, and so on. This exists so the
later unavailable-versus-empty UI work can distinguish "misconfigured" from "no articles yet"
without guessing. That UI package is **not** implemented here; only the typed state it needs is.

`describeLiteratureDatabaseBinding()` returns a redacted view safe to log. No function in the
contract ever puts a credential into a message, an error, or a diagnostics payload.

Current consumers (`server/queries.ts`, `server/gold-set.ts`) still use the nullable
`createLiteratureAdmin()`. Adopting the typed result is the job of the separate capability-gating
package — see step 12 of the runbook.

### Credential model

Credentials are classified structurally: `sb_secret_…` → `secret`, `sb_publishable_…` →
`publishable`, and legacy JWTs by their unverified `role` claim. Publishable, anon, and
unclassifiable-JWT credentials are refused as the privileged backend credential in every mode.
Production accepts only `secret`.

### Legacy variable

`LITERATURE_SUPABASE_SERVICE_ROLE_KEY` is retained as an alias **outside production only**, because
`npm run literature:local:start` writes it into `.env.local` and thirteen Literature CLIs read it.
The rule is deterministic:

| `SECRET_KEY` | `SERVICE_ROLE_KEY` | Local mode                             | Strict contract                                                         |
| ------------ | ------------------ | -------------------------------------- | ----------------------------------------------------------------------- |
| set          | unset              | accepted                               | accepted                                                                |
| unset        | set                | accepted (legacy)                      | **rejected** — `legacy_credential_variable_not_permitted_in_production` |
| set          | set, same value    | accepted                               | accepted                                                                |
| set          | set, different     | **rejected** — `ambiguous_credentials` | **rejected** — `ambiguous_credentials`                                  |

Two simultaneously defined privileged credentials with different values are never silently
reconciled. Identical values are not two credentials, so that one case passes.

**Not changed in this PR:** the operational CLIs under `scripts/literature/` still read
`LITERATURE_SUPABASE_SERVICE_ROLE_KEY` only. They run against the local stack from the primary
checkout and are entangled with the protected gold-import tooling, so widening them is deliberately
left as a separate change. See the owner decisions in the rollout runbook.

## Migration scope

`supabase/migrations/` holds **33** migrations: **10** touch Literature objects (1 foundation +
**9** deferred) and **23** are unrelated application migrations. Because the directory is mixed, **`supabase db push` is prohibited** — it
would apply all 33 to whichever project the CLI is linked to.

The dedicated project's entire approved scope is one migration:

```
supabase/migrations/20260727032621_add_literature_explorer.sql
sha256 c737865cdde3572ed0c0c59c134530bbd7e86e2013d97e0b9edc06c27aa426da
37669 bytes
```

It is self-contained: it depends on nothing from any earlier migration, only on Supabase platform
primitives (the `extensions` schema, the `anon`/`authenticated`/`service_role` roles,
`gen_random_uuid()`, and the PostgREST `pgrst` notify channel). It is fully transactional — no
`CREATE INDEX CONCURRENTLY`, no `VACUUM`, no `ALTER SYSTEM` — and contains no `DROP`, no `TRUNCATE`,
and no `SECURITY DEFINER`.

It is also sufficient. `server/queries.ts` uses exactly three RPCs (`search_literature_v1`,
`literature_admin_stats_v1`, `curate_literature_article_v1`) and four tables
(`literature_articles`, `literature_article_sources`, `literature_article_topics`,
`literature_curation_events`), all created here.

### The nine deferred migrations

The remaining nine Literature migrations implement the gold-set review workflow and the
import/compensation contracts. None is authorized for this rollout.

Three of them are easy to miss because their filenames do not say "literature":

- `20260728170939_add_interactive_clinical_case_publication_status.sql`
- `20260728171212_add_immune_inflammatory_disease_tag.sql`
- `20260728174726_add_safety_complication_prevention_clinical_purpose.sql`

Each is a `DO` block that reads `save_literature_gold_review_v1` via `pg_get_functiondef` and
`raise exception`s if it is absent. They are hard-ordered Literature migrations. The manifest binds
all nine by inspection of the SQL, never by a filename pattern, and a test re-derives the set by
grepping every migration for Literature references.

### Known consequence of a foundation-only rollout

The admin gold-set surfaces (`/admin/literature/gold-set` and the
`/api/admin/literature/gold-set/*` routes) call RPCs the foundation migration does not create.
Against a foundation-only database they will error. That is correct and expected — there is no
review data in the new project to serve — but it is a deliberate scope decision, recorded here so
it is not discovered as a surprise.

## Security posture of the foundation schema

Verified against a real PostgreSQL 17 target by the disposable rehearsal, not asserted from reading
the SQL. The byte-exact contract lives in the generated artifact
`foundation-catalog-expectations.json` (13 catalog sections, each with an exact row count and
checksum), which binds function bodies, owners, column defaults, constraint/trigger/index
definitions, the full 224-row privilege grid, and role attributes:

- 8 tables, all with row-level security **enabled** and **zero policies**. Access is by
  `service_role` bypassing RLS, not by any policy. A policy appearing on these tables is drift.
- `PUBLIC`, `anon`, and `authenticated` hold no privilege on any Literature table — 168 privilege
  probes, all false.
- 6 functions, all `SECURITY INVOKER`, all with `search_path` pinned to `pg_catalog, public`.
- The three runtime RPCs grant `EXECUTE` to `service_role` only. The three trigger functions grant
  it to nobody.
- 6 triggers, 28 indexes, `pg_trgm` installed into the `extensions` schema.

## Verification tooling

| Command                                   | What it does                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run literature:dedicated:rehearse`   | Applies the migration to a throwaway PostgreSQL 17 container and proves 23 scenarios |
| `npm run literature:dedicated:preflight`  | Read-only. Proves repository and target state before anything is applied             |
| `npm run literature:dedicated:postflight` | Read-only. Classifies the target after an attempt, including a lost acknowledgement  |
| `npm run literature:dedicated:test`       | The unit and contract suites                                                         |

The preflight and postflight **hold no credential and open no connection.** The operator captures a
read-only observation separately (`--print-observation-sql` emits the exact statements, each wrapped
in `BEGIN READ ONLY`) and the verifiers evaluate that JSON document offline. This means no code
path in this repository can log, store, or transmit the Literature secret.

The rehearsal container publishes **no port**, so it has no TCP surface and cannot collide with the
protected real-local database on 55322.

## Related

- Rollout and Railway cutover: [`dedicated-supabase-rollout-runbook.md`](./dedicated-supabase-rollout-runbook.md)
- Threat model: [`dedicated-supabase-threat-model.md`](./dedicated-supabase-threat-model.md)
- Independent review: [`dedicated-supabase-codex-review-handoff.md`](./dedicated-supabase-codex-review-handoff.md)
