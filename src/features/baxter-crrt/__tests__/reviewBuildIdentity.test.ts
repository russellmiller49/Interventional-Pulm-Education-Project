import {
  resolveBaxterCrrtReviewBuildIdentity,
  type BaxterCrrtReviewBuildEnvironment,
} from '../reviewBuildIdentity'
import { BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX } from '../content/candidateIdentity'

const candidateId = `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'a'.repeat(64)}`
const manifestSha256 = 'b'.repeat(64)

describe('Baxter CRRT review build identity', () => {
  it('marks a build without an exact candidate and manifest digest as unfrozen', () => {
    expect(resolveBaxterCrrtReviewBuildIdentity({})).toEqual({
      state: 'unfrozen-working-build',
      candidateId: null,
      manifestSha256: null,
      buildId: null,
      formalReviewEligible: false,
    })
  })

  it('retains a valid declared identity without calling it formally eligible', () => {
    expect(
      resolveBaxterCrrtReviewBuildIdentity({
        BAXTER_CRRT_REVIEW_CANDIDATE_ID: candidateId,
        BAXTER_CRRT_REVIEW_MANIFEST_SHA256: manifestSha256,
        BAXTER_CRRT_REVIEW_BUILD_ID: 'review-build:2026-07-17.1',
      }),
    ).toEqual({
      state: 'declared-candidate-requires-manifest-verification',
      candidateId,
      manifestSha256,
      buildId: 'review-build:2026-07-17.1',
      formalReviewEligible: false,
    })
  })

  it.each([
    { BAXTER_CRRT_REVIEW_CANDIDATE_ID: 'commit:abc123' },
    { BAXTER_CRRT_REVIEW_CANDIDATE_ID: candidateId },
    { BAXTER_CRRT_REVIEW_MANIFEST_SHA256: manifestSha256 },
    {
      BAXTER_CRRT_REVIEW_CANDIDATE_ID: candidateId,
      BAXTER_CRRT_REVIEW_MANIFEST_SHA256: 'not-a-digest',
    },
  ] satisfies BaxterCrrtReviewBuildEnvironment[])(
    'fails a partial or malformed declaration closed',
    (environment) => {
      expect(resolveBaxterCrrtReviewBuildIdentity(environment)).toMatchObject({
        state: 'unfrozen-working-build',
        candidateId: null,
        manifestSha256: null,
        formalReviewEligible: false,
      })
    },
  )

  it('drops an unsafe or unbounded build label', () => {
    expect(
      resolveBaxterCrrtReviewBuildIdentity({
        BAXTER_CRRT_REVIEW_BUILD_ID: '<script>alert(1)</script>',
      }).buildId,
    ).toBeNull()
  })
})
