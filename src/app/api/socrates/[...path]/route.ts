import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireSocratesUser,
  SocratesAccessError,
  trainingCatalog,
  loadTraining,
  loadAttempt,
  trainingReveal,
  dashboardData,
} from '@/features/socrates-study/server/service'
import { studyConfigSchema } from '@/features/socrates-study/model'
import { studyCsv } from '@/features/socrates-study/reporting'

export const dynamic = 'force-dynamic'
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}
const uuid = z.string().uuid()
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers })
}
function failure(error: unknown) {
  if (error instanceof SocratesAccessError) return json({ error: error.message }, error.status)
  if (error instanceof z.ZodError)
    return json({ error: error.issues[0]?.message ?? 'Invalid request.' }, 400)
  // Database errors can contain private input. Never send them to a participant.
  return json({ error: 'The request could not be saved. Reload and try again.' }, 409)
}
async function body(request: Request) {
  if (Number(request.headers.get('content-length')) > 262144)
    throw new SocratesAccessError('Request too large.', 413)
  const source = await request.text()
  if (source.length > 262144) throw new SocratesAccessError('Request too large.', 413)
  try {
    return JSON.parse(source) as unknown
  } catch {
    throw new SocratesAccessError('Invalid JSON.', 400)
  }
}
async function rpc(
  session: Awaited<ReturnType<typeof requireSocratesUser>>,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await session.supabase.rpc(name, args)
  if (error) throw new Error('Database operation failed.')
  return data
}
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await params).path
    if (path.join('/') === 'catalog') return json(await trainingCatalog())
    const session = await requireSocratesUser(path[0] === 'admin')
    if (path[0] === 'training' && path.length === 2)
      return json(await loadTraining(uuid.parse(path[1]), session))
    if (path[0] === 'attempt' && path.length === 2)
      return json((await loadAttempt(uuid.parse(path[1]), session)).dto)
    if (path.join('/') === 'studies')
      return json(await rpc(session, 'socrates_participant_studies', {}))
    if (path.join('/') === 'admin/dashboard') return json(await dashboardData())
    if (path.join('/') === 'admin/export')
      return new Response(studyCsv(await dashboardData()), {
        headers: {
          ...headers,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="socrates-study.csv"',
        },
      })
    return json({ error: 'Not found.' }, 404)
  } catch (error) {
    return failure(error)
  }
}
export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    // Same-origin cookie requests only; no cross-site study writes.
    const origin = request.headers.get('origin')
    if (
      origin &&
      new URL(origin).host !== (request.headers.get('host') ?? new URL(request.url).host)
    )
      throw new SocratesAccessError('Origin not allowed.')
    const path = (await params).path.join('/')
    const session = await requireSocratesUser(path.startsWith('admin/'))
    const input = await body(request)
    if (path === 'training') {
      const p = z
        .object({
          caseId: uuid,
          revision: z.number().int().positive(),
          stage: z.enum(['opened', 'revealed', 'completed']),
        })
        .strict()
        .parse(input)
      const progress = await rpc(session, 'socrates_record_training', {
        cid: p.caseId,
        rev: p.revision,
        stage: p.stage,
      })
      const reveal = p.stage === 'opened' ? null : await trainingReveal(p.caseId, p.revision)
      return json({ progress, reveal })
    }
    if (path === 'start') {
      const p = z
        .object({
          studyId: uuid,
          round: z.string().regex(/^[a-z0-9-]{1,40}$/),
          position: z.number().int().positive(),
        })
        .strict()
        .parse(input)
      const attempt = await rpc(session, 'socrates_start_attempt', {
        sid: p.studyId,
        round_id: p.round,
        case_position: p.position,
      })
      return json({ attemptId: attempt.id })
    }
    if (path === 'submit') {
      const p = z
        .object({ attemptId: uuid, responses: z.record(z.string().max(4000)) })
        .strict()
        .parse(input)
      await rpc(session, 'socrates_submit_attempt', {
        attempt_id: p.attemptId,
        answers: p.responses,
      })
      return json((await loadAttempt(p.attemptId, session)).dto)
    }
    if (path === 'admin/study') {
      const config = studyConfigSchema.parse(input)
      const id = await rpc(session, 'socrates_save_study', { config })
      return json({ id })
    }
    if (path === 'admin/enroll') {
      const p = z.object({ studyId: uuid, userId: uuid, active: z.boolean() }).strict().parse(input)
      await rpc(session, 'socrates_enroll_participant', {
        sid: p.studyId,
        participant: p.userId,
        enabled: p.active,
      })
      return json({ ok: true })
    }
    if (path === 'admin/active') {
      const p = z.object({ studyId: uuid, active: z.boolean() }).strict().parse(input)
      await rpc(session, 'socrates_set_study_active', { sid: p.studyId, enabled: p.active })
      return json({ ok: true })
    }
    return json({ error: 'Not found.' }, 404)
  } catch (error) {
    return failure(error)
  }
}
