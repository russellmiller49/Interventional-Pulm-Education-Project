'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useEffect, useState } from 'react'
import { betaModuleById } from './catalog'
import { finalizedOwnerDraftIds, readOwnerDrafts } from './ownerDraftStore'
import { ownerFeedbackContent } from './ownerFeedbackStore'

// Owner-local only. Points back to the testing pages that still hold unsent work; it never
// opens, saves, or removes a draft.
export function OwnerDraftNotice({ locale }: { locale: string }) {
  const [hosts, setHosts] = useState<string[]>([])
  const [problem, setProblem] = useState('')
  useEffect(() => {
    let current = true
    void (async () => {
      try {
        const { drafts, unreadable } = await readOwnerDrafts()
        // A stored copy of exactly what was saved or discarded is cleared when its testing page
        // next opens. Anything that differs from it is still unsent work.
        const finalized = await finalizedOwnerDraftIds(ownerFeedbackContent)
        const pending: string[] = []
        for (const draft of drafts)
          if (!finalized.has(draft.id) && !pending.includes(draft.host_module_id))
            pending.push(draft.host_module_id)
        if (!current) return
        setHosts(pending)
        setProblem(
          unreadable.length
            ? 'An unsent draft on this browser cannot be opened by this version. It has not been removed; open any module below to review it.'
            : '',
        )
      } catch (error) {
        if (current)
          setProblem(
            error instanceof Error
              ? error.message
              : 'Unsent drafts on this browser are unreadable.',
          )
      }
    })()
    return () => {
      current = false
    }
  }, [])
  if (!hosts.length && !problem) return null
  return (
    <div
      role="status"
      className="space-y-2 rounded-xl border border-primary/40 p-4 text-sm leading-6"
    >
      {hosts.length > 0 && (
        <p>
          Unsent feedback kept on this browser, not saved yet:{' '}
          {hosts.map((id, index) => (
            <span key={id}>
              {index > 0 && ', '}
              <Link
                className="underline underline-offset-4"
                href={`/${locale}/development-beta/${id}` as Route}
              >
                {betaModuleById(id)?.title ?? id}
              </Link>
            </span>
          ))}
          . Open the module and choose <strong>Continue feedback</strong> to save or discard it.
        </p>
      )}
      {problem && <p className="text-destructive">{problem}</p>}
    </div>
  )
}
