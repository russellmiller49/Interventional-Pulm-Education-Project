/**
 * The dependency-aware evaluator behind the derived-hemodynamics station.
 *
 * Every result it produces answers the station's ten questions in data: which equation ran, which
 * inputs fed it and how each was obtained, which acquisition method produced the flow, whether the
 * inputs belong to one measurement episode, whether the arithmetic is possible, whether the result
 * is clinically interpretable, what it is sensitive to, and what survives when something fails.
 *
 * Three commitments shape the code.
 *
 * Withholding is selective: each metric is judged against its own dependency list, so an invalid
 * PAWP takes down PVR and nothing else, and there is deliberately no global "hemodynamics invalid"
 * switch anywhere in this file.
 *
 * Reasons are collected, not short-circuited — a metric with three problems reports three problems,
 * the same decision `fickCardiacOutput` made in H4.
 *
 * Discordance is preserved: a negative gradient is reported as the negative number it is, as
 * evidence two measurements disagree. Nothing here clamps, repairs, or hides it.
 */

import {
  cardiacOutputInputStatusLabels,
  cardiacOutputMethodById,
  type CardiacOutputInputStatus,
} from '../content/cardiacOutputMethods'
import {
  derivedMetricRecords,
  derivedThresholdClassificationLabels,
  requireDerivedInputDefinition,
  requireDerivedMetric,
  requireDerivedThresholdContext,
  type DerivedMetricId,
  type DerivedMetricRecord,
} from '../content/derivedMetrics'
import type {
  DerivedEpisodeFlowResult,
  DerivedEpisodeInput,
  DerivedMeasurementEpisode,
} from '../content/derivedMeasurementEpisodes'
import { checkPpvValidity } from './calculations'
import { roundTo } from './calculations'

export type DerivedResultStatus = 'available' | 'available-with-caution' | 'withheld'

export const derivedResultStatusLabels: Readonly<Record<DerivedResultStatus, string>> =
  Object.freeze({
    available: 'Available',
    'available-with-caution': 'Available with caution',
    withheld: 'Withheld',
  })

export interface DerivedDependencyLedgerRow {
  readonly inputId: string
  readonly label: string
  readonly value: number | null
  readonly unit: string
  readonly provenance: CardiacOutputInputStatus
  readonly provenanceLabel: string
  readonly measurementEpisodeId: string
  readonly convention: string | null
  readonly valid: boolean
  readonly note: string
  /** Exactly what the surface prints for this row. */
  readonly display: string
}

export interface DerivedGradientAccount {
  readonly label: string
  readonly valueMmHg: number | null
  readonly display: string
}

export interface DerivedSensitivityAccount {
  readonly inputLabel: string
  readonly perturbation: number
  readonly baseline: number
  readonly perturbedLow: number
  readonly perturbedHigh: number
  readonly note: string
}

export interface DerivedThresholdDisplay {
  readonly contextId: string
  readonly classificationLabel: string
  readonly statement: string
  readonly population: string
  readonly notUniversal: string
}

export interface DerivedMetricEvaluation {
  readonly metricId: DerivedMetricId
  readonly metricName: string
  readonly shortLabel: string
  readonly status: DerivedResultStatus
  readonly value: number | null
  readonly unit: string
  /** The flow method behind the result, when the metric consumes a flow. */
  readonly flowMethodId: string | null
  readonly flowMethodLabel: string | null
  /** The sub-episode tags the used inputs actually came from. */
  readonly measurementEpisodeIds: readonly string[]
  readonly ledger: readonly DerivedDependencyLedgerRow[]
  readonly gradientAccounts: readonly DerivedGradientAccount[]
  readonly formulaAccount: readonly string[]
  readonly mathematicalValidityReasons: readonly string[]
  readonly clinicalValidityReasons: readonly string[]
  readonly cautions: readonly string[]
  readonly sensitivity: DerivedSensitivityAccount | null
  readonly thresholdContexts: readonly DerivedThresholdDisplay[]
  readonly textEquivalent: string
}

export interface DerivedFlowResultSet {
  readonly flow: DerivedEpisodeFlowResult | null
  readonly flowMethodLabel: string
  readonly results: readonly DerivedMetricEvaluation[]
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export const METHOD_UNKNOWN_LABEL = 'Cardiac-output method not established'

export function derivedFlowMethodLabel(flow: DerivedEpisodeFlowResult | null): string {
  if (!flow) return 'No cardiac-output result in this episode'
  if (flow.methodId === 'method-unknown') return METHOD_UNKNOWN_LABEL
  return cardiacOutputMethodById.get(flow.methodId)?.name ?? flow.methodId
}

function episodeInput(
  episode: DerivedMeasurementEpisode,
  inputId: string,
): DerivedEpisodeInput | null {
  return episode.inputs.find((candidate) => candidate.inputId === inputId) ?? null
}

/**
 * Materialize the values a metric's calculation reads, including the two calculated inputs the
 * episodes do not author directly: cardiac output (from the flow result) and stroke volume (from
 * flow and heart rate). Provenance for both is `calculated`, never anything else.
 */
function resolveLedger(
  metric: DerivedMetricRecord,
  episode: DerivedMeasurementEpisode,
  flow: DerivedEpisodeFlowResult | null,
): {
  rows: DerivedDependencyLedgerRow[]
  values: Record<string, number>
  problems: { mathematical: string[]; clinical: string[] }
} {
  const rows: DerivedDependencyLedgerRow[] = []
  const values: Record<string, number> = {}
  const mathematical: string[] = []
  const clinical: string[] = []

  const heartRate = episodeInput(episode, 'heartRateBpm')
  const flowValue = flow && flow.status === 'accepted' ? flow.valueLMin : null
  const strokeVolume =
    finite(flowValue) && finite(heartRate?.value) && (heartRate?.value ?? 0) > 0
      ? ((flowValue as number) * 1000) / (heartRate!.value as number)
      : null

  for (const dependency of metric.dependencies) {
    const definition = requireDerivedInputDefinition(dependency.inputId)

    if (dependency.inputId === 'cardiacOutputLMin') {
      const provenance: CardiacOutputInputStatus = 'calculated'
      const display =
        flow === null
          ? 'No cardiac-output result exists in this episode.'
          : flow.status === 'withheld'
            ? `Withheld by its own method: ${flow.withheldReasons.join(' ')}`
            : `${flowValue} L/min · ${derivedFlowMethodLabel(flow)}`
      rows.push({
        inputId: dependency.inputId,
        label: definition.label,
        value: flowValue ?? null,
        unit: definition.unit,
        provenance,
        provenanceLabel: cardiacOutputInputStatusLabels[provenance].label,
        measurementEpisodeId: flow?.measurementEpisodeId ?? 'none',
        convention: null,
        valid: finite(flowValue),
        note: flow?.acquisitionNote ?? 'No cardiac-output acquisition exists in this episode.',
        display,
      })
      if (flow === null) {
        clinical.push('No accepted cardiac-output result exists in this episode.')
      } else if (flow.status === 'withheld') {
        clinical.push(
          `The ${derivedFlowMethodLabel(flow).toLowerCase()} result was itself withheld (${flow.withheldReasons.join(' ')}), so every value that depends on it is withheld rather than recalculated from stale inputs.`,
        )
      } else if (flow.methodId === 'method-unknown') {
        clinical.push(
          'The cardiac-output method is unknown. A flow with no acquisition account cannot feed a derived value.',
        )
      } else if (finite(flowValue)) {
        values[dependency.inputId] = flowValue as number
      }
      continue
    }

    if (dependency.inputId === 'strokeVolumeMl') {
      const provenance: CardiacOutputInputStatus = 'calculated'
      rows.push({
        inputId: dependency.inputId,
        label: definition.label,
        value: strokeVolume === null ? null : roundTo(strokeVolume, 1),
        unit: definition.unit,
        provenance,
        provenanceLabel: cardiacOutputInputStatusLabels[provenance].label,
        measurementEpisodeId: flow?.measurementEpisodeId ?? 'none',
        convention: null,
        valid: strokeVolume !== null,
        note: 'Calculated from cardiac output and heart rate; it inherits both, including the flow method.',
        display:
          strokeVolume === null
            ? 'Cannot be calculated: it needs an accepted cardiac output and a positive heart rate.'
            : `${roundTo(strokeVolume, 1)} mL per beat · calculated from CO and HR`,
      })
      if (strokeVolume === null) {
        clinical.push(
          'Stroke volume cannot be calculated, because it needs an accepted cardiac output and a positive heart rate from this episode.',
        )
        if (flow !== null && flow.status === 'accepted' && flow.methodId === 'method-unknown') {
          clinical.push(
            'The cardiac-output method is unknown. A flow with no acquisition account cannot feed a derived value.',
          )
        }
      } else if (flow?.methodId === 'method-unknown') {
        clinical.push(
          'The cardiac-output method is unknown. A flow with no acquisition account cannot feed a derived value.',
        )
      } else {
        values[dependency.inputId] = strokeVolume
      }
      continue
    }

    const authored = episodeInput(episode, dependency.inputId)
    if (!authored) {
      rows.push({
        inputId: dependency.inputId,
        label: definition.label,
        value: null,
        unit: definition.unit,
        provenance: 'entered',
        provenanceLabel: 'Missing',
        measurementEpisodeId: 'none',
        convention: null,
        valid: false,
        note: 'Not recorded in this episode.',
        display: 'Not recorded in this episode.',
      })
      mathematical.push(`${definition.label} was not recorded in this episode.`)
      continue
    }

    const conventionText = authored.convention ? authored.convention.replaceAll('-', ' ') : null
    rows.push({
      inputId: dependency.inputId,
      label: definition.label,
      value: authored.value,
      unit: authored.recordedUnit ?? definition.unit,
      provenance: authored.provenance,
      provenanceLabel: cardiacOutputInputStatusLabels[authored.provenance].label,
      measurementEpisodeId: authored.measurementEpisodeId,
      convention: conventionText,
      valid: authored.valid,
      note: authored.note,
      display:
        authored.value === null
          ? `Missing — ${authored.note}`
          : `${authored.value} ${authored.recordedUnit ?? definition.unit}${conventionText ? ` · ${conventionText}` : ''}${authored.valid ? '' : ' · INVALID'}`,
    })

    if (authored.value === null || !finite(authored.value)) {
      mathematical.push(`${definition.label} is missing or not a finite number.`)
      continue
    }
    if (authored.recordedUnit && authored.recordedUnit !== definition.unit) {
      mathematical.push(
        `${definition.label} was recorded in ${authored.recordedUnit}, and this formula needs ${definition.unit}; the units cannot be reconciled without a conversion this episode does not carry.`,
      )
      continue
    }
    if (!authored.valid) {
      clinical.push(`A required input is invalid: ${definition.label} — ${authored.note}`)
      continue
    }
    if (
      definition.requiredConvention !== null &&
      authored.convention !== definition.requiredConvention
    ) {
      clinical.push(
        `${definition.label} was obtained as ${(authored.convention ?? 'an unstated convention').replaceAll('-', ' ')}, but this formula requires the ${definition.requiredConvention.replaceAll('-', ' ')} value. One convention cannot silently stand in for the other.`,
      )
      continue
    }
    if (!dependency.acceptableProvenance.includes(authored.provenance)) {
      clinical.push(
        `${definition.label} reached the record as ${cardiacOutputInputStatusLabels[authored.provenance].label.toLowerCase()}, which this formula does not accept for that input${authored.provenance === 'assumed' ? ' — an assumption cannot be presented as a measurement' : ''}.`,
      )
      continue
    }
    values[dependency.inputId] = authored.value
  }

  return { rows, values, problems: { mathematical, clinical } }
}

/**
 * Evaluate one metric inside one episode, against one flow account.
 *
 * `flow` is the cardiac-output result this evaluation is allowed to consume; passing a different
 * flow produces a different, separately labeled result set. Averaging two flows before calling this
 * is exactly the operation the station teaches against, and nothing here supports it.
 */
export function evaluateDerivedMetric(
  metricId: DerivedMetricId,
  episode: DerivedMeasurementEpisode,
  flow: DerivedEpisodeFlowResult | null,
): DerivedMetricEvaluation {
  const metric = requireDerivedMetric(metricId)
  const usesFlow = metric.requiresFlowMethod
  const flowForMetric = usesFlow ? flow : null
  const { rows, values, problems } = resolveLedger(metric, episode, flowForMetric)
  const mathematical = [...problems.mathematical]
  const clinical = [...problems.clinical]
  const cautions: string[] = []

  /* Episode coherence: every used tag must be one tag. */
  const usedTags = new Set<string>(
    rows
      .filter((row) => row.valid && row.value !== null && row.measurementEpisodeId !== 'none')
      .map((row) => row.measurementEpisodeId),
  )
  if (usedTags.size > 1) {
    clinical.push(
      `Its inputs come from different measurement episodes (${[...usedTags].sort().join(' and ')}), so the equation would combine two circulatory states into one number. ${episode.stateNote}`,
    )
  }

  if (episode.shuntPresent && usesFlow) {
    clinical.push(
      'An intracardiac shunt is present, so pulmonary and systemic flow are two different quantities and this simple equation does not represent the circulation it claims to describe.',
    )
  }

  /* Domain checks, from the canonical record. */
  for (const positiveId of metric.requiredPositiveInputIds) {
    const value = values[positiveId]
    if (finite(value) && value <= 0) {
      const definition = requireDerivedInputDefinition(positiveId)
      mathematical.push(
        value === 0
          ? `${definition.label} is zero, and a zero ${metric.dependencies.find((d) => d.inputId === positiveId)?.role === 'denominator' ? 'denominator cannot be divided by' : 'value cannot feed this equation'}.`
          : `${definition.label} is ${value} ${definition.unit}, which this equation cannot use.`,
      )
    }
  }

  const gradientAccounts: DerivedGradientAccount[] = []
  for (const gradient of metric.gradients) {
    const minuend = values[gradient.minuendInputId]
    const subtrahend = values[gradient.subtrahendInputId]
    const value = finite(minuend) && finite(subtrahend) ? roundTo(minuend - subtrahend, 1) : null
    gradientAccounts.push({
      label: gradient.label,
      valueMmHg: value,
      display:
        value === null
          ? `${gradient.label}: not computable from the available inputs.`
          : `${gradient.label} = ${value} mmHg`,
    })
    if (value !== null && gradient.mustBePositive && value <= 0) {
      mathematical.push(
        value === 0
          ? `The ${gradient.label} is zero, so the equation has nothing to divide or no difference to report.`
          : `The ${gradient.label} is ${value} mmHg. A negative difference is not a quantity this equation is written for — it is evidence that two measurements disagree, and it is preserved here as that evidence rather than clamped or repaired.`,
      )
    }
  }

  /* The physiologic validity screen, where the record declares one. */
  if (metric.validityScreen === 'fluid-responsiveness') {
    if (!episode.ppvContext) {
      clinical.push(
        'No rhythm-and-ventilation validity screen was performed in this episode, so the number has no interpretable meaning regardless of the arithmetic.',
      )
    } else {
      const screen = checkPpvValidity(episode.ppvContext)
      if (!screen.valid) clinical.push(...screen.reasons)
    }
  }

  /* Cautions that do not withhold. */
  if (
    usesFlow &&
    flowForMetric?.status === 'accepted' &&
    flowForMetric.methodId === 'fick-assumed-vo2'
  ) {
    cautions.push(
      'The flow behind this value is a Fick estimate with an assumed oxygen uptake. Every value calculated from it inherits that assumption and moves in proportion to the substituted figure.',
    )
  }
  if (usesFlow && flowForMetric?.status === 'accepted') {
    const acceptedFlows = episode.flowResults.filter((candidate) => candidate.status === 'accepted')
    if (acceptedFlows.length > 1) {
      cautions.push(
        'Two acceptable cardiac-output methods disagree in this episode, so this value is method-dependent: the other method produces a different result, and the two are kept as separate labeled sets rather than averaged.',
      )
    }
  }

  const withheld = mathematical.length > 0 || clinical.length > 0
  const missingRequired = metric.dependencies.some((dependency) => !(dependency.inputId in values))
  const value =
    !withheld && !missingRequired
      ? roundTo(metric.calculate(values), metric.displayPrecision)
      : null
  /* A guard, not a repair: if arithmetic still produced a nonfinite value, withhold loudly. */
  if (value !== null && !Number.isFinite(value)) {
    mathematical.push('The calculation produced a nonfinite value, so no number is displayed.')
  }
  const finalStatus: DerivedResultStatus =
    mathematical.length > 0 || clinical.length > 0
      ? 'withheld'
      : cautions.length > 0
        ? 'available-with-caution'
        : 'available'
  const finalValue = finalStatus === 'withheld' ? null : value

  let sensitivity: DerivedSensitivityAccount | null = null
  const focus = episode.sensitivityFocus
  if (
    focus &&
    focus.metricId === metric.id &&
    finalValue !== null &&
    finite(values[focus.inputId])
  ) {
    const definition = requireDerivedInputDefinition(focus.inputId)
    const low = metric.calculate({
      ...values,
      [focus.inputId]: values[focus.inputId] - focus.perturbation,
    })
    const high = metric.calculate({
      ...values,
      [focus.inputId]: values[focus.inputId] + focus.perturbation,
    })
    if (Number.isFinite(low) && Number.isFinite(high)) {
      sensitivity = {
        inputLabel: definition.label,
        perturbation: focus.perturbation,
        baseline: finalValue,
        perturbedLow: roundTo(Math.min(low, high), metric.displayPrecision),
        perturbedHigh: roundTo(Math.max(low, high), metric.displayPrecision),
        note: focus.note,
      }
      cautions.push(focus.note)
    }
  }
  const statusWithSensitivity: DerivedResultStatus =
    finalStatus === 'available' && cautions.length > 0 ? 'available-with-caution' : finalStatus

  const methodLabel = usesFlow ? derivedFlowMethodLabel(flowForMetric) : null
  const formulaAccount: string[] = [
    `Formula: ${metric.shortLabel} = ${metric.formulaText}`,
    ...gradientAccounts.map((account) => account.display),
    ...metric.unitAccount,
    statusWithSensitivity === 'withheld'
      ? 'The calculation is not carried out, because the inputs above do not support it.'
      : `Result: ${finalValue}${metric.outputUnit ? ` ${metric.outputUnit}` : ''}${methodLabel ? ` · calculated using ${methodLabel.toLowerCase()}` : ''}`,
  ]

  const thresholdContexts: DerivedThresholdDisplay[] =
    statusWithSensitivity === 'withheld'
      ? []
      : metric.thresholdContextIds.map((contextId) => {
          const context = requireDerivedThresholdContext(contextId)
          return {
            contextId,
            classificationLabel: derivedThresholdClassificationLabels[context.classification],
            statement: context.statement,
            population: context.population,
            notUniversal: context.notUniversal,
          }
        })

  const ledgerText = rows
    .map((row) => `${row.label} — ${row.provenanceLabel.toLowerCase()}: ${row.display}.`)
    .join(' ')
  const textEquivalent = [
    `${metric.name} (${metric.shortLabel}) — ${derivedResultStatusLabels[statusWithSensitivity].toLowerCase()}.`,
    methodLabel ? `Flow method: ${methodLabel}.` : '',
    `Dependency ledger: ${ledgerText}`,
    formulaAccount.join(' '),
    mathematical.length > 0 ? `Not calculable: ${mathematical.join(' ')}` : '',
    clinical.length > 0 ? `Not clinically interpretable: ${clinical.join(' ')}` : '',
    cautions.length > 0 ? `Cautions: ${cautions.join(' ')}` : '',
    sensitivity
      ? `Sensitivity: a ${sensitivity.perturbation} ${requireDerivedInputDefinition(focus!.inputId).unit} change in ${sensitivity.inputLabel.toLowerCase()} moves the result between ${sensitivity.perturbedLow} and ${sensitivity.perturbedHigh} around ${sensitivity.baseline}.`
      : '',
    thresholdContexts.length > 0
      ? `Context: ${thresholdContexts.map((context) => `${context.classificationLabel} — ${context.statement} ${context.notUniversal}`).join(' ')}`
      : '',
  ]
    .filter((part) => part.trim().length > 0)
    .join(' ')

  return {
    metricId: metric.id,
    metricName: metric.name,
    shortLabel: metric.shortLabel,
    status: statusWithSensitivity,
    value: finalValue,
    unit: metric.outputUnit,
    flowMethodId: usesFlow ? (flowForMetric?.methodId ?? null) : null,
    flowMethodLabel: methodLabel,
    measurementEpisodeIds: [...usedTags].sort(),
    ledger: rows,
    gradientAccounts,
    formulaAccount,
    mathematicalValidityReasons: mathematical,
    clinicalValidityReasons: clinical,
    cautions,
    sensitivity,
    thresholdContexts,
    textEquivalent,
  }
}

/**
 * Every metric, evaluated once per accepted flow account.
 *
 * When two methods are both acceptable the episode yields two labeled result sets — never one
 * blended set — and when no flow exists the pressure-only metrics still get their own evaluation,
 * which is the selective-invalidation behavior the station exists to show.
 */
export function evaluateDerivedEpisode(
  episode: DerivedMeasurementEpisode,
): readonly DerivedFlowResultSet[] {
  const flows = episode.flowResults.filter((flow) => flow.status === 'accepted')
  const flowAccounts: (DerivedEpisodeFlowResult | null)[] =
    flows.length > 0 ? [...flows] : [episode.flowResults[0] ?? null]
  return flowAccounts.map((flow) => ({
    flow,
    flowMethodLabel: derivedFlowMethodLabel(flow),
    results: derivedMetricRecords.map((metric) => evaluateDerivedMetric(metric.id, episode, flow)),
  }))
}

/* ------------------------------------------------------------------ *
 * Section completion — the evidence the station requires
 * ------------------------------------------------------------------ */

/**
 * The four hands-on checks the workbench records into the simulation's signal-validation list.
 * They are ordinary `VALIDATE_SIGNAL` checks, so the exported objective predicate stays a function
 * of simulation state and a suite can construct any combination directly.
 */
export const DERIVED_SECTION_CHECKS = Object.freeze({
  dependencyChain: 'derived-dependency-chain-validated',
  withheldForValidity: 'derived-withheld-for-input-validity',
  selectivePreserved: 'derived-selective-invalidation-preserved',
  methodTraced: 'derived-flow-method-traced',
})

export interface DerivedSectionEvidence {
  readonly signalValidationChecks: readonly string[]
  /** Whether the learner separated measured quantities from calculated ones in Recognize. */
  readonly measuredCalculatedSeparated: boolean
  /** Whether a two-method disagreement was preserved without averaging. */
  readonly disagreementPreservedWithoutAveraging: boolean
  /** Whether a phenotype-specific boundary was read inside its context rather than universally. */
  readonly thresholdContextResolved: boolean
}

export interface DerivedSectionCompletion {
  readonly measuredCalculatedSeparated: boolean
  readonly dependencyChainValidated: boolean
  readonly withheldForValidity: boolean
  readonly selectiveInvalidationPreserved: boolean
  readonly flowMethodTraced: boolean
  readonly disagreementPreservedWithoutAveraging: boolean
  readonly thresholdContextResolved: boolean
  readonly complete: boolean
  /** What is still outstanding, in the learner's terms. */
  readonly outstanding: readonly string[]
}

/**
 * What it takes to have worked through the derived-hemodynamics section.
 *
 * The predicate this replaces was one line: a `derived-reviewed` check set by a single button under
 * the formula reference. Opening a reference is not evidence that anything was traced, withheld,
 * preserved, or kept in context, which is why each requirement here is earned by a separate graded
 * interaction. Nothing here touches persisted progress payloads, storage keys, completion-rule ids,
 * or scoring — this is a Learn-local judgement about whether the section's own work was done.
 */
export function derivedHemodynamicsSectionCompletion(
  evidence: DerivedSectionEvidence,
): DerivedSectionCompletion {
  const checks = new Set(evidence.signalValidationChecks)
  const dependencyChainValidated = checks.has(DERIVED_SECTION_CHECKS.dependencyChain)
  const withheldForValidity = checks.has(DERIVED_SECTION_CHECKS.withheldForValidity)
  const selectiveInvalidationPreserved = checks.has(DERIVED_SECTION_CHECKS.selectivePreserved)
  const flowMethodTraced = checks.has(DERIVED_SECTION_CHECKS.methodTraced)

  const outstanding: string[] = []
  if (!evidence.measuredCalculatedSeparated) {
    outstanding.push(
      'Separate the measured quantities from the calculated ones in the provenance drill.',
    )
  }
  if (!dependencyChainValidated) {
    outstanding.push('Validate one complete dependency chain: name every input PVR requires.')
  }
  if (!withheldForValidity) {
    outstanding.push(
      'Withhold a metric for the correct input-validity reason in the invalid-wedge episode.',
    )
  }
  if (!selectiveInvalidationPreserved) {
    outstanding.push(
      'Keep the unaffected metrics available in that same episode — one invalid input does not invalidate everything.',
    )
  }
  if (!flowMethodTraced) {
    outstanding.push('Trace a flow-dependent result to the acquisition method that produced it.')
  }
  if (!evidence.disagreementPreservedWithoutAveraging) {
    outstanding.push(
      'Work through the two-method disagreement and preserve it without averaging the flows.',
    )
  }
  if (!evidence.thresholdContextResolved) {
    outstanding.push(
      'Read the phenotype-specific boundary inside its population rather than universally.',
    )
  }

  return {
    measuredCalculatedSeparated: evidence.measuredCalculatedSeparated,
    dependencyChainValidated,
    withheldForValidity,
    selectiveInvalidationPreserved,
    flowMethodTraced,
    disagreementPreservedWithoutAveraging: evidence.disagreementPreservedWithoutAveraging,
    thresholdContextResolved: evidence.thresholdContextResolved,
    complete: outstanding.length === 0,
    outstanding,
  }
}
