# Gold import-compensation operations runbook v1

This runbook prepares and verifies the `gold-review-import-compensation/1.0.0`
workflow. It is not authorization to apply a migration, execute the pending
import, or execute compensation. The contract migration was applied exactly
once in a separately authorized operation; it must not be rerun. The import and
compensation remain unexecuted.

## Fixed identities and safety boundary

| Input                                 | Required identity                                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Contract migration                    | `20260808035633_add_literature_gold_import_compensation_contract.sql`                                                 |
| Migration SHA-256                     | `e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528`                                                    |
| Contract                              | `gold-review-import-compensation/1.0.0`                                                                               |
| Final 630-row V3 artifact             | `961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59`                                                    |
| Signed 305-row protocol authorization | `784d13736ff0fbf69bd8ad55c8bf55b293c4cc2051b980a3488a980f120c5dd3`                                                    |
| Amended two-row authorization         | `b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a`                                                    |
| Disposable PostgreSQL image           | `public.ecr.aws/supabase/postgres:17.6.1.104@sha256:5deba92e50cd17bfacf8603834d317cdf3bfc1c016ec8293991997fa3b55fa3d` |
| Disposable full-inventory identity    | `b5c6a6050b2c17c60c28fa400c6957103277e51e8b54425c290f43c92a447471`                                                    |
| Canonical identity artifact SHA-256   | `8f709d225f3087c77445b1453cffee994b9c8a8cfdbc004a798efbfff96ee20e`                                                    |

Use Codex Full Access for commands that inspect Git, Docker, or the local
Supabase stack. Migration, import, compensation, backup, upload, and other
shared-state operations run only in the primary checkout on clean `main`
exactly equal to `origin/main`. The two post-migration reconciliation audits
and their file-only additive delivery backup are deliberately narrower
exceptions: they require the exact
reviewed feature-worktree branch and clean tracked state, require `origin/main`
to be an ancestor, pin the local container/port/project, and never authorize a
mutation command. Only the two audits may read the pinned local database, and
only through their asserted read-only transactions; the delivery backup never
contacts a database.

Every target is local. Never pass a remote URL, linked-project identity, or
remote credential. The package and rehearsal CLIs deliberately accept no
database URL. The rehearsal also refuses caller-authored seed SQL,
attestations, and evidence.

Every command requires an explicit approved output root and a new child output
directory. The root must already exist as a real, non-symlink directory. The
tool resolves the root, rejects escapes and `..` traversal, inspects every
existing ancestor below it, and refuses symlinks, non-directory ancestors, and
an existing output collision. It creates the child directory exclusively with
mode `0700` and files exclusively with mode `0600`, then verifies the created
directory remains confined to the approved root. Never merge, replace, or
reuse prior output, and never put temporary or final artifacts outside the
approved root.

## Current fail-closed compatibility finding

The historical package shape was 621 initial actions, three revisions, and six
no-ops. It remains historical evidence only. Production code derives the
action partition from current state and contains no `621/3/6` readiness pin.

The real local catalog uses owner `postgres`; the disposable rehearsal uses
`supabase_admin`. The complete 763-versus-683 diff is explained by the exact
local owner/ACL representation (24 function-owner ACL records plus 56
table-owner ACL records), while invariant definitions, search paths, security
modes, effective execution boundaries, append-only protections, and prohibited
privileges remain exact. Readiness requires
`local_supabase_postgres_owner_v1`; the profile binds the exact owner
attributes, role memberships, ACL matrix, and effective privileges and fails
closed for any other state. The full environment inventory is retained as
evidence but is no longer misused as a cross-environment readiness hash.

The signed V3 provenance authorizes the finalized enrichment deltas, including
additive differences from the nine existing heads, but source authorization
does not override execution compatibility. The real read-only audit validates
all 630 rows before assigning actions and finds zero executable rows:

- `source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1`
  affects all 630 rows: every source `is_blinded` value is semantically false,
  while every local `automatedSignalsRevealedAt` value is null;
- `excluded_status_null_not_representable_by_import_contract_v1` affects all
  272 formal V3 excluded rows: their blank technology- and disease-tag
  statuses are authoritative and outside enrichment scope, while import
  contract v1 requires non-null status enums; and
- `source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1`
  affects 50 rows: `full_text_used=true` conflicts with null local
  `supplementalMetadataRevealedAt` state.

Those three checksum-bound ledgers are execution blockers. They are distinct
from the existing-head field audit, which conservatively reports incompatible
`notes` for PMIDs `36879724` and `39281191`. The finalized source notes differ
from each current authorized rationale, and the signed V3 provenance plus
amended two-row authorization do not provide an exact replace-source-notes or
preserve-current-rationale mapping. The notes therefore remain an unresolved
source-authorization mapping and produce the fourth readiness blocker,
`incompatible_existing_head_fields`. They are classified as incompatible, not
as pending physician-supplement decisions.

The exact boolean-normalization ledger preserves each source lexeme and
semantic value; it cannot change false to true. Ordered V3 pipe lists are
normalized to the import contract's ascending set order only through the exact
source-artifact-bound ledger; V1 authorization and incomplete or substituted
ledgers fail closed. Neither form of normalization repairs a lifecycle-state
mismatch.

The 272 excluded-row blanks are not physician ambiguity. A compatibility
supplement or template would invent out-of-scope enrichment values and is
neither required nor safe; supplying one must not change readiness. No action
plan or package is generated. The exact terminal state is
`CONTRACT STILL BLOCKED — UNRESOLVED DIFFERENCE`. This source/local contract
finding is independent of the safe owner/ACL profile conclusion and does not
propose or authorize a forward migration.

## Operational sequence

### 1. Verify the historical merge and subsequent mainline separately

This step is database-free and may run from a review worktree. One strict CLI
accepts either mode from a checksum-reviewed config; it does not infer a mode
or fall back to an output-only path.

First preserve the historical PR #84/PR #85 proof unchanged:

```bash
npm run literature:verify-gold-import-compensation-merge -- \
  --config <HISTORICAL_MERGE_EQUIVALENCE_CONFIG> \
  --output-root <EXISTING_APPROVED_MERGE_RECEIPT_ROOT> \
  --output <NEW_HISTORICAL_RECEIPT_DIRECTORY>
```

Require `accepted_unrelated_mainline_delta`, 34 protected paths, four accepted
nonoverlapping PR #85 paths, zero overlap, merged-main identity
`858018c247c5fef177bd57b7bef686db2918333e`, and the preserved historical
receipt SHA-256
`4772d0a7da8e4f0c4ecd359d26fb114181a1f8cf0e1a95f542b848b8ccfed962`.
Do not reinterpret later mainline changes as part of this receipt.

Then produce a separate receipt for later accepted mainline changes:

```bash
npm run literature:verify-gold-import-compensation-merge -- \
  --config <SUBSEQUENT_MAINLINE_COMPATIBILITY_CONFIG> \
  --output-root <EXISTING_APPROVED_MERGE_RECEIPT_ROOT> \
  --output <NEW_CURRENT_MAIN_COMPATIBILITY_DIRECTORY>
```

Require `accepted_structured_unrelated_mainline_delta`. Ordinary protected
files must retain byte, Git mode, and object-type identity. Structured
comparison is permitted only for explicitly declared files and named
comparators. The sole authorized structured overlap is `package.json` from PR
#86 merge `da4420f9053a4fe681ab05b078fd5952611eb41e`: it may add exactly JSON
Pointer `/scripts/ip-intel:audit` with value
`tsx scripts/ip-device-intelligence/audit-data-readiness.ts`. The receipt must
also prove every import-compensation script pointer/value is preserved and
enumerate the complete semantic diff. A broad `package.json` exemption is
forbidden because it could conceal dependency, metadata, engine, or unrelated
script substitutions. Malformed or duplicate-key JSON, a deletion, a changed
authorized value, or any undeclared semantic path is a hard failure.

### 2. Prepare the pre-migration backup

Switch to the primary checkout, update clean `main`, start the isolated local
literature stack only if already authorized to do so, and confirm its status.
Then run the always-read-only backup command:

```bash
npm run literature:prepare-gold-import-compensation-migration -- \
  --dry-run \
  --backup-root <EXISTING_APPROVED_BACKUP_ROOT> \
  --output <NEW_PRE_MIGRATION_BACKUP_DIRECTORY>
```

The backup manifest covers canonical schema/security/state artifacts,
`development-planning-state.json`, and
`development-database-seed.json`. The seed contains full rows only for the 630
development members plus one batch and permitted batch-level events. It
contains no held-out identities. `execution-receipt.json` is intentionally
noncanonical.

Verify `checksum-manifest.sha256` before doing anything else. Preserve both the
directory and the manifest SHA-256. Do not edit or reserialize a backup file.

Every list serialized into canonical backup, audit, state, planning, package,
or rehearsal evidence has an aggregate-level ordering contract. Items order by
display order then immutable item ID; review histories by item/display order,
revision, then review ID; events and operation journals by creation timestamp
then immutable ID; operation actions by operation ID, action sequence, then
action ID. Schema objects order by schema, object type, name, identity
arguments or ordinal; policy roles, ACL members, and privileges are normalized
and sorted. `DISTINCT` or an ordered subquery never substitutes for `ORDER BY`
inside the serialized aggregate. A new unordered JSON, array, object, or string
aggregate is a release-blocking test failure.

### 3. Apply the migration only after separate approval

This step is deliberately deferred. When separately approved, run from the
clean primary checkout. `npm run literature:local:start` uses the
project-pinned Supabase CLI and the isolated local workdir; after start it runs
`supabase migration up --local`. Do not use `db push`, do not link a project,
and do not use a remote target.

If the command response is lost or ambiguous, do not run it again. Treat the
outcome as unknown and run the read-only audit in step 4 against the preserved
backup. Exactly one matching migration-ledger row means it committed; absence
means it did not. Any duplicate or inconsistent ledger state is a stop
condition.

### 4. Run the post-migration audit

```bash
npm run literature:audit-gold-import-compensation-migration -- \
  --dry-run \
  --pre-migration-backup <PRE_MIGRATION_BACKUP_DIRECTORY> \
  --pre-migration-backup-manifest-sha256 <REVIEWED_PRE_MIGRATION_MANIFEST_SHA256> \
  --backup-root <EXISTING_APPROVED_AUDIT_ROOT> \
  --output <NEW_POST_MIGRATION_AUDIT_DIRECTORY>
```

Before migration, `not_yet_migrated` is the only expected result and no
planning state is emitted. On the current once-migrated local database, this
legacy full-inventory audit is expected to be `blocked` only by the exact four
superseded owner-specific checks. Any other failure is a stop condition. The
reconciliation command below must then prove one exact ledger entry, unchanged
prior reviews/pointers/effective state, fresh hashes, exact RPC signatures and
bodies, enabled RLS and append-only triggers, safe security-definer search
paths, no PUBLIC execute, intended service-role boundary, no prohibited
privileges, the selected local deployment profile, and the exact lint
allowlist.

The ready audit is one indivisible canonical package:
`migration-audit.json`, `migration-audit.md`,
`development-planning-state.json`,
`schema-security-definition-identity.json`, and
`checksum-manifest.sha256`. The schema/security artifact contains normalized,
exact definitions and state for constraints, triggers, indexes, RLS and
journal policies, RPCs/functions, grants/ACLs, and event vocabulary. Definitions
come from PostgreSQL catalog functions such as `pg_get_constraintdef`,
`pg_get_triggerdef`, `pg_get_indexdef`, `pg_get_functiondef`, and
`pg_get_expr`; the identity also binds `FORCE ROW LEVEL SECURITY`, explicit
protected-column ACL state from `pg_attribute.attacl`, and effective privilege
state. Only irrelevant formatting is normalized. A same-name object
with different columns, actions, predicates, timing, roles, expressions,
security mode, search path, or grants changes the identity and blocks
readiness.

The fixed-image contract verifier also runs six rollback-only definition and
security-state mutation probes after the clean identity is observed: a weakened
same-name trigger, a changed same-name foreign-key action, a broadened same-name
journal policy, a wrong same-name unique-index definition,
`FORCE ROW LEVEL SECURITY` being enabled, and a broadened column-level grant.
Each probe must change the
semantic identity and be rejected by the reviewed identity pin; the transaction
is then rolled back.

Review and preserve the manifest SHA-256 separately. Do not copy the planning
or schema-definition state out of that directory or reserialize any JSON; the
legacy package generator requires all four canonical files to be regular,
non-symlink sibling files, verifies their raw bytes against the reviewed
manifest, and recomputes the semantic schema/security identity.

### 4a. Reconcile the real-local contract representation

From the exact clean reconciliation feature worktree, run:

```bash
npm run literature:diagnose-gold-import-compensation-contract -- \
  --dry-run \
  --pre-migration-backup <PRE_MIGRATION_BACKUP_DIRECTORY> \
  --pre-migration-backup-manifest-sha256 <REVIEWED_PRE_MIGRATION_MANIFEST_SHA256> \
  --backup-root <EXISTING_APPROVED_AUDIT_ROOT> \
  --output <NEW_RECONCILED_POST_MIGRATION_AUDIT_DIRECTORY>
```

The feature-worktree guard does not authorize migration or application
commands. The diagnostic uses read-only repeatable-read catalog/state
transactions, brackets the full snapshot and membership/effective/physical
hashes, reruns lint, and fails on any drift. It emits the canonical reconciled
audit plus `contract-diagnostics.json`, `contract-reconciliation.json`, and
`read-only-state-bracket.json`. The reconciled manifest binds exactly those
three files plus the four legacy audit artifacts; every reconciled downstream
consumer requires, authenticates, and preserves that exact seven-file set.

Require all 763 expected records and all 683 actual records to be accounted
for, the exact 24 function-ACL plus 56 table-ACL collapse, an exact invariant
identity, and exact `local_supabase_postgres_owner_v1` profile. Preserve the
full-inventory identity as evidence. The requested
`reconcile_literature_gold_import_v1` spelling must appear only as
`audit_expectation_defect`; the command queries only
`reconcile_literature_gold_review_operation_v1` and never creates an alias.

### 4b. Audit the finalized source against current planning state

This command is file-only and authenticates the full reconciled audit bundle
before opening the unchanged CSV:

```bash
npm run literature:audit-gold-existing-head-compatibility -- \
  --audit <RECONCILED_AUDIT_DIRECTORY>/migration-audit.json \
  --audit-manifest-sha256 <REVIEWED_RECONCILED_AUDIT_MANIFEST_SHA256> \
  --development-state <RECONCILED_AUDIT_DIRECTORY>/development-planning-state.json \
  --artifact <FINAL_V3_CSV> \
  --output-root <EXISTING_APPROVED_AUDIT_ROOT> \
  --output <NEW_SOURCE_COMPATIBILITY_AUDIT_DIRECTORY>
```

Require all 630 rows to be execution-blocked and zero to be executable. Require
exact blocker counts of 630 source/local blinding mismatches, 272 excluded-row
status mismatches, and 50 supplemental-metadata reveal mismatches. The audit
must also report incompatible `notes` for exactly PMIDs `36879724` and
`39281191` and the fourth readiness blocker
`incompatible_existing_head_fields`. The first three blockers are the counted
execution-compatibility ledgers; the fourth is the conservative
source-authorization mapping failure from the existing-head field audit. The
audit must report zero unresolved physician decisions,
`supplement.required=false`, no supplement template, no
initial/revision/no-op action, and terminal state
`CONTRACT STILL BLOCKED — UNRESOLVED DIFFERENCE`.

Preserve `boolean-normalization-report.json` and
`list-normalization-report.json`; the list report digest must match the audit
source binding and readiness artifact. The source rows and finalized artifact
must remain byte-identical. Do not supply a compatibility supplement and do
not run package generation.

### 5. Package generation remains blocked

Do not invoke the package generator for the current audit. Its readiness gate
must reject the 630 execution-blocked rows before opening a mutation path or
writing package output. A physician supplement cannot satisfy that gate and
must itself be rejected. This runbook does not authorize a source rewrite,
local-state rewrite, or forward migration. Any later package procedure
requires separately reviewed evidence that every source row satisfies the
execution contract; counts must then be derived from that evidence rather than
compared with the historical `621/3/6` distribution.

If a later, separately authorized compatibility result passes that gate, its
generated package must embed the exact seven reconciled audit artifacts and
the original audit manifest, including the contract diagnostics,
reconciliation, and read-only bracket. Its descriptor must bind the reviewed
audit-manifest SHA, the normalized schema/security identity SHA, the
pre-migration backup manifest SHA, and both pre-migration and post-migration
state identities. A recomputed outer package manifest cannot legitimize
replaced audit evidence or a semantically substituted database object.

`row-level-action-plan.json` repeats the import operation ID and import
idempotency key beside every row solely to make the binding reviewable. The
key is operation-scoped, not 630 independently retryable per-action keys;
`perActionIdempotencyKey` is always null. Each row also repeats the deferred
compensation operation ID and derivation-context SHA. The compensation key
remains null until a committed import receipt and fresh database-observed
physical hash are bound into a finalized plan.

The import plan's `expectedPhysicalStateSha256` is the pre-import physical
hash. Post-import and post-compensation physical hashes are never guessed:
their templates say `database_observed_at_execution`. Compensation must restore
the pre-import effective hash while its physical hash must differ from both the
pre-import and post-import physical hashes.

### 6. Rehearse the exact package in a disposable database

Do not run this step unless an exact checksum-valid package exists.

```bash
npm run literature:rehearse-exact-gold-import-compensation-package -- \
  --package <PACKAGE_DIRECTORY> \
  --pre-migration-backup <PRE_MIGRATION_BACKUP_DIRECTORY> \
  --pre-migration-backup-manifest-sha256 <REVIEWED_PRE_MIGRATION_MANIFEST_SHA256> \
  --artifact <FINAL_V3_CSV> \
  --protocol-authorization <SIGNED_PROTOCOL_AUTHORIZATION> \
  --amended-authorization <AMENDED_TWO_ROW_AUTHORIZATION> \
  --migration supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql \
  --output-root <EXISTING_APPROVED_REHEARSAL_ROOT> \
  --output <NEW_REHEARSAL_DIRECTORY>
```

Before starting Docker, the command sends the backup directory and explicit
reviewed manifest SHA through the same full B/C loader used by the audit. That
loader requires the exact canonical inventory plus the noncanonical execution
receipt, pinned pre-migration ledger/schema baselines, a clean repository
identity, PostgreSQL 17/local database provenance, authoritative source
identities, development-only membership, complete review/event histories, and
mutually consistent receipt/state/planning/seed hashes. The rehearsal then
cross-binds its receipt commit, batch, membership, effective state, prior
physical state, planning state, seed identity, and manifest to the exact
package. The seed renderer uses fixed table projections; batch rows, aggregate
sampling reports, exclusion sources, and batch-level events have explicit
field allowlists. Unknown payload fields are refused rather than screened by
name heuristics.

The command itself then performs these database actions, only inside its fresh
immutable-image Docker container:

1. rejects remote or ambiguous Docker host/context overrides, resolves and
   pins one local socket, starts the exact multi-platform OCI-index digest with
   a random run-nonce label, and inspects the returned container ID, exact
   random name, nonce label, and Docker-assigned `127.0.0.1` port before the
   first `psql` call (never reserved real-local port `55322`);
2. creates a fresh random database and a Supabase-compatible migration ledger;
3. atomically applies and records the eight historical migrations;
4. internally renders INSERT-only restore SQL from the checksum-bound
   development seed and restores those rows with constraint triggers disabled
   only for that fresh restore transaction;
5. atomically applies and records the exact contract migration once;
6. verifies the restored membership and exact pre-import effective/physical
   hashes and refuses operation/idempotency collisions;
7. runs the normalized S01-S20 contract verifier;
8. executes the exact import RPC once and discards its response to model a lost
   acknowledgement;
9. observes the committed journal/state and uses a separately bound,
   non-mutating recovery authorization to call the reconciliation RPC—there is
   no automatic import retry—and proves byte-equivalent full-batch snapshots
   before and after reconciliation;
10. separately proves exact replay idempotency;
11. proves an exact stale-database-state rejection (`P7607`) in a rollback-only
    state perturbation and exact stale-authorization and wrong-operation
    rejections, all without persistent mutation;
12. finalizes a rehearsal-only compensation plan from the reconciled receipt
    and fresh observed physical hash, then executes it;
13. proves a second compensation is rejected, effective state is restored,
    physical state remains distinct, and every current pointer is the latest
    physical head;
14. runs the full schema/security introspection and recomputes the exact
    schema/security-definition identity bound by the audit and package: exact RPC overloads,
    signatures, JSONB return types, volatility, ownership, SECURITY DEFINER
    search paths and grants; seven RLS tables; the exact 22 protected-table
    triggers, including all eight contract-specific triggers;
    exact constraints, indexes and journal policies; schema CREATE privileges;
    review/event/journal ACLs including REFERENCES and TRIGGER; exact event
    vocabulary; and pinned Supabase lint;
15. builds deterministic normalized scenario evidence, a physical-hash
    relationship proof, full normalized lint/security evidence, a stable
    package report, and a sorted checksum manifest in memory; and
16. force-removes the random container name exactly once, then independently
    proves absence by the exact random name and, when Docker returned it, the
    owned container ID. Cleanup is armed immediately before `docker run`, so it
    still runs if Docker creates the container but its response is lost or
    malformed. Only after removal and both applicable absence checks succeed
    may the command publish canonical artifacts and mark the noncanonical
    execution receipt approved.

A `docker rm --force` failure, an absence-query failure, or a still-present
name/ID makes the command exit nonzero. The receipt records the cleanup attempt
and outcome, both applicable probes, and `executionApproval: not_approved`; it
preserves the primary verifier error and the cleanup error together and never
labels a canonical manifest successful. Promise rejections and malformed/lost Docker
responses use this same handled cleanup path. Graceful `SIGINT` and `SIGTERM`
record the signal as the primary failure and resolve a signal-notification race
around every active command wait, so even a child command whose promise never
settles cannot hold the JavaScript control path. The first signal immediately
starts one memoized cancellation-then-cleanup sequence. Production cancellation
sends `SIGTERM`, waits at most one second, escalates to `SIGKILL`, and waits at
most one further second before recording cancellation failure and continuing
to the same exactly-once removal and name/ID absence proof. Cancellation,
primary execution, and cleanup errors are preserved together; the command
writes a non-approved failure receipt and exits nonzero. A repeated signal
cannot start a second cancellation or cleanup. The executor cannot handle an
uncatchable process-level `SIGKILL`, host crash, or abrupt runtime death in
JavaScript. After one of those external interruptions, treat the run as failed
and use the random owned name/label on the pinned local Docker endpoint to
verify and remove any residue before another run.

The execution receipt alone contains volatile timestamps, container identity,
database fingerprint, raw physical hashes, raw RPC receipts, lint diagnostics,
and raw verifier UUIDs. Every manifest-covered artifact is deterministic. The
normalized contract scenarios use equality-preserving UUID and physical-state
tokens. Exact-package evidence and the state-hash proof retain the bound
pre-import hash but represent post-import and post-compensation physical hashes
as stable `database_observed_at_execution` relationship rules; they never
fabricate or publish a repeatable post-state digest. Two fresh runs with
different database fingerprints and raw post-state hashes therefore produce
byte-identical canonical artifacts and manifests when all contract outcomes
are the same.

### 7. Review and authorize later execution

Review the immutable plan, row actions, source authorization set, state-hash
rules, reconciliation instructions, compensation template, and both manifests.
Any regenerated or changed package supersedes the prior candidate; never mix
files or authorizations across package manifests.

Import authorization is a new, separate, operation-scoped authorization. A
later import may run only from primary clean `main`, against the fixed local
database, after a fresh read-only state check. Submit the one atomic import RPC
once. If its response is ambiguous, do not retry: observe state, bind a
non-mutating recovery authorization, call reconciliation, and preserve the
sealed receipt.

Verify post-import effective and database-observed physical hashes. Preserve
the compensation template but do not execute it. A compensation plan cannot be
finalized until the committed import receipt and a fresh physical hash exist,
and execution always requires a new, separate compensation authorization. It
must append void/restore heads; it may never update/delete an immutable row,
null or rewind a pointer, rewrite a supersedes link, or claim physical equality
with pre-import state.

Held-out test identities remain inaccessible throughout. Only aggregate lock
state may be reported. Any held-out identity disclosure, remote connection,
stale hash, source-byte mismatch, output collision, symlink, migration-ledger
collision, or action-count mismatch is a hard stop.
