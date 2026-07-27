import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FlattenedLiteratureTopic } from '@/features/literature/config'
import { literatureTopicLabel } from '@/features/literature/domain/display'
import type { LiteratureSearchQuery } from '@/features/literature/schemas/search'
import type { ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

interface LiteratureJournalOption {
  id: string
  displayName: string
}

interface LiteratureSearchFormProps {
  journals: LiteratureJournalOption[]
  labels: {
    adminPreview: string
    adminPreviewHelp: string
    clear: string
    examples: string
    filters: string
    journal: string
    landmark: string
    publicationType: string
    query: string
    queryPlaceholder: string
    search: string
    sort: string
    sortJournal: string
    sortNewest: string
    sortOldest: string
    sortRelevance: string
    topic: string
    yearFrom: string
    yearTo: string
  }
  locale: ActiveLocale
  query: LiteratureSearchQuery
  topics: FlattenedLiteratureTopic[]
}

const publicationTypeOptions = [
  'Journal Article',
  'Clinical Trial',
  'Randomized Controlled Trial',
  'Review',
  'Systematic Review',
  'Meta-Analysis',
  'Practice Guideline',
]

const searchExamples = [
  'EBUS-TBNA',
  'robotic bronchoscopy',
  'cone-beam CT',
  'airway stent migration',
]

export function LiteratureSearchForm({
  journals,
  labels,
  locale,
  query,
  topics,
}: LiteratureSearchFormProps) {
  return (
    <form action={`/${locale}/literature`} method="get" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="literature-query">
          {labels.query}
        </label>
        <Input
          id="literature-query"
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder={labels.queryPlaceholder}
          leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
          className="min-h-12 flex-1"
        />
        <Button type="submit" className="h-12 px-7">
          {labels.search}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{labels.examples}:</span>
        {searchExamples.map((example) => (
          <Link
            key={example}
            href={`/literature?q=${encodeURIComponent(example)}${query.adminPreview ? '&adminPreview=1' : ''}`}
            className="rounded-full border border-border px-3 py-1 transition hover:border-primary hover:text-primary"
          >
            {example}
          </Link>
        ))}
      </div>

      <details
        open={
          query.topicIds.length > 0 ||
          query.journalIds.length > 0 ||
          query.publicationTypes.length > 0 ||
          Boolean(query.yearFrom || query.yearTo || query.landmarkOnly)
        }
        className="rounded-2xl border border-border/80 bg-muted/25 p-4"
      >
        <summary className="cursor-pointer font-semibold">{labels.filters}</summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-medium" htmlFor="literature-topics">
            <span>{labels.topic}</span>
            <select
              id="literature-topics"
              name="topic"
              multiple
              size={7}
              defaultValue={query.topicIds}
              className="min-h-44 w-full rounded-xl border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.parentId ? '— ' : ''}
                  {literatureTopicLabel(topic, locale)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium" htmlFor="literature-journals">
            <span>{labels.journal}</span>
            <select
              id="literature-journals"
              name="journal"
              multiple
              size={7}
              defaultValue={query.journalIds}
              className="min-h-44 w-full rounded-xl border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {journals.map((journal) => (
                <option key={journal.id} value={journal.id}>
                  {journal.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium" htmlFor="literature-publication-types">
            <span>{labels.publicationType}</span>
            <select
              id="literature-publication-types"
              name="publicationType"
              multiple
              size={7}
              defaultValue={query.publicationTypes}
              className="min-h-44 w-full rounded-xl border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {publicationTypeOptions.map((publicationType) => (
                <option key={publicationType} value={publicationType}>
                  {publicationType}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2 text-sm font-medium" htmlFor="literature-year-from">
                <span>{labels.yearFrom}</span>
                <input
                  id="literature-year-from"
                  name="yearFrom"
                  type="number"
                  min="1800"
                  max="3000"
                  defaultValue={query.yearFrom}
                  className="h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-2 text-sm font-medium" htmlFor="literature-year-to">
                <span>{labels.yearTo}</span>
                <input
                  id="literature-year-to"
                  name="yearTo"
                  type="number"
                  min="1800"
                  max="3000"
                  defaultValue={query.yearTo}
                  className="h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>

            <label className="space-y-2 text-sm font-medium" htmlFor="literature-sort">
              <span>{labels.sort}</span>
              <select
                id="literature-sort"
                name="sort"
                defaultValue={query.sort}
                className="h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="relevance">{labels.sortRelevance}</option>
                <option value="newest">{labels.sortNewest}</option>
                <option value="oldest">{labels.sortOldest}</option>
                <option value="journal">{labels.sortJournal}</option>
              </select>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="landmark"
                value="1"
                defaultChecked={query.landmarkOnly}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span>{labels.landmark}</span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="adminPreview"
                value="1"
                defaultChecked={query.adminPreview}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span>
                <span className="block font-medium">{labels.adminPreview}</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {labels.adminPreviewHelp}
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="submit" size="sm">
            {labels.search}
          </Button>
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/literature">{labels.clear}</Link>
          </Button>
        </div>
      </details>
    </form>
  )
}
