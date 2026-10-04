import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from './SignupForm'
import { SITE_USER_AGREEMENT_VERSION } from '@/lib/site-auth/user-agreement'
import { interestOptions, learningGoalOptions } from '@/lib/site-auth/profile-options'

const mockReplace = jest.fn()
const mockRefresh = jest.fn()
const mockUpsert = jest.fn()
const mockProfile = {
  first_name: 'Returning',
  last_name: 'Learner',
  professional_role: 'pulmonologist',
  institution_type: 'hospital',
  institution: 'Teaching Hospital',
  country: 'US',
  years_in_practice: 'lt_5',
  interests: [interestOptions[0].value],
  learning_goals: [learningGoalOptions[0].value],
}
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
  useSearchParams: () =>
    new URLSearchParams('mode=complete&next=%2Fen%2Fdashboard%3Fcourses%3Dclosed'),
}))
jest.mock('@/lib/supabase/browser', () => ({
  supabaseCookieBrowser: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'returning-user', email: 'returning@example.com' } },
      }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mockProfile }) }) }),
      upsert: mockUpsert,
    }),
  }),
}))

beforeEach(() => {
  mockUpsert.mockResolvedValue({ error: null })
})

it('prefills the existing profile but requires fresh explicit consent before saving it', async () => {
  const user = userEvent.setup()
  render(<SignupForm />)
  await waitFor(() => expect(screen.getByLabelText('First name')).toHaveValue('Returning'))
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  const agreement = screen.getByRole('checkbox', { name: /I have read and agree/ })
  expect(agreement).not.toBeChecked()
  // Submit programmatically as well as through browser validation to exercise the handler guard.
  const button = screen.getByRole('button', { name: 'Save profile' })
  fireEvent.submit(button.closest('form')!)
  expect(mockUpsert).not.toHaveBeenCalled()
  expect(
    await screen.findByText('Review and accept the user agreement before continuing.'),
  ).toBeInTheDocument()
  await user.click(agreement)
  await user.click(button)
  await waitFor(() =>
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'returning-user',
        email: 'returning@example.com',
        first_name: 'Returning',
        agreement_version: SITE_USER_AGREEMENT_VERSION,
        performance_research_consent: true,
        agreement_accepted_at: expect.any(String),
        onboarding_completed_at: expect.any(String),
      }),
      { onConflict: 'id' },
    ),
  )
  expect(mockReplace).toHaveBeenCalledWith('/en/dashboard?courses=closed')
})
