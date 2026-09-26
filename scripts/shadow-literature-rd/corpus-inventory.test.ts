import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  SHADOW_RD_CORPUS_INVENTORY_SQL,
  assertShadowRdCorpusInventorySqlBoundary,
  parseShadowRdCorpusInventoryQueryOutput,
  renderShadowRdCorpusInventoryMarkdown,
  serializeShadowRdCorpusInventoryJson,
  shadowRdCorpusInventoryArtifactSchema,
  shadowRdCorpusInventoryQueryPayloadSchema,
  type ShadowRdCorpusInventoryQueryPayload,
} from './corpus-inventory-contract'
import {
  SHADOW_RD_CORPUS_INVENTORY_OUTPUT_ROOT,
  SHADOW_RD_CORPUS_INVENTORY_USAGE,
  validateShadowRdCorpusInventoryCliArguments,
} from './collect-corpus-inventory'

function queryPayload(): ShadowRdCorpusInventoryQueryPayload {
  return {
    capturedAt: '2026-08-11T12:34:56.789Z',
    developmentCohort: {
      assertedCount: 630,
      batchId: 'fff41ba3-811d-4d28-ba73-9302db3a942a',
      batchName: 'gold-set-v1',
      crossTabs: {
        articleRelevanceState: {
          minimumCellSize: 5,
          suppressed: { cellCount: 1, recordCount: 4 },
          visible: [
            { count: 400, value: 'included' },
            { count: 226, value: 'candidate' },
          ],
        },
        publicationYear: {
          minimumCellSize: 5,
          suppressed: { cellCount: 2, recordCount: 6 },
          visible: [
            { count: 300, value: '2025' },
            { count: 324, value: '2026' },
          ],
        },
      },
      datasetSplit: 'development',
      expectedCount: 630,
      generalCorpusOverlapCount: 630,
      membershipSha256: '73367b254e7116db166dcd88372457d9ae1a9061aa58038c9900fbe21a17b46c',
      observedCount: 630,
      physicianReviewedCurrentEffectiveCount: 628,
    },
    generalCorpus: {
      completeness: {
        abstract: { completeCount: 900, completionPercent: 90, missingCount: 100 },
        authorKeywords: { completeCount: 600, completionPercent: 60, missingCount: 400 },
        languages: { completeCount: 980, completionPercent: 98, missingCount: 20 },
        meshTerms: { completeCount: 800, completionPercent: 80, missingCount: 200 },
        title: { completeCount: 1_000, completionPercent: 100, missingCount: 0 },
      },
      conferenceAbstractCount: 25,
      correctionCount: 4,
      duplicateAndCollisionIndicators: {
        articlesInDuplicateNormalizedTitleGroups: 12,
        doiCollisionGroupCount: 1,
        metadataHashCollisionGroupCount: 2,
        normalizedTitleDuplicateGroupCount: 5,
        normalizedTitleHashCollisionGroupCount: 0,
        pmidCollisionPreventedByPrimaryKey: true,
      },
      journalCoverage: {
        articlesWithRegisteredJournalCount: 900,
        articlesWithoutRegisteredJournalCount: 100,
        byJournalRegistryId: [
          { count: 600, value: 'chest' },
          { count: 400, value: 'unregistered-or-missing' },
        ],
        distinctRegisteredJournalCount: 17,
      },
      publicBetaEligibleCount: 300,
      publicationTypeDistribution: [
        { count: 900, value: 'Journal Article' },
        { count: 100, value: 'Review' },
      ],
      publicationYearDistribution: [
        { count: 450, value: '2025' },
        { count: 550, value: '2026' },
      ],
      relevanceStateCounts: {
        candidate: 250,
        excluded: 200,
        included: 500,
        unreviewed: 50,
      },
      retractionCount: 3,
      sourceKindCoverage: {
        articlesWithAnySourceCount: 950,
        articlesWithoutAnySourceCount: 50,
        bySourceKind: [{ count: 950, value: 'core_journal' }],
      },
      sourceRegistryCoverage: {
        articleCoveragePercent: 92.5,
        articlesWithRegisteredSourceCount: 925,
        articlesWithoutRegisteredSourceCount: 75,
        expectedRegisteredIdentityCount: 43,
        observedRegisteredIdentityCount: 40,
        queryRegistryContentSha256:
          '45c2f0b72deb6dee54cb5b7081fea520bc7b463c12369d972e05e3ff82204a50',
        registryVersion: '1.0.0',
      },
      totalArticleRows: 1_000,
      uniquePmidCount: 1_000,
      visibilityStateCounts: {
        draft: 500,
        hidden: 100,
        published: 400,
      },
    },
    targetAudit: {
      currentUser: 'postgres',
      databaseName: 'postgres',
      sessionUser: 'postgres',
      unixSocketConnection: true,
    },
    queryId: 'literature-shadow-rd-fixed-local-aggregate-inventory/1.0.0',
    schemaVersion: 'literature-shadow-rd-corpus-inventory/1.0.0',
  }
}

describe('shadow-R&D corpus inventory contract', () => {
  test('pins one fixed aggregate read-only transaction and only the development membership', () => {
    expect(() =>
      assertShadowRdCorpusInventorySqlBoundary(SHADOW_RD_CORPUS_INVENTORY_SQL),
    ).not.toThrow()
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).toMatch(
      /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/u,
    )
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).toContain("SET LOCAL statement_timeout = '120s';")
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL.endsWith('ROLLBACK;')).toBe(true)
    expect(
      SHADOW_RD_CORPUS_INVENTORY_SQL.match(/item\.dataset_split = 'development'/gu),
    ).toHaveLength(1)
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).not.toMatch(
      /dataset_split\s*(?:<>|!=|=\s*'(?:test|all)')/iu,
    )
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).not.toContain("'pmid'")
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).not.toContain('relevance_label')
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).not.toMatch(/array_agg\s*\(\s*article\.pmid/iu)
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).not.toMatch(/jsonb_agg\s*\([^)]*article\.pmid/iu)
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).not.toMatch(/jsonb_build_object\s*\(\s*'pmid'/iu)
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).not.toMatch(/'title'\s*,\s*article\.title/iu)
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).toContain(
      "batch.id = 'fff41ba3-811d-4d28-ba73-9302db3a942a'::uuid",
    )
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).toContain("batch.name = 'gold-set-v1'")
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).toContain(
      'CASE WHEN count(item.id) = 630 THEN 630 ELSE NULL END',
    )
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).toContain('development_projection.membership_sha256')
    expect(SHADOW_RD_CORPUS_INVENTORY_SQL).toContain('extensions.digest(')
  })

  test('refuses SQL substitution and mutation statements', () => {
    expect(() =>
      assertShadowRdCorpusInventorySqlBoundary(
        SHADOW_RD_CORPUS_INVENTORY_SQL.replace(
          'CROSS JOIN development_summary\nCROSS JOIN target_audit;',
          'DELETE FROM x;',
        ),
      ),
    ).toThrow('exact committed aggregate SQL')
  })

  test('requires exact 630 development membership and aggregate overlap', () => {
    expect(() => shadowRdCorpusInventoryQueryPayloadSchema.parse(queryPayload())).not.toThrow()
    expect(() =>
      shadowRdCorpusInventoryQueryPayloadSchema.parse({
        ...queryPayload(),
        developmentCohort: { ...queryPayload().developmentCohort, observedCount: 629 },
      }),
    ).toThrow()
    expect(() =>
      shadowRdCorpusInventoryQueryPayloadSchema.parse({
        ...queryPayload(),
        developmentCohort: {
          ...queryPayload().developmentCohort,
          generalCorpusOverlapCount: 629,
        },
      }),
    ).toThrow()
    expect(() =>
      shadowRdCorpusInventoryQueryPayloadSchema.parse({
        ...queryPayload(),
        developmentCohort: {
          ...queryPayload().developmentCohort,
          membershipSha256: '0'.repeat(64),
        },
      }),
    ).toThrow()
  })

  test('binds every source/query registry identity and exact committed registry content', () => {
    const registryBytes = readFileSync(
      resolve(process.cwd(), 'config/literature/pubmed-query-registry.v1.json'),
    )
    expect(createHash('sha256').update(registryBytes).digest('hex')).toBe(
      queryPayload().generalCorpus.sourceRegistryCoverage.queryRegistryContentSha256,
    )
    const registry = JSON.parse(registryBytes.toString('utf8')) as {
      core_journals: { id: string }[]
      discovery_queries: { id: string }[]
      expanded_journals: { id: string }[]
      non_pubmed_sources: { id: string }[]
      optional_continuity_journals: { id: string }[]
      queries: Record<string, string>
      registry_version: string
    }
    const identities = [
      ...registry.core_journals,
      ...registry.optional_continuity_journals,
      ...registry.expanded_journals,
      ...registry.non_pubmed_sources,
    ].map(({ id }) => id)
    identities.push(
      ...Object.keys(registry.queries),
      ...registry.discovery_queries.map(({ id }) => id),
    )
    expect(registry.registry_version).toBe('1.0.0')
    expect(new Set(identities).size).toBe(43)
    for (const identity of identities) {
      expect(SHADOW_RD_CORPUS_INVENTORY_SQL).toContain(`('${identity}')`)
    }
  })

  test('enforces aggregate partitions and minimum-cell suppression', () => {
    expect(() =>
      shadowRdCorpusInventoryQueryPayloadSchema.parse({
        ...queryPayload(),
        generalCorpus: {
          ...queryPayload().generalCorpus,
          relevanceStateCounts: {
            ...queryPayload().generalCorpus.relevanceStateCounts,
            candidate: 249,
          },
        },
      }),
    ).toThrow('do not partition')
    expect(() =>
      shadowRdCorpusInventoryQueryPayloadSchema.parse({
        ...queryPayload(),
        developmentCohort: {
          ...queryPayload().developmentCohort,
          crossTabs: {
            ...queryPayload().developmentCohort.crossTabs,
            publicationYear: {
              minimumCellSize: 5,
              suppressed: { cellCount: 0, recordCount: 0 },
              visible: [{ count: 4, value: 'rare-year' }],
            },
          },
        },
      }),
    ).toThrow('at least 5')
    expect(() =>
      shadowRdCorpusInventoryQueryPayloadSchema.parse({
        ...queryPayload(),
        developmentCohort: {
          ...queryPayload().developmentCohort,
          crossTabs: {
            ...queryPayload().developmentCohort.crossTabs,
            publicationYear: {
              ...queryPayload().developmentCohort.crossTabs.publicationYear,
              visible: [{ count: 300, value: '2025' }],
            },
          },
        },
      }),
    ).toThrow('does not represent all 630')
  })

  test('adds sealed-evaluation metadata without accepting it from query output', () => {
    const artifact = parseShadowRdCorpusInventoryQueryOutput(JSON.stringify(queryPayload()))
    expect(artifact.sealedEvaluation).toEqual({
      expectedCount: 270,
      identityAccessed: false,
      queried: false,
    })
    expect(artifact.queryAudit).toEqual(
      expect.objectContaining({
        databaseMutationCount: 0,
        heldOutIdentitiesAccessed: false,
        remoteDatabaseAccessed: false,
        rolledBack: true,
        transactionReadOnly: true,
      }),
    )
    expect(artifact.authorization.autonomousProductionLevel).toBe(0)
    expect(() => shadowRdCorpusInventoryArtifactSchema.parse(artifact)).not.toThrow()
  })

  test('rejects absent, duplicated, invalid, and query-supplied boundary fields', () => {
    expect(() => parseShadowRdCorpusInventoryQueryOutput('')).toThrow('exactly one')
    expect(() =>
      parseShadowRdCorpusInventoryQueryOutput(
        `${JSON.stringify(queryPayload())}\n${JSON.stringify(queryPayload())}`,
      ),
    ).toThrow('exactly one')
    expect(() => parseShadowRdCorpusInventoryQueryOutput('{bad json}')).toThrow('invalid JSON')
    expect(() =>
      parseShadowRdCorpusInventoryQueryOutput(
        JSON.stringify({
          ...queryPayload(),
          sealedEvaluation: { expectedCount: 270, identityAccessed: false, queried: false },
        }),
      ),
    ).toThrow()
  })

  test('renders only aggregate JSON and human-readable development-only Markdown', () => {
    const artifact = parseShadowRdCorpusInventoryQueryOutput(JSON.stringify(queryPayload()))
    const markdown = renderShadowRdCorpusInventoryMarkdown(artifact)
    const json = serializeShadowRdCorpusInventoryJson(artifact)
    expect(markdown).toContain('General Literature Explorer corpus')
    expect(markdown).toContain('Current effective physician-reviewed records | 628')
    expect(markdown).toContain('Not queried (expected 270)')
    expect(markdown).toContain('Suppressed (2 cells)')
    expect(markdown).toContain('not held-out validation')
    expect(markdown).not.toContain('rare-year')
    expect(JSON.parse(json)).toEqual(artifact)
  })
})

describe('shadow-R&D corpus inventory CLI boundary', () => {
  test('accepts no operational arguments and only a standalone help flag', () => {
    expect(validateShadowRdCorpusInventoryCliArguments([])).toEqual({ help: false })
    expect(validateShadowRdCorpusInventoryCliArguments(['--help'])).toEqual({ help: true })
    for (const argv of [
      ['--scope', 'test'],
      ['--scope', 'all'],
      ['--split', 'test'],
      ['--queue', 'all'],
      ['--held-out'],
      ['--complement'],
      ['--pmid', '12345678'],
      ['--target', 'remote'],
      ['--database-url', 'postgres://example.invalid/database'],
      ['--output', '/tmp/inventory'],
      ['--help=yes'],
    ]) {
      expect(() => validateShadowRdCorpusInventoryCliArguments(argv)).toThrow()
    }
  })

  test('documents only the fixed local aggregate command and ignored output root', () => {
    expect(SHADOW_RD_CORPUS_INVENTORY_USAGE).toContain(
      'accepts no scope, target, queue, split, PMID',
    )
    expect(SHADOW_RD_CORPUS_INVENTORY_OUTPUT_ROOT).toBe('local-data/literature/shadow-rd-results')
  })

  test('keeps all database and filesystem capabilities private and fixed', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/shadow-literature-rd/collect-corpus-inventory.ts'),
      'utf8',
    )
    expect(source).not.toContain('@supabase/supabase-js')
    expect(source).not.toMatch(/export\s+(?:async\s+)?function\s+(?:run|execute)/u)
    expect(source).not.toMatch(/export\s+interface\s+.*(?:Dependencies|Executor|Runner)/u)
    expect(source).not.toContain('DATABASE_URL')
    expect(source).toContain("'--context',\n  SHADOW_RD_CORPUS_INVENTORY_DOCKER_CONTEXT")
    expect(source).toContain("'supabase_db_ip-literature-local'")
    expect(source).toContain("'ip-literature-local'")
    expect(source).toContain("'55322'")
    expect(source).toContain("'codex/ip-literature-autonomous-shadow-rd-v1'")
    expect(source).toContain("['status', '--porcelain=v1', '--untracked-files=all']")
    expect(source).toContain('head !== upstreamHead')
    expect(source).toContain("git(cwd, ['hash-object', '--', path])")
    expect(source).toContain("git(cwd, ['rev-parse', `HEAD:${path}`])")
    expect(source.indexOf('await assertExactCommittedRuntimeSources(cwd)')).toBeLessThan(
      source.indexOf('await assertFixedLocalDockerTarget(cwd)'),
    )
    expect(source.match(/await assertProductionRepositoryAndEntrypoint\(\)/gu)).toHaveLength(2)
    expect(source.match(/await assertExactCommittedRuntimeSources\(cwd\)/gu)).toHaveLength(2)
    expect(
      source.indexOf('const finalCwd = await assertProductionRepositoryAndEntrypoint()'),
    ).toBeLessThan(source.indexOf('const outputRoot = await ensureFixedOutputRoot(cwd)'))
    expect(source).toContain('writeExclusiveOutputFiles(identity, [')
    expect(source.match(/name: 'corpus-inventory\.(?:json|md)'/gu)).toHaveLength(2)
  })
})
