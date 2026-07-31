import { literatureGoldSetLabels, literatureTaxonomy } from '@/features/literature/config'

import {
  LITERATURE_GOLD_HIGH_SCORE_THRESHOLD,
  LITERATURE_GOLD_LOW_SCORE_THRESHOLD,
  LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION,
} from './constants'
import { classifyLiteratureGoldDeterministicBand } from './sampling'
import type { LiteratureGoldDeterministicBand, LiteratureGoldSetRelevanceLabel } from './types'
import type { LiteratureGoldCsvRow } from './export'

type CountMap = Record<string, number>

export interface LiteratureGoldBandOutcome {
  total: number
  included: number
  excluded: number
  uncertain: number
  inclusionRate: number
}

export interface LiteratureGoldPilotAnalysis {
  reportVersion: '1.0.0'
  generatedAt: string
  source: {
    batchId: string
    batchName: string
    sha256: string | null
  }
  contracts: {
    taxonomyVersion: string
    labelSchemaVersion: string
    relevanceDefinitionVersion: string
    samplingAlgorithmVersion: string
    lowScoreThreshold: number
    highScoreThreshold: number
  }
  readiness: {
    status: 'ready' | 'ready_with_follow_up' | 'not_ready'
    gates: Array<{ id: string; passed: boolean; detail: string }>
  }
  totals: {
    records: number
    included: number
    excluded: number
    uncertain: number
    blinded: number
    revised: number
    supplementalMetadata: number
    fullTextCategorization: number
  }
  counts: {
    relevance: CountMap
    metadataSufficiency: CountMap
    reviewerConfidence: CountMap
    sampleStratum: CountMap
    sourceTier: CountMap
    originalRuleBand: CountMap
    calibratedRuleBand: CountMap
  }
  outcomes: {
    bySampleStratum: Record<string, LiteratureGoldBandOutcome>
    byOriginalRuleBand: Record<string, LiteratureGoldBandOutcome>
    byCalibratedRuleBand: Record<string, LiteratureGoldBandOutcome>
  }
  coverage: {
    broadTopics: { used: string[]; missing: string[]; counts: CountMap }
    technologyTags: { used: string[]; missing: string[]; counts: CountMap }
    clinicalPurposes: { used: string[]; missing: string[]; counts: CountMap }
    diseaseTags: { used: string[]; missing: string[]; counts: CountMap }
    studyDesigns: { used: string[]; missing: string[]; counts: CountMap }
    publicationStatuses: { used: string[]; missing: string[]; counts: CountMap }
  }
  reviewTiming: {
    totalSeconds: number
    meanSeconds: number
    medianSeconds: number
    maximumSeconds: number
  }
  followUp: {
    lowConfidencePmids: string[]
    revisedPmids: string[]
    noAbstractIncludedPmids: string[]
    originalHighBandExcludedPmids: string[]
    calibratedLowBandIncludedPmids: string[]
    calibratedHighBandExcludedPmids: string[]
  }
  warnings: string[]
  limitations: string[]
}

function countValues(values: Array<string | null>) {
  return values.reduce<CountMap>((counts, value) => {
    if (value) counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function included(label: string | null): label is 'include_core' | 'include_adjacent' {
  return label === 'include_core' || label === 'include_adjacent'
}

function outcome(rows: LiteratureGoldCsvRow[]): LiteratureGoldBandOutcome {
  const includedCount = rows.filter((row) => included(row.review.relevanceLabel)).length
  const excluded = rows.filter((row) => row.review.relevanceLabel === 'exclude').length
  const uncertain = rows.filter((row) => row.review.relevanceLabel === 'uncertain').length
  return {
    total: rows.length,
    included: includedCount,
    excluded,
    uncertain,
    inclusionRate: rows.length === 0 ? 0 : Number((includedCount / rows.length).toFixed(4)),
  }
}

function groupedOutcomes(rows: LiteratureGoldCsvRow[], key: (row: LiteratureGoldCsvRow) => string) {
  const values = new Map<string, LiteratureGoldCsvRow[]>()
  for (const row of rows) {
    const group = key(row)
    values.set(group, [...(values.get(group) ?? []), row])
  }
  return Object.fromEntries(
    [...values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([group, groupedRows]) => [group, outcome(groupedRows)]),
  )
}

interface SamplingSignals {
  ruleBand: LiteratureGoldDeterministicBand | null
  score: number | null
  sourceTier: string | null
}

function samplingSignals(reason: string | null): SamplingSignals {
  if (!reason) return { ruleBand: null, score: null, sourceTier: null }
  const entries = reason.split(';').flatMap((part): Array<[string, string]> => {
    const normalized = part.trim()
    const separator = normalized.indexOf('=')
    return separator > 0 ? [[normalized.slice(0, separator), normalized.slice(separator + 1)]] : []
  })
  const values = new Map(entries)
  const ruleBand = values.get('rule_band')
  const rawScore = values.get('score')
  const score = rawScore && /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/u.test(rawScore) ? Number(rawScore) : null
  return {
    ruleBand:
      ruleBand === 'high' || ruleBand === 'intermediate' || ruleBand === 'low' ? ruleBand : null,
    score,
    sourceTier: values.get('source') || null,
  }
}

function controlledCoverage(values: string[], allowed: string[]) {
  const counts = countValues(values)
  return {
    used: allowed.filter((value) => (counts[value] ?? 0) > 0),
    missing: allowed.filter((value) => (counts[value] ?? 0) === 0),
    counts,
  }
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? 0)
}

export function analyzeLiteratureGoldPilot(
  rows: LiteratureGoldCsvRow[],
  options: { generatedAt?: string; sourceSha256?: string | null } = {},
): LiteratureGoldPilotAnalysis {
  if (rows.length === 0) throw new Error('Pilot analysis requires at least one completed row.')

  const warnings: string[] = []
  const signals = new Map(rows.map((row) => [row.itemId, samplingSignals(row.samplingReason)]))
  const rowsWithoutScore = rows.filter((row) => signals.get(row.itemId)?.score === null)
  if (rowsWithoutScore.length > 0) {
    warnings.push(
      `${rowsWithoutScore.length} rows lacked a parseable deterministic score in sampling_reason.`,
    )
  }

  const rowsWithScore = rows.filter(
    (row) => signals.get(row.itemId)?.score !== null,
  ) as LiteratureGoldCsvRow[]
  const calibratedBand = (row: LiteratureGoldCsvRow) => {
    const score = signals.get(row.itemId)?.score
    return score === null || score === undefined
      ? 'unknown'
      : classifyLiteratureGoldDeterministicBand(score)
  }
  const originalBand = (row: LiteratureGoldCsvRow) => signals.get(row.itemId)?.ruleBand ?? 'unknown'
  const relevance = (row: LiteratureGoldCsvRow) =>
    row.review.relevanceLabel as LiteratureGoldSetRelevanceLabel | null
  const revisedRows = rows.filter((row) => (row.review.revision ?? 0) > 1)
  const reviewSeconds = rows.map((row) => row.review.reviewSeconds)
  const includedRows = rows.filter((row) => included(relevance(row)))
  const allCompleted = rows.every(
    (row) => row.reviewSource === 'completed' && row.reviewStatus === 'completed',
  )
  const allDevelopment = rows.every((row) => row.datasetSplit === 'development')
  const allBlinded = rows.every((row) => row.review.isBlinded === true)
  const noUncertain = rows.every((row) => relevance(row) !== 'uncertain')

  const calibratedOutcomes = groupedOutcomes(rowsWithScore, calibratedBand)
  const calibratedIntermediate = calibratedOutcomes.intermediate
  const mixedIntermediate = Boolean(
    calibratedIntermediate &&
    calibratedIntermediate.included > 0 &&
    calibratedIntermediate.excluded > 0,
  )
  const broadTopicIds = literatureTaxonomy.topics.map((topic) => topic.id)
  const broadTopicCoverage = controlledCoverage(
    includedRows.flatMap((row) => row.review.topicIds),
    broadTopicIds,
  )
  const calibratedHighBandExcludedPmids = rows
    .filter((row) => calibratedBand(row) === 'high' && relevance(row) === 'exclude')
    .map((row) => row.pmid)

  const gates = [
    {
      id: 'all-completed',
      passed: allCompleted,
      detail: `${rows.filter((row) => row.reviewSource === 'completed').length}/${rows.length} rows have completed decisions.`,
    },
    {
      id: 'development-only',
      passed: allDevelopment,
      detail: allDevelopment
        ? 'Every pilot row remains in the development split.'
        : 'A pilot row was assigned to a held-out split.',
    },
    {
      id: 'blinded-first-pass',
      passed: allBlinded,
      detail: `${rows.filter((row) => row.review.isBlinded === true).length}/${rows.length} current decisions are marked blinded.`,
    },
    {
      id: 'resolved-relevance',
      passed: noUncertain,
      detail: `${rows.filter((row) => relevance(row) === 'uncertain').length} uncertain decisions remain.`,
    },
    {
      id: 'broad-topic-coverage',
      passed: broadTopicCoverage.missing.length === 0,
      detail: `${broadTopicCoverage.used.length}/${broadTopicIds.length} broad topics are represented.`,
    },
    {
      id: 'usable-boundary-band',
      passed: mixedIntermediate,
      detail: mixedIntermediate
        ? 'The calibrated intermediate band contains both included and excluded articles.'
        : 'The calibrated intermediate band does not contain both sides of the relevance boundary.',
    },
    {
      id: 'high-band-audit',
      passed: calibratedHighBandExcludedPmids.length === 0,
      detail: `${calibratedHighBandExcludedPmids.length} calibrated high-band articles were excluded.`,
    },
  ]
  const hardGatesPass = gates.every((gate) => gate.passed)
  const followUpRecommended =
    revisedRows.length > 0 ||
    rows.some((row) => row.review.reviewerConfidence === 'low') ||
    rowsWithoutScore.length > 0

  return {
    reportVersion: '1.0.0',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: {
      batchId: rows[0]?.batchId ?? '',
      batchName: rows[0]?.batchName ?? '',
      sha256: options.sourceSha256 ?? null,
    },
    contracts: {
      taxonomyVersion: literatureTaxonomy.taxonomy_version,
      labelSchemaVersion: literatureGoldSetLabels.label_schema_version,
      relevanceDefinitionVersion: literatureGoldSetLabels.relevance_definition_version,
      samplingAlgorithmVersion: LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION,
      lowScoreThreshold: LITERATURE_GOLD_LOW_SCORE_THRESHOLD,
      highScoreThreshold: LITERATURE_GOLD_HIGH_SCORE_THRESHOLD,
    },
    readiness: {
      status: hardGatesPass
        ? followUpRecommended
          ? 'ready_with_follow_up'
          : 'ready'
        : 'not_ready',
      gates,
    },
    totals: {
      records: rows.length,
      included: includedRows.length,
      excluded: rows.filter((row) => relevance(row) === 'exclude').length,
      uncertain: rows.filter((row) => relevance(row) === 'uncertain').length,
      blinded: rows.filter((row) => row.review.isBlinded === true).length,
      revised: revisedRows.length,
      supplementalMetadata: rows.filter((row) => row.review.usedSupplementalMetadata).length,
      fullTextCategorization: rows.filter((row) => row.review.categorizationFromFullText).length,
    },
    counts: {
      relevance: countValues(rows.map((row) => relevance(row))),
      metadataSufficiency: countValues(rows.map((row) => row.review.metadataSufficiency)),
      reviewerConfidence: countValues(rows.map((row) => row.review.reviewerConfidence)),
      sampleStratum: countValues(rows.map((row) => row.sampleStratum)),
      sourceTier: countValues(rows.map((row) => signals.get(row.itemId)?.sourceTier ?? null)),
      originalRuleBand: countValues(rows.map(originalBand)),
      calibratedRuleBand: countValues(rows.map(calibratedBand)),
    },
    outcomes: {
      bySampleStratum: groupedOutcomes(rows, (row) => row.sampleStratum ?? 'unknown'),
      byOriginalRuleBand: groupedOutcomes(rows, originalBand),
      byCalibratedRuleBand: calibratedOutcomes,
    },
    coverage: {
      broadTopics: broadTopicCoverage,
      technologyTags: controlledCoverage(
        includedRows.flatMap((row) => row.review.technologyTags),
        literatureGoldSetLabels.technology_tags.map((tag) => tag.id),
      ),
      clinicalPurposes: controlledCoverage(
        includedRows.flatMap((row) => row.review.clinicalPurposes),
        literatureTaxonomy.facets.clinical_purpose,
      ),
      diseaseTags: controlledCoverage(
        includedRows.flatMap((row) => row.review.diseaseTags),
        literatureTaxonomy.facets.disease,
      ),
      studyDesigns: controlledCoverage(
        includedRows.flatMap((row) => (row.review.studyDesign ? [row.review.studyDesign] : [])),
        literatureTaxonomy.facets.study_design,
      ),
      publicationStatuses: controlledCoverage(
        includedRows.flatMap((row) =>
          row.review.publicationStatus ? [row.review.publicationStatus] : [],
        ),
        literatureTaxonomy.facets.publication_class,
      ),
    },
    reviewTiming: {
      totalSeconds: reviewSeconds.reduce((total, value) => total + value, 0),
      meanSeconds: Number(
        (reviewSeconds.reduce((total, value) => total + value, 0) / rows.length).toFixed(2),
      ),
      medianSeconds: median(reviewSeconds),
      maximumSeconds: Math.max(...reviewSeconds),
    },
    followUp: {
      lowConfidencePmids: rows
        .filter((row) => row.review.reviewerConfidence === 'low')
        .map((row) => row.pmid),
      revisedPmids: revisedRows.map((row) => row.pmid),
      noAbstractIncludedPmids: includedRows
        .filter((row) => row.review.metadataSufficiency === 'no_abstract')
        .map((row) => row.pmid),
      originalHighBandExcludedPmids: rows
        .filter((row) => originalBand(row) === 'high' && relevance(row) === 'exclude')
        .map((row) => row.pmid),
      calibratedLowBandIncludedPmids: includedRows
        .filter((row) => calibratedBand(row) === 'low')
        .map((row) => row.pmid),
      calibratedHighBandExcludedPmids,
    },
    warnings,
    limitations: [
      'This pilot was deliberately stratified and cannot estimate prevalence or population-level classifier performance.',
      'Band outcomes evaluate deterministic sampling signals, not a deployed relevance classifier.',
      'The current-only CSV identifies revised decisions but does not contain superseded labels or change reasons.',
      'Review seconds can include idle time, supplemental review, or revision time and are not a pure first-pass effort measure.',
    ],
  }
}

function markdownTable(
  outcomes: Record<string, LiteratureGoldBandOutcome>,
  heading: string,
): string[] {
  return [
    `### ${heading}`,
    '',
    '| Group | Total | Included | Excluded | Uncertain | Inclusion yield |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(outcomes).map(
      ([group, value]) =>
        `| ${group.replaceAll('_', '\\_')} | ${value.total} | ${value.included} | ${value.excluded} | ${value.uncertain} | ${(value.inclusionRate * 100).toFixed(1)}% |`,
    ),
    '',
  ]
}

function pmidList(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None'
}

export function serializeLiteratureGoldPilotAnalysisMarkdown(report: LiteratureGoldPilotAnalysis) {
  const lines = [
    `# ${report.source.batchName} readiness analysis`,
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Source SHA-256: ${report.source.sha256 ?? 'Not recorded'}`,
    '',
    `Contracts: taxonomy ${report.contracts.taxonomyVersion}; labels ${report.contracts.labelSchemaVersion}; relevance ${report.contracts.relevanceDefinitionVersion}; sampling ${report.contracts.samplingAlgorithmVersion}.`,
    '',
    `Sampling bands: low below ${report.contracts.lowScoreThreshold.toFixed(2)}; intermediate from ${report.contracts.lowScoreThreshold.toFixed(2)} to below ${report.contracts.highScoreThreshold.toFixed(2)}; high at least ${report.contracts.highScoreThreshold.toFixed(2)}.`,
    '',
    `Status: **${report.readiness.status.replaceAll('_', ' ')}**`,
    '',
    'This is a development-only sampling and workflow diagnostic. It is not a population performance estimate.',
    '',
    '## Readiness gates',
    '',
    ...report.readiness.gates.map(
      (gate) => `- ${gate.passed ? 'PASS' : 'FAIL'} — ${gate.id}: ${gate.detail}`,
    ),
    '',
    '## Pilot summary',
    '',
    `- Records: ${report.totals.records}`,
    `- Included: ${report.totals.included}`,
    `- Excluded: ${report.totals.excluded}`,
    `- Uncertain: ${report.totals.uncertain}`,
    `- Blinded current decisions: ${report.totals.blinded}`,
    `- Revised current decisions: ${report.totals.revised}`,
    `- Supplemental metadata used: ${report.totals.supplementalMetadata}`,
    `- Full-text categorization: ${report.totals.fullTextCategorization}`,
    '',
    ...markdownTable(report.outcomes.bySampleStratum, 'Sample-stratum outcomes'),
    ...markdownTable(report.outcomes.byOriginalRuleBand, 'Original band outcomes'),
    ...markdownTable(report.outcomes.byCalibratedRuleBand, 'Stratified-v2 band outcomes'),
    '## Controlled-vocabulary coverage',
    '',
    `- Broad topics: ${report.coverage.broadTopics.used.length} used; ${report.coverage.broadTopics.missing.length} missing`,
    `- Technology tags: ${report.coverage.technologyTags.used.length} used; ${report.coverage.technologyTags.missing.length} missing`,
    `- Clinical purposes: ${report.coverage.clinicalPurposes.used.length} used; ${report.coverage.clinicalPurposes.missing.length} missing`,
    `- Disease tags: ${report.coverage.diseaseTags.used.length} used; ${report.coverage.diseaseTags.missing.length} missing`,
    `- Study designs: ${report.coverage.studyDesigns.used.length} used; ${report.coverage.studyDesigns.missing.length} missing`,
    `- Publication statuses: ${report.coverage.publicationStatuses.used.length} used; ${report.coverage.publicationStatuses.missing.length} missing`,
    '',
    '## Follow-up and regression candidates',
    '',
    `- Low-confidence decisions: ${pmidList(report.followUp.lowConfidencePmids)}`,
    `- Revised current decisions: ${pmidList(report.followUp.revisedPmids)}`,
    `- Included without abstracts: ${pmidList(report.followUp.noAbstractIncludedPmids)}`,
    `- Original high-band exclusions: ${pmidList(report.followUp.originalHighBandExcludedPmids)}`,
    `- Stratified-v2 low-band inclusions: ${pmidList(report.followUp.calibratedLowBandIncludedPmids)}`,
    `- Stratified-v2 high-band exclusions: ${pmidList(report.followUp.calibratedHighBandExcludedPmids)}`,
    '',
    '## Limitations',
    '',
    ...report.limitations.map((limitation) => `- ${limitation}`),
    '',
  ]
  if (report.warnings.length > 0) {
    lines.push('## Warnings', '', ...report.warnings.map((warning) => `- ${warning}`), '')
  }
  return `${lines.join('\n')}\n`
}
