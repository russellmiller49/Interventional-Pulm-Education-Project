import {
  validateStageAOutput,
  type StageAOutput,
  type StageATerminalState,
} from '../../src/features/literature/classifier/stage-a-contract'
import { sha256 } from '../literature-production-ingest/canonical'

/**
 * Strict Stage-A result ingestion.
 *
 * No semantic repair, no retry, no silent drops: every selected record ends in exactly one
 * terminal state, and every rejected raw payload is preserved byte-exact in a quarantine
 * wrapper. A record with anything other than a clean, identity-bound, schema-valid output
 * advances by default downstream; ingestion only ever *narrows* toward validity, never fixes.
 */

export const LUNA_QUARANTINE_SCHEMA_VERSION = 'literature-luna-quarantine/1.0.0'

export interface RawResponseRecord {
  /** The request custom id (equal to the opaque record id) the response claims to answer. */
  readonly customId: string | null
  /** Raw response body text, byte-preserved. */
  readonly bodyText: string
}

export interface QuarantineEntry {
  readonly schemaVersion: typeof LUNA_QUARANTINE_SCHEMA_VERSION
  readonly customId: string | null
  readonly reason: string
  readonly rawSha256: string
  readonly rawBase64: string
}

export interface TerminalAssignment {
  readonly recordId: string
  readonly state: StageATerminalState
  readonly output: StageAOutput | null
  readonly responseSha256: string | null
  readonly detail: string | null
}

export interface IngestionResult {
  readonly assignments: readonly TerminalAssignment[]
  readonly quarantine: readonly QuarantineEntry[]
  /** Responses whose custom id matches no selected record. Accounted, never adopted. */
  readonly unknownIdentityCount: number
}

function quarantineEntry(
  customId: string | null,
  reason: string,
  bodyText: string,
): QuarantineEntry {
  return {
    schemaVersion: LUNA_QUARANTINE_SCHEMA_VERSION,
    customId,
    reason,
    rawSha256: sha256(bodyText),
    rawBase64: Buffer.from(bodyText, 'utf8').toString('base64'),
  }
}

type ExtractedResponse =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'refusal' }
  | { readonly kind: 'invalid'; readonly reason: string }

/**
 * Pull the model's output text (or refusal) out of one Responses API body. Anything that is
 * not an unambiguous completed message is invalid — never repaired.
 */
export function extractResponseOutput(bodyText: string): ExtractedResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    return { kind: 'invalid', reason: 'response_body_not_json' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { kind: 'invalid', reason: 'response_body_not_object' }
  }
  const body = parsed as Record<string, unknown>
  if (body.error) {
    return { kind: 'invalid', reason: 'response_reported_error' }
  }
  if (body.status !== 'completed') {
    return { kind: 'invalid', reason: `response_status_${String(body.status)}` }
  }
  const output = Array.isArray(body.output) ? body.output : []
  const texts: string[] = []
  let refusalSeen = false
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const outputItem = item as Record<string, unknown>
    if (outputItem.type !== 'message') continue
    const content = Array.isArray(outputItem.content) ? outputItem.content : []
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const contentPart = part as Record<string, unknown>
      if (contentPart.type === 'output_text' && typeof contentPart.text === 'string') {
        texts.push(contentPart.text)
      }
      if (contentPart.type === 'refusal') {
        refusalSeen = true
      }
    }
  }
  if (refusalSeen && texts.length === 0) {
    return { kind: 'refusal' }
  }
  if (texts.length !== 1) {
    return { kind: 'invalid', reason: `response_message_texts_${texts.length}` }
  }
  return { kind: 'text', text: texts[0] }
}

export interface IngestOptions {
  /** Every record id selected into the cohort. */
  readonly selectedRecordIds: readonly string[]
  /** The subset of selected record ids that were actually submitted. */
  readonly attemptedRecordIds: readonly string[]
  readonly responses: readonly RawResponseRecord[]
}

/**
 * Assign exactly one terminal state to every selected record. The partition is exhaustive by
 * construction and re-asserted arithmetically before returning.
 */
export function ingestStageAResponses(options: IngestOptions): IngestionResult {
  const selected = new Set(options.selectedRecordIds)
  if (selected.size !== options.selectedRecordIds.length) {
    throw new Error('The selected cohort contains duplicate record ids; refusing to ingest.')
  }
  const attempted = new Set(options.attemptedRecordIds)
  for (const recordId of attempted) {
    if (!selected.has(recordId)) {
      throw new Error('An attempted record id is outside the selected cohort; refusing.')
    }
  }
  const quarantine: QuarantineEntry[] = []
  const byCustomId = new Map<string, RawResponseRecord[]>()
  let unknownIdentityCount = 0
  for (const response of options.responses) {
    if (response.customId === null || !selected.has(response.customId)) {
      unknownIdentityCount += 1
      quarantine.push(
        quarantineEntry(response.customId, 'unknown_or_missing_custom_id', response.bodyText),
      )
      continue
    }
    const bucket = byCustomId.get(response.customId) ?? []
    bucket.push(response)
    byCustomId.set(response.customId, bucket)
  }

  const assignments: TerminalAssignment[] = []
  for (const recordId of options.selectedRecordIds) {
    if (!attempted.has(recordId)) {
      assignments.push({
        recordId,
        state: 'no_attempt',
        output: null,
        responseSha256: null,
        detail: null,
      })
      continue
    }
    const responses = byCustomId.get(recordId) ?? []
    if (responses.length === 0) {
      assignments.push({
        recordId,
        state: 'missing',
        output: null,
        responseSha256: null,
        detail: null,
      })
      continue
    }
    if (responses.length > 1) {
      for (const response of responses) {
        quarantine.push(quarantineEntry(recordId, 'duplicate_response', response.bodyText))
      }
      assignments.push({
        recordId,
        state: 'duplicate',
        output: null,
        responseSha256: null,
        detail: `duplicate_responses_${responses.length}`,
      })
      continue
    }
    const response = responses[0]
    const responseSha256 = sha256(response.bodyText)
    const extracted = extractResponseOutput(response.bodyText)
    if (extracted.kind === 'refusal') {
      assignments.push({ recordId, state: 'refusal', output: null, responseSha256, detail: null })
      continue
    }
    if (extracted.kind === 'invalid') {
      quarantine.push(quarantineEntry(recordId, extracted.reason, response.bodyText))
      assignments.push({
        recordId,
        state: 'invalid_quarantined',
        output: null,
        responseSha256,
        detail: extracted.reason,
      })
      continue
    }
    let outputValue: unknown
    try {
      outputValue = JSON.parse(extracted.text)
    } catch {
      quarantine.push(quarantineEntry(recordId, 'output_text_not_json', response.bodyText))
      assignments.push({
        recordId,
        state: 'invalid_quarantined',
        output: null,
        responseSha256,
        detail: 'output_text_not_json',
      })
      continue
    }
    const validation = validateStageAOutput(outputValue)
    if (!validation.ok) {
      quarantine.push(quarantineEntry(recordId, 'output_schema_invalid', response.bodyText))
      assignments.push({
        recordId,
        state: 'invalid_quarantined',
        output: null,
        responseSha256,
        detail: `output_schema_invalid: ${validation.issues.join('; ').slice(0, 500)}`,
      })
      continue
    }
    if (validation.output.record_id !== recordId) {
      quarantine.push(quarantineEntry(recordId, 'record_identity_mismatch', response.bodyText))
      assignments.push({
        recordId,
        state: 'invalid_quarantined',
        output: null,
        responseSha256,
        detail: 'record_identity_mismatch',
      })
      continue
    }
    assignments.push({
      recordId,
      state:
        validation.output.triage_decision === 'insufficient_evidence'
          ? 'valid_abstention'
          : 'valid_prediction',
      output: validation.output,
      responseSha256,
      detail: null,
    })
  }

  const counts = new Map<StageATerminalState, number>()
  for (const assignment of assignments) {
    counts.set(assignment.state, (counts.get(assignment.state) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0)
  if (total !== selected.size || assignments.length !== selected.size) {
    throw new Error(
      `Terminal-state accounting failed: ${total} states for ${selected.size} selected ` +
        'records. Every selected record must land in exactly one state.',
    )
  }
  return { assignments, quarantine, unknownIdentityCount }
}
