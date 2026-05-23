import type {
  BronchoscopeDevice,
  BronchoscopyInstrument,
  FitClassification,
} from '@/lib/bronchoscope-size-explorer/types'

interface ScopeCrossSectionProps {
  scope: BronchoscopeDevice
  instrument: BronchoscopyInstrument
  fitResult: FitClassification
  airwayDiameterMm: number
}

export function ScopeCrossSection({
  scope,
  instrument,
  fitResult,
  airwayDiameterMm,
}: ScopeCrossSectionProps) {
  const center = 130
  const sheathDiameterMm = scope.sheathDiameterMm ?? 0
  const instrumentDiameterMm = instrument.outerDiameterMm ?? 0
  const maxDiameterMm = Math.max(
    airwayDiameterMm,
    sheathDiameterMm,
    scope.outerDiameterMm,
    scope.workingChannelMm,
    instrumentDiameterMm,
  )
  const scale = 210 / maxDiameterMm
  const airwayRadius = (airwayDiameterMm * scale) / 2
  const sheathRadius = (sheathDiameterMm * scale) / 2
  const scopeRadius = (scope.outerDiameterMm * scale) / 2
  const channelRadius = (scope.workingChannelMm * scale) / 2
  const instrumentRadius = (instrumentDiameterMm * scale) / 2
  const channelOffset = Math.max(0, Math.min(scopeRadius * 0.32, scopeRadius - channelRadius - 4))
  const channelCx = center + channelOffset
  const instrumentKnown = instrument.outerDiameterMm !== undefined

  return (
    <section
      aria-labelledby="cross-section-heading"
      className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm"
    >
      <div className="space-y-1">
        <h3 id="cross-section-heading" className="text-base font-semibold">
          True-scale cross-section
        </h3>
        <p className="text-sm text-muted-foreground">
          Circle diameters are scaled to the selected scope, channel, and known instrument size.
        </p>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background">
        <svg
          viewBox="0 0 260 260"
          role="img"
          aria-labelledby="scope-cross-section-title scope-cross-section-desc"
          className="h-auto w-full"
        >
          <title id="scope-cross-section-title">
            {`Cross-section for ${scope.displayName} and ${instrument.displayName}`}
          </title>
          <desc id="scope-cross-section-desc">
            The airway lumen, scope outer diameter, working channel, and selected instrument are
            displayed as proportional circles.
          </desc>
          <rect width="260" height="260" fill="hsl(var(--muted) / 0.35)" />
          <circle
            cx={center}
            cy={center}
            r={airwayRadius}
            fill="hsl(var(--secondary) / 0.12)"
            stroke="hsl(var(--secondary) / 0.55)"
            strokeWidth="3"
          />
          {scope.sheathDiameterMm ? (
            <circle
              cx={center}
              cy={center}
              r={sheathRadius}
              fill="none"
              stroke="hsl(var(--accent) / 0.8)"
              strokeDasharray="6 5"
              strokeWidth="3"
            />
          ) : null}
          <circle
            cx={center}
            cy={center}
            r={scopeRadius}
            fill="hsl(var(--primary) / 0.88)"
            stroke="hsl(var(--foreground) / 0.22)"
            strokeWidth="2"
          />
          <circle
            cx={channelCx}
            cy={center}
            r={channelRadius}
            fill="hsl(var(--background))"
            stroke="hsl(var(--foreground) / 0.35)"
            strokeWidth="2"
          />
          {instrumentKnown ? (
            <circle
              cx={channelCx}
              cy={center}
              r={instrumentRadius}
              fill="hsl(var(--accent) / 0.85)"
              stroke="hsl(var(--foreground) / 0.35)"
              strokeWidth="2"
            />
          ) : (
            <g aria-label="Instrument has minimum channel threshold only">
              <path
                d={`M ${channelCx} ${center - 12} L ${channelCx + 12} ${center} L ${channelCx} ${
                  center + 12
                } L ${channelCx - 12} ${center} Z`}
                fill="hsl(var(--accent) / 0.85)"
                stroke="hsl(var(--foreground) / 0.35)"
                strokeWidth="2"
              />
            </g>
          )}
          <text x="16" y="28" className="fill-foreground text-[11px] font-semibold">
            Airway model: {airwayDiameterMm.toFixed(1)} mm
          </text>
          <text x="16" y="246" className="fill-foreground text-[11px] font-semibold">
            Scope OD: {scope.outerDiameterMm.toFixed(1)} mm
          </text>
          <text x="144" y="246" className="fill-foreground text-[11px] font-semibold">
            Channel: {scope.workingChannelMm.toFixed(1)} mm
          </text>
        </svg>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <CrossSectionMetric label="Scope OD" value={`${scope.outerDiameterMm.toFixed(1)} mm`} />
        <CrossSectionMetric
          label="Working channel"
          value={`${scope.workingChannelMm.toFixed(1)} mm`}
        />
        <CrossSectionMetric
          label="Working channel area"
          value={`${fitResult.channelAreaMm2.toFixed(2)} mm²`}
        />
        <CrossSectionMetric
          label="Remaining channel area"
          value={
            fitResult.remainingAreaMm2 === null
              ? 'Not available'
              : `${fitResult.remainingAreaMm2.toFixed(2)} mm²`
          }
        />
      </dl>
    </section>
  )
}

function CrossSectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  )
}
