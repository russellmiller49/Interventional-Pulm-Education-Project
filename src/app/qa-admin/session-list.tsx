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
  ml_advisor_output: Record<string, unknown> | null
  free_text_feedback: string | null
  repo_branch: string | null
  repo_commit_sha: string | null
  // New trace fields for ML feedback loop
  reporter_trace: Record<string, unknown> | null
  registry_trace: Record<string, unknown> | null
  unified_trace: Record<string, unknown> | null
  extraction_confidence: Record<string, number> | null
  field_completeness: number | null
  quality_scores: Record<string, number> | null
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

          {/* ML Advisor Output */}
          {session.ml_advisor_output && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  ML Advisor Output
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-normal text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    Beta
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Explanation */}
                {session.ml_advisor_output.advisor_explanation && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Explanation
                    </p>
                    <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                      {String(session.ml_advisor_output.advisor_explanation)}
                    </p>
                  </div>
                )}

                {/* Disagreements */}
                {Array.isArray(session.ml_advisor_output.disagreements) &&
                  session.ml_advisor_output.disagreements.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Disagreements
                      </p>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        {(session.ml_advisor_output.disagreements as string[]).join(', ')}
                      </p>
                    </div>
                  )}

                {/* Confidence Scores */}
                {session.ml_advisor_output.advisor_suggestions &&
                  typeof session.ml_advisor_output.advisor_suggestions === 'object' && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-muted-foreground">
                        Confidence Scores
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(
                          session.ml_advisor_output.advisor_suggestions as Record<string, number>,
                        ).map(([code, confidence]) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm"
                          >
                            <span className="font-mono font-medium">{code}</span>
                            <span className="text-muted-foreground">
                              {(confidence * 100).toFixed(0)}%
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Raw JSON */}
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    View Raw JSON
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-4 text-xs">
                    {JSON.stringify(session.ml_advisor_output, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          )}

          {/* Quality Metrics (from unified trace) */}
          {(session.quality_scores ||
            session.field_completeness !== null ||
            session.extraction_confidence) && (
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  Quality Metrics
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-normal text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    ML Feedback Loop
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Field Completeness */}
                {session.field_completeness !== null && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Field Completeness
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full ${
                            session.field_completeness >= 0.8
                              ? 'bg-green-500'
                              : session.field_completeness >= 0.5
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${session.field_completeness * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {(session.field_completeness * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Quality Scores by Module */}
                {session.quality_scores && Object.keys(session.quality_scores).length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Module Quality Scores
                    </p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {Object.entries(session.quality_scores).map(([module, score]) => (
                        <div key={module} className="rounded-lg border p-3 text-center">
                          <p className="text-xs text-muted-foreground capitalize">
                            {module.replace(/_/g, ' ')}
                          </p>
                          <p
                            className={`text-lg font-bold ${
                              score >= 0.8
                                ? 'text-green-600'
                                : score >= 0.5
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {(score * 100).toFixed(0)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extraction Confidence */}
                {session.extraction_confidence &&
                  Object.keys(session.extraction_confidence).length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-muted-foreground">
                        Extraction Confidence by Field
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(session.extraction_confidence).map(
                          ([field, confidence]) => (
                            <span
                              key={field}
                              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                                confidence >= 0.8
                                  ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950'
                                  : confidence >= 0.5
                                    ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950'
                                    : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950'
                              }`}
                            >
                              <span className="font-medium">{field.replace(/_/g, ' ')}</span>
                              <span className="text-muted-foreground">
                                {(confidence * 100).toFixed(0)}%
                              </span>
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {/* Unified Trace Details */}
                {session.unified_trace && (
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      View Trace Details
                    </summary>
                    <div className="mt-2 space-y-2">
                      {session.unified_trace.error_attribution && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Error Attribution: {String(session.unified_trace.error_attribution)}
                          </p>
                          {session.unified_trace.root_cause && (
                            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                              {String(session.unified_trace.root_cause)}
                            </p>
                          )}
                        </div>
                      )}
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-4 text-xs">
                        {JSON.stringify(session.unified_trace, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
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

  // Format registry output for CSV
  const formatRegistryOutput = (data: Record<string, unknown> | null): string => {
    if (!data || typeof data !== 'object') return ''
    const record = (data.record as Record<string, unknown>) || {}
    const lines: string[] = []

    // Format field name
    const formatFieldName = (field: string): string => {
      return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    // Format value
    const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      if (Array.isArray(value)) {
        if (value.length === 0) return ''
        // Handle EBUS stations array
        if (value.length > 0 && typeof value[0] === 'object') {
          return value
            .map(
              (station: Record<string, unknown>) =>
                `Station: ${station.station || ''}, Size: ${station.size_mm || ''}mm, Passes: ${station.passes || ''}, ROSE: ${station.rose_result || ''}`,
            )
            .join('; ')
        }
        return value.join(', ')
      }
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    }

    // Get all fields with values
    Object.entries(record).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value) && value.length === 0) return
        lines.push(`${formatFieldName(key)}: ${formatValue(value)}`)
      }
    })

    return lines.join('\n')
  }

  // Format coder output for CSV
  const formatCoderOutput = (data: Record<string, unknown> | null): string => {
    if (!data || typeof data !== 'object') return ''
    const lines: string[] = []

    const codes = (data.codes as Array<Record<string, unknown>>) || []
    const totalRvu = data.total_work_rvu as number | undefined
    const estimatedPayment = data.estimated_payment as number | undefined
    const bundledCodes = (data.bundled_codes as Array<Record<string, unknown>>) || []

    if (totalRvu !== undefined) {
      lines.push(`Total Work RVU: ${totalRvu.toFixed(2)}`)
    }
    if (estimatedPayment !== undefined) {
      lines.push(`Estimated Payment: $${estimatedPayment.toFixed(2)}`)
    }

    if (codes.length > 0) {
      lines.push('\nCPT Codes:')
      codes.forEach((code) => {
        const codeStr = String(code.cpt || '')
        const desc = String(code.description || '')
        const modifiers =
          Array.isArray(code.modifiers) && code.modifiers.length > 0
            ? code.modifiers.join(', ')
            : ''
        const rvu = (code.rvu_data as Record<string, unknown>)?.work_rvu?.toString() || ''
        lines.push(
          `  ${codeStr} - ${desc}${modifiers ? ` (Modifiers: ${modifiers})` : ''}${rvu ? ` [RVU: ${rvu}]` : ''}`,
        )
      })
    }

    if (bundledCodes.length > 0) {
      lines.push('\nBundled Codes:')
      bundledCodes.forEach((bundle) => {
        const bundled = String(bundle.bundled_cpt || '')
        const dominant = String(bundle.dominant_cpt || '')
        const reason = bundle.reason ? ` (${bundle.reason})` : ''
        lines.push(`  ${bundled} bundled into ${dominant}${reason}`)
      })
    }

    return lines.join('\n')
  }

  // Format reporter output for CSV
  const formatReporterOutput = (data: Record<string, unknown> | null): string => {
    if (!data || typeof data !== 'object') return ''
    const lines: string[] = []

    // If it's a markdown report, include it
    if (data.markdown && typeof data.markdown === 'string') {
      lines.push('Report (Markdown):')
      lines.push(data.markdown)
    }

    // Include other fields
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'markdown') return // Already included
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'object') {
          lines.push(`${key}: ${JSON.stringify(value)}`)
        } else {
          lines.push(`${key}: ${value}`)
        }
      }
    })

    return lines.join('\n')
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
      'Reporter Output (Formatted)',
      'Reporter Output (JSON)',
      'Coder Output (Formatted)',
      'Coder Output (JSON)',
      'Registry Output (Formatted)',
      'Registry Output (JSON)',
      'ML Advisor Final Codes',
      'ML Advisor Disagreements',
      'ML Advisor Explanation',
      'ML Advisor Output (JSON)',
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
      formatReporterOutput(session.reporter_output),
      session.reporter_output ? JSON.stringify(session.reporter_output) : '',
      formatCoderOutput(session.coder_output),
      session.coder_output ? JSON.stringify(session.coder_output) : '',
      formatRegistryOutput(session.registry_output),
      session.registry_output ? JSON.stringify(session.registry_output) : '',
      // ML Advisor columns
      session.ml_advisor_output?.final_codes
        ? (session.ml_advisor_output.final_codes as string[]).join(', ')
        : '',
      session.ml_advisor_output?.disagreements
        ? (session.ml_advisor_output.disagreements as string[]).join(', ')
        : '',
      session.ml_advisor_output?.advisor_explanation
        ? String(session.ml_advisor_output.advisor_explanation)
        : '',
      session.ml_advisor_output ? JSON.stringify(session.ml_advisor_output) : '',
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
