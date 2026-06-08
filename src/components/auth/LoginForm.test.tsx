import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { redirectToPostLoginPath } from '@/lib/site-auth/post-login-redirect'

import { LoginForm } from './LoginForm'

const mockGetUser = jest.fn()
const mockSignInWithPassword = jest.fn()
const mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

jest.mock('@/lib/supabase/browser', () => ({
  supabaseCookieBrowser: () => ({
    auth: {
      getUser: mockGetUser,
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}))

jest.mock('@/lib/site-auth/post-login-redirect', () => ({
  redirectToPostLoginPath: jest.fn(),
}))

const mockRedirectToPostLoginPath = jest.mocked(redirectToPostLoginPath)

describe('LoginForm', () => {
  beforeEach(() => {
    mockSearchParams.delete('next')
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockRedirectToPostLoginPath.mockReset()
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  it('uses a document redirect after successful password sign in', async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('button', { name: 'Redirecting...' })).toBeDisabled()
    await waitFor(() => expect(mockRedirectToPostLoginPath).toHaveBeenCalledWith('/dashboard'))
  })

  it('redirects authenticated visitors away from the sign-in form', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    render(<LoginForm />)

    await waitFor(() => expect(mockRedirectToPostLoginPath).toHaveBeenCalledWith('/dashboard'))
  })
})
