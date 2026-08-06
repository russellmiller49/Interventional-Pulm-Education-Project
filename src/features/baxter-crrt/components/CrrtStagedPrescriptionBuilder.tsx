'use client'

import { useId, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'

import {
  CRRT_CLEARANCE_VERSUS_REMOVAL_CONTRAST,
  CRRT_PRESCRIPTION_STAGE_IDS,
  CRRT_STARTING_CONSTRUCTION,
  calculateCrrtPredictedConsequences,
  crrtConstructionGroups,
  crrtPrescriptionGoalGroups,
  crrtPrescriptionGoalOptions,
  crrtPrescriptionModalityViews,
  crrtPrescriptionStages,
  nextCrrtPrescriptionStageId,
  previousCrrtPrescriptionStageId,
  type CrrtConstructionFieldId,
  type CrrtPredictedConsequences,
  type CrrtPrescriptionConstruction,
  type CrrtPrescriptionStageId,
} from '../stagedPrescriptionModel'
import type {
  QualitativeComparisonLevel,
  QualitativePrePostDilutionResult,
} from '../prescriptionWorkbenchModel'
import { CrrtPilotCircuit } from './CrrtPilotCircuit'
import styles from './crrt-staged-prescription-builder.module.css'

/* ------------------------------------------------------------------ *
 * Entry specification
 * ------------------------------------------------------------------ */

type NumericFieldId = Exclude<CrrtConstructionFieldId, 'modalityViewId' | 'anticoagulationConcept'>

interface NumericFieldSpec {
  readonly label: string
  readonly unit: string
  readonly description: string
  readonly min: number
  readonly max?: number
  readonly step: number
}

const NUMERIC_FIELD_IDS = Object.freeze([
  'simulatedWeightKg',
  'hematocritPercent',
  'bloodFlowMlPerMinute',
  'preBloodPumpMlPerHour',
  'dialysateMlPerHour',
  'preReplacementMlPerHour',
  'postReplacementMlPerHour',
  'patientFluidRemovalMlPerHour',
  'makeupMlPerHour',
  'treatmentWindowHours',
  'downtimeHours',
] as const satisfies readonly NumericFieldId[])

const NUMERIC_FIELDS: Readonly<Record<NumericFieldId, NumericFieldSpec>> = Object.freeze({
  simulatedWeightKg: Object.freeze({
    label: 'Practice weight',
    unit: 'kg',
    description: 'A denominator only. It normalises the effluent display and changes nothing else.',
    min: 0.1,
    step: 0.1,
  }),
  hematocritPercent: Object.freeze({
    label: 'Practice haematocrit',
    unit: '%',
    description: 'Used only to turn blood flow into plasma flow.',
    min: 0,
    max: 99.9,
    step: 0.1,
  }),
  bloodFlowMlPerMinute: Object.freeze({
    label: 'Blood flow',
    unit: 'mL/min',
    description:
      'How much blood the circuit sees. Entered per minute and converted before plasma flow is worked out.',
    min: 0,
    step: 1,
  }),
  preBloodPumpMlPerHour: Object.freeze({
    label: 'Pre-blood-pump flow',
    unit: 'mL/h',
    description: 'Joins the blood path before the pump, so it reaches the patient.',
    min: 0,
    step: 10,
  }),
  dialysateMlPerHour: Object.freeze({
    label: 'Dialysate flow',
    unit: 'mL/h',
    description:
      'Runs along the far side of the membrane. It never joins the blood path and never enters the patient.',
    min: 0,
    step: 10,
  }),
  preReplacementMlPerHour: Object.freeze({
    label: 'Pre-filter replacement flow',
    unit: 'mL/h',
    description: 'Enters the blood before the membrane, so some of it is filtered off again.',
    min: 0,
    step: 10,
  }),
  postReplacementMlPerHour: Object.freeze({
    label: 'Post-filter replacement flow',
    unit: 'mL/h',
    description: 'Enters the blood after the membrane, so all of it reaches the patient.',
    min: 0,
    step: 10,
  }),
  patientFluidRemovalMlPerHour: Object.freeze({
    label: 'Patient fluid removal',
    unit: 'mL/h',
    description:
      'The only entry that decides what the patient loses. It is never the same as total effluent.',
    min: 0,
    step: 10,
  }),
  makeupMlPerHour: Object.freeze({
    label: 'Device makeup flow',
    unit: 'mL/h',
    description:
      'Held at nothing unless a local configuration is bound. Enter any amount and the references stop agreeing about where that volume belongs, so the fluid results are withheld rather than guessed.',
    min: 0,
    step: 10,
  }),
  treatmentWindowHours: Object.freeze({
    label: 'Treatment window',
    unit: 'h',
    description: 'The period the prescription is being read over.',
    min: 0.1,
    step: 1,
  }),
  downtimeHours: Object.freeze({
    label: 'Time not running in that window',
    unit: 'h',
    description:
      'Hours lost to interruptions. The prescription is unchanged; what changes is how much of it the window produced.',
    min: 0,
    step: 0.5,
  }),
})

type NumericEntryState = Readonly<Record<NumericFieldId, string>>

function numericEntriesFor(construction: CrrtPrescriptionConstruction): NumericEntryState {
  return Object.freeze({
    simulatedWeightKg: String(construction.simulatedWeightKg),
    hematocritPercent: String(construction.hematocritPercent),
    bloodFlowMlPerMinute: String(construction.bloodFlowMlPerMinute),
    preBloodPumpMlPerHour: String(construction.preBloodPumpMlPerHour),
    dialysateMlPerHour: String(construction.dialysateMlPerHour),
    preReplacementMlPerHour: String(construction.preReplacementMlPerHour),
    postReplacementMlPerHour: String(construction.postReplacementMlPerHour),
    patientFluidRemovalMlPerHour: String(construction.patientFluidRemovalMlPerHour),
    makeupMlPerHour: String(construction.makeupMlPerHour),
    treatmentWindowHours: String(construction.treatmentWindowHours),
    downtimeHours: String(construction.downtimeHours),
  })
}

const INITIAL_NUMERIC_ENTRIES: NumericEntryState = numericEntriesFor(CRRT_STARTING_CONSTRUCTION)

const SOURCE_NOTES = Object.freeze([
  Object.freeze({
    key: 'effluent',
    label: 'Effluent-pump arithmetic',
    text: "PrisMax operator's manual effluent-pump target expression",
  }),
  Object.freeze({
    key: 'dose',
    label: 'Weight-normalised display',
    text: "PrisMax operator's manual weight-normalised effluent display",
  }),
  Object.freeze({
    key: 'predilution',
    label: 'Predilution relationship',
    text: "PrisMax operator's manual printed total-predilution relationship",
  }),
  Object.freeze({
    key: 'removed',
    label: 'Machine patient-fluid-removed term',
    text: "PrisMax operator's manual patient-fluid-removed expression",
  }),
  Object.freeze({
    key: 'unavailable',
    label: 'Held calculations',
    text: 'Two printed circuit-flow expressions remain unavailable because the references do not support one verified reading',
  }),
  Object.freeze({
    key: 'clinical',
    label: 'Clinical context',
    text: '2025 CKRT core curriculum and 2026 multidisciplinary ICU RRT guidance',
  }),
  Object.freeze({
    key: 'practice',
    label: 'Practice-value boundary',
    text: 'Practice values and arithmetic boundaries for this builder',
  }),
])

/* ------------------------------------------------------------------ *
 * Entry validation
 * ------------------------------------------------------------------ */

interface EntryValidation {
  readonly construction: CrrtPrescriptionConstruction | null
  readonly errors: Readonly<Partial<Record<NumericFieldId, string>>>
  readonly invalidLabels: readonly string[]
}

function validateNumericText(value: string, spec: NumericFieldSpec): string | null {
  if (value.trim() === '') return `${spec.label} is required.`
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `${spec.label} must be a finite number.`
  if (parsed < spec.min) return `${spec.label} must be at least ${spec.min}.`
  if (spec.max !== undefined && parsed > spec.max) {
    return `${spec.label} must be at most ${spec.max}.`
  }
  return null
}

function validateEntries(
  entries: NumericEntryState,
  modalityViewId: CrrtPrescriptionConstruction['modalityViewId'],
): EntryValidation {
  const errors: Partial<Record<NumericFieldId, string>> = {}

  for (const fieldId of NUMERIC_FIELD_IDS) {
    const error = validateNumericText(entries[fieldId], NUMERIC_FIELDS[fieldId])
    if (error) errors[fieldId] = error
  }

  if (!errors.downtimeHours && !errors.treatmentWindowHours) {
    if (Number(entries.downtimeHours) > Number(entries.treatmentWindowHours)) {
      errors.downtimeHours = 'Time not running cannot exceed the treatment window.'
    }
  }

  const invalidLabels = (Object.keys(errors) as NumericFieldId[]).map(
    (fieldId) => NUMERIC_FIELDS[fieldId].label,
  )
  if (invalidLabels.length > 0) {
    return Object.freeze({
      construction: null,
      errors: Object.freeze(errors),
      invalidLabels: Object.freeze(invalidLabels),
    })
  }

  return Object.freeze({
    construction: Object.freeze({
      modalityViewId,
      simulatedWeightKg: Number(entries.simulatedWeightKg),
      hematocritPercent: Number(entries.hematocritPercent),
      bloodFlowMlPerMinute: Number(entries.bloodFlowMlPerMinute),
      preBloodPumpMlPerHour: Number(entries.preBloodPumpMlPerHour),
      dialysateMlPerHour: Number(entries.dialysateMlPerHour),
      preReplacementMlPerHour: Number(entries.preReplacementMlPerHour),
      postReplacementMlPerHour: Number(entries.postReplacementMlPerHour),
      patientFluidRemovalMlPerHour: Number(entries.patientFluidRemovalMlPerHour),
      makeupMlPerHour: Number(entries.makeupMlPerHour),
      treatmentWindowHours: Number(entries.treatmentWindowHours),
      downtimeHours: Number(entries.downtimeHours),
      anticoagulationConcept: 'none' as const,
    }),
    errors: Object.freeze(errors),
    invalidLabels: Object.freeze([]),
  })
}

interface ConsequenceAttempt {
  readonly consequences: CrrtPredictedConsequences | null
  readonly errorMessage: string | null
}

function attemptConsequences(construction: CrrtPrescriptionConstruction): ConsequenceAttempt {
  try {
    return Object.freeze({
      consequences: calculateCrrtPredictedConsequences(construction),
      errorMessage: null,
    })
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return Object.freeze({
      consequences: null,
      errorMessage:
        'The entered combination exceeds a finite calculation boundary. Every predicted consequence remains unavailable.',
    })
  }
}

/* ------------------------------------------------------------------ *
 * Small presentational pieces
 * ------------------------------------------------------------------ */

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return value.toLocaleString(undefined, { maximumFractionDigits })
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

interface NumberControlProps {
  readonly id: string
  readonly spec: NumericFieldSpec
  readonly value: string
  readonly error: string | null
  readonly onChange: (value: string) => void
}

function NumberControl({ id, spec, value, error, onChange }: NumberControlProps) {
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.currentTarget.value)
  }

  return (
    <div className={styles.numberControl}>
      <label htmlFor={id}>
        <span>{spec.label}</span>
        <small>{spec.unit}</small>
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
        aria-errormessage={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
        onChange={handleChange}
      />
      <small id={descriptionId}>{spec.description}</small>
      {error ? (
        <small id={errorId} className={styles.inputError}>
          {error}
        </small>
      ) : null}
    </div>
  )
}

export interface QualitativePrePostDilutionExperimentProps {
  readonly result: QualitativePrePostDilutionResult | null
}

/**
 * The pre/post split comparison, carried over from the dense workbench unchanged in substance.
 * It belongs to stage 3: it describes what a split predicts, not what to enter.
 */
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
      <h4 id={`${idPrefix}-heading`}>Pre- versus post-dilution split</h4>
      <p className={styles.intro}>
        The same total replacement flow, allocated differently. The comparisons below are unitless
        directional teaching aids — not device displays, measured concentrations, clinical targets,
        or patient predictions.
      </p>
      <p className={styles.conceptEquation} role="note">
        Split-position index = entered post-replacement flow ÷ entered total replacement flow. The
        three labels follow only whether the entered split is pre-dominant, equal, or post-dominant;
        no physiologic coefficient is invented.
      </p>

      {result === null ? (
        <p className={styles.inactiveNotice}>
          Unavailable — revise every invalid entry before viewing the comparison.
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
                  Unitless 0–1 split-position index; the endpoints are teaching anchors, not
                  concentrations.
                </small>
              </dd>
            </div>
            <div>
              <dt>Relative filtration-burden indicator</dt>
              <dd>
                <strong>{qualitativeLabel(result.filtrationFractionBurdenProxy)}</strong>
                <small>Split-only indicator; the quantitative value is unavailable.</small>
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

/* ------------------------------------------------------------------ *
 * The builder
 * ------------------------------------------------------------------ */

export interface CrrtStagedPrescriptionBuilderProps {
  readonly onPhaseChange?: (phase: 'predict' | 'act' | 'observe') => void
  readonly onCompletionEvidence?: () => void
  /**
   * Which step opens first. A learner always starts at Goals; this exists so the offline review
   * harness can render each step as its own mount, and so a test can address one step directly.
   */
  readonly initialStageId?: CrrtPrescriptionStageId
  /**
   * The construction the builder opens with. Defaults to the authored practice values; the review
   * harness overrides it to render the downtime and unresolved-makeup states.
   */
  readonly initialConstruction?: CrrtPrescriptionConstruction
}

export function CrrtStagedPrescriptionBuilder({
  onPhaseChange,
  onCompletionEvidence,
  initialStageId = 'goals',
  initialConstruction = CRRT_STARTING_CONSTRUCTION,
}: CrrtStagedPrescriptionBuilderProps) {
  const idPrefix = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const constructionChanged = useRef(false)
  const completionReported = useRef(false)

  const [stageId, setStageId] = useState<CrrtPrescriptionStageId>(initialStageId)
  const [selectedGoalIds, setSelectedGoalIds] = useState<readonly string[]>([])
  const [modalityViewId, setModalityViewId] = useState<
    CrrtPrescriptionConstruction['modalityViewId']
  >(initialConstruction.modalityViewId)
  const [entries, setEntries] = useState<NumericEntryState>(() =>
    initialConstruction === CRRT_STARTING_CONSTRUCTION
      ? INITIAL_NUMERIC_ENTRIES
      : numericEntriesFor(initialConstruction),
  )

  const validation = validateEntries(entries, modalityViewId)
  const attempt = validation.construction ? attemptConsequences(validation.construction) : null
  const consequences = attempt?.consequences ?? null

  const stage = crrtPrescriptionStages.find((candidate) => candidate.id === stageId)!
  const previousStageId = previousCrrtPrescriptionStageId(stageId)
  const nextStageId = nextCrrtPrescriptionStageId(stageId)

  const updateStatus = consequences
    ? `Predictions updated for step ${stage.ordinal} of ${CRRT_PRESCRIPTION_STAGE_IDS.length}, ${stage.shortTitle}. Total effluent ${formatNumber(consequences.ledger.totalEffluentMlHour)} millilitres per hour; prescribed intensity ${formatNumber(consequences.intensity.prescribedDoseMlPerKgHour, 2)} and delivered intensity ${formatNumber(consequences.intensity.deliveredDoseMlPerKgHour, 2)} millilitres per kilogram per hour; fluid results ${consequences.resolution === 'resolved' ? 'available' : 'withheld while the makeup attribution is unresolved'}.`
    : (attempt?.errorMessage ??
      `Every predicted consequence is unavailable. Revise: ${validation.invalidLabels.join(', ')}.`)

  function focusStagePanel() {
    panelRef.current?.focus({ preventScroll: true })
  }

  function goToStage(next: CrrtPrescriptionStageId) {
    setStageId(next)
    if (next === 'goals') onPhaseChange?.('predict')
    if (next === 'construction') onPhaseChange?.('act')
    if (next === 'predicted-consequences') {
      onPhaseChange?.('observe')
      if (constructionChanged.current && !completionReported.current) {
        completionReported.current = true
        onCompletionEvidence?.()
      }
    }
    // Focus follows the stage so keyboard order restarts inside the panel that just appeared.
    window.setTimeout(focusStagePanel, 0)
  }

  function updateEntry(fieldId: NumericFieldId, value: string) {
    constructionChanged.current = true
    setEntries((current) => ({ ...current, [fieldId]: value }))
  }

  function goalToggle(goalId: string) {
    setSelectedGoalIds((current) =>
      current.includes(goalId) ? current.filter((id) => id !== goalId) : [...current, goalId],
    )
  }

  const selectedGoals = crrtPrescriptionGoalOptions.filter((option) =>
    selectedGoalIds.includes(option.id),
  )

  return (
    <section
      className={styles.builder}
      aria-labelledby={`${idPrefix}-heading`}
      data-reviewer-only="false"
      data-review-metadata="informational"
      data-analytics="allowlisted"
      data-progress-write="learner-mode-only"
      data-persistence="learner-mode-only"
      data-stage={stageId}
      data-makeup-resolution={consequences?.resolution ?? 'unavailable-invalid-entry'}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Instructional tool · transparent arithmetic</span>
          <h2 id={`${idPrefix}-heading`}>Staged Prescription Builder</h2>
        </div>
        <span className={styles.pendingBadge}>Practice tool</span>
      </header>

      <div
        className={styles.reviewBoundary}
        role="note"
        aria-label="Educational calculation boundary"
      >
        <strong>Calculation practice — not for patient care.</strong>
        <p>
          Build the prescription in three steps and watch what each step changes. This builder
          provides no clinical target, no recommended set of flows, no patient prediction, and no
          device-control instruction. You can move between steps in either direction and nothing is
          lost.
        </p>
      </div>

      <nav className={styles.stageRail} aria-label="Prescription building steps">
        <ol>
          {crrtPrescriptionStages.map((candidate) => {
            const isCurrent = candidate.id === stageId
            return (
              <li key={candidate.id}>
                <button
                  type="button"
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => goToStage(candidate.id)}
                >
                  <span className={styles.stageOrdinal}>
                    Step {candidate.ordinal} of {CRRT_PRESCRIPTION_STAGE_IDS.length}
                  </span>
                  <span className={styles.stageName}>{candidate.shortTitle}</span>
                  <span className={styles.stageState}>
                    {candidate.id === 'goals'
                      ? selectedGoals.length === 0
                        ? 'No job named yet'
                        : `${selectedGoals.length} named`
                      : candidate.id === 'construction'
                        ? validation.construction
                          ? 'Entries accepted'
                          : 'Entries need revising'
                        : consequences
                          ? consequences.resolution === 'resolved'
                            ? 'Predictions available'
                            : 'Predictions withheld'
                          : 'Predictions unavailable'}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <p className={styles.updateStatus} role="status" aria-atomic="true">
        {updateStatus}
      </p>

      <div
        className={styles.stagePanel}
        ref={panelRef}
        tabIndex={-1}
        role="group"
        aria-labelledby={`${idPrefix}-stage-heading`}
      >
        <header>
          <span className={styles.kicker}>
            Step {stage.ordinal} of {CRRT_PRESCRIPTION_STAGE_IDS.length} · {stage.shortTitle}
          </span>
          <h3 id={`${idPrefix}-stage-heading`}>{stage.title}</h3>
          <p className={styles.stageQuestion}>{stage.question}</p>
          <p className={styles.stageSummary}>{stage.summary}</p>
        </header>

        {stageId === 'goals' ? (
          <>
            {crrtPrescriptionGoalGroups.map((group) => (
              <fieldset key={group.id} className={styles.goalGroup}>
                <legend>{group.title}</legend>
                <p className={styles.goalGroupQuestion}>{group.question}</p>
                {crrtPrescriptionGoalOptions
                  .filter((option) => option.group === group.id)
                  .map((option) => {
                    const selected = selectedGoalIds.includes(option.id)
                    return (
                      <label
                        key={option.id}
                        className={styles.goalOption}
                        data-selected={selected}
                        data-goal={option.id}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => goalToggle(option.id)}
                        />
                        <strong>{option.label}</strong>
                        <small>{option.whatThePrescriptionMustDo}</small>
                      </label>
                    )
                  })}
              </fieldset>
            ))}

            <div className={styles.contrastPanel}>
              <h4>{CRRT_CLEARANCE_VERSUS_REMOVAL_CONTRAST.title}</h4>
              <dl>
                <div>
                  <dt>Clearance intensity</dt>
                  <dd>{CRRT_CLEARANCE_VERSUS_REMOVAL_CONTRAST.clearanceSide}</dd>
                </div>
                <div>
                  <dt>Net patient fluid removal</dt>
                  <dd>{CRRT_CLEARANCE_VERSUS_REMOVAL_CONTRAST.removalSide}</dd>
                </div>
              </dl>
              <p>{CRRT_CLEARANCE_VERSUS_REMOVAL_CONTRAST.consequence}</p>
            </div>
          </>
        ) : null}

        {stageId === 'construction' ? (
          <>
            {crrtConstructionGroups.map((group) => (
              <fieldset key={group.id} className={styles.constructionGroup}>
                <legend>
                  {group.ordinal}. {group.title}
                </legend>
                <p className={styles.causalNote}>{group.causalNote}</p>
                <div className={styles.controlGrid}>
                  {group.fieldIds.map((fieldId) => {
                    if (fieldId === 'modalityViewId') {
                      return (
                        <div key={fieldId} className={styles.selectControl}>
                          <label htmlFor={`${idPrefix}-modality`}>Modality view</label>
                          <select
                            id={`${idPrefix}-modality`}
                            value={modalityViewId}
                            aria-describedby={`${idPrefix}-modality-description`}
                            onChange={(event) => {
                              constructionChanged.current = true
                              setModalityViewId(
                                event.currentTarget
                                  .value as CrrtPrescriptionConstruction['modalityViewId'],
                              )
                            }}
                          >
                            {crrtPrescriptionModalityViews.map((view) => (
                              <option key={view.id} value={view.id}>
                                {view.label}
                              </option>
                            ))}
                          </select>
                          <small id={`${idPrefix}-modality-description`}>
                            Chooses which view of the one circuit is drawn in step 3. The label
                            describes the transport intent; the flows below decide what actually
                            runs.
                          </small>
                        </div>
                      )
                    }
                    if (fieldId === 'anticoagulationConcept') {
                      return (
                        <div key={fieldId} className={styles.selectControl}>
                          <label htmlFor={`${idPrefix}-anticoagulation`}>
                            Anticoagulation approach
                          </label>
                          <select
                            id={`${idPrefix}-anticoagulation`}
                            defaultValue="none"
                            aria-describedby={`${idPrefix}-anticoagulation-description`}
                          >
                            <option value="none">None — only available selection</option>
                            <option value="systemic" disabled>
                              Systemic — unavailable pending protocol
                            </option>
                            <option value="citrate" disabled>
                              Regional citrate — unavailable pending local protocol
                            </option>
                          </select>
                          <small id={`${idPrefix}-anticoagulation-description`}>
                            No dosing, target, monitoring plan, or recommendation is provided here.
                            The citrate section teaches where citrate acts, not how much to give.
                          </small>
                        </div>
                      )
                    }
                    return (
                      <NumberControl
                        key={fieldId}
                        id={`${idPrefix}-${fieldId}`}
                        spec={NUMERIC_FIELDS[fieldId]}
                        value={entries[fieldId]}
                        error={validation.errors[fieldId] ?? null}
                        onChange={(value) => updateEntry(fieldId, value)}
                      />
                    )
                  })}
                </div>
              </fieldset>
            ))}
            <p className={styles.stageSummary}>
              Starting values are practice examples — not defaults, targets, or recommendations.
            </p>
          </>
        ) : null}

        {stageId === 'predicted-consequences' ? (
          consequences === null ? (
            <p className={styles.inactiveNotice}>
              {attempt?.errorMessage ??
                `Every predicted consequence is unavailable until each entry is valid. Revise: ${validation.invalidLabels.join(', ')}.`}
            </p>
          ) : (
            <>
              <div className={styles.goalEcho}>
                <h4>What you said this prescription had to do</h4>
                {selectedGoals.length === 0 ? (
                  <p>
                    No job was named in step 1. The predictions below are still true of these
                    entries, but nothing here can tell you whether they serve the patient in front
                    of you.
                  </p>
                ) : (
                  <ul>
                    {selectedGoals.map((goal) => (
                      <li key={goal.id}>
                        {goal.label} — {goal.whatThePrescriptionMustDo}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {consequences.withheldNotice ? (
                <div className={styles.withheldNotice} role="note" aria-label="Withheld results">
                  <strong>These fluid results are withheld, not zero.</strong>
                  <span>{consequences.withheldNotice}</span>
                </div>
              ) : null}

              <section className={styles.consequenceSection}>
                <h4>The circuit these entries describe</h4>
                <p>
                  The same circuit as every other section, in the view you chose. The ledger below
                  it is computed from your entries, and it is the module&rsquo;s only fluid ledger.
                </p>
                {consequences.circuitView.consistencyNotes.length > 0 ? (
                  <ul className={styles.consistencyList} aria-label="View and entry disagreements">
                    {consequences.circuitView.consistencyNotes.map((note) => (
                      <li key={`${note.fieldId}-${note.expectation}`}>{note.statement}</li>
                    ))}
                  </ul>
                ) : (
                  <p>The flows you entered match the view you chose.</p>
                )}
                <div className={styles.circuitHolder}>
                  <CrrtPilotCircuit
                    running={true}
                    setReady={true}
                    fluidsReady={true}
                    bloodFlowMlMin={consequences.flows.bloodFlowMlMin}
                    dialysateFlowMlHour={consequences.flows.dialysateFlowMlHour}
                    patientFluidRemovalMlHour={consequences.flows.patientFluidRemovalMlHour}
                    flows={consequences.flows}
                    initialOverlayId={consequences.circuitView.overlayId}
                    pressure={{
                      access: null,
                      filter: null,
                      return: null,
                      effluent: null,
                      TMP: null,
                      filterDrop: null,
                    }}
                  />
                </div>
              </section>

              <section className={styles.consequenceSection}>
                <h4>Prescribed intensity is not delivered intensity</h4>
                <dl className={styles.intensityGrid}>
                  <div>
                    <dt>Total effluent</dt>
                    <dd>
                      <strong>
                        {formatNumber(consequences.intensity.prescribedEffluentRateMlPerHour)} mL/h
                      </strong>
                      <small>
                        What the effluent pump is asked to carry. This is not fluid the patient
                        loses.
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>Prescribed intensity</dt>
                    <dd>
                      <strong>
                        {formatNumber(consequences.intensity.prescribedDoseMlPerKgHour, 2)} mL/kg/h
                      </strong>
                      <small>
                        The weight-normalised display for the prescription as written. No target
                        range is supplied.
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>Delivered intensity</dt>
                    <dd>
                      <strong>
                        {formatNumber(consequences.intensity.deliveredDoseMlPerKgHour, 2)} mL/kg/h
                      </strong>
                      <small>
                        The same expression over what the window actually produced:{' '}
                        {formatNumber(consequences.intensity.deliveredHours, 1)} of{' '}
                        {formatNumber(consequences.intensity.treatmentWindowHours, 1)} hours
                        running.
                      </small>
                    </dd>
                  </div>
                </dl>
                <p className={styles.separationNote}>{consequences.intensity.statement}</p>
              </section>

              <QualitativePrePostDilutionExperiment
                result={consequences.filtrationBurden.qualitative}
              />

              <section className={styles.consequenceSection}>
                <h4>Filtration burden</h4>
                <p>
                  Printed total-predilution relationship:{' '}
                  <strong>
                    {consequences.filtrationBurden.printedTotalPredilutionFraction === null
                      ? 'unavailable — no entered pre-flow denominator'
                      : `${(consequences.filtrationBurden.printedTotalPredilutionFraction * 100).toFixed(1)}%`}
                  </strong>
                  . This is a dimensionless relationship, not the quantitative filtration fraction.
                </p>
                <p>{consequences.filtrationBurden.quantitativeReason}</p>
              </section>

              <section className={styles.consequenceSection}>
                <h4>What the blood flow you set does to every pressure</h4>
                <p>
                  Blood flow moves these readings whether or not anything is obstructed. Four of
                  them are places you can walk to and inspect; two are arithmetic over the first
                  four and have no location at all.
                </p>
                <ul className={styles.implicationList} aria-label="Pressure implications">
                  {consequences.pressureImplications.map((implication) => (
                    <li key={implication.signalId}>
                      <strong>{implication.label}</strong>{' '}
                      <span className={styles.implicationKind}>
                        {implication.hasALocation
                          ? 'has a location'
                          : 'no location — calculated from the others'}
                      </span>
                      <br />
                      {implication.bloodFlowEffect}
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.consequenceSection}>
                <h4>What these entries still do not tell you</h4>
                <ul className={styles.unavailableList} aria-label="Calculations not supported">
                  {consequences.unavailableOutputs.map((output) => (
                    <li key={output.id}>
                      <strong>{output.label}</strong> — {output.reason}
                    </li>
                  ))}
                </ul>
                <ul className={styles.boundaryList} aria-label="Model boundaries">
                  {consequences.modelBoundaries.map((boundary) => (
                    <li key={boundary}>{boundary}</li>
                  ))}
                </ul>
              </section>
            </>
          )
        ) : null}
      </div>

      <div className={styles.stageNav}>
        <button
          type="button"
          className={styles.secondary}
          disabled={previousStageId === null}
          onClick={() => previousStageId && goToStage(previousStageId)}
        >
          {previousStageId
            ? `Back to ${crrtPrescriptionStages.find((item) => item.id === previousStageId)?.shortTitle}`
            : 'Back'}
        </button>
        <button
          type="button"
          disabled={nextStageId === null}
          onClick={() => nextStageId && goToStage(nextStageId)}
        >
          {nextStageId
            ? `Continue to ${crrtPrescriptionStages.find((item) => item.id === nextStageId)?.shortTitle}`
            : 'End of the three steps'}
        </button>
      </div>

      <details className={styles.sourcePanel}>
        <summary>Evidence and calculation notes</summary>
        <ul>
          {SOURCE_NOTES.map((note) => (
            <li key={note.key}>
              <strong>{note.label}</strong> — {note.text}
            </li>
          ))}
        </ul>
        <ul>
          {(
            consequences?.workbench.assumptions ?? [
              'All source-linked arithmetic is suspended until every required entry is valid.',
              'No invalid entry is clamped or replaced by a minimum value.',
            ]
          ).map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
        <p>
          Educational calculation tool only. Actual CRRT selection, prescription, solution use,
          anticoagulation, device setup, and monitoring depend on the patient, the exact device and
          disposable set, approved institutional protocols, manufacturer instructions, and the
          treating team&rsquo;s judgment.
        </p>
      </details>
    </section>
  )
}
