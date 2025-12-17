import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Force dynamic - always fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  if (!supabaseAdmin) {
    // Demo mode: allow QA admin UI to load even if Supabase isn't configured.
    return NextResponse.json({ sessions: [] })
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
      model_backend,
      model_version,
      procedure_type,
      note_text,
      unified_output,
      free_text_feedback,
      reporter_output,
      coder_output,
      registry_output
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
