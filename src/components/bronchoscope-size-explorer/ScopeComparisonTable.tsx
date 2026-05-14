import {
  estimateReachGeneration,
  getEstimatedReachLabel,
  getMaxReachableGeneration,
  workingChannelAreaMm2,
} from '@/lib/bronchoscope-size-explorer/calculations'
import type { AirwayGeneration, BronchoscopeDevice } from '@/lib/bronchoscope-size-explorer/types'

interface ScopeComparisonTableProps {
  scopes: BronchoscopeDevice[]
  airwayModel: AirwayGeneration[]
}

export function ScopeComparisonTable({ scopes, airwayModel }: ScopeComparisonTableProps) {
  return (
    <section aria-labelledby="scope-comparison-heading" className="space-y-4">
      <div className="space-y-1">
        <h3 id="scope-comparison-heading" className="text-xl font-semibold">
          Scope comparison
        </h3>
        <p className="text-sm text-muted-foreground">
          Preset dimensions are representative examples and are not an exhaustive device catalog.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <table className="min-w-[860px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Scope/platform</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">OD</th>
              <th className="px-4 py-3 font-semibold">Working channel</th>
              <th className="px-4 py-3 font-semibold">Channel area</th>
              <th className="px-4 py-3 font-semibold">Estimated reach label</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {scopes.map((scope) => {
              const reachResults = estimateReachGeneration(scope.outerDiameterMm, airwayModel)
              const reachLabel = getEstimatedReachLabel(getMaxReachableGeneration(reachResults))

              return (
                <tr key={scope.id} className="align-top">
                  <td className="px-4 py-4 font-semibold text-foreground">{scope.displayName}</td>
                  <td className="px-4 py-4 capitalize text-muted-foreground">
                    {scope.category.replace('-', ' ')}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {scope.outerDiameterMm.toFixed(1)} mm
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {scope.workingChannelMm.toFixed(1)} mm
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {workingChannelAreaMm2(scope.workingChannelMm).toFixed(2)} mm²
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{reachLabel}</td>
                  <td className="max-w-xs px-4 py-4 text-muted-foreground">
                    {scope.notes.join(' ')}
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
