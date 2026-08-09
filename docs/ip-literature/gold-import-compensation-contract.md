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

| Contract               | Identity                                        |
| ---------------------- | ----------------------------------------------- |
| Contract version       | `1.0.0`                                         |
| Contract ID            | `gold-review-import-compensation/1.0.0`         |
| Import RPC             | `apply_literature_gold_import_v1`               |
| Compensation RPC       | `compensate_literature_gold_import_v1`          |
| Reconciliation RPC     | `reconcile_literature_gold_review_operation_v1` |
| Physical/audit hash    | `literature_gold_physical_state_hash_v1`        |
| Effective-review hash  | `literature_gold_effective_state_hash_v1`       |
| Operation table        | `literature_gold_review_operations`             |
| Operation-action table | `literature_gold_review_operation_actions`      |

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

The name `reconcile_literature_gold_import_v1` appeared in a post-migration audit request but is not
part of the migration or executable contract. The canonical RPC is
`reconcile_literature_gold_review_operation_v1`. Diagnostics record the requested spelling as an
`audit_expectation_defect`; they do not query, create, or silently accept an alias.

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

## Post-migration contract reconciliation

The once-applied real-local migration was executed by the local `postgres` migration owner, while
the fixed disposable rehearsal applied it as `supabase_admin`. PostgreSQL represents owner ACLs
differently in those environments. Readiness therefore uses three separate identities:

1. the **environment-invariant contract identity** binds normalized RPC definitions, signatures,
   search paths, security modes, dependencies, lifecycle objects, append-only protections, RLS,
   event vocabulary, and the required/prohibited effective privilege matrix;
2. the **deployment-profile identity** binds the exact target, owner, owner attributes and role
   memberships, normalized ACL/grantor representation, and effective privileges; and
3. the **full-environment inventory identity** preserves every normalized catalog record as audit
   evidence but does not decide readiness by itself.

`local_supabase_postgres_owner_v1` is permitted only for `target=local`, owner `postgres`, and the
exact checksum-pinned local role inventory. `supabase_admin_owner_v1` remains the disposable
expectation. Any arbitrary owner, changed membership, PUBLIC execution, anon/authenticated
execution, broadened service-role privilege, changed body/signature/search path, or undeclared role
difference fails closed.

The historical disposable inventory contains 763 semantic records. Under the exact local profile,
24 owner function-ACL records and 56 owner table-ACL records collapse into the owner representation,
producing the observed 683 records. The reconciliation must still classify all 763 expected records
and compare every actual record; the arithmetic alone is never accepted as proof. When the
invariant and selected profile are exact, this owner/ACL representation does not require a forward
migration. The original owner-specific full-inventory hash remains evidence rather than a readiness
pin.

## Finalized-artifact compatibility

Finalized boolean fields accept only `true`, `false`, `True`, and `False`. All four forms are parsed
semantically and package/database values are canonical booleans. A normalization ledger preserves
the original lexeme, semantic value, row identity, source-artifact SHA-256, and rule version. This is
lexical normalization, not a physician change. Other spellings, numeric values, blanks, and
arbitrary casing are rejected, and the finalized CSV remains byte-identical.

The V3 artifact also preserves taxonomy/workflow order for the four ordered, unique pipe-list
columns, while the import contract represents those values as ascending sets. Each source cell that
requires reordering has a separate checksum-bound ledger entry containing its original pipe lexeme
and ordered values, canonical ascending values, row identity, source-artifact SHA-256, column, and
fixed rule version. Whitespace repair, deduplication, additions, removals, an incomplete ledger, or a
V1 authorization for any reordered cell fails closed. The generator, runtime executor, and
disposable rehearsal independently rederive the exact ledger and compare the normalized projection
to the signed action plan before any database client or mutation path is available.

Source authorization and execution compatibility are independent gates. The signed V3 provenance
authorizes its finalized enrichment deltas, including additive differences from the nine existing
effective heads, but it cannot override an import RPC pre-state invariant or authorize a different
source value. Every one of the 630 source rows must pass the execution contract before any action is
proposed or package readiness is considered.

The real read-only audit found three source/local execution-contract mismatches:

- all 630 source rows have semantic `is_blinded=false`, while all 630 local planning rows have
  `automatedSignalsRevealedAt=null`; contract v1 requires those states to agree, so changing the
  source value to true would be an unauthorized semantic rewrite rather than normalization;
- all 272 formal V3 excluded rows have authoritative blank technology- and disease-tag statuses;
  those fields are outside enrichment scope for excluded rows, while contract v1 requires non-null
  status enums for an import revision; and
- 50 source rows have `full_text_used=true` (`usedSupplementalMetadata=true`), while their local
  `supplementalMetadataRevealedAt` state is null; contract v1 requires the source use flag to agree
  with that reveal state.

Those three cohorts are execution-compatibility ledgers. Separately, the field-by-field
existing-head audit conservatively classifies `notes` as incompatible for PMIDs `36879724` and
`39281191`. Their finalized source notes differ from the current authorized rationale, and the
signed V3 provenance plus amended two-row authorization do not provide an exact mapping that says
whether to replace those notes or preserve the current rationale. This unresolved source-authorization
mapping produces the independent readiness blocker `incompatible_existing_head_fields`; it is not
an execution-ledger count or a pending physician-supplement decision.

The 272 excluded-row blanks are not unresolved physician decisions. A compatibility supplement or
template would invent enrichment values outside the finalized V3 scope and therefore is neither
required nor safe. No supplement can repair the lifecycle-state mismatches, and supplying one must
not change readiness. The source values remain verbatim, no executable action is emitted for any of
the 630 rows, and no package is generated. The exact terminal state is
`CONTRACT STILL BLOCKED — UNRESOLVED DIFFERENCE`. This finding does not alter the safe-profile
owner/ACL conclusion above and does not propose or authorize a forward migration. The historical
`621/3/6` distribution remains evidence only, not a production assertion.

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
A fresh compensation operation ID targeting an import that already has a started or completed
compensation is not a replay: it is rejected with stable SQLSTATE `P7625` before a second compensation
head can be created.

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
- A compensation request must name the exact sealed import operation, plan, receipt, artifact, and
  batch. An unrelated import cannot be substituted because its state hashes happen to match.
- Recovery authorization binds the exact target operation, plan hash, and idempotency key. It cannot
  reconcile one import or compensation through another operation identity.

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
- the isolated twenty-scenario rehearsal passes with exactly one direct database-evidence record for
  every required scenario;
- no prior operation with the same ID has a conflicting identity;
- no ambiguous or nonterminal operation blocks the scope.

Compensation readiness is separately false unless the source import is completed and verified, every
imported review remains the unchanged head, the compensation plan and authorization are exact, the
physical/effective pre-state hashes match, the expected effective post-state equals the bound
pre-import state, and the isolated compensation rehearsal passes.

Migration readiness, import readiness, compensation readiness, and held-out-test readiness are
separate statuses. Passing one never implies another.

## Isolated twenty-scenario rehearsal

The migration and RPCs must be rehearsed against a disposable Supabase PostgreSQL database populated
only with synthetic development identities. The committed runner accepts only an output directory; it
does not accept a database URL, host, port, or remote target. No scenario may use the real local
database, real PMIDs, finalized review data, or held-out identities.

The stable scenario matrix is:

| ID                                                 | Scenario                             | Required direct runtime evidence                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S01_initial_import_success`                       | Initial-review import                | Actual import RPC appends revision 1, advances the physical head, resolves the new effective review, and emits the exact events.                                                                      |
| `S02_revision_import_success`                      | Existing-review revision import      | Actual import RPC appends `max(revision)+1`, supersedes the prior physical head, and preserves a linear history.                                                                                      |
| `S03_exact_mixed_package`                          | Exact mixed package                  | One import RPC processes exactly 621 initial actions, three revisions, and six no-ops: 630 actions, 624 review inserts, exact events/pointers/revisions/hashes, followed by an exact no-write replay. |
| `S04_import_failure_before_commit`                 | Import failure before commit         | An injected action failure rolls back review, pointer, and item-success events while preserving only the sealed failed-attempt audit.                                                                 |
| `S05_ambiguous_outcome`                            | Ambiguous client/process outcome     | A real database operation reaches a terminal state while the client-side result is treated as unknown; no blind retry is authorized.                                                                  |
| `S06_read_only_reconciliation`                     | Reconciliation after ambiguity       | The read-only reconciliation RPC distinguishes completed, failed, absent, and started operations without creating a review, event, or operation.                                                      |
| `S07_restore_compensation`                         | Restore prior review                 | A restore head supersedes the imported head, points to the prior effective source, restores the effective hash, and changes the physical hash.                                                        |
| `S08_void_compensation`                            | Void first review                    | A withdrawn head supersedes the imported first review, stays current, and yields no effective completed review.                                                                                       |
| `S09_compensation_failure_before_commit`           | Compensation failure before commit   | An injected failure rolls back compensation reviews, pointers, and success events while preserving the sealed failed-attempt audit.                                                                   |
| `S10_compensation_idempotent_replay`               | Successful compensation replay       | The identical request returns the existing completed operation/receipt with no additional head, review, event, pointer, or hash change.                                                               |
| `S11_standard_review_after_restore`                | Ordinary review after restore        | The standard review function appends after the restore physical head, becomes the effective/current review, preserves history, and does not fabricate blinding state.                                 |
| `S12_standard_review_after_void`                   | Ordinary review after void           | The standard function appends after the withdrawn head at `max(revision)+1`; first-decision blinding is not recreated.                                                                                |
| `S13_stale_before_state_rejected`                  | Stale before-state                   | Changed head, draft, membership, or physical/effective state is rejected before item mutation with a controlled result.                                                                               |
| `S14_stale_authorization_rejected`                 | Stale authorization                  | Wrong checksum, plan binding, state binding, or timestamp shape is rejected before an operation is accepted.                                                                                          |
| `S15_wrong_import_operation_id_rejected`           | Wrong target import identity         | A compensation request cannot substitute an unrelated import operation even when other state values resemble the target.                                                                              |
| `S16_wrong_compensation_operation_id_rejected`     | Wrong compensation/recovery identity | A compensation or reconciliation operation cannot be resolved through another operation identity.                                                                                                     |
| `S17_second_compensation_rejected`                 | Fresh second compensation            | A newly identified compensation targeting an already compensated import is rejected with SQLSTATE `P7625`; only an exact replay of the original operation is idempotent.                              |
| `S18_held_out_item_rejected`                       | Held-out scope refusal               | Test-split or unlocked-test scope is rejected without selecting, printing, or recording a held-out identity.                                                                                          |
| `S19_pointer_rewind_and_history_mutation_rejected` | Rewind and immutable-history attacks | Direct pointer rewind, chain branch, and historical review update/delete attempts fail with controlled errors and leave the chain unchanged.                                                          |
| `S20_legacy_pointer_rewind_plan_rejected`          | Retired rollback plan                | A pointer-rewind-shaped legacy plan is submitted to the database contract and rejected before journal or item mutation.                                                                               |

The exact mixed-package fixture is generated inside the disposable database from deterministic,
synthetic development-only rows. Its counts are derived again from persisted operation, action,
review, pointer, and event state; a TypeScript planning simulation cannot satisfy this gate.

### Evidence artifacts

Run:

```text
npm run literature:rehearse-gold-import-compensation -- --output <new-empty-directory>
```

The runner creates these files:

- `scenario-evidence.json` (`pr84-scenario-evidence/v1`): canonical ordered evidence for exactly the
  20 IDs above, including invoked database functions, pre/post counts and chain state, expected and
  actual results, assertion outcomes, SQLSTATE/result, and mutation count;
- `lint-introspection.json` (`pr84-lint-introspection/v1`): normalized Supabase lint and database
  security/constraint/trigger introspection;
- `rehearsal-manifest.json` (`pr84-rehearsal-manifest/v1`): canonical identities for the exact
  migration inputs, verifier, runner evidence, lint/introspection, and scenario counts; and
- `execution-receipt.json` (`pr84-execution-receipt/v1`): noncanonical execution time, local disposable
  container/port, raw runtime hashes, and output path.

The first three artifacts are byte-identical for identical committed inputs. Runtime physical hashes
contain audit timestamps and are validated as 64-character SHA-256 values plus required equality or
difference relationships before being normalized out of canonical evidence. UUIDs generated by the
ordinary review RPC are likewise replaced by first-seen equality tokens. The raw physical hashes and
runtime UUIDs remain in the noncanonical receipt. Effective hashes and deterministic clinical
projections remain exact in the canonical evidence. Any missing, duplicate, failed, or reordered
scenario; failed assertion; changed mixed-package count; lint error; unexpected lint warning; unsafe
grant/search path; missing RLS; missing trigger/constraint; or artifact validation error makes the
runner exit nonzero.

The runner uses the fixed disposable Supabase PostgreSQL image, applies the exact historical migration
chain and this forward migration, executes the versioned SQL verifier, runs Supabase database lint,
and records runtime introspection for RLS, function security mode/search paths, execute/table grants,
immutability protections, constraints, triggers, and event vocabulary. The known three lint warning
groups are allowlisted by exact function/message identity and remain warnings only; a changed warning
set fails closed. The ambiguous-outcome scenario commits its synthetic operation before a new
transaction performs reconciliation. Before any container starts, the runner removes inherited
database and Docker target variables and verifies that Docker resolves to a local Unix-domain socket
or Windows named pipe.

The disposable grant audit also guards an environment-specific Supabase default: tables created by
`supabase_admin` can begin with `service_role` privileges beyond a later four-verb data grant. This
forward migration explicitly removes `TRUNCATE`, `REFERENCES`, and `TRIGGER` from immutable review and
event tables. In particular, `TRUNCATE` must not bypass their append-only row triggers.

Committed rehearsal evidence is the result of this command and its checksum-bound artifacts. Manual
source review, standalone lint, TypeScript simulations, and ad hoc disposable checks may supplement
that evidence but cannot mark a scenario passed or replace an artifact entry.

## Operational sequence and mandatory stop

### Repository implementation and isolated validation

1. Add the additive migration, RPCs, hash projections, constraints, and tests on a branch created from
   current `origin/main`.
2. Do not edit the ignored V2 package, finalized V3 artifact, raw results, or signed authorizations.
3. Create a disposable isolated PostgreSQL/Supabase rehearsal environment that is not the real local
   literature database.
4. Apply the canonical historical literature migrations and the new migration only to that disposable
   environment.
5. Run all twenty direct database scenarios twice in fresh disposable environments and require
   byte-identical canonical evidence and manifests.
6. Run the integrated Supabase lint/security introspection, static migration checks, focused tests,
   literature tests, type checking, linting, formatting,
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
