'use client'

import type { Route } from 'next'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { ArrowRight, Download, RotateCcw, Trash2 } from 'lucide-react'

import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  readCriticalCareProgress,
} from '@/features/learning-module/activity/progress'
import type { CriticalCareProgressEnvelope } from '@/features/learning-module/activity/types'
import { Link } from '@/i18n/navigation'

import { criticalCareCatalogActivityHref } from '../content/activityRoutes'
import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'
import { CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY } from '../progress/types'

interface ProgressState {
  readonly envelope: CriticalCareProgressEnvelope
  readonly storageKeys: readonly string[]
}

const CRITICAL_CARE_LOCAL_HISTORY_KEYS = [
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  CRITICAL_CARE_INTEGRATED_OUTCOMES_STORAGE_KEY,
  'icu-hemodynamics-progress-v2',
  'icu-hemodynamics-progress-v1',
  'mechanical-ventilation-progress-v2',
  'hamilton-c6-ventilation-progress-v1',
  'interventionalpulm:mcs-progress:v1',
  'baxter-crrt-progress-v3',
] as const
const subscribeToHydration = () => () => {}
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false

function downloadJson(envelope: CriticalCareProgressEnvelope) {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `critical-care-history-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function CriticalCareProgressView({
  catalog,
}: {
  readonly catalog: CriticalCarePublicClientCatalog
}) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  )
  const loaded = useMemo(() => {
    if (!hydrated) return { progress: null, failed: false }
    try {
      return {
        progress: {
          envelope: readCriticalCareProgress(window.localStorage),
          storageKeys: CRITICAL_CARE_LOCAL_HISTORY_KEYS,
        } satisfies ProgressState,
        failed: false,
      }
    } catch {
      return { progress: null, failed: true }
    }
  }, [hydrated])
  const [progressOverride, setProgressOverride] = useState<ProgressState>()
  const progress = progressOverride ?? loaded.progress
  const failed = loaded.failed

  const engaged = useMemo(() => {
    const byId = new Map(catalog.activities.map((activity) => [activity.id, activity]))
    return (progress?.envelope.activities ?? []).flatMap((item) => {
      const activity = byId.get(item.activityId)
      return activity && item.status !== 'not-started' ? [{ activity, progress: item }] : []
    })
  }, [catalog.activities, progress])
  const tricky = engaged.filter(
    ({ progress: item }) => item.tricky || (item.hintCount ?? 0) > 0 || item.attempts > 1,
  )
  const touchedConcepts = [
    ...new Set(engaged.flatMap(({ activity }) => activity.teachesConceptIds)),
  ].flatMap((conceptId) => {
    const concept = catalog.concepts.find((item) => item.id === conceptId)
    return concept ? [concept] : []
  })
  const recentlyTouched = [...engaged]
    .sort((left, right) => right.progress.updatedAt.localeCompare(left.progress.updatedAt))
    .slice(0, 8)

  function deleteHistory() {
    if (!progress) return
    if (!window.confirm('Delete critical-care learning history stored in this browser?')) return
    for (const key of new Set(progress.storageKeys)) window.localStorage.removeItem(key)
    setProgressOverride({
      envelope: { version: 1, activities: [], updatedAt: new Date().toISOString() },
      storageKeys: progress.storageKeys,
    })
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Personal history</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Where you have been</h1>
      <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
        This local-first view remembers safe resume places and offers useful material to revisit. It
        does not rank you, compare you with anyone else, or claim what you know.
      </p>

      {failed ? (
        <p className="mt-8 rounded-2xl border border-destructive/50 p-5" role="alert">
          History could not be read. Existing browser data was not changed.
        </p>
      ) : null}
      {!progress && !failed ? (
        <p className="mt-8" role="status">
          Loading history…
        </p>
      ) : null}

      {progress ? (
        <>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => downloadJson(progress.envelope)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold"
            >
              <Download className="size-4" aria-hidden="true" /> Export JSON
            </button>
            <button
              type="button"
              onClick={deleteHistory}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" /> Delete local history
            </button>
          </div>

          {progress.envelope.resume ? (
            <section className="mt-10 rounded-3xl border border-primary/30 bg-primary/5 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Continue</p>
              {catalog.activities
                .filter((activity) => activity.id === progress.envelope.resume?.activityId)
                .map((activity) => (
                  <div key={activity.id}>
                    <h2 className="mt-2 text-xl font-semibold">{activity.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Pick up from your last safe authored checkpoint.
                    </p>
                    <Link
                      href={criticalCareCatalogActivityHref(activity) as Route}
                      className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary"
                    >
                      Pick up where you left off{' '}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
            </section>
          ) : null}

          <section className="mt-10" aria-labelledby="recent-history">
            <h2 id="recent-history" className="text-2xl font-bold">
              Recently touched
            </h2>
            {recentlyTouched.length > 0 ? (
              <ol className="mt-4 grid gap-3 md:grid-cols-2">
                {recentlyTouched.map(({ activity, progress: item }) => (
                  <li key={activity.id} className="rounded-2xl border bg-card p-5">
                    <p className="text-xs font-semibold capitalize text-primary">
                      {activity.difficulty}
                    </p>
                    <h3 className="mt-1 font-semibold">{activity.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.status === 'in-progress' ? 'In progress' : 'Worked through'} ·{' '}
                      <time dateTime={item.updatedAt}>
                        {new Intl.DateTimeFormat(undefined, {
                          day: 'numeric',
                          month: 'short',
                        }).format(new Date(item.updatedAt))}
                      </time>
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Activities you open will appear here.
              </p>
            )}
          </section>

          <section className="mt-10" aria-labelledby="tricky-history">
            <h2 id="tricky-history" className="text-2xl font-bold">
              Worth another look?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              These are activities where you asked for help, met a hard stop, or returned for
              another run.
            </p>
            {tricky.length > 0 ? (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {tricky.map(({ activity }) => (
                  <li key={activity.id} className="rounded-2xl border bg-card p-4">
                    <Link
                      href={criticalCareCatalogActivityHref(activity) as Route}
                      className="inline-flex min-h-10 items-center gap-2 font-semibold text-primary"
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      {activity.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Nothing is calling for a revisit.
              </p>
            )}
          </section>

          <section className="mt-10" aria-labelledby="concept-history">
            <h2 id="concept-history" className="text-2xl font-bold">
              Concepts you have touched
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {touchedConcepts.map((concept) => (
                <li key={concept.id}>
                  <Link
                    href={`/critical-care/concepts/${concept.id}` as Route}
                    className="inline-flex min-h-10 items-center rounded-full border bg-card px-4 text-sm font-semibold"
                  >
                    {concept.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  )
}
