import Image from 'next/image'
import Link from 'next/link'

import { Hero } from '@/components/home/hero'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
// GitHub integrations are prepared in `src/lib/home/github-data.ts` for future rollout.

export default function HomePage() {
  const featureHighlights = [
    {
      badge: 'Simulation',
      title: 'FluoroView',
      description:
        'Rotate a labeled tracheobronchial tree under simulated fluoroscopy to drill RAO/LAO and cranial/caudal projections before lab day.',
      href: '/fluoroview',
      cta: 'Launch FluoroView',
    },
    {
      badge: '3D Models',
      title: 'Interactive Anatomy Viewer',
      description:
        'Stream GLB and STL assets with live segmentation toggles, cross-sectional slicing, and board-ready annotations.',
      href: '/learn/anatomy',
      cta: 'Browse 3D Models',
    },
    {
      badge: 'Board Review',
      title: 'IP Board Review Chapters',
      description:
        'Case-based coverage of malignant, benign, and procedural domains mapped to the interventional pulmonology exam blueprint.',
      href: '/board-prep',
      cta: 'Start Board Prep',
    },
    {
      badge: 'Training Lab',
      title: 'Rigid Bronchoscopy Foundations',
      description:
        'Simulation-forward curriculum with checklists, video briefs, and competency tracking for scope rehearsal.',
      href: '/training/rigid-bronchoscopy-foundations',
      cta: 'Launch Module',
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
            <div className="grid gap-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80">
                  3D Anatomy
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  Launch the interactive model library
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Stream segmented GLB/OBJ anatomy with clipping planes, callouts, and case-aligned
                  presets for lab prep and board review.
                </p>
                <Button asChild className="mt-4 w-fit">
                  <Link href="/learn/anatomy">Explore 3D Models</Link>
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="secondary" className="rounded-full px-6">
                  <Link href="/board-prep">Board Review Library</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6">
                  <Link href="/training/rigid-bronchoscopy-foundations">Rigid Bronch Lab</Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-slate-900 p-8 text-slate-100 shadow-xl">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.4em] text-slate-200/80">Board Review</p>
                <h3 className="text-2xl font-semibold text-white">
                  Interventional Pulmonology exam prep
                </h3>
                <p className="text-sm text-slate-100/80">
                  Walk through malignant, benign, and procedural domains with curated question
                  banks, image-rich cases, and competency checklists.
                </p>
                <ul className="space-y-2 text-xs text-slate-200/80">
                  <li>• Organized by ABMS IP blueprint with cross-links to anatomy assets.</li>
                  <li>
                    • Impact-focused pearls, complication mitigations, and board-style questions.
                  </li>
                </ul>
              </div>
              <Button asChild className="mt-6 w-fit">
                <Link href="/board-prep">Visit Board Review</Link>
              </Button>
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-slate-100 shadow-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/10">
                  <Image
                    src="/window.svg"
                    alt="Simulation lab"
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-300/80">
                    Simulation Lab 03
                  </p>
                  <h3 className="text-lg font-semibold text-white">
                    Rigid Bronchoscopy Foundations
                  </h3>
                  <p className="text-sm text-slate-200/80">
                    Downloadable checklists, video walk-throughs, and analytics-ready competency
                    tracking for your next scope rehearsal.
                  </p>
                </div>
              </div>
              <Button asChild variant="secondary" className="mt-6 w-fit">
                <Link href="/training/rigid-bronchoscopy-foundations">Open training module</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="featured-pathways" className="container space-y-6">
        <div className="flex flex-col gap-2">
          <h2 id="featured-pathways" className="text-3xl font-semibold tracking-tight md:text-4xl">
            Featured pathways
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Dive straight into the experiences that are live today: board prep chapters, interactive
            models, and simulation-ready curricula.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureHighlights.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex h-full flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-6 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:-translate-y-1 hover:border-primary/50"
            >
              <div className="space-y-3">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {link.badge}
                </span>
                <h3 className="text-lg font-semibold text-foreground">{link.title}</h3>
                <p className="text-sm text-muted-foreground">{link.description}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {link.cta}
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
              We&apos;re shipping new board review chapters and lab kits every quarter. Join the
              list and we&apos;ll reach out when fresh anatomy drops or contributor calls open.
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
