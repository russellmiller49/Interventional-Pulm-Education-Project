import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type FeedbackRequest = {
  sessionId: string
  qualityRating?: number
  safeToUse?: boolean
  errorCategories?: string[]
  freeTextFeedback?: string
  unifiedCorrected?: unknown
}

type FeedbackResponse = {
  ok?: boolean
  error?: string
}

export async function POST(request: Request): Promise<NextResponse<FeedbackResponse>> {
  let body: FeedbackRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    sessionId,
    qualityRating,
    safeToUse,
    errorCategories,
    freeTextFeedback,
    unifiedCorrected,
  } = body

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  // Demo mode: allow QA demo without Supabase configured.
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabaseAdmin
    .from('proc_qa_sessions')
    .update({
      quality_rating: qualityRating ?? null,
      safe_to_use: safeToUse ?? null,
      error_categories: errorCategories ?? null,
      free_text_feedback: freeTextFeedback ?? null,
      unified_corrected: unifiedCorrected ?? null,
      feedback_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Failed to save feedback:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
