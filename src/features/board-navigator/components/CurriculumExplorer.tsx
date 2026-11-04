'use client'

import type { Route } from 'next'
import { ExternalLink, Flag } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/cn'

import { BLUEPRINT_DOMAINS, BLUEPRINT_VERSION, topicsInDomain } from '../content/blueprint'
import { CONCEPT_TAG_LABELS } from '../content/concepts'
import { objectivesInTopic } from '../content/objectives'
import { labHref, mapHref } from '../content/routes'
import { NAVIGATOR_SOURCES, navigatorSource } from '../content/sources'
import { BOARD_NAVIGATOR_NUMBERS } from '../content/teachingNumbers'
import { withFlag } from '../engine/record'
import { objectiveStatus } from '../engine/status'
import { StatusBadge } from './StatusBadge'
import { nowIso, useNavigatorRecord, useNow } from './useNavigatorRecord'

/**
 * Screen E. Every blueprint topic, irrespective of the algorithm, with its objectives, resources
 * and references. A learner can flag a topic that felt difficult after using an outside resource;
 * the flag is an input the learner owns, shown on the objective, never a judgement by the engine.
 */
export function CurriculumExplorer() {
  const { record, hydrated, update } = useNavigatorRecord()
  const now = useNow(record)
  const ipass = navigatorSource('aabip-ipass')
  const blueprint = navigatorSource(BLUEPRINT_VERSION.sourceId)

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Curriculum explorer</h1>
        <p className="max-w-3xl text-muted-foreground">
          The whole blueprint, browsable. Topics without pilot objectives are listed so the gaps in
          the Navigator itself are visible. Crosswalk version: {BLUEPRINT_VERSION.label}
          {blueprint.url ? (
            <>
              {' '}
              (
              <a
                href={blueprint.url}
                className="text-primary underline-offset-4 hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                source
              </a>
              )
            </>
          ) : null}
          .
        </p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          For board-style question practice, the AABIP’s own{' '}
          <a
            href={ipass.url}
            className="text-primary underline-offset-4 hover:underline"
            rel="noreferrer"
            target="_blank"
          >
            iPASS
          </a>{' '}
          is the complementary resource. The Navigator does not reproduce its questions. If a topic
          felt difficult there, flag it here and the map will show the flag beside the objective.
        </p>
      </section>

      {BLUEPRINT_DOMAINS.map((domain) => (
        <section key={domain.id} aria-labelledby={`curriculum-${domain.id}`} className="grid gap-5">
          <div className="grid gap-1">
            <h2 id={`curriculum-${domain.id}`} className="text-2xl font-bold">
              {domain.title}{' '}
              <span className="text-base font-normal text-muted-foreground">
                · {domain.weightPercent}%
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">{domain.description}</p>
          </div>
          {topicsInDomain(domain.id).map((topic) => {
            const objectives = objectivesInTopic(topic.id)
            return (
              <article key={topic.id} className="grid gap-3 rounded-2xl border bg-card p-5">
                <h3 className="text-lg font-semibold">{topic.title}</h3>
                {objectives.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pilot objectives yet. The blueprint topic is recorded so coverage is honest.
                  </p>
                ) : (
                  <ul className="grid gap-3">
                    {objectives.map((objective) => {
                      const status = hydrated
                        ? objectiveStatus(record, objective.id, now).status
                        : 'not-assessed'
                      const flagged = record.flagged.includes(objective.id)
                      const secondary = objective.topicId !== topic.id
                      return (
                        <li
                          key={objective.id}
                          className="grid gap-2 rounded-xl border border-border/70 p-4 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={mapHref(objective.id) as Route}
                              className="font-semibold hover:underline"
                            >
                              {objective.title}
                            </Link>
                            <StatusBadge status={status} />
                            {secondary ? (
                              <span className="text-xs text-muted-foreground">
                                also under this topic
                              </span>
                            ) : null}
                            {flagged ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 dark:text-rose-300">
                                <Flag aria-hidden="true" className="size-3" /> You flagged this
                              </span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground">{objective.competency}</p>
                          <ul className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                            {objective.concepts.map((tag) => (
                              <li
                                key={tag}
                                className="rounded-full border border-border/70 px-2 py-0.5"
                              >
                                {CONCEPT_TAG_LABELS[tag]}
                              </li>
                            ))}
                          </ul>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <Link
                              href={labHref(objective.id) as Route}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              Open the lab
                            </Link>
                            {objective.resources.map((resource) => (
                              <Link
                                key={resource.href}
                                href={resource.href as Route}
                                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                              >
                                {resource.label}
                                <ExternalLink aria-hidden="true" className="size-3" />
                              </Link>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                update((current) =>
                                  withFlag(current, objective.id, !flagged, nowIso()),
                                )
                              }
                              className={cn(
                                'inline-flex items-center gap-1 underline-offset-4 hover:underline',
                                flagged
                                  ? 'text-rose-700 dark:text-rose-300'
                                  : 'text-muted-foreground',
                              )}
                              aria-pressed={flagged}
                            >
                              <Flag aria-hidden="true" className="size-3" />
                              {flagged ? 'Remove flag' : 'Flag as difficult'}
                            </button>
                          </div>
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer">References</summary>
                            <ul className="mt-1 grid gap-1">
                              {objective.sourceIds.map((id) => (
                                <li key={id}>{navigatorSource(id).citation}</li>
                              ))}
                            </ul>
                          </details>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </article>
            )
          })}
        </section>
      ))}

      <section aria-labelledby="numbers-heading" className="grid gap-3">
        <h2 id="numbers-heading" className="text-xl font-bold">
          Numbers the Navigator teaches
        </h2>
        <p className="text-sm text-muted-foreground">
          Every clinical number in the labs, with its class and its source.
        </p>
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {BOARD_NAVIGATOR_NUMBERS.rows.map((row) => (
                <tr key={row.id} className="border-t border-border/70 align-top">
                  <td className="px-3 py-2">
                    {row.label}
                    {row.appliesTo ? (
                      <span className="block text-xs text-muted-foreground">{row.appliesTo}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-semibold">{row.value}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.class}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.sources.length === 0
                      ? row.note
                      : row.sources.map((citation) => (
                          <span key={citation.sourceId} className="block">
                            {
                              navigatorSource(
                                citation.sourceId as Parameters<typeof navigatorSource>[0],
                              ).citation
                            }{' '}
                            ({citation.locator})
                          </span>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="sources-heading" className="grid gap-3">
        <h2 id="sources-heading" className="text-xl font-bold">
          Sources
        </h2>
        <ol className="grid gap-2 text-sm text-muted-foreground">
          {NAVIGATOR_SOURCES.map((source) => (
            <li key={source.id}>
              {source.citation}
              {source.url ? (
                <>
                  {' '}
                  <a
                    href={source.url}
                    className="text-primary underline-offset-4 hover:underline"
                    rel="noreferrer"
                    target="_blank"
                  >
                    link
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
