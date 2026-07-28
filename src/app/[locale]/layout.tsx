import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Layout as AppLayout } from '@/components/layout/Layout'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { SiteUsageTracker } from '@/components/analytics/SiteUsageTracker'
import { CriticalCareAccountSync } from '@/features/critical-care/components/CriticalCareAccountSync'
import { buildCriticalCarePublicClientCatalog } from '@/features/critical-care/content/publicCatalog.server'
import { Toaster } from '@/components/ui/toaster'
import { getLocaleDirection } from '@/i18n/locale'
import { localeStaticParams } from '@/i18n/path'
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/cn'
import '@/styles/globals.css'
import '@/styles/fluoroview.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

interface LocaleLayoutProps {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0ea5e9' },
    { media: '(prefers-color-scheme: dark)', color: '#0284c7' },
  ],
}

export function generateStaticParams() {
  return localeStaticParams()
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return {
    title: {
      default: t('title'),
      template: `%s | ${t('title')}`,
    },
    description: t('description'),
  }
}

export default async function RootLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)
  const messages = await getMessages()
  const common = await getTranslations('common')

  return (
    <html
      lang={locale}
      dir={getLocaleDirection(locale)}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className={cn('min-h-screen bg-background font-sans antialiased', inter.variable)}>
        <a href="#main-content" className="skip-link">
          {common('skipToContent')}
        </a>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AppLayout>{children}</AppLayout>
            <SiteUsageTracker />
            <CriticalCareAccountSync
              activities={buildCriticalCarePublicClientCatalog().activities}
            />
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
