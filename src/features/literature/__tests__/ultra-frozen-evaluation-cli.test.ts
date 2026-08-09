import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  parseUltraFrozenEvaluationCliArguments,
  runUltraFrozenEvaluation,
  type RunUltraFrozenEvaluationOptions,
} from '../../../../scripts/literature/ultra-frozen-evaluation'
import type {
  UltraRelevanceLabel,
  UltraScreeningResult,
} from '@/features/literature/ultra-screening/core'

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function result(pmid: string, relevanceLabel: UltraRelevanceLabel): UltraScreeningResult {
  return {
    pmid,
    relevanceLabel,
    decisionConfidence: 'high',
    requiresHumanReview: false,
    reasonCodes: [
      relevanceLabel === 'exclude' ? 'incidental_specimen_collection' : 'scope_boundary',
    ],
    evidence: [{ field: 'title', text: `Title ${pmid}` }],
    conciseRationale: `Rationale ${pmid}.`,
  }
}

function review(id: string, relevanceLabel: UltraRelevanceLabel) {
  return { id, revision: 1, relevanceLabel }
}

interface Fixture {
  options: RunUltraFrozenEvaluationOptions
  paths: {
    predictionRoot: string
    outputRoot: string
    truth: string
    manifest: string
    primaryAggregate: string
  }
  values: {
    truth: Record<string, unknown>
    manifest: Record<string, unknown>
    primaryAggregate: string
  }
  hashes: {
    primaryAggregate: string
    comparisonAggregate: string
  }
}

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'ultra-frozen-evaluation-cli-'))
  const predictionRoot = join(root, 'ip-literature-ultra-v1')
  const outputRoot = join(root, 'ip-literature-ultra-v2-container')
  const validated = join(predictionRoot, 'validated')
  const coordinator = join(predictionRoot, 'coordinator-only')
  await mkdir(join(validated, 'pilot-a'), { recursive: true })
  await mkdir(join(validated, 'pilot-b'), { recursive: true })
  await mkdir(coordinator, { recursive: true })

  const primaryAggregate = `${JSON.stringify(result('1', 'include_core'))}\n${JSON.stringify(
    result('2', 'exclude'),
  )}\n`
  const comparisonAggregate = `${JSON.stringify(result('2', 'include_adjacent'))}\n`
  const primaryAggregatePath = join(validated, 'pilot-a', 'all.jsonl')
  const comparisonAggregatePath = join(validated, 'pilot-b', 'all.jsonl')
  await writeFile(primaryAggregatePath, primaryAggregate)
  await writeFile(comparisonAggregatePath, comparisonAggregate)

  const selection = JSON.stringify({
    kind: 'terra_escalation_selection',
    selections: [
      {
        pmid: '2',
        reasons: ['animal_preclinical_boundary', 'no_abstract_boundary'],
      },
    ],
  })
  const selectionPath = join(coordinator, 'pilot-terra-selection.json')
  await writeFile(selectionPath, selection)

  const frozenAt = '2026-08-03T03:07:32.813975+00:00'
  const truth = {
    exportVersion: '1.0.0',
    exportedAt: '2026-08-03T05:10:12.476Z',
    batch: { name: 'pilot-v1', status: 'frozen', frozenAt },
    split: 'all',
    includesHistory: true,
    records: [
      {
        pmid: '1',
        abstract: 'Abstract one',
        reviewStatus: 'completed',
        reviewSource: 'completed',
        review: review('review-1', 'include_core'),
        reviewHistory: [review('review-1', 'include_core')],
      },
      {
        pmid: '2',
        abstract: null,
        reviewStatus: 'completed',
        reviewSource: 'completed',
        review: review('review-2', 'include_adjacent'),
        reviewHistory: [review('review-2', 'include_adjacent')],
      },
    ],
  }
  const truthPath = join(root, 'pilot-v1-all-history.json')
  const truthContent = JSON.stringify(truth)
  await writeFile(truthPath, truthContent)

  const policyPath = join(root, 'legacy-policy-record.md')
  const promptPath = join(root, 'legacy-prompt-record.md')
  const policyContent = 'Formalized H1 policy reference; exact historical policy unavailable.\n'
  const promptContent = 'Formalized H1 prompt reference; exact rendered prompt unavailable.\n'
  await writeFile(policyPath, policyContent)
  await writeFile(promptPath, promptContent)

  const manifest = {
    manifestVersion: '1.0.0',
    runId: 'ip-literature-ultra-v1',
    rootPath: predictionRoot,
    phases: {
      'pilot-a': {
        status: 'completed',
        aggregateOutputPath: primaryAggregatePath,
        aggregateOutputSha256: sha256(primaryAggregate),
      },
      'pilot-b': {
        status: 'completed',
        aggregateOutputPath: comparisonAggregatePath,
        aggregateOutputSha256: sha256(comparisonAggregate),
      },
    },
  }
  const manifestPath = join(predictionRoot, 'progress-manifest.json')
  const manifestContent = JSON.stringify(manifest)
  await writeFile(manifestPath, manifestContent)

  return {
    options: {
      evaluationId: 'pilot-a-frozen-v2-test',
      evaluatedAt: '2026-08-03T06:00:00.000Z',
      predictionRunRoot: predictionRoot,
      outputRoot,
      truthExportPath: truthPath,
      truthSha256: sha256(truthContent),
      truthBatchName: 'pilot-v1',
      truthFrozenAt: frozenAt,
      manifestPath,
      manifestSha256: sha256(manifestContent),
      phaseId: 'pilot-a',
      predictionAggregateSha256: sha256(primaryAggregate),
      predictionAttemptProvenanceStatus: 'unavailable_legacy',
      comparePhaseIds: ['pilot-b'],
      selectionAudits: [{ path: selectionPath, sha256: sha256(selection) }],
      screeningPolicyRecord: {
        path: policyPath,
        version: 'formalized-h1-reference-v1',
        sha256: sha256(policyContent),
      },
      workerPromptTemplateRecord: {
        path: promptPath,
        version: 'formalized-h1-reference-v1',
        sha256: sha256(promptContent),
      },
      repositoryCommit: 'a'.repeat(40),
    },
    paths: {
      predictionRoot,
      outputRoot,
      truth: truthPath,
      manifest: manifestPath,
      primaryAggregate: primaryAggregatePath,
    },
    values: { truth, manifest, primaryAggregate },
    hashes: {
      primaryAggregate: sha256(primaryAggregate),
      comparisonAggregate: sha256(comparisonAggregate),
    },
  }
}

describe('frozen Ultra evaluation CLI helpers', () => {
  it('verifies immutable inputs, evaluates frozen truth, and writes outside the v1 run', async () => {
    const setup = await fixture()
    const first = await runUltraFrozenEvaluation(setup.options)

    expect(first.report).toMatchObject({
      evaluationId: 'pilot-a-frozen-v2-test',
      provenance: {
        predictionRunId: 'ip-literature-ultra-v1',
        predictionPhase: 'pilot-a',
        predictionAggregateSha256: setup.hashes.primaryAggregate,
        predictionAttemptProvenanceStatus: 'unavailable_legacy',
        truthBatchStatus: 'frozen',
        selectionAudits: [
          {
            path: expect.stringContaining('pilot-terra-selection.json'),
            sha256: setup.options.selectionAudits?.[0]?.sha256,
          },
        ],
      },
      performance: { metrics: { articleCount: 2 } },
      subsets: {
        noAbstract: { metrics: { articleCount: 1 } },
        animalPreclinical: { metrics: { articleCount: 1 } },
      },
    })
    expect(first.report.comparisons[0]).toMatchObject({
      predictionPhase: 'pilot-b',
      comparisonCount: 1,
      overlapCount: 1,
    })
    expect(first.artifacts.reportPath.startsWith(setup.paths.outputRoot)).toBe(true)
    await expect(access(join(setup.paths.predictionRoot, 'evaluations'))).rejects.toMatchObject({
      code: 'ENOENT',
    })

    const second = await runUltraFrozenEvaluation(setup.options)
    expect(second.artifacts).toMatchObject({
      reportStatus: 'verified_existing',
      disagreementsStatus: 'verified_existing',
      disagreementsCsvStatus: 'verified_existing',
      bundleReceiptStatus: 'verified_existing',
      bundleComplete: true,
    })
  })

  it('uses only the evaluated phase PMIDs for truth and filters comparison overlap', async () => {
    const setup = await fixture()
    const options: RunUltraFrozenEvaluationOptions = {
      ...setup.options,
      evaluationId: 'pilot-b-frozen-v2-test',
      phaseId: 'pilot-b',
      predictionAggregateSha256: setup.hashes.comparisonAggregate,
      comparePhaseIds: ['pilot-a'],
    }
    const evaluated = await runUltraFrozenEvaluation(options)

    expect(evaluated.report.performance.metrics.articleCount).toBe(1)
    expect(evaluated.report.performance.metrics.exactMatches).toBe(1)
    expect(evaluated.report.comparisons[0]).toMatchObject({
      predictionPhase: 'pilot-a',
      comparisonCount: 1,
      overlapCount: 1,
    })
  })

  it('validates a V1.1 compensation source and its exact copied truth payload', async () => {
    const setup = await fixture()
    const truth = setup.values.truth as {
      exportVersion: string
      records: Array<Record<string, unknown>>
    }
    truth.exportVersion = '1.1.0'
    for (const [index, record] of truth.records.entries()) {
      const base: Record<string, unknown> = {
        ...(record.review as Record<string, unknown>),
        revisionKind: 'standard',
        lifecycleState: 'effective',
        supersedesReviewId: null,
        compensatesReviewId: null,
        effectiveSourceReviewId: null,
        operationActionId: null,
      }
      if (index === 0) {
        const imported = {
          ...base,
          id: 'review-1-import',
          revision: 2,
          revisionKind: 'import',
          supersedesReviewId: base['id'],
          operationActionId: 'import-action-1',
          relevanceLabel: 'include_adjacent',
        }
        const compensation = {
          ...base,
          id: 'review-1-compensation',
          revision: 3,
          revisionKind: 'compensation',
          supersedesReviewId: imported.id,
          compensatesReviewId: imported.id,
          effectiveSourceReviewId: base['id'],
          operationActionId: 'compensation-action-1',
        }
        record.reviewHistory = [base, imported, compensation]
        record.review = { ...compensation }
        record.chainHeadReviewId = compensation.id
      } else {
        record.reviewHistory = [base]
        record.review = { ...base }
        record.chainHeadReviewId = base['id']
      }
    }
    let truthContent = JSON.stringify(truth)
    await writeFile(setup.paths.truth, truthContent)
    const options = {
      ...setup.options,
      evaluationId: 'pilot-a-v11-compensation-test',
      truthSha256: sha256(truthContent),
    }
    await expect(runUltraFrozenEvaluation(options)).resolves.toMatchObject({
      report: { performance: { metrics: { articleCount: 2 } } },
    })

    const first = truth.records[0]!
    const history = first.reviewHistory as Array<Record<string, unknown>>
    history[2]!.relevanceLabel = 'exclude'
    ;(first.review as Record<string, unknown>).relevanceLabel = 'exclude'
    truthContent = JSON.stringify(truth)
    await writeFile(setup.paths.truth, truthContent)
    await expect(
      runUltraFrozenEvaluation({
        ...options,
        evaluationId: 'pilot-a-v11-compensation-tamper-test',
        truthSha256: sha256(truthContent),
      }),
    ).rejects.toThrow('compensation source or copied payload is not chain-consistent')
  })

  it('derives the complete no-abstract subset from frozen truth without selection audits', async () => {
    const setup = await fixture()
    const evaluated = await runUltraFrozenEvaluation({
      ...setup.options,
      evaluationId: 'pilot-a-no-selection-audit-test',
      selectionAudits: [],
    })

    expect(evaluated.report.provenance.selectionAudits).toEqual([])
    expect(evaluated.report.subsets.noAbstract?.metrics.articleCount).toBe(1)
    expect(evaluated.report.subsets.animalPreclinical).toBeNull()
  })

  it('fails closed on truth hash/status/frozenAt, aggregate hash, and an in-v1 output root', async () => {
    const badTruthHash = await fixture()
    await expect(
      runUltraFrozenEvaluation({ ...badTruthHash.options, truthSha256: '0'.repeat(64) }),
    ).rejects.toThrow('frozen truth export SHA-256 mismatch')

    const activeTruth = await fixture()
    const activeContent = JSON.stringify({
      ...activeTruth.values.truth,
      batch: { name: 'pilot-v1', status: 'active', frozenAt: activeTruth.options.truthFrozenAt },
    })
    await writeFile(activeTruth.paths.truth, activeContent)
    await expect(
      runUltraFrozenEvaluation({ ...activeTruth.options, truthSha256: sha256(activeContent) }),
    ).rejects.toThrow('Truth batch must be frozen')

    const wrongFrozenAt = await fixture()
    await expect(
      runUltraFrozenEvaluation({
        ...wrongFrozenAt.options,
        truthFrozenAt: '2026-08-03T03:08:00.000Z',
      }),
    ).rejects.toThrow('Truth frozenAt mismatch')

    const changedAggregate = await fixture()
    await writeFile(
      changedAggregate.paths.primaryAggregate,
      `${changedAggregate.values.primaryAggregate}\n`,
    )
    await expect(runUltraFrozenEvaluation(changedAggregate.options)).rejects.toThrow(
      'phase pilot-a aggregate SHA-256 mismatch',
    )

    const nestedOutput = await fixture()
    await expect(
      runUltraFrozenEvaluation({
        ...nestedOutput.options,
        outputRoot: join(nestedOutput.paths.predictionRoot, 'new-evaluations'),
      }),
    ).rejects.toThrow('outputRoot must be outside predictionRunRoot')
  })

  it('rejects a sibling output-root symlink that redirects into preserved v1', async () => {
    const setup = await fixture()
    const redirectedTarget = join(setup.paths.predictionRoot, 'redirected-evaluations')
    await mkdir(redirectedTarget)
    await symlink(redirectedTarget, setup.paths.outputRoot, 'dir')

    await expect(runUltraFrozenEvaluation(setup.options)).rejects.toThrow(
      'Evaluation output path must not be a symbolic link',
    )
    await expect(access(join(redirectedTarget, 'evaluations'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('parses explicit legacy provenance and comma-separated comparison/audit inputs', () => {
    const parsed = parseUltraFrozenEvaluationCliArguments([
      '--evaluation-id',
      'pilot-a-frozen-v2',
      '--evaluated-at',
      '2026-08-03T06:00:00.000Z',
      '--prediction-run-root',
      '/tmp/v1',
      '--output-root',
      '/tmp/v2',
      '--truth-export',
      '/tmp/truth.json',
      '--truth-sha256',
      'a'.repeat(64),
      '--truth-batch',
      'pilot-v1',
      '--truth-frozen-at',
      '2026-08-03T03:07:32.813975+00:00',
      '--manifest',
      '/tmp/v1/progress-manifest.json',
      '--manifest-sha256',
      'b'.repeat(64),
      '--phase',
      'pilot-a',
      '--aggregate-sha256',
      'c'.repeat(64),
      '--prediction-attempt-provenance-status',
      'unavailable_legacy',
      '--compare-phases',
      'pilot-b,pilot-c',
      '--selection-audits',
      '/tmp/b.json,/tmp/c.json',
      '--selection-audit-sha256s',
      `${'d'.repeat(64)},${'e'.repeat(64)}`,
      '--policy-record',
      '/tmp/policy.md',
      '--policy-version',
      'reference-v1',
      '--policy-sha256',
      'f'.repeat(64),
      '--prompt-record',
      '/tmp/prompt.md',
      '--prompt-version',
      'reference-v1',
      '--prompt-sha256',
      '1'.repeat(64),
      '--repository-commit',
      '2'.repeat(40),
    ])

    expect(parsed).toMatchObject({
      predictionRunRoot: '/tmp/v1',
      outputRoot: '/tmp/v2',
      comparePhaseIds: ['pilot-b', 'pilot-c'],
      predictionAttemptProvenanceStatus: 'unavailable_legacy',
      selectionAudits: [
        { path: '/tmp/b.json', sha256: 'd'.repeat(64) },
        { path: '/tmp/c.json', sha256: 'e'.repeat(64) },
      ],
    })
  })
})
