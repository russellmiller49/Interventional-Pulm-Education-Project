import { setRequestLocale } from 'next-intl/server'
import { requireSocratesUser } from '@/features/socrates-study/server/service'
import { libraryReleases } from '@/features/socrates-learning/server/shared-library'
import { publishedLibraryDocument } from '@/features/socrates-learning/shared-library'
import { PublishedModules } from '@/features/socrates-learning/components/PublishedModules'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'SOCRATES teaching and testing',
  robots: { index: false, follow: false },
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const loaded = await (async () => {
    try {
      const session = await requireSocratesUser()
      const slides = await libraryReleases()
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
        <a href={`/${locale}/login?next=/${locale}/socrates/learn`}>Sign in</a>
        {' · '}
        <a href={`/${locale}/socrates-demo#library`}>Browser drafts</a>
      </main>
    )
  return (
    <PublishedModules
      progressKey={`socrates-published-progress:${loaded.session.user.id}`}
      documents={loaded.slides.map((r) => publishedLibraryDocument(r.document, r.assignment, r.id))}
      assignments={Object.fromEntries(loaded.slides.map((r) => [r.id, r.assignment]))}
    />
  )
}
