# Gold import contract V2 protected-application runbook

> Status: historical application record. Real-local V2 is applied exactly once and its recovered
> migration receipt is finalized. Do not rerun the application or receipt-recovery commands.

This runbook preserves the completed forward-only Literature gold-import V2 application boundary.
Its operator sequence is retained for audit meaning only and is no longer executable authority.
Current package preparation begins with the separately versioned
[`gold-import-v2-post-migration-preimport-capture.md`](./gold-import-v2-post-migration-preimport-capture.md)
workflow. `npm run literature:local:start` remains a development lifecycle command, not migration,
package, import, or compensation authorization.

## Fixed boundary

| Identity                  | Required value                                                           |
| ------------------------- | ------------------------------------------------------------------------ |
| V1 migration              | `20260808035633_add_literature_gold_import_compensation_contract.sql`    |
| V1 SHA-256                | `e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528`       |
| Protected V2 migration    | `20260809231651_add_literature_gold_import_compensation_contract_v2.sql` |
| Protected V2 migration ID | `20260809231651_add_literature_gold_import_compensation_contract_v2`     |
| Protected V2 SHA-256      | `3f34934391b3c1ca3ff2ab96c103fe64f05fc29e7b2e0d8375dd6742401995b1`       |
| V2 verifier SHA-256       | `2570f0885ed646247df7dd3e375b835c7591f2750bc190d63845191cd0426eeb`       |
| Local project             | `ip-literature-local`                                                    |
| Local database container  | `supabase_db_ip-literature-local`                                        |
| Local database port       | `55322`                                                                  |
| Membership                | `73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c`       |
| Effective state           | `8b4f46720b980ec5337edfa448f7d998ddfa6498ec32a8fce5a941589a746a23`       |
| V1 physical state         | `3986852c329bb66abf293d499655f2f278ae881801291756c9c1f75cc0351c70`       |
| Planning state            | `84743faccffca532d3fe6e03bd2d29a44f96790f0004c40ff0c9ed6bba881be5`       |

The operator command accepts no database URL, linked project, remote target, source artifact,
import authorization, or compensation authorization. It reads development state and aggregate
held-out lock state only. It cannot authorize import or compensation.

## Protected state model

The decision binds the exact migration filename, version/name ledger pair, and source/generated
file SHA-256. Filename presence alone is never authorization.

| State                        | Meaning                                                                                                              | Routine behavior                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `v2_absent_unarmed`          | No exact V2 ledger row and no in-session operator authorization                                                      | V2 is excluded; ordinary start may run through V1 only                             |
| `v2_absent_explicitly_armed` | V2 absent and the protected operator has revalidated all inputs and built an in-memory checksum-bound authorization  | Only that operator invocation may stage and apply V2                               |
| `v2_applied_exactly_once`    | Exactly one ledger row has version `20260809231651` and name `add_literature_gold_import_compensation_contract_v2`   | Ordinary start restores the exact generated copy if needed and does not reapply V2 |
| `v2_drifted_or_ambiguous`    | Duplicate occurrence, wrong name/version pairing, source/generated checksum drift, or unexpected generated migration | Fail closed; do not start migration-up, reset, or retry application                |

The armed state is ephemeral. It is not a hand-editable marker. Its canonical authorization binds
clean primary `main`, exact `HEAD == origin/main`, the exact migration SHA, the local target,
accepted database hashes, and two separately executed redundant backup captures. Each capture binds
its output-directory realpath, capture identity, fresh execution nonce and timestamp, repository and
database identities, canonical manifest, migration ledger, development-only safety proof, and local
duplicate-detection marker. Commit mode also requires and checksum-binds this exact attestation:

`I ATTEST THESE ARE TWO SEPARATE READ-ONLY BACKUP CAPTURES`

Any repository, database, capture, receipt, or marker drift invalidates the authorization. Applying
V2 changes the ledger and makes the authorization single-use.

## Trusted local operator — redundant capture model V1

The trust-model identity is `trusted-local-operator-redundant-captures/1.0.0`. The authorized local
operator is trusted not to deliberately fabricate evidence and is assumed to have filesystem and
Docker/database administrative access. The two captures protect against accidental omission,
stale state, partial output, inadvertent path duplication, wrong targets, and ordinary operational
mistakes. Their unkeyed local receipts and markers provide integrity, staleness, and duplicate
detection; they are not a separate trust root or cryptographic proof of separate execution.

A malicious authorized operator can recompute or bypass these local controls. Resistance to that
operator would require a genuinely separate principal or service and is outside this workflow. No
local nonce, chmod mode, inode, same-user key, receipt, or marker is represented as unforgeable.
The repository-grounded abuse-path and residual-risk analysis is in
[`gold-import-contract-v2-threat-model.md`](./gold-import-contract-v2-threat-model.md).

## Default command matrix

| Command                    | V2 absent                                                                                       | V2 applied exactly once                                                                                                    | Drift/ambiguity                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `literature:local:prepare` | Copies ordinary migrations only and safely removes an exact previously staged generated V2 copy | Remains unarmed; a later start restores V2 after observing the ledger                                                      | Wrong bytes or unexpected files fail              |
| `literature:local:start`   | First-start sees only ordinary migrations; migration-up runs without V2; reports V2 pending     | Starts with ordinary files, observes the exact ledger row, restores exact V2, then migration-up sees it as already applied | Fails before migration-up after ledger inspection |
| `literature:local:status`  | Observes status/ledger/inventory only; reports pending                                          | Observes exact applied state only                                                                                          | Fails closed; writes nothing                      |
| `literature:local:stop`    | Stops without preparation                                                                       | Stops without preparation                                                                                                  | Does not change inventory                         |
| `literature:local:reset`   | Resets only through the ordinary V1 boundary                                                    | Refuses routine reset; a separately reviewed protected reset is required                                                   | Fails closed                                      |

If an exact staged V2 generated copy exists while the ledger is absent, ordinary preparation
removes only that ignored generated copy before startup. It never edits or deletes the repository
migration. A staged checksum mismatch is a hard stop. If the ledger is exact and the generated copy
is absent, ordinary start restores it from the checksum-pinned repository source after the stack is
running and before migration-up. This restoration cannot reapply the already-recorded migration.

## Historical operator sequence — do not rerun

This completed sequence must not be run again. It is preserved to explain the immutable historical
captures, intent, and receipt. The operator used the primary checkout and proved all of the
following:

```bash
git fetch --prune origin
git switch main
git status --short --untracked-files=all
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
```

The status output must be empty. The local stack must already be the exact project/container/port.
If it is stopped, ordinary start may be used to start the existing V1 stack; while V2 occurrence is
zero it will explicitly leave V2 pending and unarmed.

### 1. Create two fresh, separately executed read-only captures

Run the pre-application diagnostic twice into distinct new directories no more than two hours before
application:

```bash
npm run literature:diagnose-gold-import-compensation-v2-preapplication -- \
  --backup-root <EXISTING_LOCAL_BACKUP_ROOT> \
  --output <NEW_PREAPPLICATION_BACKUP_ONE>

npm run literature:diagnose-gold-import-compensation-v2-preapplication -- \
  --backup-root <EXISTING_LOCAL_BACKUP_ROOT> \
  --output <NEW_PREAPPLICATION_BACKUP_TWO>
```

Each capture is a repeatable-read/read-only, checksum-sealed development snapshot. It contains the
development database seed, exact migration ledger, accepted state hashes, report, manifest, and
execution receipt; it contains no held-out identities. The diagnostic also creates a local marker
below `.protected-v2-backup-duplicate-markers/` in the backup root. Verify both manifests
separately. Identical canonical development snapshots are expected, but output realpaths, capture
identities, execution nonces, execution-receipt checksums, and timestamps must be distinct. The
operator re-verifies every file, canonical receipt, and marker and rejects stale, same-directory,
realpath-alias, retained-copy, reserialized, unsafe, or state/HEAD-mismatched captures. An authorized
same-user operator can honestly recompute a copied receipt and marker; that capability is explicitly
outside the claimed accidental-safety boundary above.

### 2. Run the default read-only dry-run

```bash
npm run literature:apply-protected-gold-import-contract-v2 -- \
  --target local \
  --operator <OPERATOR_IDENTITY> \
  --backup <NEW_PREAPPLICATION_BACKUP_ONE> \
  --backup <NEW_PREAPPLICATION_BACKUP_TWO>
```

The expected mode is `dry_run_read_only`, database mutation count is zero, and the protected state
remains `v2_absent_unarmed`. Review all reported repository, migration, backup, ledger, target, and
state bindings. Any mismatch is terminal.

### 3. Apply only after separate human authorization

The explicit confirmation is exactly:

`APPLY PROTECTED LITERATURE GOLD IMPORT CONTRACT V2 EXACTLY ONCE`

The receipt output must be a new child below the ignored local-only directory
`local-data/literature/protected-v2-application-receipts/`.

```bash
npm run literature:apply-protected-gold-import-contract-v2 -- \
  --target local \
  --operator <OPERATOR_IDENTITY> \
  --backup <NEW_PREAPPLICATION_BACKUP_ONE> \
  --backup <NEW_PREAPPLICATION_BACKUP_TWO> \
  --confirmation "APPLY PROTECTED LITERATURE GOLD IMPORT CONTRACT V2 EXACTLY ONCE" \
  --separate-capture-attestation "I ATTEST THESE ARE TWO SEPARATE READ-ONLY BACKUP CAPTURES" \
  --output <ABSOLUTE_NEW_CHILD_UNDER_LOCAL_ONLY_RECEIPT_ROOT> \
  --commit
```

Immediately before mutation, the command re-reads the repository, database, and both backups and
compares them to the checksum-bound in-memory authorization. Before staging, it exclusively creates
the requested local-only output directory and writes an immutable, checksum-sealed application
intent. That intent preserves the exact authorization, both redundant captures, trust model and
attestation, complete pre-state, migration-only capability, and a deterministic transitive
protected-operator bundle. The bundle records the intent repository HEAD, ordered relative file
inventory, each Git mode and file SHA-256, protected-directory inventory, explicit and final roots,
module-resolution audit, runtime-input declaration/audit, and aggregate SHA-256. It is a conservative
Git-tracked superset: `tsconfig.json`, Supabase configuration, package metadata and lockfile, guards,
operator/audit modules, migrations, verifier, and every declared runtime input are sealed.
Unsupported dynamic runtime dependencies fail closed. The intent also records explicit
`importAuthorized=false` and `compensationAuthorized=false`. If intent sealing fails, neither
staging nor migration application is attempted.

Only after sealing does the command stage the exact protected file in the ignored generated
workdir and invoke the project-pinned `supabase migration up --local` once. It then proves V1 stayed
once, V2 moved from absent to exactly once, the bound development state did not change, and no
review, pointer, reveal, action, import, or compensation mutation occurred. It runs the committed
complete deterministic catalog audit under REPEATABLE READ READ ONLY. It binds exact tables,
columns/types/nullability/defaults/generated expressions, constraints, indexes, the complete trigger
inventory, RLS/FORCE RLS and policies, raw ACLs/effective privileges, all transition and semantic
functions, signatures/bodies/configuration/ACLs, and exact `pg_depend` dependencies. The audit emits
component identities, the environment-invariant identity, local postgres-owner profile identity,
full inventory identity, and one canonical full identity. The verifier source remains SHA-pinned but
is not executed against real local; receipts say `verifierExecuted=false` and
`auditMethod=complete_read_only_catalog_identity`.

Those observed audit hashes are descriptive evidence, not an authorization source. Readiness is
authorized only by the statically selected committed expected artifact for the exact target/profile,
including its artifact file/content hashes, seven component hashes, deployment-profile identity,
normalized full-inventory identity and count, full-audit identity, audit model, migration, and
verifier. Equal counts and arbitrary self-consistent hashes are insufficient; profile cross-use and
target-derived expectations fail. Proposed expected artifacts may be generated only by the fresh
disposable maintainer workflow, which accepts no target database and cannot let the target establish
its own expected state. Finally the operator atomically adds a
`finalized/` subpackage and never deletes or rewrites the original intent.

### 4. Resolve an ambiguous or lost acknowledgement without replay

Never rerun `--commit` after an ambiguous migration outcome. Preserve the intent directory and use
observational `npm run literature:local:status` first. The operator response is determined by the
exact ledger state:

| Observed state                                       | Required action                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 absent                                            | Reconciliation fails without staging or applying. After the incident is understood, discard that authorization and obtain a new decision with two fresh backups before any later commit attempt.                                                                |
| V2 applied exactly once                              | Run the reconciliation command below. It verifies the sealed intent, both original backup instances, exact repository/migration bytes, unchanged development state, and the committed read-only V2 audit, then finalizes the receipt with zero migration calls. |
| Duplicate, wrong-pair, or otherwise ambiguous ledger | Stop. Do not stage, apply, reconcile, start migration-up, or reset. Escalate for a separately reviewed recovery.                                                                                                                                                |

```bash
npm run literature:apply-protected-gold-import-contract-v2 -- \
  --target local \
  --operator <SAME_OPERATOR_IDENTITY> \
  --output <EXISTING_SEALED_INTENT_DIRECTORY> \
  --reconciliation-reason "<NONEMPTY_INCIDENT_REASON>" \
  --reconcile-applied-receipt
```

Reconciliation accepts no `--backup`, `--commit`, confirmation, or attestation argument. It loads
the immutable intent and its original bindings, never stages a migration, never calls `migration
up`, and never infers that an absent migration should be applied. Same-HEAD recovery is accepted.
A later clean primary `main` is also accepted only when current `HEAD == origin/main`, the intent
commit is an ancestor, and the complete protected-operator bundle is byte-identical. Unrelated code
or documentation descendants may therefore recover only when they do not change the conservative
bundle. Divergent history, unreachable intent, expected-artifact, `tsconfig.json`, Supabase config,
source, package/lockfile, migration, verifier, module-resolution, runtime-input, or other protected
bundle drift fails closed. The result
records `intentRepositoryHead`, `recoveryRepositoryHead`, `intentCommitIsAncestor=true`, and
`operatorBundleUnchanged=true`. A reconciled receipt records
`receiptReconciled=true`, `migrationReexecuted=false`, and
`migrationApplicationCallCount=0`. Repeating reconciliation against an already complete package
only verifies and reports it as already complete; it does not rewrite any evidence.

## Later import and compensation remain separate

V2 migration application changes schema only. It does not authorize package execution. A later real
import still requires its own exact source/package/state authorization and human decision. A later
compensation requires the committed import receipt, fresh observed state, a finalized compensation
plan, and a new compensation-specific authorization. Never treat this runbook, its dry-run, its
migration authorization, or its receipt as authorization for either operation.

The finalized receipt now feeds the post-V2 pre-import readiness workflow only as immutable
historical evidence. Two new post-V2 captures are required; neither of the original V2-absent
preapplication captures may be substituted.

## Final V2 delivery backup

The additive Phase-10 backup command is
`literature:backup-gold-import-contract-v2-forward-repair`. Its version-2 manifest binds both exact
profile artifacts and the current detailed runtime-bundle identity, copies every changed tracked
file and the exact evidence-name inventory, rejects symlinks/overlap/transient probe output, parses
copied JSON semantically, verifies the canonical package manifest, and independently rechecks every
copied byte before self-hashing its receipt. The older
`literature:backup-post-migration-contract-reconciliation` command is a V1-only, old-branch blocked
reconciliation archive; it is not Phase-10 V2 delivery evidence.
