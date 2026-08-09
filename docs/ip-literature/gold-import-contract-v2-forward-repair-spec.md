# Gold import contract V2 forward-repair specification

> Specification version: `gold-import-contract-v2-forward-repair/1.0.0`
>
> Artifact category: `coordinator_only`
>
> Status: design required for future review; not an authorization to create, apply, or execute a
> migration, import, compensation, or package

## Decision

Contract v1 is safe at the owner and ACL boundary under the exact
`local_supabase_postgres_owner_v1` profile, but it cannot faithfully execute the finalized V3 source.
The remaining problem is a semantic field-lineage defect, not an owner representation defect and not
a missing physician decision.

The exact owner/ACL subterminal is:

`OWNER/ACL AUDIT READY — NO OWNER/ACL FORWARD MIGRATION REQUIRED`

A future forward-only contract v2 repair must preserve the exact meanings in
[`gold-import-field-lineage-v1.md`](./gold-import-field-lineage-v1.md). It must not edit migration
`20260808035633_add_literature_gold_import_compensation_contract.sql`, and this specification does
not authorize creating or applying the future migration.

## Bound findings

| Cohort            | Authoritative fact                                                            | Contract-v1 defect                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 630 rows          | Finalized V3 `is_blinded` is semantically `false`                             | Import v1 equates review provenance with the absence of a current item automated-signal reveal event.                             |
| 272 excluded rows | Technology- and disease-tag statuses are intentionally blank and out of scope | Import v1 requires non-null status enums for every import revision.                                                               |
| 50 rows           | A checksum-matched complete PDF was used for V3 enrichment                    | Import v1 stores that fact as supplemental PubMed metadata use and requires an unrelated UI reveal timestamp.                     |
| 2 existing heads  | Current rationale differs from earlier finalized V3 notes                     | The exact amended authorization already requires the supplied rationale in persisted `notes`; the v1 audit fails to interpret it. |

The 630, 272, and 50 identity ledgers remain independently checksum-bound execution blockers until a
reviewed v2 implementation exists and a later read-only audit proves the repaired contract. The
two-note mapping is not a fourth blocker.

## Normative repair requirements

### 1. Preserve imported review blinding independently

Contract v2 must:

1. parse finalized `is_blinded` through the existing exact boolean lexical rules;
2. write the resulting semantic value to `literature_gold_set_reviews.is_blinded`;
3. remove the import-only equality between review `is_blinded` and
   `literature_gold_set_items.automated_signals_revealed_at`;
4. permit an exact checksum-authorized historical import review to be nonblinded even when it is the
   first effective local review; and
5. leave the ordinary workspace rule unchanged: automated signals cannot be revealed before the
   first interactive completion, and `save_literature_gold_review_v1` continues to record the
   workspace review state it observed.

The import must not set, backfill, or fabricate `automated_signals_revealed_at`. Imported historical
review provenance and local workspace UI history are distinct facts.

### 2. Persist complete-PDF evidence in its own exact provenance target

Contract v2 must preserve the exact semantic identity `full_text_used` independently. The present
evidence proves that import v1 has no correctly validated target; it does not by itself decide whether
the repair should add an immutable nullable review column, extend a strictly validated immutable
event/provenance envelope, or use another equally explicit representation. That choice requires a
separate migration design review. Whatever representation is selected, null must mean that this V3
enrichment-evidence fact is not represented for that review and must not be silently coerced to
`false`. Every effective import revision from the finalized V3 artifact must carry a non-null boolean,
and compensation that preserves a source review's effective payload must preserve this value.

The selected persistence target must be included in:

- the import payload and strict JSON shape;
- immutable review insert projections;
- clinical/effective and physical state projections where other imported enrichment fields are
  bound;
- action, review, event, plan, and receipt hashes;
- compensation copy/restore projections; and
- source-to-target validation and read-only audit output.

The finalized source `full_text_used` must no longer populate
`used_supplemental_metadata`. The import may continue to validate
`used_supplemental_metadata` against its own item reveal event, but it must source that value only from
the supplemental-metadata workflow. It must never set or backfill
`supplemental_metadata_revealed_at` to make PDF evidence executable.

`categorization_from_full_text` remains a separate, direct review field. Its values happen to coincide
with the 50-row complete-PDF cohort in the current artifact, but that observation does not establish
semantic identity or a permanent equality rule. Contract v2 must validate the fields independently.

### 3. Represent formal excluded status nulls

The existing status columns are already nullable. Contract v2 must revise only the import-specific
requirements so that:

- an included source row requires non-null `technology_tag_status` and `disease_tag_status`, with the
  existing tag/cardinality rules;
- a formal V3 excluded or uncertain source row with empty taxonomy requires both statuses to remain
  null;
- a source null is accepted only when the authenticated artifact family and relevance/taxonomy shape
  prove that the field was out of scope; and
- null must never be replaced by `not_applicable`, `not_assessable`, or a compatibility supplement.

The operation ledger, event payload, action hash, effective-state projection, compensation logic,
and file-only audit must preserve the distinction between a source-authoritative null and a missing
or malformed included-row value.

### 4. Apply the existing two-note authorization overlay

Before comparing or constructing target `notes`, contract v2 must authenticate all of these bindings:

- finalized artifact SHA-256
  `961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59`;
- amended authorization SHA-256
  `b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a`;
- exact authorization text SHA-256
  `76be83337df191cbf973934500648b947f3cfc5fa7ce58701d61b90d7919d53a`;
- mapping SHA-256
  `169808d89f094798ec1c55682dce047f4cb51de26cb1117639fc81f190250191`;
- authoritative mapping correction SHA-256
  `9f0bba6172ea1af4a6d4844365bb5aa8c63308bee67ab9df5c03d1937e8d429d`;
- exact identities and projection hashes for PMIDs `36879724` and `39281191`; and
- the exact authorized rationale or its checksum-bound hash for each identity.

The default mapping remains finalized V3 `physician_notes` to persisted review `notes`. For only
those two identities, the target is the exact rationale supplied by the amended authorization. If a
current note equals that target, classify the relationship
`requires_existing_authorization_interpretation` and preserve it. If the current note differs from
both the source and the authenticated overlay, fail closed as
`requires_new_physician_disposition`; do not select a value or emit a supplement automatically.

For the verified current state, the note subterminal is exactly:

`NOTE DISPOSITION ALREADY AUTHORIZED`

### 5. Retain normalization and authorization boundaries

Contract v2 must retain the existing source artifact and normalization evidence:

- allowed boolean source lexemes remain exactly `true`, `false`, `True`, and `False`;
- semantic package values remain canonical booleans without changing source bytes;
- the boolean ledger continues to bind original lexeme, semantic value, identity, source hash, and
  rule version;
- ordered pipe-list reordering remains an
  `ordered_set_representation_only` ledger operation with no additions, removals, deduplication, or
  whitespace repair; and
- signed V3 enrichment authorization remains separate from operation authorization and cannot make
  an execution-incompatible row executable.

## Required classification model

The v2 machine contract must use exactly this mapping-classification union:

```text
exact_same_semantic_field
lexical_representation_only
ordered_set_representation_only
distinct_provenance_concepts
source_authoritative_null
missing_persistence_target
requires_existing_authorization_interpretation
requires_new_physician_disposition
```

The committed schema or typed constant must reject every other value. The generated lineage report
must contain exactly the 13 field identities in the lineage document and must record, for each:

- definition and originating workflow;
- source of truth;
- evidence, UI/item, review, or import provenance class;
- current contract-v1 mapping;
- one or more classifications from the exact union;
- contract-v1 safety result;
- v2 target and repair disposition; and
- checksum-bound evidence references.

## Required machine-readable audit artifacts

A future implementation must emit and seal these artifacts before any package generator is callable:

1. `field-lineage.json` and `field-lineage.md`
   - exactly 13 field entries;
   - exact classification union;
   - relationship edges that distinguish source-review, item-event, evidence, and import state;
   - finalized artifact and current-state bindings.
2. `execution-compatibility-report.json`
   - separate identity ledgers for the 630 blinding, 272 status-null, and 50 full-text persistence
     findings;
   - contract version under which each ledger is blocked or repaired;
   - no conversion of an execution blocker into a physician decision.
3. `note-disposition-audit.json`
   - exactly PMIDs `36879724` and `39281191`;
   - source note, authorized target-note hash, authorization/mapping/projection hashes;
   - classification `requires_existing_authorization_interpretation`;
   - exact-match result and `NOTE DISPOSITION ALREADY AUTHORIZED` subterminal.
4. `package-readiness.json`
   - independent owner/profile, source authorization, lineage, execution, and package gates;
   - no `incompatible_existing_head_fields` blocker when both notes match their authorization;
   - no supplement, optional-status-resolution, or accepted-supplement field;
   - no proposed action while any execution ledger remains blocked.

The existing `boolean-normalization-report.json` and `list-normalization-report.json` remain required
and separately checksum-bound. A recomputed outer manifest must not legitimize changed source,
authorization, lineage, or normalization evidence.

## Forward-migration safety envelope

If a future reviewed implementation uses a new migration, it must be forward-only and must:

- leave migration `20260808035633` byte-identical;
- preserve every existing review, item pointer, event, operation, action, and effective decision;
- add no fabricated reveal timestamp, status, or physician rationale;
- preserve append-only protections, RLS, exact service-role RPC boundaries, safe search paths, and
  the explicit local/disposable owner profiles;
- rehearse both fresh application and upgrade from an already-v1-migrated database in a disposable
  environment;
- prove identical effective clinical state before and after the schema repair; and
- remain unapplied to the real local database until separately authorized.

No owner or ACL repair is required by the current evidence. The safe-profile conclusion remains
independent and unchanged.

## Verification obligations

Focused tests for a future implementation must prove at least:

- all 630 source `False` lexemes remain semantic false review provenance without item timestamp
  synthesis;
- ordinary interactive first-review blinding remains enforced;
- exactly 50 V3 `full_text_used=true` values reach the dedicated persistence target;
- those 50 values do not change either supplemental-metadata field;
- `categorization_from_full_text` remains independently represented;
- exactly 272 formal excluded rows retain null for both status fields;
- included status/cardinality validation remains strict;
- both authorized note overlays resolve exactly, while a changed note fails closed;
- no physician/status supplement or template is emitted;
- source and authorization hashes remain unchanged;
- no action or package is emitted while any v1 execution blocker remains; and
- database, held-out, remote, import, and compensation mutation counts remain zero in the file-only
  audit.

## Current terminal

This specification records a safe forward repair but does not implement or authorize it. Under the
currently applied contract v1, every row remains non-executable, no action partition is valid, and no
package exists or may be generated. The exact overall terminal remains:

`FORWARD IMPORT-CONTRACT REPAIR REQUIRED — NOTE DISPOSITION ALREADY AUTHORIZED`
