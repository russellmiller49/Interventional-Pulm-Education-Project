import Link from 'next/link'
import type { Route } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { betaModuleReviewPath, type BetaModule } from './catalog'
import type { BetaRollout, BetaTesterNote } from './rollout'

const groups = ['Bronchoscopy', 'Devices', 'Literature', 'Critical care'] as const

function ModuleLinks({ entry, locale }: { entry: BetaModule; locale: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Link
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        href={`/${locale}/development-beta/${entry.id}` as Route}
      >
        Test with feedback <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
      <Link
        className="text-sm underline underline-offset-4"
        href={`/${locale}${betaModuleReviewPath(entry)}` as Route}
      >
        Standard module
      </Link>
    </div>
  )
}

function NoteList({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null
  return (
    <div className="text-sm leading-6">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function formatMinutes(minutes: number) {
  if (minutes < 90) return `${minutes} minutes`
  return `${Math.round(minutes / 30) / 2} hours`
}

function TesterNote({ note }: { note: BetaTesterNote }) {
  return (
    <>
      <p className="text-sm leading-6">{note.summary}</p>
      <dl className="space-y-1 text-sm leading-6">
        <div>
          <dt className="inline font-semibold">Written for: </dt>
          <dd className="inline text-muted-foreground">{note.audience}</dd>
        </div>
        {note.estimate && (
          <div>
            <dt className="inline font-semibold">Estimated time: </dt>
            <dd className="inline text-muted-foreground">
              about {formatMinutes(note.estimate.minutes)}, from {note.estimate.basis}
            </dd>
          </div>
        )}
      </dl>
      <NoteList title="Where feedback helps most" items={note.lookFor} />
      <NoteList title="Known limits" items={note.knownLimits} />
    </>
  )
}

/**
 * The hub's module list. Every module passed in is listed and opens the same way; a
 * module that is ready for review moves to the first section and shows its tester note. A module
 * still in development shows its note too when it has one.
 */
export function BetaHubSections({
  locale,
  modules,
  rollout,
}: {
  locale: string
  modules: readonly BetaModule[]
  rollout: BetaRollout
}) {
  const ready = modules.filter((entry) => rollout[entry.id].stage === 'ready')
  const preview = modules.filter((entry) => rollout[entry.id].stage === 'preview')

  return (
    <>
      {ready.length > 0 && (
        <section className="space-y-4" aria-labelledby="beta-ready-heading">
          <div className="max-w-3xl space-y-2">
            <h2 id="beta-ready-heading" className="text-2xl font-semibold">
              Ready for review
            </h2>
            <p className="text-muted-foreground">
              Start here. Each card says who the module is for, where feedback helps most and its
              known limits.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {ready.map((entry) => {
              const stage = rollout[entry.id]
              if (stage.stage !== 'ready') return null
              const { note } = stage
              return (
                <article
                  key={entry.id}
                  className="flex flex-col justify-between gap-6 rounded-2xl border bg-card p-6 shadow-sm"
                >
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {entry.group}
                    </p>
                    <h3 className="text-lg font-semibold">{entry.title}</h3>
                    <TesterNote note={note} />
                  </div>
                  <ModuleLinks entry={entry} locale={locale} />
                </article>
              )
            })}
          </div>
        </section>
      )}
      {preview.length > 0 && (
        <section className="space-y-6" aria-labelledby="beta-preview-heading">
          <div className="max-w-3xl space-y-2">
            <h2 id="beta-preview-heading" className="text-2xl font-semibold">
              Still in development
            </h2>
            <p className="text-muted-foreground">
              These modules are still being built and reviewed. They open as before; expect
              unfinished parts.
            </p>
          </div>
          {groups.map((group) => {
            const entries = preview.filter((entry) => entry.group === group)
            if (entries.length === 0) return null
            return (
              <div key={group} className="space-y-4">
                <h3 className="text-xl font-semibold">{group}</h3>
                {/* Top-aligned, so a card without a note keeps its height beside one with a note. */}
                <div className="grid items-start gap-4 md:grid-cols-2">
                  {entries.map((entry) => {
                    const { note } = rollout[entry.id]
                    const title = <h4 className="text-lg font-semibold">{entry.title}</h4>
                    return (
                      <article
                        key={entry.id}
                        className="flex flex-col justify-between gap-6 rounded-2xl border bg-card p-6 shadow-sm"
                      >
                        {note ? (
                          <div className="space-y-3">
                            {title}
                            <TesterNote note={note} />
                          </div>
                        ) : (
                          title
                        )}
                        <ModuleLinks entry={entry} locale={locale} />
                      </article>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}
