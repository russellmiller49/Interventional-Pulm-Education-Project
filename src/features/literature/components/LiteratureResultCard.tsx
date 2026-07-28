import { ExternalLink, Landmark, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  compactLiteratureAuthors,
  literatureCitationParts,
  literatureTopicLabel,
} from '@/features/literature/domain/display'
import type { LiteratureSearchResult } from '@/features/literature/server/types'
import type { ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

interface LiteratureResultCardProps {
  adminPreview: boolean
  labels: {
    abstractUnavailable: string
    correction: string
    confirmedTopic: string
    doi: string
    landmark: string
    matchedBy: string
    matchedFields: Record<string, string>
    pmid: string
    pubMed: string
    relevanceStates: Record<string, string>
    retracted: string
    suggestedTopic: string
    visibilityStates: Record<string, string>
  }
  locale: ActiveLocale
  result: LiteratureSearchResult
}

export function LiteratureResultCard({
  adminPreview,
  labels,
  locale,
  result,
}: LiteratureResultCardProps) {
  const authors = compactLiteratureAuthors(result.authors)
  const citation = literatureCitationParts(result)

  return (
    <Card className="border-border/80 bg-card/90">
      <CardContent className="gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {result.isLandmark ? (
            <Badge variant="success" className="gap-1">
              <Landmark className="h-3 w-3" aria-hidden="true" />
              {labels.landmark}
            </Badge>
          ) : null}
          {result.isRetracted ? (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {labels.retracted}
            </Badge>
          ) : null}
          {result.isCorrection ? <Badge variant="outline">{labels.correction}</Badge> : null}
          {adminPreview ? (
            <>
              <Badge variant="outline">
                {labels.relevanceStates[result.relevanceState] ?? result.relevanceState}
              </Badge>
              <Badge variant="outline">
                {labels.visibilityStates[result.visibilityState] ?? result.visibilityState}
              </Badge>
            </>
          ) : null}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold leading-snug tracking-tight">
            <Link
              href={`/literature/article/${result.pmid}`}
              className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {result.title}
            </Link>
          </h2>
          {authors ? <p className="text-sm text-muted-foreground">{authors}</p> : null}
          {citation ? <p className="text-sm font-medium text-foreground/80">{citation}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {result.confirmedTopics.map((topic) => (
            <Badge
              key={`confirmed-${topic.id}`}
              variant="default"
              title={labels.confirmedTopic}
              className="normal-case tracking-normal"
            >
              {literatureTopicLabel(topic, locale)}
            </Badge>
          ))}
          {adminPreview
            ? result.suggestedTopics.map((topic) => (
                <Badge
                  key={`suggested-${topic.id}`}
                  variant="outline"
                  title={labels.suggestedTopic}
                  className="gap-1 normal-case tracking-normal"
                >
                  {literatureTopicLabel(topic, locale)}
                  <span className="font-normal">({labels.suggestedTopic})</span>
                </Badge>
              ))
            : null}
          {result.publicationTypes.map((publicationType) => (
            <Badge
              key={publicationType}
              variant="secondary"
              className="normal-case tracking-normal"
            >
              {publicationType}
            </Badge>
          ))}
        </div>

        <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">
          {result.abstractSnippet ?? labels.abstractUnavailable}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span>
            {labels.pmid}: {result.pmid}
          </span>
          {result.doi ? (
            <span>
              {labels.doi}: {result.doi}
            </span>
          ) : null}
          {result.matchedBy.length > 0 ? (
            <span>
              {labels.matchedBy}:{' '}
              {result.matchedBy.map((field) => labels.matchedFields[field] ?? field).join(', ')}
            </span>
          ) : null}
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${result.pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {labels.pubMed}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          {result.doi ? (
            <a
              href={`https://doi.org/${encodeURIComponent(result.doi)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {labels.doi}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
