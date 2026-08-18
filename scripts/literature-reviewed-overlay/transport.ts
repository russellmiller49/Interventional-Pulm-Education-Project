/**
 * The overlay's destination transports.
 *
 * `OverlayTransport` is the engine's only view of a destination, so the production PostgREST
 * implementation and the rehearsal's disposable-container implementation are interchangeable
 * without the engine knowing which world it is in. The production implementation can reach
 * exactly two surfaces — the mutating overlay batch RPC and the bounded read-only observation
 * RPC — both by POST with a request body. There is no generic table read, no query-string
 * filter, and therefore no way for a PMID to enter a request URL.
 *
 * Error discipline: an untrusted response body never enters a thrown or logged error. Failures
 * carry only the stable classification, the HTTP status, and a digest of the body for
 * out-of-band correlation. A confirmed PostgREST rejection (4xx) is retryable only by explicit
 * resume; a timeout, transport exception, 408, 5xx, or malformed body is ambiguous — the
 * caller must reconcile read-only before any further mutation.
 */

import { redact, sha256 } from '../literature-production-ingest/canonical'
import type { DestinationBinding } from '../literature-production-ingest/types'
import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  OVERLAY_APPLY_RPC,
  OVERLAY_OBSERVE_RPC,
  PROHIBITED_ENDOREELS_REF,
} from './constants'

export type OverlayAmbiguityCode =
  | 'transport_exception'
  | 'request_timeout'
  | 'server_error'
  | 'unexpected_status'
  | 'malformed_acknowledgement'
export type OverlayConfirmedFailureCode = 'postgrest_rejected'

export class OverlayMutationAmbiguousError extends Error {
  readonly kind = 'ambiguous' as const

  constructor(
    readonly code: OverlayAmbiguityCode,
    message: string,
  ) {
    super(message)
    this.name = 'OverlayMutationAmbiguousError'
  }
}

export class OverlayMutationConfirmedFailureError extends Error {
  readonly kind = 'confirmed_failure' as const
  readonly code: OverlayConfirmedFailureCode = 'postgrest_rejected'

  constructor(message: string) {
    super(message)
    this.name = 'OverlayMutationConfirmedFailureError'
  }
}

export class OverlayReadError extends Error {
  constructor(
    readonly code:
      | 'read_timeout'
      | 'read_transport_error'
      | 'read_rejected'
      | 'read_malformed_response',
    message: string,
  ) {
    super(message)
    this.name = 'OverlayReadError'
  }
}

export interface OverlayTransport {
  /** POST the mutating batch RPC and return the parsed acknowledgement body. */
  applyBatch(requestBody: string): Promise<unknown>
  /** POST the bounded read-only observation RPC and return the parsed observation body. */
  observe(requestBody: string): Promise<unknown>
}

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000

function validateBinding(binding: DestinationBinding): void {
  // Deliberately re-checked against widened strings: the binding type already narrows these to
  // the approved literals, and this transport still refuses rather than trusting a cast.
  const url = binding.url as string
  const projectRef = binding.projectRef as string
  if (
    url !== (APPROVED_PROJECT_URL as string) ||
    projectRef !== (APPROVED_PROJECT_REF as string) ||
    projectRef === (PROHIBITED_ENDOREELS_REF as string) ||
    url.toLowerCase().includes(PROHIBITED_ENDOREELS_REF)
  ) {
    throw new Error('The overlay transport refuses a destination outside the approved project.')
  }
  if (!/^sb_secret_[A-Za-z0-9._-]+$/u.test(binding.secret)) {
    throw new Error('The overlay transport refuses a non-secret credential class.')
  }
}

/** A short correlation digest of an untrusted body that is safe to name in an error. */
function bodyDigest(bodyText: string | null): string {
  return bodyText === null ? 'unreadable' : sha256(bodyText).slice(0, 16)
}

export interface PostgrestOverlayTransportOptions {
  binding: DestinationBinding
  fetchImplementation?: typeof fetch
  timeoutMs?: number
}

export class PostgrestOverlayTransport implements OverlayTransport {
  readonly #binding: DestinationBinding
  readonly #fetch: typeof fetch
  readonly #timeoutMs: number

  constructor(options: PostgrestOverlayTransportOptions) {
    validateBinding(options.binding)
    this.#binding = options.binding
    this.#fetch = options.fetchImplementation ?? fetch
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  }

  async #post(rpc: string, requestBody: string): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs)
    try {
      // The opaque secret travels only here, in the apikey and authorization headers of a
      // request to the approved origin. It never enters a URL, a log, or an error.
      return await this.#fetch(`${this.#binding.url}rest/v1/rpc/${rpc}`, {
        method: 'POST',
        headers: {
          apikey: this.#binding.secret,
          authorization: `Bearer ${this.#binding.secret}`,
          'content-type': 'application/json',
        },
        body: requestBody,
        redirect: 'error',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  async applyBatch(requestBody: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.#post(OVERLAY_APPLY_RPC, requestBody)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OverlayMutationAmbiguousError(
          'request_timeout',
          'The overlay batch request timed out before an acknowledgement arrived.',
        )
      }
      throw new OverlayMutationAmbiguousError(
        'transport_exception',
        `The overlay batch request failed in transport: ${redact(error, [this.#binding.secret])}`,
      )
    }

    const bodyText = await response.text().catch(() => null)
    if (response.status === 408) {
      throw new OverlayMutationAmbiguousError(
        'request_timeout',
        'The destination reported a request timeout.',
      )
    }
    if (response.status >= 500) {
      throw new OverlayMutationAmbiguousError(
        'server_error',
        `The destination reported a server error (status ${response.status}).`,
      )
    }
    if (response.status >= 400) {
      // The response body is untrusted and never enters the error; the digest lets an
      // operator correlate the refusal with server-side logs out of band.
      throw new OverlayMutationConfirmedFailureError(
        `The destination rejected the overlay batch (status ${response.status}, ` +
          `body digest ${bodyDigest(bodyText)}).`,
      )
    }
    if (response.status < 200 || response.status >= 300) {
      throw new OverlayMutationAmbiguousError(
        'unexpected_status',
        `The destination answered with an unexpected status (${response.status}).`,
      )
    }
    if (bodyText === null) {
      throw new OverlayMutationAmbiguousError(
        'malformed_acknowledgement',
        'The destination acknowledgement body could not be read.',
      )
    }
    try {
      return JSON.parse(bodyText) as unknown
    } catch {
      throw new OverlayMutationAmbiguousError(
        'malformed_acknowledgement',
        'The destination acknowledgement was not valid JSON.',
      )
    }
  }

  async observe(requestBody: string): Promise<unknown> {
    let response: Response
    try {
      response = await this.#post(
        OVERLAY_OBSERVE_RPC,
        JSON.stringify({ p_request: JSON.parse(requestBody) as unknown }),
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OverlayReadError('read_timeout', 'An overlay observation timed out.')
      }
      throw new OverlayReadError(
        'read_transport_error',
        `An overlay observation failed in transport: ${redact(error, [this.#binding.secret])}`,
      )
    }
    const bodyText = await response.text().catch(() => null)
    if (response.status < 200 || response.status >= 300) {
      throw new OverlayReadError(
        'read_rejected',
        `An overlay observation was rejected (status ${response.status}, ` +
          `body digest ${bodyDigest(bodyText)}).`,
      )
    }
    if (bodyText === null) {
      throw new OverlayReadError(
        'read_malformed_response',
        'An overlay observation body could not be read.',
      )
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(bodyText)
    } catch {
      throw new OverlayReadError(
        'read_malformed_response',
        'An overlay observation was not valid JSON.',
      )
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new OverlayReadError(
        'read_malformed_response',
        'An overlay observation was not a JSON object.',
      )
    }
    return parsed
  }
}
