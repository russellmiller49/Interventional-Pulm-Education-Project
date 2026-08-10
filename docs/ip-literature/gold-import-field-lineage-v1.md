# Gold import field-lineage contract

> Lineage version: `gold-import-field-lineage/1.0.0`
>
> Artifact category: `coordinator_only`
>
> Status: source-of-truth specification; not an import, migration, or database-write authorization

## Purpose

This document defines the source, meaning, and safe mapping of the 13 fields that determine the
current finalized V3 import-compatibility finding. It separates physician-review state, enrichment
evidence, workspace reveal events, and import persistence. A matching value does not make two fields
equivalent when the fields record different events.

The finalized 630-row V3 artifact remains byte-identical at SHA-256
`961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59`. The database is authoritative
for current item events and persisted review state. The finalized artifact and its checksum-bound
authorizations are authoritative for the source values and authorized overlays to be imported. One
authority must not be rewritten to imitate another.

## Mapping-classification vocabulary

Every field relationship must use only one or more of these exact classifications:

- `exact_same_semantic_field`
- `lexical_representation_only`
- `ordered_set_representation_only`
- `distinct_provenance_concepts`
- `source_authoritative_null`
- `missing_persistence_target`
- `requires_existing_authorization_interpretation`
- `requires_new_physician_disposition`

`ordered_set_representation_only` applies to the separate taxonomy pipe-list normalization ledger,
not to any of the 13 fields below. `requires_new_physician_disposition` is a fail-closed fallback when
an existing authorization cannot resolve a physician field; the current two-note finding does not
meet that condition.

## Exact 13-field lineage

### 1. Finalized V3 `is_blinded`

- **Definition:** Whether the finalized source review was conducted without access to automated
  signals. Every finalized V3 row is semantically `false` and is serialized with the protected legacy
  lexeme `False`.
- **Origin and authority:** The canonical physician projection; V3 copies it without change and binds
  it into the protected physician hash and final artifact hash.
- **Provenance class:** Source review provenance.
- **Current mapping:** Contract v1 parses `False` to `false`, maps it to
  `literature_gold_set_reviews.is_blinded`, and then requires it to equal the inverse of the current
  item automated-signal reveal timestamp.
- **Mapping classification:** `lexical_representation_only` for the source-to-review conversion.
  Any mapping to the item timestamp is `distinct_provenance_concepts`.
- **V1 safety and forward repair:** The lexical conversion is safe; the timestamp equality is not.
  Contract v2 must preserve source `false` in the imported review and leave item reveal state
  untouched.

### 2. `literature_gold_set_reviews.is_blinded`

- **Definition:** Immutable review-row provenance stating whether that review decision was blinded.
- **Origin and authority:** For an ordinary workspace review, `save_literature_gold_review_v1`
  computes it from the item reveal state at save time. For a checksum-bound historical import, the
  authorized source review is authoritative.
- **Provenance class:** Persisted review provenance.
- **Current mapping:** Finalized V3 `is_blinded` is parsed to a boolean and written here, but contract
  v1 also applies the ordinary workspace reveal-state invariant to imported historical reviews.
- **Mapping classification:** `exact_same_semantic_field` after lexical parsing.
- **V1 safety and forward repair:** The target is correct. Contract v2 must make the imported-history
  rule explicit and must not require an imported nonblinded review to fabricate a local reveal event.
  The ordinary interactive first-review rule remains unchanged.

### 3. `literature_gold_set_items.automated_signals_revealed_at`

- **Definition:** Timestamp of the local workspace action that reveals sampling, source-query, and
  automated topic signals after a completed review.
- **Origin and authority:** `reveal_automated` UI/item event; the persisted item timestamp is
  authoritative.
- **Provenance class:** UI item-event provenance.
- **Current mapping:** Contract v1 treats a null timestamp as requiring every imported review to have
  `is_blinded=true`.
- **Mapping classification:** `distinct_provenance_concepts` relative to finalized V3
  `is_blinded`.
- **V1 safety and forward repair:** Unsafe for historical import. Contract v2 must validate this
  timestamp independently, never synthesize it, and never use it to rewrite source review
  provenance.

### 4. Finalized V3 `full_text_used`

- **Definition:** Whether a checksum-matched complete PDF was used as V3 enrichment evidence. It is
  `true` for exactly 50 matched-complete rows and `false` for metadata-only, preview-only, missing,
  and excluded rows.
- **Origin and authority:** The V3 full-text registry, matched file identity, physician review, and
  final artifact are authoritative.
- **Provenance class:** Enrichment-evidence provenance.
- **Current mapping:** Contract v1 maps it to
  `literature_gold_set_reviews.used_supplemental_metadata` and indirectly to the item supplemental
  reveal timestamp.
- **Mapping classification:** `missing_persistence_target`; the current source-to-supplemental edge
  is `distinct_provenance_concepts`.
- **V1 safety and forward repair:** Unsafe. Contract v2 needs an explicit immutable persistence
  target for this exact evidence fact and must include it in review/action/event projections and
  hashes. It must not set either supplemental-metadata field.

### 5. `literature_gold_set_reviews.categorization_from_full_text`

- **Definition:** `true` when Category 3 could not be assigned from the abstract and required
  full-text review.
- **Origin and authority:** The same-named finalized V3 field for imported reviews; the ordinary
  review payload for workspace reviews.
- **Provenance class:** Persisted review/evidence provenance.
- **Current mapping:** The finalized source boolean maps directly to this review column.
- **Mapping classification:** `exact_same_semantic_field` after the documented boolean lexical
  parse.
- **V1 safety and forward repair:** Safe and retained. It remains distinct from the broader evidence
  fact `full_text_used`, even though the finalized V3 workflow requires the two booleans to agree for
  its packet families.

### 6. `literature_gold_set_reviews.used_supplemental_metadata`

- **Definition:** Whether the reviewer used the workspace's revealed supplemental PubMed metadata,
  specifically MeSH terms and author keywords.
- **Origin and authority:** Ordinary workspace review payload, constrained by the local item reveal
  event.
- **Provenance class:** Persisted review/UI-use provenance.
- **Current mapping:** Contract v1 fills it from finalized V3 `full_text_used`.
- **Mapping classification:** `distinct_provenance_concepts`.
- **V1 safety and forward repair:** Unsafe. Contract v2 must derive or preserve this field only from
  its own UI/item workflow and must never use it as storage for PDF evidence.

### 7. `literature_gold_set_items.supplemental_metadata_revealed_at`

- **Definition:** Timestamp of the local UI action that reveals MeSH terms and author keywords.
- **Origin and authority:** `reveal_supplemental` UI/item event; the persisted item timestamp is
  authoritative.
- **Provenance class:** UI item-event provenance.
- **Current mapping:** Contract v1 requires the imported `usedSupplementalMetadata` value, currently
  sourced from V3 `full_text_used`, to equal whether this timestamp is non-null.
- **Mapping classification:** `distinct_provenance_concepts` relative to V3 `full_text_used`.
- **V1 safety and forward repair:** Unsafe. Contract v2 must preserve the timestamp unchanged and
  validate it only against the actual supplemental-metadata-use field.

### 8. Finalized V3 `technology_tag_status`

- **Definition:** Completion state for the V3 technology-tag assessment. Included rows use `tagged`,
  `not_applicable`, or `not_assessable`; all 272 formal excluded rows are blank because taxonomy was
  out of scope.
- **Origin and authority:** V3 taxonomy/enrichment review and final artifact.
- **Provenance class:** Import enrichment state.
- **Current mapping:** Contract v1 maps a nonblank value directly but rejects a blank value or asks a
  compatibility supplement to replace it.
- **Mapping classification:** `exact_same_semantic_field` for included rows;
  `source_authoritative_null` for formal excluded rows.
- **V1 safety and forward repair:** Safe only for included rows. Contract v2 must persist null for an
  excluded row and must not infer `not_applicable` or `not_assessable`.

### 9. Finalized V3 `disease_tag_status`

- **Definition:** Completion state for the V3 disease-tag assessment. Included rows use `tagged`,
  `not_applicable`, or `not_assessable`; all 272 formal excluded rows are blank because taxonomy was
  out of scope.
- **Origin and authority:** V3 taxonomy/enrichment review and final artifact.
- **Provenance class:** Import enrichment state.
- **Current mapping:** Contract v1 maps a nonblank value directly but rejects a blank value or asks a
  compatibility supplement to replace it.
- **Mapping classification:** `exact_same_semantic_field` for included rows;
  `source_authoritative_null` for formal excluded rows.
- **V1 safety and forward repair:** Safe only for included rows. Contract v2 must persist null for an
  excluded row and must not infer `not_applicable` or `not_assessable`.

### 10. Persisted `technology_tag_status`

- **Definition:** Nullable review-row completion state for technology tags.
- **Origin and authority:** The authorized enrichment source for an import review; otherwise the
  persisted review row.
- **Provenance class:** Persisted import enrichment state.
- **Current mapping:** The column permits null generally, but contract v1 requires every import
  revision to carry a non-null enum.
- **Mapping classification:** `exact_same_semantic_field` for included rows;
  `source_authoritative_null` for formal excluded rows.
- **V1 safety and forward repair:** The column can represent both states, but the import constraint
  cannot. Contract v2 must require non-null only for included taxonomy and require null for a formal
  excluded, empty-taxonomy source row.

### 11. Persisted `disease_tag_status`

- **Definition:** Nullable review-row completion state for disease tags.
- **Origin and authority:** The authorized enrichment source for an import review; otherwise the
  persisted review row.
- **Provenance class:** Persisted import enrichment state.
- **Current mapping:** The column permits null generally, but contract v1 requires every import
  revision to carry a non-null enum.
- **Mapping classification:** `exact_same_semantic_field` for included rows;
  `source_authoritative_null` for formal excluded rows.
- **V1 safety and forward repair:** The column can represent both states, but the import constraint
  cannot. Contract v2 must require non-null only for included taxonomy and require null for a formal
  excluded, empty-taxonomy source row.

### 12. Finalized V3 `physician_notes`

- **Definition:** Protected physician relevance notes copied from the canonical source into the
  finalized artifact.
- **Origin and authority:** Canonical protected physician projection and final V3 artifact, subject
  only to a later exact physician authorization that expressly supplies replacement rationale.
- **Provenance class:** Source physician-rationale provenance.
- **Current mapping:** Contract v1 maps it directly to review `notes` and treats any difference as
  incompatible.
- **Mapping classification:** `exact_same_semantic_field` by default;
  `requires_existing_authorization_interpretation` for PMIDs `36879724` and `39281191`.
- **V1 safety and forward repair:** Direct mapping is safe except for those exact identities. The
  existing amended authorization expressly requires the supplied physician rationale instead of the
  earlier artifact notes; no new physician disposition is required.

### 13. Persisted review `notes`

- **Definition:** Immutable rationale stored with a specific review revision.
- **Origin and authority:** The persisted review row, interpreted with any checksum-bound physician
  authorization for that revision.
- **Provenance class:** Persisted physician-rationale provenance.
- **Current mapping:** The audit compares it only with finalized V3 `physician_notes`.
- **Mapping classification:** `exact_same_semantic_field` normally;
  `requires_existing_authorization_interpretation` for PMIDs `36879724` and `39281191`.
- **V1 safety and forward repair:** The comparison is incomplete. Contract v2 must authenticate the
  existing authorization overlay and compare these two notes with its exact rationales. A different
  current value fails closed as `requires_new_physician_disposition`; an exact match is already
  authorized and is not a readiness blocker.

## Exact two-note authorization interpretation

The checksum-bound amended authorization is decisive:

- `amended-authorization.json` SHA-256:
  `b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a`;
- exact authorization text SHA-256:
  `76be83337df191cbf973934500648b947f3cfc5fa7ce58701d61b90d7919d53a`;
- original field mapping SHA-256:
  `169808d89f094798ec1c55682dce047f4cb51de26cb1117639fc81f190250191`;
- authoritative additive path correction SHA-256:
  `9f0bba6172ea1af4a6d4844365bb5aa8c63308bee67ab9df5c03d1937e8d429d`;
- PMID `36879724` finalized projection SHA-256:
  `f8ef656dbe144dfa92a35dc8ade1f5d471273c0d32fe7ae6937bb6e32a939863`;
- PMID `39281191` finalized projection SHA-256:
  `431b93b72152942686bc3386cf78d47c142ef74293e16bd962c7932f3d75bee1`.

The authorization says that values come exactly from finalized V3 **except for the physician
rationale supplied in that authorization**. Its field mapping writes that exact rationale to
`literature_gold_set_reviews.notes`, and the authoritative path correction says the review-row
mappings are unchanged. The post-write evidence binds rationale SHA-256
`7d8f4603076b3adc3e6aef85e22b362b1a000964a5b44cc566b3d1200b51e013` to PMID `36879724` and
`a7ac86081d020100990168edec59c85672b22a0fe966fe75f70bcc9248c1afc7` to PMID `39281191`.

Therefore the note subterminal is exactly:

`NOTE DISPOSITION ALREADY AUTHORIZED`

It creates no `incompatible_existing_head_fields` blocker when the current rationale matches the
bound value, requires no physician supplement or template, and must not be overwritten with the
earlier source note.

## Current readiness consequence

The note mapping is resolved, but contract v1 still has three independent execution blockers:

- 630 source-review blinding values are incorrectly coupled to local item reveal state;
- 272 formal excluded status nulls are not representable by the import-v1 constraints; and
- 50 complete-PDF evidence values have no correct persistence target and are incorrectly coupled to
  supplemental metadata reveal state.

No row is executable, no action is assigned, no supplement is applicable, and no package may be
generated. The overall terminal remains exactly:

`FORWARD IMPORT-CONTRACT REPAIR REQUIRED — NOTE DISPOSITION ALREADY AUTHORIZED`

The independent owner/ACL subterminal remains exactly:

`OWNER/ACL AUDIT READY — NO OWNER/ACL FORWARD MIGRATION REQUIRED`
