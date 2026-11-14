import { useId } from 'react'
import { benchFluidObservation } from '../../engine/scope/benchFluid'
import type { ScopeState } from './types'

/** Both views read the reducer's fluid level and tip depth; no decorative emptying animation. */
export function BenchFluidView({
  state,
  optical = false,
  overlay = false,
}: {
  state: ScopeState
  optical?: boolean
  overlay?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const fluid = benchFluidObservation(state)
  const surfaceY = 52 + fluid.surfaceMm * 2.5
  const tipY = 52 + Math.max(-4, Math.min(47, state.depthMm)) * 2.5
  const status = fluid.aspirating
    ? 'Fluid enters the working channel'
    : fluid.submerged
      ? 'Tip in fluid · suction off'
      : state.inputs.suction
        ? 'Tip above fluid · reposition to aspirate'
        : 'Advance the tip into the fluid'
  return (
    <svg
      viewBox={optical ? '0 0 400 300' : '0 0 520 220'}
      role="img"
      aria-label={`${optical ? 'Scope view' : 'Outside view of fluid reservoir'}. ${status}. Fluid remaining ${Math.round(fluid.remaining * 100)} percent.`}
      data-bench-fluid={optical ? 'optical' : 'outside'}
      data-fluid-remaining={fluid.remaining.toFixed(3)}
      data-fluid-submerged={fluid.submerged}
      data-fluid-aspirating={fluid.aspirating}
      style={{
        position: overlay ? 'absolute' : 'relative',
        inset: overlay ? 0 : undefined,
        display: 'block',
        width: '100%',
        height: '100%',
        zIndex: 1,
        background: optical ? '#061119' : '#e5edef',
      }}
    >
      <defs>
        <radialGradient id={`${id}-liquid`}>
          <stop stopColor="#77dce6" />
          <stop offset="1" stopColor="#165875" />
        </radialGradient>
        <linearGradient id={`${id}-shaft`}>
          <stop stopColor="#111e28" />
          <stop offset="0.45" stopColor="#677b88" />
          <stop offset="0.65" stopColor="#263944" />
          <stop offset="1" stopColor="#111e28" />
        </linearGradient>
        <clipPath id={`${id}-circle`}>
          <circle cx="200" cy="142" r="109" />
        </clipPath>
      </defs>
      {optical ? (
        <>
          <circle cx="200" cy="142" r="114" fill="#253844" />
          <g clipPath={`url(#${id}-circle)`}>
            <circle
              cx="200"
              cy="142"
              r="109"
              fill={fluid.submerged ? `url(#${id}-liquid)` : '#bbcdd2'}
            />
            {!fluid.submerged ? (
              <ellipse cx="200" cy="170" rx="110" ry="68" fill={`url(#${id}-liquid)`} />
            ) : null}
            {[
              [-54, -40],
              [40, 32],
              [-27, 57],
              [62, -32],
              [4, -12],
            ].map(([x, y], i) => {
              const progress = fluid.aspirating ? (state.signals.clockSec * 0.8 + i * 0.17) % 1 : 0
              return (
                <circle
                  key={i}
                  cx={200 + x * (1 - progress)}
                  cy={142 + y * (1 - progress)}
                  r={8 * (1 - progress) + 2}
                  fill="none"
                  stroke="#d4f9fc"
                  strokeWidth="2"
                  opacity={fluid.submerged ? 0.75 : 0.3}
                />
              )
            })}
          </g>
          <text x="200" y="279" textAnchor="middle" fill="#e5f5f8" fontSize="13">
            {status}
          </text>
        </>
      ) : (
        <>
          <text x="18" y="24" fill="#203944" fontSize="14" fontWeight="600">
            Fluid reservoir · side view
          </text>
          <path
            d="M148 47 V177 Q148 186 158 186 H332 Q342 186 342 177 V47"
            fill="#f8fbfc"
            stroke="#6e939f"
            strokeWidth="3"
          />
          <rect
            x="151"
            y={surfaceY}
            width="188"
            height={Math.max(0, 182 - surfaceY)}
            fill="#45b9d0"
            opacity="0.68"
          />
          <path
            d={`M152 ${surfaceY} Q200 ${surfaceY - 3} 244 ${surfaceY} T338 ${surfaceY}`}
            fill="none"
            stroke="#14798c"
            strokeWidth="2"
          />
          <rect
            x="224"
            y="35"
            width="25"
            height={Math.max(1, tipY - 35)}
            rx="4"
            fill={`url(#${id}-shaft)`}
          />
          <path
            d={`M237 39 V${tipY - 2}`}
            stroke={fluid.aspirating ? '#83e5ed' : '#0b1821'}
            strokeWidth="5"
          />
          <ellipse cx="237" cy={tipY} rx="12" ry="4" fill="#152733" />
          <ellipse cx="237" cy={tipY} rx="4" ry="2" fill="#8ce6eb" />
          {fluid.aspirating
            ? [0, 1, 2].map((i) => {
                const y = tipY - ((state.signals.clockSec * 25 + i * 21) % Math.max(1, tipY - 40))
                return (
                  <path
                    key={i}
                    d={`M233 ${y + 3} l4 -5 l4 5`}
                    fill="none"
                    stroke="#ddffff"
                    strokeWidth="2"
                  />
                )
              })
            : null}
          <path d={`M249 ${tipY} H369`} fill="none" stroke="#476b77" />
          <text x="375" y={tipY + 4} fill="#254651" fontSize="13">
            Tip
          </text>
          <text x="18" y="209" fill="#254651" fontSize="13">
            {status}
          </text>
        </>
      )}
    </svg>
  )
}
