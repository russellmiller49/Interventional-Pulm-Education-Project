import { getPhysicianProductReview, PHYSICIAN_REVIEW_DATE } from '../server/physician-review.server'

export function PhysicianReviewPanel({
  productId,
  translate: t,
}: {
  productId: string
  translate: (key: string) => string
}) {
  const review = getPhysicianProductReview(productId)
  if (!review) return null
  return (
    <section
      id="physician-evidence-review"
      className="space-y-4 rounded-2xl border border-border p-5"
      aria-labelledby="physician-review-heading"
    >
      <h2 id="physician-review-heading" className="text-xl font-semibold">
        {t('heading')} · {PHYSICIAN_REVIEW_DATE}
      </h2>
      <p className="text-sm text-muted-foreground">{t('scope')}</p>
      <div lang="en" className="space-y-4">
        {review.notes.map((note, index) => (
          <div
            key={index}
            className={note.kind === 'safety' ? 'rounded-lg border border-amber-600/40 p-3' : ''}
          >
            <p className="text-sm leading-6">{note.text}</p>
            <ul className="mt-1 space-y-1 text-xs">
              {note.citations.map((source) => (
                <li key={source.url}>
                  <a
                    className="break-words underline underline-offset-2"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {review.udi_records.length ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            {t('identities')} ({review.udi_records.length})
          </summary>
          <p className="mb-3 text-sm text-muted-foreground">{t('udiNote')}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">{t('model')}</th>
                  <th className="p-2">{t('primaryDi')}</th>
                  <th className="p-2">{t('packageDi')}</th>
                  <th className="p-2">{t('identityScope')}</th>
                </tr>
              </thead>
              <tbody>
                {review.udi_records.map((record) => (
                  <tr className="border-b" key={record.primary_di}>
                    <td className="p-2 font-mono">{record.model}</td>
                    <td className="p-2 font-mono">
                      <a
                        className="underline"
                        href={`https://accessgudid.nlm.nih.gov/devices/${record.primary_di}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {record.primary_di}
                      </a>
                    </td>
                    <td className="p-2 font-mono">
                      {record.package_di ?? '—'}
                      {record.package_quantity ? ` (${record.package_quantity})` : ''}
                    </td>
                    <td className="p-2">
                      {t(record.scope === 'exact' ? 'exact' : 'requiresLabel')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
      {review.unresolved_checks.length ? (
        <div className="rounded-lg bg-muted p-3">
          <h3 className="font-semibold">{t('unresolved')}</h3>
          <ul lang="en" className="mt-2 list-inside list-disc text-sm">
            {review.unresolved_checks.map((check) => (
              <li key={check.check_id}>{check.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
