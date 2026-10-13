'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import {
  DOSE_NOTE_TEMPLATE_LINES,
  DOSE_NOTE_TEMPLATE_TEXT,
  DOSE_QUANTITIES,
} from '../../content/doseQuantities'
import { glossaryTerm } from '../../content/glossary'
import { RADIAL_EBUS_VIEWS } from '../../content/radialEbusViews'
import { PI_NUMBERS, piNumberCitation } from '../../content/teachingNumbers'
import { ImagingReferenceValues } from './ImagingReferenceValues'
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
import { TimeSamples } from '../suite/views/TimeView'
import { temporal } from '../suite/suiteModel'
import {
  ConspicuityPair,
  DependentOpacityPair,
  FieldPair,
  MotionDoubledPlanes,
} from '../figures/CheckImages'
import { ConspicuityComparison } from '../figures/ConspicuityComparison'
import { EvidenceSequenceFigure, type EvidenceStep } from '../figures/EvidenceSequenceFigure'
import { CopyTextButton } from '../figures/CopyTextButton'
import styles from './imaging-stage.module.css'

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

/** Section 9: the three radial EBUS views, what each establishes and the next move. */
export function RadialEbusViews() {
  return (
    <>
      <section className={styles.teachingCard} data-radial-ebus-views>
        <p className={styles.kicker}>Three views, three next moves</p>
        <table className={styles.doseTable}>
          <thead>
            <tr>
              <th scope="col">View</th>
              <th scope="col">What you see</th>
              <th scope="col">What it establishes</th>
              <th scope="col">Next move</th>
            </tr>
          </thead>
          <tbody>
            {RADIAL_EBUS_VIEWS.map((row) => (
              <tr key={row.id} data-radial-ebus-view={row.id}>
                <th scope="row">{row.view}</th>
                <td data-label="What you see">{row.see}</td>
                <td data-label="What it establishes">{row.establishes}</td>
                <td data-label="Next move">{row.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <ImagingReferenceValues title="Why the view matters" ids={['rebus-yield-by-position']} />
    </>
  )
}

/** Section 18: the levels that prompt action, and what published procedures have delivered. */
export function DoseReferenceValues() {
  return (
    <>
      <ImagingReferenceValues
        title="Dose levels that prompt action"
        ids={['aapm-first-notification', 'aapm-substantial-dose']}
      />
      <ImagingReferenceValues
        title="Dose–area product in published navigation bronchoscopy"
        ids={[
          'mobile-cbct-total-dap',
          'mobile-cbct-spin-dap',
          'confirm-dap',
          'verhoeven-fluoroscopy-dap',
          'verhoeven-total-dap',
        ]}
      />
    </>
  )
}

export function DoseNoteTemplate() {
  return (
    <section className={styles.teachingCard} data-dose-note-template>
      <p className={styles.kicker}>Record the whole procedure once · copyable aid</p>
      <p>
        The fields the section teaches, for the procedure note. Nothing is filled in: every value
        comes from your own record.
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
        <caption>Example procedure record for the arithmetic</caption>
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
      <p data-example-record-scale>
        These values are small round numbers chosen for the arithmetic. Published series are larger:{' '}
        {PI_NUMBERS.value('mobile-cbct-total-dap')} of total dose–area product with mobile CBCT (
        {piNumberCitation('mobile-cbct-total-dap')}).
      </p>
    </section>
  )
}

/**
 * The four questions an image can be asked, on one drawing (`EvidenceSequenceFigure`). The steps sit
 * above the figure, so the control and what it changes are on screen together, and each step says
 * what that evidence shows and what it does not.
 */
const EVIDENCE_STEPS = [
  {
    button: 'Planning target',
    question: 'Navigation: where is the catheter relative to the navigation target?',
    shows:
      'The catheter has reached the target defined on the planning CT. The planning target guides the catheter to a previously defined location.',
    not: 'It does not establish where the lesion is today.',
  },
  {
    button: 'Current lesion',
    question: 'Localization: where is the lesion now?',
    shows:
      'Current imaging localizes the lesion as it is at this moment, here beside the planned target and not on it.',
    not: 'It does not confirm a tool exchanged afterward.',
  },
  {
    button: 'Sampling component',
    question:
      'Tool-in-lesion confirmation: where is the actual biopsy tool relative to the lesion?',
    shows:
      'Assess the actual sampling component against the current lesion. The tool tip is a different part of the tool.',
    not: 'It does not establish that the tissue obtained is diagnostic.',
  },
  {
    button: 'Tissue result',
    question: 'Diagnosis: did the specimen answer the clinical question?',
    shows: 'The specimen result answers this question.',
    not: 'An image of the tool in the lesion does not establish diagnostic tissue.',
  },
] as const

export function ImagingQuestionPanels() {
  const [panel, setPanel] = useState<EvidenceStep>(0)
  const step = EVIDENCE_STEPS[panel]
  return (
    <section className={styles.evidenceCard} data-imaging-question-example>
      <p className={styles.kicker}>
        Navigation indicates arrival · what each kind of evidence adds
      </p>
      <div className={styles.evidenceSteps} role="group" aria-label="Evidence sequence">
        {EVIDENCE_STEPS.map((entry, i) => (
          <button
            type="button"
            key={entry.button}
            aria-pressed={panel === i}
            onClick={() => setPanel(i as EvidenceStep)}
          >
            {entry.button}
          </button>
        ))}
      </div>
      <figure className={styles.evidenceFrame}>
        {/* The caption leads: the question, then the drawing that answers it. */}
        <figcaption data-panel-caption={panel}>
          <strong>{step.question}</strong>
          <span>
            {step.shows} <span className={styles.evidenceNot}>{step.not}</span>
          </span>
        </figcaption>
        <EvidenceSequenceFigure step={panel} />
      </figure>
      {/* Reports 1.1 and 6.1: the term is defined on the screen where it is first used, in Section
          15's words, and the section that teaches it in full is linked. */}
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
        Dashed amber circle: the navigation target from the planning CT · amber nodule: the lesion
        on current imaging · white line: the catheter and the biopsy tool · teal segment: the tool’s
        sampling component.
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
  if (visual === 'radial-ebus') return <RadialEbusViews />
  if (sectionId === 'signal') return independent ? <ConspicuityPair /> : <ConspicuityComparison />
  if (sectionId === 'dose-reporting')
    return independent ? (
      <DoseRecord independent />
    ) : (
      <>
        <DoseQuantityTable />
        <DoseReferenceValues />
        <DoseNoteTemplate />
        <DoseRecord />
      </>
    )
  if (sectionId === 'field' && independent) return <FieldPair />
  if (sectionId === 'current-anatomy' && independent) return <DependentOpacityPair />
  if (sectionId === 'changing-anatomy' && independent) return <MotionDoubledPlanes />
  if (sectionId === 'imaging-questions' && !independent) return <ImagingQuestionPanels />
  if (sectionId === 'time' && independent)
    return (
      <section className={styles.teachingCard}>
        <p>Two moving-tool acquisitions · same speed and pulse width</p>
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

/** These self-contained image, SVG and table examples need no WebGL renderer. */
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
