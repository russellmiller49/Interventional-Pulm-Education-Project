import { createHash } from 'node:crypto'

import { z } from 'zod'

export const ULTRA_SCREENING_SCHEMA_VERSION = '1.0.0' as const
export const NO_ABSTRACT_MARKER = '[NO ABSTRACT AVAILABLE]' as const

export const ULTRA_RELEVANCE_LABELS = [
  'include_core',
  'include_adjacent',
  'exclude',
  'uncertain',
] as const

export const ULTRA_DECISION_CONFIDENCE = ['high', 'moderate', 'low'] as const

export const ULTRA_EVIDENCE_FIELDS = [
  'title',
  'abstract',
  'mesh',
  'author_keyword',
  'publication_type',
  'journal',
  'year',
] as const

export const ULTRA_REASON_CODES = [
  'core_procedure_central',
  'basic_bronchoscopy',
  'bal_procedural',
  'bronchoscopic_sampling',
  'ebus_eusb',
  'peripheral_navigation_biopsy',
  'therapeutic_rigid_airway',
  'airway_stent_stenosis',
  'bronchoscopic_ablation',
  'lung_volume_reduction',
  'air_leak_fistula',
  'cryobiopsy',
  'hemoptysis_intervention',
  'pleural_procedure',
  'procedural_tracheostomy',
  'education_quality_safety',
  'applied_technology',
  'adjacent_anesthesia_ventilation',
  'adjacent_specimen_adequacy',
  'adjacent_imaging_localization',
  'adjacent_preclinical_procedural',
  'adjacent_benchtop',
  'incidental_specimen_collection',
  'animal_nonprocedural',
  'unrelated_pulmonary_oncology',
  'unrelated_imaging_ai',
  'unrelated_surgery_anesthesia_education',
  'non_airway_stent',
  'nonpulmonary_endoscopy',
  'insufficient_metadata',
  'scope_boundary',
] as const

function uniqueStrings(values: string[]) {
  return new Set(values).size === values.length
}

const boundedSourceText = z.string().max(2_000_000)
const boundedSourceTextArray = z.array(z.string().max(50_000)).max(500)

export const ultraScreeningArticleSchema = z
  .object({
    pmid: z.string().regex(/^[0-9]{1,12}$/u),
    title: z.string().trim().min(1).max(50_000),
    abstract: boundedSourceText,
    mesh: boundedSourceTextArray,
    author_keyword: boundedSourceTextArray,
    publication_type: boundedSourceTextArray,
    journal: z.string().max(50_000).nullable(),
    year: z.number().int().min(1800).max(3000).nullable(),
    language: boundedSourceTextArray,
  })
  .strict()

export type UltraScreeningArticle = z.infer<typeof ultraScreeningArticleSchema>

export const ultraScreeningEvidenceSchema = z
  .object({
    field: z.enum(ULTRA_EVIDENCE_FIELDS),
    text: z.string().trim().min(1).max(2_000),
  })
  .strict()

export const ultraScreeningResultSchema = z
  .object({
    pmid: z.string().regex(/^[0-9]{1,12}$/u),
    relevanceLabel: z.enum(ULTRA_RELEVANCE_LABELS),
    decisionConfidence: z.enum(ULTRA_DECISION_CONFIDENCE),
    requiresHumanReview: z.boolean(),
    reasonCodes: z
      .array(z.enum(ULTRA_REASON_CODES))
      .min(1)
      .max(8)
      .refine(uniqueStrings, 'reasonCodes must be unique.'),
    evidence: z.array(ultraScreeningEvidenceSchema).min(1).max(8),
    conciseRationale: z.string().trim().min(1).max(1_000),
  })
  .strict()
  .superRefine((result, context) => {
    if (
      (result.relevanceLabel === 'uncertain' || result.decisionConfidence === 'low') &&
      !result.requiresHumanReview
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Uncertain and low-confidence results require human review.',
        path: ['requiresHumanReview'],
      })
    }
  })

export type UltraScreeningResult = z.infer<typeof ultraScreeningResultSchema>
export type UltraRelevanceLabel = UltraScreeningResult['relevanceLabel']

export interface UltraValidationError {
  code:
    | 'invalid_packet'
    | 'invalid_json'
    | 'invalid_schema'
    | 'duplicate_pmid'
    | 'missing_pmid'
    | 'unexpected_pmid'
    | 'invalid_evidence'
  message: string
  line?: number
  pmid?: string
}

export interface UltraValidationReport {
  schemaVersion: typeof ULTRA_SCREENING_SCHEMA_VERSION
  valid: boolean
  assignedCount: number
  parsedCount: number
  validRecordCount: number
  errors: UltraValidationError[]
  records: UltraScreeningResult[]
}

function evidenceFieldValues(
  article: UltraScreeningArticle,
  field: UltraScreeningResult['evidence'][number]['field'],
) {
  switch (field) {
    case 'title':
      return [article.title]
    case 'abstract':
      return [article.abstract]
    case 'mesh':
      return article.mesh
    case 'author_keyword':
      return article.author_keyword
    case 'publication_type':
      return article.publication_type
    case 'journal':
      return article.journal === null ? [] : [article.journal]
    case 'year':
      return article.year === null ? [] : [String(article.year)]
  }
}

function possiblePmid(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const pmid = (value as Record<string, unknown>).pmid
  return typeof pmid === 'string' ? pmid : undefined
}

export function validateUltraWorkerOutput(
  rawOutput: string,
  rawArticles: readonly unknown[],
): UltraValidationReport {
  const errors: UltraValidationError[] = []
  const assignedArticles: UltraScreeningArticle[] = []
  const assignedPmids = new Set<string>()

  for (const [index, rawArticle] of rawArticles.entries()) {
    const parsed = ultraScreeningArticleSchema.safeParse(rawArticle)
    if (!parsed.success) {
      errors.push({
        code: 'invalid_packet',
        message: `Packet article ${index + 1}: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'record'} ${issue.message}`)
          .join('; ')}`,
      })
      continue
    }
    if (assignedPmids.has(parsed.data.pmid)) {
      errors.push({
        code: 'invalid_packet',
        message: `Packet contains duplicate PMID ${parsed.data.pmid}.`,
        pmid: parsed.data.pmid,
      })
      continue
    }
    assignedPmids.add(parsed.data.pmid)
    assignedArticles.push(parsed.data)
  }

  const articleByPmid = new Map(assignedArticles.map((article) => [article.pmid, article]))
  const records: UltraScreeningResult[] = []
  const seenPmids = new Set<string>()
  const nonblankLines = rawOutput
    .split(/\r?\n/u)
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => text.trim().length > 0)

  for (const { line, text } of nonblankLines) {
    let rawRecord: unknown
    try {
      rawRecord = JSON.parse(text) as unknown
    } catch (error) {
      errors.push({
        code: 'invalid_json',
        line,
        message: `Line ${line} is not a JSON object: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })
      continue
    }

    const parsed = ultraScreeningResultSchema.safeParse(rawRecord)
    if (!parsed.success) {
      errors.push({
        code: 'invalid_schema',
        line,
        pmid: possiblePmid(rawRecord),
        message: `Line ${line}: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'record'} ${issue.message}`)
          .join('; ')}`,
      })
      continue
    }

    const result = parsed.data
    if (seenPmids.has(result.pmid)) {
      errors.push({
        code: 'duplicate_pmid',
        line,
        pmid: result.pmid,
        message: `PMID ${result.pmid} appears more than once.`,
      })
      continue
    }
    seenPmids.add(result.pmid)

    const article = articleByPmid.get(result.pmid)
    if (!article) {
      errors.push({
        code: 'unexpected_pmid',
        line,
        pmid: result.pmid,
        message: `PMID ${result.pmid} was not assigned to this worker.`,
      })
      continue
    }

    for (const evidence of result.evidence) {
      const values = evidenceFieldValues(article, evidence.field)
      const occursVerbatim =
        evidence.field === 'year'
          ? values.includes(evidence.text)
          : values.some((value) => value.includes(evidence.text))
      if (!occursVerbatim) {
        errors.push({
          code: 'invalid_evidence',
          line,
          pmid: result.pmid,
          message: `Evidence text for PMID ${result.pmid} does not occur verbatim in supplied field ${evidence.field}.`,
        })
      }
    }
    records.push(result)
  }

  for (const pmid of assignedPmids) {
    if (!seenPmids.has(pmid)) {
      errors.push({
        code: 'missing_pmid',
        pmid,
        message: `Assigned PMID ${pmid} is missing from the worker output.`,
      })
    }
  }

  const orderByPmid = new Map(assignedArticles.map((article, index) => [article.pmid, index]))
  records.sort(
    (left, right) =>
      (orderByPmid.get(left.pmid) ?? Number.MAX_SAFE_INTEGER) -
      (orderByPmid.get(right.pmid) ?? Number.MAX_SAFE_INTEGER),
  )

  return {
    schemaVersion: ULTRA_SCREENING_SCHEMA_VERSION,
    valid: errors.length === 0,
    assignedCount: assignedPmids.size,
    parsedCount: nonblankLines.length,
    validRecordCount: records.length,
    errors,
    records,
  }
}

export function serializeUltraResults(records: readonly UltraScreeningResult[]) {
  return records.map((record) => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

export function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

export function sha256Text(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function sha256Json(value: unknown) {
  return sha256Text(stableJson(value))
}

export function compareNumericPmids(left: string, right: string) {
  if (left.length !== right.length) return left.length - right.length
  return left.localeCompare(right)
}

export function deterministicPmidOrder(pmids: readonly string[], seed: string) {
  return [...pmids].sort((left, right) => {
    const leftHash = sha256Text(`${seed}\0${left}`)
    const rightHash = sha256Text(`${seed}\0${right}`)
    const hashOrder = leftHash.localeCompare(rightHash)
    return hashOrder === 0 ? compareNumericPmids(left, right) : hashOrder
  })
}

export function deterministicPmidSample(pmids: readonly string[], count: number, seed: string) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Sample count must be a positive integer.')
  }
  const uniquePmids = [...new Set(pmids)]
  if (uniquePmids.length !== pmids.length) {
    throw new Error('Cannot sample a PMID list containing duplicates.')
  }
  if (count > uniquePmids.length) {
    throw new Error(`Cannot select ${count} PMIDs from ${uniquePmids.length} candidates.`)
  }
  return deterministicPmidOrder(uniquePmids, seed).slice(0, count)
}

export function balancedChunks<T>(values: readonly T[], chunkCount: number) {
  if (!Number.isInteger(chunkCount) || chunkCount < 1) {
    throw new Error('Chunk count must be a positive integer.')
  }
  if (chunkCount > values.length) {
    throw new Error('Chunk count cannot exceed the number of values.')
  }
  const baseSize = Math.floor(values.length / chunkCount)
  const largerChunkCount = values.length % chunkCount
  const chunks: T[][] = []
  let cursor = 0
  for (let index = 0; index < chunkCount; index += 1) {
    const size = baseSize + (index < largerChunkCount ? 1 : 0)
    chunks.push(values.slice(cursor, cursor + size))
    cursor += size
  }
  return chunks
}

export function fixedSizeChunks<T>(values: readonly T[], chunkSize: number) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error('Chunk size must be a positive integer.')
  }
  const chunks: T[][] = []
  for (let start = 0; start < values.length; start += chunkSize) {
    chunks.push(values.slice(start, start + chunkSize))
  }
  return chunks
}

export interface UltraScreeningTruth {
  pmid: string
  relevanceLabel: UltraRelevanceLabel
}

function safeRatio(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator
}

export function evaluateUltraScreening(
  truth: readonly UltraScreeningTruth[],
  predictions: readonly UltraScreeningResult[],
) {
  const predictionByPmid = new Map(predictions.map((result) => [result.pmid, result]))
  if (predictionByPmid.size !== predictions.length) {
    throw new Error('Predictions contain duplicate PMIDs.')
  }
  const truthByPmid = new Map(truth.map((result) => [result.pmid, result]))
  if (truthByPmid.size !== truth.length) {
    throw new Error('Truth contains duplicate PMIDs.')
  }
  const missing = truth.filter((item) => !predictionByPmid.has(item.pmid)).map((item) => item.pmid)
  const extra = predictions.filter((item) => !truthByPmid.has(item.pmid)).map((item) => item.pmid)
  if (missing.length || extra.length) {
    throw new Error(
      `Prediction/truth PMID mismatch. Missing: ${missing.join(', ') || 'none'}; extra: ${
        extra.join(', ') || 'none'
      }.`,
    )
  }

  const confusion = Object.fromEntries(
    ULTRA_RELEVANCE_LABELS.map((actual) => [
      actual,
      Object.fromEntries(ULTRA_RELEVANCE_LABELS.map((predicted) => [predicted, 0])),
    ]),
  ) as Record<UltraRelevanceLabel, Record<UltraRelevanceLabel, number>>

  let exact = 0
  let truePositive = 0
  let trueNegative = 0
  let falsePositive = 0
  let falseNegative = 0
  const dangerousFalseNegatives: Array<{
    pmid: string
    physicianLabel: UltraRelevanceLabel
    prediction: UltraScreeningResult
  }> = []

  for (const item of truth) {
    const prediction = predictionByPmid.get(item.pmid)
    if (!prediction) continue
    confusion[item.relevanceLabel][prediction.relevanceLabel] += 1
    if (item.relevanceLabel === prediction.relevanceLabel) exact += 1

    const actualIncluded =
      item.relevanceLabel === 'include_core' || item.relevanceLabel === 'include_adjacent'
    const predictedIncluded =
      prediction.relevanceLabel === 'include_core' ||
      prediction.relevanceLabel === 'include_adjacent'
    if (actualIncluded && predictedIncluded) truePositive += 1
    else if (!actualIncluded && !predictedIncluded) trueNegative += 1
    else if (!actualIncluded && predictedIncluded) falsePositive += 1
    else falseNegative += 1

    if (
      actualIncluded &&
      prediction.relevanceLabel === 'exclude' &&
      prediction.decisionConfidence === 'high'
    ) {
      dangerousFalseNegatives.push({
        pmid: item.pmid,
        physicianLabel: item.relevanceLabel,
        prediction,
      })
    }
  }

  const perLabel = Object.fromEntries(
    ULTRA_RELEVANCE_LABELS.map((label) => {
      const support = ULTRA_RELEVANCE_LABELS.reduce(
        (sum, predicted) => sum + confusion[label][predicted],
        0,
      )
      const predictedCount = ULTRA_RELEVANCE_LABELS.reduce(
        (sum, actual) => sum + confusion[actual][label],
        0,
      )
      const correct = confusion[label][label]
      const precision = safeRatio(correct, predictedCount)
      const recall = safeRatio(correct, support)
      const f1 =
        precision === null || recall === null || precision + recall === 0
          ? null
          : (2 * precision * recall) / (precision + recall)
      return [label, { support, predictedCount, precision, recall, f1 }]
    }),
  )

  return {
    schemaVersion: ULTRA_SCREENING_SCHEMA_VERSION,
    articleCount: truth.length,
    exactMatches: exact,
    exactAccuracy: safeRatio(exact, truth.length),
    confusion,
    perLabel,
    binaryInclude: {
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
      sensitivity: safeRatio(truePositive, truePositive + falseNegative),
      specificity: safeRatio(trueNegative, trueNegative + falsePositive),
      precision: safeRatio(truePositive, truePositive + falsePositive),
      negativePredictiveValue: safeRatio(trueNegative, trueNegative + falseNegative),
    },
    review: {
      uncertain: predictions.filter((result) => result.relevanceLabel === 'uncertain').length,
      lowConfidence: predictions.filter((result) => result.decisionConfidence === 'low').length,
      requiresHumanReview: predictions.filter((result) => result.requiresHumanReview).length,
    },
    dangerousFalseNegatives,
  }
}

export function compareUltraScreeningPasses(
  left: readonly UltraScreeningResult[],
  right: readonly UltraScreeningResult[],
) {
  const rightByPmid = new Map(right.map((result) => [result.pmid, result]))
  const overlap = left.filter((result) => rightByPmid.has(result.pmid))
  const agreements = overlap.filter(
    (result) => rightByPmid.get(result.pmid)?.relevanceLabel === result.relevanceLabel,
  )
  return {
    overlapCount: overlap.length,
    agreementCount: agreements.length,
    agreementRate: safeRatio(agreements.length, overlap.length),
    disagreements: overlap.flatMap((result) => {
      const comparison = rightByPmid.get(result.pmid)
      return comparison && comparison.relevanceLabel !== result.relevanceLabel
        ? [
            {
              pmid: result.pmid,
              left: result.relevanceLabel,
              right: comparison.relevanceLabel,
            },
          ]
        : []
    }),
  }
}

export interface UltraTerraSelection {
  pmid: string
  reasons: string[]
}

export function selectUltraTerraCandidates(options: {
  articles: readonly UltraScreeningArticle[]
  firstPass: readonly UltraScreeningResult[]
  challengePass?: readonly UltraScreeningResult[]
  qcRate?: number
  qcSeed: string
}) {
  const { articles, firstPass, challengePass = [], qcRate = 0.05, qcSeed } = options
  if (qcRate < 0 || qcRate > 1) throw new Error('QC rate must be between zero and one.')
  const articleByPmid = new Map(articles.map((article) => [article.pmid, article]))
  const challengeByPmid = new Map(challengePass.map((result) => [result.pmid, result]))
  const reasonsByPmid = new Map<string, Set<string>>()
  const add = (pmid: string, reason: string) => {
    const reasons = reasonsByPmid.get(pmid) ?? new Set<string>()
    reasons.add(reason)
    reasonsByPmid.set(pmid, reasons)
  }

  for (const result of firstPass) {
    if (result.relevanceLabel === 'uncertain') add(result.pmid, 'first_pass_uncertain')
    if (result.decisionConfidence === 'low') add(result.pmid, 'first_pass_low_confidence')
    if (articleByPmid.get(result.pmid)?.abstract === NO_ABSTRACT_MARKER) {
      add(result.pmid, 'no_abstract_boundary')
    }
    if (
      result.reasonCodes.includes('adjacent_preclinical_procedural') ||
      result.reasonCodes.includes('animal_nonprocedural')
    ) {
      add(result.pmid, 'animal_preclinical_boundary')
    }
    const challenge = challengeByPmid.get(result.pmid)
    if (challenge && challenge.relevanceLabel !== result.relevanceLabel) {
      add(result.pmid, 'luna_disagreement')
    }
    if (challenge?.relevanceLabel === 'uncertain') add(result.pmid, 'challenge_uncertain')
    if (challenge?.decisionConfidence === 'low') add(result.pmid, 'challenge_low_confidence')
  }

  const confidentExclusions = firstPass
    .filter(
      (result) =>
        result.relevanceLabel === 'exclude' &&
        result.decisionConfidence === 'high' &&
        !result.requiresHumanReview,
    )
    .map((result) => result.pmid)
  const qcCount = Math.ceil(confidentExclusions.length * qcRate)
  for (const pmid of deterministicPmidOrder(confidentExclusions, qcSeed).slice(0, qcCount)) {
    add(pmid, 'confident_exclusion_qc')
  }

  return [...reasonsByPmid.entries()]
    .map(
      ([pmid, reasons]): UltraTerraSelection => ({
        pmid,
        reasons: [...reasons].sort(),
      }),
    )
    .sort((left, right) => compareNumericPmids(left.pmid, right.pmid))
}
