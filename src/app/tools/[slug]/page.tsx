import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { projects } from '@/data/projects'
import { toolDetails } from '@/data/tool-details'
import { getIssuesByLabel, getRepo } from '@/lib/github-api'
import { projectStatusLabels, toolCategoryLabels } from '@/lib/types'

interface ToolPageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const project = projects.find((item) => item.slug === params.slug)

  if (!project) {
    return {
      title: 'Tool not found',
    }
  }

  return {
    title: `${project.name} | Tool Overview`,
    description: project.tagline,
    openGraph: {
      title: project.name,
      description: project.description,
      url: `https://interventionalpulm.org/tools/${project.slug}`,
      images: project.heroImage ? [project.heroImage] : undefined,
    },
  }
}

export default async function ToolDetailPage({ params }: ToolPageProps) {
  const project = projects.find((item) => item.slug === params.slug)

  if (!project) {
    notFound()
  }

  const repoResponse = await getRepo(project.repository.owner, project.repository.name, {
    revalidate: 300,
  })
  const issuesResponse = await getIssuesByLabel(project.repository.owner, project.repository.name, 'good first issue', {
    perPage: 5,
    revalidate: 600,
  })

  const jsonLd = buildSoftwareApplicationJsonLd(project)

  return (
    <div className="space-y-20 py-16">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="container">
        <div className="grid gap-10 overflow-hidden rounded-3xl border border-border/70 bg-card/60 p-10 md:grid-cols-[1.1fr_0.9fr]">
          <ToolHero project={project} stats={repoResponse.data} />
          <ToolScreenshot project={project} />
        </div>
      </section>

      <section className="container grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <ToolKeyFeatures projectSlug={project.slug} />
        <ToolHighlights detailSlug={project.slug} />
      </section>

      <section className="container grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolHowItWorks detailSlug={project.slug} />
        <ToolUseCases detailSlug={project.slug} />
      </section>

      <section className="container grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <ToolGettingStarted detailSlug={project.slug} />
        <ToolTechStack project={project} />
      </section>

      <section className="container">
        <ToolContributing
          project={project}
          issues={issuesResponse.data}
          isRateLimited={issuesResponse.meta.rateLimited}
        />
      </section>
    </div>
  )
}

function buildSoftwareApplicationJsonLd(project: (typeof projects)[number]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.name,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Cross-platform',
    description: project.description,
    image: project.heroImage ?? undefined,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'Interventional Pulmonology Collaborative',
    },
    url: `https://interventionalpulm.org/tools/${project.slug}`,
  }
}

function ToolHero({
  project,
  stats,
}: {
  project: (typeof projects)[number]
  stats: Awaited<ReturnType<typeof getRepo>>['data']
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
          {projectStatusLabels[project.status]}
        </Badge>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {project.categories.map((category) => (
            <span key={category} className="rounded-full bg-muted px-2 py-0.5">
              {toolCategoryLabels[category]}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{project.name}</h1>
        <p className="text-lg text-muted-foreground md:text-xl">{project.tagline}</p>
        <p className="max-w-2xl text-muted-foreground">{project.description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {project.demoUrl ? (
          <Button asChild size="lg">
            <a href={project.demoUrl} target="_blank" rel="noreferrer">
              Try the live demo
            </a>
          </Button>
        ) : null}
        <Button asChild size="lg" variant="outline">
          <a href={project.repository.url} target="_blank" rel="noreferrer">
            View GitHub repo
          </a>
        </Button>
        {project.documentation ? (
          <Button asChild size="lg" variant="ghost">
            <a href={project.documentation} target="_blank" rel="noreferrer">
              Read documentation
            </a>
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
        <Stat label="Stars" value={stats?.stars} />
        <Stat label="Forks" value={stats?.forks} />
        <Stat label="Open issues" value={stats?.openIssues} />
        <Stat label="Last updated" value={stats?.updatedAt ? new Date(stats.updatedAt).toLocaleDateString() : undefined} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value?: number | string }) {
  if (!value && value !== 0) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="inline-flex h-2 w-2 rounded-full bg-muted" />
        <span className="text-muted-foreground">{label}: —</span>
      </span>
    )
  }

  const formatted = typeof value === 'number' ? Intl.NumberFormat('en', { notation: 'compact' }).format(value) : value
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
      <span className="inline-flex h-2 w-2 rounded-full bg-primary/70" />
      <span>{label}:</span>
      <span className="text-muted-foreground">{formatted}</span>
    </span>
  )
}

function ToolScreenshot({ project }: { project: (typeof projects)[number] }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-teal-500/20">
      {project.heroImage ? (
        <Image
          src={project.heroImage}
          alt={`${project.name} hero screenshot`}
          width={1200}
          height={900}
          className="h-full w-full object-cover"
          priority
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
          <span className="text-sm font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
            Preview coming soon
          </span>
          <p className="max-w-sm text-sm">
            We&apos;re working on production screenshots for this tool. Explore the demo or documentation for a deeper look.
          </p>
        </div>
      )}
    </div>
  )
}

function ToolKeyFeatures({ projectSlug }: { projectSlug: string }) {
  const detail = toolDetails[projectSlug]
  if (!detail) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Badge variant="info" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Key features
        </Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Why teams rely on it</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{detail.summary}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {detail.features.map((feature) => (
          <Card key={`${projectSlug}-${feature.title}`} className="border-border/70 bg-card/80">
            <CardContent className="space-y-2 p-5">
              <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ToolHighlights({ detailSlug }: { detailSlug: string }) {
  const detail = toolDetails[detailSlug]
  if (!detail?.demoLinks?.length && !detail?.documentationLinks?.length) {
    return null
  }

  return (
    <div className="space-y-4 rounded-3xl border border-border/60 bg-muted/30 p-6">
      <h3 className="text-lg font-semibold">Quick links</h3>
      <div className="space-y-3 text-sm text-muted-foreground">
        {detail.demoLinks?.map((link) => (
          <ExternalLinkCard key={link.href} label={link.label} href={link.href} description={link.description} />
        ))}
        {detail.documentationLinks?.map((link) => (
          <ExternalLinkCard key={link.href} label={link.label} href={link.href} description={link.description} />
        ))}
      </div>
    </div>
  )
}

function ExternalLinkCard({ label, href, description }: { label: string; href: string; description?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col rounded-2xl border border-border/70 bg-card/70 p-4 transition hover:border-primary hover:text-primary"
    >
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
    </a>
  )
}

function ToolHowItWorks({ detailSlug }: { detailSlug: string }) {
  const detail = toolDetails[detailSlug]
  if (!detail) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          How it works
        </Badge>
        <h2 className="text-2xl font-semibold tracking-tight">From install to impact</h2>
        <p className="text-sm text-muted-foreground">
          A proven implementation path that teams use to deploy, govern, and grow the project inside their institutions.
        </p>
      </div>
      <ol className="space-y-4 border-l border-border/70 pl-6 text-sm text-muted-foreground">
        {detail.gettingStarted.steps.map((step, index) => (
          <li key={index} className="relative pl-2">
            <span className="absolute -left-[1.33rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
            {step}
          </li>
        ))}
      </ol>
    </div>
  )
}

function ToolUseCases({ detailSlug }: { detailSlug: string }) {
  const detail = toolDetails[detailSlug]
  if (!detail) {
    return null
  }

  return (
    <div className="space-y-6 rounded-3xl border border-border/60 bg-card/70 p-6">
      <div className="space-y-1">
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Use cases
        </Badge>
        <h3 className="text-xl font-semibold text-foreground">Where it shines</h3>
      </div>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {detail.useCases.map((useCase) => (
          <li key={useCase} className="rounded-2xl border border-border/50 bg-background/60 p-3">
            {useCase}
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4 text-xs text-muted-foreground">
        Have a unique workflow? Share it with the community to appear here in the next release.
      </div>
    </div>
  )
}

function ToolGettingStarted({ detailSlug }: { detailSlug: string }) {
  const detail = toolDetails[detailSlug]
  if (!detail) {
    return null
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Badge variant="success" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Getting started
        </Badge>
        <h2 className="text-2xl font-semibold tracking-tight">Deploy in under an hour</h2>
        <p className="text-sm text-muted-foreground">
          Everything you need to boot, configure, and start inviting collaborators.
        </p>
      </div>
      <div className="rounded-3xl border border-border/70 bg-card/70 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Requirements</h3>
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          {detail.gettingStarted.requirements.map((requirement) => (
            <li key={requirement} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary/70" />
              <span>{requirement}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ToolTechStack({ project }: { project: (typeof projects)[number] }) {
  return (
    <div className="space-y-5 rounded-3xl border border-border/60 bg-muted/30 p-6">
      <h3 className="text-lg font-semibold">Technology stack</h3>
      <div className="flex flex-wrap gap-2">
        {project.techStack.map((tech) => (
          <Badge key={tech} variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
            {tech}
          </Badge>
        ))}
      </div>
      {project.keywords?.length ? (
        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">Keywords</p>
          <p>{project.keywords.join(', ')}</p>
        </div>
      ) : null}
    </div>
  )
}

function ToolContributing({
  project,
  issues,
  isRateLimited,
}: {
  project: (typeof projects)[number]
  issues: Awaited<ReturnType<typeof getIssuesByLabel>>['data']
  isRateLimited: boolean
}) {
  return (
    <div className="space-y-6 rounded-3xl border border-border/70 bg-card/70 p-8">
      <div className="space-y-2">
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Contributing
        </Badge>
        <h2 className="text-3xl font-semibold tracking-tight">Join the build</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pitch in on new features, triage issues, or share implementation feedback. The maintainers are active on
          GitHub and welcome co-builders.
        </p>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
          Start with the contributor guide in the repository README and review the project&apos;s code of conduct. All
          discussions happen in the GitHub Discussions board linked below.
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Open issues</h3>
          {isRateLimited ? (
            <p className="text-sm text-muted-foreground">
              GitHub rate limit reached. Try again in a few minutes or check the repo directly.
            </p>
          ) : issues && issues.length > 0 ? (
            <ul className="space-y-3">
              {issues.map((issue) => (
                <li key={issue.id} className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={issue.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground transition hover:text-primary"
                    >
                      #{issue.number} · {issue.title}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      Updated {new Date(issue.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {issue.labels.length ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {issue.labels.map((label) => (
                        <span
                          key={label.id}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-primary"
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No issues tagged &ldquo;good first issue&rdquo; right now. Check the backlog on GitHub for other opportunities.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={`${project.repository.url}/issues`} target="_blank" rel="noreferrer">
              Browse issues
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`${project.repository.url}/discussions`} target="_blank" rel="noreferrer">
              Join discussions
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
