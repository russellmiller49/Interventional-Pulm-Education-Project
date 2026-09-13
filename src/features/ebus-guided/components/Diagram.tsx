'use client'
import { useState } from 'react'
import type { Lesson } from '../content/types'
import styles from './course.module.css'
const positions: Record<string, number[][]> = {
  ultrasound: [
    [220, 63],
    [108, 87],
    [168, 203],
    [288, 205],
  ],
  stations: [
    [260, 65],
    [260, 125],
    [161, 217],
    [354, 207],
  ],
  needle: [
    [110, 145],
    [242, 145],
    [337, 145],
    [407, 151],
  ],
}
const labels = {
  workflow: [
    'Clinical question',
    'Preparation',
    'Nodal survey',
    'Tissue sampling',
    'Result and follow-up',
  ],
  ultrasound: ['Transducer', 'Airway wall', 'Ultrasound sector', 'Tissue beyond the wall'],
  stations: ['Trachea', 'Carina', 'Right main bronchus', 'Left main bronchus'],
  needle: ['Scope channel', 'Needle sheath', 'Needle tip', 'Lymph node'],
  specimens: ['Specimen source', 'Smears / ROSE', 'Cell block', 'Ancillary studies'],
}
export function TeachingDiagram({ kind }: { kind: Lesson['diagram'] }) {
  const [active, setActive] = useState<number | null>(null)
  const names = labels[kind]
  return (
    <section className={styles.figure}>
      <h2>Teaching diagram</h2>
      <p className={styles.muted}>Authored schematic · Select a label to locate it.</p>
      <svg
        viewBox="0 0 520 290"
        role="img"
        aria-label={
          kind === 'ultrasound'
            ? 'Transducer against the airway wall, with a sector extending into adjacent tissue.'
            : kind === 'stations'
              ? 'Trachea dividing into right and left main bronchi.'
              : 'Schematic relationships for ' + kind
        }
      >
        <rect width="520" height="290" rx="18" fill="#0a2028" />
        {kind === 'ultrasound' ? (
          <>
            <path d="M50 105 Q260 30 465 100" fill="none" stroke="#ab697d" strokeWidth="23" />
            <path
              d="M245 87 L80 257 Q260 294 444 254 Z"
              fill="#4c9293"
              opacity=".3"
              stroke="#68d8d0"
            />
            <rect x="175" y="51" width="98" height="24" rx="9" fill="#95bdd2" />
            <ellipse cx="285" cy="205" rx="52" ry="28" fill="#a1b57c" />
            <text x="25" y="38" fill="#a3bec9" fontSize="14">
              Airway lumen
            </text>
          </>
        ) : kind === 'stations' ? (
          <>
            <path d="M260 24 V125" fill="none" stroke="#947986" strokeWidth="30" />
            <path
              d="M260 125 L125 246 M260 125 L409 246"
              fill="none"
              stroke="#947986"
              strokeWidth="30"
            />
            {[
              [218, 80],
              [304, 80],
              [257, 182],
              [170, 209],
              [357, 207],
            ].map(([x, y], i) => (
              <ellipse key={i} cx={x} cy={y} rx="14" ry="21" fill="#b3c28b" />
            ))}
          </>
        ) : kind === 'needle' ? (
          <>
            <path d="M35 145 H246" stroke="#88a9b5" strokeWidth="30" />
            <path d="M82 145 H339" stroke="#dae7ee" strokeWidth="4" />
            <ellipse cx="386" cy="145" rx="63" ry="46" fill="#728e6b" />
            <path d="M330 145 H399" stroke="#faf5c7" strokeWidth="4" />
          </>
        ) : (
          <>
            {names.map((name, i) => (
              <g key={name}>
                <rect
                  x={25 + i * 99}
                  y={100}
                  width="85"
                  height="78"
                  rx="12"
                  fill={active === i ? '#236f72' : '#21414f'}
                  stroke="#72d5d4"
                />
                {i < names.length - 1 && (
                  <path d={'M' + (111 + i * 99) + ' 140 h12'} stroke="#72d5d4" strokeWidth="2" />
                )}
                <text x={67 + i * 99} y="147" textAnchor="middle" fill="#e8f4f2" fontSize="24">
                  {i + 1}
                </text>
              </g>
            ))}
          </>
        )}
        {positions[kind] &&
          names.map((name, i) => {
            const [x, y] = positions[kind][i]
            return (
              <g key={name}>
                <line
                  x1={x}
                  y1={y}
                  x2={50 + i * 137}
                  y2={265}
                  stroke={active === i ? '#ffff93' : '#8bb3c1'}
                  strokeWidth={active === i ? 3 : 1}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={active === i ? 12 : 5}
                  fill="none"
                  stroke={active === i ? '#ffff93' : '#c7e4e5'}
                  strokeWidth="2"
                />
                <circle
                  cx={50 + i * 137}
                  cy={265}
                  r="13"
                  fill={active === i ? '#ffff93' : '#294b57'}
                />
                <text
                  x={50 + i * 137}
                  y={270}
                  textAnchor="middle"
                  fill={active === i ? '#0a2028' : '#eaf6f3'}
                  fontSize="13"
                >
                  {i + 1}
                </text>
              </g>
            )
          })}
      </svg>
      <div className={styles.diagramLabels}>
        {names.map((name, i) => (
          <button key={name} type="button" aria-pressed={active === i} onClick={() => setActive(i)}>
            {i + 1}. {name}
          </button>
        ))}
      </div>
    </section>
  )
}
