import imagesData from '@/data/creative-commons-images.json'

export interface CreativeCommonsImageRecord {
  Category: string
  Image_url: string
  'Image Description': string
  article_title: string
  article_url: string
}

export interface CreativeCommonsCategory {
  name: string
  slug: string
  count: number
  icon: string
}

export interface PaginatedCreativeCommonsImages {
  images: CreativeCommonsImageRecord[]
  page: number
  pageSize: number
  pageCount: number
  total: number
}

const images = imagesData as CreativeCommonsImageRecord[]

const categoryConfig: Array<Omit<CreativeCommonsCategory, 'count'>> = [
  { name: '3D reconstructions', slug: '3d-reconstructions', icon: 'Microscopy' },
  { name: 'Imaging', slug: 'imaging', icon: 'Imaging' },
  { name: 'Pathology', slug: 'pathology', icon: 'Pathology' },
  { name: 'Miscellaneous', slug: 'miscellaneous', icon: 'Files' },
  {
    name: 'Peripheral Bronchoscopy (Navigation/Robotic/Intraprocedual Imaging)',
    slug: 'peripheral-bronchoscopy',
    icon: 'Navigation',
  },
  { name: 'Surgery', slug: 'surgery', icon: 'Procedure' },
  { name: 'Therapeutic Bronchoscopy', slug: 'therapeutic-bronchoscopy', icon: 'Therapy' },
  { name: 'Tracheostomy', slug: 'tracheostomy', icon: 'Airway' },
  { name: 'EBUS/EUS', slug: 'ebus-eus', icon: 'Ultrasound' },
  { name: 'Radiotherapy', slug: 'radiotherapy', icon: 'Radiation' },
  {
    name: 'Bronchoscopic Lung Volume Reduction',
    slug: 'bronchoscopic-lung-volume-reduction',
    icon: 'BLVR',
  },
  { name: 'Equipment', slug: 'equipment', icon: 'Tools' },
  { name: 'Pleural Procedures', slug: 'pleural-procedures', icon: 'Pleura' },
]

export const creativeCommonsCategorySlugs = Object.fromEntries(
  categoryConfig.map((category) => [category.name, category.slug]),
)

const categoryBySlug = new Map(categoryConfig.map((category) => [category.slug, category.name]))
const countsByCategory = images.reduce<Record<string, number>>((acc, image) => {
  acc[image.Category] = (acc[image.Category] ?? 0) + 1
  return acc
}, {})

export function getCreativeCommonsImageCount() {
  return images.length
}

export function listCreativeCommonsCategories(): CreativeCommonsCategory[] {
  return categoryConfig.map((category) => ({
    ...category,
    count: countsByCategory[category.name] ?? 0,
  }))
}

export function getCreativeCommonsCategoryName(slug: string) {
  return categoryBySlug.get(slug)
}

export function getCreativeCommonsCategorySlug(categoryName: string) {
  return (
    creativeCommonsCategorySlugs[categoryName] ?? categoryName.toLowerCase().replace(/\s+/g, '-')
  )
}

export function filterCreativeCommonsImages({
  categorySlug,
  query,
}: {
  categorySlug?: string
  query?: string
}) {
  const normalizedQuery = normalizeSearchTerm(query)
  const categoryName = categorySlug ? getCreativeCommonsCategoryName(categorySlug) : undefined

  if (categorySlug && !categoryName) {
    return []
  }

  return images.filter((image) => {
    if (categoryName && image.Category !== categoryName) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return normalizeSearchTerm(
      `${image['Image Description']} ${image.article_title} ${image.Category}`,
    ).includes(normalizedQuery)
  })
}

export function paginateCreativeCommonsImages(
  filteredImages: CreativeCommonsImageRecord[],
  page: number,
  pageSize = 24,
): PaginatedCreativeCommonsImages {
  const total = filteredImages.length
  const pageCount = Math.max(Math.ceil(total / pageSize), 1)
  const normalizedPage = clampInteger(page, 1, pageCount)
  const start = (normalizedPage - 1) * pageSize

  return {
    images: filteredImages.slice(start, start + pageSize),
    page: normalizedPage,
    pageSize,
    pageCount,
    total,
  }
}

export function parsePositiveInteger(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeSearchTerm(value: string | undefined) {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max)
}
