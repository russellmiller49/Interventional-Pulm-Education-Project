import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import { LUNA_REASONING_EFFORTS, type LunaReasoningEffort } from './constants'
import type { OperationPaths } from './operation'
import { reconcileRequestBodyText, type RequestReconciliation } from './reconcile'
import { readRegularFile, type StateRoot } from './state'

/**
 * The one authoritative reader of a stored prepared-request set.
 *
 * Stored request metadata is **evidence, never authority**. A row's `bodySha256` is a claim
 * about the bytes beside it; a manifest's `requestSetSha256` is a claim about the rows beside
 * it. Both claims are recomputed here from the raw ordered bytes, and a claim that does not
 * survive its own recomputation refuses the whole set.
 *
 * Two failure shapes motivated centralizing this.
 *
 * The first is drift: a body edited to a same-length variant keeps its stale digest, and a
 * consumer that only schema-checks the stored row emits the altered bytes downstream. So the
 * digest is taken *from the bytes*, and the ordered set digest is taken from those recomputed
 * digests — a manifest is never allowed to authorize the rows sitting beside it.
 *
 * The second is collapse: building a `Map` keyed by custom id silently merges a duplicated row
 * before any validator can see it, so two stored rows become one planned record. So raw-row
 * multiplicity — uniqueness of custom ids, uniqueness of the record ids recovered from the
 * bodies, exact count, exact order — is proven on the raw sequence, and a lookup map is only
 * constructed once that proof holds.
 *
 * Every retained offline command that consumes prepared requests reads them through here.
 */

export class PreparedRequestSetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PreparedRequestSetError'
  }
}

function refuse(message: string): never {
  throw new PreparedRequestSetError(`${message} The prepared request set is refused.`)
}

const ROW_KEYS = ['body', 'bodySha256', 'customId'] as const
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u

export interface ValidatedPreparedRequest {
  readonly customId: string
  /** Recomputed from the exact stored body bytes, and equal to the stored row's claim. */
  readonly bodySha256: string
  readonly body: Record<string, unknown>
  readonly bodyText: string
  readonly reconciliation: RequestReconciliation
}

export interface PreparedRequestSetManifest {
  readonly model: string
  readonly reasoningEffort: LunaReasoningEffort
  readonly promptSha256: string
  readonly requestCount: number
  readonly totalEstimatedInputTokens: number
  readonly totalEstimatedOutputTokenAllowance: number
  readonly requestSetSha256: string
  readonly customIdSequenceSha256: string
}

export interface ValidatedPreparedRequestSet {
  /** The raw stored rows, in their stored order, each proven against its own bytes. */
  readonly requests: readonly ValidatedPreparedRequest[]
  readonly manifest: PreparedRequestSetManifest
  /** Built only after multiplicity was proven on the raw sequence. Lookup only. */
  readonly byCustomId: ReadonlyMap<string, ValidatedPreparedRequest>
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    refuse(`The stored request manifest has no ${label}.`)
  }
  return value
}

function requireSafeCount(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    refuse(`The stored request manifest's ${label} is not a whole non-negative count.`)
  }
  return value
}

function parseManifest(manifestText: string): PreparedRequestSetManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(manifestText)
  } catch {
    refuse('The stored request manifest is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    refuse('The stored request manifest is not a JSON object.')
  }
  const manifest = parsed as Record<string, unknown>
  const reasoningEffort = requireString(manifest.reasoningEffort, 'reasoning effort')
  if (!(LUNA_REASONING_EFFORTS as readonly string[]).includes(reasoningEffort)) {
    refuse('The stored request manifest names an unknown reasoning effort.')
  }
  for (const [value, label] of [
    [manifest.promptSha256, 'prompt digest'],
    [manifest.requestSetSha256, 'request-set digest'],
    [manifest.customIdSequenceSha256, 'custom-id sequence digest'],
  ] as const) {
    if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
      refuse(`The stored request manifest has no ${label}.`)
    }
  }
  return {
    model: requireString(manifest.model, 'model'),
    reasoningEffort: reasoningEffort as LunaReasoningEffort,
    promptSha256: manifest.promptSha256 as string,
    requestCount: requireSafeCount(manifest.requestCount, 'request count'),
    totalEstimatedInputTokens: requireSafeCount(
      manifest.totalEstimatedInputTokens,
      'input-token total',
    ),
    totalEstimatedOutputTokenAllowance: requireSafeCount(
      manifest.totalEstimatedOutputTokenAllowance,
      'output-token total',
    ),
    requestSetSha256: manifest.requestSetSha256 as string,
    customIdSequenceSha256: manifest.customIdSequenceSha256 as string,
  }
}

/**
 * Validate a stored prepared-request set from its exact textual artifacts.
 *
 * The order of work is the point: the raw ordered rows are kept as a sequence, each row's
 * digest is recomputed from its own bytes, multiplicity and order are proven over that
 * sequence, the manifest is proven against the recomputation, and only then is a lookup map
 * built. Nothing collapses before it has been counted.
 */
export function validatePreparedRequestSet(
  requestsJsonlText: string,
  manifestText: string,
): ValidatedPreparedRequestSet {
  const manifest = parseManifest(manifestText)

  // 1. The raw ordered row sequence, kept as a sequence.
  const rawLines = requestsJsonlText.split('\n').filter((line) => line.length > 0)
  if (rawLines.length === 0) refuse('The stored request journal holds no rows.')

  const validated: ValidatedPreparedRequest[] = []
  rawLines.forEach((line, index) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      refuse(`Stored request row ${index} is not valid JSON.`)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      refuse(`Stored request row ${index} is not a JSON object.`)
    }
    // 2. Shape, exactly: no unrecognized key may ride along beside the three that matter.
    const row = parsed as Record<string, unknown>
    const keys = Object.keys(row).sort()
    if (keys.length !== ROW_KEYS.length || keys.some((key, at) => key !== ROW_KEYS[at])) {
      refuse(`Stored request row ${index} does not carry exactly a custom id, digest, and body.`)
    }
    const customId = row.customId
    if (typeof customId !== 'string' || customId.length === 0) {
      refuse(`Stored request row ${index} has no custom id.`)
    }
    const declaredDigest = row.bodySha256
    if (typeof declaredDigest !== 'string' || !DIGEST_PATTERN.test(declaredDigest)) {
      refuse(`Stored request row ${index} has no body digest.`)
    }
    if (!row.body || typeof row.body !== 'object' || Array.isArray(row.body)) {
      refuse(`Stored request row ${index} has no request body.`)
    }
    // 3-5. The exact stored body bytes, re-hashed, and required to equal the stored claim.
    const body = row.body as Record<string, unknown>
    const bodyText = canonicalJson(body)
    const bodySha256 = sha256(bodyText)
    if (bodySha256 !== declaredDigest) {
      refuse(
        `Stored request row ${index} does not hash to its recorded digest: the stored bytes ` +
          'were altered after they were prepared.',
      )
    }
    // The body must also reconcile structurally, and the row's custom id must be the record id
    // the body itself carries — an id is not a label a caller gets to choose.
    const reconciliation = reconcileRequestBodyText(bodyText)
    if (reconciliation.recordId !== customId) {
      refuse(
        `Stored request row ${index} names a custom id that is not the record id its own body ` +
          'carries.',
      )
    }
    if (reconciliation.model !== manifest.model) {
      refuse(`Stored request row ${index} names a model the request manifest does not declare.`)
    }
    if (reconciliation.reasoningEffort !== manifest.reasoningEffort) {
      refuse(
        `Stored request row ${index} names a reasoning effort the request manifest does not ` +
          'declare.',
      )
    }
    validated.push({ customId, bodySha256, body, bodyText, reconciliation })
  })

  // 6. Multiplicity and order over the raw sequence, before any collapsing structure exists.
  const seenCustomIds = new Set<string>()
  const seenRecordIds = new Set<string>()
  validated.forEach((request, index) => {
    if (seenCustomIds.has(request.customId)) {
      refuse(`Stored request row ${index} repeats a duplicate custom id.`)
    }
    seenCustomIds.add(request.customId)
    if (seenRecordIds.has(request.reconciliation.recordId)) {
      refuse(`Stored request row ${index} repeats a duplicate record id.`)
    }
    seenRecordIds.add(request.reconciliation.recordId)
    if (index > 0 && !(validated[index - 1].customId < request.customId)) {
      refuse(
        `Stored request row ${index} breaks the canonical ascending custom-id order the ` +
          'preparation writes.',
      )
    }
  })

  // 7-9. The manifest is proven against the recomputation, never the other way round.
  if (manifest.requestCount !== validated.length) {
    refuse(
      `The stored request manifest declares ${manifest.requestCount} requests but the journal ` +
        `holds ${validated.length}; the stored count is wrong.`,
    )
  }
  const recomputedSetDigest = sha256(canonicalJson(validated.map((request) => request.bodySha256)))
  if (recomputedSetDigest !== manifest.requestSetSha256) {
    refuse(
      'The stored request-set digest does not match the digest recomputed from the stored ' +
        'bodies; rows were added, removed, reordered, or altered.',
    )
  }
  const recomputedIdDigest = sha256(canonicalJson(validated.map((request) => request.customId)))
  if (recomputedIdDigest !== manifest.customIdSequenceSha256) {
    refuse('The stored custom-id sequence does not match the sequence the manifest declares.')
  }
  const totals = validated.reduce(
    (sum, request) => ({
      inputTokens: sum.inputTokens + request.reconciliation.inputTokens,
      outputTokenAllowance: sum.outputTokenAllowance + request.reconciliation.outputTokenAllowance,
    }),
    { inputTokens: 0, outputTokenAllowance: 0 },
  )
  if (
    totals.inputTokens !== manifest.totalEstimatedInputTokens ||
    totals.outputTokenAllowance !== manifest.totalEstimatedOutputTokenAllowance
  ) {
    refuse(
      'The stored request manifest declares token totals the stored bodies do not reconcile ' +
        'to.',
    )
  }
  for (const [index, request] of validated.entries()) {
    const instructions = (request.body as { instructions?: unknown }).instructions
    if (typeof instructions !== 'string' || sha256(instructions) !== manifest.promptSha256) {
      refuse(
        `Stored request row ${index} carries prompt text the request manifest's prompt digest ` +
          'does not cover.',
      )
    }
  }

  // Only now: a lookup map, over a sequence whose multiplicity is already proven.
  return {
    requests: validated,
    manifest,
    byCustomId: new Map(validated.map((request) => [request.customId, request])),
  }
}

function isFileNotFound(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

/**
 * Read and validate the operation's stored prepared-request set, with the state root's
 * containment proof re-run on both artifacts. A set that exists only in part is incomplete,
 * not absent.
 */
export async function loadPreparedRequestSet(
  state: StateRoot,
  paths: OperationPaths,
): Promise<ValidatedPreparedRequestSet | null> {
  let requestsText: string | null = null
  let manifestText: string | null = null
  try {
    requestsText = await readRegularFile(paths.requestsJsonl, state)
  } catch (error) {
    if (!isFileNotFound(error)) throw error
  }
  try {
    manifestText = await readRegularFile(paths.requestManifestJson, state)
  } catch (error) {
    if (!isFileNotFound(error)) throw error
  }
  if (requestsText === null && manifestText === null) return null
  if (requestsText === null || manifestText === null) {
    refuse(
      'This operation holds only part of a prepared request set: a request journal without its ' +
        'manifest, or a manifest without its journal.',
    )
  }
  return validatePreparedRequestSet(requestsText, manifestText)
}

/** The same read, for a command that cannot proceed without prepared requests. */
export async function requirePreparedRequestSet(
  state: StateRoot,
  paths: OperationPaths,
): Promise<ValidatedPreparedRequestSet> {
  const set = await loadPreparedRequestSet(state, paths)
  if (!set) {
    refuse('This operation has no prepared requests. Run `prepare-requests` first.')
  }
  return set
}
