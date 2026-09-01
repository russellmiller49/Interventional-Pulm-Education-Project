import {
  capabilityFromArticleCount,
  capabilityFromFailure,
  capabilityFromFilteredRead,
  type LiteratureCapability,
} from './runtime-capability'
import { literatureClientForOperation } from './database-client'

export const literatureShadowRelevanceValues = [
  'include_core',
  'include_adjacent',
  'include',
  'exclude',
] as const
export const literatureShadowZoneValues = [
  'conference_projection',
  'auto_exclude',
  'review',
  'auto_include',
] as const

export type LiteratureShadowRelevance = (typeof literatureShadowRelevanceValues)[number]
export type LiteratureShadowZone = (typeof literatureShadowZoneValues)[number]

export interface LiteratureShadowFilters {
  runId?: number
  relevance?: LiteratureShadowRelevance
  zone?: LiteratureShadowZone
  page: number
}

export interface LiteratureShadowRun {
  id: number
  runKey: string
  sourceKind: 'conference_projection' | 'screening_ml'
  sourceRepository: string
  sourceReleaseTag: string
  sourceArtifactSha256: string
  modelKey: string
  modelMetadata: Record<string, unknown>
  status: 'prepared' | 'verified' | 'retired'
  classificationCount: number
  enhancementCount: number
  termCount: number
  classCounts: Record<string, number>
  zoneCounts: Record<string, number>
  importedAt: string
}

export interface LiteratureShadowClassification {
  pmid: string
  title: string
  journal: string | null
  publicationYear: number | null
  predictedRelevance: LiteratureShadowRelevance
  predictedConfidence: 'high' | 'medium' | 'low' | null
  inclusionProbability: number | null
  decisionZone: LiteratureShadowZone
  predictedCategory: string | null
  predictedCategoryProbability: number | null
  reviewPriority: 'high' | 'medium' | 'low' | null
  displaySummary: string | null
}

export interface LiteratureShadowOverview {
  runs: LiteratureShadowRun[]
  selectedRun: LiteratureShadowRun | null
  items: LiteratureShadowClassification[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type LiteratureShadowResult =
  | { data: LiteratureShadowOverview; error: null; capability: LiteratureCapability }
  | { data: null; error: string; capability: LiteratureCapability }

interface ShadowRunRow {
  id: number | string
  run_key: string
  source_kind: LiteratureShadowRun['sourceKind']
  source_repository: string
  source_release_tag: string
  source_artifact_sha256: string
  model_key: string
  model_metadata: unknown
  status: LiteratureShadowRun['status']
  classification_count: number | string
  enhancement_count: number | string
  term_count: number | string
  class_counts: unknown
  zone_counts: unknown
  imported_at: string
}

interface ShadowClassificationRow {
  pmid: string
  source_title: string
  source_journal: string | null
  source_publication_year: number | null
  predicted_relevance: LiteratureShadowRelevance
  predicted_confidence: LiteratureShadowClassification['predictedConfidence']
  inclusion_probability: number | string | null
  decision_zone: LiteratureShadowZone
  predicted_category: string | null
  predicted_category_probability: number | string | null
  review_priority: LiteratureShadowClassification['reviewPriority']
  display_summary: string | null
}

const PAGE_SIZE = 25

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function countMap(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(objectValue(value)).flatMap(([key, count]) => {
      const numeric = Number(count)
      return Number.isFinite(numeric) ? [[key, numeric]] : []
    }),
  )
}

function runDisplay(row: ShadowRunRow): LiteratureShadowRun {
  return {
    id: Number(row.id),
    runKey: row.run_key,
    sourceKind: row.source_kind,
    sourceRepository: row.source_repository,
    sourceReleaseTag: row.source_release_tag,
    sourceArtifactSha256: row.source_artifact_sha256,
    modelKey: row.model_key,
    modelMetadata: objectValue(row.model_metadata),
    status: row.status,
    classificationCount: Number(row.classification_count),
    enhancementCount: Number(row.enhancement_count),
    termCount: Number(row.term_count),
    classCounts: countMap(row.class_counts),
    zoneCounts: countMap(row.zone_counts),
    importedAt: row.imported_at,
  }
}

function classificationDisplay(row: ShadowClassificationRow): LiteratureShadowClassification {
  return {
    pmid: row.pmid,
    title: row.source_title,
    journal: row.source_journal,
    publicationYear: row.source_publication_year,
    predictedRelevance: row.predicted_relevance,
    predictedConfidence: row.predicted_confidence,
    inclusionProbability:
      row.inclusion_probability === null ? null : Number(row.inclusion_probability),
    decisionZone: row.decision_zone,
    predictedCategory: row.predicted_category,
    predictedCategoryProbability:
      row.predicted_category_probability === null
        ? null
        : Number(row.predicted_category_probability),
    reviewPriority: row.review_priority,
    displaySummary: row.display_summary,
  }
}

export async function loadLiteratureShadowOverview(
  filters: LiteratureShadowFilters,
): Promise<LiteratureShadowResult> {
  const access = literatureClientForOperation('shadow_read')
  if (!access.client) {
    return {
      data: null,
      error: access.capability.message,
      capability: access.capability,
    }
  }

  const runsQuery = await access.client
    .from('literature_shadow_runs')
    .select(
      'id,run_key,source_kind,source_repository,source_release_tag,source_artifact_sha256,model_key,model_metadata,status,classification_count,enhancement_count,term_count,class_counts,zone_counts,imported_at',
    )
    .order('imported_at', { ascending: false })
    .limit(20)

  if (runsQuery.error) {
    return {
      data: null,
      error: 'The AI/ML shadow run registry could not be read.',
      capability: capabilityFromFailure(runsQuery.error, {
        projectRef: access.projectRef,
        surface: 'shadow_workflow',
      }),
    }
  }

  const runs = ((runsQuery.data ?? []) as ShadowRunRow[]).map(runDisplay)
  const selectedRun =
    runs.find((run) => filters.runId !== undefined && run.id === filters.runId) ?? runs[0] ?? null
  if (!selectedRun) {
    return {
      data: {
        runs,
        selectedRun: null,
        items: [],
        total: 0,
        page: 1,
        pageSize: PAGE_SIZE,
        pageCount: 0,
      },
      error: null,
      capability: capabilityFromArticleCount(0, access.projectRef),
    }
  }

  const page = Math.max(1, filters.page)
  let query = access.client
    .from('literature_shadow_classifications')
    .select(
      'pmid,source_title,source_journal,source_publication_year,predicted_relevance,predicted_confidence,inclusion_probability,decision_zone,predicted_category,predicted_category_probability,review_priority,display_summary',
      { count: 'exact' },
    )
    .eq('run_id', selectedRun.id)
  if (filters.relevance) query = query.eq('predicted_relevance', filters.relevance)
  if (filters.zone) query = query.eq('decision_zone', filters.zone)
  const start = (page - 1) * PAGE_SIZE
  const rowsQuery = await query
    .order('pmid', { ascending: true })
    .range(start, start + PAGE_SIZE - 1)

  if (rowsQuery.error) {
    return {
      data: null,
      error: 'The selected AI/ML shadow run could not be read.',
      capability: capabilityFromFailure(rowsQuery.error, {
        projectRef: access.projectRef,
        surface: 'shadow_workflow',
      }),
    }
  }

  const total = rowsQuery.count ?? 0
  return {
    data: {
      runs,
      selectedRun,
      items: ((rowsQuery.data ?? []) as ShadowClassificationRow[]).map(classificationDisplay),
      total,
      page,
      pageSize: PAGE_SIZE,
      pageCount: total === 0 ? 0 : Math.ceil(total / PAGE_SIZE),
    },
    error: null,
    capability: capabilityFromFilteredRead(access.projectRef),
  }
}
