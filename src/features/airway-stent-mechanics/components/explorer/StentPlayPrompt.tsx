'use client'

import { ListChecks, Play, X } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'

interface StentPlayPromptProps {
  onClose: () => void
  onSelfCheck: () => void
  onSkipAndPlay: () => void
  open: boolean
  reducedMotion?: boolean
  stationTitle: string
}

export function StentPlayPrompt({
  onClose,
  onSelfCheck,
  onSkipAndPlay,
  open,
  reducedMotion = false,
  stationTitle,
}: StentPlayPromptProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const selfCheckButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    selfCheckButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocusedElement?.focus()
    }
  }, [open])

  if (!open) return null

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [],
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        aria-describedby="stent-play-prompt-description"
        aria-labelledby="stent-play-prompt-title"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-cyan-300/25 bg-background shadow-2xl"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <header className="border-b bg-gradient-to-r from-indigo-500/10 via-background to-cyan-500/10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                Before playback
              </p>
              <h2 id="stent-play-prompt-title" className="mt-2 text-2xl font-bold tracking-tight">
                Predict first, or explore now?
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close playback options"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p
            id="stent-play-prompt-description"
            className="mt-3 text-sm leading-6 text-muted-foreground"
          >
            Playback reveals the modeled consequence for <strong>{stationTitle}</strong>.{' '}
            {reducedMotion
              ? 'Your device currently requests reduced motion; use the self-check to reveal static states, or explicitly play the full animation.'
              : 'Use the optional self-check to commit a prediction, or skip it and start exploring immediately.'}
          </p>
        </header>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          <button
            ref={selfCheckButtonRef}
            type="button"
            aria-label="Go to self-check"
            onClick={onSelfCheck}
            className="group rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-left transition hover:border-indigo-500/60 hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:transition-none"
          >
            <ListChecks className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
            <span className="mt-3 block text-sm font-bold">Go to self-check</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {reducedMotion
                ? 'Make an unscored prediction, then reveal representative static states.'
                : 'Make an unscored prediction, then animate the result.'}
            </span>
          </button>
          <button
            type="button"
            aria-label="Skip prediction & play"
            onClick={onSkipAndPlay}
            className="group rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-left transition hover:border-cyan-500/60 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none"
          >
            <Play className="h-5 w-5 text-cyan-600 dark:text-cyan-300" aria-hidden />
            <span className="mt-3 block text-sm font-bold">Skip prediction &amp; play</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Unlock the controls and start the animation automatically.
            </span>
          </button>
        </div>
      </section>
    </div>
  )
}
