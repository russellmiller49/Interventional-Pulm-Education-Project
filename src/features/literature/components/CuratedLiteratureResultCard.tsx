import { ExternalLink, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  compactLiteratureAuthors,
  literatureCitationParts,
} from '@/features/literature/domain/display'
import type { LiteratureCuratedResult } from '@/features/literature/server/types'
import type { ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

interface CuratedLiteratureResultCardProps {
  labels: {
    abstractUnavailable: string
    adjacent: string
    conferenceAbstract: string
    core: string
    correction: string
    doi: string
    physicianReviewed: string
    pmid: string
    provenance: Record<LiteratureCuratedResult['reviewed']['enrichmentProvenance'], string>
    pubMed: string
    retracted: string
    reviewedOn: string
    visibility: Record<LiteratureCuratedResult['visibilityState'], string>
  }
  locale: ActiveLocale
  result: LiteratureCuratedResult
}

export function CuratedLiteratureResultCard({
  labels,
  locale,
  result,
}: CuratedLiteratureResultCardProps) {
  const authors = compactLiteratureAuthors(result.authors)
  const citation = literatureCitationParts(result)
  const reviewedDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(result.reviewed.reviewedAt),
  )

  return (
    <Card className="border-border/80 bg-card/95 shadow-sm">
      <CardContent className="gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{labels.physicianReviewed}</Badge>
          <Badge
            variant={result.reviewed.reviewedRelevance === 'include_core' ? 'success' : 'default'}
          >
            {result.reviewed.reviewedRelevance === 'include_core' ? labels.core : labels.adjacent}
          </Badge>
          <Badge variant="outline">{labels.provenance[result.reviewed.enrichmentProvenance]}</Badge>
          <Badge variant="outline">{labels.visibility[result.visibilityState]}</Badge>
          {result.isRetracted ? (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {labels.retracted}
            </Badge>
          ) : null}
          {result.isCorrection ? <Badge variant="warning">{labels.correction}</Badge> : null}
          {result.isConferenceAbstract ? (
            <Badge variant="outline">{labels.conferenceAbstract}</Badge>
          ) : null}
        </div>

        <div className="min-w-0 space-y-2">
          <h3 className="break-words text-xl font-semibold leading-snug tracking-tight">
            <Link
              href={`/admin/literature/article/${result.pmid}?from=curated`}
              className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {result.title}
            </Link>
          </h3>
          {authors ? <p className="text-sm text-muted-foreground">{authors}</p> : null}
          {citation ? <p className="text-sm font-medium text-foreground/80">{citation}</p> : null}
        </div>

        {result.publicationTypes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
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
        ) : null}

        <p className="line-clamp-4 break-words text-sm leading-6 text-muted-foreground">
          {result.abstractSnippet ?? labels.abstractUnavailable}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span>
            {labels.pmid}: {result.pmid}
          </span>
          {result.doi ? (
            <span className="break-all">
              {labels.doi}: {result.doi}
            </span>
          ) : null}
          <span>
            {labels.reviewedOn}: <time dateTime={result.reviewed.reviewedAt}>{reviewedDate}</time>
          </span>
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${result.pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {labels.pubMed}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
