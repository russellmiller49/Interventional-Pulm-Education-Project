import { allBoardModules } from 'contentlayer/generated'

import type { BoardModule } from 'contentlayer/generated'
import { boardReviewCategoryLabels, type BoardReviewChapterMeta } from '@/data/board-review'
import { slugify } from '@/lib/slugify'

export interface BoardReviewSection {
  id: string
  title: string
  content: string
}

export interface BoardReviewChapter extends BoardReviewChapterMeta {
  intro: string
  sections: BoardReviewSection[]
  highYield: string[]
  examScope?: string
  wordCount: number
  readingMinutes: number
}

export function listBoardReviewChapters(): BoardReviewChapterMeta[] {
  return allBoardModules
    .map((module) => ({
      slug: module.slug,
      title: module.title,
      description: module.description,
      summary: module.summary,
      category: module.category as BoardReviewChapterMeta['category'],
      estimatedMinutes: module.estimatedMinutes,
      examDomains: module.examDomains,
      tags: module.tags,
      focus: module.focus,
      sourceFile: module._raw.sourceFileName,
      order: module.order,
      published: true as const,
    }))
    .sort((a, b) => a.order - b.order)
}

export function loadBoardReviewChapter(slug: string): BoardReviewChapter | null {
  const boardModule = allBoardModules.find((item) => item.slug === slug)

  if (!boardModule) {
    return null
  }

  const rawContent = boardModule.body.raw
  const parsed = parseBoardReviewContent(rawContent)
  const highYield = extractHighYieldPoints(parsed.sections)
  const examScope = extractExamScope(parsed.sections) ?? parsed.intro
  const wordCount = countWords(rawContent)
  const readingMinutes = Math.max(boardModule.estimatedMinutes, Math.ceil(wordCount / 225))

  return {
    slug: boardModule.slug,
    title: boardModule.title,
    summary: boardModule.summary,
    description: boardModule.description,
    category: boardModule.category as BoardReviewChapterMeta['category'],
    estimatedMinutes: boardModule.estimatedMinutes,
    examDomains: boardModule.examDomains,
    tags: boardModule.tags,
    focus: boardModule.focus,
    sourceFile: boardModule._raw.sourceFileName,
    order: boardModule.order,
    published: true,
    intro: parsed.intro,
    sections: parsed.sections,
    highYield,
    examScope,
    wordCount,
    readingMinutes,
  }
}

export function groupBoardModulesByCategory() {
  const modules = allBoardModules.slice().sort((a, b) => a.order - b.order)
  return modules.reduce<Record<string, BoardModule[]>>((acc, module) => {
    const label = boardReviewCategoryLabels[module.category as keyof typeof boardReviewCategoryLabels] ?? module.category
    if (!acc[label]) {
      acc[label] = []
    }
    acc[label].push(module)
    return acc
  }, {})
}

function parseBoardReviewContent(raw: string): { intro: string; sections: BoardReviewSection[] } {
  const normalized = raw.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  let index = 0
  while (index < lines.length && !lines[index].trim()) {
    index++
  }

  // Skip top-level title line if present
  if (index < lines.length && lines[index].trim()) {
    index++
  }

  const introLines: string[] = []
  const sections: BoardReviewSection[] = []
  let currentTitle: string | null = null
  let buffer: string[] = []
  let previousLineBlank = true

  for (; index < lines.length; index++) {
    const line = lines[index]
    const trimmed = line.trim()
    const nextLineBlank = index + 1 >= lines.length || !lines[index + 1].trim()

    if (isSectionHeading(trimmed) && previousLineBlank && nextLineBlank) {
      if (currentTitle) {
        const content = buffer.join('\n').trim()
        if (content) {
          sections.push({
            id: slugify(currentTitle),
            title: currentTitle,
            content,
          })
        }
      } else if (buffer.length) {
        introLines.push(buffer.join('\n').trim())
      }

      currentTitle = trimmed
      buffer = []
    } else {
      buffer.push(line)
    }

    previousLineBlank = trimmed.length === 0
  }

  if (currentTitle) {
    const content = buffer.join('\n').trim()
    if (content) {
      sections.push({
        id: slugify(currentTitle),
        title: currentTitle,
        content,
      })
    }
  } else if (buffer.length) {
    introLines.push(buffer.join('\n').trim())
  }

  const intro = introLines.join('\n\n').trim()

  return {
    intro: formatMermaidDiagrams(formatTabSeparatedTables(intro)),
    sections: sections.map((section) => ({
      ...section,
      content: formatMermaidDiagrams(formatTabSeparatedTables(section.content)),
    })),
  }
}

function isSectionHeading(line: string) {
  if (!line) {
    return false
  }

  if (line.length > 85) {
    return false
  }

  if (/^\d/.test(line)) {
    return false
  }

  if (/[.?!]$/.test(line)) {
    return false
  }

  if (/[_|]/.test(line)) {
    return false
  }

  if (!/[A-Za-z]/.test(line)) {
    return false
  }

  const words = line.split(/\s+/)
  if (words.length > 1) {
    const uppercaseStarts = words.filter((word) => /^[A-Z(]/.test(word))
    if (!uppercaseStarts.length) {
      return false
    }
  }

  return true
}

function extractHighYieldPoints(sections: BoardReviewSection[]) {
  const target = sections.find((section) => section.title.toLowerCase().includes('high-yield'))

  if (!target) {
    return []
  }

  return target.content
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !isSectionHeading(line) &&
        !line.startsWith('|') &&
        !line.startsWith('```') &&
        !/^[-:]{2,}$/.test(line),
    )
    .slice(0, 8)
}

function extractExamScope(sections: BoardReviewSection[]) {
  const target = sections.find((section) => /exam mapping/i.test(section.title))

  if (!target) {
    return undefined
  }

  const firstParagraph = target.content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' ')

  return firstParagraph
}

function countWords(content: string) {
  return content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function formatTabSeparatedTables(content: string) {
  if (!content.includes('\t')) {
    return content
  }

  const lines = content.split('\n')
  const formatted: string[] = []
  let buffer: string[] = []

  const flush = () => {
    if (!buffer.length) {
      return
    }

    const rows = buffer
      .map((row) =>
        row
          .split('\t')
          .map((cell) => cell.trim())
          .map((cell) => cell.replace(/\s+/g, ' ')),
      )
      .filter((cells) => cells.some((cell) => cell.length))

    if (!rows.length) {
      buffer = []
      return
    }

    const columnCount = Math.max(...rows.map((cells) => cells.length))
    const normalizedRows = rows.map((cells) => {
      if (cells.length < columnCount) {
        return [...cells, ...Array(columnCount - cells.length).fill('')]
      }
      return cells
    })

    const header = normalizedRows[0]
    const separator = Array(columnCount).fill('---')
    const body = normalizedRows.slice(1)

    formatted.push(
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...body.map((cells) => `| ${cells.join(' | ')} |`),
    )

    buffer = []
  }

  for (const line of lines) {
    if (line.includes('\t')) {
      buffer.push(line)
    } else {
      flush()
      formatted.push(line)
    }
  }

  flush()

  return formatted.join('\n')
}

function formatMermaidDiagrams(content: string) {
  if (!/flowchart\s+/i.test(content)) {
    return content
  }

  const lines = content.split('\n')
  const formatted: string[] = []
  let inDiagram = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '```mermaid') {
      formatted.push(line)
      inDiagram = true
      continue
    }

    if (inDiagram) {
      formatted.push(line)
      if (trimmed === '```') {
        inDiagram = false
      }
      continue
    }

    if (/^flowchart\s+/i.test(trimmed)) {
      formatted.push('```mermaid')
      formatted.push(line)
      inDiagram = true
      continue
    }

    formatted.push(line)
  }

  if (inDiagram) {
    formatted.push('```')
  }

  return formatted.join('\n')
}
