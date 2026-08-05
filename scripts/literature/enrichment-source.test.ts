/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import { parseCsvRows } from '@/features/literature/gold-set/export'

import {
  parseBuildGoldEnrichmentArguments,
  writeGoldEnrichmentArtifacts,
  type BuildGoldEnrichmentCliOptions,
} from './build-gold-enrichment-source'
import { V2_SOURCE_COLUMNS, type V2SourceColumn } from './data-quality/external-qa'
import {
  GOLD_ENRICHMENT_BATCH_ID,
  GOLD_ENRICHMENT_BATCH_NAME,
  GOLD_ENRICHMENT_DEVELOPMENT_ROWS,
  PHYSICIAN_FIELD_COLUMNS,
  PHYSICIAN_RELEVANCE_COLUMNS,
  buildFidelityAudit,
  buildGoldEnrichmentReceipt,
  buildGoldEnrichmentSource,
  canonicalDatabaseStateSha256,
  loadCanonicalDevelopmentSnapshot,
  parsePhysicianRelevanceCsv,
  physicianFieldSha256,
  serializeGoldEnrichmentReceipt,
  type CanonicalDevelopmentSnapshot,
  type GOLD_ENRICHMENT_SOURCE_COLUMNS,
  type GoldEnrichmentArticle,
  type PhysicianRelevanceColumn,
  type PhysicianRelevanceContract,
} from './enrichment-source'

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
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

function physicianRow(
  index: number,
  overrides: Partial<Record<PhysicianRelevanceColumn, string>> = {},
): Record<PhysicianRelevanceColumn, string> {
  const row = Object.fromEntries(
    PHYSICIAN_RELEVANCE_COLUMNS.map((column) => [column, '']),
  ) as Record<PhysicianRelevanceColumn, string>
  return Object.assign(row, {
    master_row_id: String(index),
    screening_batch: `screening-${index}`,
    source_row_id: String(index),
    pmid: String(20_000 + index),
    title: `Noncanonical source title ${index}`,
    abstract: '[NO ABSTRACT AVAILABLE]',
    mesh: 'must not be used',
    author_keywords: 'must not be used',
    publication_types: 'must not be used',
    journal: 'must not be used',
    year: '1900',
    language: '4348',
    no_abstract: 'False',
    protected_procedural_cue: 'True',
    first_pass_label: 'include_core',
    first_pass_confidence: 'high',
    first_pass_requires_human_review: 'False',
    first_pass_rationale: `First-pass rationale ${index}`,
    second_pass_label: '',
    second_pass_confidence: '',
    second_pass_requires_human_review: '',
    second_pass_rationale: '',
    two_pass_status: 'not_second_passed',
    provisional_label: 'include_core',
    triage_lane: 'quick_confirm_core',
    triage_reason: 'protected_procedural_cue',
    physician_final_label: 'include_core',
    physician_final_confidence: 'high',
    physician_accept_or_modify: 'accept',
    physician_notes: `Preserve physician note ${index}`,
    physician_reviewed: 'True',
    decision_provenance: 'human_ai_assisted',
    is_blinded: 'False',
    relevance_review_complete: 'True',
    enrichment_status: 'pending',
    database_import_ready: 'False',
    ...overrides,
  })
}

function physicianFixture(
  rows: Array<Record<PhysicianRelevanceColumn, string>> = [physicianRow(1), physicianRow(2)],
) {
  const value = csv(PHYSICIAN_RELEVANCE_COLUMNS, rows)
  const physicianHash = physicianFieldSha256(rows)
  const labels = Object.fromEntries(
    ['exclude', 'include_adjacent', 'include_core', 'uncertain'].map((label) => [
      label,
      rows.filter((row) => row.physician_final_label === label).length,
    ]),
  ) as PhysicianRelevanceContract['labelCounts']
  const confidence = Object.fromEntries(
    ['high', 'low', 'moderate'].map((level) => [
      level,
      rows.filter((row) => row.physician_final_confidence === level).length,
    ]),
  ) as PhysicianRelevanceContract['confidenceCounts']
  const contract: PhysicianRelevanceContract = {
    confidenceCounts: confidence,
    decisionProvenance: 'human_ai_assisted',
    expectedRows: rows.length,
    labelCounts: labels,
    physicianFieldSha256: physicianHash,
    sourceSha256: sha256(value),
  }
  return { contract, parsed: parsePhysicianRelevanceCsv(value, contract), rows, value }
}

function article(
  pmid: string,
  overrides: Partial<GoldEnrichmentArticle> = {},
): GoldEnrichmentArticle {
  return {
    abstract: `Canonical abstract ${pmid}`,
    authorKeywords: [`keyword ${pmid}`],
    authors: [{ abbreviatedName: 'Miller R', fullName: 'Russell Miller' }],
    journalAbbreviation: 'J Test',
    journalTitle: 'Journal of Deterministic Tests',
    languages: ['eng'],
    meshTerms: [`MeSH ${pmid}`],
    pmid,
    publicationTypes: ['Journal Article'],
    publicationYear: 2026,
    title: `Canonical title ${pmid}`,
    ...overrides,
  }
}

function snapshot(
  pmids = ['20001', '20002'],
  articleOverrides: Array<Partial<GoldEnrichmentArticle>> = [],
): CanonicalDevelopmentSnapshot {
  return {
    articles: pmids.map((pmid, index) => article(pmid, articleOverrides[index])),
    batch: { id: GOLD_ENRICHMENT_BATCH_ID, name: GOLD_ENRICHMENT_BATCH_NAME },
    datasetSplit: 'development',
    items: pmids.map((pmid, index) => ({
      datasetSplit: 'development',
      displayOrder: index * 3 + 2,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      pmid,
    })),
  }
}

function priorRow(
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
    screening_batch: `screening-${index}`,
    source_row_id: String(index),
    pmid: String(20_000 + index),
    title: `Canonical title ${20_000 + index}`,
    abstract: `Canonical abstract ${20_000 + index}`,
    no_abstract: 'false',
    physician_final_label: 'include_core',
    physician_final_confidence: 'high',
    processing_status: 'valid',
    ...overrides,
  })
}

function priorFixture(rows = [priorRow(1), priorRow(2)]) {
  const value = csv(V2_SOURCE_COLUMNS, rows)
  return { hash: sha256(value), rows, value }
}

describe('gold enrichment CLI safety', () => {
  const root = '/workspace'
  const valid = [
    '--batch',
    'gold-set-v1',
    '--reviews',
    '/inputs/gold-set-v1_physician_relevance_final_630.csv',
    '--output',
    'local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.csv',
    '--prior-source',
    '/inputs/gold-set-v1_quality-cleaned_630.csv',
  ]

  it('accepts only the exact local development invocation', () => {
    expect(parseBuildGoldEnrichmentArguments(valid, root)).toEqual({
      batch: GOLD_ENRICHMENT_BATCH_NAME,
      outputPath: '/workspace/local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.csv',
      priorSourcePath: '/inputs/gold-set-v1_quality-cleaned_630.csv',
      receiptPath:
        '/workspace/local-data/literature/gold-sets/gold-set-v1/enrichment-source-v2.receipt.json',
      reviewsPath: '/inputs/gold-set-v1_physician_relevance_final_630.csv',
      target: 'local',
    } satisfies BuildGoldEnrichmentCliOptions)
  })

  it.each([['--split', 'test'], ['--split', 'all'], ['--include-test'], ['--held-out']])(
    'rejects held-out/test/all option %s',
    (...forbidden) => {
      expect(() => parseBuildGoldEnrichmentArguments([...valid, ...forbidden], root)).toThrow(
        'forbidden',
      )
    },
  )

  it('rejects a different batch, remote target, relative review file, and test-named input', () => {
    expect(() =>
      parseBuildGoldEnrichmentArguments(
        valid.map((value) => (value === 'gold-set-v1' ? 'other-batch' : value)),
        root,
      ),
    ).toThrow('--batch must be exactly')
    expect(() => parseBuildGoldEnrichmentArguments([...valid, '--target', 'remote'], root)).toThrow(
      'remote access is forbidden',
    )
    expect(() =>
      parseBuildGoldEnrichmentArguments(
        valid.map((value) =>
          value === '/inputs/gold-set-v1_physician_relevance_final_630.csv' ? 'reviews.csv' : value,
        ),
        root,
      ),
    ).toThrow('absolute path')
    expect(() =>
      parseBuildGoldEnrichmentArguments(
        valid.map((value) =>
          value === '/inputs/gold-set-v1_physician_relevance_final_630.csv'
            ? '/inputs/held-out-test/reviews.csv'
            : value,
        ),
        root,
      ),
    ).toThrow('held-out/test/all')
  })

  it('requires the checksum-bound prior source so every run includes the fidelity audit', () => {
    const withoutPrior = valid.slice(0, -2)
    expect(() => parseBuildGoldEnrichmentArguments(withoutPrior, root)).toThrow(
      '--prior-source is required',
    )
  })
})

describe('physician relevance verification', () => {
  it('validates exact membership, label/confidence contract, provenance, and field hash', () => {
    const fixture = physicianFixture([
      physicianRow(1),
      physicianRow(2, {
        physician_final_label: 'include_adjacent',
        physician_final_confidence: 'moderate',
        physician_accept_or_modify: 'modify',
      }),
    ])
    expect(fixture.parsed.rows).toHaveLength(2)
    expect(fixture.parsed.byPmid.size).toBe(2)
    expect(fixture.parsed.sourceSha256).toBe(fixture.contract.sourceSha256)
    expect(fixture.parsed.physicianFieldSha256).toBe(fixture.contract.physicianFieldSha256)
    expect(fixture.parsed.summaries).toEqual({
      confidenceCounts: { high: 1, low: 0, moderate: 1 },
      labelCounts: { exclude: 0, include_adjacent: 1, include_core: 1, uncertain: 0 },
      provenanceCounts: { human_ai_assisted: 2 },
    })
  })

  it('rejects duplicate PMIDs, invalid confidence, and a modified checksum-bound source', () => {
    const duplicateRows = [physicianRow(1), physicianRow(2, { pmid: '20001' })]
    const duplicateValue = csv(PHYSICIAN_RELEVANCE_COLUMNS, duplicateRows)
    const duplicateContract = physicianFixture().contract
    expect(() =>
      parsePhysicianRelevanceCsv(duplicateValue, {
        ...duplicateContract,
        expectedRows: 2,
        sourceSha256: sha256(duplicateValue),
      }),
    ).toThrow('duplicates record')

    const invalidRows = [physicianRow(1, { physician_final_confidence: 'certain' })]
    const invalidValue = csv(PHYSICIAN_RELEVANCE_COLUMNS, invalidRows)
    expect(() =>
      parsePhysicianRelevanceCsv(invalidValue, {
        ...physicianFixture([physicianRow(1)]).contract,
        sourceSha256: sha256(invalidValue),
      }),
    ).toThrow('Invalid physician confidence')

    const fixture = physicianFixture()
    expect(() => parsePhysicianRelevanceCsv(`${fixture.value} `, fixture.contract)).toThrow(
      'checksum mismatch',
    )
  })

  it('rejects PMID membership and order mismatches instead of sorting them away', () => {
    const fixture = physicianFixture()
    expect(() => buildGoldEnrichmentSource(snapshot(['20001', '99999']), fixture.parsed)).toThrow(
      'exactly match development membership',
    )
    const reversed = physicianFixture([physicianRow(2), physicianRow(1)])
    expect(() => buildGoldEnrichmentSource(snapshot(), reversed.parsed)).toThrow('order mismatch')
  })
})

describe('canonical enrichment source construction', () => {
  it('uses only canonical metadata while preserving identity, screening, and physician fields', () => {
    const fixture = physicianFixture()
    const canonical = snapshot()
    const build = buildGoldEnrichmentSource(canonical, fixture.parsed)
    const parsed = parseCsvRows(build.csv)
    const header = parsed[0]
    const first = parsed[1]
    const field = (name: (typeof GOLD_ENRICHMENT_SOURCE_COLUMNS)[number]) =>
      first[header.indexOf(name)]

    expect(field('title')).toBe(canonical.articles[0].title)
    expect(field('title')).not.toContain('Noncanonical source title')
    expect(field('mesh_terms_json')).toBe(JSON.stringify(canonical.articles[0].meshTerms))
    expect(field('authors_json')).toBe(
      JSON.stringify([{ abbreviatedName: 'Miller R', fullName: 'Russell Miller' }]),
    )
    expect(field('master_row_id')).toBe('1')
    expect(field('display_order')).toBe('2')
    expect(field('screening_batch')).toBe('screening-1')
    expect(field('physician_notes')).toBe('Preserve physician note 1')
    expect(build.physicianFieldSha256).toBe(fixture.parsed.physicianFieldSha256)
  })

  it('preserves clean Unicode byte-for-byte without applying the mojibake repair map', () => {
    const clean = 'Café β 中文 😷 ™ — déjà vu'
    const fixture = physicianFixture()
    const canonical = snapshot(
      ['20001', '20002'],
      [
        { abstract: clean, title: clean },
        { abstract: null, title: 'Second title' },
      ],
    )
    const first = buildGoldEnrichmentSource(canonical, fixture.parsed)
    const second = buildGoldEnrichmentSource(canonical, fixture.parsed)
    const rows = parseCsvRows(first.csv)
    const titleIndex = rows[0].indexOf('title')
    const abstractIndex = rows[0].indexOf('abstract')
    const noAbstractIndex = rows[0].indexOf('no_abstract')

    expect(rows[1][titleIndex]).toBe(clean)
    expect(rows[1][abstractIndex]).toBe(clean)
    expect(Buffer.from(rows[1][titleIndex], 'utf8')).toEqual(Buffer.from(clean, 'utf8'))
    expect(rows[2][abstractIndex]).toBe('')
    expect(rows[2][noAbstractIndex]).toBe('True')
    expect(second.csv).toBe(first.csv)
    expect(second.outputSha256).toBe(first.outputSha256)
  })

  it('requires complete publication types/languages while allowing nullable MeSH and keywords', () => {
    const fixture = physicianFixture()
    const canonical = snapshot(
      ['20001', '20002'],
      [
        { authorKeywords: [], meshTerms: [] },
        { authorKeywords: ['keyword'], meshTerms: ['heading'] },
      ],
    )
    const build = buildGoldEnrichmentSource(canonical, fixture.parsed)
    const state = canonicalDatabaseStateSha256(canonical)
    const receipt = buildGoldEnrichmentReceipt({
      build,
      databaseStateSha256After: state,
      databaseStateSha256Before: state,
      fidelityAudit: null,
      physicianReviews: fixture.parsed,
      snapshot: canonical,
    })

    expect(receipt.fieldCoverage).toEqual({
      authorKeywords: { blank: 1, populated: 1 },
      languages: { blank: 0, populated: 2 },
      meshTerms: { blank: 1, populated: 1 },
      publicationTypes: { blank: 0, populated: 2 },
    })
    expect(receipt.safety).toMatchObject({
      databaseMutationOperations: [],
      heldOutTestAccessed: false,
      mutationPlan: null,
    })
    expect(() =>
      buildGoldEnrichmentSource(
        snapshot(['20001', '20002'], [{ publicationTypes: [] }]),
        fixture.parsed,
      ),
    ).toThrow('has no publication type')
    expect(() =>
      buildGoldEnrichmentSource(snapshot(['20001', '20002'], [{ languages: [] }]), fixture.parsed),
    ).toThrow('has no language')
  })
})

describe('export fidelity audit and receipt', () => {
  it('reports title/abstract/order/physician differences and invalid languages', () => {
    const fixture = physicianFixture()
    const canonical = snapshot()
    const prior = priorFixture([
      priorRow(2, {
        abstract: 'Different abstract',
        language: '4348',
        master_row_id: '99',
        pmid: '20002',
        physician_final_confidence: 'low',
        title: 'Different title',
      }),
      priorRow(1, { pmid: '20001' }),
    ])
    const audit = buildFidelityAudit(canonical, fixture.parsed, prior.value, prior.hash)

    expect(audit.pmidAndOrder).toMatchObject({ exactMembership: true, exactOrder: false })
    expect(audit.pmidAndOrder.orderMismatches).toHaveLength(2)
    expect(audit.titleDifferences.count).toBe(1)
    expect(audit.abstractDifferences.count).toBe(1)
    expect(audit.physicianFieldMismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'master_row_id', pmid: '20002' }),
        expect.objectContaining({ field: 'physician_final_confidence', pmid: '20002' }),
      ]),
    )
    expect(audit.invalidLanguages.previous).toEqual([{ pmid: '20002', value: '4348' }])
    expect(audit.invalidLanguages.canonical).toEqual([])
  })

  it('reports nonblank metadata conflicts instead of replacing canonical values', () => {
    const fixture = physicianFixture()
    const canonical = snapshot()
    const prior = priorFixture([
      priorRow(1, {
        author_keywords: '["different"]',
        language: '["spa"]',
        mesh: '["different heading"]',
        publication_types: '["Review"]',
      }),
      priorRow(2),
    ])
    const audit = buildFidelityAudit(canonical, fixture.parsed, prior.value, prior.hash)

    expect(audit.nonblankMetadataConflicts.map((conflict) => conflict.field)).toEqual([
      'meshTerms',
      'authorKeywords',
      'publicationTypes',
      'languages',
    ])
    expect(audit.nonblankMetadataConflicts[2]).toMatchObject({
      canonical: ['Journal Article'],
      pmid: '20001',
      previousRaw: '["Review"]',
    })
  })

  it('checksum-binds the prior source and validates source/database/physician hashes in receipt', () => {
    const fixture = physicianFixture()
    const canonical = snapshot()
    const prior = priorFixture()
    expect(() =>
      buildFidelityAudit(canonical, fixture.parsed, `${prior.value} `, prior.hash),
    ).toThrow('checksum mismatch')

    const audit = buildFidelityAudit(canonical, fixture.parsed, prior.value, prior.hash)
    const build = buildGoldEnrichmentSource(canonical, fixture.parsed)
    const state = canonicalDatabaseStateSha256(canonical)
    const receipt = buildGoldEnrichmentReceipt({
      build,
      databaseStateSha256After: state,
      databaseStateSha256Before: state,
      fidelityAudit: audit,
      physicianReviews: fixture.parsed,
      snapshot: canonical,
    })
    const receiptAgain = serializeGoldEnrichmentReceipt(receipt)

    expect(receipt.sources).toMatchObject({
      canonicalDatabase: { unchangedDuringExport: true },
      physicianReviews: {
        expectedSha256: fixture.contract.sourceSha256,
        sha256: fixture.contract.sourceSha256,
      },
      previousEnrichmentExport: {
        expectedSha256: prior.hash,
        sha256: prior.hash,
      },
    })
    expect(receipt.physicianFieldIntegrity).toMatchObject({
      columns: ['master_row_id', 'pmid', ...PHYSICIAN_FIELD_COLUMNS],
      expectedSha256: fixture.contract.physicianFieldSha256,
      inputSha256: fixture.contract.physicianFieldSha256,
      outputSha256: fixture.contract.physicianFieldSha256,
      unchanged: true,
    })
    expect(serializeGoldEnrichmentReceipt(receipt)).toBe(receiptAgain)
    expect(() =>
      buildGoldEnrichmentReceipt({
        build,
        databaseStateSha256After: 'f'.repeat(64),
        databaseStateSha256Before: state,
        fidelityAudit: audit,
        physicianReviews: fixture.parsed,
        snapshot: canonical,
      }),
    ).toThrow('database state changed')
  })

  it('publishes the CSV and receipt as an exclusive validated pair', async () => {
    const fixture = physicianFixture()
    const canonical = snapshot()
    const prior = priorFixture()
    const audit = buildFidelityAudit(canonical, fixture.parsed, prior.value, prior.hash)
    const build = buildGoldEnrichmentSource(canonical, fixture.parsed)
    const state = canonicalDatabaseStateSha256(canonical)
    const receipt = buildGoldEnrichmentReceipt({
      build,
      databaseStateSha256After: state,
      databaseStateSha256Before: state,
      fidelityAudit: audit,
      physicianReviews: fixture.parsed,
      snapshot: canonical,
    })
    const root = await mkdtemp(join(tmpdir(), 'gold-enrichment-artifacts-'))
    try {
      await mkdir(join(root, 'local-data'), { recursive: true })
      const outputPath = join(root, 'local-data', 'export.csv')
      const receiptPath = join(root, 'local-data', 'export.receipt.json')
      await writeGoldEnrichmentArtifacts(outputPath, build.csv, receiptPath, receipt, root)
      expect(await readFile(outputPath, 'utf8')).toBe(build.csv)
      expect(await readFile(receiptPath, 'utf8')).toBe(serializeGoldEnrichmentReceipt(receipt))
      await expect(
        writeGoldEnrichmentArtifacts(outputPath, build.csv, receiptPath, receipt, root),
      ).rejects.toThrow('Refusing to overwrite')

      const blockedOutput = join(root, 'local-data', 'blocked.csv')
      const blockedReceipt = join(root, 'local-data', 'blocked.receipt.json')
      await writeFile(blockedReceipt, 'existing receipt', 'utf8')
      await expect(
        writeGoldEnrichmentArtifacts(blockedOutput, build.csv, blockedReceipt, receipt, root),
      ).rejects.toThrow('Refusing to overwrite')
      await expect(readFile(blockedOutput)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})

type RecordedCall = { arguments: unknown[]; method: string; table: string }

class ReadOnlyQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  private filters = new Map<string, unknown>()
  private rangeValue: [number, number] | null = null
  private inValues: string[] | null = null

  constructor(
    private readonly table: string,
    private readonly calls: RecordedCall[],
    private readonly data: Record<string, Array<Record<string, unknown>>>,
  ) {}

  private record(method: string, arguments_: unknown[]) {
    this.calls.push({ arguments: arguments_, method, table: this.table })
    return this
  }

  select(...arguments_: unknown[]) {
    return this.record('select', arguments_)
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value)
    return this.record('eq', [column, value])
  }

  limit(...arguments_: unknown[]) {
    return this.record('limit', arguments_)
  }

  order(...arguments_: unknown[]) {
    return this.record('order', arguments_)
  }

  range(from: number, to: number) {
    this.rangeValue = [from, to]
    return this.record('range', [from, to])
  }

  in(column: string, values: string[]) {
    this.inValues = values
    return this.record('in', [column, values])
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    let rows = [...(this.data[this.table] ?? [])]
    for (const [column, value] of this.filters) rows = rows.filter((row) => row[column] === value)
    if (this.inValues) rows = rows.filter((row) => this.inValues!.includes(String(row.pmid)))
    if (this.table === 'literature_gold_set_items') {
      rows.sort((left, right) => Number(left.display_order) - Number(right.display_order))
    }
    if (this.rangeValue) rows = rows.slice(this.rangeValue[0], this.rangeValue[1] + 1)
    return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected)
  }
}

describe('read-only canonical database loader', () => {
  it('selects only development membership and canonical metadata with zero mutation operations', async () => {
    const calls: RecordedCall[] = []
    const items = Array.from({ length: GOLD_ENRICHMENT_DEVELOPMENT_ROWS }, (_, index) => ({
      batch_id: GOLD_ENRICHMENT_BATCH_ID,
      dataset_split: 'development',
      display_order: index * 2 + 2,
      id: `item-${index + 1}`,
      pmid: String(30_000 + index),
    }))
    const articles = items.map((item) => ({
      abstract: null,
      author_keywords: [],
      authors: [],
      journal_abbreviation: 'J Test',
      journal_title: 'Journal of Tests',
      languages: ['eng'],
      mesh_terms: [],
      pmid: item.pmid,
      publication_types: ['Journal Article'],
      publication_year: 2026,
      title: `Article ${item.pmid}`,
    }))
    const data = {
      literature_articles: articles,
      literature_gold_set_batches: [
        { id: GOLD_ENRICHMENT_BATCH_ID, name: GOLD_ENRICHMENT_BATCH_NAME },
      ],
      literature_gold_set_items: items,
    }
    const client = {
      from: (table: string) => new ReadOnlyQuery(table, calls, data),
    } as unknown as SupabaseClient

    const loaded = await loadCanonicalDevelopmentSnapshot(client)
    expect(loaded.items).toHaveLength(GOLD_ENRICHMENT_DEVELOPMENT_ROWS)
    expect(loaded.articles).toHaveLength(GOLD_ENRICHMENT_DEVELOPMENT_ROWS)
    expect(new Set(calls.map((call) => call.table))).toEqual(
      new Set(['literature_gold_set_batches', 'literature_gold_set_items', 'literature_articles']),
    )
    expect(new Set(calls.map((call) => call.method))).toEqual(
      new Set(['select', 'eq', 'limit', 'order', 'range', 'in']),
    )
    expect(calls).toContainEqual({
      arguments: ['dataset_split', 'development'],
      method: 'eq',
      table: 'literature_gold_set_items',
    })
    expect(
      calls.some((call) =>
        call.arguments.some((argument) => argument === 'test' || argument === 'all'),
      ),
    ).toBe(false)
    expect(calls.some((call) => /review|physician/iu.test(String(call.arguments[0])))).toBe(false)
  })
})
