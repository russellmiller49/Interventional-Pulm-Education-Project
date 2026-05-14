import { cn } from '@/lib/cn'
import type { BronchoscopeDevice } from '@/lib/bronchoscope-size-explorer/types'

interface ScopeSelectorProps {
  scopes: BronchoscopeDevice[]
  selectedScopeId: string
  onSelectScope: (scopeId: string) => void
}

export function ScopeSelector({ scopes, selectedScopeId, onSelectScope }: ScopeSelectorProps) {
  return (
    <section aria-labelledby="scope-selector-heading" className="space-y-3">
      <div className="space-y-1">
        <h3 id="scope-selector-heading" className="text-base font-semibold">
          Scope platform
        </h3>
        <p className="text-sm text-muted-foreground">
          Smaller outer diameter favors modeled distal access; larger channel favors suction and
          tool capacity.
        </p>
      </div>
      <div className="grid gap-2" role="list" aria-label="Bronchoscope presets">
        {scopes.map((scope) => {
          const isSelected = scope.id === selectedScopeId

          return (
            <button
              key={scope.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectScope(scope.id)}
              className={cn(
                'rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isSelected
                  ? 'border-primary/60 bg-primary/10 shadow-sm'
                  : 'border-border/70 bg-card/70 hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <span className="flex flex-wrap items-start justify-between gap-3">
                <span className="space-y-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {scope.displayName}
                  </span>
                  <span className="block text-xs capitalize text-muted-foreground">
                    {scope.category.replace('-', ' ')}
                  </span>
                </span>
                <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-semibold text-foreground">
                  OD {scope.outerDiameterMm.toFixed(1)} mm
                </span>
              </span>
              <span className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Channel {scope.workingChannelMm.toFixed(1)} mm</span>
                {scope.sheathDiameterMm ? (
                  <span>Sheath {scope.sheathDiameterMm.toFixed(1)} mm</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
