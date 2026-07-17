import { isBaxterCrrtExactCandidateIdentity } from './candidateIdentity'
import type { BaxterCrrtReviewStatus } from './reviewStatus'

/**
 * Normalized runtime dispositions. Review-packet display values are mapped to
 * this closed vocabulary before they enter an activation or publication gate.
 * Only `accepted` can unlock either gate.
 */
export const CRRT_EXACT_VERSION_DISPOSITIONS = Object.freeze([
  'accepted',
  'changes-required',
  'rejected',
] as const)

export type CrrtExactVersionDisposition = (typeof CRRT_EXACT_VERSION_DISPOSITIONS)[number]

export interface BaxterCrrtReviewAttestationFields {
  readonly reviewer: string | null
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly exactCandidateIdentity: string | null
  readonly candidateManifestSha256: string | null
  readonly findingsLedgerSha256: string | null
  readonly reviewScopeSha256: string | null
  readonly exactVersionDisposition: CrrtExactVersionDisposition | null
  readonly attestedAt: string | null
  readonly attestationArtifactId: string | null
  readonly attestationSha256: string | null
}

function hasRecordedText(value: string | null): value is string {
  return value !== null && value.trim().length > 0
}

const CRRT_ATTESTATION_SHA256_PATTERN = /^[a-f0-9]{64}$/u
const ISO_ATTESTATION_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/u

export function isBaxterCrrtAttestationSha256(value: string | null): value is string {
  return value !== null && CRRT_ATTESTATION_SHA256_PATTERN.test(value)
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  if ([4, 6, 9, 11].includes(month)) return 30
  return 31
}

export function isBaxterCrrtIsoAttestationTime(value: string | null): value is string {
  if (value === null) return false
  const match = ISO_ATTESTATION_TIME_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = match[8] === undefined ? 0 : Number(match[8])
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9])
  const validUtcOffset = offsetHour < 14 || (offsetHour === 14 && offsetMinute === 0)

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetMinute <= 59 &&
    validUtcOffset &&
    Number.isFinite(Date.parse(value))
  )
}

export function hasCompleteBaxterCrrtReviewAttestationFields(
  review: BaxterCrrtReviewAttestationFields,
  exactCandidateIdentity: string | null,
  candidateManifestSha256: string | null,
  findingsLedgerSha256: string | null,
  expectedReviewScopeSha256: string | null,
): boolean {
  return (
    isBaxterCrrtExactCandidateIdentity(exactCandidateIdentity) &&
    hasRecordedText(review.reviewer) &&
    review.reviewStatus === 'approved' &&
    isBaxterCrrtExactCandidateIdentity(review.exactCandidateIdentity) &&
    review.exactCandidateIdentity === exactCandidateIdentity &&
    isBaxterCrrtAttestationSha256(candidateManifestSha256) &&
    review.candidateManifestSha256 === candidateManifestSha256 &&
    isBaxterCrrtAttestationSha256(review.candidateManifestSha256) &&
    isBaxterCrrtAttestationSha256(findingsLedgerSha256) &&
    review.findingsLedgerSha256 === findingsLedgerSha256 &&
    isBaxterCrrtAttestationSha256(review.findingsLedgerSha256) &&
    isBaxterCrrtAttestationSha256(expectedReviewScopeSha256) &&
    review.reviewScopeSha256 === expectedReviewScopeSha256 &&
    isBaxterCrrtAttestationSha256(review.reviewScopeSha256) &&
    review.exactVersionDisposition === 'accepted' &&
    isBaxterCrrtIsoAttestationTime(review.attestedAt) &&
    hasRecordedText(review.attestationArtifactId) &&
    isBaxterCrrtAttestationSha256(review.attestationSha256)
  )
}
