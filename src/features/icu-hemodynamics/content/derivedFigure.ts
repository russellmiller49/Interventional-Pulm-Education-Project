import type { DerivedMetricId } from './derivedMetrics'
import { derivedMetricRecords } from './derivedMetrics'

/**
 * Which calculated value the derived-values section draws beside a task.
 *
 * The section's first task reads the values one page at a time, and the drawing is that page's
 * value. Its first question and the explanation after it are about systemic vascular resistance
 * (`pac-derived-predict-1`); the question about a new patient and its explanation are about
 * pulse-pressure variation (`pac-derived-transfer-1`). Beside a question or an explanation the
 * drawing shows how the value is built and no numbers: the question is about a patient the
 * drawing's worked episode does not describe.
 */
export function derivedFigureMetricId(
  phase: string,
  readingPart: string | undefined,
): DerivedMetricId {
  if (readingPart?.startsWith('metric:')) return readingPart.slice(7) as DerivedMetricId
  if (phase === 'transfer') return 'pulsePressureVariationPercent'
  if (phase === 'predict' || phase === 'explain') return 'systemicVascularResistance'
  return derivedMetricRecords[0].id
}

/** The two worked episodes the section's reading compares: one complete, one missing body size. */
export const DERIVED_READING_EPISODE_ID = 'ep-assumed-vo2'
export const DERIVED_READING_COMPARISON_EPISODE_ID = 'ep-missing-bsa'
