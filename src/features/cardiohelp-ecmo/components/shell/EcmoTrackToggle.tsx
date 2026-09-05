'use client'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { HeartPulse, Wind } from 'lucide-react'

import type { SupportMode } from '../../engine/types'
import styles from '../cardiohelp-ecmo.module.css'

/**
 * The VV / VA radiogroup, lifted unchanged from the workbench header: real radio semantics with a
 * roving tabindex, arrow keys and Home/End moving the selection.
 */
export function EcmoTrackToggle({
  supportMode,
  onSelect,
}: {
  readonly supportMode: SupportMode
  readonly onSelect: (mode: SupportMode) => void
}) {
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const nextMode: SupportMode | null =
      event.key === 'Home'
        ? 'vv'
        : event.key === 'End'
          ? 'va'
          : event.key === 'ArrowRight' ||
              event.key === 'ArrowDown' ||
              event.key === 'ArrowLeft' ||
              event.key === 'ArrowUp'
            ? supportMode === 'vv'
              ? 'va'
              : 'vv'
            : null
    if (!nextMode) return
    event.preventDefault()
    onSelect(nextMode)
  }

  return (
    <div className={styles.trackToggle} role="radiogroup" aria-label="ECMO support mode">
      <button
        type="button"
        role="radio"
        aria-checked={supportMode === 'vv'}
        tabIndex={supportMode === 'vv' ? 0 : -1}
        data-active={supportMode === 'vv'}
        onKeyDown={handleKeyDown}
        onClick={() => onSelect('vv')}
      >
        <Wind aria-hidden="true" /> VV track
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={supportMode === 'va'}
        tabIndex={supportMode === 'va' ? 0 : -1}
        data-active={supportMode === 'va'}
        onKeyDown={handleKeyDown}
        onClick={() => onSelect('va')}
      >
        <HeartPulse aria-hidden="true" /> VA track
      </button>
    </div>
  )
}
