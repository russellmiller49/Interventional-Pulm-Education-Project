import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'SOCRATES Library',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function SocratesBuilderPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  redirect(`/${locale}/socrates-library`)
}
