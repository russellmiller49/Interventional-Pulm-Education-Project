import Image from 'next/image'

import { BuildGuide } from '@/components/make/BuildGuide'
import { DownloadCard } from '@/components/make/DownloadCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { featuredMakeProject } from '@/data/make-projects'

export default function MakePage() {
  const project = featuredMakeProject

  return (
    <div className="space-y-16 py-16">
      <section className="container grid gap-10 overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div className="space-y-6">
          <Badge variant="info" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
            Featured project
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{project.title}</h1>
            <p className="text-lg text-muted-foreground md:text-xl">{project.tagline}</p>
            <p className="text-sm text-muted-foreground/90">{project.summary}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={`/api/download/${project.downloads[0].id}`}>
                Download STL pack
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#build-guide">Jump to build guide</a>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              License: {project.license}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Includes electronics, prints, firmware
            </Badge>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/20 to-amber-500/20">
          {project.heroImage ? (
            <Image src={project.heroImage} alt={project.title} fill className="object-cover mix-blend-screen" sizes="(min-width: 768px) 480px, 100vw" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-br from-background/20 via-transparent to-background/40" />
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-border/60 bg-background/70 p-4 text-xs text-muted-foreground">
            Built for: FDM printers ≥200 mm bed, Arduino Nano, peristaltic pump, modular airway cartridges.
          </div>
        </div>
      </section>

      <section className="container space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Download kit</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Each download routes through the future analytics-enabled API. Re-print, remix, and share improvements with the community.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {project.downloads.map((resource) => (
            <DownloadCard key={resource.id} resource={resource} />
          ))}
        </div>
      </section>

      <section id="build-guide" className="container space-y-8">
        <h2 className="text-2xl font-semibold tracking-tight">Build guide</h2>
        <BuildGuide guide={project.buildGuide} />
      </section>

      {project.resources && project.resources.length ? (
        <section className="container space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Additional resources</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {project.resources.map((resource) => (
              <Card key={resource.href} className="border-border/60 bg-card/80">
                <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
                  <a href={resource.href} target="_blank" rel="noreferrer" className="text-base font-semibold text-foreground transition hover:text-primary">
                    {resource.label}
                  </a>
                  {resource.description ? <p>{resource.description}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Disclaimers</h2>
        <div className="space-y-3 rounded-3xl border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
          {project.disclaimers.map((disclaimer) => (
            <p key={disclaimer}>
              <span className="font-semibold text-foreground">Note:</span> {disclaimer}
            </p>
          ))}
          <p className="text-xs text-muted-foreground/80">
            Downloads will route through /api/download/[fileId] once the M11 analytics backend is online. Until then, files are served directly.
          </p>
        </div>
      </section>
    </div>
  )
}
