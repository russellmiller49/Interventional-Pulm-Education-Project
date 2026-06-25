import type { Metadata } from 'next'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, ExternalLink, Search } from 'lucide-react'

import CreativeCommonsImageSimple from '@/components/CreativeCommonsImageSimple'
import CreativeCommonsLicenseDetails from '@/components/CreativeCommonsLicenseDetails'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import {
  filterCreativeCommonsImages,
  getCreativeCommonsCategoryName,
  listCreativeCommonsCategories,
  paginateCreativeCommonsImages,
  parsePositiveInteger,
} from '@/lib/creative-commons'
import { HandoffContent } from '@/i18n/handoff'
import { localizeCreativeCommonsText } from '@/i18n/creative-commons-search'
import { defaultLocale, isActiveLocale } from '@/i18n/locale'

interface CategoryPageProps {
  params: Promise<{ category: string; locale: string }>
  searchParams?: Promise<{
    page?: string | string[]
    q?: string | string[]
  }>
}

export function generateStaticParams() {
  return listCreativeCommonsCategories().map((category) => ({
    category: category.slug,
  }))
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category, locale: rawLocale } = await params
  const locale = isActiveLocale(rawLocale) ? rawLocale : defaultLocale
  const categoryName = getCreativeCommonsCategoryName(category)

  if (!categoryName) {
    return {
      title: 'Creative Commons image category not found',
    }
  }

  const localizedCategoryName = localizeCreativeCommonsText(locale, categoryName)

  if (locale === 'es') {
    return {
      title: `Imágenes de ${localizedCategoryName}`,
      description: `Imágenes médicas Creative Commons de la colección ${localizedCategoryName}.`,
    }
  }

  if (locale === 'zh-CN') {
    return {
      title: `${localizedCategoryName}图像`,
      description: `${localizedCategoryName}集合中的 Creative Commons 医学图像。`,
    }
  }

  return {
    title: `${categoryName} Images`,
    description: `Creative Commons medical images in the ${categoryName} collection.`,
  }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category, locale: rawLocale } = await params
  const locale = isActiveLocale(rawLocale) ? rawLocale : defaultLocale
  const paramsValue = await searchParams
  const categoryName = getCreativeCommonsCategoryName(category)

  if (!categoryName) {
    notFound()
  }

  const query = Array.isArray(paramsValue?.q) ? paramsValue.q[0] : paramsValue?.q
  const page = parsePositiveInteger(paramsValue?.page, 1)
  const filteredImages = filterCreativeCommonsImages({
    categorySlug: category,
    locale,
    query,
  })
  const pagination = paginateCreativeCommonsImages(filteredImages, page)

  return (
    <HandoffContent>
      {
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-8">
            <Link
              href="/resources/creative-commons"
              className="mb-4 inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="mr-2" size={20} />
              Back to Categories
            </Link>
            <h1 className="mb-2 text-4xl font-bold">{categoryName}</h1>
            <p className="text-gray-600">
              {pagination.total} {pagination.total === 1 ? 'image' : 'images'} in this category
            </p>
          </div>

          <form className="mb-6" role="search">
            <div className="relative flex gap-3">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="search"
                name="q"
                defaultValue={query ?? ''}
                placeholder="Search within this category..."
                className="min-h-12 w-full rounded-lg border-2 border-gray-200 py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </form>

          <ImageGrid images={pagination.images} />

          {pagination.total === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg text-gray-500">No images found matching your search.</p>
              <Link
                href={`/resources/creative-commons/${category}`}
                className="mt-4 inline-flex text-blue-600 hover:text-blue-800"
              >
                Clear search
              </Link>
            </div>
          ) : (
            <Pagination
              basePath={`/resources/creative-commons/${category}`}
              page={pagination.page}
              pageCount={pagination.pageCount}
              query={query}
            />
          )}
        </div>
      }
    </HandoffContent>
  )
}

function ImageGrid({ images }: { images: ReturnType<typeof filterCreativeCommonsImages> }) {
  return (
    <HandoffContent>
      {
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <Card
              key={`${image.Image_url}-${image.article_url}`}
              className="overflow-hidden transition-shadow hover:shadow-xl"
            >
              <div className="relative h-64 bg-gray-100">
                <CreativeCommonsImageSimple
                  src={image.Image_url}
                  alt={image['Image Description']}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="p-4">
                <p className="mb-3 line-clamp-3 text-sm text-gray-700">
                  {image['Image Description']}
                </p>

                <div className="mb-3">
                  <a
                    href={image.article_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-no-handoff-translate
                    className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {image.article_title}
                    <ExternalLink className="ml-1" size={14} />
                  </a>
                </div>

                <CreativeCommonsLicenseDetails
                  attribution={image.attribution}
                  className="mb-3"
                  license={image.license}
                  licenseUrl={image.license_url}
                />

                <div className="flex gap-2">
                  <a
                    href={image.Image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    <Download className="mr-1" size={16} />
                    Download
                  </a>
                  <a
                    href={image.article_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center rounded bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-300"
                  >
                    <ExternalLink className="mr-1" size={16} />
                    Article
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      }
    </HandoffContent>
  )
}

function Pagination({
  basePath,
  page,
  pageCount,
  query,
}: {
  basePath: string
  page: number
  pageCount: number
  query?: string
}) {
  if (pageCount <= 1) {
    return <HandoffContent>{null}</HandoffContent>
  }

  return (
    <HandoffContent>
      {
        <nav
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
          aria-label="Pagination"
        >
          {page > 1 ? (
            <Link
              href={buildPageHref(basePath, page - 1, query) as Route}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-500 hover:text-blue-700"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-sm text-gray-600">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={buildPageHref(basePath, page + 1, query) as Route}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-500 hover:text-blue-700"
            >
              Next
            </Link>
          ) : null}
        </nav>
      }
    </HandoffContent>
  )
}

function buildPageHref(basePath: string, page: number, query?: string) {
  const params = new URLSearchParams()
  if (query) {
    params.set('q', query)
  }
  if (page > 1) {
    params.set('page', String(page))
  }
  const search = params.toString()
  return search ? `${basePath}?${search}` : basePath
}
