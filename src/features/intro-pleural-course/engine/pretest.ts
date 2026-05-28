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

export interface SectionDelta {
  section: PleuralSection
  pretestPercent: number
  posttestPercent: number | null
  delta: number | null
  posttestAnswered: number
  total: number
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

export function comparePretestPosttest(
  pretestAnswers: Record<string, string | undefined>,
  posttestAnswers: Record<string, string | undefined>,
  items: readonly PretestItem[],
): SectionDelta[] {
  const pretest = scorePretest(pretestAnswers, items)
  const posttestBySection = new Map<PleuralSection, { correct: number; answered: number }>()

  for (const item of items) {
    const existing = posttestBySection.get(item.section) ?? { correct: 0, answered: 0 }
    const answer = posttestAnswers[item.id]

    posttestBySection.set(item.section, {
      correct: existing.correct + (answer === item.correctId ? 1 : 0),
      answered: existing.answered + (answer ? 1 : 0),
    })
  }

  return pretest.sectionScores.map((sectionScore) => {
    const posttest = posttestBySection.get(sectionScore.section) ?? { correct: 0, answered: 0 }
    const posttestPercent =
      posttest.answered === sectionScore.total
        ? Math.round((posttest.correct / sectionScore.total) * 100)
        : null

    return {
      section: sectionScore.section,
      pretestPercent: sectionScore.percent,
      posttestPercent,
      delta: posttestPercent === null ? null : posttestPercent - sectionScore.percent,
      posttestAnswered: posttest.answered,
      total: sectionScore.total,
    }
  })
}
