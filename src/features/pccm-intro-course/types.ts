export const pccmInstitutions = ['ucsd', 'loma_linda'] as const
export const pccmAssessmentKinds = [
  'bronchoscopy_pre',
  'bronchoscopy_post',
  'pleural_pre',
  'pleural_post',
] as const

export type PccmInstitution = (typeof pccmInstitutions)[number]
export type PccmAssessmentKind = (typeof pccmAssessmentKinds)[number]
export type PccmAssessmentFamily = 'bronchoscopy' | 'pleural'
export type PccmAssessmentPhase = 'pre' | 'post'
export type PccmVideoAudience = PccmInstitution | 'shared'
export type PccmCourseSection = 'bronchoscopy' | 'pleural'

export interface PccmEnrollment {
  id: string
  user_id: string
  institution: PccmInstitution
  status: 'active' | 'revoked'
  enrolled_at: string
}

export interface PccmAssessmentAttemptRow {
  id: string
  user_id: string
  enrollment_id: string
  attempt_kind: PccmAssessmentKind
  question_order: string[]
  choice_order: Record<string, string[]>
  answers: Record<string, string>
  score: number | null
  total: number | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface PccmVideoProgressRow {
  user_id: string
  video_id: string
  max_percent_complete: number
  watched_seconds: number
  duration_seconds: number | null
  last_position_seconds: number | null
  completed_at: string | null
  last_activity_at: string
}

export function isPccmInstitution(value: unknown): value is PccmInstitution {
  return typeof value === 'string' && pccmInstitutions.includes(value as PccmInstitution)
}

export function isPccmAssessmentKind(value: unknown): value is PccmAssessmentKind {
  return typeof value === 'string' && pccmAssessmentKinds.includes(value as PccmAssessmentKind)
}

export function getPccmAssessmentFamily(kind: PccmAssessmentKind): PccmAssessmentFamily {
  return kind.startsWith('bronchoscopy') ? 'bronchoscopy' : 'pleural'
}

export function getPccmAssessmentPhase(kind: PccmAssessmentKind): PccmAssessmentPhase {
  return kind.endsWith('_pre') ? 'pre' : 'post'
}

export function formatPccmInstitution(institution: PccmInstitution) {
  return institution === 'loma_linda' ? 'Loma Linda' : 'UCSD'
}

export function formatPccmAssessmentKind(kind: PccmAssessmentKind) {
  const family = getPccmAssessmentFamily(kind) === 'bronchoscopy' ? 'Bronchoscopy' : 'Pleural'
  const phase = getPccmAssessmentPhase(kind) === 'pre' ? 'Pretest' : 'Posttest'
  return `${family} ${phase}`
}
