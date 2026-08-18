import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { LiteratureCapabilityNotice } from '@/features/literature/components/LiteratureCapabilityNotice'
import type {
  LiteratureCapabilityResult,
  LiteratureReviewedMetadata,
} from '@/features/literature/server/types'
import type { ActiveLocale } from '@/i18n/locale'

interface LiteratureReviewedProvenanceProps {
  labels: {
    adjacent: string
    core: string
    curatedMembership: string
    curatedNo: string
    curatedYes: string
    description: string
    excluded: string
    physicianReviewed: string
    provenance: Record<LiteratureReviewedMetadata['enrichmentProvenance'], string>
    provenanceLabel: string
    reviewedClass: string
    reviewedDate: string
    source: string
    sourceKinds: Record<LiteratureReviewedMetadata['sourceKind'], string>
    title: string
    unreviewed: string
    unreviewedDescription: string
  }
  capabilityLabels: {
    description: string
    projectLabel: string
    reasonLabel: string
    title: string
  }
  locale: ActiveLocale
  result: LiteratureCapabilityResult<LiteratureReviewedMetadata | null>
}

export function LiteratureReviewedProvenance({
  capabilityLabels,
  labels,
  locale,
  result,
}: LiteratureReviewedProvenanceProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{labels.title}</h2>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {result.error ? (
          <LiteratureCapabilityNotice
            capability={result.capability}
            title={capabilityLabels.title}
            description={capabilityLabels.description}
            projectLabel={capabilityLabels.projectLabel}
            reasonLabel={capabilityLabels.reasonLabel}
          />
        ) : result.data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{labels.physicianReviewed}</Badge>
              <Badge
                variant={
                  result.data.reviewedRelevance === 'include_core'
                    ? 'success'
                    : result.data.reviewedRelevance === 'include_adjacent'
                      ? 'default'
                      : 'outline'
                }
              >
                {result.data.reviewedRelevance === 'include_core'
                  ? labels.core
                  : result.data.reviewedRelevance === 'include_adjacent'
                    ? labels.adjacent
                    : labels.excluded}
              </Badge>
              <Badge variant="outline">{labels.provenance[result.data.enrichmentProvenance]}</Badge>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">{labels.reviewedClass}</dt>
                <dd className="font-medium">
                  {result.data.reviewedRelevance === 'include_core'
                    ? labels.core
                    : result.data.reviewedRelevance === 'include_adjacent'
                      ? labels.adjacent
                      : labels.excluded}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{labels.provenanceLabel}</dt>
                <dd className="font-medium">
                  {labels.provenance[result.data.enrichmentProvenance]}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{labels.reviewedDate}</dt>
                <dd className="font-medium">
                  <time dateTime={result.data.reviewedAt}>
                    {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                      new Date(result.data.reviewedAt),
                    )}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{labels.source}</dt>
                <dd className="font-medium">{labels.sourceKinds[result.data.sourceKind]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{labels.curatedMembership}</dt>
                <dd className="font-medium">
                  {result.data.curated ? labels.curatedYes : labels.curatedNo}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="outline">{labels.unreviewed}</Badge>
            <p className="text-sm leading-6 text-muted-foreground">
              {labels.unreviewedDescription}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
