import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { emptyProfileInput, LearnerProfileFields, validateProfileInput } from '@/features/account/LearnerProfileFields';
import type { LearnerProfile, LearnerProfileInput } from '@/lib/auth';
import { useAuth } from '@/lib/auth';

function profileToInput(profile: LearnerProfile | null): LearnerProfileInput {
  return {
    fullName: profile?.fullName ?? '',
    degree: profile?.degree ?? 'MD',
    institution: profile?.institution ?? '',
    institutionalEmail: profile?.institutionalEmail ?? '',
    fellowshipYear: profile?.fellowshipYear ?? 'first',
    flexibleBronchoscopyCount: profile?.flexibleBronchoscopyCount ?? null,
    ebusCount: profile?.ebusCount ?? null,
    ebusConfidence: profile?.ebusConfidence ?? 'moderate',
  };
}

export function AccountPage() {
  const { isLoading, isSupabaseEnabled, profile, updateLearnerProfile, user } = useAuth();
  const [formValues, setFormValues] = useState<LearnerProfileInput>(emptyProfileInput);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormValues(profileToInput(profile));
  }, [profile]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const profileError = validateProfileInput(formValues);

    if (profileError) {
      setError(profileError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await updateLearnerProfile(formValues);
      setMessage('Profile updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update your profile.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isSupabaseEnabled) {
    return (
      <div className="page-stack">
        <section className="section-card">
          <div className="eyebrow">Account</div>
          <h2>Account profiles are available when Supabase auth is configured.</h2>
          <div className="button-row button-row--wrap">
            <Link className="button" to="/">
              Back to home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-stack">
        <section className="section-card">
          <div className="eyebrow">Account</div>
          <h2>Loading profile...</h2>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="section-card auth-card">
        <div className="eyebrow">Account</div>
        <h2>Learner profile</h2>
        <p>
          Update your training profile for course tracking. Your login email is managed by Supabase and remains{' '}
          {user?.email ?? 'your account email'}.
        </p>
        {message ? <p className="auth-card__message">{message}</p> : null}
        {error ? <p className="auth-card__error">{error}</p> : null}
        <form className="auth-form" onSubmit={handleSubmit}>
          <LearnerProfileFields onChange={setFormValues} values={formValues} />
          <div className="button-row button-row--wrap">
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving...' : 'Update profile'}
            </button>
            <Link className="button button--ghost" to="/">
              Back to workspace
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
