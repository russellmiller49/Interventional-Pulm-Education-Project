/**
 * Deterministic identity derivation for the reviewed overlay.
 *
 * The same reviewed truth must always name the same operation and the same per-record events,
 * so that a replay can only ever collide with itself: an operation-row insert or an event
 * insert that hits an existing primary key is either an exact idempotent replay (proven by
 * content comparison) or drift (refused). Nothing here is random.
 */

import { sha256 } from '../literature-production-ingest/canonical'
import {
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_CURATION_REASON,
  OVERLAY_ENGINE_VERSION,
} from './constants'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

/**
 * Format the first 32 hex characters of a SHA-256 digest as a v8 UUID, the same shaping the
 * ingest operator uses for its deterministic operation id: version nibble forced to `8`
 * (custom/experimental per RFC 9562) and the variant nibble folded into `8|9|a|b`.
 */
export function deterministicUuid(parts: readonly string[]): string {
  if (parts.length === 0 || parts.some((part) => part.length === 0 || part.includes('\n'))) {
    throw new Error('Deterministic UUID parts must be nonempty and newline-free.')
  }
  const digest = sha256(parts.join('\n')).split('')
  digest[12] = '8'
  digest[16] = ['8', '9', 'a', 'b'][Number.parseInt(digest[16] as string, 16) % 4] as string
  const hex = digest.join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

export function assertDeterministicUuid(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a deterministic v8 UUID.`)
  }
}

/**
 * The overlay operation identity.
 *
 * Bound to the engine version, the artifact byte identity, the digest of the combined source
 * projection, and the frozen curation reason, so that different truth — or the same truth with
 * a different frozen reason — can never share an operation, and identical truth can never fork
 * one. The reason contains no newline by construction (it is a reviewed sentence constant),
 * which the derivation's newline-free rule re-enforces.
 */
export function overlayOperationId(projectionDigest: string): string {
  if (!/^[a-f0-9]{64}$/u.test(projectionDigest)) {
    throw new Error('The projection digest must be a lowercase SHA-256 digest.')
  }
  return deterministicUuid([
    'literature-reviewed-overlay-operation',
    OVERLAY_ENGINE_VERSION,
    OVERLAY_ARTIFACT_SHA256,
    projectionDigest,
    OVERLAY_CURATION_REASON,
  ])
}

/** The deterministic curation-event identity for one record of one operation. */
export function overlayEventId(operationId: string, pmid: string): string {
  assertDeterministicUuid(operationId, 'The overlay operation id')
  if (!/^[0-9]{1,12}$/u.test(pmid)) {
    throw new Error('An overlay event identity requires a 1-12 digit PMID.')
  }
  return deterministicUuid(['literature-reviewed-overlay-event', operationId, pmid])
}
