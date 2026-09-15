import {
  LUNA_ASSUMED_PRICING,
  LUNA_REASONING_OUTPUT_TOKEN_ALLOWANCE,
  LUNA_REQUEST_TOKEN_OVERHEAD,
  LUNA_STRUCTURED_OUTPUT_TOKEN_ALLOWANCE,
  LUNA_TOKENS_PER_CHARACTER,
  type LunaReasoningEffort,
} from './constants'

/**
 * Deterministic token/cost estimation, versioned as part of the frozen calibration surface.
 *
 * These are ceiling-enforcement estimates, not billing truth: characters-per-token is a fixed
 * heuristic and the price table is recorded as an assumption. The runner refuses to spend
 * without an explicit owner ceiling, and the estimate exists so that ceiling means something
 * before the first request leaves the machine.
 */

export interface RequestEstimate {
  readonly inputTokens: number
  readonly outputTokenAllowance: number
}

export interface CohortEstimate {
  readonly estimatorVersion: string
  readonly records: number
  readonly inputTokens: number
  readonly outputTokenAllowance: number
  readonly totalTokenAllowance: number
  readonly estimatedCostUsd: number
  readonly batchDiscountApplied: boolean
  readonly pricingAssumed: true
}

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length * LUNA_TOKENS_PER_CHARACTER)
}

export function estimateRequestTokens(
  instructionsText: string,
  packetJson: string,
  reasoning: LunaReasoningEffort,
): RequestEstimate {
  return {
    inputTokens:
      estimateTextTokens(instructionsText) +
      estimateTextTokens(packetJson) +
      LUNA_REQUEST_TOKEN_OVERHEAD,
    outputTokenAllowance:
      LUNA_STRUCTURED_OUTPUT_TOKEN_ALLOWANCE + LUNA_REASONING_OUTPUT_TOKEN_ALLOWANCE[reasoning],
  }
}

export function estimateCohortCost(
  requests: readonly RequestEstimate[],
  options: { readonly batch: boolean },
): CohortEstimate {
  const inputTokens = requests.reduce((sum, request) => sum + request.inputTokens, 0)
  const outputTokenAllowance = requests.reduce(
    (sum, request) => sum + request.outputTokenAllowance,
    0,
  )
  const discount = options.batch ? LUNA_ASSUMED_PRICING.batchDiscountMultiplier : 1
  const estimatedCostUsd =
    discount *
    ((inputTokens / 1_000_000) * LUNA_ASSUMED_PRICING.inputUsdPerMillionTokens +
      (outputTokenAllowance / 1_000_000) * LUNA_ASSUMED_PRICING.outputUsdPerMillionTokens)
  return {
    estimatorVersion: LUNA_ASSUMED_PRICING.version,
    records: requests.length,
    inputTokens,
    outputTokenAllowance,
    totalTokenAllowance: inputTokens + outputTokenAllowance,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    batchDiscountApplied: options.batch,
    pricingAssumed: true,
  }
}

export class CostCeilingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CostCeilingError'
  }
}

/** Enforce the owner's spend ceiling against the deterministic estimate. */
export function assertWithinCostCeiling(
  estimate: CohortEstimate,
  maxEstimatedCostUsd: number,
): void {
  if (!Number.isFinite(maxEstimatedCostUsd) || maxEstimatedCostUsd <= 0) {
    throw new CostCeilingError('--max-estimated-cost-usd must be a positive number.')
  }
  if (estimate.estimatedCostUsd > maxEstimatedCostUsd) {
    throw new CostCeilingError(
      `The estimated cost $${estimate.estimatedCostUsd.toFixed(4)} exceeds the authorized ` +
        `ceiling $${maxEstimatedCostUsd.toFixed(4)}. Nothing was sent.`,
    )
  }
}

export class RecordCeilingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordCeilingError'
  }
}

/** Enforce the owner's record ceiling before any request exists. */
export function assertWithinRecordCeiling(recordCount: number, maxRecords: number): void {
  if (!Number.isInteger(maxRecords) || maxRecords <= 0) {
    throw new RecordCeilingError('--max-records must be a positive integer.')
  }
  if (recordCount > maxRecords) {
    throw new RecordCeilingError(
      `The selected cohort holds ${recordCount} records, above the authorized --max-records ` +
        `${maxRecords}. Nothing was sent.`,
    )
  }
}
