/** @jest-environment node */
import type { NextRequest } from 'next/server'
import { proxy } from './proxy'
import { createServerClient } from '@supabase/ssr'
import { SITE_USER_AGREEMENT_VERSION } from '@/lib/site-auth/user-agreement'

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
jest.mock('@/lib/site-auth/local-dev-auth', () => ({
  hasValidLocalDevAuthCookie: () => false,
  LOCAL_DEV_AUTH_COOKIE_NAME: 'dev-auth',
}))
jest.mock('next/server', () => ({
  NextResponse: {
    next: () => ({ headers: new Headers(), cookies: { set: jest.fn(), getAll: () => [] } }),
    redirect: (url: URL) => ({
      headers: new Headers({ location: url.toString() }),
      cookies: { set: jest.fn() },
    }),
  },
}))

const completeProfile = {
  onboarding_completed_at: '2026-06-10T00:00:00Z',
  agreement_accepted_at: '2026-06-10T00:00:00Z',
  agreement_version: SITE_USER_AGREEMENT_VERSION,
  performance_research_consent: true,
}

function configureAccount(profile: unknown, signedIn = true) {
  const from = jest.fn((table: string) => {
    const result = {
      data: table === 'site_profiles' ? profile : { entitlement: 'socal_ebus_course' },
    }
    const query: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'or', 'in', 'limit']) query[method] = () => query
    query.maybeSingle = jest.fn(async () => result)
    return query
  })
  jest.mocked(createServerClient).mockReturnValue({
    auth: {
      getUser: async () => ({
        data: { user: signedIn ? { id: 'course-user', email_confirmed_at: '2026-06-01' } : null },
      }),
    },
    from,
  } as unknown as ReturnType<typeof createServerClient>)
  return from
}

async function visit(path: string) {
  const url = new URL(path, 'https://interventionalpulm.org')
  const response = await proxy({
    url: url.toString(),
    nextUrl: Object.assign(url, { clone: () => new URL(url) }),
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as NextRequest)
  const location = response.headers.get('location')
  return location ? new URL(location) : null
}

beforeEach(() => configureAccount(completeProfile))

it.each(['/en/pccm-intro-course', '/en/socal-ebus-course', '/socal-ebus-course/app/index.html'])(
  'sends anonymous course visitors to main-site login: %s',
  async (path) => {
    configureAccount(null, false)
    expect((await visit(path))?.pathname).toBe('/en/login')
  },
)

it.each([
  null,
  { onboarding_completed_at: '2026-06-01' },
  { ...completeProfile, performance_research_consent: false },
])('requires registration and consent before checking course entitlement', async (profile) => {
  const from = configureAccount(profile)
  const location = await visit('/es/socal-ebus-course')
  expect(location?.pathname).toBe('/es/signup')
  expect(location?.searchParams.get('mode')).toBe('complete')
  expect(location?.searchParams.get('next')).toBe('/es/dashboard?courses=closed')
  expect(from).not.toHaveBeenCalledWith('site_entitlements')
  expect(from).not.toHaveBeenCalledWith('learner_profiles')
})

it.each([
  '/en/pccm-intro-course/assessments/bronchoscopy_pre',
  '/socal-ebus-course/app/index.html',
])('closes courses even for completed accounts with existing entitlements: %s', async (path) => {
  const location = await visit(path)
  expect(location?.pathname).toBe('/en/dashboard')
  expect(location?.searchParams.get('courses')).toBe('closed')
})

it('requires consent on other entitlement-protected routes too', async () => {
  configureAccount({ onboarding_completed_at: '2026-06-01' })
  expect((await visit('/en/ip-registry'))?.pathname).toBe('/en/signup')
})

it('lets completed main-site users reach their dashboard', async () => {
  expect(await visit('/en/dashboard')).toBeNull()
})

it('does not trap former PCCM learners behind the closed course pretests', async () => {
  const from = configureAccount(completeProfile)
  expect(await visit('/en/intro-bronchoscopy')).toBeNull()
  expect(from).not.toHaveBeenCalledWith('pccm_intro_course_enrollments')
})

it('preserves standalone public training and callback access', async () => {
  expect(
    await visit('/socal-ebus-course/app/index.html?publicTraining=1&publicScope=ebus'),
  ).toBeNull()
  expect(await visit('/socal-ebus-course/app?authCallback=1')).toBeNull()
})
