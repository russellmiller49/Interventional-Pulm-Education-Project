'use client'

import type { ModuleSection } from '../engine'
import { EcmoPracticeActivity } from './practice/EcmoPracticeActivity'
import { EcmoLessonStage } from './stage/EcmoLessonStage'

interface CardiohelpWorkbenchProps {
  section: ModuleSection
  locale?: string
}

/**
 * Learn renders the lesson stage; Practice and Challenge render the case activity. The split is a
 * plain branch above any hook so each surface owns exactly one simulation session.
 */
export function CardiohelpWorkbench({ section, locale = 'en' }: CardiohelpWorkbenchProps) {
  if (section === 'learn') return <EcmoLessonStage locale={locale} />
  return <EcmoPracticeActivity section={section} locale={locale} />
}
