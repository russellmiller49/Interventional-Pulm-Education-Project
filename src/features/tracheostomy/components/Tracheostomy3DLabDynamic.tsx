'use client'

import dynamic from 'next/dynamic'

export const Tracheostomy3DLabDynamic = dynamic(
  () => import('./Tracheostomy3DLab').then((module) => module.Tracheostomy3DLab),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[500px] items-center justify-center rounded-3xl border border-slate-700 bg-slate-950 text-sm text-slate-300">
        Loading the 3D tube lab…
      </div>
    ),
  },
)
