'use client'

import {
  Activity,
  CircleGauge,
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Wind,
  Zap,
} from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

import {
  deviceArchitectureProfiles,
  deviceLoadModes,
  getDeviceArchitectureProfile,
} from '@/features/airway-stent-mechanics/content/deviceArchitectureProfiles'
import type {
  DeviceArchitectureId,
  DeviceArchitectureProfile,
  DeviceLoadMode,
} from '@/features/airway-stent-mechanics/content/deviceArchitectureProfiles'
import { cn } from '@/lib/cn'

import { DeviceArchitectureViewport } from './DeviceArchitectureViewport'

const loadModeIcons: Record<DeviceLoadMode, typeof Activity> = {
  breathing: Wind,
  cough: Zap,
  foreshortening: ScanLine,
  radial: CircleGauge,
  rest: Activity,
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(callback: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery)
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => false)
}

function couplingLabel(profile: DeviceArchitectureProfile) {
  if (profile.id === 'aero') return 'Minimal coupling in this schematic'
  if (profile.id === 'bonastent') return 'Braid-angle coupling shown'
  return 'Loop-opening coupling shown'
}

export function DeviceArchitectureLab() {
  const reducedMotion = usePrefersReducedMotion()
  const [selectedId, setSelectedId] = useState<DeviceArchitectureId>('aero')
  const [mode, setMode] = useState<DeviceLoadMode>('radial')
  const [playing, setPlaying] = useState(!reducedMotion)
  const [loadAmplitude, setLoadAmplitude] = useState(0.78)
  const [showAirway, setShowAirway] = useState(true)
  const [showCover, setShowCover] = useState(true)
  const [viewVersion, setViewVersion] = useState(0)
  const profile = getDeviceArchitectureProfile(selectedId)
  const selectedMode =
    deviceLoadModes.find((candidate) => candidate.id === mode) ?? deviceLoadModes[0]!
  const canAnimate = !reducedMotion && mode !== 'rest'
  const isPlaying = playing && canAnimate

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 text-white shadow-2xl">
      <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
        <div className="border-b border-slate-800 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              Topology-aware procedural model
            </span>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
              Same imposed motion · no force units
            </span>
          </div>
          <h3 className="mt-5 text-2xl font-semibold tracking-tight">
            AERO vs BONASTENT vs Ultraflex
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Each scaffold has a different path through space and receives the same imposed motion.
            Toggle the cover off whenever it obscures the wire or strut response.
          </p>

          <div className="mt-6 space-y-2" role="group" aria-label="Choose a device architecture">
            {deviceArchitectureProfiles.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setSelectedId(candidate.id)}
                aria-pressed={candidate.id === selectedId}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 motion-reduce:transition-none',
                  candidate.id === selectedId
                    ? 'border-cyan-300/60 bg-cyan-300/10'
                    : 'border-slate-700 bg-slate-900/70 hover:border-slate-500',
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-white">{candidate.shortLabel}</span>
                  <span className="text-xs text-cyan-200">{candidate.topologyLabel}</span>
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-400">
                  {candidate.loadPathSummary}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Applied motion
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {deviceLoadModes.map((candidate) => {
                const Icon = loadModeIcons[candidate.id]
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setMode(candidate.id)
                      if (candidate.id === 'rest') setPlaying(false)
                    }}
                    aria-pressed={candidate.id === mode}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 motion-reduce:transition-none',
                      candidate.id === mode
                        ? 'border-sky-400 bg-sky-400/10'
                        : 'border-slate-700 bg-slate-900/60 hover:border-slate-500',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4 text-sky-300" aria-hidden />
                      {candidate.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                      {candidate.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <label className="mt-6 block rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold">
              Illustrative displacement amplitude
              <span className="tabular-nums text-cyan-200">{Math.round(loadAmplitude * 100)}%</span>
            </span>
            <input
              type="range"
              min={0.25}
              max={1}
              step={0.01}
              value={loadAmplitude}
              onChange={(event) => setLoadAmplitude(Number(event.target.value))}
              className="mt-3 w-full accent-cyan-300"
              aria-describedby="architecture-load-boundary"
            />
            <span
              id="architecture-load-boundary"
              className="mt-2 block text-[11px] leading-4 text-slate-400"
            >
              This controls visible displacement, not newtons, pressure, chronic outward force, or
              compression resistance.
            </span>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowCover((current) => !current)}
              aria-pressed={showCover}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              {showCover ? (
                <Eye className="h-4 w-4" aria-hidden />
              ) : (
                <EyeOff className="h-4 w-4" aria-hidden />
              )}
              {showCover ? 'Cover visible' : 'Scaffold only'}
            </button>
            <button
              type="button"
              onClick={() => setShowAirway((current) => !current)}
              aria-pressed={showAirway}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              {showAirway ? (
                <Eye className="h-4 w-4" aria-hidden />
              ) : (
                <EyeOff className="h-4 w-4" aria-hidden />
              )}
              {showAirway ? 'Airway visible' : 'Airway hidden'}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlaying((current) => !current)}
              disabled={!canAnimate}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              {mode === 'rest' ? 'Static state' : isPlaying ? 'Pause cycle' : 'Play cycle'}
            </button>
            <button
              type="button"
              onClick={() => setViewVersion((current) => current + 1)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset view
            </button>
          </div>
          {reducedMotion ? (
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Motion reduction is enabled, so each load is shown as a static representative state.
            </p>
          ) : null}
        </div>

        <div className="bg-[radial-gradient(circle_at_50%_42%,rgba(14,116,144,0.24),transparent_58%)]">
          <div className="relative min-h-[540px]">
            <DeviceArchitectureViewport
              loadAmplitude={loadAmplitude}
              mode={mode}
              playing={isPlaying}
              profile={profile}
              reduceMotion={reducedMotion}
              showAirway={showAirway}
              showCover={showCover}
              viewVersion={viewVersion}
            />

            <div className="pointer-events-none absolute left-4 top-4 max-w-[19rem] rounded-2xl border border-white/10 bg-slate-950/75 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                {profile.topologyLabel}
              </p>
              <p className="mt-2 text-sm leading-5 text-slate-200">{selectedMode.description}</p>
            </div>
          </div>

          <div className="grid gap-2 border-t border-slate-800 bg-slate-950/55 p-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Scaffold
              </p>
              <p className="mt-1 text-xs leading-4 text-slate-200">{profile.scaffoldSummary}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Cover interface
              </p>
              <p className="mt-1 text-xs leading-4 text-slate-200">{profile.coverSummary}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Diameter–length coupling
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-200">{couplingLabel(profile)}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-300">{profile.couplingSummary}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-800 bg-slate-900/60 p-5 sm:p-7 md:grid-cols-3">
        {profile.teachingPoints.map((point, index) => (
          <article key={point} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300/10 text-sm font-semibold text-cyan-200">
              {index + 1}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">{point}</p>
          </article>
        ))}
      </div>

      <div className="border-t border-amber-300/20 bg-amber-300/5 px-5 py-4 text-xs leading-5 text-amber-100 sm:px-7">
        <strong>Evidence boundary:</strong> geometry is reconstructed from the module source set and
        device descriptions to teach scaffold topology and load paths. Dimensions, wire counts, loop
        counts, cover thicknesses, displacement gains, and diameter–length coupling coefficients are
        illustrative. This is not CAD, finite-element analysis, bench-calibrated product comparison,
        or a patient-specific predictor. Source references for this selected schematic:{' '}
        {profile.sourceRefs.join(', ')}.
      </div>
    </section>
  )
}
