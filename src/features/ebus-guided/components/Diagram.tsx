'use client'
import { useState } from 'react'
import styles from './course.module.css'

/**
 * The course's three drawn schematics. What changed in EBUS-PRE-REVIEW-04, and why:
 *
 * - The five-box "clinical question → result" schematic is gone (OV-1, L1-2, L2-8, L25-5). It
 *   was a second course map beside the real seven chapters, it filled the briefing of four
 *   lessons with the same picture, and selecting one of its labels only lit a numbered box. The
 *   chapter map on the Overview and Learn pages is the one map; those briefings now have no figure.
 * - The specimen boxes are replaced by the running case's own specimens (`CaseSpecimens`), and a
 *   generic transducer sketch in two lessons that were not about acquisition geometry is gone.
 * - The number for each structure now sits beside that structure (L17-5, L16-2). The numbers used
 *   to hang from a row along the bottom edge on long leaders, and two of them crossed.
 * - The caption says what the drawing is and what selecting a name does, in words a learner
 *   uses, and selecting a name really does mark that structure.
 *
 * Nothing is drawn that was not drawn before: no structure is added, moved or named anew. The
 * unlabeled node ovals in the airway drawing stay unlabeled — naming them would be new anatomy.
 */
type Kind = 'ultrasound' | 'stations' | 'needle'
const anchors: Record<Kind, [number, number][]> = {
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
/** Where each number sits: beside its structure, clear of the drawing's other marks. */
const badges: Record<Kind, [number, number][]> = {
  ultrasound: [
    [222, 24],
    [62, 70],
    [132, 232],
    [352, 190],
  ],
  stations: [
    [306, 40],
    [306, 128],
    [112, 214],
    [404, 204],
  ],
  needle: [
    [110, 104],
    [242, 104],
    [337, 104],
    [470, 104],
  ],
}
const labels: Record<Kind, string[]> = {
  ultrasound: ['Transducer', 'Airway wall', 'Ultrasound sector', 'Tissue beyond the wall'],
  stations: ['Trachea', 'Carina', 'Right main bronchus', 'Left main bronchus'],
  needle: ['Scope channel', 'Needle sheath', 'Needle tip', 'Lymph node'],
}
const descriptions: Record<Kind, string> = {
  ultrasound: 'Transducer against the airway wall, with a sector extending into adjacent tissue.',
  stations: 'Trachea dividing into right and left main bronchi, with unlabeled nodes around it.',
  needle: 'Needle and sheath leaving the scope channel toward a lymph node.',
}
export function TeachingDiagram({ kind }: { kind: Kind }) {
  const [active, setActive] = useState<number | null>(null)
  const names = labels[kind]
  return (
    <section className={styles.figure} data-teaching-diagram={kind}>
      <h2>Teaching diagram</h2>
      <p className={styles.muted} data-diagram-caption>
        A schematic drawn for this course, not to scale and not a patient image. Select a name to
        mark it on the drawing.
      </p>
      <svg viewBox="0 0 520 290" role="img" aria-label={descriptions[kind]}>
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
        ) : (
          <>
            <path d="M35 145 H246" stroke="#88a9b5" strokeWidth="30" />
            <path d="M82 145 H339" stroke="#dae7ee" strokeWidth="4" />
            <ellipse cx="386" cy="145" rx="63" ry="46" fill="#728e6b" />
            <path d="M330 145 H399" stroke="#faf5c7" strokeWidth="4" />
          </>
        )}
        {names.map((name, i) => {
          const [x, y] = anchors[kind][i]
          const [bx, by] = badges[kind][i]
          const on = active === i
          return (
            <g key={name} data-diagram-marker={i + 1} data-active={on || undefined}>
              <line
                x1={x}
                y1={y}
                x2={bx}
                y2={by}
                stroke={on ? '#ffff93' : '#8bb3c1'}
                strokeWidth={on ? 3 : 1.5}
              />
              <circle
                cx={x}
                cy={y}
                r={on ? 10 : 4}
                fill="none"
                stroke={on ? '#ffff93' : '#c7e4e5'}
                strokeWidth="2"
              />
              <circle cx={bx} cy={by} r="13" fill={on ? '#ffff93' : '#294b57'} stroke="#c7e4e5" />
              <text
                x={bx}
                y={by + 5}
                textAnchor="middle"
                fill={on ? '#0a2028' : '#eaf6f3'}
                fontSize="13"
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
      <div className={styles.diagramLabels} role="group" aria-label="Structures on the drawing">
        {names.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-pressed={active === i}
            onClick={() => setActive(active === i ? null : i)}
          >
            {i + 1}. {name}
          </button>
        ))}
      </div>
    </section>
  )
}
