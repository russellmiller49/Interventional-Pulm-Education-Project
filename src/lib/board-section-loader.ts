import { loadBoardReviewChapter, type BoardReviewSection } from '@/lib/board-review-loader'

/**
 * Board-prose bridge for the learning modules.
 *
 * `loadBoardReviewChapter` parses each board chapter into stable, slug-keyed
 * sections. A module's Learn page selects only the sections it wants to surface
 * (e.g. the ultrasound-guided technique + the diagnostic algorithm) and renders
 * them with MarkdownContent — no need to split the MDX files.
 *
 * Server-only: this transitively imports `contentlayer/generated` and reads from
 * disk, so call it from server components (e.g. `learn/page.tsx`).
 *
 * Returns the requested sections in the requested order, silently skipping any
 * id that does not resolve (defensive against heading-parser drift — a unit test
 * guards that the ids we rely on still parse).
 */
export function getBoardSections(slug: string, ids: readonly string[]): BoardReviewSection[] {
  const chapter = loadBoardReviewChapter(slug)
  if (!chapter) {
    return []
  }

  const byId = new Map(chapter.sections.map((section) => [section.id, section]))

  return ids
    .map((id) => byId.get(id))
    .filter((section): section is BoardReviewSection => Boolean(section))
}
