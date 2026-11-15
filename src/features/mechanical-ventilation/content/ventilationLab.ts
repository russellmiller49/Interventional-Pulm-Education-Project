import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'

/**
 * The open lab's route and the one paragraph that says what it is for. Practice links to it and
 * the lab page opens with the same paragraph (author's ruling, 2026-11-15, "Link the lab from
 * Practice"). It is the one host that keeps the old lung panel on the Graphics screen (ruling of
 * 2026-11-12, "Hide it in cases, keep it in the lab").
 */
export const MECHANICAL_VENTILATION_LAB_HREF = `${mechanicalVentilationNavBase}/practice/lab`

export const MECHANICAL_VENTILATION_LAB_SUMMARY =
  'Free exploration on the full console: any case, on any console, with any setting. Its Graphics screen also shows the simplified dynamic lung panel, which reads out compliance, the resistive gap and the patient’s effort. The sections and cases leave that panel off, so that you read those from the traces.'
