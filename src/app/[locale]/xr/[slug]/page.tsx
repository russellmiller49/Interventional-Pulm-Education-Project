import { notFound } from 'next/navigation'

import { AnatomySpatialRouteViewer } from '@/components/3d/AnatomySpatialRouteViewer'
import { anatomyModels } from '@/data/printable-models'

type XRPageProps = {
  params: Promise<{ slug: string }>
}

export default async function XRPage({ params }: XRPageProps) {
  const { slug } = await params
  const model = anatomyModels.find((candidate) => candidate.slug === slug)

  if (!model) {
    return notFound()
  }

  return <AnatomySpatialRouteViewer model={model} />
}
