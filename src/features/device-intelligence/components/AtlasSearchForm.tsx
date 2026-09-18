import { Button } from '@/components/ui/button'
import type { CatalogSearchQuery } from '@/features/preference-cards/schemas/catalog-search'
import {
  ATLAS_SPEC_FILTERS,
  deviceDisplayConfigFor,
  type AtlasSpecFilterKey,
} from '@/features/device-intelligence/domain/device-display-config'
import { hasActiveSpecFilter } from '@/features/device-intelligence/domain/atlas-query'
import type { AtlasFacets } from '@/features/device-intelligence/server/atlas.server'

/**
 * Plain GET form — filters live entirely in URL params, so the index is linkable,
 * server-rendered, and needs no client JavaScript. Selects and inputs are labeled for
 * keyboard and screen-reader use.
 *
 * Hierarchy: the search box leads; the three controls most searches need (device class,
 * subtype, manufacturer) are always visible; clinical role, procedure and the numeric
 * specification filters sit under "More filters", which opens itself whenever one of them is
 * active so an applied filter is never hidden.
 *
 * D2C: the class and subtype controls submit stable taxonomy CODES, displayed by localized
 * label. The specification inputs offered are the ones the display config lists for the
 * selected class (generic ones otherwise); every one maps to an existing URL parameter.
 */

const FIELD =
  'h-11 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const LABEL = 'text-xs font-semibold text-muted-foreground'

export interface AtlasSearchFormLabels {
  search: string
  searchPlaceholder: string
  manufacturer: string
  deviceClass: string
  deviceSubtype: string
  subtypeNeedsClass: string
  role: string
  procedure: string
  any: string
  apply: string
  moreFilters: string
  specHeading: string
  specNote: string
  min: string
  max: string
  specFilters: Record<AtlasSpecFilterKey, string>
  channelMaxHelp: string
}

export function AtlasSearchForm({
  locale,
  query,
  facets,
  deviceClassLabels,
  subtypeOptions,
  labels,
}: {
  locale: string
  query: CatalogSearchQuery
  facets: AtlasFacets
  /** Localized label per device-class code, from the taxonomy message bundle. */
  deviceClassLabels: Record<string, string>
  /** Subtypes of the selected class, already labeled; empty when no class is selected. */
  subtypeOptions: { code: string; label: string; productCount: number }[]
  labels: AtlasSearchFormLabels
}) {
  const action = `/${locale}/devices`
  const deviceClassOptions = facets.deviceClasses
    .map((facet) => ({
      code: facet.code,
      productCount: facet.productCount,
      label: deviceClassLabels[facet.code] ?? facet.code,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale))
  const specFilterKeys = deviceDisplayConfigFor(query.deviceClass).filterFields
  const moreFiltersActive = Boolean(query.role || query.procedure || hasActiveSpecFilter(query))

  return (
    <form action={action} method="get" role="search" className="min-w-0 space-y-4">
      {/* Presentation state rides along so applying a filter never resets the view or sort. */}
      {query.view ? <input type="hidden" name="view" value={query.view} /> : null}
      {query.sort !== 'relevance' ? <input type="hidden" name="sort" value={query.sort} /> : null}
      {query.family ? <input type="hidden" name="family" value={query.family} /> : null}

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="atlas-q" className={LABEL}>
            {labels.search}
          </label>
          <input
            id="atlas-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder={labels.searchPlaceholder}
            className="h-12 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" className="min-h-12">
          {labels.apply}
        </Button>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="atlas-device-class" className={LABEL}>
            {labels.deviceClass}
          </label>
          <select
            id="atlas-device-class"
            name="deviceClass"
            defaultValue={query.deviceClass ?? ''}
            className={FIELD}
          >
            <option value="">{labels.any}</option>
            {deviceClassOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label} ({option.productCount})
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="atlas-device-subtype" className={LABEL}>
            {labels.deviceSubtype}
          </label>
          <select
            id="atlas-device-subtype"
            name="deviceSubtype"
            defaultValue={query.deviceSubtype ?? ''}
            disabled={subtypeOptions.length === 0}
            aria-describedby={subtypeOptions.length === 0 ? 'atlas-subtype-hint' : undefined}
            className={`${FIELD} disabled:opacity-60`}
          >
            <option value="">{labels.any}</option>
            {subtypeOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label} ({option.productCount})
              </option>
            ))}
          </select>
          {subtypeOptions.length === 0 ? (
            <p id="atlas-subtype-hint" className="text-[11px] text-muted-foreground">
              {labels.subtypeNeedsClass}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="atlas-manufacturer" className={LABEL}>
            {labels.manufacturer}
          </label>
          <select
            id="atlas-manufacturer"
            name="manufacturer"
            defaultValue={query.manufacturers[0] ?? ''}
            className={FIELD}
          >
            <option value="">{labels.any}</option>
            {facets.manufacturers.map((manufacturer) => (
              <option key={manufacturer.id} value={manufacturer.id}>
                {manufacturer.displayName} ({manufacturer.productCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      <details open={moreFiltersActive} className="min-w-0">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {labels.moreFilters}
        </summary>
        <div className="mt-2 space-y-4">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="atlas-role" className={LABEL}>
                {labels.role}
              </label>
              <select id="atlas-role" name="role" defaultValue={query.role ?? ''} className={FIELD}>
                <option value="">{labels.any}</option>
                {facets.roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="atlas-procedure" className={LABEL}>
                {labels.procedure}
              </label>
              <select
                id="atlas-procedure"
                name="procedure"
                defaultValue={query.procedure ?? ''}
                className={FIELD}
              >
                <option value="">{labels.any}</option>
                {facets.procedures.map((procedure) => (
                  <option key={procedure.code} value={procedure.code}>
                    {procedure.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-semibold">{labels.specHeading}</legend>
            <p className="text-xs leading-5 text-muted-foreground">{labels.specNote}</p>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {specFilterKeys.map((key) => {
                const definition = ATLAS_SPEC_FILTERS[key]
                const label = `${labels.specFilters[key]} (${definition.unit})`
                if (definition.kind === 'range') {
                  return (
                    <fieldset key={key} className="min-w-0">
                      <legend className={LABEL}>{label}</legend>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {(['min', 'max'] as const).map((bound) => {
                          const param = bound === 'min' ? definition.minParam : definition.maxParam
                          return (
                            <input
                              key={param}
                              name={param}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={definition.step}
                              defaultValue={query[param] ?? ''}
                              placeholder={labels[bound]}
                              aria-label={`${label} — ${labels[bound]}`}
                              className={FIELD}
                            />
                          )
                        })}
                      </div>
                    </fieldset>
                  )
                }
                return (
                  <div key={key} className="flex min-w-0 flex-col gap-1">
                    <label htmlFor={`atlas-spec-${key}`} className={LABEL}>
                      {label}
                    </label>
                    <input
                      id={`atlas-spec-${key}`}
                      name={definition.param}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={definition.step}
                      defaultValue={query[definition.param] ?? ''}
                      aria-describedby={key === 'channelMax' ? 'atlas-channel-help' : undefined}
                      className={FIELD}
                    />
                    {key === 'channelMax' ? (
                      <p
                        id="atlas-channel-help"
                        className="text-[11px] leading-4 text-muted-foreground"
                      >
                        {labels.channelMaxHelp}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </fieldset>
        </div>
      </details>
    </form>
  )
}
