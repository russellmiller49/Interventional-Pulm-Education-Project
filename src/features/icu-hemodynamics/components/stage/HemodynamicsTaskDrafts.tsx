'use client'

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

type Drafts = Record<string, unknown>
const TaskDraftContext = createContext<{
  taskId: string
  drafts: Drafts
  setDrafts: Dispatch<SetStateAction<Drafts>>
} | null>(null)

/** Transient UI answers belong to the section session; no storage or simulation state here. */
export function HemodynamicsTaskDrafts({
  taskId,
  children,
}: {
  readonly taskId: string
  readonly children: ReactNode
}) {
  const [drafts, setDrafts] = useState<Drafts>({})
  return (
    <TaskDraftContext.Provider value={{ taskId, drafts, setDrafts }}>
      {children}
    </TaskDraftContext.Provider>
  )
}

/** Standalone references retain their existing local state; Learn retains drafts across Back. */
export function useHemodynamicsTaskDraft<T>(
  name: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(TaskDraftContext)
  const [local, setLocal] = useState(initial)
  if (!context) return [local, setLocal]
  const key = `${context.taskId}:${name}`
  const current = Object.hasOwn(context.drafts, key) ? (context.drafts[key] as T) : local
  return [
    current,
    (update) =>
      context.setDrafts((drafts) => {
        const previous = Object.hasOwn(drafts, key) ? (drafts[key] as T) : local
        return {
          ...drafts,
          [key]: typeof update === 'function' ? (update as (value: T) => T)(previous) : update,
        }
      }),
  ]
}
