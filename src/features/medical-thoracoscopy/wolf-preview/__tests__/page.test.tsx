import { render, screen } from '@testing-library/react'

const jar = new Map<string, string>()
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  }),
}))
jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
jest.mock('@/features/medical-thoracoscopy/wolf-preview/WolfPreviewExplorer', () => ({
  WolfPreviewExplorer: () => <div data-testid="explorer" />,
}))

import Page, { metadata } from '@/app/[locale]/medical-thoracoscopy/wolf-preview/page'
import {
  codeVerifier,
  issueSession,
  newReviewCode,
  previewConfig,
  sessionCookie,
} from '../server/access'

/** The page renders the explorer only for a valid session; otherwise the code screen. */
const variables = process.env as Record<string, string | undefined>
const saved = { ...variables }
const CODE = newReviewCode()
const props = (review?: string) => ({
  params: Promise.resolve({ locale: 'en' }),
  searchParams: Promise.resolve(review ? { review } : {}),
})

beforeEach(() => {
  jar.clear()
  variables.MT_WOLF_PREVIEW_ENABLED = 'true'
  variables.MT_WOLF_PREVIEW_SESSION_SECRET = 'q'.repeat(40)
  variables.MT_WOLF_PREVIEW_REVIEWERS = `wolf-reviewer-1:${codeVerifier(CODE)}`
  variables.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.test'
  variables.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
})

afterAll(() => {
  for (const key of Object.keys(variables)) if (!(key in saved)) delete variables[key]
  Object.assign(variables, saved)
})

describe('wolf preview page', () => {
  it('is not found while the preview is off or unconfigured', async () => {
    for (const change of [
      { MT_WOLF_PREVIEW_ENABLED: 'false' },
      { MT_WOLF_PREVIEW_SESSION_SECRET: '' },
      { MT_WOLF_PREVIEW_REVIEWERS: '' },
    ]) {
      Object.assign(variables, change)
      await expect(Page(props())).rejects.toThrow('NEXT_NOT_FOUND')
      beforeEachReset()
    }
  })

  it('shows only the code screen without a session', async () => {
    render(await Page(props()))
    expect(
      screen.getByRole('heading', { name: 'Device Explorer — Manufacturer Review' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Review code')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Open preview' })).toBeInTheDocument()
    expect(screen.queryByTestId('explorer')).toBeNull()
    expect(document.body.innerHTML).not.toContain(CODE)
    expect(document.body.innerHTML).not.toContain('wolf-reviewer-1')
    expect(document.body.innerHTML).not.toContain(codeVerifier(CODE).slice(7))
  })

  it('says only that a code was not recognised', async () => {
    render(await Page(props('denied')))
    expect(screen.getByRole('alert')).toHaveTextContent('Review code not recognized.')
  })

  it('shows the explorer for a valid session and the code screen for a tampered one', async () => {
    const config = previewConfig()!
    const { value } = issueSession(config, config.reviewers[0])
    jar.set(sessionCookie().name, value)
    const { unmount } = render(await Page(props()))
    expect(screen.getByTestId('explorer')).toBeInTheDocument()
    unmount()
    jar.set(sessionCookie().name, `${value.slice(0, -3)}AAA`)
    render(await Page(props()))
    expect(screen.queryByTestId('explorer')).toBeNull()
    expect(screen.getByLabelText('Review code')).toBeInTheDocument()
  })

  it('says the preview is unavailable, without opening it, when storage is not configured', async () => {
    const config = previewConfig()!
    jar.set(sessionCookie().name, issueSession(config, config.reviewers[0]).value)
    delete variables.SUPABASE_SERVICE_ROLE_KEY
    render(await Page(props()))
    expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable')
    expect(screen.queryByTestId('explorer')).toBeNull()
  })

  it('is never indexed, archived or cached', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true, nocache: true })
  })
})

function beforeEachReset() {
  variables.MT_WOLF_PREVIEW_ENABLED = 'true'
  variables.MT_WOLF_PREVIEW_SESSION_SECRET = 'q'.repeat(40)
  variables.MT_WOLF_PREVIEW_REVIEWERS = `wolf-reviewer-1:${codeVerifier(CODE)}`
}
