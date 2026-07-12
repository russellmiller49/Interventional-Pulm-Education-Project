'use client'

import dynamic from 'next/dynamic'

export const StentArchitectureLabDynamic = dynamic(
  () => import('./StentArchitectureLab').then((module) => module.StentArchitectureLab),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[560px] items-center justify-center rounded-[2rem] border border-slate-700 bg-slate-950 px-6 text-center text-sm text-slate-300"
        role="status"
      >
        Building the interactive airway-stent architecture scene…
      </div>
    ),
  },
)
