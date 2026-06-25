import { chestDrainageLessons } from '../content/lessons'
import { chestDrainageReferences } from '../content/references'
import { HandoffContent } from '@/i18n/handoff'

export function ClinicalReviewTable() {
  const statements = chestDrainageLessons.flatMap((lesson) =>
    lesson.statements.map((statement) => ({
      lesson: lesson.title,
      ...statement,
    })),
  )

  return (
    <HandoffContent>
      {
        <div className="container space-y-8">
          <section className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
            <div className="border-b border-border/80 px-5 py-4">
              <h2 className="text-xl font-semibold text-foreground">
                Clinical statement review packet
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Statements, source IDs, and review metadata are stored in feature-local data files.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Lesson</th>
                    <th className="px-4 py-3">Statement</th>
                    <th className="px-4 py-3">Sources</th>
                    <th className="px-4 py-3">Last reviewed</th>
                    <th className="px-4 py-3">Reviewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/80">
                  {statements.map((statement) => (
                    <tr key={statement.id}>
                      <td className="px-4 py-3 font-medium text-foreground">{statement.lesson}</td>
                      <td className="max-w-xl px-4 py-3 leading-6 text-muted-foreground">
                        {statement.statement}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {statement.referenceIds.join(', ')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{statement.lastReviewed}</td>
                      <td className="px-4 py-3 text-muted-foreground">{statement.reviewer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">References</h2>
            <div className="mt-5 grid gap-4">
              {chestDrainageReferences.map((reference) => (
                <article
                  key={reference.id}
                  className="rounded-lg border border-border/80 bg-background p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {reference.sourceType}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {reference.id}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                    {reference.url ? (
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-sky-500 underline-offset-4"
                      >
                        {reference.citation}
                      </a>
                    ) : (
                      reference.citation
                    )}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {reference.useNote}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
