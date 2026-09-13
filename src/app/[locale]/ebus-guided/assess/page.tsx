import { setRequestLocale } from 'next-intl/server'
import { AssessPage } from '@/features/ebus-guided/components/AssessPage'
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <AssessPage locale={locale} />
}
