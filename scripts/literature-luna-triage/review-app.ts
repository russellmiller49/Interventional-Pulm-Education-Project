import { randomBytes, timingSafeEqual } from 'node:crypto'
import { lstat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'

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
import {
  StatePathError,
  assertContainedDirectory,
  assertContainedRealPath,
  exclusiveWriteFile,
  readRegularFile,
  type StateRoot,
} from './state'

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

function isFileNotFound(error: unknown): boolean {
  return (
    !(error instanceof StatePathError) &&
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

/** Present-and-contained, or genuinely absent. Nothing in between. */
export type AuditSampleRead =
  | { readonly status: 'absent' }
  | { readonly status: 'present'; readonly recordIds: ReadonlySet<string> }

/**
 * Read the operation's audit sample under the same root-down containment guarantees as the
 * review decision and export paths.
 *
 * The audit sample is *optional*, and only that one thing is optional: the file may not exist
 * yet. Everything else — a symlinked `audit/` directory, a symlinked leaf, a target whose real
 * path lies outside the state root, wrong permissions, malformed contents, a `StatePathError`
 * — is a refusal. The earlier read passed no `StateRoot` and caught every error as "no audit
 * sample", which made a redirected read indistinguishable from an absent one, so an audit
 * sample chosen outside the operation could mark records as sampled.
 *
 * Containment is re-proven at read time rather than remembered from startup, so an ancestor
 * swapped for a link between one load and the next cannot ride through on an earlier check.
 */
export async function readAuditSampleIds(
  state: StateRoot,
  paths: OperationPaths,
): Promise<AuditSampleRead> {
  const auditDir = dirname(paths.auditSampleJson)
  try {
    await assertContainedDirectory(state, auditDir)
  } catch (error) {
    if (isFileNotFound(error)) return { status: 'absent' }
    throw error
  }
  let stat
  try {
    stat = await lstat(paths.auditSampleJson)
  } catch (error) {
    if (isFileNotFound(error)) return { status: 'absent' }
    throw error
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new StatePathError(
      `Refusing to read ${paths.auditSampleJson}: the audit sample is not a regular file.`,
    )
  }
  if ((stat.mode & 0o777) !== 0o600) {
    throw new StatePathError(
      `Refusing to read ${paths.auditSampleJson}: an operation artifact must be mode 0600.`,
    )
  }
  // The read itself re-proves containment from the root down, immediately before the bytes.
  const raw = await readRegularFile(paths.auditSampleJson, state)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('The stored audit sample is not valid JSON; refusing to use it.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The stored audit sample is not a JSON object; refusing to use it.')
  }
  const entries = (parsed as { entries?: unknown }).entries
  if (!Array.isArray(entries)) {
    throw new Error('The stored audit sample carries no entry list; refusing to use it.')
  }
  const recordIds = new Set<string>()
  for (const entry of entries) {
    const recordId = (entry as { recordId?: unknown } | null)?.recordId
    if (typeof recordId !== 'string' || recordId.length === 0) {
      throw new Error('A stored audit-sample entry names no record; refusing to use it.')
    }
    recordIds.add(recordId)
  }
  return { status: 'present', recordIds }
}

export async function loadReviewData(state: StateRoot, operationId: string): Promise<ReviewData> {
  const paths = operationPaths(state, operationId)
  // Containment is proven before the first byte is read: every ancestor of the operation tree
  // is lstat-checked for a symlink and the tree must realpath back under the state root.
  await assertContainedDirectory(state, paths.root)
  await assertContainedDirectory(state, paths.reviewDecisionsDir)
  await assertContainedDirectory(state, paths.reviewExportsDir)
  for (const artifact of [
    paths.operationJson,
    paths.packetsJsonl,
    paths.routedRecordsJsonl,
    paths.terminalStatesJsonl,
  ]) {
    await assertContainedRealPath(state, artifact)
  }
  const metadata = await loadOperationMetadata(paths)
  const packets = await readPackets(paths)
  const routed = await readRoutedRecords(paths)
  const terminal = await readTerminalStates(paths)
  const decisions = await readReviewDecisions(paths, state)
  const auditSample = await readAuditSampleIds(state, paths)
  const sampledRecordIds =
    auditSample.status === 'present' ? auditSample.recordIds : new Set<string>()

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
      inAuditSample: sampledRecordIds.has(record.recordId),
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
  state?: StateRoot,
): Promise<ReviewExportResult> {
  if (state) await assertContainedDirectory(state, data.paths.reviewExportsDir)
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
    await exclusiveWriteFile(path, serialized, state)
    receiptBody.exports[file.name] = sha256(serialized)
    written.push(path)
  }
  const receiptPath = join(data.paths.reviewExportsDir, `review-audit-receipt-${stamp}.json`)
  await exclusiveWriteFile(receiptPath, `${canonicalJson(receiptBody)}\n`, state)
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

/**
 * The only hostnames this server will answer to. No DNS resolution ever happens.
 *
 * `::1` appears here only as the *inside* of a bracketed authority: HTTP Host syntax requires
 * an IPv6 literal to be bracketed, so a bare `::1` is not a valid authority at all and is
 * refused before it can be looked up.
 */
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
  } else if (value.includes(':') && value.indexOf(':') !== value.lastIndexOf(':')) {
    // Two or more colons outside brackets: an unbracketed IPv6 literal such as a bare `::1`.
    // HTTP Host syntax has no such form, so there is nothing here to accept.
    return refuse('unbracketed_ipv6_authority')
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

export type MutationGuardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

function headerValue(request: IncomingMessage, name: string): string | null {
  const raw = request.headers[name]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw.length === 1 ? raw[0] : null
  return null
}

function tokensMatch(supplied: string, expected: string): boolean {
  const left = Buffer.from(supplied, 'utf8')
  const right = Buffer.from(expected, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * The CSRF wall in front of every state-changing endpoint.
 *
 * A hostile page can make a browser send a *simple* cross-origin request — a form post or a
 * `text/plain` POST — without any preflight, and without the ability to read the reply. That
 * is enough to create a physician decision if the server only checks that the request arrived.
 * So four independent things must hold: the request must carry an `Origin` that exactly
 * matches this server's own loopback origin (scheme, host, and the port it is actually
 * listening on); it must declare `application/json`, which a simple request cannot; it must
 * carry the per-run random token in a custom header, which a simple request also cannot; and
 * any `Sec-Fetch-Site` it does carry must say same-origin. No CORS headers are ever sent, so a
 * browser never gets permission to read anything either.
 */
export function assertMutationAllowed(
  request: IncomingMessage,
  expected: { readonly origins: readonly string[]; readonly csrfToken: string },
): MutationGuardResult {
  const site = headerValue(request, 'sec-fetch-site')
  if (site !== null && site !== 'same-origin' && site !== 'none') {
    return { ok: false, reason: 'cross_site_request' }
  }
  const origin = headerValue(request, 'origin')
  if (origin === null) return { ok: false, reason: 'missing_origin' }
  if (!expected.origins.includes(origin)) return { ok: false, reason: 'foreign_origin' }
  const contentType = headerValue(request, 'content-type')
  if (contentType === null) return { ok: false, reason: 'missing_content_type' }
  const mediaType = contentType.split(';')[0].trim().toLowerCase()
  if (mediaType !== 'application/json') return { ok: false, reason: 'unsupported_content_type' }
  const token = headerValue(request, 'x-luna-csrf')
  if (token === null) return { ok: false, reason: 'missing_csrf_header' }
  if (!tokensMatch(token, expected.csrfToken)) return { ok: false, reason: 'invalid_csrf_token' }
  return { ok: true }
}

/** The exact origins this server answers to, given the port it actually bound. */
export function allowedReviewOrigins(port: number): string[] {
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`]
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
  let decisions = await readReviewDecisions(data.paths, options.state)
  // One random token per server run, delivered only in the page body. It is never placed in a
  // URL, never written to an artifact, and does not survive a restart.
  const csrfToken = randomBytes(32).toString('hex')
  const pageHtml = reviewPageHtml(csrfToken)
  let allowedOrigins: readonly string[] = []

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
        response.end(pageHtml)
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
        const guard = assertMutationAllowed(request, { origins: allowedOrigins, csrfToken })
        if (!guard.ok) {
          // Refused before any body is read, so no state file can exist for this request.
          sendJson(response, 403, { error: 'forbidden', reason: guard.reason })
          return
        }
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
        // Containment is revalidated on this write, not merely trusted from startup.
        await assertContainedDirectory(options.state, data.paths.reviewDecisionsDir)
        await exclusiveWriteFile(
          join(data.paths.reviewDecisionsDir, filename),
          `${canonicalJson(decision)}\n`,
          options.state,
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
        const guard = assertMutationAllowed(request, { origins: allowedOrigins, csrfToken })
        if (!guard.ok) {
          sendJson(response, 403, { error: 'forbidden', reason: guard.reason })
          return
        }
        const result = await writeReviewExports(data, decisions, options.now(), options.state)
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
  // The origin allowlist names the port actually bound, so a stale or guessed port is foreign.
  const address = server.address()
  const boundPort = typeof address === 'object' && address !== null ? address.port : options.port
  allowedOrigins = allowedReviewOrigins(boundPort)
  return {
    server,
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => (error ? rejectPromise(error) : resolvePromise()))
      }),
  }
}
