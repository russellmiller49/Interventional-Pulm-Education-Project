import { setRequestLocale } from 'next-intl/server'
import { trainingCatalog } from '@/features/socrates-study/server/service'
import { groupCatalog, type CatalogCase } from '@/features/socrates-study/projections'
import { StudyShell } from '@/features/socrates-study/components/shared'
import styles from '@/features/socrates-study/components/study.module.css'
export const dynamic = 'force-dynamic'
export default async function SocratesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  let cases: CatalogCase[] = []
  let error = false
  try {
    cases = await trainingCatalog()
  } catch {
    error = true
  }
  return (
    <StudyShell locale={locale}>
      <div className={styles.eyebrow}>SOCRATES</div>
      <h1>Training case directory</h1>
      <p>
        Choose a case, inspect the image, then review the authored interpretation. Testing is a
        separate experience for enrolled study participants.
      </p>
      <div className={styles.banner}>
        Unlisted study module · Training and testing require authorized participant access.
      </div>
      <nav className={styles.nav}>
        <a href={`/${locale}/socrates/testing`}>Enter testing</a>
        <a href={`/${locale}/socrates-demo`}>Open the demonstration sandbox</a>
      </nav>
      {error ? (
        <p role="status">The case catalog is temporarily unavailable. Please try again later.</p>
      ) : cases.length === 0 ? (
        <p>No reviewed training cases have been published yet.</p>
      ) : (
        groupCatalog(cases).map(([category, entries]) => (
          <section key={category} aria-label={category}>
            <h2>{category}</h2>
            <div className={styles.cards}>
              {entries.map((c) => (
                <article key={c.id} className={styles.card}>
                  <h3>
                    <a href={`/${locale}/socrates/training/${c.id}`}>{c.title}</a>
                  </h3>
                  {c.subcategory && <p>{c.subcategory}</p>}
                  <p className={styles.small}>Training · revision {c.revision}</p>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </StudyShell>
  )
}
