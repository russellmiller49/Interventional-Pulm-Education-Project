import { PathwayLanding } from '@/features/learning-module/curriculum'

import { pacLearningPathway } from '../content'

export function IcuHemodynamicsLearnLandingV2() {
  return (
    <PathwayLanding
      pathway={pacLearningPathway}
      sectionHref={(sectionId) => `/icu-hemodynamics/learn?activity=${sectionId}`}
      intro="Begin with the catheter at the introducer and follow it through RA, RV, PA, and wedge physiology. Every station uses the same synchronized three-panel workspace. Move in order or jump directly to any section; every station remains open."
      startLabel="Start at the introducer"
      sectionsNote="The final signal-validation station is an integration capstone, not a duplicate introductory module."
    />
  )
}
