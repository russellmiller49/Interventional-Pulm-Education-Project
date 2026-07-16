import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeft, ArrowRight, BookOpen, ClipboardCheck, PlayCircle } from 'lucide-react'

import { Quiz } from '@/components/training/Quiz'
import { Badge } from '@/components/ui/badge'
import { HandoffContent } from '@/i18n/handoff'
import { cn } from '@/lib/cn'

import {
  getNextIntroBronchoscopyModule,
  getPreviousIntroBronchoscopyModule,
} from '../content/modules'
import type { IntroBronchoscopyModule } from '../types'
import { IntroBronchoscopyProgressToggle } from './IntroBronchoscopyProgressToggle'
import { IntroPracticeActivities } from './IntroPracticeActivities'
import { IntroConceptVisual } from './IntroVisuals'

interface IntroBronchoscopyModulePageProps {
  module: IntroBronchoscopyModule
}

export function IntroBronchoscopyModulePage({ module }: IntroBronchoscopyModulePageProps) {
  const previous = getPreviousIntroBronchoscopyModule(module.slug)
  const next = getNextIntroBronchoscopyModule(module.slug)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <section className="container space-y-6">
            <Link
              href={'/intro-bronchoscopy' as Route}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Intro to bronchoscopy curriculum
            </Link>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                <Badge
                  variant="info"
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  Intro bronchoscopy · {module.estimatedMinutes} min
                </Badge>
                <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
                  {module.title}
                </h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                  {module.summary}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Syllabus coverage
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {module.syllabusSections.map((section) => (
                    <span
                      key={section}
                      className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      Section {section}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/70 p-5">
              <p className="text-sm font-semibold text-foreground">Learning objectives</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground md:grid-cols-2">
                {module.objectives.map((objective) => (
                  <li key={objective} className="flex gap-2">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="learn" className="container max-w-5xl space-y-5">
            <SectionHeading icon={BookOpen} title="Learn" />
            <div className="grid gap-5">
              {module.learnBlocks.map((block) => (
                <article
                  key={block.id}
                  className="grid gap-5 rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]"
                >
                  <div className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground">{block.title}</h2>
                    {block.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                    {block.bullets?.length ? (
                      <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
                        {block.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2">
                            <span
                              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80"
                              aria-hidden
                            />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {block.visual ? <IntroConceptVisual visual={block.visual} /> : null}
                </article>
              ))}
            </div>
            <IntroBronchoscopyProgressToggle
              moduleId={module.id}
              section="learn"
              label="Mark learn section"
            />
          </section>

          <section id="practice" className="container max-w-5xl space-y-5">
            <SectionHeading icon={PlayCircle} title="Practice" />
            <IntroPracticeActivities activities={module.practiceActivities} />
            <IntroBronchoscopyProgressToggle
              moduleId={module.id}
              section="practice"
              label="Mark practice section"
            />
          </section>

          <section id="assessment" className="container max-w-5xl space-y-5">
            <SectionHeading icon={ClipboardCheck} title="Assessment" />
            <Quiz
              title={`${module.shortTitle} knowledge check`}
              questions={module.assessmentItems}
            />
            <IntroBronchoscopyProgressToggle
              moduleId={module.id}
              section="assessment"
              label="Mark assessment section"
            />
          </section>

          {module.safetyNotes.length > 0 && (
            <section className="container max-w-5xl space-y-3">
              {module.safetyNotes.map((note) => (
                <p
                  key={note.title}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-muted-foreground"
                >
                  <span className="font-semibold text-foreground">{note.title}.</span> {note.text}
                </p>
              ))}
            </section>
          )}

          <section className="container max-w-5xl">
            <div className="grid gap-3 md:grid-cols-2">
              <ModuleJump module={previous} direction="previous" />
              <ModuleJump module={next} direction="next" />
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}

function SectionHeading({ icon: Icon, title }: { icon: typeof BookOpen; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
    </div>
  )
}

function ModuleJump({
  module,
  direction,
}: {
  module?: IntroBronchoscopyModule
  direction: 'previous' | 'next'
}) {
  if (!module) {
    return <div className="hidden md:block" />
  }

  const isNext = direction === 'next'
  return (
    <Link
      href={`/intro-bronchoscopy/${module.slug}` as Route}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5',
        isNext && 'md:justify-end md:text-right',
      )}
    >
      {!isNext && <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isNext ? 'Next module' : 'Previous module'}
        </span>
        <span className="mt-1 block text-sm font-semibold text-foreground">{module.title}</span>
      </span>
      {isNext && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
    </Link>
  )
}
