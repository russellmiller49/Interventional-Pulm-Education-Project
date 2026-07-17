import {
  isBaxterCrrtAttestationSha256,
  isBaxterCrrtExactCandidateIdentity,
} from './content/activation'

export const BAXTER_CRRT_REVIEW_CANDIDATE_ID_ENV = 'BAXTER_CRRT_REVIEW_CANDIDATE_ID' as const
export const BAXTER_CRRT_REVIEW_MANIFEST_SHA256_ENV = 'BAXTER_CRRT_REVIEW_MANIFEST_SHA256' as const
export const BAXTER_CRRT_REVIEW_BUILD_ID_ENV = 'BAXTER_CRRT_REVIEW_BUILD_ID' as const

export interface BaxterCrrtReviewBuildEnvironment {
  readonly [key: string]: string | undefined
  readonly BAXTER_CRRT_REVIEW_CANDIDATE_ID?: string
  readonly BAXTER_CRRT_REVIEW_MANIFEST_SHA256?: string
  readonly BAXTER_CRRT_REVIEW_BUILD_ID?: string
}

export interface BaxterCrrtReviewBuildIdentity {
  readonly state: 'declared-candidate-requires-manifest-verification' | 'unfrozen-working-build'
  readonly candidateId: string | null
  readonly manifestSha256: string | null
  readonly buildId: string | null
  readonly formalReviewEligible: false
}

const BUILD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,127}$/u

function validBuildId(value: string | undefined): string | null {
  if (value === undefined || !BUILD_ID_PATTERN.test(value)) return null
  return value
}

/**
 * A rendered identifier helps reviewers detect the wrong build, but environment
 * values alone never establish a clean commit, a verified manifest, or approval.
 */
export function resolveBaxterCrrtReviewBuildIdentity(
  environment: BaxterCrrtReviewBuildEnvironment,
): BaxterCrrtReviewBuildIdentity {
  const candidateIdInput = environment.BAXTER_CRRT_REVIEW_CANDIDATE_ID ?? null
  const manifestSha256Input = environment.BAXTER_CRRT_REVIEW_MANIFEST_SHA256 ?? null
  const candidateId = isBaxterCrrtExactCandidateIdentity(candidateIdInput) ? candidateIdInput : null
  const manifestSha256 = isBaxterCrrtAttestationSha256(manifestSha256Input)
    ? manifestSha256Input
    : null
  const declared = candidateId !== null && manifestSha256 !== null

  return Object.freeze({
    state: declared
      ? 'declared-candidate-requires-manifest-verification'
      : 'unfrozen-working-build',
    candidateId: declared ? candidateId : null,
    manifestSha256: declared ? manifestSha256 : null,
    buildId: validBuildId(environment.BAXTER_CRRT_REVIEW_BUILD_ID),
    formalReviewEligible: false,
  })
}
