import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { reviewSchema } from '@/features/module-beta/schema'
import { feedbackJson, hasSameOrigin, requireFeedbackUser } from '@/features/module-beta/server'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasSameOrigin(request))
    return feedbackJson({ error: 'Update feedback from this site.' }, 403)
  const auth = await requireFeedbackUser(true)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return feedbackJson({ error: 'Feedback storage is not available yet.' }, 503)
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success)
    return feedbackJson({ error: 'Invalid feedback ID.' }, 400)
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return feedbackJson({ error: 'Choose a valid status and notes up to 10,000 characters.' }, 400)
  const { data, error } = await supabaseAdmin
    .from('module_beta_feedback')
    .update({
      status: parsed.data.status,
      reviewer_notes: parsed.data.reviewerNotes,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return feedbackJson({ error: 'Review could not be saved.' }, 503)
  if (!data) return feedbackJson({ error: 'Feedback was not found.' }, 404)
  return feedbackJson({ id: data.id })
}
