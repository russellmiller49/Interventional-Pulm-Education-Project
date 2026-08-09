import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { sha256Canonical } from '../../src/features/literature/gold-set/import-compensation'
import {
  BOOLEAN_NORMALIZATION_REPORT_SCHEMA_VERSION,
  COMPATIBILITY_AUDIT_EXECUTION_SCHEMA_VERSION,
  COMPATIBILITY_AUDIT_READY_SUPPLEMENT_NOT_REQUIRED,
  COMPATIBILITY_AUDIT_READY_SUPPLEMENT_REQUIRED,
  COMPATIBILITY_PACKAGE_READINESS_SCHEMA_VERSION,
  EXISTING_HEAD_COMPATIBILITY_AUDIT_SCHEMA_VERSION,
  EXPECTED_UNRESOLVED_COMPATIBILITY_PMIDS,
  buildExistingHeadCompatibilityAudit,
  runAuditGoldExistingHeadCompatibility,
} from './audit-gold-existing-head-compatibility'
import type {
  VerifiedPostMigrationAuditPackage,
  verifyReadyPostMigrationAuditPackage,
} from './generate-gold-import-compensation-package-v1'
import {
  FINALIZED_GOLD_IMPORT_ARTIFACT_COLUMNS,
  GOLD_IMPORT_COMPATIBILITY_SUPPLEMENT_SCHEMA_VERSION,
  GOLD_IMPORT_COMPENSATION_MIGRATION_ID,
  GOLD_IMPORT_EXISTING_HEAD_IDENTITIES,
  GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES,
  bindCompletedCompatibilitySupplement,
  type BoundCompatibilitySupplementTemplate,
  type CompatibilityDevelopmentPlanningState,
  type CompatibilitySupplementCompletedContent,
} from './gold-import-compensation-compatibility'

const FIXED_TIME = '2026-08-08T00:00:00.000Z'
const temporaryDirectories: string[] = []
const DECISION_KEYS = new Set(
  GOLD_IMPORT_PHYSICIAN_DECISION_IDENTITIES.map(
    ({ masterRowId, pmid }) => `${masterRowId}:${pmid}`,
  ),
)

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
  provenance:
    | 'physician_confirmed_ai_enrichment'
    | 'physician_modified_ai_enrichment'
    | 'ai_generated_enrichment_qc_accepted'
}): ArtifactValues {
  const decisionRequired = DECISION_KEYS.has(`${input.masterRowId}:${input.pmid}`)
  return {
    categorization_from_full_text: 'false',
    clinical_purposes: input.included ? 'diagnosis' : '',
    dataset_split: 'development',
    disease_tag_status: input.included ? 'tagged' : decisionRequired ? '' : 'not_applicable',
    disease_tags: input.included ? 'lung-cancer' : '',
    enrichment_provenance: input.provenance,
    enrichment_schema_version: '3.0.2',
    full_text_used: 'false',
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

function buildFixture(): {
  artifactBytes: Buffer
  auditPackage: VerifiedPostMigrationAuditPackage
  planningState: CompatibilityDevelopmentPlanningState
} {
  const artifactRows: ArtifactValues[] = []
  const planningRows: CompatibilityDevelopmentPlanningState['rows'] = []
  GOLD_IMPORT_EXISTING_HEAD_IDENTITIES.forEach((identity, index) => {
    const itemId = fixtureUuid(0x11000000, index + 1)
    const reviewId = fixtureUuid(0x22000000, index + 1)
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
      currentReviewId: reviewId,
      currentRevision: 1,
      datasetSplit: 'development',
      displayOrder: index,
      effectiveReviewId: reviewId,
      itemId,
      itemState: {
        automatedSignalsRevealedAt: FIXED_TIME,
        completedAt: FIXED_TIME,
        reviewStatus: 'completed',
        startedAt: FIXED_TIME,
        supplementalMetadataRevealedAt: null,
      },
      pmid: identity.pmid,
      sequence: index + 1,
    })
  })
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
      developmentMembershipSha256: 'd'.repeat(64),
      developmentPlanningStateSha256: sha256Canonical(planningState),
      environmentProfileIdentitySha256: 'f'.repeat(64),
      repositoryCommitSha: 'a'.repeat(40),
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

function completedContent(
  template: BoundCompatibilitySupplementTemplate,
): CompatibilitySupplementCompletedContent {
  return {
    allowedMutableFields: ['technologyTagStatus', 'diseaseTagStatus'],
    authorization: {
      authorizationId: fixtureUuid(0x44000000, 1),
      authorizationKind: 'physician_compatibility_decision',
      authorizationNote: 'Physician reviewed the two optional statuses on all four rows.',
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
      categorizationFromFullText: false,
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
      physicianRationale: `Reviewed available evidence for PMID ${row.pmid}.`,
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

function completedSupplementBytes(template: BoundCompatibilitySupplementTemplate): Buffer {
  return Buffer.from(
    `${JSON.stringify(bindCompletedCompatibilitySupplement(completedContent(template)), null, 2)}\n`,
    'utf8',
  )
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
  test('blocks package readiness and reports exactly the four unresolved PMIDs', () => {
    const fixture = buildFixture()
    const before = Buffer.from(fixture.artifactBytes)
    const generated = buildExistingHeadCompatibilityAudit({
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    expect(fixture.artifactBytes).toEqual(before)
    expect(generated.packageReady).toBe(false)
    expect(generated.terminalState).toBe(COMPATIBILITY_AUDIT_READY_SUPPLEMENT_REQUIRED)
    expect(generated.unresolvedPmids).toEqual(EXPECTED_UNRESOLVED_COMPATIBILITY_PMIDS)
    expect([...generated.canonicalFiles.keys()]).toEqual([
      'boolean-normalization-report.json',
      'compatibility-supplement-template.json',
      'existing-head-compatibility-audit.json',
      'package-readiness.json',
    ])
    const audit = jsonFile<{
      packageGenerationAllowed: boolean
      schemaVersion: string
      unresolved: { count: number; pmids: string[] }
    }>(generated, 'existing-head-compatibility-audit.json')
    expect(audit).toEqual(
      expect.objectContaining({
        packageGenerationAllowed: false,
        schemaVersion: EXISTING_HEAD_COMPATIBILITY_AUDIT_SCHEMA_VERSION,
        unresolved: {
          count: 4,
          pmids: EXPECTED_UNRESOLVED_COMPATIBILITY_PMIDS,
        },
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
          'physician_compatibility_supplement_required',
          'unresolved_physician_compatibility_decisions',
        ],
        packageGenerationAllowed: false,
        schemaVersion: COMPATIBILITY_PACKAGE_READINESS_SCHEMA_VERSION,
        unresolved: {
          count: 4,
          pmids: EXPECTED_UNRESOLVED_COMPATIBILITY_PMIDS,
        },
      }),
    )
  })

  test('seals all boolean normalizations and an unselected exact supplement template', () => {
    const fixture = buildFixture()
    const generated = buildExistingHeadCompatibilityAudit({
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
        normalizationCount: 27,
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
    const template = jsonFile<BoundCompatibilitySupplementTemplate>(
      generated,
      'compatibility-supplement-template.json',
    )
    expect(template.authorization).toBeNull()
    expect(template.rows).toHaveLength(4)
    expect(template.rows.map(({ pmid }) => pmid)).toEqual(EXPECTED_UNRESOLVED_COMPATIBILITY_PMIDS)
    template.rows.forEach((row) => {
      expect(row.technologyTagStatus.physicianFinalValue).toBeNull()
      expect(row.diseaseTagStatus.physicianFinalValue).toBeNull()
      expect(row.physicianRationale).toBe('')
      expect(row.reviewed).toBe(false)
    })
  })

  test('accepts the authorized supplement, clears blockers, and seals the accepted content', () => {
    const fixture = buildFixture()
    const pending = buildExistingHeadCompatibilityAudit({
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    const template = jsonFile<BoundCompatibilitySupplementTemplate>(
      pending,
      'compatibility-supplement-template.json',
    )
    const supplementBytes = completedSupplementBytes(template)
    const ready = buildExistingHeadCompatibilityAudit({
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      compatibilitySupplementBytes: supplementBytes,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    expect(ready.packageReady).toBe(true)
    expect(ready.terminalState).toBe(COMPATIBILITY_AUDIT_READY_SUPPLEMENT_NOT_REQUIRED)
    expect(ready.unresolvedPmids).toEqual([])
    expect(ready.canonicalFiles.has('accepted-compatibility-supplement.json')).toBe(true)
    expect(ready.sourceSupplementSha256).toBe(sha256(supplementBytes))
    const readiness = jsonFile<{
      blockers: string[]
      packageGenerationAllowed: boolean
      unresolved: { count: number; pmids: string[] }
    }>(ready, 'package-readiness.json')
    expect(readiness).toEqual(
      expect.objectContaining({
        blockers: [],
        packageGenerationAllowed: true,
        unresolved: { count: 0, pmids: [] },
      }),
    )
  })

  test('produces a strictly sorted manifest that authenticates every canonical file', () => {
    const fixture = buildFixture()
    const generated = buildExistingHeadCompatibilityAudit({
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    const lines = generated.canonicalManifest.toString('utf8').trimEnd().split('\n')
    const names = lines.map((line) => line.slice(66))
    expect(names).toEqual([...names].sort())
    expect(generated.canonicalManifestSha256).toBe(sha256(generated.canonicalManifest))
    lines.forEach((line) => {
      const match = /^([a-f0-9]{64})  ([a-z0-9-]+\.json)$/u.exec(line)
      expect(match).not.toBeNull()
      if (!match) return
      expect(sha256(generated.canonicalFiles.get(match[2]) as Buffer)).toBe(match[1])
    })
  })

  test('rejects a legacy audit, wrong artifact hash, and stale supplement', () => {
    const fixture = buildFixture()
    expect(() =>
      buildExistingHeadCompatibilityAudit({
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
        artifactBytes: fixture.artifactBytes,
        auditPackage: fixture.auditPackage,
        expectedArtifactSha256: '0'.repeat(64),
      }),
    ).toThrow('approved raw SHA-256')

    const pending = buildExistingHeadCompatibilityAudit({
      artifactBytes: fixture.artifactBytes,
      auditPackage: fixture.auditPackage,
      expectedArtifactSha256: sha256(fixture.artifactBytes),
    })
    const supplementBytes = completedSupplementBytes(
      jsonFile<BoundCompatibilitySupplementTemplate>(
        pending,
        'compatibility-supplement-template.json',
      ),
    )
    const staleAuditPackage = {
      ...fixture.auditPackage,
      audit: {
        ...fixture.auditPackage.audit,
        database: {
          ...fixture.auditPackage.audit.database,
          currentPhysicalStateSha256: '1'.repeat(64),
        },
      } as VerifiedPostMigrationAuditPackage['audit'],
    }
    expect(() =>
      buildExistingHeadCompatibilityAudit({
        artifactBytes: fixture.artifactBytes,
        auditPackage: staleAuditPackage,
        compatibilitySupplementBytes: supplementBytes,
        expectedArtifactSha256: sha256(fixture.artifactBytes),
      }),
    ).toThrow('stale')
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
    await writeFile(artifactPath, fixture.artifactBytes)
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
        '--output-root',
        outputRoot,
        '--output',
        outputDirectory,
      ],
      {
        expectedArtifactSha256ForTest: sha256(fixture.artifactBytes),
        ...repositoryGuardDependencies,
        now: () => new Date('2026-08-09T13:00:00.000Z'),
        verifyReadyAuditPackage,
      },
    )
    if ('help' in result) throw new Error('Unexpected help result.')
    expect(verifyReadyAuditPackage).toHaveBeenCalledTimes(1)
    expect(result.packageReady).toBe(false)
    expect(result.terminalState).toBe(COMPATIBILITY_AUDIT_READY_SUPPLEMENT_REQUIRED)
    expect(result.unresolvedPmids).toEqual(EXPECTED_UNRESOLVED_COMPATIBILITY_PMIDS)
    expect(await readFile(artifactPath)).toEqual(before)
    expect(await readdir(outputDirectory)).toEqual(
      expect.arrayContaining([
        'boolean-normalization-report.json',
        'checksum-manifest.sha256',
        'compatibility-supplement-template.json',
        'execution-receipt.json',
        'existing-head-compatibility-audit.json',
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
  })
})
