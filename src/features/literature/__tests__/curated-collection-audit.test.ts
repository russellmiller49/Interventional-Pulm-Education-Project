import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  auditExternalResources,
  buildCuratedCollectionAuditReport,
  EXPERT_CURATED_IP_V1_COLLECTION_ID,
  explicitIdentifierFromExternalUrl,
  serializeCuratedCollectionExternalCsv,
  serializeCuratedCollectionJson,
  serializeCuratedCollectionPmidCsv,
  validateCuratedCollectionInputs,
  type CuratedCollectionDatabaseSnapshot,
  type CuratedCollectionInputs,
} from '@/features/literature/curated-collection/audit'
import { resolveCuratedCollectionAuditArtifactPaths } from '../../../../scripts/literature/audit-curated-collection'

const canonicalPmids = Array.from({ length: 281 }, (_, index) => String(index + 1))
const canonicalExternalResources = Array.from(
  { length: 7 },
  (_, index) => `https://example.test/resource-${index + 1}`,
)
const localDatabase = { databaseTarget: 'local' as const }

function inputFiles() {
  return {
    pmids: { path: 'local-data/pmids.txt', sha256: 'a'.repeat(64) },
    externalResources: { path: 'local-data/external.txt', sha256: 'b'.repeat(64) },
    sourceAudit: { path: 'local-data/audit.json', sha256: 'c'.repeat(64) },
  }
}

function sourceAudit() {
  return {
    collectionId: EXPERT_CURATED_IP_V1_COLLECTION_ID,
    counts: {
      uniquePmids: 281,
      uniqueExternalResources: 7,
      totalUniqueResources: 288,
    },
    uniquePmidsInFirstOccurrenceOrder: canonicalPmids,
    uniqueExternalResourcesInFirstOccurrenceOrder: canonicalExternalResources,
  }
}

function validatedInputs(): CuratedCollectionInputs {
  return validateCuratedCollectionInputs({
    pmidsText: `${canonicalPmids.join('\n')}\n`,
    externalResourcesText: `${canonicalExternalResources.join('\n')}\n`,
    sourceAudit: sourceAudit(),
    files: inputFiles(),
  })
}

function databaseSnapshot(): CuratedCollectionDatabaseSnapshot {
  return {
    articles: [
      {
        pmid: '3',
        doi: null,
        title: 'Locked test article',
        abstract: 'Available',
        journalId: null,
        journalTitle: 'Journal C',
        journalAbbreviation: 'J C',
        publicationYear: 2022,
        relevanceState: 'candidate',
        visibilityState: 'draft',
        isLandmark: false,
      },
      {
        pmid: '2',
        doi: '10.1234/two',
        title: 'Prior exclusion',
        abstract: null,
        journalId: 'journal-b',
        journalTitle: 'Journal B',
        journalAbbreviation: 'J B',
        publicationYear: 2020,
        relevanceState: 'excluded',
        visibilityState: 'hidden',
        isLandmark: true,
      },
      {
        pmid: '1',
        doi: '10.1234/one',
        title: '=Formula-like title',
        abstract: 'Abstract',
        journalId: 'journal-a',
        journalTitle: 'Journal A',
        journalAbbreviation: 'J A',
        publicationYear: 2021,
        relevanceState: 'unreviewed',
        visibilityState: 'draft',
        isLandmark: false,
      },
    ],
    exactIdentifierArticles: [
      { pmid: '2', doi: '10.1234/two' },
      { pmid: '1', doi: '10.1234/one' },
    ],
    sources: [
      {
        pmid: '1',
        batchId: 'import-b',
        sourceKind: 'core_journal',
        sourceId: 'core-b',
        queryId: null,
        sourceFilename: 'b.nbib',
        firstSeenAt: '2026-01-02T00:00:00.000Z',
      },
      {
        pmid: '1',
        batchId: 'import-a',
        sourceKind: 'all_pubmed_discovery',
        sourceId: null,
        queryId: 'query-a',
        sourceFilename: 'a.nbib',
        firstSeenAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    importBatches: [
      {
        id: 'import-b',
        sourceFilename: 'b.nbib',
        sourceFileSha256: 'e'.repeat(64),
        manifestVersion: 'manifest-v1',
        queryRegistryVersion: null,
        sourceKind: 'core_journal',
        sourceId: 'core-b',
        queryId: null,
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
        status: 'completed',
        recordsRead: 11,
        uniquePmids: 10,
        insertedCount: 8,
        updatedCount: 1,
        duplicateCount: 2,
        errorCount: 0,
        recordLimit: null,
        startedAt: '2026-01-02T00:00:00.000Z',
        completedAt: '2026-01-02T01:00:00.000Z',
        report: { warnings: [], source: 'fixture' },
        createdBy: 'literature-import',
      },
      {
        id: 'import-a',
        sourceFilename: 'a.nbib',
        sourceFileSha256: 'd'.repeat(64),
        manifestVersion: 'manifest-v1',
        queryRegistryVersion: 'queries-v1',
        sourceKind: 'all_pubmed_discovery',
        sourceId: null,
        queryId: 'query-a',
        dateFrom: null,
        dateTo: null,
        status: 'completed',
        recordsRead: 20,
        uniquePmids: 18,
        insertedCount: 15,
        updatedCount: 3,
        duplicateCount: 2,
        errorCount: 0,
        recordLimit: null,
        startedAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T01:00:00.000Z',
        report: { z: 2, a: 1 },
        createdBy: null,
      },
    ],
    topicAssignments: [
      {
        pmid: '1',
        topicId: 'topic-a',
        confidence: 0.9,
        assignmentSource: 'rule',
        assignmentState: 'suggested',
        modelOrRuleVersion: 'rule-v1',
        evidence: { z: 1, a: { z: 2, a: 1 } },
      },
    ],
    topicDefinitions: [{ id: 'topic-a', labelEn: 'Topic A' }],
    batches: [
      {
        id: 'gold-locked',
        name: 'gold-v1',
        kind: 'gold_standard',
        status: 'active',
        testUnlockedAt: null,
      },
      {
        id: 'pilot',
        name: 'pilot-v1',
        kind: 'pilot',
        status: 'frozen',
        testUnlockedAt: null,
      },
    ],
    batchItems: [
      {
        id: 'locked-item',
        batchId: 'gold-locked',
        pmid: '3',
        datasetSplit: 'test',
        reviewStatus: 'completed',
        currentReviewId: 'locked-secret-review',
      },
      {
        id: 'pilot-item',
        batchId: 'pilot',
        pmid: '2',
        datasetSplit: 'development',
        reviewStatus: 'completed',
        currentReviewId: 'pilot-review-2',
      },
    ],
    reviews: [
      {
        id: 'pilot-review-2',
        itemId: 'pilot-item',
        revision: 2,
        relevanceLabel: 'exclude',
        reviewerConfidence: 'high',
        isBlinded: false,
        completedAt: '2026-01-04T00:00:00.000Z',
      },
      {
        id: 'pilot-review-1',
        itemId: 'pilot-item',
        revision: 1,
        relevanceLabel: 'include_core',
        reviewerConfidence: 'moderate',
        isBlinded: true,
        completedAt: '2026-01-03T00:00:00.000Z',
      },
    ],
  }
}

describe('curated collection input validation', () => {
  it('accepts only the frozen 281-PMID and seven-resource collection contract', () => {
    const inputs = validatedInputs()

    expect(inputs.collectionId).toBe('expert-curated-ip-v1')
    expect(inputs.pmids).toHaveLength(281)
    expect(inputs.externalResources).toHaveLength(7)
  })

  it('fails closed on duplicate, malformed, count, and source-audit drift', () => {
    const base = {
      externalResourcesText: `${canonicalExternalResources.join('\n')}\n`,
      sourceAudit: sourceAudit(),
      files: inputFiles(),
    }

    expect(() =>
      validateCuratedCollectionInputs({
        ...base,
        pmidsText: `${canonicalPmids.slice(0, -1).join('\n')}\n1\n`,
      }),
    ).toThrow('duplicate entry')
    expect(() =>
      validateCuratedCollectionInputs({
        ...base,
        pmidsText: `${canonicalPmids.slice(0, -1).join('\n')}\nnot-a-pmid\n`,
      }),
    ).toThrow('only numeric PMID')
    expect(() =>
      validateCuratedCollectionInputs({
        ...base,
        pmidsText: `${canonicalPmids.slice(0, -1).join('\n')}\n`,
      }),
    ).toThrow('exactly 281')
    expect(() =>
      validateCuratedCollectionInputs({
        ...base,
        pmidsText: `${canonicalPmids.join('\n')}\n`,
        sourceAudit: {
          ...sourceAudit(),
          uniquePmidsInFirstOccurrenceOrder: [...canonicalPmids].reverse(),
        },
      }),
    ).toThrow('canonical input order')
  })
})

describe('curated collection audit report', () => {
  it('reports required overlap fields, current decisions, revision counts, and conflicts', () => {
    const report = buildCuratedCollectionAuditReport(
      validatedInputs(),
      databaseSnapshot(),
      localDatabase,
    )
    const imported = report.pmids.find((record) => record.pmid === '1')!
    const excluded = report.pmids.find((record) => record.pmid === '2')!
    const locked = report.pmids.find((record) => record.pmid === '3')!

    expect(report.summary).toMatchObject({
      requestedPmids: 281,
      presentInCorpus: 3,
      missingFromCorpus: 278,
      alreadyExcluded: 1,
      candidate: 1,
      unreviewed: 1,
      alreadyLandmark: 1,
      alreadyInPilotOrAnotherBatch: 2,
      missingAbstract: 1,
      conflictingExistingPhysicianDecision: 1,
      manualConflictQueue: 1,
      heldOutLabelsWithheld: 1,
    })
    expect(excluded.batchMemberships[0]).toMatchObject({
      labelAccess: 'accessible',
      revisionCount: 2,
      currentPhysicianDecision: { relevanceLabel: 'exclude', revision: 2 },
    })
    expect(excluded.conflict.reasons).toEqual([
      'general_curation_excluded',
      'physician_decision_excluded',
    ])
    expect(locked.batchMemberships[0]).toMatchObject({
      labelAccess: 'withheld_locked_test',
      currentPhysicianDecision: null,
      revisionCount: null,
    })
    expect(locked.conflict).toMatchObject({
      status: 'not_fully_assessable_locked_test',
      assessmentComplete: false,
      heldOutLabelWithheld: true,
    })
    expect(report.collectionSemantics.expertCuratedMembershipIsFinalRelevanceLabel).toBe(false)
    expect(report.database).toEqual({ target: 'local' })
    expect(imported.sourceProvenance[1]?.importBatch).toMatchObject({
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      recordsRead: 11,
      uniquePmids: 10,
      insertedCount: 8,
      updatedCount: 1,
      duplicateCount: 2,
      errorCount: 0,
      report: { source: 'fixture', warnings: [] },
      createdBy: 'literature-import',
    })
  })

  it('is byte-deterministic across unordered database snapshots and has no wall-clock field', () => {
    const firstSnapshot = databaseSnapshot()
    const secondSnapshot = databaseSnapshot()
    secondSnapshot.articles.reverse()
    secondSnapshot.sources.reverse()
    secondSnapshot.importBatches.reverse()
    secondSnapshot.batches.reverse()
    secondSnapshot.batchItems.reverse()
    secondSnapshot.reviews.reverse()

    const first = buildCuratedCollectionAuditReport(validatedInputs(), firstSnapshot, localDatabase)
    const second = buildCuratedCollectionAuditReport(
      validatedInputs(),
      secondSnapshot,
      localDatabase,
    )
    const firstJson = serializeCuratedCollectionJson(first)

    expect(serializeCuratedCollectionJson(second)).toBe(firstJson)
    expect(serializeCuratedCollectionPmidCsv(second)).toBe(serializeCuratedCollectionPmidCsv(first))
    expect(serializeCuratedCollectionExternalCsv(second)).toBe(
      serializeCuratedCollectionExternalCsv(first),
    )
    expect(firstJson).not.toContain('generatedAt')
    expect(firstJson).not.toContain('locked-secret-review')
    expect(serializeCuratedCollectionPmidCsv(first)).toContain("'=Formula-like title")
    expect(first.determinism.inputPathContract).toBe(
      'normalized_repo_relative_paths_are_part_of_report',
    )
  })

  it('rejects a locked gold-test review row instead of redacting it after loading', () => {
    const snapshot = databaseSnapshot()
    snapshot.reviews.push({
      id: 'locked-secret-review',
      itemId: 'locked-item',
      revision: 1,
      relevanceLabel: 'include_core',
      reviewerConfidence: 'high',
      isBlinded: true,
      completedAt: '2026-01-05T00:00:00.000Z',
    })

    expect(() =>
      buildCuratedCollectionAuditReport(validatedInputs(), snapshot, localDatabase),
    ).toThrow('Locked held-out test review rows must not be loaded')
  })
})

describe('curated collection audit output isolation', () => {
  it('accepts explicit local-data subdirectories and rejects escapes and input collisions', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'curated-audit-output-'))
    try {
      await mkdir(join(workspaceRoot, 'local-data'))
      const outputDirectory = join(workspaceRoot, 'local-data', 'literature', 'custom-audit')
      const artifacts = await resolveCuratedCollectionAuditArtifactPaths({
        workspaceRoot,
        outputDirectory,
        inputPaths: [join(workspaceRoot, 'input.txt')],
      })
      expect(artifacts.outputDirectory).toBe(outputDirectory)

      await expect(
        resolveCuratedCollectionAuditArtifactPaths({
          workspaceRoot,
          outputDirectory: join(workspaceRoot, 'reports'),
          inputPaths: [],
        }),
      ).rejects.toThrow('must remain under the repository local-data directory')
      await expect(
        resolveCuratedCollectionAuditArtifactPaths({
          workspaceRoot,
          outputDirectory,
          inputPaths: [artifacts.json],
        }),
      ).rejects.toThrow('collides with an input path')
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true })
    }
  })

  it('rejects symlinked output directories and output files', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'curated-audit-symlink-'))
    try {
      const localDataRoot = join(workspaceRoot, 'local-data')
      const outsideDirectory = join(workspaceRoot, 'outside')
      await Promise.all([mkdir(localDataRoot), mkdir(outsideDirectory)])
      await symlink(outsideDirectory, join(localDataRoot, 'linked'))
      await expect(
        resolveCuratedCollectionAuditArtifactPaths({
          workspaceRoot,
          outputDirectory: join(localDataRoot, 'linked', 'audit'),
          inputPaths: [],
        }),
      ).rejects.toThrow('must not traverse a symbolic link')

      const outputDirectory = join(localDataRoot, 'safe')
      await mkdir(outputDirectory)
      const target = join(outsideDirectory, 'target.json')
      await writeFile(target, '{}\n', 'utf8')
      await symlink(
        target,
        join(
          outputDirectory,
          `${EXPERT_CURATED_IP_V1_COLLECTION_ID}-curated-collection-audit.json`,
        ),
      )
      await expect(
        resolveCuratedCollectionAuditArtifactPaths({
          workspaceRoot,
          outputDirectory,
          inputPaths: [],
        }),
      ).rejects.toThrow('must not be a symbolic link')
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true })
    }
  })
})

describe('external-resource resolution', () => {
  it('uses only literal PMID or DOI evidence and an exact unique corpus match', () => {
    const resources = [
      'https://pubmed.ncbi.nlm.nih.gov/12345/',
      'https://doi.org/10.1234/ABC',
      'https://publisher.test/article/S0737-6146(14)00012-4/abstract',
    ]
    const audited = auditExternalResources(resources, [
      { pmid: '12345', doi: '10.9999/pubmed' },
      { pmid: '67890', doi: '10.1234/abc' },
    ])

    expect(audited[0]).toMatchObject({
      classification: 'resolved_pubmed_duplicate',
      resolvedPmid: '12345',
      exactIdentifier: { kind: 'pmid', value: '12345' },
    })
    expect(audited[1]).toMatchObject({
      classification: 'resolved_pubmed_duplicate',
      resolvedPmid: '67890',
      resolvedDoi: '10.1234/abc',
      exactIdentifier: { kind: 'doi', value: '10.1234/abc' },
    })
    expect(audited[2]).toMatchObject({
      classification: 'unresolved',
      exactIdentifier: null,
      resolutionEvidence: 'no_explicit_pmid_or_doi',
    })
  })

  it('does not resolve source-list adjacency and fails ambiguous exact DOI matches closed', () => {
    const url = 'https://doi.org/10.1234/duplicate'
    const audited = auditExternalResources(
      [url],
      [
        { pmid: '1', doi: '10.1234/duplicate' },
        { pmid: '2', doi: '10.1234/duplicate' },
      ],
    )

    expect(audited[0]).toMatchObject({
      classification: 'unresolved',
      resolvedPmid: null,
      resolutionEvidence: 'ambiguous_exact_identifier_match',
    })
    expect(explicitIdentifierFromExternalUrl('https://example.test/near/12345')).toBeNull()
  })
})
