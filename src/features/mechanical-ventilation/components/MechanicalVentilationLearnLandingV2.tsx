import type { Route } from 'next'
import { ArrowRight, Clock3 } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { mechanicalVentilationLessons } from '../content'

export function MechanicalVentilationLearnLandingV2() {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Focused lessons
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Build one reasoning habit at a time.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Each guided activity uses the same six phases as the case workspace and ends with an
          explicit transfer check. Opening a page does not mark it complete.
        </p>
      </header>

      <ol className="grid gap-4 md:grid-cols-2">
        {mechanicalVentilationLessons.map((lesson, index) => (
          <li key={lesson.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                  {String(index + 1).padStart(2, '0')} · {lesson.domain}
                </span>
                <h2 className="mt-2 text-xl font-bold">{lesson.title}</h2>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" /> {lesson.estimatedMinutes} min
              </span>
            </div>
            <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{lesson.summary}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Related cases: {lesson.relatedCaseIds.join(' · ')}
            </p>
            <Link
              href={`/mechanical-ventilation/learn?activity=${lesson.id}` as Route}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start guided lesson <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </main>
  )
}
