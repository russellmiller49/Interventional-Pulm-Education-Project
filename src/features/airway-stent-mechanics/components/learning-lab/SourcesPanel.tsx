import { ExternalLink, Info } from 'lucide-react'

import { evidenceRegistry, resolveEvidenceReferences } from '../../content/evidenceRegistry'
import type { EvidenceReference } from '../../engine/learningLabTypes'

interface SourcesPanelProps {
  disclaimer: string
  evidenceIds: readonly string[]
  limitations: readonly string[]
}

function SourceCard({ reference }: { reference: EvidenceReference }) {
  return (
    <article className="rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
        <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-cyan-800 dark:text-cyan-200">
          {reference.sourceType.replaceAll('-', ' ')}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          {reference.applicability.replaceAll('-', ' ')}
        </span>
        <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-indigo-800 dark:text-indigo-200">
          {reference.claimScope.replaceAll('-', ' ')}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-foreground">{reference.citation}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        <strong className="text-foreground">Boundary:</strong> {reference.transferLimitation}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        Verified {reference.verifiedOn}
        {reference.clinicalReviewNote ? ` · ${reference.clinicalReviewNote}` : ''}
      </p>
      <a
        href={reference.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        Open source
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </article>
  )
}

export function SourcesPanel({ disclaimer, evidenceIds, limitations }: SourcesPanelProps) {
  const lessonReferences = resolveEvidenceReferences([...new Set(evidenceIds)])

  return (
    <aside className="space-y-4" aria-label="Evidence and educational limitations">
      <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-foreground sm:p-6">
        <p className="flex items-center gap-2 font-semibold">
          <Info className="h-5 w-5 text-amber-600" aria-hidden />
          Educational boundary
        </p>
        <p className="mt-2 text-muted-foreground">{disclaimer}</p>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
          {limitations.map((limitation) => (
            <li key={limitation} className="flex gap-2">
              <span className="text-amber-600" aria-hidden>
                •
              </span>
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
      </div>

      <details className="group rounded-3xl border bg-card shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500 sm:px-6">
          <span className="flex items-center justify-between gap-4">
            Evidence for this lesson
            <span className="text-xs font-normal text-muted-foreground">
              {lessonReferences.length} source{lessonReferences.length === 1 ? '' : 's'}
            </span>
          </span>
        </summary>
        <div className="grid gap-3 border-t p-5 sm:p-6 lg:grid-cols-2">
          {lessonReferences.map((reference) => (
            <SourceCard key={reference.id} reference={reference} />
          ))}
        </div>
      </details>

      <details className="group rounded-3xl border bg-card shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500 sm:px-6">
          Full evidence registry
        </summary>
        <div className="grid gap-3 border-t p-5 sm:p-6 lg:grid-cols-2">
          {evidenceRegistry.map((reference) => (
            <SourceCard key={reference.id} reference={reference} />
          ))}
        </div>
      </details>
    </aside>
  )
}
