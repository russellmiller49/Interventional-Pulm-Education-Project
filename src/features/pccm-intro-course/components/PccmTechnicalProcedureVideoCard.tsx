import { ExternalLink, Lock, PlayCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PccmTechnicalProcedureVideo } from '@/features/pccm-intro-course/content/technicalProcedureVideos'

interface PccmTechnicalProcedureVideoCardProps {
  locked: boolean
  video: PccmTechnicalProcedureVideo
}

export function PccmTechnicalProcedureVideoCard({
  locked,
  video,
}: PccmTechnicalProcedureVideoCardProps) {
  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="flex aspect-video items-center justify-center bg-muted/70">
        {locked ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground">
            <Lock className="h-8 w-8" aria-hidden />
            <p className="text-sm font-medium">Complete both pretests to unlock this video.</p>
          </div>
        ) : video.embedUrl ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src={video.embedUrl}
            title={`${video.title} video`}
          />
        ) : (
          <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
            <PlayCircle className="h-9 w-9 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Publisher-hosted procedure video</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This video opens on the publisher&apos;s site.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={video.sourceUrl} rel="noreferrer" target="_blank">
                Watch on NEJM
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Technical procedure</Badge>
          <Badge variant="outline">{video.publisher}</Badge>
        </div>
        <div>
          <h3 className="font-semibold">{video.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{video.description}</p>
        </div>
        {!locked && video.embedUrl ? (
          <a
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
            href={video.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            View source: {video.sourceTitle}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  )
}
