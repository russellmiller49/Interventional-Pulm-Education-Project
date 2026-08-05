import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { CardReconciliationView } from './CardReconciliationView'
import { allowedAcknowledgements } from '../domain/card-rebuild-plan'
import type { RebuildDecision, RebuildRequirementDecision } from '../domain/card-rebuild-plan'
import type { CardRebuildPreparation } from '../server/rebuild-card'

/**
 * The rebuild review, and the gate.
 *
 * The mirror image of `CardReconciliationView`, which reports and offers nothing. This one offers
 * exactly one action, and cannot reach it until every changed or unresolved decision has been
 * answered one at a time. There is deliberately no "accept all clinical changes" control: a single
 * click that disposed of every changed requirement would leave a record indistinguishable from a
 * rebuild nobody read, and the record is the whole point of the phase.
 *
 * Plain server-action forms rather than a client component, for the same reason the row actions
 * are: each is one round trip with nothing to keep in sync, the controls work without JavaScript,
 * and — the part that matters here — the plan the answers are given against is the plan the server
 * rendered, quoted back by hash, rather than a copy the browser has been holding and mutating.
 */

interface CardRebuildReviewProps {
  preparation: CardRebuildPreparation
  locale: string
  createAction: (formData: FormData) => Promise<void>
  /** Set when a submitted review was refused, so the reader is told why rather than shown nothing. */
  error?: { message: string; unanswered: string[] } | null
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

/** The label a decision is shown under. Never used for matching — only requirement keys match. */
function decisionTitle(decision: RebuildDecision): string {
  switch (decision.kind) {
    case 'requirement':
      return decision.target?.label ?? decision.source?.label ?? decision.requirementKey
    case 'module':
      return decision.moduleCode
    case 'modifier':
      return decision.modifierCode
    case 'waiver':
      return decision.warningCode
  }
}

function decisionIdentity(decision: RebuildDecision): string {
  switch (decision.kind) {
    case 'requirement':
      return decision.requirementKey
    case 'module':
      return decision.moduleCode
    case 'modifier':
      return decision.modifierCode
    case 'waiver':
      return decision.requirementKey ?? decision.warningCode
  }
}

function SelectionSummary({ decision }: { decision: RebuildRequirementDecision }) {
  const t = useTranslations('preferenceCards')
  const before = decision.source?.selection
  const after = decision.carriedSelection
  if (!before) return null
  return (
    <p className="mt-2 text-xs leading-5 text-muted-foreground">
      {t('rebuild.selectionMove', {
        before: t(`rebuild.selectionKind.${before.kind}`),
        after: after
          ? t(`rebuild.selectionKind.${after.kind}`)
          : t('rebuild.selectionKind.dropped'),
      })}
    </p>
  )
}

function DecisionRow({ decision, unanswered }: { decision: RebuildDecision; unanswered: boolean }) {
  const t = useTranslations('preferenceCards')
  const answers = allowedAcknowledgements(decision)
  const needsAnswer = decision.requiresExplicitConfirmation

  return (
    <li
      className={
        unanswered
          ? 'rounded-2xl border border-destructive/60 bg-destructive/5 p-4'
          : 'rounded-2xl border border-border p-4'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{decisionTitle(decision)}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {decisionIdentity(decision)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {decision.blocking ? (
            <Badge variant="destructive" className="normal-case tracking-normal">
              {t('rebuild.blocking')}
            </Badge>
          ) : null}
          <Badge variant="outline" className="normal-case tracking-normal">
            {t(`rebuild.state.${decision.state}`)}
          </Badge>
        </div>
      </div>

      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {decision.reasonCodes.map((code) => t(`rebuild.reason.${code}`)).join(' ')}
      </p>

      {decision.kind === 'requirement' ? <SelectionSummary decision={decision} /> : null}

      {decision.kind === 'requirement' && decision.changedDefinitionFields.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t('rebuild.changedFields', { fields: decision.changedDefinitionFields.join(', ') })}
        </p>
      ) : null}

      {decision.kind === 'waiver' ? (
        <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {t('rebuild.priorWaiver', { rationale: decision.priorRationale })}
        </p>
      ) : null}

      {needsAnswer ? (
        <fieldset className="mt-3">
          <legend className="text-xs font-semibold text-foreground">
            {t('rebuild.answerLegend')}
          </legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {answers.map((answer) => (
              <label
                key={answer}
                className="flex items-center gap-2 text-xs font-medium text-foreground"
              >
                <input
                  type="radio"
                  name={`decision:${decision.key}`}
                  value={answer}
                  required
                  className="h-4 w-4"
                />
                {t(`rebuild.answer.${answer}`)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </li>
  )
}

function DecisionGroup({
  title,
  help,
  decisions,
  unanswered,
}: {
  title: string
  help: string
  decisions: RebuildDecision[]
  unanswered: Set<string>
}) {
  if (decisions.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{help}</p>
      <ul className="mt-3 space-y-3">
        {decisions.map((decision) => (
          <DecisionRow
            key={decision.key}
            decision={decision}
            unanswered={unanswered.has(decision.key)}
          />
        ))}
      </ul>
    </div>
  )
}

export function CardRebuildReview({
  preparation,
  locale,
  createAction,
  error,
}: CardRebuildReviewProps) {
  const t = useTranslations('preferenceCards')
  const { plan, planHash, revision, sourceReleaseBundle, targetReleaseBundle, selection } =
    preparation
  const unanswered = new Set(error?.unanswered ?? [])

  const carriedUnchanged = plan.decisions.filter(
    (decision) => decision.state === 'carried_unchanged',
  )
  const requiresReview = plan.decisions.filter(
    (decision) => decision.state === 'carried_requires_review',
  )
  const added = plan.decisions.filter((decision) => decision.state === 'new_requirement')
  const waivers = plan.decisions.filter((decision) => decision.kind === 'waiver')
  const removed = plan.decisions.filter(
    (decision) =>
      decision.kind !== 'waiver' &&
      (decision.state === 'removed_requirement' || decision.state === 'not_carried'),
  )
  const blocking = plan.decisions.filter((decision) => decision.blocking)

  return (
    <div className="space-y-6">
      <Section title={t('rebuild.sourceHeading')} help={t('rebuild.sourceHelp')}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">
              {t('rebuild.sourceRevision')}
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground">
              {t('revisions.revisionNumber', { number: revision.revisionNumber })} ·{' '}
              {revision.snapshotHash.slice(0, 12)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">
              {t('rebuild.sourceRelease')}
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{sourceReleaseBundle.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">
              {t('rebuild.targetRelease')}
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{targetReleaseBundle.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">
              {t('rebuild.planHashLabel')}
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground">{planHash.slice(0, 16)}</dd>
          </div>
          {/*
            Both comparisons are written into the new card's provenance as what was compared, so
            they are shown here rather than only recorded. They are inside the plan hash as well —
            the operational one re-reads current hospital-local data, which is precisely what moves
            underneath a card, and a provenance field outside the hash could otherwise differ
            between the page rendering and the form posting.
          */}
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">
              {t('rebuild.operationalHashLabel')}
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground">
              {plan.comparisons.operationalHash.slice(0, 16)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">
              {t('rebuild.releaseDiffHashLabel')}
            </dt>
            <dd className="mt-1 font-mono text-xs text-foreground">
              {plan.comparisons.releaseDiffHash.slice(0, 16)}
            </dd>
          </div>
        </dl>
        <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
          {t('rebuild.sourceUnchangedNotice')}
        </p>
      </Section>

      {/*
        The comparisons themselves, not their digests. The hashes above identify what was compared
        and are written into the card's provenance as evidence of it; a physician cannot read a
        digest, so the structured reconciliation is rendered here through the same component the
        read-only review page uses. Two presentations of one comparison would be two answers.
      */}
      <Section title={t('rebuild.comparisonsHeading')} help={t('rebuild.comparisonsHelp')}>
        <CardReconciliationView
          reconciliation={{
            record: preparation.record,
            source: {
              cardId: plan.source.cardId,
              revisionId: plan.source.revisionId,
              revisionNumber: plan.source.revisionNumber,
              procedureCode: revision.procedureCode,
              scenarioId: revision.scenarioId,
              snapshotHash: plan.source.snapshotHash,
              snapshotIntegrityHash: plan.source.snapshotIntegrityHash,
              resolvedContentHash: plan.source.resolvedContentHash,
              printDocumentHash: revision.printDocumentHash,
              releaseBundleId: plan.source.releaseBundleId,
              catalogReleaseId: plan.source.catalogReleaseId,
              updatedAt: revision.createdAt,
            },
            operational: preparation.operational,
            release: preparation.release,
          }}
        />
      </Section>

      <Section
        title={t('rebuild.targetResolutionHeading')}
        help={t('rebuild.targetResolutionHelp')}
      >
        {plan.targetResolution.ok ? (
          <>
            <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
              {t('rebuild.targetReadiness', {
                readiness: plan.targetResolution.readinessState ?? 'unknown',
              })}
            </p>
            {plan.targetResolution.warnings.length > 0 ? (
              <ul className="space-y-2">
                {plan.targetResolution.warnings.map((warning) => (
                  <li
                    key={`${warning.code}-${warning.sourceId ?? ''}`}
                    className="rounded-2xl border border-border px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {t(`rebuild.targetWarning.${warning.severity}`)}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {warning.code}
                      {warning.sourceId ? ` · ${warning.sourceId}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
                {t('rebuild.targetNoWarnings')}
              </p>
            )}
          </>
        ) : (
          <p className="rounded-2xl border border-destructive/60 bg-destructive/5 p-4 text-sm leading-6 text-foreground">
            {t('rebuild.targetUnresolvable')}
          </p>
        )}
      </Section>

      <Section title={t('rebuild.decisionsHeading')} help={t('rebuild.decisionsHelp')}>
        {error ? (
          <p className="rounded-2xl border border-destructive/60 bg-destructive/5 p-4 text-sm leading-6 text-foreground">
            {error.message}
          </p>
        ) : null}

        <form action={createAction} className="space-y-6">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="cardId" value={plan.source.cardId} />
          <input type="hidden" name="revisionId" value={plan.source.revisionId} />
          {/*
            The plan the answers below are given against. The server recomputes the plan from the
            same source revision and target release and refuses the request if this no longer
            matches — a stale page's answers describe decisions this rebuild would not make.
          */}
          <input type="hidden" name="planHash" value={planHash} />
          {selection.moduleVersionIds.map((moduleVersionId) => (
            <input
              key={moduleVersionId}
              type="hidden"
              name="moduleVersionId"
              value={moduleVersionId}
            />
          ))}
          {selection.modifierCodes.map((modifierCode) => (
            <input key={modifierCode} type="hidden" name="modifierCode" value={modifierCode} />
          ))}

          <DecisionGroup
            title={t('rebuild.blockingHeading')}
            help={t('rebuild.blockingHelp')}
            decisions={blocking}
            unanswered={unanswered}
          />
          <DecisionGroup
            title={t('rebuild.reviewHeading')}
            help={t('rebuild.reviewHelp')}
            decisions={requiresReview}
            unanswered={unanswered}
          />
          <DecisionGroup
            title={t('rebuild.addedHeading')}
            help={t('rebuild.addedHelp')}
            decisions={added.filter((decision) => !decision.blocking)}
            unanswered={unanswered}
          />
          <DecisionGroup
            title={t('rebuild.removedHeading')}
            help={t('rebuild.removedHelp')}
            decisions={removed.filter((decision) => !decision.blocking)}
            unanswered={unanswered}
          />
          <DecisionGroup
            title={t('rebuild.waiverHeading')}
            help={t('rebuild.waiverHelp')}
            /*
              Every waiver decision is `not_carried` — that is the rule, not an outcome — so the
              group is filtered on whether it still needs an answer rather than on its state. The
              previous filter excluded the only state a waiver can have and rendered nothing, which
              pushed prior rationales into the removed-requirements list where they read as
              equipment rather than as a judgement somebody has to make again.
            */
            decisions={waivers}
            unanswered={unanswered}
          />

          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <label className="block text-xs font-semibold text-foreground">
              {t('cardTitleLabel')}
              <input
                name="title"
                required
                maxLength={160}
                defaultValue={t('rebuild.defaultTitle', { title: preparation.record.title }).slice(
                  0,
                  160,
                )}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-foreground">
              {t('physicianLabel')}
              <input
                name="physicianName"
                maxLength={160}
                defaultValue={preparation.record.physicianName ?? ''}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {t('rebuild.createNotice')}
            </p>
            <Button type="submit" className="mt-4">
              {t('rebuild.createAction')}
            </Button>
          </div>
        </form>
      </Section>

      <Section title={t('rebuild.carriedHeading')} help={t('rebuild.carriedHelp')}>
        <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
          {t('rebuild.carriedCount', { requirements: carriedUnchanged.length })}
        </p>
        <ul className="space-y-2">
          {carriedUnchanged.map((decision) => (
            <li key={decision.key} className="rounded-2xl border border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{decisionTitle(decision)}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {decisionIdentity(decision)}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
