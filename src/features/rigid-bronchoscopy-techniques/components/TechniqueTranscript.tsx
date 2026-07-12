import { techniqueCopy } from '@/features/rigid-bronchoscopy-techniques/components/techniqueCopy'

/**
 * Transcript panel. Uses a native <details> element so it works without
 * JavaScript. Paragraphs are separated by blank lines in `text`.
 */
export function TechniqueTranscript({ text }: { text?: string }) {
  const paragraphs = text
    ?.split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <details className="rounded-lg border border-border/60 bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium text-foreground">
        {techniqueCopy.transcriptSummary}
      </summary>
      <div className="mt-2 space-y-2 leading-6 text-muted-foreground">
        {paragraphs && paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
        ) : (
          <p>{techniqueCopy.transcriptUnavailable}</p>
        )}
      </div>
    </details>
  )
}
