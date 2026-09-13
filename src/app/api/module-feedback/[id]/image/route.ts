import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { feedbackBucket, feedbackJson, requireFeedbackUser } from '@/features/module-beta/server'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireFeedbackUser(true)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return feedbackJson({ error: 'Feedback storage is not available yet.' }, 503)
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success)
    return feedbackJson({ error: 'Invalid feedback ID.' }, 400)
  const { data, error } = await supabaseAdmin
    .from('module_beta_feedback')
    .select('screenshot_path')
    .eq('id', id)
    .maybeSingle()
  if (error) return feedbackJson({ error: 'Screenshot lookup is unavailable.' }, 503)
  if (!data?.screenshot_path) return feedbackJson({ error: 'Screenshot not found.' }, 404)
  const result = await supabaseAdmin.storage.from(feedbackBucket).download(data.screenshot_path)
  if (result.error || !result.data)
    return feedbackJson({ error: 'Screenshot could not be loaded.' }, 503)
  return new Response(result.data, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="module-feedback.png"',
    },
  })
}
