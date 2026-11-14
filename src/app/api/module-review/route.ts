import { supabaseAdmin } from '@/lib/supabase/admin'
import { betaModuleById } from '@/features/module-beta/catalog'
import {
  reviewFormVersion,
  reviewSubmissionSchema,
  reviewTracks,
  reviewerProfileColumns,
} from '@/features/module-beta/reviewSchema'
import { countBy, modulePrompts, reviewsUnavailable } from '@/features/module-beta/reviewServer'
import { feedbackJson, hasSameOrigin, requireFeedbackUser } from '@/features/module-beta/server'

export const runtime = 'nodejs'
const maxBody = 64000

/** Save the signed-in reviewer's overall review of one module, or replace their earlier one. */
export async function POST(request: Request) {
  if (!hasSameOrigin(request))
    return feedbackJson({ error: 'Send your review from this site.' }, 403)
  const auth = await requireFeedbackUser()
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return feedbackJson({ error: reviewsUnavailable }, 503)
  if (Number(request.headers.get('content-length')) > maxBody)
    return feedbackJson({ error: 'This review is too long to send.' }, 413)
  const raw = await request.text().catch(() => '')
  if (raw.length > maxBody) return feedbackJson({ error: 'This review is too long to send.' }, 413)
  let body: unknown = null
  try {
    body = JSON.parse(raw)
  } catch {}
  const parsed = reviewSubmissionSchema.safeParse(body)
  if (!parsed.success)
    return feedbackJson({ error: 'Answer every question before sending your review.' }, 400)
  const { moduleId, track, answers } = parsed.data
  const moduleEntry = betaModuleById(moduleId)
  if (!moduleEntry)
    return feedbackJson({ error: 'Open a module from the beta hub before reviewing it.' }, 400)
  if (track === 'educator') {
    const expected = modulePrompts(moduleEntry.id)
    const sent = answers.prompts.map((entry) => entry.prompt)
    if (sent.length !== expected.length || sent.some((prompt, i) => prompt !== expected[i]))
      return feedbackJson(
        {
          error:
            'This module’s questions have changed since you opened the form. Close it and open it again; your other answers are kept.',
        },
        409,
      )
  }
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('site_profiles')
    .select(reviewerProfileColumns)
    .eq('id', auth.user.id)
    .maybeSingle()
  if (profileError) return feedbackJson({ error: reviewsUnavailable }, 503)
  const { data, error } = await supabaseAdmin
    .from('module_beta_reviews')
    .upsert(
      {
        user_id: auth.user.id,
        tester_email: auth.user.email ?? '',
        module_id: moduleEntry.id,
        track,
        profile_snapshot: profile ?? {},
        answers,
        form_version: reviewFormVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,module_id' },
    )
    .select('id,module_id,track,answers,form_version,created_at,updated_at')
    .single()
  if (error || !data) return feedbackJson({ error: reviewsUnavailable }, 503)
  return feedbackJson({ review: data })
}

/** Every overall review, for the site admin's workspace, with each reviewer's report counts. */
export async function GET(request: Request) {
  const auth = await requireFeedbackUser(true)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return feedbackJson({ error: 'Review storage is not available yet.' }, 503)
  const params = new URL(request.url).searchParams
  const moduleId = params.get('module')
  const track = params.get('track')
  let query = supabaseAdmin
    .from('module_beta_reviews')
    .select(
      'id,user_id,tester_email,module_id,track,profile_snapshot,answers,form_version,created_at,updated_at',
    )
  if (moduleId) query = query.eq('module_id', moduleId)
  if (track && (reviewTracks as readonly string[]).includes(track)) query = query.eq('track', track)
  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .order('id')
    .range(0, 999)
  if (error)
    return feedbackJson(
      { error: 'Overall reviews could not be loaded. Check that review storage has been set up.' },
      503,
    )
  const reviews = data ?? []
  const users = [...new Set(reviews.map((review) => review.user_id).filter(Boolean))] as string[]
  let reportCounts: Record<string, number> = {}
  if (users.length) {
    const { data: reports, error: reportError } = await supabaseAdmin
      .from('module_beta_feedback')
      .select('user_id,module_id')
      .in('user_id', users)
    if (!reportError)
      reportCounts = countBy(reports ?? [], (row) => `${row.user_id}:${row.module_id}`)
  }
  return feedbackJson({ reviews, reportCounts })
}
