import { z } from 'zod'
import {
  fellowRoleValues,
  getTrainingLevelOptions,
  professionalRoleOptions,
  residentSpecialtyOptions,
  yearsInPracticeOptions,
} from '@/lib/site-auth/profile-options'

/*
 * The overall module review: one per reviewer per module, given at the end of testing and
 * editable later. Detailed feedback (one problem, one page) stays in `schema.ts`.
 *
 * Who the reviewer is comes from their site profile, which the beta hub already requires; the
 * form never asks it again. A reviewer answers as a learner or as an educator / practicing
 * clinician. Their profile picks the default and they may switch. The two tracks share most
 * questions; each adds its own. The educator track also answers the module's own "where
 * feedback helps most" prompts from its hub card, which are written for faculty.
 *
 * Bump `reviewFormVersion` whenever a question or its options change meaning, so stored answers
 * are read against the form they were given on.
 */
export const reviewFormVersion = 1

export const reviewTracks = ['learner', 'educator'] as const
export type ReviewTrack = (typeof reviewTracks)[number]

type Option<V extends string> = { readonly value: V; readonly label: string }
const options = <V extends string>(list: readonly Option<V>[]) => list
const values = <V extends string>(list: readonly Option<V>[]) =>
  list.map((option) => option.value) as [V, ...V[]]

export const coverageOptions = options([
  { value: 'all', label: 'All of it' },
  { value: 'most', label: 'Most of it' },
  { value: 'half', label: 'About half' },
  { value: 'less-than-half', label: 'Less than half' },
])
export const experienceOptions = options([
  { value: 'new', label: 'New to it' },
  { value: 'some-exposure', label: 'Some exposure' },
  { value: 'supervised', label: 'Do it with supervision' },
  { value: 'independent', label: 'Do it independently' },
  { value: 'teach', label: 'Teach or supervise it' },
])
/** Stored as 1–5 so means and medians need no lookup. */
export const qualityOptions = options([
  { value: '1', label: 'Poor' },
  { value: '2', label: 'Fair' },
  { value: '3', label: 'Good' },
  { value: '4', label: 'Very good' },
  { value: '5', label: 'Excellent' },
])
export const accuracyOptions = options([
  ...qualityOptions,
  { value: 'cant-judge', label: 'Can’t judge' },
])
export const confidenceOptions = options([
  { value: '1', label: 'Not confident' },
  { value: '2', label: 'Slightly' },
  { value: '3', label: 'Somewhat' },
  { value: '4', label: 'Confident' },
  { value: '5', label: 'Very confident' },
])
export const levelOptions = options([
  { value: 'too-basic', label: 'Too basic' },
  { value: 'about-right', label: 'About right' },
  { value: 'too-advanced', label: 'Too advanced' },
])
export const likelihoodOptions = options([
  { value: 'yes', label: 'Yes' },
  { value: 'probably', label: 'Probably' },
  { value: 'probably-not', label: 'Probably not' },
  { value: 'no', label: 'No' },
])
export const consistencyOptions = options([
  { value: 'yes', label: 'Yes' },
  { value: 'mostly', label: 'Mostly' },
  { value: 'in-parts', label: 'In parts' },
  { value: 'no', label: 'No' },
])
export const promptVerdictOptions = options([
  { value: 'looks-right', label: 'Looks right' },
  { value: 'needs-changes', label: 'Needs changes' },
  { value: 'not-reached', label: 'Didn’t reach it' },
])
export const readinessOptions = options([
  { value: 'ready-now', label: 'Ready now' },
  { value: 'minor-fixes', label: 'Ready after minor fixes' },
  { value: 'major-changes', label: 'Needs major changes' },
  { value: 'not-ready', label: 'Not ready' },
])

const text = z.string().trim().max(3000).default('')
const common = {
  coverage: z.enum(values(coverageOptions)),
  experience: z.enum(values(experienceOptions)),
  overall: z.enum(values(qualityOptions)),
  clarity: z.enum(values(qualityOptions)),
  easeOfUse: z.enum(values(qualityOptions)),
  interactive: z.enum(values(qualityOptions)),
  level: z.enum(values(levelOptions)),
  readiness: z.enum(values(readinessOptions)),
  workedBest: text,
  oneFix: text,
}
export const learnerAnswersSchema = z
  .object({
    ...common,
    confidenceBefore: z.enum(values(confidenceOptions)),
    confidenceNow: z.enum(values(confidenceOptions)),
    wouldUse: z.enum(values(likelihoodOptions)),
  })
  .strict()
export const educatorAnswersSchema = z
  .object({
    ...common,
    accuracy: z.enum(values(accuracyOptions)),
    consistent: z.enum(values(consistencyOptions)),
    wouldAssign: z.enum(values(likelihoodOptions)),
    /** The module's own prompts, each stored with the wording it was answered against. */
    prompts: z
      .array(
        z
          .object({
            prompt: z.string().min(1).max(600),
            verdict: z.enum(values(promptVerdictOptions)),
          })
          .strict(),
      )
      .max(12),
  })
  .strict()
export type LearnerAnswers = z.infer<typeof learnerAnswersSchema>
export type EducatorAnswers = z.infer<typeof educatorAnswersSchema>
export type ReviewAnswers = LearnerAnswers | EducatorAnswers

/** What the browser sends. The module's prompts are checked against its hub card on the server. */
export const reviewSubmissionSchema = z.discriminatedUnion('track', [
  z.object({
    moduleId: z.string().min(1).max(64),
    track: z.literal('learner'),
    answers: learnerAnswersSchema,
  }),
  z.object({
    moduleId: z.string().min(1).max(64),
    track: z.literal('educator'),
    answers: educatorAnswersSchema,
  }),
])
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>

/** The profile fields a review is read against, copied when it is saved. */
export interface ReviewerProfile {
  professional_role: string
  role_other: string | null
  resident_specialty: string | null
  training_level: string | null
  years_in_practice: string | null
}
export const reviewerProfileColumns =
  'professional_role,role_other,resident_specialty,training_level,years_in_practice'

export interface StoredReview {
  id: string
  user_id: string | null
  tester_email: string
  module_id: string
  track: ReviewTrack
  profile_snapshot: Partial<ReviewerProfile>
  answers: ReviewAnswers
  form_version: number
  created_at: string
  updated_at: string
}

const trainee = new Set(['medical_student', 'resident', 'chief_resident', ...fellowRoleValues])
/** Students, residents and fellows answer as learners by default; everyone else as educators. */
export function defaultTrack(role: string | null | undefined): ReviewTrack | null {
  if (!role) return null
  return trainee.has(role) ? 'learner' : 'educator'
}

const labelOf = (list: readonly { value: string; label: string }[], value?: string | null) =>
  (value && list.find((option) => option.value === value)?.label) || ''

/** "PCCM Fellow · Fellow Year 2", "Resident, Internal Medicine · PGY-2", "Intensivist · 10-20 years". */
export function describeReviewer(profile: Partial<ReviewerProfile> | null | undefined) {
  if (!profile?.professional_role) return ''
  const role =
    profile.professional_role === 'other'
      ? profile.role_other?.trim() || 'Other'
      : labelOf(professionalRoleOptions, profile.professional_role) || profile.professional_role
  const specialty = labelOf(residentSpecialtyOptions, profile.resident_specialty)
  const level = labelOf(getTrainingLevelOptions(profile.professional_role), profile.training_level)
  const years =
    profile.years_in_practice === 'in_training'
      ? ''
      : labelOf(yearsInPracticeOptions, profile.years_in_practice)
  return [specialty ? `${role}, ${specialty}` : role, level || years].filter(Boolean).join(' · ')
}

export function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return labelOf(list, value) || value
}
