'use client'

import { useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { boardReviewCategoryLabels, type BoardReviewChapterMeta } from '@/data/board-review'

import { BoardReviewCard } from './BoardReviewCard'

interface BoardReviewCatalogProps {
  chapters: BoardReviewChapterMeta[]
}

const allOption = { value: 'all', label: 'All domains' } as const

export function BoardReviewCatalog({ chapters }: BoardReviewCatalogProps) {
  const [category, setCategory] = useState<
    typeof allOption.value | BoardReviewChapterMeta['category']
  >('all')
  const [query, setQuery] = useState('')

  const categories = useMemo(() => {
    const counts = chapters.reduce<Record<string, number>>((acc, chapter) => {
      acc[chapter.category] = (acc[chapter.category] ?? 0) + 1
      return acc
    }, {})

    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({
        value,
        count,
        label: boardReviewCategoryLabels[value as BoardReviewChapterMeta['category']],
      }))
  }, [chapters])

  const filteredChapters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return chapters.filter((chapter) => {
      const matchesCategory = category === 'all' || chapter.category === category

      if (!matchesCategory) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        chapter.title,
        chapter.description,
        chapter.summary,
        ...chapter.tags,
        ...chapter.examDomains,
        ...chapter.focus,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [category, chapters, query])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={category === 'all' ? 'default' : 'outline'}
            className={cn(
              'rounded-full px-4 py-1 text-sm',
              category === 'all' ? 'shadow-sm' : 'border-border/60',
            )}
            onClick={() => setCategory('all')}
          >
            All ({chapters.length})
          </Button>
          {categories.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={category === item.value ? 'default' : 'outline'}
              className={cn(
                'rounded-full px-4 py-1 text-sm',
                category === item.value ? 'shadow-sm' : 'border-border/60',
              )}
              onClick={() => setCategory(item.value as BoardReviewChapterMeta['category'])}
            >
              {item.label} ({item.count})
            </Button>
          ))}
        </div>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chapters, domains, or tags"
          className="w-full max-w-sm text-sm"
          aria-label="Search board review chapters"
        />
      </div>

      {filteredChapters.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredChapters.map((chapter) => (
            <BoardReviewCard key={chapter.slug} chapter={chapter} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/60 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No chapters match that filter yet. Try another keyword or category.
          </p>
        </div>
      )}
    </div>
  )
}
