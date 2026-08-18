import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { LunaCohort, LunaReasoningEffort } from './constants'
import { LUNA_LOCKED_SANITY_COHORT_SIZE } from './constants'
import type { FreezeReceipt } from './freeze'

/**
 * Locked-sanity execution authority.
 *
 * The locked 200 are the one cohort whose result means anything: they are seen once, under one
 * frozen surface, through one dedicated pathway. Three things enforce that here.
 *
 * First, **membership is a refusal, not a warning**: generic inference commands reject a
 * locked-sanity operation and reject any packet set that touches a locked identity, so there
 * is no ordinary command that can quietly consume the locked cohort.
 *
 * Second, **the frozen receipt is the only source of execution configuration**: model,
 * reasoning effort, prompt, schema, vocabulary, and split identities come from the validated
 * freeze with no default fallback and no post-freeze override, so verification and execution
 * cannot diverge into two different runs.
 *
 * Third, **the once-only marker is keyed to canonical identity, not to a filename**: the
 * marker path is derived from the calibration version, the freeze digest, the locked-manifest
 * digest, and the model/prompt/schema identities, so copying, moving, or renaming a receipt
 * lands on exactly the same marker and the second run refuses.
 */

export const LUNA_LOCKED_SANITY_COHORT: LunaCohort = 'locked-sanity-200'

export const LUNA_LOCKED_RUN_IDENTITY_VERSION = 'literature-luna-locked-run-identity/1.0.0'

export class LockedCohortError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LockedCohortError'
  }
}

/**
 * The canonical identity of one locked run. Every surface that could change what the locked
 * cohort sees is inside the digest; nothing about where a receipt happens to be stored is.
 */
export function lockedRunIdentitySha256(
  receipt: FreezeReceipt,
  lockedSanityIdentitySha256: string,
): string {
  if (!/^[0-9a-f]{64}$/u.test(lockedSanityIdentitySha256)) {
    throw new LockedCohortError('The locked-sanity identity digest is malformed.')
  }
  if (!receipt || typeof receipt !== 'object' || !/^[0-9a-f]{64}$/u.test(receipt.receiptSha256)) {
    throw new LockedCohortError('The freeze receipt has no valid digest.')
  }
  return sha256(
    canonicalJson({
      version: LUNA_LOCKED_RUN_IDENTITY_VERSION,
      calibrationVersion: receipt.calibrationVersion,
      freezeReceiptSha256: receipt.receiptSha256,
      lockedSanityIdentitySha256,
      splitManifestSha256: receipt.splitManifestSha256,
      model: receipt.model,
      modelAlias: receipt.modelAlias,
      reasoningEffort: receipt.reasoningEffort,
      promptSha256: receipt.promptSha256,
      outputSchemaSha256: receipt.outputSchemaSha256,
      reasonVocabularySha256: receipt.reasonVocabularySha256,
      stageAContractVersion: receipt.stageAContractVersion,
      packetSchemaVersion: receipt.packetSchemaVersion,
      riskLexiconVersion: receipt.riskLexiconVersion,
      evaluationVersion: receipt.evaluationVersion,
      costEstimatorVersion: receipt.costEstimatorVersion,
    }),
  )
}

/** The one deterministic marker filename for a locked run identity. */
export function lockedRunMarkerFilename(lockedRunIdentity: string): string {
  if (!/^[0-9a-f]{64}$/u.test(lockedRunIdentity)) {
    throw new LockedCohortError('The locked-run identity digest is malformed.')
  }
  return `${lockedRunIdentity}.marker.json`
}

/**
 * Refuse a locked-sanity operation on any generic pathway. Only the dedicated locked-run
 * coordinator, holding a validated freeze, may touch this cohort.
 */
export function assertGenericCommandNotLocked(cohort: string, command: string): void {
  if (cohort === LUNA_LOCKED_SANITY_COHORT) {
    throw new LockedCohortError(
      `${command} refuses the ${LUNA_LOCKED_SANITY_COHORT} cohort. The locked cohort runs only ` +
        'through run-locked, once, under a validated freeze receipt.',
    )
  }
}

/**
 * Refuse any packet set that touches a locked identity, whatever the operation calls itself.
 * The cohort label is a claim; membership is the fact.
 */
export function assertNoLockedMembership(
  pmids: readonly string[],
  lockedSanityPmids: ReadonlySet<string>,
  command: string,
): void {
  if (lockedSanityPmids.size !== LUNA_LOCKED_SANITY_COHORT_SIZE) {
    throw new LockedCohortError(
      `The locked-sanity membership set holds ${lockedSanityPmids.size} identities, not ` +
        `${LUNA_LOCKED_SANITY_COHORT_SIZE}; refusing to check membership against it.`,
    )
  }
  let overlap = 0
  for (const pmid of pmids) {
    if (lockedSanityPmids.has(pmid)) overlap += 1
  }
  if (overlap > 0) {
    throw new LockedCohortError(
      `${command} refuses this operation: ${overlap} of its records are locked-sanity ` +
        'members. Only run-locked may send the locked cohort to the model.',
    )
  }
}

/**
 * The execution configuration a locked run must use. Every value comes from the validated
 * freeze receipt; there is no default and no caller override once a freeze exists.
 */
export interface FrozenExecutionConfiguration {
  readonly calibrationVersion: string
  readonly model: string
  readonly reasoningEffort: LunaReasoningEffort
  readonly promptSha256: string
  readonly outputSchemaSha256: string
  readonly reasonVocabularySha256: string
  readonly packetSchemaVersion: string
  readonly splitManifestSha256: string
  readonly evaluationVersion: string
  readonly costEstimatorVersion: string
}

/**
 * Derive the frozen execution configuration, refusing any caller-supplied override. A run that
 * verifies one model and then executes a defaulted other model is two runs pretending to be
 * one; the override is refused rather than silently losing.
 */
export function frozenExecutionConfiguration(
  receipt: FreezeReceipt,
  overrides: { readonly model?: string; readonly reasoningEffort?: string },
): FrozenExecutionConfiguration {
  if (overrides.model !== undefined) {
    throw new LockedCohortError(
      'A locked run takes its model from the freeze receipt; --model may not override it.',
    )
  }
  if (overrides.reasoningEffort !== undefined) {
    throw new LockedCohortError(
      'A locked run takes its reasoning effort from the freeze receipt; --reasoning may not ' +
        'override it.',
    )
  }
  if (typeof receipt.model !== 'string' || receipt.model.length === 0) {
    throw new LockedCohortError('The freeze receipt names no model; refusing to run locked.')
  }
  return {
    calibrationVersion: receipt.calibrationVersion,
    model: receipt.model,
    reasoningEffort: receipt.reasoningEffort,
    promptSha256: receipt.promptSha256,
    outputSchemaSha256: receipt.outputSchemaSha256,
    reasonVocabularySha256: receipt.reasonVocabularySha256,
    packetSchemaVersion: receipt.packetSchemaVersion,
    splitManifestSha256: receipt.splitManifestSha256,
    evaluationVersion: receipt.evaluationVersion,
    costEstimatorVersion: receipt.costEstimatorVersion,
  }
}

/**
 * Prove that what the request manifest will actually send agrees exactly with the freeze.
 * Verification and execution read the same two fields here, so they cannot drift apart.
 */
export function assertExecutionMatchesFreeze(
  configuration: FrozenExecutionConfiguration,
  actual: {
    readonly model: string
    readonly reasoningEffort: string
    readonly promptSha256: string
  },
): void {
  const drift: string[] = []
  if (actual.model !== configuration.model) drift.push('model')
  if (actual.reasoningEffort !== configuration.reasoningEffort) drift.push('reasoningEffort')
  if (actual.promptSha256 !== configuration.promptSha256) drift.push('promptSha256')
  if (drift.length > 0) {
    throw new LockedCohortError(
      `The locked run would send ${drift.join(', ')} that the freeze does not name. Freeze a ` +
        'new calibration version instead.',
    )
  }
}
