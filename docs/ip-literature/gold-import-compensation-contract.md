# Gold review import and compensation contract

> Contract version: `1.0.0`
>
> Artifact category: `coordinator_only`
>
> Status: implementation contract; not an authorization to apply a migration or mutate a database

## Purpose and safety boundary

This contract defines atomic imports and append-only post-commit compensation for immutable gold-set
review histories. It replaces the historical pointer-rewind rollback concept. It applies to future
regenerated import packages and to the database operations that execute or compensate them.

The contract does not authorize any of the following:

- applying a migration to the real local literature database;
- executing the pending gold-set V3 enrichment import;
- compensating a committed import;
- accessing, enumerating, exporting, unlocking, or evaluating held-out test identities;
- connecting to or writing a remote database;
- changing a physician relevance label, relevance confidence, or finalized enrichment decision;
- editing an existing immutable review, event, operation, or action row;
- changing a raw model result, the finalized V3 artifact, or an existing signed authorization.

Repository implementation, migration review, and rehearsal must use a disposable isolated database.
The operational sequence in this document stops before any real database migration or import.

## Version and vocabulary

| Contract               | Identity                                   |
| ---------------------- | ------------------------------------------ |
| Contract version       | `1.0.0`                                    |
| Contract ID            | `gold-review-import-compensation/1.0.0`    |
| Import RPC             | `apply_literature_gold_import_v1`          |
| Compensation RPC       | `compensate_literature_gold_import_v1`     |
| Physical/audit hash    | `literature_gold_physical_state_hash_v1`   |
| Effective-review hash  | `literature_gold_effective_state_hash_v1`  |
| Operation table        | `literature_gold_review_operations`        |
| Operation-action table | `literature_gold_review_operation_actions` |

In this contract:

- **head** means the immutable review row with the greatest revision for an item;
- **current pointer** means `literature_gold_set_items.current_review_id`;
- **effective review** means the review payload that currently governs the item's decision;
- **physical/audit state** means the durable append-only rows, item pointer, chain metadata,
  operation ledger, action ledger, and events;
- **compensation** means a new immutable review head that reverses the effective consequence of a
  committed import without deleting, rewriting, or bypassing any prior row;
- **void head** means a compensation revision that remains the physical head but represents that the
  imported initial review has no effective successor payload.

“Rollback” is reserved for transaction rollback before commit. After commit, the only supported
reversal is compensation.

## Precise defect in the historical rollback plan

The checksum-bound V2 rollback plan says to retain the imported immutable reviews and events, restore
each item's pre-import pointer and status, and append compensating events. Those requirements cannot
all satisfy the gold-review data model.

Assume an item has a prior review `R1`. The import appends `R2`, records `R2.supersedes_review_id =
R1.id`, and advances `current_review_id` to `R2.id`. Pointer rewind would retain `R2` but set
`current_review_id` back to `R1.id`:

```text
physical history: R1 <- R2
rewound pointer:   ^
```

The current pointer would no longer identify the latest immutable revision. A later writer computes
revision 3 from the maximum revision but links it to the current pointer, producing `R3 -> R1` while
`R2` still exists. That is a fork, not a linear revision chain. A writer that derives the next
revision directly from the rewound pointer may instead collide with the retained revision 2.

The defect is even clearer for an imported initial review. If an item had no prior review, retaining
the imported revision while restoring `current_review_id = null` makes an extant review disappear
from current-state readers. The next completion can then attempt another first revision or create a
chain that does not supersede the retained import.

The historical state hash does not make pointer rewind valid. Its own definition covers item and
current-review logical state while excluding events and non-current history. Returning that hash to
its pre-import value would show only an effective-state resemblance. The physical database would
still contain the imported reviews, import events, and new compensation events. Calling the result an
exact database rollback conflates two different projections.

Therefore:

1. a failed, uncommitted import must roll back atomically;
2. a committed import must never rewind a pointer;
3. compensation must append a new head;
4. `current_review_id` must always reference the physical head;
5. physical/audit and effective-review state must have separate hashes.

## Current contract inventory

The implementation must preserve or deliberately extend each surface below.

| Surface                     | Current authority                                                                                                                | Contract consequence                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Item state and pointer      | `supabase/migrations/20260727164510_add_literature_gold_set.sql`                                                                 | A completed item requires a pointer; contract v1 additionally requires every nonempty chain's pointer to be its head.                                           |
| Review revision and links   | `literature_gold_set_reviews.revision`, `supersedes_review_id`, and unique `(item_id, revision)`                                 | Revisions are contiguous and links form one linear chain.                                                                                                       |
| Same-item foreign keys      | Current-review and supersedes composite foreign keys                                                                             | A head, predecessor, compensation target, and effective source must belong to the same item.                                                                    |
| Immutable rows              | `prevent_literature_gold_set_append_only_mutation()`                                                                             | Reviews and events remain update/delete prohibited. Compensation is additive.                                                                                   |
| Event vocabulary            | Latest `literature_gold_set_events_type_check` in `20260730194025_add_literature_gold_test_unlock.sql`                           | Contract migration adds only the supported import and compensation event types listed below.                                                                    |
| Normal review writer        | `save_literature_gold_review_v1`                                                                                                 | It already uses maximum revision + 1, supersedes the current pointer, and advances the pointer. It must remain compatible with the new head invariant.          |
| Current-state reader/export | `src/features/literature/server/gold-set.ts`                                                                                     | It resolves current review through the pointer. Void heads require explicit effective-state interpretation rather than pointer rewind.                          |
| Offline review importer     | `scripts/literature/import-gold-reviews.ts`                                                                                      | Its historical multi-request commit path cannot provide atomicity and is retired. File validation remains available; contract writes use the single import RPC. |
| Full-history analysis       | `src/features/literature/gold-set/analysis.ts`                                                                                   | It already requires contiguous revisions and current review equal to the latest immutable revision.                                                             |
| Gold-set runbook            | `docs/literature-gold-set-runbook.md`                                                                                            | It declares that corrections append revisions and never overwrite the first decision.                                                                           |
| Additional pointer readers  | `scripts/literature/ultra-screening.ts` and `scripts/literature/audit-curated-collection.ts`                                     | Effective-state consumers must not silently reinterpret a historical pointer rewind as valid.                                                                   |
| V3 workflow                 | `docs/ip-literature/gold-enrichment-v3-workflow.md` and `scripts/literature/gold-enrichment-v3*.ts`                              | Final artifact, physician decisions, raw results, and coordinator provenance stay immutable.                                                                    |
| Ignored import package      | V2 immutable plan, row plan, executor, expected states, rollback plan, command, and receipt template under ignored `local-data/` | Historical evidence only after contract v1; do not edit or execute it. Regenerate a new package after migration approval.                                       |
| Authorizations              | Signed protocol authorization, amended physician authorization, and staged import authorization text                             | Existing signed clinical decisions remain unchanged. Import, compensation, and recovery each require their own operation-scoped authorization.                  |
| Readiness                   | V3 readiness, package validation, conflict report, freshness record, and checksum manifests                                      | Prior readiness cannot authorize a contract-v1 write because it does not bind the new schema, hashes, operation ledger, or compensation semantics.              |

## Historical V2 package disposition

The existing V2 package and its backups remain immutable audit evidence. Important identities include:

| Artifact                                | SHA-256                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| Final 630-row V3 development artifact   | `961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59` |
| Signed 305-row protocol authorization   | `784d13736ff0fbf69bd8ad55c8bf55b293c4cc2051b980a3488a980f120c5dd3` |
| Amended two-row authorization           | `b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a` |
| V2 immutable import plan                | `8a9833b77f00fd50e33c3c08d6db3f8196a06770a4bbd9b1986869bb04d6ad00` |
| V2 import-package manifest              | `3339b8dab99d088e399d46fba0037b9b98e2097b69ae532dfb7842f401dcf3eb` |
| V2 row-level plan                       | `52f2797168e7a665b6e8bf24363fbba9c4449126aa83f0e95c1fc650c19a19f3` |
| V2 executor                             | `14c38c93447bcc5795945ad846af3b8456a13bec147bc1b7d530ff41ad16314a` |
| Historical pointer-rewind rollback plan | `516c40d84354072a79c1aebcc02ced8a287c79ce2dfb59dd93d046226ab2a647` |
| Read-only compensation mapping          | `39b1fff91763d4f8cb7f494d24d5790ce3c5668c5104ef0ab263ea6c67e1eba1` |

The final V3 artifact and existing signed clinical authorizations remain authoritative and byte
unchanged. The V2 import plan, executor, command, expected states, import receipt template, and
rollback plan are unsupported for execution under contract `1.0.0`. They must not be patched in
place. A later, separately authorized workflow must regenerate a new checksum-bound import and
compensation package against the approved migration and bind the unchanged source artifacts by hash.

The immutable package snapshot establishes that the pending general enrichment import had not
executed when the package was generated: it records 624 planned inserts and six no-ops, zero created
import rows, no executed command, and no completed receipt. This implementation session deliberately
does not query the real database, so it does not overstate that historical package evidence as a fresh
database attestation. It performs no import or real-database mutation. A read-only mapping accounts
for every row as 621 initial imports that would require void heads, three revisions that would require
prior-review restore heads, and six no-ops. Readiness remains `import = false` and `rollback = false`,
with `mutationPlan = null`; this analysis performed zero database, held-out, or remote access.

## Schema additions

### Review lifecycle metadata

Contract v1 adds these immutable review fields:

- `revision_kind`: `standard`, `import`, or `compensation`;
- `lifecycle_state`: `effective` or `withdrawn`;
- `operation_action_id`: the operation action that created an import or compensation revision;
- `compensates_review_id`: the imported review directly compensated by this revision;
- `effective_source_review_id`: the immutable source review whose decision payload the compensation
  restores, or null for an initial-review void.

Existing rows resolve through schema defaults as `revision_kind = standard` and `lifecycle_state =
effective`; their new nullable link columns remain null. No update to an existing review is required,
and no clinical payload changes. For an effective standard or import node, a null
`effective_source_review_id` means “use this node's own payload.” A compensation restore is effective,
copies its prior effective payload, and identifies that prior source. A compensation void is withdrawn
and has no effective source.

These fields do not permit updates to old review rows. An import is not marked withdrawn by changing
the imported row; its later compensation head records the relationship.

### Operation ledger

`literature_gold_review_operations` records one accepted import or compensation attempt. Its status
is one of:

- `started`
- `completed`
- `failed`

The operation binds its kind, stable operation ID/idempotency key, batch and development scope, plan
hash, authorization hash, source-artifact identities, expected counts, actor identity, contract
version, and physical/effective pre/post hashes. A terminal operation is immutable.

`literature_gold_review_operation_actions` records the deterministic item-level plan. Its action kind
is one of:

- `import_initial`
- `import_revision`
- `import_noop`
- `compensate_restore`
- `compensate_void`
- `compensate_noop`

Its status is one of `planned`, `applied`, `noop`, or `failed`. Each action binds the expected item
head and effective state, deterministic new identities when applicable, payload hashes, predecessor,
compensation target, effective source, and expected resulting state.

Operation and action rows are ledger records, not mutable job queues. Exact terminal results are
returned idempotently; terminal operations are never reopened.

## Chain and current-pointer invariants

The import and compensation RPCs must lock their scoped items in stable display order and enforce all
of these conditions before and after mutation:

1. A review chain has revisions exactly `1..N`, with no duplicate or missing revision.
2. Revision 1 has no `supersedes_review_id`.
3. Every revision `N > 1` supersedes the same item's revision `N - 1`.
4. Every nonempty chain has `current_review_id` equal to revision `N`.
5. No item pointer may reference a non-head review.
6. An import revision is exactly head revision + 1 and supersedes that head.
7. A compensation revision is exactly imported head revision + 1 and supersedes that imported head.
8. `compensates_review_id` identifies the imported head being reversed.
9. A restore's effective source belongs to the item and predates the imported head.
10. A void has no effective source and is valid only for an import that created the item's first
    effective review.
11. A compensation is rejected if any later review, pointer change, draft, conflicting operation,
    guarded item-state change, or effective-state hash change occurred after the import receipt.
    Audit-only physical changes require a fresh plan and authorization bound to the new physical hash,
    but do not by themselves alter the sealed effective state being restored.
12. No RPC updates or deletes an existing review or event.

Database constraints should enforce what can be expressed locally. Both RPCs must also perform the
full ordered-chain and current-is-head audits inside the locked transaction.

## Failed-import atomicity

### Accepted-operation boundary

Malformed input, unsupported contract versions, invalid authorization, wrong target, remote target,
held-out scope, checksum mismatch, operation-ID collision, or an unreadable plan is rejected before an
operation is accepted. These failures make no database change.

After a valid operation is accepted, `apply_literature_gold_import_v1` records the operation start and
planned actions in its outer transaction. All review inserts, item changes, item-level import events,
and after-state verification run inside a PL/pgSQL `BEGIN ... EXCEPTION` block, which supplies a
database subtransaction/savepoint.

### Success

On success, the inner mutation subtransaction applies every planned non-noop action, verifies exact
row counts, chain and pointer invariants, event contents, and actual physical/effective post-state
hashes. The outer transaction then appends `import_completed` without embedding the not-yet-computable
post-physical hash, marks the operation completed, computes the physical hash over that terminal
journal, seals it in the operation's excluded post-hash column, and returns the committed receipt. One
outer commit makes the operation ledger, every review, pointer, action status, and event visible
together.

### Audited failure

If any inner action or post-write assertion fails:

1. PostgreSQL rolls the inner subtransaction back to its savepoint.
2. No imported review, pointer change, or item-level `review_imported` event survives.
3. The outer transaction verifies that effective state still equals its pre-import hash.
4. The operation/action ledger records the failure without claiming any item action applied.
5. The outer transaction appends `import_failed` without a post-physical hash and marks the operation
   failed without re-raising the caught mutation error.
6. It computes the physical hash over that terminal failure journal, seals it in the operation's
   excluded post-hash column, and returns a failed, audited receipt.
7. Committing that outer transaction persists only the operation/action/failure audit records.

This is failed-import atomicity: the gold-review effective state is all-or-none, while an accepted
failure remains auditable. The physical/audit post-failure hash differs from the pre-attempt physical
hash because it includes the durable failed-operation evidence; the effective-review hash must be
identical.

If writing or verifying the failure audit itself fails, the outer transaction must fail and roll back
entirely. No partial review mutation may survive. The caller may retain a filesystem or application
error record, but it must not claim a database-audited failure.

## Append-only post-commit compensation

Compensation applies only to a completed import operation and requires the imported review to remain
the unchanged current head. It is one atomic operation across its full authorized action set.

### Restore a prior review

For an item that had an effective review before import:

1. append a `revision_kind = compensation`, `lifecycle_state = effective` review;
2. set its revision to imported revision + 1;
3. set `supersedes_review_id` and `compensates_review_id` to the imported head;
4. reproduce the prior effective decision payload exactly from the bound immutable source;
5. set `effective_source_review_id` to that prior source;
6. advance `current_review_id` to the compensation review;
7. append `review_compensated`.

The import remains visible in history. Current state again has the prior effective content, but the
physical head is the new compensation revision.

### Void an imported initial review

For an item with no effective review before import, pointer rewind to null is prohibited. Instead:

1. append a `revision_kind = compensation`, `lifecycle_state = withdrawn` void head;
2. set its revision to imported revision + 1;
3. set `supersedes_review_id` and `compensates_review_id` to the imported head;
4. set `effective_source_review_id = null`;
5. restore the item's prior logical review status and other plan-bound effective item state;
6. keep `current_review_id` on the new void head;
7. append `review_voided`.

Readers must interpret the withdrawn head as no effective completed review while preserving it as the
latest physical chain node. They must never hide the imported revision by pointing behind it.

### Compensation no-op

An exact idempotent replay of a completed compensation is a no-op that returns the terminal receipt.
An item action classified `compensate_noop` creates no review, pointer change, or item-level event.
It must still be checksum-bound in the action inventory and counted exactly.

### Compensation atomicity

`compensate_literature_gold_import_v1` uses the same outer audit transaction and inner mutation
subtransaction boundary as import. A successful mixed restore/void/noop plan commits all actions and
their item events together. If any action or post-write proof fails, every compensation review,
pointer change, item-state change, and item-level event rolls back; only the failed operation/action
audit and `import_compensation_failed` survive. The post-failure effective hash must equal the
pre-compensation imported state, while the physical hash records the additive failed-attempt audit.

## State-hash projections

Both hash functions use canonical UTF-8 JSON, object keys sorted by byte-stable `C`/Unicode code-point
order, deterministic row ordering, explicit nulls, and SHA-256. Controlled-label arrays in the
clinical projection use the same order. Hash schema/version is part of the hashed envelope; database
locale must not change a digest.

### Physical/audit state

`literature_gold_physical_state_hash_v1` identifies durable structure and audit meaning. Its canonical
projection includes, for the authorized development scope:

- batch identity and contract-relevant version/status fields;
- item identity, review status, and current head pointer;
- every immutable review identity, revision, predecessor, clinical payload hash, revision kind,
  lifecycle state, operation action, compensation target, and effective source;
- relevant operation and action identities, statuses, plan/authorization identities, counts, and
  state hashes;
- import and compensation event identities, type, sequence, operation/action link, item link, and
  canonical payload.

The projection includes database timestamps on batches, items, reviews, events, operations, and
actions. It excludes only the operation fields that store pre/post state hashes, avoiding a
self-referential digest. Terminal event payloads deliberately omit the post-physical hash. After the
terminal event and status exist, the RPC computes the physical hash, seals it in the excluded
operation column, and returns it in the receipt. Consequently, a plan that predicts a physical
post-state must also bind every timestamp that contributes to that state; otherwise the receipt
records the verified actual physical post-state without pretending it was knowable in advance.

The physical hash must change after a successful import, an audited failed attempt, or a successful or
audited failed compensation. A compensation must never claim to restore the pre-import physical hash.

### Effective-review state

`literature_gold_effective_state_hash_v1` identifies the decisions current consumers should observe.
Its canonical per-item projection includes PMID, semantic item status, whether an effective review
exists, and the normalized effective decision payload. For an effective head, the resolved source is
`coalesce(effective_source_review_id, head.id)`; a withdrawn head resolves to no effective review. The
projection excludes item/review IDs, physical head pointers, revision ordinals, operation/event IDs,
audit timestamps, compensation metadata, and non-effective historical rows.

Consequences:

- successful import: effective hash changes to the authorized imported state;
- failed import: effective hash remains the exact pre-import hash;
- prior-review compensation: effective hash returns to the pre-import hash;
- initial-review void: effective hash returns to the pre-import no-review state;
- failed compensation: effective hash remains the imported pre-compensation hash.

A receipt must never use one projection's hash in a field named for the other.

## Supported events

Contract v1 supports exactly these new event types:

| Event                           | Scope           | Required meaning                                                                                                                |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `import_started`                | operation/batch | Accepted import identity, plan, authorization, expected counts, and pre-state hashes.                                           |
| `review_imported`               | action/item     | Newly appended import review, predecessor, resulting head, payload identity, and resulting effective source.                    |
| `import_completed`              | operation/batch | Exact applied/noop counts and verified post-effective hash; post-physical is sealed on the operation after this event exists.   |
| `import_failed`                 | operation/batch | Inner subtransaction rolled back, failure identity, zero surviving item actions, and unchanged effective hash.                  |
| `import_compensation_started`   | operation/batch | Accepted compensation identity, source import receipt, plan, authorization, and pre-compensation hashes.                        |
| `review_compensated`            | action/item     | Prior-review restore node, imported review compensated, resulting head, and effective source.                                   |
| `review_voided`                 | action/item     | Initial-review void node, imported review compensated, resulting withdrawn head, and null effective source.                     |
| `import_compensation_completed` | operation/batch | Exact restore/void/noop counts and verified post-effective hash; post-physical is sealed afterward.                             |
| `import_compensation_failed`    | operation/batch | Inner compensation subtransaction rolled back and effective import state remained unchanged; post-physical is sealed afterward. |

Every event links `operation_id`, optional `operation_action_id`, and a unique monotonic
`operation_event_sequence` within the operation. Operation events use a null item. Review events name
exactly one development item and one action. Event payloads bind IDs and non-self-referential hashes
rather than embedding an unbounded artifact. A terminal event must not contain the post-physical hash
of state that includes that event.

No generic “rollback” event is supported. A `review_revised` event is not a substitute for an import or
compensation event because it does not bind the required operation and state hashes.

## Authorization separation

### Import authorization

An import authorization permits one exact local import operation. It binds:

- contract version and `kind = import_authorization`;
- authorization ID, affirmative authorization, authorizing identity, authorization timestamp, and
  note;
- `targetDatabase = local`, `remoteWritesAllowed = false`, repository commit, and approved migration
  identity;
- operation ID, batch ID, plan hash, and idempotency key;
- the unchanged source artifact hash;
- expected physical pre-state hash and expected effective pre/post-state hashes; and
- a canonical content hash over every field above.

The import plan separately binds the raw checksum of the unchanged clinical authorization set as
`sourceAuthorizationSetSha256`. The executor requires that file, verifies its bytes, verifies the
source artifact bytes, verifies the live repository commit, and accepts only a loopback local target
before it can construct a database client. The authorization therefore approves one exact bound plan;
the plan supplies the development-only membership, action inventory, counts, and created identities.
The database-observed physical post-state hash is recorded in the receipt rather than predicted from
database-generated audit timestamps.

It does not authorize compensation or recovery. A prior authorization bound to the V2 plan cannot be
reused for a regenerated contract-v1 plan.

### Compensation authorization

Compensation requires a new explicit authorization created only after a completed import receipt
exists. It binds:

- contract version and `kind = compensation_authorization`;
- authorization ID, affirmative authorization, authorizing identity, authorization timestamp, and
  note;
- the local-only repository and migration identity;
- compensation operation ID, target import operation ID, batch ID, exact plan hash, and idempotency
  key;
- completed import receipt hash and unchanged source artifact hash;
- expected physical pre-state hash and expected effective pre/post-state hashes; and
- a canonical content hash over every field above.

The bound compensation plan supplies the exact imported heads, restore/void/noop inventory, counts,
and unchanged-state guards. Physical post-state is observed after the append-only compensation and
recorded in the receipt; it is never an asserted restoration target.

Import authorization never implies compensation authorization.

### Recovery authorization

Recovery authorization is required when the client cannot determine a transaction's outcome or a
durable operation remains nonterminal. The
V1 recovery operation is read-only reconciliation by operation ID. Its authorization binds the
authorization actor fields, local repository and migration identity, one of
`resolve_ambiguous_import` or `resolve_ambiguous_compensation`, batch ID, target operation ID, target
plan hash, target idempotency key, and the observed physical/effective hashes. It then returns a
canonical terminal receipt, an absent result, or explicit evidence that the durable row remains
nonterminal.

Recovery authorization is reconciliation authority only and always declares
`permitsMutation: false`. It cannot terminalize a journal row, insert a review, repeat an import, move a pointer, or
compensate an import. A nonterminal row therefore remains a hard stop for V1 and requires a separately
reviewed forward migration or later recovery-contract version. If a terminal failed receipt or an
authorized reconciliation establishes that a new import or compensation is required, the mutation
needs a new plan, a new operation ID, and a fresh corresponding authorization bound to the updated
physical state. A terminal failed receipt itself is sufficient failure evidence; no additional
recovery authorization is required merely to prepare that fresh operation. Neither authorization
substitutes for the other.

## Idempotency and ambiguous outcomes

The operation ID and plan/authorization hashes form the idempotency identity.

- The RPC resolves an existing operation's exact idempotency identity before applying stale-state or
  current-head guards.
- Exact replay of a completed operation returns the same terminal receipt and performs no write.
- Exact replay of a failed audited operation returns the same failed receipt and performs no write.
- Reuse of an operation ID with any different kind, plan, authorization, scope, artifact, or expected
  hash is rejected before mutation.
- Deterministic review, action, and event ID collisions are rejected unless they exactly belong to the
  terminal operation being replayed.
- A completed or failed operation cannot return to `started`.
- Compensation is rejected if the imported head is no longer current, even if its content happens to
  match.

If a connection is lost before commit confirmation, the caller must not retry automatically, create a
second operation, rewind pointers, or compensate. It first performs read-only reconciliation:

- operation `completed`: verify hashes and recover the existing receipt;
- operation `failed`: verify audited atomic failure and recover the failed receipt;
- operation absent: treat the transaction as uncommitted; any later mutation still requires a new
  operation ID, plan, and authorization bound to freshly observed state;
- operation `started` or contradictory state: block all writes and require recovery authorization.

No timeout, lost terminal output, client exception, or missing local receipt proves that COMMIT failed.

## Plan contract

Canonical import and compensation plans use strict camelCase JSON. Unknown or differently cased
fields fail closed. Their common top-level fields are:

- `contractVersion`, `kind`, `operationId`, and `batchId`;
- `expectedPhysicalStateSha256`, `expectedEffectiveStateSha256`, and
  `expectedPostEffectiveStateSha256`;
- `executionContext`, containing the exact local target, remote-write prohibition, repository commit,
  migration, import/compensation/reconciliation RPCs, and membership/physical/effective hash-function
  identities;
- `scope`, fixed to the development split, `heldOutIdentitiesAccessed = false`, and the exact
  development-membership hash;
- exact kind counts, a canonical ordered `actions` array, and an optional `faultAfterAction` accepted
  only by the isolated rehearsal and rejected by the production executor; and
- `binding.contentSha256`, computed over the content without `binding`, plus an idempotency key derived
  from the contract version, operation kind, operation ID, and content hash.

An import plan additionally carries `sourceArtifactSha256`, `sourceAuthorizationSetSha256`, and counts
for `total`, `initial`, `revisions`, `noops`, and `inserts`. A compensation plan additionally carries
`targetImportOperationId`, `importPlanSha256`, `importReceiptSha256`, `sourceArtifactSha256`, and counts
for `total`, `restored`, `voided`, and `noops`. The exact action schemas bind the item/head guards,
pre-import item state, payload or candidate-payload hash, predecessor, compensation target/effective
source, and expected resulting state needed by their action kind.

Each canonical action uses these shared names where its declared action kind permits them:

| Field                            | Meaning                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `actionId`                       | Stable action/idempotency identity.                             |
| `sequence`                       | Unique deterministic action order within the operation.         |
| `itemId` and `pmid`              | Exact development item identity pair.                           |
| `expectedCurrentReviewId`        | Physical head pointer required before the action.               |
| `expectedEffectiveReviewId`      | Effective source required before the action, or null.           |
| `expectedRevision`               | Exact revision number of the newly appended review, or null.    |
| `expectedSupersedesReviewId`     | Exact predecessor of the newly appended review, or null.        |
| `expectedHeadReviewIdAfter`      | Required physical head after the action.                        |
| `expectedEffectiveReviewIdAfter` | Required effective source after the action, or null for a void. |
| `expectedEventSequence`          | Exact item-level event sequence; an empty array for a no-op.    |

An import action uses `importedReviewId` when it appends a review. A compensation action uses
`sourceActionId`, `compensationReviewId`, and `effectiveSourceReviewId`. These identities are null only
where the declared action kind permits it. Aliases, inferred IDs, and implicit action ordering are not
accepted.

An import plan binds the unchanged finalized V3 artifact and authorization set by raw file checksums.
Before any database client is constructed, the executor also parses the finalized development CSV,
requires exact one-to-one item/PMID action coverage, and compares every finalized physician and
enrichment field with the checksum-bound insert payload or no-op candidate projection. Reviewer
identity, audit timestamps, and review duration remain separately plan-bound rather than being
inferred from clinical artifact columns.
A compensation plan binds the completed import receipt and the exact pre-import effective state being
restored. Neither plan predicts a physical post-state hash: database-generated operation, action,
event, and timestamp state is observed and sealed after the transaction.

## Receipt contract

A canonical import or compensation terminal receipt contains exactly the contract version, receipt
kind, operation ID, batch ID, plan hash, idempotency key, outcome (`committed` or `failed`), response
classification (`applied`, `idempotent_replay`, or `ambiguous_after_commit`), physical and effective
before/after hashes, compact counts (`planned`, `applied`, and `noops`), ordered event sequence, nullable
error, and canonical content binding. A compensation receipt additionally names the target import
operation. The binding excludes only the response classification so the same terminal evidence has
one content identity whether returned by the original call, exact replay, or reconciliation.

For a successful operation, `planned` and `applied` count the action kinds that append reviews, while
`noops` reports the no-op actions. For a failed operation, `applied = 0`, `noops = 0`, the effective
before/after hashes are identical, the physical hash changes because the durable failure audit is
appended, and `error` is non-null. A successful import receipt therefore proves every planned import
revision and no-op; a successful compensation receipt proves its restores, voids, and no-ops.

The receipt is intentionally compact. The operation/action journals provide actor, authorization,
source, timestamps, kind-specific counts, and row-level identities by operation ID. The executor's
exclusively created local execution envelope separately binds the raw artifact hash, authorization
hash, RPC name, local target, attempt/completion times, normalized transport error, state, and parsed
receipt. An ambiguous envelope is evidence to reconcile, never evidence to retry or compensate. A
reconciliation response may return the exact terminal receipt, an absent result, or a nonterminal
recovery-required result; it may not imply a mutation that the database state does not prove.

## Held-out, remote, and clinical-decision exclusions

Plans and RPCs must select development rows server-side. They must not load the test split and then
filter it in application memory. The following are fatal preflight failures:

- any test-split item or identity in a plan, action, authorization, hash projection, or event;
- a test unlock or a batch/test-lock change;
- a nonlocal database target or nonlocal PostgreSQL socket;
- any item outside the exact authorized batch/development membership;
- a target review whose physician relevance label or confidence differs from the finalized artifact;
- any mutation outside the declared reviews, items, operation/actions, and events;
- any attempt to relax a schema constraint to make an artifact importable.

The strict development-only plan scope, locked-test gate, server-side membership hash, and isolated
verification prove that no held-out identity is read. Compact receipts do not repeat an identity-read
count and must never include or enumerate held-out identifiers.

## Readiness gates

Import readiness is false unless all of these are true:

- contract migration and RPC/hash identities are exactly the approved versions on the target;
- the package was regenerated after that migration from unchanged checksum-bound source artifacts;
- the old V2 plan and rollback are explicitly rejected;
- package, plan, action, event, and authorization manifests verify;
- expected physical and effective pre-state hashes match a fresh read-only snapshot;
- every current pointer is the chain head and every revision chain is linear;
- all action counts, deterministic IDs, payloads, the expected effective post-state hash, and any
  explicitly supplied timestamp-bound physical post-state hash recompute;
- coordinator, relevance, taxonomy, draft, collision, and protected-divergence conflicts are zero;
- import authorization is valid for the exact operation and local target;
- held-out access is zero and the test split remains locked;
- the isolated ten-scenario rehearsal passes;
- no prior operation with the same ID has a conflicting identity;
- no ambiguous or nonterminal operation blocks the scope.

Compensation readiness is separately false unless the source import is completed and verified, every
imported review remains the unchanged head, the compensation plan and authorization are exact, the
physical/effective pre-state hashes match, the expected effective post-state equals the bound
pre-import state, and the isolated compensation rehearsal passes.

Migration readiness, import readiness, compensation readiness, and held-out-test readiness are
separate statuses. Passing one never implies another.

## Isolated ten-scenario rehearsal

The migration and RPCs must be rehearsed against a disposable database populated only with synthetic
development identities. No scenario may use the real local database or held-out identities.

|   # | Scenario                                | Required assertions                                                                                                                                                                                                           |
| --: | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Mixed import success                    | Initial, revision, and noop actions have exact counts; reviews/events/actions are correct; chains are linear; every pointer is head; both post hashes match.                                                                  |
|   2 | Scope and authorization refusal         | Remote target, test split, invalid authorization, or plan-hash mismatch is rejected before an operation or item mutation is accepted.                                                                                         |
|   3 | Injected mid-import failure             | Inner subtransaction rolls back all reviews/pointers/item events; one failed operation audit survives; effective hash is unchanged; failure physical hash matches.                                                            |
|   4 | Import idempotency and collision        | Exact completed/failed replay produces no writes and returns the terminal receipt; same operation ID with changed input fails closed.                                                                                         |
|   5 | Prior-review compensation               | Restore head supersedes and compensates imported head, pointer remains latest, source payload is exact, effective hash returns to pre-import, physical hash does not.                                                         |
|   6 | Initial-review void                     | Withdrawn void head supersedes imported initial head, pointer remains latest, effective source is null, prior no-review state/hash is restored.                                                                               |
|   7 | Mixed compensation success              | Restore, void, and noop actions commit atomically with exact events/counts and no old-row updates or deletes.                                                                                                                 |
|   8 | Injected mid-compensation failure       | All compensation review/pointer/item events roll back; compensation failure audit survives; imported effective state remains unchanged.                                                                                       |
|   9 | Stale-head and chain corruption refusal | Intervening revision, rewound pointer, broken predecessor, wrong revision, draft, or state-hash drift blocks compensation before item mutation.                                                                               |
|  10 | Ambiguous client outcome and recovery   | Lost commit acknowledgement causes no blind retry; read-only operation lookup distinguishes completed, failed, absent, and nonterminal states; recovery requires its own authorization and creates no duplicate review/event. |

The versioned verification SQL contains the synthetic plan/authorization fixtures and asserts the
before/after physical and effective hashes, operation/action/event counts, chain and pointer results,
and transaction outcome inside the disposable database. The runner records checksums for the complete
migration input set and verification script. Effective projections and deterministic IDs are stable
across fresh runs; timestamp-bearing physical hashes are recomputed and verified against each run's
actual audit state rather than falsely claimed to be identical across different clocks.

## Operational sequence and mandatory stop

### Repository implementation and isolated validation

1. Add the additive migration, RPCs, hash projections, constraints, and tests on a branch created from
   current `origin/main`.
2. Do not edit the ignored V2 package, finalized V3 artifact, raw results, or signed authorizations.
3. Create a disposable isolated PostgreSQL/Supabase rehearsal environment that is not the real local
   literature database.
4. Apply the canonical historical literature migrations and the new migration only to that disposable
   environment.
5. Run the ten scenarios and capture non-sensitive synthetic receipts and hash evidence.
6. Run static migration checks, focused tests, literature tests, type checking, linting, formatting,
   and repository checks that do not connect to the real database.
7. Commit, push, and open a draft pull request with the migration still unapplied to the real database.
8. **Stop. Do not apply the migration to the real local database. Do not regenerate or execute the
   pending import.**

### Future migration and import, requiring new authorization

Only a later, explicitly authorized primary-checkout session may:

1. verify the merged repository commit and clean primary checkout;
2. back up and hash the real development physical and effective state without exposing test identities;
3. apply the approved migration to the real local database;
4. verify backfill, chains, pointers, operations, events, and both hash projections;
5. regenerate a new import and compensation package against contract `1.0.0` while preserving the
   final V3 artifact and signed clinical authorizations byte-for-byte;
6. obtain a new checksum-bound import authorization for that regenerated plan;
7. recheck readiness immediately before execution;
8. execute the import exactly once and preserve its terminal receipt.

The old V2 executor and rollback plan must never be used as a shortcut.

### Future compensation, requiring separate authorization

If a committed import later requires reversal:

1. reconcile the completed import operation and receipt read-only;
2. verify that every imported review remains the current head and no later revision exists;
3. generate and checksum a compensation plan with restore, void, and noop actions;
4. compute the expected physical pre-state and effective pre/post-state hashes, with the physical
   post-state to be observed and recorded from the committed database state;
5. obtain a separate compensation authorization;
6. create and verify an immediate pre-compensation backup;
7. execute `compensate_literature_gold_import_v1` exactly once;
8. verify the new compensation heads, linear chains, current pointers, events, and both hashes;
9. preserve the compensation receipt and additive post-compensation backup.

Compensation never deletes history, rewinds a pointer, restores a physical hash, changes the final V3
artifact, or implies permission to access the held-out test split.
