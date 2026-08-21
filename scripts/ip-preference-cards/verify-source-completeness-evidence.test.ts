import { assertReviewedEvidenceFileFact } from './verify-source-completeness-evidence'

describe('source-completeness evidence file facts', () => {
  const reviewed = {
    evidenceId: 'EVID-TEST',
    sha256: 'a'.repeat(64),
    pageCount: 2,
  }

  test('accepts matching facts derived from a local PDF', () => {
    expect(() =>
      assertReviewedEvidenceFileFact(reviewed, {
        sha256: 'a'.repeat(64),
        pageCount: 2,
      }),
    ).not.toThrow()
  })

  test('fails closed on either a hash or page-count mismatch', () => {
    expect(() =>
      assertReviewedEvidenceFileFact(reviewed, {
        sha256: 'b'.repeat(64),
        pageCount: 2,
      }),
    ).toThrow(/SHA-256 mismatch/u)
    expect(() =>
      assertReviewedEvidenceFileFact(reviewed, {
        sha256: 'a'.repeat(64),
        pageCount: 3,
      }),
    ).toThrow(/page-count mismatch/u)
  })
})
