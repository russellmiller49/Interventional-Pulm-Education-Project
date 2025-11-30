import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PROC_API_URL = process.env.PROC_API_URL
const PROC_API_TIMEOUT = 60000 // 60 seconds

type RunRequest = {
  noteText: string
  modulesRun: 'reporter' | 'coder' | 'registry'
  procedureType?: string
  testerName: string
  includeMLAdvisor?: boolean // New: Enable ML advisor for hybrid coding
}

type RunResponse = {
  sessionId?: string
  reporterOutput?: Record<string, unknown>
  coderOutput?: Record<string, unknown>
  registryOutput?: Record<string, unknown>
  mlAdvisorOutput?: Record<string, unknown> // New: ML advisor suggestions
  error?: string
}

export async function POST(request: Request): Promise<NextResponse<RunResponse>> {
  if (!PROC_API_URL) {
    return NextResponse.json({ error: 'PROC_API_URL not configured' }, { status: 500 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
  }

  let body: RunRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { noteText, modulesRun, procedureType, testerName, includeMLAdvisor } = body

  if (!noteText || !modulesRun || !testerName) {
    return NextResponse.json(
      { error: 'noteText, modulesRun, and testerName are required' },
      { status: 400 },
    )
  }

  // 1) Create initial session row
  const { data: session, error: insertError } = await supabaseAdmin
    .from('proc_qa_sessions')
    .insert({
      note_text: noteText,
      modules_run: modulesRun,
      procedure_type: procedureType || null,
      tester_name: testerName,
    })
    .select()
    .single()

  if (insertError || !session) {
    console.error('Failed to create session:', insertError)
    return NextResponse.json({ error: 'Failed to create QA session' }, { status: 500 })
  }

  // 2) Call Python service with timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROC_API_TIMEOUT)

  try {
    const apiRes = await fetch(`${PROC_API_URL}/qa/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_text: noteText,
        modules_run: modulesRun,
        procedure_type: procedureType ?? null,
        include_ml_advisor: includeMLAdvisor ?? false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!apiRes.ok) {
      const errorText = await apiRes.text()
      console.error('Python service failed:', errorText)
      return NextResponse.json({ error: 'Python service failed' }, { status: 502 })
    }

    const {
      reporter_output,
      coder_output,
      registry_output,
      reporter_version,
      coder_version,
      repo_branch,
      repo_commit_sha,
    } = await apiRes.json()

    // 2b) If ML advisor is requested, get ML suggestions for the relevant module
    let ml_advisor_output = null
    if (includeMLAdvisor) {
      try {
        // Different ML advisor endpoint based on module type
        const mlEndpoint =
          modulesRun === 'coder'
            ? `${PROC_API_URL}/api/v1/ml-advisor/code_with_advisor`
            : modulesRun === 'reporter'
              ? `${PROC_API_URL}/api/v1/ml-advisor/reporter_assist`
              : `${PROC_API_URL}/api/v1/ml-advisor/registry_validate`

        const mlRes = await fetch(mlEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report_text: noteText,
            procedure_category: procedureType || null,
            include_advisor: true,
            // Pass module-specific context
            registry_output: modulesRun === 'registry' ? registry_output : undefined,
            reporter_output: modulesRun === 'reporter' ? reporter_output : undefined,
          }),
          signal: controller.signal,
        })

        if (mlRes.ok) {
          ml_advisor_output = await mlRes.json()
        } else {
          console.warn('ML advisor call failed:', await mlRes.text())
        }
      } catch (mlError) {
        console.warn('ML advisor error:', mlError)
        // Continue without ML advisor output
      }
    }

    // 3) Update session with outputs
    const { error: updateError } = await supabaseAdmin
      .from('proc_qa_sessions')
      .update({
        reporter_output,
        coder_output,
        registry_output,
        reporter_version,
        coder_version,
        repo_branch,
        repo_commit_sha,
        ml_advisor_output, // Store ML advisor results
      })
      .eq('id', session.id)

    if (updateError) {
      console.error('Failed to update session:', updateError)
      // Continue anyway - outputs were generated
    }

    // 4) Return to frontend
    return NextResponse.json({
      sessionId: session.id,
      reporterOutput: reporter_output,
      coderOutput: coder_output,
      registryOutput: registry_output,
      mlAdvisorOutput: ml_advisor_output,
    })
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
