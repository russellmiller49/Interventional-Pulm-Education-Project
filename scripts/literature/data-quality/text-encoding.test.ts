/** @jest-environment node */

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import fixture from '../../../tests/fixtures/literature/macroman-mojibake-v1.json'
import {
  TEXT_ENCODING_ARTICLE_SELECT,
  assertLocalTextEncodingTarget,
  writeTextEncodingAuditReport,
} from '../audit-text-encoding'
import {
  TEXT_ENCODING_REPAIR_AUDIT_SHA256,
  buildTextEncodingAudit,
  buildTextEncodingRepairPlans,
  classifyTextEncodingSpan,
  corruptUtf8AsMacRoman,
  scanTextEncoding,
  stableTextEncodingJson,
  type GoldSetDevelopmentTextEncodingScope,
  type TextEncodingArticleRow,
  type TextEncodingRepairRowPlan,
} from './text-encoding'
import {
  TEXT_ENCODING_UNDO_LOG_GENESIS_SHA256,
  assertPrimaryCheckoutPaths,
  assertSparseTextEncodingUpdate,
  buildSparseTextEncodingUpdate,
  openTextEncodingUndoLog,
  parseTextEncodingUndoLog,
  textEncodingUndoEventSha256,
  type TextEncodingSparseUpdate,
} from '../repair-text-encoding'

interface MojibakeFixture {
  expected: {
    cellCount: number
    replacementCount: number
    rowCount: number
    spanTypeCount: number
  }
  schemaVersion: string
  sourceAuditSha256: string
  spans: Array<{ clean: string; corrupt: string; count: number }>
}

const mojibakeFixture = fixture as MojibakeFixture
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

function syntheticCorpus() {
  const expandedSpans = mojibakeFixture.spans.flatMap((span) =>
    Array.from({ length: span.count }, () => span.corrupt),
  )
  const buckets = Array.from({ length: mojibakeFixture.expected.cellCount }, () => [] as string[])
  expandedSpans.forEach((span, index) => buckets[index % buckets.length].push(span))
  const candidate = (index: number) =>
    `ASCII prefix ${buckets[index].join(' separator ')} ASCII suffix`

  const rows: TextEncodingArticleRow[] = []
  for (let index = 0; index < mojibakeFixture.expected.rowCount; index += 1) {
    const pmid = String(10_000_001 + index)
    rows.push({
      abstract: index < 5 ? candidate(index * 2 + 1) : candidate(index + 5),
      pmid,
      title: index < 5 ? candidate(index * 2) : `Clean title ${pmid}`,
      updated_at: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    })
  }
  const scope: GoldSetDevelopmentTextEncodingScope = {
    batchId: '00000000-0000-4000-8000-000000000001',
    batchName: 'gold-set-v1',
    datasetSplit: 'development',
    pmids: rows.map((row) => row.pmid),
  }
  return { rows, scope }
}

function sampleRepairPlan(): TextEncodingRepairRowPlan {
  return {
    expectedUpdatedAt: '2026-08-04T12:00:00.000Z',
    fields: [
      {
        after: 'β title',
        afterSha256: 'a'.repeat(64),
        before: 'corrupt title',
        beforeSha256: 'b'.repeat(64),
        field: 'title',
        replacementCount: 1,
      },
      {
        after: 'clean abstract',
        afterSha256: 'c'.repeat(64),
        before: 'corrupt abstract',
        beforeSha256: 'd'.repeat(64),
        field: 'abstract',
        replacementCount: 2,
      },
    ],
    pmid: '12345678',
  }
}

describe('three-pass UTF-8 bytes interpreted as MacRoman repair', () => {
  it('reverses every supplied audit mapping and counts maximal spans', () => {
    expect(mojibakeFixture.schemaVersion).toBe('1.0.0')
    expect(mojibakeFixture.sourceAuditSha256).toBe(TEXT_ENCODING_REPAIR_AUDIT_SHA256)
    expect(mojibakeFixture.spans).toHaveLength(mojibakeFixture.expected.spanTypeCount)
    expect(mojibakeFixture.spans.reduce((sum, span) => sum + span.count, 0)).toBe(
      mojibakeFixture.expected.replacementCount,
    )

    for (const span of mojibakeFixture.spans) {
      expect(corruptUtf8AsMacRoman(span.clean, 3)).toBe(span.corrupt)
      expect(classifyTextEncodingSpan(span.corrupt)).toEqual({
        clean: span.clean,
        kind: 'repairable',
        reversePasses: 3,
        span: span.corrupt,
      })
      const scan = scanTextEncoding(`before ${span.corrupt} after`)
      expect(scan.status).toBe('repairable')
      expect(scan.repairedText).toBe(`before ${span.clean} after`)
      expect(scan.replacements).toHaveLength(1)
      expect(scan.replacements[0].beforeCodePoints[0]?.codePoint).toMatch(/^U\+/u)
      expect(scan.replacements[0].afterCodePoints).toHaveLength(Array.from(span.clean).length)
    }
  })

  it('preserves clean Unicode byte-for-byte when no reverse pass succeeds', () => {
    const clean = 'Café β 中文 😷 ™ — déjà vu'
    expect(scanTextEncoding(clean)).toEqual({
      candidateText: clean,
      refusals: [],
      repairedText: clean,
      replacements: [],
      status: 'clean',
    })
  })

  it('fails closed on partial and greater-than-three-pass corruption', () => {
    const onePass = classifyTextEncodingSpan(corruptUtf8AsMacRoman('®', 1))
    const twoPass = classifyTextEncodingSpan(corruptUtf8AsMacRoman('®', 2))
    const fourPass = classifyTextEncodingSpan(corruptUtf8AsMacRoman('®', 4))

    expect(onePass).toMatchObject({ kind: 'refused', reason: 'partial_one_pass_corruption' })
    expect(twoPass).toMatchObject({ kind: 'refused', reason: 'partial_two_pass_corruption' })
    expect(fourPass).toMatchObject({ kind: 'refused', reason: 'more_than_three_reverse_passes' })

    const mixed = scanTextEncoding(
      `${mojibakeFixture.spans[0].corrupt} and ${corruptUtf8AsMacRoman('®', 1)}`,
    )
    expect(mixed.status).toBe('refused')
    expect(mixed.repairedText).toBeNull()
    expect(mixed.replacements).toHaveLength(1)
    expect(mixed.refusals).toHaveLength(1)
  })

  it('fails closed when a clean maximal span hides a proper three-pass subspan', () => {
    const corruptSuffix = corruptUtf8AsMacRoman('®', 3)
    const hiddenCorruption = `β${corruptSuffix}`
    expect(classifyTextEncodingSpan(hiddenCorruption)).toMatchObject({
      kind: 'refused',
      reason: 'contains_three_pass_repairable_subspan',
      reversePasses: 0,
    })
    expect(classifyTextEncodingSpan(`${'β'.repeat(200)}${corruptSuffix}`)).toMatchObject({
      kind: 'refused',
      reason: 'contains_three_pass_repairable_subspan',
    })

    const scan = scanTextEncoding(`before ${hiddenCorruption} after`)
    expect(scan.status).toBe('refused')
    expect(scan.repairedText).toBeNull()
    expect(scan.replacements).toHaveLength(0)
    expect(scan.refusals).toHaveLength(1)
    expect(scan.refusals[0].reason).toBe('contains_three_pass_repairable_subspan')
  })
})

describe('development-only encoding audit', () => {
  it('reproduces the supplied 115-row, 120-cell, 429-span totals deterministically', () => {
    const { rows, scope } = syntheticCorpus()
    const first = buildTextEncodingAudit(rows, scope)
    const second = buildTextEncodingAudit([...rows].reverse(), {
      ...scope,
      pmids: [...scope.pmids].reverse(),
    })

    expect(first.counts).toMatchObject({
      candidateCells: mojibakeFixture.expected.cellCount,
      candidateRows: mojibakeFixture.expected.rowCount,
      refusedCells: 0,
      refusedSpans: 0,
      replacementSpans: mojibakeFixture.expected.replacementCount,
      rowsScanned: mojibakeFixture.expected.rowCount,
    })
    expect(first.cells).toHaveLength(mojibakeFixture.expected.cellCount)
    expect(first.provenance.repairAuditSha256).toBe(mojibakeFixture.sourceAuditSha256)
    expect(first.sourceSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(first.candidateSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(second.sourceSha256).toBe(first.sourceSha256)
    expect(second.candidateSha256).toBe(first.candidateSha256)
    expect(second.cells).toEqual(first.cells)
    expect(buildTextEncodingRepairPlans(rows, scope)).toHaveLength(
      mojibakeFixture.expected.rowCount,
    )
  })

  it('rejects held-out scope and queries no review or physician fields', () => {
    const { rows, scope } = syntheticCorpus()
    expect(() =>
      buildTextEncodingAudit(rows, {
        ...scope,
        datasetSplit: 'test',
      } as unknown as GoldSetDevelopmentTextEncodingScope),
    ).toThrow('restricted to the gold-set-v1 development split')

    expect(TEXT_ENCODING_ARTICLE_SELECT).toBe('pmid,title,abstract,updated_at')
    expect(TEXT_ENCODING_ARTICLE_SELECT).not.toMatch(
      /review|relevance|physician|dataset_split|metadata_hash/iu,
    )
  })

  it('writes a new mode-0600 audit artifact without overwriting or entering inputs', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'text-encoding-audit-'))
    temporaryRoots.push(workspaceRoot)
    await mkdir(join(workspaceRoot, 'local-data'), { recursive: true })
    const { rows, scope } = syntheticCorpus()
    const report = buildTextEncodingAudit(rows, scope)
    const output = 'local-data/literature/data-quality/audit.json'

    const written = await writeTextEncodingAuditReport(report, output, { workspaceRoot })
    expect(await readFile(written, 'utf8')).toBe(`${stableTextEncodingJson(report)}\n`)
    expect((await stat(written)).mode & 0o777).toBe(0o600)
    await expect(
      writeTextEncodingAuditReport(report, output, { workspaceRoot }),
    ).rejects.toMatchObject({ code: 'EEXIST' })
    await expect(
      writeTextEncodingAuditReport(report, 'local-data/inputs/audit.json', { workspaceRoot }),
    ).rejects.toThrow('read-only local-data/inputs')
    await expect(
      writeTextEncodingAuditReport(report, 'local-data/INPUTS/audit.json', { workspaceRoot }),
    ).rejects.toThrow('read-only local-data/inputs')
  })
})

describe('guarded sparse repair and undo log', () => {
  it('builds only title, abstract, and derived title-normalization fields', () => {
    const payload = buildSparseTextEncodingUpdate(sampleRepairPlan())
    expect(Object.keys(payload).sort()).toEqual([
      'abstract',
      'normalized_title',
      'normalized_title_hash',
      'title',
    ])
    expect(payload).not.toHaveProperty('metadata_hash')
    expect(payload).not.toHaveProperty('raw_tags')
    expect(payload).not.toHaveProperty('relevance_state')
    expect(() =>
      assertSparseTextEncodingUpdate({
        metadata_hash: 'forbidden',
      } as unknown as TextEncodingSparseUpdate),
    ).toThrow('non-sparse')
  })

  it('hard-rejects remote targets and commit mode outside the primary checkout', () => {
    expect(() => assertLocalTextEncodingTarget('remote')).toThrow('local-only')
    expect(() => assertPrimaryCheckoutPaths('/repo/.git', '/repo/.git')).not.toThrow()
    expect(() => assertPrimaryCheckoutPaths('/repo/.git/worktrees/codex-b', '/repo/.git')).toThrow(
      'primary checkout',
    )
  })

  it('appends planned-before-applied mode-0600 events with a verified hash chain', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'text-encoding-undo-'))
    temporaryRoots.push(workspaceRoot)
    await mkdir(join(workspaceRoot, 'local-data'), { recursive: true })
    const writer = await openTextEncodingUndoLog('local-data/literature/data-quality/undo.jsonl', {
      workspaceRoot,
    })
    const plan = sampleRepairPlan()
    const planned = await writer.append({
      eventType: 'repair_planned',
      payload: { expectedUpdatedAt: plan.expectedUpdatedAt, fields: plan.fields, pmid: plan.pmid },
      recordedAt: '2026-08-04T12:00:00.000Z',
      runId: 'run-1',
    })
    const applied = await writer.append({
      eventType: 'repair_applied',
      payload: { plannedEventSha256: planned.eventSha256, pmid: plan.pmid },
      recordedAt: '2026-08-04T12:00:01.000Z',
      runId: 'run-1',
    })
    await writer.close()

    const contents = await readFile(writer.path, 'utf8')
    const events = parseTextEncodingUndoLog(contents)
    expect(events).toEqual([planned, applied])
    expect(planned.sequence).toBe(1)
    expect(planned.previousEventSha256).toBe(TEXT_ENCODING_UNDO_LOG_GENESIS_SHA256)
    expect(applied.sequence).toBe(2)
    expect(applied.previousEventSha256).toBe(planned.eventSha256)
    expect(textEncodingUndoEventSha256(planned)).toBe(planned.eventSha256)
    expect((await stat(writer.path)).mode & 0o777).toBe(0o600)
    expect(() => parseTextEncodingUndoLog(contents.slice(0, -1))).toThrow('truncated final line')
  })

  it('holds an exclusive sidecar lock and fails closed on a stale lock', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'text-encoding-lock-'))
    temporaryRoots.push(workspaceRoot)
    await mkdir(join(workspaceRoot, 'local-data'), { recursive: true })
    const requestedPath = 'local-data/literature/data-quality/locked-undo.jsonl'
    const first = await openTextEncodingUndoLog(requestedPath, { workspaceRoot })

    expect((await stat(first.lockPath)).mode & 0o777).toBe(0o600)
    await expect(openTextEncodingUndoLog(requestedPath, { workspaceRoot })).rejects.toThrow(
      'lock already exists',
    )
    await first.close()
    await expect(stat(first.lockPath)).rejects.toMatchObject({ code: 'ENOENT' })

    const reopened = await openTextEncodingUndoLog(requestedPath, { workspaceRoot })
    await reopened.close()
    await writeFile(reopened.lockPath, 'stale lock\n', {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    await expect(openTextEncodingUndoLog(requestedPath, { workspaceRoot })).rejects.toThrow(
      'stale-lock recovery',
    )
    expect(await readFile(reopened.lockPath, 'utf8')).toBe('stale lock\n')
  })
})
