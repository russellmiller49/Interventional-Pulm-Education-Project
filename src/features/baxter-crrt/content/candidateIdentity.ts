export const BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX = 'baxter-crrt-rc-v2-sha256-' as const

const BAXTER_CRRT_EXACT_CANDIDATE_ID_PATTERN = /^baxter-crrt-rc-v2-sha256-[a-f0-9]{64}$/u

export function isBaxterCrrtExactCandidateIdentity(value: string | null): value is string {
  return value !== null && BAXTER_CRRT_EXACT_CANDIDATE_ID_PATTERN.test(value)
}
