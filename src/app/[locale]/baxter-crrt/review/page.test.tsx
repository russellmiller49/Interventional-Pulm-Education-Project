import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX } from '@/features/baxter-crrt/content/candidateIdentity'

jest.mock('@/features/baxter-crrt/components/CrrtPhase7ReviewPanel', () => ({
  CrrtPhase7ReviewPanel: () => <section data-testid="phase7-review-panel">review panel</section>,
}))
jest.mock('@/features/baxter-crrt/components/CrrtPhase8ReviewPanel', () => ({
  CrrtPhase8ReviewPanel: () => <section data-testid="phase8-review-panel">review panel</section>,
}))

import BaxterCrrtReviewPage, { metadata } from './page'

describe('Baxter CRRT localized reviewer route', () => {
  const setRequestLocaleMock = jest.mocked(setRequestLocale)
  const originalCandidateId = process.env.BAXTER_CRRT_REVIEW_CANDIDATE_ID
  const originalManifestSha = process.env.BAXTER_CRRT_REVIEW_MANIFEST_SHA256
  const originalBuildId = process.env.BAXTER_CRRT_REVIEW_BUILD_ID

  beforeEach(() => {
    setRequestLocaleMock.mockClear()
    delete process.env.BAXTER_CRRT_REVIEW_CANDIDATE_ID
    delete process.env.BAXTER_CRRT_REVIEW_MANIFEST_SHA256
    delete process.env.BAXTER_CRRT_REVIEW_BUILD_ID
  })

  afterAll(() => {
    if (originalCandidateId === undefined) delete process.env.BAXTER_CRRT_REVIEW_CANDIDATE_ID
    else process.env.BAXTER_CRRT_REVIEW_CANDIDATE_ID = originalCandidateId
    if (originalManifestSha === undefined) delete process.env.BAXTER_CRRT_REVIEW_MANIFEST_SHA256
    else process.env.BAXTER_CRRT_REVIEW_MANIFEST_SHA256 = originalManifestSha
    if (originalBuildId === undefined) delete process.env.BAXTER_CRRT_REVIEW_BUILD_ID
    else process.env.BAXTER_CRRT_REVIEW_BUILD_ID = originalBuildId
  })

  it('is noindex and marks the page as analytics/progress isolated', async () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })

    render(await BaxterCrrtReviewPage({ params: Promise.resolve({ locale: 'en' }) }))

    expect(setRequestLocaleMock).toHaveBeenCalledWith('en')
    expect(screen.getByRole('main')).toHaveAttribute('data-reviewer-route', 'true')
    expect(screen.getByRole('main')).toHaveAttribute('data-analytics', 'none')
    expect(screen.getByRole('main')).toHaveAttribute('data-progress-write', 'none')
    expect(screen.getByRole('main')).toHaveAttribute(
      'data-candidate-state',
      'unfrozen-working-build',
    )
    expect(screen.getByRole('heading', { name: 'Unfrozen working build' })).toBeInTheDocument()
    expect(screen.getByText(/Do not sign this build/i)).toBeInTheDocument()
    expect(screen.getByTestId('phase7-review-panel')).toBeInTheDocument()
    expect(screen.getByTestId('phase8-review-panel')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Return to protected learner workspace/i }),
    ).toHaveAttribute('href', '/en/baxter-crrt')
  })

  it('renders a declared candidate and manifest identity without calling it approved', async () => {
    const candidateId = `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'a'.repeat(64)}`
    const manifestSha = 'b'.repeat(64)
    process.env.BAXTER_CRRT_REVIEW_CANDIDATE_ID = candidateId
    process.env.BAXTER_CRRT_REVIEW_MANIFEST_SHA256 = manifestSha
    process.env.BAXTER_CRRT_REVIEW_BUILD_ID = 'review-build:1'

    render(await BaxterCrrtReviewPage({ params: Promise.resolve({ locale: 'en' }) }))

    expect(screen.getByRole('main')).toHaveAttribute(
      'data-candidate-state',
      'declared-candidate-requires-manifest-verification',
    )
    expect(
      screen.getByRole('heading', { name: 'Declared candidate — verify manifest' }),
    ).toBeInTheDocument()
    expect(screen.getByText(candidateId)).toBeInTheDocument()
    expect(screen.getByText(manifestSha)).toBeInTheDocument()
    expect(screen.getByText('review-build:1')).toBeInTheDocument()
    expect(screen.getByText(/banner alone is not a freeze or approval/i)).toBeInTheDocument()
  })
})
