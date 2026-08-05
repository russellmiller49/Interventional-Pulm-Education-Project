/** @jest-environment node */

import { mkdir, mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  ExistingPubmedMetadataRow,
  PubmedMetadataRecord,
} from '@/features/literature/domain/pubmed-metadata'
import {
  assertSparsePubmedMetadataPatch,
  createPubmedCommitJournal,
  parsePubmedBackfillArguments,
  resolveSafeLocalDataOutputPath,
  runPubmedMetadataBackfill,
  validatePubmedBackfillInvocation,
  writePubmedBackfillReportAtomic,
  type PubmedBackfillCliOptions,
  type PubmedBackfillReport,
  type PubmedCommitJournalEntry,
} from '../../../../scripts/literature/backfill-pubmed-metadata'
import { parseCliArguments } from '../../../../scripts/literature/lib/cli'

const UPDATED_AT = '2026-08-04T12:00:00.000Z'

function options(overrides: Partial<PubmedBackfillCliOptions> = {}): PubmedBackfillCliOptions {
  return {
    batchSize: 200,
    cacheDirectory: 'local-data/literature/pubmed-efetch-cache',
    commit: false,
    explicitDryRun: false,
    refresh: false,
    reportPath: null,
    target: 'local',
    ...overrides,
  }
}

function fetchedRecord(pmid = '39414327'): PubmedMetadataRecord {
  return {
    pmid,
    meshHeadings: [],
    meshTerms: ['Bronchoscopy'],
    authorKeywords: ['airway'],
    publicationTypes: ['Journal Article'],
    languages: ['spa'],
    invalidLanguages: [],
  }
}

const defaultArticleRow: ExistingPubmedMetadataRow = {
  pmid: '39414327',
  mesh_terms: [],
  author_keywords: [],
  publication_types: [],
  languages: ['4348'],
  updated_at: UPDATED_AT,
}

function mockArticleClient({
  articles = [defaultArticleRow],
  failUpdateAt = -1,
  onMutation,
  optimisticMatch = true,
}: {
  articles?: ExistingPubmedMetadataRow[]
  failUpdateAt?: number
  onMutation?: (pmid: string, updateIndex: number) => void
  optimisticMatch?: boolean
} = {}) {
  const calls: Array<{ method: string; arguments: unknown[] }> = []
  let updateIndex = 0
  const client = {
    from(table: string) {
      expect(table).toBe('literature_articles')
      let updating = false
      let updatePmid = ''
      const query = {
        select(...arguments_: unknown[]) {
          calls.push({ method: 'select', arguments: arguments_ })
          return query
        },
        in(...arguments_: unknown[]) {
          calls.push({ method: 'in', arguments: arguments_ })
          return query
        },
        order(...arguments_: unknown[]) {
          calls.push({ method: 'order', arguments: arguments_ })
          return query
        },
        update(...arguments_: unknown[]) {
          updating = true
          calls.push({ method: 'update', arguments: arguments_ })
          return query
        },
        eq(...arguments_: unknown[]) {
          calls.push({ method: 'eq', arguments: arguments_ })
          if (arguments_[0] === 'pmid') updatePmid = String(arguments_[1])
          return query
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          if (updating) {
            const currentUpdateIndex = updateIndex
            updateIndex += 1
            onMutation?.(updatePmid, currentUpdateIndex)
            if (currentUpdateIndex === failUpdateAt) {
              return Promise.reject(new Error(`simulated update failure for ${updatePmid}`)).then(
                resolve,
                reject,
              )
            }
          }
          const data = updating ? (optimisticMatch ? [{ pmid: updatePmid }] : []) : articles
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return query
    },
  }
  return { calls, client: client as unknown as SupabaseClient }
}

function commitJournalRecorder(order: string[] = []) {
  const entries: PubmedCommitJournalEntry[] = []
  const createCommitJournal = jest.fn(async () => {
    order.push('journal_created')
    return {
      async append(entry: PubmedCommitJournalEntry) {
        entries.push(entry)
        order.push(`journal:${entry.event}`)
      },
      async close() {
        order.push('journal_closed')
      },
    }
  })
  return { createCommitJournal, entries }
}

function efetchResult(record: PubmedMetadataRecord | PubmedMetadataRecord[] = fetchedRecord()) {
  const records = Array.isArray(record) ? record : [record]
  return {
    records,
    unavailablePmids: [],
    batches: [
      {
        records,
        unavailablePmids: [],
        requestedPmids: records.map((item) => item.pmid),
        retrievedAt: '2026-08-04T12:01:00.000Z',
        sourceSha256: 'a'.repeat(64),
        rawCacheReference: 'pubmed-efetch-cache:fixture.xml',
        fromCache: true,
        attemptCount: 1,
        apiRequestsMade: 0,
      },
    ],
  }
}

describe('PubMed metadata backfill safety', () => {
  it('is dry-run by default and accepts only EFetch batches up to 200', () => {
    expect(parsePubmedBackfillArguments(parseCliArguments([]))).toMatchObject({
      commit: false,
      target: 'local',
      batchSize: 200,
    })
    expect(() => parsePubmedBackfillArguments(parseCliArguments(['--batch-size', '201']))).toThrow(
      'between 1 and 200',
    )
  })

  it('blocks every remote target and worktree commit while allowing worktree dry-run', () => {
    expect(() =>
      validatePubmedBackfillInvocation({
        commit: false,
        explicitDryRun: false,
        target: 'local',
        gitDirectory: '/repo/.git/worktrees/codex',
        gitCommonDirectory: '/repo/.git',
      }),
    ).not.toThrow()
    expect(() =>
      validatePubmedBackfillInvocation({
        commit: false,
        explicitDryRun: false,
        target: 'remote',
      }),
    ).toThrow('local-only')
    expect(() =>
      validatePubmedBackfillInvocation({
        commit: true,
        explicitDryRun: false,
        target: 'local',
        gitDirectory: '/repo/.git/worktrees/codex',
        gitCommonDirectory: '/repo/.git',
      }),
    ).toThrow('blocked in an agent worktree')
  })

  it('rejects any update field outside the four PubMed metadata arrays', () => {
    expect(() =>
      assertSparsePubmedMetadataPatch({
        mesh_terms: ['Bronchoscopy'],
        relevance_state: 'included',
      }),
    ).toThrow('relevance_state')
  })

  it('confines cache/report paths to non-input, non-symlinked local-data paths', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pubmed-output-safety-'))
    try {
      await mkdir(path.join(root, 'local-data'), { recursive: true })
      await mkdir(path.join(root, 'outside'), { recursive: true })
      await symlink(path.join(root, 'outside'), path.join(root, 'local-data', 'linked'))

      await expect(
        resolveSafeLocalDataOutputPath('local-data/literature/cache', root),
      ).resolves.toBe(path.join(root, 'local-data', 'literature', 'cache'))
      await expect(resolveSafeLocalDataOutputPath('../outside', root)).rejects.toThrow(
        'must remain below',
      )
      await expect(
        resolveSafeLocalDataOutputPath('local-data/inputs/private.xml', root),
      ).rejects.toThrow('read-only local-data/inputs')
      await expect(
        resolveSafeLocalDataOutputPath('local-data/INPUTS/private.xml', root),
      ).rejects.toThrow('read-only local-data/inputs')
      await expect(resolveSafeLocalDataOutputPath('local-data/linked/cache', root)).rejects.toThrow(
        'through symlink',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates reports exclusively instead of overwriting an existing final path', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pubmed-report-exclusive-'))
    const reportPath = path.join(root, 'local-data', 'literature', 'report.json')
    try {
      const report = { formatVersion: '1.0.0' } as PubmedBackfillReport
      await writePubmedBackfillReportAtomic(report, reportPath, root)
      await expect(writePubmedBackfillReportAtomic(report, reportPath, root)).rejects.toThrow(
        'Refusing to overwrite',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates an exclusive append-only 0600 commit journal', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pubmed-journal-exclusive-'))
    const journalPath = path.join(root, 'local-data', 'literature', 'commit.jsonl')
    try {
      const journal = await createPubmedCommitJournal(journalPath, root)
      await journal.append({
        event: 'commit_started',
        generatedAt: '2026-08-04T12:02:00.000Z',
        plannedRows: 1,
        recordedAt: '2026-08-04T12:02:00.000Z',
        reportSha256: 'a'.repeat(64),
      })
      await journal.close()

      expect((await stat(journalPath)).mode & 0o777).toBe(0o600)
      expect(await readFile(journalPath, 'utf8')).toContain('"event":"commit_started"')
      await expect(createPubmedCommitJournal(journalPath, root)).rejects.toThrow(
        'Refusing to overwrite',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('PubMed metadata backfill orchestration', () => {
  it('produces an offline dry-run report with source hashes and no update call', async () => {
    const { calls, client } = mockArticleClient()
    const writeReport = jest.fn(async () => undefined)
    const createCommitJournal = jest.fn()

    const { commitOutcome, report } = await runPubmedMetadataBackfill(options(), {
      client,
      createCommitJournal,
      efetchClient: { fetchPmids: jest.fn(async () => efetchResult()) },
      loadScope: async () => ({
        batchId: 'batch-id',
        batchName: 'gold-set-v1',
        datasetSplit: 'development',
        pmids: ['39414327'],
      }),
      now: () => Date.parse('2026-08-04T12:02:00.000Z'),
      writeReport,
    })

    expect(report.mode).toBe('dry-run')
    expect(report.invalidLanguageRows).toEqual([
      { pmid: '39414327', invalidValues: ['4348'], validValues: [] },
    ])
    expect(report.rows[0]?.patch).toEqual({
      mesh_terms: ['Bronchoscopy'],
      author_keywords: ['airway'],
      publication_types: ['Journal Article'],
      languages: ['spa'],
    })
    expect(report.sourceBatches[0]?.sourceSha256).toBe('a'.repeat(64))
    expect(report.hashes).toEqual({
      aggregateCacheSourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      candidateMetadataSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      currentMetadataSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      fetchedSourceMetadataSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    })
    expect(commitOutcome).toBeNull()
    expect(report).not.toHaveProperty('commitJournalReference')
    expect(report.invalidSourceLanguageRows).toEqual([])
    expect(calls.some((call) => call.method === 'update')).toBe(false)
    expect(writeReport).toHaveBeenCalledTimes(1)
    expect(createCommitJournal).not.toHaveBeenCalled()
  })

  it('uses a sparse update with an optimistic updated_at guard in commit mode', async () => {
    const order: string[] = []
    const { calls, client } = mockArticleClient({
      onMutation: () => order.push('database_update'),
    })
    const { createCommitJournal, entries } = commitJournalRecorder(order)

    const { commitOutcome, report } = await runPubmedMetadataBackfill(options({ commit: true }), {
      client,
      createCommitJournal,
      efetchClient: { fetchPmids: jest.fn(async () => efetchResult()) },
      loadScope: async () => ({
        batchId: 'batch-id',
        batchName: 'gold-set-v1',
        datasetSplit: 'development',
        pmids: ['39414327'],
      }),
      writeReport: async () => {
        order.push('plan_report')
      },
    })

    const update = calls.find((call) => call.method === 'update')
    expect(update?.arguments[0]).toEqual({
      mesh_terms: ['Bronchoscopy'],
      author_keywords: ['airway'],
      publication_types: ['Journal Article'],
      languages: ['spa'],
    })
    expect(calls).toContainEqual({ method: 'eq', arguments: ['updated_at', UPDATED_AT] })
    expect(report.counts.appliedRows).toBe(0)
    expect(report.commitJournalReference).toMatch(/\.commit-journal\.jsonl$/u)
    expect(commitOutcome).toMatchObject({ appliedRows: 1, status: 'completed' })
    expect(entries.map((entry) => entry.event)).toEqual([
      'commit_started',
      'row_attempt',
      'row_applied',
      'commit_completed',
    ])
    expect(order).toEqual([
      'plan_report',
      'journal_created',
      'journal:commit_started',
      'journal:row_attempt',
      'database_update',
      'journal:row_applied',
      'journal:commit_completed',
      'journal_closed',
    ])
  })

  it('reports invalid language values returned by PubMed XML', async () => {
    const { client } = mockArticleClient()
    const record = fetchedRecord()
    record.languages = []
    record.invalidLanguages = ['not-a-language!']

    const { report } = await runPubmedMetadataBackfill(options(), {
      client,
      efetchClient: { fetchPmids: jest.fn(async () => efetchResult(record)) },
      loadScope: async () => ({
        batchId: 'batch-id',
        batchName: 'gold-set-v1',
        datasetSplit: 'development',
        pmids: ['39414327'],
      }),
      writeReport: async () => undefined,
    })

    expect(report.invalidSourceLanguageRows).toEqual([
      { pmid: '39414327', invalidValues: ['not-a-language!'] },
    ])
    expect(report.counts.invalidSourceLanguageRows).toBe(1)
  })

  it('hashes the sparse projected database state rather than blindly hashing fetched metadata', async () => {
    const { client } = mockArticleClient({
      articles: [
        {
          pmid: '39414327',
          mesh_terms: ['Existing heading'],
          author_keywords: ['existing keyword'],
          publication_types: ['Review'],
          languages: ['eng'],
          updated_at: UPDATED_AT,
        },
      ],
    })

    const { report } = await runPubmedMetadataBackfill(options(), {
      client,
      efetchClient: { fetchPmids: jest.fn(async () => efetchResult()) },
      loadScope: async () => ({
        batchId: 'batch-id',
        batchName: 'gold-set-v1',
        datasetSplit: 'development',
        pmids: ['39414327'],
      }),
      writeReport: async () => undefined,
    })

    expect(report.rows[0]?.patch).toEqual({})
    expect(report.hashes.candidateMetadataSha256).toBe(report.hashes.currentMetadataSha256)
    expect(report.hashes.fetchedSourceMetadataSha256).not.toBe(
      report.hashes.candidateMetadataSha256,
    )
  })

  it('does not attempt a database mutation when the durable plan report collides', async () => {
    const mutation = jest.fn()
    const { client } = mockArticleClient({ onMutation: mutation })
    const createCommitJournal = jest.fn()

    await expect(
      runPubmedMetadataBackfill(options({ commit: true }), {
        client,
        createCommitJournal,
        efetchClient: { fetchPmids: jest.fn(async () => efetchResult()) },
        loadScope: async () => ({
          batchId: 'batch-id',
          batchName: 'gold-set-v1',
          datasetSplit: 'development',
          pmids: ['39414327'],
        }),
        writeReport: async () => {
          throw new Error('Refusing to overwrite existing PubMed metadata report')
        },
      }),
    ).rejects.toThrow('Refusing to overwrite')
    expect(createCommitJournal).not.toHaveBeenCalled()
    expect(mutation).not.toHaveBeenCalled()
  })

  it('does not attempt a database mutation when the commit journal collides', async () => {
    const mutation = jest.fn()
    const { client } = mockArticleClient({ onMutation: mutation })
    const writeReport = jest.fn(async () => undefined)

    await expect(
      runPubmedMetadataBackfill(options({ commit: true }), {
        client,
        createCommitJournal: async () => {
          throw new Error('Refusing to overwrite existing PubMed commit journal')
        },
        efetchClient: { fetchPmids: jest.fn(async () => efetchResult()) },
        loadScope: async () => ({
          batchId: 'batch-id',
          batchName: 'gold-set-v1',
          datasetSplit: 'development',
          pmids: ['39414327'],
        }),
        writeReport,
      }),
    ).rejects.toThrow('Refusing to overwrite')
    expect(writeReport).toHaveBeenCalledTimes(1)
    expect(mutation).not.toHaveBeenCalled()
  })

  it('journals partial commit outcomes and the indeterminate failing row', async () => {
    const order: string[] = []
    const articles: ExistingPubmedMetadataRow[] = ['1', '2'].map((pmid) => ({
      pmid,
      mesh_terms: [],
      author_keywords: [],
      publication_types: [],
      languages: [],
      updated_at: UPDATED_AT,
    }))
    const { client } = mockArticleClient({
      articles,
      failUpdateAt: 1,
      onMutation: (pmid) => order.push(`database_update:${pmid}`),
    })
    const { createCommitJournal, entries } = commitJournalRecorder(order)

    await expect(
      runPubmedMetadataBackfill(options({ commit: true }), {
        client,
        createCommitJournal,
        efetchClient: {
          fetchPmids: jest.fn(async () => efetchResult([fetchedRecord('1'), fetchedRecord('2')])),
        },
        loadScope: async () => ({
          batchId: 'batch-id',
          batchName: 'gold-set-v1',
          datasetSplit: 'development',
          pmids: ['1', '2'],
        }),
        writeReport: async () => {
          order.push('plan_report')
        },
      }),
    ).rejects.toThrow('simulated update failure for 2')

    expect(entries.map((entry) => entry.event)).toEqual([
      'commit_started',
      'row_attempt',
      'row_applied',
      'row_attempt',
      'row_error',
      'commit_failed',
    ])
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'row_error', pmid: '2', outcome: 'indeterminate' }),
        expect.objectContaining({ event: 'commit_failed', appliedRows: 1 }),
      ]),
    )
    expect(order.indexOf('journal:row_attempt')).toBeLessThan(order.indexOf('database_update:1'))
    expect(order.at(-1)).toBe('journal_closed')
  })

  it('reports an optimistic conflict instead of treating a lost guard as applied', async () => {
    const { client } = mockArticleClient({ optimisticMatch: false })
    const { createCommitJournal, entries } = commitJournalRecorder()

    const { commitOutcome, report } = await runPubmedMetadataBackfill(options({ commit: true }), {
      client,
      createCommitJournal,
      efetchClient: { fetchPmids: jest.fn(async () => efetchResult()) },
      loadScope: async () => ({
        batchId: 'batch-id',
        batchName: 'gold-set-v1',
        datasetSplit: 'development',
        pmids: ['39414327'],
      }),
      writeReport: async () => undefined,
    })

    expect(report.counts.appliedRows).toBe(0)
    expect(report.optimisticGuardConflictPmids).toEqual([])
    expect(commitOutcome).toMatchObject({
      appliedRows: 0,
      optimisticGuardConflictPmids: ['39414327'],
    })
    expect(entries.map((entry) => entry.event)).toContain('row_optimistic_conflict')
  })
})
