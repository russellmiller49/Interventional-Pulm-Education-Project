/**
 * The overlay's destination transports.
 *
 * `OverlayTransport` is the engine's only view of a destination, so the production PostgREST
 * implementation and the rehearsal's disposable-container implementation are interchangeable
 * without the engine knowing which world it is in. The production implementation can reach
 * exactly one mutating surface — the overlay batch RPC — and three read-only tables; there is
 * no generic query method to widen.
 *
 * Error taxonomy mirrors the ingest transport: a confirmed PostgREST rejection (4xx) is
 * retryable only by explicit resume; a timeout, transport exception, 408, 5xx, or malformed
 * body is ambiguous — the caller must reconcile read-only before any further mutation.
 */

import { redact } from '../literature-production-ingest/canonical'
import type { DestinationBinding } from '../literature-production-ingest/types'
import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  OVERLAY_APPLY_RPC,
  OVERLAY_READ_TABLES,
  PROHIBITED_ENDOREELS_REF,
  type OverlayReadTable,
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
      | 'read_malformed_response'
      | 'count_missing',
    message: string,
  ) {
    super(message)
    this.name = 'OverlayReadError'
  }
}

export interface OverlayReadQuery {
  /** PostgREST query-string filters, e.g. `select=pmid&reviewed_operation_id=eq.…`. */
  query: string
  /** Zero-based inclusive row range for paging. */
  range?: { from: number; to: number }
}

export interface OverlayTransport {
  /** POST the batch RPC and return the parsed acknowledgement body. */
  applyBatch(requestBody: string): Promise<unknown>
  /** GET rows from an allowlisted table. */
  readRows(table: OverlayReadTable, query: OverlayReadQuery): Promise<unknown[]>
  /** HEAD an exact count from an allowlisted table. */
  countRows(table: OverlayReadTable, filterQuery: string): Promise<number>
}

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000

function assertReadTable(table: string): asserts table is OverlayReadTable {
  if (!(OVERLAY_READ_TABLES as readonly string[]).includes(table)) {
    throw new Error('The overlay transport may not read that relation.')
  }
}

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

  #headers(extra: Record<string, string> = {}): Record<string, string> {
    // The opaque secret travels only here, in the apikey and authorization headers of a
    // request to the approved origin. It never enters a URL, a log, or an error.
    return {
      apikey: this.#binding.secret,
      authorization: `Bearer ${this.#binding.secret}`,
      ...extra,
    }
  }

  async #request(
    path: string,
    init: { method: string; headers: Record<string, string>; body?: string },
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs)
    try {
      return await this.#fetch(`${this.#binding.url}${path}`, {
        method: init.method,
        headers: init.headers,
        body: init.body,
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
      response = await this.#request(`rest/v1/rpc/${OVERLAY_APPLY_RPC}`, {
        method: 'POST',
        headers: this.#headers({ 'content-type': 'application/json' }),
        body: requestBody,
      })
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
        `The destination reported a server error (${response.status}).`,
      )
    }
    if (response.status >= 400) {
      throw new OverlayMutationConfirmedFailureError(
        `The destination rejected the overlay batch (${response.status}): ${redact(bodyText ?? '', [
          this.#binding.secret,
        ])}`,
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

  async readRows(table: OverlayReadTable, query: OverlayReadQuery): Promise<unknown[]> {
    assertReadTable(table)
    const headers = this.#headers()
    if (query.range) headers.range = `${query.range.from}-${query.range.to}`
    let response: Response
    try {
      response = await this.#request(`rest/v1/${table}?${query.query}`, {
        method: 'GET',
        headers,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OverlayReadError('read_timeout', 'A read-only overlay request timed out.')
      }
      throw new OverlayReadError(
        'read_transport_error',
        `A read-only overlay request failed in transport: ${redact(error, [this.#binding.secret])}`,
      )
    }
    if (response.status < 200 || response.status >= 300) {
      throw new OverlayReadError(
        'read_rejected',
        `A read-only overlay request was rejected (${response.status}).`,
      )
    }
    const bodyText = await response.text().catch(() => null)
    if (bodyText === null) {
      throw new OverlayReadError('read_malformed_response', 'A read-only body could not be read.')
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(bodyText)
    } catch {
      throw new OverlayReadError('read_malformed_response', 'A read-only body was not JSON.')
    }
    if (!Array.isArray(parsed)) {
      throw new OverlayReadError('read_malformed_response', 'A read-only body was not an array.')
    }
    return parsed
  }

  async countRows(table: OverlayReadTable, filterQuery: string): Promise<number> {
    assertReadTable(table)
    let response: Response
    try {
      response = await this.#request(`rest/v1/${table}?${filterQuery}`, {
        method: 'HEAD',
        headers: this.#headers({ prefer: 'count=exact', range: '0-0' }),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OverlayReadError('read_timeout', 'A count request timed out.')
      }
      throw new OverlayReadError(
        'read_transport_error',
        `A count request failed in transport: ${redact(error, [this.#binding.secret])}`,
      )
    }
    if (response.status < 200 || response.status >= 300) {
      throw new OverlayReadError(
        'read_rejected',
        `A count request was rejected (${response.status}).`,
      )
    }
    const contentRange = response.headers.get('content-range')
    const total = contentRange?.split('/')[1]
    if (!total || total === '*' || !/^\d+$/u.test(total)) {
      // `*` means "not counted": an uncounted response must never read as an empty table.
      throw new OverlayReadError('count_missing', 'The destination did not return an exact count.')
    }
    return Number.parseInt(total, 10)
  }
}
