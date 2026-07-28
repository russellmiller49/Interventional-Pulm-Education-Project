import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { PathwayLanding } from '@/features/learning-module/curriculum'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'

export function BaxterCrrtLearnLanding() {
  return (
    <PathwayLanding
      pathway={criticalCareLearningPathway('baxter-crrt')}
      sectionHref={(sectionId) => `${baxterCrrtNavBase}/learn?lesson=${sectionId}`}
      intro="Start from the treatment goal, follow the blood path once, and keep returning to it. Each section adds one reading of the same run — what it moves, what protects it, what it removes — and the last section asks you to put those readings together on a run that is going wrong. Move in order or open any section directly; every section stays open."
      startLabel="Start with the treatment goal"
      sectionsNote="The final section is an integration capstone that reuses every earlier reading, not a new topic."
      notice={
        <aside
          role="note"
          className="flex max-w-3xl gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6"
        >
          <div>
            <p className="font-semibold">Educational model · pending clinical review</p>
            <p className="text-muted-foreground">
              Values, device responses, and alarm behavior are synthetic teaching examples. Confirm
              every workflow against current PrisMax instructions and local policy.
            </p>
          </div>
        </aside>
      }
    />
  )
}
