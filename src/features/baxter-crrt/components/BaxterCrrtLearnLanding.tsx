import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { PathwayLanding } from '@/features/learning-module/curriculum'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'

/**
 * The CRRT front door.
 *
 * C2 §4 asks this page to answer four questions before a learner opens anything: where a novice
 * begins, what is assumed already known, what will actually be practiced, and what finishing the
 * pathway does *not* establish. The last one is the reason this notice exists at all — a module
 * that runs a circuit, builds a prescription, and works a differential can otherwise read as a
 * qualification, and it is not one.
 */
export function BaxterCrrtLearnLanding() {
  return (
    <PathwayLanding
      pathway={criticalCareLearningPathway('baxter-crrt')}
      sectionHref={(sectionId) => `${baxterCrrtNavBase}/learn?lesson=${sectionId}`}
      intro="Begin at section 1, the treatment trajectory: what problem is this therapy meant to work on, and what is it meant to move toward? Section 2 then traces one circuit, and every section after it reuses that same picture — what moves solute across it, what the prescription asks it to deliver, where a pressure change points, what citrate does inside it, and what leaves the patient. The final section puts those readings together on a run that is going wrong. Move in order or open any section directly; every section stays open."
      startLabel="Start with the treatment trajectory"
      sectionsNote="The final section is an integration capstone that reuses every earlier reading, not a new topic."
      notice={
        <aside
          role="note"
          aria-label="Before you start"
          className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6"
        >
          <div>
            <p className="font-semibold">What this pathway assumes, and what it does not settle</p>
            <p className="text-muted-foreground">
              It assumes you already know what acute kidney injury is and can read a basic acid–base
              and electrolyte picture. It does not assume you have seen a CRRT machine, set up a
              circuit, or written a prescription before.
            </p>
          </div>
          <div>
            <p className="font-semibold">What you will practise</p>
            <p className="text-muted-foreground">
              Tracing one circuit and naming where each pressure sits; building a prescription in
              stages and reading what those flows predict; separating prescribed intensity from
              therapy actually delivered; telling a circuit sample apart from a patient sample; and
              keeping the machine fluid ledger separate from the whole-patient one.
            </p>
          </div>
          <div>
            <p className="font-semibold">Educational model · pending clinical review</p>
            <p className="text-muted-foreground">
              Values, device responses, and alarm behaviour are synthetic teaching examples.
              Finishing this pathway does not by itself qualify anyone to prescribe, set up, run, or
              troubleshoot CRRT independently, and it replaces no local protocol. Confirm every
              workflow against current PrisMax instructions, your local policy, and the responsible
              clinical team.
            </p>
          </div>
        </aside>
      }
    />
  )
}
