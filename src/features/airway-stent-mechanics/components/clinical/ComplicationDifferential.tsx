'use client'

import { useState } from 'react'

import { complicationRegistry } from '../../content/complicationRegistry'

export function ComplicationDifferential({ onComplete }: { onComplete?: () => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [committed, setCommitted] = useState(false)

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby="complication-differential-title"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">
        Recurrent obstruction
      </p>
      <h3 id="complication-differential-title" className="mt-2 text-2xl font-bold tracking-tight">
        Build a differential before choosing a response
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        More than one process can coexist. Select the categories that must be distinguished by
        symptoms, imaging, bronchoscopy, cultures, device position, and the broader disease course.
      </p>

      <fieldset className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Complication differential</legend>
        {complicationRegistry.map((pathway) => {
          const selected = selectedIds.includes(pathway.id)
          return (
            <label
              key={pathway.id}
              className={
                selected
                  ? 'cursor-pointer rounded-xl border border-rose-500/60 bg-rose-500/10 p-3 focus-within:ring-2 focus-within:ring-rose-500'
                  : 'cursor-pointer rounded-xl border bg-background p-3 hover:border-rose-500/40 focus-within:ring-2 focus-within:ring-rose-500'
              }
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() =>
                  setSelectedIds((current) =>
                    selected ? current.filter((id) => id !== pathway.id) : [...current, pathway.id],
                  )
                }
                className="mr-2 accent-rose-600"
              />
              <span className="text-sm font-semibold">{pathway.label}</span>
            </label>
          )
        })}
      </fieldset>

      {selectedIds.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2" aria-live="polite">
          {complicationRegistry
            .filter((pathway) => selectedIds.includes(pathway.id))
            .map((pathway) => (
              <article key={pathway.id} className="rounded-2xl border bg-muted/15 p-4">
                <h4 className="font-semibold">{pathway.label}</h4>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Recognition pattern
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {pathway.recognitionPatterns[0]}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Reassessment question
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {pathway.reassessmentQuestions[0]}
                </p>
              </article>
            ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (committed) return
          setCommitted(true)
          onComplete?.()
        }}
        disabled={selectedIds.length < 2 || committed}
        className="mt-5 min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {committed ? 'Differential committed' : 'Commit differential'}
      </button>
    </section>
  )
}
