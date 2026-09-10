import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  clearBrowserAuthTokensFromUrl,
  clearStoredBrowserRecoverySessionTokens,
  getBrowserAuthCodeFromUrl,
  getAuthCallbackUrl,
  getBrowserAuthCallbackMode,
  getBrowserRecoverySessionTokens,
  getBrowserRecoverySessionTokensFromUrl,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  storeBrowserRecoverySessionTokens,
} from '@/lib/supabase';

export type LearnerDegree = 'MD' | 'DO';
export type FellowshipYear = 'first' | 'second' | 'third';
export type EbusConfidence = 'high' | 'moderate' | 'low';
export type LearnerApprovalStatus = 'pending' | 'approved';

export interface LearnerProfileInput {
  fullName: string;
  degree: LearnerDegree;
  institution: string;
  institutionalEmail: string;
  fellowshipYear: FellowshipYear;
  flexibleBronchoscopyCount: number | null;
  ebusCount: number | null;
  ebusConfidence: EbusConfidence;
}

export interface LearnerProfile {
  id: string;
  email: string | null;
  fullName: string | null;
  degree: LearnerDegree | null;
  institution: string | null;
  institutionalEmail: string | null;
  fellowshipYear: FellowshipYear | null;
  flexibleBronchoscopyCount: number | null;
  ebusCount: number | null;
  ebusConfidence: EbusConfidence | null;
  inviteSentAt: string | null;
  lastSignInAt: string | null;
  mustSetPassword: boolean;
  onboardingCompletedAt: string | null;
  approvalStatus: LearnerApprovalStatus;
  approvedAt: string | null;
  approvedBy: string | null;
}

interface AuthContextValue {
  isLoading: boolean;
  isPasswordRecoverySession: boolean;
  isSupabaseEnabled: boolean;
  profile: LearnerProfile | null;
  session: Session | null;
  user: User | null;
  completePasswordSetup: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestPasswordRecovery: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithProfile: (loginEmail: string, profile: LearnerProfileInput, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateLearnerProfile: (profile: LearnerProfileInput) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isLearnerDegree(value: unknown): value is LearnerDegree {
  return value === 'MD' || value === 'DO';
}

function isFellowshipYear(value: unknown): value is FellowshipYear {
  return value === 'first' || value === 'second' || value === 'third';
}

function isEbusConfidence(value: unknown): value is EbusConfidence {
  return value === 'high' || value === 'moderate' || value === 'low';
}

function isLearnerApprovalStatus(value: unknown): value is LearnerApprovalStatus {
  return value === 'pending' || value === 'approved';
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapProfile(raw: Record<string, unknown> | null): LearnerProfile | null {
  if (!raw) {
    return null;
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    email: typeof raw.email === 'string' ? raw.email : null,
    fullName: typeof raw.full_name === 'string' ? raw.full_name : null,
    degree: isLearnerDegree(raw.degree) ? raw.degree : null,
    institution: typeof raw.institution === 'string' ? raw.institution : null,
    institutionalEmail: typeof raw.institutional_email === 'string' ? raw.institutional_email : null,
    fellowshipYear: isFellowshipYear(raw.fellowship_year) ? raw.fellowship_year : null,
    flexibleBronchoscopyCount: readNumber(raw.flexible_bronchoscopy_count),
    ebusCount: readNumber(raw.ebus_count),
    ebusConfidence: isEbusConfidence(raw.ebus_confidence) ? raw.ebus_confidence : null,
    inviteSentAt: typeof raw.invite_sent_at === 'string' ? raw.invite_sent_at : null,
    lastSignInAt: typeof raw.last_sign_in_at === 'string' ? raw.last_sign_in_at : null,
    mustSetPassword: raw.must_set_password === true,
    onboardingCompletedAt: typeof raw.onboarding_completed_at === 'string' ? raw.onboarding_completed_at : null,
    approvalStatus: isLearnerApprovalStatus(raw.approval_status) ? raw.approval_status : 'pending',
    approvedAt: typeof raw.approved_at === 'string' ? raw.approved_at : null,
    approvedBy: typeof raw.approved_by === 'string' ? raw.approved_by : null,
  };
}

function toProfileRow(profile: LearnerProfileInput) {
  const row: {
    full_name: string;
    degree: LearnerDegree;
    institution: string;
    institutional_email: string;
    fellowship_year: FellowshipYear;
    ebus_confidence: EbusConfidence;
    flexible_bronchoscopy_count?: number;
    ebus_count?: number;
  } = {
    full_name: profile.fullName.trim(),
    degree: profile.degree,
    institution: profile.institution.trim(),
    institutional_email: profile.institutionalEmail.trim().toLowerCase(),
    fellowship_year: profile.fellowshipYear,
    ebus_confidence: profile.ebusConfidence,
  };

  if (profile.flexibleBronchoscopyCount !== null) {
    row.flexible_bronchoscopy_count = profile.flexibleBronchoscopyCount;
  }

  if (profile.ebusCount !== null) {
    row.ebus_count = profile.ebusCount;
  }

  return row;
}

const learnerProfileSelectColumns = [
  'id',
  'email',
  'full_name',
  'degree',
  'institution',
  'institutional_email',
  'fellowship_year',
  'flexible_bronchoscopy_count',
  'ebus_count',
  'ebus_confidence',
  'invite_sent_at',
  'last_sign_in_at',
  'must_set_password',
  'onboarding_completed_at',
  'approval_status',
  'approved_at',
  'approved_by',
].join(', ');

function isMainSiteAuthUser(user: User) {
  return user.user_metadata?.app_scope === 'main_site';
}

async function upsertLearnerProfile(patch: {
  id: string;
  email: string | null;
  full_name?: string;
  degree?: LearnerDegree;
  institution?: string;
  institutional_email?: string;
  fellowship_year?: FellowshipYear;
  flexible_bronchoscopy_count?: number;
  ebus_count?: number;
  ebus_confidence?: EbusConfidence;
  last_sign_in_at: string;
  must_set_password?: boolean;
  onboarding_completed_at?: string;
}) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error('Supabase is not configured for this environment.');
  }

  const { error } = await client.from('learner_profiles').upsert(patch, { onConflict: 'id' });

  if (error) {
    throw error;
  }

  return client;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [isPasswordRecoverySession, setIsPasswordRecoverySession] = useState(false);
  const isSupabaseEnabled = isSupabaseConfigured();

  const refreshProfile = useCallback(async () => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      setProfile(null);
      return;
    }

    const currentUser = (await client.auth.getUser()).data.user;

    if (!currentUser) {
      setProfile(null);
      return;
    }

    if (!isMainSiteAuthUser(currentUser)) {
      await upsertLearnerProfile({
        id: currentUser.id,
        email: currentUser.email ?? null,
        last_sign_in_at: new Date().toISOString(),
      });
    }

    const { data, error } = await client
      .from('learner_profiles')
      .select(learnerProfileSelectColumns)
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    setProfile(mapProfile(data as Record<string, unknown> | null));
  }, []);

  useEffect(() => {
    const nextClient = getSupabaseBrowserClient();

    if (!nextClient) {
      setIsLoading(false);
      return;
    }

    const client = nextClient;

    let active = true;

    async function bootstrapSession() {
      const recoveryCode = getBrowserAuthCodeFromUrl();
      const recoveryTokens = getBrowserRecoverySessionTokensFromUrl();
      let recoveredSession: Session | null = null;

      if (recoveryCode && getBrowserAuthCallbackMode() === 'reset-password') {
        const { data, error } = await client.auth.exchangeCodeForSession(recoveryCode);

        if (!error && data.session?.user) {
          recoveredSession = data.session;
          setIsPasswordRecoverySession(true);
          clearStoredBrowserRecoverySessionTokens();
          clearBrowserAuthTokensFromUrl();
        } else {
          clearStoredBrowserRecoverySessionTokens();
          await client.auth.signOut({ scope: 'local' });
          setIsPasswordRecoverySession(true);
        }
      } else if (recoveryTokens) {
        storeBrowserRecoverySessionTokens(recoveryTokens);

        const { data, error } = await client.auth.setSession({
          access_token: recoveryTokens.accessToken,
          refresh_token: recoveryTokens.refreshToken,
        });

        if (!error && data.session?.user) {
          recoveredSession = data.session;
          setIsPasswordRecoverySession(true);
          clearBrowserAuthTokensFromUrl();
        } else {
          clearStoredBrowserRecoverySessionTokens();
          await client.auth.signOut({ scope: 'local' });
          setIsPasswordRecoverySession(true);
        }
      }

      const {
        data: { session: nextSession },
      } = recoveredSession ? { data: { session: recoveredSession } } : await client.auth.getSession();

      if (!active) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        if (getBrowserAuthCallbackMode() === 'reset-password') {
          setIsPasswordRecoverySession(true);
        }

        try {
          await refreshProfile();
        } catch {
          if (active) {
            setProfile(null);
          }
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    }

    void bootstrapSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoverySession(true);
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setIsPasswordRecoverySession(false);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      void refreshProfile()
        .catch(() => {
          // Keep the session active even if profile refresh fails.
        })
        .finally(() => {
          setIsLoading(false);
        });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      throw new Error('Supabase is not configured for this environment.');
    }

    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    setIsPasswordRecoverySession(false);
  }, []);

  const signUpWithProfile = useCallback(
    async (loginEmail: string, nextProfile: LearnerProfileInput, password: string) => {
      const client = getSupabaseBrowserClient();

      if (!client) {
        throw new Error('Supabase is not configured for this environment.');
      }

      const normalizedProfile = toProfileRow(nextProfile);
      const normalizedLoginEmail = loginEmail.trim().toLowerCase();

      if (!normalizedLoginEmail) {
        throw new Error('Enter your login email.');
      }

      const { data, error } = await client.auth.signUp({
        email: normalizedLoginEmail,
        password,
        options: {
          data: {
            app_scope: 'socal_ebus_course',
            ...normalizedProfile,
            must_set_password: false,
            approval_status: 'pending',
          },
          emailRedirectTo: getAuthCallbackUrl('sign-in'),
        },
      });

      if (error) {
        throw error;
      }

      if (data.session?.user) {
        await upsertLearnerProfile({
          id: data.session.user.id,
          email: data.session.user.email ?? normalizedLoginEmail,
          ...normalizedProfile,
          last_sign_in_at: new Date().toISOString(),
          must_set_password: false,
          onboarding_completed_at: new Date().toISOString(),
        });
        await refreshProfile();
      }
    },
    [refreshProfile],
  );

  const requestPasswordRecovery = useCallback(async (email: string) => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      throw new Error('Supabase is not configured for this environment.');
    }

    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getAuthCallbackUrl('reset-password'),
    });

    if (error) {
      throw error;
    }

    setIsPasswordRecoverySession(false);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      throw new Error('Supabase is not configured for this environment.');
    }

    let { error } = await client.auth.updateUser({ password });

    if (error?.message === 'Auth session missing!') {
      const recoveryTokens = getBrowserRecoverySessionTokens();

      if (recoveryTokens) {
        const { data, error: sessionError } = await client.auth.setSession({
          access_token: recoveryTokens.accessToken,
          refresh_token: recoveryTokens.refreshToken,
        });

        if (sessionError) {
          clearStoredBrowserRecoverySessionTokens();
          await client.auth.signOut({ scope: 'local' });
          throw new Error(
            'The recovery link is invalid or expired. Request a fresh recovery email, then open the newest link.',
          );
        }

        if (!data.session?.user) {
          throw new Error(
            'The recovery link did not create a valid password reset session. Request a new recovery email.',
          );
        }

        setSession(data.session);
        setUser(data.session.user);
        clearBrowserAuthTokensFromUrl();

        const retry = await client.auth.updateUser({ password });
        error = retry.error;
      } else {
        throw new Error(
          'The recovery link is missing its reset session. Request a fresh recovery email, then open the newest link.',
        );
      }
    }

    if (error) {
      throw error;
    }

    clearStoredBrowserRecoverySessionTokens();
    setIsPasswordRecoverySession(false);
  }, []);

  const completePasswordSetup = useCallback(
    async (password: string) => {
      const client = getSupabaseBrowserClient();

      if (!client || !user) {
        throw new Error('No signed-in learner session is available.');
      }

      await updatePassword(password);

      await upsertLearnerProfile({
        id: user.id,
        email: user.email ?? null,
        last_sign_in_at: new Date().toISOString(),
        must_set_password: false,
        onboarding_completed_at: new Date().toISOString(),
      });

      await refreshProfile();
    },
    [refreshProfile, updatePassword, user],
  );

  const updateLearnerProfile = useCallback(
    async (nextProfile: LearnerProfileInput) => {
      if (!user) {
        throw new Error('No signed-in learner session is available.');
      }

      await upsertLearnerProfile({
        id: user.id,
        email: user.email ?? nextProfile.institutionalEmail.trim().toLowerCase(),
        ...toProfileRow(nextProfile),
        last_sign_in_at: new Date().toISOString(),
        must_set_password: false,
        onboarding_completed_at: profile?.onboardingCompletedAt ?? new Date().toISOString(),
      });

      await refreshProfile();
    },
    [profile?.onboardingCompletedAt, refreshProfile, user],
  );

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();

    if (!client) {
      return;
    }

    await client.auth.signOut();
    setIsPasswordRecoverySession(false);
    setProfile(null);
    setSession(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isPasswordRecoverySession,
      isSupabaseEnabled,
      profile,
      session,
      user,
      completePasswordSetup,
      refreshProfile,
      requestPasswordRecovery,
      signInWithPassword,
      signUpWithProfile,
      signOut,
      updateLearnerProfile,
      updatePassword,
    }),
    [
      completePasswordSetup,
      isLoading,
      isPasswordRecoverySession,
      isSupabaseEnabled,
      profile,
      refreshProfile,
      requestPasswordRecovery,
      session,
      signInWithPassword,
      signOut,
      signUpWithProfile,
      updateLearnerProfile,
      updatePassword,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
