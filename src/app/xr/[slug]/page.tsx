import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'

import { getModel } from '@/data/models'

const XRViewer = dynamic(() => import('@/components/XRViewer'), { ssr: false })

type XRPageProps = {
  params: { slug: string }
}

export default function XRPage({ params }: XRPageProps) {
  const model = getModel(params.slug)

  if (!model) {
    return notFound()
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      <XRViewer
        glbSrc={model.glbSrc}
        usdzSrc={model.usdzSrc}
        title={`Enter Spatial: ${model.name}`}
      />
    </main>
  )
}
