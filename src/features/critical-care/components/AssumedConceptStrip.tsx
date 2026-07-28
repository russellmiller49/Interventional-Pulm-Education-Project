'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { BookOpen, X } from 'lucide-react'

import { readCriticalCareProgress } from '@/features/learning-module/activity'

import { criticalCareActivityById } from '../content/activities'
import { criticalCareConceptById, type CriticalCareConcept } from '../content/concepts'
import { ConceptSidePanel } from './ConceptSidePanel'

const GLOBAL_DISMISS_KEY = 'critical-care-assumed-concepts-hidden-v1'
const ACTIVITY_DISMISS_KEY = 'critical-care-assumed-concepts-dismissed-v1'
const subscribeToHydration = () => () => {}
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false

function readDismissedActivityIds(): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ACTIVITY_DISMISS_KEY) ?? '[]')
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : []
  } catch {
    return []
  }
}

export function AssumedConceptStrip({
  activityId,
  conceptIds,
}: {
  readonly activityId: string
  readonly conceptIds: readonly string[]
}) {
  const concepts = useMemo(
    () =>
      conceptIds.flatMap((conceptId) => {
        const item = criticalCareConceptById.get(conceptId)
        return item ? [item] : []
      }),
    [conceptIds],
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [panelConcept, setPanelConcept] = useState<CriticalCareConcept | null>(null)
  const [dismissedActivityId, setDismissedActivityId] = useState<string | null>(null)
  const [dismissedGlobally, setDismissedGlobally] = useState(false)
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  )
  const localContext = useMemo(() => {
    if (!hydrated) {
      return {
        storedHidden: true,
        engagedConceptIds: new Set<string>() as ReadonlySet<string>,
        threadCallback: null as string | null,
      }
    }

    const globallyHidden = window.localStorage.getItem(GLOBAL_DISMISS_KEY) === '1'
    const activityHidden = readDismissedActivityIds().includes(activityId)
    const progress = readCriticalCareProgress(window.localStorage)
    const engagedActivities = progress.activities.filter((item) => item.status !== 'not-started')
    const engagedConceptIds = new Set(
      engagedActivities.flatMap(
        (item) => criticalCareActivityById.get(item.activityId)?.teachesConceptIds ?? [],
      ),
    )

    const current = criticalCareActivityById.get(activityId)
    if (!current) {
      return {
        storedHidden: globallyHidden || activityHidden,
        engagedConceptIds,
        threadCallback: null,
      }
    }
    const currentThreads = new Set(
      concepts.flatMap((item) => (item.threadId ? [item.threadId] : [])),
    )
    const earlier = engagedActivities.flatMap((progressItem) => {
      const activity = criticalCareActivityById.get(progressItem.activityId)
      if (!activity || activity.moduleId === current.moduleId) return []
      const matching = activity.teachesConceptIds.find((conceptId) => {
        const thread = criticalCareConceptById.get(conceptId)?.threadId
        return thread ? currentThreads.has(thread) : false
      })
      return matching ? [{ activity, conceptId: matching }] : []
    })[0]
    const title = earlier ? criticalCareConceptById.get(earlier.conceptId)?.title : undefined

    return {
      storedHidden: globallyHidden || activityHidden,
      engagedConceptIds,
      threadCallback: earlier
        ? `You saw ${title ?? 'this mechanism'} in ${earlier.activity.title} — same thread, different system.`
        : null,
    }
  }, [activityId, concepts, hydrated])
  const hidden =
    localContext.storedHidden || dismissedGlobally || dismissedActivityId === activityId

  if (hidden || concepts.length === 0) return null

  const expanded = expandedId ? criticalCareConceptById.get(expandedId) : undefined

  function dismissActivity() {
    const next = [...new Set([...readDismissedActivityIds(), activityId])]
    window.localStorage.setItem(ACTIVITY_DISMISS_KEY, JSON.stringify(next))
    setDismissedActivityId(activityId)
  }

  function dismissGlobally() {
    window.localStorage.setItem(GLOBAL_DISMISS_KEY, '1')
    setDismissedGlobally(true)
  }

  return (
    <>
      <section
        className="relative z-40 border-b bg-card px-3 py-2 text-foreground"
        aria-label="Optional concept refreshers"
      >
        <div className="flex min-h-10 flex-wrap items-center gap-2">
          <BookOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold">This assumes you&apos;re comfortable with:</span>
          {concepts.map((concept) => {
            const engaged = localContext.engagedConceptIds.has(concept.id)
            const expandedNow = expandedId === concept.id
            return (
              <button
                key={concept.id}
                type="button"
                aria-expanded={expandedNow}
                onClick={() => setExpandedId(expandedNow ? null : concept.id)}
                className="min-h-8 rounded-full border px-3 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-engaged={engaged || undefined}
                title={engaged ? 'You have encountered this concept before' : undefined}
              >
                {concept.title}
                {engaged ? <span className="sr-only"> · encountered before</span> : null}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={dismissGlobally}
              className="min-h-9 px-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Don&apos;t show these
            </button>
            <button
              type="button"
              onClick={dismissActivity}
              className="grid size-9 place-items-center rounded-full"
              aria-label="Dismiss refreshers for this activity"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {localContext.threadCallback ? (
          <p className="mt-1 text-xs text-muted-foreground">{localContext.threadCallback}</p>
        ) : null}
        <div className="sr-only" aria-live="polite">
          {expanded ? `${expanded.title} refresher expanded.` : ''}
        </div>
        {expanded ? (
          <div className="absolute left-3 right-3 top-[calc(100%-0.15rem)] z-50 max-h-48 overflow-y-auto rounded-b-2xl border bg-popover p-4 text-popover-foreground shadow-xl motion-reduce:transition-none">
            <p className="text-sm leading-6">{expanded.shortExplanation}</p>
            <button
              type="button"
              onClick={() => setPanelConcept(expanded)}
              className="mt-2 min-h-10 text-sm font-semibold text-primary"
            >
              Read more in side panel
            </button>
          </div>
        ) : null}
      </section>
      {panelConcept ? (
        <ConceptSidePanel concept={panelConcept} onClose={() => setPanelConcept(null)} />
      ) : null}
    </>
  )
}
