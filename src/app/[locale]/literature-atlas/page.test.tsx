/** @jest-environment node */
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'

import { issueSession, viewerConfig } from '@/features/literature-atlas-viewer/server/access'

let cookieValue: string | undefined
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name.endsWith('literature-atlas-viewer') && cookieValue ? { value: cookieValue } : undefined,
  }),
}))
jest.mock('next-intl/server', () => ({ setRequestLocale: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
jest.mock('@/i18n/handoff', () => ({
  HandoffContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import Page, { dynamic } from './page'

const salt = randomBytes(16)
const HASH = `pbkdf2_sha256$100000$${salt.toString('hex')}$${pbkdf2Sync('INVENTED-pass', salt, 100_000, 32, 'sha256').toString('hex')}`
const ENV = {
  LITERATURE_ATLAS_VIEWER_HASH: HASH,
  LITERATURE_ATLAS_VIEWER_SECRET: 'INVENTED-session-secret-for-tests-0123456789',
  LITERATURE_ATLAS_RELAY_SECRET: 'INVENTED-relay-secret-for-tests-0123456789',
}

async function render(query: Record<string, string> = {}) {
  const element = await Page({
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve(query),
  })
  return renderToStaticMarkup(element)
}

describe('Literature Atlas main page', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    cookieValue = undefined
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    delete process.env.LITERATURE_ATLAS_STAGING_TRIAL_REVIEW_URL
    Object.assign(process.env, ENV)
  })
  afterEach(() => {
    for (const key of [
      ...Object.keys(ENV),
      'LITERATURE_ATLAS_GATE_ALL',
      'RAILWAY_ENVIRONMENT_NAME',
      'LITERATURE_ATLAS_STAGING_TRIAL_REVIEW_URL',
    ])
      delete process.env[key]
    Object.assign(process.env, saved)
  })

  it('is rendered per request', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('shows the open Atlas frame when the switch is off', async () => {
    const html = await render()
    expect(html).toContain('<iframe')
  })

  it('switch on, signed out: form for the Atlas, no iframe', async () => {
    process.env.LITERATURE_ATLAS_GATE_ALL = '1'
    const html = await render({ viewer: 'denied' })
    expect(html).not.toContain('<iframe')
    expect(html).toContain('type="password"')
    expect(html).toContain('name="return" value="atlas"')
    expect(html).toContain('private preview')
    expect(html).toContain('That password is not right.')
  })

  it("switch on, signed in: today's page with the iframe", async () => {
    process.env.LITERATURE_ATLAS_GATE_ALL = '1'
    cookieValue = issueSession(viewerConfig()!).value
    const html = await render()
    expect(html).toContain('<iframe')
    expect(html).not.toContain('type="password"')
  })

  it('switch on without viewer configuration: not available, never the Atlas', async () => {
    process.env.LITERATURE_ATLAS_GATE_ALL = '1'
    delete process.env.LITERATURE_ATLAS_VIEWER_HASH
    const html = await render()
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('type="password"')
    expect(html).toContain('not available')
  })

  it('offers independent staging review sign-ins without opening the Atlas iframe', async () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = 'staging'
    process.env.LITERATURE_ATLAS_GATE_ALL = '1'
    process.env.LITERATURE_ATLAS_STAGING_TRIAL_REVIEW_URL =
      'https://review-staging-staging.up.railway.app/review/trials'
    for (const signedIn of [false, true]) {
      cookieValue = signedIn ? issueSession(viewerConfig()!).value : undefined
      const html = await render()
      expect(html).toContain('href="https://review.interventionalpulm.org/review"')
      expect(html).toContain('Verify Article Data')
      expect(html).toContain('(live WS1 portal)')
      expect(html).toContain('href="https://review-staging-staging.up.railway.app/review/trials"')
      expect(html).toContain('Classify Clinical Trials')
      expect(html.includes('<iframe')).toBe(signedIn)
    }
  })

  it.each([
    ['production', 'https://review-staging-staging.up.railway.app/review/trials'],
    ['staging', 'https://review.interventionalpulm.org/review/trials'],
    ['staging', 'https://review-staging-staging.up.railway.app/review'],
  ])('keeps trial classification hidden for %s with %s', async (environment, url) => {
    process.env.RAILWAY_ENVIRONMENT_NAME = environment
    process.env.LITERATURE_ATLAS_STAGING_TRIAL_REVIEW_URL = url
    const html = await render()
    expect(html).not.toContain('Classify Clinical Trials')
    expect(html).toContain('href="https://review.interventionalpulm.org/review"')
    if (environment === 'production') expect(html).toContain('Physician Review')
  })
})
