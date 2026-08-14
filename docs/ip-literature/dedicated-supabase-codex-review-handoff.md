# Independent review handoff — dedicated Literature Supabase bootstrap (correction pass)

For a fresh reviewer with no context from the implementing sessions.

A previous independent review returned **BLOCKED** with one blocking, five high, four medium, and
two low findings. This document lists every correction and asks you to **re-run the exact original
reproductions**. The goal is to decide whether the PR is safe to merge — **not** whether the
migration should be applied, which is separately gated and currently blocked by design.

## Setup

```bash
git fetch origin
git worktree add ../codex-literature-dedicated-review claude/literature-dedicated-supabase-bootstrap-v1
cd ../codex-literature-dedicated-review
npm ci
```

Node 20 (`.nvmrc`).

## Hard constraints

Reading and running the local suites is fine. Do not: apply any migration to `itcttmkxdxvwmwcmzmey`
or `tqnhxlwvkkswuckszlee`; run `supabase db push`/`db reset`/`migration repair` against any remote
project; mutate the protected real-local database (container `supabase_db_ip-literature-local`, port
55322); retrieve or reveal any production credential; ingest a canary or corpus; run any V2 import or
compensation; or access the held-out set.

`npm run literature:dedicated:rehearse` creates and destroys its own throwaway container. It
publishes no port and cannot reach 55322. Running it is safe and is the single most useful check.

## Finding-by-finding corrections to verify

### B-1 (blocking) — evidence was not bound to the database that produced it

**Correction.** Three explicit layers, in `docs/ip-literature/dedicated-supabase-provenance.md`:
Layer 1 repository (authoritative), Layer 2 evidence content (**non-authoritative**), Layer 3
provider attestation (authoritative, **not implemented**).

Two structural anti-relabelling mechanisms: the evidence body has no `projectRef`/`hostname` field
and the schema is `.strict()`, so a document cannot name its own target; and
`providerProjectRef` originates in the adapter context.

`captureLiteratureProviderAttestation()` always returns `provider_adapter_not_implemented`, so the
best reachable preflight verdict is `provider_attestation_required`.

**Re-run your reproduction.** Take a valid observation from any other database and try to make it
authorize. Try adding `projectRef`. Try a checksum-consistent forgery. Confirm you cannot reach
`ready_to_apply` or `applied_correct` by any file-only route. Confirm no function anywhere
constructs a `LiteratureProviderAttestation` from a file, flag, or environment variable.

### H-1 — the catalog comparator accepted material semantic drift

**Correction.** `LITERATURE_CATALOG_INSPECTION_SQL` now captures 13 sections: extensions, relations
(all relkinds, owner, persistence, RLS **and forced RLS**), types, columns (ordinal, type, notNull,
default, generated, identity, collation), constraints (`pg_get_constraintdef`, validated,
deferrable), functions (identity args, complete return type, language, owner, volatility, strict,
parallel, security, leakproof, full `proconfig`, **full definition**, raw `proacl`), triggers
(`pg_get_triggerdef`, enabled), indexes (`pg_get_indexdef`, unique/primary/valid/ready/method),
policies, a 224-row table-privilege grid, schema privileges, default privileges, and role attributes
including `BYPASSRLS`. Each section carries an exact row count and checksum in the committed
artifact `foundation-catalog-expectations.json`.

**Re-run your reproduction.** Tamper with `literature_admin_stats_v1`'s body while keeping its
signature and ACLs — rehearsal scenario `R17` does exactly this and must FAIL the comparison. Empty
the privilege array — `R18` must FAIL. Also try: owner change, altered default, altered constraint,
altered trigger definition, altered index definition, forced-RLS flip, an extra Literature object.

### H-2 — partial observations passed; non-table collisions were missed

**Correction.** `lib/evidence-schema.ts`: a duplicate-key-rejecting JSON parser, then a strict zod
schema (unknown/missing/wrong-type/partial-section/extra-section all rejected), then typed
`LiteratureEvidenceError` codes — never a raw `TypeError`. Collision detection now covers tables,
partitioned and foreign tables, **views**, materialized views, sequences, types, functions by name,
and indexes.

**Re-run your reproduction.** `catalog: {"tables":[]}` must be rejected. A view named
`public.literature_journals` must be observed — rehearsal `R23` reproduces it, and `R24` proves the
subsequent apply fails and rolls back completely.

### H-3 — production permitted plaintext HTTP and non-canonical URLs

**Correction.** Strict mode accepts only `https://itcttmkxdxvwmwcmzmey.supabase.co`. Distinct reason
codes for scheme, userinfo, query/fragment, port, path, loopback, and non-canonical host.

**Re-run your reproduction.** `http://`, `:8443`, `user:pass@`, `?x=1`, `#x`, `/rest/v1`, a
trailing-dot host, an alternate project host, and a custom host must each be rejected.

### H-4 — any descendant of the approved commit was accepted

**Correction.** `P04-exact-approved-commit` requires `HEAD == origin/main == ownerApprovedCommit`
exactly. Descendants are rejected.

### H-5 — `deploymentMethod` was optional free text

**Correction.** `applicationMechanism` is required and must equal
`supabase_connector_apply_migration_v1` exactly. Omitted, wrapped, suffixed, case-changed, and
arbitrary values are all rejected — the gate is exact equality, not a blacklist.

**Migration-history semantics.** Resolved honestly rather than assumed:
`LITERATURE_MIGRATION_HISTORY_FIDELITY` records that the version is provider-assigned and that the
filename version `20260727032621` may not be what `list_migrations` returns. The postflight requires
**exactly one recorded migration** and defers version identity to execution-time evidence. Verify
nothing asserts the filename version against a managed target.

### M-1 — anything but exact `NODE_ENV=production` was permissive

**Correction.** `NODE_ENV` is no longer consulted. `LITERATURE_SUPABASE_RUNTIME_MODE` is a closed
enum where only the exact string `local` relaxes anything; absent, empty, `Local`, `LOCAL`,
`' local'`, `production`, `Production` all resolve to the strict contract. Local mode permits
loopback **only** and never an arbitrary remote host.

### M-2 — raw, case-sensitive scanning before decoding

**Correction.** Screening runs after decoding, recursively over keys and values, case-normalised,
covering `sb_secret_`, `sb_publishable_`, JWTs, inline-credential connection strings, bearer tokens,
and credential-shaped key names.

**Re-run your reproduction.** `sb_secret_…`, mixed case, nested, in an array, as a key name,
and duplicate keys must all be rejected.

### M-3 — a wrong target could print `applied_correct` before failing later

**Correction.** Target attestation is the first check in `classifyLiteratureRollout`. An unproven,
wrong, stale, or incomplete target yields `provider_attestation_required` /
`stop_read_only_reconciliation`. The exit status agrees with the classification.

### M-4 — the documented sequence exposed an ungated gold-set route

**Correction (sequencing, not scope).** Runbook step 12 now states explicitly that the foundation
migration does **not** authorize Railway cutover, and requires a separate capability-gating /
unavailable-versus-empty package — reviewed and deployed — before the dedicated Railway variables are
set. No gold-set UI is implemented here, by design.

### L-1 — the row-count query existed but was not emitted

**Correction.** `LITERATURE_READ_ONLY_QUERY_BUNDLE` has four entries and the row count is one of
them, marked `postApplicationOnly`. The bundle has a bound SHA-256 that an attestation must carry.
`totalRowCount` is required, integer, non-negative, and must be exactly zero.

### L-2 — stale counts

**Correction.** Everywhere: 33 total, 10 Literature-related, 1 foundation, 9 deferred, 23 unrelated.
A test asserts the `db push` reason text does not say "six deferred" or "twenty-six".

## Gates to re-run

```bash
npm run type-check
npm run lint
npx eslint scripts/literature-dedicated-supabase src/features/literature
npx prettier --check .
npx jest scripts/literature-dedicated-supabase src/features/literature
npx jest scripts/literature
npx jest --runInBand
npm run build
git diff --check
npm run literature:dedicated:rehearse
```

## The pre-existing protected-suite failure

The previous review reported `scripts/literature/generate-gold-import-contract-v2-catalog-expectations.test.ts`
failing on both base `6044bfd9` and the branch.

On this machine it **passes** — 4/4 consecutive runs on the branch, and 54/54 suites / 901 tests
green for the whole `scripts/literature` directory. The branch also changes **zero** files under
`scripts/literature/`, `supabase/`, or `src/features/literature/gold-set/`, so that test's inputs are
byte-identical to base.

Please re-check it in your environment and report base-versus-branch honestly. Do **not** modify
protected catalog expectations or protected V2 authorities to make this PR green unless you can
independently prove PR #104 caused the failure.

## What a good review returns

For each finding B-1, H-1…H-5, M-1…M-4, L-1, L-2: corrected, or a specific counter-example. Flag
anything that would let a hand-authored file authorize a migration, let Literature data reach
`tqnhxlwvkkswuckszlee`, let more than one migration be selected, let a credential escape, let
semantic drift pass, or let an ambiguous acknowledgement become a retry.
