import { techniqueCopy } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'
import type { ChapterMarker } from '@/features/rigid-bronchoscopy-techniques/types'

function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

/** Static chapter markers for a clip. Renders nothing when there are no chapters. */
export function TechniqueChapterList({ chapters }: { chapters?: ChapterMarker[] }) {
  if (!chapters || chapters.length === 0) {
    return null
  }

  return (
    <nav aria-label={techniqueCopy.chaptersHeading}>
      <p className="text-sm font-semibold text-foreground">{techniqueCopy.chaptersHeading}</p>
      <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
        {chapters.map((chapter) => (
          <li key={chapter.id} className="flex gap-3">
            <span className="tabular-nums text-foreground/70">
              {formatTimestamp(chapter.startSeconds)}
            </span>
            <span>{chapter.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
