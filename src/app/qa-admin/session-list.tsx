'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight, Trash2, Download } from 'lucide-react'

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
  repo_branch: string | null
  repo_commit_sha: string | null
}

function SessionDetail({ session }: { session: Session }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-start"
      >
        {isOpen ? (
          <ChevronDown className="mr-2 h-4 w-4" />
        ) : (
          <ChevronRight className="mr-2 h-4 w-4" />
        )}
        {isOpen ? 'Hide Details' : 'Show Details'}
      </Button>
      {isOpen && (
        <div className="mt-4 space-y-4">
          {/* Input Note */}
          {session.note_text && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Input Note</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded bg-muted p-4 text-sm">
                  {session.note_text}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Reporter Output */}
          {session.reporter_output && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reporter Output</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded bg-muted p-4 text-xs">
                  {JSON.stringify(session.reporter_output, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Coder Output */}
          {session.coder_output && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Coder Output</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded bg-muted p-4 text-xs">
                  {JSON.stringify(session.coder_output, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Registry Output */}
          {session.registry_output && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registry Output</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded bg-muted p-4 text-xs">
                  {JSON.stringify(session.registry_output, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Feedback */}
          {session.free_text_feedback && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap rounded bg-muted p-4 text-sm">
                  {session.free_text_feedback}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error Categories Detail */}
          {session.error_categories && session.error_categories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Error Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {session.error_categories.map((cat, idx) => (
                    <li key={idx} className="text-sm">
                      {cat}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export function SessionList({
  sessions: initialSessions,
  onDelete,
}: {
  sessions: Session[]
  onDelete?: () => void
}) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initialSessions)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  // Update sessions when parent passes new data
  useEffect(() => {
    setSessions(initialSessions)
  }, [initialSessions])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sessions.map((s) => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectSession = (sessionId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(sessionId)
    } else {
      newSelected.delete(sessionId)
    }
    setSelectedIds(newSelected)
  }

  const handleExportCSV = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one session to export')
      return
    }

    const selectedSessions = sessions.filter((s) => selectedIds.has(s.id))

    // Helper to convert value to CSV-safe string
    const csvEscape = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') {
        return JSON.stringify(value).replace(/"/g, '""')
      }
      const str = String(value)
      // Escape quotes and wrap in quotes if contains comma, newline, or quote
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Define CSV columns
    const headers = [
      'ID',
      'Created At',
      'Tester Name',
      'Modules Run',
      'Procedure Type',
      'Note Text',
      'Reporter Output (JSON)',
      'Coder Output (JSON)',
      'Registry Output (JSON)',
      'Quality Rating',
      'Safe to Use',
      'Error Categories',
      'Free Text Feedback',
      'Reporter Version',
      'Coder Version',
      'Repo Branch',
      'Repo Commit SHA',
    ]

    // Build CSV rows
    const rows = selectedSessions.map((session) => [
      session.id,
      session.created_at,
      session.tester_name || '',
      session.modules_run,
      session.procedure_type || '',
      session.note_text || '',
      session.reporter_output ? JSON.stringify(session.reporter_output) : '',
      session.coder_output ? JSON.stringify(session.coder_output) : '',
      session.registry_output ? JSON.stringify(session.registry_output) : '',
      session.quality_rating?.toString() || '',
      session.safe_to_use?.toString() || '',
      session.error_categories?.join('; ') || '',
      session.free_text_feedback || '',
      session.reporter_version || '',
      session.coder_version || '',
      session.repo_branch || '',
      session.repo_commit_sha || '',
    ])

    // Combine headers and rows
    const csvContent = [
      headers.map(csvEscape).join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ].join('\n')

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `qa-sessions-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDelete = async () => {
    if (selectedIds.size === 0) return

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} session(s)? This action cannot be undone. This is useful for cleaning up old test data after pipeline updates.`,
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/qa/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: Array.from(selectedIds) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete sessions')
      }

      // Remove deleted sessions from state
      setSessions(sessions.filter((s) => !selectedIds.has(s.id)))
      setSelectedIds(new Set())

      // Call parent's refresh callback if provided, otherwise use router
      if (onDelete) {
        onDelete()
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete sessions')
    } finally {
      setIsDeleting(false)
    }
  }

  const allSelected = sessions.length > 0 && selectedIds.size === sessions.length

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>
                Latest 100 QA test sessions - Select sessions to export or delete after pipeline
                updates
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV ({selectedIds.size})
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length > 0 && (
            <div className="mb-4 flex items-center space-x-2 border-b pb-4">
              <Checkbox id="select-all" checked={allSelected} onCheckedChange={handleSelectAll} />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Select All
              </label>
            </div>
          )}

          <div className="space-y-4">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      id={`select-${session.id}`}
                      checked={selectedIds.has(session.id)}
                      onCheckedChange={(checked) =>
                        handleSelectSession(session.id, checked as boolean)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-8">
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="text-sm font-medium">
                            {new Date(session.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Modules</p>
                          <p className="text-sm font-medium">{session.modules_run}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Type</p>
                          <p className="text-sm font-medium">{session.procedure_type || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Rating</p>
                          <p className="text-sm font-medium">
                            {session.quality_rating !== null ? (
                              <span
                                className={
                                  session.quality_rating >= 4
                                    ? 'text-green-600'
                                    : session.quality_rating <= 2
                                      ? 'text-red-600'
                                      : 'text-yellow-600'
                                }
                              >
                                {session.quality_rating}/5
                              </span>
                            ) : (
                              '—'
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Safe?</p>
                          <p className="text-sm font-medium">
                            {session.safe_to_use === null ? (
                              '—'
                            ) : session.safe_to_use ? (
                              <span className="text-green-600">Yes</span>
                            ) : (
                              <span className="text-red-600">No</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Errors</p>
                          <p className="text-sm font-medium">
                            {session.error_categories?.length ? (
                              <span className="text-orange-600">
                                {session.error_categories.length}
                              </span>
                            ) : (
                              '—'
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tester</p>
                          <p className="text-sm font-medium">{session.tester_name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Version</p>
                          <p className="text-xs font-medium">
                            {session.reporter_version || session.coder_version || '—'}
                          </p>
                        </div>
                      </div>
                      <SessionDetail session={session} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {sessions.length === 0 && (
            <p className="mt-4 text-muted-foreground">No QA sessions yet.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
