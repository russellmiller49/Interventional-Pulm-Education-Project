import { curriculumSections } from '../curriculum'
import { assertSections } from '../sectionValidation'
import type { ThoracoscopySectionId } from '../sectionIds'
import type { ThoracoscopySectionSpec } from '../types'
import { section as fourControls } from './four-controls'
import { section as normalPleuralSpace } from './normal-pleural-space'
import { section as systematicSurvey } from './systematic-survey'

/**
 * The written sections, in the course order, checked together as this file loads. A section that
 * breaks the authoring contract fails the build here, before any page reads it.
 *
 * A section is listed here exactly when the curriculum says it is written or available: a spec
 * with no state would never be shown, and a state with no spec would open an empty lesson.
 */
export const WRITTEN_SECTIONS: readonly ThoracoscopySectionSpec[] = [
  normalPleuralSpace,
  fourControls,
  systematicSurvey,
]

const written = curriculumSections
  .filter((section) => section.state !== 'in-preparation')
  .map((section) => section.id)
if (written.join() !== WRITTEN_SECTIONS.map((section) => section.id).join()) {
  throw new Error(
    `Medical Thoracoscopy sections: the curriculum marks ${written.join(', ') || 'none'} as written, and the specs are ${WRITTEN_SECTIONS.map((section) => section.id).join(', ')}`,
  )
}

assertSections(WRITTEN_SECTIONS)

const byId = new Map(WRITTEN_SECTIONS.map((section) => [section.id, section] as const))

export function writtenSection(id: ThoracoscopySectionId): ThoracoscopySectionSpec | null {
  return byId.get(id) ?? null
}
