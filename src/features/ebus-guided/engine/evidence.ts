import type { EbusObservation } from '@/lib/ebus-guided-bridge'
import type { Lab, Question } from '../content/types'
import { labGoalMet } from '../content/types'

/** Metadata never substitutes for the current, mounted workbench's actual retained frame. */
export function retainedImageAvailable(
  question: Question,
  lab: Lab | undefined,
  retained: EbusObservation | null,
  current: EbusObservation,
): boolean {
  if (question.imagePolicy !== 'retained-acquisition') return true
  if (!lab || !retained || !current.ready || !current.frameReady || !labGoalMet(lab, retained))
    return false
  if (retained.acquisitionSession !== current.acquisitionSession) return false
  if (lab.kind === 'knobology')
    return (
      !!retained.recorded?.held &&
      !!current.recorded?.held &&
      retained.recorded.frameId === current.recorded.frameId &&
      retained.recorded.sessionId === current.recorded.sessionId &&
      retained.recorded.taskId === lab.goal
    )
  if (lab.linkedLesson)
    return (
      !!retained.linked?.source &&
      retained.linked.frameId === current.linked?.frameId &&
      retained.linked.source.sessionId === current.linked?.source?.sessionId &&
      retained.linked.source.taskId === current.linked?.source?.taskId
    )
  if (lab.modelPackage)
    return (
      !!retained.model?.frameId &&
      retained.model.frameId === current.model?.frameId &&
      retained.model.revision === current.model?.revision
    )
  return false
}
