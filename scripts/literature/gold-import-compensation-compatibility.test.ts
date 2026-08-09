import { createHash } from 'node:crypto'

import { sha256Canonical } from '../../src/features/literature/gold-set/import-compensation'
import {
  FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS,
  GOLD_IMPORT_BOOLEAN_NORMALIZATION_RULE_VERSION,
  GOLD_IMPORT_COMPATIBILITY_SUPPLEMENT_SCHEMA_VERSION,
  GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
  GOLD_IMPORT_EXISTING_HEAD_IDENTITIES,
  GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES,
  bindCompletedCompatibilitySupplement,
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
}): ArtifactValues {
  const decisionRequired = DECISION_KEYS.has(`${input.masterRowId}:${input.pmid}`)
  return {
    categorization_from_full_text: 'false',
    clinical_purposes: input.included ? 'diagnosis' : '',
    dataset_split: 'development',
    disease_tag_status: input.included ? 'tagged' : decisionRequired ? '' : 'not_applicable',
    disease_tags: input.included ? 'lung-cancer' : '',
    enrichment_provenance: input.provenance ?? 'physician_confirmed_ai_enrichment',
    enrichment_schema_version: '3.0.2',
    full_text_used: 'false',
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
    technology_tag_status: input.included ? 'tagged' : decisionRequired ? '' : 'not_applicable',
    technology_tags: input.included ? 'convex-ebus' : '',
    topic_ids: input.included ? 'basic-bronchoscopy' : '',
  }
}

function historicalReview(
  values: ArtifactValues,
): NonNullable<CompatibilityDevelopmentPlanningState['rows'][number]['currentEffectiveReview']> {
  const included = values.physician_final_label !== 'exclude'
  return {
    categorizationFromFullText: false,
    clinicalPurposes: included ? ['diagnosis'] : [],
    completedAt: FIXED_TIME,
    createdAt: FIXED_TIME,
    diseaseTagStatus: null,
    diseaseTags: included ? ['lung-cancer'] : [],
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
    technologyTags: included ? ['convex-ebus'] : [],
    topicIds: included ? ['basic-bronchoscopy'] : [],
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

function buildFixture(initialCount = 0): {
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
})

describe('nine-head compatibility resolution', () => {
  test('classifies five deterministic rows, defers four physician rows, and derives counts', () => {
    const fixture = buildFixture(2)
    const result = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    expect(result.readyForPackage).toBe(false)
    expect(result.supplementRequired).toBe(true)
    expect(result.existingHeads).toHaveLength(9)
    expect(result.actionCounts).toEqual({
      incompatible: 0,
      initial: 2,
      inserts: 7,
      noops: 0,
      revisions: 5,
      total: 11,
      unresolved: 4,
    })
    const pending = result.existingHeads.filter(
      (row) => row.resolutionStatus === 'pending_physician_decision',
    )
    const deterministic = result.existingHeads.filter((row) => row.resolutionStatus === 'resolved')
    expect(pending).toHaveLength(4)
    expect(deterministic).toHaveLength(5)
    expect(pending.map((row) => row.proposedAction)).toEqual([null, null, null, null])
    pending.forEach((row) => {
      expect(row.fields).toHaveLength(20)
      expect(
        row.fields.filter((field) => field.classification === 'physician_decision_required'),
      ).toEqual([
        expect.objectContaining({ field: 'technologyTagStatus', sourceValue: '' }),
        expect.objectContaining({ field: 'diseaseTagStatus', sourceValue: '' }),
      ])
    })
    deterministic.forEach((row) => {
      expect(row.proposedAction).toBe('import_revision')
      expect(
        row.fields.filter(
          (field) => field.classification === 'deterministic_schema_compatibility_mapping',
        ),
      ).toHaveLength(6)
    })
    result.existingHeads.forEach((row) => {
      expect(row.fields).toContainEqual(
        expect.objectContaining({
          classification: 'deterministic_lexical_normalization',
          field: 'isBlinded',
          resolvedValue: false,
          sourceValue: 'False',
        }),
      )
    })
    expect(result.planningRows.filter((row) => row.proposedAction === null)).toHaveLength(4)
    expect(
      result.planningRows.filter((row) => row.proposedAction === 'import_initial'),
    ).toHaveLength(2)
  })

  test('emits an unselected checksum-bound four-row physician template', () => {
    const fixture = buildFixture()
    const result = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    const template = result.supplementTemplate
    expect(template).not.toBeNull()
    if (!template) throw new Error('Expected a physician supplement template.')
    expect(template.authorization).toBeNull()
    expect(template.scope).toEqual({
      datasetSplit: 'development',
      heldOutIdentitiesAccessed: false,
      purpose: 'import_contract_compatibility_only',
      remoteWritesAllowed: false,
      targetDatabase: 'local',
    })
    expect(template.allowedMutableFields).toEqual(['technologyTagStatus', 'diseaseTagStatus'])
    expect(template.bindings).toEqual({
      ...fixture.bindingContext,
      existingHeadCohortSha256: result.existingHeadCohortSha256,
    })
    expect(template.rows).toHaveLength(4)
    expect(template.rows.map((row) => ({ masterRowId: row.masterRowId, pmid: row.pmid }))).toEqual(
      GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES,
    )
    template.rows.forEach((row) => {
      expect(row).toEqual(
        expect.objectContaining({
          categorizationFromFullText: false,
          clinicalPurposes: [],
          completionStatus: 'pending',
          diseaseTags: [],
          physicianRationale: '',
          publicationStatus: null,
          relevanceLabel: 'exclude',
          reviewed: false,
          studyDesign: null,
          technologyTags: [],
          topicIds: [],
        }),
      )
      expect(row.technologyTagStatus).toEqual({
        allowedValues: ['not_applicable', 'not_assessable'],
        currentValue: null,
        physicianFinalValue: null,
        proposedValue: null,
        sourceValue: '',
      })
      expect(row.diseaseTagStatus).toEqual(row.technologyTagStatus)
    })
    const { binding, ...content } = template
    expect(binding.contentSha256).toBe(sha256Canonical(content))
  })

  test('accepts a completed authorized supplement and derives nine revisions dynamically', () => {
    const fixture = buildFixture(2)
    const preliminary = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    if (!preliminary.supplementTemplate) throw new Error('Expected supplement template.')
    const supplement = completedSupplement(preliminary.supplementTemplate)
    const resolved = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      compatibilitySupplement: supplement,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    expect(resolved.readyForPackage).toBe(true)
    expect(resolved.acceptedSupplementSha256).toBe(supplement.binding.contentSha256)
    expect(resolved.actionCounts).toEqual({
      incompatible: 0,
      initial: 2,
      inserts: 11,
      noops: 0,
      revisions: 9,
      total: 11,
      unresolved: 0,
    })
    expect(resolved.planningRows.every((row) => row.targetReview !== null)).toBe(true)
    expect(resolved.existingHeads.map((row) => row.proposedAction)).toEqual(
      Array.from({ length: 9 }, () => 'import_revision'),
    )
    resolved.existingHeads
      .filter((row) => DECISION_KEYS.has(`${row.identity.masterRowId}:${row.identity.pmid}`))
      .forEach((row) => {
        expect(
          row.fields.filter(
            (field) => field.classification === 'physician_authorized_compatibility_decision',
          ),
        ).toHaveLength(2)
      })
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
    expect(result.actionCounts.incompatible).toBe(1)
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

describe('compatibility supplement validation', () => {
  function supplementFixture() {
    const fixture = buildFixture()
    const preliminary = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    if (!preliminary.supplementTemplate) throw new Error('Expected supplement template.')
    return {
      ...fixture,
      content: completedContent(preliminary.supplementTemplate),
      supplement: completedSupplement(preliminary.supplementTemplate),
      template: preliminary.supplementTemplate,
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

  test('rejects a stale supplement after database state or cohort drift', () => {
    const fixture = supplementFixture()
    expect(() =>
      resolveGoldImportCompensationCompatibility({
        bindingContext: {
          ...fixture.bindingContext,
          currentDatabase: {
            ...fixture.bindingContext.currentDatabase,
            physicalStateSha256: '1'.repeat(64),
          },
        },
        compatibilitySupplement: fixture.supplement,
        developmentPlanningState: fixture.planningState,
        finalizedArtifact: fixture.artifactBytes,
      }),
    ).toThrow('stale')

    const changedState = clonePlanningState(fixture.planningState)
    const first = changedState.rows[0]
    if (!first?.currentEffectiveReview) throw new Error('Fixture head missing.')
    first.currentEffectiveReview.notes = 'State drift after physician supplement generation.'
    expect(() =>
      resolveGoldImportCompensationCompatibility({
        bindingContext: {
          ...fixture.bindingContext,
          currentDatabase: {
            ...fixture.bindingContext.currentDatabase,
            developmentPlanningStateSha256: sha256Canonical(changedState),
          },
        },
        compatibilitySupplement: fixture.supplement,
        developmentPlanningState: changedState,
        finalizedArtifact: fixture.artifactBytes,
      }),
    ).toThrow('stale')
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
    const fixture = buildFixture(2)
    const preliminary = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    if (!preliminary.supplementTemplate) throw new Error('Expected supplement template.')
    const supplement = completedSupplement(preliminary.supplementTemplate)
    const resolution = resolveGoldImportCompensationCompatibility({
      bindingContext: fixture.bindingContext,
      compatibilitySupplement: supplement,
      developmentPlanningState: fixture.planningState,
      finalizedArtifact: fixture.artifactBytes,
    })
    const optionalTagStatusResolutions = resolution.artifact.rows
      .filter(
        (row) =>
          row.projection.technologyTagStatus === null || row.projection.diseaseTagStatus === null,
      )
      .map((row) => {
        const target = resolution.planningRows.find(
          (planningRow) => planningRow.identity.itemId === row.identity.itemId,
        )?.targetReview
        if (
          !target ||
          target.technologyTagStatus === 'tagged' ||
          target.diseaseTagStatus === 'tagged'
        ) {
          throw new Error('Expected exact completed optional statuses.')
        }
        return {
          diseaseTagStatus: target.diseaseTagStatus,
          itemId: row.identity.itemId,
          pmid: row.identity.pmid,
          technologyTagStatus: target.technologyTagStatus,
        }
      })
    const authorizationSet = {
      amendedTwoRowAuthorizationSha256: '1'.repeat(64),
      compatibility: {
        acceptedSupplementSha256: supplement.binding.contentSha256,
        actionCounts: resolution.actionCounts,
        booleanNormalizationLedger: resolution.artifact.booleanNormalizations,
        booleanNormalizationLedgerSha256: sha256Canonical(
          resolution.artifact.booleanNormalizations,
        ),
        existingHeadCohortSha256: resolution.existingHeadCohortSha256,
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
          initial: resolution.actionCounts.initial,
          inserts: resolution.actionCounts.inserts,
          noops: resolution.actionCounts.noops,
          revisions: resolution.actionCounts.revisions,
          total: resolution.actionCounts.total,
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
