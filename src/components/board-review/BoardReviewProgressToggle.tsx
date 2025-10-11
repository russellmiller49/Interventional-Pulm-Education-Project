'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckIcon, CircleIcon } from '@radix-ui/react-icons'

import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'ip-board-review-progress'

interface ProgressRecord {
  completed: boolean
  updatedAt: string
}

type ProgressMap = Record<string, ProgressRecord>

interface BoardReviewProgressToggleProps {
  slug: string
  title: string
}

export function BoardReviewProgressToggle({ slug, title }: BoardReviewProgressToggleProps) {
  const [progress, setProgress] = useState<ProgressRecord | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return
      }
      const map = JSON.parse(raw) as ProgressMap
      if (map[slug]) {
        setProgress(map[slug])
      }
    } catch (error) {
      console.warn('Unable to read progress state', error)
    }
  }, [slug])

  const toggleProgress = useCallback(() => {
    setProgress((prev) => {
      const next: ProgressRecord = {
        completed: !(prev?.completed ?? false),
        updatedAt: new Date().toISOString(),
      }

      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          const map = raw ? (JSON.parse(raw) as ProgressMap) : {}
          map[slug] = next
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
        } catch (error) {
          console.warn('Unable to persist progress state', error)
        }
      }

      return next
    })
  }, [slug])

  const isCompleted = progress?.completed ?? false
  const lastUpdatedLabel = progress ? new Date(progress.updatedAt).toLocaleDateString() : null

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={isCompleted ? 'default' : 'outline'}
        className="justify-start gap-2 px-4"
        onClick={toggleProgress}
        aria-pressed={isCompleted}
      >
        {isCompleted ? (
          <CheckIcon className="h-4 w-4 text-primary-foreground" aria-hidden />
        ) : (
          <CircleIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        {isCompleted ? 'Marked complete' : 'Mark complete for board study'}
      </Button>
      <p className="text-xs text-muted-foreground">
        {isCompleted
          ? `Nice work! Last reviewed ${lastUpdatedLabel ?? 'just now'}.`
          : `Track your progress—${title} will stay highlighted in the catalog.`}
      </p>
    </div>
  )
}

