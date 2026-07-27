import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { LiteratureSearchQuery } from '@/features/literature/schemas/search'
import { serializeLiteratureSearchQuery } from '@/features/literature/search/url'
import { Link } from '@/i18n/navigation'

interface LiteraturePaginationProps {
  labels: {
    next: string
    page: string
    previous: string
  }
  pageCount: number
  query: LiteratureSearchQuery
}

function pageHref(query: LiteratureSearchQuery, page: number) {
  const serialized = serializeLiteratureSearchQuery(
    { ...query, page },
    { includeAdminPreview: true },
  )
  return `/literature${serialized ? `?${serialized}` : ''}`
}

export function LiteraturePagination({ labels, pageCount, query }: LiteraturePaginationProps) {
  if (pageCount <= 1) {
    return null
  }

  return (
    <nav
      aria-label={labels.page}
      className="flex flex-wrap items-center justify-between gap-3 pt-2"
    >
      {query.page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={pageHref(query, query.page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {labels.previous}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">
        {labels.page} {query.page} / {pageCount}
      </span>
      {query.page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={pageHref(query, query.page + 1)}>
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
