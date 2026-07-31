import { createHash } from 'node:crypto'

import { flattenLiteratureTaxonomy, literatureTaxonomy } from '@/features/literature/config'

import {
  DEFAULT_LITERATURE_GOLD_TEST_PERCENT,
  LITERATURE_GOLD_HIGH_SCORE_THRESHOLD,
  LITERATURE_GOLD_LOW_SCORE_THRESHOLD,
  LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION,
} from './constants'
import type {
  LiteratureGoldDeterministicBand,
  LiteratureGoldSampledItem,
  LiteratureGoldSamplingCandidate,
  LiteratureGoldSamplingReport,
  LiteratureGoldSetDatasetSplit,
  LiteratureGoldSetKind,
  LiteratureGoldSetStratum,
} from './types'

const BASE_STRATUM_TARGETS: Array<[LiteratureGoldSetStratum, number]> = [
  ['strong_likely_ip', 200],
  ['likely_non_ip', 200],
  ['ambiguous_boundary', 250],
  ['discovery_only', 150],
  ['challenging_metadata', 100],
]

interface PreparedCandidate extends LiteratureGoldSamplingCandidate {
  deterministicBand: LiteratureGoldDeterministicBand
  deterministicScore: number
  broadTopicIds: string[]
  rareTopicIds: string[]
  sourceTier: string
  stratum: LiteratureGoldSetStratum
  yearBand: string
}

export interface LiteratureGoldSamplingOptions {
  name: string
  kind: LiteratureGoldSetKind
  size: number
  seed: number
  testPercent?: number
  explicitPmids?: string[]
  excludedPmids?: string[]
  generatedAt?: string
}

function stableHash(seed: number, ...parts: Array<string | number>) {
  return createHash('sha256')
    .update([seed, ...parts].join('\u001f'))
    .digest('hex')
}

function stableSort<T>(values: T[], seed: number, key: (value: T) => string) {
  return [...values].sort((left, right) => {
    const leftHash = stableHash(seed, key(left))
    const rightHash = stableHash(seed, key(right))
    return leftHash.localeCompare(rightHash) || key(left).localeCompare(key(right))
  })
}

function sourceTier(sourceKinds: string[]) {
  const sourceSet = new Set(sourceKinds)
  if (sourceSet.size > 1) return 'multiple'
  if (sourceSet.has('core_journal')) return 'core'
  if (sourceSet.has('expanded_journal')) return 'expanded'
  if (sourceSet.has('all_pubmed_discovery')) return 'discovery_only'
  if (sourceSet.has('manual_landmark')) return 'manual_landmark'
  return 'other'
}

function yearBand(year: number | null) {
  if (year === null) return 'unknown'
  if (year < 2000) return 'before_2000'
  if (year < 2010) return '2000_2009'
  if (year < 2020) return '2010_2019'
  return '2020_present'
}

function deterministicScore(candidate: LiteratureGoldSamplingCandidate) {
  const suggestionStrength = Math.max(0, Math.min(1, candidate.maxSuggestionConfidence))
  const suggestionBreadth = Math.min(candidate.suggestionCount, 3) / 3
  const multipleSources = candidate.sourceCount > 1 ? 1 : 0
  const multipleQueries = candidate.queryIds.length > 1 ? 1 : 0
  return Number(
    (
      suggestionStrength * 0.65 +
      suggestionBreadth * 0.2 +
      multipleSources * 0.1 +
      multipleQueries * 0.05
    ).toFixed(4),
  )
}

export function classifyLiteratureGoldDeterministicBand(
  score: number,
): LiteratureGoldDeterministicBand {
  if (score >= LITERATURE_GOLD_HIGH_SCORE_THRESHOLD) return 'high'
  if (score < LITERATURE_GOLD_LOW_SCORE_THRESHOLD) return 'low'
  return 'intermediate'
}

function allocateTargets(requestedSize: number, strata: Array<[LiteratureGoldSetStratum, number]>) {
  const totalWeight = strata.reduce((total, [, weight]) => total + weight, 0)
  const allocations = new Map<LiteratureGoldSetStratum, number>()
  const remainders: Array<{
    stratum: LiteratureGoldSetStratum
    remainder: number
  }> = []
  let assigned = 0

  for (const [stratum, weight] of strata) {
    const exact = (requestedSize * weight) / totalWeight
    const count = Math.floor(exact)
    allocations.set(stratum, count)
    assigned += count
    remainders.push({ stratum, remainder: exact - count })
  }

  remainders
    .sort(
      (left, right) =>
        right.remainder - left.remainder || left.stratum.localeCompare(right.stratum),
    )
    .slice(0, requestedSize - assigned)
    .forEach(({ stratum }) => allocations.set(stratum, (allocations.get(stratum) ?? 0) + 1))

  return allocations
}

function fillShortages(
  targets: Map<LiteratureGoldSetStratum, number>,
  candidatesByStratum: Map<LiteratureGoldSetStratum, PreparedCandidate[]>,
  size: number,
) {
  for (const [stratum, target] of targets) {
    targets.set(stratum, Math.min(target, candidatesByStratum.get(stratum)?.length ?? 0))
  }

  let missing = size - [...targets.values()].reduce((total, value) => total + value, 0)
  const redistributionOrder: LiteratureGoldSetStratum[] = [
    'ambiguous_boundary',
    'challenging_metadata',
    'discovery_only',
    'strong_likely_ip',
    'likely_non_ip',
  ]

  while (missing > 0) {
    let assignedThisPass = 0
    for (const stratum of redistributionOrder) {
      const capacity = candidatesByStratum.get(stratum)?.length ?? 0
      const current = targets.get(stratum) ?? 0
      if (current < capacity) {
        targets.set(stratum, current + 1)
        missing -= 1
        assignedThisPass += 1
      }
      if (missing === 0) break
    }
    if (assignedThisPass === 0) break
  }

  return targets
}

function roundRobinByJournal(
  candidates: PreparedCandidate[],
  count: number,
  seed: number,
  alreadySelected: Set<string>,
) {
  const journalBuckets = new Map<string, PreparedCandidate[]>()
  for (const candidate of candidates) {
    if (alreadySelected.has(candidate.pmid)) continue
    const key = candidate.journalId ?? candidate.journalLabel ?? 'unknown'
    const bucket = journalBuckets.get(key) ?? []
    bucket.push(candidate)
    journalBuckets.set(key, bucket)
  }

  const journalOrder = stableSort([...journalBuckets.keys()], seed, (key) => key)
  for (const [journal, bucket] of journalBuckets) {
    journalBuckets.set(
      journal,
      stableSort(bucket, seed, (candidate) => `${journal}:${candidate.pmid}`),
    )
  }

  const selected: PreparedCandidate[] = []
  let index = 0
  while (selected.length < count) {
    let added = false
    for (const journal of journalOrder) {
      const candidate = journalBuckets.get(journal)?.[index]
      if (candidate) {
        selected.push(candidate)
        alreadySelected.add(candidate.pmid)
        added = true
        if (selected.length === count) break
      }
    }
    if (!added) break
    index += 1
  }
  return selected
}

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function buildTopicMaps() {
  const parentByTopic = new Map(
    flattenLiteratureTaxonomy().map((topic) => [topic.id, topic.parentId ?? topic.id]),
  )
  const broadTopicIds = literatureTaxonomy.topics.map((topic) => topic.id)
  return { broadTopicIds, parentByTopic }
}

function prepareCandidates(
  candidates: LiteratureGoldSamplingCandidate[],
  kind: LiteratureGoldSetKind,
) {
  const { broadTopicIds, parentByTopic } = buildTopicMaps()
  const topicFrequency = countValues(candidates.flatMap((candidate) => candidate.suggestedTopicIds))
  const rareThreshold = Math.max(2, Math.floor(candidates.length * 0.005))
  const regressionStratum =
    kind === 'landmark_regression'
      ? 'landmark_regression'
      : kind === 'hard_negative_regression'
        ? 'hard_negative_regression'
        : null

  const prepared = candidates.map<PreparedCandidate>((candidate) => {
    const score = deterministicScore(candidate)
    const band = classifyLiteratureGoldDeterministicBand(score)
    const candidateBroadTopics = [
      ...new Set(
        candidate.suggestedTopicIds
          .map((topicId) => parentByTopic.get(topicId))
          .filter((topicId): topicId is string => Boolean(topicId)),
      ),
    ]
    const rareTopicIds = candidate.suggestedTopicIds.filter(
      (topicId) => (topicFrequency[topicId] ?? 0) <= rareThreshold,
    )
    const tier = sourceTier(candidate.sourceKinds)
    const isChallenging =
      !candidate.hasAbstract ||
      candidate.isConferenceAbstract ||
      (candidate.publicationYear !== null && candidate.publicationYear < 2000) ||
      rareTopicIds.length > 0
    const stratum: LiteratureGoldSetStratum =
      regressionStratum ??
      (tier === 'discovery_only'
        ? 'discovery_only'
        : isChallenging
          ? 'challenging_metadata'
          : band === 'high'
            ? 'strong_likely_ip'
            : band === 'low'
              ? 'likely_non_ip'
              : 'ambiguous_boundary')

    return {
      ...candidate,
      deterministicBand: band,
      deterministicScore: score,
      broadTopicIds: candidateBroadTopics,
      rareTopicIds,
      sourceTier: tier,
      stratum,
      yearBand: yearBand(candidate.publicationYear),
    }
  })

  return { broadTopicIds, prepared }
}

function samplingReason(candidate: PreparedCandidate) {
  const traits = [
    `stratum=${candidate.stratum}`,
    `source=${candidate.sourceTier}`,
    `year=${candidate.yearBand}`,
    `abstract=${candidate.hasAbstract ? 'available' : 'missing'}`,
    `rule_band=${candidate.deterministicBand}`,
    `score=${candidate.deterministicScore.toFixed(4)}`,
    `source_files=${candidate.sourceFileCount}`,
  ]
  if (candidate.isConferenceAbstract) traits.push('conference_abstract=true')
  if (candidate.rareTopicIds.length > 0) {
    traits.push(`rare_topics=${candidate.rareTopicIds.join(',')}`)
  }
  return traits.join('; ')
}

function assignSplits(
  selected: PreparedCandidate[],
  seed: number,
  testPercent: number,
): Map<string, LiteratureGoldSetDatasetSplit> {
  const splitByPmid = new Map<string, LiteratureGoldSetDatasetSplit>()
  const targetTestCount = Math.round((selected.length * testPercent) / 100)
  const byStratum = new Map<LiteratureGoldSetStratum, PreparedCandidate[]>()
  selected.forEach((candidate) => {
    const bucket = byStratum.get(candidate.stratum) ?? []
    bucket.push(candidate)
    byStratum.set(candidate.stratum, bucket)
  })

  const stratumTargets = [...byStratum.entries()].map(([stratum, values]) => {
    const exact = (values.length * testPercent) / 100
    return {
      stratum,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    }
  })
  let assigned = stratumTargets.reduce((total, target) => total + target.count, 0)
  stratumTargets
    .sort(
      (left, right) =>
        right.remainder - left.remainder || left.stratum.localeCompare(right.stratum),
    )
    .forEach((target) => {
      if (assigned < targetTestCount) {
        target.count += 1
        assigned += 1
      }
    })

  for (const { stratum, count } of stratumTargets) {
    const ordered = stableSort(byStratum.get(stratum) ?? [], seed, (candidate) =>
      stableHash(seed, 'split', candidate.pmid),
    )
    ordered.forEach((candidate, index) => {
      splitByPmid.set(candidate.pmid, index < count ? 'test' : 'development')
    })
  }
  return splitByPmid
}

export function sampleLiteratureGoldSet(
  rawCandidates: LiteratureGoldSamplingCandidate[],
  options: LiteratureGoldSamplingOptions,
): LiteratureGoldSamplingReport {
  const warnings: string[] = []
  const uniqueCandidates = [
    ...new Map(rawCandidates.map((candidate) => [candidate.pmid, candidate])).values(),
  ]
  if (uniqueCandidates.length !== rawCandidates.length) {
    warnings.push(
      `${rawCandidates.length - uniqueCandidates.length} duplicate candidate rows were removed by PMID.`,
    )
  }

  const explicitPmids = new Set(options.explicitPmids ?? [])
  const excludedPmids = new Set(options.excludedPmids ?? [])
  let candidates = uniqueCandidates.filter((candidate) => !excludedPmids.has(candidate.pmid))
  const excludedCandidateCount = uniqueCandidates.length - candidates.length
  if (excludedCandidateCount > 0) {
    warnings.push(
      `${excludedCandidateCount} previously sampled candidate PMIDs were excluded from selection.`,
    )
  }
  if (explicitPmids.size > 0) {
    candidates = candidates.filter((candidate) => explicitPmids.has(candidate.pmid))
    const missing = [...explicitPmids].filter(
      (pmid) => !candidates.some((candidate) => candidate.pmid === pmid),
    )
    if (missing.length > 0) {
      warnings.push(
        `${missing.length} explicitly requested PMIDs were not eligible after corpus and exclusion filters.`,
      )
    }
  }

  const regression =
    options.kind === 'landmark_regression' || options.kind === 'hard_negative_regression'
  if (regression && explicitPmids.size === 0) {
    throw new Error('Regression sets require an explicit PMID list.')
  }
  if (!regression && explicitPmids.size > 0) {
    warnings.push('The automatic gold sample was restricted to an explicit PMID list.')
  }

  const { broadTopicIds, prepared } = prepareCandidates(candidates, options.kind)
  const requestedSize = options.size
  const sampleSize = Math.min(requestedSize, prepared.length)
  if (sampleSize < requestedSize) {
    warnings.push(
      `Only ${sampleSize} unique eligible candidates were available for ${requestedSize} requested items.`,
    )
  }

  const selected: PreparedCandidate[] = []
  const selectedPmids = new Set<string>()

  if (regression) {
    selected.push(
      ...stableSort(prepared, options.seed, (candidate) => candidate.pmid).slice(0, sampleSize),
    )
  } else {
    const candidatesByStratum = new Map<LiteratureGoldSetStratum, PreparedCandidate[]>()
    for (const candidate of prepared) {
      const bucket = candidatesByStratum.get(candidate.stratum) ?? []
      bucket.push(candidate)
      candidatesByStratum.set(candidate.stratum, bucket)
    }
    const requestedTargets = allocateTargets(sampleSize, BASE_STRATUM_TARGETS)
    for (const [stratum, target] of requestedTargets) {
      const available = candidatesByStratum.get(stratum)?.length ?? 0
      if (available < target) {
        warnings.push(
          `${stratum} supplied ${available}/${target} requested candidates; the ${target - available} item shortfall was redistributed.`,
        )
      }
    }
    const targets = fillShortages(new Map(requestedTargets), candidatesByStratum, sampleSize)

    // Reserve one candidate for each broad topic when that topic is available.
    for (const topicId of stableSort(broadTopicIds, options.seed, (id) => id)) {
      const eligible = prepared.filter(
        (candidate) =>
          candidate.broadTopicIds.includes(topicId) &&
          !selectedPmids.has(candidate.pmid) &&
          (targets.get(candidate.stratum) ?? 0) >
            selected.filter((selectedCandidate) => selectedCandidate.stratum === candidate.stratum)
              .length,
      )
      const candidate = stableSort(eligible, options.seed, (value) => `${topicId}:${value.pmid}`)[0]
      if (candidate) {
        selected.push(candidate)
        selectedPmids.add(candidate.pmid)
      }
    }

    for (const [stratum] of BASE_STRATUM_TARGETS) {
      const target = targets.get(stratum) ?? 0
      const alreadyInStratum = selected.filter((candidate) => candidate.stratum === stratum).length
      selected.push(
        ...roundRobinByJournal(
          candidatesByStratum.get(stratum) ?? [],
          Math.max(0, target - alreadyInStratum),
          options.seed,
          selectedPmids,
        ),
      )
    }
  }

  const testPercent =
    options.kind === 'pilot' || regression
      ? 0
      : (options.testPercent ?? DEFAULT_LITERATURE_GOLD_TEST_PERCENT)
  const splitByPmid = assignSplits(selected, options.seed, testPercent)
  const displayOrdered = stableSort(selected, options.seed, (candidate) =>
    stableHash(options.seed, 'display', candidate.pmid),
  )
  const items: LiteratureGoldSampledItem[] = displayOrdered.map((candidate, index) => ({
    pmid: candidate.pmid,
    sampleStratum: candidate.stratum,
    samplingReason: samplingReason(candidate),
    samplingMetadata: {
      deterministicBand: candidate.deterministicBand,
      deterministicScore: candidate.deterministicScore,
      hasAbstract: candidate.hasAbstract,
      isConferenceAbstract: candidate.isConferenceAbstract,
      journal: candidate.journalLabel,
      queryIds: candidate.queryIds,
      rareTopicIds: candidate.rareTopicIds,
      sourceFileCount: candidate.sourceFileCount,
      sourceKinds: candidate.sourceKinds,
      sourceTier: candidate.sourceTier,
      suggestedTopicIds: candidate.suggestedTopicIds,
      yearBand: candidate.yearBand,
    },
    datasetSplit: splitByPmid.get(candidate.pmid) ?? 'development',
    displayOrder: index + 1,
  }))

  const representedTopics = new Set(selected.flatMap((candidate) => candidate.broadTopicIds))
  const broadTopicsAvailable = new Set(prepared.flatMap((candidate) => candidate.broadTopicIds))
  const unavailableTopics = broadTopicIds.filter((topicId) => !broadTopicsAvailable.has(topicId))
  const availableButMissing = broadTopicIds.filter(
    (topicId) => broadTopicsAvailable.has(topicId) && !representedTopics.has(topicId),
  )
  if (availableButMissing.length > 0) {
    warnings.push(
      `The requested sample was too small or constrained to represent ${availableButMissing.length} available broad topics.`,
    )
  }

  const developmentCount = items.filter((item) => item.datasetSplit === 'development').length
  const testCount = items.length - developmentCount
  if (options.kind === 'gold_standard' && (developmentCount === 0 || testCount === 0)) {
    throw new Error('Gold-standard samples require at least one development and one test item.')
  }

  return {
    reportVersion: '1.1.0',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    name: options.name,
    kind: options.kind,
    samplingSeed: options.seed,
    samplingAlgorithmVersion: LITERATURE_GOLD_SAMPLING_ALGORITHM_VERSION,
    requestedSize,
    originalCandidateCount: uniqueCandidates.length,
    excludedCandidateCount,
    candidateCount: candidates.length,
    selectedCount: items.length,
    developmentCount,
    testCount,
    countsByStratum: countValues(items.map((item) => item.sampleStratum)),
    countsBySourceTier: countValues(items.map((item) => String(item.samplingMetadata.sourceTier))),
    countsByYearBand: countValues(items.map((item) => item.samplingMetadata.yearBand)),
    countsByAbstractAvailability: countValues(
      items.map((item) => (item.samplingMetadata.hasAbstract ? 'has_abstract' : 'no_abstract')),
    ),
    countsByJournal: countValues(items.map((item) => item.samplingMetadata.journal)),
    countsByDeterministicBand: countValues(
      items.map((item) => item.samplingMetadata.deterministicBand),
    ),
    broadTopicsRepresented: broadTopicIds.filter((topicId) => representedTopics.has(topicId)),
    broadTopicsUnavailable: unavailableTopics,
    warnings,
    items,
  }
}
