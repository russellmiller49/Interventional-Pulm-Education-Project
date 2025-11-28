import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type FeedbackRequest = {
  sessionId: string
  qualityRating?: number
  safeToUse?: boolean
  errorCategories?: string[]
  freeTextFeedback?: string
  reporterCorrected?: unknown
  coderCorrected?: unknown
}

type FeedbackResponse = {
  ok?: boolean
  error?: string
}

export async function POST(request: Request): Promise<NextResponse<FeedbackResponse>> {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
  }

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
    reporterCorrected,
    coderCorrected,
  } = body

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('proc_qa_sessions')
    .update({
      quality_rating: qualityRating ?? null,
      safe_to_use: safeToUse ?? null,
      error_categories: errorCategories ?? null,
      free_text_feedback: freeTextFeedback ?? null,
      reporter_corrected: reporterCorrected ?? null,
      coder_corrected: coderCorrected ?? null,
      feedback_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Failed to save feedback:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
