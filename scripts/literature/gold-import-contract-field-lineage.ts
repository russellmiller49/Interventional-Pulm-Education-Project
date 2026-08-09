import { createHash } from 'node:crypto'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'

export const GOLD_IMPORT_FIELD_LINEAGE_SCHEMA_VERSION =
  'gold-import-contract-field-lineage/1.0.0' as const
export const GOLD_IMPORT_FORWARD_REPAIR_SCHEMA_VERSION =
  'gold-import-contract-v2-forward-repair-requirements/1.0.0' as const

export const FIELD_LINEAGE_MAPPING_CLASSIFICATIONS = [
  'exact_same_semantic_field',
  'lexical_representation_only',
  'ordered_set_representation_only',
  'distinct_provenance_concepts',
  'source_authoritative_null',
  'missing_persistence_target',
  'requires_existing_authorization_interpretation',
  'requires_new_physician_disposition',
] as const

export type FieldLineageMappingClassification =
  (typeof FIELD_LINEAGE_MAPPING_CLASSIFICATIONS)[number]

export interface GoldImportFieldLineageRecord {
  currentSourceToDatabaseMapping: string
  currentV1MappingSafe: boolean
  exactForwardRepairRequirement: string
  field: string
  formalDefinition: string
  mappingClassifications: readonly [
    FieldLineageMappingClassification,
    ...FieldLineageMappingClassification[],
  ]
  originatingWorkflow: string
  provenanceKind: 'review_evidence' | 'local_ui_state' | 'item_state' | 'import_provenance'
  sourceOfTruth: string
}

const FIELD_LINEAGE_RECORDS = Object.freeze([
  {
    field: 'finalized V3 is_blinded',
    formalDefinition:
      'Whether the finalized external V3 review decision was performed without exposure to the external workflow signals governed by that artifact.',
    originatingWorkflow: 'Checksum-authorized finalized V3 enrichment workflow.',
    sourceOfTruth: 'The byte-identical finalized V3 CSV is_blinded lexeme.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Parsed exactly (including False -> false lexical normalization) into literature_gold_set_reviews.is_blinded, then import contract v1 additionally equates it to local item reveal state.',
    mappingClassifications: ['lexical_representation_only', 'distinct_provenance_concepts'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Preserve the authorized source review-provenance value without manufacturing or changing any local reveal event; use a new explicit import-contract version.',
  },
  {
    field: 'literature_gold_set_reviews.is_blinded',
    formalDefinition:
      'Persisted provenance of whether the review represented by this immutable review revision was blinded.',
    originatingWorkflow: 'Gold-set review persistence and append-only import contracts.',
    sourceOfTruth: 'The immutable review revision that is current/effective for the item.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Receives finalized V3 is_blinded, but import v1 rejects it unless it equals a value inferred from automated_signals_revealed_at.',
    mappingClassifications: ['exact_same_semantic_field', 'distinct_provenance_concepts'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Retain ordinary interactive save-review protections while adding a fail-closed external-import path that can persist authenticated review provenance independently of local UI history.',
  },
  {
    field: 'literature_gold_set_items.automated_signals_revealed_at',
    formalDefinition:
      'Timestamp of an actual local UI event revealing automated signals for an item.',
    originatingWorkflow: 'Interactive local gold-set review workspace.',
    sourceOfTruth: 'The item row and its immutable automated-signals-revealed event history.',
    provenanceKind: 'item_state',
    currentSourceToDatabaseMapping:
      'Import v1 uses null/non-null as a compatibility predicate for review.is_blinded even though the finalized V3 artifact does not record this local event.',
    mappingClassifications: ['distinct_provenance_concepts'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Never synthesize a timestamp. Contract v2 must keep local reveal history unchanged and validate external review provenance through a separate authenticated boundary.',
  },
  {
    field: 'finalized V3 full_text_used',
    formalDefinition:
      'Whether exact complete-article evidence was used by the finalized V3 categorization workflow.',
    originatingWorkflow: 'Finalized V3 metadata/full-text enrichment workflow.',
    sourceOfTruth: 'The byte-identical finalized V3 CSV full_text_used lexeme.',
    provenanceKind: 'import_provenance',
    currentSourceToDatabaseMapping:
      'The draft import-v1 compatibility layer projected this boolean into used_supplemental_metadata; the v1 review payload has no exact dedicated persistence target for this source provenance.',
    mappingClassifications: ['missing_persistence_target', 'distinct_provenance_concepts'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Preserve full_text_used separately as checksum-bound import provenance, either in a dedicated persisted field or an independently validated immutable provenance envelope; do not map it to local supplemental-metadata use.',
  },
  {
    field: 'literature_gold_set_reviews.categorization_from_full_text',
    formalDefinition:
      'Whether the persisted clinical categorization was derived from full-text evidence.',
    originatingWorkflow: 'Gold-set clinical categorization contract.',
    sourceOfTruth:
      'The finalized categorization_from_full_text value for import; the immutable review value after persistence.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Direct finalized V3 categorization_from_full_text to the same-named review field.',
    mappingClassifications: ['exact_same_semantic_field'],
    currentV1MappingSafe: true,
    exactForwardRepairRequirement:
      'Keep this direct mapping and validate it independently from full_text_used even when their observed cohort values coincide.',
  },
  {
    field: 'literature_gold_set_reviews.used_supplemental_metadata',
    formalDefinition:
      'Whether the local reviewer used supplemental metadata revealed by the local workflow, including MeSH terms or author keywords.',
    originatingWorkflow: 'Interactive local gold-set review workspace.',
    sourceOfTruth:
      'The immutable review revision together with the local supplemental-metadata reveal event.',
    provenanceKind: 'local_ui_state',
    currentSourceToDatabaseMapping:
      'The draft compatibility layer incorrectly populated it from finalized V3 full_text_used.',
    mappingClassifications: ['distinct_provenance_concepts'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Remove the source mapping. Preserve existing local review state; an external import may set this field only from exact local supplemental-metadata evidence, never from full-text use.',
  },
  {
    field: 'literature_gold_set_items.supplemental_metadata_revealed_at',
    formalDefinition:
      'Timestamp of an actual local UI event revealing supplemental metadata such as MeSH or author-keyword information.',
    originatingWorkflow: 'Interactive local gold-set review workspace.',
    sourceOfTruth: 'The item row and its immutable supplemental-metadata-revealed event history.',
    provenanceKind: 'item_state',
    currentSourceToDatabaseMapping:
      'Import v1 requires used_supplemental_metadata to equal this timestamp state; finalized V3 full_text_used supplies no such local event evidence.',
    mappingClassifications: ['distinct_provenance_concepts'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Keep the timestamp unchanged and never fabricate a reveal event to accommodate source full-text provenance.',
  },
  {
    field: 'finalized V3 technology_tag_status',
    formalDefinition:
      'Completion status for technology tagging when the finalized V3 row is in enrichment scope; deliberately blank/null for excluded or uncertain out-of-scope rows.',
    originatingWorkflow: 'Finalized V3 enrichment taxonomy contract.',
    sourceOfTruth: 'The byte-identical finalized V3 CSV and its conditional merged-V3 schema.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Included values map directly; import v1 rejects authoritative null for excluded/uncertain import revisions.',
    mappingClassifications: ['exact_same_semantic_field', 'source_authoritative_null'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Permit null only for excluded/uncertain rows whose categorization arrays and prohibited categorization fields are empty/null; included rows remain non-null and consistency checked.',
  },
  {
    field: 'finalized V3 disease_tag_status',
    formalDefinition:
      'Completion status for disease tagging when the finalized V3 row is in enrichment scope; deliberately blank/null for excluded or uncertain out-of-scope rows.',
    originatingWorkflow: 'Finalized V3 enrichment taxonomy contract.',
    sourceOfTruth: 'The byte-identical finalized V3 CSV and its conditional merged-V3 schema.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Included values map directly; import v1 rejects authoritative null for excluded/uncertain import revisions.',
    mappingClassifications: ['exact_same_semantic_field', 'source_authoritative_null'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Permit null only for excluded/uncertain rows whose categorization arrays and prohibited categorization fields are empty/null; included rows remain non-null and consistency checked.',
  },
  {
    field: 'persisted technology_tag_status',
    formalDefinition: 'Persisted technology-tag completion status on an immutable review revision.',
    originatingWorkflow: 'Gold-set review schema and import payload validation.',
    sourceOfTruth: 'The persisted review revision after an authorized write.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Direct target for finalized technology_tag_status, but import v1 globally requires a non-null value.',
    mappingClassifications: ['exact_same_semantic_field', 'source_authoritative_null'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'A forward constraint and payload-version change must preserve authoritative out-of-scope null while retaining exact included-row tag/status invariants.',
  },
  {
    field: 'persisted disease_tag_status',
    formalDefinition: 'Persisted disease-tag completion status on an immutable review revision.',
    originatingWorkflow: 'Gold-set review schema and import payload validation.',
    sourceOfTruth: 'The persisted review revision after an authorized write.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Direct target for finalized disease_tag_status, but import v1 globally requires a non-null value.',
    mappingClassifications: ['exact_same_semantic_field', 'source_authoritative_null'],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'A forward constraint and payload-version change must preserve authoritative out-of-scope null while retaining exact included-row tag/status invariants.',
  },
  {
    field: 'finalized V3 physician_notes',
    formalDefinition: 'Physician rationale recorded in the finalized V3 artifact.',
    originatingWorkflow: 'Finalized V3 physician review and reconciliation workflow.',
    sourceOfTruth:
      'The byte-identical finalized V3 artifact, except where a later checksum-bound authorization explicitly supplies the persisted rationale.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Normally maps to review notes; PMIDs 36879724 and 39281191 are governed by the later amended authorization rationale exception.',
    mappingClassifications: [
      'exact_same_semantic_field',
      'requires_existing_authorization_interpretation',
    ],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Bind and validate the exact amended authorization and mapping artifacts; for the two identified rows preserve the authorized supplied/current rationale rather than substituting finalized V3 text.',
  },
  {
    field: 'persisted review notes',
    formalDefinition: 'Rationale text persisted on an immutable review revision.',
    originatingWorkflow: 'Gold-set review persistence and physician authorization workflow.',
    sourceOfTruth:
      'The governing checksum-bound physician authorization for the revision, otherwise the finalized source under an approved import contract.',
    provenanceKind: 'review_evidence',
    currentSourceToDatabaseMapping:
      'Receives finalized V3 physician_notes except for the exact two-row amended-authorization rationale exception already applied to current revisions.',
    mappingClassifications: [
      'exact_same_semantic_field',
      'requires_existing_authorization_interpretation',
    ],
    currentV1MappingSafe: false,
    exactForwardRepairRequirement:
      'Make the two-row preserve-current disposition explicit and checksum-bound in diagnostics and any future contract-v2 package; never merge or rewrite note text.',
  },
] satisfies readonly GoldImportFieldLineageRecord[])

export function buildGoldImportFieldLineageReport() {
  const fields = FIELD_LINEAGE_RECORDS.map((record) => ({ ...record }))
  return {
    schemaVersion: GOLD_IMPORT_FIELD_LINEAGE_SCHEMA_VERSION,
    scope: {
      finalizedWorkflow: 'gold-set-v1-enrichment-v3',
      importContract: 'gold-import-compensation-v1',
      fieldCount: fields.length,
    },
    conclusions: {
      categorizationFromFullTextIndependentFromFullTextUsed: true,
      excludedBlankStatusesAreSourceAuthoritativeNull: true,
      fullTextUsedEqualsUsedSupplementalMetadata: false,
      localRevealTimestampsMayBeSynthesized: false,
      sourceBlindingEqualsLocalAutomatedRevealHistory: false,
      statusPhysicianDecisionRequired: false,
    },
    fields,
  } as const
}

export function goldImportFieldLineageSha256(
  report: ReturnType<
    typeof buildGoldImportFieldLineageReport
  > = buildGoldImportFieldLineageReport(),
): string {
  return createHash('sha256').update(canonicalJson(report)).digest('hex')
}

export function renderGoldImportFieldLineageMarkdown(
  report: ReturnType<
    typeof buildGoldImportFieldLineageReport
  > = buildGoldImportFieldLineageReport(),
): string {
  const lines = [
    '# Gold import contract v1 field-lineage audit',
    '',
    `Schema: \`${report.schemaVersion}\``,
    '',
    `Canonical JSON SHA-256: \`${goldImportFieldLineageSha256(report)}\``,
    '',
    'This audit treats finalized review evidence, local UI reveal history, item state, and import provenance as separate evidence domains. It does not authorize a write.',
    '',
  ]
  report.fields.forEach((record, index) => {
    lines.push(
      `## ${index + 1}. ${record.field}`,
      '',
      `- Formal definition: ${record.formalDefinition}`,
      `- Originating workflow: ${record.originatingWorkflow}`,
      `- Source of truth: ${record.sourceOfTruth}`,
      `- Provenance kind: \`${record.provenanceKind}\``,
      `- Current mapping: ${record.currentSourceToDatabaseMapping}`,
      `- Classifications: ${record.mappingClassifications.map((value) => `\`${value}\``).join(', ')}`,
      `- Safe under import contract v1: \`${String(record.currentV1MappingSafe)}\``,
      `- Forward repair: ${record.exactForwardRepairRequirement}`,
      '',
    )
  })
  return `${lines.join('\n').trimEnd()}\n`
}

export type GoldImportNoteDisposition = 'already_authorized' | 'authorization_required'

export function buildGoldImportForwardRepairRequirements(input: {
  noteDisposition: GoldImportNoteDisposition
  noteDispositionEvidenceSha256: string | null
}) {
  return {
    schemaVersion: GOLD_IMPORT_FORWARD_REPAIR_SCHEMA_VERSION,
    ownerAclForwardMigrationRequired: false,
    importContractForwardMigrationRequired: true,
    sourceArtifactChangeRequired: false,
    physicianStatusDecisionRequired: false,
    noteDisposition: {
      status: input.noteDisposition,
      evidenceSha256: input.noteDispositionEvidenceSha256,
    },
    requirements: [
      {
        id: 'immutable_existing_migration',
        requirement: 'Migration 20260808035633 remains immutable.',
      },
      {
        id: 'new_forward_migration_only',
        requirement: 'Any repair is implemented only as a new forward migration.',
      },
      {
        id: 'preserve_contract_v1',
        requirement: 'Import contract v1 remains intact for historical audit evidence.',
      },
      {
        id: 'new_fail_closed_version_boundary',
        requirement:
          'The repaired import contract uses a new explicit version and fail-closed RPC or equivalent version boundary.',
      },
      {
        id: 'ordinary_ui_semantics_unchanged',
        requirement:
          'Ordinary interactive UI save-review semantics and protections remain unchanged.',
      },
      {
        id: 'separate_external_and_local_provenance',
        requirement:
          'Checksum-authorized external import provenance is distinguished from local UI reveal-event history.',
      },
      {
        id: 'no_full_text_supplemental_conflation',
        requirement:
          'full_text_used is not projected into used_supplemental_metadata without an exact semantic rule.',
      },
      {
        id: 'conditional_out_of_scope_null_statuses',
        requirement:
          'Excluded or uncertain imported rows may retain null technology/disease tag statuses only when their technology/disease arrays and every categorization field prohibited for excluded rows are empty or null.',
      },
      {
        id: 'included_status_invariants',
        requirement:
          'Included rows continue to require non-null tag statuses and exact tag/status consistency.',
      },
      { id: 'development_only', requirement: 'No held-out row can enter the import.' },
      {
        id: 'preserve_existing_state',
        requirement:
          'Existing review rows, pointers, effective state, item reveal history, and physical revision history are preserved.',
      },
      {
        id: 'append_only_compensation',
        requirement: 'Compensation remains append-only and maps every actual future action.',
      },
      {
        id: 'source_artifact_immutable',
        requirement: 'The finalized V3 artifact remains byte-identical.',
      },
      {
        id: 'normalization_ledgers_separate',
        requirement:
          'Boolean and ordered-list normalization remain separately source-bound and ledgered.',
      },
      {
        id: 'package_gate',
        requirement:
          'Package generation stays blocked until the forward contract is merged, applied exactly once, audited, and the note disposition is resolved.',
      },
    ],
  } as const
}

export function goldImportForwardRepairRequirementsSha256(
  requirements: ReturnType<typeof buildGoldImportForwardRepairRequirements>,
): string {
  return createHash('sha256').update(canonicalJson(requirements)).digest('hex')
}
