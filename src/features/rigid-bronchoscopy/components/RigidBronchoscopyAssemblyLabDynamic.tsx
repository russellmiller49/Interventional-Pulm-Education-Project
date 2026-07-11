'use client'

import dynamic from 'next/dynamic'

export const RigidBronchoscopyAssemblyLabDynamic = dynamic(
  () =>
    import('./RigidBronchoscopyAssemblyLab').then((module) => module.RigidBronchoscopyAssemblyLab),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[560px] items-center justify-center rounded-3xl border border-slate-700 bg-slate-950 px-6 text-center text-sm text-slate-300"
        role="status"
      >
        Loading the rigid bronchoscopy assembly lab…
      </div>
    ),
  },
)
