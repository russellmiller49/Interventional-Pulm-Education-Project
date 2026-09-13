import { supabaseAdmin } from '@/lib/supabase/admin'
import { feedbackSchema, isPngScreenshot, maxScreenshotBytes } from '@/features/module-beta/schema'
import {
  feedbackBucket,
  feedbackJson,
  hasSameOrigin,
  requireFeedbackUser,
  readFeedbackForm,
} from '@/features/module-beta/server'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return feedbackJson({ error: 'Send feedback from this site.' }, 403)
  const auth = await requireFeedbackUser()
  if (!auth.ok) return auth.response
  if (!supabaseAdmin)
    return feedbackJson(
      { error: 'Feedback storage is not available yet. Your draft has been kept open.' },
      503,
    )
  if (Number(request.headers.get('content-length')) > maxScreenshotBytes + 64000)
    return feedbackJson({ error: 'The screenshot is too large.' }, 413)
  let form: FormData
  try {
    form = await readFeedbackForm(request, maxScreenshotBytes + 64000)
  } catch (error) {
    if (error instanceof RangeError)
      return feedbackJson({ error: 'The screenshot is too large.' }, 413)
    return feedbackJson({ error: 'Could not read this feedback.' }, 400)
  }
  const parsed = feedbackSchema.safeParse(Object.fromEntries(form.entries()))
  if (!parsed.success) return feedbackJson({ error: parsed.error.issues[0].message }, 400)
  const body = parsed.data
  const attachment = form.get('screenshot')
  let bytes: Uint8Array | null = null
  if (attachment !== null) {
    if (
      !(attachment instanceof File) ||
      attachment.type !== 'image/png' ||
      attachment.size > maxScreenshotBytes
    )
      return feedbackJson({ error: 'Attach a PNG screenshot up to 3 MB.' }, 400)
    bytes = new Uint8Array(await attachment.arrayBuffer())
    if (!isPngScreenshot(bytes))
      return feedbackJson({ error: 'The screenshot could not be read.' }, 400)
  }
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('module_beta_feedback')
    .select('id,user_id')
    .eq('id', body.id)
    .maybeSingle()
  if (existingError)
    return feedbackJson(
      { error: 'Feedback storage is not available yet. Your draft has been kept open.' },
      503,
    )
  if (existing)
    return existing.user_id === auth.user.id
      ? feedbackJson({ id: existing.id })
      : feedbackJson({ error: 'Start a new feedback report and try again.' }, 409)
  const { count, error: countError } = await supabaseAdmin
    .from('module_beta_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())
  if (countError)
    return feedbackJson({ error: 'Feedback storage is temporarily unavailable.' }, 503)
  if ((count ?? 0) >= 30)
    return feedbackJson(
      { error: 'You have sent 30 reports in the past hour. Please try again later.' },
      429,
    )
  const screenshotPath = bytes ? `${auth.user.id}/${body.id}.png` : null
  if (bytes && screenshotPath) {
    const { error } = await supabaseAdmin.storage
      .from(feedbackBucket)
      .upload(screenshotPath, bytes, { contentType: 'image/png', upsert: false })
    if (error)
      return feedbackJson(
        { error: 'The screenshot could not be saved. Your draft has been kept open.' },
        503,
      )
  }
  const { error } = await supabaseAdmin.from('module_beta_feedback').insert({
    id: body.id,
    user_id: auth.user.id,
    tester_email: auth.user.email ?? '',
    module_id: body.moduleId,
    page_path: body.pagePath,
    comment: body.comment,
    selected_text: body.selectedText,
    screenshot_path: screenshotPath,
  })
  if (error) {
    if (screenshotPath) await supabaseAdmin.storage.from(feedbackBucket).remove([screenshotPath])
    return feedbackJson(
      { error: 'Feedback could not be saved. Your draft has been kept open; please retry.' },
      503,
    )
  }
  return feedbackJson({ id: body.id }, 201)
}

export async function GET(request: Request) {
  const auth = await requireFeedbackUser(true)
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return feedbackJson({ error: 'Feedback storage is not available yet.' }, 503)
  const params = new URL(request.url).searchParams
  const page = Math.max(0, Math.min(10000, Math.floor(Number(params.get('page')) || 0)))
  let query = supabaseAdmin
    .from('module_beta_feedback')
    .select(
      'id,module_id,page_path,comment,selected_text,tester_email,created_at,screenshot_path,status,reviewer_notes',
      { count: 'exact' },
    )
  if (params.get('module')) query = query.eq('module_id', params.get('module')!)
  if (params.get('status')) query = query.eq('status', params.get('status')!)
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .order('id')
    .range(page * 30, page * 30 + 29)
  if (error)
    return feedbackJson(
      { error: 'Feedback could not be loaded. Check that feedback storage has been set up.' },
      503,
    )
  return feedbackJson({ entries: data, count })
}
