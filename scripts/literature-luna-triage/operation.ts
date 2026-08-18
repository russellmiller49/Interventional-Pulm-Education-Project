import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { validateUniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import type { CoordinatorRiskFlag } from '../../src/features/literature/classifier/risk-lexicon'
import { canonicalJson } from '../literature-production-ingest/canonical'
import { LUNA_TRIAGE_LANE_VERSION, type LunaCohort, type LunaReviewAction } from './constants'
import type { RecordIdMappingRow } from './packet'
import type { TerminalAssignment } from './results'
import type { RoutedRecord } from './routing'
import {
  appendJournalLine,
  createJournal,
  ensureStateDirectory,
  exclusiveWriteFile,
  readJournalLines,
  readRegularFile,
  resolveInsideRoot,
  type StateRoot,
} from './state'

/**
 * Operation directory lifecycle. One operation owns one cohort's artifacts, in a mode-0700
 * directory of mode-0600 files, all create-once or append-only journals. Loaders re-validate
 * shape on the way back in: an operation directory is owner-controlled but never blindly
 * trusted.
 */

export const OPERATION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u

export interface OperationPaths {
  readonly root: string
  readonly operationJson: string
  readonly saltJson: string
  readonly packetsJsonl: string
  readonly mappingJsonl: string
  readonly riskFlagsJsonl: string
  readonly packetManifestJson: string
  readonly requestsJsonl: string
  readonly requestManifestJson: string
  readonly rawResponsesDir: string
  readonly quarantineDir: string
  readonly ledgerJsonl: string
  readonly terminalStatesJsonl: string
  readonly ingestionReportJson: string
  readonly routedRecordsJsonl: string
  readonly routingManifestJson: string
  readonly stageBQueueJsonl: string
  readonly reviewQueueJson: string
  readonly reviewDecisionsDir: string
  readonly reviewExportsDir: string
  readonly evaluationReportJson: string
  readonly qualificationReportJson: string
  readonly auditSampleJson: string
  readonly batchShardsDir: string
  readonly batchReceiptsDir: string
  readonly batchRawDir: string
}

export function operationPaths(state: StateRoot, operationId: string): OperationPaths {
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw new Error(
      'The operation id must be a short lowercase identifier (letters, digits, hyphens).',
    )
  }
  const root = resolveInsideRoot(state, 'ops', operationId)
  return {
    root,
    operationJson: join(root, 'operation.json'),
    saltJson: join(root, 'salt.json'),
    packetsJsonl: join(root, 'packets.jsonl'),
    mappingJsonl: join(root, 'mapping.jsonl'),
    riskFlagsJsonl: join(root, 'risk-flags.jsonl'),
    packetManifestJson: join(root, 'packet-manifest.json'),
    requestsJsonl: join(root, 'requests.jsonl'),
    requestManifestJson: join(root, 'request-manifest.json'),
    rawResponsesDir: join(root, 'responses', 'raw'),
    quarantineDir: join(root, 'responses', 'quarantine'),
    ledgerJsonl: join(root, 'ledger.jsonl'),
    terminalStatesJsonl: join(root, 'results', 'terminal-states.jsonl'),
    ingestionReportJson: join(root, 'results', 'ingestion-report.json'),
    routedRecordsJsonl: join(root, 'routing', 'routed-records.jsonl'),
    routingManifestJson: join(root, 'routing', 'routing-manifest.json'),
    stageBQueueJsonl: join(root, 'routing', 'stage-b-queue.jsonl'),
    reviewQueueJson: join(root, 'review-queue.json'),
    reviewDecisionsDir: join(root, 'review', 'decisions'),
    reviewExportsDir: join(root, 'review', 'exports'),
    evaluationReportJson: join(root, 'evaluation', 'evaluation-report.json'),
    qualificationReportJson: join(root, 'qualification', 'qualification-report.json'),
    auditSampleJson: join(root, 'audit', 'audit-sample.json'),
    batchShardsDir: join(root, 'batch', 'shards'),
    batchReceiptsDir: join(root, 'batch', 'receipts'),
    batchRawDir: join(root, 'batch', 'raw'),
  }
}

export interface OperationMetadata {
  readonly laneVersion: string
  readonly operationId: string
  readonly cohort: LunaCohort
  readonly createdAt: string
  readonly purpose: string
}

export async function createOperation(
  state: StateRoot,
  operationId: string,
  cohort: LunaCohort,
  purpose: string,
  createdAt: string,
): Promise<OperationPaths> {
  const paths = operationPaths(state, operationId)
  await ensureStateDirectory(state, 'ops')
  await ensureStateDirectory(state, 'ops', operationId)
  for (const child of [
    ['responses', 'raw'],
    ['responses', 'quarantine'],
    ['results'],
    ['routing'],
    ['review', 'decisions'],
    ['review', 'exports'],
    ['evaluation'],
    ['qualification'],
    ['audit'],
    ['batch', 'shards'],
    ['batch', 'receipts'],
    ['batch', 'raw'],
  ] as const) {
    await ensureStateDirectory(state, 'ops', operationId, ...child)
  }
  const metadata: OperationMetadata = {
    laneVersion: LUNA_TRIAGE_LANE_VERSION,
    operationId,
    cohort,
    createdAt,
    purpose,
  }
  await exclusiveWriteFile(paths.operationJson, `${canonicalJson(metadata)}\n`)
  return paths
}

export async function loadOperationMetadata(paths: OperationPaths): Promise<OperationMetadata> {
  const parsed = JSON.parse(await readRegularFile(paths.operationJson)) as OperationMetadata
  if (parsed.laneVersion !== LUNA_TRIAGE_LANE_VERSION || !parsed.operationId) {
    throw new Error('The operation metadata is missing or from another lane version.')
  }
  return parsed
}

export async function readPackets(paths: OperationPaths): Promise<UniversalPacket[]> {
  const lines = await readJournalLines(paths.packetsJsonl)
  return lines.map((line) => {
    const validation = validateUniversalPacket(line)
    if (!validation.ok) {
      throw new Error(`A stored packet failed re-validation: ${validation.issues.join('; ')}`)
    }
    return validation.packet
  })
}

export async function readMapping(paths: OperationPaths): Promise<RecordIdMappingRow[]> {
  const lines = await readJournalLines(paths.mappingJsonl)
  return lines.map((line) => {
    const row = line as RecordIdMappingRow
    if (
      typeof row.recordId !== 'string' ||
      typeof row.pmid !== 'string' ||
      typeof row.contentSha256 !== 'string'
    ) {
      throw new Error('A mapping row is malformed.')
    }
    return row
  })
}

export interface RiskFlagRow {
  readonly recordId: string
  readonly riskFlags: readonly CoordinatorRiskFlag[]
}

export async function readRiskFlags(paths: OperationPaths): Promise<RiskFlagRow[]> {
  const lines = await readJournalLines(paths.riskFlagsJsonl)
  return lines.map((line) => {
    const row = line as RiskFlagRow
    if (typeof row.recordId !== 'string' || !Array.isArray(row.riskFlags)) {
      throw new Error('A risk-flag row is malformed.')
    }
    return row
  })
}

export interface StoredRequestRow {
  readonly customId: string
  readonly bodySha256: string
  readonly body: Record<string, unknown>
}

export async function readRequests(paths: OperationPaths): Promise<StoredRequestRow[]> {
  const lines = await readJournalLines(paths.requestsJsonl)
  return lines.map((line) => {
    const row = line as StoredRequestRow
    if (
      typeof row.customId !== 'string' ||
      typeof row.bodySha256 !== 'string' ||
      !row.body ||
      typeof row.body !== 'object'
    ) {
      throw new Error('A stored request row is malformed.')
    }
    return row
  })
}

export async function readTerminalStates(paths: OperationPaths): Promise<TerminalAssignment[]> {
  const lines = await readJournalLines(paths.terminalStatesJsonl)
  return lines.map((line) => line as TerminalAssignment)
}

export async function readRoutedRecords(paths: OperationPaths): Promise<RoutedRecord[]> {
  const lines = await readJournalLines(paths.routedRecordsJsonl)
  return lines.map((line) => line as RoutedRecord)
}

/** Raw responses stored one file per record: `<customId>.json`, create-once. */
export async function listRawResponseIds(paths: OperationPaths): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(paths.rawResponsesDir)
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => entry.slice(0, -'.json'.length))
    .sort()
}

export interface ReviewDecisionRecord {
  readonly artifactVersion: string
  readonly operationId: string
  readonly recordId: string
  readonly action: LunaReviewAction
  readonly revision: number
  readonly decidedAt: string
}

/** Latest revision wins; each revision file is create-once. */
export async function readReviewDecisions(
  paths: OperationPaths,
): Promise<Map<string, ReviewDecisionRecord>> {
  let entries: string[]
  try {
    entries = await readdir(paths.reviewDecisionsDir)
  } catch {
    return new Map()
  }
  const latest = new Map<string, ReviewDecisionRecord>()
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.json')) continue
    const parsed = JSON.parse(
      await readRegularFile(join(paths.reviewDecisionsDir, entry)),
    ) as ReviewDecisionRecord
    if (typeof parsed.recordId !== 'string' || typeof parsed.revision !== 'number') {
      throw new Error('A review decision artifact is malformed.')
    }
    const existing = latest.get(parsed.recordId)
    if (!existing || parsed.revision > existing.revision) {
      latest.set(parsed.recordId, parsed)
    }
  }
  return latest
}

export async function appendJsonlRows(path: string, rows: readonly unknown[]): Promise<void> {
  await createJournal(path)
  for (const row of rows) {
    await appendJournalLine(path, canonicalJson(row))
  }
}
