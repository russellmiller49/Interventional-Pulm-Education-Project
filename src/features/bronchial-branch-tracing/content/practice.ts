import { makeExercise } from './phantoms'

// Separate mathematical arrangements, not independent patient cases.
export const PRACTICE_EXERCISES = [
  makeExercise('horizontal-oblique', 7),
  makeExercise('vertical', 8),
  makeExercise('reversal', 9),
  makeExercise('variant', 10, 'uncertainty'),
]
export const ASSESS_EXERCISES = [
  makeExercise('horizontal-vertical', 8),
  makeExercise('variant', 11),
  makeExercise('horizontal-horizontal', 9),
  makeExercise('variant', 12, 'uncertainty'),
]
