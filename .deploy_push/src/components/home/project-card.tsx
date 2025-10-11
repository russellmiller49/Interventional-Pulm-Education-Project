import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowTopRightIcon, StarFilledIcon } from '@radix-ui/react-icons'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import type { GitHubProject, GitHubRepoStats } from '@/lib/types'

interface ProjectCardProps {
  project: GitHubProject
  stats?: GitHubRepoStats
  href?: Route
  className?: string
}

const formatter = Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function ProjectCard({ project, stats, href, className }: ProjectCardProps) {
  const projectHref = href ?? (`/tools/${project.slug}` as Route)
  const hasStats = Boolean(stats)

  return (
    <Card
      className={cn(
        'flex h-full flex-col justify-between border-border/70 bg-card/80 backdrop-blur',
        className,
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {project.categories.map((category) => (
              <span key={category} className="rounded-full bg-muted px-2 py-0.5">
                {categoryLabel(category)}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Link
            href={projectHref}
            className="text-lg font-semibold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {project.name}
          </Link>
          <p className="text-sm text-muted-foreground">{project.tagline}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="line-clamp-3 text-muted-foreground">{project.description}</p>
        <div className="h-px w-full bg-border/70" />
        <div className="flex flex-wrap gap-2">
          {project.techStack.slice(0, 4).map((tech) => (
            <Badge
              key={tech}
              variant="outline"
              className="rounded-full border-border/70 px-3 py-1 text-xs"
            >
              {tech}
            </Badge>
          ))}
          {project.techStack.length > 4 ? (
            <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
              +{project.techStack.length - 4}
            </Badge>
          ) : null}
        </div>
      </CardContent>
      {hasStats ? (
        <CardFooter className="flex flex-col gap-4 border-t border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-2">
              <StatPill
                icon={<StarFilledIcon className="h-4 w-4" />}
                label="Stars"
                value={formatter.format(stats!.stars)}
              />
              <StatPill
                icon={<ForkIcon className="h-4 w-4" />}
                label="Forks"
                value={formatter.format(stats!.forks)}
              />
              <StatPill
                icon={<IssueIcon className="h-4 w-4" />}
                label="Issues"
                value={formatter.format(stats!.openIssues)}
              />
            </div>
            <a
              href={project.repository.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              GitHub
              <ArrowTopRightIcon className="h-3 w-3" />
            </a>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  )
}

function StatPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-1">
      {icon}
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

function ForkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="6" cy="4" r="2" />
      <circle cx="18" cy="4" r="2" />
      <circle cx="12" cy="20" r="2" />
      <path d="M8 4v5a4 4 0 0 0 4 4" />
      <path d="M16 4v5a4 4 0 0 1-4 4" />
      <path d="M12 13v5" />
    </svg>
  )
}

function IssueIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function categoryLabel(category: GitHubProject['categories'][number]) {
  switch (category) {
    case 'clinical':
      return 'Clinical'
    case 'research':
      return 'Research'
    case 'education':
      return 'Education'
    case 'mobile':
      return 'Mobile'
    default:
      return category
  }
}
