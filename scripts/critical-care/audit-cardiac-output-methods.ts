/**
 * The numeric truth surface behind H4, printed as three tables.
 *
 * The tests assert specific invariants. This exists for the questions a test cannot ask well: what
 * every trial in every authored acquisition actually produced, what every Fick episode's oxygen
 * contents and denominators come to, and how far apart the two methods land in each comparison.
 * Those are numbers a reviewer reads and judges, not conditions code can check — and the module's
 * whole claim is that a number should be readable back to its acquisition.
 *
 * It also re-runs the assertions that would be silent failures rather than loud ones: an assumed
 * value carrying a measured label, an excluded trial reaching the accepted average, a result
 * printed without its method, a nonfinite or impossible quantity anywhere in the chain.
 *
 * Run it directly; there is no package script:
 *
 *   npx tsx scripts/critical-care/audit-cardiac-output-methods.ts
 */

import {
  cardiacOutputAcquisitionParameters,
  cardiacOutputComparisonScenarios,
  cardiacOutputMethods,
  cardiacOutputUnsupportedClaimTopics,
  CARDIAC_OUTPUT_VERIFICATION_DEPTH,
  type CardiacOutputComparisonScenario,
} from '../../src/features/icu-hemodynamics/content'
import {
  CARDIAC_OUTPUT_MODEL_CONSTANTS,
  canExcludeThermodilutionTrial,
  fickCardiacOutput,
  fickErrorAmplification,
  generateThermodilutionCurve,
  thermodilutionCurveFeatures,
  thermodilutionExclusionReasonsFor,
  thermodilutionSeriesSummary,
  type FickResult,
  type ThermodilutionTrial,
} from '../../src/features/icu-hemodynamics/engine'

const CONFIGURATION = {
  injectateVolumeMl: 10,
  injectateTemperatureC: 5,
  maximumTrials: 6,
  minimumAcceptedTrials: 3,
}

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
 * 1. Thermodilution trials, per authored acquisition
 * ------------------------------------------------------------------ */

function buildTrials(scenario: CardiacOutputComparisonScenario): readonly ThermodilutionTrial[] {
  return scenario.thermodilution.trialSpecs.map((spec) =>
    generateThermodilutionCurve({
      trueCardiacOutputLMin: scenario.thermodilution.trueCardiacOutputLMin,
      technique: spec.technique,
      configuration: CONFIGURATION,
      modifiers: {
        ...scenario.thermodilution.modifiers,
        catheterPosition: scenario.thermodilution.positionConfirmed ? 'pa' : 'rv',
      },
      seed: scenario.thermodilution.seed,
      sequence: spec.sequence,
    }),
  )
}

/**
 * The acceptance a reviewer should see: every technically usable trial reviewed and accepted, and
 * every trial with a reason excluded under that reason. Running the same rule the learner is held
 * to means the series numbers below are the ones a careful learner would reach.
 */
function decide(trials: readonly ThermodilutionTrial[]): readonly ThermodilutionTrial[] {
  return trials.map((trial) => {
    const reviewed = { ...trial, reviewed: true }
    const reasons = thermodilutionExclusionReasonsFor(reviewed)
    if (reasons.length > 0) {
      return { ...reviewed, accepted: false, exclusionReasonId: reasons[0].id }
    }
    return { ...reviewed, accepted: reviewed.quality === 'valid', exclusionReasonId: null }
  })
}

console.log('\n=== 1. Thermodilution trials ===\n')

const trialRows: string[][] = []
const seriesByScenario = new Map<string, ReturnType<typeof thermodilutionSeriesSummary>>()

for (const scenario of cardiacOutputComparisonScenarios) {
  const decided = decide(buildTrials(scenario))
  const summary = thermodilutionSeriesSummary(decided)
  seriesByScenario.set(scenario.id, summary)

  for (const trial of decided) {
    const features = thermodilutionCurveFeatures(trial)
    const reasons = thermodilutionExclusionReasonsFor(trial)

    if (!finite(trial.estimatedCardiacOutputLMin) || trial.estimatedCardiacOutputLMin <= 0) {
      flag(`${scenario.id} trial ${trial.sequence}: nonfinite or impossible cardiac output.`)
    }
    if (!finite(trial.curveArea) || trial.curveArea <= 0) {
      flag(`${scenario.id} trial ${trial.sequence}: nonfinite or impossible curve area.`)
    }
    if (features.peakChangeC >= 0) {
      flag(
        `${scenario.id} trial ${trial.sequence}: the peak excursion is not below baseline, which a cooler indicator cannot produce.`,
      )
    }
    if (
      trial.accepted === false &&
      !canExcludeThermodilutionTrial(trial, trial.exclusionReasonId ?? undefined)
    ) {
      flag(
        `${scenario.id} trial ${trial.sequence}: excluded without a technical reason this curve shows.`,
      )
    }
    if (trial.accepted === true && !trial.reviewed) {
      flag(
        `${scenario.id} trial ${trial.sequence}: accepted without the curve having been reviewed.`,
      )
    }

    trialRows.push([
      scenario.id,
      String(scenario.thermodilution.seed),
      String(trial.sequence),
      `${trial.technique.injectateVolumeMl}mL/${trial.technique.injectateTemperatureC}C/${trial.technique.injectionDurationSeconds}s/${trial.technique.respiratoryPhase}`,
      trial.quality,
      features.curveArea.toFixed(3),
      features.decayToTenthSeconds === null
        ? 'unfinished'
        : features.decayToTenthSeconds.toFixed(2),
      features.secondaryDisturbance ? 'yes' : 'no',
      trial.estimatedCardiacOutputLMin.toFixed(2),
      trial.accepted === true ? 'accepted' : trial.accepted === false ? 'excluded' : 'undecided',
      trial.exclusionReasonId ?? (reasons.length > 0 ? `available:${reasons[0].id}` : '—'),
    ])
  }
}

table(
  [
    'scenario',
    'seed',
    '#',
    'acquisition',
    'quality',
    'area',
    'decay10',
    '2nd',
    'CO L/min',
    'state',
    'reason',
  ],
  trialRows,
)

console.log('=== 1b. Accepted series ===\n')

table(
  [
    'scenario',
    'accepted',
    'excluded',
    'unreviewed',
    'average',
    'spread',
    'rel spread',
    'technique',
  ],
  cardiacOutputComparisonScenarios.map((scenario) => {
    const summary = seriesByScenario.get(scenario.id)!
    if (summary.averageLMin !== null) {
      const accepted = decide(buildTrials(scenario)).filter(
        (trial) => trial.accepted === true && trial.quality === 'valid' && trial.reviewed,
      )
      const recomputed =
        Math.round(
          (accepted.reduce((total, trial) => total + trial.estimatedCardiacOutputLMin, 0) /
            accepted.length) *
            10,
        ) / 10
      if (recomputed !== summary.averageLMin) {
        flag(
          `${scenario.id}: the accepted-series value is not the mean of the accepted trials (${summary.averageLMin} vs ${recomputed}).`,
        )
      }
      if (summary.acceptedTrialIds.length !== accepted.length) {
        flag(`${scenario.id}: the accepted-series membership does not match the accepted trials.`)
      }
    }
    return [
      scenario.id,
      String(summary.acceptedTrialIds.length),
      String(summary.excludedTrialIds.length),
      String(summary.unreviewedTrialIds.length),
      summary.averageLMin === null ? 'withheld' : `${summary.averageLMin.toFixed(1)} L/min`,
      summary.spreadLMin === null ? '—' : summary.spreadLMin.toFixed(2),
      summary.relativeSpread === null ? '—' : summary.relativeSpread.toFixed(3),
      summary.techniqueConsistent ? 'consistent' : 'mixed',
    ]
  }),
)

/* ------------------------------------------------------------------ *
 * 2. Fick episodes
 * ------------------------------------------------------------------ */

console.log('=== 2. Fick episodes ===\n')

function checkFick(label: string, result: FickResult): void {
  const method = cardiacOutputMethods.find((candidate) => candidate.id === result.methodId)
  if (!method) {
    flag(`${label}: the result names a method that is not in the model.`)
    return
  }
  if (method.vo2Provenance !== result.vo2Provenance) {
    flag(`${label}: the result's oxygen-uptake provenance disagrees with its method record.`)
  }
  const vo2Row = result.trace.find((row) => row.id === 'vo2')
  if (result.vo2Provenance === 'assumed' && vo2Row?.status !== 'assumed') {
    flag(`${label}: an assumed oxygen uptake is labeled "${vo2Row?.status}".`)
  }
  if (result.vo2Provenance === 'assumed' && /\bdirect\b/i.test(result.methodName)) {
    flag(`${label}: an assumed oxygen uptake is presented as direct Fick.`)
  }
  if (result.methodName.trim().length === 0) {
    flag(`${label}: a result was produced without its method name.`)
  }
  if (result.status === 'calculated') {
    if (!finite(result.cardiacOutputLMin) || (result.cardiacOutputLMin ?? 0) <= 0) {
      flag(`${label}: a calculated result is nonfinite or not positive.`)
    }
    if (!finite(result.contentDifferenceMlDl) || (result.contentDifferenceMlDl ?? 0) <= 0) {
      flag(`${label}: a result was calculated from a content difference at or below zero.`)
    }
    const expected =
      (result.trace.find((row) => row.id === 'vo2')?.value ?? Number.NaN) /
      ((result.contentDifferenceMlDl ?? Number.NaN) *
        CARDIAC_OUTPUT_MODEL_CONSTANTS.decilitersPerLiter)
    if (Math.abs(expected - (result.cardiacOutputLMin ?? 0)) > 0.02) {
      flag(`${label}: the printed result does not reconcile with its own inputs and units.`)
    }
  } else if (result.withheldReasons.length === 0) {
    flag(`${label}: a result was withheld without a reason.`)
  }
  for (const row of result.trace) {
    if (row.value !== null && !Number.isFinite(row.value)) {
      flag(`${label}: trace row ${row.id} carries a nonfinite value.`)
    }
    if (row.display.trim().length === 0) {
      flag(`${label}: trace row ${row.id} prints nothing.`)
    }
  }
}

const fickRows: string[][] = []
for (const scenario of cardiacOutputComparisonScenarios) {
  const result = fickCardiacOutput(scenario.fick)
  checkFick(scenario.id, result)
  const amplification = fickErrorAmplification(scenario.fick, 0.03)
  fickRows.push([
    scenario.id,
    result.methodId,
    result.vo2Provenance,
    String(scenario.fick.vo2MlMin ?? '—'),
    String(scenario.fick.hemoglobinGDl ?? '—'),
    String(scenario.fick.arterialSaturationFraction ?? '—'),
    String(scenario.fick.mixedVenousSaturationFraction ?? '—'),
    scenario.fick.venousSampleSite,
    result.arterialOxygenContentMlDl === null ? '—' : result.arterialOxygenContentMlDl.toFixed(2),
    result.mixedVenousOxygenContentMlDl === null
      ? '—'
      : result.mixedVenousOxygenContentMlDl.toFixed(2),
    result.contentDifferenceMlDl === null ? '—' : result.contentDifferenceMlDl.toFixed(2),
    result.status === 'calculated' ? `${result.cardiacOutputLMin?.toFixed(2)}` : 'withheld',
    amplification === null ? '—' : amplification.relativeOutputChange.toFixed(3),
    result.withheldReasons.length === 0 ? '—' : String(result.withheldReasons.length),
  ])
}

table(
  [
    'scenario',
    'method',
    'VO2',
    'VO2 mL/min',
    'Hb',
    'SaO2',
    'SvO2',
    'venous site',
    'CaO2',
    'CvO2',
    'a-v diff',
    'CO L/min',
    'rel err',
    '#withheld',
  ],
  fickRows,
)

/* ------------------------------------------------------------------ *
 * 3. Method comparison
 * ------------------------------------------------------------------ */

console.log('=== 3. Method comparison ===\n')

table(
  [
    'scenario',
    'thermodilution',
    'fick',
    'abs diff',
    'rel diff',
    'defensible position',
    'averaging offered',
    'averaging defensible',
  ],
  cardiacOutputComparisonScenarios.map((scenario) => {
    const summary = seriesByScenario.get(scenario.id)!
    const fick = fickCardiacOutput(scenario.fick)
    const both = summary.averageLMin !== null && fick.cardiacOutputLMin !== null
    const absolute = both
      ? Math.abs((summary.averageLMin as number) - (fick.cardiacOutputLMin as number))
      : null
    const relative =
      both && (fick.cardiacOutputLMin as number) > 0
        ? (absolute as number) / (fick.cardiacOutputLMin as number)
        : null

    const averaging = scenario.options.filter(
      (option) => option.verdict === 'averages-unlike-methods',
    )
    if (averaging.length === 0) {
      flag(`${scenario.id}: no averaging position is offered, so the learner never declines one.`)
    }
    if (averaging.some((option) => option.id === scenario.defensibleOptionId)) {
      flag(`${scenario.id}: an averaging position is marked defensible.`)
    }
    const defensible = scenario.options.find((option) => option.id === scenario.defensibleOptionId)
    if (!defensible) flag(`${scenario.id}: the defensible position does not resolve to an option.`)
    if (
      defensible &&
      !/thermodilution|fick|withhold|both/i.test(`${defensible.label} ${defensible.why}`)
    ) {
      flag(`${scenario.id}: the defensible position does not name a method.`)
    }
    if (scenario.biasDirection === null && scenario.openQuestionIds.length === 0) {
      flag(
        `${scenario.id}: no direction of bias and no open question, so the silence is unexplained.`,
      )
    }

    return [
      scenario.id,
      summary.averageLMin === null ? 'withheld' : summary.averageLMin.toFixed(1),
      fick.cardiacOutputLMin === null ? 'withheld' : fick.cardiacOutputLMin.toFixed(2),
      absolute === null ? '—' : absolute.toFixed(2),
      relative === null ? '—' : relative.toFixed(3),
      scenario.defensibleOptionId,
      averaging.length > 0 ? 'yes' : 'NO',
      averaging.some((option) => option.id === scenario.defensibleOptionId) ? 'YES' : 'no',
    ]
  }),
)

/* ------------------------------------------------------------------ *
 * 4. Source boundaries
 * ------------------------------------------------------------------ */

console.log('=== 4. Numbers shown, and what backs each one ===\n')

table(
  ['parameter', 'shown', 'provenance'],
  cardiacOutputAcquisitionParameters.map((parameter) => {
    if ((parameter.provenance === 'unsupported') !== (parameter.valueShown === null)) {
      flag(`${parameter.id}: classification and displayed value disagree.`)
    }
    return [parameter.id, parameter.valueShown ?? '(none)', parameter.provenance]
  }),
)

console.log(`Verification depth: ${CARDIAC_OUTPUT_VERIFICATION_DEPTH}`)
console.log(`Declared source gaps: ${cardiacOutputUnsupportedClaimTopics().join(', ')}\n`)

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
