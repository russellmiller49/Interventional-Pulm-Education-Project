import { allBoardModules } from 'contentlayer/generated'

import { boardReviewCategoryLabels } from '@/data/board-review'

export function getBoardModules() {
  return allBoardModules
    .filter((module) => module.order > 0)
    .slice()
    .sort((a, b) => a.order - b.order)
}

export function getBoardModuleSlugs() {
  return getBoardModules().map((module) => module.slug)
}

export function getBoardModuleBySlug(slug: string) {
  return allBoardModules.find((module) => module.slug === slug) ?? null
}

export function searchBoardModules(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return getBoardModules()
  }

  return getBoardModules().filter((module) => {
    const haystack = [
      module.title,
      module.summary,
      module.description,
      boardReviewCategoryLabels[module.category as keyof typeof boardReviewCategoryLabels] ?? module.category,
      ...module.examDomains,
      ...module.tags,
      ...module.focus,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalized)
  })
}

