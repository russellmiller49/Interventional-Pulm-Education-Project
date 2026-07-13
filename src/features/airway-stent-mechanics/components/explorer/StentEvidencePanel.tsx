import { ExternalLink, FileCheck2, ShieldAlert } from 'lucide-react'

import { resolveEvidenceReferences } from '../../content/evidenceRegistry'
import type { StentExplorerStation } from '../../explorer/types'

interface StentEvidencePanelProps {
  onSourceOpen?: (sourceId: string) => void
  revealed: boolean
  station: StentExplorerStation
}

export const STENT_EXPLORER_PRECOMMIT_EVIDENCE_BOUNDARY =
  'This qualitative preview does not provide a patient-specific prediction, sizing rule, device ranking, complication probability, or unsupervised procedural instruction. Commit or skip to reveal the station-specific evidence limits.'

export function StentEvidencePanel({ onSourceOpen, revealed, station }: StentEvidencePanelProps) {
  const references = resolveEvidenceReferences(station.evidenceRefs)

  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm" aria-label="Evidence">
      <div className="border-b bg-muted/25 p-5 sm:p-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700 dark:text-cyan-200">
          <FileCheck2 className="h-4 w-4" aria-hidden />
          Evidence beside the scene
        </p>
        <h3 className="mt-2 text-xl font-bold">What supports this station</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {revealed
            ? station.evidenceNote
            : 'Source citations and a general qualitative-model boundary remain available before prediction. Commit or skip to reveal the station-specific synthesis and transfer limits.'}
        </p>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
            Evidence boundary
          </p>
          <p className="mt-2 text-muted-foreground">
            {revealed ? station.evidenceBoundary : STENT_EXPLORER_PRECOMMIT_EVIDENCE_BOUNDARY}
          </p>
        </div>

        <ul className="grid gap-3">
          {references.map((reference) => (
            <li key={reference.id} className="rounded-2xl border bg-background p-4">
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-800 dark:text-cyan-200">
                  {reference.sourceType.replaceAll('-', ' ')}
                </span>
                <span className="rounded-full bg-muted px-2 py-1">
                  {reference.supportLevel?.replaceAll('-', ' ') ?? reference.claimScope}
                </span>
                {reference.sourcePages?.length ? (
                  <span className="rounded-full border px-2 py-1">
                    Pages {reference.sourcePages.join(', ')}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6">{reference.citation}</p>
              {revealed ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {reference.transferLimitation}
                </p>
              ) : null}
              {reference.url ? (
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onSourceOpen?.(reference.id)}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Open source
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : (
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  Authoring source · not distributed with this module
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
