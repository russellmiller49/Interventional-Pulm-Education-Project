'use client'

import { useEffect, useId, useState } from 'react'
import { INDEPENDENT_IMAGE_PANEL_SECTIONS } from '../../content/learningActivities'
import type { ImagingSectionId } from '../../content/pathway'
import { FIELD_CONTEXT, LESION_CENTER, projectToDetector } from '../../lib/physics'
import { collimator, suiteFrame } from '../suite/suiteModel'
import { TimeSamples } from '../suite/views/TimeView'
import { temporal } from '../suite/suiteModel'
import styles from './imaging-stage.module.css'

/** Vector teaching panels, not device captures or a calibrated noise/scatter simulation. */
export function SignalImage({
  factor = 'reference',
  label,
}: {
  factor?: 'reference' | 'noise' | 'contrast' | 'overlap'
  label: string
}) {
  const id = useId().replace(/:/g, '')
  return (
    <figure className={styles.teachingFigure}>
      <figcaption>{label}</figcaption>
      <svg
        viewBox="0 0 240 180"
        role="img"
        aria-label={
          factor === 'noise'
            ? 'Illustration with irregular mottling across the image'
            : factor === 'contrast'
              ? 'Illustration with smooth low contrast and a sharp tool edge'
              : factor === 'overlap'
                ? 'Illustration with a dense silhouette crossing the circular target'
                : 'Reference illustration with distinguishable background structures and a tool'
        }
      >
        <defs>
          <clipPath id={id}>
            <rect width="240" height="180" rx="5" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
          <rect width="240" height="180" fill="#1e2934" />
          <g opacity={factor === 'contrast' ? 0.24 : 1}>
            <ellipse cx="70" cy="92" rx="45" ry="73" fill="#73818a" />
            <ellipse cx="174" cy="92" rx="43" ry="73" fill="#667680" />
            {[40, 65, 90, 115, 140].map((y) => (
              <path
                key={y}
                d={`M20 ${y} Q65 ${y - 26} 110 ${y} M135 ${y} Q180 ${y - 26} 225 ${y}`}
                fill="none"
                stroke="#a7b2b7"
                strokeWidth="4"
                opacity=".4"
              />
            ))}
            <circle cx="173" cy="104" r="13" fill="#cad5d1" />
            {factor === 'overlap' && <ellipse cx="165" cy="116" rx="32" ry="55" fill="#c4ccd1" />}
          </g>
          <path d="M100 32L169 99" stroke="#f1f7f5" strokeWidth="3" />
          {factor === 'noise' &&
            Array.from({ length: 360 }, (_, i) => (
              <rect
                key={i}
                x={(i * 67 + 23) % 240}
                y={(i * 41 + 19) % 180}
                width={2 + (i % 4)}
                height={2 + (i % 3)}
                fill={i % 2 ? '#f6f6ed' : '#05070b'}
                opacity=".4"
              />
            ))}
        </g>
      </svg>
    </figure>
  )
}

export function SignalComparison({ independent = false }: { independent?: boolean }) {
  const [factor, setFactor] = useState<'noise' | 'contrast' | 'overlap'>('noise')
  return (
    <section className={styles.teachingCard} data-signal-comparison>
      <p className={styles.kicker}>Matched conceptual images · draft illustrations</p>
      {!independent && (
        <div className={styles.demoButtons} aria-label="Conceptual comparison">
          <button
            type="button"
            aria-pressed={factor === 'noise'}
            onClick={() => setFactor('noise')}
          >
            Quantum noise
          </button>
          <button
            type="button"
            aria-pressed={factor === 'contrast'}
            onClick={() => setFactor('contrast')}
          >
            Contrast loss
          </button>
          <button
            type="button"
            aria-pressed={factor === 'overlap'}
            onClick={() => setFactor('overlap')}
          >
            Superimposition
          </button>
        </div>
      )}
      <div className={styles.exampleGrid}>
        <SignalImage label={independent ? 'Image A' : 'Reference'} />
        {independent ? (
          <SignalImage factor="contrast" label="Image B" />
        ) : (
          <SignalImage
            factor={factor}
            label={
              factor === 'noise'
                ? 'Quantum noise · irregular mottling'
                : factor === 'contrast'
                  ? 'Scatter-related contrast loss · smooth veil'
                  : 'Superimposition · projected silhouettes'
            }
          />
        )}
      </div>
      <p>
        Each panel changes one illustrative limiting factor from the reference. These drawings do
        not calculate photon statistics, scatter, dose response or patient anatomy. A texture alone
        is not diagnostic in a clinical image.
      </p>
      {!independent && (
        <p>
          Noise concerns limited signal statistics; review exposure/image-quality mode with the
          imaging team. Scatter can reduce contrast; review the irradiated field and beam path.
          Superimposition depends on projection; compare the CT geometry below. None of these
          drawings establishes lesion identity.
        </p>
      )}
    </section>
  )
}

export function FieldComparison() {
  const frame = suiteFrame(25, 0)
  const screen = (point: Parameters<typeof projectToDetector>[0]) => {
    const [u, v] = projectToDetector(point, 25)
    return [128 + u * 0.4, 128 - v * 0.4]
  }
  const target = screen(LESION_CENTER)
  const points = FIELD_CONTEXT.map(({ point }) => screen(point))
  return (
    <section className={styles.teachingCard} data-field-comparison>
      <p>
        Matched geometric illustrations · same target, excursion and context; different acquisition
        fields. Draft teaching marks, not device images.
      </p>
      <div className={styles.exampleGrid}>
        {[100, 45].map((width, i) => {
          const aperture = collimator(frame, width)
          const left = 128 + aperture.left * 0.4
          const top = 128 - (aperture.bottom + aperture.side) * 0.4
          const side = aperture.side * 0.4
          return (
            <figure key={width} className={styles.teachingFigure}>
              <figcaption>Field {i ? 'B' : 'A'}</figcaption>
              <svg
                viewBox="0 0 256 256"
                role="img"
                aria-label={
                  i
                    ? 'Field B includes target but truncates the dashed excursion and left context mark'
                    : 'Field A includes target, both context marks and dashed excursion'
                }
              >
                <rect width="256" height="256" fill="#172633" />
                <circle cx={target[0]} cy={target[1]} r="9" fill="#edc480" />
                <line
                  x1={points[2][0]}
                  y1={points[2][1]}
                  x2={points[3][0]}
                  y2={points[3][1]}
                  stroke="#77dccf"
                  strokeDasharray="4 3"
                  strokeWidth="3"
                />
                {points.slice(0, 2).map(([x, y], j) => (
                  <text key={j} x={x} y={y} fill="#c9f6ee" fontSize="14">
                    {j + 1}
                  </text>
                ))}
                <path
                  d={`M0 0H256V256H0Z M${left} ${top}v${side}h${side}v-${side}Z`}
                  fill="#050a0e"
                  fillRule="evenodd"
                />
                <rect x={left} y={top} width={side} height={side} fill="none" stroke="#ecc178" />
              </svg>
            </figure>
          )
        })}
      </div>
    </section>
  )
}

export function DoseRecord({ independent = false }: { independent?: boolean }) {
  return (
    <section className={styles.teachingCard} data-dose-record>
      <table className={styles.beforeAfter}>
        <caption>Fictional procedure record · authored 2026-09-13</caption>
        <thead>
          <tr>
            <th scope="col">Included modes</th>
            <th scope="col">Quantity</th>
            <th scope="col">Reported value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Fluoroscopy subtotal</th>
            <td>KAP</td>
            <td>{independent ? 4 : 2} Gy·cm²</td>
          </tr>
          <tr>
            <th scope="row">CBCT subtotal</th>
            <td>KAP</td>
            <td>{independent ? 2 : 3} Gy·cm²</td>
          </tr>
          <tr>
            <th scope="row">Fluoroscopy + CBCT total</th>
            <td>KAP</td>
            <td>{independent ? 6 : 5} Gy·cm²</td>
          </tr>
          <tr>
            <th scope="row">Fluoroscopy + CBCT total</th>
            <td>Reference air kerma</td>
            <td>{independent ? 55 : 40} mGy</td>
          </tr>
        </tbody>
      </table>
      <p>
        Fictional report values, not expected bronchoscopy exposures. Peak skin dose and effective
        dose are not supplied.
      </p>
    </section>
  )
}

export function ImagingQuestionPanels() {
  const [panel, setPanel] = useState(0)
  return (
    <section className={styles.teachingCard} data-imaging-question-example>
      <p className={styles.kicker}>Navigation indicates arrival · conceptual evidence sequence</p>
      <div className={styles.exampleGrid}>
        {[
          'Navigation target · planning CT',
          'Current lesion · updated imaging',
          'Actual biopsy tool · sampling component',
          'Tissue result · still awaited',
        ].map((title, i) =>
          i === panel ? (
            <figure key={title} className={styles.teachingFigure}>
              <figcaption>{title}</figcaption>
              <svg viewBox="0 0 200 115" role="img" aria-label={title}>
                <rect width="200" height="115" fill="#152935" rx="5" />
                {i < 3 ? (
                  <>
                    <path
                      d="M80 10V45L40 88M80 45L135 85"
                      fill="none"
                      stroke="#87a7b2"
                      strokeWidth="7"
                    />
                    <circle
                      cx={i ? 143 : 132}
                      cy={i ? 72 : 85}
                      r="13"
                      stroke="#e8bb70"
                      strokeDasharray={i ? undefined : '4 3'}
                      fill="none"
                      strokeWidth="2"
                    />
                    {i === 2 && (
                      <>
                        <path d="M85 48L151 75" stroke="#edf8f6" strokeWidth="3" />
                        <path d="M132 67L142 71" stroke="#61d8bc" strokeWidth="5" />
                      </>
                    )}
                  </>
                ) : (
                  <text x="32" y="62" fill="#e7f2ef" fontSize="17">
                    No diagnosis yet
                  </text>
                )}
              </svg>
            </figure>
          ) : null,
        )}
      </div>
      <p>
        {
          [
            'The planning target guides the catheter to a previously defined location. It does not establish the current lesion location.',
            'Current imaging can localize the lesion in the depicted state. It does not confirm a tool exchanged afterward.',
            'Assess the actual sampling component against the current intended lesion. The tool tip is a different component.',
            'An image of tool–lesion position does not establish diagnostic tissue. The specimen result answers that question.',
          ][panel]
        }
      </p>
      <div className={styles.demoButtons} aria-label="Evidence sequence">
        {['Planning target', 'Current lesion', 'Sampling component', 'Tissue result'].map(
          (label, i) => (
            <button
              type="button"
              key={label}
              aria-pressed={panel === i}
              onClick={() => setPanel(i)}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <p>
        The virtual target guides navigation. Current imaging can show a different lesion location.
        After tool exchange, assess the actual sampling component. Even tool-in-lesion does not
        establish diagnostic tissue. These are conceptual teaching diagrams, not matched patient
        acquisitions or captured device screens.
      </p>
    </section>
  )
}

export function TeachingPanels({
  sectionId,
  independent = false,
}: {
  sectionId: ImagingSectionId
  independent?: boolean
}) {
  if (sectionId === 'signal') return <SignalComparison independent={independent} />
  if (sectionId === 'dose-reporting') return <DoseRecord independent={independent} />
  if (sectionId === 'field' && independent) return <FieldComparison />
  if (sectionId === 'imaging-questions' && !independent) return <ImagingQuestionPanels />
  if (sectionId === 'time' && independent)
    return (
      <section className={styles.teachingCard}>
        <p>Two authored moving-tool acquisitions · same speed and pulse width</p>
        {[10, 5].map((rate, i) => (
          <div key={rate}>
            <p>Image {i ? 'B' : 'A'}</p>
            <TimeSamples
              comparison
              phase={0.5}
              model={temporal({ pulseRate: rate, pulseWidthMs: 5, speedMmS: 20, phase: 0.5 })}
            />
          </div>
        ))}
      </section>
    )
  if (sectionId === 'dts-interpretation' && !independent)
    return (
      <section className={styles.teachingCard} data-provenance-flow>
        <p className={styles.kicker}>From acquisition to guidance</p>
        <ol>
          <li>
            <strong>Acquired now</strong>
            <span>
              Current limited-angle projections contribute measured attenuation information.
            </span>
          </li>
          <li>
            <strong>Prior anatomy</strong>
            <span>
              Planning CT may contribute prior anatomical information in some reconstruction
              methods.
            </span>
          </li>
          <li>
            <strong>Reconstructed planes</strong>
            <span>The reconstructed planes combine those inputs according to the method.</span>
          </li>
          <li>
            <strong>Navigation update</strong>
            <span>
              A navigation-target update changes guidance coordinates; it is not a new biopsy-tool
              image.
            </span>
          </li>
          <li>
            <strong>Displayed overlay</strong>
            <span>
              An overlay displays stored information on a projection; its acquisition source and age
              still matter.
            </span>
          </li>
        </ol>
        <p>
          Capabilities differ by platform and software version. A study-specific localization error
          is not a universal accuracy specification.
        </p>
      </section>
    )
  if (sectionId === 'suite-cases' && !independent)
    return (
      <section data-worked-suite-case>
        <p className={styles.lookFor}>
          <strong>Worked case.</strong> A virtual target guided the catheter; current imaging showed
          a shifted lesion. The biopsy tool has now been exchanged. Follow which evidence answers
          each question in the panels.
        </p>
        <ImagingQuestionPanels />
        <p>
          Review the actual sampling component against the current intended lesion. A previously
          updated target does not confirm the exchanged tool, and an image does not establish the
          tissue result. Apply this reasoning to the practice cases and the integrated cases.
        </p>
      </section>
    )
  return null
}

export function hasIndependentImagePanel(sectionId: ImagingSectionId) {
  return INDEPENDENT_IMAGE_PANEL_SECTIONS.includes(sectionId)
}

/** These self-contained SVG/table examples need no remote asset or WebGL renderer. */
export function IndependentImagePanels({
  sectionId,
  onRepresentationReady,
}: {
  sectionId: ImagingSectionId
  onRepresentationReady: (ready: boolean) => void
}) {
  useEffect(() => {
    onRepresentationReady(hasIndependentImagePanel(sectionId))
  }, [onRepresentationReady, sectionId])
  return (
    <div data-independent-image-panels>
      <TeachingPanels sectionId={sectionId} independent />
    </div>
  )
}
