import { setRequestLocale } from 'next-intl/server'
import {
  sharedLibrarySession,
  listSharedSlides,
} from '@/features/socrates-learning/server/shared-library'
import { SharedSlideLibrary } from '@/features/socrates-learning/components/SharedSlideLibrary'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'SOCRATES shared slide library',
  robots: { index: false, follow: false },
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const loaded = await (async () => {
    try {
      const session = await sharedLibrarySession()
      const slides = await listSharedSlides()
      return { session, slides }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'The library is unavailable.' }
    }
  })()
  if ('error' in loaded)
    return (
      <main style={{ maxWidth: 800, margin: '4rem auto', padding: '2rem' }}>
        <h1>SOCRATES</h1>
        <p role="alert">{loaded.error}</p>
        <a href={`/${locale}/login?next=/${locale}/socrates-library`}>Sign in</a>
        {' · '}
        <a href={`/${locale}/socrates-demo#library`}>Browser drafts</a>
      </main>
    )
  return (
    <SharedSlideLibrary
      initialSlides={loaded.slides}
      canPublish={loaded.session.canPublish}
      userId={loaded.session.user!.id}
      locale={locale}
    />
  )
}
