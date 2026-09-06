import { mcsSectionLearningContractById } from './sectionLearningContracts'
import { mcsMapSegmentIds, type McsMapSegmentId } from './supportSpine'

/**
 * Which identification questions are answered on the circulation map, and where each answer is.
 *
 * The rule, taken from the ECMO module's owner decision: a question is answered on the picture
 * only when every one of its answers is a place on it. Naming a place from a list tests the words;
 * pointing at it on the loop tests the thing. Two of the nine sections qualify — where a
 * right-sided pump returns its blood, and which side of the heart is limiting delivery. The rest
 * ask about readings, mechanisms or actions, which no drawing can express, and keep their lists.
 * `map-answer.test.tsx` pins the qualifying set, so adding one is a decision taken with the rule
 * in front of it.
 */

export interface McsMapAnswerTarget {
  readonly optionId: string
  /** The segments the pin's halo covers; the pin itself sits on the first. */
  readonly segmentIds: readonly McsMapSegmentId[]
}

export interface McsMapAnswerMapping {
  readonly sectionId: string
  readonly targets: readonly McsMapAnswerTarget[]
}

const mappings: readonly McsMapAnswerMapping[] = [
  {
    sectionId: 'impella-suction-purge-rv',
    targets: [
      { optionId: 'returns-to-pa', segmentIds: ['pulmonary-artery'] },
      { optionId: 'returns-to-aorta', segmentIds: ['ascending-aorta'] },
      { optionId: 'returns-to-ra', segmentIds: ['right-atrium'] },
    ],
  },
  {
    sectionId: 'mcs-device-selection-integration',
    targets: [
      { optionId: 'right-sided', segmentIds: ['right-ventricle', 'right-atrium'] },
      { optionId: 'left-sided', segmentIds: ['left-ventricle'] },
      { optionId: 'afterload', segmentIds: ['descending-aorta', 'systemic-bed'] },
    ],
  },
]

export const mcsMapAnswerMappings: readonly McsMapAnswerMapping[] = Object.freeze(mappings)

export function mcsMapAnswerTargets(sectionId: string): readonly McsMapAnswerTarget[] | null {
  return mappings.find((mapping) => mapping.sectionId === sectionId)?.targets ?? null
}

export function mcsMapAnswerSectionIds(): readonly string[] {
  return mappings.map((mapping) => mapping.sectionId)
}

/** A mapping must be total over the section's identification options, and every place must exist. */
export function validateMcsMapAnswerMappings(): string[] {
  const errors: string[] = []
  for (const mapping of mappings) {
    const contract = mcsSectionLearningContractById.get(mapping.sectionId)
    if (!contract) {
      errors.push(`${mapping.sectionId}: no section contract`)
      continue
    }
    const optionIds = contract.recognizeOptions.map((option) => option.id)
    const mapped = mapping.targets.map((target) => target.optionId)
    for (const optionId of optionIds) {
      if (!mapped.includes(optionId)) {
        errors.push(`${mapping.sectionId}: option ${optionId} has no place on the map`)
      }
    }
    for (const target of mapping.targets) {
      if (!optionIds.includes(target.optionId)) {
        errors.push(
          `${mapping.sectionId}: a place for an option that does not exist (${target.optionId})`,
        )
      }
      if (target.segmentIds.length === 0) {
        errors.push(`${mapping.sectionId}: ${target.optionId} names no segment`)
      }
      for (const segment of target.segmentIds) {
        if (!(mcsMapSegmentIds as readonly string[]).includes(segment)) {
          errors.push(`${mapping.sectionId}: ${target.optionId} names unknown segment ${segment}`)
        }
      }
    }
    const firstSegments = mapping.targets.map((target) => target.segmentIds[0])
    if (new Set(firstSegments).size !== firstSegments.length) {
      errors.push(`${mapping.sectionId}: two options pin the same place`)
    }
  }
  return errors
}

const mapAnswerErrors = validateMcsMapAnswerMappings()
if (mapAnswerErrors.length > 0) {
  throw new Error(`Invalid MCS map answer mappings:\n- ${mapAnswerErrors.join('\n- ')}`)
}
