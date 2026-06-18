import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { canCurrentUserViewDraftModules } from '@/lib/draft-module-guard'
import { getFeaturedSearchResults, searchSite } from '@/lib/site-search'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search resources, board review chapters, simulation tools, and clinician guides.',
}

interface SearchPageProps {
  searchParams?: Promise<{
    q?: string | string[]
  }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = Array.isArray(params?.q) ? params?.q[0] : params?.q
  const normalizedQuery = query?.trim() ?? ''
  const canViewDrafts = await canCurrentUserViewDraftModules()
  const searchOptions = { canViewDrafts }
  const results = normalizedQuery
    ? searchSite(normalizedQuery, 60, searchOptions)
    : getFeaturedSearchResults(searchOptions)

  return (
    <div className="container space-y-8 py-12 md:py-16">
      <section className="max-w-3xl space-y-5">
        <Badge variant="info" className="rounded-full px-3 py-1">
          Search
        </Badge>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Search resources and guides
          </h1>
          <p className="text-base leading-7 text-muted-foreground md:text-lg">
            Find board review chapters, medical image collections, simulation tools, and
            clinician-builder resources.
          </p>
        </div>
      </section>

      <form action="/search" className="flex max-w-3xl flex-col gap-3 sm:flex-row">
        <Input
          type="search"
          name="q"
          defaultValue={normalizedQuery}
          placeholder="Try EBUS, pleural, airway stent, coding, or safety"
          leadingIcon={<Search className="h-4 w-4" />}
          className="min-h-11 flex-1"
          aria-label="Search resources and guides"
        />
        <Button type="submit" className="h-11 px-6">
          Search
        </Button>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {normalizedQuery ? `Results for "${normalizedQuery}"` : 'Suggested starting points'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </p>
        </div>

        {results.length > 0 ? (
          <div className="grid gap-3">
            {results.map((result) => (
              <Link
                key={`${result.href}-${result.title}`}
                href={result.href as Route}
                className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="border-border/80 bg-card/80 transition-colors group-hover:border-primary/40">
                  <CardContent className="gap-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full">
                        {result.section}
                      </Badge>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {result.type.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">
                        {result.title}
                      </h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {result.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-border/80 bg-muted/40">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No matches yet. Try a broader term like airway, EBUS, pleural, coding, anatomy, or
              safety.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
