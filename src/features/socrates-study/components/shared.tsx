import type { ReactNode } from 'react'
import {
  annotationLegendIssues,
  type AnnotationLegend,
} from '@/features/socrates-builder/case-content'
import type { TeachingContent } from '../projections'
import styles from './study.module.css'
export function StudyShell({ locale, children }: { locale: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <nav className={styles.nav} aria-label="SOCRATES navigation">
        <a href={`/${locale}/socrates`}>SOCRATES · Training cases</a>
        <a href={`/${locale}/socrates/testing`}>Testing</a>
      </nav>
      {children}
      <p className={styles.small}>
        For education and research only. Not for clinical diagnosis. Completing cases does not
        establish clinical competency or certification.
      </p>
    </div>
  )
}
export function AnnotationKey({ legend }: { legend: AnnotationLegend }) {
  return (
    <section aria-label="Annotation color key">
      <h3>Annotation / color key</h3>
      {!legend.reviewed || annotationLegendIssues(legend).length > 0 ? (
        <p>Annotation key pending review</p>
      ) : (
        <div className={styles.legend}>
          {legend.entries.map((e, i) => (
            <div key={i} className={styles.legendEntry}>
              <span
                aria-hidden="true"
                className={styles.swatch}
                style={{ backgroundColor: e.color }}
              />
              <div>
                <strong>{e.label}</strong>
                {e.explanation && <p>{e.explanation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
export function Interpretation({ teaching }: { teaching: TeachingContent }) {
  return (
    <>
      {(['adequacy', 'cancer', 'preliminaryDiagnosis'] as const).map(
        (key, i) =>
          teaching[key] && (
            <section key={key}>
              <h3>{['Adequacy', 'Cancer designation', 'Preliminary diagnosis'][i]}</h3>
              <strong>{teaching[key]!.designation || 'Interpretation pending review'}</strong>
              <p>{teaching[key]!.reasoning}</p>
            </section>
          ),
      )}
    </>
  )
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/socrates/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Request unavailable.')
  return data as T
}
