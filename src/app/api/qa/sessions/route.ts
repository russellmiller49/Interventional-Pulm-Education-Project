import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Force dynamic - always fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
  }

  const { data: sessions, error } = await supabaseAdmin
    .from('proc_qa_sessions')
    .select(
      `
      id,
      created_at,
      modules_run,
      quality_rating,
      safe_to_use,
      error_categories,
      tester_name,
      reporter_version,
      coder_version,
      procedure_type,
      note_text,
      reporter_output,
      coder_output,
      registry_output,
      ml_advisor_output,
      free_text_feedback,
      repo_branch,
      repo_commit_sha,
      reporter_trace,
      registry_trace,
      unified_trace,
      extraction_confidence,
      field_completeness,
      quality_scores
    `,
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sessions: sessions || [] })
}
