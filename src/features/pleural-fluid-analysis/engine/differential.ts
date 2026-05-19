import { pleuralDiseaseProfiles } from '../content/diseaseProfiles'
import { evaluateLightsCriteria, getPseudoexudateReasons } from './interpretation'
import type {
  DifferentialOptions,
  DifferentialResult,
  DifferentialRule,
  DifferentialRuleDomain,
  DifferentialRuleKey,
  DifferentialSummary,
  DiseaseRarity,
  PleuralFluidInput,
} from './types'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const rarityPrior: Record<DiseaseRarity, number> = {
  common: 8,
  uncommon: 5.5,
  rare: 2.5,
  'very rare': 1,
}

const rarityBonus: Record<DiseaseRarity, number> = {
  common: 0,
  uncommon: 1.5,
  rare: 5,
  'very rare': 7,
}

const rarityCap: Record<DiseaseRarity, number> = {
  common: 100,
  uncommon: 100,
  rare: 86,
  'very rare': 78,
}

export function scoreDifferential(
  input: PleuralFluidInput,
  options: DifferentialOptions,
): DifferentialSummary {
  const contextEmphasis = clamp(options.contextEmphasis, 0, 100)
  const raritySensitivity = clamp(options.raritySensitivity, 0, 100)
  const domainWeights = getDomainWeights(contextEmphasis)
  const results = pleuralDiseaseProfiles
    .map((disease) => {
      const prior =
        rarityPrior[disease.rarity] + (raritySensitivity / 100) * rarityBonus[disease.rarity]
      const maxPrior =
        rarityPrior[disease.rarity] +
        rarityBonus[disease.rarity] +
        (disease.rarity === 'common' ? 2 : 0)
      let rawScore = prior
      let maxScore = maxPrior
      const matchedEvidence: string[] = []
      const missingEvidence: string[] = []

      for (const rule of disease.rules) {
        const ruleWeight = rule.weight * domainWeights[rule.domain]
        maxScore += ruleWeight

        if (matchesRule(input, rule)) {
          rawScore += ruleWeight
          matchedEvidence.push(rule.evidence)
        } else if (rule.weight >= 6) {
          missingEvidence.push(rule.evidence)
        }
      }

      const score = clamp(
        Math.round((rawScore / Math.max(maxScore, 1)) * 100),
        0,
        rarityCap[disease.rarity],
      )

      return {
        disease,
        score,
        rank: 0,
        matchedEvidence,
        missingEvidence,
        rawScore,
        maxScore,
      }
    })
    .sort(compareDifferentialResults)
    .map((result, index) => ({ ...result, rank: index + 1 }))

  const maxResults =
    options.maxResults ?? Math.round(11 - contextEmphasis / 16 + raritySensitivity / 35)
  const visibleLimit = clamp(maxResults, 4, 12)
  const visibleResults = results
    .filter((result) => raritySensitivity >= 35 || result.disease.rarity !== 'very rare')
    .slice(0, visibleLimit)

  return {
    results,
    visibleResults,
    hiddenCount: Math.max(0, results.length - visibleResults.length),
    lensLabel: getLensLabel(contextEmphasis, raritySensitivity),
  }
}

function compareDifferentialResults(
  a: Omit<DifferentialResult, 'rank'>,
  b: Omit<DifferentialResult, 'rank'>,
) {
  if (b.score !== a.score) {
    return b.score - a.score
  }

  if (b.matchedEvidence.length !== a.matchedEvidence.length) {
    return b.matchedEvidence.length - a.matchedEvidence.length
  }

  return rarityPrior[b.disease.rarity] - rarityPrior[a.disease.rarity]
}

function getDomainWeights(contextEmphasis: number): Record<DifferentialRuleDomain, number> {
  const contextFactor = contextEmphasis / 100

  return {
    fluid: 1.18 - contextFactor * 0.28,
    targeted: 1.28 - contextFactor * 0.08,
    context: 0.45 + contextFactor * 1.05,
  }
}

function getLensLabel(contextEmphasis: number, raritySensitivity: number) {
  if (contextEmphasis < 30 && raritySensitivity < 35) {
    return 'Broad common-pattern lens'
  }

  if (contextEmphasis < 40) {
    return 'Broad lab-first lens'
  }

  if (contextEmphasis > 75 && raritySensitivity > 65) {
    return 'Context-heavy rare-disease lens'
  }

  if (contextEmphasis > 70) {
    return 'Narrow clinical-context lens'
  }

  return 'Balanced diagnostic lens'
}

function matchesRule(input: PleuralFluidInput, rule: DifferentialRule) {
  const value = getRuleValue(input, rule.key)

  if (value === undefined || value === null || Number.isNaN(value)) {
    return false
  }

  switch (rule.operator) {
    case 'eq':
      return value === rule.value
    case 'oneOf':
      return Boolean(rule.values?.includes(value as string | number | boolean))
    case 'gte':
      return typeof value === 'number' && typeof rule.value === 'number' && value >= rule.value
    case 'lte':
      return typeof value === 'number' && typeof rule.value === 'number' && value <= rule.value
    case 'between':
      return (
        typeof value === 'number' &&
        (rule.min === undefined || value >= rule.min) &&
        (rule.max === undefined || value <= rule.max)
      )
    case 'truthy':
      return Boolean(value)
    case 'falsy':
      return !value
    default:
      return false
  }
}

function getRuleValue(input: PleuralFluidInput, key: DifferentialRuleKey) {
  const lightCriteria = evaluateLightsCriteria(input)

  switch (key) {
    case 'lightCategory':
      return lightCriteria.classification
    case 'reconciledCategory':
      return getPseudoexudateReasons(input, lightCriteria.classification).length > 0
        ? 'transudate'
        : lightCriteria.classification
    case 'proteinRatio':
      return input.pleuralProtein / input.serumProtein
    case 'ldhRatio':
      return input.pleuralLdh / input.serumLdh
    case 'ldhUpperLimitRatio':
      return input.pleuralLdh / input.serumLdhUpperLimit
    case 'proteinGradient':
      return input.serumProtein - input.pleuralProtein
    case 'albuminGradient':
      return input.serumAlbumin !== undefined && input.pleuralAlbumin !== undefined
        ? input.serumAlbumin - input.pleuralAlbumin
        : undefined
    default:
      return input[key]
  }
}
