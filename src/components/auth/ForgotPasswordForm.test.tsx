import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ForgotPasswordForm } from './ForgotPasswordForm'

const mockResetPasswordForEmail = jest.fn()

jest.mock('@/lib/supabase/browser', () => ({
  supabaseCookieBrowser: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}))

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
  })

  it('requests recovery with the main-site callback before the password form', async () => {
    const user = userEvent.setup()

    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() =>
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('learner@example.com', {
        redirectTo: 'http://localhost/auth/callback?next=%2Fauth%2Fupdate-password',
      }),
    )
    expect(await screen.findByText('Check your email for a password reset link.')).toBeVisible()
  })
})
