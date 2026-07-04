'use client'

import { useId } from 'react'

import { clockToOffset, getNode, lobeColor } from '@/lib/airway-anatomy-lesson/airway-graph'
import type { AirwayNode } from '@/lib/airway-anatomy-lesson/types'
import { cn } from '@/lib/cn'

interface EndoscopicViewProps {
  node: AirwayNode
  /** Currently highlighted child opening id (e.g. the survey's next target). */
  highlightChildId?: string | null
  onSelectOpening?: (childId: string) => void
  showOrientationMarks?: boolean
  className?: string
}

const FIELD = 320
const CENTER = FIELD / 2
const FIELD_RADIUS = 150

/**
 * A stylized endoluminal ("what the scope sees") illustration. The circular
 * fiberoptic field shows pink mucosa; each downstream airway is drawn as a dark
 * ostium placed on the clock face from the node's `endoscopicView`. Purely
 * schematic — a teaching diagram, not a photograph.
 */
export function EndoscopicView({
  node,
  highlightChildId,
  onSelectOpening,
  showOrientationMarks = true,
  className,
}: EndoscopicViewProps) {
  const uid = useId().replace(/[:]/g, '')
  const view = node.endoscopicView

  if (!view) {
    return (
      <div
        className={cn(
          'flex aspect-square w-full items-center justify-center rounded-full border border-border/60 bg-slate-950 text-xs text-slate-400',
          className,
        )}
      >
        Terminal segment — no further branches
      </div>
    )
  }

  // Neutral scope orientation: anterior up, posterior down, and the patient's
  // right toward the left of the image (so patient-right sits at 9 o'clock).
  const orientationTicks = [
    { clock: 12, label: 'A' },
    { clock: 6, label: 'P' },
    { clock: 9, label: 'R' },
    { clock: 3, label: 'L' },
  ]

  return (
    <svg
      viewBox={`0 0 ${FIELD} ${FIELD}`}
      className={cn('w-full', className)}
      role="img"
      aria-label={`Schematic endoscopic view at the ${node.fullName}`}
    >
      <defs>
        <radialGradient id={`${uid}-mucosa`} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#f7b7ac" />
          <stop offset="55%" stopColor="#e0827a" />
          <stop offset="100%" stopColor="#a63f45" />
        </radialGradient>
        <radialGradient id={`${uid}-vignette`} cx="50%" cy="50%" r="52%">
          <stop offset="72%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.72" />
        </radialGradient>
        <radialGradient id={`${uid}-ostium`} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#3a1518" />
          <stop offset="70%" stopColor="#210b0d" />
          <stop offset="100%" stopColor="#080303" />
        </radialGradient>
      </defs>

      {/* Scope field background */}
      <circle cx={CENTER} cy={CENTER} r={FIELD_RADIUS} fill="#0b0405" />
      <circle cx={CENTER} cy={CENTER} r={FIELD_RADIUS} fill={`url(#${uid}-mucosa)`} />

      {/* Subtle vascular striae on the mucosa */}
      <g stroke="#8f2f34" strokeOpacity="0.35" strokeWidth="1.4" fill="none">
        <path d={`M ${CENTER - 96} ${CENTER - 30} q 40 -34 96 -18`} />
        <path d={`M ${CENTER - 70} ${CENTER + 62} q 60 20 132 -8`} />
        <path d={`M ${CENTER + 20} ${CENTER - 92} q 18 60 -6 120`} />
      </g>

      {/* Wall features (membranous wall, spurs) */}
      {view.wallFeatures?.map((feature) => {
        const pos = clockToOffset(feature.clock, FIELD_RADIUS - 16)
        return (
          <text
            key={`${feature.clock}-${feature.label}`}
            x={CENTER + pos.x}
            y={CENTER + pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-rose-50/80 text-[9px] font-medium"
            style={{ paintOrder: 'stroke' }}
            stroke="#5a1f22"
            strokeWidth="2.4"
          >
            {feature.label}
          </text>
        )
      })}

      {/* Ostia (downstream openings) */}
      {view.openings.map((opening) => {
        const child = getNode(opening.childId)
        const pos = clockToOffset(opening.clock, FIELD_RADIUS * 0.5)
        const r = (opening.size ?? 0.6) * FIELD_RADIUS * 0.34
        const cx = CENTER + pos.x
        const cy = CENTER + pos.y
        const isHighlighted = highlightChildId === opening.childId
        const rimColor = child ? lobeColor(child.lobe) : '#e2e8f0'
        return (
          <g
            key={opening.childId}
            onClick={onSelectOpening ? () => onSelectOpening(opening.childId) : undefined}
            style={{ cursor: onSelectOpening ? 'pointer' : 'default' }}
            role={onSelectOpening ? 'button' : undefined}
            aria-label={child?.fullName}
          >
            {isHighlighted && (
              <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke={rimColor} strokeWidth="3">
                <animate
                  attributeName="stroke-opacity"
                  values="0.9;0.25;0.9"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.86} fill={`url(#${uid}-ostium)`} />
            <ellipse
              cx={cx}
              cy={cy}
              rx={r}
              ry={r * 0.86}
              fill="none"
              stroke={rimColor}
              strokeWidth={isHighlighted ? 3 : 1.6}
              strokeOpacity={isHighlighted ? 1 : 0.75}
            />
            {opening.label && (
              <text
                x={cx}
                y={cy + r + 12}
                textAnchor="middle"
                className="fill-white text-[11px] font-semibold"
                style={{ paintOrder: 'stroke' }}
                stroke="#3f1416"
                strokeWidth="3"
              >
                {opening.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Vignette on top of everything except orientation marks */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={FIELD_RADIUS}
        fill={`url(#${uid}-vignette)`}
        pointerEvents="none"
      />

      {/* Orientation ticks (A/P/R/L) around the rim */}
      {showOrientationMarks &&
        orientationTicks.map((tick) => {
          const pos = clockToOffset(tick.clock, FIELD_RADIUS + 12)
          return (
            <text
              key={tick.label + tick.clock}
              x={CENTER + pos.x}
              y={CENTER + pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-400 text-[11px] font-bold"
            >
              {tick.label}
            </text>
          )
        })}

      <circle
        cx={CENTER}
        cy={CENTER}
        r={FIELD_RADIUS}
        fill="none"
        stroke="#1e293b"
        strokeWidth="4"
        pointerEvents="none"
      />
    </svg>
  )
}
