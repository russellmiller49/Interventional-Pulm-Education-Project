import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, open, unlink, type FileHandle } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeTitle, sha256 } from '@/features/literature/domain/text'

import {
  buildTextEncodingRepairPlans,
  sha256TextEncodingValue,
  stableTextEncodingJson,
  type TextEncodingAuditReport,
  type TextEncodingRepairRowPlan,
} from './data-quality/text-encoding'
import {
  assertLocalTextEncodingTarget,
  auditGoldSetV1DevelopmentTextEncoding,
  DEFAULT_TEXT_ENCODING_AUDIT_PATH,
  resolveSafeTextEncodingLocalDataPath,
  writeTextEncodingAuditReport,
} from './audit-text-encoding'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { createLiteratureReadClient, executeDatabaseCall } from './lib/database'

export const DEFAULT_TEXT_ENCODING_UNDO_LOG_PATH =
  'local-data/literature/data-quality/text-encoding-undo.jsonl'
export const TEXT_ENCODING_UNDO_LOG_SCHEMA_VERSION = '1.0.0'
export const TEXT_ENCODING_UNDO_LOG_GENESIS_SHA256 = '0'.repeat(64)

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const UNDO_EVENT_TYPES = ['repair_planned', 'repair_applied'] as const

const HELP = `
Dry-run or repair reversible title and abstract encoding corruption in the fixed gold-set-v1
development split.

Usage:
  npm run literature:repair-text-encoding -- [--dry-run] [--target local]
  npm run literature:repair-text-encoding -- --commit --target local

Options:
  --dry-run          Audit only; this is the default and performs no database writes.
  --commit           Apply optimistic sparse updates. Must run from the primary checkout.
  --target <value>   Must be local (default).
  --output <path>    New JSON audit report under local-data.
  --undo-log <path>  Append-only JSONL undo log under local-data.
  --help             Show this help.

Remote writes are not supported. A commit changes only title and/or abstract; title changes also
recompute normalized_title and normalized_title_hash. It never changes metadata_hash, raw tags,
relevance state, review rows, or physician fields.
`.trim()

export interface TextEncodingSparseUpdate {
  abstract?: string
  normalized_title?: string
  normalized_title_hash?: string
  title?: string
}

export type TextEncodingUndoEventType = (typeof UNDO_EVENT_TYPES)[number]

export interface TextEncodingUndoEventContent {
  eventType: TextEncodingUndoEventType
  payload: unknown
  previousEventSha256: string
  recordedAt: string
  runId: string
  schemaVersion: typeof TEXT_ENCODING_UNDO_LOG_SCHEMA_VERSION
  sequence: number
}

export interface TextEncodingUndoEvent extends TextEncodingUndoEventContent {
  eventSha256: string
}

export interface TextEncodingUndoEventInput {
  eventType: TextEncodingUndoEventType
  payload: unknown
  recordedAt?: string
  runId: string
}

interface OptimisticUpdateResult {
  pmid: string
  updatedAt: string
}

interface LiteratureArticleUpdateResult {
  pmid: unknown
  updated_at: unknown
}

interface TextEncodingUndoLogLock {
  device: number
  handle: FileHandle
  inode: number
  path: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  )
}

function textEncodingUndoEventContent(
  event: TextEncodingUndoEventContent,
): TextEncodingUndoEventContent {
  return {
    eventType: event.eventType,
    payload: event.payload,
    previousEventSha256: event.previousEventSha256,
    recordedAt: event.recordedAt,
    runId: event.runId,
    schemaVersion: event.schemaVersion,
    sequence: event.sequence,
  }
}

export function textEncodingUndoEventSha256(content: TextEncodingUndoEventContent) {
  return sha256TextEncodingValue(stableTextEncodingJson(textEncodingUndoEventContent(content)))
}

function parseUndoEvent(value: unknown, lineNumber: number): TextEncodingUndoEvent {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'eventSha256',
      'eventType',
      'payload',
      'previousEventSha256',
      'recordedAt',
      'runId',
      'schemaVersion',
      'sequence',
    ]) ||
    value.schemaVersion !== TEXT_ENCODING_UNDO_LOG_SCHEMA_VERSION ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 1 ||
    typeof value.previousEventSha256 !== 'string' ||
    !SHA256_PATTERN.test(value.previousEventSha256) ||
    typeof value.eventSha256 !== 'string' ||
    !SHA256_PATTERN.test(value.eventSha256) ||
    typeof value.eventType !== 'string' ||
    !UNDO_EVENT_TYPES.includes(value.eventType as TextEncodingUndoEventType) ||
    typeof value.recordedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.recordedAt)) ||
    typeof value.runId !== 'string' ||
    !value.runId
  ) {
    throw new Error(`Invalid text encoding undo-log event on line ${lineNumber}.`)
  }

  return value as unknown as TextEncodingUndoEvent
}

export function parseTextEncodingUndoLog(contents: string): TextEncodingUndoEvent[] {
  if (!contents) return []
  if (!contents.endsWith('\n')) {
    throw new Error('Text encoding undo log has a truncated final line.')
  }

  const events = contents
    .slice(0, -1)
    .split('\n')
    .map((line, index) => {
      if (!line) throw new Error(`Text encoding undo log has an empty line at ${index + 1}.`)
      try {
        return parseUndoEvent(JSON.parse(line) as unknown, index + 1)
      } catch (error: unknown) {
        if (error instanceof SyntaxError) {
          throw new Error(`Invalid JSON in text encoding undo log on line ${index + 1}.`)
        }
        throw error
      }
    })

  let previousEventSha256 = TEXT_ENCODING_UNDO_LOG_GENESIS_SHA256
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index + 1 || event.previousEventSha256 !== previousEventSha256) {
      throw new Error(`Broken text encoding undo-log chain on line ${index + 1}.`)
    }
    if (textEncodingUndoEventSha256(textEncodingUndoEventContent(event)) !== event.eventSha256) {
      throw new Error(`Invalid text encoding undo-log hash on line ${index + 1}.`)
    }
    previousEventSha256 = event.eventSha256
  }
  return events
}

async function acquireTextEncodingUndoLogLock(path: string): Promise<TextEncodingUndoLogLock> {
  let handle: FileHandle
  try {
    handle = await open(path, 'wx', 0o600)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(
        `Text encoding undo-log lock already exists: ${path}. Refusing concurrent or stale-lock recovery.`,
      )
    }
    throw error
  }

  try {
    await handle.chmod(0o600)
    await handle.writeFile(
      `${stableTextEncodingJson({
        acquiredAt: new Date().toISOString(),
        processId: process.pid,
        token: randomUUID(),
      })}\n`,
      'utf8',
    )
    await handle.sync()
    const metadata = await handle.stat()
    return {
      device: metadata.dev,
      handle,
      inode: metadata.ino,
      path,
    }
  } catch (error: unknown) {
    await handle.close()
    await unlink(path).catch(() => undefined)
    throw error
  }
}

async function releaseTextEncodingUndoLogLock(lock: TextEncodingUndoLogLock) {
  try {
    const current = await lstat(lock.path)
    if (current.dev !== lock.device || current.ino !== lock.inode) {
      throw new Error(
        `Text encoding undo-log lock was replaced while held; refusing to remove ${lock.path}.`,
      )
    }
    await unlink(lock.path)
  } finally {
    await lock.handle.close()
  }
}

export class TextEncodingUndoLogWriter {
  readonly lockPath: string
  readonly path: string
  #closed = false
  #handle: FileHandle
  #lastEventSha256: string
  #lock: TextEncodingUndoLogLock
  #sequence: number

  constructor(
    path: string,
    handle: FileHandle,
    lock: TextEncodingUndoLogLock,
    existingEvents: readonly TextEncodingUndoEvent[],
  ) {
    this.path = path
    this.lockPath = lock.path
    this.#handle = handle
    this.#lock = lock
    this.#sequence = existingEvents.length
    this.#lastEventSha256 =
      existingEvents.at(-1)?.eventSha256 ?? TEXT_ENCODING_UNDO_LOG_GENESIS_SHA256
  }

  async append(input: TextEncodingUndoEventInput): Promise<TextEncodingUndoEvent> {
    const content: TextEncodingUndoEventContent = {
      eventType: input.eventType,
      payload: input.payload,
      previousEventSha256: this.#lastEventSha256,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
      runId: input.runId,
      schemaVersion: TEXT_ENCODING_UNDO_LOG_SCHEMA_VERSION,
      sequence: this.#sequence + 1,
    }
    const event: TextEncodingUndoEvent = {
      ...content,
      eventSha256: textEncodingUndoEventSha256(content),
    }
    await this.#handle.appendFile(`${stableTextEncodingJson(event)}\n`, 'utf8')
    await this.#handle.sync()
    this.#sequence = event.sequence
    this.#lastEventSha256 = event.eventSha256
    return event
  }

  async close() {
    if (this.#closed) return
    this.#closed = true
    try {
      await this.#handle.close()
    } catch (error: unknown) {
      // A possibly-open log handle and an absent lock would permit a second writer. Leave the
      // sidecar in place so recovery requires explicit inspection.
      await this.#lock.handle.close().catch(() => undefined)
      throw error
    }
    await releaseTextEncodingUndoLogLock(this.#lock)
  }
}

export async function openTextEncodingUndoLog(
  requestedPath: string,
  options: { workspaceRoot?: string } = {},
) {
  if (extname(requestedPath).toLocaleLowerCase('en-US') !== '.jsonl') {
    throw new Error('Text encoding undo logs must use a .jsonl filename.')
  }
  const path = await resolveSafeTextEncodingLocalDataPath(requestedPath, options)
  await mkdir(dirname(path), { recursive: true })
  const verifiedPath = await resolveSafeTextEncodingLocalDataPath(path, options)
  const lockPath = await resolveSafeTextEncodingLocalDataPath(`${verifiedPath}.lock`, options)
  const lock = await acquireTextEncodingUndoLogLock(lockPath)
  let handle: FileHandle | null = null
  try {
    handle = await open(verifiedPath, 'a+', 0o600)
    await chmod(verifiedPath, 0o600)
    const existing = await handle.readFile({ encoding: 'utf8' })
    return new TextEncodingUndoLogWriter(
      verifiedPath,
      handle,
      lock,
      parseTextEncodingUndoLog(existing),
    )
  } catch (error: unknown) {
    if (handle) {
      try {
        await handle.close()
      } catch (closeError: unknown) {
        await lock.handle.close().catch(() => undefined)
        throw new AggregateError(
          [error, closeError],
          `Failed to close text encoding undo log; lock retained at ${lock.path}.`,
        )
      }
    }
    await releaseTextEncodingUndoLogLock(lock)
    throw error
  }
}

export function assertPrimaryCheckoutPaths(gitDirectory: string, commonDirectory: string) {
  if (resolve(gitDirectory) !== resolve(commonDirectory)) {
    throw new Error(
      'Text encoding commit mode must run from the primary checkout, not an agent worktree.',
    )
  }
}

export function assertPrimaryCheckout() {
  const gitDirectory = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
    encoding: 'utf8',
  }).trim()
  const commonDirectory = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { encoding: 'utf8' },
  ).trim()
  assertPrimaryCheckoutPaths(gitDirectory, commonDirectory)
}

export function assertSparseTextEncodingUpdate(payload: TextEncodingSparseUpdate) {
  const keys = Object.keys(payload)
  const allowedKeys = new Set(['abstract', 'normalized_title', 'normalized_title_hash', 'title'])
  if (keys.length === 0 || keys.some((key) => !allowedKeys.has(key))) {
    throw new Error('Text encoding repair produced an empty or non-sparse article update.')
  }
  if (payload.title === undefined) {
    if (payload.normalized_title !== undefined || payload.normalized_title_hash !== undefined) {
      throw new Error('Normalized title fields require a repaired title.')
    }
  } else {
    const normalizedTitle = normalizeTitle(payload.title)
    if (
      payload.normalized_title !== normalizedTitle ||
      payload.normalized_title_hash !== sha256(normalizedTitle)
    ) {
      throw new Error('Repaired title normalization fields are missing or inconsistent.')
    }
  }
}

export function buildSparseTextEncodingUpdate(
  plan: TextEncodingRepairRowPlan,
): TextEncodingSparseUpdate {
  const payload: TextEncodingSparseUpdate = {}
  for (const field of plan.fields) {
    if (field.field === 'abstract') {
      if (payload.abstract !== undefined)
        throw new Error(`Duplicate abstract plan for ${plan.pmid}.`)
      payload.abstract = field.after
      continue
    }
    if (payload.title !== undefined) throw new Error(`Duplicate title plan for ${plan.pmid}.`)
    const normalizedTitle = normalizeTitle(field.after)
    payload.title = field.after
    payload.normalized_title = normalizedTitle
    payload.normalized_title_hash = sha256(normalizedTitle)
  }
  assertSparseTextEncodingUpdate(payload)
  return payload
}

export async function applyOptimisticTextEncodingUpdate(
  client: SupabaseClient,
  plan: TextEncodingRepairRowPlan,
): Promise<OptimisticUpdateResult> {
  const payload = buildSparseTextEncodingUpdate(plan)
  const rows = await executeDatabaseCall<LiteratureArticleUpdateResult[]>(
    `Optimistic text encoding update for PMID ${plan.pmid}`,
    () =>
      client
        .from('literature_articles')
        .update(payload)
        .eq('pmid', plan.pmid)
        .eq('updated_at', plan.expectedUpdatedAt)
        .select('pmid,updated_at'),
    1,
  )
  if (
    rows?.length !== 1 ||
    String(rows[0]?.pmid ?? '') !== plan.pmid ||
    typeof rows[0]?.updated_at !== 'string'
  ) {
    throw new Error(
      `Optimistic text encoding update for PMID ${plan.pmid} matched no current row; no further repairs were applied.`,
    )
  }
  return { pmid: plan.pmid, updatedAt: rows[0].updated_at }
}

function repairPlannedPayload(report: TextEncodingAuditReport, plan: TextEncodingRepairRowPlan) {
  return {
    candidateSha256: report.candidateSha256,
    expectedUpdatedAt: plan.expectedUpdatedAt,
    fields: plan.fields,
    pmid: plan.pmid,
    repairAuditSha256: report.provenance.repairAuditSha256,
    sourceSha256: report.sourceSha256,
  }
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, ['commit', 'dry-run', 'help', 'output', 'target', 'undo-log'])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }
  if (arguments_.values.has('commit') || arguments_.values.has('dry-run')) {
    throw new Error('--commit and --dry-run are flags and do not accept values.')
  }

  const commit = hasFlag(arguments_, 'commit')
  if (commit && hasFlag(arguments_, 'dry-run')) {
    throw new Error('Choose either --dry-run or --commit, not both.')
  }
  assertLocalTextEncodingTarget(stringArgument(arguments_, 'target', 'local'))
  if (commit) assertPrimaryCheckout()

  const client = createLiteratureReadClient(arguments_)
  const { report, rows, scope } = await auditGoldSetV1DevelopmentTextEncoding(client)
  const output = await writeTextEncodingAuditReport(
    report,
    stringArgument(arguments_, 'output', DEFAULT_TEXT_ENCODING_AUDIT_PATH),
  )
  if (report.counts.refusedSpans > 0) {
    throw new Error(
      `Refusing text encoding repair: audit found ${report.counts.refusedSpans} ambiguous or non-reversible span(s). Audit: ${output}`,
    )
  }

  const plans = buildTextEncodingRepairPlans(rows, scope)
  console.log(`Mode: ${commit ? 'COMMIT' : 'dry-run (no database writes)'}`)
  console.log(`Rows scanned: ${report.counts.rowsScanned}`)
  console.log(`Rows planned: ${plans.length}`)
  console.log(`Replacement spans: ${report.counts.replacementSpans}`)
  console.log(`Source SHA-256: ${report.sourceSha256}`)
  console.log(`Candidate SHA-256: ${report.candidateSha256}`)
  console.log(`Audit report: ${output}`)
  if (!commit) return

  const runId = randomUUID()
  const undoLog = await openTextEncodingUndoLog(
    stringArgument(arguments_, 'undo-log', DEFAULT_TEXT_ENCODING_UNDO_LOG_PATH),
  )
  try {
    for (const plan of plans) {
      const planned = await undoLog.append({
        eventType: 'repair_planned',
        payload: repairPlannedPayload(report, plan),
        runId,
      })
      const applied = await applyOptimisticTextEncodingUpdate(client, plan)
      await undoLog.append({
        eventType: 'repair_applied',
        payload: {
          candidateSha256: report.candidateSha256,
          plannedEventSha256: planned.eventSha256,
          pmid: applied.pmid,
          sourceSha256: report.sourceSha256,
          updatedAt: applied.updatedAt,
        },
        runId,
      })
    }
  } finally {
    await undoLog.close()
  }
  console.log(`Applied rows: ${plans.length}`)
  console.log(`Undo log: ${undoLog.path}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
