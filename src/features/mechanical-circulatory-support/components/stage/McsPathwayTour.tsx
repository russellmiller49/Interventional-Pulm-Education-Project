'use client'
import { useState } from 'react'
import { mcsComparisonPathways } from '../teaching/selectors'
import type { McsPathwayView } from '../teaching/selectors'
import styles from './mcs-flow.module.css'

export function McsPathwayTour() {
  const [index, setIndex] = useState(0)
  const paths = [
    mcsComparisonPathways.iabp,
    mcsComparisonPathways.impellaLeft,
    mcsComparisonPathways.lvad,
  ]
  return (
    <section className={styles.tour} data-annotated-pathway-comparison>
      <p>
        Conceptual pathway reference · changing this drawing does not select a device in the
        patient.
      </p>
      <nav aria-label="Study one support pathway at a time">
        {['IABP', 'LV-to-aorta microaxial pump', 'Existing durable LVAD'].map((label, i) => (
          <button type="button" key={label} aria-pressed={index === i} onClick={() => setIndex(i)}>
            {label}
          </button>
        ))}
      </nav>
      <McsCirculationSketch device={index === 0 ? 'iabp' : index === 1 ? 'impella' : 'lvad'} />
      <PathwayAccount pathway={paths[index]} />
      <p>
        The lungs and native right-sided delivery remain necessary. No device here oxygenates blood.
        These are different support mechanisms; durable implantation and candidacy are separate
        clinical decisions.
      </p>
      <details>
        <summary>Compare the three pathways after studying each</summary>
        {paths.map((pathway) => (
          <PathwayAccount key={pathway.id} pathway={pathway} />
        ))}
      </details>
    </section>
  )
}

export function McsCirculationSketch({
  device = 'native',
}: {
  device?: 'native' | 'iabp' | 'impella' | 'lvad'
}) {
  return (
    <figure>
      <svg
        viewBox="0 0 620 255"
        className={styles.cutaway}
        role="img"
        aria-label={`Conceptual circulation: veins to right heart to lungs to left ventricle to aorta. ${device === 'native' ? 'Unsupported conceptual route, not a simulated patient baseline.' : device === 'iabp' ? 'Balloon acts within the descending aorta without a separate pump-flow route.' : device === 'impella' ? 'Pump inlet in the left ventricle and outlet in the aorta, parallel to native ejection.' : 'Apical inflow and graft to the ascending aorta, parallel to native ejection.'}`}
      >
        <defs>
          <marker
            id={`flow-${device}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 Z" fill="#71e1e5" />
          </marker>
        </defs>
        {[
          ['Veins', 20],
          ['Right heart', 135],
          ['Lungs', 250],
          ['LV', 365],
          ['Aorta', 480],
        ].map(([label, x]) => (
          <g key={label}>
            <rect
              x={Number(x)}
              y="95"
              width="100"
              height="65"
              rx="24"
              fill="#17343a"
              stroke="#b8cccf"
            />
            <text x={Number(x) + 50} y="131" textAnchor="middle" fill="#eaf4f4" fontSize="15">
              {label}
            </text>
          </g>
        ))}
        {[120, 235, 350, 465].map((x) => (
          <path
            key={x}
            d={`M${x} 127 h15`}
            stroke="#71e1e5"
            strokeWidth="3"
            markerEnd={`url(#flow-${device})`}
          />
        ))}
        <path
          d="M530 160 V215 H70 V160"
          stroke="#71e1e5"
          fill="none"
          strokeWidth="2"
          markerEnd={`url(#flow-${device})`}
        />
        <text x="290" y="239" textAnchor="middle" fill="#b8cccf" fontSize="14">
          Body → venous return
        </text>
        {device === 'iabp' ? (
          <>
            <ellipse cx="560" cy="186" rx="9" ry="20" fill="#ffbf62" />
            <text x="425" y="190" fill="#ffbf62" fontSize="14">
              Aortic balloon
            </text>
          </>
        ) : null}
        {device === 'impella' || device === 'lvad' ? (
          <>
            <path
              d="M415 95 V48 H530 V95"
              fill="none"
              stroke="#ffbf62"
              strokeWidth="5"
              markerEnd={`url(#flow-${device})`}
            />
            <text x="415" y="30" fill="#ffbf62" fontSize="14">
              {device === 'lvad' ? 'Apical inflow → graft' : 'LV inlet → aortic outlet'}
            </text>
          </>
        ) : null}
      </svg>
      <figcaption>
        Conceptual{' '}
        {device === 'native'
          ? 'unsupported circulation; no normal-patient engine or baseline readings are implied'
          : 'support pathway; schematic anatomy, not positioning guidance'}
        . Solid arrows show blood flow. Catheter insertion is not depicted.
      </figcaption>
    </figure>
  )
}

function PathwayAccount({ pathway }: { pathway: McsPathwayView }) {
  return (
    <dl className={styles.readings} data-pathway={pathway.id}>
      <div>
        <dt>Where it acts</dt>
        <dd>{pathway.activeComponent}</dd>
      </div>
      <div>
        <dt>Blood enters / leaves</dt>
        <dd>
          {pathway.source} → {pathway.destination}
        </dd>
      </div>
      <div>
        <dt>Relation to native flow</dt>
        <dd>{pathway.relationshipLabel}</dd>
      </div>
    </dl>
  )
}
