'use client'

import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type CodeSuggestion = {
  code: string
  description: string
  confidence: number
  rationale: string
  review_flag: string
}

type PerCodeBilling = {
  cpt_code: string
  description: string
  work_rvu: number
  total_facility_rvu: number
  facility_payment: number
}

type UnifiedOutput = {
  registry: Record<string, unknown>
  cpt_codes: string[]
  suggestions: CodeSuggestion[]
  total_work_rvu?: number
  estimated_payment?: number
  per_code_billing?: PerCodeBilling[]
  coder_difficulty: string
  needs_manual_review: boolean
  audit_warnings: string[]
  validation_errors: string[]
  pipeline_mode: string
  kb_version: string
  processing_time_ms: number
}

type RunResponse = {
  sessionId?: string
  unifiedOutput?: UnifiedOutput
  error?: string
}

const ERROR_CATEGORIES = [
  { id: 'missing_field', label: 'Missing Registry Field' },
  { id: 'wrong_extraction', label: 'Wrong Extraction' },
  { id: 'wrong_classification', label: 'Wrong Classification' },
  { id: 'missing_cpt', label: 'Missing CPT Code' },
  { id: 'extra_cpt', label: 'Extra CPT Code' },
  { id: 'wrong_derivation', label: 'Wrong CPT Derivation' },
]

// Helper to render a key-value row
function DataRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null

  return (
    <div className="flex border-b border-border py-2 last:border-0">
      <span className="w-1/3 shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

// Format field names for display
function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Nested schema field mapping
const NESTED_SCHEMA_CATEGORIES: Record<string, { label: string; excludeFields?: string[] }> = {
  patient_demographics: { label: 'Patient Information' },
  providers: { label: 'Providers' },
  clinical_context: { label: 'Clinical Context' },
  sedation: { label: 'Sedation' },
  equipment: { label: 'Equipment' },
  procedures_performed: { label: 'Procedures Performed' },
  pleural_procedures: { label: 'Pleural Procedures' },
  specimens: { label: 'Specimens' },
  complications: { label: 'Complications' },
  outcomes: { label: 'Outcomes' },
  billing: { label: 'Billing' },
  metadata: { label: 'Metadata', excludeFields: ['version'] },
}

// Helper to check if a value is meaningful
function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (value === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).some((v) => isNonEmpty(v))
  }
  return true
}

// Render a value appropriately based on type
function renderValue(field: string, value: unknown, depth = 0): ReactNode {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    if (value.every((v) => typeof v !== 'object')) {
      return value.map((v) => String(v)).join(', ')
    }
    return (
      <div className="space-y-2">
        {value.map((item, idx) => (
          <div key={idx} className="rounded border bg-muted/30 p-2 text-sm">
            {typeof item === 'object' && item !== null
              ? Object.entries(item)
                  .filter(([, v]) => isNonEmpty(v))
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="font-medium text-muted-foreground">
                        {formatFieldName(k)}:
                      </span>
                      <span>{renderValue(k, v, depth + 1)}</span>
                    </div>
                  ))
              : String(item)}
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).filter(([, v]) => isNonEmpty(v))
    if (entries.length === 0) return null
    if (depth > 1) return JSON.stringify(value)
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-sm">
            <span className="font-medium text-muted-foreground">{formatFieldName(k)}:</span>
            <span>{renderValue(k, v, depth + 1)}</span>
          </div>
        ))}
      </div>
    )
  }
  return String(value)
}

// Registry section display
function RegistrySection({ data }: { data: Record<string, unknown> }) {
  const isNestedSchema = Object.keys(NESTED_SCHEMA_CATEGORIES).some(
    (key) => data[key] && typeof data[key] === 'object' && !Array.isArray(data[key]),
  )

  const renderNestedCategory = (
    categoryKey: string,
    label: string,
    excludeFields: string[] = [],
  ) => {
    const categoryData = data[categoryKey] as Record<string, unknown> | undefined
    if (!categoryData || typeof categoryData !== 'object') return null

    const entries = Object.entries(categoryData).filter(
      ([key, value]) => !excludeFields.includes(key) && isNonEmpty(value),
    )
    if (entries.length === 0) return null

    return (
      <div key={categoryKey}>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
          <Badge variant="outline" className="text-xs font-normal normal-case">
            {entries.length} field{entries.length > 1 ? 's' : ''}
          </Badge>
        </h4>
        <div className="rounded-lg border bg-card p-4 space-y-3">
          {entries.map(([field, value]) => (
            <DataRow key={field} label={formatFieldName(field)} value={renderValue(field, value)} />
          ))}
        </div>
      </div>
    )
  }

  if (isNestedSchema) {
    return (
      <div className="space-y-6">
        {/* Top-level flat fields */}
        {(() => {
          const topLevelFields = Object.entries(data).filter(([key, value]) => {
            if (Object.keys(NESTED_SCHEMA_CATEGORIES).includes(key)) return false
            if (key === 'evidence' || key === 'version') return false
            return isNonEmpty(value) && typeof value !== 'object'
          })
          if (topLevelFields.length === 0) return null

          return (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Indication & Diagnosis
                <Badge variant="outline" className="text-xs font-normal normal-case">
                  {topLevelFields.length} field{topLevelFields.length > 1 ? 's' : ''}
                </Badge>
              </h4>
              <div className="rounded-lg border bg-card p-4 space-y-3">
                {topLevelFields.map(([field, value]) => (
                  <DataRow
                    key={field}
                    label={formatFieldName(field)}
                    value={renderValue(field, value)}
                  />
                ))}
              </div>
            </div>
          )
        })()}

        {/* Nested schema categories */}
        {Object.entries(NESTED_SCHEMA_CATEGORIES).map(([key, { label, excludeFields }]) =>
          renderNestedCategory(key, label, excludeFields),
        )}
      </div>
    )
  }

  // Flat schema fallback
  const flatFields = Object.entries(data).filter(
    ([key, value]) => key !== 'evidence' && key !== 'version' && isNonEmpty(value),
  )

  return (
    <div className="space-y-3">
      {flatFields.map(([field, value]) => (
        <DataRow key={field} label={formatFieldName(field)} value={renderValue(field, value)} />
      ))}
    </div>
  )
}

// CPT Codes section display
function CPTCodesSection({ data }: { data: UnifiedOutput }) {
  const {
    suggestions,
    total_work_rvu,
    estimated_payment,
    per_code_billing,
    audit_warnings,
    coder_difficulty,
    needs_manual_review,
  } = data

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{suggestions.length}</p>
          <p className="text-sm text-muted-foreground">CPT Codes</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{total_work_rvu?.toFixed(2) || '—'}</p>
          <p className="text-sm text-muted-foreground">Total Work RVU</p>
        </div>
      </div>

      {estimated_payment && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            ${estimated_payment.toFixed(2)}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">Estimated Payment</p>
        </div>
      )}

      {/* Quality Indicators */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={coder_difficulty === 'HIGH_CONF' ? 'default' : 'secondary'}>
          {coder_difficulty || 'Unknown'} Confidence
        </Badge>
        {needs_manual_review && <Badge variant="destructive">Manual Review Required</Badge>}
      </div>

      {/* Audit Warnings */}
      {audit_warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">Audit Warnings</p>
          <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300">
            {audit_warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* CPT Codes Table */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Derived CPT Codes
        </h4>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-2 text-right text-sm font-medium">RVU</th>
                <th className="px-4 py-2 text-right text-sm font-medium">Payment</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {suggestions.map((suggestion, idx) => {
                const billing = per_code_billing?.find((b) => b.cpt_code === suggestion.code)
                return (
                  <tr key={idx} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono">
                        {suggestion.code}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{suggestion.description}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      {billing?.work_rvu?.toFixed(2) || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {billing?.facility_payment ? `$${billing.facility_payment.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge
                        variant={
                          suggestion.review_flag === 'required'
                            ? 'destructive'
                            : suggestion.review_flag === 'recommended'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="text-xs"
                      >
                        {suggestion.review_flag}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
              {suggestions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No CPT codes derived
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rationales */}
      {suggestions.some((s) => s.rationale) && (
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Derivation Rationales
          </h4>
          <div className="space-y-2">
            {suggestions
              .filter((s) => s.rationale)
              .map((suggestion, idx) => (
                <div key={idx} className="rounded-lg border bg-muted/30 p-3">
                  <span className="font-mono font-medium">{suggestion.code}</span>
                  <span className="text-muted-foreground"> — </span>
                  <span className="text-sm">{suggestion.rationale}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Unified Output Display
function UnifiedOutputDisplay({ data }: { data: UnifiedOutput }) {
  return (
    <div className="space-y-8">
      {/* Registry Extraction Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
          Registry Extraction
          <Badge variant="outline">Extraction-First</Badge>
        </h3>
        <RegistrySection data={data.registry} />
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* CPT Codes Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
          Derived CPT Codes
          <Badge variant="outline">Deterministic</Badge>
        </h3>
        <CPTCodesSection data={data} />
      </div>

      {/* Processing Info */}
      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
        <span>Pipeline: {data.pipeline_mode}</span>
        <span>KB Version: {data.kb_version}</span>
        <span>Processing Time: {data.processing_time_ms.toFixed(0)}ms</span>
      </div>

      {/* Raw JSON toggle */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          View Raw JSON (for debugging)
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-4 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default function QASandbox() {
  // Input state
  const [noteText, setNoteText] = useState('')
  const [procedureType, setProcedureType] = useState('')
  const [testerName, setTesterName] = useState('')
  const [phiConfirmed, setPhiConfirmed] = useState(false)

  // Output state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [unifiedOutput, setUnifiedOutput] = useState<UnifiedOutput | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Feedback state
  const [qualityRating, setQualityRating] = useState<number | null>(null)
  const [safeToUse, setSafeToUse] = useState<boolean | null>(null)
  const [errorCategories, setErrorCategories] = useState<string[]>([])
  const [freeTextFeedback, setFreeTextFeedback] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  const handleRun = async () => {
    if (!phiConfirmed) {
      setError('Please confirm you are not entering PHI')
      return
    }

    setLoading(true)
    setError(null)
    setSessionId(null)
    setUnifiedOutput(null)
    setFeedbackSubmitted(false)

    try {
      const res = await fetch('/api/qa/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteText,
          procedureType: procedureType || undefined,
          testerName: testerName.trim(),
        }),
      })

      let data: RunResponse | null = null
      try {
        data = await res.json()
      } catch {
        data = null
      }

      if (!res.ok) {
        const baseMessage = data?.error || 'Failed to run'
        const hint = res.status >= 500 ? ' Retry extraction or switch to manual mode.' : ''
        throw new Error(`${baseMessage}${hint}`)
      }

      if (!data) {
        throw new Error('Failed to parse response')
      }

      setSessionId(data.sessionId ?? null)
      setUnifiedOutput(data.unifiedOutput ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleFeedbackSubmit = async () => {
    if (!sessionId) return

    try {
      const res = await fetch('/api/qa/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          qualityRating,
          safeToUse,
          errorCategories,
          freeTextFeedback: freeTextFeedback || undefined,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to submit feedback')
      }

      setFeedbackSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    }
  }

  const toggleErrorCategory = (id: string) => {
    setErrorCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* PHI Warning Banner */}
      <div className="mb-6 rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-950">
        <p className="font-bold text-yellow-800 dark:text-yellow-200">
          Warning: QA Sandbox - No PHI
        </p>
        <p className="text-yellow-700 dark:text-yellow-300">
          Use de-identified or synthetic notes only. Do not enter real patient data.
        </p>
      </div>

      <h1 className="mb-6 text-2xl font-bold">Procedure Suite QA Sandbox</h1>
      <p className="mb-6 text-muted-foreground">
        Unified extraction-first pipeline: Registry extraction followed by deterministic CPT code
        derivation.
      </p>

      {/* Input Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Input</CardTitle>
          <CardDescription>Enter a procedure note for testing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block font-medium">
              Procedure Note (de-identified/synthetic)
            </label>
            <Textarea
              className="min-h-40"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Paste procedure note here..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block font-medium">Procedure Type (optional)</label>
              <Input
                value={procedureType}
                onChange={(e) => setProcedureType(e.target.value)}
                placeholder="e.g., EBUS, rigid, flex"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Tester Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={testerName}
                onChange={(e) => setTesterName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="phi-confirm"
              checked={phiConfirmed}
              onCheckedChange={(checked) => setPhiConfirmed(checked === true)}
            />
            <label htmlFor="phi-confirm" className="cursor-pointer">
              I confirm I am NOT entering PHI (protected health information)
            </label>
          </div>

          <Button
            onClick={handleRun}
            disabled={loading || !noteText || !phiConfirmed || !testerName.trim()}
          >
            {loading ? 'Running...' : 'Run Unified Extraction'}
          </Button>

          {error && <p className="mt-2 text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* Output Section */}
      {unifiedOutput && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Unified Output</CardTitle>
            <CardDescription>Registry extraction with derived CPT codes</CardDescription>
          </CardHeader>
          <CardContent>
            <UnifiedOutputDisplay data={unifiedOutput} />
          </CardContent>
        </Card>
      )}

      {/* Feedback Section */}
      {sessionId && !feedbackSubmitted && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Feedback</CardTitle>
            <CardDescription>Help improve the system by providing feedback</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block font-medium">Overall Quality (1-5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    variant={qualityRating === n ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQualityRating(n)}
                    className="h-10 w-10"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block font-medium">Would you sign off on this output?</label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={safeToUse === true}
                    onChange={() => setSafeToUse(true)}
                    className="h-4 w-4"
                  />
                  Yes
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={safeToUse === false}
                    onChange={() => setSafeToUse(false)}
                    className="h-4 w-4"
                  />
                  No
                </label>
              </div>
            </div>

            <div>
              <label className="mb-2 block font-medium">Error Categories</label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {ERROR_CATEGORIES.map((cat) => (
                  <label key={cat.id} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={errorCategories.includes(cat.id)}
                      onCheckedChange={() => toggleErrorCategory(cat.id)}
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block font-medium">Additional Feedback</label>
              <Textarea
                value={freeTextFeedback}
                onChange={(e) => setFreeTextFeedback(e.target.value)}
                placeholder="Describe any issues or suggestions..."
                className="min-h-24"
              />
            </div>

            <Button onClick={handleFeedbackSubmit} variant="secondary">
              Submit Feedback
            </Button>
          </CardContent>
        </Card>
      )}

      {feedbackSubmitted && (
        <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4 dark:bg-green-950">
          <p className="text-green-800 dark:text-green-200">Feedback submitted successfully!</p>
        </div>
      )}
    </div>
  )
}
