import { render, screen } from '@testing-library/react'
import { setRequestLocale } from 'next-intl/server'

import { BAXTER_CRRT_CONTENT_VERSION, baxterCrrtReleaseStage } from '@/features/baxter-crrt/content'

jest.mock('@/features/baxter-crrt/components/BaxterCrrtLab', () => ({
  __esModule: true,
  default: ({ locale, sessionMode }: { locale: string; sessionMode: string }) => (
    <main
      data-testid="baxter-crrt-lab"
      data-locale={locale}
      data-session-mode={sessionMode}
      data-analytics="suppressed"
      data-progress-write="suppressed"
    >
      Full CRRT workspace
    </main>
  ),
}))

import BaxterCrrtReviewPage, { metadata } from './page'

describe('Baxter CRRT localized final-SME preview route', () => {
  const setRequestLocaleMock = jest.mocked(setRequestLocale)

  beforeEach(() => setRequestLocaleMock.mockClear())

  it('is noindex and renders the full workspace with telemetry and persistence suppressed', async () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true })

    render(await BaxterCrrtReviewPage({ params: Promise.resolve({ locale: 'en' }) }))

    expect(setRequestLocaleMock).toHaveBeenCalledWith('en')
    expect(screen.getByRole('heading', { name: 'Baxter CRRT v1 preview' })).toBeInTheDocument()
    expect(screen.getByText(baxterCrrtReleaseStage)).toBeInTheDocument()
    expect(screen.getByText(BAXTER_CRRT_CONTENT_VERSION)).toBeInTheDocument()
    expect(screen.getAllByText('Suppressed')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Final SME review prompts' })).toBeInTheDocument()
    expect(screen.getByText(/no signature or approval record/i)).toBeInTheDocument()

    const workspace = screen.getByTestId('baxter-crrt-lab')
    expect(workspace).toHaveAttribute('data-locale', 'en')
    expect(workspace).toHaveAttribute('data-session-mode', 'review-preview')
    expect(workspace).toHaveAttribute('data-analytics', 'suppressed')
    expect(workspace).toHaveAttribute('data-progress-write', 'suppressed')
    expect(
      screen.getByRole('link', { name: /Return to protected learner workspace/i }),
    ).toHaveAttribute('href', '/en/baxter-crrt')
  })
})
