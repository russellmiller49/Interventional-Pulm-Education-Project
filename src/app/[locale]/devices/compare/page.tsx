import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PrintControls } from '@/features/preference-cards/components/PrintControls'
import { CompareRemoveLink } from '@/features/device-intelligence/components/CompareSelection'
import { DeviceTaskNav } from '@/features/device-intelligence/components/DeviceTaskNav'
import { LinkTabs } from '@/features/device-intelligence/components/LinkTabs'
import { ProductStatusBadges } from '@/features/device-intelligence/components/ProductStatus'
import {
  comparisonValuesDiffer,
  GENERAL_COMPARISON_FIELDS,
} from '@/features/device-intelligence/domain/comparison'
import {
  comparisonValue,
  getDeviceComparison,
  type ComparisonCitation,
} from '@/features/device-intelligence/server/reference-workspace.server'
import {
  comparisonHref,
  MAX_COMPARISON_DEVICES,
  parseDeviceIds,
} from '@/features/device-intelligence/domain/saved-devices'
import { getProductStatusLabels } from '@/features/device-intelligence/server/status-labels.server'
import { getTaxonomyLabels } from '@/features/device-intelligence/server/product-taxonomy.server'
import { getSafetyEvidence } from '@/features/device-intelligence/server/safety-evidence.server'
import {
  getPhysicianProductReview,
  PHYSICIAN_REVIEW_DATE,
} from '@/features/device-intelligence/server/physician-review.server'
import { safetyEvidenceFreshness } from '@/features/device-intelligence/domain/evidence-freshness'
import styles from '@/features/device-intelligence/components/ReferencePrint.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Device comparison',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function DeviceComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ ids?: string | string[]; diff?: string | string[] }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.comparison')
  const tReview = await getTranslations('deviceIntelligence.physicianReview')
  const tDevices = await getTranslations('deviceIntelligence.devices')
  const tReference = await getTranslations('deviceIntelligence.reference')
  const tCompare = await getTranslations('deviceIntelligence.compareSelection')
  const resolvedSearchParams = await searchParams
  const raw = resolvedSearchParams?.ids
  const differencesOnly = resolvedSearchParams?.diff === '1'
  const ids = Array.isArray(raw) ? null : parseDeviceIds(raw, MAX_COMPARISON_DEVICES)
  const comparison = getDeviceComparison(ids ?? [])
  const statusLabels = await getProductStatusLabels(locale)
  const taxonomyLabels = getTaxonomyLabels(locale)
  const today = new Date().toISOString().slice(0, 10)
  const citations: ComparisonCitation[] = []
  const citationNumber = (citation: ComparisonCitation) => {
    let index = citations.findIndex((item) => JSON.stringify(item) === JSON.stringify(citation))
    if (index < 0) {
      index = citations.length
      citations.push(citation)
    }
    return index + 1
  }
  const cells = comparison.fields.map((field) => ({
    field,
    values: comparison.devices.map((device) => {
      const value = comparisonValue(device, field)
      return { ...value, references: value.citations.map(citationNumber) }
    }),
  }))
  // Category-specific technical fields lead; the fields every class shares follow the
  // safety and description rows. "Differences only" folds away specification rows whose
  // recorded values agree — and ONLY those rows: identity, safety and market status are never
  // candidates for hiding.
  const isGeneral = (field: (typeof cells)[number]['field']) =>
    GENERAL_COMPARISON_FIELDS.includes(field)
  const visible = (row: (typeof cells)[number]) =>
    !differencesOnly || comparisonValuesDiffer(row.values)
  const technicalCells = cells.filter((row) => !isGeneral(row.field))
  const generalCells = cells.filter((row) => isGeneral(row.field))
  const hiddenRowCount = cells.filter((row) => !visible(row)).length
  const deviceIds = comparison.devices.map((device) => device.product.product_id)
  const selfHref = (diff: boolean) => `${comparisonHref(locale, deviceIds)}${diff ? '&diff=1' : ''}`
  // One semantic table. From `md` up it is a side-by-side grid; below that each field becomes
  // a stacked block listing every device's value, so nothing needs a sideways scroll. Explicit
  // table roles keep the semantics in browsers that flatten tables after a display change.
  const rowClass = 'block border-t border-border md:table-row md:border-0'
  const headClass =
    'block bg-muted/40 px-4 pb-1 pt-3 text-left text-sm font-semibold md:table-cell md:w-40 md:border-t md:border-border md:bg-transparent md:p-4 md:align-top'
  const cellClass =
    'block min-w-0 px-4 py-2 text-sm [overflow-wrap:anywhere] md:table-cell md:border-t md:border-border md:p-4 md:align-top'
  const deviceTag = (device: (typeof comparison.devices)[number]) => (
    <span
      aria-hidden="true"
      className="mb-1 block text-[11px] font-semibold text-primary md:hidden"
    >
      {device.product.product_name}
      {device.product.catalog_number ? ` · ${device.product.catalog_number}` : ''}
    </span>
  )
  const specRow = ({ field, values }: (typeof cells)[number]) => (
    <tr role="row" key={field} data-comparison-field={field} className={rowClass}>
      <th role="rowheader" scope="row" className={headClass}>
        {t(`fields.${field}`)}
      </th>
      {values.map((value, index) => (
        <td role="cell" key={comparison.devices[index].product.product_id} className={cellClass}>
          {deviceTag(comparison.devices[index])}
          {value.value === null ? (
            <span data-missing-value className="italic text-muted-foreground">
              — {t('missing')}
            </span>
          ) : (
            <>
              <span lang="en" className="font-semibold">
                {String(value.value)}
                {value.unit ? ` ${value.unit}` : ''}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`origin.${value.origin}`)}
                {value.scope ? ` · ${t(`scope.${value.scope}`)}` : ''}
              </p>
              {value.origin === 'catalog' ? (
                <Link
                  className="mt-1 inline-block text-xs underline"
                  href={
                    `/${locale}/devices/${comparison.devices[index].product.product_id}#device-sources` as Route
                  }
                >
                  {t('catalogSources')}
                </Link>
              ) : null}
              {value.references.map((reference) => (
                <a
                  key={reference}
                  href={`#comparison-source-${reference}`}
                  className="mr-2 inline-block text-xs underline"
                >
                  [{reference}]
                </a>
              ))}
            </>
          )}
        </td>
      ))}
    </tr>
  )

  return (
    <div className={`device-reference-output container space-y-5 py-8 ${styles.output}`}>
      <DeviceTaskNav
        locale={locale}
        active="compare"
        labels={{
          navigation: tDevices('navigationLabel'),
          find: tDevices('findDevice'),
          procedures: tDevices('prepareProcedure'),
          saved: tReference('savedDevices'),
          compare: tCompare('navCompare'),
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <Link
            className="inline-flex min-h-11 items-center text-sm underline"
            href={`/${locale}/devices` as Route}
          >
            {t('findMore')}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center text-sm underline"
            href={`/${locale}/devices/saved` as Route}
          >
            {t('changeDevices')}
          </Link>
        </div>
        {comparison.devices.length >= 2 ? <PrintControls /> : null}
      </div>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('prepared', { date: today })}</p>
        <p className="max-w-4xl text-sm leading-6">{t('boundary')}</p>
      </header>
      {!ids ? <p role="alert">{t('invalid')}</p> : null}
      {comparison.unavailableCount > 0 ? (
        <p role="status">{t('unavailable', { count: comparison.unavailableCount })}</p>
      ) : null}
      {comparison.devices.length < 2 ? (
        <p>{t('choose')}</p>
      ) : (
        <>
          {comparison.mixedClasses ? (
            <p className="rounded-xl border border-amber-500/60 p-4 text-sm">{t('mixedClasses')}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <LinkTabs
              label={t('rowsLabel')}
              tabs={[
                {
                  key: 'all',
                  label: t('allFields'),
                  href: selfHref(false) as Route,
                  active: !differencesOnly,
                },
                {
                  key: 'diff',
                  label: t('differencesOnly'),
                  href: selfHref(true) as Route,
                  active: differencesOnly,
                },
              ]}
            />
            <p className="hidden text-xs text-muted-foreground md:block">{t('scroll')}</p>
          </div>
          {differencesOnly ? (
            <p
              role="status"
              data-differences-note
              className="text-xs leading-5 text-muted-foreground"
            >
              {t('differencesNote', { count: hiddenRowCount })}
            </p>
          ) : null}
          {/* Narrow screens: the column headers are replaced by this device list, and every
              value below is tagged with its device. */}
          <ul className="space-y-2 md:hidden print:hidden">
            {comparison.devices.map((device) => (
              <li
                key={device.product.product_id}
                className="rounded-xl border border-border p-3 text-sm [overflow-wrap:anywhere]"
              >
                <Link
                  className="font-semibold underline"
                  href={`/${locale}/devices/${device.product.product_id}` as Route}
                >
                  {device.product.product_name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {device.product.manufacturerDisplay} ·{' '}
                  <span className="font-mono">
                    {device.product.catalog_number ?? t('missingIdentifier')}
                  </span>
                  {device.product.size_display ? ` · ${device.product.size_display}` : ''}
                </p>
                <CompareRemoveLink
                  href={comparisonHref(
                    locale,
                    deviceIds.filter((id) => id !== device.product.product_id),
                  )}
                  productId={device.product.product_id}
                  label={t('removeDevice')}
                  accessibleLabel={`${t('removeDevice')}: ${device.product.product_name}`}
                />
              </li>
            ))}
          </ul>
          <div
            role="region"
            aria-label={t('tableLabel')}
            tabIndex={0}
            className="overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table
              role="table"
              className={`block w-full border-collapse text-left md:table md:table-fixed ${comparison.devices.length === 4 ? 'md:min-w-[1100px]' : comparison.devices.length === 3 ? 'md:min-w-[900px]' : 'md:min-w-[700px]'}`}
            >
              <thead role="rowgroup" className="sr-only md:not-sr-only md:table-header-group">
                <tr role="row">
                  <th role="columnheader" scope="col" className="w-40 p-4 text-sm">
                    {t('field')}
                  </th>
                  {comparison.devices.map((device) => (
                    <th
                      role="columnheader"
                      scope="col"
                      key={device.product.product_id}
                      className="p-4 align-top [overflow-wrap:anywhere]"
                    >
                      <Link
                        className="text-sm font-semibold underline"
                        href={`/${locale}/devices/${device.product.product_id}` as Route}
                      >
                        {device.product.product_name}
                      </Link>
                      <p className="mt-2 text-xs font-normal text-muted-foreground">
                        {device.product.manufacturerDisplay}
                      </p>
                      <p className="mt-1 font-mono text-xs">
                        {device.product.catalog_number ?? t('missingIdentifier')}
                      </p>
                      <p className="mt-1 text-xs font-normal">{device.product.size_display}</p>
                      <CompareRemoveLink
                        href={comparisonHref(
                          locale,
                          deviceIds.filter((id) => id !== device.product.product_id),
                        )}
                        productId={device.product.product_id}
                        label={t('removeDevice')}
                        accessibleLabel={`${t('removeDevice')}: ${device.product.product_name}`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody role="rowgroup" className="block md:table-row-group">
                <tr role="row" data-comparison-row={'type'} className={rowClass}>
                  <th role="rowheader" scope="row" className={headClass}>
                    {t('type')}
                  </th>
                  {comparison.devices.map((device) => (
                    <td role="cell" key={device.product.product_id} className={cellClass}>
                      {deviceTag(device)}
                      {taxonomyLabels.subtypes[device.taxonomy.deviceSubtypeCode]}
                      {device.taxonomy.needsReview ? (
                        <p className="mt-1 text-xs">{t('taxonomyReview')}</p>
                      ) : null}
                    </td>
                  ))}
                </tr>
                {technicalCells.filter(visible).map(specRow)}
                <tr role="row" data-comparison-row={'safety'} className={rowClass}>
                  <th role="rowheader" scope="row" className={headClass}>
                    {t('safety')}
                  </th>
                  {comparison.devices.map((device) => {
                    const evidence = getSafetyEvidence(device.product.product_id)
                    const freshness = safetyEvidenceFreshness(evidence, today)
                    const physicianReview = getPhysicianProductReview(device.product.product_id)
                    return (
                      <td role="cell" key={device.product.product_id} className={cellClass}>
                        {deviceTag(device)}
                        <ProductStatusBadges status={device.status} labels={statusLabels} />
                        <p className="mt-2 text-xs font-semibold">
                          {statusLabels.evidence.freshness[freshness]}
                        </p>
                        <p className="mt-1 text-xs">
                          {device.status.researchSnapshotDate
                            ? `${statusLabels.snapshotLabel} ${device.status.researchSnapshotDate}`
                            : evidence?.notices.length
                              ? statusLabels.marketNotResearchedWithSafetyEvidence
                              : statusLabels.notResearched}
                        </p>
                        {physicianReview ? (
                          <div className="mt-2 space-y-2 text-xs">
                            <Link
                              className="underline"
                              href={
                                `/${locale}/devices/${device.product.product_id}#physician-evidence-review` as Route
                              }
                            >
                              {tReview('heading')} · {PHYSICIAN_REVIEW_DATE}
                            </Link>
                            {physicianReview.notes
                              .filter((note) => note.kind === 'safety')
                              .map((note) => (
                                <p lang="en" key={note.text}>
                                  {note.text}
                                </p>
                              ))}
                          </div>
                        ) : null}
                        {device.status.statusRecommendationGate !== 'clear' ? (
                          <p className="mt-2 text-xs font-semibold">
                            {statusLabels.gateHeading}:{' '}
                            {statusLabels.gate[device.status.statusRecommendationGate]}
                          </p>
                        ) : null}
                        <ul className="mt-2 space-y-2 text-xs">
                          {evidence?.notices.map((notice) => (
                            <li key={notice.recall_number}>
                              {notice.official_record_url ? (
                                <a
                                  href={notice.official_record_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                >
                                  {notice.recall_number}
                                </a>
                              ) : (
                                notice.recall_number
                              )}
                              {' · '}
                              {statusLabels.evidence.recordedState[notice.recorded_state]}
                            </li>
                          ))}
                        </ul>
                        <Link
                          className="mt-2 inline-block text-xs underline"
                          href={
                            `/${locale}/devices/${device.product.product_id}#device-safety` as Route
                          }
                        >
                          {t('openSafety')}
                        </Link>
                      </td>
                    )
                  })}
                </tr>
                <tr role="row" data-comparison-row={'summary'} className={rowClass}>
                  <th role="rowheader" scope="row" className={headClass}>
                    {t('summary')}
                  </th>
                  {comparison.devices.map((device) => (
                    <td role="cell" key={device.product.product_id} className={cellClass}>
                      {deviceTag(device)}
                      <p lang="en">{device.publicDescription?.text ?? t('missing')}</p>
                      {device.publicDescription ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t(`origin.${device.publicDescription.origin}`)}
                          {device.profile
                            ? ` · ${t(`descriptionScope.${device.profile.description_scope}`)} · ${device.profile.as_of_date}`
                            : ''}
                        </p>
                      ) : null}
                      <Link
                        className="mt-1 inline-block text-xs underline"
                        href={
                          `/${locale}/devices/${device.product.product_id}${device.profile ? '#d2d-profile-heading' : '#device-sources'}` as Route
                        }
                      >
                        {t('descriptionSources')}
                      </Link>
                    </td>
                  ))}
                </tr>
                <tr role="row" data-comparison-row={'configuration'} className={rowClass}>
                  <th role="rowheader" scope="row" className={headClass}>
                    {t('configuration')}
                  </th>
                  {comparison.devices.map((device) => {
                    const reviewed =
                      device.profile?.runtime_state === 'reviewed'
                        ? device.profile.exact_configuration_summary
                        : null
                    const text = device.profile ? reviewed?.text : device.product.compatibility_text
                    return (
                      <td role="cell" key={device.product.product_id} className={cellClass}>
                        {deviceTag(device)}
                        <p lang="en">{text ?? t('missing')}</p>
                        {text ? (
                          <>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t(`origin.${reviewed ? 'reviewed' : 'catalog'}`)}
                              {reviewed ? ` · ${t(`scope.${reviewed.evidence_scope}`)}` : ''}
                            </p>
                            <Link
                              className="mt-1 inline-block text-xs underline"
                              href={
                                `/${locale}/devices/${device.product.product_id}${reviewed ? '#d2d-profile-heading' : '#device-sources'}` as Route
                              }
                            >
                              {t('configurationSources')}
                            </Link>
                          </>
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
                {generalCells.filter(visible).map(specRow)}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-5">{t('sourceNote')}</p>
          <p className="text-xs leading-5">{t('safetyNote')}</p>
          {citations.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t('sources')}</h2>
              <ol className="list-inside list-decimal space-y-3 text-xs">
                {citations.map((citation, index) => (
                  <li
                    key={index}
                    id={`comparison-source-${index + 1}`}
                    className="scroll-mt-24 [overflow-wrap:anywhere]"
                  >
                    {citation.url ? (
                      <a
                        className="underline"
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {citation.title}
                      </a>
                    ) : (
                      citation.title
                    )}{' '}
                    · {citation.asOf}
                    <p lang="en" className="mt-1 text-muted-foreground">
                      {citation.locator}
                    </p>
                    {citation.url ? (
                      <p className="mt-1 hidden print:block">{citation.url}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
