import {
  catalogSearchInputFromUrl,
  catalogSearchSchema,
  serializeCatalogSearchQuery,
  type CatalogSearchQuery,
} from '@/features/preference-cards/schemas/catalog-search'
import { deviceClassOfSubtype, isDeviceClassCode, isDeviceSubtypeCode } from './product-taxonomy'

/**
 * URL state for the Device Atlas index. Everything here is pure: the index stays a
 * server-rendered page whose whole state is its query string, so a search can be bookmarked,
 * shared, and returned to from a device page.
 *
 * One rule runs through every helper: a link changes exactly the filter it names. Removing a
 * chip, picking a subtype, or switching the view rebuilds the URL from the parsed query, so
 * the other filters survive and the result is deterministic (`serializeCatalogSearchQuery`
 * fixes the parameter order and omits defaults).
 */

/** Numeric specification filters, in the order their chips and inputs appear. */
export const ATLAS_SPEC_FILTER_PARAMS = [
  'diameterMin',
  'diameterMax',
  'lengthMin',
  'lengthMax',
  'channelMax',
  'gauge',
  'frenchMin',
  'frenchMax',
  'workingLengthMin',
  'workingLengthMax',
] as const satisfies readonly (keyof CatalogSearchQuery)[]

export type AtlasSpecFilterParam = (typeof ATLAS_SPEC_FILTER_PARAMS)[number]

export function hasActiveSpecFilter(query: CatalogSearchQuery): boolean {
  return ATLAS_SPEC_FILTER_PARAMS.some((param) => query[param] !== undefined)
}

function withoutSpecFilters(query: CatalogSearchQuery): CatalogSearchQuery {
  const next: CatalogSearchQuery = { ...query, specUnknown: 'exclude' }
  for (const param of ATLAS_SPEC_FILTER_PARAMS) next[param] = undefined
  return next
}

export interface NormalizedAtlasQuery {
  query: CatalogSearchQuery
  /**
   * True when the URL named a subtype that belongs to a different class than the one it also
   * named. The class wins (it is the broader, more recently chosen control in the form) and
   * the page says so instead of silently showing an empty list.
   */
  subtypeDroppedForClassMismatch: boolean
}

/**
 * Reconcile the class and subtype filters. A subtype is owned by exactly one class, so a
 * subtype alone implies its class; a subtype that contradicts the named class is dropped.
 * Unknown codes are left untouched for `validateAtlasFilters` to report honestly.
 */
export function normalizeAtlasQuery(query: CatalogSearchQuery): NormalizedAtlasQuery {
  const subtype = query.deviceSubtype
  if (!subtype || !isDeviceSubtypeCode(subtype)) {
    return { query, subtypeDroppedForClassMismatch: false }
  }
  const owningClass = deviceClassOfSubtype(subtype)
  if (!query.deviceClass) {
    return { query: { ...query, deviceClass: owningClass }, subtypeDroppedForClassMismatch: false }
  }
  if (isDeviceClassCode(query.deviceClass) && query.deviceClass !== owningClass) {
    return { query: { ...query, deviceSubtype: undefined }, subtypeDroppedForClassMismatch: true }
  }
  return { query, subtypeDroppedForClassMismatch: false }
}

export function atlasIndexHref(locale: string, query: CatalogSearchQuery): string {
  const serialized = serializeCatalogSearchQuery(query)
  return `/${locale}/devices${serialized ? `?${serialized}` : ''}`
}

/**
 * Choosing a device class starts a new browse within the current search: the text query,
 * manufacturer, role, procedure, sort and view stay, while the subtype, product line and
 * numeric specification filters — all of which are meaningful only inside one class — reset.
 */
export function withDeviceClass(
  query: CatalogSearchQuery,
  deviceClass: string | undefined,
): CatalogSearchQuery {
  return {
    ...withoutSpecFilters(query),
    deviceClass,
    deviceSubtype: undefined,
    family: undefined,
    page: 1,
  }
}

/** Choosing a subtype keeps every other filter, including the class-level spec filters. */
export function withDeviceSubtype(
  query: CatalogSearchQuery,
  deviceSubtype: string | undefined,
): CatalogSearchQuery {
  return {
    ...query,
    deviceClass:
      deviceSubtype && isDeviceSubtypeCode(deviceSubtype)
        ? deviceClassOfSubtype(deviceSubtype)
        : query.deviceClass,
    deviceSubtype,
    family: undefined,
    page: 1,
  }
}

export type AtlasFilterId =
  | 'q'
  | 'deviceClass'
  | 'deviceSubtype'
  | 'family'
  | `manufacturer:${string}`
  | 'role'
  | 'procedure'
  | 'diameter'
  | 'length'
  | 'channelMax'
  | 'gauge'
  | 'french'
  | 'workingLength'
  | 'specUnknown'

export interface ActiveAtlasFilter {
  id: AtlasFilterId
  /** The raw stored value (a code, an id, or free text); the page resolves its label. */
  value: string
  min?: number
  max?: number
}

const RANGE_FILTERS = [
  { id: 'diameter', min: 'diameterMin', max: 'diameterMax' },
  { id: 'length', min: 'lengthMin', max: 'lengthMax' },
  { id: 'french', min: 'frenchMin', max: 'frenchMax' },
  { id: 'workingLength', min: 'workingLengthMin', max: 'workingLengthMax' },
] as const

/** Every filter currently narrowing the results, in a stable display order. */
export function activeAtlasFilters(query: CatalogSearchQuery): ActiveAtlasFilter[] {
  const filters: ActiveAtlasFilter[] = []
  if (query.q) filters.push({ id: 'q', value: query.q })
  if (query.deviceClass) filters.push({ id: 'deviceClass', value: query.deviceClass })
  if (query.deviceSubtype) filters.push({ id: 'deviceSubtype', value: query.deviceSubtype })
  if (query.family) filters.push({ id: 'family', value: query.family })
  for (const manufacturer of query.manufacturers) {
    filters.push({ id: `manufacturer:${manufacturer}`, value: manufacturer })
  }
  if (query.role) filters.push({ id: 'role', value: query.role })
  if (query.procedure) filters.push({ id: 'procedure', value: query.procedure })
  for (const range of RANGE_FILTERS) {
    const min = query[range.min]
    const max = query[range.max]
    if (min === undefined && max === undefined) continue
    filters.push({ id: range.id, value: `${min ?? ''}-${max ?? ''}`, min, max })
  }
  if (query.channelMax !== undefined) {
    filters.push({ id: 'channelMax', value: String(query.channelMax), max: query.channelMax })
  }
  if (query.gauge !== undefined) filters.push({ id: 'gauge', value: String(query.gauge) })
  if (query.specUnknown === 'only') filters.push({ id: 'specUnknown', value: 'only' })
  return filters
}

/**
 * The query with one filter removed and every other filter preserved. The single dependency:
 * a subtype cannot outlive its class, so removing the class removes the subtype with it.
 */
export function withoutAtlasFilter(
  query: CatalogSearchQuery,
  id: AtlasFilterId,
): CatalogSearchQuery {
  const next: CatalogSearchQuery = { ...query, page: 1 }
  if (id.startsWith('manufacturer:')) {
    const manufacturer = id.slice('manufacturer:'.length)
    next.manufacturers = query.manufacturers.filter((entry) => entry !== manufacturer)
    return next
  }
  switch (id) {
    case 'q':
      next.q = ''
      break
    case 'deviceClass':
      next.deviceClass = undefined
      next.deviceSubtype = undefined
      break
    case 'deviceSubtype':
      next.deviceSubtype = undefined
      break
    case 'family':
      next.family = undefined
      break
    case 'role':
      next.role = undefined
      break
    case 'procedure':
      next.procedure = undefined
      break
    case 'channelMax':
      next.channelMax = undefined
      break
    case 'gauge':
      next.gauge = undefined
      break
    case 'specUnknown':
      next.specUnknown = 'exclude'
      break
    default: {
      const range = RANGE_FILTERS.find((candidate) => candidate.id === id)
      if (range) {
        next[range.min] = undefined
        next[range.max] = undefined
      }
    }
  }
  // "Unknown value only" describes the spec filters; with none left it means nothing.
  if (!hasActiveSpecFilter(next)) next.specUnknown = 'exclude'
  return next
}

/**
 * Return context — how a device page finds its way back to the search it was opened from.
 *
 * The context travels as one `from` parameter holding a serialized atlas query. It is never
 * used as a URL: it is parsed through the same schema as the index itself and re-serialized,
 * so whatever arrives, the only thing that can come out is a canonical `/devices?…` query
 * string. A malformed or hostile value simply yields no context, and the page falls back to
 * the plain index. Browser history is not involved, so new tabs and shared links still work.
 */
const MAX_RETURN_CONTEXT_LENGTH = 1500

export function encodeReturnContext(query: CatalogSearchQuery): string {
  return serializeCatalogSearchQuery(query)
}

export function parseReturnContext(raw: string | string[] | undefined | null): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_RETURN_CONTEXT_LENGTH) {
    return null
  }
  let params: URLSearchParams
  try {
    params = new URLSearchParams(raw)
  } catch {
    return null
  }
  const parsed = catalogSearchSchema.safeParse(catalogSearchInputFromUrl(params))
  if (!parsed.success) return null
  return serializeCatalogSearchQuery(parsed.data) || null
}

export function deviceDetailHref(
  locale: string,
  productId: string,
  returnContext?: string | null,
): string {
  const base = `/${locale}/devices/${productId}`
  return returnContext ? `${base}?from=${encodeURIComponent(returnContext)}` : base
}

export function returnToResultsHref(locale: string, returnContext: string | null): string {
  return `/${locale}/devices${returnContext ? `?${returnContext}` : ''}`
}
