# Threat model — dedicated Literature Supabase bootstrap

Scope: binding the application to the dedicated `IP_Literature` project, and the later
foundation-migration rollout and Railway cutover. Everything here describes controls that exist in
the repository today plus the ones the runbook requires of a human operator.

Legend for **Status**: _code_ — enforced by a test-covered code path; _procedure_ — enforced by the
runbook and requires operator discipline; _open_ — accepted residual risk.

> Revised after three independent reviews, each of which returned BLOCKED. The first review's
> blocking finding (evidence provenance) and nine further findings produced T19–T22; the third
> review's runtime-activation and catalog-scope findings produced T23–T24. Check IDs and outcome
> names in this document are bound to the exported production names by
> `scripts/literature-dedicated-supabase/docs-consistency.test.ts`.

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

The strict contract goes further: it accepts only the exact raw value
`https://itcttmkxdxvwmwcmzmey.supabase.co/`, trailing slash included, compared byte for byte before
any parsing. (`itcttmkxdxvwmwcmzmey.supabase.co` is the host/ref, not the configuration value.)
Plaintext http, a non-default port, userinfo, a query, a fragment, an unexpected path, a
trailing-dot host, an alternate project host, and any custom host are each refused with their own
reason code (H-3).

**Residual.** Prefix validation of `sb_secret_` is a credential-_class_ check only. Real acceptance
happens when the provider validates the credential.

## T3 — Wrong Railway service or environment

Variables set on the wrong Railway service, or on preview instead of production.

**Controls (procedure).** The runbook requires the operator to name the service and environment in
the authorization record and to re-read the variables back after setting them. **Controls (code).**
If the variables land somewhere that is not the approved project, the resolver fails closed rather
than reading it; a preview or branch hostname is not the byte-exact approved value and is refused
with `noncanonical_production_url`. While the production runtime is not activated (T23), variables
on the wrong service cannot activate a client anywhere.

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
hold no credential at all: they evaluate an operator-captured observation document, and the
parsers' module-private screener (`assertParsedEvidenceCarriesNoSecret`, fourth review — no
arbitrary-object scanner is exported at all) rejects any document whose decoded keys **or decoded
string values** carry an `sb_secret_…`/`sb_publishable_…` marker, a JWT-shaped or
inline-credential value, or the prohibited secret vocabulary (secret, token, password,
authorization, bearer, api key, connection string, database URL, service role, …) —
case-insensitively, with a closed allowance list for the exact role name `service_role` in role
positions, PostgreSQL ACL grammar entries, and the contract's own `serviceRoleExecute` field.
Rejected content is never echoed into an error message; legitimate catalog content that would
otherwise trip the vocabulary is represented as a typed, exact value rather than by weakening the
screening.

Each allowance is **position-specific** (third review) and, since the fourth correction, matched
against **structured path segments** — a `readonly (string | number)[]`, so a field name, an
array index, and a literal key that merely _contains_ dots or brackets are different things. A
vocabulary match is admitted only at the exact segment sequence where that content is legitimate:
ACL grammar in `catalog.functions[*].acl[*]` and `catalog.defaultPrivileges[*].acl[*]`, the literal
`service_role` in the three catalog `role` positions and `prerequisites.roles[*]`, and the
`serviceRoleExecute` key on a `catalog.functions[*]` row. The same byte sequence in `owner`,
`definition`, `name`, `type`, `schema`, a function body, an index or trigger definition, or
anywhere else is rejected — closing `{owner: "password=foo/grantor"}` and
`{definition: "token=abc/grantor"}`. Credential _shapes_ (`sb_secret_…`, JWTs, inline-credential
connection strings) have no allowance at any path. The section lists are derived from the row
schemas themselves by a test, so a schema change cannot silently widen the allowance.

A malformed ACL value inside a real ACL array is rejected **before** any of that, by the row
schema (fifth review): the canonical `grantee=privileges/grantor` grammar is applied to every
non-null member of the two ACL arrays regardless of whether the value trips the vocabulary. It
previously ran only from inside the position allowance, so a malformed but innocuous entry such as
`not-an-acl-entry` was never checked against it.

Rehearsal child processes are spawned with every
`LITERATURE_SUPABASE_*`, `SUPABASE_*`, `PG*`, `POSTGRES_*`, `DOCKER_*`, `DATABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_URL` variable stripped. Test fixtures use self-describing placeholders; the
JWTs the classifier tests are constructed at runtime, so no credential-shaped literal is committed.

**Residual.** `.env.example` carries placeholders only, and `.env.local` is gitignored and was not
read during this work.

## T7 — Browser exposure

The Literature secret reaching a client bundle.

**Controls (code).** The primary guarantee is naming: Next.js exposes only `NEXT_PUBLIC_*` to the
browser, and none of the dedicated variables carries that prefix. A test asserts that a
`NEXT_PUBLIC_*`-only environment resolves to `null` for the privileged client. `database-client.ts`
additionally throws if it is ever evaluated where `window` is defined. A production bundle scan
confirms `.next/static/` contains zero `LITERATURE_SUPABASE` occurrences while the secret variable
appears only in server chunks.

The repository has no `server-only` dependency; adding one was considered and left out rather than
introducing a new package in a preparation-only PR. The naming guarantee plus the bundle scan is
what carries the property.

## T8 — The wrong migration is applied

A different migration, or a migration the rollout was never authorized to include.

**Controls (code).** The manifest binds one path. The preflight rejects a deferred Literature
migration (`P08`), an unrelated application migration (`P09`), and anything other than exactly one
selection (`P06`), with the selected path itself bound by `P07`. The nine deferred migrations are enumerated explicitly — including the three
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

**Controls (code).** The preflight refuses a target holding any Literature object (`E02`) or a
partial table set (`E06`). The postflight assesses a partial object set as
`content_partial_incident_nonauthoritative` rather than as drift or as a content match. The
rehearsal proves this end to end: it drops one table inside a transaction, confirms the comparison
fails and the classifier returns that assessment, then rolls back and confirms the catalog is
intact.

## T12 — Same-name collision

An unrelated object already occupying a name the migration creates.

**Controls (code).** Preflight check `E05-no-name-collision` compares the **broad** observation
inventory — every public relation and kind, every public standalone type, every public index
relation name — against the expected inventory and refuses any collision, whatever object class
occupies the name. That breadth is deliberately separate from the exact catalog comparison, which
is narrowed to foundation-owned objects so an unrelated, non-colliding public object is not drift
(T24). The rehearsal separately proves that a second application is rejected by PostgreSQL and
leaves the catalog unchanged.

## T13 — Lost acknowledgement

The apply is sent, the connection drops, and the operator does not learn whether it committed.

**Controls (code).** `resolveLostAcknowledgement()` returns
`stop_read_only_reconciliation` with `automaticRetryPermitted: false`. The postflight assesses a
missing or incomplete observation as `content_observation_incomplete_nonauthoritative`, never as
success or failure. Every verdict carries `automaticRetryPermitted`,
`automaticReapplicationPermitted`, `automaticCompensationPermitted`, and
`migrationHistoryEditPermitted` — all four hard-coded `false` and asserted across every observation
shape the reconciliation suite exercises.

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
migration, and the postflight assesses any non-zero row count as
`content_drifted_nonauthoritative`. **Controls (procedure).** Ingestion is a separately authorized
step; the runbook stops before it.

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

## T19 — Forged or relabelled target evidence (the blocking finding)

A catalog observation captured from a different database — a disposable rehearsal, the main project,
any host — relabelled as the approved project and accepted.

**Controls (code).** Two independent structural mechanisms, because a checksum alone cannot fix
this: hashing proves bytes did not change, not which database produced them.

1. **The evidence body cannot name its own target.** There is no `projectRef` or `hostname` field in
   the schema, and the schema is `.strict()`, so a document adding one is rejected as an unknown
   field. Relabelling is unrepresentable, not merely detected.
2. **Identity comes from the adapter.** The future adapter's project ref originates in a
   project-scoped connector context; the bindings it must carry (provider URL, query-plan
   identity, repository commit, migration path and checksum, content checksum, completeness, a
   10-minute freshness window) are recorded as inert data in
   `LITERATURE_LAYER3_REQUIRED_BINDINGS`. No exported type or evaluator can represent or judge a
   satisfied attestation today — the second review showed any such surface is forgeable while the
   adapter is absent, so it was removed rather than hardened.

**Status: honestly blocked.** The provider adapter is deliberately unimplemented —
`captureLiteratureProviderAttestation()` always reports `provider_adapter_not_implemented`, so every
production-authorizing path returns `provider_attestation_required`. No cryptographic provenance is
claimed, because no signature primitive exists here. A safe blocked gate beats false provenance.

**Residual (open).** Until Layer 3 ships, repository and content checks are non-authoritative and
the migration cannot be applied. That is the intended state.

## T20 — Semantic drift that preserves signatures and grants

A function whose signature and ACLs are untouched but whose body was replaced; a changed owner,
column default, constraint, trigger or index definition; a flipped forced-RLS flag.

**Controls (code).** The comparator binds a generated, committed artifact covering the
foundation-owned catalog sections with an exact row count and checksum each — including function
definitions (by SHA-256), owners, strictness, parallel safety, leakproof state, full `proconfig`,
raw ACL rows, columns with defaults and identity/generated state, constraint definitions, trigger
definitions and enabled state, index definitions and validity, and the full table-privilege grid.
Global state the migration does not own is deliberately outside the exact artifact (H-1): `pg_trgm`
and role attributes (including `BYPASSRLS`) are checked semantically as scoped managed
prerequisites, and default/schema privileges are checked as a pre/post delta that must be empty
across the apply. The rehearsal proves detection end to end: scenario `R25` replaces
`literature_admin_stats_v1`'s body while keeping its signature and ACLs and the comparison fails;
`R14` detects a tampered role attribute through the scoped checks; `R15` detects a new
default-privilege grant through the delta.

Empty or missing evidence is never read as "nothing granted": the privilege grid emits an explicit
`granted` boolean for all 224 (table, role, privilege) combinations, and `R26` proves an emptied
array fails.

## T21 — Evidence-document parsing attacks

A document that parses differently than it reads: duplicate keys, unknown fields surviving a cast,
wrong types becoming an uncontrolled `TypeError`, a credential hidden behind Unicode escapes, a
`__proto__` wrapper that swaps the decoded object's prototype so the strict schema reads required
fields through it, a literal key spelled like a path (`catalog.functions[0].acl[0]`) colliding
with a screening allowance, or a hostile object/`Proxy` handed to a parsing surface directly.

**Controls (code).** The parsers accept **primitive JSON text only** (fourth review): every
object, array, boxed string, `Proxy`, getter carrier, and conversion carrier is refused by a
`typeof` check before any property access, trap, or coercion can run, and no production surface
accepts a decoded object — the screener is module-private and no arbitrary-object scanner is
exported. A custom, JSON-compliant recursive-descent parser rejects duplicate keys outright
rather than resolving last-value-wins — reporting a character offset with the repeated key
**redacted**, so a credential-shaped key cannot ride out through the error message or the CLI
stdout that prints it (fifth review) — rejects unescaped control characters (U+0000–U+001F)
inside strings as RFC 8259 requires, and rejects the reserved structural keys
`__proto__`/`prototype`/`constructor` at every depth, checked on the _decoded_ key. Decoded
objects are materialized as `Object.create(null)` with members installed by
`Object.defineProperty` as ordinary own enumerable data properties, so no decoded key can alter a
prototype. Every row of every catalog section has its own
`.strict()` runtime schema with exact field types, so unknown nested fields (including any casing
or Unicode-escaped spelling of `projectRef`/`hostname`), missing fields, numeric names, malformed
booleans, and malformed arrays are all controlled schema violations — never a later raw
`TypeError`, and never a message that echoes an unknown key name or a received value. The
evidence documents are phase-specific: the preflight schema has no `totalRowCount`, the
postflight schema requires it, and each binds the identity of the exact query plan that produced
it. Credential screening runs **after** the schema, over the schema-normalized parser-owned
graph with structured-segment paths, recursively over every key and
value, with case-normalised patterns — so `sb\u005fsecret_…` and `SB_SeCrEt_…` are caught
identically to the plain form. Every failure is a typed `LiteratureEvidenceError` with a code.

## T22 — A success verdict for an unproven or wrong target

The postflight printing a success verdict, or an authoritative-looking flag, and only later
emitting a warning.

**Controls (code).** The success verdicts no longer exist. After the second review demonstrated
that any evaluator accepting attestation-shaped input is forgeable while the adapter is absent,
every production verdict union was stripped of its success members: the preflight resolves only to
`blocked` or `provider_attestation_required`; the postflight classification is always
`provider_attestation_required` with next action `stop_read_only_reconciliation`, plus an
explicitly `*_nonauthoritative` content assessment; and both CLIs exit nonzero unconditionally. A
forged plain object, a bare attested-status literal, an `as any` cast, or a deserialized fixture
has nothing to flip — the adversarial `authority-lockdown` suite replays every bypass shape from
the review against every exported symbol and asserts no success token can appear.

The third review found the one remaining hole in the exit-status half of that claim:
`--print-query-plans` returned from `main()` before the trailing `process.exitCode = 1`, so a
query-plan dump exited 0 and a shell `&&` chain could read it as a passing preflight. The status is
now set at main entry — before any argument-dependent branch — and re-asserted at finalization, and
`cli-exit-status.test.ts` spawns both CLIs as **subprocesses** across every supported invocation
(no arguments, `--print-query-plans`, valid evidence, invalid evidence, an unreadable path, unknown
flags, repeated flags) asserting a nonzero status and no authoritative-success text in the real
output. The plans are still printed; printing them is simply not a success.

## T23 — A privileged remote client activated by setting variables alone

The runtime binding validated the dedicated project and then constructed a Supabase client from it.
Existing callers use that client for mutating RPCs — `curate_literature_article_v1` and the
gold-set operations — so setting the documented Railway variables would have activated remote
mutation against `IP_Literature` before the separately reviewed capability-gating / cutover package
exists. Railway variables being unset today is a fact about the environment, not a control.

**Controls (code).** Validation and activation are separated. `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION`
is a source constant currently set to `not_activated`; while it holds that value, a strict
configuration that passes every check resolves to the typed state `not_activated` /
`dedicated_runtime_not_activated` instead of `bound`, and carries **no** `secretKey` field for a
caller to misuse. `createLiteratureAdmin()` reaches `createClient` only when the binding is `bound`,
the mode is exactly `local`, and the URL is on the explicit canonical local-host allowlist
(`localhost`, `127.0.0.1`, `[::1]` — never the wildcard bind address `0.0.0.0`, and never an alias
spelling such as `127.1`, `0177.0.0.1`, or `2130706433`, which are refused on the raw authority
before URL normalization could map them onto the list) — three agreeing gates, none of which any
environment variable can satisfy for a remote host. A test suite mocks
Supabase client construction and asserts, across no-variable / partial / exactly-valid / invalid
configurations, that `createClient` is never called, that the existing read and mutating server
functions all return "not configured", and that `.rpc()` and `.from()` are never invoked — while a
loopback local configuration still constructs exactly its intended client.

Activation is deliberately **not** an environment variable: a second variable would have recreated
the same defect one level down. Only a reviewed code change in the capability-gating / cutover PR
can flip it.

**Residual.** Until that package ships, production Literature reports "not configured" even with
correct variables set. That is the intended state and is recorded in the runbook.

## T24 — Unrelated public objects read as foundation drift

The exact catalog comparison covered every public relation and every public type, because the
inspection must see them all to detect collisions. An unrelated, non-colliding public table planted
by another workload therefore made the observed `relations` section one row larger than the
artifact expects, and the postflight reported drift for an object the foundation neither owns nor
forbids. A false drift signal on a real rollout is not a safe failure: it invites an operator to
regenerate the artifact against whatever the target happens to hold.

**Controls (code).** Observation breadth and comparison scope are separate.
`collectCatalogCollisionInventory` keeps the unfiltered public inventory that `E05` needs, and
`projectFoundationOwnedSection` narrows the exact comparison to foundation-owned objects —
`relations` to the eight foundation tables, `types` to `LITERATURE_FOUNDATION_OWNED_TYPES` (empty:
the migration defines no standalone type), with every other exact section already SQL-scoped to
`literature%`. Detection is preserved on all four axes: expected-name collisions of any object
class, altered semantics of an expected relation, a missing expected object, and a prohibited extra
inside the reserved Literature namespace. Rehearsal `R38`–`R40` prove it against a real PostgreSQL
17 target: an unrelated table, its implicit sequence, an unrelated view, and an unrelated enum are
planted before the apply, preflight passes, the apply succeeds, the exact comparison matches, all
of them survive, and an extra `literature_`-named table is still reported as drift.

## Residual risks accepted

1. **Layer 3 is unimplemented** (T19). Production migration is blocked until a project-scoped
   read-only connector exists and is independently reviewed.
2. **Railway is unobservable from here** (T3). Only the operator can confirm the variables landed on
   the right service and environment.
3. **Operational CLIs still read the legacy variable only.** Deliberate, to avoid entangling this
   change with the protected gold-import tooling.
4. **Managed migration-history semantics are unproven.** The recorded version is provider-assigned;
   the contract binds "exactly one recorded migration" and defers version identity to execution-time
   evidence rather than assuming the filename version.
5. **Admin gold-set surfaces would error against a foundation-only database.** This is why the
   runbook gates Railway cutover behind a separate capability-gating package (M-4).
6. **The production Literature runtime is disabled** (T23). Correct variables produce no client
   until the capability-gating / cutover package flips the activation constant, so production
   Literature stays "not configured" in the meantime.
