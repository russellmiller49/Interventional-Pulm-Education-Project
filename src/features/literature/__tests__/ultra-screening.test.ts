import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  balancedChunks,
  deterministicPmidSample,
  evaluateUltraScreening,
  NO_ABSTRACT_MARKER,
  selectUltraTerraCandidates,
  serializeUltraResults,
  validateUltraWorkerOutput,
  type UltraScreeningArticle,
  type UltraScreeningResult,
} from '@/features/literature/ultra-screening/core'
import {
  FROZEN_LEGACY_ULTRA_RUN_ID,
  ULTRA_SCREENING_MUTATING_COMMANDS,
} from '../../../../scripts/literature/ultra-v1-freeze'

const repoRoot = resolve(__dirname, '../../../..')
const ultraScreeningCli = resolve(repoRoot, 'node_modules/.bin/tsx')
const ultraScreeningScript = resolve(repoRoot, 'scripts/literature/ultra-screening.ts')

async function runtimeFixture(runId: string) {
  const rootPath = await mkdtemp(join(tmpdir(), 'ultra-screening-cli-'))
  await mkdir(rootPath, { recursive: true })
  const manifestPath = join(rootPath, 'progress-manifest.json')
  const manifestContent = `${JSON.stringify(
    {
      manifestVersion: '1.0.0',
      schemaVersion: '1.0.0',
      runId,
      rootPath,
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
      maxRetries: 2,
      databaseSnapshot: {
        availableArticleCount: 0,
        withAbstractCount: 0,
        noAbstractCount: 0,
        capturedAt: '2026-08-03T00:00:00.000Z',
      },
      phases: {},
      chunks: {},
      dispatchBlockers: [],
      allocationChanges: [],
    },
    null,
    2,
  )}\n`
  await writeFile(manifestPath, manifestContent)
  return { rootPath, manifestPath, manifestContent }
}

function runUltraScreeningCli(arguments_: readonly string[]) {
  return spawnSync(ultraScreeningCli, [ultraScreeningScript, ...arguments_], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  })
}

const article: UltraScreeningArticle = {
  pmid: '12345',
  title: 'Bronchoscopic lavage technique and safety',
  abstract: 'We compared suction methods during bronchoalveolar lavage.',
  mesh: ['Bronchoscopy', 'Bronchoalveolar Lavage'],
  author_keyword: ['suction pressure'],
  publication_type: ['Comparative Study'],
  journal: 'Journal of Bronchology',
  year: 2025,
  language: ['eng'],
}

const validResult: UltraScreeningResult = {
  pmid: '12345',
  relevanceLabel: 'include_core',
  decisionConfidence: 'high',
  requiresHumanReview: false,
  reasonCodes: ['bal_procedural'],
  evidence: [
    {
      field: 'abstract',
      text: 'suction methods during bronchoalveolar lavage',
    },
  ],
  conciseRationale: 'The study directly compares a BAL technique.',
}

describe('ultra literature screening contracts', () => {
  it('accepts one strict, evidence-grounded result per assigned PMID', () => {
    const report = validateUltraWorkerOutput(serializeUltraResults([validResult]), [article])

    expect(report.valid).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.records).toEqual([validResult])
  })

  it('rejects invented evidence, duplicate PMIDs, and missing assignments', () => {
    const duplicate = {
      ...validResult,
      evidence: [{ field: 'title' as const, text: 'not in the supplied title' }],
    }
    const report = validateUltraWorkerOutput(
      `${JSON.stringify(duplicate)}\n${JSON.stringify(validResult)}\n`,
      [article],
    )

    expect(report.valid).toBe(false)
    expect(report.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['invalid_evidence', 'duplicate_pmid']),
    )
  })

  it('rejects additional result properties and low confidence without review', () => {
    const invalid = {
      ...validResult,
      decisionConfidence: 'low',
      requiresHumanReview: false,
      leakedSamplingStratum: 'strong_likely_ip',
    }
    const report = validateUltraWorkerOutput(`${JSON.stringify(invalid)}\n`, [article])

    expect(report.valid).toBe(false)
    expect(report.errors.map((error) => error.code)).toContain('invalid_schema')
    expect(report.errors.map((error) => error.code)).toContain('missing_pmid')
  })

  it('validates year evidence as the supplied year string', () => {
    const result: UltraScreeningResult = {
      ...validResult,
      evidence: [{ field: 'year', text: '2025' }],
    }
    expect(validateUltraWorkerOutput(serializeUltraResults([result]), [article]).valid).toBe(true)
    expect(
      validateUltraWorkerOutput(
        serializeUltraResults([{ ...result, evidence: [{ field: 'year', text: '202' }] }]),
        [article],
      ).valid,
    ).toBe(false)
  })

  it('creates deterministic smoke selections and balanced eight-way chunks', () => {
    const pmids = Array.from({ length: 100 }, (_, index) => String(index + 1))
    const selected = deterministicPmidSample(pmids, 20, 'fixed-seed')

    expect(deterministicPmidSample([...pmids].reverse(), 20, 'fixed-seed')).toEqual(selected)
    expect(new Set(selected).size).toBe(20)
    expect(balancedChunks(selected, 8).map((chunk) => chunk.length)).toEqual([
      3, 3, 3, 3, 2, 2, 2, 2,
    ])
  })

  it('reports dangerous high-confidence false negatives and binary metrics', () => {
    const predictions: UltraScreeningResult[] = [
      validResult,
      {
        ...validResult,
        pmid: '999',
        relevanceLabel: 'exclude',
        reasonCodes: ['incidental_specimen_collection'],
      },
    ]
    const metrics = evaluateUltraScreening(
      [
        { pmid: '12345', relevanceLabel: 'include_core' },
        { pmid: '999', relevanceLabel: 'include_adjacent' },
      ],
      predictions,
    )

    expect(metrics.exactAccuracy).toBe(0.5)
    expect(metrics.binaryInclude).toMatchObject({
      truePositive: 1,
      falseNegative: 1,
      sensitivity: 0.5,
    })
    expect(metrics.dangerousFalseNegatives.map((item) => item.pmid)).toEqual(['999'])
  })

  it('selects Terra boundary, disagreement, no-abstract, and deterministic QC cases', () => {
    const articles: UltraScreeningArticle[] = [
      article,
      { ...article, pmid: '2', abstract: NO_ABSTRACT_MARKER },
      { ...article, pmid: '3' },
      { ...article, pmid: '4' },
    ]
    const firstPass: UltraScreeningResult[] = [
      validResult,
      {
        ...validResult,
        pmid: '2',
        relevanceLabel: 'exclude',
        reasonCodes: ['animal_nonprocedural'],
      },
      {
        ...validResult,
        pmid: '3',
        relevanceLabel: 'exclude',
        reasonCodes: ['incidental_specimen_collection'],
      },
      {
        ...validResult,
        pmid: '4',
        relevanceLabel: 'uncertain',
        decisionConfidence: 'low',
        requiresHumanReview: true,
        reasonCodes: ['scope_boundary'],
      },
    ]
    const challengePass: UltraScreeningResult[] = [
      {
        ...validResult,
        pmid: '2',
        relevanceLabel: 'include_adjacent',
        reasonCodes: ['adjacent_preclinical_procedural'],
      },
      {
        ...validResult,
        pmid: '3',
        relevanceLabel: 'exclude',
        reasonCodes: ['incidental_specimen_collection'],
      },
    ]

    const selected = selectUltraTerraCandidates({
      articles,
      firstPass,
      challengePass,
      qcRate: 1,
      qcSeed: 'fixed-qc',
    })

    expect(selected.map((item) => item.pmid)).toEqual(['2', '3', '4'])
    expect(selected.find((item) => item.pmid === '2')?.reasons).toEqual(
      expect.arrayContaining([
        'animal_preclinical_boundary',
        'confident_exclusion_qc',
        'luna_disagreement',
        'no_abstract_boundary',
      ]),
    )
    expect(selected.find((item) => item.pmid === '4')?.reasons).toEqual(
      expect.arrayContaining(['first_pass_low_confidence', 'first_pass_uncertain']),
    )
  })

  it('refuses every mutating v1 CLI command before any artifact write', async () => {
    const fixture = await runtimeFixture(FROZEN_LEGACY_ULTRA_RUN_ID)
    const originalEntries = await readdir(fixture.rootPath, { recursive: true })
    const originalStat = await stat(fixture.manifestPath)

    for (const command of ULTRA_SCREENING_MUTATING_COMMANDS) {
      const result = runUltraScreeningCli([
        command,
        ...(command === 'prepare' ? ['--run-id', FROZEN_LEGACY_ULTRA_RUN_ID] : []),
        '--run-root',
        fixture.rootPath,
      ])

      expect(result.error).toBeUndefined()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(
        `Legacy Ultra run ${FROZEN_LEGACY_ULTRA_RUN_ID} is frozen experimental evidence`,
      )
      expect(result.stderr).toContain(`The ${command} command is disabled`)
    }

    const mismatchedPrepare = runUltraScreeningCli([
      'prepare',
      '--run-id',
      'different-run-id',
      '--run-root',
      fixture.rootPath,
    ])
    expect(mismatchedPrepare.status).toBe(1)
    expect(mismatchedPrepare.stderr).toContain('The prepare command is disabled')

    const unrecognizedFutureCommand = runUltraScreeningCli([
      'future-mutator',
      '--run-root',
      fixture.rootPath,
    ])
    expect(unrecognizedFutureCommand.status).toBe(1)
    expect(unrecognizedFutureCommand.stderr).toContain('The future-mutator command is disabled')

    const absentFrozenRoot = join(fixture.rootPath, FROZEN_LEGACY_ULTRA_RUN_ID)
    const missingManifestPrepare = runUltraScreeningCli([
      'prepare',
      '--run-id',
      'different-run-id',
      '--run-root',
      absentFrozenRoot,
      '--mode',
      'corpus',
    ])
    expect(missingManifestPrepare.status).toBe(1)
    expect(missingManifestPrepare.stderr).toContain('The prepare command is disabled')
    await expect(access(absentFrozenRoot)).rejects.toMatchObject({ code: 'ENOENT' })

    expect(await readFile(fixture.manifestPath, 'utf8')).toBe(fixture.manifestContent)
    expect(await readdir(fixture.rootPath, { recursive: true })).toEqual(originalEntries)
    const finalStat = await stat(fixture.manifestPath)
    expect(finalStat.ino).toBe(originalStat.ino)
    expect(finalStat.mtimeMs).toBe(originalStat.mtimeMs)
  }, 60_000)

  it('keeps v1 status and audit available as read-only commands', async () => {
    const fixture = await runtimeFixture(FROZEN_LEGACY_ULTRA_RUN_ID)

    const status = runUltraScreeningCli(['status', '--run-root', fixture.rootPath, '--json'])
    expect(status.error).toBeUndefined()
    expect(status.status).toBe(0)
    expect(JSON.parse(status.stdout)).toMatchObject({
      runId: FROZEN_LEGACY_ULTRA_RUN_ID,
      phases: [],
    })

    const audit = runUltraScreeningCli(['audit', '--run-root', fixture.rootPath])
    expect(audit.error).toBeUndefined()
    expect(audit.status).toBe(0)
    expect(JSON.parse(audit.stdout)).toMatchObject({
      runId: FROZEN_LEGACY_ULTRA_RUN_ID,
      checkedChunks: 0,
      valid: true,
    })

    expect(await readFile(fixture.manifestPath, 'utf8')).toBe(fixture.manifestContent)
    expect(await readdir(fixture.rootPath, { recursive: true })).toEqual(['progress-manifest.json'])
  }, 30_000)

  it('preserves normal CLI validation for non-v1 runtimes', async () => {
    const fixture = await runtimeFixture('ip-literature-ultra-v2-test')
    const result = runUltraScreeningCli([
      'start',
      '--run-root',
      fixture.rootPath,
      '--chunk',
      'missing-chunk',
      '--agent-id',
      'test-agent',
      '--model',
      'luna-test',
      '--reasoning',
      'ultra',
    ])

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Unknown chunk: missing-chunk')
    expect(result.stderr).not.toContain('is frozen experimental evidence')
    expect(await readFile(fixture.manifestPath, 'utf8')).toBe(fixture.manifestContent)
  })

  it('fails closed when an existing run manifest cannot be parsed', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'ultra-screening-malformed-'))
    const manifestPath = join(rootPath, 'progress-manifest.json')
    const malformedManifest = '{"runId":"ip-literature-ultra-v1"'
    await writeFile(manifestPath, malformedManifest)

    const result = runUltraScreeningCli(['start', '--run-root', rootPath])

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('JSON')
    expect(await readFile(manifestPath, 'utf8')).toBe(malformedManifest)
    expect(await readdir(rootPath, { recursive: true })).toEqual(['progress-manifest.json'])
  })
})
