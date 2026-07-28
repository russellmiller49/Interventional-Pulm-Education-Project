import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

import { serializeCatalogSearchQuery, type CatalogSearchQuery } from '../schemas/catalog-search'

interface CatalogPaginationProps {
  labels: {
    next: string
    page: string
    previous: string
  }
  pageCount: number
  page: number
  query: CatalogSearchQuery
  basePath?: string
}

function pageHref(query: CatalogSearchQuery, page: number, basePath: string) {
  const serialized = serializeCatalogSearchQuery({ ...query, page })
  return `${basePath}${serialized ? `?${serialized}` : ''}`
}

export function CatalogPagination({
  labels,
  pageCount,
  page,
  query,
  basePath = '/preference-cards/catalog',
}: CatalogPaginationProps) {
  if (pageCount <= 1) return null

  return (
    <nav
      aria-label={labels.page}
      className="flex flex-wrap items-center justify-between gap-3 pt-2"
    >
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={pageHref(query, page - 1, basePath)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {labels.previous}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">
        {labels.page} {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={pageHref(query, page + 1, basePath)}>
            {labels.next}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  )
}
