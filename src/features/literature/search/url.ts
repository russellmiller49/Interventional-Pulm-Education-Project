import type { LiteratureSearchQuery } from '@/features/literature/schemas/search'

export function serializeLiteratureSearchQuery(
  query: LiteratureSearchQuery,
  options: { includePageSize?: boolean; includeAdminPreview?: boolean } = {},
) {
  const searchParams = new URLSearchParams()

  if (query.q) {
    searchParams.set('q', query.q)
  }
  query.topicIds.forEach((topicId) => searchParams.append('topic', topicId))
  query.journalIds.forEach((journalId) => searchParams.append('journal', journalId))
  if (query.yearFrom) {
    searchParams.set('yearFrom', String(query.yearFrom))
  }
  if (query.yearTo) {
    searchParams.set('yearTo', String(query.yearTo))
  }
  query.publicationTypes.forEach((publicationType) =>
    searchParams.append('publicationType', publicationType),
  )
  if (query.landmarkOnly) {
    searchParams.set('landmark', '1')
  }
  if (query.sort !== 'relevance') {
    searchParams.set('sort', query.sort)
  }
  if (query.page > 1) {
    searchParams.set('page', String(query.page))
  }
  if (options.includePageSize && query.pageSize !== 20) {
    searchParams.set('pageSize', String(query.pageSize))
  }
  if (options.includeAdminPreview && query.adminPreview) {
    searchParams.set('adminPreview', '1')
  }

  return searchParams.toString()
}
