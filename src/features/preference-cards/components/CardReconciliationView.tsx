import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'

import { resolutionAffectingChanges } from '../server/reconcile-card'
import type {
  AffectedRequirement,
  CardReconciliation,
  OperationalReconciliationResult,
  ReleaseReconciliationResult,
} from '../server/reconcile-card'
import type { ReconciledItemChange } from '../domain/card-reconciliation'

/**
 * The read-only reconciliation report.
 *
 * Every control this component *could* have offered is deliberately absent: there is no
 * "apply", no "rebuild on the current release", no "carry these forward". The page reports and
 * stops, and the closing notice says so in words rather than leaving the reader to infer it
 * from the lack of a button.
 *
 * The two sections are presented as separate answers to separate questions, and either can be
 * unavailable while the other is fine — a card whose selections cannot be re-resolved still has
 * a release that compares perfectly well.
 */

interface CardReconciliationViewProps {
  reconciliation: CardReconciliation
}

function Section({
  title,
  help,
  children,
}: {
  title: string
  help: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
      <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{help}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function Unavailable({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
      {message}
    </p>
  )
}

function Settled({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
      {message}
    </p>
  )
}

function ItemChangeRow({ change }: { change: ReconciledItemChange }) {
  const t = useTranslations('preferenceCards')
  const moved = change.beforePresence !== change.afterPresence
  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{change.label || change.itemId}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{change.roleCode}</p>
        </div>
        {moved ? (
          <Badge variant="outline" className="normal-case tracking-normal">
            {t(`reconcile.presence.${change.beforePresence}`)} →{' '}
            {t(`reconcile.presence.${change.afterPresence}`)}
          </Badge>
        ) : null}
      </div>
      {change.changedFields.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t('reconcile.changedFields', { fields: change.changedFields.join(', ') })}
        </p>
      ) : null}
    </li>
  )
}

function OperationalSection({ result }: { result: OperationalReconciliationResult }) {
  const t = useTranslations('preferenceCards')

  if (!result.ok) {
    return (
      <Section title={t('reconcile.operationalHeading')} help={t('reconcile.operationalHelp')}>
        <Unavailable message={result.message} />
      </Section>
    )
  }

  const { delta } = result
  const changes = resolutionAffectingChanges(delta)
  const otherChanges = delta.items.filter((item) => !changes.includes(item))

  return (
    <Section title={t('reconcile.operationalHeading')} help={t('reconcile.operationalHelp')}>
      {delta.identical ? <Settled message={t('reconcile.operationalIdentical')} /> : null}

      {/*
        The release is held fixed by the reconstruction path, so anything here means a field
        outside hospital-local data moved. It should always be empty; showing it rather than
        asserting it is what makes that a checkable claim instead of a comment.
      */}
      {delta.otherChangedProjectionKeys.length > 0 ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm leading-6 text-foreground">
          {t('reconcile.operationalHeldBroken', {
            keys: delta.otherChangedProjectionKeys.join(', '),
          })}
        </p>
      ) : null}

      {delta.readinessState ? (
        <p className="text-sm leading-6 text-foreground">
          {t('reconcile.readinessChanged', {
            before: t(`readiness.${delta.readinessState.before}`),
            after: t(`readiness.${delta.readinessState.after}`),
          })}
        </p>
      ) : null}

      {changes.length + otherChanges.length > 0 ? (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('reconcile.lineChanges')}
          </h3>
          <ul className="mt-3 space-y-3">
            {[...changes, ...otherChanges].map((change) => (
              <ItemChangeRow key={change.itemId} change={change} />
            ))}
          </ul>
        </div>
      ) : null}

      {delta.warnings.length > 0 ? (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('reconcile.warningChanges')}
          </h3>
          <ul className="mt-3 space-y-2">
            {delta.warnings.map((warning) => (
              <li
                key={`${warning.kind}-${warning.code}-${warning.sourceId ?? ''}`}
                className="flex flex-wrap items-center gap-2 text-sm text-foreground"
              >
                <Badge variant="outline" className="normal-case tracking-normal">
                  {warning.kind === 'added'
                    ? t('reconcile.warningAdded')
                    : t('reconcile.warningRemoved')}
                </Badge>
                <span className="font-mono text-xs">{warning.code}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`severity.${warning.severity}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  )
}

function RequirementRow({ requirement }: { requirement: AffectedRequirement }) {
  const t = useTranslations('preferenceCards')
  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {requirement.label ?? requirement.requirementKey}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {requirement.requirementKey}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="normal-case tracking-normal">
            {t(`reconcile.kind.${requirement.kind}`)}
          </Badge>
          <Badge
            variant={requirement.onCard ? 'secondary' : 'outline'}
            className="normal-case tracking-normal"
          >
            {requirement.onCard ? t('reconcile.onCard') : t('reconcile.notOnCard')}
          </Badge>
        </div>
      </div>
      {requirement.changedFields.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t('reconcile.changedFields', { fields: requirement.changedFields.join(', ') })}
        </p>
      ) : null}
      {requirement.hasSelection ? (
        <p className="mt-2 text-xs leading-5 text-foreground">{t('reconcile.hasSelection')}</p>
      ) : null}
    </li>
  )
}

function ReleaseSection({ result }: { result: ReleaseReconciliationResult }) {
  const t = useTranslations('preferenceCards')

  if (!result.ok) {
    return (
      <Section title={t('reconcile.releaseHeading')} help={t('reconcile.releaseHelp')}>
        <Unavailable message={result.message} />
      </Section>
    )
  }

  if (result.currentReleaseBundleId === null) {
    return (
      <Section title={t('reconcile.releaseHeading')} help={t('reconcile.releaseHelp')}>
        <Settled message={t('reconcile.releaseNoCurrent')} />
      </Section>
    )
  }

  return (
    <Section title={t('reconcile.releaseHeading')} help={t('reconcile.releaseHelp')}>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t('reconcile.releasePinned')}
          </dt>
          <dd className="mt-1 break-words font-mono text-sm text-foreground">
            {result.pinnedReleaseBundleId}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t('reconcile.releaseCurrent')}
          </dt>
          <dd className="mt-1 break-words font-mono text-sm text-foreground">
            {result.currentReleaseBundleId}
          </dd>
        </div>
      </dl>

      {result.onCurrentRelease ? <Settled message={t('reconcile.releaseOnCurrent')} /> : null}

      {result.impact?.identical ? <Settled message={t('reconcile.releaseIdentical')} /> : null}

      {result.impact?.catalogImportChanged ? (
        <p className="text-sm leading-6 text-foreground">{t('reconcile.releaseCatalogChanged')}</p>
      ) : null}
      {result.impact?.resolverContractChanged ? (
        <p className="text-sm leading-6 text-foreground">{t('reconcile.releaseContractChanged')}</p>
      ) : null}

      {result.affecting.length > 0 ? (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('reconcile.requirementChanges')}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {t('reconcile.requirementChangesHelp')}
          </p>
          <ul className="mt-3 space-y-3">
            {/* Requirements this card actually carries first: they are the ones with consequences. */}
            {[...result.affecting]
              .sort(
                (left, right) =>
                  Number(right.onCard) - Number(left.onCard) ||
                  left.requirementKey.localeCompare(right.requirementKey),
              )
              .map((requirement) => (
                <RequirementRow key={requirement.requirementKey} requirement={requirement} />
              ))}
          </ul>
        </div>
      ) : null}
    </Section>
  )
}

export function CardReconciliationView({ reconciliation }: CardReconciliationViewProps) {
  const t = useTranslations('preferenceCards')
  const { source } = reconciliation

  const identity = [
    [
      t('reconcile.revisionLabel'),
      source.revisionNumber === null
        ? t('reconcile.revisionUnavailable')
        : String(source.revisionNumber),
    ],
    [t('cardMetadata.snapshot'), source.snapshotHash.slice(0, 20)],
    ...(source.resolvedContentHash
      ? ([[t('revisions.contentHash'), source.resolvedContentHash.slice(0, 20)]] as const)
      : []),
    ...(source.printDocumentHash
      ? ([[t('revisions.documentHash'), source.printDocumentHash.slice(0, 20)]] as const)
      : []),
    ...(source.releaseBundleId
      ? ([[t('revisions.releasePin'), source.releaseBundleId]] as const)
      : []),
  ] as const

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
        <h2 className="text-xl font-black tracking-tight text-foreground">
          {t('reconcile.sourceHeading')}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t('reconcile.sourceHelp')}
        </p>
        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {identity.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 break-words font-mono text-sm text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <OperationalSection result={reconciliation.operational} />
      <ReleaseSection result={reconciliation.release} />

      <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
        {t('reconcile.noRebuildNotice')}
      </p>
    </div>
  )
}
