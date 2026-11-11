'use client'

import Link from 'next/link'
import type { Route } from 'next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { BetaModule } from './catalog'
import type { BetaModuleRevision } from './revisions'

export function RevisionDetails({
  moduleEntry,
  locale,
  revisions,
}: {
  moduleEntry: BetaModule
  locale: string
  /** Newest first. */
  revisions: readonly BetaModuleRevision[]
}) {
  const [current] = revisions
  if (!current) return <p className="text-muted-foreground">Version history not yet available</p>

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })

  return (
    <Dialog>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{current.displayVersion}</span>
        <DialogTrigger asChild>
          <button
            type="button"
            className="-my-1 rounded-sm py-1 text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            What’s changed
          </button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>What’s changed</DialogTitle>
          <DialogDescription>{moduleEntry.title}</DialogDescription>
        </DialogHeader>
        <ol className="divide-y text-sm">
          {revisions.map((revision) => (
            <li key={revision.revisionId} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <h3 className="font-semibold">{revision.displayVersion}</h3>
              <p className="text-muted-foreground">
                <span className="capitalize">{revision.category}</span>
                {revision.releasedOn && (
                  <>
                    {' · '}
                    <time dateTime={revision.releasedOn}>
                      {dateFormat.format(new Date(revision.releasedOn))}
                    </time>
                  </>
                )}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {revision.changelog.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
              {revision.affectedSections?.length ? (
                <>
                  <h4 className="font-medium">Affected sections</h4>
                  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                    {revision.affectedSections.map((section) => (
                      <li key={section.id}>
                        {section.path ? (
                          <Link
                            className="underline underline-offset-2 hover:text-foreground"
                            href={
                              `/${locale}/development-beta/${moduleEntry.id}?section=${encodeURIComponent(section.id)}` as Route
                            }
                            target="_blank"
                            rel="noopener"
                            prefetch={false}
                          >
                            {section.title}
                            <span className="sr-only"> (opens in a new testing tab)</span>
                          </Link>
                        ) : (
                          section.title
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {revision.rereviewRecommended && (
                <p className="font-medium">Clinical or educational re-review recommended</p>
              )}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
