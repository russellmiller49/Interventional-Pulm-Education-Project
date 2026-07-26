import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { PathwayLanding } from '@/features/learning-module/curriculum'

import { ICU_WORKSPACE_ORIENTATION_ID } from '../content'

/**
 * The pathway spans two routes: the orientation section lives under Learn, and each scenario
 * section opens the coached Practice run of that scenario.
 */
export function IcuLearnLanding() {
  return (
    <PathwayLanding
      pathway={criticalCareLearningPathway('icu-simulation')}
      sectionHref={(sectionId) =>
        sectionId === ICU_WORKSPACE_ORIENTATION_ID
          ? `/icu-simulation/learn?activity=${sectionId}`
          : `/icu-simulation/practice?case=${sectionId}`
      }
      intro="This module removes the isolation the other modules rely on: one synthetic patient, one clock, and several supports that interact. Start with the loop, then work the scenarios from the one where a single mechanism dominates to the ones where the limiting support keeps moving. Move in order or open any section directly."
      startLabel="Start with the loop"
      sectionsNote="Scenarios are ordered by how many supports interact and for how long, not by how dramatic they are."
      notice={
        <aside
          role="note"
          className="flex max-w-3xl gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6"
        >
          <div>
            <p className="font-semibold">Educational model · pending clinical review</p>
            <p className="text-muted-foreground">
              Scenario content, device responses, laboratory trajectories, and timing are bounded
              synthetic approximations and cannot guide care.
            </p>
          </div>
        </aside>
      }
    />
  )
}
