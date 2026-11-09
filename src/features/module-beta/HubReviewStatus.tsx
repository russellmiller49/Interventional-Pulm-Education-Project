'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/*
 * Each hub card says whether the reviewer has given that module its overall review, so the hub
 * doubles as their checklist and a review missed on leaving is still found. One request serves
 * every card. Nothing is shown until reviews are open (the table exists) or when the request
 * fails, and owner-local mode renders no provider, so no card shows a status there.
 */
type ReviewStatusState =
  | { status: 'loading' | 'unavailable' }
  | { status: 'ready'; submitted: Record<string, string> }

const ReviewStatusContext = createContext<ReviewStatusState | null>(null)

export function ReviewStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewStatusState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    fetch('/api/module-review/mine')
      .then(async (response) => (response.ok ? response.json() : null))
      .then((mine) => {
        if (cancelled) return
        if (!mine?.reviewsOpen) return setState({ status: 'unavailable' })
        const submitted: Record<string, string> = {}
        for (const review of mine.reviews as { module_id: string; updated_at: string }[])
          submitted[review.module_id] = review.updated_at
        setState({ status: 'ready', submitted })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [])
  return <ReviewStatusContext.Provider value={state}>{children}</ReviewStatusContext.Provider>
}

export function ReviewStatus({ moduleId, locale }: { moduleId: string; locale: string }) {
  const state = useContext(ReviewStatusContext)
  if (state?.status !== 'ready') return null
  const at = state.submitted[moduleId]
  if (!at)
    return (
      <p className="text-sm text-muted-foreground" data-review-status="not-yet">
        Overall review: not yet
      </p>
    )
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    new Date(at),
  )
  return (
    <p className="text-sm text-muted-foreground" data-review-status="submitted">
      Overall review: submitted {date} ·{' '}
      <Link
        className="underline underline-offset-4"
        href={`/${locale}/development-beta/${moduleId}?review=1` as Route}
      >
        Edit
      </Link>
    </p>
  )
}
