import type { Metadata, Route } from 'next'
import { Activity, Crosshair, Flame, ShieldCheck, Stethoscope } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { therapeuticBronchoscopyModules } from '@/data/therapeutic-bronchoscopy'
import { HandoffContent } from '@/i18n/handoff'
import { Link } from '@/i18n/navigation'

interface PageProps {
  params: Promise<{ locale: string }>
}

const moduleIcons = {
  airwayStents: Activity,
  peripheralAblation: Crosshair,
  rigidBronchoscopy: Stethoscope,
  thermalAblation: Flame,
} as const

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'therapeuticBronchoscopy' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function TherapeuticBronchoscopyPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('therapeuticBronchoscopy')

  return (
    <HandoffContent>
      <div className="space-y-12 pb-16 pt-8 md:pt-12">
        <section className="container">
          <div className="relative overflow-hidden rounded-3xl border border-sky-400/25 bg-gradient-to-br from-sky-950 via-slate-950 to-teal-950 px-6 py-10 text-white shadow-xl md:px-10 md:py-14">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_44%)]"
            />
            <div className="relative max-w-4xl space-y-5">
              <Badge className="rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                {t('eyebrow')}
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{t('title')}</h1>
              <p className="max-w-3xl text-base leading-7 text-slate-200 md:text-lg">
                {t('description')}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="therapeutic-submodules" className="container space-y-6">
          <div className="max-w-3xl space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              {t('collectionLabel')}
            </p>
            <h2 id="therapeutic-submodules" className="text-3xl font-semibold tracking-tight">
              {t('chooseTitle')}
            </h2>
            <p className="text-base leading-7 text-muted-foreground">{t('chooseBody')}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {therapeuticBronchoscopyModules.map((module) => {
              const Icon = moduleIcons[module.id]

              return (
                <Link
                  key={module.id}
                  href={module.href as Route}
                  className="group flex min-h-64 flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-500/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
                >
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300">
                        <Icon className="h-6 w-6" aria-hidden />
                      </span>
                      <Badge variant="info" className="rounded-full px-3 py-1 text-xs uppercase">
                        {t(`modules.${module.id}.badge`)}
                      </Badge>
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                      {t(`modules.${module.id}.title`)}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {t(`modules.${module.id}.description`)}
                    </p>
                  </div>
                  <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {t(`modules.${module.id}.cta`)}
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="container">
          <div className="flex gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 text-sm leading-6">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
            <div>
              <h2 className="font-semibold text-foreground">{t('disclaimerTitle')}</h2>
              <p className="mt-1 text-muted-foreground">{t('disclaimerBody')}</p>
            </div>
          </div>
        </section>
      </div>
    </HandoffContent>
  )
}
