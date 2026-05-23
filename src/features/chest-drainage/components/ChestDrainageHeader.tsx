import { Badge } from '@/components/ui/badge'

import { EducationalDisclaimer } from './EducationalDisclaimer'

interface ChestDrainageHeaderProps {
  eyebrow?: string
  title: string
  description: string
  showDisclaimer?: boolean
}

export function ChestDrainageHeader({
  eyebrow = 'Pleural procedures',
  title,
  description,
  showDisclaimer = true,
}: ChestDrainageHeaderProps) {
  return (
    <section className="container space-y-5">
      <div className="max-w-4xl space-y-3">
        <Badge
          variant="info"
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
        >
          {eyebrow}
        </Badge>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
            {description}
          </p>
        </div>
      </div>
      {showDisclaimer ? <EducationalDisclaimer /> : null}
    </section>
  )
}
