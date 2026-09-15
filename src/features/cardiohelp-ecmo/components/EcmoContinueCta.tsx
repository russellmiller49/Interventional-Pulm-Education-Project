'use client'

import { ArrowRight } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { nextIncompleteSectionLink } from '../content/pathwayResolver'
import type { SupportMode } from '../engine'
import { useStoredProgress } from './useStoredProgress'

/**
 * The Learn landing's primary call to action, resolved through the same function the hub uses.
 *
 * The landing is a server component and reads no progress, so its start link pointed at section
 * one for everybody — correct for a fresh learner and wrong for everyone else, while the hub was
 * separately pointing at the console tour. This island exists so both surfaces answer "continue"
 * from one resolver rather than from two ideas about where a learner is.
 *
 * The server pass and the first client render are deliberately identical: the default envelope
 * resolves to section one, which is exactly what the server would have rendered, so hydration
 * matches and the link only changes once real progress has been read. A learner who has worked
 * nothing sees no change at all.
 */
export function EcmoContinueCta({ supportMode }: { readonly supportMode: SupportMode }) {
  const { progress, hydrated } = useStoredProgress()

  const next = nextIncompleteSectionLink(supportMode, progress)

  if (!next) {
    return (
      <p className="max-w-sm text-sm font-semibold leading-6" data-ecmo-continue="complete">
        Every section of this track has been visited. Open any of them below to revisit it.
      </p>
    )
  }

  return (
    <Link
      href={next.linkTarget}
      data-ecmo-continue={hydrated ? 'resolved' : 'pending'}
      className="inline-flex min-h-12 max-w-sm items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
    >
      <span>
        {progress.lastVisited || progress.visitedTopicIds?.length ? 'Continue' : 'Start'} —{' '}
        {next.section.title}
        <span className="block text-xs font-medium opacity-90">
          Section {next.index + 1} of {next.total} · {next.section.minutes} minutes
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
    </Link>
  )
}
