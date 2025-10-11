import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { formatDuration } from '@/lib/format-duration'
import type { TrainingModule } from '@/lib/types'

const categoryLabels: Record<TrainingModule['category'], string> = {
  'rigid-bronchoscopy': 'Rigid Bronchoscopy',
  ebus: 'EBUS',
  navigation: 'Navigation',
  ablation: 'Ablation',
  stents: 'Airway Stents',
}

const difficultyLabels: Record<TrainingModule['difficulty'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

interface ModuleCardProps {
  module: TrainingModule
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <Card className="flex h-full flex-col justify-between border-border/70 bg-card/80">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]"
          >
            {categoryLabels[module.category]}
          </Badge>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {formatDuration(module.durationMinutes)} total
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{module.title}</h3>
          <p className="text-sm text-muted-foreground">{module.summary}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="rounded-full px-3 py-1 capitalize">
            {difficultyLabels[module.difficulty]}
          </Badge>
          {module.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full px-3 py-1">
              {tag}
            </Badge>
          ))}
        </div>
        <ul className="space-y-2 text-xs text-muted-foreground/90">
          {module.objectives.slice(0, 2).map((objective) => (
            <li key={objective} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{objective}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border/60 bg-muted/20 p-4">
        <span className="text-xs text-muted-foreground">
          Prereqs: {module.prerequisites.length}
        </span>
        <Link
          href={`/training/${module.slug}`}
          className="text-sm font-semibold text-primary transition hover:text-primary/80"
        >
          View module →
        </Link>
      </CardFooter>
    </Card>
  )
}
