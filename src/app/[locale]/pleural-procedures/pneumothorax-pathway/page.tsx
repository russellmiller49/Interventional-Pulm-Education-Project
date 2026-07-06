import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { pneumothoraxNavBase } from '@/features/learning-module/moduleRoutes'
import { PneumothoraxNav } from '@/features/pneumothorax-pathway/components/PneumothoraxNav'
import { getPneumothoraxObjectives } from '@/features/pneumothorax-pathway/content/learnContent'
import { HandoffContent } from '@/i18n/handoff'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'pneumothoraxPathway.overview',
  })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

const base = pneumothoraxNavBase

export default async function PneumothoraxPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pneumothoraxPathway')
  const nav = await getTranslations('navigation')

  const objectives = getPneumothoraxObjectives(locale)

  const pathSteps = [
    { href: `${base}/learn`, step: '1', key: 'learn' },
    { href: `${base}/practice`, step: '2', key: 'practice' },
    { href: `${base}/assessment`, step: '3', key: 'assessment' },
  ] as const

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ModuleHeader
            eyebrow={nav('items.pleuralProcedures.title')}
            title={t('overview.headerTitle')}
            description={t('overview.headerDescription')}
          />
          <PneumothoraxNav activeHref={base} />

          <section className="container max-w-4xl space-y-6">
            <div className="rounded-lg border border-border/80 bg-card p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t('overview.objectivesLead')}
              </p>
              <ul className="mt-3 grid gap-2 text-sm leading-7 text-foreground">
                {objectives.map((objective) => (
                  <li key={objective} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                    />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {pathSteps.map((stepItem) => (
                <Link
                  key={stepItem.href}
                  href={stepItem.href as Route}
                  className="group rounded-lg border border-border/80 bg-card p-5 shadow-sm transition-colors hover:border-sky-500/60 hover:bg-sky-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-sky-600">
                    {stepItem.step}
                  </span>
                  <h2 className="mt-4 text-lg font-semibold text-foreground">
                    {t(`overview.steps.${stepItem.key}.title`)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t(`overview.steps.${stepItem.key}.description`)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      }
    </HandoffContent>
  )
}
