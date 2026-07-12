'use client'

import { FlaskConical, Wrench } from 'lucide-react'
import { useState } from 'react'

import {
  engineeringDeepDiveBoundary,
  engineeringMissions,
  forceTaxonomy,
  ginaDumonBenchData,
} from '../../content/engineeringDeepDiveContent'
import type { StentLabExperienceProgress } from '../../engine/learningLabTypes'
import { StentArchitectureLabDynamic } from './StentArchitectureLabDynamic'

interface EngineeringDeepDiveProps {
  initiallyOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onOpen?: () => void
  onOptionalCompletion?: () => void
}

export function EngineeringDeepDive({
  initiallyOpen = false,
  open: controlledOpen,
  onOpenChange,
  onOpen,
  onOptionalCompletion,
}: EngineeringDeepDiveProps) {
  const [internalOpen, setInternalOpen] = useState(initiallyOpen)
  const [showMissions, setShowMissions] = useState(false)
  const open = controlledOpen ?? internalOpen

  function toggleOpen() {
    const next = !open
    if (next) onOpen?.()
    if (controlledOpen === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  function handleMissionProgress(progress: StentLabExperienceProgress) {
    if (progress.complete) onOptionalCompletion?.()
  }

  return (
    <section
      id="airway-stent-engineering-deep-dive"
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-white shadow-2xl"
      aria-labelledby="engineering-deep-dive-title"
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 sm:px-7"
      >
        <span>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-amber-200">
            <FlaskConical className="h-4 w-4" aria-hidden />
            Optional · does not affect module completion
          </span>
          <span id="engineering-deep-dive-title" className="mt-1 block text-xl font-bold">
            Advanced mechanics: inspect the engineering model
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200">
          {open ? 'Close' : 'Open'}
        </span>
      </button>

      {open ? (
        <div className="space-y-6 border-t border-slate-800 p-4 sm:p-6">
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100">
            <strong>Engineering evidence boundary:</strong> {engineeringDeepDiveBoundary}
          </div>

          <StentArchitectureLabDynamic experience="architecture-explorer" />

          <div className="grid gap-4 lg:grid-cols-2">
            <section
              className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5"
              aria-labelledby="force-taxonomy-title"
            >
              <h3 id="force-taxonomy-title" className="text-lg font-semibold">
                Method-bound force vocabulary
              </h3>
              <div className="mt-4 space-y-3">
                {forceTaxonomy.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"
                  >
                    <h4 className="text-sm font-semibold text-cyan-100">{item.term}</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-300">{item.definition}</p>
                    <p className="mt-2 text-xs leading-5 text-amber-100">
                      Boundary: {item.interpretationLimit}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section
              className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5"
              aria-labelledby="bench-example-title"
            >
              <h3 id="bench-example-title" className="text-lg font-semibold">
                GINA–Dumon sourced bench example
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Values belong to the cited sizes and fixtures and are shown to teach method
                dependence.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-300">
                      <th className="border border-slate-700 p-2">Metric</th>
                      <th className="border border-slate-700 p-2">Dumon</th>
                      <th className="border border-slate-700 p-2">GINA</th>
                      <th className="border border-slate-700 p-2">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ginaDumonBenchData.map((row) => (
                      <tr key={row.id}>
                        <th className="border border-slate-700 p-2 font-semibold text-white">
                          {row.metric}
                        </th>
                        <td className="border border-slate-700 p-2 text-slate-300">{row.dumon}</td>
                        <td className="border border-slate-700 p-2 text-slate-300">{row.gina}</td>
                        <td className="border border-slate-700 p-2 text-slate-300">{row.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Wrench className="h-5 w-5 text-cyan-200" aria-hidden />
                  Existing engineering practice missions
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {engineeringMissions.length} optional missions retain the full controls and method
                  labels.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMissions((current) => !current)}
                aria-expanded={showMissions}
                className="min-h-11 rounded-xl border border-slate-600 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {showMissions ? 'Hide missions' : 'Open missions'}
              </button>
            </div>
            {showMissions ? (
              <div className="mt-5">
                <StentArchitectureLabDynamic
                  experience="force-practice"
                  onExperienceProgress={handleMissionProgress}
                />
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="border-t border-slate-800 px-5 py-3 text-xs leading-5 text-slate-400 sm:px-7">
          Raw displacement controls, force taxonomy, normalized geometry readouts, bench values, and
          engineering missions stay outside the required clinical path.
        </div>
      )}
    </section>
  )
}
