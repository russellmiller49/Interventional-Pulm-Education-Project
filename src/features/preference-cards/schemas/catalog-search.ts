import { z } from 'zod'

export const DEFAULT_CATALOG_PAGE_SIZE = 25
export const MAX_CATALOG_PAGE_SIZE = 100
export const MAX_CATALOG_QUERY_LENGTH = 200

export const catalogSortValues = [
  'relevance',
  'name',
  'manufacturer',
  'diameter',
  'length',
] as const
export const catalogTierValues = ['all', 'verified', 'unverified'] as const

export type CatalogSortValue = (typeof catalogSortValues)[number]
export type CatalogTierValue = (typeof catalogTierValues)[number]

const optionalNumberSchema = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(min).max(max).optional(),
  )

const positiveIntegerSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
)

export const catalogSearchSchema = z
  .object({
    q: z.string().trim().max(MAX_CATALOG_QUERY_LENGTH).default(''),
    manufacturers: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    category: z.string().trim().min(1).max(160).optional(),
    subcategory: z.string().trim().min(1).max(160).optional(),
    role: z.string().trim().min(1).max(80).optional(),
    procedure: z.string().trim().min(1).max(80).optional(),
    tier: z.enum(catalogTierValues).default('all'),
    diameterMin: optionalNumberSchema(0, 60),
    diameterMax: optionalNumberSchema(0, 60),
    lengthMin: optionalNumberSchema(0, 1000),
    lengthMax: optionalNumberSchema(0, 1000),
    /** "Fits my scope": keep products whose required working channel is at most this. */
    channelMax: optionalNumberSchema(0, 6),
    sort: z.enum(catalogSortValues).default('relevance'),
    page: positiveIntegerSchema.default(1),
    pageSize: positiveIntegerSchema
      .pipe(z.number().int().min(1).max(MAX_CATALOG_PAGE_SIZE))
      .default(DEFAULT_CATALOG_PAGE_SIZE),
  })
  .superRefine((query, context) => {
    if (
      query.diameterMin !== undefined &&
      query.diameterMax !== undefined &&
      query.diameterMin > query.diameterMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`diameterMin` must not be greater than `diameterMax`.',
        path: ['diameterMax'],
      })
    }
    if (
      query.lengthMin !== undefined &&
      query.lengthMax !== undefined &&
      query.lengthMin > query.lengthMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`lengthMin` must not be greater than `lengthMax`.',
        path: ['lengthMax'],
      })
    }
  })

export type CatalogSearchQuery = z.infer<typeof catalogSearchSchema>

function parseList(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

export function catalogSearchInputFromUrl(searchParams: URLSearchParams) {
  return {
    q: searchParams.get('q') ?? '',
    manufacturers: parseList(searchParams, 'manufacturer'),
    category: searchParams.get('category') || undefined,
    subcategory: searchParams.get('subcategory') || undefined,
    role: searchParams.get('role') || undefined,
    procedure: searchParams.get('procedure') || undefined,
    tier: searchParams.get('tier') || 'all',
    diameterMin: searchParams.get('diameterMin') ?? undefined,
    diameterMax: searchParams.get('diameterMax') ?? undefined,
    lengthMin: searchParams.get('lengthMin') ?? undefined,
    lengthMax: searchParams.get('lengthMax') ?? undefined,
    channelMax: searchParams.get('channelMax') ?? undefined,
    sort: searchParams.get('sort') || 'relevance',
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
  }
}

/** Serialize back to a query string, omitting defaults so URLs stay readable. */
export function serializeCatalogSearchQuery(query: CatalogSearchQuery): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  for (const manufacturer of query.manufacturers) params.append('manufacturer', manufacturer)
  if (query.category) params.set('category', query.category)
  if (query.subcategory) params.set('subcategory', query.subcategory)
  if (query.role) params.set('role', query.role)
  if (query.procedure) params.set('procedure', query.procedure)
  if (query.tier !== 'all') params.set('tier', query.tier)
  if (query.diameterMin !== undefined) params.set('diameterMin', String(query.diameterMin))
  if (query.diameterMax !== undefined) params.set('diameterMax', String(query.diameterMax))
  if (query.lengthMin !== undefined) params.set('lengthMin', String(query.lengthMin))
  if (query.lengthMax !== undefined) params.set('lengthMax', String(query.lengthMax))
  if (query.channelMax !== undefined) params.set('channelMax', String(query.channelMax))
  if (query.sort !== 'relevance') params.set('sort', query.sort)
  if (query.page > 1) params.set('page', String(query.page))
  if (query.pageSize !== DEFAULT_CATALOG_PAGE_SIZE) params.set('pageSize', String(query.pageSize))
  return params.toString()
}

export type CatalogPageSearchParams = Record<string, string | string[] | undefined>

export function catalogPageSearchParamsToUrl(
  searchParams: CatalogPageSearchParams | undefined,
): URLSearchParams {
  const params = new URLSearchParams()
  if (!searchParams) return params
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry)
    } else if (typeof value === 'string') {
      params.set(key, value)
    }
  }
  return params
}
