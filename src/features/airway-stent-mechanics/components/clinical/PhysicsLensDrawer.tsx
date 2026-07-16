'use client'

import { Eye, Pause, Play, ScanSearch } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { getArchitectureProfile } from '../../content/architectureRegistry'
import type { PhysicsLensConfig, StentArchitectureId } from '../../engine/learningLabTypes'

const StentArchitectureViewport = dynamic(
  () =>
    import('../learning-lab/StentArchitectureViewport').then(
      (module) => module.StentArchitectureViewport,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300"
        role="status"
      >
        Preparing the optional clinical physics scene…
      </div>
    ),
  },
)

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(callback: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(reducedMotionQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function reducedMotionSnapshot() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(reducedMotionQuery).matches
    : false
}

function useSceneActivity<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null)
  const [intersecting, setIntersecting] = useState(true)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const node = ref.current
    if (!open || !node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry?.isIntersecting ?? true),
      { rootMargin: '160px 0px', threshold: 0.01 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  return { active: open && intersecting && visible, ref }
}

interface PhysicsLensDrawerProps {
  config: PhysicsLensConfig
  onOpen?: () => void
}

export function PhysicsLensDrawer({ config, onOpen }: PhysicsLensDrawerProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    reducedMotionSnapshot,
    () => false,
  )
  const [open, setOpen] = useState(false)
  const [architectureId, setArchitectureId] = useState<StentArchitectureId>(
    config.architectureIds[0] ?? 'studded-silicone',
  )
  const [playing, setPlaying] = useState(false)
  const { active, ref } = useSceneActivity<HTMLElement>(open)
  const profile = getArchitectureProfile(architectureId)
  const effectivePlaying = playing && active && !reducedMotion

  function toggleOpen() {
    setOpen((current) => {
      if (!current) onOpen?.()
      if (current) setPlaying(false)
      return !current
    })
  }

  return (
    <section
      ref={ref}
      className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-white shadow-xl"
      data-testid="physics-lens-drawer"
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 sm:px-6"
      >
        <span>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-200">
            <ScanSearch className="h-4 w-4" aria-hidden />
            Optional physics lens
          </span>
          <span className="mt-1 block text-base font-semibold">{config.clinicalQuestion}</span>
        </span>
        <span className="shrink-0 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          {open ? 'Close lens' : 'Inspect scene'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-slate-800" data-testid={`physics-lens-${config.preset}`}>
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
            <div className="relative h-[360px] min-w-0 bg-[radial-gradient(circle_at_50%_35%,rgba(8,145,178,0.23),transparent_58%)] sm:h-[460px]">
              <StentArchitectureViewport
                active={active}
                amplitude={0.72}
                mode={config.loadMode}
                onFrameChange={() => undefined}
                playing={effectivePlaying}
                profile={profile}
                reducedMotion={reducedMotion}
                resetVersion={0}
                showAirway
                showCover
              />
              <div className="pointer-events-none absolute left-3 top-3 max-w-[18rem] rounded-xl border border-white/10 bg-slate-950/80 p-3 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  {profile.shortLabel}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Inspect visible geometry; no clinical risk score is generated.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-800 p-5 lg:border-l lg:border-t-0">
              {config.architectureIds.length > 1 ? (
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Architecture family
                  <select
                    value={architectureId}
                    onChange={(event) => {
                      setArchitectureId(event.target.value as StentArchitectureId)
                      setPlaying(false)
                    }}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    {config.architectureIds.map((id) => {
                      const candidate = getArchitectureProfile(id)
                      return (
                        <option key={id} value={id}>
                          {candidate.label}
                        </option>
                      )
                    })}
                  </select>
                </label>
              ) : (
                <p className="text-sm font-semibold">{profile.label}</p>
              )}

              <button
                type="button"
                onClick={() => setPlaying((current) => !current)}
                disabled={reducedMotion}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {effectivePlaying ? (
                  <Pause className="h-4 w-4" aria-hidden />
                ) : (
                  <Play className="h-4 w-4" aria-hidden />
                )}
                {reducedMotion
                  ? 'Static pose shown'
                  : effectivePlaying
                    ? 'Pause motion'
                    : 'Play motion'}
              </button>

              <div className="mt-5">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  <Eye className="h-4 w-4" aria-hidden />
                  What to inspect
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                  {config.observationPrompts.map((prompt) => (
                    <li key={prompt}>• {prompt}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                Text equivalent and debrief
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{config.debrief}</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100">
              <strong>Evidence boundary:</strong> {config.evidenceBoundary}
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-800 px-5 py-3 text-xs leading-5 text-slate-400 sm:px-6">
          Optional and collapsed by default. The lesson can be completed without opening this
          visualization.
        </div>
      )}
    </section>
  )
}
