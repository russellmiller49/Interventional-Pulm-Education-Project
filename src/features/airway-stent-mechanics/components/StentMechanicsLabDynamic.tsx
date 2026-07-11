'use client'

import dynamic from 'next/dynamic'

export const StentMechanicsLabDynamic = dynamic(
  () => import('./StentMechanicsLab').then((module) => module.StentMechanicsLab),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[540px] items-center justify-center rounded-3xl border border-slate-700 bg-slate-950 px-6 text-center text-sm text-slate-300"
        role="status"
      >
        Building the interactive stent mechanics scene…
      </div>
    ),
  },
)
