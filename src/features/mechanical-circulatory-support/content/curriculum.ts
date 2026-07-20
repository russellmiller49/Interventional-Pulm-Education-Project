import type { McsDeviceKind } from '../engine/types'
import { mcsLessons } from './lessons'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from './scenarios'

export const mcsFoundationLessonIds = mcsLessons
  .filter((lesson) => lesson.device === 'shared')
  .map((lesson) => lesson.id)

export function mcsDeviceLessonIds(device: McsDeviceKind): readonly string[] {
  return mcsLessons.filter((lesson) => lesson.device === device).map((lesson) => lesson.id)
}

export function mcsDevicePracticeCaseIds(device: McsDeviceKind): readonly string[] {
  return mcsPracticeScenarios
    .filter((scenario) => scenario.device === device)
    .map((scenario) => scenario.id)
}

export function mcsCapstoneId(device: McsDeviceKind): string {
  const scenario = mcsCapstoneScenarios.find((candidate) => candidate.device === device)
  if (!scenario) throw new Error(`Missing MCS capstone for ${device}`)
  return scenario.id
}

export interface McsProgressLike {
  completedLessonIds: readonly string[]
  masteredCaseIds: readonly string[]
}

export function isMcsCapstoneUnlocked(progress: McsProgressLike, device: McsDeviceKind): boolean {
  const lessons = new Set(progress.completedLessonIds)
  const cases = new Set(progress.masteredCaseIds)
  return (
    [...mcsFoundationLessonIds, ...mcsDeviceLessonIds(device)].every((id) => lessons.has(id)) &&
    mcsDevicePracticeCaseIds(device).every((id) => cases.has(id))
  )
}

export function remainingMcsCapstoneRequirements(
  progress: McsProgressLike,
  device: McsDeviceKind,
): readonly string[] {
  const lessons = new Set(progress.completedLessonIds)
  const cases = new Set(progress.masteredCaseIds)
  return [
    ...[...mcsFoundationLessonIds, ...mcsDeviceLessonIds(device)].filter((id) => !lessons.has(id)),
    ...mcsDevicePracticeCaseIds(device).filter((id) => !cases.has(id)),
  ]
}
