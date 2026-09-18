import type { Route } from 'next'
import Link from 'next/link'

import type { CatalogSearchQuery } from '@/features/preference-cards/schemas/catalog-search'
import {
  atlasIndexHref,
  withDeviceClass,
  withDeviceSubtype,
} from '@/features/device-intelligence/domain/atlas-query'
import { FEATURED_DEVICE_CLASSES } from '@/features/device-intelligence/domain/device-display-config'
import { cn } from '@/lib/cn'

/**
 * "Browse by device type": the normalized taxonomy as visible navigation, so nobody has to
 * open a filter panel to learn what kinds of device the Atlas holds.
 *
 * Every entry is a link that sets the same `deviceClass` / `deviceSubtype` URL filters the
 * form uses — there is no second taxonomy and no client state. Labels and counts come from
 * the controlled vocabulary and the cohort facets; the featured shortcuts are a fixed
 * navigation list in vocabulary order, not a ranking.
 */
export function DeviceTypeBrowser({
  locale,
  query,
  classes,
  subtypes,
  labels,
}: {
  locale: string
  query: CatalogSearchQuery
  /** Every device class present in the cohort, with its localized label. */
  classes: { code: string; label: string; productCount: number }[]
  /** Subtypes of the selected class (empty when no class is selected). */
  subtypes: { code: string; label: string; productCount: number }[]
  labels: {
    heading: string
    allTypes: string
    moreTypes: string
    subtypeHeading: string
    allOfClass: string
    count: (count: number) => string
  }
}) {
  const featuredCodes = new Set<string>(FEATURED_DEVICE_CLASSES)
  const featured = FEATURED_DEVICE_CLASSES.flatMap((code) =>
    classes.filter((entry) => entry.code === code),
  )
  const others = classes
    .filter((entry) => !featuredCodes.has(entry.code))
    .sort((left, right) => left.label.localeCompare(right.label, locale))
  const selected = classes.find((entry) => entry.code === query.deviceClass) ?? null
  const selectedIsOther = selected !== null && !featuredCodes.has(selected.code)

  const tile = (entry: { code: string; label: string; productCount: number }) => {
    const active = entry.code === query.deviceClass
    return (
      <li key={entry.code}>
        <Link
          href={atlasIndexHref(locale, withDeviceClass(query, entry.code)) as Route}
          aria-current={active ? 'true' : undefined}
          data-device-class={entry.code}
          className={cn(
            'flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active
              ? 'border-primary bg-primary/10 font-semibold text-foreground'
              : 'border-border hover:border-primary hover:bg-muted/50',
          )}
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">{entry.label}</span>
          <span className="shrink-0 text-xs font-normal text-muted-foreground">
            <span aria-hidden="true">{entry.productCount}</span>
            <span className="sr-only">{labels.count(entry.productCount)}</span>
          </span>
        </Link>
      </li>
    )
  }

  return (
    <section aria-labelledby="atlas-browse-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="atlas-browse-heading" className="text-lg font-semibold tracking-tight">
          {labels.heading}
        </h2>
        {selected ? (
          <Link
            href={atlasIndexHref(locale, withDeviceClass(query, undefined)) as Route}
            className="rounded text-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {labels.allTypes}
          </Link>
        ) : null}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {featured.map(tile)}
      </ul>
      {others.length > 0 ? (
        <details open={selectedIsOther} className="min-w-0">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {labels.moreTypes}
          </summary>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {others.map(tile)}
          </ul>
        </details>
      ) : null}

      {selected && subtypes.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3">
          <h3 id="atlas-subtype-heading" className="text-sm font-semibold">
            {labels.subtypeHeading}
          </h3>
          <ul aria-labelledby="atlas-subtype-heading" className="flex flex-wrap gap-2">
            {[
              {
                code: '',
                label: labels.allOfClass,
                productCount: selected.productCount,
              },
              ...subtypes,
            ].map((entry) => {
              const active = (query.deviceSubtype ?? '') === entry.code
              return (
                <li key={entry.code || 'all'}>
                  <Link
                    href={
                      atlasIndexHref(
                        locale,
                        withDeviceSubtype(query, entry.code || undefined),
                      ) as Route
                    }
                    aria-current={active ? 'true' : undefined}
                    data-device-subtype={entry.code || 'all'}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:border-primary',
                    )}
                  >
                    {entry.label}
                    <span
                      className={cn(
                        'text-xs',
                        active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                      )}
                    >
                      <span aria-hidden="true">{entry.productCount}</span>
                      <span className="sr-only">{labels.count(entry.productCount)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
