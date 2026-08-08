# Gold import-compensation operations runbook v1

This runbook prepares and verifies the `gold-review-import-compensation/1.0.0`
workflow. It is not authorization to apply a migration, execute the pending
import, or execute compensation. The real migration, import, and compensation
were not run while this tooling was implemented.

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

Use Codex Full Access for commands that inspect Git, Docker, or the local
Supabase stack. Real-local operations run only in the primary checkout on a
clean `main` exactly equal to `origin/main`. This implementation worktree may
run read-only unit checks and the self-contained disposable rehearsal; it must
not run the primary-only local Supabase mutation commands.

Every target is local. Never pass a remote URL, linked-project identity, or
remote credential. The package and rehearsal CLIs deliberately accept no
database URL. The rehearsal also refuses caller-authored seed SQL,
attestations, and evidence.

Canonical output directories must be absent before each command. Put them
under the command's approved backup/output root, never behind a symlink. A
collision is a stop condition; do not merge, replace, or reuse prior output.

## Current fail-closed compatibility finding

The expected historical package shape is 621 initial actions, three additive
revisions, six identical-content no-ops, 624 inserts, and 630 total actions.
Compensation would map that exact shape to 621 voids, three restores, and six
no-actions.

The generator does not trust those historical classifications. It derives each
action from `development-planning-state.json` plus the finalized CSV and
compares every contract clinical/enrichment field. The current real database
has nine existing review heads, while the migration adds six enrichment fields
as nullable without backfilling them. The finalized CSV supplies values for
those fields (and also contains blank status values that strict contract
validation may reject). The observed real state therefore cannot truthfully
produce the historical six no-ops under contract 1.0.0; the derivation is
expected to report `real_state_shape_mismatch` (621 initial, nine revisions,
zero no-ops) or `real_contract_incompatibility` and create no executable
package.

Do not bypass this result with hand-authored or preclassified planning rows.
Stop and obtain an explicit reviewed decision about the core contract,
migration/backfill, or authoritative artifact. Editing any of those is outside
this operational tooling change.

## Operational sequence

### 1. Verify the path-scoped merge

This step is database-free and may run from a review worktree. Use either the
accepted config file or the explicit form:

```bash
npm run literature:verify-gold-import-compensation-merge -- \
  --feature-head 21fc97ce66b724040d261f7404bec5658b8caaa2 \
  --merge-commit 858018c247c5fef177bd57b7bef686db2918333e \
  --merged-main <CURRENT_MERGED_MAIN_SHA> \
  --protected-path-inventory <PR84_PROTECTED_PATHS> \
  --accepted-unrelated-merge 'PR-85=<PR85_MERGE_SHA>' \
  --output <NEW_MERGE_RECEIPT_DIRECTORY>
```

Require `accepted_unrelated_mainline_delta`, 34 protected paths, four accepted
nonoverlapping PR #85 paths, and zero overlap. Verify the emitted manifest.

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
planning state is emitted. After migration, require `ready`, one exact ledger
entry, unchanged prior reviews/pointers/effective state, fresh hashes, exact
RPC signatures, enabled RLS and append-only triggers, safe security-definer
search paths, no PUBLIC execute, intended service-role boundary, no prohibited
privileges, and the exact lint allowlist.

The ready audit is one indivisible canonical package:
`migration-audit.json`, `migration-audit.md`,
`development-planning-state.json`, and `checksum-manifest.sha256`. Review and
preserve the manifest SHA-256 separately. Do not copy the planning state out of
that directory or reserialize any JSON; the package generator requires the
three canonical files to be regular, non-symlink sibling files and verifies
their raw bytes against the reviewed manifest.

### 5. Generate the package

Package generation is read-only and contacts no database. It gates the audit
before opening the source artifacts:

```bash
npm run literature:generate-gold-import-compensation-package -- \
  --audit <POST_AUDIT_DIRECTORY>/migration-audit.json \
  --audit-manifest-sha256 <REVIEWED_POST_AUDIT_MANIFEST_SHA256> \
  --development-state <POST_AUDIT_DIRECTORY>/development-planning-state.json \
  --artifact <FINAL_V3_CSV> \
  --protocol-authorization <SIGNED_PROTOCOL_AUTHORIZATION> \
  --amended-authorization <AMENDED_TWO_ROW_AUTHORIZATION> \
  --migration supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql \
  --output-root <EXISTING_APPROVED_PACKAGE_ROOT> \
  --output <NEW_PACKAGE_DIRECTORY>
```

At present, expect the compatibility failure documented above. That failure is
the safe result. If a later reviewed change makes the real derivation exactly
621/3/6, verify every package manifest entry and confirm 630 actions, 624
inserts, compensation 621/3/6, append-only heads, no pointer rewind, and source
hashes before proceeding.

The generated package embeds the exact canonical audit JSON, Markdown,
planning-state JSON, and original audit manifest. Its descriptor binds the
reviewed audit-manifest SHA, each embedded file SHA, the pre-migration backup
manifest SHA, and both pre-migration and post-migration state identities. A
recomputed outer package manifest cannot legitimize replaced audit evidence.

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
14. runs the full schema/security introspection: exact RPC overloads,
    signatures, JSONB return types, volatility, ownership, SECURITY DEFINER
    search paths and grants; seven RLS tables; the exact 22 protected-table
    triggers, including all eight contract-specific triggers;
    exact constraints, indexes and journal policies; schema CREATE privileges;
    review/event/journal ACLs including REFERENCES and TRIGGER; exact event
    vocabulary; and pinned Supabase lint;
15. writes deterministic normalized scenario evidence, a physical-hash
    relationship proof, full normalized lint/security evidence, a stable
    package report, a sorted checksum manifest, and a noncanonical execution
    receipt; and
16. force-removes the random container name in a `finally` cleanup path. The
    cleanup attempt is armed immediately before `docker run`, so it still runs
    if Docker creates the container but its run response is lost or malformed.

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
