'use client'

import { useId, useState } from 'react'

import styles from './ConceptDiagrams.module.css'

/**
 * Two hand-placed illustrations of where the native stream and the circuit return meet.
 *
 * Neither is computed: this simulation has no mixing-region variable (traced in ECMO-FELLOW-02, VA11-1),
 * and the pack forbids inferring an aortic position from a saturation or from a flow ratio. The
 * states are named by the direction of the balance the existing VA teaching describes — more native
 * ejection relative to circuit flow moves the meeting place further from the aortic root; more
 * circuit flow relative to native ejection moves it back toward the root — and nothing else.
 */
export const VA_MIXING_ILLUSTRATIONS = [
  {
    id: 'native-stronger',
    choice: 'More native ejection relative to circuit flow',
    band: 'distal',
    caption:
      'Illustration A. The mixing region sits further from the aortic root, past the arch branches. In this illustration the arch branches — the right arm and the brain among them — fill from the native side, carrying whatever the native lungs managed to do to that blood, and the lower body fills with circuit blood.',
  },
  {
    id: 'circuit-stronger',
    choice: 'More circuit flow relative to native ejection',
    band: 'proximal',
    caption:
      'Illustration B. The mixing region sits nearer the root, between the coronary origins and the arch branches. In this illustration the arch branches fill with circuit blood while the coronary origins sit on the native side of the region, so the right-radial sample and the coronary supply are being filled from different sides.',
  },
] as const

export type VaMixingIllustrationId = (typeof VA_MIXING_ILLUSTRATIONS)[number]['id']

/*
 * Drawing units: an anterior view, so the patient's right (the right arm, the brachiocephalic
 * trunk, the right coronary) is on the viewer's LEFT, the same convention as the pressure-zone map.
 */
const AORTA = 'M235 300 V170 C235 112 280 92 318 94 C356 96 372 124 372 164 V396'
const BRANCHES = {
  brachiocephalic: 'M252 112 L230 76',
  rightCarotid: 'M230 76 L205 40',
  rightSubclavianToArm: 'M230 76 C190 70 140 74 104 100 L88 146',
  leftCarotid: 'M292 96 L288 40',
  leftSubclavianToArm: 'M334 100 C356 76 400 72 434 98 L450 146',
} as const
const CORONARIES = ['M236 293 C222 293 208 299 198 309', 'M237 293 C251 293 264 299 272 309']

const STREAMS = {
  distal: {
    native: 'M235 292 V170 C235 112 280 92 318 94 C356 96 372 124 372 164 V222',
    circuit: 'M372 390 V252',
    band: { x: 358, y: 226 },
    label: { x: 395, anchor: 'start' as const },
    branches: 'native' as const,
  },
  proximal: {
    native: 'M235 292 V236',
    circuit: 'M372 390 V164 C372 124 356 96 318 94 C280 92 235 112 235 170 V208',
    band: { x: 221, y: 210 },
    label: { x: 212, anchor: 'end' as const },
    branches: 'circuit' as const,
  },
} as const

/**
 * Who fills the aorta in peripheral femoral VA ECMO, drawn (VA6-1, VA7-3), with an optional
 * conceptual comparison of where the two streams meet (VA11-1).
 *
 * The section taught this as a ten-item list under a sentence beginning "This diagram shows" with no
 * diagram, and the only drawing of it — on the pressure-zone map — has a mixing marker that cannot
 * move. This draws the relationships the section already states: the native antegrade stream, the
 * circuit's retrograde return up the descending aorta, the arch branches and the coronary origin at
 * the root, with the right-radial sampling site on the patient's right arm. The learner may switch
 * between two hand-placed illustrations; neither is derived from the values on the page.
 */
export function VaAorticStreamsDiagram({
  comparison = true,
  initialIllustration = 'native-stronger',
}: {
  /** Offer the two-illustration comparison. Without it the drawing shows illustration A. */
  readonly comparison?: boolean
  readonly initialIllustration?: VaMixingIllustrationId
}) {
  const id = useId()
  const [selected, setSelected] = useState<VaMixingIllustrationId>(initialIllustration)
  const illustration =
    VA_MIXING_ILLUSTRATIONS.find((item) => item.id === selected) ?? VA_MIXING_ILLUSTRATIONS[0]
  const streams = STREAMS[illustration.band]
  const marker = (name: string) => `${id}-${name}`.replace(/[^a-zA-Z0-9_-]/g, '')
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  const branchStream = streams.branches
  return (
    <figure
      className={styles.figure}
      data-concept-diagram="va-aortic-streams"
      data-conceptual="true"
      data-illustration-state={illustration.id}
      data-mixing-band-position={illustration.band}
    >
      <div className={styles.header}>
        <p className={styles.title}>Who fills the aorta: two streams, one meeting place</p>
        <span className={styles.schematicBadge} data-schematic-label>
          Schematic · not to scale · conceptual
        </span>
      </div>
      {comparison ? (
        <fieldset className={styles.choices} data-mixing-illustration-choices>
          <legend>Compare two illustrations (chosen by hand, not computed)</legend>
          {VA_MIXING_ILLUSTRATIONS.map((item) => (
            <label key={item.id} className={styles.choice}>
              <input
                type="radio"
                name={`${id}-illustration`}
                value={item.id}
                checked={selected === item.id}
                onChange={() => setSelected(item.id)}
              />
              <span>{item.choice}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className={styles.drawing}>
        <svg viewBox="0 0 540 400" role="img" aria-labelledby={`${titleId} ${descId}`}>
          <title id={titleId}>
            Peripheral femoral VA ECMO: native stream and circuit return in one aorta
          </title>
          <desc id={descId}>
            Anterior view, so the patient&apos;s right is on the left. The left ventricle ejects
            forward up the ascending aorta: the native stream. The circuit returns blood through a
            femoral arterial cannula, backward up the descending aorta. The coronary arteries arise
            at the aortic root, before the arch branches to the head and both arms; the right-radial
            sampling site is on the right arm. {illustration.caption} This is a conceptual drawing:
            the simulation does not calculate where the streams meet.
          </desc>
          <defs>
            <marker
              id={marker('native')}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M0 0 L0 8 L7 4 Z" className={styles.markerNative} />
            </marker>
            <marker
              id={marker('circuit')}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M0 0 L0 8 L7 4 Z" className={styles.markerCircuit} />
            </marker>
          </defs>

          <path d={AORTA} className={styles.vessel} strokeWidth={22} data-vessel="aorta" />
          {Object.entries(BRANCHES).map(([name, d]) => (
            <path key={name} d={d} className={styles.vessel} strokeWidth={9} data-vessel={name} />
          ))}
          {CORONARIES.map((d) => (
            <path key={d} d={d} className={styles.vessel} strokeWidth={5} data-vessel="coronary" />
          ))}
          <ellipse cx="222" cy="345" rx="58" ry="36" className={styles.heart} />

          {/* Which stream reaches the arch branches in this illustration. */}
          {Object.entries(BRANCHES).map(([name, d]) => (
            <path
              key={`stream-${name}`}
              d={d}
              className={styles.stream}
              data-stream={branchStream}
              strokeWidth={3}
            />
          ))}
          {CORONARIES.map((d) => (
            <path
              key={`stream-${d}`}
              d={d}
              className={styles.stream}
              data-stream="native"
              strokeWidth={2.5}
            />
          ))}
          <path
            d={streams.native}
            className={styles.stream}
            data-stream="native"
            markerEnd={`url(#${marker('native')})`}
          />
          <path
            d={streams.circuit}
            className={styles.stream}
            data-stream="circuit"
            markerEnd={`url(#${marker('circuit')})`}
          />
          <rect
            x={streams.band.x}
            y={streams.band.y}
            width="28"
            height="22"
            rx="4"
            className={styles.band}
            data-mixing-band
          />
          <text x={streams.label.x} y={streams.band.y + 10} textAnchor={streams.label.anchor}>
            Mixing region
          </text>
          <text
            x={streams.label.x}
            y={streams.band.y + 24}
            textAnchor={streams.label.anchor}
            className={styles.quiet}
          >
            (illustrative)
          </text>

          <circle cx="88" cy="160" r="13" className={styles.site} data-right-radial-site />
          <text x="22" y="196" className={styles.quiet}>
            Right-radial
          </text>
          <text x="22" y="211" className={styles.quiet}>
            sample site
          </text>
          <text x="270" y="22" textAnchor="middle" className={styles.quiet}>
            Arch branches: head and both arms
          </text>
          <text x="190" y="282" textAnchor="end" className={styles.quiet}>
            Coronary origins
          </text>
          <text x="190" y="297" textAnchor="end" className={styles.quiet}>
            at the aortic root
          </text>
          <text x="262" y="140">
            Aortic arch
          </text>
          <text x="385" y="182" className={styles.quiet}>
            Descending
          </text>
          <text x="385" y="196" className={styles.quiet}>
            aorta
          </text>
          <text x="222" y="350" textAnchor="middle">
            Left ventricle
          </text>
          <text x="385" y="380" className={styles.quiet}>
            Femoral arterial
          </text>
          <text x="385" y="394" className={styles.quiet}>
            return (circuit)
          </text>
        </svg>
      </div>
      <ul className={styles.legend} aria-label="Diagram key">
        <li>
          <i data-key="native" aria-hidden="true" />
          Native stream (solid): ejected by the left ventricle
        </li>
        <li>
          <i data-key="circuit-stream" aria-hidden="true" />
          Circuit return (dashed): from the femoral cannula
        </li>
        <li>
          <i data-key="band" aria-hidden="true" />
          Mixing region, placed by hand
        </li>
      </ul>
      <p className={styles.caption} aria-live="polite" data-illustration-caption>
        {illustration.caption}
      </p>
      <p className={styles.caveat} data-diagram-boundary>
        Colours mark which stream, not how much oxygen it carries. The two positions are drawn by
        hand to show the direction of the shift; neither is computed from this patient&apos;s values
        — this simulation does not calculate where the streams meet. A right-radial value shows what
        reaches the right arm; it does not locate the mixing region or establish what the coronary
        arteries receive. A teaching adaptation awaiting clinical review, not a device or physiology
        validation.
      </p>
    </figure>
  )
}
