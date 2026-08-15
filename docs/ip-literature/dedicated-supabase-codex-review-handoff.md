# Independent review handoff — dedicated Literature Supabase bootstrap (fifth correction pass)

For a fresh reviewer with no context from the implementing sessions.

A first independent review returned **BLOCKED** (one blocking, five high, four medium, two low). A
correction pass followed. A **second** independent review of that correction again returned
**BLOCKED**, with the central architectural finding that a structurally typed attestation object
can never be made unforgeable while the real provider adapter is absent — plus scoping, collision,
parser, URL, query-plan, screening, and runtime-type findings.

A **third** independent review confirmed the authority lockdown holds and returned **BLOCKED** on
six remaining findings: a CLI exit-status hole, non-position-specific ACL allowances, an exact
catalog comparison that included unrelated public objects, a production runtime that variables
alone could activate, an exact URL missing its trailing slash in prose, and stale documentation
states.

A **fourth** independent review returned **BLOCKED** on four remaining findings: a
`__proto__`/dotted-path/arbitrary-object evidence-boundary bypass, `0.0.0.0` surviving on the
local client allowlist, a stale live PR body, and a suite-wide Jest timeout increase.

A **fifth** independent review returned **BLOCKED** on six bounded findings: a duplicate-key error
echoing the supplied key, a CLI test wrapper that could orphan a `git` descendant, alias spellings
of the loopback address surviving WHATWG normalization onto the local allowlist, an ACL grammar
that only ran when secret screening happened to look, an inconsistent rollout sequence, and a PR
body claiming more than the diff supported.

This document lists **all** of those corrections and asks you to **re-run the exact
reproductions**. The goal is to decide whether the PR is safe to merge — **not** whether the
migration should be applied, which is separately gated and, in this PR, structurally impossible.

The rollout sequence in force is option B: **Layer 3 before the migration authorization.** It is
stated in full under "Fifth correction pass — 5" below, and identically in the runbook, provenance
note, architecture note, and live PR body.

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
publishes no port and cannot reach 55322. Running it is safe and is the single most useful check;
it prints its own `N/N scenarios passed` line.

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
as secondary defense. Local mode keeps its own canonical local-host allowlist (`localhost`,
`127.0.0.1`, `[::1]`; `0.0.0.0` and `[::]` are refused as wildcard bind addresses) and does not
share the production path. Re-run every variant: no slash, `HTTPS://`, `Https://`, whitespace, `:443`,
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

The parsers' module-private screener (`assertParsedEvidenceCarriesNoSecret`; the previously
exported arbitrary-object scanner was removed by the fourth correction) scans decoded keys **and
decoded string values**, case-insensitively, for: secret, token, password/passwd, credential,
authorization, bearer, api key, private key, connection string, database URL, service role, the
Supabase key prefixes, JWT-shaped values, and inline-credential connection strings. The decoded
values `"password"` and `"Authorization"` are rejected. Rejected content is never echoed —
offending path segments render as `[redacted-key]`. Legitimate catalog content is admitted
through typed exact allowances rather than weakened screening, and since the third correction
those allowances are **position-specific** (see finding 2 below); free text containing the tokens
is still rejected everywhere. Screening is exercised through
`parseLiteraturePreflightEvidence` / `parseLiteraturePostflightEvidence`, the only parsing
surfaces that exist.

## H-5 — total runtime input handling

`applicationMechanism` is typed `unknown` and type-gated before any string operation:
`null`, arrays, objects, numbers, booleans, symbols, and missing values all produce the controlled
`application_mechanism_not_approved` rejection — never a `TypeError`. The closed enum is retained:
only the exact string `supabase_connector_apply_migration_v1` passes.

## Third correction pass — the six findings above

### 1. Every CLI invocation exits nonzero

Your reproduction: `npx tsx scripts/literature-dedicated-supabase/preflight.ts --print-query-plans`
printed the plans and exited **0**, because the early return happened before
`process.exitCode = 1`.

**Correction.** Both CLIs call `blockExitStatus()` at main entry — before any argument-dependent
branch — and re-assert it in `.finally(blockExitStatus)`. The plans are still printed; printing
them is simply not a success. Re-run every invocation: no arguments, `--print-query-plans`,
`--print-query-plans` combined with a full argument set, valid evidence, invalid evidence, an
unreadable evidence path, an unknown flag, a repeated flag — for both CLIs. Each must exit nonzero
and contain no `ready_to_apply` / `applied_correct` / `attested` / proceed-next-action text.
`scripts/literature-dedicated-supabase/cli-exit-status.test.ts` spawns real subprocesses for all of
these.

### 2. Secret-screening allowances are position-specific

Your reproduction: `{owner: "password=foo/grantor"}` and `{definition: "token=abc/grantor"}`
matched the ACL grammar and survived screening anywhere in the document.

**Correction.** The screener threads the decoded structural path through its recursion — since
the fourth correction as structured `(string | number)` segments rather than a concatenated
string — and each allowance is bound to exact paths: ACL grammar only in
`catalog.functions[*].acl[*]` and `catalog.defaultPrivileges[*].acl[*]`; the literal `service_role`
only in `catalog.{tablePrivileges,schemaPrivileges,roleAttributes}[*].role` and
`prerequisites.roles[*]`; the `serviceRoleExecute` **key** only on a `catalog.functions[*]` row.
`LITERATURE_ACL_BEARING_CATALOG_SECTIONS` and `LITERATURE_ROLE_BEARING_CATALOG_SECTIONS` are
derived from `LITERATURE_CATALOG_ROW_SCHEMAS` by a test, so a schema change cannot widen them
silently.

Re-run through the **full parser**: those two values in `owner`, `definition`, `name`, `type`,
`schema`, a function body, an index/trigger definition, `migrationVersions`, and
`existenceProbe.presentLiteratureTables`; the same values inside real `acl` arrays (must pass);
malformed ACL values inside `acl` arrays (must fail); `sb_secret_…` inside an `acl` array (must
fail); mixed-case and `\u`-escaped variants. Rehearsal `R41` additionally round-trips the genuine
post-apply catalog — real function ACL arrays, real `service_role` privilege rows — through
`parseLiteraturePostflightEvidence` to prove the allowance is not too narrow.

### 3. The exact catalog scope is foundation-owned only

Your reproduction: create an unrelated public table, preflight passes, apply the migration,
postflight sees 9 public relations against the artifact's 8 and reports drift.

**Correction.** Broad observation and exact comparison are separated.
`collectCatalogCollisionInventory` keeps the unfiltered public inventory for `E05`;
`projectFoundationOwnedSection` narrows the exact comparison to the eight foundation relations and
to `LITERATURE_FOUNDATION_OWNED_TYPES` (empty — the migration defines no standalone type). Every
other exact section was already SQL-scoped to `literature%`. The committed artifact is unchanged:
it already held 8 relations and 0 types, which is why the projection is a no-op on the rehearsal
snapshot and a fix on a real project.

Re-run your reproduction against rehearsal `R38`–`R40`: an unrelated table (plus its implicit
sequence), an unrelated view, and an unrelated enum are planted before the apply; preflight passes;
the apply succeeds; the exact comparison matches; all survive; and an extra `literature_`-named
table is still reported as drift and as an unexpected Literature object. Confirm that a colliding
Literature name of any relkind still stops the preflight (`R32`–`R37`, plus `catalog-scope.test.ts`).

### 4. No production Literature client is constructed

Your reproduction: the runtime validated the dedicated project and then called
`createClient(url, secretKey)`, which existing curation and gold-set callers use for mutating RPCs.

**Correction.** `LITERATURE_PRODUCTION_RUNTIME_ACTIVATION` is a **source constant** set to
`not_activated`. Strict mode validates everything and then returns the typed state `not_activated`
/ `dedicated_runtime_not_activated`, which carries no `secretKey`. `createLiteratureAdmin()`
reaches `createClient` only when the binding is `bound` **and** the mode is exactly `local`
**and** the URL is on the canonical local-host allowlist (`localhost`, `127.0.0.1`, `[::1]` —
never `0.0.0.0`). No environment variable introduced by this PR can
activate the remote client; activation requires a code change in the future capability-gating /
cutover PR.

Re-run: set the three documented production variables exactly, in every combination, and confirm
`createLiteratureAdmin()` returns `null`, `createClient` is never called, and
`searchLiterature` / `getLiteratureArticle` / `loadLiteratureAdminStats` /
`curateLiteratureArticle` / `listLiteratureGoldSetBatches` all return
`"The literature database is not configured."` without invoking `.rpc()` or `.from()`. Then confirm
a loopback local configuration still constructs exactly its intended client.
`src/features/literature/server/runtime-activation.test.ts` mocks `@supabase/supabase-js` and
asserts all of this.

### 5. The exact URL includes the trailing slash

`LITERATURE_CANONICAL_PRODUCTION_URL_EXACT` = `https://itcttmkxdxvwmwcmzmey.supabase.co/`. The
architecture note and the runbook now show that exact value wherever they present a configuration
value, and label the bare host as a host/ref description where they mean one.
`docs-consistency.test.ts` asserts the runbook's `LITERATURE_SUPABASE_URL=` line equals the
executable constant.

### 6. Documentation states match the code

The threat model's threat-shaped check IDs (which were never check IDs), its two misnumbered
repository-rule references, and three outcome names left over from superseded iterations are gone.
Brittle counts — a per-layer check count in the runbook, a rehearsal scenario count in the
architecture note — are removed from prose rather than corrected, so they cannot go stale again.

`docs-consistency.test.ts` binds what remains to production exports and fails on the _shape_ of the
old mistakes: every backticked `P`/`E`/`Q` check ID across the five documents must be produced by
the real evaluators; the runbook's content-assessment table must equal
`LITERATURE_CONTENT_ASSESSMENTS` exactly; no superseded outcome name, threat-shaped check ID,
per-layer check count, or scenario count may appear anywhere; every documented CLI flag must exist
in a CLI source; and the exact URL must carry its trailing slash in all five documents and
`.env.example`.

## Fourth correction pass — the four findings above

### 1. The evidence boundary takes JSON text only (high)

Your reproduction: `{"__proto__": <valid document>}` with a credential-shaped relation owner —
assignment-based construction swapped the decoded object's prototype, `Object.entries` saw no own
fields, the strict schema read every required field through the polluted prototype, and both
parsers accepted the credential-shaped value. Separately: a literal key spelled
`catalog.functions[0].acl[0]` collided with the concatenated screening path, and the exported
scanner accepted an arbitrary object/`Proxy` that could hide its keys from reflection.

**Correction.** Architectural, not a denylist patch:

- the parsers accept **`typeof input === 'string'` only**, refusing every object, array, boxed
  `String`, `Proxy`, getter carrier, and conversion carrier _before_ any property access,
  coercion, or reflection — no `String(input)` or `JSON.stringify(input)` ever runs on the input;
- decoded objects are built as `Object.create(null)` with `Object.defineProperty` own enumerable
  data members (never `result[key] = value`), duplicates tracked in a separate `Set`;
- the reserved structural keys `__proto__`/`prototype`/`constructor` are rejected at every depth
  on the decoded key (Unicode-escaped spellings included) with the controlled code
  `reserved_structural_key`;
- screening paths are structured `readonly (string | number)[]` segments matched as exact
  sequences, so a dotted/bracketed literal key is one segment and can never satisfy an allowance;
- `assertDecodedEvidenceCarriesNoSecret` is **gone from the export surface**; the renamed
  module-private screener runs only on the schema-normalized parser-owned graph inside
  `parseEvidence`;
- the fail-closed order is: string admission → safe decode → strict schema (sanitized messages
  that never echo unknown keys or received values) → secret screening → business rules.

Re-run: the `__proto__` wrapper (top-level and nested, plain and Unicode-escaped, with valid and
credential-carrying payloads), `prototype`/`constructor` keys, duplicate reserved keys, dotted and
bracketed spoof keys, numeric-looking keys, and every non-string parser input (plain object,
null-prototype object, boxed `String`, trap-counting `Proxy`, key-hiding `Proxy`, key-synthesizing
`Proxy`, throwing `Proxy`, getter carrier, `toString`/`valueOf`/`Symbol.toPrimitive` carrier) —
asserting zero trap/getter/conversion invocations. `evidence-schema.test.ts` carries the full
matrix; genuine ACL/role/`serviceRoleExecute` content must still pass at its exact positions and
nowhere else.

### 2. `0.0.0.0` is not a local destination (medium)

Your reproduction: `LITERATURE_SUPABASE_RUNTIME_MODE=local` +
`LITERATURE_SUPABASE_URL=http://0.0.0.0:55321` returned `bound` and constructed a client.

**Correction.** The permissive local check is now a closed canonical allowlist — exactly
`localhost`, `127.0.0.1`, `[::1]` as Node 20's `URL.hostname` serializes them (pinned by test).
`0.0.0.0` and `[::]` are refused with their own reason, `wildcard_address_not_permitted`;
`*.localhost`, `localhost.localdomain`, other `127/8` aliases, IPv4-mapped IPv6 forms, and every
remote host are refused with `remote_host_not_permitted_in_local_mode`. No DNS resolution. The
broad "local-shaped" detection survives only as strict-mode refusal diagnostics, where it can
only reject. `runtime-activation.test.ts` proves the wildcard configurations construct nothing
(`createClient` uncalled, `.rpc()`/`.from()` unreachable) and strict/deployed environments still
resolve `not_activated`.

### 3. One canonical current record in the live PR body (low)

The live PR body retained superseded current-sounding validation claims alongside the corrected
ones. It has been rewritten from scratch: one current-state record, one canonical validation
section with the fourth-pass measurements, the four findings and their corrections, one safety
attestation, and a clearly labeled superseded-historical table. No stale count reads as current.

### 4. No Jest timeout increase (low)

Your reproduction: `cli-exit-status.test.ts` set `jest.setTimeout(120_000)` while the PR body
claimed no timeout increase.

**Correction.** The suite-wide timeout is removed entirely; nothing replaces it — no per-test
Jest timeout, no retry, no `forceExit`, and no worker reduction in any test file. Each subprocess
invocation runs in its own test within Jest's ordinary 5 s default. Containment is a
**child-process** timeout (4 000 ms, `SIGKILL`), chosen from measured durations (≈0.09–0.12 s
direct, ≈0.21 s under eight-way contention) as a hung-process guard below the Jest default. An
adversarial test runs a review-owned hanging child that would write a marker file if it survived:
the child is SIGKILLed, the wrapper reports a controlled failure, the PID is gone, and the marker
never appears. Search the PR diff for `jest.setTimeout`, per-test timeouts, retries, and
`forceExit`: the expected count of PR-added occurrences is zero.

The one worker-policy string this PR adds anywhere is the `--runInBand` in the convenience
`literature:dedicated:test` script in `package.json`. It is convenience, not concealment: the same
paths pass under Jest's default worker count and under `--maxWorkers=50%` — both commands are in
"Gates to re-run" below, and this handoff makes no zero-occurrence claim about worker policy.

(The fifth correction below replaced the containment mechanism — `spawn`'s own `timeout` option —
with a group-directed kill, and left the budget and the absence of Jest policy changes exactly as
they are.)

## Fifth correction pass — six bounded findings

A **fifth** independent review returned **BLOCKED** on six findings. This pass corrects exactly
those six and adds no new architecture, provider adapter, migration executor, authorization model,
parsing framework, or threat-model expansion.

### 1. Duplicate-key errors echoed the attacker-supplied key (finding 1)

Your reproduction: an evidence document repeating a credential-shaped key produced
`The evidence document repeats the key "sb_secret_…"`, and the preflight CLI printed that message
to stdout.

**Correction.** The duplicate-key failure now carries a **character offset** and an explicit
statement that the key is redacted — nothing drawn from the document itself. Re-run with
credential-shaped duplicate keys (secret-prefixed, publishable-prefixed, JWT-shaped,
`Authorization: Bearer …`, a connection string with an inline password, and a bare vocabulary
word), at the top level and nested inside a catalog row, and check the thrown error, stdout, and
stderr. `evidence-schema.test.ts` carries the parser matrix; `cli-exit-status.test.ts` runs both
CLIs against three such documents and asserts nothing leaks into either stream.

### 2. Containment killed the CLI but could orphan its `git` descendant (finding 2)

Your reproduction: `spawn`'s `timeout` option signals only the direct child, and the preflight
spawns `git` (`gatherRepositoryFacts`), so a wedged invocation left a descendant running after the
test that "contained" it had finished.

**Correction.** Each CLI runs in an **operation-owned process group** (`detached`, so the child
leads the group and every descendant joins it), and the containment timeout signals the whole
group with `process.kill(-pid, 'SIGKILL')`. Where process groups do not exist (Windows) or the
group signal cannot be delivered, an explicit direct-child kill is the fallback. The containment
timer is cleared on close and `unref`ed, so nothing leaks.

Re-run the focused regression: a fake CLI spawns a harmless `git` stand-in that would write a
marker file 1.5 s later, then wedges. The test asserts the direct process **and** the descendant
are gone, the marker is never written, and no child-process handle remains. Flip `detached` off
locally and the descendant survives — that is the defect the test detects. A second test asserts
the opposite direction: a concurrent invocation running beside the killed one is untouched — it
exits 0, unsignalled, and completes its own work — so the group signal reaches exactly one
operation and never the runner. **No Jest timeout, retry, `forceExit`, skip, or worker-policy
change was added.**

### 3. WHATWG normalization widened the local allowlist (finding 3)

Your reproduction: `LITERATURE_SUPABASE_RUNTIME_MODE=local` with `http://127.1:55321` —
or `127.0.1`, `127.000.000.001`, `0177.0.0.1`, `0x7f.1`, `2130706433` — returned `bound` and
constructed a client, because the URL parser rewrites every one of those to the string
`127.0.0.1` before the allowlist sees it.

**Correction.** The **raw** authority is judged first, before any `URL` is constructed: only
`localhost` (ASCII-case-insensitively — a URI host is case-insensitive by definition), `127.0.0.1`,
and `[::1]`, with an optional in-range port and no userinfo, are admitted. The URL is then parsed
and revalidated exactly as before, so both gates must agree. Alias spellings stop with their own
reason, `noncanonical_local_url_authority`; the wildcard (`0.0.0.0`, `[::]`) and remote-host
refusals keep the reasons the fourth review gave them. **No DNS resolution is performed.**
`runtime-activation.test.ts` proves each rejected spelling constructs no client — `createClient`
uncalled, `.rpc()` and `.from()` unreachable, every server function still returning "not
configured".

### 4. The ACL grammar ran only when secret screening happened to look (finding 4)

Your reproduction: `not-an-acl-entry` inside `catalog.functions[0].acl[0]` was accepted. The
canonical grammar was consulted only from inside the screener's position allowance, which runs
only for values that already match the secret vocabulary, so a malformed but innocuous entry was
never checked against it.

**Correction.** The grammar is now applied by the **row schemas**, to every non-null member of
`catalog.functions[*].acl[*]` and `catalog.defaultPrivileges[*].acl[*]`, at the schema stage —
before screening runs and regardless of the value's content. Re-run with malformed non-secret
entries (`not-an-acl-entry`, an empty entry, a missing grantor, an internal space, trailing
content, prose, a hyphenated grantee, a null or non-string member) and with the genuine catalog
entries as positive controls (`service_role=X/supabase_admin`, `=X/supabase_admin`,
`postgres=arwdDxt/postgres`, the grant-option asterisk, quoted role names). Each malformed input
is refused with one input-independent message; the rehearsal's `R41` scenario still parses a real
post-apply catalog through the same schema.

### 5. The rollout sequence disagreed between documents (finding 5)

The implemented design is option B — **Layer 3 is required before the migration authorization** —
but the runbook ran the preflight before the authorization and the PR body listed the migration
before Layer 3.

**Correction.** One sequence, stated identically in the runbook, the provenance note, the
architecture note, this handoff, and the live PR body:

1. Merge this preparation PR after independent review.
2. Implement and independently review Layer 3.
3. Obtain the exact owner migration authorization.
4. Run the provider-bound preflight.
5. Apply exactly the foundation migration.
6. Run the provider-bound postflight, and stop.
7. Implement and deploy capability gating, while the runtime stays disabled.
8. Obtain the Railway authorization and cut over.
9. Stop, before any canary or ingestion.

No document describes step 5 as executable through the CLIs in this repository. They hold no
credential, open no connection, apply nothing, and exit nonzero on every invocation.

### 6. The live PR body claimed more than the diff supported (finding 6)

It claimed zero PR-added worker-policy occurrences while `package.json` adds a convenience
`literature:dedicated:test` command that uses `--runInBand`, and its current-main inventory named
only `src/features/device-intelligence/**`.

**Correction.** The body is one current record. It states plainly that the convenience command
uses `--runInBand` **and** that the same suites pass under default workers and under
`--maxWorkers=50%`, so the flag is convenience rather than concealment; and the current-main
inventory names both `src/features/device-intelligence/**` and `docs/ip-device-intelligence/**`.
One validation section, one safety attestation, one future-package sequence.

## Earlier documentation corrections

- The architecture note names the actual flag (`--print-query-plans`) and the split catalog scopes.
- The threat model names the actual screening function (now the module-private
  `assertParsedEvidenceCarriesNoSecret`, renamed and unexported by the fourth correction).
- The runbook and provenance notes state that no success verdict exists in this PR and describe
  the non-authoritative content assessments.

## Gates to re-run

```bash
npm run type-check
npm run lint
npx eslint scripts/literature-dedicated-supabase src/features/literature
npx prettier --check .
npx jest scripts/literature-dedicated-supabase src/features/literature
npx jest scripts/literature-dedicated-supabase/cli-exit-status.test.ts   # spawns real subprocesses
npx jest scripts/literature-dedicated-supabase/evidence-schema.test.ts
npx jest scripts/literature-dedicated-supabase/catalog-scope.test.ts
npx jest scripts/literature-dedicated-supabase/docs-consistency.test.ts
npx jest src/features/literature/server/dedicated-project-contract.test.ts
npx jest src/features/literature/server/runtime-activation.test.ts
npx jest scripts/literature --maxWorkers=2
npx jest --maxWorkers=2
npm run build
git diff --check
npm run literature:dedicated:rehearse   # repeat three times; all scenarios must pass each time
```

`npm run literature:dedicated:test` is a convenience alias for the dedicated suites and passes
`--runInBand`. It is convenience, not concealment: run the same paths under Jest's default worker
count and under `--maxWorkers=50%` and they pass identically.

```bash
npx jest scripts/literature-dedicated-supabase src/features/literature/dedicated-supabase src/features/literature/server
npx jest scripts/literature-dedicated-supabase src/features/literature/dedicated-supabase src/features/literature/server --maxWorkers=50%
```

While the CLI suite runs, watch for leaked processes — `pgrep -f 'literature-dedicated-supabase'`
after it finishes must be empty.

## The protected catalog-expectation suite

Run `npx jest scripts/literature/generate-gold-import-contract-v2-catalog-expectations.test.ts`
on both base `6044bfd9` and the branch head, without modifying any protected file, and report
base-versus-branch honestly. The branch changes zero files under `scripts/literature/` or
`supabase/`, so its inputs are byte-identical to base. Do **not** modify protected catalog
expectations or protected V2 authorities to make this PR green unless you can independently prove
PR #104 caused a failure.

## What a good review returns

For each finding — B-1/M-3, H-1, H-2 (collisions), H-2 (schemas), H-3, H-5, L-1, M-2, the six
third-review findings, the four fourth-review findings, and the six fifth-review findings above —
corrected, or a specific counter-example. Flag anything that would
let _any_ input produce a success verdict or a zero exit status from production code while the
provider adapter is absent; let a hand-authored file authorize a migration; let an environment
variable construct a production Literature client or reach a mutating RPC; let Literature data
reach `tqnhxlwvkkswuckszlee`; let more than one migration be selected; let a credential escape at
any document position; let semantic drift pass; let an unrelated public object read as drift; or
let an ambiguous acknowledgement become a retry.
