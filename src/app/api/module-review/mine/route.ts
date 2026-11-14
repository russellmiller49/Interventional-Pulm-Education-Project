import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  defaultTrack,
  describeReviewer,
  reviewerProfileColumns,
  type ReviewerProfile,
} from '@/features/module-beta/reviewSchema'
import { countBy } from '@/features/module-beta/reviewServer'
import { feedbackJson, requireFeedbackUser } from '@/features/module-beta/server'

export const runtime = 'nodejs'

/**
 * The signed-in reviewer's own overall reviews, how they are described from their site profile,
 * and how many detailed reports they have sent per module. `reviewsOpen` is false until the
 * reviews table exists, so the hub and the form can say so instead of failing on send.
 */
export async function GET() {
  const auth = await requireFeedbackUser()
  if (!auth.ok) return auth.response
  if (!supabaseAdmin) return feedbackJson({ error: 'Review storage is not available yet.' }, 503)
  const [profileResult, reviewResult, reportResult] = await Promise.all([
    supabaseAdmin
      .from('site_profiles')
      .select(reviewerProfileColumns)
      .eq('id', auth.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('module_beta_reviews')
      .select('id,module_id,track,answers,form_version,created_at,updated_at')
      .eq('user_id', auth.user.id),
    supabaseAdmin.from('module_beta_feedback').select('module_id').eq('user_id', auth.user.id),
  ])
  const profile = (profileResult.data ?? null) as ReviewerProfile | null
  return feedbackJson({
    profile: profile
      ? { label: describeReviewer(profile), defaultTrack: defaultTrack(profile.professional_role) }
      : null,
    reviewsOpen: !reviewResult.error,
    reviews: reviewResult.data ?? [],
    reportCounts: countBy(reportResult.data ?? [], (row) => row.module_id),
  })
}
