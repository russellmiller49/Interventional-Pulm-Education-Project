import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { CatalogSearchQuery } from '@/features/preference-cards/schemas/catalog-search'
import type { AtlasFacets } from '@/features/device-intelligence/server/atlas.server'

/**
 * Plain GET form — filters live entirely in URL params, so the index is linkable,
 * server-rendered, and needs no client JavaScript. Selects and inputs are labeled for
 * keyboard and screen-reader use.
 *
 * D2C: the canonical-category facet is replaced by the normalized Device class facet.
 * Options are the controlled device classes present in the atlas cohort, displayed by
 * localized label (sorted by that label, so es/zh menus read naturally) with cohort
 * counts. The submitted value is the stable class CODE, never the label.
 */
export function AtlasSearchForm({
  locale,
  query,
  facets,
  deviceClassLabels,
  labels,
}: {
  locale: string
  query: CatalogSearchQuery
  facets: AtlasFacets
  /** Localized label per device-class code, from the taxonomy message bundle. */
  deviceClassLabels: Record<string, string>
  labels: {
    search: string
    searchPlaceholder: string
    manufacturer: string
    deviceClass: string
    role: string
    procedure: string
    any: string
    apply: string
    clear: string
  }
}) {
  const action = `/${locale}/devices`
  const deviceClassOptions = facets.deviceClasses
    .map((facet) => ({
      code: facet.code,
      productCount: facet.productCount,
      label: deviceClassLabels[facet.code] ?? facet.code,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale))
  return (
    <form action={action} method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <div className="flex flex-col gap-1 xl:col-span-2">
        <label htmlFor="atlas-q" className="text-xs font-semibold text-muted-foreground">
          {labels.search}
        </label>
        <input
          id="atlas-q"
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder={labels.searchPlaceholder}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="atlas-manufacturer" className="text-xs font-semibold text-muted-foreground">
          {labels.manufacturer}
        </label>
        <select
          id="atlas-manufacturer"
          name="manufacturer"
          defaultValue={query.manufacturers[0] ?? ''}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{labels.any}</option>
          {facets.manufacturers.map((manufacturer) => (
            <option key={manufacturer.id} value={manufacturer.id}>
              {manufacturer.displayName} ({manufacturer.productCount})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="atlas-device-class" className="text-xs font-semibold text-muted-foreground">
          {labels.deviceClass}
        </label>
        <select
          id="atlas-device-class"
          name="deviceClass"
          defaultValue={query.deviceClass ?? ''}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{labels.any}</option>
          {deviceClassOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label} ({option.productCount})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="atlas-role" className="text-xs font-semibold text-muted-foreground">
          {labels.role}
        </label>
        <select
          id="atlas-role"
          name="role"
          defaultValue={query.role ?? ''}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{labels.any}</option>
          {facets.roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="atlas-procedure" className="text-xs font-semibold text-muted-foreground">
          {labels.procedure}
        </label>
        <select
          id="atlas-procedure"
          name="procedure"
          defaultValue={query.procedure ?? ''}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{labels.any}</option>
          {facets.procedures.map((procedure) => (
            <option key={procedure.code} value={procedure.code}>
              {procedure.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm">
          {labels.apply}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={action as Route}>{labels.clear}</Link>
        </Button>
      </div>
    </form>
  )
}
