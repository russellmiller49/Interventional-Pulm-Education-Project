import { supabaseAdmin } from '@/lib/supabase/admin'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SessionList } from './session-list'
import { revalidatePath } from 'next/cache'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Session = {
  id: string
  created_at: string
  modules_run: string
  quality_rating: number | null
  safe_to_use: boolean | null
  error_categories: string[] | null
  tester_name: string | null
  reporter_version: string | null
  coder_version: string | null
  procedure_type: string | null
  note_text: string | null
  reporter_output: Record<string, unknown> | null
  coder_output: Record<string, unknown> | null
  registry_output: Record<string, unknown> | null
  free_text_feedback: string | null
}

async function getSessions(): Promise<{ sessions: Session[]; error?: string }> {
  if (!supabaseAdmin) {
    return { sessions: [], error: 'Supabase admin client not configured' }
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
      free_text_feedback
    `,
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return { sessions: [], error: error.message }
  }

  return { sessions: sessions || [] }
}

export default async function QAAdmin() {
  const { sessions, error } = await getSessions()

  if (error) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <p className="text-red-600">Error loading sessions: {error}</p>
      </div>
    )
  }

  // Calculate statistics
  const totalSessions = sessions.length
  const sessionsWithFeedback = sessions.filter((s) => s.quality_rating !== null).length
  const avgRating =
    sessions
      .filter((s) => s.quality_rating !== null)
      .reduce((sum, s) => sum + (s.quality_rating || 0), 0) / (sessionsWithFeedback || 1) || 0
  const safeCount = sessions.filter((s) => s.safe_to_use === true).length

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">QA Sessions Dashboard</h1>
        <form
          action={async () => {
            'use server'
            revalidatePath('/qa-admin')
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Refresh
          </button>
        </form>
      </div>

      {/* Last Updated Timestamp */}
      <p className="mb-4 text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleString()}
      </p>

      {/* Statistics Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sessions</CardDescription>
            <CardTitle className="text-3xl">{totalSessions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>With Feedback</CardDescription>
            <CardTitle className="text-3xl">{sessionsWithFeedback}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Rating</CardDescription>
            <CardTitle className="text-3xl">{avgRating.toFixed(1)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Safe to Use</CardDescription>
            <CardTitle className="text-3xl">{safeCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Sessions List */}
      <SessionList sessions={sessions} />
    </div>
  )
}
