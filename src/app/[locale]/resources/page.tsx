import { redirect } from '@/i18n/navigation'
import { defaultLocale, isActiveLocale } from '@/i18n/locale'

export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  redirect({
    href: '/resources/creative-commons',
    locale: isActiveLocale(locale) ? locale : defaultLocale,
  })
}
