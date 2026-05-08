import { anatomyModels } from '@/data/printable-models'

export type XRModel = {
  slug: string
  name: string
  glbSrc: string
  usdzSrc?: string
  poster?: string
}

export const MODELS: XRModel[] = anatomyModels.flatMap((model) => {
  const glb = model.downloads.find((download) => download.format === 'glb')
  if (!glb) {
    return []
  }

  const usdz = model.downloads.find((download) => download.format === 'usdz')
  return [
    {
      slug: model.slug,
      name: model.name,
      glbSrc: glb.url,
      usdzSrc: usdz?.url,
      poster: model.thumbnail,
    },
  ]
})

export function getModel(slug: string): XRModel | undefined {
  return MODELS.find((model) => model.slug === slug)
}
