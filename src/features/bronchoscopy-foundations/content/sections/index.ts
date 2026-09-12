import { BRONCH_SECTION_IDS, type BronchSectionId } from '../sectionIds'
import { validateAllSections } from '../sectionValidation'
import type { BronchSectionDefinition } from '../types'
import { section as bleedingPriorities } from './bleeding-priorities'
import { section as branchEntry } from './branch-entry'
import { section as clinicalQuestion } from './clinical-question'
import { section as describeFindings } from './describe-findings'
import { section as deterioration } from './deterioration'
import { section as fiveControls } from './five-controls'
import { section as honestReport } from './honest-report'
import { section as icuPhysiology } from './icu-physiology'
import { section as larynxAndEntry } from './larynx-and-entry'
import { section as leftSide } from './left-side'
import { section as poorReturn } from './poor-return'
import { section as preUseCheck } from './pre-use-check'
import { section as protectedAccessories } from './protected-accessories'
import { section as referenceFrames } from './reference-frames'
import { section as rightSide } from './right-side'
import { section as scopeInATube } from './scope-in-a-tube'
import { section as sedationAndMonitoring } from './sedation-and-monitoring'
import { section as sharedAirway } from './shared-airway'
import { section as specimenPathway } from './specimen-pathway'
import { section as systematicSurvey } from './systematic-survey'
import { section as viewLoss } from './view-loss'
import { section as washingAndLavage } from './washing-and-lavage'
import { section as whatCompletionMeans } from './what-completion-means'

/**
 * The section registry: every authored section, in the canonical order of `sectionIds.ts`,
 * validated as a set at import. A section that fails its contract is a build failure here, before
 * any adapter or page reads it.
 */
const AUTHORED: readonly BronchSectionDefinition[] = [
  sharedAirway,
  clinicalQuestion,
  preUseCheck,
  sedationAndMonitoring,
  fiveControls,
  branchEntry,
  referenceFrames,
  viewLoss,
  larynxAndEntry,
  rightSide,
  leftSide,
  systematicSurvey,
  describeFindings,
  washingAndLavage,
  poorReturn,
  protectedAccessories,
  specimenPathway,
  deterioration,
  bleedingPriorities,
  scopeInATube,
  icuPhysiology,
  honestReport,
  whatCompletionMeans,
]

const byId = new Map<BronchSectionId, BronchSectionDefinition>(
  AUTHORED.map((section) => [section.id, section] as const),
)

export const BRONCH_SECTIONS: readonly BronchSectionDefinition[] = BRONCH_SECTION_IDS.map((id) => {
  const section = byId.get(id)
  if (!section) throw new Error(`No authored section for ${id}`)
  return section
})

export function bronchSection(sectionId: BronchSectionId): BronchSectionDefinition {
  const section = byId.get(sectionId)
  if (!section) throw new Error(`No section ${sectionId}`)
  return section
}

const registryErrors = [
  ...(AUTHORED.length === BRONCH_SECTION_IDS.length
    ? []
    : [
        `${AUTHORED.length} sections are authored; the canonical order lists ${BRONCH_SECTION_IDS.length}.`,
      ]),
  ...AUTHORED.flatMap((section, index) =>
    section.id === BRONCH_SECTION_IDS[index]
      ? []
      : [`Section ${section.id} is registered out of the canonical order.`],
  ),
  ...validateAllSections(AUTHORED),
]
if (registryErrors.length > 0) {
  throw new Error(
    `The Bronchoscopy Foundations sections are invalid:\n${registryErrors.join('\n')}`,
  )
}
