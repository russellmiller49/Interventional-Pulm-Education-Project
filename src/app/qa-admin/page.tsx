'use client'

import { useEffect, useState } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SessionList } from './session-list'

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

export default function QAAdmin() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchSessions = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/qa/sessions', {
        cache: 'no-store', // Always fetch fresh data
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch sessions')
      }
      setSessions(data.sessions || [])
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSessions, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && sessions.length === 0) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <p className="text-muted-foreground">Loading sessions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <p className="text-red-600">Error loading sessions: {error}</p>
        <Button onClick={fetchSessions} className="mt-4">
          Retry
        </Button>
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
        <Button onClick={fetchSessions} disabled={loading} variant="outline">
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Last Updated Timestamp */}
      <p className="mb-4 text-sm text-muted-foreground">
        Last updated: {lastUpdated.toLocaleString()}
        {loading && ' (refreshing...)'}
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
      <SessionList sessions={sessions} onDelete={fetchSessions} />
    </div>
  )
}
