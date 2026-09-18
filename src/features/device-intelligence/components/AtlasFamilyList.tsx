import type { ComponentProps } from 'react'
import type { Route } from 'next'
import Link from 'next/link'

import type { CatalogSearchQuery } from '@/features/preference-cards/schemas/catalog-search'
import type { CatalogListItem } from '@/features/preference-cards/server/catalog'
import { atlasIndexHref, deviceDetailHref } from '@/features/device-intelligence/domain/atlas-query'
import {
  familySpecSummary,
  modelSpecSummary,
  type AtlasSpecSource,
  type SpecSummaryEntry,
} from '@/features/device-intelligence/domain/device-display-config'
import {
  UNRESEARCHED_PRODUCT_STATUS,
  type ProductStatusView,
} from '@/features/device-intelligence/domain/product-status'
import type { AtlasFamily } from '@/features/device-intelligence/server/atlas.server'
import { AtlasResultsTable } from './AtlasResultsTable'
import { CompareButton, type CompareLabels } from './CompareSelection'
import { MarketStatusBadge, ProductStatusBadges, type ProductStatusLabels } from './ProductStatus'
import { SaveDeviceButton, type SaveDeviceLabels } from './SavedDevicesProvider'

/** Rows shown inside an expanded product line before "View all models" takes over. */
export const FAMILY_MODEL_PREVIEW_LIMIT = 10

export interface AtlasFamilyListLabels {
  /** "{count} matching models" — counts only the models that matched the filters. */
  modelCount: (count: number) => string
  viewModels: (count: number) => string
  viewAllModels: (count: number) => string
  previewNote: (shown: number, total: number) => string
  /** "{affected} of {total} listed models have a recorded safety notice…" */
  safetyNotice: (affected: number, total: number) => string
  marketVaries: string
  catalogGrouping: string
  recordedFor: (recorded: number, total: number) => string
  exactMatch: string
  catalogNumber: string
  notRecorded: string
}

/**
 * Family-first results: one card per manufacturer product line, built from the models that
 * matched the search (filters run on models first — see `domain/atlas-families.ts`).
 *
 * A line with a single matching model renders as that model, because there is nothing to
 * fold. A larger line shows what its matching models record, then lists them on demand in the
 * same accessible table the model view uses. Save and Compare act on exact models only, so
 * they live on model rows and single-model cards — never on a line, which has no identity to
 * save and whose members must not be presented as one comparable thing.
 */
export function AtlasFamilyList({
  locale,
  query,
  families,
  statusByProductId,
  extrasByProductId,
  exactIdentifierMatchIds,
  subtypeLabels,
  statusLabels,
  saveLabels,
  compareLabels,
  specLabels,
  tableLabels,
  returnContext,
  labels,
}: {
  locale: string
  query: CatalogSearchQuery
  families: AtlasFamily[]
  statusByProductId: Record<string, ProductStatusView>
  extrasByProductId: Record<string, { reuseStatus: string | null }>
  exactIdentifierMatchIds: string[]
  subtypeLabels: Record<string, string>
  statusLabels: ProductStatusLabels
  saveLabels: SaveDeviceLabels
  compareLabels: CompareLabels
  specLabels: Record<string, string>
  tableLabels: ComponentProps<typeof AtlasResultsTable>['labels']
  returnContext: string | null
  labels: AtlasFamilyListLabels
}) {
  const sourceOf = (item: CatalogListItem): AtlasSpecSource => ({
    ...item,
    reuseStatus: extrasByProductId[item.productId]?.reuseStatus ?? null,
  })
  const statusOf = (productId: string) =>
    statusByProductId[productId] ?? UNRESEARCHED_PRODUCT_STATUS

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {families.map((family) => {
        const subtypeLabel = subtypeLabels[family.deviceSubtypeCode]
        if (family.models.length === 1) {
          const model = family.models[0]
          return (
            <li key={family.groupKey} data-family-key={family.groupKey} className="min-w-0">
              <ModelCard
                locale={locale}
                item={model}
                subtypeLabel={subtypeLabel}
                status={statusOf(model.productId)}
                specs={modelSpecSummary(family.deviceClassCode, sourceOf(model), 4)}
                exact={exactIdentifierMatchIds.includes(model.productId)}
                returnContext={returnContext}
                statusLabels={statusLabels}
                saveLabels={saveLabels}
                compareLabels={compareLabels}
                specLabels={specLabels}
                labels={labels}
              />
            </li>
          )
        }

        const summary = familySpecSummary(family.deviceClassCode, family.models.map(sourceOf))
        // A model with a recorded safety notice is never left behind the preview cut: any
        // affected model past the first rows is appended, so the notice above always points
        // at rows the reader can see.
        const affectedIds = new Set(family.safetyNoticeModelIds)
        const preview = [
          ...family.models.slice(0, FAMILY_MODEL_PREVIEW_LIMIT),
          ...family.models
            .slice(FAMILY_MODEL_PREVIEW_LIMIT)
            .filter((model) => affectedIds.has(model.productId))
            .slice(0, FAMILY_MODEL_PREVIEW_LIMIT),
        ]
        const affected = family.safetyNoticeModelIds.length
        const representative = statusOf(family.modelIds[0])
        return (
          <li
            key={family.groupKey}
            data-family-key={family.groupKey}
            className="min-w-0 rounded-2xl border border-border p-4 lg:col-span-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">{family.manufacturerDisplay}</p>
                <h3 className="text-lg font-bold tracking-tight [overflow-wrap:anywhere]">
                  {family.familyName}
                </h3>
                <p className="text-sm text-muted-foreground">{subtypeLabel}</p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <p className="text-sm font-semibold">{labels.modelCount(family.models.length)}</p>
                {family.unanimousMarketStatus ? (
                  <MarketStatusBadge status={representative} labels={statusLabels} />
                ) : (
                  <p className="text-xs text-muted-foreground">{labels.marketVaries}</p>
                )}
              </div>
            </div>

            {summary.length > 0 ? (
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {summary.map((entry) => (
                  <div key={entry.key} className="flex flex-wrap gap-x-2">
                    <dt className="text-muted-foreground">{specLabels[entry.key] ?? entry.key}</dt>
                    <dd className="font-medium [overflow-wrap:anywhere]">
                      {entry.value}
                      {entry.recordedCount < entry.modelCount ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          {labels.recordedFor(entry.recordedCount, entry.modelCount)}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {affected > 0 ? (
              // Model-level, never family-wide: the count is stated and the affected models
              // carry their own badge in the rows below.
              <p
                data-family-safety-notice
                className="mt-3 rounded-lg border border-amber-600/40 bg-amber-500/5 px-3 py-2 text-xs leading-5"
              >
                {labels.safetyNotice(affected, family.models.length)}
              </p>
            ) : null}
            {family.nameBasis === 'catalog_grouping' ? (
              <p className="mt-2 text-xs text-muted-foreground">{labels.catalogGrouping}</p>
            ) : null}

            <details className="mt-3" open={Boolean(query.family)}>
              <summary className="inline-flex min-h-11 cursor-pointer items-center rounded text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {labels.viewModels(family.models.length)}
              </summary>
              <div className="mt-2 space-y-2">
                <AtlasResultsTable
                  locale={locale}
                  idPrefix={`family-${family.groupKey.replace(/[^a-zA-Z0-9]+/g, '-')}`}
                  hideLineColumns
                  items={preview}
                  exactIdentifierMatchIds={exactIdentifierMatchIds}
                  statusByProductId={statusByProductId}
                  deviceTypeByProductId={{}}
                  statusLabels={statusLabels}
                  saveLabels={saveLabels}
                  compareLabels={compareLabels}
                  specLabels={specLabels}
                  specSummaryByProductId={Object.fromEntries(
                    preview.map((model) => [
                      model.productId,
                      modelSpecSummary(family.deviceClassCode, sourceOf(model)),
                    ]),
                  )}
                  returnContext={returnContext}
                  labels={{
                    ...tableLabels,
                    region: `${tableLabels.region}: ${family.manufacturerDisplay} ${family.familyName} — ${subtypeLabel}`,
                  }}
                />
                {family.models.length > preview.length ? (
                  <p className="text-xs text-muted-foreground">
                    {labels.previewNote(preview.length, family.models.length)}{' '}
                    <Link
                      href={
                        atlasIndexHref(locale, {
                          ...query,
                          family: family.familyKey,
                          deviceClass: family.deviceClassCode,
                          deviceSubtype: family.deviceSubtypeCode,
                          view: 'models',
                          page: 1,
                        }) as Route
                      }
                      className="font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {labels.viewAllModels(family.models.length)}
                    </Link>
                  </p>
                ) : null}
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

function ModelCard({
  locale,
  item,
  subtypeLabel,
  status,
  specs,
  exact,
  returnContext,
  statusLabels,
  saveLabels,
  compareLabels,
  specLabels,
  labels,
}: {
  locale: string
  item: CatalogListItem
  subtypeLabel: string
  status: ProductStatusView
  specs: SpecSummaryEntry[]
  exact: boolean
  returnContext: string | null
  statusLabels: ProductStatusLabels
  saveLabels: SaveDeviceLabels
  compareLabels: CompareLabels
  specLabels: Record<string, string>
  labels: AtlasFamilyListLabels
}) {
  return (
    <article
      data-product-id={item.productId}
      className="flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-border p-4"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">{item.manufacturerDisplay}</p>
        <h3 className="text-lg font-bold tracking-tight [overflow-wrap:anywhere]">
          <Link
            href={deviceDetailHref(locale, item.productId, returnContext) as Route}
            className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.productName}
          </Link>
        </h3>
        {exact ? (
          <p data-exact-identifier-match className="text-xs font-semibold text-primary">
            {labels.exactMatch}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {subtypeLabel}
          {' · '}
          {labels.catalogNumber}{' '}
          {item.catalogNumber ? (
            <span className="font-mono text-foreground">{item.catalogNumber}</span>
          ) : (
            <span className="italic">{labels.notRecorded}</span>
          )}
          {item.sizeDisplay ? ` · ${item.sizeDisplay}` : ''}
        </p>
      </div>
      {specs.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {specs.map((entry) => (
            <div key={entry.key} className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{specLabels[entry.key] ?? entry.key}</dt>
              <dd className="font-medium">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <ProductStatusBadges status={status} labels={statusLabels} />
      <div className="mt-auto flex flex-wrap gap-2">
        <SaveDeviceButton
          productId={item.productId}
          productName={item.productName}
          catalogNumber={item.catalogNumber}
          labels={saveLabels}
        />
        <CompareButton
          productId={item.productId}
          productName={item.productName}
          catalogNumber={item.catalogNumber}
          labels={compareLabels}
        />
      </div>
    </article>
  )
}
