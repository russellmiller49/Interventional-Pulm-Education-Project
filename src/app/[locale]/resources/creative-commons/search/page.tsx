import type { Metadata } from 'next'
import type { Route } from 'next'
import { ArrowLeft, Download, ExternalLink, Filter, Search } from 'lucide-react'

import CreativeCommonsImageSimple from '@/components/CreativeCommonsImageSimple'
import CreativeCommonsLicenseDetails from '@/components/CreativeCommonsLicenseDetails'
import { Card } from '@/components/ui/card'
import { Link } from '@/i18n/navigation'
import {
  filterCreativeCommonsImages,
  getCreativeCommonsCategorySlug,
  listCreativeCommonsCategories,
  paginateCreativeCommonsImages,
  parsePositiveInteger,
  type CreativeCommonsImageRecord,
} from '@/lib/creative-commons'
import { HandoffContent } from '@/i18n/handoff'
import { defaultLocale, isActiveLocale } from '@/i18n/locale'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Search Creative Commons Images',
  description: 'Search curated Creative Commons medical images for educational use.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

interface SearchPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    category?: string | string[]
    page?: string | string[]
    q?: string | string[]
  }>
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale: rawLocale } = await params
  const locale = isActiveLocale(rawLocale) ? rawLocale : defaultLocale
  const paramsValue = await searchParams
  const query = Array.isArray(paramsValue?.q) ? paramsValue.q[0] : paramsValue?.q
  const category = Array.isArray(paramsValue?.category)
    ? paramsValue.category[0]
    : paramsValue?.category
  const page = parsePositiveInteger(paramsValue?.page, 1)
  const categories = listCreativeCommonsCategories()
  const selectedCategory = category === 'all' ? undefined : category
  const filteredImages = filterCreativeCommonsImages({
    categorySlug: selectedCategory,
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
            <h1 className="mb-2 text-4xl font-bold">Search Creative Commons Images</h1>
            <p className="text-gray-600">
              Search across server-filtered medical images without loading the full image index in
              the browser.
            </p>
          </div>

          <form className="mb-6 space-y-4" role="search">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="search"
                  name="q"
                  placeholder="Search by description, title, or category..."
                  defaultValue={query ?? ''}
                  className="min-h-12 w-full rounded-lg border-2 border-gray-200 py-3 pl-10 pr-4 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Search
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Filter size={18} />
                Filter by Category
              </label>
              <select
                name="category"
                defaultValue={selectedCategory ?? 'all'}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none md:w-auto"
              >
                <option value="all">All Categories</option>
                {categories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </form>

          <div className="mb-4">
            <p className="text-gray-600">
              Found <span className="font-semibold">{pagination.total}</span> images
              {query ? ` matching "${query}"` : ''}
            </p>
          </div>

          <ImageGrid images={pagination.images} />

          {pagination.total === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg text-gray-500">No images found matching your criteria.</p>
              <Link
                href="/resources/creative-commons/search"
                className="mt-4 inline-flex text-blue-600 hover:text-blue-800"
              >
                Clear search
              </Link>
            </div>
          ) : (
            <Pagination
              page={pagination.page}
              pageCount={pagination.pageCount}
              query={query}
              category={selectedCategory}
            />
          )}
        </div>
      }
    </HandoffContent>
  )
}

function ImageGrid({ images }: { images: CreativeCommonsImageRecord[] }) {
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
                <Link
                  href={`/resources/creative-commons/${getCreativeCommonsCategorySlug(image.Category)}`}
                  className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white transition-colors hover:bg-black/90"
                >
                  {image.Category}
                </Link>
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
  category,
  page,
  pageCount,
  query,
}: {
  category?: string
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
              href={buildPageHref(page - 1, query, category) as Route}
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
              href={buildPageHref(page + 1, query, category) as Route}
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

function buildPageHref(page: number, query?: string, category?: string) {
  const params = new URLSearchParams()
  if (query) {
    params.set('q', query)
  }
  if (category) {
    params.set('category', category)
  }
  if (page > 1) {
    params.set('page', String(page))
  }
  const search = params.toString()
  return search
    ? `/resources/creative-commons/search?${search}`
    : '/resources/creative-commons/search'
}
