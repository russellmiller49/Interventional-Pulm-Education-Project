'use client'
import { useEffect, useState } from 'react'
import { api } from './shared'
import styles from './study.module.css'
interface EnrolledStudy {
  id: string
  title: string
  version: string
  active: boolean
  rounds: { key: string; title: string; completed: number; total: number; nextOrder: number }[]
}
export function StudyDirectory({ locale }: { locale: string }) {
  const [studies, setStudies] = useState<EnrolledStudy[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api<EnrolledStudy[]>('studies')
      .then(setStudies)
      .catch((e) => setError(e.message))
  }, [])
  async function start(studyId: string, round: string, position: number) {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ attemptId: string }>('start', { studyId, round, position })
      window.location.assign(`/${locale}/socrates/testing/${result.attemptId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open case.')
      setBusy(false)
    }
  }
  return (
    <>
      <div className={styles.eyebrow}>SOCRATES study</div>
      <h1>Testing</h1>
      <p>
        Each round uses its configured cases and survey. Responses are saved to your authenticated
        study account.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!studies && !error && <p role="status">Loading your study rounds…</p>}
      {studies?.length === 0 && (
        <div className={styles.banner}>
          No study enrollment is available. Contact your study administrator.
        </div>
      )}
      {studies?.map((study) => (
        <section key={study.id}>
          <h2>{study.title}</h2>
          <p>
            Version {study.version} · {study.active ? 'Active' : 'Paused'}
          </p>
          <div className={styles.cards}>
            {study.rounds.map((round) => (
              <article key={round.key} className={styles.card}>
                <h3>{round.title}</h3>
                <p>
                  {round.completed} of {round.total} cases completed
                </p>
                {round.completed < round.total ? (
                  <button
                    disabled={busy || !study.active}
                    onClick={() => void start(study.id, round.key, round.nextOrder)}
                  >
                    Continue {round.title}
                  </button>
                ) : (
                  <p role="status">Round completed</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
