import { DEFAULT_AIRWAY_CLEARANCE_MM } from '@/lib/bronchoscope-size-explorer/calculations'
import type {
  AirwayReachResult,
  BronchoscopeDevice,
  ReachStatus,
} from '@/lib/bronchoscope-size-explorer/types'

interface AirwayReachMapProps {
  scope: BronchoscopeDevice
  reachResults: AirwayReachResult[]
  reachLabel: string
}

const statusText: Record<ReachStatus, string> = {
  reachable: 'Reachable',
  borderline: 'Borderline',
  unreachable: 'Unreachable',
}

const statusClasses: Record<ReachStatus, string> = {
  reachable: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  borderline: 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  unreachable: 'border-border bg-muted text-muted-foreground',
}

export function AirwayReachMap({ scope, reachResults, reachLabel }: AirwayReachMapProps) {
  const isRobotic =
    scope.category === 'robotic-catheter' || scope.category === 'robotic-bronchoscope'

  return (
    <section
      aria-labelledby="airway-reach-heading"
      className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm"
    >
      <div className="space-y-1">
        <h3 id="airway-reach-heading" className="text-base font-semibold">
          Airway reach model
        </h3>
        <p className="text-sm text-muted-foreground">
          Estimated size-limited reach:{' '}
          <span className="font-semibold text-foreground">{reachLabel}</span>
        </p>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Educational adult model with {DEFAULT_AIRWAY_CLEARANCE_MM.toFixed(1)} mm default clearance.
        It does not account for patient-specific anatomy, airway angulation, secretions, sedation,
        or operator technique.
      </p>
      <div className="mt-4 space-y-2">
        {reachResults.map((result) => (
          <div
            key={result.generation}
            className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-xl border border-border/60 bg-background/70 p-3 text-sm"
          >
            <div className="font-semibold text-foreground">Gen {result.generation}</div>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{result.label}</p>
              <p className="text-xs text-muted-foreground">
                Approx. {result.approximateDiameterMm.toFixed(1)} mm
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClasses[result.status]}`}
            >
              {statusText[result.status]}
            </span>
          </div>
        ))}
      </div>
      {isRobotic ? (
        <p className="mt-4 rounded-xl border border-sky-300/60 bg-sky-50 p-3 text-sm leading-6 text-sky-950 dark:border-sky-400/30 dark:bg-sky-950/20 dark:text-sky-100">
          Robotic platform reach is influenced by diameter, articulation, stability, navigation, and
          confirmation imaging; this visualization models size only.
        </p>
      ) : null}
    </section>
  )
}
