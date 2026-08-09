import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { sha256Canonical } from '../../src/features/literature/gold-set/import-compensation'
import {
  BOOLEAN_NORMALIZATION_REPORT_SCHEMA_VERSION,
  COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION,
  COMPATIBILITY_PACKAGE_READINESS_SCHEMA_VERSION,
  EXISTING_HEAD_COMPATIBILITY_AUDIT_SCHEMA_VERSION,
  FORWARD_IMPORT_CONTRACT_REPAIR_REQUIRED_NOTE_AUTHORIZED,
  LIST_NORMALIZATION_REPORT_SCHEMA_VERSION,
  buildExistingHeadCompatibilityAudit,
  runAuditGoldExistingHeadCompatibility,
} from './audit-gold-existing-head-compatibility'
import type {
  VerifiedPostMigrationAuditPackage,
  verifyReadyPostMigrationAuditPackage,
} from './generate-gold-import-compensation-package-v1'
import {
  FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS,
  GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
  GOLD_IMPORT_EXISTING_HEAD_IDENTITIES,
  type CompatibilityDevelopmentPlanningState,
} from './gold-import-compensation-compatibility'
import { buildGoldImportNoteDispositionAuditForTest } from './gold-import-note-disposition'

const FIXED_TIME = '2026-08-08T00:00:00.000Z'
const temporaryDirectories: string[] = []
const EXCLUDED_EXISTING_PMIDS = new Set(['32250874', '16002921', '15133344', '28610675'])
const CONSERVATIVE_NOTES_MISMATCH_PMIDS = new Set(['36879724', '39281191'])

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

const NOTE_MAPPING_EXCEPTION =
  'The database review notes field uses the exact amended physician rationale rather than the earlier artifact physician_notes, as expressly authorized.'

function buildFixtureNoteDisposition(
  input: Parameters<typeof buildGoldImportNoteDispositionAuditForTest>[0],
) {
  const rationales = Object.fromEntries(input.rows.map((row) => [row.pmid, row.currentNote]))
  const amendedAuthorizationBytes = Buffer.from(
    JSON.stringify({
      authorization_status: 'authorized',
      finalized_v3_source_artifact: { sha256: input.finalV3ArtifactSha256 },
      physician_rationales: rationales,
      target: 'local',
      target_pmids: ['39281191', '36879724'],
      two_row_only_write_boundary: true,
    }),
    'utf8',
  )
  const authorizationMappingBytes = Buffer.from(
    JSON.stringify({
      mappings: [
        {
          authorization: 'exact physician rationale',
          database:
            'literature_gold_set_reviews.notes and event amendment_authorization.physician_rationale',
        },
      ],
      rationale_exception: NOTE_MAPPING_EXCEPTION,
    }),
    'utf8',
  )
  const amendedAuthorizationSha256 = sha256(amendedAuthorizationBytes)
  const authorizationMappingSha256 = sha256(authorizationMappingBytes)
  const authorizationMappingCorrectionBytes = Buffer.from(
    JSON.stringify({
      authoritative: true,
      original_mapping: { sha256: authorizationMappingSha256 },
      review_row_mappings_unchanged: true,
      status: 'authoritative_additive_path_correction',
    }),
    'utf8',
  )
  const authorizationMappingCorrectionSha256 = sha256(authorizationMappingCorrectionBytes)
  const authorizationMappingCorrectionManifestBytes = Buffer.from(
    `${authorizationMappingCorrectionSha256}  artifact-to-database-field-mapping-authoritative-v2.json\n`,
    'utf8',
  )
  const authorizationManifestBytes = Buffer.from(
    `${amendedAuthorizationSha256}  amended-authorization.json\n${authorizationMappingSha256}  artifact-to-database-field-mapping.json\n`,
    'utf8',
  )
  return buildGoldImportNoteDispositionAuditForTest(
    {
      ...input,
      amendedAuthorizationBytes,
      authorizationManifestBytes,
      authorizationMappingBytes,
      authorizationMappingCorrectionBytes,
      authorizationMappingCorrectionManifestBytes,
    },
    {
      amendedAuthorizationSha256,
      authorizationManifestSha256: sha256(authorizationManifestBytes),
      authorizationMappingSha256,
      authorizationMappingCorrectionManifestSha256: sha256(
        authorizationMappingCorrectionManifestBytes,
      ),
      authorizationMappingCorrectionSha256,
      finalV3ArtifactSha256: input.finalV3ArtifactSha256,
    },
  )
}

const TEST_NOTE_EVIDENCE_INPUT = {
  amendedAuthorizationBytes: Buffer.from('verified by test builder'),
  authorizationManifestBytes: Buffer.from('verified by test builder'),
  authorizationMappingBytes: Buffer.from('verified by test builder'),
  authorizationMappingCorrectionBytes: Buffer.from('verified by test builder'),
  authorizationMappingCorrectionManifestBytes: Buffer.from('verified by test builder'),
  noteDispositionBuilderForTest: buildFixtureNoteDisposition,
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
  fullTextUsed?: boolean
  included: boolean
  itemId: string
  masterRowId: string
  pmid: string
  provenance:
    | 'physician_confirmed_ai_enrichment'
    | 'physician_modified_ai_enrichment'
    | 'ai_generated_enrichment_qc_accepted'
}): ArtifactValues {
  return {
    categorization_from_full_text: 'false',
    clinical_purposes: input.included ? 'diagnosis' : '',
    dataset_split: 'development',
    disease_tag_status: input.included ? 'tagged' : '',
    disease_tags: input.included ? 'lung-cancer' : '',
    enrichment_provenance: input.provenance,
    enrichment_schema_version: '3.0.2',
    full_text_used: input.fullTextUsed ? 'true' : 'false',
    gold_set_item_id: input.itemId,
    is_blinded: 'False',
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
  const canonicalList = (value: string): string[] => (value ? value.split('|').sort() : [])
  return {
    categorizationFromFullText: false,
    clinicalPurposes: canonicalList(values.clinical_purposes),
    completedAt: FIXED_TIME,
    createdAt: FIXED_TIME,
    diseaseTagStatus: null,
    diseaseTags: canonicalList(values.disease_tags),
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
    technologyTags: canonicalList(values.technology_tags),
    topicIds: canonicalList(values.topic_ids),
    usedSupplementalMetadata: false,
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
  options: {
    withOneBlindingCompatibleRow?: boolean
    withOneRepresentableExcludedStatus?: boolean
    withUnsortedLists?: boolean
  } = {},
): {
  artifactBytes: Buffer
  auditPackage: VerifiedPostMigrationAuditPackage
  planningState: CompatibilityDevelopmentPlanningState
} {
  const artifactRows: ArtifactValues[] = []
  const planningRows: CompatibilityDevelopmentPlanningState['rows'] = []
  let unsortedListRowAdded = false
  GOLD_IMPORT_EXISTING_HEAD_IDENTITIES.forEach((identity, index) => {
    const itemId = fixtureUuid(0x11000000, index + 1)
    const reviewId = fixtureUuid(0x22000000, index + 1)
    const values = artifactValues({
      included: !EXCLUDED_EXISTING_PMIDS.has(identity.pmid),
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
    if (
      options.withUnsortedLists &&
      values.physician_final_label !== 'exclude' &&
      !unsortedListRowAdded
    ) {
      values.topic_ids = 'peripheral-navigation|basic-bronchoscopy'
      values.technology_tags = 'robotic-bronchoscopy|convex-ebus'
      values.clinical_purposes = 'staging|diagnosis'
      values.disease_tags = 'mesothelioma|lung-cancer'
      unsortedListRowAdded = true
    }
    const currentEffectiveReview = historicalReview(values)
    currentEffectiveReview.isBlinded = true
    if (CONSERVATIVE_NOTES_MISMATCH_PMIDS.has(identity.pmid)) {
      currentEffectiveReview.notes = `Current authorized rationale for PMID ${identity.pmid}.`
    }
    artifactRows.push(values)
    planningRows.push({
      currentEffectiveReview,
      currentReviewId: reviewId,
      currentRevision: 1,
      datasetSplit: 'development',
      displayOrder: index,
      effectiveReviewId: reviewId,
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
    const itemId = fixtureUuid(0x11000000, sequence)
    const values = artifactValues({
      fullTextUsed: included && index < 318,
      included,
      itemId,
      masterRowId: String(sequence),
      pmid: String(60_000_000 + sequence),
      provenance: 'physician_confirmed_ai_enrichment',
    })
    if (options.withOneRepresentableExcludedStatus && index === 0) {
      values.technology_tag_status = 'not_applicable'
      values.disease_tag_status = 'not_applicable'
    }
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
        automatedSignalsRevealedAt:
          options.withOneBlindingCompatibleRow && index === 0 ? FIXED_TIME : null,
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
  const manifestBytes = Buffer.from('fixture reconciled audit manifest\n', 'utf8')
  const audit = {
    schemaVersion: 'gold-import-compensation-reconciled-migration-audit/1.0.0',
    status: 'ready',
    readinessStatus: 'ready',
    result: 'audit_ready_contract_compatibility_audit_required',
    database: {
      batchId: fixtureUuid(0x33000000, 1),
      contractInvariantIdentitySha256: 'e'.repeat(64),
      currentEffectiveStateSha256: 'c'.repeat(64),
      currentPhysicalStateSha256: 'b'.repeat(64),
      currentPointersAreLatestHeads: true,
      developmentMembershipSha256: 'd'.repeat(64),
      developmentPlanningStateSha256: sha256Canonical(planningState),
      environmentProfileIdentitySha256: 'f'.repeat(64),
      repositoryCommitSha: 'a'.repeat(40),
      revisionChainsLinear: true,
    },
    migration: {
      applied: true,
      id: GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
      ledgerOccurrences: 1,
      sha256: 'a'.repeat(64),
    },
  } as unknown as VerifiedPostMigrationAuditPackage['audit']
  const auditPackage: VerifiedPostMigrationAuditPackage = {
    audit,
    auditBytes: Buffer.from('{}\n', 'utf8'),
    developmentPlanningState: planningState,
    developmentPlanningStateBytes: Buffer.from(`${JSON.stringify(planningState)}\n`, 'utf8'),
    expectedSchemaSecurityIdentitySha256: '1'.repeat(64),
    manifestBytes,
    manifestSha256: sha256(manifestBytes),
    markdownBytes: Buffer.from('# Reconciled fixture\n', 'utf8'),
    reconciledEvidence: null,
    schemaSecurityDefinitionIdentity: { records: [{}], schemaVersion: 'fixture' },
    schemaSecurityDefinitionIdentityBytes: Buffer.from('{}\n', 'utf8'),
  }
  return { artifactBytes, auditPackage, planningState }
}

function jsonFile<T>(
  generated: ReturnType<typeof buildExistingHeadCompatibilityAudit>,
  name: string,
): T {
  const bytes = generated.canonicalFiles.get(name)
  if (!bytes) throw new Error(`Missing generated file ${name}.`)
  return JSON.parse(bytes.toString('utf8')) as T
}

async function safeTemporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(await realpath(tmpdir()), prefix))
  temporaryDirectories.push(directory)
  return directory
}

async function writeDummyAuditBundle(directory: string): Promise<{
  auditPath: string
  developmentStatePath: string
}> {
  const auditPath = join(directory, 'migration-audit.json')
  const developmentStatePath = join(directory, 'development-planning-state.json')
  await Promise.all([
    writeFile(auditPath, '{}\n'),
    writeFile(developmentStatePath, '{}\n'),
    writeFile(join(directory, 'checksum-manifest.sha256'), 'fixture manifest\n'),
    writeFile(join(directory, 'contract-diagnostics.json'), '{}\n'),
    writeFile(join(directory, 'contract-reconciliation.json'), '{}\n'),
    writeFile(join(directory, 'migration-audit.md'), '# Fixture\n'),
    writeFile(join(directory, 'read-only-state-bracket.json'), '{}\n'),
    writeFile(join(directory, 'schema-security-definition-identity.json'), '{}\n'),
  ])
  return { auditPath, developmentStatePath }
}

describe('sealed existing-head compatibility artifacts', () => {
  test('remains contract-blocked with exact dynamic execution blocker ledgers', () => {
    const fixture = buildFixture()
    const before = Buffer.from(fixture.artifactBytes)
    const generated = buildExistingHeadCompatibilityAudit({
      ...TEST_NOTE_EVIDENCE_INPUT,
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    expect(fixture.artifactBytes).toEqual(before)
    expect(generated.packageReady).toBe(false)
    expect(generated.terminalState).toBe(FORWARD_IMPORT_CONTRACT_REPAIR_REQUIRED_NOTE_AUTHORIZED)
    expect(generated.unresolvedPmids).toEqual([])
    expect([...generated.canonicalFiles.keys()]).toEqual([
      'boolean-normalization-report.json',
      'existing-head-compatibility-audit.json',
      'field-lineage.json',
      'field-lineage.md',
      'forward-import-contract-repair-requirements.json',
      'list-normalization-report.json',
      'note-disposition-audit.json',
      'package-readiness.json',
    ])
    const audit = jsonFile<{
      actionCounts: Record<string, number>
      executionCompatibility: {
        blockedRowCount: number
        countsByCode: Record<string, number>
        executableRowCount: number
        totalRowCount: number
      }
      existingHeads: Array<{
        fields: Array<{ classification: string; field: string }>
        identity: { pmid: string }
      }>
      packageGenerationAllowed: boolean
      schemaVersion: string
      unresolved: { count: number; pmids: string[] }
    }>(generated, 'existing-head-compatibility-audit.json')
    expect(audit).toEqual(
      expect.objectContaining({
        packageGenerationAllowed: false,
        schemaVersion: EXISTING_HEAD_COMPATIBILITY_AUDIT_SCHEMA_VERSION,
        unresolved: { count: 0, pmids: [] },
        actionCounts: {
          incompatible: 630,
          initial: 0,
          inserts: 0,
          noops: 0,
          revisions: 0,
          total: 630,
          unresolved: 0,
        },
        executionCompatibility: expect.objectContaining({
          blockedRowCount: 630,
          countsByCode: {
            excluded_status_null_not_representable_by_import_contract_v1: 272,
            source_full_text_provenance_has_no_exact_import_v1_mapping: 50,
            source_review_blinding_provenance_has_no_exact_import_v1_mapping: 630,
          },
          executableRowCount: 0,
          totalRowCount: 630,
        }),
        noteDisposition: expect.objectContaining({ status: 'already_authorized' }),
      }),
    )
    const readiness = jsonFile<{
      blockers: string[]
      packageGenerationAllowed: boolean
      schemaVersion: string
      unresolved: { count: number; pmids: string[] }
    }>(generated, 'package-readiness.json')
    expect(readiness).toEqual(
      expect.objectContaining({
        blockers: [
          'excluded_status_null_not_representable_by_import_contract_v1',
          'source_review_blinding_provenance_has_no_exact_import_v1_mapping',
          'source_full_text_provenance_has_no_exact_import_v1_mapping',
        ],
        packageGenerationAllowed: false,
        schemaVersion: COMPATIBILITY_PACKAGE_READINESS_SCHEMA_VERSION,
        unresolved: { count: 0, pmids: [] },
      }),
    )
    expect(
      audit.existingHeads
        .filter((row) =>
          row.fields.some(
            (field) =>
              field.field === 'notes' &&
              field.classification === 'existing_physician_note_preserved_by_amended_authorization',
          ),
        )
        .map((row) => row.identity.pmid),
    ).toEqual(['36879724', '39281191'])
  })

  test('seals normalizations, lineage, forward repair, and exact note disposition', () => {
    const fixture = buildFixture()
    const generated = buildExistingHeadCompatibilityAudit({
      ...TEST_NOTE_EVIDENCE_INPUT,
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    const report = jsonFile<{
      existingHeadLegacyFalseCount: number
      existingHeadLegacyFalseNormalizations: Array<{
        canonicalLexeme: string
        originalLexeme: string
        semanticValue: boolean
      }>
      normalizationCount: number
      schemaVersion: string
      sourceArtifactBytesPreserved: boolean
    }>(generated, 'boolean-normalization-report.json')
    expect(report).toEqual(
      expect.objectContaining({
        existingHeadLegacyFalseCount: 9,
        normalizationCount: 1890,
        schemaVersion: BOOLEAN_NORMALIZATION_REPORT_SCHEMA_VERSION,
        sourceArtifactBytesPreserved: true,
      }),
    )
    expect(report.existingHeadLegacyFalseNormalizations).toHaveLength(9)
    report.existingHeadLegacyFalseNormalizations.forEach((entry) => {
      expect(entry).toEqual(
        expect.objectContaining({
          canonicalLexeme: 'false',
          originalLexeme: 'False',
          semanticValue: false,
        }),
      )
    })
    expect(
      jsonFile<{
        normalizationCount: number
        normalizationLedgerSha256: string
        schemaVersion: string
        sourceArtifactBytesPreserved: boolean
      }>(generated, 'list-normalization-report.json'),
    ).toEqual(
      expect.objectContaining({
        normalizationCount: 0,
        normalizationLedgerSha256: sha256Canonical([]),
        schemaVersion: LIST_NORMALIZATION_REPORT_SCHEMA_VERSION,
        sourceArtifactBytesPreserved: true,
      }),
    )
    expect(
      jsonFile<{ scope: { fieldCount: number } }>(generated, 'field-lineage.json').scope.fieldCount,
    ).toBe(13)
    expect(
      jsonFile<{ noteDisposition: { status: string } }>(generated, 'package-readiness.json')
        .noteDisposition.status,
    ).toBe('already_authorized')
    expect(
      jsonFile<{ requirements: unknown[] }>(
        generated,
        'forward-import-contract-repair-requirements.json',
      ).requirements,
    ).toHaveLength(15)
    expect(
      jsonFile<{ rows: unknown[]; status: string }>(generated, 'note-disposition-audit.json'),
    ).toEqual(expect.objectContaining({ rows: expect.any(Array), status: 'already_authorized' }))
  })

  test('rejects drift from the authenticated 630-row review-blinding blocker count', () => {
    const fixture = buildFixture({ withOneBlindingCompatibleRow: true })
    expect(() =>
      buildExistingHeadCompatibilityAudit({
        ...TEST_NOTE_EVIDENCE_INPUT,
        artifactBytes: fixture.artifactBytes,
        auditPackage: fixture.auditPackage,
        expectedArtifactSha256: sha256(fixture.artifactBytes),
      }),
    ).toThrow('does not match the authenticated production result')
  })

  test('rejects drift from the authenticated excluded-status blocker count', () => {
    const fixture = buildFixture({ withOneRepresentableExcludedStatus: true })
    expect(() =>
      buildExistingHeadCompatibilityAudit({
        ...TEST_NOTE_EVIDENCE_INPUT,
        artifactBytes: fixture.artifactBytes,
        auditPackage: fixture.auditPackage,
        expectedArtifactSha256: sha256(fixture.artifactBytes),
      }),
    ).toThrow('does not match the authenticated production result')
  })

  test('cross-binds a nonempty per-column list normalization ledger across audit reports', () => {
    const fixture = buildFixture({ withUnsortedLists: true })
    const generated = buildExistingHeadCompatibilityAudit({
      ...TEST_NOTE_EVIDENCE_INPUT,
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    const report = jsonFile<{
      normalizationCount: number
      normalizationCountsByColumn: Record<string, number>
      normalizationLedgerSha256: string
      normalizations: Array<{ column: string }>
    }>(generated, 'list-normalization-report.json')
    expect(report.normalizationCount).toBe(4)
    expect(report.normalizationCountsByColumn).toEqual({
      clinical_purposes: 1,
      disease_tags: 1,
      technology_tags: 1,
      topic_ids: 1,
    })
    expect(report.normalizations.map(({ column }) => column)).toEqual([
      'topic_ids',
      'technology_tags',
      'clinical_purposes',
      'disease_tags',
    ])
    expect(report.normalizationLedgerSha256).toBe(sha256Canonical(report.normalizations))
    const audit = jsonFile<{
      sourceBindings: { listNormalizationLedgerSha256: string }
    }>(generated, 'existing-head-compatibility-audit.json')
    const readiness = jsonFile<{ listNormalizationLedgerSha256: string }>(
      generated,
      'package-readiness.json',
    )
    expect(audit.sourceBindings.listNormalizationLedgerSha256).toBe(
      report.normalizationLedgerSha256,
    )
    expect(readiness.listNormalizationLedgerSha256).toBe(report.normalizationLedgerSha256)
  })

  test('produces a strictly sorted manifest that authenticates every canonical file', () => {
    const fixture = buildFixture()
    const generated = buildExistingHeadCompatibilityAudit({
      ...TEST_NOTE_EVIDENCE_INPUT,
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    const lines = generated.canonicalManifest.toString('utf8').trimEnd().split('\n')
    const names = lines.map((line) => line.slice(66))
    expect(names).toEqual([...names].sort())
    expect(generated.canonicalManifestSha256).toBe(sha256(generated.canonicalManifest))
    lines.forEach((line) => {
      const match = /^([a-f0-9]{64})  ([a-z0-9-]+\.(?:json|md))$/u.exec(line)
      expect(match).not.toBeNull()
      if (!match) return
      expect(sha256(generated.canonicalFiles.get(match[2]) as Buffer)).toBe(match[1])
    })
  })

  test('rejects a legacy audit and wrong artifact hash', () => {
    const fixture = buildFixture()
    expect(() =>
      buildExistingHeadCompatibilityAudit({
        ...TEST_NOTE_EVIDENCE_INPUT,
        artifactBytes: fixture.artifactBytes,
        auditPackage: {
          ...fixture.auditPackage,
          audit: {
            ...fixture.auditPackage.audit,
            schemaVersion: 'gold-import-compensation-migration-audit/1.0.0',
          } as VerifiedPostMigrationAuditPackage['audit'],
        },
        expectedArtifactSha256: sha256(fixture.artifactBytes),
      }),
    ).toThrow('ready reconciled')
    expect(() =>
      buildExistingHeadCompatibilityAudit({
        ...TEST_NOTE_EVIDENCE_INPUT,
        artifactBytes: fixture.artifactBytes,
        auditPackage: fixture.auditPackage,
        expectedArtifactSha256: '0'.repeat(64),
      }),
    ).toThrow('approved raw SHA-256')
  })
})

describe('file-only compatibility audit CLI', () => {
  const repositoryHead = 'a'.repeat(40)
  const repositoryGuardDependencies = {
    inspectRepositoryState: async () => ({
      branch: 'codex/ip-literature-post-migration-contract-reconciliation-v1' as const,
      commonDir: '/fixture/repository/.git',
      gitDir: '/fixture/repository/.git/worktrees/codex-b',
      head: repositoryHead,
      mergeBaseWithOriginMain: 'b'.repeat(40),
      originMain: 'b'.repeat(40),
      trackedStatus: '',
    }),
  }

  test('verifies the audit bundle, writes sealed reports and receipt, and performs no DB work', async () => {
    const fixture = buildFixture()
    const temporary = await safeTemporaryDirectory('gold-head-compat-cli-')
    const auditDirectory = join(temporary, 'audit')
    const outputRoot = join(temporary, 'output-root')
    const outputDirectory = join(outputRoot, 'compatibility-audit')
    await Promise.all([mkdir(auditDirectory), mkdir(outputRoot)])
    const { auditPath, developmentStatePath } = await writeDummyAuditBundle(auditDirectory)
    const artifactPath = join(temporary, 'finalized.csv')
    const amendedAuthorizationPath = join(temporary, 'amended-authorization.json')
    const authorizationManifestPath = join(temporary, 'authorization-artifact-manifest.sha256')
    const authorizationMappingPath = join(temporary, 'artifact-to-database-field-mapping.json')
    const authorizationMappingCorrectionPath = join(
      temporary,
      'artifact-to-database-field-mapping-authoritative-v2.json',
    )
    const authorizationMappingCorrectionManifestPath = join(
      temporary,
      'authorization-mapping-supplement-manifest.sha256',
    )
    await Promise.all([
      writeFile(artifactPath, fixture.artifactBytes),
      writeFile(amendedAuthorizationPath, 'verified by injected test builder'),
      writeFile(authorizationManifestPath, 'verified by injected test builder'),
      writeFile(authorizationMappingPath, 'verified by injected test builder'),
      writeFile(authorizationMappingCorrectionPath, 'verified by injected test builder'),
      writeFile(authorizationMappingCorrectionManifestPath, 'verified by injected test builder'),
    ])
    const before = await readFile(artifactPath)
    const verifyReadyAuditPackage = jest.fn(
      () => fixture.auditPackage,
    ) as unknown as typeof verifyReadyPostMigrationAuditPackage
    const result = await runAuditGoldExistingHeadCompatibility(
      [
        '--audit',
        auditPath,
        '--audit-manifest-sha256',
        '9'.repeat(64),
        '--development-state',
        developmentStatePath,
        '--artifact',
        artifactPath,
        '--amended-authorization',
        amendedAuthorizationPath,
        '--authorization-manifest',
        authorizationManifestPath,
        '--authorization-mapping',
        authorizationMappingPath,
        '--authorization-mapping-correction',
        authorizationMappingCorrectionPath,
        '--authorization-mapping-correction-manifest',
        authorizationMappingCorrectionManifestPath,
        '--output-root',
        outputRoot,
        '--output',
        outputDirectory,
      ],
      {
        expectedArtifactSha256ForTest: sha256(fixture.artifactBytes),
        ...repositoryGuardDependencies,
        buildNoteDispositionAudit: buildFixtureNoteDisposition,
        now: () => new Date('2026-08-09T13:00:00.000Z'),
        verifyReadyAuditPackage,
      },
    )
    if ('help' in result) throw new Error('Unexpected help result.')
    expect(verifyReadyAuditPackage).toHaveBeenCalledTimes(1)
    expect(result.packageReady).toBe(false)
    expect(result.terminalState).toBe(FORWARD_IMPORT_CONTRACT_REPAIR_REQUIRED_NOTE_AUTHORIZED)
    expect(result.unresolvedPmids).toEqual([])
    expect(await readFile(artifactPath)).toEqual(before)
    expect(await readdir(outputDirectory)).toEqual(
      expect.arrayContaining([
        'boolean-normalization-report.json',
        'checksum-manifest.sha256',
        'execution-receipt.json',
        'existing-head-compatibility-audit.json',
        'field-lineage.json',
        'field-lineage.md',
        'forward-import-contract-repair-requirements.json',
        'list-normalization-report.json',
        'note-disposition-audit.json',
        'package-readiness.json',
      ]),
    )
    const receipt = JSON.parse(
      await readFile(join(outputDirectory, 'execution-receipt.json'), 'utf8'),
    ) as {
      canonicalManifestSha256: string
      repositoryCommitSha: string
      schemaVersion: string
      safety: Record<string, unknown>
      sources: { postMigrationAuditManifestSha256: string }
    }
    expect(receipt).toEqual(
      expect.objectContaining({
        canonicalManifestSha256: result.manifestSha256,
        repositoryCommitSha: repositoryHead,
        schemaVersion: COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION,
        safety: {
          compensationExecuted: false,
          databaseMutationCount: 0,
          databaseQueriesExecuted: 0,
          heldOutIdentitiesAccessed: false,
          importExecuted: false,
          remoteDatabaseAccessed: false,
          sourceArtifactBytesPreserved: true,
          sourceArtifactWritten: false,
        },
      }),
    )
    expect(receipt.sources.postMigrationAuditManifestSha256).toBe(
      fixture.auditPackage.manifestSha256,
    )
  })

  test('does not open the artifact or create output when reconciled audit verification fails', async () => {
    const temporary = await safeTemporaryDirectory('gold-head-compat-gate-')
    const auditDirectory = join(temporary, 'audit')
    const outputRoot = join(temporary, 'output-root')
    const outputDirectory = join(outputRoot, 'compatibility-audit')
    await Promise.all([mkdir(auditDirectory), mkdir(outputRoot)])
    const { auditPath, developmentStatePath } = await writeDummyAuditBundle(auditDirectory)
    await expect(
      runAuditGoldExistingHeadCompatibility(
        [
          '--audit',
          auditPath,
          '--audit-manifest-sha256',
          '9'.repeat(64),
          '--development-state',
          developmentStatePath,
          '--artifact',
          join(temporary, 'artifact-must-not-be-opened.csv'),
          '--output-root',
          outputRoot,
          '--output',
          outputDirectory,
        ],
        {
          ...repositoryGuardDependencies,
          verifyReadyAuditPackage: (() => {
            throw new Error('reconciled audit rejected before artifact access')
          }) as typeof verifyReadyPostMigrationAuditPackage,
        },
      ),
    ).rejects.toThrow('reconciled audit rejected before artifact access')
    await expect(readFile(join(temporary, 'artifact-must-not-be-opened.csv'))).rejects.toThrow()
    await expect(readdir(outputDirectory)).rejects.toThrow()
  })

  test('contains no database client, Docker, or Supabase path', async () => {
    const source = await readFile(
      join(process.cwd(), 'scripts/literature/audit-gold-existing-head-compatibility.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/node:child_process|@supabase|createClient\(|docker|psql/u)
  })

  test('rejects any requested commit or database-write mode', async () => {
    await expect(runAuditGoldExistingHeadCompatibility(['--commit'])).rejects.toThrow(
      'no commit or database-write mode',
    )
    await expect(
      runAuditGoldExistingHeadCompatibility([
        '--compatibility-supplement',
        '/tmp/retired-status-supplement.json',
      ]),
    ).rejects.toThrow('Unknown option(s): --compatibility-supplement')
  })
})
