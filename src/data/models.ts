export type XRModel = {
  slug: string
  name: string
  glbSrc: string
  usdzSrc?: string
  poster?: string
}

export const MODELS: XRModel[] = [
  {
    slug: 'mediastinal-lymph-map-glb',
    name: 'Mediastinal Lymph Node Atlas',
    glbSrc: '/models/lymph-node-education.glb',
    usdzSrc: '/models/mediastinum.usdz',
    poster: '/window.svg',
  },
]

export function getModel(slug: string): XRModel | undefined {
  return MODELS.find((model) => model.slug === slug)
}
