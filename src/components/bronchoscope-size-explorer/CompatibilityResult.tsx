import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type {
  BronchoscopeDevice,
  BronchoscopyInstrument,
  FitClassification,
  FitStatus,
} from '@/lib/bronchoscope-size-explorer/types'

interface CompatibilityResultProps {
  scope: BronchoscopeDevice
  instrument: BronchoscopyInstrument
  result: FitClassification
}

const statusLabels: Record<FitStatus, string> = {
  fits: 'Fits',
  borderline: 'Borderline',
  'does-not-fit': 'Does not fit',
  unknown: 'Unknown',
}

const statusClasses: Record<FitStatus, string> = {
  fits: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  borderline: 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  'does-not-fit': 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  unknown: 'border-border bg-muted text-muted-foreground',
}

export function CompatibilityResult({ scope, instrument, result }: CompatibilityResultProps) {
  return (
    <section
      aria-labelledby="compatibility-heading"
      className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id="compatibility-heading" className="text-base font-semibold">
            Compatibility result
          </h3>
          <p className="text-sm text-muted-foreground">
            {scope.shortName} with {instrument.displayName}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn('rounded-full px-3 py-1', statusClasses[result.status])}
        >
          {statusLabels[result.status]}
        </Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{result.message}</p>
      {result.caution ? (
        <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100">
          {result.caution}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Metric label="Working channel" value={`${scope.workingChannelMm.toFixed(1)} mm`} />
        <Metric label="Channel area" value={`${result.channelAreaMm2.toFixed(2)} mm²`} />
        <Metric
          label="Instrument area"
          value={
            result.instrumentAreaMm2 === null
              ? 'Not modeled from diameter'
              : `${result.instrumentAreaMm2.toFixed(2)} mm²`
          }
        />
        <Metric
          label="Remaining area"
          value={
            result.remainingAreaMm2 === null
              ? 'Not available'
              : `${result.remainingAreaMm2.toFixed(2)} mm²`
          }
        />
      </dl>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  )
}
