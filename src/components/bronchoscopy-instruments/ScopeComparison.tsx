'use client'

import { useState } from 'react'

/**
 * A bronchoscope and a gastrointestinal endoscope side by side: the control body each hand holds,
 * the face of each tip, and a table of sizes. Choosing a feature lights its parts on both scopes and
 * says what each one does with it. Drawings are generic: no model or brand.
 *
 * The rows come from the module that uses it, with its own sources.
 */

export type ScopeFeatureId = 'steering' | 'lock' | 'air' | 'suction' | 'channel'

export interface ScopeComparisonRow {
  readonly id: string
  readonly label: string
  readonly bronchoscope: string
  readonly gastroscope: string
}

export interface ScopeFeature {
  readonly id: ScopeFeatureId
  readonly label: string
  readonly bronchoscope: string
  readonly gastroscope: string
}

export interface ScopeComparisonProps {
  readonly features: readonly ScopeFeature[]
  readonly rows: readonly ScopeComparisonRow[]
  /** One line under the table: where the numbers come from. */
  readonly sourceNote?: string
}

const HIGHLIGHT = '#f2a516'

export function ScopeComparison({ features, rows, sourceNote }: ScopeComparisonProps) {
  const [selected, setSelected] = useState<ScopeFeatureId>(features[0]?.id ?? 'steering')
  const feature = features.find((f) => f.id === selected) ?? features[0]
  const on = (id: ScopeFeatureId) => selected === id
  return (
    <section
      className="grid gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-sm"
      aria-label="Bronchoscope and gastrointestinal endoscope compared"
      data-scope-compare={selected}
    >
      <div role="radiogroup" aria-label="Feature" className="flex flex-wrap gap-2">
        {features.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={on(f.id)}
            onClick={() => setSelected(f.id)}
            className={`rounded-full border px-3 py-1.5 font-semibold transition ${
              on(f.id)
                ? 'border-amber-500 bg-amber-500/15 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ScopeCard
          title="Bronchoscope"
          accent="#2a7fb8"
          handle={<BronchoscopeHandle on={on} />}
          tip={<BronchoscopeTip on={on} />}
          text={feature?.bronchoscope}
        />
        <ScopeCard
          title="Gastrointestinal endoscope"
          accent="#2f8a5a"
          handle={<GastroscopeHandle on={on} />}
          tip={<GastroscopeTip on={on} />}
          text={feature?.gastroscope}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                &nbsp;
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold text-sky-700 dark:text-sky-300">
                Bronchoscope
              </th>
              <th
                scope="col"
                className="py-1.5 font-semibold text-emerald-700 dark:text-emerald-300"
              >
                Gastrointestinal endoscope
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/50 align-top"
                data-compare-row={row.id}
              >
                <th scope="row" className="py-1.5 pr-3 font-semibold">
                  {row.label}
                </th>
                <td className="py-1.5 pr-3">{row.bronchoscope}</td>
                <td className="py-1.5">{row.gastroscope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sourceNote ? <p className="text-xs text-muted-foreground">{sourceNote}</p> : null}
    </section>
  )
}

function ScopeCard({
  title,
  accent,
  handle,
  tip,
  text,
}: {
  title: string
  accent: string
  handle: React.ReactNode
  tip: React.ReactNode
  text?: string
}) {
  return (
    <figure className="m-0 grid gap-2 rounded-lg border border-border/60 bg-white p-2 text-slate-800">
      <figcaption className="text-sm font-bold" style={{ color: accent }}>
        {title}
      </figcaption>
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-2">
        {handle}
        {tip}
      </div>
      <p className="min-h-[3.2em] rounded-md bg-amber-50 px-2 py-1.5 text-[0.82rem] leading-snug text-slate-800">
        {text}
      </p>
    </figure>
  )
}

const part = (lit: boolean) =>
  lit ? { stroke: HIGHLIGHT, strokeWidth: 3.5, filter: 'drop-shadow(0 0 3px #f2a516)' } : {}

function BronchoscopeHandle({ on }: { on: (id: ScopeFeatureId) => boolean }) {
  return (
    <svg
      viewBox="0 0 200 260"
      role="img"
      aria-label="Bronchoscope control body"
      className="h-auto w-full"
    >
      {/* Universal cord and insertion tube. */}
      <path
        d="M70 118 C40 130 22 160 12 200"
        stroke="#2b3138"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M104 214 L110 258" stroke="#2b3138" strokeWidth="7" strokeLinecap="round" />
      {/* Body. */}
      <path d="M78 40 Q100 30 122 40 L128 150 Q118 214 104 216 Q92 214 84 150 Z" fill="#30373e" />
      <rect x="86" y="196" width="34" height="14" rx="4" fill="#3d454d" />
      {/* Thumb lever. */}
      <g style={part(on('steering'))}>
        <path d="M80 70 L52 58" stroke="#59626b" strokeWidth="7" strokeLinecap="round" />
        <circle cx="50" cy="57" r="9" fill="#3b444c" stroke="#59626b" strokeWidth="2" />
      </g>
      {/* Suction button. */}
      <g style={part(on('suction'))}>
        <rect x="94" y="16" width="22" height="22" rx="4" fill="#d6dbe0" stroke="#8b949c" />
        <rect x="98" y="10" width="14" height="8" rx="2" fill="#b7bec5" />
      </g>
      {/* Working-channel port, which also takes the wash. */}
      <g style={part(on('channel'))}>
        <path d="M122 132 L150 118" stroke="#3d454d" strokeWidth="9" strokeLinecap="round" />
        <rect x="146" y="106" width="16" height="16" rx="3" fill="#d6dbe0" stroke="#8b949c" />
      </g>
      <g fontSize="11" fill="#47525c" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
        <text x="6" y="40">
          Thumb lever
        </text>
        <text x="122" y="22">
          Suction
        </text>
        <text x="196" y="146" textAnchor="end">
          Channel port
        </text>
      </g>
      {on('air') || on('lock') ? (
        <text
          x="100"
          y="238"
          fontSize="12"
          textAnchor="middle"
          fill="#a35a00"
          fontWeight="700"
          stroke="#ffffff"
          strokeWidth="4"
          paintOrder="stroke"
        >
          None on this scope
        </text>
      ) : null}
    </svg>
  )
}

function GastroscopeHandle({ on }: { on: (id: ScopeFeatureId) => boolean }) {
  return (
    <svg
      viewBox="0 0 200 260"
      role="img"
      aria-label="Gastrointestinal endoscope control body"
      className="h-auto w-full"
    >
      <path
        d="M66 126 C38 140 22 168 12 206"
        stroke="#2b3138"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M100 222 L104 258" stroke="#2b3138" strokeWidth="9" strokeLinecap="round" />
      <path d="M74 40 Q98 28 122 40 L130 156 Q118 222 100 224 Q86 222 78 156 Z" fill="#30373e" />
      {/* Two steering knobs. */}
      <g style={part(on('steering'))}>
        <circle cx="140" cy="76" r="27" fill="#444d55" stroke="#6b747c" strokeWidth="2" />
        <circle cx="140" cy="76" r="17" fill="#59626b" stroke="#7d868e" strokeWidth="2" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect
            key={a}
            x="137"
            y="45"
            width="6"
            height="9"
            rx="2"
            fill="#6b747c"
            transform={`rotate(${a} 140 76)`}
          />
        ))}
      </g>
      {/* Fixation levers. */}
      <g style={part(on('lock'))}>
        <path d="M140 108 L170 118" stroke="#7d868e" strokeWidth="6" strokeLinecap="round" />
        <path d="M118 60 L164 44" stroke="#7d868e" strokeWidth="4" strokeLinecap="round" />
      </g>
      {/* Air and water button, suction button. */}
      <g style={part(on('air'))}>
        <rect x="86" y="54" width="16" height="16" rx="8" fill="#d6dbe0" stroke="#8b949c" />
      </g>
      <g style={part(on('suction'))}>
        <rect x="86" y="80" width="16" height="16" rx="8" fill="#d6dbe0" stroke="#8b949c" />
      </g>
      {/* Biopsy port. */}
      <g style={part(on('channel'))}>
        <path d="M84 168 L58 182" stroke="#3d454d" strokeWidth="8" strokeLinecap="round" />
        <rect x="44" y="176" width="16" height="14" rx="3" fill="#d6dbe0" stroke="#8b949c" />
      </g>
      <g fontSize="11" fill="#47525c" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
        <text x="150" y="30">
          Knobs
        </text>
        <text x="4" y="62">
          Air / water
        </text>
        <text x="4" y="92">
          Suction
        </text>
        <text x="148" y="136">
          Locks
        </text>
        <text x="4" y="216">
          Biopsy port
        </text>
      </g>
    </svg>
  )
}

function BronchoscopeTip({ on }: { on: (id: ScopeFeatureId) => boolean }) {
  return (
    <svg
      viewBox="0 0 120 130"
      role="img"
      aria-label="Bronchoscope tip face"
      className="h-auto w-full"
    >
      <circle cx="60" cy="60" r="46" fill="#3a4148" stroke="#1d2226" strokeWidth="3" />
      <ellipse cx="60" cy="36" rx="13" ry="8" fill="#cfe9f7" stroke="#7da7bd" />
      <circle cx="30" cy="58" r="7" fill="#ffe14d" />
      <circle cx="90" cy="58" r="7" fill="#ffe14d" />
      <circle cx="60" cy="76" r="17" fill="#0d1013" style={part(on('channel') || on('suction'))} />
      <text x="60" y="124" fontSize="11" textAnchor="middle" fill="#47525c">
        Tip face
      </text>
    </svg>
  )
}

function GastroscopeTip({ on }: { on: (id: ScopeFeatureId) => boolean }) {
  return (
    <svg
      viewBox="0 0 120 130"
      role="img"
      aria-label="Gastrointestinal endoscope tip face"
      className="h-auto w-full"
    >
      <circle cx="60" cy="60" r="52" fill="#3a4148" stroke="#1d2226" strokeWidth="3" />
      <circle cx="40" cy="34" r="9" fill="#e9eef2" />
      <circle cx="40" cy="62" r="11" fill="#cfe9f7" stroke="#7da7bd" />
      <circle cx="55" cy="47" r="3" fill="#2a7fb8" style={part(on('air'))} />
      <path d="M34 82 l12 -4 l-2 12 z" fill="#c3cbd2" style={part(on('air'))} />
      <circle cx="40" cy="98" r="7" fill="#e9eef2" />
      <circle
        cx="80"
        cy="62"
        r="17"
        fill="#0d1013"
        stroke="#2f8a5a"
        strokeWidth="2"
        style={part(on('channel') || on('suction'))}
      />
      <text x="60" y="126" fontSize="11" textAnchor="middle" fill="#47525c">
        Tip face
      </text>
    </svg>
  )
}
