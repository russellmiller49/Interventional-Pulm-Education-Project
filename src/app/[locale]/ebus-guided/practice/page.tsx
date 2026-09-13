import { setRequestLocale } from 'next-intl/server'
import { PracticePage } from '@/features/ebus-guided/components/PracticePage'
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <PracticePage locale={locale} />
}
