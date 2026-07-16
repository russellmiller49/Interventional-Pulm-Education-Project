import type { Metadata, Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { Activity, AirVent, BadgeCheck, Box, ShieldAlert, Stethoscope } from 'lucide-react'

import { TracheostomyDisclaimer } from '@/features/tracheostomy/components/TracheostomyDisclaimer'
import { TracheostomyNav } from '@/features/tracheostomy/components/TracheostomyNav'
import { tracheostomyNavBase } from '@/features/learning-module/moduleRoutes'
import { HandoffContent } from '@/i18n/handoff'

export const metadata: Metadata = {
  title: 'Tracheostomy Knowledge Lab',
  description:
    'Interactive adult tracheostomy education covering anatomy, tube selection, airflow, routine care, emergency rescue, communication, and decannulation.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

const pathways = [
  {
    icon: Box,
    title: 'Explore the 3D tube',
    body: 'Rotate, zoom, isolate, and explode the outer cannula, inner cannula, cuff, flange, connector, obturator, and pilot system.',
  },
  {
    icon: AirVent,
    title: 'See airflow change',
    body: 'Compare an inflated cuff, deflated cuff, one-way speaking valve, and cap with animated inspiration and expiration paths.',
  },
  {
    icon: ShieldAlert,
    title: 'Rehearse emergencies',
    body: 'Practice blocked-tube, fresh-displacement, speaking-valve distress, and sentinel-bleed decisions with feedback after commitment.',
  },
  {
    icon: BadgeCheck,
    title: 'Plan the next step',
    body: 'Choose tube features by function and anatomy, then review decannulation readiness as domains—not a false precision score.',
  },
] as const

export default async function TracheostomyOverviewPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 pb-16 pt-8 md:pt-12">
          <section className="container">
            <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 shadow-2xl">
              <Image
                src="/tracheostomy/tracheostomy-hero.png"
                alt="Stylized adult neck cutaway with a non-branded tracheostomy tube positioned in the cervical trachea"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1200px"
                className="object-cover object-[62%_center] opacity-75 md:object-center md:opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/5" />
              <div className="relative flex min-h-[560px] max-w-2xl flex-col justify-center p-7 text-white md:p-12 lg:p-16">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                  Adult clinician education
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
                  Tracheostomy
                  <span className="block text-cyan-300">Knowledge Lab</span>
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 md:text-lg">
                  Build a shared mental model from skin to carina: anatomy, tube design, airflow,
                  bedside care, communication, emergency rescue, and the path toward decannulation.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={`${tracheostomyNavBase}/learn` as Route}
                    className="inline-flex items-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
                  >
                    Enter the learning lab
                  </Link>
                  <Link
                    href={`${tracheostomyNavBase}/practice` as Route}
                    className="inline-flex items-center rounded-full border border-white/30 bg-slate-950/50 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Start with a scenario
                  </Link>
                </div>
                <p className="mt-6 text-xs leading-5 text-slate-400">
                  Stylized hero illustration for orientation. Use the labeled 3D and SVG labs for
                  instructional anatomy.
                </p>
              </div>
            </div>
          </section>

          <div className="container">
            <TracheostomyDisclaimer />
          </div>

          <TracheostomyNav activeHref={tracheostomyNavBase} />

          <section className="container grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
            <article className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm md:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <Activity className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-foreground">Learning outcomes</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This module prioritizes the decisions most likely to change care or avert harm.
              </p>
              <ul className="mt-5 grid gap-3 text-sm leading-6 text-foreground">
                {[
                  'Distinguish tracheostomy, tracheotomy, cricothyrotomy, and total laryngectomy.',
                  'Connect tube dimensions and component design to ventilation, secretion clearance, speech, and rescue.',
                  'Sequence the cognitive steps of bronchoscopy-guided percutaneous tracheostomy and identify forced stop points.',
                  'Execute the first moves for obstruction, displacement, speaking-valve distress, and possible tracheo-innominate fistula.',
                  'Frame communication, swallowing, downsizing, and decannulation as multidisciplinary readiness decisions.',
                ].map((objective) => (
                  <li key={objective} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </article>

            <div className="grid gap-4 sm:grid-cols-2">
              {pathways.map((pathway) => (
                <article
                  key={pathway.title}
                  className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm"
                >
                  <pathway.icon className="h-6 w-6 text-sky-500" aria-hidden />
                  <h2 className="mt-4 text-lg font-semibold text-foreground">{pathway.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{pathway.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="container">
            <div className="grid gap-6 rounded-3xl border border-border/70 bg-muted/30 p-6 md:grid-cols-3 md:p-8">
              {[
                [
                  '1 · Learn',
                  'Build anatomy and physiology before revealing clinical consequences.',
                ],
                [
                  '2 · Practice',
                  'Commit to a sequence or rescue decision, then receive source-linked feedback.',
                ],
                [
                  '3 · Assess',
                  'Complete a ten-item knowledge check with explanations after each answer.',
                ],
              ].map(([title, body]) => (
                <div key={title}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
