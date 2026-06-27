import type { TrendPoint } from '../engine/types'
import { HandoffContent } from '@/i18n/handoff'

interface PressureTrendChartProps {
  series: TrendPoint[]
}

export function PressureTrendChart({ series }: PressureTrendChartProps) {
  const width = 520
  const height = 220
  const pad = 34
  const maxLeak = Math.max(100, ...series.map((point) => point.airLeakMlMin))
  const minPressure = Math.min(-40, ...series.map((point) => point.pressureCmH2O))
  const maxPressure = Math.max(5, ...series.map((point) => point.pressureCmH2O))

  const leakPoints = series
    .map((point, index) => {
      const x = pad + (index / Math.max(series.length - 1, 1)) * (width - pad * 2)
      const y = height - pad - (point.airLeakMlMin / maxLeak) * (height - pad * 2)

      return `${x},${y}`
    })
    .join(' ')

  const pressurePoints = series
    .map((point, index) => {
      const x = pad + (index / Math.max(series.length - 1, 1)) * (width - pad * 2)
      const range = maxPressure - minPressure
      const y = height - pad - ((point.pressureCmH2O - minPressure) / range) * (height - pad * 2)

      return `${x},${y}`
    })
    .join(' ')

  return (
    <HandoffContent>
      {
        <figure className="rounded-lg border border-border/80 bg-background p-4">
          <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-foreground">Trend cockpit</span>
            <span className="text-xs text-muted-foreground">
              Blue: air leak mL/min · Orange: pressure cm H2O
            </span>
          </figcaption>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Trend chart showing modeled air leak and suction pressure over time"
            className="h-auto w-full"
          >
            <rect x="0" y="0" width={width} height={height} rx="10" className="fill-muted/30" />
            {[0, 1, 2, 3].map((line) => {
              const y = pad + line * ((height - pad * 2) / 3)

              return (
                <line
                  key={line}
                  x1={pad}
                  x2={width - pad}
                  y1={y}
                  y2={y}
                  className="stroke-border"
                  strokeWidth="1"
                />
              )
            })}
            <polyline
              points={leakPoints}
              fill="none"
              className="stroke-sky-500"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={pressurePoints}
              fill="none"
              className="stroke-orange-500"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="7 6"
            />
            <text x={pad} y={height - 10} className="fill-muted-foreground text-[11px]">
              0 min
            </text>
            <text
              x={width - pad - 38}
              y={height - 10}
              className="fill-muted-foreground text-[11px]"
            >
              {series.at(-1)?.minute ?? 0} min
            </text>
          </svg>
        </figure>
      }
    </HandoffContent>
  )
}
