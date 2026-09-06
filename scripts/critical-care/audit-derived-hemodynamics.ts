/**
 * The numeric truth surface behind H5, printed as episode-by-episode tables.
 *
 * The tests assert specific invariants. This exists for the questions a test cannot ask well: what
 * every metric in every episode actually evaluates to, under every accepted flow method, with its
 * inputs, units, provenance, episode tags, status, reasons, and threshold context laid out for a
 * reviewer to read and judge.
 *
 * It also re-runs the assertions that would otherwise be silent failures: a nonfinite or clamped
 * value, a calculated quantity labeled measured, a mixed-episode result that calculated anyway, a
 * flow-dependent result with no method name, an indexed value with no body-size provenance, a
 * PAWP convention substitution, a threshold with no population, or two flows averaged into one set.
 *
 * Run it directly; there is no package script:
 *
 *   npx tsx scripts/critical-care/audit-derived-hemodynamics.ts
 */

import {
  derivedClaimVerifications,
  derivedMeasurementEpisodes,
  derivedMetricRecords,
  derivedMethodDisagreementDecision,
  derivedThresholdContexts,
  derivedTransferComparisonDecision,
  derivedUnsupportedClaimTopics,
  requireDerivedInputDefinition,
  requireDerivedMeasurementEpisode,
  type DerivedMeasurementEpisode,
} from '../../src/features/icu-hemodynamics/content'
import {
  evaluateDerivedEpisode,
  type DerivedMetricEvaluation,
} from '../../src/features/icu-hemodynamics/engine'

const problems: string[] = []

function flag(message: string): void {
  problems.push(message)
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + ' '.repeat(width - value.length)
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): void {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length)),
  )
  console.log(headers.map((header, index) => pad(header, widths[index])).join('  '))
  console.log(widths.map((width) => '-'.repeat(width)).join('  '))
  for (const row of rows) {
    console.log(row.map((cell, index) => pad(cell ?? '', widths[index])).join('  '))
  }
  console.log('')
}

/* ------------------------------------------------------------------ *
 * Hand-calculated expectations for the stable fixtures
 * ------------------------------------------------------------------ */

/**
 * Recomputed by hand from the authored inputs, not through the helper under audit:
 *   ep-coherent-complete: HR 78, MAP 86, RAP 8, mPAP 24, PASP 38, PADP 16, PAWP 14, BSA 1.9,
 *   CO 5.2 by thermodilution, PPmax 46, PPmin 41.
 *   ep-method-disagreement: MAP 90, RAP 9, mPAP 34, PAWP 12, CO 4.1 (TD) and 5.6 (Fick).
 */
const HAND_CALCULATED: readonly {
  episodeId: string
  methodLabel: string
  metricId: string
  value: number
}[] = [
  {
    episodeId: 'ep-coherent-complete',
    methodLabel: 'Bolus thermodilution',
    metricId: 'systemicVascularResistance',
    value: 1200,
  },
  {
    episodeId: 'ep-coherent-complete',
    methodLabel: 'Bolus thermodilution',
    metricId: 'cardiacIndexLMinM2',
    value: 2.7,
  },
  {
    episodeId: 'ep-coherent-complete',
    methodLabel: 'Bolus thermodilution',
    metricId: 'strokeVolumeMl',
    value: 67,
  },
  {
    episodeId: 'ep-coherent-complete',
    methodLabel: 'Bolus thermodilution',
    metricId: 'pulmonaryVascularResistance',
    value: 1.9,
  },
  {
    episodeId: 'ep-coherent-complete',
    methodLabel: 'Bolus thermodilution',
    metricId: 'cardiacPowerOutputW',
    value: 0.99,
  },
  {
    episodeId: 'ep-coherent-complete',
    methodLabel: 'Bolus thermodilution',
    metricId: 'pulmonaryArteryPulsatilityIndex',
    value: 2.75,
  },
  {
    episodeId: 'ep-coherent-complete',
    methodLabel: 'Bolus thermodilution',
    metricId: 'pulsePressureVariationPercent',
    value: 11,
  },
  {
    episodeId: 'ep-method-disagreement',
    methodLabel: 'Bolus thermodilution',
    metricId: 'systemicVascularResistance',
    value: 1580,
  },
  {
    episodeId: 'ep-method-disagreement',
    methodLabel: 'Direct Fick with measured oxygen uptake',
    metricId: 'systemicVascularResistance',
    value: 1157,
  },
  {
    episodeId: 'ep-method-disagreement',
    methodLabel: 'Bolus thermodilution',
    metricId: 'pulmonaryVascularResistance',
    value: 5.4,
  },
  {
    episodeId: 'ep-method-disagreement',
    methodLabel: 'Direct Fick with measured oxygen uptake',
    metricId: 'pulmonaryVascularResistance',
    value: 3.9,
  },
]

/* ------------------------------------------------------------------ *
 * 1. Every metric, every episode, every accepted method
 * ------------------------------------------------------------------ */

console.log('\n=== 1. Derived metrics per episode and flow method ===\n')

function ledgerSummary(evaluation: DerivedMetricEvaluation): string {
  return evaluation.ledger
    .map((row) => `${row.label.split(' ')[0]}=${row.value ?? '—'}${row.valid ? '' : '!'}`)
    .join(' ')
}

const rows: string[][] = []
for (const episode of derivedMeasurementEpisodes) {
  const sets = evaluateDerivedEpisode(episode)

  const acceptedFlows = episode.flowResults.filter((flow) => flow.status === 'accepted')
  if (acceptedFlows.length > 1 && sets.length !== acceptedFlows.length) {
    flag(
      `${episode.id}: ${acceptedFlows.length} accepted methods produced ${sets.length} result sets — methods may have been combined.`,
    )
  }

  for (const set of sets) {
    for (const result of set.results) {
      /* Silent-failure re-checks. */
      if (result.value !== null && !Number.isFinite(result.value)) {
        flag(`${episode.id}/${set.flowMethodLabel}/${result.metricId}: nonfinite displayed value.`)
      }
      if (result.status !== 'withheld' && result.value === null) {
        flag(`${episode.id}/${set.flowMethodLabel}/${result.metricId}: available but valueless.`)
      }
      if (result.status === 'withheld' && result.value !== null) {
        flag(
          `${episode.id}/${set.flowMethodLabel}/${result.metricId}: withheld yet showing a value.`,
        )
      }
      if (
        result.status === 'withheld' &&
        result.mathematicalValidityReasons.length === 0 &&
        result.clinicalValidityReasons.length === 0
      ) {
        flag(`${episode.id}/${set.flowMethodLabel}/${result.metricId}: withheld without a reason.`)
      }
      const metric = derivedMetricRecords.find((candidate) => candidate.id === result.metricId)!
      if (metric.requiresFlowMethod && result.status !== 'withheld' && !result.flowMethodLabel) {
        flag(
          `${episode.id}/${result.metricId}: a flow-dependent value is displayed with no method name.`,
        )
      }
      for (const ledgerRow of result.ledger) {
        const definition = requireDerivedInputDefinition(ledgerRow.inputId)
        if (definition.isCalculated && ledgerRow.provenance === 'measured') {
          flag(
            `${episode.id}/${result.metricId}: calculated input ${ledgerRow.inputId} labeled measured.`,
          )
        }
        if (ledgerRow.value !== null && !Number.isFinite(ledgerRow.value)) {
          flag(`${episode.id}/${result.metricId}: ledger row ${ledgerRow.inputId} nonfinite.`)
        }
      }
      /* A negative required-positive gradient must never survive into an available value. */
      for (const account of result.gradientAccounts) {
        const gradient = metric.gradients.find((candidate) => candidate.label === account.label)
        if (
          gradient?.mustBePositive &&
          account.valueMmHg !== null &&
          account.valueMmHg <= 0 &&
          result.status !== 'withheld'
        ) {
          flag(
            `${episode.id}/${result.metricId}: ${account.label} = ${account.valueMmHg} mmHg was clamped or ignored instead of withholding.`,
          )
        }
      }
      /* Episode coherence: an available result may span exactly one tag. */
      if (result.status !== 'withheld' && result.measurementEpisodeIds.length > 1) {
        flag(
          `${episode.id}/${result.metricId}: calculated across ${result.measurementEpisodeIds.join('+')}.`,
        )
      }
      /* Indexed values need body-size provenance. */
      if (metric.requiresBodySurfaceArea && result.status !== 'withheld') {
        const bsa = episode.inputs.find((candidate) => candidate.inputId === 'bodySurfaceAreaM2')
        if (!bsa || bsa.value === null || !bsa.valid) {
          flag(`${episode.id}/${result.metricId}: indexed value without body-size provenance.`)
        }
      }
      /* PAWP convention: an available PVR/PVRI must have consumed the mean-end-expiration wedge. */
      if (
        (result.metricId === 'pulmonaryVascularResistance' ||
          result.metricId === 'pulmonaryVascularResistanceIndex') &&
        result.status !== 'withheld'
      ) {
        const wedge = episode.inputs.find((candidate) => candidate.inputId === 'pawpMeanMmHg')
        if (wedge?.convention !== 'mean-end-expiration') {
          flag(`${episode.id}/${result.metricId}: calculated from a non-mean PAWP convention.`)
        }
      }
      /* Threshold context must carry population wherever it is displayed. */
      for (const context of result.thresholdContexts) {
        if (context.population.trim().length === 0 || context.notUniversal.trim().length === 0) {
          flag(
            `${episode.id}/${result.metricId}: threshold context without population or boundary.`,
          )
        }
      }

      rows.push([
        episode.id,
        set.flowMethodLabel,
        result.shortLabel,
        `${result.metricId}`,
        result.status,
        result.value === null ? '—' : `${result.value}${result.unit ? ` ${result.unit}` : ''}`,
        result.flowMethodLabel ?? 'no flow needed',
        result.measurementEpisodeIds.join('+') || '—',
        String(result.mathematicalValidityReasons.length + result.clinicalValidityReasons.length),
        String(result.cautions.length),
        result.sensitivity
          ? `${result.sensitivity.perturbedLow}–${result.sensitivity.perturbedHigh}`
          : '—',
        String(result.thresholdContexts.length),
        ledgerSummary(result).slice(0, 46),
      ])
    }
  }
}

table(
  [
    'episode',
    'flow set',
    'label',
    'metric',
    'status',
    'value',
    'method shown',
    'tags',
    '#reasons',
    '#cautions',
    'sensitivity',
    '#ctx',
    'inputs',
  ],
  rows,
)

/* ------------------------------------------------------------------ *
 * 2. Hand-calculated agreement
 * ------------------------------------------------------------------ */

console.log('=== 2. Hand-calculated fixtures ===\n')

table(
  ['episode', 'method', 'metric', 'by hand', 'evaluated', 'agree'],
  HAND_CALCULATED.map((expectation) => {
    const episode = requireDerivedMeasurementEpisode(expectation.episodeId)
    const set = evaluateDerivedEpisode(episode).find(
      (candidate) => candidate.flowMethodLabel === expectation.methodLabel,
    )
    const result = set?.results.find((candidate) => candidate.metricId === expectation.metricId)
    const agree = finite(result?.value ?? null) && result?.value === expectation.value
    if (!agree) {
      flag(
        `${expectation.episodeId}/${expectation.metricId} (${expectation.methodLabel}): hand value ${expectation.value}, evaluator ${result?.value ?? 'withheld'}.`,
      )
    }
    return [
      expectation.episodeId,
      expectation.methodLabel,
      expectation.metricId,
      String(expectation.value),
      result?.value === null || result === undefined ? 'withheld' : String(result.value),
      agree ? 'yes' : 'NO',
    ]
  }),
)

/**
 * The averaged-flow check: with the disagreement episode's flows (4.1 and 5.6 L/min), a combined
 * 4.85 L/min would put PVR at 4.5 WU and SVR at 1336. Neither may appear in any set.
 */
{
  const episode = requireDerivedMeasurementEpisode('ep-method-disagreement')
  const values = evaluateDerivedEpisode(episode).flatMap((set) =>
    set.results.map((result) => result.value),
  )
  if (values.includes(4.5) || values.includes(1336)) {
    flag(
      'ep-method-disagreement: a value derived from the averaged flows appeared in a result set.',
    )
  }
}

/* ------------------------------------------------------------------ *
 * 3. Thresholds, classifications, and source boundaries
 * ------------------------------------------------------------------ */

console.log('=== 3. Threshold contexts ===\n')

table(
  ['context', 'metric', 'classification', 'population'],
  derivedThresholdContexts.map((context) => {
    if (context.classification === 'treatment-target' || context.classification === 'unsupported') {
      flag(`${context.id}: displayed with a refused classification.`)
    }
    return [context.id, context.metricId, context.classification, context.population.slice(0, 58)]
  }),
)

console.log('=== 4. Verification depth per claim topic ===\n')

table(
  ['topic', 'depth', 'locator'],
  derivedClaimVerifications.map((verification) => [
    verification.topic,
    verification.depth,
    verification.locator ?? '—',
  ]),
)

console.log(`Declared source gaps: ${derivedUnsupportedClaimTopics().join(', ')}\n`)

/* Decision-shape re-checks: averaging is always offered and never defensible. */
for (const decision of [derivedMethodDisagreementDecision, derivedTransferComparisonDecision]) {
  const averaging = decision.options.filter((option) => option.verdict === 'averages-methods')
  if (averaging.length === 0) flag('A decision offers no averaging position to decline.')
  if (averaging.some((option) => option.id === decision.defensibleOptionId)) {
    flag('A decision marks averaging defensible.')
  }
}

/* ------------------------------------------------------------------ *
 * Verdict
 * ------------------------------------------------------------------ */

if (problems.length === 0) {
  console.log('No numeric or provenance problems found.\n')
} else {
  console.log(`${problems.length} problem(s):\n`)
  for (const problem of problems) console.log(`  - ${problem}`)
  console.log('')
  process.exitCode = 1
}
