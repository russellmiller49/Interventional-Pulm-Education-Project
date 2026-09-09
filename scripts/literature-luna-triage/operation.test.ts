/** @jest-environment node */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson } from '../literature-production-ingest/canonical'
import { syntheticCorpusRecord } from './fixtures'
import {
  appendJsonlRows,
  createOperation,
  loadOperationMetadata,
  operationPaths,
  readMapping,
  readPackets,
  readReviewDecisions,
  readRiskFlags,
  type ReviewDecisionRecord,
} from './operation'
import { buildPacket, type OperationSalt } from './packet'
import { exclusiveWriteFile, resolveStateRoot, type StateRoot } from './state'

const SALT: OperationSalt = {
  version: 'literature-luna-record-id/1.0.0',
  saltHex: '3'.repeat(64),
}

let root: string
let state: StateRoot

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'luna-op-'))
  state = await resolveStateRoot(join(root, 'lane'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('operation lifecycle', () => {
  it('creates the layout once and refuses recreation', async () => {
    const paths = await createOperation(state, 'op-alpha', 'smoke-30', 'test', 'now')
    const metadata = await loadOperationMetadata(paths)
    expect(metadata.operationId).toBe('op-alpha')
    expect(metadata.cohort).toBe('smoke-30')
    await expect(createOperation(state, 'op-alpha', 'smoke-30', 'test', 'now')).rejects.toThrow(
      /not overwritten/u,
    )
  })

  it('rejects malformed operation ids', () => {
    expect(() => operationPaths(state, 'Bad Id!')).toThrow(/lowercase identifier/u)
  })

  it('round-trips packets, mappings, and risk flags with re-validation', async () => {
    const paths = await createOperation(state, 'op-beta', 'smoke-30', 'test', 'now')
    const built = buildPacket(SALT, syntheticCorpusRecord('900000070'))
    await appendJsonlRows(paths.packetsJsonl, [built.packet])
    await appendJsonlRows(paths.mappingJsonl, [built.mapping])
    await appendJsonlRows(paths.riskFlagsJsonl, [
      { recordId: built.mapping.recordId, riskFlags: built.riskFlags },
    ])
    expect(await readPackets(paths)).toEqual([built.packet])
    expect(await readMapping(paths)).toEqual([built.mapping])
    expect((await readRiskFlags(paths))[0].recordId).toBe(built.mapping.recordId)
  })

  it('rejects stored packets that no longer pass the firewall', async () => {
    const paths = await createOperation(state, 'op-gamma', 'smoke-30', 'test', 'now')
    await appendJsonlRows(paths.packetsJsonl, [{ pmid: '123', title: 'leak' }])
    await expect(readPackets(paths)).rejects.toThrow()
  })

  it('returns the latest review-decision revision per record', async () => {
    const paths = await createOperation(state, 'op-delta', 'smoke-30', 'test', 'now')
    const recordId = 'a'.repeat(64)
    const first: ReviewDecisionRecord = {
      artifactVersion: 'literature-luna-review/1.0.0',
      operationId: 'op-delta',
      recordId,
      action: 'retain_for_stage_b',
      revision: 1,
      decidedAt: 't1',
    }
    const second: ReviewDecisionRecord = { ...first, action: 'flag_systematic_miss', revision: 2 }
    await exclusiveWriteFile(
      join(paths.reviewDecisionsDir, `${recordId}.r0001.json`),
      `${canonicalJson(first)}\n`,
    )
    await exclusiveWriteFile(
      join(paths.reviewDecisionsDir, `${recordId}.r0002.json`),
      `${canonicalJson(second)}\n`,
    )
    const decisions = await readReviewDecisions(paths)
    expect(decisions.get(recordId)?.action).toBe('flag_systematic_miss')
    expect(decisions.get(recordId)?.revision).toBe(2)
  })
})
