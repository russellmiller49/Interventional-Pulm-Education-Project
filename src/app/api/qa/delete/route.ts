import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type DeleteRequest = {
  sessionIds: string[]
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
  }

  let body: DeleteRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sessionIds } = body

  if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
    return NextResponse.json({ error: 'sessionIds array is required' }, { status: 400 })
  }

  // Delete sessions
  const { error } = await supabaseAdmin.from('proc_qa_sessions').delete().in('id', sessionIds)

  if (error) {
    console.error('Failed to delete sessions:', error)
    return NextResponse.json({ error: 'Failed to delete sessions' }, { status: 500 })
  }

  return NextResponse.json({ success: true, deletedCount: sessionIds.length })
}
