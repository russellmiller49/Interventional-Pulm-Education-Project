/** @jest-environment node */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SITE_USER_AGREEMENT_VERSION } from '@/lib/site-auth/user-agreement'
import { betaModuleReviewPath, betaModules } from './catalog'

/*
 * Who reaches Live Bronchoscopy Anatomy, decided the way production decides it: the real proxy,
 * then the real route layouts, with draft modules off. A development server enables draft modules
 * for everyone, so neither `next dev` nor the hub's browser suite can show these answers.
 */

const mockCreateServerClient = jest.fn()
jest.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}))
jest.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}))
// The lesson itself is a browser-only 3D and video bundle; this suite is about who reaches it.
jest.mock('@/components/airway-anatomy-lesson/AirwayAnatomyLessonDynamic', () => ({
  AirwayAnatomyLessonDynamic: () => 'lesson-mounted',
}))

interface Account {
  user: { id: string; email_confirmed_at?: string } | null
  profile: Record<string, unknown> | null
  entitlements: string[]
}

const registered = {
  onboarding_completed_at: '2026-06-10T00:00:00Z',
  agreement_accepted_at: '2026-06-10T00:00:00Z',
  agreement_version: SITE_USER_AGREEMENT_VERSION,
  performance_research_consent: true,
}
const verifiedUser = { id: 'user-1', email_confirmed_at: '2026-06-01T00:00:00Z' }

const accounts = {
  signedOut: { user: null, profile: null, entitlements: [] },
  unverified: { user: { id: 'user-1' }, profile: registered, entitlements: [] },
  unregistered: { user: verifiedUser, profile: null, entitlements: [] },
  reviewer: { user: verifiedUser, profile: registered, entitlements: [] },
  courseLearner: {
    user: verifiedUser,
    profile: registered,
    entitlements: ['pccm_intro_course'],
  },
  siteAdmin: { user: verifiedUser, profile: registered, entitlements: ['site_admin'] },
} satisfies Record<string, Account>

function fakeSupabase(account: Account) {
  return {
    auth: { getUser: async () => ({ data: { user: account.user }, error: null }) },
    from(table: string) {
      let rows: Record<string, unknown>[] = []
      if (table === 'site_profiles' && account.profile) rows = [account.profile]
      if (table === 'site_entitlements') {
        rows = account.entitlements.map((entitlement) => ({ entitlement, status: 'active' }))
      }
      const query: Record<string, unknown> = {
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => !(column in row) || row[column] === value)
          return query
        },
        in(column: string, values: unknown[]) {
          rows = rows.filter((row) => !(column in row) || values.includes(row[column]))
          return query
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      }
      for (const method of ['select', 'or', 'limit']) query[method] = () => query
      return query
    },
  }
}

const appRoot = join(process.cwd(), 'src', 'app', '[locale]')

/** The layouts Next would run for a path, or null when no page matches it. */
function layoutsFor(dir: string, segments: string[], above: string[]): string[] | null {
  const layout = join(dir, 'layout.tsx')
  const layouts = dir !== appRoot && existsSync(layout) ? [...above, layout] : above
  const children = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  for (const group of children.filter((name) => name.startsWith('('))) {
    const found = layoutsFor(join(dir, group), segments, layouts)
    if (found) return found
  }
  if (segments.length === 0) return existsSync(join(dir, 'page.tsx')) ? layouts : null

  const [next, ...rest] = segments
  const candidates = [next, ...children.filter((name) => name.startsWith('['))]
  for (const child of candidates.filter((name) => children.includes(name))) {
    const found = layoutsFor(join(dir, child), rest, layouts)
    if (found) return found
  }
  return null
}

function pageFile(path: string) {
  const segments = path.split('/').filter(Boolean).slice(1)
  let dir = appRoot
  for (const segment of segments) {
    const literal = join(dir, segment)
    if (existsSync(literal)) {
      dir = literal
      continue
    }
    const dynamic = readdirSync(dir).find((name) => name.startsWith('['))
    if (!dynamic) throw new Error(`No route for ${path}`)
    dir = join(dir, dynamic)
  }
  return join(dir, 'page.tsx')
}

const isNotFound = (error: unknown) =>
  String((error as { digest?: unknown })?.digest).startsWith('NEXT_HTTP_ERROR_FALLBACK;404')

async function reach(path: string, account: Account) {
  mockCreateServerClient.mockReturnValue(fakeSupabase(account))
  const { NextRequest } = await import('next/server')
  const { proxy } = await import('@/proxy')
  const response = await proxy(new NextRequest(new URL(path, 'https://interventionalpulm.org')))
  const location = response.headers.get('location')
  if (location) return new URL(location).pathname

  const layouts = layoutsFor(appRoot, path.split('/').filter(Boolean).slice(1), [])
  if (!layouts) return 'not found'
  try {
    for (const layout of layouts) {
      const { default: Layout } = await import(layout)
      await Layout({ children: null, params: Promise.resolve({ locale: 'en' }) })
    }
  } catch (error) {
    if (isNotFound(error)) return 'not found'
    throw error
  }
  return 'opens'
}

async function renderedFrame() {
  const [{ renderToStaticMarkup }, { createElement }, { BetaTestingFrame }, { betaModuleById }] =
    await Promise.all([
      import('react-dom/server'),
      import('react'),
      import('./BetaTestingFrame'),
      import('./catalog'),
    ])
  return renderToStaticMarkup(
    createElement(BetaTestingFrame, { moduleEntry: betaModuleById('live-anatomy')!, locale: 'en' }),
  )
}

const frameSource = async () => /<iframe[^>]*\ssrc="([^"]+)"/.exec(await renderedFrame())?.[1] ?? ''

async function standardLink() {
  const [{ renderToStaticMarkup }, { createElement }, sections, { betaModules }, { betaRollout }] =
    await Promise.all([
      import('react-dom/server'),
      import('react'),
      import('./BetaHubSections'),
      import('./catalog'),
      import('./rollout'),
    ])
  const html = renderToStaticMarkup(
    createElement(sections.BetaHubSections, {
      locale: 'en',
      modules: betaModules.filter((entry) => entry.id === 'live-anatomy'),
      rollout: betaRollout,
    }),
  )
  return /<a[^>]*href="([^"]+)"[^>]*>Standard module/.exec(html)?.[1] ?? ''
}

async function renderedPage(path: string) {
  const [{ renderToStaticMarkup }, { createElement }] = await Promise.all([
    import('react-dom/server'),
    import('react'),
  ])
  const { default: Page } = await import(pageFile(path))
  return renderToStaticMarkup(createElement(Page))
}

const hub = '/en/development-beta'
const wrapper = '/en/development-beta/live-anatomy'
const betaLesson = '/en/development-beta/live-anatomy/lesson'
const courseLesson = '/en/intro-bronchoscopy/airway-anatomy'
const courseHub = '/en/intro-bronchoscopy'
const courseSibling = '/en/intro-bronchoscopy/scope-anatomy-handling'
const adminPage = '/en/admin/modules'
const feedbackReview = '/en/admin/module-feedback'

beforeEach(() => {
  jest.resetModules()
  jest.replaceProperty(process, 'env', {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_PUBLIC_SHOW_DRAFT_MODULES: 'false',
    NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE: 'true',
    NEXT_PUBLIC_MODULE_FEEDBACK_MODE: 'server',
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-only',
  })
})

afterEach(() => jest.restoreAllMocks())

it('runs with draft modules off, as production does', async () => {
  const { areDraftModulesEnabled } = await import('@/lib/draft-modules')
  expect(areDraftModulesEnabled).toBe(false)
})

describe('a verified, registered reviewer with no entitlement', () => {
  it('reaches the lesson the beta wrapper frames', async () => {
    const source = await frameSource()
    expect(source).not.toBe('')
    expect(await reach(source, accounts.reviewer)).toBe('opens')
  })

  it('reaches the lesson from the card on the hub', async () => {
    const link = await standardLink()
    expect(link).not.toBe('')
    expect(await reach(link, accounts.reviewer)).toBe('opens')
  })

  it('gets the lesson itself, with no link into the course it cannot open', async () => {
    const html = await renderedPage(await frameSource())
    expect(html).toContain('Live Bronchoscopy Anatomy')
    expect(html).toContain('lesson-mounted')
    expect(html).not.toContain('href="/intro-bronchoscopy"')
  })
})

it.each(betaModules)('$id opens for a verified reviewer in production', async (entry) => {
  expect(await reach(`/en${betaModuleReviewPath(entry)}`, accounts.reviewer)).toBe('opens')
})

it('keeps the course link for those who open the lesson from the course', async () => {
  expect(await renderedPage(courseLesson)).toContain('href="/intro-bronchoscopy"')
})

it.each`
  account            | path              | expected
  ${'signedOut'}     | ${hub}            | ${'/en/login'}
  ${'signedOut'}     | ${wrapper}        | ${'/en/login'}
  ${'signedOut'}     | ${betaLesson}     | ${'/en/login'}
  ${'signedOut'}     | ${courseLesson}   | ${'not found'}
  ${'signedOut'}     | ${courseHub}      | ${'/en/login'}
  ${'signedOut'}     | ${courseSibling}  | ${'/en/login'}
  ${'signedOut'}     | ${adminPage}      | ${'/en/login'}
  ${'signedOut'}     | ${feedbackReview} | ${'/en/login'}
  ${'unverified'}    | ${hub}            | ${'/en/verify-email'}
  ${'unverified'}    | ${wrapper}        | ${'/en/verify-email'}
  ${'unverified'}    | ${betaLesson}     | ${'/en/verify-email'}
  ${'unverified'}    | ${courseLesson}   | ${'not found'}
  ${'unverified'}    | ${courseHub}      | ${'/en/verify-email'}
  ${'unverified'}    | ${courseSibling}  | ${'/en/verify-email'}
  ${'unverified'}    | ${adminPage}      | ${'/en/verify-email'}
  ${'unverified'}    | ${feedbackReview} | ${'/en/verify-email'}
  ${'unregistered'}  | ${hub}            | ${'/en/signup'}
  ${'unregistered'}  | ${wrapper}        | ${'/en/signup'}
  ${'unregistered'}  | ${betaLesson}     | ${'/en/signup'}
  ${'unregistered'}  | ${courseLesson}   | ${'not found'}
  ${'unregistered'}  | ${courseHub}      | ${'/en/signup'}
  ${'unregistered'}  | ${courseSibling}  | ${'/en/signup'}
  ${'unregistered'}  | ${adminPage}      | ${'/en/signup'}
  ${'unregistered'}  | ${feedbackReview} | ${'/en/signup'}
  ${'reviewer'}      | ${hub}            | ${'opens'}
  ${'reviewer'}      | ${wrapper}        | ${'opens'}
  ${'reviewer'}      | ${betaLesson}     | ${'opens'}
  ${'reviewer'}      | ${courseLesson}   | ${'not found'}
  ${'reviewer'}      | ${courseHub}      | ${'not found'}
  ${'reviewer'}      | ${courseSibling}  | ${'not found'}
  ${'reviewer'}      | ${adminPage}      | ${'/en/dashboard'}
  ${'reviewer'}      | ${feedbackReview} | ${'/en/dashboard'}
  ${'courseLearner'} | ${betaLesson}     | ${'opens'}
  ${'courseLearner'} | ${courseLesson}   | ${'opens'}
  ${'courseLearner'} | ${courseHub}      | ${'opens'}
  ${'courseLearner'} | ${courseSibling}  | ${'opens'}
  ${'courseLearner'} | ${adminPage}      | ${'/en/dashboard'}
  ${'courseLearner'} | ${feedbackReview} | ${'/en/dashboard'}
  ${'siteAdmin'}     | ${betaLesson}     | ${'opens'}
  ${'siteAdmin'}     | ${courseLesson}   | ${'opens'}
  ${'siteAdmin'}     | ${courseHub}      | ${'opens'}
  ${'siteAdmin'}     | ${courseSibling}  | ${'opens'}
  ${'siteAdmin'}     | ${adminPage}      | ${'opens'}
  ${'siteAdmin'}     | ${feedbackReview} | ${'opens'}
`(
  '$account at $path: $expected',
  async ({
    account,
    path,
    expected,
  }: {
    account: keyof typeof accounts
    path: string
    expected: string
  }) => {
    expect(await reach(path, accounts[account])).toBe(expected)
  },
)

it('lets a page frame the lesson only at its review address, and never the hub or wrapper', () => {
  const config = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf8')
  const frameList = /const betaFramePaths = \[([\s\S]*?)\]/.exec(config)?.[1] ?? ''
  expect(frameList).toContain("'/development-beta/live-anatomy/lesson/:path*'")
  expect(frameList).not.toContain('/intro-bronchoscopy')
  expect(frameList.match(/development-beta/g)).toHaveLength(1)
})
