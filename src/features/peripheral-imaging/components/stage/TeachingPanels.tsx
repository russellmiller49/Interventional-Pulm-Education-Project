'use client'

import { useEffect, useId, useState } from 'react'
import { Link } from '@/i18n/navigation'
import {
  DOSE_NOTE_TEMPLATE_LINES,
  DOSE_NOTE_TEMPLATE_TEXT,
  DOSE_QUANTITIES,
} from '../../content/doseQuantities'
import { glossaryTerm } from '../../content/glossary'
import {
  INDEPENDENT_IMAGE_PANEL_SECTIONS,
  type ImagingVisual,
} from '../../content/learningActivities'
import {
  imagingLesson,
  peripheralImagingSectionIds,
  type ImagingSectionId,
} from '../../content/pathway'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import { FIELD_CONTEXT, LESION_CENTER, projectToDetector } from '../../lib/physics'
import { collimator, suiteFrame } from '../suite/suiteModel'
import { TimeSamples } from '../suite/views/TimeView'
import { temporal } from '../suite/suiteModel'
import { ConspicuityComparison } from '../figures/ConspicuityComparison'
import { CopyTextButton } from '../figures/CopyTextButton'
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

/**
 * The Section 6 check's Image A and Image B: optional companions to QS-3's text variant, which
 * carries its evidence in the stem (OD4-02). The section's reading steps show the CT-derived
 * comparison instead (`ConspicuityComparison`, OD4-06); the image variant of this check waits for
 * honest media.
 */
export function SignalComparison() {
  return (
    <section className={styles.teachingCard} data-signal-comparison>
      <p className={styles.kicker} data-draft-status>
        Matched conceptual images · draft illustrations
      </p>
      <div className={styles.exampleGrid}>
        <SignalImage label="Image A" />
        <SignalImage factor="contrast" label="Image B" />
      </div>
      {/* Report CW2: one caveat where there were two overlapping ones. */}
      <p>
        Each panel changes one illustrative limiting factor from the reference. These drawings do
        not calculate photon statistics, scatter, dose response or patient anatomy, and none of them
        establishes lesion identity.
      </p>
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

/**
 * Report 7.2: the four quantities as a table, and the whole-procedure record as a copyable
 * template. Every cell is the section's own teaching; the template carries no value.
 */
export function DoseQuantityTable() {
  return (
    <section className={styles.teachingCard} data-dose-quantities>
      <p className={styles.kicker}>Four quantities, four questions</p>
      <table className={styles.doseTable}>
        <thead>
          <tr>
            <th scope="col">Quantity</th>
            <th scope="col">Unit</th>
            <th scope="col">What it tells you</th>
            <th scope="col">What it does not</th>
          </tr>
        </thead>
        <tbody>
          {DOSE_QUANTITIES.map((row) => (
            <tr key={row.id} data-dose-quantity={row.id}>
              <th scope="row">{row.name}</th>
              <td data-label="Unit">{row.unit}</td>
              <td data-label="What it tells you">{row.tells}</td>
              <td data-label="What it does not">{row.doesNot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function DoseNoteTemplate() {
  return (
    <section className={styles.teachingCard} data-dose-note-template>
      <p className={styles.kicker}>Record the whole procedure once · copyable aid</p>
      <p>
        An educational aid for the procedure note, listing the fields the section teaches. Nothing
        is filled in: every value comes from your own record and local policy.
      </p>
      <pre className={styles.template} data-dose-note-lines>
        {DOSE_NOTE_TEMPLATE_LINES.join('\n')}
      </pre>
      <div className={styles.demoButtons}>
        <CopyTextButton
          text={DOSE_NOTE_TEMPLATE_TEXT}
          label="Copy the template"
          dataAttribute="data-copy-dose-note"
        />
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
      <p data-draft-status>
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
                        {/* Report 1.1: the teal segment and the tip are named on the figure, in
                            the drawing's own coordinates. */}
                        <text x="150" y="92" fill="#edf8f6" fontSize="9" data-figure-label="tip">
                          tip
                        </text>
                        <line
                          x1="151"
                          y1="75"
                          x2="156"
                          y2="84"
                          stroke="#edf8f6"
                          strokeWidth="0.8"
                        />
                        <text
                          x="120"
                          y="104"
                          textAnchor="middle"
                          fill="#8de7d1"
                          fontSize="9"
                          data-figure-label="sampling-component"
                        >
                          sampling component (teal)
                        </text>
                        <line
                          x1="137"
                          y1="69"
                          x2="122"
                          y2="96"
                          stroke="#8de7d1"
                          strokeWidth="0.8"
                        />
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
      {/* Reports 1.1 and 6.1: the term is defined on the screen where it is first used, in Section
          15's words, and the section that teaches it in full is linked. */}
      <p data-panel-caption={panel}>
        {
          [
            'The planning target guides the catheter to a previously defined location. It does not establish the current lesion location.',
            'Current imaging can localize the lesion in the depicted state. It does not confirm a tool exchanged afterward.',
            'Assess the actual sampling component against the current intended lesion. The tool tip is a different component.',
            'An image of tool–lesion position does not establish diagnostic tissue. The specimen result answers that question.',
          ][panel]
        }
      </p>
      {panel === 2 ? (
        <p data-sampling-component-definition>
          <strong>Sampling component:</strong> {glossaryTerm('sampling-component').definition}{' '}
          Taught in full in{' '}
          <Link href={imagingSectionLinkTarget('tool-confirmation')} data-sampling-component-link>
            Section {peripheralImagingSectionIds.indexOf('tool-confirmation') + 1},{' '}
            {imagingLesson('tool-confirmation').title}
          </Link>
          .
        </p>
      ) : null}
      <p className={styles.figureLegend} data-figure-legend>
        Dashed amber circle: the navigation target from the planning CT · solid amber circle: the
        lesion on current imaging · white line: the biopsy tool · teal segment: its sampling
        component.
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

/**
 * Report 5.4: the provenance flow was authored for DTS and reused, word for word, on the mobile
 * CBCT section, so a CBCT card described "limited-angle projections" and a prior-aided
 * reconstruction. The flow now says what each acquisition contributes in its own terms, from the
 * reconstruction accounts; the steps that apply to both (a navigation update, an overlay) stay.
 */
function ProvenanceFlow({ modality }: { readonly modality: 'dts' | 'cbct' }) {
  return (
    <section
      className={styles.teachingCard}
      data-provenance-flow
      data-provenance-modality={modality}
    >
      <p className={styles.kicker}>From acquisition to guidance</p>
      {modality === 'cbct' ? (
        <p role="note" data-cbct-provenance-review>
          Draft CBCT provenance account — awaiting source-owner review for the platform and protocol
          described. Image review, navigation target update and overlay are separate capabilities.
        </p>
      ) : null}
      <ol>
        <li>
          <strong>Acquired now</strong>
          <span>
            {modality === 'dts'
              ? 'Current limited-angle projections contribute measured attenuation information.'
              : 'The projections from the CBCT spin contribute measured attenuation from every direction inside the reconstruction volume.'}
          </span>
        </li>
        <li>
          <strong>{modality === 'dts' ? 'Prior anatomy' : 'Separate capabilities'}</strong>
          <span>
            {modality === 'dts'
              ? 'Planning CT may contribute prior anatomical information in some reconstruction methods.'
              : 'Do not assume that viewing or exporting a volume updates the navigation target or provides an augmented-fluoroscopy overlay.'}
          </span>
        </li>
        <li>
          <strong>{modality === 'dts' ? 'Reconstructed planes' : 'Reconstructed volume'}</strong>
          <span>
            {modality === 'dts'
              ? 'The reconstructed planes combine those inputs according to the method.'
              : 'The volume can be reviewed in any plane; outside it nothing was acquired.'}
          </span>
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
        Capabilities differ by platform and software version. A study-specific localization error is
        not a universal accuracy specification.
      </p>
    </section>
  )
}

export function TeachingPanels({
  sectionId,
  independent = false,
  visual,
}: {
  sectionId: ImagingSectionId
  independent?: boolean
  /** The activity's declared visual, when the caller has one; decides the provenance flow. */
  visual?: ImagingVisual
}) {
  if (visual === 'provenance' || (sectionId === 'dts-interpretation' && !independent))
    return (
      <ProvenanceFlow
        modality={sectionId === 'mobile-suite' || sectionId === 'fixed-suite' ? 'cbct' : 'dts'}
      />
    )
  if (sectionId === 'signal') return independent ? <SignalComparison /> : <ConspicuityComparison />
  if (sectionId === 'dose-reporting')
    return independent ? (
      <DoseRecord independent />
    ) : (
      <>
        <DoseQuantityTable />
        <DoseNoteTemplate />
        <DoseRecord />
      </>
    )
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
