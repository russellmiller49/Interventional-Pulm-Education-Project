/** @jest-environment node */
import { lstat, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'

import { syntheticCorpusRecord, syntheticStageAOutput } from './fixtures'
import {
  appendJsonlRows,
  createOperation,
  readReviewDecisions,
  type OperationPaths,
} from './operation'
import { buildPacket, type OperationSalt } from './packet'
import {
  applyReviewFilters,
  loadReviewData,
  parseLoopbackHostHeader,
  startReviewServer,
  writeReviewExports,
  type ReviewRecordView,
} from './review-app'
import { resolveStateRoot, type StateRoot } from './state'

const SALT: OperationSalt = {
  version: 'literature-luna-record-id/1.0.0',
  saltHex: '4'.repeat(64),
}

let root: string
let state: StateRoot
let paths: OperationPaths
let negativeId: string
let flaggedId: string
let invalidId: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'luna-review-'))
  state = await resolveStateRoot(join(root, 'lane'))
  paths = await createOperation(state, 'op-review', 'locked-sanity-200', 'test', 'now')

  const negative = buildPacket(SALT, syntheticCorpusRecord('900000101', { title: 'Dental caries' }))
  const flagged = buildPacket(
    SALT,
    syntheticCorpusRecord('900000102', { title: 'Pleural effusion drainage', abstract: null }),
  )
  const invalid = buildPacket(SALT, syntheticCorpusRecord('900000103', { title: 'Crop rotation' }))
  negativeId = negative.mapping.recordId
  flaggedId = flagged.mapping.recordId
  invalidId = invalid.mapping.recordId

  await appendJsonlRows(paths.packetsJsonl, [negative.packet, flagged.packet, invalid.packet])
  await appendJsonlRows(paths.mappingJsonl, [negative.mapping, flagged.mapping, invalid.mapping])
  await appendJsonlRows(paths.riskFlagsJsonl, [
    { recordId: negativeId, riskFlags: [] },
    { recordId: flaggedId, riskFlags: flagged.riskFlags },
    { recordId: invalidId, riskFlags: [] },
  ])
  const negOutput = JSON.parse(
    syntheticStageAOutput(negativeId, 'obvious_irrelevant', 'high', [
      'clearly_nonpulmonary_domain',
    ]),
  ) as unknown
  const flaggedOutput = JSON.parse(
    syntheticStageAOutput(flaggedId, 'obvious_irrelevant', 'high', ['clearly_nonpulmonary_domain']),
  ) as unknown
  await appendJsonlRows(paths.terminalStatesJsonl, [
    {
      recordId: negativeId,
      state: 'valid_prediction',
      output: negOutput,
      responseSha256: null,
      detail: null,
    },
    {
      recordId: flaggedId,
      state: 'valid_prediction',
      output: flaggedOutput,
      responseSha256: null,
      detail: null,
    },
    {
      recordId: invalidId,
      state: 'invalid_quarantined',
      output: null,
      responseSha256: null,
      detail: 'output_schema_invalid',
    },
  ])
  await appendJsonlRows(paths.routedRecordsJsonl, [
    {
      recordId: negativeId,
      route: 'deprioritization_candidate',
      routeReasons: ['high_confidence_negative_with_negative_only_reasons_and_no_risk_flag'],
      terminalState: 'valid_prediction',
      evidenceProfile: 'metadata_with_abstract',
      riskFlags: [],
      mandatoryPhysicianReview: false,
    },
    {
      recordId: flaggedId,
      route: 'advance_to_full_relevance_classification',
      routeReasons: ['coordinator_risk_flag_present'],
      terminalState: 'valid_prediction',
      evidenceProfile: 'metadata_without_abstract',
      riskFlags: flagged.riskFlags,
      mandatoryPhysicianReview: true,
    },
    {
      recordId: invalidId,
      route: 'advance_to_full_relevance_classification',
      routeReasons: ['terminal_state_invalid_quarantined_advances_by_default'],
      terminalState: 'invalid_quarantined',
      evidenceProfile: 'metadata_with_abstract',
      riskFlags: [],
      mandatoryPhysicianReview: false,
    },
  ])
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('review data assembly', () => {
  it('joins packets, routing, outputs, and decisions into review cards', async () => {
    const data = await loadReviewData(state, 'op-review')
    expect(data.records).toHaveLength(3)
    const negative = data.records.find((record) => record.recordId === negativeId)
    expect(negative?.luna?.decision).toBe('obvious_irrelevant')
    expect(negative?.route).toBe('deprioritization_candidate')
    const flagged = data.records.find((record) => record.recordId === flaggedId)
    expect(flagged?.mandatoryReview).toBe(true)
    expect(flagged?.abstract).toBeNull()
    const invalid = data.records.find((record) => record.recordId === invalidId)
    expect(invalid?.luna).toBeNull()
    expect(invalid?.terminalState).toBe('invalid_quarantined')
  })
})

describe('review filters', () => {
  const base = {
    queue: 'all',
    review: 'all',
    triage: 'all',
    confidence: 'all',
    reason: 'all',
    profile: 'all',
    risk: 'all',
    journal: '',
    yearBand: 'all',
    pubType: 'all',
  }

  it('filters by queue, decision, profile, risk, journal, and year band', async () => {
    const data = await loadReviewData(state, 'op-review')
    const records: readonly ReviewRecordView[] = data.records
    expect(applyReviewFilters(records, { ...base, queue: 'negatives' })).toHaveLength(2)
    expect(applyReviewFilters(records, { ...base, queue: 'mandatory' })).toHaveLength(1)
    expect(applyReviewFilters(records, { ...base, triage: '(none)' })).toHaveLength(1)
    expect(
      applyReviewFilters(records, { ...base, profile: 'metadata_without_abstract' }),
    ).toHaveLength(1)
    expect(applyReviewFilters(records, { ...base, risk: '(any)' })).toHaveLength(1)
    expect(applyReviewFilters(records, { ...base, risk: '(none)' })).toHaveLength(2)
    expect(applyReviewFilters(records, { ...base, journal: 'synthetic' })).toHaveLength(3)
    expect(applyReviewFilters(records, { ...base, journal: 'zzz' })).toHaveLength(0)
    expect(applyReviewFilters(records, { ...base, yearBand: '2020s' })).toHaveLength(3)
    expect(applyReviewFilters(records, { ...base, review: 'undecided' })).toHaveLength(3)
  })
})

describe('loopback server', () => {
  it('serves the page, records create-once decisions, and enforces the Host allowlist', async () => {
    const review = await startReviewServer({
      state,
      operationId: 'op-review',
      port: 0,
      now: () => '2026-08-17T00:00:00.000Z',
    })
    try {
      const port = (review.server.address() as AddressInfo).port
      const origin = `http://127.0.0.1:${port}`

      const page = await fetch(`${origin}/`)
      expect(page.status).toBe(200)
      expect(await page.text()).toContain('Luna Stage-A physician review')

      // fetch() refuses to forge Host, so drive node:http directly for the spoof check.
      const { request } = await import('node:http')
      const foreignStatus = await new Promise<number>((resolvePromise, rejectPromise) => {
        const spoofed = request(
          {
            host: '127.0.0.1',
            port,
            path: '/api/records',
            method: 'GET',
            headers: { host: 'evil.example.com' },
          },
          (response) => {
            response.resume()
            resolvePromise(response.statusCode ?? 0)
          },
        )
        spoofed.on('error', rejectPromise)
        spoofed.end()
      })
      expect(foreignStatus).toBe(403)

      const records = await fetch(`${origin}/api/records?queue=all`)
      const payload = (await records.json()) as { total: number; filtered: number }
      expect(payload.total).toBe(3)

      const decision = await fetch(`${origin}/api/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recordId: negativeId,
          action: 'confirm_deprioritization_candidate',
        }),
      })
      expect(decision.status).toBe(200)
      const redo = await fetch(`${origin}/api/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recordId: negativeId, action: 'retain_for_stage_b' }),
      })
      expect(redo.status).toBe(200)
      const decisions = await readReviewDecisions(paths)
      expect(decisions.get(negativeId)?.action).toBe('retain_for_stage_b')
      expect(decisions.get(negativeId)?.revision).toBe(2)
      const files = await readdir(paths.reviewDecisionsDir)
      expect(files).toHaveLength(2)
      for (const file of files) {
        const stat = await lstat(join(paths.reviewDecisionsDir, file))
        expect(stat.mode & 0o777).toBe(0o600)
      }

      const rejected = await fetch(`${origin}/api/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recordId: 'f'.repeat(64), action: 'retain_for_stage_b' }),
      })
      expect(rejected.status).toBe(400)
    } finally {
      await review.close()
    }
  })
})

/**
 * LUNA-REVIEW-001. Host validation is whole-authority equality against three exact loopback
 * names, never a prefix test: the original reproduction, `localhost.evil.example`, is a foreign
 * host that merely starts with `localhost`.
 */
describe('loopback Host authority validation (LUNA-REVIEW-001)', () => {
  const accepted: readonly [string, string, number | null][] = [
    ['localhost', 'localhost', null],
    ['localhost:4630', 'localhost', 4630],
    ['127.0.0.1', '127.0.0.1', null],
    ['127.0.0.1:4630', '127.0.0.1', 4630],
    ['[::1]', '::1', null],
    ['[::1]:4630', '::1', 4630],
    ['::1', '::1', null],
    ['LOCALHOST:4630', 'localhost', 4630],
  ]

  it.each(accepted)('accepts %s', (header, hostname, port) => {
    expect(parseLoopbackHostHeader(header)).toEqual({ ok: true, hostname, port })
  })

  const rejected: readonly string[] = [
    'localhost.evil.example',
    'localhost.evil.example:4630',
    '127.0.0.1.evil.example',
    'localhost.',
    'localhostx',
    'user@localhost',
    'localhost@evil.example',
    'localhost ',
    ' localhost',
    'local\thost',
    'localhost\n',
    'localhost,evil.example',
    'localhost:4630,127.0.0.1:4630',
    '[::1',
    '::1]',
    '[::1]x',
    '[::1]:',
    '[[::1]]',
    '[::1]:0',
    '[::1]:65536',
    '[::1]:-1',
    '[::1]:+80',
    '[::1]:4a30',
    'localhost:0',
    'localhost:65536',
    'localhost:99999',
    'localhost:',
    'localhost:abc',
    '127.0.0.1:0',
    '*',
    '*.localhost',
    '0.0.0.0',
    '0.0.0.0:4630',
    '[::]',
    '[::]:4630',
    '[0:0:0:0:0:0:0:1]',
    '192.168.1.10',
    '10.0.0.1:4630',
    '127.0.0.2',
    'localhost/../evil',
    'http://localhost',
    '',
  ]

  it.each(rejected)('rejects %s', (header) => {
    expect(parseLoopbackHostHeader(header).ok).toBe(false)
  })

  it('rejects an absent Host header', () => {
    expect(parseLoopbackHostHeader(undefined).ok).toBe(false)
  })

  it('answers only loopback authorities over a real socket and stays bound to 127.0.0.1', async () => {
    const review = await startReviewServer({
      state,
      operationId: 'op-review',
      port: 0,
      now: () => '2026-08-17T00:00:00.000Z',
    })
    try {
      const address = review.server.address() as AddressInfo
      expect(address.address).toBe('127.0.0.1')
      const port = address.port
      const { request } = await import('node:http')
      const statusFor = (host: string) =>
        new Promise<number>((resolvePromise, rejectPromise) => {
          const probe = request(
            { host: '127.0.0.1', port, path: '/api/operation', method: 'GET', headers: { host } },
            (response) => {
              response.resume()
              resolvePromise(response.statusCode ?? 0)
            },
          )
          probe.on('error', rejectPromise)
          probe.end()
        })

      for (const host of [`localhost:${port}`, `127.0.0.1:${port}`, 'localhost', '[::1]', '::1']) {
        expect({ host, status: await statusFor(host) }).toEqual({ host, status: 200 })
      }
      for (const host of [
        'localhost.evil.example',
        `localhost.evil.example:${port}`,
        '127.0.0.1.evil.example',
        'localhost.',
        'evil.example',
        '0.0.0.0',
        '[::]',
        `user@localhost:${port}`,
      ]) {
        expect({ host, status: await statusFor(host) }).toEqual({ host, status: 403 })
      }
    } finally {
      await review.close()
    }
  })
})

describe('review exports', () => {
  it('writes the five create-once manifests with an audit receipt', async () => {
    const data = await loadReviewData(state, 'op-review')
    const decisions = new Map([
      [
        negativeId,
        {
          artifactVersion: 'literature-luna-review/1.0.0',
          operationId: 'op-review',
          recordId: negativeId,
          action: 'confirm_deprioritization_candidate' as const,
          revision: 1,
          decidedAt: 't',
        },
      ],
      [
        flaggedId,
        {
          artifactVersion: 'literature-luna-review/1.0.0',
          operationId: 'op-review',
          recordId: flaggedId,
          action: 'retain_for_stage_b' as const,
          revision: 1,
          decidedAt: 't',
        },
      ],
    ])
    const result = await writeReviewExports(data, decisions, '2026-08-17T01:02:03.000Z')
    expect(result.files).toHaveLength(5)
    const names = (await readdir(paths.reviewExportsDir)).sort()
    expect(names.some((name) => name.startsWith('physician-override-manifest-'))).toBe(true)
    expect(names.some((name) => name.startsWith('physician-confirmed-deprioritization-'))).toBe(
      true,
    )
    expect(names.some((name) => name.startsWith('physician-rescued-for-stage-b-'))).toBe(true)
    expect(names.some((name) => name.startsWith('systematic-miss-flags-'))).toBe(true)
    expect(names.some((name) => name.startsWith('review-audit-receipt-'))).toBe(true)
    for (const name of names) {
      const stat = await lstat(join(paths.reviewExportsDir, name))
      expect(stat.mode & 0o777).toBe(0o600)
    }
  })
})
