'use client'

import Link from 'next/link'
import type { Route } from 'next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function Hero() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-sky-500/90 via-sky-500/80 to-teal-500/80 p-[1px] shadow-lg">
      <section
        className={cn(
          'relative isolate flex flex-col gap-8 overflow-hidden rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-sky-950/80 via-sky-900/70 to-teal-900/70 px-8 py-16 text-white shadow-[0_20px_60px_-40px_rgba(14,165,233,0.8)]',
          'md:px-16 md:py-24',
        )}
      >
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),_transparent_55%)]" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_bottom,_rgba(20,184,166,0.25),_transparent_65%)] blur-3xl" />
        </div>
        <div className="max-w-xl space-y-6">
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
            Interventional Pulmonology Education
          </span>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Education &amp; Innovation in Interventional Pulmonology
          </h1>
          <p className="text-base text-sky-100 md:text-lg">
            Explore EBUS training, podcast journal clubs, 3D anatomy, Nav Bronch, board review, and
            FluoroView simulation modules built for interventional pulmonology learners and
            educators.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-11 rounded-full bg-white text-sky-900 hover:bg-sky-100"
            >
              <Link href={'/ebus-training' as Route}>Open EBUS Training</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 rounded-full border-white/60 bg-transparent text-white hover:border-white hover:bg-white/10"
            >
              <Link href={'/journal-club-podcasts' as Route}>Browse Podcast Library</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link
            href={'/ebus-training' as Route}
            className="px-4 py-2 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
          >
            EBUS Training
          </Link>
          <Link
            href={'/journal-club-podcasts' as Route}
            className="px-4 py-2 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
          >
            Podcast Library
          </Link>
          <Link
            href={'/tnm-9-staging' as Route}
            className="px-4 py-2 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
          >
            TNM-9
          </Link>
          <Link
            href={'/learn/anatomy' as Route}
            className="px-4 py-2 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
          >
            3D Anatomy
          </Link>
          <Link
            href={'/bronch-navigation-trainer' as Route}
            className="px-4 py-2 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
          >
            Nav Bronch
          </Link>
          <Link
            href={'/fluoroview' as Route}
            className="px-4 py-2 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
          >
            FluoroView
          </Link>
          <Link
            href={'/board-prep' as Route}
            className="px-4 py-2 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
          >
            Board Prep
          </Link>
          <Link
            href={'/resources' as Route}
            className="px-4 py-2 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
          >
            Resources
          </Link>
        </div>
      </section>
    </div>
  )
}
