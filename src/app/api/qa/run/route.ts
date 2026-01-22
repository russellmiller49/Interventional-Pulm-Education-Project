import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { randomUUID } from 'node:crypto'

const PROC_API_URL = process.env.PROC_API_URL
const PROC_API_TIMEOUT = 60000 // 60 seconds

type CodeSuggestion = {
  code: string
  description: string
  confidence: number
  rationale: string
  review_flag: string
}

type UnifiedOutput = {
  registry: Record<string, unknown>
  cpt_codes: string[]
  suggestions: CodeSuggestion[]
  total_work_rvu?: number
  estimated_payment?: number
  per_code_billing?: Array<{
    cpt_code: string
    description: string
    work_rvu: number
    total_facility_rvu: number
    facility_payment: number
  }>
  coder_difficulty: string
  needs_manual_review: boolean
  audit_warnings: string[]
  validation_errors: string[]
  pipeline_mode: string
  kb_version: string
  processing_time_ms: number
}

type RunRequest = {
  noteText: string
  procedureType?: string
  testerName: string
}

type RunResponse = {
  sessionId?: string
  unifiedOutput?: UnifiedOutput
  modelBackend?: string
  modelVersion?: string
  error?: string
}

export async function POST(request: Request): Promise<NextResponse<RunResponse>> {
  if (!PROC_API_URL) {
    return NextResponse.json({ error: 'PROC_API_URL not configured' }, { status: 500 })
  }

  let body: RunRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { noteText, procedureType, testerName } = body

  if (!noteText || !testerName) {
    return NextResponse.json({ error: 'noteText and testerName are required' }, { status: 400 })
  }

  // 1) Optional: create initial session row (skip if Supabase not configured)
  const supabaseEnabled = Boolean(supabaseAdmin)
  let sessionId = randomUUID()

  if (supabaseEnabled && supabaseAdmin) {
    const { data: session, error: insertError } = await supabaseAdmin
      .from('proc_qa_sessions')
      .insert({
        note_text: noteText,
        modules_run: 'unified',
        procedure_type: procedureType || null,
        tester_name: testerName,
      })
      .select()
      .single()

    if (insertError || !session) {
      console.warn('Failed to create Supabase session; continuing without logging:', insertError)
    } else {
      sessionId = session.id
    }
  }

  // 2) Call Python unified endpoint with timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROC_API_TIMEOUT)

  try {
    const apiRes = await fetch(`${PROC_API_URL}/api/v1/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: noteText,
        include_financials: true,
        explain: true,
      }),
      signal: controller.signal,
    })

    if (!apiRes.ok) {
      const errorText = await apiRes.text()
      let errorMessage = 'Python service failed'

      if (errorText) {
        try {
          const parsed = JSON.parse(errorText) as { detail?: string; error?: string } | null
          const detail = parsed?.detail ?? parsed?.error
          if (detail && typeof detail === 'string') {
            errorMessage = detail
          }
        } catch {
          // Keep the generic message if the upstream error isn't JSON.
        }
      }

      console.error('Python service failed:', errorText)
      return NextResponse.json({ error: errorMessage }, { status: apiRes.status })
    }

    const data = await apiRes.json()

    // Transform response to frontend format
    const unifiedOutput: UnifiedOutput = {
      registry: data.registry || {},
      cpt_codes: data.cpt_codes || [],
      suggestions: data.suggestions || [],
      total_work_rvu: data.total_work_rvu,
      estimated_payment: data.estimated_payment,
      per_code_billing: data.per_code_billing,
      coder_difficulty: data.coder_difficulty || '',
      needs_manual_review: data.needs_manual_review || false,
      audit_warnings: data.audit_warnings || [],
      validation_errors: data.validation_errors || [],
      pipeline_mode: data.pipeline_mode || 'extraction_first',
      kb_version: data.kb_version || '',
      processing_time_ms: data.processing_time_ms || 0,
    }

    // 3) Update session with unified output
    if (supabaseEnabled && supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin
        .from('proc_qa_sessions')
        .update({
          unified_output: unifiedOutput,
          model_backend: 'onnx',
          model_version: data.kb_version,
        })
        .eq('id', sessionId)

      if (updateError) {
        console.warn('Failed to update Supabase session; continuing without logging:', updateError)
      }
    }

    // 4) Return to frontend
    return NextResponse.json({
      sessionId,
      unifiedOutput,
      modelBackend: 'onnx',
      modelVersion: data.kb_version,
    })
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    clearTimeout(timeout)
  }
}
