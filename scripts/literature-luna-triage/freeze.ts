import {
  STAGE_A_CONTRACT_VERSION,
  STAGE_A_NEGATIVE_ONLY_REASON_CODES,
  STAGE_A_PROTECTIVE_REASON_CODES,
} from '../../src/features/literature/classifier/stage-a-contract'
import { UNIVERSAL_PACKET_SCHEMA_VERSION } from '../../src/features/literature/classifier/packet-contract'
import { COORDINATOR_RISK_LEXICON_VERSION } from '../../src/features/literature/classifier/risk-lexicon'
import { canonicalJson, checksumBody, sha256 } from '../literature-production-ingest/canonical'
import {
  LUNA_COST_ESTIMATOR_VERSION,
  LUNA_EVALUATION_VERSION,
  LUNA_FREEZE_RECEIPT_VERSION,
  type LunaReasoningEffort,
} from './constants'
import { buildStageAJsonSchema } from './openai'

/**
 * Locked-sanity freeze.
 *
 * Before the 200-record cohort may run, every surface that could influence its outputs is
 * hashed into one receipt: model, alias, reasoning effort, prompt, output schema, reason
 * vocabulary, packet schema, split manifest, evaluation version, and the cost estimator. The
 * receipt digest names the calibration version's frozen identity; the locked cohort runs once
 * per receipt digest, enforced by a create-once marker, and a failed locked run consumes the
 * attempt rather than becoming quiet tuning data.
 */

export interface FreezeInputs {
  readonly calibrationVersion: string
  readonly model: string
  readonly modelAlias: string | null
  readonly reasoningEffort: LunaReasoningEffort
  readonly promptText: string
  readonly splitManifestSha256: string
}

export interface FreezeReceipt {
  readonly receiptVersion: string
  readonly calibrationVersion: string
  readonly model: string
  readonly modelAlias: string | null
  readonly reasoningEffort: LunaReasoningEffort
  readonly promptSha256: string
  readonly outputSchemaSha256: string
  readonly reasonVocabularySha256: string
  readonly stageAContractVersion: string
  readonly packetSchemaVersion: string
  readonly riskLexiconVersion: string
  readonly splitManifestSha256: string
  readonly evaluationVersion: string
  readonly costEstimatorVersion: string
  readonly createdAt: string
  readonly receiptSha256: string
}

export function reasonVocabularySha256(): string {
  return sha256(
    canonicalJson({
      negativeOnly: [...STAGE_A_NEGATIVE_ONLY_REASON_CODES],
      protective: [...STAGE_A_PROTECTIVE_REASON_CODES],
    }),
  )
}

export function outputSchemaSha256(): string {
  return sha256(canonicalJson(buildStageAJsonSchema()))
}

const CALIBRATION_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/u

export function buildFreezeReceipt(inputs: FreezeInputs, createdAt: string): FreezeReceipt {
  if (!CALIBRATION_VERSION_PATTERN.test(inputs.calibrationVersion)) {
    throw new Error(
      'The calibration version must be a short lowercase identifier (3-64 characters).',
    )
  }
  const body = {
    receiptVersion: LUNA_FREEZE_RECEIPT_VERSION,
    calibrationVersion: inputs.calibrationVersion,
    model: inputs.model,
    modelAlias: inputs.modelAlias,
    reasoningEffort: inputs.reasoningEffort,
    promptSha256: sha256(inputs.promptText),
    outputSchemaSha256: outputSchemaSha256(),
    reasonVocabularySha256: reasonVocabularySha256(),
    stageAContractVersion: STAGE_A_CONTRACT_VERSION,
    packetSchemaVersion: UNIVERSAL_PACKET_SCHEMA_VERSION,
    riskLexiconVersion: COORDINATOR_RISK_LEXICON_VERSION,
    splitManifestSha256: inputs.splitManifestSha256,
    evaluationVersion: LUNA_EVALUATION_VERSION,
    costEstimatorVersion: LUNA_COST_ESTIMATOR_VERSION,
    createdAt,
  }
  const receipt = { ...body, receiptSha256: '' }
  return { ...body, receiptSha256: checksumBody(receipt, 'receiptSha256') }
}

export class FreezeDriftError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FreezeDriftError'
  }
}

/**
 * Verify a stored receipt against the currently effective surfaces. Any drift means the
 * calibration version no longer names what would actually run, and the locked cohort refuses.
 */
export function assertFreezeReceiptCurrent(receipt: FreezeReceipt, current: FreezeInputs): void {
  const recomputed = buildFreezeReceipt(current, receipt.createdAt)
  const drift: string[] = []
  for (const key of [
    'receiptVersion',
    'calibrationVersion',
    'model',
    'modelAlias',
    'reasoningEffort',
    'promptSha256',
    'outputSchemaSha256',
    'reasonVocabularySha256',
    'stageAContractVersion',
    'packetSchemaVersion',
    'riskLexiconVersion',
    'splitManifestSha256',
    'evaluationVersion',
    'costEstimatorVersion',
  ] as const) {
    if (recomputed[key] !== receipt[key]) drift.push(key)
  }
  if (checksumBody({ ...receipt }, 'receiptSha256') !== receipt.receiptSha256) {
    drift.push('receiptSha256')
  }
  if (drift.length > 0) {
    throw new FreezeDriftError(
      `The frozen calibration surface drifted since the receipt was created: ` +
        `${drift.join(', ')}. Freeze a new calibration version instead of rerunning this one.`,
    )
  }
}
