'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const DeviceArchitectureLab = dynamic(
  () => import('./DeviceArchitectureLab').then((module) => module.DeviceArchitectureLab),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[560px] items-center justify-center rounded-[2rem] border border-slate-700 bg-slate-950 p-8 text-center text-slate-300"
        role="status"
      >
        Constructing the topology-aware stent models…
      </div>
    ),
  },
)

const StentExampleGallery = dynamic(
  () => import('./StentExampleGallery').then((module) => module.StentExampleGallery),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[520px] items-center justify-center rounded-[2rem] border border-slate-700 bg-slate-950 p-8 text-center text-slate-300"
        role="status"
      >
        Preparing the legacy 3D mechanics casebook…
      </div>
    ),
  },
)

export function StentExampleGalleryDynamic() {
  const [showLegacyGallery, setShowLegacyGallery] = useState(false)

  return (
    <div className="space-y-8">
      <DeviceArchitectureLab />

      <div className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200">
          Legacy reference meshes
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The original normalized GLBs remain available for airway context, coverage, deployment,
          bend, fatigue, and carinal teaching prompts. They are not the topology reference for AERO,
          BONASTENT, or Ultraflex and stay unloaded until opened.
        </p>
        <button
          type="button"
          onClick={() => setShowLegacyGallery((current) => !current)}
          aria-expanded={showLegacyGallery}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          {showLegacyGallery ? 'Hide legacy casebook' : 'Open legacy casebook'}
        </button>
      </div>

      {showLegacyGallery ? <StentExampleGallery /> : null}
    </div>
  )
}
