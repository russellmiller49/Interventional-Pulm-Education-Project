import { Button } from '@/components/ui/button'

interface DownloadButtonProps {
  href: string
  label?: string
  description?: string
}

export function DownloadButton({ href, label = 'Download', description }: DownloadButtonProps) {
  return (
    <div className="not-prose space-y-2">
      <Button asChild size="sm" className="gap-2">
        <a href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      </Button>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}
