'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Trash2, Download } from 'lucide-react'

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

type Session = {
  id: string
  created_at: string
  modules_run: string
  quality_rating: number | null
  safe_to_use: boolean | null
  error_categories: string[] | null
  tester_name: string | null
  model_backend: string | null
  model_version: string | null
  procedure_type: string | null
  note_text: string | null
  unified_output: UnifiedOutput | null
  free_text_feedback: string | null
  // Legacy fields for backward compatibility
  reporter_output?: Record<string, unknown> | null
  coder_output?: Record<string, unknown> | null
  registry_output?: Record<string, unknown> | null
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

          {/* Unified Output */}
          {session.unified_output && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  Unified Output
                  <Badge variant="outline">{session.unified_output.pipeline_mode}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quality Indicators */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      session.unified_output.coder_difficulty === 'HIGH_CONF'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {session.unified_output.coder_difficulty || 'Unknown'} Confidence
                  </Badge>
                  {session.unified_output.needs_manual_review && (
                    <Badge variant="destructive">Manual Review Required</Badge>
                  )}
                  {session.unified_output.total_work_rvu && (
                    <Badge variant="outline">
                      {session.unified_output.total_work_rvu.toFixed(2)} RVU
                    </Badge>
                  )}
                  {session.unified_output.estimated_payment && (
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                      ${session.unified_output.estimated_payment.toFixed(2)}
                    </Badge>
                  )}
                </div>

                {/* CPT Codes */}
                {session.unified_output.suggestions.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Derived CPT Codes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {session.unified_output.suggestions.map((suggestion, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm"
                        >
                          <span className="font-mono font-medium">{suggestion.code}</span>
                          <span className="text-muted-foreground text-xs">
                            {suggestion.description.slice(0, 30)}...
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Warnings */}
                {session.unified_output.audit_warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Audit Warnings
                    </p>
                    <ul className="mt-1 list-disc list-inside text-sm text-amber-700 dark:text-amber-300">
                      {session.unified_output.audit_warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Registry Summary */}
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    View Registry Fields ({Object.keys(session.unified_output.registry).length}{' '}
                    fields)
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-4 text-xs">
                    {JSON.stringify(session.unified_output.registry, null, 2)}
                  </pre>
                </details>

                {/* Full JSON */}
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    View Full JSON
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-4 text-xs">
                    {JSON.stringify(session.unified_output, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          )}

          {/* Legacy outputs for backward compatibility */}
          {!session.unified_output && session.registry_output && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registry Output (Legacy)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded bg-muted p-4 text-xs">
                  {JSON.stringify(session.registry_output, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {!session.unified_output && session.coder_output && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Coder Output (Legacy)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded bg-muted p-4 text-xs">
                  {JSON.stringify(session.coder_output, null, 2)}
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

  // Format unified output for CSV
  const formatUnifiedOutput = (data: UnifiedOutput | null): string => {
    if (!data) return ''
    const lines: string[] = []

    // Summary
    lines.push(`Pipeline: ${data.pipeline_mode}`)
    lines.push(`Coder Difficulty: ${data.coder_difficulty}`)
    lines.push(`Needs Manual Review: ${data.needs_manual_review ? 'Yes' : 'No'}`)
    if (data.total_work_rvu) lines.push(`Total Work RVU: ${data.total_work_rvu.toFixed(2)}`)
    if (data.estimated_payment)
      lines.push(`Estimated Payment: $${data.estimated_payment.toFixed(2)}`)

    // CPT Codes
    if (data.suggestions.length > 0) {
      lines.push('\nDerived CPT Codes:')
      data.suggestions.forEach((s) => {
        lines.push(`  ${s.code} - ${s.description} (${s.review_flag})`)
        if (s.rationale) lines.push(`    Rationale: ${s.rationale}`)
      })
    }

    // Audit Warnings
    if (data.audit_warnings.length > 0) {
      lines.push('\nAudit Warnings:')
      data.audit_warnings.forEach((w) => lines.push(`  - ${w}`))
    }

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
      'Unified Output (Formatted)',
      'Unified Output (JSON)',
      'CPT Codes',
      'Total Work RVU',
      'Estimated Payment',
      'Coder Difficulty',
      'Needs Manual Review',
      'Audit Warnings',
      'Quality Rating',
      'Safe to Use',
      'Error Categories',
      'Free Text Feedback',
      'Model Backend',
      'Model Version',
    ]

    // Build CSV rows
    const rows = selectedSessions.map((session) => [
      session.id,
      session.created_at,
      session.tester_name || '',
      session.modules_run,
      session.procedure_type || '',
      session.note_text || '',
      formatUnifiedOutput(session.unified_output),
      session.unified_output ? JSON.stringify(session.unified_output) : '',
      session.unified_output?.cpt_codes?.join(', ') || '',
      session.unified_output?.total_work_rvu?.toString() || '',
      session.unified_output?.estimated_payment?.toString() || '',
      session.unified_output?.coder_difficulty || '',
      session.unified_output?.needs_manual_review ? 'Yes' : 'No',
      session.unified_output?.audit_warnings?.join('; ') || '',
      session.quality_rating?.toString() || '',
      session.safe_to_use?.toString() || '',
      session.error_categories?.join('; ') || '',
      session.free_text_feedback || '',
      session.model_backend || '',
      session.model_version || '',
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
      `Are you sure you want to delete ${selectedIds.size} session(s)? This action cannot be undone.`,
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

      setSessions(sessions.filter((s) => !selectedIds.has(s.id)))
      setSelectedIds(new Set())

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
                Latest 100 QA test sessions - Select sessions to export or delete
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
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="text-sm font-medium">
                            {new Date(session.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Type</p>
                          <p className="text-sm font-medium">{session.procedure_type || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">CPT Codes</p>
                          <p className="text-sm font-medium">
                            {session.unified_output?.cpt_codes?.length || 0}
                          </p>
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
                          <p className="text-xs text-muted-foreground">Tester</p>
                          <p className="text-sm font-medium">{session.tester_name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <p className="text-sm font-medium">
                            {session.unified_output?.coder_difficulty || '—'}
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
