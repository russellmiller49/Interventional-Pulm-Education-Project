import type { Route } from 'next'
import { AlertTriangle, ArrowRight, BookOpen, ExternalLink } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import type { CriticalCareConcept } from '../content/concepts'
import { resolveCriticalCareEvidence } from '../content/evidenceRegistry'
import { sourceConflictsForConcept } from '../content/sourceConflicts'
import { criticalCareCatalogActivityHref } from '../content/activityRoutes'
import { sortByCurriculumOrder } from '../content/curriculumOrder'
import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'

export function CriticalCareConceptDetail({
  concept,
  catalog,
}: {
  readonly concept: CriticalCareConcept
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const activities = sortByCurriculumOrder(
    catalog.activities.filter(
      (activity) =>
        activity.teachesConceptIds.includes(concept.id) ||
        activity.assumedConceptIds.includes(concept.id),
    ),
  )
  const byModule = catalog.modules.flatMap((module) => {
    const moduleActivities = activities.filter((activity) => activity.moduleId === module.id)
    return moduleActivities.length > 0 ? [{ module, activities: moduleActivities }] : []
  })
  const relatedConcepts = concept.relatedConceptIds.flatMap((conceptId) => {
    const related = catalog.concepts.find((item) => item.id === conceptId)
    return related ? [related] : []
  })
  const evidence = resolveCriticalCareEvidence(concept.evidenceIds)
  const sourceConflicts = sourceConflictsForConcept(concept.id)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={'/critical-care/concepts' as Route}
        className="inline-flex min-h-10 items-center text-sm font-semibold text-primary"
      >
        All concepts
      </Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-primary">
        {concept.id}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{concept.title}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
        {concept.shortExplanation}
      </p>
      {concept.threadId ? (
        <p className="mt-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Recurring thread · {concept.threadId.replace('thread.', '').replaceAll('-', ' ')}
        </p>
      ) : null}

      <section className="mt-10" aria-labelledby="where-this-appears">
        <div className="flex items-center gap-3">
          <BookOpen className="size-5 text-primary" aria-hidden="true" />
          <h2 id="where-this-appears" className="text-2xl font-semibold tracking-tight">
            Where this shows up
          </h2>
        </div>
        {byModule.length > 0 ? (
          <div className="mt-6 space-y-8">
            {byModule.map(({ module, activities: moduleActivities }) => (
              <section key={module.id} aria-labelledby={`concept-module-${module.id}`}>
                <h3 id={`concept-module-${module.id}`} className="text-lg font-semibold">
                  {module.title}
                </h3>
                <ol className="mt-3 grid gap-3 md:grid-cols-2">
                  {moduleActivities.map((activity) => (
                    <li key={activity.id} className="rounded-2xl border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-muted px-2.5 py-1 font-semibold capitalize">
                          {activity.difficulty}
                        </span>
                        <span className="text-muted-foreground">
                          {activity.kind === 'assessment'
                            ? 'Challenge'
                            : activity.kind.replaceAll('-', ' ')}
                        </span>
                        {activity.assumedConceptIds.includes(concept.id) ? (
                          <span className="text-muted-foreground">assumed</span>
                        ) : (
                          <span className="text-muted-foreground">teaches</span>
                        )}
                      </div>
                      <h4 className="mt-3 font-semibold">{activity.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {activity.description}
                      </p>
                      <Link
                        href={criticalCareCatalogActivityHref(activity) as Route}
                        className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                      >
                        Open activity <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border bg-muted/40 p-5 text-sm text-muted-foreground">
            Activities using this concept are still inside a module review boundary.
          </p>
        )}
      </section>

      {sourceConflicts.length > 0 ? (
        <section className="mt-12" aria-labelledby="source-disagreements">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 text-amber-700" aria-hidden="true" />
            <h2 id="source-disagreements" className="text-2xl font-semibold tracking-tight">
              Source disagreements
            </h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            These positions are intentionally shown side by side. They have not been averaged or
            silently reconciled.
          </p>
          <div className="mt-5 space-y-5">
            {sourceConflicts.map((conflict) => (
              <article
                key={conflict.id}
                className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  {conflict.reviewStatus.replace('-', ' ')}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{conflict.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{conflict.context}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {conflict.positions.map((position) => (
                    <section
                      key={`${conflict.id}:${position.claim}`}
                      className="rounded-xl border bg-background p-4"
                    >
                      <h4 className="font-semibold">{position.claim}</h4>
                      <p className="mt-2 text-sm">{position.source}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {position.locator}
                      </p>
                    </section>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6">
                  <strong>How this curriculum handles it:</strong> {conflict.handling}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="related-concepts">
          <h2 id="related-concepts" className="text-xl font-semibold">
            Related concepts
          </h2>
          <ul className="mt-4 space-y-2">
            {relatedConcepts.map((related) => (
              <li key={related.id}>
                <Link
                  href={`/critical-care/concepts/${related.id}` as Route}
                  className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                >
                  {related.title} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="concept-sources">
          <h2 id="concept-sources" className="text-xl font-semibold">
            Sources and model boundaries
          </h2>
          <ol className="mt-4 space-y-3">
            {evidence.map((record) => (
              <li key={record.id} className="rounded-2xl border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {record.claimType.replaceAll('-', ' ')}
                </p>
                <h3 className="mt-1 font-semibold">{record.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{record.citation}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{record.limitation}</p>
                {record.sourceUrl ? (
                  <a
                    href={record.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-primary"
                  >
                    Open source <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="mt-12 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-6">
        <strong>Educational resource.</strong> Device behavior, compatibility, measurements, and
        modeled responses depend on patient context, device revision, current manufacturer
        instructions, local policy, procedural conditions, and clinical judgment.
      </aside>
    </main>
  )
}
