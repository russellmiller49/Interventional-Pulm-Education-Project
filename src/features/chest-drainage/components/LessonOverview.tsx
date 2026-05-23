import { chestDrainageGlossary } from '../content/glossary'
import { chestDrainageLessons } from '../content/lessons'

export function LessonOverview() {
  return (
    <div className="container grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        {chestDrainageLessons.map((lesson) => (
          <article
            key={lesson.id}
            className="rounded-lg border border-border/80 bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">{lesson.title}</h2>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                {lesson.timeMinutes} min
              </span>
            </div>
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-muted-foreground">
              {lesson.objectives.map((objective) => (
                <li key={objective} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-lg border border-border/70 bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reviewable clinical statements
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                {lesson.statements.map((statement) => (
                  <li key={statement.id}>{statement.statement}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <aside className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Glossary</h2>
        <dl className="mt-4 space-y-4 text-sm leading-6">
          {chestDrainageGlossary.map((item) => (
            <div key={item.term}>
              <dt className="font-semibold text-foreground">{item.term}</dt>
              <dd className="mt-1 text-muted-foreground">{item.definition}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  )
}
