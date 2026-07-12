import { useId, type ReactNode } from 'react'

import type { StentArchitectureProfile } from '../../engine/learningLabTypes'

interface StentArchitectureFallbackProps {
  caption?: string
  profile: StentArchitectureProfile
  reason?: string
}

function IllustrationFrame({ children }: { children: ReactNode }) {
  return (
    <g>
      <rect x="118" y="48" width="404" height="310" rx="30" fill="#0f1b30" stroke="#334155" />
      <path
        d="M150 203 H490"
        fill="none"
        stroke="#fb7185"
        strokeDasharray="8 12"
        strokeOpacity="0.32"
        strokeWidth="76"
      />
      {children}
    </g>
  )
}

function StuddedSchematic() {
  return (
    <IllustrationFrame>
      <rect
        x="198"
        y="132"
        width="244"
        height="142"
        rx="36"
        fill="#93c5fd"
        fillOpacity="0.28"
        stroke="#7dd3fc"
        strokeWidth="12"
      />
      {Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 3 }, (_, column) => (
          <circle
            key={`${row}-${column}`}
            cx={218 + row * 41}
            cy={150 + column * 52 + (row % 2) * 8}
            r="6"
            fill="#e0f2fe"
            stroke="#0ea5e9"
            strokeWidth="3"
          />
        )),
      )}
    </IllustrationFrame>
  )
}

function DynamicDSchematic() {
  return (
    <IllustrationFrame>
      <path
        d="M206 140 H425 Q453 140 453 168 V238 Q453 266 425 266 H206 Z"
        fill="#5eead4"
        fillOpacity="0.22"
        stroke="#5eead4"
        strokeWidth="10"
      />
      <path d="M206 140 V266" stroke="#fbbf24" strokeDasharray="8 7" strokeWidth="8" />
      {Array.from({ length: 6 }, (_, index) => (
        <path
          key={index}
          d={`M${230 + index * 37} 143 V263`}
          stroke="#2dd4bf"
          strokeOpacity="0.74"
          strokeWidth="5"
        />
      ))}
      <text x="190" y="304" fill="#fde68a" fontSize="14">
        flat posterior segment
      </text>
    </IllustrationFrame>
  )
}

function SiliconeYSchematic() {
  return (
    <IllustrationFrame>
      <path
        d="M320 89 V207 M320 204 C310 237 267 251 228 304 M320 204 C330 237 373 251 412 304"
        fill="none"
        stroke="#bae6fd"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="38"
      />
      <path
        d="M320 89 V207 M320 204 C310 237 267 251 228 304 M320 204 C330 237 373 251 412 304"
        fill="none"
        stroke="#0f1b30"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="21"
      />
      <circle cx="320" cy="213" r="25" fill="none" stroke="#67e8f9" strokeWidth="5" />
    </IllustrationFrame>
  )
}

function BraidSchematic({ captured = false }: { captured?: boolean }) {
  if (captured) {
    const junctions = [
      { cx: 216, hooked: true, x0: 166 },
      { cx: 276, hooked: false, x0: 226 },
      { cx: 336, hooked: true, x0: 286 },
      { cx: 396, hooked: false, x0: 346 },
    ]

    return (
      <IllustrationFrame>
        <rect
          x="188"
          y="122"
          width="264"
          height="162"
          rx="28"
          fill="#e2e8f0"
          fillOpacity="0.11"
          stroke="#64748b"
          strokeDasharray="5 8"
        />
        {junctions.map(({ cx, hooked, x0 }) => (
          <g key={cx}>
            <path
              d={`M${x0 - 2} 126 L${x0 + 102} 278`}
              fill="none"
              stroke="#67e8f9"
              strokeLinecap="round"
              strokeWidth="5"
            />
            <path
              d={
                hooked
                  ? `M${x0} 278 L${cx - 8} 215 C${cx - 15} 207 ${cx - 12} 194 ${cx - 1} 191 C${cx + 10} 188 ${cx + 17} 197 ${cx + 13} 207 C${cx + 9} 217 ${cx - 3} 218 ${cx - 9} 210 C${cx - 13} 204 ${cx - 8} 196 ${cx} 193 L${x0 + 100} 126`
                  : `M${x0} 278 L${x0 + 100} 126`
              }
              fill="none"
              stroke={hooked ? '#fbbf24' : '#dbeafe'}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={hooked ? 6 : 5}
            />
          </g>
        ))}
        <path d="M205 304 L218 218" stroke="#fbbf24" strokeOpacity="0.75" strokeWidth="2" />
        <text x="172" y="322" fill="#fde68a" fontSize="13">
          eye hook
        </text>
        <path d="M397 304 L397 205" stroke="#67e8f9" strokeOpacity="0.72" strokeWidth="2" />
        <text x="380" y="322" fill="#a5f3fc" fontSize="13">
          cross
        </text>
      </IllustrationFrame>
    )
  }

  const lines = Array.from({ length: 7 }, (_, index) => 186 + index * 42)
  return (
    <IllustrationFrame>
      <rect
        x="188"
        y="122"
        width="264"
        height="162"
        rx="28"
        fill="#e2e8f0"
        fillOpacity="0.04"
        stroke="#64748b"
        strokeDasharray="5 8"
      />
      {lines.map((x) => (
        <path
          key={`forward-${x}`}
          d={`M${x - 48} 278 L${x + 54} 126`}
          stroke="#dbeafe"
          strokeLinecap="round"
          strokeWidth="6"
        />
      ))}
      {lines.map((x) => (
        <path
          key={`back-${x}`}
          d={`M${x - 48} 126 L${x + 54} 278`}
          stroke="#67e8f9"
          strokeLinecap="round"
          strokeWidth="5"
        />
      ))}
    </IllustrationFrame>
  )
}

function LaserCutSchematic() {
  return (
    <IllustrationFrame>
      {Array.from({ length: 6 }, (_, row) => {
        const y = 128 + row * 30
        return (
          <path
            key={row}
            d={`M190 ${y} l22 -15 22 15 22 -15 22 15 22 -15 22 15 22 -15 22 15 22 -15 22 15 22 -15 22 15`}
            fill="none"
            stroke="#e2e8f0"
            strokeLinejoin="round"
            strokeWidth="7"
          />
        )
      })}
      {Array.from({ length: 5 }, (_, row) => (
        <path
          key={`connector-${row}`}
          d={`M234 ${128 + row * 30} V${143 + row * 30} M322 ${128 + row * 30} V${143 + row * 30} M410 ${128 + row * 30} V${143 + row * 30}`}
          stroke="#fbbf24"
          strokeWidth="5"
        />
      ))}
    </IllustrationFrame>
  )
}

function KnittedSchematic() {
  const stitchCenters = Array.from({ length: 9 }, (_, index) => 204 + index * 28)
  const upperCourse = stitchCenters
    .map(
      (center) =>
        `C${center - 10} 145 ${center + 3} 140 ${center + 5} 154 ` +
        `C${center + 8} 170 ${center - 7} 184 ${center - 9} 166 ` +
        `C${center - 11} 153 ${center} 146 ${center + 6} 154 ` +
        `C${center + 11} 159 ${center + 11} 167 ${center + 14} 171`,
    )
    .join(' ')
  const lowerCourse = [...stitchCenters]
    .reverse()
    .map(
      (center) =>
        `C${center + 10} 261 ${center - 3} 266 ${center - 5} 252 ` +
        `C${center - 8} 236 ${center + 7} 222 ${center + 9} 240 ` +
        `C${center + 11} 253 ${center} 260 ${center - 6} 252 ` +
        `C${center - 11} 247 ${center - 11} 239 ${center - 14} 235`,
    )
    .join(' ')
  const continuousWire = `M190 171 ${upperCourse} C452 180 452 226 442 235 ${lowerCourse}`

  return (
    <IllustrationFrame>
      <path
        d={continuousWire}
        fill="none"
        stroke="#e2e8f0"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
      />
      <rect
        x="258"
        y="126"
        width="124"
        height="154"
        rx="26"
        fill="#bae6fd"
        fillOpacity="0.2"
        stroke="#7dd3fc"
        strokeOpacity="0.42"
      />
      <path d="M216 304 L216 255" stroke="#67e8f9" strokeOpacity="0.66" strokeWidth="2" />
      <text x="164" y="322" fill="#a5f3fc" fontSize="13">
        exposed loop rows
      </text>
      <text x="284" y="304" fill="#bae6fd" fontSize="13">
        partial mid cover
      </text>
    </IllustrationFrame>
  )
}

function Schematic({ profile }: { profile: StentArchitectureProfile }) {
  switch (profile.geometryBuilder) {
    case 'studded-cylinder':
      return <StuddedSchematic />
    case 'dynamic-d-cylinder':
      return <DynamicDSchematic />
    case 'silicone-y':
      return <SiliconeYSchematic />
    case 'free-crossing-helices':
      return <BraidSchematic />
    case 'hook-cross-captured-helices':
      return <BraidSchematic captured />
    case 'laser-cut-rings':
      return <LaserCutSchematic />
    case 'single-wire-knitted-loops':
      return <KnittedSchematic />
  }
}

/** Accessible, non-WebGL rendering used for reduced capability and GPU failures. */
export function StentArchitectureFallback({
  caption,
  profile,
  reason = 'The interactive 3D view is unavailable in this browser.',
}: StentArchitectureFallbackProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <div className="flex min-h-[500px] flex-col bg-slate-950 p-4 text-white sm:p-6">
      <div className="rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm leading-6 text-amber-100">
        <strong>Static accessible view.</strong> {reason}
      </div>
      <svg
        className="mt-4 min-h-72 w-full flex-1"
        viewBox="0 0 640 420"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>{profile.label} illustrative architecture</title>
        <desc id={descriptionId}>
          Static educational schematic of {profile.topologyDescription}
        </desc>
        <Schematic profile={profile} />
        <text x="320" y="394" textAnchor="middle" fill="#94a3b8" fontSize="13">
          Illustrative topology · not product CAD or a force model
        </text>
      </svg>
      <div className="grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Load path
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{profile.loadPath}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Current interpretation
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {caption ?? 'Unloaded architecture shown for inspection.'}
          </p>
        </div>
      </div>
    </div>
  )
}
