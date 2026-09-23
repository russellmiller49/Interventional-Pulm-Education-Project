import { setRequestLocale } from 'next-intl/server'
import {
  trainingCatalog,
  curriculumCatalog,
  directoryProgress,
} from '@/features/socrates-study/server/service'
import { CurriculumDirectory } from '@/features/socrates-study/components/CurriculumDirectory'
import { StudyShell } from '@/features/socrates-study/components/shared'
import styles from '@/features/socrates-study/components/study.module.css'
export const dynamic = 'force-dynamic'
export default async function SocratesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ module?: string }>
}) {
  const { locale } = await params
  const { module } = await searchParams
  setRequestLocale(locale)
  const result = await Promise.all([
    trainingCatalog(),
    curriculumCatalog(),
    directoryProgress(),
  ]).catch(() => null)
  return (
    <StudyShell locale={locale}>
      <div className={styles.eyebrow}>SOCRATES</div>
      <div className={styles.banner}>
        Unlisted study module · Training and testing require authorized participant access.
      </div>
      <nav className={styles.nav}>
        <a href={`/${locale}/socrates/testing`}>Enter testing</a>
        <a href={`/${locale}/socrates-demo`}>Open the demonstration sandbox</a>
      </nav>
      {result ? (
        <CurriculumDirectory
          locale={locale}
          selected={module}
          cases={result[0]}
          modules={result[1]}
          progress={result[2]}
        />
      ) : (
        <>
          <h1>SOCRATES training modules</h1>
          <p role="status">The curriculum is temporarily unavailable. Please try again later.</p>
        </>
      )}
    </StudyShell>
  )
}
