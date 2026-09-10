import { type FormEvent, useState } from 'react';

import { emptyProfileInput, LearnerProfileFields, validateProfileInput } from '@/features/account/LearnerProfileFields';
import type { LearnerProfileInput } from '@/lib/auth';
import { useAuth } from '@/lib/auth';
import { getLearnerAuthErrorMessage } from '@/lib/authErrors';

type LearnerAccessMode = 'sign-in' | 'sign-up';

export function LearnerAccessBox() {
  const { isLoading, isSupabaseEnabled, profile, signInWithPassword, signOut, signUpWithProfile, user } = useAuth();
  const [mode, setMode] = useState<LearnerAccessMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupProfile, setSignupProfile] = useState<LearnerProfileInput>(emptyProfileInput);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function switchMode(nextMode: LearnerAccessMode) {
    setMode(nextMode);
    setMessage(null);
    setError(null);
    setPassword('');
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await signInWithPassword(email.trim(), password);
      setMessage('Signed in. The welcome video is unlocked.');
    } catch (caught) {
      setError(getLearnerAuthErrorMessage(caught, 'Unable to sign in with that email and password.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const loginEmail = email.trim();
    const profileError = validateProfileInput(signupProfile);

    if (!loginEmail) {
      setError('Enter your login email.');
      return;
    }

    if (profileError) {
      setError(profileError);
      return;
    }

    if (password.length < 10) {
      setError('Use at least 10 characters for the learner password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await signUpWithProfile(loginEmail, signupProfile, password);
      setPassword('');
      setMessage('Account created. Stay signed in here to watch the welcome video.');
    } catch (caught) {
      setError(getLearnerAuthErrorMessage(caught, 'Unable to create the learner account.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isSupabaseEnabled) {
    return (
      <div className="learner-access-box">
        <p className="auth-card__message">
          Local course mode is active. The welcome video is unlocked in this browser.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="learner-access-box">
        <p className="auth-card__message">Checking your learner session...</p>
      </div>
    );
  }

  if (user && !profile) {
    return (
      <div className="learner-access-box learner-access-box--signed-in">
        <div className="learner-access-box__status">
          <div>
            <strong>No Southern California EBUS Course profile found for this account.</strong>
            <p>
              Sign out and use your course learner account, or contact course leadership if this website account should
              be enrolled in the course.
            </p>
          </div>
          <button className="button button--ghost" onClick={() => void signOut()} type="button">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (user && profile) {
    return (
      <div className="learner-access-box learner-access-box--signed-in">
        <div className="learner-access-box__status">
          <div>
            <strong>Signed in as {profile?.email ?? user.email ?? 'this learner account'}</strong>
            <p>
              The welcome video is unlocked. Later modules may remain locked until required course steps are complete.
            </p>
            {profile?.approvalStatus === 'pending' ? (
              <p>Course leadership approval is still pending for the full module workspace.</p>
            ) : null}
          </div>
          <button className="button button--ghost" onClick={() => void signOut()} type="button">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="learner-access-box">
      <div aria-label="Choose learner access mode" className="learner-access-box__tabs" role="tablist">
        <button
          aria-selected={mode === 'sign-in'}
          className={`control-pill${mode === 'sign-in' ? ' control-pill--active' : ''}`}
          onClick={() => switchMode('sign-in')}
          role="tab"
          type="button"
        >
          Sign in
        </button>
        <button
          aria-selected={mode === 'sign-up'}
          className={`control-pill${mode === 'sign-up' ? ' control-pill--active' : ''}`}
          onClick={() => switchMode('sign-up')}
          role="tab"
          type="button"
        >
          Create account
        </button>
      </div>

      <p>
        Sign in with an existing learner account, or choose Create account to request access before opening the course
        intro.
      </p>
      {message ? <p className="auth-card__message">{message}</p> : null}
      {error ? <p className="auth-card__error">{error}</p> : null}

      {mode === 'sign-up' ? (
        <form className="auth-form" onSubmit={handleSignUp}>
          <label className="field">
            <span>Login email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <LearnerProfileFields onChange={setSignupProfile} values={signupProfile} />
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <div className="button-row button-row--wrap">
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
            <button className="button button--ghost" onClick={() => switchMode('sign-in')} type="button">
              I already have an account
            </button>
          </div>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleSignIn}>
          <label className="field">
            <span>Login email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <div className="button-row button-row--wrap">
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
            <button className="button button--ghost" onClick={() => switchMode('sign-up')} type="button">
              Create account
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
