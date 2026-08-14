import type { OpenFdaClient, OpenFdaClientResult } from '../openfda/client'
import type { OpenFdaRecord } from '../openfda/types'

export interface FdaQueryExecutionMetrics {
  pages: number
  apiRequests: number
  cacheHits: number
  cacheMisses: number
  retries: number
}

export interface FdaResponseProvenance {
  request_url: string
  request_search: string
  request_limit: number
  request_skip: number
  retrieved_at: string
  response_sha256: string
  raw_cache_reference: string
}

export interface PaginatedFdaResponsePage extends FdaResponseProvenance {
  records: OpenFdaRecord[]
}

export interface PaginatedFdaQueryResult {
  records: OpenFdaRecord[]
  datasetLastUpdated: string | null
  resultTotal: number | null
  retrievedAt: string[]
  rawCacheReferences: string[]
  pages: PaginatedFdaResponsePage[]
  truncated: boolean
  metrics: FdaQueryExecutionMetrics
}

export interface PaginatedFdaQueryOptions {
  search: string
  limit?: number
  maxPages?: number
  refresh?: boolean
}

function pageMetrics(page: OpenFdaClientResult): FdaQueryExecutionMetrics {
  return {
    pages: 1,
    apiRequests: page.apiRequestsMade,
    cacheHits: page.fromCache ? 1 : 0,
    cacheMisses: page.fromCache ? 0 : 1,
    retries: page.retryCount,
  }
}

function addMetrics(
  total: FdaQueryExecutionMetrics,
  next: FdaQueryExecutionMetrics,
): FdaQueryExecutionMetrics {
  return {
    pages: total.pages + next.pages,
    apiRequests: total.apiRequests + next.apiRequests,
    cacheHits: total.cacheHits + next.cacheHits,
    cacheMisses: total.cacheMisses + next.cacheMisses,
    retries: total.retries + next.retries,
  }
}

/**
 * Read all bounded pages for one exact openFDA query through the existing cache/retry client.
 * Callers still perform endpoint-specific exact local filtering; API result totals describe
 * analyzed search hits and therefore cannot establish exact identity on their own.
 */
export async function queryOpenFdaPages(
  client: OpenFdaClient,
  { search, limit = 100, maxPages = 10, refresh = false }: PaginatedFdaQueryOptions,
): Promise<PaginatedFdaQueryResult> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
  const safeMaxPages = Math.max(1, Math.min(250, Math.trunc(maxPages)))
  const records: OpenFdaRecord[] = []
  const retrievedAt = new Set<string>()
  const rawCacheReferences = new Set<string>()
  const pages: PaginatedFdaResponsePage[] = []
  let datasetLastUpdated: string | null = null
  let resultTotal: number | null = null
  let metrics: FdaQueryExecutionMetrics = {
    pages: 0,
    apiRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    retries: 0,
  }

  for (let pageIndex = 0; pageIndex < safeMaxPages; pageIndex += 1) {
    const skip = pageIndex * safeLimit
    if (skip > 25_000) break
    const page = await client.request({ search, limit: safeLimit, skip, refresh })
    if (
      page.requestSearch !== search ||
      page.requestLimit !== safeLimit ||
      page.requestSkip !== skip
    ) {
      throw new Error('openFDA client response provenance does not match the requested query page.')
    }
    records.push(...page.records)
    if (page.datasetLastUpdated) datasetLastUpdated = page.datasetLastUpdated
    if (page.resultTotal !== null) resultTotal = page.resultTotal
    retrievedAt.add(page.retrievedAt)
    rawCacheReferences.add(page.rawCacheReference)
    pages.push({
      request_url: page.requestUrl,
      request_search: page.requestSearch,
      request_limit: page.requestLimit,
      request_skip: page.requestSkip,
      retrieved_at: page.retrievedAt,
      response_sha256: page.responseSha256,
      raw_cache_reference: page.rawCacheReference,
      records: page.records,
    })
    metrics = addMetrics(metrics, pageMetrics(page))

    const knownComplete = resultTotal !== null && records.length >= resultTotal
    if (knownComplete || page.records.length < safeLimit) break
  }

  return {
    records,
    datasetLastUpdated,
    resultTotal,
    retrievedAt: [...retrievedAt].sort(),
    rawCacheReferences: [...rawCacheReferences].sort(),
    pages,
    truncated:
      resultTotal !== null
        ? records.length < resultTotal
        : records.length >= safeLimit * safeMaxPages,
    metrics,
  }
}
