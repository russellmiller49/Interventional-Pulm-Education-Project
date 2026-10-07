import Link from 'next/link'
import type { Route } from 'next'
import { ArrowUpRight } from 'lucide-react'
import type { BetaModule } from './catalog'
import type { BetaRollout } from './rollout'

const groups = ['Bronchoscopy', 'Devices', 'Critical care'] as const

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
        href={`/${locale}${entry.path}` as Route}
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

/**
 * The hub's module list. Every module is listed and opens the same way whatever its stage; a
 * module that is ready for review moves to the first section and shows its tester note.
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
              Start here. Each card says what to look for and what is still under faculty review.
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
                      {entry.group} · about {note.minutes} minutes
                    </p>
                    <h3 className="text-lg font-semibold">{entry.title}</h3>
                    <p className="text-sm leading-6">{note.summary}</p>
                    <NoteList title="What to look for" items={note.lookFor} />
                    <NoteList title="Still under review" items={note.knownLimits} />
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
                <div className="grid gap-4 md:grid-cols-2">
                  {entries.map((entry) => (
                    <article
                      key={entry.id}
                      className="flex flex-col justify-between gap-6 rounded-2xl border bg-card p-6 shadow-sm"
                    >
                      <h4 className="text-lg font-semibold">{entry.title}</h4>
                      <ModuleLinks entry={entry} locale={locale} />
                    </article>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}
