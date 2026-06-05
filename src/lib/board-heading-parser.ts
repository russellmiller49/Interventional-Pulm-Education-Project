import { slugify } from '@/lib/slugify'

/**
 * Pure, dependency-free mirror of the section-heading detection in
 * `board-review-loader.ts` (which can't be imported in tests because it pulls in
 * `contentlayer/generated`). Used by the per-module board-bridge guard tests to
 * assert that the section ids a Learn page relies on still parse from the source
 * MDX — so a future content edit that renames or reflows a heading fails CI.
 *
 * Keep this in sync with `board-review-loader.ts`'s `isSectionHeading` /
 * `parseBoardReviewContent`.
 */

export function isBoardSectionHeading(line: string): boolean {
  if (!line) return false
  if (line.length > 85) return false
  if (/^\d/.test(line)) return false
  if (/[.?!]$/.test(line)) return false
  if (/[_|]/.test(line)) return false
  if (!/[A-Za-z]/.test(line)) return false
  const words = line.split(/\s+/)
  if (words.length > 1) {
    const uppercaseStarts = words.filter((word) => /^[A-Z(]/.test(word))
    if (!uppercaseStarts.length) return false
  }
  return true
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return raw
  return raw.slice(raw.indexOf('\n', end + 1) + 1)
}

/** Return the set of slug ids the board-review parser would produce for `raw`. */
export function parseBoardSectionIds(raw: string): Set<string> {
  const lines = stripFrontmatter(raw.replace(/\r\n/g, '\n')).split('\n')
  let index = 0
  while (index < lines.length && !lines[index].trim()) index++
  if (index < lines.length && lines[index].trim()) index++ // skip the title line

  const ids = new Set<string>()
  let currentTitle: string | null = null
  let buffer: string[] = []
  let previousLineBlank = true

  const flush = () => {
    if (currentTitle && buffer.join('\n').trim()) {
      ids.add(slugify(currentTitle))
    }
  }

  for (; index < lines.length; index++) {
    const trimmed = lines[index].trim()
    const nextLineBlank = index + 1 >= lines.length || !lines[index + 1].trim()
    if (isBoardSectionHeading(trimmed) && previousLineBlank && nextLineBlank) {
      flush()
      currentTitle = trimmed
      buffer = []
    } else {
      buffer.push(lines[index])
    }
    previousLineBlank = trimmed.length === 0
  }
  flush()

  return ids
}
