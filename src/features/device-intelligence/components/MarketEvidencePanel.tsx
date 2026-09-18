import { getStatusRefresh } from '../server/status-refresh.server'

export function MarketEvidencePanel({
  productId,
  translate: t,
}: {
  productId: string
  translate: (key: string) => string
}) {
  const refresh = getStatusRefresh(productId)
  if (!refresh) return null
  const evidence = refresh.market_evidence
  return (
    <section
      id="market-evidence"
      className="scroll-mt-24 space-y-3 rounded-xl border border-border bg-card p-5"
      aria-labelledby="market-evidence-heading"
    >
      <h2 id="market-evidence-heading" className="text-lg font-semibold">
        {t('heading')}
      </h2>
      <p className="text-sm leading-6">{t(`basis.${evidence.basis}`)}</p>
      <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          <dt>{t('checked')}</dt>
          <dd className="font-mono">{evidence.checked_on}</dd>
        </div>
        <div>
          <dt>{t('udiDate')}</dt>
          <dd className="font-mono">{evidence.udi_dataset_as_of ?? t('unavailable')}</dd>
        </div>
        <div>
          <dt>{t('listingDate')}</dt>
          <dd className="font-mono">{evidence.listing_dataset_as_of ?? t('unavailable')}</dd>
        </div>
      </dl>
      {evidence.records.length ||
      evidence.manufacturer_sources.length ||
      evidence.listing_sources.length ? (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-medium">{t('sources')}</summary>
          <ul className="space-y-2 break-words">
            {evidence.records.map((record) => (
              <li key={record.primary_di}>
                <a
                  className="inline-flex min-h-11 items-center underline underline-offset-2"
                  href={`https://accessgudid.nlm.nih.gov/devices/${encodeURIComponent(record.primary_di)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  FDA GUDID · {record.primary_di}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t(
                    record.distribution_status === 'In Commercial Distribution'
                      ? 'inDistribution'
                      : record.distribution_status === 'Not in Commercial Distribution'
                        ? 'endedDistribution'
                        : 'unavailable',
                  )}
                </span>
              </li>
            ))}
            {evidence.listing_sources.map((url, index) => (
              <li key={url}>
                <a
                  className="inline-flex min-h-11 items-center underline underline-offset-2"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('listingSource')} {index + 1}
                </a>
              </li>
            ))}
            {evidence.manufacturer_sources.map((source) => (
              <li key={source.url}>
                <a
                  className="inline-flex min-h-11 items-center underline underline-offset-2"
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="text-xs leading-5 text-muted-foreground">{t('limits')}</p>
    </section>
  )
}
