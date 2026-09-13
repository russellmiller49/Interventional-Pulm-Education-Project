import { setRequestLocale } from 'next-intl/server'
import { CoursePage } from '@/features/ebus-guided/components/CoursePage'
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <CoursePage locale={locale} />
}
