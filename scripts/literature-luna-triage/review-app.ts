import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { join } from 'node:path'

import type { UniversalPacket } from '../../src/features/literature/classifier/packet-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_REVIEW_ACTIONS,
  LUNA_REVIEW_APP_HOST,
  LUNA_REVIEW_ARTIFACT_VERSION,
  type LunaReviewAction,
} from './constants'
import { yearBandOf } from './corpus'
import {
  loadOperationMetadata,
  operationPaths,
  readPackets,
  readReviewDecisions,
  readRoutedRecords,
  readTerminalStates,
  type OperationPaths,
  type ReviewDecisionRecord,
} from './operation'
import { reviewPageHtml } from './review-page'
import type { RoutedRecord } from './routing'
import { exclusiveWriteFile, readRegularFile, type StateRoot } from './state'

/**
 * Loopback-only local physician-review application.
 *
 * Binds to 127.0.0.1 exclusively, needs no Supabase connection and no API key, reads only
 * operation-owned validated artifacts, and writes create-once mode-0600 review artifacts. It
 * is a plain node HTTP server serving one embedded page — never a Next.js route, never
 * exposed, never a writer to any database or to physician-reviewed production truth.
 */

export interface ReviewRecordView {
  readonly recordId: string
  readonly title: string
  readonly abstract: string | null
  readonly journal: string | null
  readonly publicationYear: number | null
  readonly publicationTypes: readonly string[]
  readonly meshTerms: readonly string[]
  readonly keywords: readonly string[]
  readonly language: string | null
  readonly evidenceProfile: string
  readonly luna: {
    readonly decision: string
    readonly confidenceBand: string
    readonly reasonCodes: readonly string[]
  } | null
  readonly terminalState: string
  readonly route: string
  readonly riskFlags: readonly string[]
  readonly mandatoryReview: boolean
  readonly inAuditSample: boolean
  decision: { action: LunaReviewAction; revision: number; decidedAt: string } | null
}

export interface ReviewData {
  readonly operationId: string
  readonly cohort: string
  readonly records: ReviewRecordView[]
  readonly paths: OperationPaths
}

async function readAuditSampleIds(paths: OperationPaths): Promise<Set<string>> {
  try {
    const parsed = JSON.parse(await readRegularFile(paths.auditSampleJson)) as {
      entries?: readonly { recordId?: string }[]
    }
    return new Set(
      (parsed.entries ?? [])
        .map((entry) => entry.recordId)
        .filter((value): value is string => typeof value === 'string'),
    )
  } catch {
    return new Set()
  }
}

export async function loadReviewData(state: StateRoot, operationId: string): Promise<ReviewData> {
  const paths = operationPaths(state, operationId)
  const metadata = await loadOperationMetadata(paths)
  const packets = await readPackets(paths)
  const routed = await readRoutedRecords(paths)
  const terminal = await readTerminalStates(paths)
  const decisions = await readReviewDecisions(paths)
  const auditSample = await readAuditSampleIds(paths)

  const packetById = new Map<string, UniversalPacket>(
    packets.map((packet) => [packet.record_id, packet]),
  )
  const terminalById = new Map(terminal.map((assignment) => [assignment.recordId, assignment]))
  const records: ReviewRecordView[] = routed.map((record: RoutedRecord) => {
    const packet = packetById.get(record.recordId)
    if (!packet) {
      throw new Error('A routed record has no packet in this operation; artifacts disagree.')
    }
    const assignment = terminalById.get(record.recordId)
    const output = assignment?.output ?? null
    const decision = decisions.get(record.recordId) ?? null
    return {
      recordId: record.recordId,
      title: packet.title,
      abstract: packet.abstract,
      journal: packet.journal,
      publicationYear: packet.publication_year,
      publicationTypes: packet.publication_types,
      meshTerms: packet.mesh_terms,
      keywords: packet.keywords,
      language: packet.language,
      evidenceProfile: packet.evidence_profile,
      luna: output
        ? {
            decision: output.triage_decision,
            confidenceBand: output.confidence_band,
            reasonCodes: output.reason_codes,
          }
        : null,
      terminalState: record.terminalState,
      route: record.route,
      riskFlags: record.riskFlags,
      mandatoryReview: record.mandatoryPhysicianReview,
      inAuditSample: auditSample.has(record.recordId),
      decision: decision
        ? { action: decision.action, revision: decision.revision, decidedAt: decision.decidedAt }
        : null,
    }
  })
  return { operationId: metadata.operationId, cohort: metadata.cohort, records, paths }
}

export interface ReviewFilters {
  readonly queue: string
  readonly review: string
  readonly triage: string
  readonly confidence: string
  readonly reason: string
  readonly profile: string
  readonly risk: string
  readonly journal: string
  readonly yearBand: string
  readonly pubType: string
}

export function applyReviewFilters(
  records: readonly ReviewRecordView[],
  filters: ReviewFilters,
): ReviewRecordView[] {
  return records.filter((record) => {
    if (filters.queue === 'negatives' && record.luna?.decision !== 'obvious_irrelevant') {
      return false
    }
    if (filters.queue === 'mandatory' && !record.mandatoryReview) return false
    if (filters.queue === 'sample' && !record.inAuditSample) return false
    if (filters.review === 'undecided' && record.decision !== null) return false
    if (filters.review === 'decided' && record.decision === null) return false
    if (
      LUNA_REVIEW_ACTIONS.includes(filters.review as LunaReviewAction) &&
      record.decision?.action !== filters.review
    ) {
      return false
    }
    if (filters.triage !== 'all') {
      if (filters.triage === '(none)') {
        if (record.luna !== null) return false
      } else if (record.luna?.decision !== filters.triage) {
        return false
      }
    }
    if (filters.confidence !== 'all' && record.luna?.confidenceBand !== filters.confidence) {
      return false
    }
    if (filters.reason !== 'all' && !(record.luna?.reasonCodes ?? []).includes(filters.reason)) {
      return false
    }
    if (filters.profile !== 'all' && record.evidenceProfile !== filters.profile) return false
    if (filters.risk === '(any)' && record.riskFlags.length === 0) return false
    if (filters.risk === '(none)' && record.riskFlags.length > 0) return false
    if (
      filters.risk !== 'all' &&
      filters.risk !== '(any)' &&
      filters.risk !== '(none)' &&
      !record.riskFlags.includes(filters.risk)
    ) {
      return false
    }
    if (
      filters.journal.length > 0 &&
      !(record.journal ?? '').toLowerCase().includes(filters.journal.toLowerCase())
    ) {
      return false
    }
    if (filters.yearBand !== 'all' && yearBandOf(record.publicationYear) !== filters.yearBand) {
      return false
    }
    if (filters.pubType !== 'all' && !record.publicationTypes.includes(filters.pubType)) {
      return false
    }
    return true
  })
}

function summarize(records: readonly ReviewRecordView[]) {
  return {
    total: records.length,
    decided: records.filter((record) => record.decision !== null).length,
  }
}

export interface ReviewExportResult {
  readonly files: readonly string[]
}

/** Write the five export artifacts, create-once, mode 0600, and return their paths. */
export async function writeReviewExports(
  data: ReviewData,
  decisions: ReadonlyMap<string, ReviewDecisionRecord>,
  now: string,
): Promise<ReviewExportResult> {
  const stamp = now.replace(/[:.]/gu, '-')
  const latest = [...decisions.values()].sort((left, right) =>
    left.recordId < right.recordId ? -1 : 1,
  )
  const byAction = (action: LunaReviewAction) =>
    latest.filter((decision) => decision.action === action).map((decision) => decision.recordId)

  const overrideManifest = {
    artifactVersion: LUNA_REVIEW_ARTIFACT_VERSION,
    kind: 'physician_override_manifest',
    operationId: data.operationId,
    generatedAt: now,
    decisions: latest,
  }
  const confirmed = {
    artifactVersion: LUNA_REVIEW_ARTIFACT_VERSION,
    kind: 'physician_confirmed_deprioritization',
    operationId: data.operationId,
    generatedAt: now,
    recordIds: byAction('confirm_deprioritization_candidate'),
  }
  const rescued = {
    artifactVersion: LUNA_REVIEW_ARTIFACT_VERSION,
    kind: 'physician_rescued_for_stage_b',
    operationId: data.operationId,
    generatedAt: now,
    recordIds: byAction('retain_for_stage_b'),
  }
  const misses = {
    artifactVersion: LUNA_REVIEW_ARTIFACT_VERSION,
    kind: 'systematic_miss_flags',
    operationId: data.operationId,
    generatedAt: now,
    recordIds: byAction('flag_systematic_miss'),
  }
  const mandatory = data.records.filter((record) => record.mandatoryReview)
  const sample = data.records.filter((record) => record.inAuditSample)
  const negatives = data.records.filter((record) => record.luna?.decision === 'obvious_irrelevant')
  const receiptBody = {
    artifactVersion: LUNA_REVIEW_ARTIFACT_VERSION,
    kind: 'review_audit_receipt',
    operationId: data.operationId,
    generatedAt: now,
    counts: {
      records: data.records.length,
      decided: latest.length,
      byAction: Object.fromEntries(
        LUNA_REVIEW_ACTIONS.map((action) => [action, byAction(action).length]),
      ),
      mandatoryReview: mandatory.length,
      mandatoryReviewed: mandatory.filter((record) => record.decision !== null).length,
      auditSample: sample.length,
      auditSampleReviewed: sample.filter((record) => record.decision !== null).length,
      negativeQueue: negatives.length,
      negativeQueueReviewed: negatives.filter((record) => record.decision !== null).length,
    },
    exports: {} as Record<string, string>,
  }

  const files: { name: string; body: unknown }[] = [
    { name: `physician-override-manifest-${stamp}.json`, body: overrideManifest },
    { name: `physician-confirmed-deprioritization-${stamp}.json`, body: confirmed },
    { name: `physician-rescued-for-stage-b-${stamp}.json`, body: rescued },
    { name: `systematic-miss-flags-${stamp}.json`, body: misses },
  ]
  const written: string[] = []
  for (const file of files) {
    const serialized = `${canonicalJson(file.body)}\n`
    const path = join(data.paths.reviewExportsDir, file.name)
    await exclusiveWriteFile(path, serialized)
    receiptBody.exports[file.name] = sha256(serialized)
    written.push(path)
  }
  const receiptPath = join(data.paths.reviewExportsDir, `review-audit-receipt-${stamp}.json`)
  await exclusiveWriteFile(receiptPath, `${canonicalJson(receiptBody)}\n`)
  written.push(receiptPath)
  return { files: written }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const serialized = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(serialized)
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 64 * 1024) {
        rejectPromise(new Error('Request body too large.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')))
    request.on('error', rejectPromise)
  })
}

/** The only hostnames this server will answer to. No DNS resolution ever happens. */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1'])

export type LoopbackHostValidation =
  | { readonly ok: true; readonly hostname: string; readonly port: number | null }
  | { readonly ok: false; readonly reason: string }

function refuse(reason: string): LoopbackHostValidation {
  return { ok: false, reason }
}

/**
 * Parse a Host header as an authority and accept only the three exact loopback hostnames,
 * optionally with a valid port.
 *
 * Whole-authority equality, never a prefix test: `localhost.evil.example` and
 * `127.0.0.1.evil.example` are foreign hosts that merely start with a loopback string, and a
 * prefix check hands them the review app. Userinfo, embedded paths, multiple comma-joined
 * authorities, whitespace, control characters, wildcard binds, and non-loopback addresses are
 * all refused, and nothing here resolves a name.
 */
export function parseLoopbackHostHeader(value: string | undefined): LoopbackHostValidation {
  if (typeof value !== 'string' || value.length === 0) return refuse('missing_authority')
  if (value.length > 255) return refuse('authority_too_long')
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x20 || code >= 0x7f) return refuse('whitespace_or_control_character')
  }
  if (value.includes(',')) return refuse('multiple_authorities')
  if (value.includes('@')) return refuse('userinfo_not_allowed')
  for (const forbidden of ['/', '\\', '?', '#']) {
    if (value.includes(forbidden)) return refuse('not_a_bare_authority')
  }

  let hostname: string
  let portText: string | null
  if (value.startsWith('[')) {
    const close = value.indexOf(']')
    if (close < 0 || value.indexOf('[', 1) >= 0 || value.indexOf(']', close + 1) >= 0) {
      return refuse('malformed_ipv6_authority')
    }
    hostname = value.slice(1, close)
    const rest = value.slice(close + 1)
    if (rest.length === 0) portText = null
    else if (rest.startsWith(':')) portText = rest.slice(1)
    else return refuse('malformed_ipv6_authority')
  } else if (value.includes('[') || value.includes(']')) {
    return refuse('malformed_ipv6_authority')
  } else if (value === '::1') {
    // A bare, portless IPv6 literal. Any ported IPv6 Host must use the bracketed form.
    hostname = value
    portText = null
  } else {
    const firstColon = value.indexOf(':')
    if (firstColon < 0) {
      hostname = value
      portText = null
    } else if (value.indexOf(':', firstColon + 1) >= 0) {
      return refuse('malformed_authority')
    } else {
      hostname = value.slice(0, firstColon)
      portText = value.slice(firstColon + 1)
    }
  }

  const normalized = hostname.toLowerCase()
  if (!LOOPBACK_HOSTNAMES.has(normalized)) return refuse('not_a_loopback_host')
  if (portText === null) return { ok: true, hostname: normalized, port: null }
  if (!/^[0-9]{1,5}$/u.test(portText)) return refuse('invalid_port')
  const port = Number(portText)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return refuse('port_out_of_range')
  return { ok: true, hostname: normalized, port }
}

function hostAllowed(request: IncomingMessage): boolean {
  return parseLoopbackHostHeader(request.headers.host).ok
}

export interface ReviewServer {
  readonly server: Server
  readonly close: () => Promise<void>
}

/**
 * Start the loopback review server. The listen host is the literal loopback address; a
 * request that somehow arrives with a foreign Host header is refused anyway.
 */
export async function startReviewServer(options: {
  readonly state: StateRoot
  readonly operationId: string
  readonly port: number
  readonly now: () => string
}): Promise<ReviewServer> {
  const data = await loadReviewData(options.state, options.operationId)
  let decisions = await readReviewDecisions(data.paths)

  const server = createServer((request, response) => {
    void (async () => {
      if (!hostAllowed(request)) {
        sendJson(response, 403, { error: 'loopback_only' })
        return
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (request.method === 'GET' && url.pathname === '/') {
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        })
        response.end(reviewPageHtml())
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/operation') {
        sendJson(response, 200, { operationId: data.operationId, cohort: data.cohort })
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/records') {
        const filters: ReviewFilters = {
          queue: url.searchParams.get('queue') ?? 'all',
          review: url.searchParams.get('review') ?? 'all',
          triage: url.searchParams.get('triage') ?? 'all',
          confidence: url.searchParams.get('confidence') ?? 'all',
          reason: url.searchParams.get('reason') ?? 'all',
          profile: url.searchParams.get('profile') ?? 'all',
          risk: url.searchParams.get('risk') ?? 'all',
          journal: url.searchParams.get('journal') ?? '',
          yearBand: url.searchParams.get('yearBand') ?? 'all',
          pubType: url.searchParams.get('pubType') ?? 'all',
        }
        const filtered = applyReviewFilters(data.records, filters)
        const reasonCodes = [
          ...new Set(data.records.flatMap((record) => record.luna?.reasonCodes ?? [])),
        ].sort()
        const riskFlags = [...new Set(data.records.flatMap((record) => record.riskFlags))].sort()
        const publicationTypes = [
          ...new Set(data.records.flatMap((record) => record.publicationTypes)),
        ].sort()
        sendJson(response, 200, {
          total: data.records.length,
          filtered: filtered.length,
          records: filtered,
          summary: summarize(data.records),
          reasonCodes,
          riskFlags,
          publicationTypes,
        })
        return
      }
      if (request.method === 'POST' && url.pathname === '/api/decision') {
        const body = await readBody(request)
        let parsed: { recordId?: unknown; action?: unknown }
        try {
          parsed = JSON.parse(body) as { recordId?: unknown; action?: unknown }
        } catch {
          sendJson(response, 400, { error: 'invalid_json' })
          return
        }
        const recordId = typeof parsed.recordId === 'string' ? parsed.recordId : null
        const action = LUNA_REVIEW_ACTIONS.includes(parsed.action as LunaReviewAction)
          ? (parsed.action as LunaReviewAction)
          : null
        const record = data.records.find((candidate) => candidate.recordId === recordId)
        if (!recordId || !action || !record) {
          sendJson(response, 400, { error: 'unknown_record_or_action' })
          return
        }
        const previous = decisions.get(recordId)
        const decision: ReviewDecisionRecord = {
          artifactVersion: LUNA_REVIEW_ARTIFACT_VERSION,
          operationId: data.operationId,
          recordId,
          action,
          revision: (previous?.revision ?? 0) + 1,
          decidedAt: options.now(),
        }
        const filename = `${recordId}.r${String(decision.revision).padStart(4, '0')}.json`
        await exclusiveWriteFile(
          join(data.paths.reviewDecisionsDir, filename),
          `${canonicalJson(decision)}\n`,
        )
        decisions = new Map(decisions)
        decisions.set(recordId, decision)
        record.decision = {
          action: decision.action,
          revision: decision.revision,
          decidedAt: decision.decidedAt,
        }
        sendJson(response, 200, {
          decision: record.decision,
          summary: summarize(data.records),
        })
        return
      }
      if (request.method === 'POST' && url.pathname === '/api/export') {
        const result = await writeReviewExports(data, decisions, options.now())
        sendJson(response, 200, result)
        return
      }
      sendJson(response, 404, { error: 'not_found' })
    })().catch((error: unknown) => {
      sendJson(response, 500, { error: String(error instanceof Error ? error.message : error) })
    })
  })

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise)
    server.listen(options.port, LUNA_REVIEW_APP_HOST, () => resolvePromise())
  })
  return {
    server,
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => (error ? rejectPromise(error) : resolvePromise()))
      }),
  }
}
