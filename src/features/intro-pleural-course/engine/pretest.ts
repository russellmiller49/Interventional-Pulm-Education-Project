import type { PleuralSection } from '@/features/pleural-procedures/content/types'

import { introPleuralModules } from './moduleRegistry'
import type { PretestItem } from '../content/pretestItems'

export interface PretestScore {
  section: PleuralSection
  correct: number
  total: number
  percent: number
}

export interface PretestResult {
  totalCorrect: number
  total: number
  sectionScores: PretestScore[]
  prescription: {
    section: PleuralSection
    percent: number
    modules: typeof introPleuralModules
  }[]
}

export function scorePretest(
  answers: Record<string, string | undefined>,
  items: readonly PretestItem[],
): PretestResult {
  const sections = new Map<PleuralSection, { correct: number; total: number }>()
  let totalCorrect = 0

  for (const item of items) {
    const existing = sections.get(item.section) ?? { correct: 0, total: 0 }
    const isCorrect = answers[item.id] === item.correctId

    sections.set(item.section, {
      correct: existing.correct + (isCorrect ? 1 : 0),
      total: existing.total + 1,
    })

    if (isCorrect) {
      totalCorrect += 1
    }
  }

  const sectionScores = [...sections.entries()].map(([section, score]) => ({
    section,
    correct: score.correct,
    total: score.total,
    percent: score.total ? Math.round((score.correct / score.total) * 100) : 0,
  }))

  const prescription = [...sectionScores]
    .sort((a, b) => a.percent - b.percent || a.section.localeCompare(b.section))
    .map((score) => ({
      section: score.section,
      percent: score.percent,
      modules: introPleuralModules.filter((module) => module.section === score.section),
    }))

  return {
    totalCorrect,
    total: items.length,
    sectionScores,
    prescription,
  }
}
