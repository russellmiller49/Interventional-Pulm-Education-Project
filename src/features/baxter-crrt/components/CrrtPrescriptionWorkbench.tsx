'use client'

import { useId, useState, type ChangeEvent, type CSSProperties } from 'react'

import {
  PRESCRIPTION_WORKBENCH_UNAVAILABLE_OUTPUTS,
  calculatePrescriptionWorkbench,
  type PrescriptionWorkbenchInputs,
  type PrescriptionWorkbenchResult,
  type QualitativeComparisonLevel,
  type QualitativePrePostDilutionResult,
  type SyntheticBagStream,
} from '../prescriptionWorkbenchModel'
import styles from './crrt-prescription-workbench.module.css'

type NumericInputKey =
  | 'simulatedWeightKg'
  | 'hematocritPercent'
  | 'bloodFlowMlPerMinute'
  | 'preBloodPumpMlPerHour'
  | 'dialysateMlPerHour'
  | 'preReplacementMlPerHour'
  | 'postReplacementMlPerHour'
  | 'patientFluidRemovalMlPerHour'

type NumericInputState = Readonly<Record<NumericInputKey, string>>
type WorkbenchInputErrorKey = NumericInputKey | 'syntheticBagCapacityMl'

interface NumericInputSpec {
  readonly label: string
  readonly min: number
  readonly max?: number
}

interface WorkbenchInputValidation {
  readonly inputs: PrescriptionWorkbenchInputs | null
  readonly errors: Readonly<Partial<Record<WorkbenchInputErrorKey, string>>>
  readonly invalidLabels: readonly string[]
}

interface WorkbenchCalculationAttempt {
  readonly result: PrescriptionWorkbenchResult | null
  readonly errorMessage: string | null
}

const NUMERIC_INPUT_KEYS = Object.freeze([
  'simulatedWeightKg',
  'hematocritPercent',
  'bloodFlowMlPerMinute',
  'preBloodPumpMlPerHour',
  'dialysateMlPerHour',
  'preReplacementMlPerHour',
  'postReplacementMlPerHour',
  'patientFluidRemovalMlPerHour',
] as const satisfies readonly NumericInputKey[])

const NUMERIC_INPUT_SPECS: Readonly<Record<NumericInputKey, NumericInputSpec>> = Object.freeze({
  simulatedWeightKg: Object.freeze({ label: 'Example weight', min: 0.1 }),
  hematocritPercent: Object.freeze({ label: 'Example hematocrit', min: 0, max: 99.9 }),
  bloodFlowMlPerMinute: Object.freeze({ label: 'Blood flow', min: 0 }),
  preBloodPumpMlPerHour: Object.freeze({ label: 'PBP flow', min: 0 }),
  dialysateMlPerHour: Object.freeze({ label: 'Dialysate flow', min: 0 }),
  preReplacementMlPerHour: Object.freeze({ label: 'Pre-replacement flow', min: 0 }),
  postReplacementMlPerHour: Object.freeze({ label: 'Post-replacement flow', min: 0 }),
  patientFluidRemovalMlPerHour: Object.freeze({
    label: 'Patient fluid removal (PFR)',
    min: 0,
  }),
})

const INITIAL_NUMERIC_INPUTS: NumericInputState = Object.freeze({
  simulatedWeightKg: '70',
  hematocritPercent: '30',
  bloodFlowMlPerMinute: '100',
  preBloodPumpMlPerHour: '200',
  dialysateMlPerHour: '1000',
  preReplacementMlPerHour: '300',
  postReplacementMlPerHour: '500',
  patientFluidRemovalMlPerHour: '100',
})

const BAG_STREAM_OPTIONS: readonly {
  readonly value: SyntheticBagStream
  readonly label: string
}[] = Object.freeze([
  Object.freeze({ value: 'pre-blood-pump', label: 'PBP stream' }),
  Object.freeze({ value: 'dialysate', label: 'Dialysate stream' }),
  Object.freeze({ value: 'pre-replacement', label: 'Pre-replacement stream' }),
  Object.freeze({ value: 'post-replacement', label: 'Post-replacement stream' }),
])

const SOURCE_NOTES = Object.freeze([
  Object.freeze({
    id: 'MATH-PM-001',
    text: 'PrisMax effluent-pump target expression · AW8035 manual p217 / PDF p218',
  }),
  Object.freeze({
    id: 'DOSE-PM-001',
    text: 'Weight-normalized effluent display · AW8035 manual pp219–220 / PDF pp220–221',
  }),
  Object.freeze({
    id: 'MATH-PM-003',
    text: 'Printed total-predilution relationship · AW8035 manual p218 / PDF p219',
  }),
  Object.freeze({
    id: 'MATH-PM-005',
    text: 'Plasma-flow relationship · AW8035 manual pp218–219 / PDF pp219–220',
  }),
  Object.freeze({
    id: 'MATH-PM-004 / MATH-PM-006',
    text: 'Some circuit-flow calculations remain unavailable because the references do not support one verified expression',
  }),
  Object.freeze({
    id: 'REVIEW-CKRT-CORE-2025',
    text: '2025 CKRT Core Curriculum · clinical context source',
  }),
  Object.freeze({
    id: 'GUID-RRT-ICU-2026',
    text: '2026 multidisciplinary ICU RRT guideline · clinical context source',
  }),
  Object.freeze({
    id: 'SYNTH-LAB-PRESCRIPTION-001',
    text: 'Practice values and arithmetic boundaries for the prescription workbench',
  }),
  Object.freeze({
    id: 'SYNTH-LAB-PREPOST-001',
    text: 'Qualitative comparison rules for the pre/post replacement-flow exercise',
  }),
])

interface NumberControlProps {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly value: string
  readonly min: number
  readonly max?: number
  readonly step: number
  readonly unit: string
  readonly error: string | null
  readonly onChange: (value: string) => void
}

function NumberControl({
  id,
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  error,
  onChange,
}: NumberControlProps) {
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.currentTarget.value)
  }

  return (
    <div className={styles.numberControl}>
      <label htmlFor={id}>
        <span>{label}</span>
        <small>{unit}</small>
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
        aria-errormessage={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
        onChange={handleChange}
      />
      <small id={descriptionId}>{description}</small>
      {error ? (
        <small id={errorId} className={styles.inputError}>
          {error}
        </small>
      ) : null}
    </div>
  )
}

interface OutputMetricProps {
  readonly label: string
  readonly value: string
  readonly source: string
  readonly note: string
}

function OutputMetric({ label, value, source, note }: OutputMetricProps) {
  return (
    <div className={styles.outputMetric}>
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        <span>{source}</span>
        <small>{note}</small>
      </dd>
    </div>
  )
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString(undefined, { maximumFractionDigits })
}

function formatPercentageFraction(value: number | null): string {
  return value === null
    ? 'Unavailable — no entered pre-flow denominator'
    : `${(value * 100).toFixed(1)}%`
}

function validateNumericText(value: string, spec: NumericInputSpec): string | null {
  if (value.trim() === '') return `${spec.label} is required.`

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `${spec.label} must be a finite number.`
  if (parsed < spec.min) return `${spec.label} must be at least ${spec.min}.`
  if (spec.max !== undefined && parsed > spec.max) {
    return `${spec.label} must be at most ${spec.max}.`
  }
  return null
}

function validateWorkbenchInputs(
  numericInputs: NumericInputState,
  syntheticBagCapacity: string,
  syntheticBagStream: SyntheticBagStream,
): WorkbenchInputValidation {
  const errors: Partial<Record<WorkbenchInputErrorKey, string>> = {}

  for (const key of NUMERIC_INPUT_KEYS) {
    const error = validateNumericText(numericInputs[key], NUMERIC_INPUT_SPECS[key])
    if (error) errors[key] = error
  }

  const trimmedBagCapacity = syntheticBagCapacity.trim()
  if (trimmedBagCapacity !== '') {
    const parsedBagCapacity = Number(trimmedBagCapacity)
    if (!Number.isFinite(parsedBagCapacity)) {
      errors.syntheticBagCapacityMl = 'Practice bag capacity must be a finite number.'
    } else if (parsedBagCapacity <= 0) {
      errors.syntheticBagCapacityMl = 'Practice bag capacity must be greater than zero.'
    }
  }

  const invalidLabels = Object.keys(errors).map((key) =>
    key === 'syntheticBagCapacityMl'
      ? 'Practice bag capacity'
      : NUMERIC_INPUT_SPECS[key as NumericInputKey].label,
  )
  if (invalidLabels.length > 0) {
    return Object.freeze({
      inputs: null,
      errors: Object.freeze(errors),
      invalidLabels: Object.freeze(invalidLabels),
    })
  }

  return Object.freeze({
    inputs: Object.freeze({
      simulatedWeightKg: Number(numericInputs.simulatedWeightKg),
      hematocritPercent: Number(numericInputs.hematocritPercent),
      bloodFlowMlPerMinute: Number(numericInputs.bloodFlowMlPerMinute),
      preBloodPumpMlPerHour: Number(numericInputs.preBloodPumpMlPerHour),
      dialysateMlPerHour: Number(numericInputs.dialysateMlPerHour),
      preReplacementMlPerHour: Number(numericInputs.preReplacementMlPerHour),
      postReplacementMlPerHour: Number(numericInputs.postReplacementMlPerHour),
      patientFluidRemovalMlPerHour: Number(numericInputs.patientFluidRemovalMlPerHour),
      anticoagulationConcept: 'none',
      solutionProfileId: null,
      syntheticBagCapacityMl: trimmedBagCapacity === '' ? null : Number(trimmedBagCapacity),
      syntheticBagStream,
    }),
    errors: Object.freeze(errors),
    invalidLabels: Object.freeze([]),
  })
}

function attemptPrescriptionWorkbenchCalculation(
  inputs: PrescriptionWorkbenchInputs,
): WorkbenchCalculationAttempt {
  try {
    return Object.freeze({
      result: calculatePrescriptionWorkbench(inputs),
      errorMessage: null,
    })
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return Object.freeze({
      result: null,
      errorMessage:
        'The entered combination exceeds a finite calculation boundary. All calculated outputs remain unavailable.',
    })
  }
}

function qualitativeLabel(level: QualitativeComparisonLevel): string {
  switch (level) {
    case 'lower':
      return 'Lower than inverse split'
    case 'middle':
      return 'Equal-split midpoint'
    case 'higher':
      return 'Higher than inverse split'
    case 'not-applicable':
      return 'Not applicable'
  }
}

export interface QualitativePrePostDilutionExperimentProps {
  readonly result: QualitativePrePostDilutionResult | null
}

export interface CrrtPrescriptionWorkbenchProps {
  readonly onPhaseChange?: (phase: 'predict' | 'act' | 'observe') => void
}

export function QualitativePrePostDilutionExperiment({
  result,
}: QualitativePrePostDilutionExperimentProps) {
  const idPrefix = useId()
  const prePercent = (result?.preReplacementShare ?? 0) * 100
  const postPercent = (result?.postReplacementShare ?? 0) * 100

  return (
    <section
      className={styles.splitExperiment}
      aria-labelledby={`${idPrefix}-heading`}
      data-quantitative-ff="unavailable"
      data-clinical-target="none"
      data-proxy-status={result?.proxyStatus ?? 'unavailable-invalid-input'}
    >
      <header>
        <div>
          <span>Qualitative companion experiment</span>
          <h3 id={`${idPrefix}-heading`}>Pre- versus post-dilution split</h3>
        </div>
        <span className={styles.pendingBadge}>Concept lab</span>
      </header>

      <p className={styles.intro}>
        Hold the entered total replacement flow in view while changing its pre/post allocation in
        the workbench. The comparisons below are unitless directional teaching aids—not device
        displays, measured concentrations, clinical targets, or patient predictions.
      </p>

      <p className={styles.conceptEquation} role="note">
        Split-position index = entered post-replacement flow ÷ entered total replacement flow. The
        three qualitative labels follow only whether the entered split is pre-dominant, equal, or
        post-dominant; no physiologic coefficient or clinical target is invented.
      </p>

      {result === null ? (
        <p className={styles.inactiveNotice}>
          Unavailable — correct every invalid entry before viewing the qualitative comparison.
        </p>
      ) : result.direction === 'not-active' ? (
        <p className={styles.inactiveNotice}>{result.comparisonText}</p>
      ) : (
        <>
          <div
            className={styles.splitBar}
            role="img"
            aria-label={`Entered replacement split: ${prePercent.toFixed(1)} percent pre-filter and ${postPercent.toFixed(1)} percent post-filter`}
            style={{ '--pre-share': `${prePercent}%` } as CSSProperties}
          >
            <span>Pre {prePercent.toFixed(1)}%</span>
            <span>Post {postPercent.toFixed(1)}%</span>
          </div>

          <dl className={styles.qualitativeGrid}>
            <div>
              <dt>Filter-inlet concentration split index</dt>
              <dd>
                <strong>{result.filterInletConcentrationSplitIndex?.toFixed(2)}</strong>
                <small>
                  Unitless 0–1 split-position index; endpoints are teaching anchors, not
                  concentrations.
                </small>
              </dd>
            </div>
            <div>
              <dt>Relative FF-burden indicator</dt>
              <dd>
                <strong>{qualitativeLabel(result.filtrationFractionBurdenProxy)}</strong>
                <small>Split-only indicator; quantitative FF is unavailable.</small>
              </dd>
            </div>
            <div>
              <dt>Relative effective-clearance indicator</dt>
              <dd>
                <strong>{qualitativeLabel(result.effectiveClearanceTendencyProxy)}</strong>
                <small>Split-only indicator; effective clearance is not calculated.</small>
              </dd>
            </div>
            <div>
              <dt>Relative fouling-burden indicator</dt>
              <dd>
                <strong>{qualitativeLabel(result.foulingTendencyProxy)}</strong>
                <small>Split-only indicator; no clotting risk or filter-life prediction.</small>
              </dd>
            </div>
          </dl>
        </>
      )}

      {result ? <p className={styles.experimentSummary}>{result.comparisonText}</p> : null}
      <p className={styles.proxyCaveat} role="note">
        <strong>Evidence context:</strong> CKRT core-curriculum and multidisciplinary ICU RRT
        guidance.{' '}
        {result?.omittedVariableCaveat ??
          'The comparison remains unavailable while one or more entries are invalid.'}
      </p>
      <p className={styles.noBestStatement} role="note">
        Neither connection position is declared universally best. The tradeoff remains dependent on
        the intended therapy, circuit, solution, patient context, and reviewed local practice.
      </p>
    </section>
  )
}

export function CrrtPrescriptionWorkbench({ onPhaseChange }: CrrtPrescriptionWorkbenchProps = {}) {
  const idPrefix = useId()
  const [numericInputs, setNumericInputs] = useState(INITIAL_NUMERIC_INPUTS)
  const [syntheticBagStream, setSyntheticBagStream] = useState<SyntheticBagStream>('dialysate')
  const [syntheticBagCapacity, setSyntheticBagCapacity] = useState('')
  const validation = validateWorkbenchInputs(
    numericInputs,
    syntheticBagCapacity,
    syntheticBagStream,
  )
  const calculationAttempt = validation.inputs
    ? attemptPrescriptionWorkbenchCalculation(validation.inputs)
    : null
  const result = calculationAttempt?.result ?? null
  const unavailableOutputs =
    result?.unavailableOutputs ?? PRESCRIPTION_WORKBENCH_UNAVAILABLE_OUTPUTS
  const updateStatus = result
    ? `Practice outputs updated. Effluent pump target display ${formatNumber(result.effluentPumpTargetMlPerHour)} milliliters per hour; dose-section display ${formatNumber(result.effluentDoseMlPerKgHour, 2)} milliliters per kilogram per hour; split comparison ${result.prePostExperiment.direction}; bag duration ${
        result.syntheticBagDuration?.durationHours === null ||
        result.syntheticBagDuration?.durationHours === undefined
          ? 'unavailable'
          : `${formatNumber(result.syntheticBagDuration.durationHours, 2)} hours`
      }.`
    : (calculationAttempt?.errorMessage ??
      `All calculated outputs are unavailable. Correct: ${validation.invalidLabels.join(', ')}.`)

  function updateNumericInput(key: NumericInputKey, value: string) {
    setNumericInputs((current) => ({ ...current, [key]: value }))
  }

  return (
    <section
      className={styles.workbench}
      aria-labelledby={`${idPrefix}-heading`}
      data-reviewer-only="false"
      data-review-metadata="informational"
      data-analytics="allowlisted"
      data-progress-write="learner-mode-only"
      data-persistence="learner-mode-only"
      data-scoring="tool-specific"
      data-competency="none"
      onFocusCapture={() => onPhaseChange?.('predict')}
      onChangeCapture={() => onPhaseChange?.('act')}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Instructional tool · transparent arithmetic</span>
          <h2 id={`${idPrefix}-heading`}>Full Prescription Workbench</h2>
        </div>
        <span className={styles.pendingBadge}>Practice tool</span>
      </header>

      <div
        className={styles.reviewBoundary}
        role="note"
        aria-label="Educational calculation boundary"
      >
        <strong>Calculation practice—not for patient care.</strong>
        <p>
          Edit the practice values to see how the displayed calculations respond. The workbench does
          not provide clinical targets, patient predictions, or device-control instructions.
        </p>
      </div>

      <p className={styles.updateStatus} role="status" aria-atomic="true">
        {updateStatus}
      </p>

      <div className={styles.workspace}>
        <div className={styles.inputColumn}>
          <fieldset className={styles.fieldset}>
            <legend>Patient and circuit entries</legend>
            <p className={styles.syntheticStartingNote}>
              Starting values are practice examples—not defaults, targets, or recommendations.
            </p>
            <div className={styles.controlGrid}>
              <NumberControl
                id={`${idPrefix}-weight`}
                label="Example weight"
                description="Used only as the denominator of the manual-based effluent display calculation."
                unit="kg"
                min={0.1}
                step={0.1}
                value={numericInputs.simulatedWeightKg}
                error={validation.errors.simulatedWeightKg ?? null}
                onChange={(value) => updateNumericInput('simulatedWeightKg', value)}
              />
              <NumberControl
                id={`${idPrefix}-hematocrit`}
                label="Example hematocrit"
                description="Used only in the manual-based plasma-flow relationship."
                unit="%"
                min={0}
                max={99.9}
                step={0.1}
                value={numericInputs.hematocritPercent}
                error={validation.errors.hematocritPercent ?? null}
                onChange={(value) => updateNumericInput('hematocritPercent', value)}
              />
              <NumberControl
                id={`${idPrefix}-blood-flow`}
                label="Blood flow"
                description="Entered in mL/min and explicitly converted before plasma-flow calculation."
                unit="mL/min"
                min={0}
                step={1}
                value={numericInputs.bloodFlowMlPerMinute}
                error={validation.errors.bloodFlowMlPerMinute ?? null}
                onChange={(value) => updateNumericInput('bloodFlowMlPerMinute', value)}
              />
              <NumberControl
                id={`${idPrefix}-pbp`}
                label="PBP flow"
                description="Entered calculation term; no solution identity is assumed."
                unit="mL/h"
                min={0}
                step={10}
                value={numericInputs.preBloodPumpMlPerHour}
                error={validation.errors.preBloodPumpMlPerHour ?? null}
                onChange={(value) => updateNumericInput('preBloodPumpMlPerHour', value)}
              />
              <NumberControl
                id={`${idPrefix}-dialysate`}
                label="Dialysate flow"
                description="Entered calculation term; no solution identity is assumed."
                unit="mL/h"
                min={0}
                step={10}
                value={numericInputs.dialysateMlPerHour}
                error={validation.errors.dialysateMlPerHour ?? null}
                onChange={(value) => updateNumericInput('dialysateMlPerHour', value)}
              />
              <NumberControl
                id={`${idPrefix}-pre-replacement`}
                label="Pre-replacement flow"
                description="Feeds the qualitative pre/post split experiment."
                unit="mL/h"
                min={0}
                step={10}
                value={numericInputs.preReplacementMlPerHour}
                error={validation.errors.preReplacementMlPerHour ?? null}
                onChange={(value) => updateNumericInput('preReplacementMlPerHour', value)}
              />
              <NumberControl
                id={`${idPrefix}-post-replacement`}
                label="Post-replacement flow"
                description="Feeds the qualitative pre/post split experiment."
                unit="mL/h"
                min={0}
                step={10}
                value={numericInputs.postReplacementMlPerHour}
                error={validation.errors.postReplacementMlPerHour ?? null}
                onChange={(value) => updateNumericInput('postReplacementMlPerHour', value)}
              />
              <NumberControl
                id={`${idPrefix}-pfr`}
                label="Patient fluid removal (PFR)"
                description="Displayed as a separate machine term; never labeled whole-patient balance."
                unit="mL/h"
                min={0}
                step={10}
                value={numericInputs.patientFluidRemovalMlPerHour}
                error={validation.errors.patientFluidRemovalMlPerHour ?? null}
                onChange={(value) => updateNumericInput('patientFluidRemovalMlPerHour', value)}
              />
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Protocol and configuration checks</legend>
            <div className={styles.gateGrid}>
              <div className={styles.selectControl}>
                <label htmlFor={`${idPrefix}-anticoagulation`}>Anticoagulation concept</label>
                <select
                  id={`${idPrefix}-anticoagulation`}
                  defaultValue="none"
                  aria-describedby={`${idPrefix}-anticoagulation-description`}
                >
                  <option value="none">None — only available selection</option>
                  <option value="systemic" disabled>
                    Systemic — disabled pending protocol
                  </option>
                  <option value="citrate" disabled>
                    Regional citrate — disabled pending local protocol
                  </option>
                </select>
                <small id={`${idPrefix}-anticoagulation-description`}>
                  No dosing, target, monitoring, or recommendation is provided.
                </small>
              </div>
              <div className={styles.selectControl}>
                <label htmlFor={`${idPrefix}-solution`}>Locally verified solution profile</label>
                <select
                  id={`${idPrefix}-solution`}
                  disabled
                  defaultValue="unavailable"
                  aria-describedby={`${idPrefix}-solution-description`}
                >
                  <option value="unavailable">Unavailable — no site profile loaded</option>
                </select>
                <small id={`${idPrefix}-solution-description`}>
                  No composition, bag assignment, compatibility, or local stock is inferred.
                </small>
              </div>
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Optional practice bag-duration calculation</legend>
            <div className={styles.gateGrid}>
              <div className={styles.numberControl}>
                <label htmlFor={`${idPrefix}-bag-capacity`}>
                  <span>Practice bag capacity</span>
                  <small>mL</small>
                </label>
                <input
                  id={`${idPrefix}-bag-capacity`}
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="100"
                  value={syntheticBagCapacity}
                  placeholder="Leave blank"
                  aria-describedby={`${idPrefix}-bag-capacity-description${
                    validation.errors.syntheticBagCapacityMl
                      ? ` ${idPrefix}-bag-capacity-error`
                      : ''
                  }`}
                  aria-errormessage={
                    validation.errors.syntheticBagCapacityMl
                      ? `${idPrefix}-bag-capacity-error`
                      : undefined
                  }
                  aria-invalid={validation.errors.syntheticBagCapacityMl ? 'true' : undefined}
                  onChange={(event) => setSyntheticBagCapacity(event.currentTarget.value)}
                />
                <small id={`${idPrefix}-bag-capacity-description`}>
                  Enter a positive example capacity to calculate duration at the selected flow.
                </small>
                {validation.errors.syntheticBagCapacityMl ? (
                  <small id={`${idPrefix}-bag-capacity-error`} className={styles.inputError}>
                    {validation.errors.syntheticBagCapacityMl}
                  </small>
                ) : null}
              </div>
              <div className={styles.selectControl}>
                <label htmlFor={`${idPrefix}-bag-stream`}>Entered stream for division</label>
                <select
                  id={`${idPrefix}-bag-stream`}
                  value={syntheticBagStream}
                  aria-describedby={`${idPrefix}-bag-stream-description`}
                  onChange={(event) =>
                    setSyntheticBagStream(event.currentTarget.value as SyntheticBagStream)
                  }
                >
                  {BAG_STREAM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small id={`${idPrefix}-bag-stream-description`}>
                  Capacity ÷ selected entered rate only; this does not predict scale or alarm
                  behavior.
                </small>
              </div>
            </div>
          </fieldset>
        </div>

        <div className={styles.outputColumn}>
          <section
            className={styles.outputPanel}
            aria-labelledby={`${idPrefix}-outputs`}
            tabIndex={0}
            onFocus={() => onPhaseChange?.('observe')}
          >
            <header>
              <span>Manufacturer-manual calculations</span>
              <h3 id={`${idPrefix}-outputs`}>Educational calculation outputs</h3>
            </header>
            <dl className={styles.outputGrid}>
              <OutputMetric
                label="Effluent pump target"
                value={
                  result
                    ? `${formatNumber(result.effluentPumpTargetMlPerHour)} mL/h`
                    : 'Unavailable — correct entries'
                }
                source="PrisMax operator's manual calculation"
                note="Sum of entered PFR, PBP, replacement, and dialysate terms; syringe/makeup held at zero."
              />
              <OutputMetric
                label="Effluent display dose"
                value={
                  result
                    ? `${formatNumber(result.effluentDoseMlPerKgHour, 2)} mL/kg/h`
                    : 'Unavailable — correct entries'
                }
                source="PrisMax operator's manual calculation"
                note="No target range and no delivered-dose or downtime claim."
              />
              <OutputMetric
                label="Plasma flow"
                value={
                  result
                    ? `${formatNumber(result.plasmaFlowMlPerHour)} mL/h`
                    : 'Unavailable — correct entries'
                }
                source="PrisMax operator's manual calculation"
                note="Blood-flow entry converted from mL/min before applying entered hematocrit."
              />
              <OutputMetric
                label="Machine PFR term"
                value={
                  result
                    ? `${formatNumber(result.machinePatientFluidRemovalTermMlPerHour)} mL/h`
                    : 'Unavailable — correct entries'
                }
                source="PrisMax operator's manual · separate term"
                note="Not a whole-patient balance or tolerance recommendation."
              />
              <OutputMetric
                label="Aggregate source-pump/bag throughput"
                value={
                  result
                    ? `${formatNumber(result.aggregateSourcePumpThroughputMlPerDay / 1_000, 2)} L/day`
                    : 'Unavailable — correct entries'
                }
                source="Calculated from the entered values"
                note="PBP + dialysate + replacement pump entries over 24 hours if unchanged. This is source-bag use: dialysate remains separate from blood-side/patient input, and PFR is excluded."
              />
              <OutputMetric
                label="Printed total-predilution fraction"
                value={
                  result
                    ? formatPercentageFraction(result.totalPredilutionFraction)
                    : 'Unavailable — correct entries'
                }
                source="PrisMax operator's manual calculation"
                note="Dimensionless relationship only; not quantitative filtration fraction."
              />
            </dl>
          </section>

          <section className={styles.unavailablePanel} aria-labelledby={`${idPrefix}-unavailable`}>
            <header>
              <span>Calculations not supported by the available evidence</span>
              <h3 id={`${idPrefix}-unavailable`}>Unavailable outputs</h3>
            </header>
            <ul>
              {unavailableOutputs.map((output) => (
                <li key={output.id}>
                  <div>
                    <strong>{output.label}</strong>
                    <span>Unavailable in this workbench</span>
                  </div>
                  <p>{output.reason}</p>
                  <small>
                    Not shown because the available evidence does not support this calculation.
                  </small>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.bagResult} aria-labelledby={`${idPrefix}-bag-result`}>
            <h3 id={`${idPrefix}-bag-result`}>Practice bag-duration result</h3>
            {result === null ? (
              <p>Unavailable — correct every invalid entry.</p>
            ) : result.syntheticBagDuration === null ? (
              <p>No result — enter an optional practice bag capacity.</p>
            ) : result.syntheticBagDuration.status === 'unavailable-zero-stream' ? (
              <p>
                Unavailable — the selected {result.syntheticBagDuration.streamLabel} rate is zero.{' '}
                {result.syntheticBagDuration.limitation}
              </p>
            ) : (
              <p>
                <strong>{formatNumber(result.syntheticBagDuration.durationHours ?? 0, 2)} h</strong>{' '}
                for a practice {formatNumber(result.syntheticBagDuration.capacityMl, 0)} mL capacity
                divided by the entered {result.syntheticBagDuration.streamLabel} rate of{' '}
                {formatNumber(result.syntheticBagDuration.streamRateMlPerHour)} mL/h.{' '}
                {result.syntheticBagDuration.limitation}
              </p>
            )}
          </section>
        </div>
      </div>

      <QualitativePrePostDilutionExperiment result={result?.prePostExperiment ?? null} />

      <details className={styles.sourcePanel}>
        <summary id={`${idPrefix}-sources`}>Evidence and calculation notes</summary>
        <div>
          <ul>
            {SOURCE_NOTES.map((source) => (
              <li key={source.id}>
                <strong>{source.id}</strong>
                <span>{source.text}</span>
              </li>
            ))}
          </ul>
          <ul>
            {(
              result?.assumptions ?? [
                'All source-linked arithmetic is suspended until every required entry and any entered optional capacity is valid.',
                'No invalid entry is clamped or replaced by a minimum value.',
              ]
            ).map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
        <p>
          Educational calculation tool only. Actual CRRT selection, prescription, solution use,
          anticoagulation, device setup, and monitoring depend on the patient, the exact device and
          disposable set, approved institutional protocols, manufacturer instructions, and the
          treating team’s judgment.
        </p>
      </details>
    </section>
  )
}
