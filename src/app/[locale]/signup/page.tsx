import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'

const handoffMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.signup' })
  return {
    ...handoffMetadata,
    title: t('metadataTitle'),
  }
}

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'auth.signup' })

  return (
    <AuthShell title={t('title')} description={t('description')} showPromo>
      <Suspense fallback={<p className="text-sm text-muted-foreground">{t('loading')}</p>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  )
}
