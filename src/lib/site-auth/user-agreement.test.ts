import { hasCompletedSiteRegistration, SITE_USER_AGREEMENT_VERSION } from './user-agreement'

const complete = {
  onboarding_completed_at: '2026-06-01T00:00:00Z',
  agreement_accepted_at: '2026-06-01T00:00:00Z',
  agreement_version: SITE_USER_AGREEMENT_VERSION,
  performance_research_consent: true,
}

it('accepts completed main-site registration with recorded consent', () => {
  expect(hasCompletedSiteRegistration(complete)).toBe(true)
})
it.each(Object.keys(complete))('requires %s', (key) => {
  expect(hasCompletedSiteRegistration({ ...complete, [key]: null })).toBe(false)
})
it('does not accept a course profile, missing profile, old agreement, or declined consent', () => {
  expect(hasCompletedSiteRegistration(null)).toBe(false)
  expect(
    hasCompletedSiteRegistration({ onboarding_completed_at: complete.onboarding_completed_at }),
  ).toBe(false)
  expect(hasCompletedSiteRegistration({ ...complete, agreement_version: 'course-agreement' })).toBe(
    false,
  )
  expect(hasCompletedSiteRegistration({ ...complete, performance_research_consent: false })).toBe(
    false,
  )
})
