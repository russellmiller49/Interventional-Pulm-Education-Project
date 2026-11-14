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
          Fifteen short sections take you through one adult flexible bronchoscopy. Plan it, prepare
          the scope and the patient, drive to the carina, survey both lungs, sample, and respond
          when something goes wrong. You need general clinical knowledge. You do not need to have
          held a scope.
        </p>
        <div>
          <BronchContinueCta />
        </div>
        <p className="text-sm text-muted-foreground" data-pathway-composition>
          {bronchCompositionLine()}
        </p>
        <p className="max-w-3xl leading-7">
          Each section teaches first, then asks. You can skip any question or activity, open its
          explanation, or try it again. Open the sections in any order. The order here is the order
          of a procedure.
        </p>
        <p className="text-sm leading-6 text-muted-foreground" data-competence-statement>
          An online course cannot show that you can perform a bronchoscopy. You build the hand skill
          on the bench and at the bedside. The faculty who watch you judge when you are ready, and
          your institution grants privileges.
        </p>
        <p className="text-sm leading-6 text-muted-foreground" data-storage-statement>
          This device remembers where you left off and the sections you opened or marked. Your
          answers are not saved and nothing is scored.
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
          Reference and sources
        </Link>
      </nav>
    </div>
  )
}
