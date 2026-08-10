# Gold import contract V2 protected-application runbook

> Status: implementation and disposable rehearsal ready; real-local V2 migration application
> remains separately authorized and unapplied.

This runbook is the only supported path for later application of the forward-only Literature gold
import contract V2 migration. Merging the implementation does not arm ordinary local startup.
`npm run literature:local:start` is a development lifecycle command, not migration authorization.

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
accepted database hashes, and two independently executed backup instances. Each instance binds its
output-directory realpath, a fresh execution nonce, repository and database identities, canonical
manifest, migration ledger, development-only safety proof, and an external checksum-bound witness
under the backup root. Any repository, database, backup, receipt, or witness drift invalidates the
authorization. Applying V2 changes the ledger and makes the authorization single-use.

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

## Future operator sequence

Do not run this sequence from a feature worktree. A later separately approved operator must use the
primary checkout after the PR is merged, fetch the remote, and prove all of the following:

```bash
git fetch --prune origin
git switch main
git status --short --untracked-files=all
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
```

The status output must be empty. The local stack must already be the exact project/container/port.
If it is stopped, ordinary start may be used to start the existing V1 stack; while V2 occurrence is
zero it will explicitly leave V2 pending and unarmed.

### 1. Create two fresh read-only backups

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

Each backup is a repeatable-read/read-only, checksum-sealed development snapshot. It contains the
development database seed, exact migration ledger, accepted state hashes, report, manifest, and
execution receipt; it contains no held-out identities. The diagnostic also creates a separate,
exclusive instance witness below `.protected-v2-backup-instance-witnesses/` in the backup root.
Verify both manifests independently. Identical canonical development snapshots are expected, but
the output realpaths, backup-instance identities, execution-receipt checksums, and witnesses must
all be distinct. The operator re-verifies every file, canonical receipt, and witness and rejects
old, same-directory, realpath-alias, copied, reserialized, unsafe, or state/HEAD-mismatched backups.
Editing a copied receipt's output path cannot create a new diagnostic execution: it invalidates the
instance checksum and the external witness binding.

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
  --output <ABSOLUTE_NEW_CHILD_UNDER_LOCAL_ONLY_RECEIPT_ROOT> \
  --commit
```

Immediately before mutation, the command re-reads the repository, database, and both backups and
compares them to the checksum-bound in-memory authorization. Before staging, it exclusively creates
the requested local-only output directory and writes an immutable, checksum-sealed application
intent. That intent preserves the exact authorization, both independent backup instances, complete
pre-state, migration-only capability, and explicit `importAuthorized=false` and
`compensationAuthorized=false`. If intent sealing fails, neither staging nor migration application
is attempted.

Only after sealing does the command stage the exact protected file in the ignored generated
workdir and invoke the project-pinned `supabase migration up --local` once. It then proves V1 stayed
once, V2 moved from absent to exactly once, the bound development state did not change, and no
review, pointer, reveal, action, import, or compensation mutation occurred. It runs the committed
read-only V2 RPC/function/trigger security audit and binds that audit and the pinned verifier source
identity into the application result. Finally it atomically adds a `finalized/` subpackage with the
result, checksum manifest, and execution receipt; it never deletes or rewrites the original intent.

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

Reconciliation accepts no `--backup`, `--commit`, or confirmation argument. It loads the immutable
intent and its original bindings, never stages a migration, never calls `migration up`, and never
infers that an absent migration should be applied. A reconciled receipt records
`receiptReconciled=true`, `migrationReexecuted=false`, and
`migrationApplicationCallCount=0`. Repeating reconciliation against an already complete package
only verifies and reports it as already complete; it does not rewrite any evidence.

## Later import and compensation remain separate

V2 migration application changes schema only. It does not authorize package execution. A later real
import still requires its own exact source/package/state authorization and human decision. A later
compensation requires the committed import receipt, fresh observed state, a finalized compensation
plan, and a new compensation-specific authorization. Never treat this runbook, its dry-run, its
migration authorization, or its receipt as authorization for either operation.
