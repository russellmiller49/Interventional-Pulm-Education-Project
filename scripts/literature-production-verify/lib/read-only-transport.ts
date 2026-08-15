/**
 * The only way this package talks to the Literature project. Read-only by construction.
 *
 * ## Why GET and HEAD, and nothing else
 *
 * "Read-only" is usually a promise about intent, checked by reading the code and trusting that
 * nobody adds a `DELETE` later. Here it is a property of the request set:
 *
 *   - The method allowlist is `GET` and `HEAD`. Every other method is refused before a URL is
 *     built, so `PATCH`, `PUT`, `POST`, and `DELETE` are unreachable — including the `POST` that
 *     PostgREST uses for row insertion and for RPC invocation.
 *   - PostgREST **refuses `GET` on a `VOLATILE` function**. Every mutating Literature RPC —
 *     `curate_literature_article_v1`, `save_literature_gold_review_v1`, and the rest — is volatile.
 *     So even a bug that constructed the wrong RPC path could not execute one: the server rejects
 *     it. The two RPCs this tool needs, `search_literature_v1` and `literature_admin_stats_v1`,
 *     are declared `stable`, which is exactly the class `GET` is allowed to reach.
 *   - No request ever carries a body. There is no parameter to supply one.
 *
 * That gives two agreeing gates, one local and one remote, and the local one is testable without a
 * network: `performReadOnlyRequest` refuses the method before it touches `fetch`.
 *
 * A third gate sits on top for defence in depth: an RPC name allowlist. It is redundant with the
 * volatility rule, and it is here anyway, because "the server would have stopped us" is a worse
 * answer than "we never asked".
 *
 * ## Credentials
 *
 * The credential is passed to the transport per call and lives only in the `apikey` and
 * `Authorization` headers. It is never placed in a URL, never logged, and never returned. Response
 * bodies are handed back verbatim for the caller to interpret; redaction happens once, at the
 * reporting boundary.
 */

import { registerSecret } from './redaction'

export const READ_ONLY_METHODS = ['GET', 'HEAD'] as const
export type ReadOnlyMethod = (typeof READ_ONLY_METHODS)[number]

/**
 * RPCs this transport may address. Both are `stable`, take no privileged action, and are the two
 * the Literature runtime itself calls for reads.
 *
 * `list_literature_gold_batches_v2` is here because the gold-workflow check must probe it. It does
 * not exist in `IP_Literature` — its migration was never applied — so the probe's expected answer
 * is a 404, and the request is read-shaped either way.
 */
export const PERMITTED_READ_ONLY_RPCS: readonly string[] = [
  'list_literature_gold_batches_v2',
  'literature_admin_stats_v1',
  'search_literature_v1',
]

/**
 * RPCs refused by name. Every one mutates. Listing them is redundant with both the method
 * allowlist and PostgREST's volatility rule; it exists so the refusal is explicit and so a future
 * reader sees that these were considered rather than overlooked.
 */
export const FORBIDDEN_RPCS: readonly string[] = [
  'curate_literature_article_v1',
  'freeze_literature_gold_batch_v1',
  'save_literature_gold_review_v1',
  'unlock_literature_gold_test_split_v1',
  'update_literature_gold_item_v1',
]

const REST_PATH_PREFIX = '/rest/v1/'
const RPC_PATH_PREFIX = '/rest/v1/rpc/'

export type TransportRefusalReason =
  | 'method_not_read_only'
  | 'path_outside_rest_namespace'
  | 'rpc_not_permitted'
  | 'rpc_forbidden'

export interface TransportRefusal {
  readonly outcome: 'refused'
  readonly reason: TransportRefusalReason
  readonly message: string
}

export interface TransportResponse {
  readonly outcome: 'responded'
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export interface TransportFailure {
  readonly outcome: 'failed'
  readonly code: string
  readonly detail: string
}

export type TransportResult = TransportResponse | TransportRefusal | TransportFailure

export interface ReadOnlyRequest {
  readonly method: ReadOnlyMethod
  /** A `/rest/v1/…` path. Query values are supplied separately and encoded here. */
  readonly path: string
  readonly query?: Readonly<Record<string, string>>
  /** Extra request headers, e.g. `Prefer: count=exact`. Never a credential. */
  readonly headers?: Readonly<Record<string, string>>
}

export interface ReadOnlyTransportOptions {
  /** The project origin, byte-exact per the runtime contract (with its trailing slash). */
  readonly origin: string
  /** The privileged backend credential, or `null` for a deliberately unauthenticated probe. */
  readonly credential: string | null
  /** Injected for tests. Defaults to the global `fetch`. */
  readonly fetchImplementation?: typeof fetch
  readonly timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

function refusal(reason: TransportRefusalReason, message: string): TransportRefusal {
  return { outcome: 'refused', reason, message }
}

/**
 * Judge a request without performing it.
 *
 * Separate from the performing function so the refusal rules can be exercised exhaustively in
 * tests with no network, no credential, and no `fetch` at all.
 */
export function evaluateReadOnlyRequest(request: {
  method: string
  path: string
}): TransportRefusal | null {
  if (!(READ_ONLY_METHODS as readonly string[]).includes(request.method)) {
    return refusal(
      'method_not_read_only',
      `This transport issues ${READ_ONLY_METHODS.join(' and ')} only; ${request.method} is refused.`,
    )
  }
  if (!request.path.startsWith(REST_PATH_PREFIX)) {
    return refusal(
      'path_outside_rest_namespace',
      `Path ${request.path} is outside ${REST_PATH_PREFIX}, which is the only namespace this ` +
        'transport addresses.',
    )
  }
  if (request.path.startsWith(RPC_PATH_PREFIX)) {
    const name = request.path.slice(RPC_PATH_PREFIX.length)
    if (FORBIDDEN_RPCS.includes(name)) {
      return refusal(
        'rpc_forbidden',
        `RPC ${name} mutates Literature data and is refused by name. Verification never writes.`,
      )
    }
    if (!PERMITTED_READ_ONLY_RPCS.includes(name)) {
      return refusal(
        'rpc_not_permitted',
        `RPC ${name} is not on the read-only allowlist ` +
          `(${PERMITTED_READ_ONLY_RPCS.join(', ')}).`,
      )
    }
  }
  return null
}

/** A transport bound to one origin and one credential. */
export interface ReadOnlyTransport {
  readonly origin: string
  readonly authenticated: boolean
  request(request: ReadOnlyRequest): Promise<TransportResult>
}

export function createReadOnlyTransport(options: ReadOnlyTransportOptions): ReadOnlyTransport {
  const performFetch = options.fetchImplementation ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  // Registered the moment the transport takes ownership, so anything echoed back in an error body
  // is scrubbed even if this process never prints the credential itself.
  registerSecret(options.credential)

  return {
    origin: options.origin,
    authenticated: options.credential !== null,

    async request(request: ReadOnlyRequest): Promise<TransportResult> {
      const refused = evaluateReadOnlyRequest({ method: request.method, path: request.path })
      if (refused) return refused

      const url = new URL(request.path.replace(/^\//u, ''), options.origin)
      for (const [key, value] of Object.entries(request.query ?? {})) {
        url.searchParams.set(key, value)
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...request.headers,
      }
      if (options.credential !== null) {
        headers.apikey = options.credential
        headers.Authorization = `Bearer ${options.credential}`
      }

      const controller = new AbortController()
      const timer = setTimeout(() => {
        controller.abort()
      }, timeoutMs)
      try {
        const response = await performFetch(url, {
          method: request.method,
          headers,
          redirect: 'manual',
          signal: controller.signal,
          // No `body`, ever. The type does not admit one and neither does this call.
        })
        return {
          outcome: 'responded',
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: request.method === 'HEAD' ? '' : await response.text(),
        }
      } catch (error) {
        return {
          outcome: 'failed',
          code: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
          detail: error instanceof Error ? error.message : String(error),
        }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

/**
 * The exact total from a PostgREST `Content-Range` header.
 *
 * The value after the slash is the total: a number when the server counted, and a literal asterisk
 * when it did not. An asterisk is a *missing* count and is returned as `null` — never as zero. The
 * caller turns that `null` into a `failed` observation, which is the whole point: an uncounted
 * response and an empty table must not produce the same number.
 */
export function parseExactCount(contentRange: string | undefined): number | null {
  if (!contentRange) return null
  const total = contentRange.split('/')[1]
  if (total === undefined || total === '*') return null
  const parsed = Number.parseInt(total, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}
