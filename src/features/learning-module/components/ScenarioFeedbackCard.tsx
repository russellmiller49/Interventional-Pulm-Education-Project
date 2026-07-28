'use client'

import type { Route } from 'next'
import { AlertOctagon, BookOpen } from 'lucide-react'

import { criticalCareConceptById } from '@/features/critical-care/content/concepts'
import { resolveCriticalCareEvidence } from '@/features/critical-care/content/evidenceRegistry'
import type { ScenarioFeedbackEvent } from '@/features/learning-module/scenarioFeedback'
import { Link } from '@/i18n/navigation'

export function ScenarioFeedbackCard({
  event,
  headingLevel = 3,
  onRewind,
}: {
  readonly event: ScenarioFeedbackEvent
  readonly headingLevel?: 2 | 3 | 4
  readonly onRewind?: () => void
}) {
  const Heading = `h${headingLevel}` as const
  const evidence = resolveCriticalCareEvidence(event.feedback.evidenceIds)

  return (
    <article
      className={`rounded-2xl border p-4 ${
        event.hardInterrupt ? 'border-red-400/60 bg-red-950/30' : 'border-sky-400/30 bg-sky-950/20'
      }`}
      data-feedback-timing={event.timing}
    >
      <div className="flex items-start gap-3">
        {event.hardInterrupt ? (
          <AlertOctagon className="mt-0.5 size-5 shrink-0 text-red-300" aria-hidden="true" />
        ) : (
          <BookOpen className="mt-0.5 size-5 shrink-0 text-sky-300" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-sky-200">
            {event.hardInterrupt ? 'Action paused for safety' : 'Teaching feedback'}
          </p>
          <Heading className="mt-1 text-base font-bold text-white">{event.actionLabel}</Heading>
        </div>
      </div>

      {event.hardInterrupt ? (
        <p className="mt-4 rounded-xl border border-red-300/25 bg-red-950/30 p-3 text-sm leading-6 text-red-50">
          Stopping here—in a real patient, this action could cause immediate harm. The case-specific
          consequence and mechanism are explained below.
        </p>
      ) : null}

      <dl className="mt-4 grid gap-3 text-sm leading-6 text-slate-100">
        <div>
          <dt className="font-bold text-white">What happened</dt>
          <dd>{event.feedback.whatHappened}</dd>
        </div>
        <div>
          <dt className="font-bold text-white">Why it happened</dt>
          <dd>{event.feedback.whyItHappened}</dd>
        </div>
        {event.feedback.likelyFrame ? (
          <div className="rounded-xl border border-white/15 bg-black/10 p-3">
            <dt className="font-bold text-white">A reasonable frame</dt>
            <dd className="text-slate-200">{event.feedback.likelyFrame}</dd>
          </div>
        ) : null}
        <div className="rounded-xl border border-sky-300/25 bg-sky-300/5 p-3">
          <dt className="font-bold text-white">The distinguishing cue</dt>
          <dd className="text-slate-200">{event.feedback.theCue}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Related concepts">
        {event.feedback.conceptIds.flatMap((conceptId) => {
          const concept = criticalCareConceptById.get(conceptId)
          return concept
            ? [
                <Link
                  key={concept.id}
                  href={`/critical-care/concepts/${concept.id}` as Route}
                  className="inline-flex min-h-9 items-center rounded-full border border-sky-300/30 bg-sky-300/10 px-3 text-xs font-semibold text-sky-100"
                >
                  {concept.title}
                </Link>,
              ]
            : []
        })}
      </div>
      {evidence.length > 0 ? (
        <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-slate-300">
          <strong className="text-white">Sources for this feedback</strong>
          <ul className="mt-1 space-y-1">
            {evidence.map((record) => (
              <li key={record.id}>
                {record.sourceUrl ? (
                  <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                    {record.citation}
                  </a>
                ) : (
                  record.citation
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {event.hardInterrupt && onRewind ? (
        <button
          type="button"
          onClick={onRewind}
          className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-red-300/40 px-3 text-sm font-bold text-red-100"
        >
          Rewind to before this action
        </button>
      ) : null}
    </article>
  )
}
