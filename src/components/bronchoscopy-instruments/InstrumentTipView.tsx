import { useId } from 'react'

import { REACH_MM, TARGET_MM, needleInTarget, type LabState } from './instrument-model'

/**
 * The scope tip and one accessory, seen from the side in a cut-away airway. Everything is drawn in
 * millimetres along the channel axis, so the catheter, the cups, the brush and the needle move as
 * the model says, not as a loop of frames.
 */

const S = 13 // px per mm
const TIP_X = 170
const AXIS_Y = 150
const x = (mm: number) => TIP_X + S * mm
const TARGET_X = x(TARGET_MM)

export function InstrumentTipView({
  state,
  targetLabel,
}: {
  readonly state: LabState
  readonly targetLabel: string
}) {
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${uid}-${name}`
  const tipX = x(state.outMm)
  const needleTarget = state.instrument === 'needle'
  return (
    <svg
      viewBox="0 0 640 290"
      role="img"
      aria-label={describe(state, targetLabel)}
      className="block h-auto w-full"
    >
      <defs>
        <linearGradient id={id('metal')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.45" stopColor="#c3cbd2" />
          <stop offset="1" stopColor="#7e8a94" />
        </linearGradient>
        <linearGradient id={id('scope')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a5560" />
          <stop offset="0.35" stopColor="#2b333b" />
          <stop offset="1" stopColor="#151a1f" />
        </linearGradient>
        <linearGradient id={id('mucosa')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f1b8b0" />
          <stop offset="1" stopColor="#e39a92" />
        </linearGradient>
        <radialGradient id={id('lesion')} cx="0.35" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#e7958d" />
          <stop offset="0.7" stopColor="#c9625c" />
          <stop offset="1" stopColor="#a8473f" />
        </radialGradient>
        <radialGradient id={id('node')} cx="0.4" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#b9a6c9" />
          <stop offset="1" stopColor="#7d6893" />
        </radialGradient>
        <linearGradient id={id('lumen')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fbf4ef" />
          <stop offset="1" stopColor="#f4e3db" />
        </linearGradient>
        <pattern id={id('coil')} width="7" height="26" patternUnits="userSpaceOnUse">
          <rect width="7" height="26" fill="#2f7a5c" />
          <path d="M0 0 L7 26" stroke="#4f9e7c" strokeWidth="2.2" />
          <path d="M-3.5 13 L3.5 39 M3.5 -13 L10.5 13" stroke="#1f5a43" strokeWidth="0.8" />
        </pattern>
        <clipPath id={id('beyond-tip')}>
          <rect x={TIP_X} y="0" width="640" height="290" />
        </clipPath>
        <clipPath id={id('beyond-sheath')}>
          <rect x={tipX} y="0" width="640" height="290" />
        </clipPath>
        <clipPath id={id('lumen-clip')}>
          <rect x="0" y="40" width="640" height="220" />
        </clipPath>
      </defs>

      {/* The airway: lumen, then the wall above and below. */}
      <rect x="0" y="40" width="640" height="220" fill={`url(#${id('lumen')})`} />
      <Wall y={14} flip={false} mucosa={id('mucosa')} />
      <Wall y={260} flip mucosa={id('mucosa')} />

      {/* What lies ahead of the scope: a plaque on the wall, or a node beyond it. */}
      {needleTarget ? (
        <g clipPath={`url(#${id('lumen-clip')})`}>
          <rect x={TARGET_X} y="40" width={640 - TARGET_X} height="220" fill="#f6d6cf" />
          <rect x={TARGET_X} y="40" width="9" height="220" fill={`url(#${id('mucosa')})`} />
          <rect x={TARGET_X + 16} y="62" width="14" height="64" rx="7" fill="#dfe7ee" />
          <rect x={TARGET_X + 16} y="174" width="14" height="64" rx="7" fill="#dfe7ee" />
          <ellipse
            cx={TARGET_X + 105}
            cy={AXIS_Y}
            rx="70"
            ry="52"
            fill={`url(#${id('node')})`}
            stroke="#6a5680"
            strokeWidth="1.5"
          />
          {state.memory.specimen ? (
            <circle cx={x(TARGET_MM + 1)} cy={AXIS_Y} r="3" fill="#9b2f2f" opacity="0.7" />
          ) : null}
        </g>
      ) : (
        <g clipPath={`url(#${id('lumen-clip')})`}>
          <path
            d={`M640 40 L${TARGET_X + 70} 40 Q${TARGET_X + 40} 70 ${TARGET_X + 22} 100 Q${TARGET_X - 4} 128 ${TARGET_X} ${AXIS_Y} Q${TARGET_X - 4} 172 ${TARGET_X + 22} 200 Q${TARGET_X + 40} 230 ${TARGET_X + 70} 260 L640 260 Z`}
            fill={`url(#${id('lesion')})`}
            stroke="#9c3f38"
            strokeWidth="1.2"
          />
          {[118, 136, 166, 183].map((cy, index) => (
            <circle
              key={cy}
              cx={TARGET_X + 18 + (index % 2) * 9}
              cy={cy}
              r="2.4"
              fill="#f0b0a8"
              opacity="0.8"
            />
          ))}
          {state.instrument === 'forceps' && (state.memory.specimen || state.memory.lost) ? (
            <path
              d={`M${TARGET_X - 1} ${AXIS_Y - 9} Q${TARGET_X + 12} ${AXIS_Y} ${TARGET_X - 1} ${AXIS_Y + 9}`}
              fill="#f6d2cc"
              stroke="#b8544c"
              strokeWidth="1"
            />
          ) : null}
          {state.instrument === 'brush' && state.memory.passes > 0 ? (
            <path
              d={`M${TARGET_X + 2} ${AXIS_Y - 22} Q${TARGET_X - 3} ${AXIS_Y} ${TARGET_X + 2} ${AXIS_Y + 22}`}
              fill="none"
              stroke="#f7c9c2"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.9"
            />
          ) : null}
        </g>
      )}

      {/* The scope: body, its working channel, and the tip face. */}
      <rect x="-20" y="98" width={TIP_X + 20} height="70" rx="8" fill={`url(#${id('scope')})`} />
      <rect x="-20" y="137" width={TIP_X + 20} height="26" fill="#39434c" />
      {[40, 88, 136].map((bx) => (
        <rect key={bx} x={bx} y="98" width="3" height="70" fill="#0e1216" opacity="0.6" />
      ))}

      {/* The accessory, drawn over the channel; the part still inside the scope is shaded. */}
      <g>
        {state.instrument === 'forceps' ? (
          <Forceps tipX={tipX} control={state.control} specimen={state.memory.specimen} id={id} />
        ) : state.instrument === 'brush' ? (
          <Brush tipX={tipX} control={state.control} cells={state.memory.passes > 0} id={id} />
        ) : (
          <Needle
            tipX={tipX}
            control={state.control}
            aspirating={state.suction && needleInTarget(state)}
            specimen={state.memory.specimen}
            id={id}
          />
        )}
      </g>
      <rect x="-20" y="137" width={TIP_X + 20} height="26" fill="#11161a" opacity="0.5" />
      <rect
        x={TIP_X - 12}
        y="98"
        width="12"
        height="70"
        fill={`url(#${id('metal')})`}
        opacity="0.85"
      />
      <rect x={TIP_X - 1} y="98" width="3" height="70" rx="1.5" fill="#0b0f12" />
      <ellipse cx={TIP_X} cy="112" rx="2.5" ry="7" fill="#b9e3ff" opacity="0.9" />
      <ellipse cx={TIP_X} cy="127" rx="2" ry="4" fill="#fff6c8" opacity="0.9" />
      <ellipse cx={TIP_X} cy="102" rx="2" ry="3" fill="#fff6c8" opacity="0.8" />

      {/* Labels. */}
      <g fontSize="11" fill="#3f4d57" fontFamily="inherit">
        <text x="16" y="88">
          Scope
        </text>
        <text x="16" y="185" fill="#cfd8de">
          Working channel
        </text>
        <text x={needleTarget ? TARGET_X + 70 : TARGET_X + 36} y={needleTarget ? 92 : 62}>
          {targetLabel}
        </text>
        {needleTarget ? (
          <text x={TARGET_X - 4} y="276" textAnchor="middle">
            Airway wall
          </text>
        ) : null}
      </g>
    </svg>
  )
}

function Wall({ y, flip, mucosa }: { y: number; flip: boolean; mucosa: string }) {
  const band = flip ? { mucosaY: y, tissueY: y + 6 } : { mucosaY: y + 20, tissueY: y }
  return (
    <g>
      <rect x="0" y={band.tissueY} width="640" height="20" fill="#f6d6cf" />
      <rect x="0" y={band.mucosaY} width="640" height="6" fill={`url(#${mucosa})`} />
      {[30, 130, 230, 330, 430, 530].map((cx) => (
        <rect
          key={cx}
          x={cx}
          y={flip ? y + 8 : y + 2}
          width="58"
          height="10"
          rx="5"
          fill="#dfe7ee"
        />
      ))}
    </g>
  )
}

function Forceps({
  tipX,
  control,
  specimen,
  id,
}: {
  tipX: number
  control: number
  specimen: boolean
  id: (name: string) => string
}) {
  const angle = control * 40
  const pivotX = tipX + 16
  const cup =
    'M0 0 L4 -10 Q18 -15 33 -11 Q42 -7 41 -1 L41 0 L37 -2 L33 0 L29 -2 L25 0 L21 -2 L17 0 L13 -2 L9 0 Z'
  return (
    <g>
      <rect x="-40" y={AXIS_Y - 12} width={tipX + 40} height="24" fill={`url(#${id('coil')})`} />
      <rect x={tipX} y={AXIS_Y - 9} width="18" height="18" rx="4" fill={`url(#${id('metal')})`} />
      <g transform={`translate(${pivotX} ${AXIS_Y})`}>
        {specimen && control < 0.3 ? (
          <ellipse cx="22" cy="0" rx="13" ry="5" fill="#cf6b63" />
        ) : null}
        <g transform={`rotate(${-angle})`}>
          <path d={cup} fill={`url(#${id('metal')})`} stroke="#6d7880" strokeWidth="0.8" />
          <ellipse cx="22" cy="-7" rx="5" ry="2" fill="#5b666f" />
        </g>
        <g transform={`scale(1 -1) rotate(${-angle})`}>
          <path d={cup} fill={`url(#${id('metal')})`} stroke="#6d7880" strokeWidth="0.8" />
          <ellipse cx="22" cy="-7" rx="5" ry="2" fill="#5b666f" />
        </g>
        <circle r="3" fill="#59646c" />
      </g>
    </g>
  )
}

function Brush({
  tipX,
  control,
  cells,
  id,
}: {
  tipX: number
  control: number
  cells: boolean
  id: (name: string) => string
}) {
  const end = tipX + S * REACH_MM.brush * control
  const zoneStart = end - S * 8
  const bristles = []
  for (let bx = zoneStart; bx <= end - 4; bx += 3.2) {
    const long = Math.round((bx - zoneStart) / 3.2) % 2 === 0
    bristles.push(
      <line
        key={bx}
        x1={bx}
        y1={AXIS_Y - (long ? 19 : 15)}
        x2={bx + 2}
        y2={AXIS_Y + (long ? 19 : 15)}
        stroke="#f8f7f0"
        strokeWidth="1.4"
      />,
    )
  }
  return (
    <g>
      <g clipPath={`url(#${id('beyond-sheath')})`}>
        <line x1={tipX - 10} y1={AXIS_Y} x2={end} y2={AXIS_Y} stroke="#9aa4ac" strokeWidth="3" />
        <g stroke="#c9c8bc" strokeWidth="0.5">
          {bristles}
        </g>
        <path
          d={`M${zoneStart} ${AXIS_Y} ${Array.from({ length: 12 }, (_, i) => `L${zoneStart + ((end - zoneStart) * (i + 0.5)) / 12} ${AXIS_Y + (i % 2 ? 2 : -2)}`).join(' ')} L${end} ${AXIS_Y}`}
          fill="none"
          stroke="#7d878f"
          strokeWidth="2"
        />
        {cells
          ? [0.2, 0.35, 0.5, 0.62, 0.78].map((f, i) => (
              <circle
                key={f}
                cx={zoneStart + (end - zoneStart) * f}
                cy={AXIS_Y + (i % 2 ? 9 : -10)}
                r="2.4"
                fill="#c4625b"
              />
            ))
          : null}
        <circle
          cx={end}
          cy={AXIS_Y}
          r="4.5"
          fill={`url(#${id('metal')})`}
          stroke="#6d7880"
          strokeWidth="0.6"
        />
      </g>
      <rect
        x="-40"
        y={AXIS_Y - 11}
        width={tipX + 40}
        height="22"
        rx="3"
        fill="#e6edf1"
        stroke="#aebbc4"
        strokeWidth="1"
        opacity="0.92"
      />
    </g>
  )
}

function Needle({
  tipX,
  control,
  aspirating,
  specimen,
  id,
}: {
  tipX: number
  control: number
  aspirating: boolean
  specimen: boolean
  id: (name: string) => string
}) {
  const end = tipX + S * REACH_MM.needle * control
  return (
    <g>
      <g clipPath={`url(#${id('beyond-sheath')})`}>
        <rect
          x={tipX - 20}
          y={AXIS_Y - 3.5}
          width={end - tipX + 20}
          height="7"
          fill={`url(#${id('metal')})`}
        />
        <path
          d={`M${end} ${AXIS_Y - 3.5} L${end + 9} ${AXIS_Y + 3.5} L${end} ${AXIS_Y + 3.5} Z`}
          fill="#c3cbd2"
        />
        {specimen ? (
          <rect
            x={Math.max(tipX, end - 40)}
            y={AXIS_Y - 1.4}
            width={Math.min(40, end - tipX)}
            height="2.8"
            fill="#a23b3b"
          />
        ) : null}
        {aspirating
          ? [0, 1, 2].map((i) => (
              <circle key={i} cx={end + 10} cy={AXIS_Y} r="2.2" fill="#8d2f2f">
                <animate
                  attributeName="cx"
                  from={end + 22}
                  to={end - 30}
                  dur="0.9s"
                  begin={`${i * 0.3}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))
          : null}
      </g>
      <rect x="-40" y={AXIS_Y - 11} width={tipX + 40} height="22" rx="3" fill="#8d979f" />
      <rect
        x={tipX - 9}
        y={AXIS_Y - 11}
        width="9"
        height="22"
        rx="2"
        fill={`url(#${id('metal')})`}
      />
    </g>
  )
}

function describe(state: LabState, targetLabel: string): string {
  const where =
    state.outMm < 0
      ? 'still inside the working channel'
      : state.outMm >= TARGET_MM - 1.2
        ? `against the ${targetLabel.toLowerCase()}`
        : 'out of the scope tip'
  switch (state.instrument) {
    case 'forceps':
      return `Side view: forceps ${where}, cups ${state.control > 0.6 ? 'open' : state.control > 0.15 ? 'partly open' : 'closed'}${state.memory.specimen ? ', holding a specimen' : ''}.`
    case 'brush':
      return `Side view: brush sheath ${where}, brush ${state.control > 0.6 ? 'out' : state.control > 0.15 ? 'partly out' : 'inside its sheath'}${state.memory.passes > 0 ? ', carrying cells' : ''}.`
    case 'needle':
      return `Side view: needle catheter ${where}, needle ${state.control > 0.6 ? 'out' : state.control > 0.15 ? 'partly out' : 'inside the catheter'}${state.suction ? ', suction on' : ''}.`
  }
}
