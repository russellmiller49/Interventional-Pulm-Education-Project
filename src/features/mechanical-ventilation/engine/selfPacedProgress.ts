import { ventilationLearningUnits } from '../content/learningCurriculum'
import { mechanicalVentilationCaseById } from '../content/runtimeCases'

// Separate from every legacy answer, attempt, replay and score record. No migration by inference.
export const VENTILATION_SELF_PACED_KEY = 'mechanical-ventilation-self-paced-v1'
export interface VentilationLocation {
  section: 'learn' | 'practice' | 'assess'
  id: string
  step: number
}
export interface VentilationSelfPacedProgress {
  version: 1
  visited: readonly string[]
  location?: VentilationLocation
}
export const emptySelfPacedProgress = (): VentilationSelfPacedProgress => ({
  version: 1,
  visited: [],
})
const topicExists = (id: string) =>
  ventilationLearningUnits.some((unit) => unit.id === id) || mechanicalVentilationCaseById.has(id)

export function parseSelfPacedProgress(raw: string | null): VentilationSelfPacedProgress {
  try {
    const value = JSON.parse(raw ?? 'null')
    if (value?.version !== 1 || !Array.isArray(value.visited)) return emptySelfPacedProgress()
    const visited = [
      ...new Set<string>(
        value.visited.filter((id: unknown) => typeof id === 'string' && topicExists(id)),
      ),
    ]
    const location = value.location
    const validLocation =
      location &&
      ['learn', 'practice', 'assess'].includes(location.section) &&
      typeof location.id === 'string' &&
      topicExists(location.id) &&
      Number.isInteger(location.step) &&
      location.step >= 0 &&
      location.step < 40
    return {
      version: 1,
      visited,
      ...(validLocation
        ? { location: { section: location.section, id: location.id, step: location.step } }
        : {}),
    }
  } catch {
    return emptySelfPacedProgress()
  }
}

export function visitVentilationLocation(
  progress: VentilationSelfPacedProgress,
  location: VentilationLocation,
): VentilationSelfPacedProgress {
  return parseSelfPacedProgress(
    JSON.stringify({ version: 1, visited: [...progress.visited, location.id], location }),
  )
}
