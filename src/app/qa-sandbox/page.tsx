'use client'

import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

type ModulesRun = 'reporter' | 'coder' | 'registry'

const ERROR_CATEGORIES = {
  reporter: [
    { id: 'missing_key_findings', label: 'Missing Key Findings' },
    { id: 'misstated_findings', label: 'Misstated Findings' },
    { id: 'wrong_structure', label: 'Wrong Structure' },
    { id: 'tone_wording', label: 'Tone/Wording Issues' },
  ],
  coder: [
    { id: 'missing_cpt', label: 'Missing CPT' },
    { id: 'extra_cpt', label: 'Extra CPT' },
    { id: 'wrong_cpt', label: 'Wrong CPT' },
    { id: 'modifiers_wrong', label: 'Modifiers Wrong' },
  ],
  registry: [
    { id: 'missing_field', label: 'Missing Field' },
    { id: 'wrong_extraction', label: 'Wrong Extraction' },
    { id: 'wrong_classification', label: 'Wrong Classification' },
  ],
}

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

// Registry field categories - organized by clinical domain
const REGISTRY_FIELD_CATEGORIES: Record<string, { label: string; fields: string[] }> = {
  patient: {
    label: 'Patient Information',
    fields: ['patient_mrn', 'patient_age', 'gender'],
  },
  encounter: {
    label: 'Encounter Details',
    fields: ['procedure_date', 'institution_name', 'procedure_setting', 'disposition'],
  },
  providers: {
    label: 'Providers',
    fields: [
      'attending_name',
      'fellow_name',
      'assistant_name',
      'assistant_role',
      'provider_role',
      'trainee_present',
    ],
  },
  clinical: {
    label: 'Clinical Assessment',
    fields: [
      'asa_class',
      'anticoag_status',
      'anticoag_held_preprocedure',
      'sedation_type',
      'anesthesia_agents',
    ],
  },
  indication: {
    label: 'Indication & Diagnosis',
    fields: [
      'primary_indication',
      'radiographic_findings',
      'bronch_indication',
      'final_diagnosis_prelim',
      'procedure_families',
    ],
  },
  ebus: {
    label: 'EBUS Details',
    fields: [
      'linear_ebus_performed',
      'linear_ebus_stations',
      'ebus_stations_sampled',
      'ebus_stations_detail',
      'ebus_rose_result',
      'ebus_photodocumentation_complete',
    ],
  },
  bronchoscopy: {
    label: 'Bronchoscopy Details',
    fields: [
      'bronch_location_lobe',
      'bronch_location_segment',
      'bronch_guidance',
      'bronch_num_tbbx',
      'bronch_tbbx_tool',
      'bronch_specimen_tests',
      'bronch_biopsy_sites',
    ],
  },
  navigation: {
    label: 'Navigation Bronchoscopy',
    fields: [
      'nav_platform',
      'nav_registration_method',
      'nav_registration_error_mm',
      'nav_rebus_used',
      'nav_rebus_view',
      'nav_imaging_verification',
      'nav_tool_in_lesion',
      'nav_sampling_tools',
      'nav_cryobiopsy_for_nodule',
    ],
  },
  cao: {
    label: 'Central Airway Obstruction',
    fields: [
      'cao_primary_modality',
      'cao_tumor_location',
      'cao_obstruction_pre_pct',
      'cao_obstruction_post_pct',
      'cao_interventions',
    ],
  },
  stent: {
    label: 'Stent Placement',
    fields: [
      'stent_type',
      'stent_deployment_method',
      'stent_diameter_mm',
      'stent_length_mm',
      'stent_location',
    ],
  },
  blvr: {
    label: 'BLVR (Valve Therapy)',
    fields: [
      'blvr_target_lobe',
      'blvr_cv_assessment_method',
      'blvr_chartis_result',
      'blvr_valve_type',
      'blvr_number_of_valves',
    ],
  },
  wll: {
    label: 'Whole Lung Lavage',
    fields: ['wll_volume_instilled_l', 'wll_volume_returned_l', 'wll_dlt_used'],
  },
  foreign_body: {
    label: 'Foreign Body Removal',
    fields: ['fb_object_type', 'fb_tool_used', 'fb_removal_success'],
  },
  thermoplasty: {
    label: 'Bronchial Thermoplasty',
    fields: ['bt_lobe_treated', 'bt_activation_count'],
  },
  ablation: {
    label: 'Ablation',
    fields: [
      'ablation_peripheral_performed',
      'ablation_modality',
      'ablation_device_name',
      'ablation_power_watts',
      'ablation_duration_seconds',
      'ablation_max_temp_c',
      'ablation_margin_assessed',
      'ablation_complication_immediate',
    ],
  },
  pleural: {
    label: 'Pleural Procedures',
    fields: [
      'pleural_procedure_type',
      'pleural_guidance',
      'pleural_side',
      'pleural_intercostal_space',
      'pleural_opening_pressure_measured',
      'pleural_opening_pressure_cmh2o',
      'pleural_fluid_appearance',
      'pleural_volume_drained_ml',
      'pleural_thoracoscopy_findings',
      'pleurodesis_performed',
      'pleurodesis_agent',
    ],
  },
  complications: {
    label: 'Complications',
    fields: [
      'bronch_immediate_complications',
      'ebl_ml',
      'bleeding_severity',
      'pneumothorax',
      'pneumothorax_intervention',
      'hypoxia_respiratory_failure',
    ],
  },
  radiation: {
    label: 'Radiation & Fluoroscopy',
    fields: ['fluoro_time_min', 'radiation_dap_gycm2'],
  },
  followup: {
    label: 'Follow-up & Plan',
    fields: ['molecular_testing_requested', 'follow_up_plan'],
  },
}

// Registry Output Component
function formatEbusStationDetails(stations: Array<Record<string, unknown>>): ReactNode {
  if (!stations.length) return '—'

  return (
    <ul className="space-y-1">
      {stations.map((s, idx) => {
        const station = s.station ?? '—'
        const parts: string[] = []
        if (s.size_mm !== null && s.size_mm !== undefined) parts.push(`size ${s.size_mm} mm`)
        if (s.passes !== null && s.passes !== undefined) parts.push(`${s.passes} passes`)
        if (s.rose_result) parts.push(`ROSE: ${s.rose_result}`)
        if (s.shape) parts.push(`shape: ${s.shape}`)
        if (s.margin) parts.push(`margin: ${s.margin}`)
        if (s.echogenicity) parts.push(`echo: ${s.echogenicity}`)
        if (s.chs_present !== null && s.chs_present !== undefined) {
          parts.push(`CHS: ${s.chs_present ? 'present' : 'absent'}`)
        }
        const detail = parts.length ? parts.join('; ') : 'no details'
        return (
          <li key={`${station}-${idx}`}>
            <span className="font-medium">{String(station)}</span>: {detail}
          </li>
        )
      })}
    </ul>
  )
}

function deriveRoseSummary(
  stations: Array<Record<string, unknown>> | undefined,
  globalRose: unknown,
): string | ReactNode {
  const withRose = (stations || []).filter((s) => s.rose_result)
  if (!withRose.length) return typeof globalRose === 'string' ? globalRose : '—'
  const unique = Array.from(new Set(withRose.map((s) => String(s.rose_result))))
  if (unique.length === 1) return unique[0]
  return (
    <span>Mixed ({withRose.map((s) => `${s.station || '?'}: ${s.rose_result}`).join(', ')})</span>
  )
}

function RegistryOutputDisplay({ data }: { data: Record<string, unknown> }) {
  const record = (data?.record as Record<string, unknown>) || {}

  // Get all non-null fields from a category
  const getCategoryFields = (fields: string[]) => {
    return fields
      .map((f) => ({ field: f, value: record[f] }))
      .filter(({ value }) => {
        if (value === null || value === undefined) return false
        if (value === '') return false
        if (Array.isArray(value) && value.length === 0) return false
        return true
      })
  }

  // Render a value appropriately based on type
  const renderValue = (field: string, value: unknown): ReactNode => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (Array.isArray(value)) {
      if (value.length === 0) return '—'
      if (field === 'ebus_stations_detail' && typeof value[0] === 'object') {
        return formatEbusStationDetails(value as Array<Record<string, unknown>>)
      }
      return value.map((v) => String(v)).join(', ')
    }
    if (typeof value === 'object' && value !== null) return JSON.stringify(value)
    return String(value)
  }

  return (
    <div className="space-y-6">
      {/* Render each category that has data */}
      {Object.entries(REGISTRY_FIELD_CATEGORIES).map(([key, { label, fields }]) => {
        const categoryFields = getCategoryFields(fields)
        if (categoryFields.length === 0) return null

        return (
          <div key={key}>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
              <Badge variant="outline" className="text-xs font-normal normal-case">
                {categoryFields.length} field{categoryFields.length > 1 ? 's' : ''}
              </Badge>
            </h4>
            <div className="rounded-lg border bg-card p-4">
              {categoryFields.map(({ field, value }) => {
                // Special handling for EBUS station detail rendering
                if (field === 'ebus_stations_detail' && Array.isArray(value)) {
                  return (
                    <DataRow
                      key={field}
                      label={formatFieldName(field)}
                      value={renderValue(field, value)}
                    />
                  )
                }
                // Derive safer ROSE summary if station-level data exists
                if (field === 'ebus_rose_result') {
                  const stations = record['ebus_stations_detail'] as
                    | Array<Record<string, unknown>>
                    | undefined
                  return (
                    <DataRow
                      key={field}
                      label={formatFieldName(field)}
                      value={deriveRoseSummary(stations, value)}
                    />
                  )
                }
                return (
                  <DataRow
                    key={field}
                    label={formatFieldName(field)}
                    value={renderValue(field, value)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Show fields that weren't in any category */}
      {(() => {
        const allCategoryFields = Object.values(REGISTRY_FIELD_CATEGORIES).flatMap((c) => c.fields)
        const uncategorizedFields = Object.entries(record).filter(([key, value]) => {
          if (allCategoryFields.includes(key)) return false
          if (key === 'evidence' || key === 'version') return false // Skip metadata
          if (value === null || value === undefined) return false
          if (value === '') return false
          if (Array.isArray(value) && value.length === 0) return false
          return true
        })

        if (uncategorizedFields.length === 0) return null

        return (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Other Extracted Data
              <Badge variant="outline" className="text-xs font-normal normal-case">
                {uncategorizedFields.length} field{uncategorizedFields.length > 1 ? 's' : ''}
              </Badge>
            </h4>
            <div className="rounded-lg border bg-card p-4">
              {uncategorizedFields.map(([field, value]) => (
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

// Coder Output Component
function CoderOutputDisplay({
  data,
  mlAdvisorData,
}: {
  data: Record<string, unknown>
  mlAdvisorData?: Record<string, unknown> | null
}) {
  const codes = (data?.codes as Array<Record<string, unknown>>) || []
  const totalRvu = data?.total_work_rvu as number | undefined
  const estimatedPayment = data?.estimated_payment as number | undefined
  const bundledCodes = (data?.bundled_codes as Array<Record<string, unknown>>) || []

  // ML Advisor data
  const advisorSuggestions = mlAdvisorData?.advisor_suggestions as
    | Record<string, number>
    | undefined
  const advisorExplanation = mlAdvisorData?.advisor_explanation as string | undefined
  const disagreements = (mlAdvisorData?.disagreements as string[]) || []
  const finalCodes = (mlAdvisorData?.final_codes as string[]) || []

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{codes.length}</p>
          <p className="text-sm text-muted-foreground">CPT Codes</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{totalRvu?.toFixed(2) || '—'}</p>
          <p className="text-sm text-muted-foreground">Total Work RVU</p>
        </div>
      </div>

      {estimatedPayment && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            ${estimatedPayment.toFixed(2)}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">Estimated Payment</p>
        </div>
      )}

      {/* CPT Codes Table */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          CPT Codes
        </h4>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Modifiers</th>
                <th className="px-4 py-2 text-right text-sm font-medium">RVU</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {codes.map((code, idx) => (
                <tr key={idx} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="font-mono">
                      {String(code.cpt || '')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">{String(code.description || '')}</td>
                  <td className="px-4 py-3 text-sm">
                    {Array.isArray(code.modifiers) && code.modifiers.length > 0
                      ? code.modifiers.join(', ')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {(code.rvu_data as Record<string, unknown>)?.work_rvu?.toString() || '—'}
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No CPT codes generated
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bundled Codes */}
      {bundledCodes.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Bundled Codes
          </h4>
          <div className="space-y-2">
            {bundledCodes.map((bundle, idx) => (
              <div key={idx} className="rounded-lg border bg-orange-50 p-3 dark:bg-orange-950">
                <p className="text-sm">
                  <span className="font-mono font-medium">{String(bundle.bundled_cpt || '')}</span>
                  {' bundled into '}
                  <span className="font-mono font-medium">{String(bundle.dominant_cpt || '')}</span>
                </p>
                {bundle.reason ? (
                  <p className="mt-1 text-xs text-muted-foreground">{String(bundle.reason)}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ML Advisor Suggestions */}
      {mlAdvisorData && (advisorSuggestions || disagreements.length > 0) && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span>ML Advisor Analysis</span>
            <Badge variant="secondary" className="text-xs font-normal normal-case">
              Beta
            </Badge>
          </h4>

          {/* Advisor Explanation */}
          {advisorExplanation && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <p className="text-sm text-blue-800 dark:text-blue-200">{advisorExplanation}</p>
            </div>
          )}

          {/* Disagreements / Suggestions */}
          {disagreements.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">
                ML Advisor suggests reviewing:
              </p>
              <div className="flex flex-wrap gap-2">
                {disagreements.map((code, idx) => (
                  <Badge key={idx} variant="outline" className="border-amber-400 font-mono">
                    {code}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                These codes were suggested by the ML advisor but differ from the rule engine output.
                Review documentation to determine if they should be included.
              </p>
            </div>
          )}

          {/* Advisor Confidence Scores */}
          {advisorSuggestions && Object.keys(advisorSuggestions).length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Advisor Confidence Scores
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {Object.entries(advisorSuggestions).map(([code, confidence]) => (
                  <div key={code} className="flex items-center justify-between rounded border p-2">
                    <Badge variant="outline" className="font-mono">
                      {code}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {(confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final codes from hybrid result */}
          {finalCodes.length > 0 && (
            <div className="mt-4 text-xs text-muted-foreground">
              <span className="font-medium">Final codes (rules authoritative): </span>
              {finalCodes.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Raw JSON */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          View Raw JSON
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-4 text-xs">
          {JSON.stringify({ coder: data, mlAdvisor: mlAdvisorData }, null, 2)}
        </pre>
      </details>
    </div>
  )
}

// Reporter Output Component
function ReporterOutputDisplay({ data }: { data: Record<string, unknown> }) {
  const markdown = data?.markdown as string | undefined
  const procedureCore = data?.procedure_core as Record<string, unknown> | undefined

  return (
    <div className="space-y-6">
      {/* Rendered Report */}
      {markdown && (
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Generated Report
          </h4>
          <div className="rounded-lg border bg-card p-6">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{markdown}</pre>
          </div>
        </div>
      )}

      {/* Procedure Core Details */}
      {procedureCore && Object.keys(procedureCore).length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Extracted Procedure Data
          </h4>
          <div className="rounded-lg border bg-card p-4">
            {Object.entries(procedureCore).map(([key, value]) => (
              <DataRow key={key} label={formatFieldName(key)} value={value} />
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          View Raw JSON
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
  const [modulesRun, setModulesRun] = useState<ModulesRun>('registry')
  const [procedureType, setProcedureType] = useState('')
  const [testerName, setTesterName] = useState('')
  const [phiConfirmed, setPhiConfirmed] = useState(false)
  const [includeMLAdvisor, setIncludeMLAdvisor] = useState(false) // New: ML Advisor toggle

  // Output state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [reporterOutput, setReporterOutput] = useState<Record<string, unknown> | null>(null)
  const [coderOutput, setCoderOutput] = useState<Record<string, unknown> | null>(null)
  const [registryOutput, setRegistryOutput] = useState<Record<string, unknown> | null>(null)
  const [mlAdvisorOutput, setMLAdvisorOutput] = useState<Record<string, unknown> | null>(null) // New: ML Advisor output
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
    setReporterOutput(null)
    setCoderOutput(null)
    setRegistryOutput(null)
    setMLAdvisorOutput(null)
    setFeedbackSubmitted(false)

    try {
      const res = await fetch('/api/qa/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteText,
          modulesRun,
          procedureType: procedureType || undefined,
          testerName: testerName.trim(),
          includeMLAdvisor, // Available for all modules
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to run')
      }

      setSessionId(data.sessionId)
      setReporterOutput(data.reporterOutput)
      setCoderOutput(data.coderOutput)
      setRegistryOutput(data.registryOutput)
      setMLAdvisorOutput(data.mlAdvisorOutput)
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

  // Determine which tabs to show
  const availableTabs = []
  if (registryOutput) availableTabs.push('registry')
  if (reporterOutput) availableTabs.push('reporter')
  if (coderOutput) availableTabs.push('coder')

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
              <label className="mb-2 block font-medium">Modules to Run</label>
              <Select value={modulesRun} onValueChange={(v) => setModulesRun(v as ModulesRun)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registry">Registry</SelectItem>
                  <SelectItem value="reporter">Reporter</SelectItem>
                  <SelectItem value="coder">Coder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block font-medium">Procedure Type (optional)</label>
              <Input
                value={procedureType}
                onChange={(e) => setProcedureType(e.target.value)}
                placeholder="e.g., EBUS, rigid, flex"
              />
            </div>
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

          {/* ML Advisor toggle - available for all modules */}
          <div className="flex items-center space-x-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
            <Checkbox
              id="ml-advisor"
              checked={includeMLAdvisor}
              onCheckedChange={(checked) => setIncludeMLAdvisor(checked === true)}
            />
            <label htmlFor="ml-advisor" className="cursor-pointer">
              <span className="font-medium">Include ML Advisor</span>
              <Badge variant="secondary" className="ml-2 text-xs">
                Beta
              </Badge>
              <p className="text-sm text-muted-foreground">
                {modulesRun === 'coder'
                  ? 'Get AI-powered code suggestions to review alongside rule-based coding'
                  : modulesRun === 'reporter'
                    ? 'Get AI-powered extraction suggestions to improve field completeness'
                    : 'Get AI-powered validation to check registry data quality'}
              </p>
            </label>
          </div>

          <Button
            onClick={handleRun}
            disabled={loading || !noteText || !phiConfirmed || !testerName.trim()}
          >
            {loading ? 'Running...' : 'Run Procedure Suite'}
          </Button>

          {error && <p className="mt-2 text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* Output Section - Tabbed Interface */}
      {availableTabs.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Output</CardTitle>
            <CardDescription>
              Results from {availableTabs.length} module{availableTabs.length > 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={availableTabs[0]} className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-3">
                {registryOutput && <TabsTrigger value="registry">Registry</TabsTrigger>}
                {reporterOutput && <TabsTrigger value="reporter">Reporter</TabsTrigger>}
                {coderOutput && <TabsTrigger value="coder">Coder</TabsTrigger>}
              </TabsList>

              {registryOutput && (
                <TabsContent value="registry" className="mt-0">
                  <RegistryOutputDisplay data={registryOutput} />
                </TabsContent>
              )}

              {reporterOutput && (
                <TabsContent value="reporter" className="mt-0">
                  <ReporterOutputDisplay data={reporterOutput} />
                </TabsContent>
              )}

              {coderOutput && (
                <TabsContent value="coder" className="mt-0">
                  <CoderOutputDisplay data={coderOutput} mlAdvisorData={mlAdvisorOutput} />
                </TabsContent>
              )}
            </Tabs>
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
              <label className="mb-2 block font-medium">Would you sign this report as-is?</label>
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
                {modulesRun === 'registry' &&
                  ERROR_CATEGORIES.registry.map((cat) => (
                    <label key={cat.id} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={errorCategories.includes(cat.id)}
                        onCheckedChange={() => toggleErrorCategory(cat.id)}
                      />
                      {cat.label}
                    </label>
                  ))}
                {modulesRun === 'reporter' &&
                  ERROR_CATEGORIES.reporter.map((cat) => (
                    <label key={cat.id} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={errorCategories.includes(cat.id)}
                        onCheckedChange={() => toggleErrorCategory(cat.id)}
                      />
                      {cat.label}
                    </label>
                  ))}
                {modulesRun === 'coder' &&
                  ERROR_CATEGORIES.coder.map((cat) => (
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
