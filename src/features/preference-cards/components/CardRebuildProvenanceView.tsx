import Link from 'next/link'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'

import type { StoredRebuildProvenance } from '../schemas/card-rebuild'

/**
 * How a rebuilt card came to exist, on the card itself.
 *
 * The documentation promised this interface and it did not exist: the card loader did not read
 * `rebuild_provenance` at all, so the page could not tell a rebuilt card from an ordinary one, could
 * not say which revision it was built from, and could not say when that revision was gone. A record
 * nothing displays is a record that only a database client can read, and this record exists for the
 * physician.
 *
 * Deleting the source card is permitted and cascades its revisions, so what survives here is a
 * **hash-addressed tombstone**: exactly what was reviewed, enough to verify against a copy of the
 * revision if one exists, and not enough to reconstruct it. When the source is gone the panel says
 * the revision is no longer available and shows the hashes and the reviewed decisions instead — it
 * does not imply the revision can be recovered, because it cannot.
 */

interface CardRebuildProvenanceViewProps {
  provenance: StoredRebuildProvenance
  locale: string
  /** Whether the source card is still there. Its revisions cascade with it. */
  sourceAvailable: boolean
}

function Hash({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-mono text-xs text-foreground">{value ?? '—'}</dd>
    </div>
  )
}

export function CardRebuildProvenanceView({
  provenance,
  locale,
  sourceAvailable,
}: CardRebuildProvenanceViewProps) {
  const t = useTranslations('preferenceCards')
  const answered = provenance.decisions.filter((decision) => decision.acknowledgement !== null)

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-tight text-foreground">
            {t('rebuild.provenanceHeading')}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t('rebuild.provenanceHelp')}
          </p>
        </div>
        <Badge variant="outline" className="normal-case tracking-normal">
          {t('rebuild.provenanceBadge')}
        </Badge>
      </div>

      <p className="mt-5 rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
        {sourceAvailable ? (
          <>
            {t('rebuild.provenanceSourceAvailable', {
              revision: provenance.sourceRevisionNumber,
            })}{' '}
            <Link
              href={`/${locale}/preference-cards/${provenance.sourceCardId}/reconcile` as Route}
              className="font-semibold underline underline-offset-4"
            >
              {t('rebuild.provenanceSourceLink')}
            </Link>
          </>
        ) : (
          t('rebuild.provenanceSourceGone')
        )}
      </p>

      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Hash label={t('rebuild.sourceRelease')} value={provenance.sourceReleaseBundleId} />
        <Hash label={t('rebuild.targetRelease')} value={provenance.targetReleaseBundleId} />
        <Hash label={t('rebuild.sourceRevision')} value={provenance.sourceSnapshotHash} />
        <Hash
          label={t('rebuild.operationalHashLabel')}
          value={provenance.operationalReconciliationHash}
        />
        <Hash
          label={t('rebuild.releaseDiffHashLabel')}
          value={provenance.authoredReleaseDiffHash}
        />
        <Hash label={t('rebuild.planHashLabel')} value={provenance.mappingPlanHash} />
      </dl>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {t('rebuild.provenanceDecisionsHeading')}
      </h3>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
        {t('rebuild.provenanceDecisionsHelp', {
          answered: answered.length,
          total: provenance.decisions.length,
        })}
      </p>
      {answered.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {answered.map((decision) => (
            <li
              key={decision.key}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-border px-4 py-3"
            >
              <span className="min-w-0 break-words font-mono text-xs text-foreground">
                {decision.key}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {decision.acknowledgement}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
