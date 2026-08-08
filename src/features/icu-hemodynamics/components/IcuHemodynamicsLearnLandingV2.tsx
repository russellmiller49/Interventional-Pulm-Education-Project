import { PathwayLanding } from '@/features/learning-module/curriculum'

import { pacLearningPathway } from '../content'
import { PacSectionReadinessList } from './PacSectionReadiness'

export function IcuHemodynamicsLearnLandingV2() {
  return (
    <PathwayLanding
      pathway={pacLearningPathway}
      sectionHref={(sectionId) => `/icu-hemodynamics/learn?activity=${sectionId}`}
      intro="Start with one question — can I trust this pressure signal? Establish a valid measurement system, build a normal RA, RV, PA, and wedge reference, and only then advance a simulated catheter, measure output, and derive values. Every station uses the same synchronized three-panel workspace. Move in order or jump directly to any section; every station remains open."
      startLabel="Start here: can I trust this pressure signal?"
      notice={<PacSectionReadinessList />}
      sectionsNote="The final signal-validation station is an integration capstone, not a duplicate introductory module. Working through a section records that you took part; it does not make a claim about clinical readiness."
    />
  )
}
