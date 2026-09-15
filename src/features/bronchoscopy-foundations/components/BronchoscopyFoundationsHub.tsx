import { Link } from '@/i18n/navigation'
import { BRONCH_ARC_SENTENCE } from '../content/pathway'
import { bronchCompositionLine } from '../content/pathwayResolver'
import {
  BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF,
  BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF,
  BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF,
} from '../content/routes'
import { BronchContinueCta, BronchStoredPathwayAccordion } from './hub/BronchPathwayAccordion'

/** The registry owns the outline; the self-paced record says where the learner left off. */
export function BronchoscopyFoundationsHub() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-5 rounded-3xl border bg-card p-6 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Bronchoscopy Foundations
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Prepare for supervised bronchoscopy
        </h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          A guided introduction to adult flexible bronchoscopy: prepare the patient and instrument,
          learn the controls, inspect normal airways, and reason through sampling, deterioration and
          documentation. General clinical knowledge is assumed; prior bronchoscopy experience is
          not.
        </p>
        <div>
          <BronchContinueCta />
        </div>
        <p className="text-sm text-muted-foreground" data-pathway-composition>
          {bronchCompositionLine()}
        </p>
        <p className="max-w-3xl leading-7">
          Each lesson teaches its concepts and examples before any question. Questions and
          activities are optional: open the explanation first, try again, or continue without
          answering. Some lessons use an instrument workspace; others use airway images, a patient
          case or an examination record. You can open any lesson; prerequisites suggest an order and
          never lock the course.
        </p>
        <p className="text-sm leading-6 text-muted-foreground" data-competence-statement>
          Self-paced online learning does not establish procedural competence. Hand skill, equipment
          readiness and clinical judgment are built under supervision. The models use one teaching
          anatomy with authored geometry or scripted observations; follow current device
          instructions and local policy.
        </p>
        <p className="text-sm leading-6 text-muted-foreground" data-storage-statement>
          This device keeps where you left off and the sections you open, mark reviewed or mark to
          review later. Answers, attempts and scope positions are not saved, and nothing is scored.
        </p>
      </section>
      <section aria-labelledby="bronch-map-heading">
        <h2 id="bronch-map-heading" className="text-2xl font-bold">
          {BRONCH_ARC_SENTENCE}
        </h2>
        <div className="mt-5">
          <BronchStoredPathwayAccordion id="bronch-pathway-map" />
        </div>
      </section>
      <nav
        aria-label="Further Foundations activities"
        className="flex flex-wrap gap-5 border-t pt-5 text-sm"
      >
        <Link className="min-h-11 py-3 text-primary" href={BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF}>
          Practice short cases
        </Link>
        <Link className="min-h-11 py-3 text-primary" href={BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF}>
          Integrated cases
        </Link>
        <Link className="min-h-11 py-3 text-primary" href={BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF}>
          Reference, sources and model limits
        </Link>
      </nav>
    </div>
  )
}
