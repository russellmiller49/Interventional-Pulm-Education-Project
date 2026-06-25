'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseCookieBrowser } from '@/lib/supabase/browser'
import { buildSignInRedirectUrl } from '@/lib/supabase/auth-redirect'
import {
  getTrainingLevelOptions,
  institutionTypeOptions,
  interestOptions,
  learningGoalOptions,
  professionalRoleOptions,
  residentSpecialtyOptions,
  requiresTrainingLevel,
  yearsInPracticeOptions,
} from '@/lib/site-auth/profile-options'
import {
  getSiteProfileValidationMessage,
  siteProfileSchema,
  type SiteProfileInput,
} from '@/lib/site-auth/profile-schema'
import {
  SITE_USER_AGREEMENT_VERSION,
  siteUserAgreementPoints,
} from '@/lib/site-auth/user-agreement'
import { HandoffContent } from '@/i18n/handoff'

type SubmitStatus = 'idle' | 'checking' | 'submitting' | 'sent' | 'error'

const fieldClassName =
  'mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }

  return value
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const completionMode =
    searchParams.get('mode') === 'complete' || searchParams.get('completeProfile') === '1'
  const nextPath = useMemo(() => normalizeNextPath(searchParams.get('next')), [searchParams])

  const [email, setEmail] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [professionalRole, setProfessionalRole] = useState('medical_student')
  const [residentSpecialty, setResidentSpecialty] = useState('')
  const [roleOther, setRoleOther] = useState('')
  const [institutionType, setInstitutionType] = useState('hospital')
  const [institution, setInstitution] = useState('')
  const [country, setCountry] = useState('')
  const [trainingLevel, setTrainingLevel] = useState('ms1')
  const [yearsInPractice, setYearsInPractice] = useState('in_training')
  const [interests, setInterests] = useState<string[]>([])
  const [learningGoals, setLearningGoals] = useState<string[]>([])
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [status, setStatus] = useState<SubmitStatus>(completionMode ? 'checking' : 'idle')
  const [message, setMessage] = useState<string>()

  const trainingLevelOptions = getTrainingLevelOptions(professionalRole)

  useEffect(() => {
    if (!completionMode) {
      return
    }

    let isActive = true

    async function loadCurrentUser() {
      try {
        const supabase = supabaseCookieBrowser()
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (!isActive) {
          return
        }

        if (error || !user) {
          setStatus('error')
          setMessage('Sign in before completing your profile.')
          return
        }

        setCurrentUserId(user.id)
        setEmail(user.email ?? '')
        setStatus('idle')
      } catch (error) {
        if (!isActive) {
          return
        }

        setStatus('error')
        setMessage(
          error instanceof Error ? error.message : 'Unable to load the current Supabase session.',
        )
      }
    }

    void loadCurrentUser()

    return () => {
      isActive = false
    }
  }, [completionMode])

  function buildProfileInput(): SiteProfileInput | null {
    const parsed = siteProfileSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      professional_role: professionalRole,
      resident_specialty: professionalRole === 'resident' ? residentSpecialty : undefined,
      role_other: professionalRole === 'other' ? roleOther : undefined,
      institution_type: institutionType,
      institution,
      country,
      training_level: requiresTrainingLevel(professionalRole) ? trainingLevel : undefined,
      years_in_practice: yearsInPractice,
      interests,
      learning_goals: learningGoals,
    })

    if (!parsed.success) {
      setStatus('error')
      setMessage(getSiteProfileValidationMessage(parsed.error))
      return null
    }

    return parsed.data
  }

  function handleProfessionalRoleChange(value: string) {
    const options = getTrainingLevelOptions(value)
    setProfessionalRole(value)
    setTrainingLevel(options[0]?.value ?? '')
    setResidentSpecialty(value === 'resident' ? 'internal_medicine' : '')
    setRoleOther('')
  }

  async function upsertSiteProfile(
    userId: string,
    userEmail: string,
    profile: SiteProfileInput,
    agreementAcceptedAt: string,
  ) {
    const supabase = supabaseCookieBrowser()
    const { error } = await supabase.from('site_profiles').upsert(
      {
        id: userId,
        email: userEmail.toLowerCase(),
        ...profile,
        agreement_accepted_at: agreementAcceptedAt,
        agreement_version: SITE_USER_AGREEMENT_VERSION,
        performance_research_consent: true,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    return error
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setMessage(undefined)

    const profile = buildProfileInput()
    if (!profile) {
      return
    }

    if (!completionMode) {
      if (password.length < 8) {
        setStatus('error')
        setMessage('Use a password that is at least 8 characters long.')
        return
      }

      if (password !== confirmPassword) {
        setStatus('error')
        setMessage('The password confirmation does not match.')
        return
      }
    }

    if (!agreementAccepted) {
      setStatus('error')
      setMessage('Review and accept the user agreement before continuing.')
      return
    }

    const agreementAcceptedAt = new Date().toISOString()

    try {
      const supabase = supabaseCookieBrowser()

      if (completionMode) {
        if (!currentUserId || !email) {
          setStatus('error')
          setMessage('Sign in before completing your profile.')
          return
        }

        const profileError = await upsertSiteProfile(
          currentUserId,
          email,
          profile,
          agreementAcceptedAt,
        )
        if (profileError) {
          setStatus('error')
          setMessage(profileError.message)
          return
        }

        router.replace(nextPath as Route)
        router.refresh()
        return
      }

      const normalizedEmail = email.trim().toLowerCase()
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin.replace(/\/$/, '')
          : (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://interventionalpulm.org').replace(
              /\/$/,
              '',
            )
      const emailRedirectTo = buildSignInRedirectUrl(origin, nextPath)
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo,
          data: {
            app_scope: 'main_site',
            email: normalizedEmail,
            agreement_accepted_at: agreementAcceptedAt,
            agreement_version: SITE_USER_AGREEMENT_VERSION,
            performance_research_consent: true,
            ...profile,
          },
        },
      })

      if (error) {
        setStatus('error')
        setMessage(error.message)
        return
      }

      if (data.session && data.user) {
        const profileError = await upsertSiteProfile(
          data.user.id,
          normalizedEmail,
          profile,
          agreementAcceptedAt,
        )
        if (profileError) {
          setStatus('error')
          setMessage(profileError.message)
          return
        }

        router.replace(nextPath as Route)
        router.refresh()
        return
      }

      setStatus('sent')
      setMessage('Check your email to verify your account before signing in.')
      router.replace(`/verify-email?email=${encodeURIComponent(normalizedEmail)}` as Route)
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Signup is not available because Supabase is not configured.',
      )
    }
  }

  return (
    <HandoffContent>
      {
        <form onSubmit={handleSubmit} className="space-y-6">
          {!completionMode ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Email
                <Input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="mt-2 rounded-lg"
                />
              </label>
              <div className="hidden md:block" aria-hidden />
              <label className="block text-sm font-medium">
                Password
                <Input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="mt-2 rounded-lg"
                />
              </label>
              <label className="block text-sm font-medium">
                Confirm password
                <Input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="mt-2 rounded-lg"
                />
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {email ? `Completing profile for ${email}.` : 'Checking your signed-in account...'}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              First name
              <Input
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                className="mt-2 rounded-lg"
              />
            </label>
            <label className="block text-sm font-medium">
              Last name
              <Input
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                className="mt-2 rounded-lg"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Professional role
              <select
                required
                value={professionalRole}
                onChange={(event) => handleProfessionalRoleChange(event.target.value)}
                className={fieldClassName}
              >
                {professionalRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {professionalRole === 'resident' ? (
              <label className="block text-sm font-medium">
                Resident specialty
                <select
                  required
                  value={residentSpecialty}
                  onChange={(event) => setResidentSpecialty(event.target.value)}
                  className={fieldClassName}
                >
                  {residentSpecialtyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {professionalRole === 'other' ? (
              <label className="block text-sm font-medium">
                Other role
                <Input
                  required
                  value={roleOther}
                  onChange={(event) => setRoleOther(event.target.value)}
                  className="mt-2 rounded-lg"
                />
              </label>
            ) : null}
            {trainingLevelOptions.length > 0 ? (
              <label className="block text-sm font-medium">
                Training level
                <select
                  required
                  value={trainingLevel}
                  onChange={(event) => setTrainingLevel(event.target.value)}
                  className={fieldClassName}
                >
                  {trainingLevelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Institution type
              <select
                required
                value={institutionType}
                onChange={(event) => setInstitutionType(event.target.value)}
                className={fieldClassName}
              >
                {institutionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Institution
              <Input
                required
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                className="mt-2 rounded-lg"
              />
            </label>
            <label className="block text-sm font-medium">
              Country
              <Input
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                autoComplete="country-name"
                className="mt-2 rounded-lg"
              />
            </label>
            <label className="block text-sm font-medium">
              Years in practice
              <select
                required
                value={yearsInPractice}
                onChange={(event) => setYearsInPractice(event.target.value)}
                className={fieldClassName}
              >
                {yearsInPracticeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Interests</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {interestOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={interests.includes(option.value)}
                    onChange={() => setInterests((current) => toggleValue(current, option.value))}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Learning goals</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {learningGoalOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={learningGoals.includes(option.value)}
                    onChange={() =>
                      setLearningGoals((current) => toggleValue(current, option.value))
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-border bg-muted/30 p-4">
            <legend className="px-1 text-sm font-semibold">User agreement</legend>
            <div className="space-y-3">
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                {siteUserAgreementPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <label className="flex items-start gap-3 text-sm font-medium">
                <input
                  required
                  type="checkbox"
                  checked={agreementAccepted}
                  onChange={(event) => setAgreementAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <span>
                  I have read and agree to these terms, including the tracking of educational usage
                  and performance data and the anonymous, de-identified, or aggregated research use
                  described above.
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Agreement version: {SITE_USER_AGREEMENT_VERSION}
              </p>
            </div>
          </fieldset>

          {message ? (
            <p
              className={
                status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
              }
            >
              {message}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={status === 'submitting' || status === 'checking'}
            className="w-full"
          >
            {status === 'submitting'
              ? completionMode
                ? 'Saving profile...'
                : 'Creating account...'
              : completionMode
                ? 'Save profile'
                : 'Create free account'}
          </Button>
          {!completionMode ? (
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href={'/login' as Route}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          ) : null}
        </form>
      }
    </HandoffContent>
  )
}
