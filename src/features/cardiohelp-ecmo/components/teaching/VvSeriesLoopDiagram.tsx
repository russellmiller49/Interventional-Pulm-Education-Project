import { useId } from 'react'

import styles from './ConceptDiagrams.module.css'

/*
 * The seven stages the section already teaches in words (VvSeriesPhysiologyPanel `seriesStages`),
 * drawn as the loop they form. Positions are a teaching layout in the drawing's own units, not
 * anatomy. `role` separates the ECMO circuit from the patient's own circulation.
 */
const NODES = [
  {
    id: 'systemic-venous-return',
    lines: ['Systemic venous', 'return'],
    x: 12,
    y: 20,
    role: 'patient',
  },
  { id: 'drainage', lines: ['Drainage limb'], x: 190, y: 20, role: 'circuit' },
  { id: 'oxygenator', lines: ['Membrane lung'], x: 368, y: 20, role: 'circuit' },
  {
    id: 'venous-return-to-patient',
    lines: ['Return to the', 'venous system'],
    x: 368,
    y: 128,
    role: 'circuit',
  },
  { id: 'right-heart', lines: ['Right heart'], x: 368, y: 236, role: 'patient' },
  { id: 'native-lung', lines: ['Native lungs'], x: 190, y: 236, role: 'patient' },
  {
    id: 'left-heart-systemic',
    lines: ['Left heart and', 'systemic circulation'],
    x: 12,
    y: 236,
    role: 'patient',
  },
] as const

const NODE_WIDTH = 160
const NODE_HEIGHT = 44

const ARROWS = [
  { d: 'M172 42 H188', role: 'patient' },
  { d: 'M350 42 H366', role: 'circuit' },
  { d: 'M448 64 V126', role: 'circuit' },
  { d: 'M448 172 V234', role: 'patient' },
  { d: 'M368 258 H352', role: 'patient' },
  { d: 'M190 258 H174', role: 'patient' },
  { d: 'M92 236 V66', role: 'patient' },
] as const

/**
 * The VV series loop, drawn (S6-1).
 *
 * A fellow walkthrough found this section's central idea — venous return, drainage, membrane, return,
 * right heart, native lungs, left heart, with a short-circuit from the return back into the drainage —
 * only as a seven-item list. This draws that same loop from the same stages, with the short-circuit
 * as its own dashed path. It is a schematic of order and of what sits in series with what: not
 * anatomy, not to scale, and it shows no recirculation fraction or flow.
 */
export function VvSeriesLoopDiagram() {
  const id = useId()
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  const marker = (name: string) => `${id}-${name}`.replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <figure className={styles.figure} data-concept-diagram="vv-series-loop">
      <div className={styles.header}>
        <p className={styles.title}>The loop the VV circuit sits inside</p>
        <span className={styles.schematicBadge} data-schematic-label>
          Schematic · not to scale
        </span>
      </div>
      <div className={styles.drawing}>
        <svg viewBox="0 0 540 300" role="img" aria-labelledby={`${titleId} ${descId}`}>
          <title id={titleId}>VV ECMO in series with the patient&apos;s circulation</title>
          <desc id={descId}>
            Systemic venous return is drained into the circuit, crosses the membrane lung and is
            returned to the venous system. From there the patient&apos;s own right heart moves it
            through the native lungs to the left heart and the systemic circulation, and back as
            venous return. A dashed short-circuit runs from the return back into the drainage:
            recirculation, returned blood drained again before it reaches the right heart. A
            schematic of order, not anatomy, and not to scale.
          </desc>
          <defs>
            {(
              [
                ['circuit', styles.markerCircuit],
                ['patient', styles.markerPatient],
                ['recirculation', styles.markerRecirculation],
              ] as const
            ).map(([name, className]) => (
              <marker
                key={name}
                id={marker(name)}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M0 0 L0 8 L7 4 Z" className={className} />
              </marker>
            ))}
          </defs>
          {NODES.map((node) => (
            <g
              key={node.id}
              className={styles.node}
              data-role={node.role}
              data-series-node={node.id}
            >
              <rect x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx="10" />
              {node.lines.map((line, index) => (
                <text
                  key={line}
                  x={node.x + NODE_WIDTH / 2}
                  y={node.y + (node.lines.length === 1 ? 27 : 19 + index * 15)}
                  textAnchor="middle"
                >
                  {line}
                </text>
              ))}
            </g>
          ))}
          {ARROWS.map((arrow) => (
            <path
              key={arrow.d}
              d={arrow.d}
              className={styles.arrow}
              data-role={arrow.role}
              markerEnd={`url(#${marker(arrow.role)})`}
            />
          ))}
          <path
            d="M368 146 C318 146 272 120 270 68"
            className={styles.arrow}
            data-role="recirculation"
            data-recirculation-path
            markerEnd={`url(#${marker('recirculation')})`}
          />
          <text x="258" y="140" textAnchor="end" className={styles.quiet}>
            Recirculation:
          </text>
          <text x="258" y="155" textAnchor="end" className={styles.quiet}>
            returned blood
          </text>
          <text x="258" y="170" textAnchor="end" className={styles.quiet}>
            drained again
          </text>
        </svg>
      </div>
      <ul className={styles.legend} aria-label="Diagram key">
        <li>
          <i data-key="circuit" aria-hidden="true" />
          ECMO circuit
        </li>
        <li>
          <i data-key="patient" aria-hidden="true" />
          The patient&apos;s own circulation
        </li>
        <li>
          <i data-key="recirculation" aria-hidden="true" />
          Recirculation (dashed)
        </li>
      </ul>
      <p className={styles.caveat} data-diagram-boundary>
        A teaching schematic of what sits in series with what, drawn from the stages listed below.
        It is not patient anatomy, not to scale, and shows no flow or recirculated share. A teaching
        adaptation awaiting clinical review.
      </p>
    </figure>
  )
}
