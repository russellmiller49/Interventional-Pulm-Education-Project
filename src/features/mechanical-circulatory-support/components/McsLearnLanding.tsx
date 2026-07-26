import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { PathwayLanding } from '@/features/learning-module/curriculum'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

export function McsLearnLanding() {
  return (
    <PathwayLanding
      pathway={criticalCareLearningPathway('mechanical-circulatory-support')}
      sectionHref={(sectionId) =>
        `${mechanicalCirculatorySupportNavBase}/learn?lesson=${sectionId}`
      }
      intro="Two shared foundations come first: validate the signal, then separate the mechanisms. Each device pair follows the same shape — isolate the mechanism the device manipulates, then work the conditions where it stops helping. The last section holds all three against one phenotype. Move in order or open any section directly; the device track follows your selection."
      startLabel="Start with the signal"
      sectionsNote="The device pairs are three routes through the same question: which part of the circulation is limiting?"
      notice={
        <aside
          role="note"
          className="flex max-w-3xl gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6"
        >
          <div>
            <p className="font-semibold">Educational model · pending clinical review</p>
            <p className="text-muted-foreground">
              Device responses are bounded teaching approximations. Device selection, timing, and
              escalation remain team decisions under current instructions and local protocol.
            </p>
          </div>
        </aside>
      }
    />
  )
}
