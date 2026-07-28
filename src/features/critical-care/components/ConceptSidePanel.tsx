'use client'

import type { Route } from 'next'
import { useEffect, useRef } from 'react'
import { ExternalLink, X } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { criticalCareConceptById, type CriticalCareConcept } from '../content/concepts'
import { resolveCriticalCareEvidence } from '../content/evidenceRegistry'

export function ConceptSidePanel({
  concept,
  onClose,
}: {
  readonly concept: CriticalCareConcept
  readonly onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const related = concept.relatedConceptIds.flatMap((conceptId) => {
    const item = criticalCareConceptById.get(conceptId)
    return item ? [item] : []
  })
  const evidence = resolveCriticalCareEvidence(concept.evidenceIds)

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[90]" role="presentation">
      <button
        type="button"
        aria-label="Close concept panel"
        tabIndex={-1}
        className="absolute inset-0 bg-slate-950/55"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="concept-panel-title"
        className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Concept refresher
            </p>
            <h2 id="concept-panel-title" className="mt-2 text-2xl font-semibold">
              {concept.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-full border"
            aria-label="Close concept panel"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-6 leading-7 text-muted-foreground">{concept.shortExplanation}</p>

        {concept.threadId ? (
          <p className="mt-5 rounded-xl bg-primary/10 p-3 text-sm text-primary">
            Recurring thread: {concept.threadId.replace('thread.', '').replaceAll('-', ' ')}
          </p>
        ) : null}

        <section className="mt-8" aria-labelledby="concept-panel-related">
          <h3 id="concept-panel-related" className="font-semibold">
            Connected ideas
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {related.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground"> · {item.id}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="concept-panel-citations">
          <h3 id="concept-panel-citations" className="font-semibold">
            Citation records
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {evidence.map((record) => (
              <li key={record.id} className="rounded-xl border p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {record.claimType.replaceAll('-', ' ')}
                </span>
                <strong className="mt-1 block text-foreground">{record.title}</strong>
                <span className="mt-1 block leading-6">{record.citation}</span>
                <span className="mt-2 block text-xs leading-5">{record.limitation}</span>
                {record.sourceUrl ? (
                  <a
                    href={record.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-9 items-center gap-2 font-semibold text-primary"
                  >
                    Open source <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <Link
          href={`/critical-care/concepts/${concept.id}` as Route}
          className="mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
        >
          Open the standalone concept page
          <ExternalLink className="size-4" aria-hidden="true" />
        </Link>

        <p className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-5">
          Educational explanation only. Apply current source documents, manufacturer instructions,
          local policy, and patient-specific clinical judgment.
        </p>
      </aside>
    </div>
  )
}
