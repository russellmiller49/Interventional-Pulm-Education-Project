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

/*
 * What each device view draws, in words — the same words the drawing's accessible name carries, so
 * the picture and the text cannot disagree.
 *
 * The transvalvular pump and the durable pump used to draw one identical bracket from the LV box to
 * the aorta box, differing only in a small label, although the whole point of the comparison is
 * where the blood enters and returns (F12). They now follow the topology the circulation map
 * already draws: the microaxial pump lies across the aortic valve, inlet in the ventricle and
 * outlet in the aorta; the durable pump takes blood from the apex and returns it through a graft
 * that goes around the valve. Conceptual, not to scale, and not positioning guidance.
 */
const SKETCH_DESCRIPTIONS = {
  native:
    'Conceptual circulation: veins to right heart to lungs to left ventricle, across the aortic valve, to the aorta, and back through the body. Unsupported conceptual route, not a simulated patient baseline.',
  iabp: 'Conceptual circulation with a balloon in the descending aorta, on the return side of the loop. The balloon has no inlet, no outlet and no pump-flow route of its own.',
  impella:
    'Conceptual circulation with a microaxial pump lying across the aortic valve: its inlet is inside the left ventricle and its outlet is in the aorta, so it takes blood across the valve, parallel to native ejection.',
  lvad: 'Conceptual circulation with a durable pump: an inflow at the left ventricular apex, the pump outside the heart, and an outflow graft to the aorta that goes around the aortic valve rather than through it, parallel to native ejection.',
} as const

const SKETCH_CAPTIONS = {
  native:
    'unsupported circulation; no normal-patient engine or baseline readings are implied. The two short bars between LV and Aorta mark the aortic valve.',
  iabp: 'support pathway: the balloon sits on the return side of the loop and moves no blood of its own.',
  impella:
    'support pathway: the thick bar is the pump, lying across the aortic valve (the two short bars); the open circle is its inlet in the LV and the filled circle its outlet in the aorta.',
  lvad: 'support pathway: the thick line leaves the bottom of the LV (the apex), passes through the pump (the circle) and returns to the aorta beneath the aortic valve (the two short bars) without crossing it.',
} as const

export function McsCirculationSketch({
  device = 'native',
}: {
  device?: 'native' | 'iabp' | 'impella' | 'lvad'
}) {
  return (
    <figure data-circulation-sketch={device}>
      <svg
        viewBox="0 0 620 255"
        className={styles.cutaway}
        role="img"
        aria-label={SKETCH_DESCRIPTIONS[device]}
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
          <marker
            id={`device-flow-${device}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerUnits="userSpaceOnUse"
            markerWidth="12"
            markerHeight="12"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 Z" fill="#ffbf62" />
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
            <text x={Number(x) + 50} y="122" textAnchor="middle" fill="#eaf4f4" fontSize="15">
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
        {/* The aortic valve, between the LV and the aorta: two short bars, drawn in every view. */}
        <g data-sketch-part="aortic-valve" stroke="#eaf4f4" strokeWidth="3">
          <path d="M469 104 V120 M476 134 V150" />
        </g>
        <text x="472" y="88" textAnchor="middle" fill="#b8cccf" fontSize="12">
          aortic valve
        </text>
        <path
          d="M566 160 V222 H70 V160"
          stroke="#71e1e5"
          fill="none"
          strokeWidth="2"
          markerEnd={`url(#flow-${device})`}
        />
        <text x="290" y="244" textAnchor="middle" fill="#b8cccf" fontSize="14">
          Body → venous return
        </text>
        {device === 'iabp' ? (
          <g data-sketch-part="balloon">
            <ellipse cx="566" cy="191" rx="9" ry="20" fill="#ffbf62" />
            <text x="552" y="196" textAnchor="end" fill="#ffbf62" fontSize="14">
              Balloon in the descending aorta · no pump route
            </text>
          </g>
        ) : null}
        {device === 'impella' ? (
          <g data-sketch-part="transvalvular-pump">
            <path d="M430 146 H520" stroke="#ffbf62" strokeWidth="9" strokeLinecap="round" />
            <circle cx="430" cy="146" r="6" fill="#061519" stroke="#ffbf62" strokeWidth="3" />
            <circle cx="520" cy="146" r="6" fill="#ffbf62" />
            <text x="472" y="30" textAnchor="middle" fill="#ffbf62" fontSize="14">
              Microaxial pump across the aortic valve
            </text>
            <text x="472" y="50" textAnchor="middle" fill="#ffbf62" fontSize="13">
              inlet in the LV → outlet in the aorta
            </text>
          </g>
        ) : null}
        {device === 'lvad' ? (
          <g data-sketch-part="durable-pump">
            <path
              d="M415 160 V190 H520 V166"
              fill="none"
              stroke="#ffbf62"
              strokeWidth="6"
              strokeLinejoin="round"
              markerEnd={`url(#device-flow-${device})`}
            />
            <circle cx="462" cy="190" r="11" fill="#061519" stroke="#ffbf62" strokeWidth="4" />
            <text x="472" y="30" textAnchor="middle" fill="#ffbf62" fontSize="14">
              Apical inflow → pump → outflow graft to the aorta
            </text>
            <text x="472" y="50" textAnchor="middle" fill="#ffbf62" fontSize="13">
              the graft goes around the valve, not through it
            </text>
          </g>
        ) : null}
      </svg>
      <figcaption>
        Conceptual {SKETCH_CAPTIONS[device]} Schematic anatomy, not positioning guidance and not to
        scale. Solid teal arrows show blood flow. Catheter insertion is not depicted.
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
