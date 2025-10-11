import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import type { DownloadResource } from '@/lib/types'

interface DownloadCardProps {
  resource: DownloadResource
}

export function DownloadCard({ resource }: DownloadCardProps) {
  return (
    <Card className="flex h-full flex-col justify-between border-border/70 bg-card/80">
      <CardHeader className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-border/60 bg-muted">
            {resource.previewImage ? (
              <Image
                src={resource.previewImage}
                alt={resource.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {resource.format.toUpperCase()}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {resource.name}
            </h3>
            <p className="text-sm text-muted-foreground">{resource.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Format: {resource.format.toUpperCase()}
          </Badge>
          {resource.sizeMB ? (
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {resource.sizeMB} MB
            </Badge>
          ) : null}
          <Badge variant="outline" className="rounded-full px-3 py-1 capitalize">
            {resource.difficulty}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            v{resource.version}
          </Badge>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground/90">
          {resource.estimatedPrintTime ? (
            <li>Estimated print/build time: {resource.estimatedPrintTime}</li>
          ) : null}
          {resource.estimatedMaterialCost ? (
            <li>Estimated material cost: {resource.estimatedMaterialCost}</li>
          ) : null}
          <li>Updated: {new Date(resource.updatedAt).toLocaleDateString()}</li>
        </ul>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border/60 bg-muted/20 p-4">
        <span className="text-xs text-muted-foreground">Future analytics will count downloads</span>
        <Button asChild size="sm">
          <Link href={`/api/download/${resource.id}`} prefetch={false}>
            Download
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
