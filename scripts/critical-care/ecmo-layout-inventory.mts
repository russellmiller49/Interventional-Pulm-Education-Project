import { criticalCareLearningPathway } from '../../src/features/critical-care/content/learningPathways'
import { isEcmoInteractiveFoundationSectionId } from '../../src/features/cardiohelp-ecmo/content/foundationLessonRuntime'
import { buildFoundationStageLesson } from '../../src/features/cardiohelp-ecmo/components/stage/adapters/foundationStageAdapter'
import {
  buildDrillStageLesson,
  resolveGuidedLesson,
} from '../../src/features/cardiohelp-ecmo/components/stage/adapters/drillStageAdapter'
import { ecmoTaskPresentation } from '../../src/features/cardiohelp-ecmo/components/stage/activityPresentation'
const sections = []
for (const track of ['vv', 'va'] as const)
  for (const section of criticalCareLearningPathway('cardiohelp-ecmo', track).sections) {
    const lesson = isEcmoInteractiveFoundationSectionId(section.id)
      ? buildFoundationStageLesson(section.id, track)
      : buildDrillStageLesson(resolveGuidedLesson(section.id), track)
    sections.push({
      id: section.id,
      title: section.title,
      track,
      steps: lesson.steps.map((step) => ({
        id: step.id,
        title: step.title,
        phase: step.phase,
        presentation: ecmoTaskPresentation(lesson, step),
        layout: ecmoTaskPresentation(lesson, step) ? 'FLOWING' : 'FIXED',
      })),
    })
  }
console.log(JSON.stringify(sections, null, 2))
