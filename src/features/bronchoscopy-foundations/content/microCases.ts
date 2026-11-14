import { BRONCH_SECTION_IDS, type BronchSectionId } from './pathway'
import { BRONCH_SECTIONS, bronchSection } from './sections'
import {
  bronchSectionItems,
  practiceAttemptKey,
  vignetteStageItems,
  type BronchStageItem,
} from './stageItems'
import { VIGNETTES, type VignetteTopic } from './vignettes'

/**
 * The practice layer: one-decision cases paired to the section whose mechanism they use, listed in
 * the order the course teaches those mechanisms. A case's own item id is the key its first
 * decision is recorded under.
 */
export interface BronchMicroCase {
  readonly id: string
  readonly sectionId: BronchSectionId
  readonly manifestCaseId?: string
  /** Set on a vignette with numbers: the topic it is listed under. */
  readonly vignetteTopic?: VignetteTopic
  readonly presentationTitle: string
  readonly situation: string
  readonly stage: BronchStageItem
}

const VIGNETTE_CASES: readonly BronchMicroCase[] = VIGNETTES.map((vignette, index) => ({
  id: vignette.id,
  sectionId: vignette.sectionId,
  vignetteTopic: vignette.topic,
  presentationTitle: vignette.presentationTitle,
  situation: vignette.situation,
  stage: vignetteStageItems[index],
}))

/** The sections' own cases, in the order the course teaches them, then the vignettes by topic. */
const SECTION_CASES: readonly BronchMicroCase[] = BRONCH_SECTIONS.flatMap((section) => {
  const items = bronchSectionItems(section.id)
  return section.practice.map((entry, index): BronchMicroCase => {
    const stage = items.practice[index]
    if (!stage || stage.item.id !== entry.item.id)
      throw new Error(`Practice case ${entry.id} and its item are out of step.`)
    return {
      id: entry.id,
      sectionId: section.id,
      manifestCaseId: entry.manifestCaseId,
      presentationTitle: entry.presentationTitle,
      situation: entry.situation,
      stage,
    }
  })
})

const ALL: readonly BronchMicroCase[] = [...SECTION_CASES, ...VIGNETTE_CASES]

export const bronchMicroCaseById: ReadonlyMap<string, BronchMicroCase> = new Map(
  ALL.map((entry) => [entry.id, entry] as const),
)

export function bronchMicroCasesInPathwayOrder(): readonly BronchMicroCase[] {
  return ALL
}

/** A section's own short cases. The vignettes are listed by topic, apart from the sections. */
export function microCasesForSection(sectionId: BronchSectionId): readonly BronchMicroCase[] {
  return SECTION_CASES.filter((entry) => entry.sectionId === sectionId)
}

/** The vignettes with numbers under one topic, in their written order. */
export function vignetteCasesForTopic(topic: VignetteTopic): readonly BronchMicroCase[] {
  return VIGNETTE_CASES.filter((entry) => entry.vignetteTopic === topic)
}

/** The first-attempt key of a case's decision. */
export function microCaseAttemptKey(microCase: BronchMicroCase): string {
  return practiceAttemptKey(microCase.stage.item.id)
}

export function validateBronchMicroCases(): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const entry of ALL) {
    if (ids.has(entry.id)) errors.push(`Practice case ${entry.id} is registered twice.`)
    ids.add(entry.id)
    if (!(BRONCH_SECTION_IDS as readonly string[]).includes(entry.sectionId))
      errors.push(`Practice case ${entry.id} pairs to an unknown section.`)
    else bronchSection(entry.sectionId)
  }
  return errors
}

const caseErrors = validateBronchMicroCases()
if (caseErrors.length > 0) {
  throw new Error(`The practice cases are invalid:\n${caseErrors.join('\n')}`)
}
