import { Activity, CircleDot, Droplets, ShieldAlert, Stethoscope } from 'lucide-react'

import { cn } from '@/lib/cn'

import type { IntroLearnBlock } from '../types'

const visualConfig: Record<
  NonNullable<IntroLearnBlock['visual']>,
  { title: string; labels: string[]; icon: typeof Stethoscope; accent: string }
> = {
  'value-equation': {
    title: 'Bronchoscopy value equation',
    labels: ['Indication', 'Tools', 'Technique', 'Team', 'Follow-up'],
    icon: Stethoscope,
    accent: '#0ea5e9',
  },
  'scope-anatomy': {
    title: 'Scope anatomy',
    labels: ['Insertion tube', 'Control body', 'Suction valve', 'Working channel'],
    icon: Activity,
    accent: '#22c55e',
  },
  'airway-map': {
    title: 'Endoscopy + CT + 3D',
    labels: ['Endoscopic view', 'CT correlation', 'Tree path', '3D model'],
    icon: CircleDot,
    accent: '#a855f7',
  },
  'icu-physiology': {
    title: 'ETT obstruction physiology',
    labels: ['Scope area', 'Residual lumen', 'Ventilation', 'Pause/withdraw'],
    icon: Droplets,
    accent: '#f97316',
  },
  bleeding: {
    title: 'Airway emergency priorities',
    labels: ['Announce', 'Suction', 'Protect good lung', 'Escalate'],
    icon: ShieldAlert,
    accent: '#ef4444',
  },
}

export function IntroConceptVisual({
  visual,
  className,
}: {
  visual: NonNullable<IntroLearnBlock['visual']>
  className?: string
}) {
  const config = visualConfig[visual]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${config.accent}18`, color: config.accent }}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-foreground">{config.title}</p>
        </div>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 640 220" role="img" aria-label={config.title} className="h-auto w-full">
          <defs>
            <linearGradient id={`intro-${visual}`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor={config.accent} stopOpacity="0.25" />
              <stop offset="100%" stopColor={config.accent} stopOpacity="0.04" />
            </linearGradient>
          </defs>
          <rect x="20" y="32" width="600" height="156" rx="18" fill={`url(#intro-${visual})`} />
          <path
            d="M72 112 C160 36, 248 188, 336 112 S512 36, 588 112"
            fill="none"
            stroke={config.accent}
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.6"
          />
          {config.labels.map((label, index) => {
            const x = 84 + index * (472 / Math.max(1, config.labels.length - 1))
            const y = index % 2 === 0 ? 86 : 138
            return (
              <g key={label}>
                <circle cx={x} cy={y} r="18" fill="#020617" opacity="0.82" />
                <circle cx={x} cy={y} r="8" fill={config.accent} />
                <text
                  x={x}
                  y={y + 42}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="16"
                  fontWeight="700"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
