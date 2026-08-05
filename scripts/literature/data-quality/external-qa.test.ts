import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseExternalQaAuditCliOptions } from '../audit-external-qa'
import {
  assertDevelopmentOnlyInputPath,
  buildExternalQaAuditReport,
  EXTERNAL_QA_COLUMNS,
  parseExternalQaFindingsCsv,
  parseV2SourceCsv,
  runExternalQaAudit,
  V2_SOURCE_COLUMNS,
  type BuildExternalQaAuditOptions,
  type ExternalQaColumn,
  type ExternalQaExpectedProvenance,
  type V2SourceColumn,
} from './external-qa'

function csvCell(value: string) {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function csv<Column extends string>(
  columns: readonly Column[],
  rows: readonly Record<Column, string>[],
) {
  return `${[
    columns.map(csvCell).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\r\n')}\r\n`
}

function inputSha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function expectedProvenance(
  sourceCsv: string,
  findingsCsv: string,
  sourceRows = parseV2SourceCsv(sourceCsv).rows.length,
): ExternalQaExpectedProvenance {
  return {
    findingsSha256: inputSha256(findingsCsv),
    sourceRows,
    sourceSha256: inputSha256(sourceCsv),
  }
}

function buildSyntheticExternalQaAuditReport(
  options: Omit<BuildExternalQaAuditOptions, 'expectedProvenance'>,
) {
  return buildExternalQaAuditReport({
    ...options,
    expectedProvenance: expectedProvenance(options.sourceCsv, options.findingsCsv),
  })
}

function sourceRow(
  index: number,
  overrides: Partial<Record<V2SourceColumn, string>> = {},
): Record<V2SourceColumn, string> {
  const row = Object.fromEntries(V2_SOURCE_COLUMNS.map((column) => [column, ''])) as Record<
    V2SourceColumn,
    string
  >
  return Object.assign(row, {
    batch_row_id: String(index),
    master_row_id: String(index),
    screening_batch: 'development_batch',
    source_row_id: String(index),
    pmid: String(10_000 + index),
    title: `Development article ${index}`,
    abstract: `Abstract ${index}`,
    no_abstract: 'false',
    physician_final_label: 'include_core',
    physician_final_confidence: 'high',
    metadata_sufficiency: 'adequate_abstract',
    processing_status: 'valid',
    physician_metadata_sufficiency: '',
    physician_topic_ids: '',
    physician_technology_tags: '',
    physician_clinical_purposes: '',
    physician_disease_tags: '',
    physician_study_design: '',
    physician_publication_status: '',
    physician_enrichment_accept_or_modify: '',
    physician_enrichment_notes: '',
    physician_enrichment_reviewed: '',
    ...overrides,
  })
}

function findingRow(
  source: Record<V2SourceColumn, string> | null,
  overrides: Partial<Record<ExternalQaColumn, string>> = {},
): Record<ExternalQaColumn, string> {
  return {
    source_review: 'QA_review_fixture',
    severity: 'Medium',
    category: 'Missing tag',
    master_row_id: source?.master_row_id ?? '',
    pmid: source?.pmid ?? '',
    field: 'technology_tags',
    issue: 'Synthetic QA issue',
    current_value_in_external_review: '',
    suggested_action: 'Physician review required',
    title: source?.title ?? '',
    status_against_v2: 'needs_physician_adjudication',
    review_tier: source ? 'direct_targeted' : 'global_data_quality',
    ...overrides,
  }
}

describe('external QA CSV ingestion', () => {
  it('preserves tiers and models 54 direct findings across 44 unique source PMIDs', () => {
    const sourceRows = Array.from({ length: 44 }, (_, index) => sourceRow(index + 1))
    const directFindings = Array.from({ length: 54 }, (_, index) => {
      const source = sourceRows[index < 44 ? index : index - 44]
      return findingRow(source, {
        severity: index < 11 ? 'High' : index < 52 ? 'Medium' : 'Low',
        category: index < 29 ? 'Topic implies modality, technology_tags blank' : 'Missing tag',
      })
    })
    const ruleFinding = findingRow(sourceRows[0], {
      severity: 'Low',
      category: 'Cross-field consistency',
      status_against_v2: 'rule_based_consistency_check',
      review_tier: 'rule_based_consistency',
    })
    const globalFinding = findingRow(null, {
      severity: 'High',
      category: 'Data integrity',
      field: 'mesh',
      issue: 'Column is empty',
      status_against_v2: 'global_finding',
    })

    const report = buildSyntheticExternalQaAuditReport({
      sourceCsv: csv(V2_SOURCE_COLUMNS, sourceRows),
      findingsCsv: csv(EXTERNAL_QA_COLUMNS, [...directFindings, ruleFinding, globalFinding]),
      generatedAt: '2026-08-04T12:00:00.000Z',
    })

    expect(report.summaries).toMatchObject({
      totalFindings: 56,
      tier: {
        direct_targeted: 54,
        rule_based_consistency: 1,
        global_data_quality: 1,
      },
      byTier: {
        direct_targeted: {
          findings: 54,
          uniquePmids: 44,
          severity: { High: 11, Medium: 41, Low: 2 },
        },
        rule_based_consistency: { findings: 1, uniquePmids: 1 },
        global_data_quality: { findings: 1, uniquePmids: 0 },
      },
    })
    expect(report.findingsByTier.direct_targeted).toHaveLength(54)
    expect(report.findingsByTier.rule_based_consistency[0].review_tier).toBe(
      'rule_based_consistency',
    )
    expect(report.findingsByTier.global_data_quality[0].review_tier).toBe('global_data_quality')
    expect(report.validation).toMatchObject({
      ok: true,
      mismatchCount: 0,
      mismatches: [],
      titleMatches: {
        exact: 55,
        acceptedTruncatedPrefix: 0,
        mismatch: 0,
        notValidated: 0,
      },
    })
  })

  it('requires exact source and findings headers', () => {
    const source = sourceRow(1)
    const finding = findingRow(source)
    expect(() => parseV2SourceCsv(csv(V2_SOURCE_COLUMNS.slice(1), [source]))).toThrow(
      'header must exactly match',
    )
    expect(() =>
      parseExternalQaFindingsCsv(csv([...EXTERNAL_QA_COLUMNS].reverse(), [finding])),
    ).toThrow('header must exactly match')
  })

  it('rejects duplicate source PMIDs and master row IDs', () => {
    const first = sourceRow(1)
    expect(() =>
      parseV2SourceCsv(csv(V2_SOURCE_COLUMNS, [first, sourceRow(2, { pmid: first.pmid })])),
    ).toThrow('duplicates record')
    expect(() =>
      parseV2SourceCsv(
        csv(V2_SOURCE_COLUMNS, [first, sourceRow(2, { master_row_id: first.master_row_id })]),
      ),
    ).toThrow('duplicates record')
  })

  it('rejects unknown tiers, targeted rows without identifiers, and identified global rows', () => {
    const source = sourceRow(1)
    expect(() =>
      parseExternalQaFindingsCsv(
        csv(EXTERNAL_QA_COLUMNS, [findingRow(source, { review_tier: 'merged' })]),
      ),
    ).toThrow('review_tier')
    expect(() =>
      parseExternalQaFindingsCsv(csv(EXTERNAL_QA_COLUMNS, [findingRow(source, { pmid: '' })])),
    ).toThrow('PMID')
    expect(() =>
      parseExternalQaFindingsCsv(
        csv(EXTERNAL_QA_COLUMNS, [
          findingRow(null, { master_row_id: '1', pmid: '10001', title: 'Not global' }),
        ]),
      ),
    ).toThrow('must have blank master_row_id')
  })

  it('reports source-reference mismatches without changing physician fields or planning mutations', () => {
    const first = sourceRow(1, {
      physician_topic_ids: 'source-only-topic',
      physician_enrichment_notes: 'Preserve exactly',
    })
    const second = sourceRow(2)
    const sourceCsv = csv(V2_SOURCE_COLUMNS, [first, second])
    const findingsCsv = csv(EXTERNAL_QA_COLUMNS, [
      findingRow(first, {
        master_row_id: second.master_row_id,
        title: 'Mismatched title',
      }),
      findingRow(first, { master_row_id: '999', pmid: '99999', title: 'Missing row' }),
    ])

    const report = buildSyntheticExternalQaAuditReport({ sourceCsv, findingsCsv })

    expect(report.validation.ok).toBe(false)
    expect(new Set(report.validation.mismatches.map((mismatch) => mismatch.code))).toEqual(
      new Set([
        'identifier_pair_mismatch',
        'title_mismatch',
        'pmid_not_found',
        'master_row_id_not_found',
      ]),
    )
    expect(report.physicianFieldIntegrity).toMatchObject({ unchanged: true })
    expect(report.physicianFieldIntegrity.sha256After).toBe(
      report.physicianFieldIntegrity.sha256Before,
    )
    expect(report.safety).toMatchObject({
      heldOutTestSplitAccessed: false,
      databaseAccessed: false,
      networkAccessed: false,
      sourceFilesModified: false,
      mutationPlan: null,
    })
    expect(sourceCsv).toContain('Preserve exactly')
  })

  it('accepts the QA workbook deterministic 180-character title prefix but records it separately', () => {
    const fullTitle = `${'A'.repeat(180)} full source suffix`
    const source = sourceRow(1, { title: fullTitle })
    const report = buildSyntheticExternalQaAuditReport({
      sourceCsv: csv(V2_SOURCE_COLUMNS, [source]),
      findingsCsv: csv(EXTERNAL_QA_COLUMNS, [
        findingRow(source, { title: fullTitle.slice(0, 180) }),
      ]),
    })

    expect(report.validation).toMatchObject({
      ok: true,
      mismatchCount: 0,
      titleMatches: {
        exact: 0,
        acceptedTruncatedPrefix: 1,
        mismatch: 0,
        notValidated: 0,
      },
    })
  })

  it('produces a row-order-independent physician-field hash', () => {
    const first = sourceRow(1, { physician_topic_ids: 'topic-a' })
    const second = sourceRow(2, { physician_topic_ids: 'topic-b' })
    const findingsCsv = csv(EXTERNAL_QA_COLUMNS, [findingRow(first)])
    const forward = buildSyntheticExternalQaAuditReport({
      sourceCsv: csv(V2_SOURCE_COLUMNS, [first, second]),
      findingsCsv,
    })
    const reverse = buildSyntheticExternalQaAuditReport({
      sourceCsv: csv(V2_SOURCE_COLUMNS, [second, first]),
      findingsCsv,
    })
    expect(reverse.physicianFieldIntegrity.sha256Before).toBe(
      forward.physicianFieldIntegrity.sha256Before,
    )
  })
})

describe('external QA audit safety', () => {
  it('rejects held-out, test, and all-split path semantics before access', () => {
    expect(() => assertDevelopmentOnlyInputPath('/safe/pilot-v1-test.csv', '--source')).toThrow(
      'Refusing to access',
    )
    expect(() => assertDevelopmentOnlyInputPath('/safe/pilot-v1-all.csv', '--source')).toThrow(
      'Refusing to access',
    )
    expect(() => assertDevelopmentOnlyInputPath('/safe/held-out/source.csv', '--source')).toThrow(
      'Refusing to access',
    )
    expect(() =>
      parseExternalQaAuditCliOptions([
        '--findings',
        'development-findings.csv',
        '--source',
        'development-source.csv',
        '--split',
        'test',
      ]),
    ).toThrow('split options are forbidden')

    expect(
      assertDevelopmentOnlyInputPath(
        '/safe/gold-set-v1_external_QA_findings_full-text.csv',
        '--findings',
      ),
    ).toContain('gold-set-v1_external_QA_findings_full-text.csv')
  })

  it('writes one exclusive report under local-data and leaves both inputs unchanged', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'external-qa-audit-'))
    try {
      await mkdir(join(workspaceRoot, 'local-data'))
      const sourcePath = join(workspaceRoot, 'development-source.csv')
      const findingsPath = join(workspaceRoot, 'development-findings.csv')
      const source = sourceRow(1)
      const sourceInput = csv(V2_SOURCE_COLUMNS, [source])
      const findingsInput = csv(EXTERNAL_QA_COLUMNS, [findingRow(source)])
      const provenance = expectedProvenance(sourceInput, findingsInput)
      await Promise.all([
        writeFile(sourcePath, sourceInput, 'utf8'),
        writeFile(findingsPath, findingsInput, 'utf8'),
      ])

      await expect(runExternalQaAudit({ sourcePath, findingsPath, workspaceRoot })).rejects.toThrow(
        'provenance verification failed',
      )
      await expect(
        runExternalQaAudit({
          sourcePath,
          findingsPath,
          workspaceRoot,
          expectedProvenance: { ...provenance, sourceRows: 630 },
        }),
      ).rejects.toThrow('expected exactly 630 rows')

      const result = await runExternalQaAudit({
        sourcePath,
        findingsPath,
        workspaceRoot,
        generatedAt: '2026-08-04T12:00:00.000Z',
        expectedProvenance: provenance,
      })

      expect(result.outputPath).toContain(join('local-data', 'literature', 'data-quality'))
      expect(JSON.parse(await readFile(result.outputPath, 'utf8'))).toMatchObject({
        provenanceVerification: {
          method: 'sha256_allowlist_and_exact_source_row_count',
          verified: true,
          expected: provenance,
          actual: provenance,
        },
        validation: { ok: true },
        safety: {
          developmentOnlyInputs: true,
          inputHashesUnchanged: true,
          sourceFilesModified: false,
        },
      })
      await expect(readFile(sourcePath, 'utf8')).resolves.toBe(sourceInput)
      await expect(readFile(findingsPath, 'utf8')).resolves.toBe(findingsInput)
      await expect(
        runExternalQaAudit({
          sourcePath,
          findingsPath,
          workspaceRoot,
          expectedProvenance: provenance,
        }),
      ).rejects.toThrow('Refusing to overwrite')
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('rejects case variants of the read-only local-data/inputs output tree', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'external-qa-input-boundary-'))
    try {
      await mkdir(join(workspaceRoot, 'local-data', 'inputs'), { recursive: true })
      const sourcePath = join(workspaceRoot, 'development-source.csv')
      const findingsPath = join(workspaceRoot, 'development-findings.csv')
      const source = sourceRow(1)
      const sourceInput = csv(V2_SOURCE_COLUMNS, [source])
      const findingsInput = csv(EXTERNAL_QA_COLUMNS, [findingRow(source)])
      await Promise.all([
        writeFile(sourcePath, sourceInput, 'utf8'),
        writeFile(findingsPath, findingsInput, 'utf8'),
      ])

      await expect(
        runExternalQaAudit({
          sourcePath,
          findingsPath,
          workspaceRoot,
          outputPath: join(workspaceRoot, 'local-data', 'INPUTS', 'report.json'),
          expectedProvenance: expectedProvenance(sourceInput, findingsInput),
        }),
      ).rejects.toThrow('read-only local-data/inputs')
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })
})
