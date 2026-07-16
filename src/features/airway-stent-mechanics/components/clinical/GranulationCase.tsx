import { complicationById } from '../../content/complicationRegistry'
import { ComplicationDifferential } from './ComplicationDifferential'
import { ComplicationPathwayMap } from './ComplicationPathwayMap'

export function GranulationCase({
  complicationSelectionIds,
  differentialCompleted,
  onDifferentialCompleted,
}: {
  complicationSelectionIds?: readonly string[]
  differentialCompleted?: boolean
  onDifferentialCompleted?: (selectedIds: readonly string[]) => void
}) {
  const granulation = complicationById.granulation

  return (
    <div className="space-y-6">
      <ComplicationDifferential
        completed={differentialCompleted}
        initialSelectedIds={complicationSelectionIds}
        onComplete={onDifferentialCompleted}
      />
      <ComplicationPathwayMap pathway={granulation} />
      <section
        className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
        aria-labelledby="granulation-response-title"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">
          Response categories
        </p>
        <h3 id="granulation-response-title" className="mt-2 text-2xl font-bold tracking-tight">
          Treat the obstruction and reassess its drivers
        </h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {granulation.responseDomains.map((response, index) => (
            <article key={response} className="rounded-2xl border bg-background p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-sm font-semibold text-rose-700 dark:text-rose-200">
                {index + 1}
              </span>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{response}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Choosing a debridement modality alone does not complete the plan. The secretion or
          infectious burden, fit and position, architecture, ongoing indication, and follow-up all
          remain part of the response.
        </p>
      </section>
    </div>
  )
}
