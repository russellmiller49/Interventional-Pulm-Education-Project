'use client'

import { DrillStageHost } from './DrillStageHost'

/**
 * The Learn stage: one surface for every section of the pathway.
 *
 * Drills render through the drill host over the shared session core. The foundation sections join
 * the same stage in the next increment; until then the route still renders them through their own
 * activity, so the stage is reached only for drill ids.
 */
export function EcmoLessonStage({ locale = 'en' }: { readonly locale?: string }) {
  return <DrillStageHost locale={locale} />
}
