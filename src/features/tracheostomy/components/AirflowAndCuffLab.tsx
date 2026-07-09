'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { AlertOctagon, Gauge, Volume2, Wind } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/cn'

type AirflowMode = 'inflated' | 'deflated' | 'speaking-valve' | 'capped'

interface ModeDefinition {
  id: AirflowMode
  label: string
  tagline: string
  description: string
  cue: string
  upperAirway: boolean
  tubeInspiration: boolean
  tubeExpiration: boolean
}

const modes: ModeDefinition[] = [
  {
    id: 'inflated',
    label: 'Cuff inflated',
    tagline: 'Positive-pressure seal',
    description:
      'Most delivered flow follows the tracheostomy tube. An inflated cuff supports a ventilator seal but does not eliminate microaspiration.',
    cue: 'Measure pressure with a manometer; pilot-balloon feel is not a pressure measurement.',
    upperAirway: false,
    tubeInspiration: true,
    tubeExpiration: true,
  },
  {
    id: 'deflated',
    label: 'Cuff deflated',
    tagline: 'Air can move around the tube',
    description:
      'With a patent upper airway and adequate space around the tube, exhaled gas may reach the larynx while the tracheostomy remains open.',
    cue: 'Assess secretion burden, cough, oxygenation, work of breathing, and expiratory patency during a supervised trial.',
    upperAirway: true,
    tubeInspiration: true,
    tubeExpiration: true,
  },
  {
    id: 'speaking-valve',
    label: 'Speaking valve',
    tagline: 'In through tube · out through larynx',
    description:
      'A one-way valve opens for inspiration through the tube and closes for expiration, redirecting gas around the tube and across the vocal folds.',
    cue: 'Absolute rule: the cuff must be fully deflated and an expiratory route through the upper airway must be confirmed.',
    upperAirway: true,
    tubeInspiration: true,
    tubeExpiration: false,
  },
  {
    id: 'capped',
    label: 'Capped',
    tagline: 'Both directions use the upper airway',
    description:
      'A cap closes the tracheostomy connector. Inspiration and expiration must pass around the tube through the upper airway, making this a higher-resistance readiness challenge.',
    cue: 'Remove the cap immediately for distress, stridor, desaturation, rising work of breathing, ineffective cough, or forceful air release on removal.',
    upperAirway: true,
    tubeInspiration: false,
    tubeExpiration: false,
  },
]

function pressureBand(pressure: number) {
  if (pressure < 20) {
    return {
      label: 'Below common adult-ICU consensus range',
      detail: 'Leak and loss of an effective ventilator seal become more likely.',
      color: 'text-amber-700 dark:text-amber-300',
      fill: 'bg-amber-400',
    }
  }
  if (pressure < 30) {
    return {
      label: 'Within the 2026 adult-ICU consensus target',
      detail:
        'Use the minimum pressure that provides the required seal, then follow local policy and the device IFU.',
      color: 'text-emerald-700 dark:text-emerald-300',
      fill: 'bg-emerald-500',
    }
  }
  return {
    label: 'At or above the consensus upper boundary',
    detail:
      'Recheck position, tube fit, ventilator pressures, and the cuff system rather than simply adding more air.',
    color: 'text-rose-700 dark:text-rose-300',
    fill: 'bg-rose-500',
  }
}

function FlowPath({
  d,
  color,
  marker,
  show,
  reverse = false,
  reduceMotion,
}: {
  d: string
  color: string
  marker: string
  show: boolean
  reverse?: boolean
  reduceMotion: boolean
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="10"
      strokeLinecap="round"
      strokeDasharray="14 14"
      markerEnd={`url(#${marker})`}
      initial={false}
      animate={{
        opacity: show ? 1 : 0.12,
        strokeDashoffset: reduceMotion || !show ? 0 : reverse ? 56 : -56,
      }}
      transition={
        reduceMotion || !show
          ? { duration: 0.2 }
          : {
              strokeDashoffset: { duration: 1.5, repeat: Infinity, ease: 'linear' },
              opacity: { duration: 0.2 },
            }
      }
    />
  )
}

export function AirflowAndCuffLab() {
  const reduceMotion = Boolean(useReducedMotion())
  const [modeId, setModeId] = useState<AirflowMode>('inflated')
  const [pressure, setPressure] = useState(25)
  const titleId = 'tracheostomy-airflow-title'
  const descId = 'tracheostomy-airflow-description'
  const mode = modes.find((candidate) => candidate.id === modeId) ?? modes[0]
  const band = pressureBand(pressure)
  const cuffInflated = mode.id === 'inflated'

  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
      <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6 border-b border-border/70 p-5 md:p-7 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
              Animated physiology lab
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              Predict the route of airflow
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Change the tube state and watch which airway must carry inspiration and expiration.
              Animation pauses automatically when reduced motion is enabled.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Airflow state">
            {modes.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                role="radio"
                aria-checked={candidate.id === mode.id}
                onClick={() => setModeId(candidate.id)}
                className={cn(
                  'rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  candidate.id === mode.id
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-border/70 bg-background/70 hover:border-sky-500/50',
                )}
              >
                <span className="block text-sm font-semibold text-foreground">
                  {candidate.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {candidate.tagline}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4" aria-live="polite">
            <div className="flex items-center gap-2">
              {mode.id === 'speaking-valve' ? (
                <Volume2 className="h-4 w-4 text-violet-500" aria-hidden />
              ) : (
                <Wind className="h-4 w-4 text-sky-500" aria-hidden />
              )}
              <h3 className="text-sm font-semibold text-foreground">{mode.tagline}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{mode.description}</p>
            <p
              className={cn(
                'mt-3 rounded-xl border px-3 py-2 text-xs leading-5',
                mode.id === 'speaking-valve'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                  : 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
              )}
            >
              <span className="font-semibold">Clinical cue:</span> {mode.cue}
            </p>
          </div>

          <div className={cn('space-y-3 transition-opacity', !cuffInflated && 'opacity-45')}>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="cuff-pressure"
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <Gauge className="h-4 w-4 text-sky-500" aria-hidden />
                Cuff pressure
              </label>
              <output htmlFor="cuff-pressure" className="font-mono text-sm font-semibold">
                {pressure} cm H₂O
              </output>
            </div>
            <input
              id="cuff-pressure"
              type="range"
              min="10"
              max="40"
              step="1"
              value={pressure}
              disabled={!cuffInflated}
              onChange={(event) => setPressure(Number(event.target.value))}
              className="w-full accent-sky-600"
            />
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', band.fill)}
                style={{ width: `${((pressure - 10) / 30) * 100}%` }}
              />
            </div>
            <div className={cn('text-xs leading-5', band.color)}>
              <p className="font-semibold">{band.label}</p>
              <p>{band.detail}</p>
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Educational target: greater than 20 and less than 30 cm H₂O in the 2026 adult ICU
              consensus. Device instructions and local policy may differ.
            </p>
          </div>
        </div>

        <div className="relative min-h-[560px] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-4 md:p-7">
          <svg
            viewBox="50 40 520 550"
            className="h-full min-h-[500px] w-full"
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
          >
            <title id={titleId}>{`Airflow with ${mode.label.toLowerCase()}`}</title>
            <desc id={descId}>{mode.description}</desc>
            <defs>
              <linearGradient id="skin-gradient" x1="0" x2="1">
                <stop offset="0" stopColor="#7c4a45" />
                <stop offset="1" stopColor="#b9786c" />
              </linearGradient>
              <linearGradient id="tube-gradient" x1="0" x2="1">
                <stop offset="0" stopColor="#bfdbfe" />
                <stop offset="0.5" stopColor="#f8fafc" />
                <stop offset="1" stopColor="#7dd3fc" />
              </linearGradient>
              <marker
                id="arrow-cyan"
                markerWidth="10"
                markerHeight="10"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L7,3 z" fill="#22d3ee" />
              </marker>
              <marker
                id="arrow-violet"
                markerWidth="10"
                markerHeight="10"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L7,3 z" fill="#c084fc" />
              </marker>
              <filter id="diagram-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="9"
                  stdDeviation="11"
                  floodColor="#020617"
                  floodOpacity=".42"
                />
              </filter>
            </defs>

            <path
              d="M180 72 C260 78 314 127 323 195 C332 262 316 311 325 382 C334 453 356 514 365 570 L496 570 C485 497 468 425 464 355 C460 284 484 205 450 139 C417 76 340 45 270 48Z"
              fill="url(#skin-gradient)"
              opacity=".35"
            />
            <path
              d="M321 92 C354 125 355 161 341 196 C330 225 329 257 339 291 L343 505"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="46"
              strokeLinecap="round"
              opacity=".28"
            />
            {Array.from({ length: 8 }, (_, index) => (
              <path
                key={index}
                d={`M316 ${260 + index * 36} Q342 ${247 + index * 36} 368 ${260 + index * 36}`}
                fill="none"
                stroke="#dbeafe"
                strokeWidth="7"
                strokeLinecap="round"
                opacity=".8"
              />
            ))}
            <path
              d="M190 316 C234 315 279 321 318 345 C346 362 359 403 357 473"
              fill="none"
              stroke="#64748b"
              strokeWidth="66"
              strokeLinecap="round"
              filter="url(#diagram-shadow)"
            />
            <path
              d="M190 316 C234 315 279 321 318 345 C346 362 359 403 357 473"
              fill="none"
              stroke="url(#tube-gradient)"
              strokeWidth="48"
              strokeLinecap="round"
            />
            <rect
              x="155"
              y="277"
              width="94"
              height="78"
              rx="20"
              fill="#e2e8f0"
              stroke="#7dd3fc"
              strokeWidth="5"
            />
            <rect
              x="87"
              y="291"
              width="90"
              height="50"
              rx="18"
              fill="#dbeafe"
              stroke="#7dd3fc"
              strokeWidth="5"
            />

            <motion.ellipse
              cx="356"
              cy="426"
              fill="#5eead4"
              stroke="#2dd4bf"
              strokeWidth="5"
              initial={false}
              animate={{
                rx: cuffInflated ? 52 : 27,
                ry: cuffInflated ? 44 : 22,
                opacity: cuffInflated ? 0.78 : 0.38,
              }}
              transition={{ duration: reduceMotion ? 0 : 0.45 }}
            />

            {mode.id === 'speaking-valve' ? (
              <g>
                <path d="M90 282 h-22 v70 h22" fill="#c084fc" opacity=".88" />
                <path d="M75 304 l-18 12 18 12z" fill="#f5d0fe" />
              </g>
            ) : null}
            {mode.id === 'capped' ? (
              <rect
                x="78"
                y="285"
                width="26"
                height="62"
                rx="9"
                fill="#fbbf24"
                stroke="#fde68a"
                strokeWidth="4"
              />
            ) : null}

            <FlowPath
              d="M82 316 C153 316 228 316 296 350 C326 365 345 399 353 467"
              color="#22d3ee"
              marker="arrow-cyan"
              show={mode.tubeInspiration}
              reduceMotion={reduceMotion}
            />
            <FlowPath
              d="M355 470 C344 410 318 371 278 350 C220 322 159 316 92 316"
              color="#c084fc"
              marker="arrow-violet"
              show={mode.tubeExpiration}
              reverse
              reduceMotion={reduceMotion}
            />
            <FlowPath
              d="M355 470 C350 409 347 344 342 286 C337 231 336 191 308 155 C283 123 252 111 220 105"
              color="#c084fc"
              marker="arrow-violet"
              show={mode.upperAirway}
              reverse
              reduceMotion={reduceMotion}
            />
            <FlowPath
              d="M220 105 C255 115 285 132 310 164 C337 201 339 244 342 288 C346 347 351 408 355 470"
              color="#22d3ee"
              marker="arrow-cyan"
              show={mode.id === 'capped'}
              reduceMotion={reduceMotion}
            />

            <g fontFamily="ui-sans-serif, system-ui" fontSize="17" fill="#e2e8f0">
              <text x="140" y="80">
                Mouth and upper airway
              </text>
              <text x="381" y="280">
                Trachea
              </text>
              <text x="70" y="382">
                Tube connector
              </text>
              <text x="387" y="432">
                Cuff {cuffInflated ? 'inflated' : 'deflated'}
              </text>
            </g>
            <g fontFamily="ui-sans-serif, system-ui" fontSize="15">
              <circle cx="92" cy="545" r="7" fill="#22d3ee" />
              <text x="108" y="550" fill="#bae6fd">
                Inspiration
              </text>
              <circle cx="230" cy="545" r="7" fill="#c084fc" />
              <text x="246" y="550" fill="#e9d5ff">
                Expiration
              </text>
            </g>
          </svg>

          {mode.id === 'speaking-valve' ? (
            <div className="absolute bottom-5 left-5 right-5 flex gap-3 rounded-2xl border border-rose-400/40 bg-rose-950/85 p-4 text-sm leading-6 text-rose-100 backdrop-blur">
              <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden />
              <p>
                <span className="font-semibold">
                  Never combine an inflated cuff with a one-way speaking valve.
                </span>{' '}
                The patient may inhale but cannot exhale.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
