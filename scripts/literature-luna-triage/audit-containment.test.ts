/** @jest-environment node */
import { chmod, mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { canonicalJson } from '../literature-production-ingest/canonical'
import { syntheticCorpusRecord, syntheticStageAOutput } from './fixtures'
import { appendJsonlRows, createOperation, operationPaths, type OperationPaths } from './operation'
import { buildPacket, type OperationSalt } from './packet'
import { loadReviewData } from './review-app'
import { StatePathError, resolveStateRoot, type StateRoot } from './state'

/**
 * The audit sample is read with the same root-down containment guarantees as every other
 * operation artifact.
 *
 * The reproduction: the operation's `audit/` directory was replaced with a symbolic link to a
 * directory outside the state root, an `audit-sample.json` was placed there, and the review app
 * followed the link and marked an externally chosen record as sampled. The read passed no
 * `StateRoot` and caught *every* error as "no audit sample", so a containment failure was
 * indistinguishable from absence.
 *
 * Absence stays optional. Everything else — a symlinked component, an external target, a
 * malformed file, wrong permissions, a path error — must refuse.
 */

const SALT: OperationSalt = {
  version: 'literature-luna-record-id/1.0.0',
  saltHex: '3'.repeat(64),
}

let root: string
let state: StateRoot
let paths: OperationPaths
let sampledId: string
let otherId: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'luna-audit-'))
  state = await resolveStateRoot(join(root, 'lane'))
  paths = await createOperation(state, 'op-audit', 'pilot-1000', 'test', 'now')

  const sampled = buildPacket(SALT, syntheticCorpusRecord('900000401', { title: 'Dental caries' }))
  const other = buildPacket(SALT, syntheticCorpusRecord('900000402', { title: 'Crop rotation' }))
  sampledId = sampled.mapping.recordId
  otherId = other.mapping.recordId

  await appendJsonlRows(paths.packetsJsonl, [sampled.packet, other.packet])
  await appendJsonlRows(paths.mappingJsonl, [sampled.mapping, other.mapping])
  const output = (recordId: string): unknown =>
    JSON.parse(
      syntheticStageAOutput(recordId, 'obvious_irrelevant', 'high', [
        'clearly_nonpulmonary_domain',
      ]),
    ) as unknown
  await appendJsonlRows(paths.terminalStatesJsonl, [
    {
      recordId: sampledId,
      state: 'valid_prediction',
      output: output(sampledId),
      responseSha256: null,
      detail: null,
    },
    {
      recordId: otherId,
      state: 'valid_prediction',
      output: output(otherId),
      responseSha256: null,
      detail: null,
    },
  ])
  await appendJsonlRows(
    paths.routedRecordsJsonl,
    [sampledId, otherId].map((recordId) => ({
      recordId,
      route: 'deprioritization_candidate',
      routeReasons: ['high_confidence_negative_with_negative_only_reasons_and_no_risk_flag'],
      terminalState: 'valid_prediction',
      evidenceProfile: 'metadata_with_abstract',
      riskFlags: [],
      mandatoryPhysicianReview: false,
    })),
  )
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function auditSampleBody(recordIds: readonly string[]): string {
  return `${canonicalJson({
    version: 'literature-luna-audit-sample/1.0.0',
    requestedSize: recordIds.length,
    poolSize: recordIds.length,
    strataCounts: {},
    entries: recordIds.map((recordId) => ({ recordId, stratum: 'synthetic' })),
  })}\n`
}

async function writeContainedSample(recordIds: readonly string[]): Promise<void> {
  await writeFile(paths.auditSampleJson, auditSampleBody(recordIds), { mode: 0o600 })
}

/** Point the operation's `audit/` directory at a directory outside the state root. */
async function externalAuditDirectory(recordIds: readonly string[]): Promise<string> {
  const external = join(root, 'outside-audit')
  await mkdir(external, { recursive: true, mode: 0o700 })
  await writeFile(join(external, 'audit-sample.json'), auditSampleBody(recordIds), { mode: 0o600 })
  const auditDir = dirname(paths.auditSampleJson)
  await rm(auditDir, { recursive: true, force: true })
  await symlink(external, auditDir)
  return external
}

describe('an absent audit sample stays optional', () => {
  it('loads the operation and marks nothing sampled', async () => {
    const data = await loadReviewData(state, 'op-audit')
    expect(data.records).toHaveLength(2)
    for (const record of data.records) expect(record.inAuditSample).toBe(false)
  })
})

describe('a contained audit sample is honored', () => {
  it('marks exactly the sampled record', async () => {
    await writeContainedSample([sampledId])
    const data = await loadReviewData(state, 'op-audit')
    const byId = new Map(data.records.map((record) => [record.recordId, record.inAuditSample]))
    expect(byId.get(sampledId)).toBe(true)
    expect(byId.get(otherId)).toBe(false)
  })
})

describe('containment failures refuse rather than read as absence', () => {
  it('refuses a symlinked audit directory and marks no external record', async () => {
    await externalAuditDirectory([otherId])
    await expect(loadReviewData(state, 'op-audit')).rejects.toThrow(StatePathError)
  })

  it('refuses a symlinked ancestor above the operation', async () => {
    const opsDir = join(state.root, 'ops')
    await rename(opsDir, join(root, 'moved-ops'))
    await symlink(join(root, 'moved-ops'), opsDir)
    await expect(loadReviewData(state, 'op-audit')).rejects.toThrow(StatePathError)
  })

  it('refuses a symlinked audit-sample leaf', async () => {
    const external = join(root, 'external-sample.json')
    await writeFile(external, auditSampleBody([otherId]), { mode: 0o600 })
    await symlink(external, paths.auditSampleJson)
    await expect(loadReviewData(state, 'op-audit')).rejects.toThrow(StatePathError)
  })

  it('refuses an audit directory swapped for a link after a first successful load', async () => {
    await writeContainedSample([sampledId])
    const first = await loadReviewData(state, 'op-audit')
    expect(first.records.some((record) => record.inAuditSample)).toBe(true)
    await externalAuditDirectory([otherId])
    await expect(loadReviewData(state, 'op-audit')).rejects.toThrow(StatePathError)
  })

  it('refuses a malformed audit sample instead of silently ignoring it', async () => {
    await writeFile(paths.auditSampleJson, 'not json at all\n', { mode: 0o600 })
    await expect(loadReviewData(state, 'op-audit')).rejects.toThrow()
  })

  it('refuses an audit sample whose shape is wrong', async () => {
    await writeFile(paths.auditSampleJson, `${canonicalJson({ entries: 'all' })}\n`, {
      mode: 0o600,
    })
    await expect(loadReviewData(state, 'op-audit')).rejects.toThrow(/audit sample/iu)
  })

  it('refuses an audit sample with wrong permissions', async () => {
    await writeContainedSample([sampledId])
    await chmod(paths.auditSampleJson, 0o644)
    await expect(loadReviewData(state, 'op-audit')).rejects.toThrow(StatePathError)
  })

  it('refuses a traversing operation id before any path is opened', () => {
    expect(() => operationPaths(state, '../escape')).toThrow(/short lowercase identifier/u)
  })
})
