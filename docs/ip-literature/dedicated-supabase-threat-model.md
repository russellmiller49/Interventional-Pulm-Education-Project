# Threat model — dedicated Literature Supabase bootstrap

Scope: binding the application to the dedicated `IP_Literature` project, and the later
foundation-migration rollout and Railway cutover. Everything here describes controls that exist in
the repository today plus the ones the runbook requires of a human operator.

Legend for **Status**: _code_ — enforced by a test-covered code path; _procedure_ — enforced by the
runbook and requires operator discipline; _open_ — accepted residual risk.

## T1 — The Literature client falls back to the main application project

The realised failure. A production deployment with no dedicated configuration service-roled against
`Endoreels`, which has no Literature schema, and the resulting errors surfaced as an empty Explorer.

**Controls (code).** The resolver reads only `LITERATURE_SUPABASE_*`. `SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are absent from the environment type and
from every code path. An environment carrying only main-project variables resolves to
`not_configured`. Covered by `database-client.test.ts` — "no longer falls back to the main
application database".

**Residual.** After this PR merges but before the Railway variables are set, production Literature
reports _not configured_ instead of silently returning zero results. Both show no articles; the new
behaviour is the honest one. Noted in the runbook so it is expected rather than alarming.

## T2 — The wrong project ref

A correct-looking URL pointing at the wrong Supabase project.

**Controls (code).** The expected ref is a required variable; the ref is independently parsed from
the URL hostname and the two must match; in production the result must be
`itcttmkxdxvwmwcmzmey`. `tqnhxlwvkkswuckszlee` is rejected in every mode, not only production. The
migration manifest binds the same ref, and the preflight refuses any other target. Reason codes
`project_ref_mismatch`, `unapproved_production_project_ref`, `prohibited_project_ref`.

**Residual.** A non-hosted URL (custom domain, tunnel) carries no ref in its hostname. In production
that is refused outright (`unresolvable_project_ref`); outside production the declared expected ref
is accepted as the target's identity, which is appropriate for a local stack.

## T3 — Wrong Railway service or environment

Variables set on the wrong Railway service, or on preview instead of production.

**Controls (procedure).** The runbook requires the operator to name the service and environment in
the authorization record and to re-read the variables back after setting them. **Controls (code).**
If the variables land somewhere that is not the approved project, the resolver fails closed rather
than reading it; a preview or branch hostname is refused by preflight check `T03`.

**Residual (open).** Nothing in this repository can observe Railway. Setting the right values on the
wrong service produces a Literature module that is _not configured_ on the intended service — a
visible, safe failure, but one only the operator can correct.

## T4 — Partial variables

One or two of the three variables set.

**Controls (code).** All three are required together. A partial configuration returns
`partial_configuration` or `expected_project_ref_missing` and never blends with anything else. It
does not fall back, and it does not proceed with defaults.

## T5 — Legacy and new credential variables both defined

Two privileged credentials in scope, with no obvious precedence.

**Controls (code).** Different values fail closed with `ambiguous_credentials` in every mode.
Identical values are treated as one credential and accepted. Legacy-only is refused in production
(`legacy_credential_variable_not_permitted_in_production`) and accepted outside it, so the existing
local workflow is unaffected. The full matrix is in the architecture note and is covered by six
tests.

## T6 — Secret disclosure

A credential reaching a log, an error message, a receipt, a test fixture, or the PR.

**Controls (code).** No function in the contract interpolates a credential into a message — asserted
by a test that checks four distinct failure messages against three placeholder values. The redacted
`describeLiteratureBinding()` view is what callers are expected to log. The preflight and postflight
hold no credential at all: they evaluate an operator-captured observation document, and
`assertObservationCarriesNoSecret()` rejects any document containing an `sb_secret_…`,
`sb_publishable_…`, or JWT-shaped value. Rehearsal child processes are spawned with every
`LITERATURE_SUPABASE_*`, `SUPABASE_*`, `PG*`, `POSTGRES_*`, `DOCKER_*`, `DATABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_URL` variable stripped. Test fixtures use self-describing placeholders; the
JWTs the classifier tests are constructed at runtime, so no credential-shaped literal is committed.

**Residual.** `.env.example` carries placeholders only, and `.env.local` is gitignored and was not
read during this work.

## T7 — Browser exposure

The Literature secret reaching a client bundle.

**Controls (code).** The primary guarantee is naming: Next.js exposes only `NEXT_PUBLIC_*` to the
browser, and none of the three dedicated variables carries that prefix. A test asserts that a
`NEXT_PUBLIC_*`-only environment resolves to `null` for the privileged client. `database-client.ts`
additionally throws if it is ever evaluated where `window` is defined, so an accidental client
import fails loudly rather than shipping.

## T8 — The wrong migration is applied

A different migration, or a migration the rollout was never authorized to include.

**Controls (code).** The manifest binds one path. The preflight rejects a deferred Literature
migration (`P09`), an unrelated application migration (`P10`), zero migrations (`P07`), and more
than one (`P07`). The nine deferred migrations are enumerated explicitly — including the three
whose filenames do not contain "literature" — and a test re-derives the Literature migration set by
grepping the SQL so a new one cannot be added without the manifest noticing.

## T9 — Migration drift

The approved file edited between review and rollout.

**Controls (code).** SHA-256 and byte length are both bound. The preflight rehashes the file from
disk at rollout time; the rehearsal proves a one-byte append is rejected
(`migration_checksum_mismatch`). A copy of the file at a different path is refused even when its
hash matches (`migration_path_not_approved`).

## T10 — Mixed-directory bulk push

`supabase db push` applying all 33 migrations to the dedicated project.

**Controls (code).** `supabase db push`, `supabase migration repair`, `supabase db reset`, the
GitHub integration, and dashboard-pasted SQL are each named as prohibited mechanisms with a stated
reason; the manifest rejects any of them by name. **Controls (procedure).** The dedicated project is
not connected to GitHub, so no merge can trigger a deployment.

## T11 — Partial schema

An interrupted apply leaving some objects present.

**Controls (code).** The preflight refuses a target holding any Literature object (`T06`) or a
partial table set (`T08`). The postflight classifies a partial object set as `partial_incident`
rather than as drift or success. The rehearsal proves this end to end: it drops one table inside a
transaction, confirms the comparison fails and the classifier returns `partial_incident`, then rolls
back and confirms the catalog is intact.

## T12 — Same-name collision

An unrelated object already occupying a name the migration creates.

**Controls (code).** Preflight check `T07` compares present tables and functions against the
expected inventory and refuses any collision. The rehearsal separately proves that a second
application is rejected by PostgreSQL and leaves the catalog unchanged.

## T13 — Lost acknowledgement

The apply is sent, the connection drops, and the operator does not learn whether it committed.

**Controls (code).** `resolveLostAcknowledgement()` returns
`stop_read_only_reconciliation` with `automaticRetryPermitted: false`. The postflight classifies a
missing or incomplete observation as `ambiguous`, never as success or failure. Every classification
carries `automaticRetryPermitted`, `automaticReapplicationPermitted`,
`automaticCompensationPermitted`, and `migrationHistoryEditPermitted` — all four hard-coded `false`
and asserted across six observation shapes.

## T14 — Automatic retry

Tooling reapplying after an ambiguous result.

**Controls (code).** No script in `scripts/literature-dedicated-supabase/` can apply anything. A
test greps the preflight and postflight sources for `apply_migration`, `db push`, and
`migration repair` and asserts they are absent, and asserts the reconciliation module imports no
`child_process`, Supabase client, `docker`, or `psql` capability at all.

## T15 — Unintended RLS or grant exposure

The rollout leaving Literature data readable by `anon` or `authenticated`.

**Controls (code).** The rehearsal verifies against a real PostgreSQL 17 target that RLS is enabled
on all 8 tables with zero policies, that 168 privilege probes across `PUBLIC`, `anon`, and
`authenticated` are all false, and that `anon` can neither select from a Literature table nor
execute `search_literature_v1`. The three runtime RPCs grant `EXECUTE` to `service_role` only. Every
function is `SECURITY INVOKER` with a pinned `search_path`. The postflight re-runs the same
comparison against the real target.

## T16 — Accidental data ingestion

A rollout that also imports data.

**Controls (code).** The rehearsal asserts every Literature table holds zero rows after the
migration, and the postflight classifies any non-zero row count as `applied_drifted`. **Controls
(procedure).** Ingestion is a separately authorized step; the runbook stops before it.

## T17 — Protected local mutation

The rehearsal touching the protected real-local database (`supabase_db_ip-literature-local`,
port 55322).

**Controls (code).** The rehearsal container publishes no port, so there is no TCP surface at all;
every statement goes through `docker exec` on the container's own unix socket.
`assertNotProtectedResource()` refuses any identifier naming that container or that port.
`assertLocalDockerEndpoint()` refuses a non-local Docker endpoint. Cleanup removes containers by
exact name — the rehearsal proves an unrelated same-prefix sentinel survives it — and a final
scenario confirms the protected container is still present.

**Note.** The protected database is reached by the gold-import tooling through `docker exec … psql`,
never through `LITERATURE_SUPABASE_*`. The variable changes in this PR are structurally incapable of
reaching it.

## T18 — Held-out set exposure

Reading, inferring, or exporting the 270-record held-out set.

**Controls (code).** Nothing in this PR reads the gold-set schema, and a test asserts that no module
under `scripts/literature-dedicated-supabase/` references a held-out identifier, a package
generator, or an import/compensation function. The foundation migration itself creates no gold-set
object; a test asserts its SQL contains no `literature_gold` reference.

## Residual risks accepted

1. **Railway is unobservable from here** (T3). Only the operator can confirm the variables landed on
   the right service and environment.
2. **Operational CLIs still read the legacy variable only.** Deliberate, to avoid entangling this
   change with the protected gold-import tooling. Tracked as an owner decision.
3. **Admin gold-set surfaces will error against a foundation-only database.** Expected and scoped;
   see the architecture note.
4. **A local production build (`NODE_ENV=production` with a loopback URL) reports not configured.**
   This is the required fail-closed behaviour, not a defect. Local development (`npm run dev`) is
   unaffected.
