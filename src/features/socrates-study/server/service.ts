import 'server-only'
import { curriculumCatalogSchema } from '../curriculum'
import { supabaseServer } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { upgradeSocratesDocument } from '@/features/socrates-builder/schema'
import { getInvenioPair } from '@/features/socrates-builder/invenio-source'
import {
  trainingProjection,
  testProjection,
  revealProjection,
  type CatalogCase,
} from '../projections'
import type { StudyAttempt, TrainingProgress, SurveyItem } from '../model'

export class SocratesAccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message)
  }
}
export async function requireSocratesUser(adminOnly = false) {
  const supabase = await supabaseServer()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user || user.is_anonymous || !user.email_confirmed_at)
    throw new SocratesAccessError('Sign in with a verified site account.', 401)
  const { data, error: accessError } = await supabase
    .from('site_entitlements')
    .select('entitlement')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('entitlement', ['site_admin', 'socrates_participant'])
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
  if (accessError) throw new SocratesAccessError('Access could not be verified.', 503)
  const isAdmin = (data ?? []).some((row) => row.entitlement === 'site_admin')
  if (
    !isAdmin &&
    (adminOnly || !(data ?? []).some((row) => row.entitlement === 'socrates_participant'))
  )
    throw new SocratesAccessError(
      adminOnly ? 'Study administrator access required.' : 'SOCRATES participant access required.',
    )
  return { supabase, user, isAdmin }
}
export function studyDatabase() {
  const db = createSupabaseAdmin()
  if (!db) throw new SocratesAccessError('Study persistence is not configured.', 503)
  return db
}
export async function trainingCatalog(): Promise<CatalogCase[]> {
  const db = await supabaseServer()
  const { data, error } = await db.rpc('socrates_training_catalog')
  if (error) throw new SocratesAccessError('The case catalog is temporarily unavailable.', 503)
  return data ?? []
}
export async function revisionDocument(caseId: string, revision: number) {
  const { data, error } = await studyDatabase()
    .from('socrates_revisions')
    .select('snapshot')
    .eq('slide_id', caseId)
    .eq('revision', revision)
    .single()
  if (error || !data) throw new SocratesAccessError('Case unavailable.', 404)
  return upgradeSocratesDocument(data.snapshot)
}
export async function checkReady(caseId: string, revision: number, testing: boolean) {
  const { data, error } = await studyDatabase().rpc('socrates_case_ready', {
    cid: caseId,
    rev: revision,
    testing,
  })
  if (error || !data) throw new SocratesAccessError('This case is unavailable pending review.', 409)
}
export async function trainingDocument(caseId: string, revision?: number) {
  const { data, error } = await studyDatabase()
    .from('socrates_slides')
    .select('published_snapshot')
    .eq('id', caseId)
    .single()
  const publishedRevision = data?.published_snapshot?.revision as number | undefined
  if (error || !publishedRevision || (revision !== undefined && revision !== publishedRevision))
    throw new SocratesAccessError('Training case unavailable.', 404)
  await checkReady(caseId, publishedRevision, false)
  return revisionDocument(caseId, publishedRevision)
}
export async function loadTraining(
  caseId: string,
  session: Awaited<ReturnType<typeof requireSocratesUser>>,
) {
  const document = await trainingDocument(caseId)
  const { data, error } = await session.supabase
    .from('socrates_training_progress')
    .select('case_id,case_revision,opened_at,revealed_at,completed_at')
    .eq('user_id', session.user.id)
    .eq('case_id', caseId)
    .eq('case_revision', document.revision)
    .maybeSingle()
  if (error) throw new SocratesAccessError('Training progress could not be loaded.', 503)
  return trainingProjection(
    document,
    Boolean(getInvenioPair(document.slide.descriptorUrl)),
    data as TrainingProgress | null,
  )
}
export async function loadAttempt(
  attemptId: string,
  session: Awaited<ReturnType<typeof requireSocratesUser>>,
) {
  const { data, error } = await session.supabase
    .from('socrates_test_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', session.user.id)
    .single()
  if (error || !data) throw new SocratesAccessError('Attempt unavailable.', 404)
  const attempt = data as StudyAttempt
  const db = studyDatabase()
  const { data: enrollment } = await db
    .from('socrates_study_participants')
    .select('active')
    .eq('study_id', attempt.study_id)
    .eq('user_id', session.user.id)
    .eq('active', true)
    .maybeSingle()
  if (!enrollment) throw new SocratesAccessError('Study enrollment required.')
  const { data: study } = await db
    .from('socrates_studies')
    .select('active')
    .eq('id', attempt.study_id)
    .single()
  if (!study?.active) throw new SocratesAccessError('This study is paused.', 409)
  await checkReady(attempt.case_id, attempt.case_revision, true)
  const { data: round, error: roundError } = await db
    .from('socrates_study_rounds')
    .select('show_legend,show_color_image,feedback_after_submission,survey')
    .eq('study_id', attempt.study_id)
    .eq('round_key', attempt.round_key)
    .single()
  if (roundError || !round) throw new SocratesAccessError('Round unavailable.', 404)
  const document = await revisionDocument(attempt.case_id, attempt.case_revision)
  const config = {
    showLegend: round.show_legend as boolean,
    showColorImage: round.show_color_image as boolean,
    feedbackAfterSubmission: round.feedback_after_submission as boolean,
    survey: round.survey as SurveyItem[],
  }
  return {
    dto: testProjection(
      document,
      attempt,
      config,
      Boolean(getInvenioPair(document.slide.descriptorUrl)),
    ),
    document,
    config,
  }
}
export async function trainingReveal(caseId: string, revision: number) {
  return revealProjection(await trainingDocument(caseId, revision))
}

/** Admin exports and monitoring must not silently stop at PostgREST's row cap. */
export async function allRows(table: string, order: string[] = ['id']) {
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = studyDatabase().from(table).select('*')
    for (const column of order) query = query.order(column)
    const { data, error } = await query.range(offset, offset + 999)
    if (error) throw new SocratesAccessError('Study records could not be loaded.', 503)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
export async function dashboardData() {
  const [studies, rounds, cases, participants, attempts, training] = await Promise.all([
    allRows('socrates_studies'),
    allRows('socrates_study_rounds', ['study_id', 'round_key']),
    allRows('socrates_study_cases', ['study_id', 'round_key', 'case_order']),
    allRows('socrates_study_participants', ['study_id', 'user_id']),
    allRows('socrates_test_attempts'),
    allRows('socrates_training_progress', ['user_id', 'case_id', 'case_revision']),
  ])
  return { studies, rounds, cases, participants, attempts, training }
}

export async function curriculumCatalog() {
  const db = await supabaseServer()
  const { data, error } = await db.rpc('socrates_curriculum_catalog')
  if (error) throw new SocratesAccessError('The curriculum is temporarily unavailable.', 503)
  return curriculumCatalogSchema.parse(data)
}

/** Optional progress on the public directory, always restricted to the verified user's rows. */
export async function directoryProgress(): Promise<TrainingProgress[] | null> {
  try {
    const session = await requireSocratesUser()
    const rows: TrainingProgress[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await session.supabase
        .from('socrates_training_progress')
        .select('case_id,case_revision,opened_at,revealed_at,completed_at')
        .eq('user_id', session.user.id)
        .order('case_id')
        .order('case_revision')
        .range(offset, offset + 999)
      if (error || !data) return null
      rows.push(...(data as TrainingProgress[]))
      if (data.length < 1000) return rows
    }
  } catch {
    return null
  }
}
