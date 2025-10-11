import Image from 'next/image'
import Link from 'next/link'

import { Hero } from '@/components/home/hero'
import { AnimatedCounter } from '@/components/home/animated-counter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { projects } from '@/data/projects'
import { anatomyModels } from '@/data/printable-models'
import { trainingModules } from '@/data/training-modules'
// GitHub integrations are prepared in `src/lib/home/github-data.ts` for future rollout.

export default function HomePage() {
  const toolsCount = projects.length
  const downloadsCount = anatomyModels.reduce((total, model) => total + model.downloads.length, 0)
  const contributorsCount = null

  const quickLinks = [
    {
      title: 'Learn',
      description: 'Interactive anatomy viewer, MDX-powered guides, and curated playlists.',
      href: '/learn/anatomy',
    },
    {
      title: 'Make',
      description: 'Open-source simulators, printable models, and full build guides.',
      href: '/make',
    },
    {
      title: 'Training',
      description: 'Competency-based modules with checklists, quizzes, and progress tracking.',
      href: '/training',
    },
    {
      title: 'Community',
      description: 'Meet the contributors, join discussions, and request new features.',
      href: '/community/contributors',
    },
  ] as const

  return (
    <div className="space-y-24 py-12 md:py-16">
      <div className="container">
        <Hero />
      </div>

      {/* Featured projects temporarily hidden until GitHub integrations return */}

      <section aria-labelledby="mission" className="container">
        <div className="grid gap-12 overflow-hidden rounded-3xl border border-border/70 bg-muted/30 p-8 md:grid-cols-[1.1fr_0.9fr] md:p-12">
          <div className="space-y-6">
            <Badge
              variant="success"
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            >
              Mission
            </Badge>
            <h2 id="mission" className="text-3xl font-semibold tracking-tight md:text-4xl">
              Building the open education stack for airway innovators
            </h2>
            <p className="text-base text-muted-foreground md:text-lg">
              From printable anatomy and hands-on labs to analytics-ready registries, we are
              co-creating the infrastructure that accelerates training and research in
              interventional pulmonology—no gatekeepers, no license fees.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <AnimatedCounter
                value={toolsCount}
                label="Open tools"
                description="Actively maintained repositories ready to deploy."
              />
              <AnimatedCounter
                value={downloadsCount}
                label="Printable assets"
                description="STL &amp; GLB files for rapid prototyping and teaching."
              />
              <AnimatedCounter
                value={contributorsCount}
                label="Contributors"
                description="Engineers, educators, and clinicians collaborating globally."
                fallbackLabel="Join us"
              />
            </div>
          </div>
          <div className="relative isolate">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-sky-500/30 to-teal-500/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-slate-100 shadow-xl">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.4em] text-slate-300/80">
                  Inside the lab
                </p>
                <ul className="space-y-3 text-sm text-slate-100/90">
                  <li>• Scenario design guided by multi-disciplinary faculty.</li>
                  <li>• Metrics pipelines aligned with accreditation milestones.</li>
                  <li>• Print farms producing rehearsal-ready anatomy overnight.</li>
                  <li>• Fellows pairing with engineers for rapid prototyping.</li>
                </ul>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200/80">
                  <p className="font-semibold uppercase tracking-[0.3em] text-slate-200">
                    Training modules live
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {trainingModules.length}+ competency tracks
                  </p>
                  <p className="text-xs text-slate-300">
                    Download checklists, watch annotated cases, and export QA reports.
                  </p>
                </div>
              </div>
              <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/10">
                    <Image
                      src="/window.svg"
                      alt="Airway simulation"
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Simulation Lab 03</p>
                    <p className="text-xs text-slate-300">
                      Rigid scope rehearsal · Real-time analytics
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="quick-access" className="container space-y-6">
        <div className="flex flex-col gap-2">
          <h2 id="quick-access" className="text-3xl font-semibold tracking-tight md:text-4xl">
            Quick access
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Get where you need to go—whether you&apos;re launching a tool, preparing a fellow, or
            printing tomorrow&apos;s model.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex h-full flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-6 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:-translate-y-1 hover:border-primary/50"
            >
              <div className="space-y-3">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {link.title}
                </span>
                <p className="text-sm text-muted-foreground">{link.description}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Explore
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="cta" className="container">
        <div className="grid gap-8 overflow-hidden rounded-3xl border border-border/70 bg-primary/10 p-10 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Badge
              variant="info"
              className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
            >
              Stay in the loop
            </Badge>
            <h2
              id="cta"
              className="text-3xl font-semibold tracking-tight text-primary-foreground md:text-4xl"
            >
              Contribute, collaborate, and get the latest drops
            </h2>
            <p className="text-base text-primary-foreground/80 md:text-lg">
              Star the GitHub org to follow releases, and join the mailing list for calls for
              contributors, new modules, and anatomy drops.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild elevated>
                <Link
                  href="https://github.com/interventional-pulm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit GitHub
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-white/60 bg-white/10 text-primary-foreground hover:bg-white/20"
              >
                Coming soon
              </Button>
            </div>
          </div>
          <form
            className="flex flex-col gap-4 rounded-2xl border border-white/40 bg-white/10 p-6 text-sm text-primary-foreground/90"
            aria-label="Subscribe to newsletter"
          >
            <label htmlFor="email" className="text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              className="h-11 rounded-full border border-white/50 bg-white/80 px-4 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              disabled
            />
            <Button
              type="submit"
              disabled
              className="h-11 rounded-full bg-white text-primary hover:bg-white"
            >
              Notify me (soon)
            </Button>
            <p className="text-xs text-primary-foreground/70">
              We&apos;re finalizing the community newsletter. No spam—just release notes and
              collaboration invites.
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}
