import { Badge } from '@/components/ui/badge'

import type { PreferenceCardReleaseBundle, ReleaseImpactReport } from '../domain/release-bundle'

/**
 * The retained releases, and what advancing to each one changed.
 *
 * Read-only, deliberately. Publishing a release and advancing a pointer are seed edits that go
 * through review and a build that recomputes and verifies every hash; a button here would be a
 * way to do the same thing without any of that. What this is for is the step *before* the
 * edit — seeing what a release pins, which one is current, and what changed against the
 * release it supersedes.
 */

interface ReleaseBundleTableProps {
  bundles: PreferenceCardReleaseBundle[]
  pointers: Record<string, string>
  impact: ReleaseImpactReport[]
  labels: {
    heading: string
    description: string
    release: string
    procedure: string
    state: string
    published: string
    pins: string
    impactColumn: string
    current: string
    superseded: string
    noChange: string
    initial: string
    modules: string
    recipe: string
    requirementChanges: string
    modifierEffectChanges: string
    /**
     * Renders beside the modifier-effect rows: these are changes to the authored effect of
     * *selecting* the named modifier, not a statement that any scenario selects it.
     */
    modifierEffectNote: string
  }
}

const stateVariant: Record<string, 'success' | 'info' | 'outline'> = {
  published: 'success',
  draft: 'info',
  retired: 'outline',
}

export function ReleaseBundleTable({ bundles, pointers, impact, labels }: ReleaseBundleTableProps) {
  const impactById = new Map(impact.map((report) => [report.nextReleaseBundleId, report]))
  const ordered = [...bundles].sort(
    (left, right) =>
      left.sourceProcedureCode.localeCompare(right.sourceProcedureCode) ||
      left.id.localeCompare(right.id),
  )

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{labels.heading}</h2>
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{labels.description}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{labels.release}</th>
              <th className="px-4 py-3">{labels.procedure}</th>
              <th className="px-4 py-3">{labels.state}</th>
              <th className="px-4 py-3">{labels.published}</th>
              <th className="px-4 py-3">{labels.pins}</th>
              <th className="px-4 py-3">{labels.impactColumn}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ordered.map((bundle) => {
              const isCurrent = pointers[bundle.sourceProcedureCode] === bundle.id
              const report = impactById.get(bundle.id)
              return (
                <tr key={bundle.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-mono text-[11px] text-foreground">{bundle.id}</p>
                    {isCurrent ? (
                      <Badge className="mt-1" size="sm" variant="success">
                        {labels.current}
                      </Badge>
                    ) : null}
                    {bundle.supersedesReleaseBundleId ? (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {labels.superseded} {bundle.supersedesReleaseBundleId}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px]">{bundle.sourceProcedureCode}</td>
                  <td className="px-4 py-4">
                    <Badge size="sm" variant={stateVariant[bundle.releaseState] ?? 'outline'}>
                      {bundle.releaseState}
                    </Badge>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {bundle.governanceState}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {bundle.publishedAt?.slice(0, 10) ?? '—'}
                    {bundle.retiredAt ? (
                      <span className="block">→ {bundle.retiredAt.slice(0, 10)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
                      <li>
                        {labels.recipe} {bundle.recipeVersionId} ·{' '}
                        {bundle.recipeDefinitionHash.slice(0, 12)}
                      </li>
                      <li>
                        {labels.modules} {bundle.modulePins.length}
                      </li>
                      <li>{bundle.modifierSetPin.definitionHash.slice(0, 12)} modifiers</li>
                      <li>
                        {bundle.compatibilityRuleSetPin.definitionHash.slice(0, 12)} compatibility
                      </li>
                      <li>{bundle.rescueModuleSetPin.definitionHash.slice(0, 12)} rescue</li>
                      <li>{bundle.roleTaxonomyPin.definitionHash.slice(0, 12)} roles</li>
                    </ul>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {!report || report.previousReleaseBundleId === null ? (
                      <span className="text-muted-foreground">{labels.initial}</span>
                    ) : report.identical ? (
                      <span className="text-muted-foreground">{labels.noChange}</span>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-muted-foreground">
                          {report.requirementChanges.length} {labels.requirementChanges}
                        </p>
                        <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
                          {report.requirementChanges.slice(0, 12).map((change) => (
                            <li key={change.requirementKey}>
                              {change.kind} {change.requirementKey}
                              {change.changedFields.length > 0
                                ? ` (${change.changedFields.join(', ')})`
                                : ''}
                            </li>
                          ))}
                        </ul>
                        {report.modifierEffectChanges.length > 0 ? (
                          <div className="space-y-1 pt-1">
                            <p className="text-muted-foreground">
                              {report.modifierEffectChanges.length} {labels.modifierEffectChanges}
                            </p>
                            <p className="max-w-sm text-[10px] leading-4 text-muted-foreground">
                              {labels.modifierEffectNote}
                            </p>
                            <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
                              {report.modifierEffectChanges.slice(0, 12).map((change) => (
                                <li key={`${change.modifierCode}-${change.actionId ?? 'modifier'}`}>
                                  {change.modifierCode} {change.kind}{' '}
                                  {change.requirementKey ?? change.actionId ?? change.modifierCode}
                                  {change.changedFields.length > 0
                                    ? ` (${change.changedFields.join(', ')})`
                                    : ''}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}
                    {bundle.releaseNotes ? (
                      <p className="mt-2 max-w-sm leading-5 text-muted-foreground">
                        {bundle.releaseNotes}
                      </p>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
