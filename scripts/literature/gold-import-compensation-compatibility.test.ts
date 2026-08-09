import { createHash } from 'node:crypto'

import { sha256Canonical } from '../../src/features/literature/gold-set/import-compensation'
import {
  FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS,
  GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION,
  GOLD_IMPORT_COMPATIBILITY_SUPPLEMENT_SCHEMA_VERSION,
  GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
  GOLD_IMPORT_EXISTING_HEAD_IDENTITIES,
  GOLD_IMPORT_EXECUTION_COMPATIBILITY_BLOCKER_CODES,
  GOLD_IMPORT_LIST_NORMALIZATION_RULE_VERSION,
  GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES,
  bindCompletedCompatibilitySupplement,
  boundCompatibilitySupplementTemplateSchema,
  deriveCompatibilityActionCounts,
  parseFinalizedArtifactBooleanLexeme,
  parseFinalizedGoldImportArtifact,
  resolveGoldImportCompensationCompatibility,
  validateCompletedCompatibilitySupplement,
  validateGoldImportSourceAuthorizationSetForImport,
  validateGoldImportSourceAuthorizationSetV2,
  type BoundCompatibilitySupplementCompleted,
  type BoundCompatibilitySupplementTemplate,
  type CompatibilityAuditBindingContext,
  type CompatibilityDevelopmentPlanningState,
  type CompatibilityPlanningResolutionRow,
  type CompatibilitySupplementCompletedContent,
} from './gold-import-compensation-compatibility'

const FIXED_TIME = '2026-08-08T00:00:00.000Z'
const DECISION_KEYS = new Set(
  GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES.map(
    (identity) => `${identity.masterRowId}:${identity.pmid}`,
  ),
)
const CONSERVATIVE_NOTES_MISMATCH_PMIDS = new Set(['36879724', '39281191'])

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function clonePlanningState(
  value: CompatibilityDevelopmentPlanningState,
): CompatibilityDevelopmentPlanningState {
  return JSON.parse(JSON.stringify(value)) as CompatibilityDevelopmentPlanningState
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function fixtureUuid(namespace: number, value: number): string {
  return `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${value
    .toString(16)
    .padStart(12, '0')}`
}

function csvCell(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

type ArtifactValues = Record<(typeof FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS)[number], string>

function artifactValues(input: {
  included: boolean
  itemId: string
  masterRowId: string
  pmid: string
  provenance?:
    | 'physician_confirmed_ai_enrichment'
    | 'physician_modified_ai_enrichment'
    | 'ai_generated_enrichment_qc_accepted'
  rawIsBlinded?: 'true' | 'false' | 'True' | 'False'
  fullTextUsed?: boolean
}): ArtifactValues {
  return {
    categorization_from_full_text: 'false',
    clinical_purposes: input.included ? 'diagnosis' : '',
    dataset_split: 'development',
    disease_tag_status: input.included ? 'tagged' : '',
    disease_tags: input.included ? 'lung-cancer' : '',
    enrichment_provenance: input.provenance ?? 'physician_confirmed_ai_enrichment',
    enrichment_schema_version: '3.0.2',
    full_text_used: input.fullTextUsed ? 'true' : 'false',
    gold_set_item_id: input.itemId,
    is_blinded: input.rawIsBlinded ?? 'False',
    label_schema_version: '3.0.0',
    master_row_id: input.masterRowId,
    metadata_sufficiency: 'adequate_abstract',
    physician_final_confidence: 'high',
    physician_final_label: input.included ? 'include_core' : 'exclude',
    physician_notes: `Final decision ${input.masterRowId}`,
    pmid: input.pmid,
    publication_status: input.included ? 'full-article' : '',
    study_design: input.included ? 'retrospective-cohort' : '',
    taxonomy_version: '2.0.0',
    technology_tag_status: input.included ? 'tagged' : '',
    technology_tags: input.included ? 'convex-ebus' : '',
    topic_ids: input.included ? 'basic-bronchoscopy' : '',
  }
}

function historicalReview(
  values: ArtifactValues,
): NonNullable<CompatibilityDevelopmentPlanningState['rows'][number]['currentEffectiveReview']> {
  const included = values.physician_final_label !== 'exclude'
  const sortedList = (value: string) => (value ? value.split('|').sort() : [])
  return {
    categorizationFromFullText: false,
    clinicalPurposes: sortedList(values.clinical_purposes),
    completedAt: FIXED_TIME,
    createdAt: FIXED_TIME,
    diseaseTagStatus: null,
    diseaseTags: sortedList(values.disease_tags),
    enrichmentProvenance: null,
    enrichmentSchemaVersion: null,
    isBlinded: false,
    labelSchemaVersion: null,
    metadataSufficiency: 'adequate_abstract',
    notes: values.physician_notes,
    publicationStatus: included ? 'full-article' : null,
    relevanceLabel: included ? 'include_core' : 'exclude',
    reviewerConfidence: 'high',
    reviewerEmail: 'physician@example.test',
    reviewerUserId: null,
    reviewSeconds: 17,
    startedAt: FIXED_TIME,
    studyDesign: included ? 'retrospective-cohort' : null,
    taxonomyVersion: null,
    technologyTagStatus: null,
    technologyTags: sortedList(values.technology_tags),
    topicIds: sortedList(values.topic_ids),
    usedSupplementalMetadata: false,
  }
}

function itemState(existing: boolean) {
  return {
    automatedSignalsRevealedAt: existing ? FIXED_TIME : null,
    completedAt: existing ? FIXED_TIME : null,
    reviewStatus: existing ? ('completed' as const) : ('pending' as const),
    startedAt: existing ? FIXED_TIME : null,
    supplementalMetadataRevealedAt: null,
  }
}

function serializeArtifact(rows: readonly ArtifactValues[]): Buffer {
  return Buffer.from(
    `${[
      FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS.join(','),
      ...rows.map((row) =>
        FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS.map((column) => csvCell(row[column])).join(','),
      ),
    ].join('\n')}\n`,
    'utf8',
  )
}

function buildFixture(
  initialCount = 0,
  withUnsortedLists = false,
): {
  artifactBytes: Buffer
  bindingContext: CompatibilityAuditBindingContext
  planningState: CompatibilityDevelopmentPlanningState
} {
  const artifactRows: ArtifactValues[] = []
  const planningRows: CompatibilityDevelopmentPlanningState['rows'] = []
  GOLD_IMPORT_EXISTING_HEAD_IDENTITIES.forEach((identity, index) => {
    const itemId = fixtureUuid(0x11000000, index + 1)
    const currentReviewId = fixtureUuid(0x22000000, index + 1)
    const values = artifactValues({
      included: !DECISION_KEYS.has(`${identity.masterRowId}:${identity.pmid}`),
      itemId,
      masterRowId: identity.masterRowId,
      pmid: identity.pmid,
      provenance:
        index % 3 === 0
          ? 'physician_confirmed_ai_enrichment'
          : index % 3 === 1
            ? 'physician_modified_ai_enrichment'
            : 'ai_generated_enrichment_qc_accepted',
    })
    if (withUnsortedLists && index === 0) {
      values.topic_ids = 'peripheral-navigation|basic-bronchoscopy'
      values.technology_tags = 'robotic-bronchoscopy|electromagnetic-navigation'
      values.clinical_purposes = 'staging|diagnosis'
      values.disease_tags = 'mesothelioma|lung-cancer'
    }
    artifactRows.push(values)
    planningRows.push({
      currentEffectiveReview: historicalReview(values),
      currentReviewId,
      currentRevision: 1,
      datasetSplit: 'development',
      displayOrder: index,
      effectiveReviewId: currentReviewId,
      itemId,
      itemState: itemState(true),
      pmid: identity.pmid,
      sequence: index + 1,
    })
  })
  for (let index = 0; index < initialCount; index += 1) {
    const sequence = GOLD_IMPORT_EXISTING_HEAD_IDENTITIES.length + index + 1
    const itemId = fixtureUuid(0x11000000, sequence)
    const values = artifactValues({
      included: true,
      itemId,
      masterRowId: String(sequence),
      pmid: String(40_000_000 + sequence),
      rawIsBlinded: 'true',
    })
    artifactRows.push(values)
    planningRows.push({
      currentEffectiveReview: null,
      currentReviewId: null,
      currentRevision: null,
      datasetSplit: 'development',
      displayOrder: sequence - 1,
      effectiveReviewId: null,
      itemId,
      itemState: itemState(false),
      pmid: values.pmid,
      sequence,
    })
  }
  const planningState: CompatibilityDevelopmentPlanningState = {
    datasetSplit: 'development',
    rows: planningRows,
    schemaVersion: 'gold-import-compensation-development-planning-state/1.0.0',
  }
  const artifactBytes = serializeArtifact(artifactRows)
  const bindingContext: CompatibilityAuditBindingContext = {
    contract: {
      environmentInvariantIdentitySha256: 'e'.repeat(64),
      environmentProfileIdentitySha256: 'f'.repeat(64),
    },
    currentDatabase: {
      batchId: fixtureUuid(0x33000000, 1),
      developmentMembershipSha256: 'd'.repeat(64),
      developmentPlanningStateSha256: sha256Canonical(planningState),
      effectiveStateSha256: 'c'.repeat(64),
      physicalStateSha256: 'b'.repeat(64),
    },
    finalV3ArtifactSha256: sha256(artifactBytes),
    migration: {
      id: GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
      sha256: 'a'.repeat(64),
    },
  }
  return { artifactBytes, bindingContext, planningState }
}

function buildRealLikeBlockedFixture(): {
  artifactBytes: Buffer
  bindingContext: CompatibilityAuditBindingContext
  planningState: CompatibilityDevelopmentPlanningState
} {
  const artifactRows: ArtifactValues[] = []
  const planningRows: CompatibilityDevelopmentPlanningState['rows'] = []
  GOLD_IMPORT_EXISTING_HEAD_IDENTITIES.forEach((identity, index) => {
    const itemId = fixtureUuid(0x61000000, index + 1)
    const currentReviewId = fixtureUuid(0x62000000, index + 1)
    const values = artifactValues({
      included: !DECISION_KEYS.has(`${identity.masterRowId}:${identity.pmid}`),
      itemId,
      masterRowId: identity.masterRowId,
      pmid: identity.pmid,
      rawIsBlinded: 'False',
    })
    const currentEffectiveReview = historicalReview(values)
    currentEffectiveReview.isBlinded = true
    if (CONSERVATIVE_NOTES_MISMATCH_PMIDS.has(identity.pmid)) {
      currentEffectiveReview.notes = `Current authorized rationale for PMID ${identity.pmid}.`
    }
    artifactRows.push(values)
    planningRows.push({
      currentEffectiveReview,
      currentReviewId,
      currentRevision: 1,
      datasetSplit: 'development',
      displayOrder: index,
      effectiveReviewId: currentReviewId,
      itemId,
      itemState: {
        automatedSignalsRevealedAt: null,
        completedAt: FIXED_TIME,
        reviewStatus: 'completed',
        startedAt: FIXED_TIME,
        supplementalMetadataRevealedAt: null,
      },
      pmid: identity.pmid,
      sequence: index + 1,
    })
  })
  for (let index = 0; index < 621; index += 1) {
    const sequence = GOLD_IMPORT_EXISTING_HEAD_IDENTITIES.length + index + 1
    const included = index >= 268
    const itemId = fixtureUuid(0x61000000, sequence)
    const values = artifactValues({
      fullTextUsed: included && index < 318,
      included,
      itemId,
      masterRowId: String(sequence),
      pmid: String(60_000_000 + sequence),
      rawIsBlinded: 'False',
    })
    artifactRows.push(values)
    planningRows.push({
      currentEffectiveReview: null,
      currentReviewId: null,
      currentRevision: null,
      datasetSplit: 'development',
      displayOrder: sequence - 1,
      effectiveReviewId: null,
      itemId,
      itemState: {
        automatedSignalsRevealedAt: null,
        completedAt: null,
        reviewStatus: 'pending',
        startedAt: null,
        supplementalMetadataRevealedAt: null,
      },
      pmid: values.pmid,
      sequence,
    })
  }
  const planningState: CompatibilityDevelopmentPlanningState = {
    datasetSplit: 'development',
    rows: planningRows,
    schemaVersion: 'gold-import-compensation-development-planning-state/1.0.0',
  }
  const artifactBytes = serializeArtifact(artifactRows)
  const bindingContext: CompatibilityAuditBindingContext = {
    contract: {
      environmentInvariantIdentitySha256: 'e'.repeat(64),
      environmentProfileIdentitySha256: 'f'.repeat(64),
    },
    currentDatabase: {
      batchId: fixtureUuid(0x63000000, 1),
      developmentMembershipSha256: 'd'.repeat(64),
      developmentPlanningStateSha256: sha256Canonical(planningState),
      effectiveStateSha256: 'c'.repeat(64),
      physicalStateSha256: 'b'.repeat(64),
    },
    finalV3ArtifactSha256: sha256(artifactBytes),
    migration: {
      id: GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
      sha256: 'a'.repeat(64),
    },
  }
  return { artifactBytes, bindingContext, planningState }
}

function legacySupplementTemplate(
  fixture: ReturnType<typeof buildFixture>,
): BoundCompatibilitySupplementTemplate {
  const resolution = resolveGoldImportCompensationCompatibility({
    bindingContext: fixture.bindingContext,
    developmentPlanningState: fixture.planningState,
    finalizedArtifact: fixture.artifactBytes,
  })
  const parsed = parseFinalizedGoldImportArtifact(fixture.artifactBytes, {
    expectedArtifactSha256: fixture.bindingContext.finalV3ArtifactSha256,
  })
  const byIdentity = new Map(
    parsed.rows.map((row) => [`${row.identity.masterRowId}:${row.identity.pmid}`, row]),
  )
  const content = {
    allowedMutableFields: ['technologyTagStatus', 'diseaseTagStatus'] as const,
    authorization: null,
    bindings: {
      ...fixture.bindingContext,
      existingHeadCohortSha256: resolution.existingHeadCohortSha256,
    },
    documentState: 'template' as const,
    kind: 'physician_compatibility_supplement' as const,
    resolutionClasses: [
      'deterministic_lexical_normalization',
      'deterministic_schema_compatibility_mapping',
      'physician_authorized_compatibility_decision',
    ] as const,
    rows: GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES.map((identity) => {
      const record = byIdentity.get(`${identity.masterRowId}:${identity.pmid}`)
      if (!record) throw new Error('Legacy supplement fixture identity is missing.')
      const emptyDecision = {
        allowedValues: ['not_applicable', 'not_assessable'] as const,
        currentValue: null,
        physicianFinalValue: null,
        proposedValue: null,
        sourceValue: '' as const,
      }
      return {
        categorizationFromFullText: false as const,
        clinicalPurposes: [] as const,
        completionStatus: 'pending' as const,
        diseaseTags: [] as const,
        diseaseTagStatus: emptyDecision,
        enrichmentProvenance: record.projection.enrichmentProvenance,
        itemId: record.identity.itemId,
        masterRowId: record.identity.masterRowId,
        physicianRationale: '' as const,
        pmid: record.identity.pmid,
        publicationStatus: null,
        relevanceLabel: 'exclude' as const,
        reviewed: false as const,
        reviewerConfidence: record.projection.reviewerConfidence,
        studyDesign: null,
        technologyTags: [] as const,
        technologyTagStatus: emptyDecision,
        topicIds: [] as const,
      }
    }),
    schemaVersion: GOLD_IMPORT_COMPATIBILITY_SUPPLEMENT_SCHEMA_VERSION,
    scope: {
      datasetSplit: 'development' as const,
      heldOutIdentitiesAccessed: false as const,
      purpose: 'import_contract_compatibility_only' as const,
      remoteWritesAllowed: false as const,
      targetDatabase: 'local' as const,
    },
  }
  return boundCompatibilitySupplementTemplateSchema.parse({
    ...content,
    binding: {
      canonicalization: 'recursive_sorted_key_json_v1',
      contentSha256: sha256Canonical(content),
    },
  })
}

function completedContent(
  template: BoundCompatibilitySupplementTemplate,
): CompatibilitySupplementCompletedContent {
  return {
    allowedMutableFields: ['technologyTagStatus', 'diseaseTagStatus'],
    authorization: {
      authorizationId: fixtureUuid(0x44000000, 1),
      authorizationKind: 'physician_compatibility_decision',
      authorizationNote: 'Physician reviewed both optional status fields for all four rows.',
      authorized: true,
      authorizedAt: '2026-08-09T12:00:00.000Z',
      authorizedBy: 'reviewing-physician@example.test',
      authorizedRole: 'physician',
    },
    bindings: template.bindings,
    documentState: 'completed',
    kind: 'physician_compatibility_supplement',
    resolutionClasses: [
      'deterministic_lexical_normalization',
      'deterministic_schema_compatibility_mapping',
      'physician_authorized_compatibility_decision',
    ],
    rows: template.rows.map((row, index) => ({
      categorizationFromFullText: row.categorizationFromFullText,
      clinicalPurposes: [],
      completionStatus: 'completed',
      diseaseTags: [],
      diseaseTagStatus: {
        ...row.diseaseTagStatus,
        physicianFinalValue: index % 2 === 0 ? 'not_applicable' : 'not_assessable',
      },
      enrichmentProvenance: row.enrichmentProvenance,
      itemId: row.itemId,
      masterRowId: row.masterRowId,
      physicianRationale: `Reviewed excluded-row taxonomy evidence for PMID ${row.pmid}.`,
      pmid: row.pmid,
      publicationStatus: null,
      relevanceLabel: 'exclude',
      reviewed: true,
      reviewerConfidence: row.reviewerConfidence,
      studyDesign: null,
      technologyTags: [],
      technologyTagStatus: {
        ...row.technologyTagStatus,
        physicianFinalValue: index % 2 === 0 ? 'not_assessable' : 'not_applicable',
      },
      topicIds: [],
    })),
    schemaVersion: GOLD_IMPORT_COMPATIBILITY_SUPPLEMENT_SCHEMA_VERSION,
    scope: template.scope,
    sourceTemplateSha256: template.binding.contentSha256,
  }
}

function completedSupplement(
  template: BoundCompatibilitySupplementTemplate,
): BoundCompatibilitySupplementCompleted {
  return bindCompletedCompatibilitySupplement(completedContent(template))
}

describe('finalized artifact boolean compatibility', () => {
  const sourceIdentity = {
    datasetSplit: 'development' as const,
    itemId: fixtureUuid(0x11000000, 1),
    masterRowId: '1',
    pmid: '30416813',
  }
  const sourceArtifactSha256 = 'a'.repeat(64)

  test.each([
    ['true', true, 'true', 'canonical'],
    ['false', false, 'false', 'canonical'],
    ['True', true, 'true', 'legacy_title_case'],
    ['False', false, 'false', 'legacy_title_case'],
  ] as const)(
    'accepts only documented lexeme %s and preserves normalization evidence',
    (lexeme, semanticValue, canonicalLexeme, sourceForm) => {
      expect(
        parseFinalizedArtifactBooleanLexeme({
          column: 'is_blinded',
          lexeme,
          sourceArtifactSha256,
          sourceIdentity,
        }),
      ).toEqual({
        canonicalLexeme,
        classification: 'deterministic_lexical_normalization',
        column: 'is_blinded',
        normalizationRuleVersion: GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION,
        originalLexeme: lexeme,
        semanticValue,
        sourceArtifactSha256,
        sourceForm,
        sourceIdentity,
      })
    },
  )

  test.each([
    'TRUE',
    'FALSE',
    '0',
    '1',
    'yes',
    'no',
    '',
    'tRuE',
    'fAlSe',
    ' true',
    'false ',
    'on',
    'null',
    'ambiguous',
  ])('rejects unauthorized or ambiguous lexeme %p', (lexeme) => {
    expect(() =>
      parseFinalizedArtifactBooleanLexeme({
        column: 'is_blinded',
        lexeme,
        sourceArtifactSha256,
        sourceIdentity,
      }),
    ).toThrow('must use exactly true, false, True, or False')
  })

  test.each([null, true, false, 0, 1, undefined])(
    'rejects non-string boolean representation %p',
    (lexeme) => {
      expect(() =>
        parseFinalizedArtifactBooleanLexeme({
          column: 'is_blinded',
          lexeme,
          sourceArtifactSha256,
          sourceIdentity,
        }),
      ).toThrow()
    },
  )

  test('parses rows without changing bytes and records all nine legacy False values', () => {
    const fixture = buildFixture()
    const before = Buffer.from(fixture.artifactBytes)
    const parsed = parseFinalizedGoldImportArtifact(fixture.artifactBytes, {
      expectedArtifactSha256: fixture.bindingContext.finalV3ArtifactSha256,
    })
    expect(fixture.artifactBytes).toEqual(before)
    expect(parsed.artifactSha256).toBe(sha256(before))
    const existingBlindings = parsed.booleanNormalizations.filter(
      (entry) => entry.column === 'is_blinded',
    )
    expect(existingBlindings).toHaveLength(9)
    expect(existingBlindings).toEqual(
      expect.arrayContaining(
        existingBlindings.map(() =>
          expect.objectContaining({
            canonicalLexeme: 'false',
            normalizationRuleVersion: GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION,
            originalLexeme: 'False',
            semanticValue: false,
            sourceArtifactSha256: sha256(before),
            sourceForm: 'legacy_title_case',
          }),
        ),
      ),
    )
  })

  test('normalizes ordered unique set lists without changing source bytes and records each reorder', () => {
    const fixture = buildFixture(0, true)
    const before = Buffer.from(fixture.artifactBytes)
    const parsed = parseFinalizedGoldImportArtifact(fixture.artifactBytes, {
      expectedArtifactSha256: fixture.bindingContext.finalV3ArtifactSha256,
    })

    expect(fixture.artifactBytes).toEqual(before)
    expect(parsed.rows[0]?.projection).toMatchObject({
      clinicalPurposes: ['diagnosis', 'staging'],
      diseaseTags: ['lung-cancer', 'mesothelioma'],
      technologyTags: ['electromagnetic-navigation', 'robotic-bronchoscopy'],
      topicIds: ['basic-bronchoscopy', 'peripheral-navigation'],
    })
    expect(parsed.listNormalizations).toHaveLength(4)
    expect(parsed.listNormalizations.map(({ column }) => column)).toEqual([
      'topic_ids',
      'technology_tags',
      'clinical_purposes',
      'disease_tags',
    ])
    parsed.listNormalizations.forEach((entry) => {
      expect(entry).toEqual(
        expect.objectContaining({
          classification: 'deterministic_lexical_normalization',
          normalizationRuleVersion: GOLD_IMPORT_LIST_NORMALIZATION_RULE_VERSION,
          sourceArtifactSha256: sha256(before),
          sourceIdentity: expect.objectContaining({ masterRowId: '1', pmid: '30416813' }),
        }),
      )
      expect(entry.originalLexeme).toBe(entry.originalValues.join('|'))
      expect(entry.canonicalValues).toEqual([...entry.originalValues].sort())
    })
  })

  test.each([
    'basic-bronchoscopy|basic-bronchoscopy',
    'basic-bronchoscopy |peripheral-navigation',
    'basic-bronchoscopy||peripheral-navigation',
  ])('rejects invalid list syntax %p instead of normalizing it', (topicIds) => {
    const row = artifactValues({
      included: true,
      itemId: fixtureUuid(0x11000000, 99),
      masterRowId: '99',
      pmid: '49999999',
    })
    row.topic_ids = topicIds
    expect(() => parseFinalizedGoldImportArtifact(serializeArtifact([row]))).toThrow(
      'has a noncanonical list',
    )
  })
})

describe('nine-head compatibility resolution', () => {
  test('validates all 630 rows before actions and reports exact source lifecycle blockers', () => {
    const fixture = buildRealLikeBlockedFixture()
    const result = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    expect(result.readyForPackage).toBe(false)
    expect(result.supplementRequired).toBe(false)
    expect(result.supplementTemplate).toBeNull()
    expect(result.acceptedSupplementSha256).toBeNull()
    expect(result.existingHeads).toHaveLength(9)
    expect(result.actionCounts).toEqual({
      incompatible: 630,
      initial: 0,
      inserts: 0,
      noops: 0,
      revisions: 0,
      total: 630,
      unresolved: 0,
    })
    expect(result.executionCompatibility).toEqual(
      expect.objectContaining({
        blockedRowCount: 630,
        countsByCode: {
          excluded_status_null_not_representable_by_import_contract_v1: 272,
          source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1: 630,
          source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1: 50,
        },
        executableRowCount: 0,
        totalRowCount: 630,
      }),
    )
    GOLD_IMPORT_EXECUTION_COMPATIBILITY_BLOCKER_CODES.forEach((code) => {
      expect(result.executionCompatibility.identitiesByCode[code]).toHaveLength(
        result.executionCompatibility.countsByCode[code],
      )
    })
    expect(
      Object.values(result.executionCompatibility.countsByCode).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(952)
    expect(
      result.planningRows.every(
        (row) =>
          row.proposedAction === null &&
          row.targetReview === null &&
          row.resolutionStatus === 'incompatible',
      ),
    ).toBe(true)
    result.existingHeads.forEach((row) => {
      expect(row.fields).toContainEqual(
        expect.objectContaining({
          classification: 'execution_contract_mismatch',
          field: 'isBlinded',
          resolvedValue: false,
          sourceValue: 'False',
        }),
      )
      expect(
        row.fields.filter((field) => field.classification === 'physician_decision_required'),
      ).toEqual([])
    })
    expect(
      result.existingHeads.flatMap((row) =>
        row.fields.filter((field) => field.classification === 'finalized_v3_out_of_scope_null'),
      ),
    ).toHaveLength(8)
    expect(
      result.existingHeads
        .filter((row) =>
          row.fields.some(
            (field) => field.field === 'notes' && field.classification === 'incompatible',
          ),
        )
        .map((row) => row.identity.pmid),
    ).toEqual(['36879724', '39281191'])
  })

  test('does not turn authoritative excluded V3 nulls into physician decisions', () => {
    const fixture = buildFixture()
    const result = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    expect(result).toEqual(
      expect.objectContaining({
        acceptedSupplementSha256: null,
        readyForPackage: false,
        supplementRequired: false,
        supplementTemplate: null,
      }),
    )
    expect(result.actionCounts.unresolved).toBe(0)
    expect(
      result.existingHeads.flatMap((row) =>
        row.fields.filter((field) => field.classification === 'physician_decision_required'),
      ),
    ).toEqual([])
  })

  test('rejects a supplied compatibility supplement and cannot flip readiness', () => {
    const fixture = buildFixture()
    expect(() =>
      resolveGoldImportCompensationCompatibility({
        bindingContext: fixture.bindingContext,
        compatibilitySupplement: {},
        developmentPlanningState: fixture.planningState,
        finalizedArtifact: fixture.artifactBytes,
      }),
    ).toThrow('not applicable')
  })

  test('classifies semantic physician-field drift as incompatible only after all fields are read', () => {
    const fixture = buildFixture()
    const changedState = clonePlanningState(fixture.planningState)
    const first = changedState.rows[0]
    if (!first?.currentEffectiveReview) throw new Error('Fixture head missing.')
    first.currentEffectiveReview.relevanceLabel = 'include_adjacent'
    const bindingContext = {
      ...fixture.bindingContext,
      currentDatabase: {
        ...fixture.bindingContext.currentDatabase,
        developmentPlanningStateSha256: sha256Canonical(changedState),
      },
    }
    const result = resolveGoldImportCompensationCompatibility({
      bindingContext,
      developmentPlanningState: changedState,
      finalizedArtifact: fixture.artifactBytes,
    })
    expect(result.existingHeads[0].fields).toHaveLength(20)
    expect(result.existingHeads[0]).toEqual(
      expect.objectContaining({
        proposedAction: null,
        resolutionStatus: 'incompatible',
      }),
    )
    expect(result.existingHeads[0].fields).toContainEqual(
      expect.objectContaining({ classification: 'incompatible', field: 'relevanceLabel' }),
    )
    expect(result.actionCounts.incompatible).toBe(5)
  })

  test('separates pinned V3 enrichment changes from conservative physician-note drift', () => {
    const fixture = buildFixture()
    const changedState = clonePlanningState(fixture.planningState)
    const first = changedState.rows[0]
    if (!first?.currentEffectiveReview) throw new Error('Fixture head missing.')
    first.currentEffectiveReview.topicIds = []
    first.currentEffectiveReview.studyDesign = null
    first.currentEffectiveReview.notes = 'A different physician rationale.'
    const result = resolveGoldImportCompensationCompatibility({
      bindingContext: {
        ...fixture.bindingContext,
        currentDatabase: {
          ...fixture.bindingContext.currentDatabase,
          developmentPlanningStateSha256: sha256Canonical(changedState),
        },
      },
      developmentPlanningState: changedState,
      finalizedArtifact: fixture.artifactBytes,
    })
    const audited = result.existingHeads[0]
    expect(audited?.fields).toContainEqual(
      expect.objectContaining({
        classification: 'finalized_v3_authorized_enrichment_change',
        field: 'topicIds',
      }),
    )
    expect(audited?.fields).toContainEqual(
      expect.objectContaining({
        classification: 'finalized_v3_authorized_enrichment_change',
        field: 'studyDesign',
      }),
    )
    expect(audited?.fields).toContainEqual(
      expect.objectContaining({ classification: 'incompatible', field: 'notes' }),
    )
    expect(audited).toEqual(
      expect.objectContaining({ proposedAction: null, resolutionStatus: 'incompatible' }),
    )
  })

  test('derives counts from rows rather than a historical fixed shape', () => {
    const rows = [
      ['import_initial', 'resolved'],
      ['import_initial', 'resolved'],
      ['import_revision', 'resolved'],
      ['import_noop', 'resolved'],
      [null, 'pending_physician_decision'],
      [null, 'incompatible'],
    ].map(
      ([proposedAction, resolutionStatus], index) =>
        ({
          executionBlockerCodes: [],
          identity: {
            datasetSplit: 'development',
            itemId: fixtureUuid(0x55000000, index + 1),
            masterRowId: String(index + 1),
            pmid: String(50_000_000 + index),
          },
          proposedAction,
          reason: 'fixture',
          resolutionStatus,
          sequence: index + 1,
          targetReview: null,
        }) as CompatibilityPlanningResolutionRow,
    )
    expect(deriveCompatibilityActionCounts(rows)).toEqual({
      incompatible: 1,
      initial: 2,
      inserts: 3,
      noops: 1,
      revisions: 1,
      total: 6,
      unresolved: 1,
    })
  })
})

describe('strict legacy compatibility supplement schema validation', () => {
  function supplementFixture() {
    const fixture = buildFixture()
    const template = legacySupplementTemplate(fixture)
    return {
      ...fixture,
      content: completedContent(template),
      supplement: completedSupplement(template),
      template,
    }
  }

  test('requires physician authorization and completed row attestations', () => {
    const fixture = supplementFixture()
    expect(() =>
      bindCompletedCompatibilitySupplement({ ...fixture.content, authorization: null }),
    ).toThrow()
    expect(() =>
      bindCompletedCompatibilitySupplement({
        ...fixture.content,
        rows: fixture.content.rows.map((row, index) =>
          index === 0 ? { ...row, reviewed: false } : row,
        ),
      }),
    ).toThrow()
    expect(() =>
      bindCompletedCompatibilitySupplement({
        ...fixture.content,
        rows: fixture.content.rows.map((row, index) =>
          index === 0 ? { ...row, physicianRationale: '' } : row,
        ),
      }),
    ).toThrow()
  })

  test('rejects preselection, disallowed statuses, and changes to protected fields', () => {
    const fixture = supplementFixture()
    expect(() =>
      bindCompletedCompatibilitySupplement({
        ...fixture.content,
        rows: fixture.content.rows.map((row, index) =>
          index === 0
            ? {
                ...row,
                technologyTagStatus: {
                  ...row.technologyTagStatus,
                  proposedValue: 'not_applicable',
                },
              }
            : row,
        ),
      }),
    ).toThrow()
    expect(() =>
      bindCompletedCompatibilitySupplement({
        ...fixture.content,
        rows: fixture.content.rows.map((row, index) =>
          index === 0
            ? {
                ...row,
                technologyTagStatus: {
                  ...row.technologyTagStatus,
                  physicianFinalValue: 'tagged',
                },
              }
            : row,
        ),
      }),
    ).toThrow()
    expect(() =>
      bindCompletedCompatibilitySupplement({
        ...fixture.content,
        rows: fixture.content.rows.map((row, index) =>
          index === 0 ? { ...row, relevanceLabel: 'include_core' } : row,
        ),
      }),
    ).toThrow()
    expect(() =>
      bindCompletedCompatibilitySupplement({
        ...fixture.content,
        rows: fixture.content.rows.map((row, index) =>
          index === 0 ? { ...row, technologyTags: ['convex-ebus'] } : row,
        ),
      }),
    ).toThrow()
  })

  test('rejects unknown fields at every strict boundary', () => {
    const fixture = supplementFixture()
    expect(() =>
      bindCompletedCompatibilitySupplement({ ...fixture.content, unexpected: true }),
    ).toThrow()
    expect(() =>
      bindCompletedCompatibilitySupplement({
        ...fixture.content,
        rows: fixture.content.rows.map((row, index) =>
          index === 0 ? { ...row, unexpected: true } : row,
        ),
      }),
    ).toThrow()
    expect(() =>
      validateCompletedCompatibilitySupplement(
        {
          ...fixture.supplement,
          authorization: { ...fixture.supplement.authorization, unexpected: true },
        },
        fixture.template,
      ),
    ).toThrow()
  })

  test('rejects a checksum-valid change to fixed confidence', () => {
    const fixture = supplementFixture()
    const changed = bindCompletedCompatibilitySupplement({
      ...fixture.content,
      rows: fixture.content.rows.map((row, index) =>
        index === 0 ? { ...row, reviewerConfidence: 'moderate' } : row,
      ),
    })
    expect(() => validateCompletedCompatibilitySupplement(changed, fixture.template)).toThrow(
      'changed a fixed physician or source field',
    )
  })

  test('rejects missing, duplicate, or substituted decision identities', () => {
    const fixture = supplementFixture()
    const duplicate = bindCompletedCompatibilitySupplement({
      ...fixture.content,
      rows: [fixture.content.rows[0], fixture.content.rows[0], ...fixture.content.rows.slice(2)],
    })
    expect(() => validateCompletedCompatibilitySupplement(duplicate, fixture.template)).toThrow(
      'exact four decision rows',
    )
  })

  test('rejects stale standalone supplement bindings and active resolver use', () => {
    const fixture = supplementFixture()
    const rebound = bindCompletedCompatibilitySupplement({
      ...fixture.content,
      bindings: {
        ...fixture.content.bindings,
        currentDatabase: {
          ...fixture.content.bindings.currentDatabase,
          physicalStateSha256: '1'.repeat(64),
        },
      },
    })
    expect(() => validateCompletedCompatibilitySupplement(rebound, fixture.template)).toThrow()
    expect(() =>
      resolveGoldImportCompensationCompatibility({
        bindingContext: fixture.bindingContext,
        compatibilitySupplement: fixture.supplement,
        developmentPlanningState: fixture.planningState,
        finalizedArtifact: fixture.artifactBytes,
      }),
    ).toThrow('not applicable')
  })

  test('rejects artifact and planning-state checksum mismatch before resolution', () => {
    const fixture = supplementFixture()
    const changedArtifact = Buffer.from(fixture.artifactBytes)
    changedArtifact[changedArtifact.length - 1] = 0x20
    expect(() =>
      resolveGoldImportCompensationCompatibility({
        bindingContext: fixture.bindingContext,
        developmentPlanningState: fixture.planningState,
        finalizedArtifact: changedArtifact,
      }),
    ).toThrow('SHA-256')
    expect(() =>
      resolveGoldImportCompensationCompatibility({
        bindingContext: {
          ...fixture.bindingContext,
          currentDatabase: {
            ...fixture.bindingContext.currentDatabase,
            developmentPlanningStateSha256: '0'.repeat(64),
          },
        },
        developmentPlanningState: fixture.planningState,
        finalizedArtifact: fixture.artifactBytes,
      }),
    ).toThrow('planning state is stale')
  })

  test('rejects a template in place of a completed authorized supplement', () => {
    const fixture = supplementFixture()
    expect(() =>
      resolveGoldImportCompensationCompatibility({
        bindingContext: fixture.bindingContext,
        compatibilitySupplement: fixture.template,
        developmentPlanningState: fixture.planningState,
        finalizedArtifact: fixture.artifactBytes,
      }),
    ).toThrow()
  })
})

describe('compatibility source authorization binding', () => {
  function authorizationFixture() {
    const fixture = buildFixture(2, true)
    const resolution = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    const supplement = completedSupplement(legacySupplementTemplate(fixture))
    const optionalTagStatusResolutions = supplement.rows.map((row) => {
      const technologyTagStatus = row.technologyTagStatus.physicianFinalValue
      const diseaseTagStatus = row.diseaseTagStatus.physicianFinalValue
      if (!technologyTagStatus || !diseaseTagStatus) {
        throw new Error('Expected exact completed optional statuses.')
      }
      return {
        diseaseTagStatus,
        itemId: row.itemId,
        pmid: row.pmid,
        technologyTagStatus,
      }
    })
    const legacyActionCounts = {
      incompatible: 0 as const,
      initial: 2,
      inserts: 11,
      noops: 0,
      revisions: 9,
      total: 11,
      unresolved: 0 as const,
    }
    const authorizationSet = {
      amendedTwoRowAuthorizationSha256: '1'.repeat(64),
      compatibility: {
        acceptedSupplementSha256: supplement.binding.contentSha256,
        actionCounts: legacyActionCounts,
        booleanNormalizationLedger: resolution.artifact.booleanNormalizations,
        booleanNormalizationLedgerSha256: sha256Canonical(
          resolution.artifact.booleanNormalizations,
        ),
        existingHeadCohortSha256: resolution.existingHeadCohortSha256,
        listNormalizationLedger: resolution.artifact.listNormalizations,
        listNormalizationLedgerSha256: sha256Canonical(resolution.artifact.listNormalizations),
        optionalTagStatusResolutions,
        resolutionSchemaVersion: resolution.schemaVersion,
        supplement,
      },
      finalArtifactSha256: fixture.bindingContext.finalV3ArtifactSha256,
      kind: 'gold_import_source_authorization_set',
      signedProtocolAuthorizationSha256: '2'.repeat(64),
      sourceDecisionsChanged: false,
      version: 2,
    } as const
    return {
      authorizationSet,
      artifactBytes: fixture.artifactBytes,
      plan: {
        batchId: fixture.bindingContext.currentDatabase.batchId,
        counts: {
          initial: legacyActionCounts.initial,
          inserts: legacyActionCounts.inserts,
          noops: legacyActionCounts.noops,
          revisions: legacyActionCounts.revisions,
          total: legacyActionCounts.total,
        },
        executionContext: {
          compensationRpc: 'compensate_literature_gold_import_v1' as const,
          developmentMembershipHash: 'literature_gold_development_membership_hash_v1' as const,
          effectiveStateHash: 'literature_gold_effective_state_hash_v1' as const,
          importRpc: 'apply_literature_gold_import_v1' as const,
          migrationId: GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
          physicalStateHash: 'literature_gold_physical_state_hash_v1' as const,
          reconciliationRpc: 'reconcile_literature_gold_review_operation_v1' as const,
          remoteWritesAllowed: false as const,
          repositoryCommitSha: 'a'.repeat(40),
          targetDatabase: 'local' as const,
        },
        expectedEffectiveStateSha256: fixture.bindingContext.currentDatabase.effectiveStateSha256,
        expectedPhysicalStateSha256: fixture.bindingContext.currentDatabase.physicalStateSha256,
        scope: {
          datasetSplit: 'development' as const,
          developmentMembershipSha256:
            fixture.bindingContext.currentDatabase.developmentMembershipSha256,
          heldOutIdentitiesAccessed: false as const,
        },
        sourceArtifactSha256: fixture.bindingContext.finalV3ArtifactSha256,
      },
    }
  }

  test('accepts the exact supplement, ledger, cohort, dynamic counts, and four decisions', () => {
    const { artifactBytes, authorizationSet, plan } = authorizationFixture()
    expect(validateGoldImportSourceAuthorizationSetV2(authorizationSet).version).toBe(2)
    expect(
      validateGoldImportSourceAuthorizationSetForImport({
        finalizedArtifact: artifactBytes,
        plan,
        sourceAuthorizationSet: authorizationSet,
      }).version,
    ).toBe(2)
    expect(
      validateGoldImportSourceAuthorizationSetV2({
        ...authorizationSet,
        compatibility: {
          ...authorizationSet.compatibility,
          optionalTagStatusResolutions: [
            ...authorizationSet.compatibility.optionalTagStatusResolutions,
          ].reverse(),
        },
      }).compatibility.optionalTagStatusResolutions,
    ).toHaveLength(4)
  })

  test('rejects V1 authorization when the raw artifact requires list normalization', () => {
    const { artifactBytes, authorizationSet, plan } = authorizationFixture()
    const v1AuthorizationSet = {
      amendedTwoRowAuthorizationSha256: authorizationSet.amendedTwoRowAuthorizationSha256,
      finalArtifactSha256: authorizationSet.finalArtifactSha256,
      kind: authorizationSet.kind,
      signedProtocolAuthorizationSha256: authorizationSet.signedProtocolAuthorizationSha256,
      sourceDecisionsChanged: false as const,
      version: 1 as const,
    }

    expect(() =>
      validateGoldImportSourceAuthorizationSetForImport({
        finalizedArtifact: artifactBytes,
        plan,
        sourceAuthorizationSet: v1AuthorizationSet,
      }),
    ).toThrow('V1 cannot authorize finalized-artifact list reordering')
  })

  test('rejects a self-hashed list ledger with missing raw-artifact coverage', () => {
    const { artifactBytes, authorizationSet, plan } = authorizationFixture()
    expect(authorizationSet.compatibility.listNormalizationLedger).toHaveLength(4)
    const listNormalizationLedger = authorizationSet.compatibility.listNormalizationLedger.slice(1)
    const mismatched = {
      ...authorizationSet,
      compatibility: {
        ...authorizationSet.compatibility,
        listNormalizationLedger,
        listNormalizationLedgerSha256: sha256Canonical(listNormalizationLedger),
      },
    }
    expect(validateGoldImportSourceAuthorizationSetV2(mismatched).version).toBe(2)
    expect(() =>
      validateGoldImportSourceAuthorizationSetForImport({
        finalizedArtifact: artifactBytes,
        plan,
        sourceAuthorizationSet: mismatched,
      }),
    ).toThrow('list normalization ledger does not exactly match the finalized artifact')
  })

  test('rejects checksum-consistent count and physician-decision substitution', () => {
    const { authorizationSet } = authorizationFixture()
    expect(() =>
      validateGoldImportSourceAuthorizationSetV2({
        ...authorizationSet,
        compatibility: {
          ...authorizationSet.compatibility,
          actionCounts: { ...authorizationSet.compatibility.actionCounts, revisions: 8 },
        },
      }),
    ).toThrow('action counts are inconsistent')

    const first = authorizationSet.compatibility.optionalTagStatusResolutions[0]
    expect(first).toBeDefined()
    expect(() =>
      validateGoldImportSourceAuthorizationSetV2({
        ...authorizationSet,
        compatibility: {
          ...authorizationSet.compatibility,
          optionalTagStatusResolutions:
            authorizationSet.compatibility.optionalTagStatusResolutions.map((row, index) =>
              index === 0
                ? {
                    ...row,
                    technologyTagStatus:
                      first?.technologyTagStatus === 'not_applicable'
                        ? 'not_assessable'
                        : 'not_applicable',
                  }
                : row,
            ),
        },
      }),
    ).toThrow('differs from the physician supplement')
  })

  test('rejects internally consistent action counts that differ from the parsed import plan', () => {
    const { artifactBytes, authorizationSet, plan } = authorizationFixture()
    const mismatched = {
      ...authorizationSet,
      compatibility: {
        ...authorizationSet.compatibility,
        actionCounts: {
          ...authorizationSet.compatibility.actionCounts,
          inserts: authorizationSet.compatibility.actionCounts.inserts - 1,
          noops: authorizationSet.compatibility.actionCounts.noops + 1,
          revisions: authorizationSet.compatibility.actionCounts.revisions - 1,
        },
      },
    }
    expect(validateGoldImportSourceAuthorizationSetV2(mismatched).version).toBe(2)
    expect(() =>
      validateGoldImportSourceAuthorizationSetForImport({
        finalizedArtifact: artifactBytes,
        plan,
        sourceAuthorizationSet: mismatched,
      }),
    ).toThrow('action counts do not match the import plan')
  })

  test('rejects a self-hashed normalization ledger that differs from the raw artifact', () => {
    const { artifactBytes, authorizationSet, plan } = authorizationFixture()
    const [first, ...remainingLedger] = jsonClone(
      authorizationSet.compatibility.booleanNormalizationLedger,
    )
    if (!first || first.originalLexeme !== 'false') {
      throw new Error('Expected the fixture ledger to begin with canonical false.')
    }
    const ledger = [
      { ...first, originalLexeme: 'False' as const, sourceForm: 'legacy_title_case' as const },
      ...remainingLedger,
    ]
    const mismatched = {
      ...authorizationSet,
      compatibility: {
        ...authorizationSet.compatibility,
        booleanNormalizationLedger: ledger,
        booleanNormalizationLedgerSha256: sha256Canonical(ledger),
      },
    }
    expect(validateGoldImportSourceAuthorizationSetV2(mismatched).version).toBe(2)
    expect(() =>
      validateGoldImportSourceAuthorizationSetForImport({
        finalizedArtifact: artifactBytes,
        plan,
        sourceAuthorizationSet: mismatched,
      }),
    ).toThrow('does not exactly match the finalized artifact')
  })

  test('rejects a self-bound supplement whose current database state differs from the plan', () => {
    const { artifactBytes, authorizationSet, plan } = authorizationFixture()
    const { binding: originalBinding, ...supplementContent } =
      authorizationSet.compatibility.supplement
    const staleSupplement = bindCompletedCompatibilitySupplement({
      ...supplementContent,
      bindings: {
        ...supplementContent.bindings,
        currentDatabase: {
          ...supplementContent.bindings.currentDatabase,
          physicalStateSha256: '9'.repeat(64),
        },
      },
    })
    const stale = {
      ...authorizationSet,
      compatibility: {
        ...authorizationSet.compatibility,
        acceptedSupplementSha256: staleSupplement.binding.contentSha256,
        supplement: staleSupplement,
      },
    }
    expect(staleSupplement.binding.contentSha256).not.toBe(originalBinding.contentSha256)
    expect(validateGoldImportSourceAuthorizationSetV2(stale).version).toBe(2)
    expect(() =>
      validateGoldImportSourceAuthorizationSetForImport({
        finalizedArtifact: artifactBytes,
        plan,
        sourceAuthorizationSet: stale,
      }),
    ).toThrow('stale relative to the import plan current-state bindings')
  })
})
