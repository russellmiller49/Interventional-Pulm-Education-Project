# Literature Gold Import Contract V2 schema-only transition

## Root cause

The V2 migration committed exactly once. Receipt finalization failed afterward because the
operator required the pre- and post-migration V1 physical hashes to be equal.

The historical V1 function `literature_gold_physical_state_hash_v1` serializes complete rows with
`to_jsonb(review)` and `to_jsonb(operation)`. V2 adds these columns without changing the protected
history:

- `literature_gold_set_reviews.full_text_used`
- `literature_gold_set_reviews.operation_contract_version_code`
- generated `literature_gold_set_reviews.operation_contract_version`
- `literature_gold_review_operations.contract_version`

The incident has 11 existing standard reviews. PostgreSQL exposes the V2-derived values as
`NULL`, `1`, and `NULL`, respectively. There are zero operation rows. Adding those keys changes
the schema-sensitive JSON representation even though V2 performs no review update. Reconstructing
the exact post-V2 V1 projection from either pre-application capture produces
`dab46b9df0c32e5ac98558495988d07f2be7474a61ed1d85fb8af9b5e6bff5fb`, the observed post hash.

The accepted identities are:

| Identity | SHA-256 |
| --- | --- |
| Pre-V2 V1 physical | `3986852c329bb66abf293d499655f2f278ae881801291756c9c1f75cc0351c70` |
| Post-V2 V1 physical | `dab46b9df0c32e5ac98558495988d07f2be7474a61ed1d85fb8af9b5e6bff5fb` |
| Schema-neutral full history, both captures and post | `5469be890970ad79ccef977ff9db55f454edd6cc010b6394e20f4ce733e8cddb` |
| V2 effective | `f79b825c70f0032642cd877ffa06238b6965dec479c6855105e45ee64bd01f4c` |
| V2 physical | `afce1a294fd5343a9127d86f6d210baabe8888ee9dc77b3ee3fcb3559d6741dd` |

Membership, V1 effective state, and planning do not serialize the newly added schema fields and
therefore remain unchanged.

## Schema-neutral history identity

`literature-gold-v2-schema-neutral-history.ts` canonicalizes the complete pre-V2 history surface:
batch, items, reviews, drafts, events, operations, and actions. Item rows retain current-review
pointers and both reveal timestamps. Review rows retain IDs, item IDs, revisions, supersedes and
operation/action links, lifecycle and revision kind, all clinical content and tags/statuses, notes,
timestamps, and reviewer identity. Events and operation/action rows retain their complete pre-V2
representation.

Only the four columns listed above are excluded. Unknown current or future columns are not
silently dropped. For post-V2 rows, the projector first requires the exact schema-derived values;
an excluded field with any other value fails before hashing. Component hashes separately bind
review, item, event, pointer, reveal, operation, action, draft, and batch rows. An evidence binding
authenticates the complete identity set and counts.

The same pure module also predicts the post-V2 V1 physical hash from a pre-V2 capture. This closes
the aggregate-hash loophole: a caller cannot present an arbitrary post physical hash merely because
membership or effective state stayed constant.

## Shared transition policy

All consumers must call `validateLiteratureGoldV2SchemaOnlyTransition`. Its reviewed reason is
`schema_derived_v1_physical_projection_transition`; its policy identity is
`896e0d7d5f1d0161661b453ff1c5af1cebe34167483ce1e93ae734d64577fc31`.

The validator fails closed unless both pre-application captures agree, V1 is present exactly once
before and after, V2 changes from zero to exactly one, migration and verifier bytes are exact,
membership/V1-effective/planning and every schema-neutral history component are unchanged, the
observed post V1 physical hash equals the independently predicted schema-derived value, all
review/pointer/event/reveal mutation counts are zero, operation/action/import/compensation counts
are zero, source authorization is unchanged, the V2 effective/physical identities are exact, and
the complete local PostgreSQL-owner catalog identity is exact.

## Integration contract

Future operator intent/evidence must record both `physicalStateSha256V1` and
`schemaNeutralHistorySha256`, plus the predicted post-V2 V1 physical identity and component
identities produced by `buildLiteratureGoldV2SchemaNeutralHistoryEvidence`. The operator,
disposable rehearsal, post-application diagnostic, and historical receipt recovery must pass those
typed records to the one shared validator and persist its returned proof.

Integration must add a future intent schema/parser through version dispatch. The historical 2.0.0
intent parser and runtime declaration must remain available byte-for-byte for recovery of the
sealed incident. No integration may duplicate or weaken the transition rules, reinterpret an
arbitrary bundle change, or treat the migration receipt as import/compensation authorization.

This contract changes neither V1 nor V2 migration bytes nor the V2 verifier. It authorizes no
migration replay, import, compensation, or clinical-state mutation.
