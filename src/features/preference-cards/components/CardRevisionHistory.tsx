import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'

import type { PreferenceCardRevisionSummary } from '../server/card-revisions'

/**
 * Every state a card has been saved in.
 *
 * Read-only, and there is nothing to click: a revision is evidence, not a thing to restore.
 *
 * A reviewed rebuild does now write a new card from a cited revision — but that is not restoring
 * one, and the distinction is the reason there is still no control here. Restoring would put an old
 * state back on the same card, silently, against definitions nobody re-read; the rebuild produces a
 * *separate* card on an explicitly named release and requires every changed decision to be answered
 * first. It is reached from the card's own page, which keeps this list what it is: a record.
 *
 * The content hash is shown beside each row because it is what makes the list readable — two
 * adjacent revisions with the same `resolvedContentHash` differ only in title, physician, or
 * draft/final status, and saying so is more useful than leaving the reader to compare hashes.
 */

interface CardRevisionHistoryProps {
  revisions: PreferenceCardRevisionSummary[]
}

export function CardRevisionHistory({ revisions }: CardRevisionHistoryProps) {
  const t = useTranslations('preferenceCards')

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
      <h2 className="text-xl font-black tracking-tight text-foreground">
        {t('revisions.heading')}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        {t('revisions.help')}
      </p>

      {revisions.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
          {t('revisions.empty')}
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {revisions.map((revision, index) => {
            // `revisions` is newest first, so the next entry is the one before this in time.
            const previous = revisions[index + 1]
            const sameContent =
              previous !== undefined &&
              revision.resolvedContentHash !== null &&
              revision.resolvedContentHash === previous.resolvedContentHash

            return (
              <li key={revision.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {t('revisions.revisionNumber', { number: revision.revisionNumber })}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('revisions.savedAt')}: {new Date(revision.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {index === 0 ? (
                      <Badge variant="secondary" className="normal-case tracking-normal">
                        {t('revisions.current')}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="normal-case tracking-normal">
                      {t(`status.${revision.status}`)}
                    </Badge>
                  </div>
                </div>

                <p className="mt-2 truncate text-sm text-foreground">{revision.title}</p>

                <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t('revisions.contentHash')}
                    </dt>
                    <dd className="mt-0.5 break-words font-mono text-xs text-foreground">
                      {revision.resolvedContentHash?.slice(0, 16) ?? t('revisions.notHashed')}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t('revisions.documentHash')}
                    </dt>
                    <dd className="mt-0.5 break-words font-mono text-xs text-foreground">
                      {revision.printDocumentHash?.slice(0, 16) ?? t('revisions.notHashed')}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t('revisions.releasePin')}
                    </dt>
                    <dd className="mt-0.5 break-words font-mono text-xs text-foreground">
                      {revision.releaseBundleId ?? t('revisions.notHashed')}
                    </dd>
                  </div>
                </dl>

                {sameContent ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {t('revisions.sameContent')}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
