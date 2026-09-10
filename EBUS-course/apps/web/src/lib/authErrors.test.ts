import { describe, expect, it } from 'vitest';

import { getLearnerAuthErrorMessage } from '@/lib/authErrors';

describe('auth error messages', () => {
  it('turns raw fetch failures into a learner-friendly account service message', () => {
    expect(getLearnerAuthErrorMessage(new TypeError('Failed to fetch'), 'Fallback')).toContain(
      'We could not reach the account service',
    );
  });

  it('keeps actionable Supabase messages when they are not network failures', () => {
    expect(getLearnerAuthErrorMessage(new Error('Password should be at least 6 characters'), 'Fallback')).toBe(
      'Password should be at least 6 characters',
    );
  });

  it('gives sign-in guidance for duplicate account messages', () => {
    expect(getLearnerAuthErrorMessage(new Error('User already registered'), 'Fallback')).toContain(
      'already exist for this email',
    );
  });
});
