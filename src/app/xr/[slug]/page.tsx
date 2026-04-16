import { notFound } from 'next/navigation'

import { XRViewerDynamic } from '@/components/XRViewerDynamic'
import { getModel } from '@/data/models'

type XRPageProps = {
  params: Promise<{ slug: string }>
}

export default async function XRPage({ params }: XRPageProps) {
  const { slug } = await params
  const model = getModel(slug)

  if (!model) {
    return notFound()
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      <XRViewerDynamic
        glbSrc={model.glbSrc}
        usdzSrc={model.usdzSrc}
        title={`Enter Spatial: ${model.name}`}
      />
    </main>
  )
}
