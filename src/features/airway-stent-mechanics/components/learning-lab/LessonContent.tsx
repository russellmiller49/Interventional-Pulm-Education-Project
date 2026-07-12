import { ArrowRight, Clock3, FlaskConical, ScanLine } from 'lucide-react'

import type {
  ForceTaxonomyItem,
  GinaDumonBenchDatum,
  LearningSection,
  ObstructionMorphology,
  TissueMechanism,
} from '../../engine/learningLabTypes'

export function LearningSections({ sections }: { sections: readonly LearningSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.id} className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          <h3 className="text-xl font-semibold text-foreground">{section.title}</h3>
          {section.lead ? (
            <p className="mt-2 text-sm font-medium leading-6 text-foreground">{section.lead}</p>
          ) : null}
          <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {section.cards?.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {section.cards.map((card) => (
                <article key={card.id} className="rounded-2xl border bg-background p-4">
                  <h4 className="font-semibold text-foreground">{card.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.body}</p>
                  {card.takeaway ? (
                    <p className="mt-3 border-l-2 border-cyan-500 pl-3 text-xs font-medium leading-5 text-foreground">
                      {card.takeaway}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  )
}

function MorphologySchematic({ item }: { item: ObstructionMorphology }) {
  const intrinsic = item.id === 'intrinsic' || item.id === 'mixed'
  const external = item.id === 'extrinsic' || item.id === 'mixed'
  const dynamic = item.id === 'dynamic'

  return (
    <svg
      viewBox="0 0 180 112"
      className="h-28 w-full rounded-xl bg-slate-950"
      role="img"
      aria-label={`${item.label}: ${item.visualCue}`}
    >
      <ellipse
        cx="90"
        cy="56"
        rx={external ? 48 : 58}
        ry={dynamic ? 28 : 42}
        fill="#0f172a"
        stroke="#7dd3fc"
        strokeWidth="10"
      />
      {intrinsic ? <path d="M57 42 Q83 39 94 57 Q80 79 56 74 Z" fill="#fb7185" /> : null}
      {external ? (
        <>
          <path d="M20 56 H48" stroke="#fbbf24" strokeWidth="5" />
          <path d="M160 56 H132" stroke="#fbbf24" strokeWidth="5" />
          <path d="M48 56 l-10 -7 v14 Z" fill="#fbbf24" />
          <path d="M132 56 l10 -7 v14 Z" fill="#fbbf24" />
        </>
      ) : null}
      {dynamic ? (
        <path d="M46 54 Q90 82 134 54" fill="none" stroke="#fbbf24" strokeWidth="7" />
      ) : null}
    </svg>
  )
}

export function ObstructionMorphologyGrid({ items }: { items: readonly ObstructionMorphology[] }) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
        Problem before product
      </p>
      <h3 className="mt-2 text-2xl font-semibold">Name the obstruction morphology</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        The visual category does not prescribe a stent. It identifies the mechanical question that
        must be answered before architecture or fit can be discussed.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-background p-4">
            <MorphologySchematic item={item} />
            <h4 className="mt-4 font-semibold text-foreground">{item.label}</h4>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.visualCue}</p>
            <p className="mt-3 text-sm leading-6 text-foreground">{item.mechanicalProblem}</p>
            <p className="mt-3 border-l-2 border-amber-500 pl-3 text-xs font-medium leading-5 text-muted-foreground">
              Ask: {item.decisionQuestion}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function TissueMechanismMap({ items }: { items: readonly TissueMechanism[] }) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-4 border-b bg-slate-950 p-5 text-white sm:p-6 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
          <ScanLine className="h-5 w-5 text-cyan-300" aria-hidden />
          <p className="mt-2 font-semibold">Architecture + fit</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Where and how motion reaches tissue
          </p>
        </div>
        <ArrowRight className="hidden h-5 w-5 text-slate-500 md:block" aria-hidden />
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
          <Clock3 className="h-5 w-5 text-amber-300" aria-hidden />
          <p className="mt-2 font-semibold">Repeated exposure</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Pressure, shear, secretions, and cycles
          </p>
        </div>
        <ArrowRight className="hidden h-5 w-5 text-slate-500 md:block" aria-hidden />
        <div className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4">
          <FlaskConical className="h-5 w-5 text-rose-300" aria-hidden />
          <p className="mt-2 font-semibold">Biologic response</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Complications are pathways, not a force meter
          </p>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-background p-4">
            <h4 className="font-semibold text-foreground">{item.label}</h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.mechanism}</p>
            <p className="mt-3 text-xs font-medium leading-5 text-rose-700 dark:text-rose-200">
              Possible consequence: {item.consequence}
            </p>
            <p className="mt-3 border-l-2 border-cyan-500 pl-3 text-xs leading-5 text-foreground">
              Inspect: {item.inspectionQuestion}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function EvidenceDecisionLab({
  benchData,
  forceTaxonomy,
}: {
  benchData: readonly GinaDumonBenchDatum[]
  forceTaxonomy: readonly ForceTaxonomyItem[]
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
          Name the metric before comparing it
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {forceTaxonomy.map((item) => (
            <article key={item.id} className="rounded-2xl border bg-background p-4">
              <h4 className="font-semibold text-foreground">{item.term}</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.definition}</p>
              <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-200">
                Boundary: {item.interpretationLimit}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="border-b p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">
            Direct bench example
          </p>
          <h3 className="mt-2 text-2xl font-semibold">
            Anchoring can differ from brute compression
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            These values compare specific 14-mm GINA and Dumon specimens in the cited fixtures. They
            demonstrate method-dependent tradeoffs, not clinical superiority or universal
            thresholds.
          </p>
        </div>
        <div className="overflow-x-auto p-5 sm:p-6">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <caption className="sr-only">
              GINA and Dumon silicone airway stent bench measurements and methods
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-3 font-semibold">
                  Metric
                </th>
                <th scope="col" className="p-3 font-semibold">
                  Dumon
                </th>
                <th scope="col" className="p-3 font-semibold">
                  GINA
                </th>
                <th scope="col" className="p-3 font-semibold">
                  Method context
                </th>
              </tr>
            </thead>
            <tbody>
              {benchData.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <th scope="row" className="p-3 font-medium text-foreground">
                    {row.metric}
                  </th>
                  <td className="p-3 text-muted-foreground">{row.dumon}</td>
                  <td className="p-3 text-muted-foreground">{row.gina}</td>
                  <td className="p-3 text-xs leading-5 text-muted-foreground">{row.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
