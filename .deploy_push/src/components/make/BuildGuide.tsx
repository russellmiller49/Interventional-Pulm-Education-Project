import Image from 'next/image'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { BuildGuideContent } from '@/lib/types'

interface BuildGuideProps {
  guide: BuildGuideContent
}

export function BuildGuide({ guide }: BuildGuideProps) {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">{guide.overview}</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {guide.objectives.map((objective) => (
            <li
              key={objective}
              className="flex items-start gap-2 rounded-2xl border border-border/60 bg-card/70 p-3 text-sm text-muted-foreground"
            >
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{objective}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Materials</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {guide.materials.map((material) => (
            <Card key={material.name} className="border-border/60 bg-card/80">
              <CardContent className="space-y-1 p-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between text-foreground">
                  <span className="font-semibold">{material.name}</span>
                  {material.cost ? (
                    <span className="text-xs text-muted-foreground">{material.cost}</span>
                  ) : null}
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">
                  Quantity
                </p>
                <p>{material.quantity}</p>
                {material.notes ? (
                  <p className="text-xs text-muted-foreground/80">{material.notes}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {guide.printing ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Printing &amp; Prep</h2>
          {guide.printing.description ? (
            <p className="text-sm text-muted-foreground">{guide.printing.description}</p>
          ) : null}
          <ol className="space-y-3 border-l border-border/60 pl-6 text-sm text-muted-foreground">
            {guide.printing.steps.map((step, index) => (
              <li key={index} className="relative pl-1">
                <span className="absolute -left-[1.1rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                {step}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Assembly</h2>
        <div className="space-y-4">
          {guide.assembly.map((step) => (
            <div
              key={step.title}
              className="grid gap-4 rounded-3xl border border-border/60 bg-card/70 p-4 sm:grid-cols-[0.8fr_1.2fr]"
            >
              {step.image ? (
                <div className="relative h-40 overflow-hidden rounded-2xl border border-border/50 bg-muted">
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 250px, 100vw"
                  />
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}
              <div className="space-y-2 text-sm text-muted-foreground">
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Usage &amp; maintenance</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {guide.usageTips.map((tip) => (
            <Card key={tip} className="border-border/60 bg-card/80">
              <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                    Tip
                  </Badge>
                  <span className="font-semibold text-foreground">Simulation insight</span>
                </div>
                <p>{tip}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {guide.maintenance && guide.maintenance.length ? (
          <div className="rounded-3xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            <h3 className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground/80">
              Maintenance
            </h3>
            <ul className="mt-2 space-y-2">
              {guide.maintenance.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  )
}
