import type { Route } from 'next'
import { permanentRedirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function LegacyHamiltonC6VentilationPage({ params }: PageProps) {
  const { locale } = await params
  permanentRedirect(`/${locale}/mechanical-ventilation` as Route)
}
