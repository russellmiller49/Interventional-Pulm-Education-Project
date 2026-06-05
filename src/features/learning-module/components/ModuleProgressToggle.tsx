'use client'

import { useEffect, useState } from 'react'
import { CheckIcon, CircleIcon } from '@radix-ui/react-icons'

import { Button } from '@/components/ui/button'

import type { ModuleSectionKey } from '../types'
import { markModuleSection, readModuleProgress } from '../engine/moduleProgress'

interface ModuleProgressToggleProps {
  moduleId: string
  section: ModuleSectionKey
  label: string
}

/**
 * Per-section "mark complete" control. Writes to the shared module-progress
 * store so the curriculum-spine landing page can show progress chips. Manual
 * toggle (v1) keeps the learner in control and avoids guessing completion.
 */
export function ModuleProgressToggle({ moduleId, section, label }: ModuleProgressToggleProps) {
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    const record = readModuleProgress()[moduleId]
    setComplete(Boolean(record?.[section]))
  }, [moduleId, section])

  function toggle() {
    const next = !complete
    setComplete(next)
    markModuleSection(moduleId, section, next)
  }

  return (
    <div className="container max-w-4xl">
      <Button
        type="button"
        variant={complete ? 'default' : 'outline'}
        className="justify-start gap-2"
        onClick={toggle}
        aria-pressed={complete}
      >
        {complete ? (
          <CheckIcon className="h-4 w-4" aria-hidden />
        ) : (
          <CircleIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        {complete ? `${label} — marked complete` : label}
      </Button>
    </div>
  )
}
