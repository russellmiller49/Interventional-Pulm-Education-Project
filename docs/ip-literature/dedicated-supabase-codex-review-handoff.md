# Independent review handoff — dedicated Literature Supabase bootstrap (second correction pass)

For a fresh reviewer with no context from the implementing sessions.

A first independent review returned **BLOCKED** (one blocking, five high, four medium, two low). A
correction pass followed. A **second** independent review of that correction again returned
**BLOCKED**, with the central architectural finding that a structurally typed attestation object
can never be made unforgeable while the real provider adapter is absent — plus scoping, collision,
parser, URL, query-plan, screening, and runtime-type findings. This document lists the second
correction and asks you to **re-run the exact reproductions**. The goal is to decide whether the
PR is safe to merge — **not** whether the migration should be applied, which is separately gated
and, in this PR, structurally impossible.

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
publishes no port and cannot reach 55322. Running it is safe and is the single most useful check
(41 scenarios).

## The central correction — authority was removed, not hardened (B-1 / M-3)

Your reproduction: construct a plain object with every expected field and checksum, pass it to the
exported evaluator, receive `attested`; pipe that (or a bare `{status:"attested"}`) into the
preflight/reconciliation helpers, receive `ready_to_apply` and `applied_correct`/`proceed`.

**Correction.** The success-capable production API no longer exists:

- `evaluateLiteratureProviderAttestation` was **deleted**. No exported function accepts
  attestation-shaped input. `requireLiteratureProviderAttestation()` takes no arguments and always
  returns `{status:'blocked', reason:'provider_attestation_required'}`.
- No exported type has an `attested` member; `LiteratureProviderAttestation` as an exported
  interface is gone. Future bindings live only as inert data
  (`LITERATURE_LAYER3_REQUIRED_BINDINGS`) that nothing consumes.
- `resolvePreflightOutcome` accepts no attestation status or object; its verdict union is exactly
  `'blocked' | 'provider_attestation_required'`. `ready_to_apply` and the `authoritative` field no
  longer exist. Layer results carry non-authoritative names
  (`repository_checks_passed_nonauthoritative`, `content_checks_passed_nonauthoritative`).
- `classifyLiteratureRollout` accepts no attestation input; its classification union is exactly
  `'provider_attestation_required'` and its next-action union exactly
  `'stop_read_only_reconciliation'`. What it computes is an explicitly
  `*_nonauthoritative` content assessment (e.g. `catalog_matches_expected_nonauthoritative`).
- `captureLiteratureProviderAttestation()` still returns `provider_adapter_not_implemented`, and
  its result union has no success member.
- Both CLIs set `process.exitCode = 1` unconditionally.

**Re-run your reproduction.** Forge the object again — with real recomputed checksums — and try
every route: direct call, `as any` cast, `{status:'attested'}`, deserialized fixture, importing
every public symbol of `attestation.ts`, calling `resolvePreflightOutcome` and
`classifyLiteratureRollout` directly with smuggled extra fields. There is nothing to flip: the
types cannot express success. `scripts/literature-dedicated-supabase/authority-lockdown.test.ts`
replays each of these; a source-scan test additionally asserts no production file contains a
quoted `attested`, `ready_to_apply`, `applied_correct`, `proceed`-next-action, or
`authoritative: true` literal.

## H-1 — managed-project-aware catalog scope

Your reproduction: the committed artifact froze the disposable image's global state (2 installed
extensions, 0 default-ACL rows), while the empty managed project has 5 baseline extensions and 24
`pg_default_acl` rows — guaranteeing false postflight drift.

**Correction.** The catalog is split into four scopes
(`scripts/literature-dedicated-supabase/lib/foundation-catalog.ts`):

1. **Exact foundation-owned** (`LITERATURE_EXACT_CATALOG_SECTIONS`, 9 sections): relations,
   columns, constraints, functions, triggers, indexes, policies, tablePrivileges, types. Only
   these are in `foundation-catalog-expectations.json` (v3.0.0).
2. **Scoped managed prerequisites**: the extensions observation is scoped to `pg_trgm` only
   (`where e.extname = 'pg_trgm'`), checked semantically — absent or in `extensions` pre-apply, in
   exactly `extensions` post-apply, version observed but never bound; role attributes checked
   semantically for the three API roles (exist, not superuser, `BYPASSRLS` shape).
3. **Pre/post deltas**: `defaultPrivileges` (scoped to global/public/extensions rows) and
   `schemaPrivileges` must be _unchanged across the apply_ (`compareGlobalStateDelta`) — no fixed
   inventory is asserted anywhere. For the managed project this remains an execution-time,
   provider-bound requirement that cannot produce success in this PR.
4. **Observation-only**: `indexNames` (see H-2).

**Re-run your reproduction.** Rehearsal `R04`/`R06`/`R10`–`R15`: an unrelated installed extension
(pgcrypto) and a pre-existing `pg_default_acl` row are planted _before_ the apply and do not read
as drift; the delta is empty across the apply; a tampered role attribute (`R14`) and a new
default-privilege grant (`R15`) are still detected. Confirm no code or doc claims the disposable
baseline is an exact managed baseline, and no "5 extensions"/"24 default privileges" constant
exists anywhere.

## H-2 — collision gaps

**Index names.** The inspection now emits an `indexNames` section: every index relname in
`public`, independent of its owning table. `E05-no-name-collision` rejects any expected foundation
index name found there. Rehearsal `R34` plants `literature_articles_search_vector_idx` on an
unrelated table: preflight rejects it, the apply fails, and `R35` proves complete rollback with
the unrelated index surviving.

**pg_trgm location.** `classifyPgTrgmState` distinguishes absent (permitted) / installed in
`extensions` (permitted) / installed anywhere else (rejected,
`E08-Q01-pg-trgm-location`). Rehearsal `R36` installs pg_trgm in `public`: preflight rejects; the
apply fails at `extensions.gin_trgm_ops`; `R37` proves rollback leaves the pre-existing extension
untouched in `public`, no foundation objects, no history row.

## H-2 — strict nested evidence schemas

Every row of every catalog section now has its own `.strict()` zod schema with exact field types
(`lib/evidence-schema.ts`). Nested `projectRef`, `HostName`, Unicode-escaped spellings, arbitrary
nested fields, `{name:5, relkind:"r"}`, malformed booleans/arrays — all controlled
`LiteratureEvidenceError: schema_violation`, never a raw `TypeError`. The JSON parser remains
duplicate-key-rejecting and now rejects unescaped control characters U+0000–U+001F inside strings
(RFC 8259); escaped forms remain valid. Re-run each of your parser reproductions against
`parseLiteraturePreflightEvidence` / `parseLiteraturePostflightEvidence`.

## H-3 — byte-exact production URL

Strict mode compares the **raw** `LITERATURE_SUPABASE_URL` byte-for-byte against
`LITERATURE_CANONICAL_PRODUCTION_URL_EXACT` = `https://itcttmkxdxvwmwcmzmey.supabase.co/` —
trailing slash included — _before any parsing_. No trim, case fold, dot-path resolution,
percent-decoding, or `:443` normalization runs first; parsing happens only after exact equality,
as secondary defense. Local mode keeps its own loopback allowlist and does not share the
production path. Re-run every variant: no slash, `HTTPS://`, `Https://`, whitespace, `:443`,
`/./`, `/%2e`, `/%2E`, `http://`, userinfo, path, query, fragment, trailing-dot host,
alternate/main/custom host — each must fail with the typed reason `noncanonical_production_url`,
and the raw value is never echoed.

## L-1 — phase-specific, existence-safe query plans

The single four-statement bundle is gone. `lib/target-observation.ts` defines three ordered plans
with distinct SHA-256 identities: the **preflight plan** (existence probes + `pg_catalog`-only
inspection; the history-versions step is conditional on the probe; nothing references
`supabase_migrations.schema_migrations` or `public.literature_*` unconditionally), the
**postflight existence probe**, and the **postflight complete plan** (versions/catalog/row count,
each optional-relation step conditional on the probe). Evidence documents are phase-specific:
preflight (`literature-dedicated-preflight-observation/3.0.0`) has **no** `totalRowCount` and
carries `migrationHistory: {tableExists, versions|null}` with versions-null-iff-absent enforced;
postflight requires the existence probe and `totalRowCount`. Each document binds its plan
identity; `E09-preflight-plan-identity` and the postflight plan-violation checks reject
substitution. Rehearsal `R07` runs every unconditional preflight statement against a bare database
with no history table and no Literature relation and they all succeed. Migration history for the
future authoritative gate is documented as coming from provider `list_migrations`.

## M-2 — complete decoded-value vocabulary

`assertDecodedEvidenceCarriesNoSecret` scans decoded keys **and decoded string values**,
case-insensitively, for: secret, token, password/passwd, credential, authorization, bearer,
api key/api*key/apikey, private key, connection string, database URL, service role, `sb_secret*`,
`sb*publishable*`, JWT-shaped values, and inline-credential connection strings. `"password"`and`"Authorization"`as decoded values are rejected. Rejected content is never echoed (offending path
segments are`[redacted-key]`). Legitimate catalog content is admitted through typed exact
allowances rather than weakened screening: the exact role name `service_role`in role positions,
PostgreSQL ACL grammar entries, and the contract's own`serviceRoleExecute` key — free text
containing those tokens is still rejected.

## H-5 — total runtime input handling

`applicationMechanism` is typed `unknown` and type-gated before any string operation:
`null`, arrays, objects, numbers, booleans, symbols, and missing values all produce the controlled
`application_mechanism_not_approved` rejection — never a `TypeError`. The closed enum is retained:
only the exact string `supabase_connector_apply_migration_v1` passes.

## Documentation corrections

- The architecture note names the actual flag (`--print-query-plans`), the actual scenario count
  (41), and the split catalog scopes.
- The threat model names the actual function `assertDecodedEvidenceCarriesNoSecret()`.
- The runbook and provenance notes state that no success verdict exists in this PR and describe
  the non-authoritative content assessments.

## Gates to re-run

```bash
npm run type-check
npm run lint
npx eslint scripts/literature-dedicated-supabase src/features/literature
npx prettier --check .
npx jest scripts/literature-dedicated-supabase src/features/literature
npx jest scripts/literature --maxWorkers=2
npx jest --maxWorkers=2
npm run build
git diff --check
npm run literature:dedicated:rehearse   # repeat three times; 41/41 each
```

## The protected catalog-expectation suite

Run `npx jest scripts/literature/generate-gold-import-contract-v2-catalog-expectations.test.ts`
on both base `6044bfd9` and the branch head, without modifying any protected file, and report
base-versus-branch honestly. The branch changes zero files under `scripts/literature/` or
`supabase/`, so its inputs are byte-identical to base. Do **not** modify protected catalog
expectations or protected V2 authorities to make this PR green unless you can independently prove
PR #104 caused a failure.

## What a good review returns

For each finding — B-1/M-3, H-1, H-2 (collisions), H-2 (schemas), H-3, H-5, L-1, M-2, docs —
corrected, or a specific counter-example. Flag anything that would let _any_ input produce a
success verdict from production code while the provider adapter is absent; let a hand-authored
file authorize a migration; let Literature data reach `tqnhxlwvkkswuckszlee`; let more than one
migration be selected; let a credential escape; let semantic drift pass; or let an ambiguous
acknowledgement become a retry.
