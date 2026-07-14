import type { PccmAssessmentAttemptRow } from '@/features/pccm-intro-course/types'

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({ body, init })),
  },
}))

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))

const {
  getPccmIntroCourseAdminEntitlement,
  hashPccmAccessCode,
  pccmAssessmentAnswerIsLocked,
  pccmCourseContentUnlocked,
  pccmPosttestsUnlocked,
  userCanAdministerPccmInstitution,
} = jest.requireActual(
  '@/features/pccm-intro-course/server',
) as typeof import('@/features/pccm-intro-course/server')

function attempt(
  attempt_kind: PccmAssessmentAttemptRow['attempt_kind'],
  submitted_at: string | null,
): PccmAssessmentAttemptRow {
  return {
    answers: {},
    attempt_kind,
    choice_order: {},
    created_at: '2026-07-05T00:00:00.000Z',
    enrollment_id: 'enrollment-1',
    id: attempt_kind,
    question_order: [],
    score: null,
    submitted_at,
    total: 15,
    updated_at: '2026-07-05T00:00:00.000Z',
    user_id: 'learner-1',
  }
}

describe('PCCM intro course server helpers', () => {
  it('normalizes and hashes submitted access codes without preserving plaintext', () => {
    expect(hashPccmAccessCode(' example-code ')).toBe(
      'e5da4a1cdb3c241cc8b3f2a9d7ba70a679960729bd9d8700791d412b34feef97',
    )
  })

  it('requires both Loma Linda pretests before content unlocks', () => {
    expect(
      pccmCourseContentUnlocked('loma_linda', [
        attempt('bronchoscopy_pre', '2026-07-05T00:00:00.000Z'),
      ]),
    ).toBe(false)

    expect(
      pccmCourseContentUnlocked('loma_linda', [
        attempt('bronchoscopy_pre', '2026-07-05T00:00:00.000Z'),
        attempt('pleural_pre', '2026-07-05T00:01:00.000Z'),
      ]),
    ).toBe(true)
  })

  it('does not gate UCSD content on pretest completion', () => {
    expect(pccmCourseContentUnlocked('ucsd', [])).toBe(true)
  })

  it('keeps Loma Linda posttests locked until the cohort release is recorded', () => {
    expect(pccmPosttestsUnlocked('loma_linda', null)).toBe(false)
    expect(
      pccmPosttestsUnlocked('loma_linda', {
        institution: 'loma_linda',
        posttests_released_at: null,
        posttests_released_by: null,
      }),
    ).toBe(false)
    expect(
      pccmPosttestsUnlocked('loma_linda', {
        institution: 'loma_linda',
        posttests_released_at: '2026-07-20T18:00:00.000Z',
        posttests_released_by: 'admin-1',
      }),
    ).toBe(true)
    expect(pccmPosttestsUnlocked('ucsd', null)).toBe(true)
  })

  it('locks each posttest response after its first saved answer without locking pretests', () => {
    const posttest = attempt('bronchoscopy_post', null)
    posttest.answers = { 'bronch-q1': 'option-a' }
    const pretest = attempt('bronchoscopy_pre', null)
    pretest.answers = { 'bronch-q1': 'option-a' }

    expect(pccmAssessmentAnswerIsLocked(posttest, 'bronch-q1')).toBe(true)
    expect(pccmAssessmentAnswerIsLocked(posttest, 'bronch-q2')).toBe(false)
    expect(pccmAssessmentAnswerIsLocked(pretest, 'bronch-q1')).toBe(false)
  })

  it('maps institution-scoped PCCM admin entitlements', () => {
    expect(getPccmIntroCourseAdminEntitlement('ucsd')).toBe('pccm_intro_course_admin_ucsd')
    expect(getPccmIntroCourseAdminEntitlement('loma_linda')).toBe(
      'pccm_intro_course_admin_loma_linda',
    )
  })

  it('checks scoped PCCM admin institution access', () => {
    expect(
      userCanAdministerPccmInstitution(
        { canAccessAll: false, institutions: ['ucsd'], isSiteAdmin: false },
        'ucsd',
      ),
    ).toBe(true)
    expect(
      userCanAdministerPccmInstitution(
        { canAccessAll: false, institutions: ['ucsd'], isSiteAdmin: false },
        'loma_linda',
      ),
    ).toBe(false)
    expect(
      userCanAdministerPccmInstitution(
        { canAccessAll: true, institutions: ['ucsd', 'loma_linda'], isSiteAdmin: true },
        'loma_linda',
      ),
    ).toBe(true)
  })
})
