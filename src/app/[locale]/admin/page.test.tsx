import { render, screen, within } from '@testing-library/react'
import { redirect } from 'next/navigation'
import AdminDashboardPage from './page'

const mockGetUser = jest.fn()
const mockEntitlement = jest.fn()
const mockAdmin = {
  id: 'admin',
  email: 'admin@example.com',
  email_confirmed_at: '2026-10-16',
}
const mockRows = new Map<string, object[]>()
const mockRange = jest.fn((table: string, from: number, to: number) => ({
  data: mockRows.get(table)?.slice(from, to + 1) ?? [],
  error: null,
}))

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: async () => ({
    auth: { getUser: () => mockGetUser() },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: () => mockEntitlement(),
      }
      return query
    },
  }),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    auth: { admin: { listUsers: async () => ({ data: { users: [mockAdmin] } }) } },
    from: (table: string) => ({
      select: () => ({
        data: mockRows.get(table) ?? [],
        error: null,
        order() {
          return this
        },
        limit() {
          return this
        },
        range: async (from: number, to: number) => mockRange(table, from, to),
      }),
    }),
  },
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

beforeEach(() => {
  mockRows.clear()
  mockGetUser.mockResolvedValue({ data: { user: mockAdmin } })
  mockEntitlement.mockResolvedValue({ data: { entitlement: 'site_admin' } })
})

test('signed-in Site Admin opens the library from the former builder slot', async () => {
  render(await AdminDashboardPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('heading', { name: 'Site admin dashboard' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'SOCRATES Library' })).toHaveAttribute(
    'href',
    '/socrates-library',
  )
  expect(screen.queryByRole('link', { name: /SOCRATES builder/i })).not.toBeInTheDocument()
})

test('the dashboard still requires an authenticated Site Admin', async () => {
  mockEntitlement.mockResolvedValue({ data: null })
  await expect(AdminDashboardPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    'REDIRECT:/dashboard?required=site_admin',
  )
  expect(redirect).toHaveBeenCalledWith('/dashboard?required=site_admin')
})

it('shows beta sessions from later database pages and keeps all module history accessible', async () => {
  const startedAt = '2026-01-02T12:00:00Z'
  const session = (moduleId: string, routePath: string, durationSeconds: number) => ({
    user_id: mockAdmin.id,
    module_id: moduleId,
    route_path: routePath,
    duration_seconds: durationSeconds,
    started_at: startedAt,
  })
  mockRows.set(
    'site_module_progress',
    Array.from({ length: 7 }, (_, index) => ({
      user_id: mockAdmin.id,
      module_id: `ordinary-module-${index + 1}`,
      last_visited_at: '2026-01-03T12:00:00Z',
    })),
  )
  mockRows.set('site_module_sessions', [
    ...Array.from({ length: 1000 }, () => session('anatomy', '/en/learn/anatomy/dolphin', 60)),
    session('eus-b-simulator', '/en/eus-b-simulator', 180),
    session('eus-b-simulator', '/es/eus-b-simulator/practice', 120),
    session('anatomy', '/en/learn/anatomy/airway', 240),
    session('anatomy', '/en/learn/anatomy/branch-tracing', 360),
    session('intro-bronchoscopy:airway-anatomy', '/en/development-beta/live-anatomy/lesson', 420),
  ])

  render(await AdminDashboardPage({}))

  expect(mockRange).toHaveBeenCalledWith('site_module_sessions', 1000, 1999)
  const row = within(screen.getByText(mockAdmin.email, { exact: true }).closest('tr')!)
  const moduleDetail = row.getByText('Module detail').closest('details')!
  moduleDetail.setAttribute('open', '')
  const betaModules = within(
    within(moduleDetail).getByRole('heading', { name: 'Beta modules' }).parentElement!,
  )
  expect(betaModules.getByText('EUS-B Simulator').closest('li')).toHaveTextContent(
    '5 min across 2 sessions',
  )
  expect(
    betaModules.getByText('Airway Anatomy — Synchronized Bronchoscopy').closest('li'),
  ).toHaveTextContent('4 min across 1 session')
  expect(betaModules.getByText('Bronchial Branch Tracing').closest('li')).toHaveTextContent(
    '6 min across 1 session',
  )
  expect(betaModules.getByText('Live Bronchoscopy Anatomy').closest('li')).toHaveTextContent(
    '7 min across 1 session',
  )
  expect(betaModules.getAllByRole('listitem')).toHaveLength(4)

  const allModules = row.getByText('All modules (10)').closest('details')!
  expect(allModules).not.toHaveAttribute('open')
  allModules.setAttribute('open', '')
  expect(within(allModules).getAllByRole('listitem')).toHaveLength(10)
})
