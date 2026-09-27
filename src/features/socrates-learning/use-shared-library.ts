'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  publishSharedSlide,
  refreshSharedLibrary,
  saveSharedSlide,
} from '@/app/[locale]/socrates-library/actions'
import { draftSignature, type SharedDraft, type SharedSlide } from './shared-library'

export interface SharedEntry {
  draft: SharedDraft
  base?: SharedSlide
  dirty: boolean
  conflict?: SharedSlide
  error?: string
  generation: number
}
export function reconcileShared(entries: Record<string, SharedEntry>, incoming: SharedSlide[]) {
  const next = { ...entries }
  for (const row of incoming) {
    const old = next[row.id]
    if (
      old?.base &&
      (old.base.version > row.version ||
        (old.base.version === row.version && old.base.document.revision >= row.document.revision))
    )
      continue
    if (old?.dirty)
      next[row.id] = {
        ...old,
        conflict: row,
        error:
          'Another author saved changes. Your edits are preserved; compare the versions before continuing.',
      }
    else
      next[row.id] = { draft: row, base: row, dirty: false, generation: (old?.generation ?? 0) + 1 }
  }
  return next
}

export function useSharedLibrary(initial: SharedSlide[], userId: string) {
  const [entries, setEntries] = useState<Record<string, SharedEntry>>(() =>
    reconcileShared({}, initial),
  )
  const state = useRef(entries)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const inflight = useRef(false)
  const [ready, setReady] = useState(false)
  const [tabKey] = useState(() => {
    if (typeof window === 'undefined') return 'server'
    try {
      const key = sessionStorage.getItem('socrates-author-tab') ?? crypto.randomUUID()
      sessionStorage.setItem('socrates-author-tab', key)
      return key
    } catch {
      return crypto.randomUUID()
    }
  })
  // Separate tab recovery prevents an idle tab from clearing another tab's unsaved work.
  const key = `socrates-shared-unsaved:${userId}:${tabKey}`
  const commit = useCallback(
    (next: Record<string, SharedEntry>) => {
      state.current = next
      setEntries(next)
      try {
        localStorage.setItem(
          key,
          JSON.stringify(Object.fromEntries(Object.entries(next).filter(([, e]) => e.dirty))),
        )
      } catch {
        setNotice(
          'Browser recovery storage is unavailable. Keep this page open until all edits are saved to the team.',
        )
      }
    },
    [key],
  )
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const recovered = JSON.parse(raw) as Record<string, SharedEntry>
        // Recovery is untrusted; shape checks precede use and the server validates every save.
        const valid = Object.fromEntries(
          Object.entries(recovered).filter(
            ([id, e]) =>
              e?.dirty && e.draft?.id === id && typeof e.draft.document?.title === 'string',
          ),
        )
        commit(reconcileShared({ ...state.current, ...valid }, initial))
      }
    } catch {
      setNotice('Unsaved browser recovery could not be restored. It has been left intact.')
    }
    setReady(true)
    // Initial server snapshot is used only during hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const refresh = useCallback(async () => {
    if (inflight.current) return
    const result = await refreshSharedLibrary().catch(() => ({
      ok: false as const,
      error: 'Connection lost. Your edits are retained; reconnect and retry.',
    }))
    if (result.ok) {
      setNotice('')
      commit(reconcileShared(state.current, result.slides))
    } else setNotice(result.error)
  }, [commit])
  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const timer = window.setInterval(refreshVisible, 10000)
    window.addEventListener('focus', refreshVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refreshVisible)
    }
  }, [refresh])
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (Object.values(state.current).some((e) => e.dirty)) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [])
  const edit = useCallback(
    (draft: SharedDraft) => {
      const old = state.current[draft.id]
      if (old && draftSignature(old.draft) === draftSignature(draft)) return
      commit({
        ...state.current,
        [draft.id]: {
          ...old,
          draft,
          dirty: true,
          generation: old?.generation ?? 0,
          error: old?.conflict ? old.error : undefined,
        },
      })
    },
    [commit],
  )
  const save = useCallback(
    async (id: string) => {
      const entry = state.current[id]
      if (inflight.current || !entry?.dirty || entry.conflict) return
      inflight.current = true
      setBusy(id)
      const result = await saveSharedSlide(
        {
          ...entry.draft,
          document: { ...entry.draft.document, recordId: entry.base?.document.recordId },
        },
        entry.base?.version ?? 0,
        entry.base?.document.revision ?? 0,
      ).catch(() => ({
        ok: false as const,
        error: 'Connection lost. Your edits are retained; retry saving.',
        conflict: false,
      }))
      const current = state.current[id]
      if (result.ok) {
        const unchanged = draftSignature(current.draft) === draftSignature(entry.draft)
        commit({
          ...state.current,
          [id]: {
            ...current,
            base: result.slide,
            draft: unchanged
              ? result.slide
              : {
                  ...current.draft,
                  document: {
                    ...current.draft.document,
                    recordId: result.slide.document.recordId,
                    revision: result.slide.document.revision,
                  },
                },
            dirty: !unchanged,
            error: undefined,
            conflict: undefined,
          },
        })
      } else
        commit({
          ...state.current,
          [id]: {
            ...current,
            error: result.error,
            ...(result.conflict ? { conflict: current.base } : {}),
          },
        })
      inflight.current = false
      setBusy(null)
      if (!result.ok && result.conflict) void refresh()
    },
    [commit, refresh],
  )
  useEffect(() => {
    if (!ready || busy) return
    const next = Object.values(entries).find((e) => e.dirty && !e.error && !e.conflict)
    if (!next) return
    const timer = window.setTimeout(() => void save(next.draft.id), 900)
    return () => clearTimeout(timer)
  }, [entries, ready, busy, save])
  const publish = async (id: string, release: boolean) => {
    const e = state.current[id]
    if (inflight.current || !e?.base || e.dirty) return
    inflight.current = true
    setBusy(id)
    const result = await publishSharedSlide(
      id,
      e.base.version,
      e.base.document.revision,
      release,
    ).catch(() => ({
      ok: false as const,
      error: 'Publication could not be confirmed. Refresh the shared library before retrying.',
    }))
    if (result.ok) commit(reconcileShared(state.current, [result.slide]))
    else setNotice(result.error)
    inflight.current = false
    setBusy(null)
  }
  const useLatest = (id: string) => {
    const e = state.current[id]
    if (!e.conflict) return
    // Keep the discarded working copy available through the recovery export control.
    try {
      localStorage.setItem(`${key}:recovery:${id}`, JSON.stringify(e.draft))
    } catch {
      setNotice(
        'Export your edits before loading the team version; recovery storage is unavailable.',
      )
      return
    }
    commit({
      ...state.current,
      [id]: { draft: e.conflict, base: e.conflict, dirty: false, generation: e.generation + 1 },
    })
  }
  return { entries, edit, refresh, save, publish, useLatest, busy, notice, ready, recoveryKey: key }
}
