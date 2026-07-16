'use client'

import dynamic from 'next/dynamic'

const StentExampleGallery = dynamic(
  () => import('./StentExampleGallery').then((module) => module.StentExampleGallery),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[520px] items-center justify-center rounded-[2rem] border border-slate-700 bg-slate-950 p-8 text-center text-slate-300"
        role="status"
      >
        Preparing the optimized 3D mechanics casebook…
      </div>
    ),
  },
)

export function StentExampleGalleryDynamic() {
  return <StentExampleGallery />
}
