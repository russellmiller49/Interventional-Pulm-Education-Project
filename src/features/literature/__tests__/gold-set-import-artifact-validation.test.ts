/** @jest-environment node */

import { createHash } from 'node:crypto'

import {
  deriveFinalizedArtifactBooleanNormalization,
  deriveFinalizedArtifactListNormalization,
  validateGoldImportSourceArtifact,
  type ValidateGoldImportArtifactInput,
} from '@/features/literature/gold-set/import-artifact-validation'
import {
  GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
  bindImportPlan,
  goldReviewClinicalProjectionSchema,
  sha256Canonical,
  type GoldReviewPayload,
  type ImportAction,
} from '@/features/literature/gold-set/import-compensation'

const HEADERS = [
  'gold_set_item_id',
  'master_row_id',
  'pmid',
  'dataset_split',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency',
  'topic_ids',
  'technology_tags',
  'technology_tag_status',
  'clinical_purposes',
  'disease_tags',
  'disease_tag_status',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'physician_notes',
  'full_text_used',
  'is_blinded',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'enrichment_provenance',
] as const

type Header = (typeof HEADERS)[number]
type CsvRow = Record<Header, string>

const BATCH_ID = '30000000-0000-4000-8000-000000000001'
const ITEM_1 = '10000000-0000-4000-8000-000000000001'
const ITEM_2 = '10000000-0000-4000-8000-000000000002'
const NOW = '2026-08-08T12:00:00.000Z'
const EXACT_NOTE_DISPOSITION = {
  action: 'preserve_current_authorized_physician_rationale',
  pmids: ['36879724', '39281191'],
  ruleVersion: 'gold-import-existing-note-disposition/amended-two-row-preserve-current-v1',
  sourceArtifactNotesApplied: false,
  status: 'already_authorized',
} as const

const BOOLEAN_COLUMNS = ['categorization_from_full_text', 'full_text_used', 'is_blinded'] as const
const LIST_COLUMNS = ['topic_ids', 'technology_tags', 'clinical_purposes', 'disease_tags'] as const

function sha256(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function csvCell(value: string) {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function csv(rows: CsvRow[], headers: readonly string[] = HEADERS) {
  return `${[
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header as Header])).join(',')),
  ].join('\r\n')}\r\n`
}

function review(notes: string, overrides: Partial<GoldReviewPayload> = {}): GoldReviewPayload {
  return {
    relevanceLabel: 'include_core',
    metadataSufficiency: 'adequate_abstract',
    reviewerConfidence: 'high',
    topicIds: ['basic-bronchoscopy'],
    technologyTags: ['convex-ebus'],
    technologyTagStatus: 'tagged',
    clinicalPurposes: ['diagnosis'],
    diseaseTags: ['lung-cancer'],
    diseaseTagStatus: 'tagged',
    studyDesign: 'diagnostic-accuracy',
    publicationStatus: 'full-article',
    categorizationFromFullText: false,
    notes,
    usedSupplementalMetadata: false,
    reviewSeconds: 917,
    taxonomyVersion: '2.0.0',
    labelSchemaVersion: '3.0.0',
    enrichmentSchemaVersion: '3.0.2',
    enrichmentProvenance: 'physician_confirmed_ai_enrichment',
    reviewerUserId: null,
    reviewerEmail: 'not-in-artifact@example.invalid',
    isBlinded: true,
    startedAt: NOW,
    completedAt: NOW,
    createdAt: NOW,
    ...overrides,
  }
}

const INSERT_REVIEW = review('Physician note, with a comma.')
const NOOP_REVIEW = review('Existing effective decision.', {
  relevanceLabel: 'include_adjacent',
  reviewerConfidence: 'moderate',
  reviewSeconds: 3,
  reviewerEmail: 'different-actor@example.invalid',
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:01:00.000Z',
  createdAt: '2026-01-01T00:01:00.000Z',
})

const ROWS: CsvRow[] = [
  {
    gold_set_item_id: ITEM_1,
    master_row_id: '1',
    pmid: '12345678',
    dataset_split: 'development',
    physician_final_label: INSERT_REVIEW.relevanceLabel,
    physician_final_confidence: INSERT_REVIEW.reviewerConfidence,
    metadata_sufficiency: INSERT_REVIEW.metadataSufficiency,
    topic_ids: INSERT_REVIEW.topicIds.join('|'),
    technology_tags: INSERT_REVIEW.technologyTags.join('|'),
    technology_tag_status: INSERT_REVIEW.technologyTagStatus,
    clinical_purposes: INSERT_REVIEW.clinicalPurposes.join('|'),
    disease_tags: INSERT_REVIEW.diseaseTags.join('|'),
    disease_tag_status: INSERT_REVIEW.diseaseTagStatus,
    study_design: INSERT_REVIEW.studyDesign ?? '',
    publication_status: INSERT_REVIEW.publicationStatus ?? '',
    categorization_from_full_text: String(INSERT_REVIEW.categorizationFromFullText),
    physician_notes: INSERT_REVIEW.notes,
    full_text_used: 'false',
    is_blinded: String(INSERT_REVIEW.isBlinded),
    taxonomy_version: INSERT_REVIEW.taxonomyVersion,
    label_schema_version: INSERT_REVIEW.labelSchemaVersion,
    enrichment_schema_version: INSERT_REVIEW.enrichmentSchemaVersion,
    enrichment_provenance: INSERT_REVIEW.enrichmentProvenance,
  },
  {
    gold_set_item_id: ITEM_2,
    master_row_id: '2',
    pmid: '87654321',
    dataset_split: 'development',
    physician_final_label: NOOP_REVIEW.relevanceLabel,
    physician_final_confidence: NOOP_REVIEW.reviewerConfidence,
    metadata_sufficiency: NOOP_REVIEW.metadataSufficiency,
    topic_ids: NOOP_REVIEW.topicIds.join('|'),
    technology_tags: NOOP_REVIEW.technologyTags.join('|'),
    technology_tag_status: NOOP_REVIEW.technologyTagStatus,
    clinical_purposes: NOOP_REVIEW.clinicalPurposes.join('|'),
    disease_tags: NOOP_REVIEW.diseaseTags.join('|'),
    disease_tag_status: NOOP_REVIEW.diseaseTagStatus,
    study_design: NOOP_REVIEW.studyDesign ?? '',
    publication_status: NOOP_REVIEW.publicationStatus ?? '',
    categorization_from_full_text: String(NOOP_REVIEW.categorizationFromFullText),
    physician_notes: NOOP_REVIEW.notes,
    full_text_used: 'false',
    is_blinded: String(NOOP_REVIEW.isBlinded),
    taxonomy_version: NOOP_REVIEW.taxonomyVersion,
    label_schema_version: NOOP_REVIEW.labelSchemaVersion,
    enrichment_schema_version: NOOP_REVIEW.enrichmentSchemaVersion,
    enrichment_provenance: NOOP_REVIEW.enrichmentProvenance,
  },
]

function planFor(
  csvText: string,
  insertReview: GoldReviewPayload = INSERT_REVIEW,
  sourceRows: readonly CsvRow[] = ROWS,
) {
  const existingReviewId = '20000000-0000-4000-8000-000000000002'
  const candidateReview = goldReviewClinicalProjectionSchema.parse({
    relevanceLabel: NOOP_REVIEW.relevanceLabel,
    metadataSufficiency: NOOP_REVIEW.metadataSufficiency,
    reviewerConfidence: NOOP_REVIEW.reviewerConfidence,
    topicIds: [...NOOP_REVIEW.topicIds].sort(),
    technologyTags: [...NOOP_REVIEW.technologyTags].sort(),
    technologyTagStatus: NOOP_REVIEW.technologyTagStatus,
    clinicalPurposes: [...NOOP_REVIEW.clinicalPurposes].sort(),
    diseaseTags: [...NOOP_REVIEW.diseaseTags].sort(),
    diseaseTagStatus: NOOP_REVIEW.diseaseTagStatus,
    studyDesign: NOOP_REVIEW.studyDesign,
    publicationStatus: NOOP_REVIEW.publicationStatus,
    categorizationFromFullText: NOOP_REVIEW.categorizationFromFullText,
    notes: NOOP_REVIEW.notes,
    usedSupplementalMetadata: NOOP_REVIEW.usedSupplementalMetadata,
    reviewSeconds: NOOP_REVIEW.reviewSeconds,
    taxonomyVersion: NOOP_REVIEW.taxonomyVersion,
    labelSchemaVersion: NOOP_REVIEW.labelSchemaVersion,
    enrichmentSchemaVersion: NOOP_REVIEW.enrichmentSchemaVersion,
    enrichmentProvenance: NOOP_REVIEW.enrichmentProvenance,
    isBlinded: NOOP_REVIEW.isBlinded,
  })
  const actions: ImportAction[] = [
    {
      actionId: '40000000-0000-4000-8000-000000000001',
      sequence: 1,
      itemId: sourceRows[0].gold_set_item_id,
      pmid: sourceRows[0].pmid,
      datasetSplit: 'development',
      expectedCurrentReviewId: null,
      expectedEffectiveReviewId: null,
      preImportItemState: {
        reviewStatus: 'pending',
        startedAt: null,
        completedAt: null,
        supplementalMetadataRevealedAt: null,
        automatedSignalsRevealedAt: null,
      },
      action: 'import_initial',
      expectedRevision: 1,
      expectedSupersedesReviewId: null,
      importedReviewId: '50000000-0000-4000-8000-000000000001',
      expectedHeadReviewIdAfter: '50000000-0000-4000-8000-000000000001',
      expectedEffectiveReviewIdAfter: '50000000-0000-4000-8000-000000000001',
      review: insertReview,
      reviewSha256: sha256Canonical(insertReview),
      compensationAction: 'compensate_void',
      expectedEventSequence: ['review_imported'],
    },
    {
      actionId: '40000000-0000-4000-8000-000000000002',
      sequence: 2,
      itemId: sourceRows[1].gold_set_item_id,
      pmid: sourceRows[1].pmid,
      datasetSplit: 'development',
      expectedCurrentReviewId: existingReviewId,
      expectedEffectiveReviewId: existingReviewId,
      preImportItemState: {
        reviewStatus: 'completed',
        startedAt: NOW,
        completedAt: NOW,
        supplementalMetadataRevealedAt: null,
        automatedSignalsRevealedAt: null,
      },
      action: 'import_noop',
      expectedRevision: null,
      expectedSupersedesReviewId: null,
      importedReviewId: null,
      expectedHeadReviewIdAfter: existingReviewId,
      expectedEffectiveReviewIdAfter: existingReviewId,
      candidateReview,
      candidateReviewSha256: sha256Canonical(candidateReview),
      compensationAction: 'compensate_noop',
      expectedEventSequence: [],
    },
  ]
  return bindImportPlan({
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
    kind: 'import',
    operationId: '60000000-0000-4000-8000-000000000001',
    batchId: BATCH_ID,
    sourceArtifactSha256: sha256(csvText),
    sourceAuthorizationSetSha256: 'a'.repeat(64),
    expectedPhysicalStateSha256: 'b'.repeat(64),
    expectedEffectiveStateSha256: 'c'.repeat(64),
    expectedPostEffectiveStateSha256: 'd'.repeat(64),
    executionContext: {
      targetDatabase: 'local',
      remoteWritesAllowed: false,
      repositoryCommitSha: 'e'.repeat(40),
      migrationId: '20260808035633_add_literature_gold_import_compensation_contract',
      importRpc: 'apply_literature_gold_import_v1',
      compensationRpc: 'compensate_literature_gold_import_v1',
      reconciliationRpc: 'reconcile_literature_gold_review_operation_v1',
      developmentMembershipHash: 'literature_gold_development_membership_hash_v1',
      physicalStateHash: 'literature_gold_physical_state_hash_v1',
      effectiveStateHash: 'literature_gold_effective_state_hash_v1',
    },
    scope: {
      datasetSplit: 'development',
      heldOutIdentitiesAccessed: false,
      developmentMembershipSha256: 'f'.repeat(64),
    },
    counts: { total: 2, initial: 1, revisions: 0, noops: 1, inserts: 1 },
    actions,
  })
}

function cloneRows() {
  return ROWS.map((row) => ({ ...row }))
}

function compatibilityFor(
  rows: readonly CsvRow[],
  csvText: string,
): NonNullable<ValidateGoldImportArtifactInput['compatibility']> {
  const sourceArtifactSha256 = sha256(csvText)
  const booleanNormalizationLedger = rows.flatMap((row) =>
    BOOLEAN_COLUMNS.map((column) =>
      deriveFinalizedArtifactBooleanNormalization({
        column,
        sourceArtifactSha256,
        sourceIdentity: {
          datasetSplit: 'development',
          itemId: row.gold_set_item_id,
          masterRowId: row.master_row_id,
          pmid: row.pmid,
        },
        value: row[column],
      }),
    ),
  )
  const listNormalizationLedger = rows.flatMap((row) =>
    LIST_COLUMNS.flatMap((column) => {
      const { normalization } = deriveFinalizedArtifactListNormalization({
        column,
        sourceArtifactSha256,
        sourceIdentity: {
          datasetSplit: 'development',
          itemId: row.gold_set_item_id,
          masterRowId: row.master_row_id,
          pmid: row.pmid,
        },
        value: row[column],
      })
      return normalization ? [normalization] : []
    }),
  )
  return {
    booleanNormalizationLedger,
    listNormalizationLedger,
    noteDisposition: EXACT_NOTE_DISPOSITION,
  }
}

describe('finalized V3 source artifact validation', () => {
  it('accepts exact insert/no-op coverage and returns only count/hash evidence', () => {
    const csvText = csv(ROWS)
    const plan = planFor(csvText)

    expect(validateGoldImportSourceArtifact({ csvText, plan })).toEqual({
      artifactSha256: sha256(csvText),
      contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION,
      datasetSplit: 'development',
      insertActionCount: 1,
      kind: 'gold_import_source_artifact_validation',
      noopActionCount: 1,
      planSha256: plan.binding.contentSha256,
      rowCount: 2,
      valid: true,
    })
  })

  it('rejects raw artifact tampering before row validation', () => {
    const csvText = csv(ROWS)
    expect(() =>
      validateGoldImportSourceArtifact({
        csvText: csvText.replace('Physician note', 'Tampered note'),
        plan: planFor(csvText),
      }),
    ).toThrow('Finalized V3 CSV checksum mismatch')
  })

  it('rejects a checksum-updated artifact whose finalized values drift from the plan', () => {
    const rows = cloneRows()
    rows[0].physician_final_label = 'include_adjacent'
    const csvText = csv(rows)

    expect(() => validateGoldImportSourceArtifact({ csvText, plan: planFor(csvText) })).toThrow(
      'column physician_final_label: does not match',
    )
  })

  it('binds no-op rows to their checksum-bound candidate review projection', () => {
    const rows = cloneRows()
    rows[1].physician_notes = 'Tampered no-op candidate.'
    const csvText = csv(rows)

    expect(() => validateGoldImportSourceArtifact({ csvText, plan: planFor(csvText) })).toThrow(
      'column physician_notes: does not match',
    )
  })

  it('rejects omitted and duplicate artifact rows', () => {
    const omitted = csv([ROWS[0]])
    expect(() =>
      validateGoldImportSourceArtifact({ csvText: omitted, plan: planFor(omitted) }),
    ).toThrow('does not provide exact one-to-one action coverage')

    const duplicated = csv([ROWS[0], ROWS[1], ROWS[0]])
    expect(() =>
      validateGoldImportSourceArtifact({ csvText: duplicated, plan: planFor(duplicated) }),
    ).toThrow('duplicate gold-set item rows')

    const duplicatePmidRows = cloneRows()
    duplicatePmidRows[1].pmid = duplicatePmidRows[0].pmid
    const duplicatePmid = csv(duplicatePmidRows)
    expect(() =>
      validateGoldImportSourceArtifact({
        csvText: duplicatePmid,
        plan: planFor(duplicatePmid),
      }),
    ).toThrow('duplicate PMID rows')
  })

  it('rejects missing and duplicate required headers', () => {
    const missingHeaders = HEADERS.filter((header) => header !== 'full_text_used')
    const missing = csv(ROWS, missingHeaders)
    expect(() =>
      validateGoldImportSourceArtifact({ csvText: missing, plan: planFor(missing) }),
    ).toThrow('missing required headers: full_text_used')

    const duplicateHeaders = [...HEADERS, 'pmid']
    const duplicate = csv(ROWS, duplicateHeaders)
    expect(() =>
      validateGoldImportSourceArtifact({ csvText: duplicate, plan: planFor(duplicate) }),
    ).toThrow('contains duplicate headers')
  })

  it('rejects non-development rows before examining held-out identities', () => {
    const rows = cloneRows()
    rows[1] = {
      ...rows[1],
      dataset_split: 'test',
      gold_set_item_id: 'held-out-secret-item',
      pmid: 'held-out-secret-pmid',
    }
    const csvText = csv(rows)

    let message = ''
    try {
      validateGoldImportSourceArtifact({ csvText, plan: planFor(csvText) })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('column dataset_split: must be development')
    expect(message).not.toContain('held-out-secret')
  })

  it.each([
    ['categorization_from_full_text', 'false'],
    ['full_text_used', 'false'],
    ['is_blinded', 'true'],
  ] as const)(
    'accepts the canonical boolean lexeme %s=%s without compatibility',
    (column, value) => {
      const rows = cloneRows()
      rows[0][column] = value
      const csvText = csv(rows)
      expect(() =>
        validateGoldImportSourceArtifact({ csvText, plan: planFor(csvText) }),
      ).not.toThrow()
    },
  )

  it.each([
    ['categorization_from_full_text', 'False'],
    ['full_text_used', 'False'],
    ['is_blinded', 'True'],
  ] as const)(
    'requires an exact boolean normalization ledger for legacy lexeme %s=%s',
    (column, value) => {
      const rows = cloneRows()
      rows[0][column] = value
      const csvText = csv(rows)
      const plan = planFor(csvText)

      expect(() => validateGoldImportSourceArtifact({ csvText, plan })).toThrow(
        'requires an exact checksum-bound V3 normalization ledger',
      )
      expect(() =>
        validateGoldImportSourceArtifact({
          compatibility: compatibilityFor(rows, csvText),
          csvText,
          plan,
        }),
      ).not.toThrow()
    },
  )

  it('rejects missing or tampered boolean normalization ledger entries', () => {
    const rows = cloneRows()
    rows[0].is_blinded = 'True'
    const csvText = csv(rows)
    const plan = planFor(csvText)
    const compatibility = compatibilityFor(rows, csvText)
    const [firstBooleanEntry, ...remainingBooleanEntries] = compatibility.booleanNormalizationLedger

    expect(firstBooleanEntry).toBeDefined()
    expect(() =>
      validateGoldImportSourceArtifact({
        compatibility: {
          ...compatibility,
          booleanNormalizationLedger: remainingBooleanEntries,
        },
        csvText,
        plan,
      }),
    ).toThrow('boolean normalization ledger does not exactly match')
    expect(() =>
      validateGoldImportSourceArtifact({
        compatibility: {
          ...compatibility,
          booleanNormalizationLedger: [
            {
              ...firstBooleanEntry!,
              sourceArtifactSha256: '0'.repeat(64),
            },
            ...remainingBooleanEntries,
          ],
        },
        csvText,
        plan,
      }),
    ).toThrow('boolean normalization ledger does not exactly match')
  })

  it('normalizes source list order only with exact V3 ledger coverage', () => {
    const rows = cloneRows()
    rows[0].topic_ids = 'peripheral-navigation|basic-bronchoscopy'
    const csvText = csv(rows)
    const normalizedReview = review(INSERT_REVIEW.notes, {
      topicIds: ['basic-bronchoscopy', 'peripheral-navigation'],
    })
    const plan = planFor(csvText, normalizedReview)
    const compatibility = compatibilityFor(rows, csvText)
    const [normalization] = compatibility.listNormalizationLedger
    if (!normalization) throw new Error('Expected an unsorted fixture normalization.')

    expect(() => validateGoldImportSourceArtifact({ csvText, plan })).toThrow(
      'requires an exact checksum-bound V3 normalization ledger',
    )
    expect(() =>
      validateGoldImportSourceArtifact({
        compatibility,
        csvText,
        plan,
      }),
    ).not.toThrow()
    expect(() =>
      validateGoldImportSourceArtifact({
        compatibility: { ...compatibility, listNormalizationLedger: [] },
        csvText,
        plan,
      }),
    ).toThrow('list normalization ledger does not exactly match')
    expect(() =>
      validateGoldImportSourceArtifact({
        compatibility: {
          ...compatibility,
          listNormalizationLedger: [
            {
              ...normalization,
              sourceArtifactSha256: '0'.repeat(64),
            },
          ],
        },
        csvText,
        plan,
      }),
    ).toThrow('list normalization ledger does not exactly match')
  })

  it.each(['technology_tag_status', 'disease_tag_status'] as const)(
    'rejects a blank %s without status substitution',
    (column) => {
      const rows = cloneRows()
      rows[0][column] = ''
      const csvText = csv(rows)

      expect(() => validateGoldImportSourceArtifact({ csvText, plan: planFor(csvText) })).toThrow(
        `column ${column}: is blank and is not representable by the import v1 contract`,
      )
    },
  )

  it('rejects full_text_used=true as unmapped source provenance even with exact evidence', () => {
    const rows = cloneRows()
    rows[0].full_text_used = 'true'
    const csvText = csv(rows)
    const plan = planFor(csvText)

    expect(() =>
      validateGoldImportSourceArtifact({
        compatibility: compatibilityFor(rows, csvText),
        csvText,
        plan,
      }),
    ).toThrow('records source provenance that has no exact import v1 persistence mapping')
  })

  it('applies only the exact amended two-row preserve-current note disposition', () => {
    const rows = cloneRows()
    rows[1].master_row_id = '4'
    rows[1].pmid = '36879724'
    rows[1].physician_notes = 'Source artifact note that must not replace the current rationale.'
    const csvText = csv(rows)
    const plan = planFor(csvText, INSERT_REVIEW, rows)
    const compatibility = compatibilityFor(rows, csvText)

    expect(() => validateGoldImportSourceArtifact({ csvText, plan })).toThrow(
      'column physician_notes: does not match',
    )
    expect(() => validateGoldImportSourceArtifact({ compatibility, csvText, plan })).not.toThrow()

    const wrongNoteDisposition = {
      ...compatibility.noteDisposition,
      pmids: ['39281191', '36879724'],
    } as unknown as typeof compatibility.noteDisposition
    expect(() =>
      validateGoldImportSourceArtifact({
        compatibility: { ...compatibility, noteDisposition: wrongNoteDisposition },
        csvText,
        plan,
      }),
    ).toThrow('not the exact amended two-row rule')
  })

  it.each([
    ...['TRUE', 'FALSE', '0', '1', 'yes', 'no', ''].map(
      (value) => ['unsupported boolean', 'is_blinded', value, 'must use exactly'] as const,
    ),
    [
      'non-canonical pipe array',
      'topic_ids',
      'basic-bronchoscopy |ebus-mediastinal-staging',
      'canonical pipe-delimited',
    ],
  ] as const)('rejects %s syntax', (_name, column, value, expectedMessage) => {
    const rows = cloneRows()
    rows[0][column] = value
    const csvText = csv(rows)

    expect(() => validateGoldImportSourceArtifact({ csvText, plan: planFor(csvText) })).toThrow(
      expectedMessage,
    )
  })
})
