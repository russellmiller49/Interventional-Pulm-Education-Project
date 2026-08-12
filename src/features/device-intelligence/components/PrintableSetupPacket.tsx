import { getTranslations } from 'next-intl/server'

import { Card, CardContent } from '@/components/ui/card'
import type { OperationalOutputEnvelope } from '@/features/device-intelligence/domain/operational-outputs'

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

/**
 * Printable, read-only setup packet over the exact payload supplied by the output registry.
 * It performs no resolution, ranking, role inference, recommendation, or persistence.
 */
export async function PrintableSetupPacket({
  output,
}: {
  output: OperationalOutputEnvelope<'setupPacket'>
}) {
  const t = await getTranslations('deviceIntelligence.outputs.packet')
  const tWorkspace = await getTranslations('deviceIntelligence.workspace')
  const tCommon = await getTranslations('deviceIntelligence.common')
  const { payload, common } = output
  const manifest = payload.provenanceAppendix
  const zoneLabel = (zone: string) => tWorkspace(`setupZones.${zone}` as 'setupZones.unassigned')

  const renderLine = (line: (typeof payload.roomSetup)[number]['lines'][number]) => (
    <li
      key={line.itemId}
      className="output-print-group break-inside-avoid rounded-xl border border-border/70 p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{line.label}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {line.roleCode} · {line.itemId}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase">
          <span className="rounded-full border border-border px-2 py-0.5">
            {humanize(line.effectiveRequiredness)}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5">
            {humanize(line.openHoldStatus)}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5">
            {humanize(line.resolutionState)}
          </span>
        </div>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t('fields.quantity')}</dt>
          <dd>{line.quantityDisplay}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fields.selectedItem')}</dt>
          <dd>
            {line.selectedIdentityState === 'withheld'
              ? t('withheldEvidence')
              : (line.selectedDescription ?? tCommon('notRecorded'))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fields.requiredness')}</dt>
          <dd>
            {humanize(line.requiredness)} → {humanize(line.effectiveRequiredness)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fields.responsibleRole')}</dt>
          <dd>{line.responsibleRole ?? tCommon('notRecorded')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fields.sterileStatus')}</dt>
          <dd>{line.sterileStatus ? humanize(line.sterileStatus) : tCommon('notRecorded')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fields.evidenceStates')}</dt>
          <dd>
            {humanize(line.verificationState)} · {humanize(line.compatibilityState)}
          </dd>
        </div>
      </dl>
      {line.dependencyRule ? (
        <p className="mt-2 border-l-2 border-border pl-2 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">{t('fields.dependency')}:</span> “
          {line.dependencyRule}”
          {line.conditionalState ? ` · ${humanize(line.conditionalState)}` : ''}
        </p>
      ) : null}
      {line.notes ? <p className="mt-1 text-xs text-muted-foreground">{line.notes}</p> : null}
    </li>
  )

  return (
    <div aria-label={t('heading')} className="space-y-5">
      <header className="output-print-group rounded-2xl border-2 border-foreground/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{common.procedureCode}</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight">{t('heading')}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {manifest.card.recipeName} · v{manifest.card.recipeVersion}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide">
            <span className="rounded-full border border-violet-500 px-2 py-1">
              {t('demoLabel')}
            </span>
            <span className="rounded-full border border-amber-500 px-2 py-1">
              {t('draftLabel')}
            </span>
            <span className="rounded-full border border-border px-2 py-1">
              {humanize(common.provenance.state)}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6">{t('body')}</p>
        <dl className="mt-3 grid gap-x-5 gap-y-1 border-t border-border/60 pt-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('fields.releaseBundle')}</dt>
            <dd className="break-all font-mono">{common.releaseIdentity.releaseBundleId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('fields.resolvedContentHash')}</dt>
            <dd className="break-all font-mono">{common.provenance.resolvedContentHash}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('fields.modifiers')}</dt>
            <dd>
              {manifest.card.selectedModifiers.length > 0
                ? manifest.card.selectedModifiers.join(', ')
                : t('none')}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('fields.readiness')}</dt>
            <dd>{humanize(manifest.card.readinessState)}</dd>
          </div>
        </dl>
      </header>

      {payload.responsibilityState === 'not_recorded' ? (
        <p className="output-print-group rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
          {t('noResponsibleRole')}
        </p>
      ) : null}

      <section aria-labelledby="setup-packet-room-heading" className="space-y-3">
        <div className="output-print-group border-b border-border pb-2">
          <h4 id="setup-packet-room-heading" className="text-lg font-bold">
            {t('setupHeading')}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('setupNote')}</p>
        </div>
        {payload.roomSetup.map((group) => (
          <div key={group.key} className="space-y-2">
            <h5 className="output-print-group text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {zoneLabel(group.key)}
            </h5>
            <ul className="grid gap-2 lg:grid-cols-2">{group.lines.map(renderLine)}</ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="setup-packet-suppressed-heading" className="space-y-2">
        <div className="output-print-group border-b border-border pb-2">
          <h4 id="setup-packet-suppressed-heading" className="text-lg font-bold">
            {t('suppressedHeading')}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('suppressedNote')}</p>
        </div>
        {payload.suppressedItems.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t('none')}</p>
        ) : (
          <ul className="space-y-2">
            {payload.suppressedItems.map((line) => (
              <li
                key={line.itemId}
                className="output-print-group rounded-xl border border-dashed border-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{line.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{line.roleCode}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {humanize(line.effectiveRequiredness)}
                  </span>
                </div>
                {line.suppressionReason ? (
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    “{line.suppressionReason}”
                  </p>
                ) : null}
                {line.dependencyRule ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('fields.dependency')}: “{line.dependencyRule}”
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="setup-packet-diagnostics-heading" className="space-y-2">
        <div className="output-print-group border-b border-border pb-2">
          <h4 id="setup-packet-diagnostics-heading" className="text-lg font-bold">
            {t('diagnosticsHeading')}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('diagnosticsNote')}</p>
        </div>
        {payload.diagnostics.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t('noDiagnostics')}</p>
        ) : (
          <ul className="space-y-2">
            {payload.diagnostics.map((diagnostic) => (
              <li
                key={diagnostic.id}
                className="output-print-group rounded-xl border border-border/70 p-3 text-sm"
              >
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-semibold uppercase">{diagnostic.severity}</span>
                  <span className="font-mono text-muted-foreground">{diagnostic.code}</span>
                </div>
                <p className="mt-1 leading-6">{diagnostic.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="setup-packet-provenance-heading" className="space-y-3">
        <div className="output-print-group border-b border-border pb-2">
          <h4 id="setup-packet-provenance-heading" className="text-lg font-bold">
            {t('provenanceHeading')}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('provenanceNote')}</p>
        </div>

        <Card className="output-print-group">
          <CardContent className="p-4">
            <h5 className="font-bold">{t('releaseHeading')}</h5>
            <dl className="mt-2 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
              {[
                [t('fields.releaseBundle'), manifest.releaseIdentity.releaseBundleId],
                [t('fields.releaseDefinitionHash'), manifest.releaseIdentity.releaseDefinitionHash],
                [t('fields.catalogRelease'), manifest.releaseIdentity.catalogReleaseId],
                [t('fields.resolverContract'), manifest.releaseIdentity.resolverContractVersion],
                [t('fields.engineVersion'), manifest.card.engineVersion],
                [t('fields.catalogImport'), manifest.card.catalogImportId],
                [t('fields.snapshotHash'), manifest.card.snapshotHash],
                [t('fields.snapshotIntegrityHash'), manifest.card.snapshotIntegrityHash],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-all font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="output-print-group rounded-xl border border-border/70 p-4">
          <h5 className="font-bold">{t('modulesHeading')}</h5>
          {manifest.card.includedModules.length === 0 ? (
            <p className="mt-1 text-sm italic text-muted-foreground">{t('none')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {manifest.card.includedModules.map((module) => (
                <li key={module.moduleVersionId}>
                  <span className="font-semibold">{module.moduleName}</span> v{module.moduleVersion}{' '}
                  <span className="font-mono text-muted-foreground">
                    · {module.moduleVersionId} · {module.governanceState}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          role="region"
          tabIndex={0}
          aria-label={t('tableRegionLabel')}
          className="device-output-scroll overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <table className="min-w-[1100px] border-collapse text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('fields.presence')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('fields.requirement')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('fields.sourceSlot')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('fields.sourceModules')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('fields.requiredness')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('fields.states')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('fields.evidence')}
                </th>
              </tr>
            </thead>
            <tbody>
              {manifest.requirements.map((entry) => (
                <tr key={`${entry.presence}-${entry.itemId}`} className="border-t border-border/60">
                  <td className="px-3 py-2 align-top">{humanize(entry.presence)}</td>
                  <td className="px-3 py-2 align-top">
                    <span className="font-mono">{entry.itemId}</span>
                    <span className="block text-muted-foreground">{entry.roleCode}</span>
                  </td>
                  <td className="px-3 py-2 align-top font-mono">
                    {entry.sourceSlotId ?? tCommon('notRecorded')}
                  </td>
                  <td className="px-3 py-2 align-top font-mono">
                    {entry.sourceModuleVersionIds.length > 0
                      ? entry.sourceModuleVersionIds.join(', ')
                      : tCommon('notRecorded')}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {humanize(entry.requiredness)} → {humanize(entry.effectiveRequiredness)}
                    {entry.dependencyRule ? (
                      <span className="mt-1 block text-muted-foreground">
                        “{entry.dependencyRule}”
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {humanize(entry.resolutionState)} · {humanize(entry.verificationState)} ·{' '}
                    {humanize(entry.compatibilityState)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {entry.evidence.identityState === 'withheld' ? (
                      t('withheldEvidence')
                    ) : entry.evidence.identityState === 'not_recorded' ? (
                      tCommon('notRecorded')
                    ) : (
                      <>
                        <span className="font-mono">{entry.evidence.catalogProductId}</span>
                        <span className="block text-muted-foreground">
                          {[entry.evidence.sourceId, entry.evidence.sourceLocation]
                            .filter(Boolean)
                            .join(' · ') || tCommon('notRecorded')}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="output-print-group border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        {t('footer')}
      </footer>
    </div>
  )
}
