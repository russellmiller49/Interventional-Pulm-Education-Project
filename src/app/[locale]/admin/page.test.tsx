import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import AdminDashboardPage from './page'

const mockGetUser = jest.fn()
const mockEntitlement = jest.fn()
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
jest.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: null }))
jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

beforeEach(() => {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: 'admin',
        email: 'admin@example.com',
        email_confirmed_at: '2026-10-16',
      },
    },
  })
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
