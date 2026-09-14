import { BRONCH_SECTIONS } from '../../src/features/bronchoscopy-foundations/content/sections'
import { validateAllSections } from '../../src/features/bronchoscopy-foundations/content/sectionValidation'
import { validateBronchPathway } from '../../src/features/bronchoscopy-foundations/content/pathway'
import { validateBronchStageItems } from '../../src/features/bronchoscopy-foundations/content/stageItems'
import { validateBronchStageLessons } from '../../src/features/bronchoscopy-foundations/content/stageLessons'

const errors = [
  ...validateAllSections(BRONCH_SECTIONS),
  ...validateBronchPathway(),
  ...validateBronchStageItems(),
  ...validateBronchStageLessons(),
]
if (errors.length) throw new Error(errors.join('\n'))
console.log(
  `Validated ${BRONCH_SECTIONS.length} sections, canonical pathway, item registry and course flows: 0 errors.`,
)
